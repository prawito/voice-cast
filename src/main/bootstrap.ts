import { app, ipcMain, shell } from 'electron'
import { IndicatorWindow } from './indicator-window'
import { SettingsWindow } from './settings-window'
import { createTray } from './tray'
import { TranscriptionService } from './transcription-service'
import { InjectionService } from './injection-service'
import { HotkeyManager } from './hotkey-manager'
import { RecordingController } from './recording-controller'
import { SettingsStore } from './settings-store'
import { ModelManager } from './model-manager'
import { checkPermissions, logPermissionGuidance } from './permissions'
import { IPC } from './ipc-channels'
import { MAX_RECORDING_MS } from '../shared/constants'
import type {
  AudioSubmitPayload,
  AudioSubmitResult,
  HotkeyId,
  RebindResult,
  Settings
} from '../shared/types'

export async function bootstrap(): Promise<void> {
  console.log('[VoiceCast] bootstrap starting')

  const permissions = checkPermissions()
  logPermissionGuidance(permissions)

  const settings = new SettingsStore()
  await settings.load()

  const models = new ModelManager()
  await models.migrateLegacyModels()

  const indicator = new IndicatorWindow()
  await indicator.create()
  indicator.webContents?.on('console-message', (_e, level, msg, line, src) => {
    const tag = ['LOG', 'WARN', 'ERROR', 'INFO'][level] ?? `L${level}`
    console.log(`[renderer ${tag}] ${msg}  (${src}:${line})`)
  })

  const settingsWindow = new SettingsWindow()
  const tray = createTray({
    onSettings: () => {
      settingsWindow.open().catch((err) => console.error('[VoiceCast] settings open error:', err))
    },
    onQuit: () => {
      indicator.destroy()
      settingsWindow.close()
    }
  })
  void tray

  const controller = new RecordingController()
  const hotkey = new HotkeyManager()
  const transcription = new TranscriptionService(settings, models)
  const injection = new InjectionService()

  let recordingTimer: NodeJS.Timeout | null = null

  controller.on('state', (state, message) => {
    indicator.pushState({ state, message })
  })

  controller.on('startRecording', () => {
    indicator.show()
    indicator.sendStart()
    if (recordingTimer) clearTimeout(recordingTimer)
    recordingTimer = setTimeout(() => {
      console.warn('[VoiceCast] max recording duration reached, auto-stopping')
      controller.toggle()
    }, MAX_RECORDING_MS)
  })

  controller.on('stopRecording', () => {
    if (recordingTimer) {
      clearTimeout(recordingTimer)
      recordingTimer = null
    }
    indicator.sendStop()
  })

  models.on('progress', (payload) => {
    settingsWindow.pushProgress(payload)
  })

  ipcMain.handle(
    IPC.AUDIO_SUBMIT,
    async (_e, payload: AudioSubmitPayload): Promise<AudioSubmitResult> => {
      console.log(
        `[VoiceCast] audio submitted: ${payload.buffer.byteLength} bytes, ${payload.durationMs.toFixed(0)} ms`
      )

      if (payload.buffer.byteLength === 0) {
        controller.setError('no audio captured')
        scheduleIdle(controller, indicator, 1500)
        return { ok: true, text: '' }
      }

      let text: string
      try {
        text = await transcription.transcribe(payload.buffer)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[VoiceCast] transcription error:', message)
        const userMessage = /belum diunduh/i.test(message)
          ? 'model belum diunduh, buka Settings'
          : 'transcription failed'
        controller.setError(userMessage)
        scheduleIdle(controller, indicator, 2500)
        return { ok: false, error: message }
      }

      if (!text.trim()) {
        controller.setError('no text recognized')
        scheduleIdle(controller, indicator, 1500)
        return { ok: true, text: '' }
      }

      controller.setInjecting()
      const result = await injection.inject(text)
      if (result.pasted) {
        controller.setDone(text)
        scheduleIdle(controller, indicator, 1000)
      } else {
        controller.setClipboardOnly(text)
        if (result.error) console.warn('[VoiceCast] paste fallback:', result.error)
        scheduleIdle(controller, indicator, 2000)
      }
      return { ok: true, text }
    }
  )

  ipcMain.handle(IPC.SETTINGS_GET, () => settings.get())
  ipcMain.handle(IPC.SETTINGS_UPDATE, async (_e, patch: Partial<Settings>) => {
    return settings.update(patch)
  })
  ipcMain.handle(IPC.MODELS_LIST, () => models.list())
  ipcMain.handle(IPC.MODEL_DOWNLOAD, async (_e, name: string) => {
    try {
      await models.download(name)
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message }
    }
  })

  hotkey.setHandler('toggle', () => {
    console.log(`[VoiceCast] hotkey fired (state=${controller.state()})`)
    controller.toggle()
  })
  hotkey.setHandler('settings', () => {
    settingsWindow.open().catch((err) => console.error('[VoiceCast] settings open error:', err))
  })
  const applyResult = hotkey.applyAll(settings.get().hotkeys)
  if (!applyResult.ok) {
    console.warn(`[VoiceCast] hotkey registration failed for: ${applyResult.failed.join(', ')}`)
  }
  app.on('will-quit', () => hotkey.unregisterAll())

  ipcMain.handle(
    IPC.HOTKEY_REBIND,
    async (_e, payload: { which: HotkeyId; accelerator: string | null }): Promise<RebindResult> => {
      const result = hotkey.rebind(payload.which, payload.accelerator)
      if (result.ok) {
        await settings.update({
          hotkeys: { ...settings.get().hotkeys, [payload.which]: payload.accelerator }
        })
      }
      return result
    }
  )

  ipcMain.handle(IPC.HOTKEY_LISTENING, (_e, listening: boolean) => {
    if (listening) hotkey.pauseAll()
    else hotkey.resumeAll()
  })

  ipcMain.handle(IPC.OPEN_EXTERNAL, async (_e, url: string) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        console.warn(`[VoiceCast] refused to open non-http(s) url: ${url}`)
        return
      }
      await shell.openExternal(parsed.toString())
    } catch (err) {
      console.warn(`[VoiceCast] openExternal failed for ${url}:`, err)
    }
  })

  controller.reset()
  const { toggle, settings: settingsAccel } = settings.get().hotkeys
  console.log(
    `[VoiceCast] ready — toggle=${toggle ?? '(none)'}, settings=${settingsAccel ?? '(none)'}`
  )

  await settingsWindow.open()
}

function scheduleIdle(
  controller: RecordingController,
  indicator: IndicatorWindow,
  delayMs: number
) {
  setTimeout(() => {
    controller.reset()
    indicator.hide()
  }, delayMs)
}
