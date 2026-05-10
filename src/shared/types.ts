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

export interface Settings {
  modelName: string
}

export interface ModelInfo {
  name: string
  sizeBytes: number
  description: string
  downloaded: boolean
  downloading: boolean
}

export interface ModelProgress {
  modelName: string
  receivedBytes: number
  totalBytes: number
  done: boolean
  error?: string
  attempt?: number
  maxAttempts?: number
  retryInMs?: number
  resuming?: boolean
}

export type WindowVoiceCastApi = {
  onState: (cb: (payload: StateUpdatePayload) => void) => () => void
  onRecordingStart: (cb: () => void) => () => void
  onRecordingStop: (cb: () => void) => () => void
  submitAudio: (payload: AudioSubmitPayload) => Promise<AudioSubmitResult>
  getSettings: () => Promise<Settings>
  updateSettings: (patch: Partial<Settings>) => Promise<Settings>
  listModels: () => Promise<ModelInfo[]>
  downloadModel: (name: string) => Promise<{ ok: boolean; error?: string }>
  onModelProgress: (cb: (payload: ModelProgress) => void) => () => void
}

declare global {
  interface Window {
    voicecast: WindowVoiceCastApi
  }
}
