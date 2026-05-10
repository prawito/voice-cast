import { Menu, Tray, app, nativeImage } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export interface TrayCallbacks {
  onSettings: () => void
  onQuit: () => void
}

export function createTray(callbacks: TrayCallbacks): Tray {
  const iconPath = join(__dirname, '../../resources/iconTemplate.png')
  const image = nativeImage.createFromPath(iconPath)
  image.setTemplateImage(true)

  const tray = new Tray(image)
  tray.setToolTip('VoiceCast (idle)')

  const menu = Menu.buildFromTemplate([
    { label: 'VoiceCast — walking skeleton', enabled: false },
    { type: 'separator' },
    { label: 'Settings…', click: () => callbacks.onSettings() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        callbacks.onQuit()
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
  return tray
}
