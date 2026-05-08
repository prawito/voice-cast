import { encodeWav, computeRMS } from './wav-encoder'

export interface CaptureResult {
  wav: ArrayBuffer
  durationMs: number
  rms: number
}

export class AudioCapture {
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private buffersByChannel: Float32Array[][] = []
  private totalSamples = 0
  private startTime = 0
  private capturing = false

  async start(): Promise<void> {
    if (this.capturing) return
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    })
    this.context = new AudioContext()
    this.source = this.context.createMediaStreamSource(this.stream)
    const bufferSize = 4096
    const channelCount = this.source.channelCount || 1
    this.processor = this.context.createScriptProcessor(bufferSize, channelCount, channelCount)
    this.buffersByChannel = Array.from({ length: channelCount }, () => [])
    this.totalSamples = 0

    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer
      for (let c = 0; c < input.numberOfChannels; c++) {
        const data = input.getChannelData(c)
        this.buffersByChannel[c].push(new Float32Array(data))
      }
      this.totalSamples += input.length
    }

    this.source.connect(this.processor)
    this.processor.connect(this.context.destination)
    this.startTime = performance.now()
    this.capturing = true
  }

  async stop(): Promise<CaptureResult | null> {
    if (!this.capturing) return null
    this.capturing = false
    const durationMs = performance.now() - this.startTime

    this.processor?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    const sourceSampleRate = this.context?.sampleRate ?? 48000
    await this.context?.close()

    const channels: Float32Array[] = this.buffersByChannel.map((chunks) =>
      flatten(chunks, this.totalSamples)
    )

    this.context = null
    this.source = null
    this.processor = null
    this.stream = null

    if (channels.length === 0 || channels[0].length === 0) return null

    const wav = encodeWav({ channels, sourceSampleRate })
    const rms = computeRMS(channels[0])

    return { wav, durationMs, rms }
  }
}

function flatten(chunks: Float32Array[], total: number): Float32Array {
  const out = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}
