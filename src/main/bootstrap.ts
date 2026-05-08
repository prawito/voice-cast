import { app, ipcMain } from 'electron'
import { IndicatorWindow } from './indicator-window'
import { createTray } from './tray'
import { TranscriptionService } from './transcription-service'
import { InjectionService } from './injection-service'
import { HotkeyManager } from './hotkey-manager'
import { RecordingController } from './recording-controller'
import { checkPermissions, logPermissionGuidance } from './permissions'
import { IPC } from './ipc-channels'
import { MAX_RECORDING_MS } from '../shared/constants'
import type { AudioSubmitPayload, AudioSubmitResult } from '../shared/types'

export async function bootstrap(): Promise<void> {
  console.log('[VoiceCast] bootstrap starting')

  const permissions = checkPermissions()
  logPermissionGuidance(permissions)

  const indicator = new IndicatorWindow()
  await indicator.create()
  const tray = createTray(() => indicator.destroy())
  void tray

  const controller = new RecordingController()
  const hotkey = new HotkeyManager()
  const transcription = new TranscriptionService()
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
        controller.setError('transcription failed')
        scheduleIdle(controller, indicator, 1500)
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

  hotkey.registerToggle(() => controller.toggle())
  app.on('will-quit', () => hotkey.unregisterAll())

  controller.reset()
  console.log('[VoiceCast] ready — press Cmd+Shift+V to dictate')
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
