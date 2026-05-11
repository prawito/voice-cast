import { app } from 'electron'
import {
  promises as fs,
  existsSync,
  createWriteStream,
  statSync,
  truncateSync,
  lstatSync,
  readlinkSync,
  unlinkSync
} from 'node:fs'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { request } from 'node:https'
import type { IncomingMessage } from 'node:http'
import { URL } from 'node:url'

export interface ModelDefinition {
  name: string
  sizeBytes: number
  description: string
}

export interface ModelInfo extends ModelDefinition {
  downloaded: boolean
  downloading: boolean
}

export interface ModelProgress {
  modelName: string
  receivedBytes: number
  totalBytes: number
  done: boolean
  error?: string
  attempt?: number
  maxAttempts?: number
  retryInMs?: number
  resuming?: boolean
}

const MODELS: ModelDefinition[] = [
  { name: 'tiny', sizeBytes: 75 * 1024 * 1024, description: 'Smallest, fastest, lowest accuracy' },
  { name: 'base', sizeBytes: 142 * 1024 * 1024, description: 'Fast but hallucinates on Indonesian' },
  { name: 'small', sizeBytes: 466 * 1024 * 1024, description: 'Balanced — recommended baseline' },
  { name: 'medium', sizeBytes: 1500 * 1024 * 1024, description: 'High accuracy, slower' },
  { name: 'large-v3-turbo', sizeBytes: 1600 * 1024 * 1024, description: 'Near large quality, faster' },
  { name: 'large-v3', sizeBytes: 3100 * 1024 * 1024, description: 'Best accuracy, slowest' }
]

const MAX_ATTEMPTS = 6
const STALL_TIMEOUT_MS = 30_000
const MAX_BACKOFF_MS = 30_000

type Events = {
  progress: [ModelProgress]
}

export class ModelManager extends EventEmitter<Events> {
  private modelsDir: string
  private linkDir: string
  private downloading = new Set<string>()

  constructor() {
    super()
    this.modelsDir = join(app.getPath('userData'), 'models')
    this.linkDir = join(
      app.getAppPath(),
      'node_modules',
      'nodejs-whisper',
      'cpp',
      'whisper.cpp',
      'models'
    )
  }

  list(): ModelInfo[] {
    return MODELS.map((m) => ({
      ...m,
      downloaded: existsSync(this.modelPath(m.name)),
      downloading: this.downloading.has(m.name)
    }))
  }

  isDownloaded(name: string): boolean {
    return existsSync(this.modelPath(name))
  }

  async migrateLegacyModels(): Promise<void> {
    await fs.mkdir(this.modelsDir, { recursive: true })
    if (!existsSync(this.linkDir)) return

    let entries: string[]
    try {
      entries = await fs.readdir(this.linkDir)
    } catch (err) {
      console.warn('[VoiceCast] could not read whisper models dir:', err)
      return
    }

    for (const entry of entries) {
      if (!entry.startsWith('ggml-') || !entry.endsWith('.bin')) continue

      const linkPath = join(this.linkDir, entry)
      let stat
      try {
        stat = await fs.lstat(linkPath)
      } catch {
        continue
      }
      if (stat.isSymbolicLink()) continue

      const realPath = join(this.modelsDir, entry)
      try {
        if (existsSync(realPath)) {
          await fs.unlink(linkPath)
        } else {
          await fs.rename(linkPath, realPath)
        }
        await fs.symlink(realPath, linkPath)
        console.log(`[VoiceCast] migrated model ${entry} to userData`)
      } catch (err) {
        console.warn(`[VoiceCast] failed to migrate ${entry}:`, err)
      }
    }
  }

  async ensureLinked(name: string): Promise<void> {
    if (!MODELS.find((m) => m.name === name)) {
      throw new Error(`Unknown model: ${name}`)
    }

    const fileName = `ggml-${name}.bin`
    const realPath = join(this.modelsDir, fileName)
    if (!existsSync(realPath)) {
      throw new Error(
        `Model "${name}" belum diunduh. Buka Settings untuk download dulu.`
      )
    }

    const linkPath = join(this.linkDir, fileName)
    try {
      const stat = lstatSync(linkPath)
      if (stat.isSymbolicLink() && readlinkSync(linkPath) === realPath) return
      unlinkSync(linkPath)
    } catch {
      // doesn't exist — fall through to create
    }

    await fs.mkdir(this.linkDir, { recursive: true })
    await fs.symlink(realPath, linkPath)
  }

  async download(name: string): Promise<void> {
    if (!MODELS.find((m) => m.name === name)) {
      throw new Error(`Unknown model: ${name}`)
    }
    if (this.downloading.has(name)) {
      throw new Error(`Already downloading: ${name}`)
    }
    if (this.isDownloaded(name)) {
      this.emit('progress', { modelName: name, receivedBytes: 1, totalBytes: 1, done: true })
      return
    }

    this.downloading.add(name)
    const dest = this.modelPath(name)
    const tempDest = `${dest}.part`
    const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${name}.bin`

    await fs.mkdir(this.modelsDir, { recursive: true })

    let lastError: Error | null = null

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const existingBytes = existsSync(tempDest) ? statSync(tempDest).size : 0

        try {
          await this.downloadOnce(url, tempDest, name, attempt, existingBytes)
          await fs.rename(tempDest, dest)
          this.emit('progress', {
            modelName: name,
            receivedBytes: 1,
            totalBytes: 1,
            done: true,
            attempt,
            maxAttempts: MAX_ATTEMPTS
          })
          return
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          console.warn(
            `[VoiceCast] download attempt ${attempt}/${MAX_ATTEMPTS} failed for ${name}: ${lastError.message}`
          )
          if (attempt < MAX_ATTEMPTS) {
            const backoffMs = Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, attempt - 1))
            this.emit('progress', {
              modelName: name,
              receivedBytes: existsSync(tempDest) ? statSync(tempDest).size : 0,
              totalBytes: 0,
              done: false,
              error: lastError.message,
              attempt,
              maxAttempts: MAX_ATTEMPTS,
              retryInMs: backoffMs
            })
            await sleep(backoffMs)
          }
        }
      }

      this.emit('progress', {
        modelName: name,
        receivedBytes: 0,
        totalBytes: 0,
        done: true,
        error: lastError?.message ?? 'unknown error',
        attempt: MAX_ATTEMPTS,
        maxAttempts: MAX_ATTEMPTS
      })
      throw lastError ?? new Error('Download failed')
    } finally {
      this.downloading.delete(name)
    }
  }

  private modelPath(name: string): string {
    return join(this.modelsDir, `ggml-${name}.bin`)
  }

  private downloadOnce(
    url: string,
    dest: string,
    name: string,
    attempt: number,
    existingBytes: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (err?: Error) => {
        if (settled) return
        settled = true
        if (err) reject(err)
        else resolve()
      }

      const handle = (currentUrl: string, redirectsLeft: number) => {
        const parsed = new URL(currentUrl)
        const headers: Record<string, string> = { 'User-Agent': 'voicecast/0.1' }
        if (existingBytes > 0) headers['Range'] = `bytes=${existingBytes}-`

        const req = request(
          {
            method: 'GET',
            host: parsed.host,
            path: parsed.pathname + parsed.search,
            headers
          },
          (res: IncomingMessage) => {
            const status = res.statusCode ?? 0

            if (status >= 300 && status < 400 && res.headers.location) {
              if (redirectsLeft <= 0) {
                finish(new Error('Too many redirects'))
                return
              }
              res.resume()
              const next = new URL(res.headers.location, currentUrl).toString()
              handle(next, redirectsLeft - 1)
              return
            }

            if (status === 416) {
              // requested range not satisfiable — file already complete on disk
              res.resume()
              finish()
              return
            }

            if (status !== 200 && status !== 206) {
              res.resume()
              finish(new Error(`HTTP ${status} for ${currentUrl}`))
              return
            }

            const append = status === 206 && existingBytes > 0
            if (!append && existingBytes > 0) {
              try {
                truncateSync(dest, 0)
              } catch {
                // ignore — write stream will overwrite anyway
              }
            }

            const totalRemote = Number(res.headers['content-length'] ?? 0)
            const totalBytes = append ? existingBytes + totalRemote : totalRemote
            let receivedBytes = append ? existingBytes : 0

            const out = createWriteStream(dest, { flags: append ? 'a' : 'w' })

            let stallTimer: NodeJS.Timeout | null = null
            const resetStall = () => {
              if (stallTimer) clearTimeout(stallTimer)
              stallTimer = setTimeout(() => {
                req.destroy(new Error(`Stalled: no data for ${STALL_TIMEOUT_MS}ms`))
              }, STALL_TIMEOUT_MS)
            }
            resetStall()

            let lastEmit = 0
            res.on('data', (chunk: Buffer) => {
              receivedBytes += chunk.length
              resetStall()
              const now = Date.now()
              if (now - lastEmit > 250) {
                lastEmit = now
                this.emit('progress', {
                  modelName: name,
                  receivedBytes,
                  totalBytes,
                  done: false,
                  attempt,
                  maxAttempts: MAX_ATTEMPTS,
                  resuming: append
                })
              }
            })

            res.pipe(out)
            out.on('finish', () => {
              if (stallTimer) clearTimeout(stallTimer)
              out.close((err) => (err ? finish(err) : finish()))
            })
            out.on('error', (err) => {
              if (stallTimer) clearTimeout(stallTimer)
              finish(err)
            })
            res.on('error', (err) => {
              if (stallTimer) clearTimeout(stallTimer)
              finish(err)
            })
          }
        )

        req.setTimeout(STALL_TIMEOUT_MS, () => {
          req.destroy(new Error(`Connect timeout after ${STALL_TIMEOUT_MS}ms`))
        })
        req.on('error', (err) => finish(err))
        req.end()
      }

      handle(url, 5)
    })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
