import { clipboard } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface InjectionResult {
  ok: boolean
  pasted: boolean
  error?: string
}

export class InjectionService {
  async inject(text: string): Promise<InjectionResult> {
    try {
      clipboard.writeText(text)
    } catch (err) {
      return {
        ok: false,
        pasted: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }

    if (process.platform !== 'darwin') {
      return { ok: true, pasted: false, error: 'paste only implemented on macOS' }
    }

    try {
      await execFileAsync('osascript', [
        '-e',
        'tell application "System Events" to keystroke "v" using command down'
      ])
      return { ok: true, pasted: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: true, pasted: false, error: message }
    }
  }
}
