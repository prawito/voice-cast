import { globalShortcut } from 'electron'
import type { HotkeyBindings, HotkeyId, RebindResult } from '../shared/types'

type HandlerMap = Record<HotkeyId, (() => void) | null>

const IDS: HotkeyId[] = ['toggle', 'settings']

export class HotkeyManager {
  private bindings: HotkeyBindings = { toggle: null, settings: null }
  private handlers: HandlerMap = { toggle: null, settings: null }
  private paused = false

  setHandler(id: HotkeyId, fn: () => void): void {
    this.handlers[id] = fn
  }

  applyAll(bindings: HotkeyBindings): { ok: boolean; failed: HotkeyId[] } {
    globalShortcut.unregisterAll()
    this.bindings = { ...bindings }
    this.paused = false
    return this.registerAll()
  }

  pauseAll(): void {
    if (this.paused) return
    globalShortcut.unregisterAll()
    this.paused = true
    console.log('[VoiceCast] hotkeys paused (listening mode)')
  }

  resumeAll(): { ok: boolean; failed: HotkeyId[] } {
    if (!this.paused) return { ok: true, failed: [] }
    this.paused = false
    const result = this.registerAll()
    console.log('[VoiceCast] hotkeys resumed')
    return result
  }

  rebind(id: HotkeyId, accel: string | null): RebindResult {
    const handler = this.handlers[id]
    if (!handler) return { ok: false, error: 'conflict-system' }

    const old = this.bindings[id]
    if (accel === old) return { ok: true }

    if (accel === null) {
      if (!this.paused && old) globalShortcut.unregister(old)
      this.bindings[id] = null
      console.log(`[VoiceCast] hotkey ${id} cleared`)
      return { ok: true }
    }

    for (const otherId of IDS) {
      if (otherId !== id && this.bindings[otherId] === accel) {
        return { ok: false, error: 'conflict-internal' }
      }
    }

    if (!this.paused && old) globalShortcut.unregister(old)
    const ok = globalShortcut.register(accel, handler)
    if (!ok) {
      if (!this.paused && old) globalShortcut.register(old, handler)
      return { ok: false, error: 'conflict-system' }
    }
    this.bindings[id] = accel
    console.log(`[VoiceCast] hotkey ${id} rebound to ${accel}`)
    return { ok: true }
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
    this.bindings = { toggle: null, settings: null }
    this.paused = false
  }

  private registerAll(): { ok: boolean; failed: HotkeyId[] } {
    globalShortcut.unregisterAll()
    const failed: HotkeyId[] = []
    for (const id of IDS) {
      const accel = this.bindings[id]
      const handler = this.handlers[id]
      if (!accel || !handler) continue
      if (!globalShortcut.register(accel, handler)) {
        failed.push(id)
        console.error(`[VoiceCast] failed to register hotkey ${id}=${accel} (conflict?)`)
      }
    }
    return { ok: failed.length === 0, failed }
  }
}
