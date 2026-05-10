import { promises as fs, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import type { SettingsStore } from './settings-store'

const require = createRequire(import.meta.url)

let shelljsConfigured = false

function configureShelljsForElectron(): void {
  if (shelljsConfigured) return
  const candidates = ['/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node']
  let nodePath = candidates.find((p) => existsSync(p))
  if (!nodePath) {
    try {
      nodePath = execFileSync('/usr/bin/which', ['node'], { encoding: 'utf-8' }).trim()
    } catch {
      // ignore — let shelljs fail with its own error
    }
  }
  if (nodePath) {
    const shelljs = require('shelljs')
    shelljs.config.execPath = nodePath
    console.log(`[VoiceCast] shelljs.config.execPath set to ${nodePath}`)
  }
  shelljsConfigured = true
}

export class TranscriptionService {
  constructor(private settings: SettingsStore) {}

  async transcribe(wav: ArrayBuffer): Promise<string> {
    if (wav.byteLength === 0) {
      throw new Error('Empty audio buffer')
    }

    configureShelljsForElectron()

    const { modelName, language } = this.settings.get()
    console.log(`[VoiceCast] transcribing with model=${modelName}, language=${language}`)

    const tmpFile = join(tmpdir(), `voicecast-${randomUUID()}.wav`)
    await fs.writeFile(tmpFile, Buffer.from(wav))

    try {
      const { nodewhisper } = await import('nodejs-whisper')
      const result = await nodewhisper(tmpFile, {
        modelName,
        autoDownloadModelName: modelName,
        removeWavFileAfterTranscription: false,
        whisperOptions: {
          language,
          outputInText: true,
          outputInJson: false,
          outputInSrt: false,
          outputInVtt: false,
          translateToEnglish: false,
          wordTimestamps: false,
          timestamps_length: 0,
          splitOnWord: false
        }
      })

      const text = typeof result === 'string' ? result : ''
      return cleanWhisperOutput(text)
    } finally {
      await fs.unlink(tmpFile).catch(() => {})
      await fs.unlink(`${tmpFile}.txt`).catch(() => {})
    }
  }
}

function cleanWhisperOutput(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/, ''))
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .trim()
}
