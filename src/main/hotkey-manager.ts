import { globalShortcut } from 'electron'
import { HOTKEY_SETTINGS, HOTKEY_TOGGLE } from '../shared/constants'

export class HotkeyManager {
  registerToggle(callback: () => void): boolean {
    const ok = globalShortcut.register(HOTKEY_TOGGLE, callback)
    if (!ok) {
      console.error(`[VoiceCast] failed to register hotkey ${HOTKEY_TOGGLE} (conflict?)`)
    } else {
      console.log(`[VoiceCast] hotkey registered: ${HOTKEY_TOGGLE}`)
    }
    return ok
  }

  registerSettings(callback: () => void): boolean {
    const ok = globalShortcut.register(HOTKEY_SETTINGS, callback)
    if (!ok) {
      console.error(`[VoiceCast] failed to register hotkey ${HOTKEY_SETTINGS} (conflict?)`)
    } else {
      console.log(`[VoiceCast] hotkey registered: ${HOTKEY_SETTINGS}`)
    }
    return ok
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
  }
}
