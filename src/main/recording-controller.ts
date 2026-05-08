import { EventEmitter } from 'node:events'
import type { AppState } from '../shared/types'

type ControllerEvents = {
  state: [AppState, string | undefined]
  startRecording: []
  stopRecording: []
}

export class RecordingController extends EventEmitter<ControllerEvents> {
  private current: AppState = 'idle'

  state(): AppState {
    return this.current
  }

  toggle(): void {
    if (this.current === 'idle') {
      this.transition('recording', 'listening')
      this.emit('startRecording')
      return
    }
    if (this.current === 'recording') {
      this.transition('transcribing', 'transcribing…')
      this.emit('stopRecording')
      return
    }
    // ignore toggles during transcribing/injecting/done
  }

  setTranscribing(): void {
    this.transition('transcribing', 'transcribing…')
  }

  setInjecting(): void {
    this.transition('injecting', 'pasting…')
  }

  setDone(text: string): void {
    const preview = text.length > 30 ? `${text.slice(0, 30)}…` : text
    this.transition('done', preview || 'done')
  }

  setClipboardOnly(text: string): void {
    const preview = text.length > 30 ? `${text.slice(0, 30)}…` : text
    this.transition('clipboard-only', `clipboard: ${preview}`)
  }

  setError(message: string): void {
    this.transition('error', message)
  }

  reset(): void {
    this.transition('idle', 'ready')
  }

  private transition(state: AppState, message?: string): void {
    this.current = state
    this.emit('state', state, message)
  }
}
