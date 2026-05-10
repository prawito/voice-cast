import { useEffect, useState } from 'react'
import type { ModelInfo, ModelProgress } from '../../shared/types'

interface Props {
  model: ModelInfo
  selected: boolean
  progress?: ModelProgress
  onSelect: () => void
  onDownload: () => void
}

export function ModelRow({ model, selected, progress, onSelect, onDownload }: Props) {
  const isDownloading = !!progress && !progress.done
  const isWaitingRetry = !!progress && !progress.done && (progress.retryInMs ?? 0) > 0
  const sizeMb = (model.sizeBytes / 1024 / 1024).toFixed(0)

  const percent = progress
    ? progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.receivedBytes / progress.totalBytes) * 100))
      : 0
    : 0

  const baseClasses = selected
    ? 'border-blue-500 bg-blue-500/10'
    : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'

  const canSelect = model.downloaded && !selected

  const status = (() => {
    if (model.downloaded) return null
    if (!progress) return null
    if (progress.done && progress.error) return `failed: ${progress.error}`
    if (isWaitingRetry) return `retrying ${progress.attempt}/${progress.maxAttempts}`
    if (progress.resuming) return `resuming ${progress.attempt ?? 1}/${progress.maxAttempts ?? 1}`
    if (progress.attempt && progress.attempt > 1) {
      return `attempt ${progress.attempt}/${progress.maxAttempts}`
    }
    return null
  })()

  return (
    <li
      className={`flex flex-col gap-3 rounded-lg border p-4 transition ${baseClasses} ${canSelect ? 'cursor-pointer' : ''}`}
      onClick={() => canSelect && onSelect()}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
              selected ? 'border-blue-400 bg-blue-500' : 'border-zinc-600'
            }`}
          >
            {selected && <div className="h-2 w-2 rounded-full bg-white" />}
          </div>
          <div>
            <div className="text-sm font-medium">
              {model.name}
              <span className="ml-2 text-xs font-normal text-zinc-400">({sizeMb} MB)</span>
            </div>
            <div className="text-xs text-zinc-500">{model.description}</div>
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          {model.downloaded ? (
            <span className="text-xs text-emerald-400">✓ Downloaded</span>
          ) : isDownloading ? (
            <span className="text-xs text-zinc-400">{isWaitingRetry ? '…' : `${percent}%`}</span>
          ) : (
            <button
              type="button"
              onClick={onDownload}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
            >
              {progress?.done && progress.error ? 'Retry' : 'Download'}
            </button>
          )}
        </div>
      </div>

      {isDownloading && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full transition-[width] duration-200 ${isWaitingRetry ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>
              {(progress!.receivedBytes / 1024 / 1024).toFixed(1)} /{' '}
              {progress!.totalBytes > 0
                ? `${(progress!.totalBytes / 1024 / 1024).toFixed(0)} MB`
                : '? MB'}
            </span>
            {status && <span className="text-amber-400">{status}</span>}
            {!status && <span>{percent}%</span>}
          </div>
          {isWaitingRetry && progress && (
            <RetryCountdown
              key={`${model.name}-${progress.attempt}`}
              ms={progress.retryInMs ?? 0}
              error={progress.error}
            />
          )}
        </div>
      )}

      {progress?.done && progress.error && !isDownloading && (
        <div className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {progress.error}
        </div>
      )}
    </li>
  )
}

function RetryCountdown({ ms, error }: { ms: number; error?: string }) {
  const [remaining, setRemaining] = useState(ms)
  useEffect(() => {
    setRemaining(ms)
    const start = Date.now()
    const id = setInterval(() => {
      const left = Math.max(0, ms - (Date.now() - start))
      setRemaining(left)
      if (left <= 0) clearInterval(id)
    }, 200)
    return () => clearInterval(id)
  }, [ms])
  const seconds = Math.ceil(remaining / 1000)
  return (
    <div className="text-[10px] text-amber-400">
      {error ? `${error} — ` : ''}retrying in {seconds}s…
    </div>
  )
}
