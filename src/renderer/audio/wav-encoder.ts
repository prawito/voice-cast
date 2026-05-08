import { TARGET_SAMPLE_RATE } from '../../shared/constants'

export interface EncodeInput {
  channels: Float32Array[]
  sourceSampleRate: number
}

export function encodeWav({ channels, sourceSampleRate }: EncodeInput): ArrayBuffer {
  const mono = downmixToMono(channels)
  const resampled =
    sourceSampleRate === TARGET_SAMPLE_RATE
      ? mono
      : resampleLinear(mono, sourceSampleRate, TARGET_SAMPLE_RATE)
  const pcm = floatTo16BitPCM(resampled)
  return buildWavBuffer(pcm, TARGET_SAMPLE_RATE)
}

function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]
  const length = channels[0].length
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let c = 0; c < channels.length; c++) sum += channels[c][i]
    out[i] = sum / channels.length
  }
  return out
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  const ratio = fromRate / toRate
  const outLength = Math.floor(input.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio
    const i0 = Math.floor(srcIndex)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const frac = srcIndex - i0
    out[i] = input[i0] * (1 - frac) + input[i1] * frac
  }
  return out
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

function buildWavBuffer(pcm: Int16Array, sampleRate: number): ArrayBuffer {
  const byteLength = pcm.length * 2
  const buf = new ArrayBuffer(44 + byteLength)
  const view = new DataView(buf)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + byteLength, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, byteLength, true)

  let offset = 44
  for (let i = 0; i < pcm.length; i++, offset += 2) {
    view.setInt16(offset, pcm[i], true)
  }
  return buf
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

export function computeRMS(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / Math.max(samples.length, 1))
}
