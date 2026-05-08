import { IndicatorWindow } from './indicator-window'
import { createTray } from './tray'

export async function bootstrap(): Promise<void> {
  console.log('[VoiceCast] bootstrap starting')

  const indicator = new IndicatorWindow()
  await indicator.create()

  const tray = createTray(() => {
    indicator.destroy()
  })

  indicator.show()
  indicator.pushState({ state: 'idle', message: 'ready' })

  console.log('[VoiceCast] indicator window + tray created')
  return Promise.resolve(tray) as unknown as Promise<void>
}
