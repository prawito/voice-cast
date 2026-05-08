import { app } from 'electron'
import { bootstrap } from './bootstrap'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.dock?.hide()

  app.whenReady().then(() => {
    bootstrap().catch((err) => {
      console.error('[VoiceCast] bootstrap failed:', err)
      app.quit()
    })
  })

  app.on('window-all-closed', (event: Electron.Event) => {
    event.preventDefault()
  })

  app.on('will-quit', () => {
    // cleanup hook for future use
  })
}
