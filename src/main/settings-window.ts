import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IPC } from './ipc-channels'
import type { ModelProgress } from '../shared/types'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export class SettingsWindow {
  private win: BrowserWindow | null = null

  async open(): Promise<void> {
    if (this.win && !this.win.isDestroyed()) {
      this.win.show()
      this.win.focus()
      return
    }

    this.win = new BrowserWindow({
      width: 540,
      height: 640,
      title: 'VoiceCast Settings',
      resizable: true,
      minimizable: true,
      maximizable: false,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: join(__dirname, '../preload/index.cjs')
      }
    })

    this.win.on('closed', () => {
      this.win = null
    })

    this.win.once('ready-to-show', () => {
      this.win?.show()
    })

    if (process.env.ELECTRON_RENDERER_URL) {
      await this.win.loadURL(`${process.env.ELECTRON_RENDERER_URL}?page=settings`)
    } else {
      await this.win.loadFile(join(__dirname, '../renderer/index.html'), {
        search: 'page=settings'
      })
    }
  }

  pushProgress(payload: ModelProgress): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send(IPC.MODEL_PROGRESS, payload)
    }
  }

  get webContents(): Electron.WebContents | undefined {
    return this.win?.webContents
  }

  close(): void {
    this.win?.close()
    this.win = null
  }
}
