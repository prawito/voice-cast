import { useEffect, useRef, useState } from 'react'
import type { AppState } from '../shared/types'
import { AudioCapture } from './audio/audio-capture'
import { Indicator } from './components/Indicator'
import { SILENCE_RMS_THRESHOLD } from '../shared/constants'

const EMPTY_AUDIO = { buffer: new ArrayBuffer(0), durationMs: 0 }

const LEVEL_HISTORY = 5

export function IndicatorApp() {
  const [state, setState] = useState<AppState>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [levels, setLevels] = useState<number[]>(() => new Array(LEVEL_HISTORY).fill(0))
  const captureRef = useRef<AudioCapture | null>(null)

  useEffect(() => {
    const offState = window.voicecast.onState(({ state: s, message: m }) => {
      setState(s)
      setMessage(m)
      if (s !== 'recording') setLevels(new Array(LEVEL_HISTORY).fill(0))
    })

    const offStart = window.voicecast.onRecordingStart(async () => {
      if (captureRef.current) return
      const capture = new AudioCapture()
      capture.onLevel = (lvl) => {
        setLevels((prev) => {
          const next = prev.slice(1)
          next.push(lvl)
          return next
        })
      }
      captureRef.current = capture
      try {
        await capture.start()
      } catch (err) {
        console.error('[VoiceCast] mic error', err)
        captureRef.current = null
        await window.voicecast.submitAudio(EMPTY_AUDIO)
      }
    })

    const offStop = window.voicecast.onRecordingStop(async () => {
      const capture = captureRef.current
      captureRef.current = null
      if (!capture) {
        await window.voicecast.submitAudio(EMPTY_AUDIO)
        return
      }
      const result = await capture.stop()
      if (!result || result.rms < SILENCE_RMS_THRESHOLD) {
        await window.voicecast.submitAudio(EMPTY_AUDIO)
        return
      }
      await window.voicecast.submitAudio({
        buffer: result.wav,
        durationMs: result.durationMs
      })
    })

    return () => {
      offState()
      offStart()
      offStop()
    }
  }, [])

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Indicator state={state} message={message} levels={levels} />
    </div>
  )
}
