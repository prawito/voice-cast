import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crcBuf])
}

function encodePng(w, h, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 4
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = 1 + w * 2
  const raw = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < w; x++) {
      raw[y * stride + 1 + x * 2] = pixels[(y * w + x) * 2]
      raw[y * stride + 1 + x * 2 + 1] = pixels[(y * w + x) * 2 + 1]
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function drawMic(size) {
  const pixels = new Uint8Array(size * size * 2)

  const cx = size / 2

  const capW = (8 / 22) * size
  const capH = (11 / 22) * size
  const capCy = (8 / 22) * size
  const capR = capW / 2
  const capHalfFlatH = capH / 2 - capR

  const arcCy = capCy + capHalfFlatH
  const arcOuterR = (7 / 22) * size
  const arcInnerR = (5.7 / 22) * size

  const stemTop = arcCy + arcOuterR * 0.62
  const stemBottom = (19 / 22) * size
  const stemHalfW = (0.9 / 22) * size

  const baseHalfW = (4 / 22) * size
  const baseTop = stemBottom
  const baseBottom = baseTop + (1.2 / 22) * size

  const ss = 4

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss
          const py = y + (sy + 0.5) / ss

          let inside = false

          const dx = px - cx
          const dy = py - capCy
          if (Math.abs(dx) <= capR) {
            if (Math.abs(dy) <= capHalfFlatH) inside = true
            else {
              const cdy = dy > 0 ? dy - capHalfFlatH : dy + capHalfFlatH
              if (Math.sqrt(dx * dx + cdy * cdy) <= capR) inside = true
            }
          }

          if (!inside) {
            const adx = px - cx
            const ady = py - arcCy
            const adist = Math.sqrt(adx * adx + ady * ady)
            if (ady >= 0 && adist <= arcOuterR && adist >= arcInnerR) inside = true
          }

          if (!inside) {
            if (Math.abs(px - cx) <= stemHalfW && py >= stemTop && py <= stemBottom) {
              inside = true
            }
          }

          if (!inside) {
            if (Math.abs(px - cx) <= baseHalfW && py >= baseTop && py <= baseBottom) {
              inside = true
            }
          }

          if (inside) hits++
        }
      }

      const alpha = Math.round((hits / (ss * ss)) * 255)
      pixels[(y * size + x) * 2] = 0
      pixels[(y * size + x) * 2 + 1] = alpha
    }
  }

  return pixels
}

const outDir = resolve(__dirname, '..', 'resources')
mkdirSync(outDir, { recursive: true })

writeFileSync(resolve(outDir, 'iconTemplate.png'), encodePng(22, 22, drawMic(22)))
writeFileSync(resolve(outDir, 'iconTemplate@2x.png'), encodePng(44, 44, drawMic(44)))

console.log('wrote iconTemplate.png (22x22) and iconTemplate@2x.png (44x44)')
