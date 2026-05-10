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

export type HotkeyId = 'toggle' | 'settings'

export interface HotkeyBindings {
  toggle: string | null
  settings: string | null
}

export interface Settings {
  modelName: string
  language: string
  hotkeys: HotkeyBindings
}

export type RebindResult = { ok: true } | { ok: false; error: 'conflict-internal' | 'conflict-system' }

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
  rebindHotkey: (which: HotkeyId, accelerator: string | null) => Promise<RebindResult>
  setHotkeyListening: (listening: boolean) => Promise<void>
}

declare global {
  interface Window {
    voicecast: WindowVoiceCastApi
  }
}
