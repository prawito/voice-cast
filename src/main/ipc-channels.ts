export const IPC = {
  STATE_UPDATE: 'voicecast:state-update',
  RECORDING_START: 'voicecast:recording-start',
  RECORDING_STOP: 'voicecast:recording-stop',
  AUDIO_SUBMIT: 'voicecast:audio-submit',
  SETTINGS_GET: 'voicecast:settings-get',
  SETTINGS_UPDATE: 'voicecast:settings-update',
  MODELS_LIST: 'voicecast:models-list',
  MODEL_DOWNLOAD: 'voicecast:model-download',
  MODEL_PROGRESS: 'voicecast:model-progress',
  HOTKEY_REBIND: 'voicecast:hotkey-rebind',
  HOTKEY_LISTENING: 'voicecast:hotkey-listening',
  OPEN_EXTERNAL: 'voicecast:open-external'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
