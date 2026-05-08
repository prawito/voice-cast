import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IPC } from './ipc-channels'
import type { StateUpdatePayload } from '../shared/types'
import {
  INDICATOR_HEIGHT,
  INDICATOR_MARGIN,
  INDICATOR_WIDTH
} from '../shared/constants'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export class IndicatorWindow {
  private win: BrowserWindow | null = null

  async create(): Promise<void> {
    const display = screen.getPrimaryDisplay()
    const { workArea } = display
    const x = workArea.x + workArea.width - INDICATOR_WIDTH - INDICATOR_MARGIN
    const y = workArea.y + workArea.height - INDICATOR_HEIGHT - INDICATOR_MARGIN

    this.win = new BrowserWindow({
      width: INDICATOR_WIDTH,
      height: INDICATOR_HEIGHT,
      x,
      y,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      hasShadow: false,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload: join(__dirname, '../preload/index.js')
      }
    })

    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    if (process.env.ELECTRON_RENDERER_URL) {
      await this.win.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      await this.win.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  show(): void {
    this.win?.showInactive()
  }

  hide(): void {
    this.win?.hide()
  }

  pushState(payload: StateUpdatePayload): void {
    this.win?.webContents.send(IPC.STATE_UPDATE, payload)
  }

  sendStart(): void {
    this.win?.webContents.send(IPC.RECORDING_START)
  }

  sendStop(): void {
    this.win?.webContents.send(IPC.RECORDING_STOP)
  }

  get webContents(): Electron.WebContents | undefined {
    return this.win?.webContents
  }

  destroy(): void {
    this.win?.destroy()
    this.win = null
  }
}
