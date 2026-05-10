import { Mic, Check, AlertTriangle, ClipboardCopy } from 'lucide-react'
import type { AppState } from '../../shared/types'
import { WaveAnim } from './WaveAnim'
import { Spinner } from './Spinner'

interface Props {
  state: AppState
  message?: string
  levels?: number[]
}

export function Indicator({ state, message, levels }: Props) {
  return (
    <div
      className={`flex h-[72px] w-[220px] items-center gap-3 rounded-2xl bg-neutral-900/90 px-4 text-white shadow-lg ring-1 ring-white/10 backdrop-blur transition-opacity duration-300 ${
        state === 'idle' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <Glyph state={state} levels={levels} />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-sm font-semibold">{label(state)}</span>
        {message ? (
          <span className="truncate text-[11px] text-neutral-300">{message}</span>
        ) : null}
      </div>
    </div>
  )
}

function Glyph({ state, levels }: { state: AppState; levels?: number[] }) {
  switch (state) {
    case 'recording':
      return (
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-rose-400" />
          <WaveAnim levels={levels} />
        </div>
      )
    case 'transcribing':
      return <Spinner />
    case 'injecting':
      return <ClipboardCopy className="h-4 w-4 text-sky-400" />
    case 'done':
      return <Check className="h-4 w-4 text-emerald-400" />
    case 'clipboard-only':
      return <ClipboardCopy className="h-4 w-4 text-amber-300" />
    case 'error':
      return <AlertTriangle className="h-4 w-4 text-rose-400" />
    default:
      return <Mic className="h-4 w-4 text-neutral-500" />
  }
}

function label(state: AppState): string {
  switch (state) {
    case 'recording':
      return 'Listening'
    case 'transcribing':
      return 'Transcribing'
    case 'injecting':
      return 'Pasting'
    case 'done':
      return 'Done'
    case 'clipboard-only':
      return 'In Clipboard'
    case 'error':
      return 'Error'
    default:
      return 'VoiceCast'
  }
}
