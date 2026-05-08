import { useEffect, useRef, useState } from 'react'
import type { AppState } from '../shared/types'
import { AudioCapture } from './audio/audio-capture'
import { SILENCE_RMS_THRESHOLD } from '../shared/constants'

export function App() {
  const [state, setState] = useState<AppState>('idle')
  const [message, setMessage] = useState<string | undefined>('ready')
  const captureRef = useRef<AudioCapture | null>(null)

  useEffect(() => {
    const offState = window.voicecast.onState(({ state: s, message: m }) => {
      setState(s)
      setMessage(m)
    })

    const offStart = window.voicecast.onRecordingStart(async () => {
      try {
        const capture = new AudioCapture()
        captureRef.current = capture
        await capture.start()
      } catch (err) {
        console.error('[VoiceCast] mic error', err)
      }
    })

    const offStop = window.voicecast.onRecordingStop(async () => {
      const capture = captureRef.current
      captureRef.current = null
      if (!capture) return
      const result = await capture.stop()
      if (!result) {
        await window.voicecast.submitAudio({
          buffer: new ArrayBuffer(0),
          durationMs: 0
        })
        return
      }
      if (result.rms < SILENCE_RMS_THRESHOLD) {
        console.warn('[VoiceCast] silence detected, RMS=', result.rms)
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
    <div className="flex h-[72px] w-[220px] items-center gap-3 rounded-2xl bg-neutral-900/90 px-4 text-white shadow-lg ring-1 ring-white/10 backdrop-blur">
      <StateBadge state={state} />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">VoiceCast</span>
        <span className="text-[11px] text-neutral-300">{message ?? state}</span>
      </div>
    </div>
  )
}

function StateBadge({ state }: { state: AppState }) {
  const color =
    state === 'recording'
      ? 'bg-red-500'
      : state === 'transcribing'
        ? 'bg-amber-400'
        : state === 'injecting'
          ? 'bg-sky-400'
          : state === 'done'
            ? 'bg-emerald-400'
            : state === 'error'
              ? 'bg-rose-500'
              : 'bg-neutral-500'
  return <span className={`h-3 w-3 rounded-full ${color}`} />
}
