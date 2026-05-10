export const IPC = {
  STATE_UPDATE: 'voicecast:state-update',
  RECORDING_START: 'voicecast:recording-start',
  RECORDING_STOP: 'voicecast:recording-stop',
  AUDIO_SUBMIT: 'voicecast:audio-submit',
  SETTINGS_GET: 'voicecast:settings-get',
  SETTINGS_UPDATE: 'voicecast:settings-update',
  MODELS_LIST: 'voicecast:models-list',
  MODEL_DOWNLOAD: 'voicecast:model-download',
  MODEL_PROGRESS: 'voicecast:model-progress'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
