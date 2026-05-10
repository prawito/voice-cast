import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../main/ipc-channels'
import type {
  WindowVoiceCastApi,
  StateUpdatePayload,
  AudioSubmitPayload,
  AudioSubmitResult,
  Settings,
  ModelInfo,
  ModelProgress,
  HotkeyId,
  RebindResult
} from '../shared/types'

const api: WindowVoiceCastApi = {
  onState(cb) {
    const listener = (_e: unknown, payload: StateUpdatePayload) => cb(payload)
    ipcRenderer.on(IPC.STATE_UPDATE, listener)
    return () => ipcRenderer.removeListener(IPC.STATE_UPDATE, listener)
  },
  onRecordingStart(cb) {
    const listener = () => cb()
    ipcRenderer.on(IPC.RECORDING_START, listener)
    return () => ipcRenderer.removeListener(IPC.RECORDING_START, listener)
  },
  onRecordingStop(cb) {
    const listener = () => cb()
    ipcRenderer.on(IPC.RECORDING_STOP, listener)
    return () => ipcRenderer.removeListener(IPC.RECORDING_STOP, listener)
  },
  submitAudio(payload: AudioSubmitPayload): Promise<AudioSubmitResult> {
    return ipcRenderer.invoke(IPC.AUDIO_SUBMIT, payload)
  },
  getSettings(): Promise<Settings> {
    return ipcRenderer.invoke(IPC.SETTINGS_GET)
  },
  updateSettings(patch: Partial<Settings>): Promise<Settings> {
    return ipcRenderer.invoke(IPC.SETTINGS_UPDATE, patch)
  },
  listModels(): Promise<ModelInfo[]> {
    return ipcRenderer.invoke(IPC.MODELS_LIST)
  },
  downloadModel(name: string): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.MODEL_DOWNLOAD, name)
  },
  onModelProgress(cb) {
    const listener = (_e: unknown, payload: ModelProgress) => cb(payload)
    ipcRenderer.on(IPC.MODEL_PROGRESS, listener)
    return () => ipcRenderer.removeListener(IPC.MODEL_PROGRESS, listener)
  },
  rebindHotkey(which: HotkeyId, accelerator: string | null): Promise<RebindResult> {
    return ipcRenderer.invoke(IPC.HOTKEY_REBIND, { which, accelerator })
  },
  setHotkeyListening(listening: boolean): Promise<void> {
    return ipcRenderer.invoke(IPC.HOTKEY_LISTENING, listening)
  }
}

contextBridge.exposeInMainWorld('voicecast', api)
