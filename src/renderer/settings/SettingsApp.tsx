import { useEffect, useMemo, useState } from 'react'
import type { ModelInfo, ModelProgress, Settings } from '../../shared/types'
import { ModelRow } from './ModelRow'

export function SettingsApp() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [progress, setProgress] = useState<Record<string, ModelProgress>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [s, m] = await Promise.all([
        window.voicecast.getSettings(),
        window.voicecast.listModels()
      ])
      if (cancelled) return
      setSettings(s)
      setModels(m)
      setLoading(false)
    }
    load().catch((err) => console.error('[Settings] load failed', err))

    const off = window.voicecast.onModelProgress((payload) => {
      setProgress((prev) => ({ ...prev, [payload.modelName]: payload }))
      if (payload.done && !payload.error) {
        window.voicecast
          .listModels()
          .then(setModels)
          .catch((err) => console.error('[Settings] list refresh failed', err))
      }
    })

    return () => {
      cancelled = true
      off()
    }
  }, [])

  const selectedModel = settings?.modelName

  const handleSelect = async (name: string) => {
    const updated = await window.voicecast.updateSettings({ modelName: name })
    setSettings(updated)
  }

  const handleDownload = async (name: string) => {
    setProgress((prev) => ({
      ...prev,
      [name]: { modelName: name, receivedBytes: 0, totalBytes: 0, done: false }
    }))
    const result = await window.voicecast.downloadModel(name)
    if (!result.ok && result.error) {
      console.error('[Settings] download failed', result.error)
    }
  }

  const downloadedCount = useMemo(() => models.filter((m) => m.downloaded).length, [models])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">VoiceCast Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Pilih model Whisper untuk transcription. Model lebih besar = lebih akurat tapi lebih
          lambat. Tersimpan: {downloadedCount}/{models.length}.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
          Whisper Model
        </h2>
        <ul className="space-y-2">
          {models.map((m) => (
            <ModelRow
              key={m.name}
              model={m}
              selected={selectedModel === m.name}
              progress={progress[m.name]}
              onSelect={() => handleSelect(m.name)}
              onDownload={() => handleDownload(m.name)}
            />
          ))}
        </ul>
      </section>

      <footer className="mt-8 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        Settings tersimpan otomatis. Restart tidak diperlukan — perubahan model berlaku pada
        transcription berikutnya.
      </footer>
    </div>
  )
}
