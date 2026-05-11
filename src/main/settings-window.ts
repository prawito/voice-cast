import { BrowserWindow, shell } from 'electron'
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
      backgroundColor: '#09090b',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: join(__dirname, '../preload/index.cjs'),
        additionalArguments: ['--voicecast-page=settings']
      }
    })

    this.win.on('closed', () => {
      this.win = null
    })

    this.win.once('ready-to-show', () => {
      this.win?.show()
    })

    this.win.webContents.setWindowOpenHandler(({ url }) => {
      openExternalSafely(url)
      return { action: 'deny' }
    })

    this.win.webContents.on('will-navigate', (event, url) => {
      const current = this.win?.webContents.getURL() ?? ''
      if (url !== current) {
        event.preventDefault()
        openExternalSafely(url)
      }
    })

    if (process.env.ELECTRON_RENDERER_URL) {
      await this.win.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      await this.win.loadFile(join(__dirname, '../renderer/index.html'))
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

function openExternalSafely(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn(`[VoiceCast] refused non-http(s) url from settings: ${url}`)
      return
    }
    void shell.openExternal(parsed.toString())
  } catch (err) {
    console.warn(`[VoiceCast] openExternal failed for ${url}:`, err)
  }
}
