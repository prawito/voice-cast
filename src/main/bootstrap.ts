import { ipcMain } from 'electron'
import { IndicatorWindow } from './indicator-window'
import { createTray } from './tray'
import { TranscriptionService } from './transcription-service'
import { IPC } from './ipc-channels'
import type { AudioSubmitPayload, AudioSubmitResult } from '../shared/types'

export async function bootstrap(): Promise<void> {
  console.log('[VoiceCast] bootstrap starting')

  const indicator = new IndicatorWindow()
  await indicator.create()
  const tray = createTray(() => indicator.destroy())
  void tray

  const transcription = new TranscriptionService()

  ipcMain.handle(
    IPC.AUDIO_SUBMIT,
    async (_event, payload: AudioSubmitPayload): Promise<AudioSubmitResult> => {
      console.log(
        `[VoiceCast] audio submitted: ${payload.buffer.byteLength} bytes, ${payload.durationMs.toFixed(0)} ms`
      )
      indicator.pushState({ state: 'transcribing', message: 'transcribing…' })
      try {
        const text = await transcription.transcribe(payload.buffer)
        console.log('[VoiceCast] transcript:', JSON.stringify(text))
        indicator.pushState({ state: 'idle', message: text || 'no text' })
        return { ok: true, text }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[VoiceCast] transcription error:', message)
        indicator.pushState({ state: 'error', message: 'transcription failed' })
        return { ok: false, error: message }
      }
    }
  )

  indicator.show()
  indicator.pushState({ state: 'idle', message: 'ready' })

  console.log('[VoiceCast] bootstrap complete (no hotkey wired yet)')
}
