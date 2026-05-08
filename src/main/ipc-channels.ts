export const IPC = {
  STATE_UPDATE: 'voicecast:state-update',
  RECORDING_START: 'voicecast:recording-start',
  RECORDING_STOP: 'voicecast:recording-stop',
  AUDIO_SUBMIT: 'voicecast:audio-submit'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
