import { IndicatorWindow } from './indicator-window'

export async function bootstrap(): Promise<void> {
  console.log('[VoiceCast] bootstrap starting')

  const indicator = new IndicatorWindow()
  await indicator.create()
  indicator.show()
  indicator.pushState({ state: 'idle', message: 'ready' })

  console.log('[VoiceCast] indicator window created and shown')
}
