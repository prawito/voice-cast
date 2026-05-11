import { useEffect, useMemo, useState } from 'react'
import type { HotkeyId, ModelInfo, ModelProgress, Settings } from '../../shared/types'
import { LANGUAGES } from '../../shared/languages'
import { HOTKEY_TOGGLE, HOTKEY_SETTINGS } from '../../shared/constants'
import { ModelRow } from './ModelRow'
import { HotkeyRow } from './HotkeyRow'

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

  const handleLanguageChange = async (language: string) => {
    const updated = await window.voicecast.updateSettings({ language })
    setSettings(updated)
  }

  const handleRebind = async (which: HotkeyId, accelerator: string | null) => {
    const result = await window.voicecast.rebindHotkey(which, accelerator)
    if (result.ok) {
      setSettings((prev) =>
        prev ? { ...prev, hotkeys: { ...prev.hotkeys, [which]: accelerator } } : prev
      )
      return { ok: true as const }
    }
    return { ok: false as const, error: result.error }
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

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
          Language
        </h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-300">Spoken language</span>
            <select
              value={settings?.language ?? 'id'}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-zinc-500">
            Pilih sesuai bahasa yang akan kamu ucapkan. Auto-detect lebih lambat & kadang
            salah-tebak — pilih bahasa spesifik kalau hasilnya tidak akurat.
          </p>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
          Shortcuts
        </h2>
        <ul className="space-y-2">
          <HotkeyRow
            id="toggle"
            label="Toggle Recording"
            accelerator={settings?.hotkeys.toggle ?? null}
            defaultAccelerator={HOTKEY_TOGGLE}
            onRebind={(accel) => handleRebind('toggle', accel)}
          />
          <HotkeyRow
            id="settings"
            label="Open Settings"
            accelerator={settings?.hotkeys.settings ?? null}
            defaultAccelerator={HOTKEY_SETTINGS}
            onRebind={(accel) => handleRebind('settings', accel)}
          />
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          Klik Change lalu tekan kombinasi tombol. ESC untuk batal. Clear akan unbind hotkey
          (akses lewat tray menu).
        </p>
      </section>

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
        <p>
          Settings tersimpan otomatis. Restart tidak diperlukan — perubahan model berlaku pada
          transcription berikutnya.
        </p>
        <p className="mt-4 flex items-center justify-center gap-1 text-center text-zinc-500">
          <span>Made with</span>
          <span aria-label="love" className="text-rose-400">
            ♥
          </span>
          <span>by</span>
          <a
            href="https://prawito.com"
            target="_blank"
            rel="noreferrer"
            className="cursor-pointer text-zinc-300 underline underline-offset-2 hover:text-zinc-100"
          >
            Prawito Hudoro
          </a>
        </p>
      </footer>
    </div>
  )
}
