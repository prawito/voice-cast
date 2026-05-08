import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { WHISPER_LANGUAGE, WHISPER_MODEL_NAME } from '../shared/constants'

export class TranscriptionService {
  async transcribe(wav: ArrayBuffer): Promise<string> {
    if (wav.byteLength === 0) {
      throw new Error('Empty audio buffer')
    }

    const tmpFile = join(tmpdir(), `voicecast-${randomUUID()}.wav`)
    await fs.writeFile(tmpFile, Buffer.from(wav))

    try {
      const { nodewhisper } = await import('nodejs-whisper')
      const result = await nodewhisper(tmpFile, {
        modelName: WHISPER_MODEL_NAME,
        autoDownloadModelName: WHISPER_MODEL_NAME,
        removeWavFileAfterTranscription: false,
        whisperOptions: {
          language: WHISPER_LANGUAGE,
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
