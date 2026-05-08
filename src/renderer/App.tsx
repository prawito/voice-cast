import { useEffect, useState } from 'react'
import type { AppState } from '../shared/types'

export function App() {
  const [state, setState] = useState<AppState>('idle')
  const [message, setMessage] = useState<string | undefined>()

  useEffect(() => {
    const off = window.voicecast?.onState(({ state: s, message: m }) => {
      setState(s)
      setMessage(m)
    })
    return () => off?.()
  }, [])

  return (
    <div className="flex h-[72px] w-[220px] items-center gap-3 rounded-2xl bg-neutral-900/90 px-4 text-white shadow-lg ring-1 ring-white/10 backdrop-blur">
      <div className="text-sm font-medium">VoiceCast</div>
      <div className="ml-auto text-xs text-neutral-300">{message ?? state}</div>
    </div>
  )
}
