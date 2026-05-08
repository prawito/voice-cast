import { app, ipcMain } from 'electron'
import { IndicatorWindow } from './indicator-window'
import { createTray } from './tray'
import { TranscriptionService } from './transcription-service'
import { HotkeyManager } from './hotkey-manager'
import { RecordingController } from './recording-controller'
import { IPC } from './ipc-channels'
import { MAX_RECORDING_MS } from '../shared/constants'
import type { AudioSubmitPayload, AudioSubmitResult } from '../shared/types'
import { checkPermissions, logPermissionGuidance } from './permissions'

export async function bootstrap(): Promise<void> {
  console.log('[VoiceCast] bootstrap starting')

  const permissions = checkPermissions()
  logPermissionGuidance(permissions)

  const indicator = new IndicatorWindow()
  await indicator.create()
  const tray = createTray(() => {
    indicator.destroy()
  })
  void tray

  const controller = new RecordingController()
  const hotkey = new HotkeyManager()
  const transcription = new TranscriptionService()

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
      try {
        const text = await transcription.transcribe(payload.buffer)
        if (!text) {
          controller.setError('no text recognized')
          fadeIdle(controller, indicator, 1500)
          return { ok: true, text: '' }
        }
        // injection happens in next task — for now just preview
        controller.setDone(text)
        fadeIdle(controller, indicator, 1000)
        return { ok: true, text }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[VoiceCast] transcription error:', message)
        controller.setError('transcription failed')
        fadeIdle(controller, indicator, 1500)
        return { ok: false, error: message }
      }
    }
  )

  hotkey.registerToggle(() => controller.toggle())

  app.on('will-quit', () => hotkey.unregisterAll())

  indicator.show()
  controller.reset()
  console.log('[VoiceCast] bootstrap complete; press Cmd+Shift+V')
}

function fadeIdle(controller: RecordingController, indicator: IndicatorWindow, delayMs: number) {
  setTimeout(() => {
    controller.reset()
    indicator.hide()
  }, delayMs)
}
