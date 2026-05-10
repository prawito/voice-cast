import { useEffect, useRef, useState } from 'react'
import type { HotkeyId } from '../../shared/types'
import { captureFromKeyboardEvent, formatAccelerator } from '../../shared/hotkey-format'

interface Props {
  id: HotkeyId
  label: string
  accelerator: string | null
  defaultAccelerator: string
  onRebind: (accelerator: string | null) => Promise<{ ok: boolean; error?: string }>
}

export function HotkeyRow({ id, label, accelerator, defaultAccelerator, onRebind }: Props) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!listening) return
    inputRef.current?.focus()
    void window.voicecast.setHotkeyListening(true)

    const handler = async (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const result = captureFromKeyboardEvent(e)
      if (result.cancelled) {
        setListening(false)
        setError(null)
        return
      }
      if (!result.accelerator) return

      setBusy(true)
      const res = await onRebind(result.accelerator)
      setBusy(false)
      if (res.ok) {
        setListening(false)
        setError(null)
      } else {
        setError(errorMessage(res.error))
      }
    }

    window.addEventListener('keydown', handler, { capture: true })
    return () => {
      window.removeEventListener('keydown', handler, { capture: true })
      void window.voicecast.setHotkeyListening(false)
    }
  }, [listening, onRebind])

  const handleClear = async () => {
    setBusy(true)
    const res = await onRebind(null)
    setBusy(false)
    if (!res.ok) setError(errorMessage(res.error))
  }

  const handleReset = async () => {
    setBusy(true)
    const res = await onRebind(defaultAccelerator)
    setBusy(false)
    if (!res.ok) setError(errorMessage(res.error))
  }

  return (
    <li
      data-hotkey-id={id}
      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
    >
      <div className="flex min-w-0 flex-col">
        <span className="text-sm text-zinc-200">{label}</span>
        {error ? <span className="mt-1 text-xs text-rose-400">{error}</span> : null}
      </div>

      <div className="flex items-center gap-2">
        <div
          ref={inputRef}
          tabIndex={listening ? 0 : -1}
          className={`min-w-[88px] rounded-md border px-2 py-1 text-center font-mono text-sm ${
            listening
              ? 'border-rose-500 bg-rose-500/10 text-rose-200'
              : accelerator
                ? 'border-zinc-700 bg-zinc-950 text-zinc-100'
                : 'border-dashed border-zinc-700 bg-zinc-950 text-zinc-500'
          }`}
        >
          {listening ? 'Press keys…' : formatAccelerator(accelerator)}
        </div>

        {listening ? (
          <button
            type="button"
            onClick={() => {
              setListening(false)
              setError(null)
            }}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null)
                setListening(true)
              }}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Change
            </button>
            {accelerator ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleClear}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
              >
                Clear
              </button>
            ) : null}
            {accelerator !== defaultAccelerator ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleReset}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
              >
                Reset
              </button>
            ) : null}
          </>
        )}
      </div>
    </li>
  )
}

function errorMessage(error?: string): string {
  switch (error) {
    case 'conflict-internal':
      return 'Already used by another VoiceCast hotkey'
    case 'conflict-system':
      return 'Already used by macOS or another app'
    default:
      return error ?? 'Failed to bind'
  }
}
