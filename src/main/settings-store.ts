import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'

export interface Settings {
  modelName: string
}

const DEFAULTS: Settings = {
  modelName: 'small'
}

type Events = {
  change: [Settings]
}

export class SettingsStore extends EventEmitter<Events> {
  private current: Settings = { ...DEFAULTS }
  private filePath = join(app.getPath('userData'), 'settings.json')

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<Settings>
      this.current = { ...DEFAULTS, ...parsed }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        console.warn('[VoiceCast] settings load error, using defaults:', err)
      }
      await this.persist()
    }
    console.log('[VoiceCast] settings loaded:', this.current)
  }

  get(): Settings {
    return { ...this.current }
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    this.current = { ...this.current, ...patch }
    await this.persist()
    this.emit('change', this.get())
    return this.get()
  }

  private async persist(): Promise<void> {
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(this.current, null, 2), 'utf-8')
  }
}
