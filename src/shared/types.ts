export type AppState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'injecting'
  | 'done'
  | 'clipboard-only'
  | 'error'

export interface StateUpdatePayload {
  state: AppState
  message?: string
}

export interface AudioSubmitPayload {
  buffer: ArrayBuffer
  durationMs: number
}

export interface AudioSubmitResult {
  ok: boolean
  text?: string
  error?: string
}

export type WindowVoiceCastApi = {
  onState: (cb: (payload: StateUpdatePayload) => void) => () => void
  onRecordingStart: (cb: () => void) => () => void
  onRecordingStop: (cb: () => void) => () => void
  submitAudio: (payload: AudioSubmitPayload) => Promise<AudioSubmitResult>
}

declare global {
  interface Window {
    voicecast: WindowVoiceCastApi
  }
}
