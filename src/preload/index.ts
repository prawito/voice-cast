import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../main/ipc-channels'
import type {
  WindowVoiceCastApi,
  StateUpdatePayload,
  AudioSubmitPayload,
  AudioSubmitResult
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
  }
}

contextBridge.exposeInMainWorld('voicecast', api)
