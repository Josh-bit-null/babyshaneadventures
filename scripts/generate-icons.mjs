import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'client', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const mix = (a, b, t) => a + (b - a) * t
const clamp01 = (value) => Math.min(1, Math.max(0, value))

function draw({ size, maskable = false }) {
  const scale = 2
  const w = size * scale
  const h = size * scale
  const rgba = Buffer.alloc(w * h * 4)
  const s = w

  const setPixel = (x, y, color, alpha = 1) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 4
    const a = clamp01(alpha)
    const inv = 1 - a
    rgba[i] = Math.round(color[0] * a + rgba[i] * inv)
    rgba[i + 1] = Math.round(color[1] * a + rgba[i + 1] * inv)
    rgba[i + 2] = Math.round(color[2] * a + rgba[i + 2] * inv)
    rgba[i + 3] = Math.round((a + (rgba[i + 3] / 255) * inv) * 255)
  }

  const insideRoundedRect = (x, y, x0, y0, x1, y1, r) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const cx = Math.min(Math.max(x, x0 + r), x1 - r)
    const cy = Math.min(Math.max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
  }

  const insideEllipse = (x, y, cx, cy, rx, ry) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

  const drawEllipse = (cx, cy, rx, ry, colorAt, opacity = 1) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        if (insideEllipse(x + 0.5, y + 0.5, cx, cy, rx, ry)) {
          setPixel(x, y, colorAt(x, y), opacity)
        }
      }
    }
  }

  const drawRoundRect = (x0, y0, x1, y1, r, color, opacity = 1) => {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y += 1) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x += 1) {
        if (insideRoundedRect(x + 0.5, y + 0.5, x0, y0, x1, y1, r)) {
          setPixel(x, y, color, opacity)
        }
      }
    }
  }

  // background
  const bgTop = [255, 230, 238]
  const bgBottom = [255, 168, 194]
  for (let y = 0; y < h; y += 1) {
    const t = y / h
    const color = [
      Math.round(mix(bgTop[0], bgBottom[0], t)),
      Math.round(mix(bgTop[1], bgBottom[1], t)),
      Math.round(mix(bgTop[2], bgBottom[2], t)),
    ]
    for (let x = 0; x < w; x += 1) {
      const inside = maskable
        ? true
        : insideRoundedRect(x + 0.5, y + 0.5, 0, 0, w, h, w * 0.225)
      if (inside) setPixel(x, y, color, 1)
    }
  }

  const k = maskable ? 0.84 : 1
  const cx = w / 2
  const cxOf = (nx) => cx + (nx - 0.5) * w * k
  const cyOf = (ny) => h * 0.52 + (ny - 0.52) * h * k

  // soft background bubbles
  drawEllipse(w * 0.24, h * 0.2, w * 0.14, w * 0.14, () => [255, 255, 255], 0.22)
  drawEllipse(w * 0.82, h * 0.78, w * 0.2, w * 0.2, () => [255, 255, 255], 0.13)

  // shadow
  drawEllipse(cxOf(0.5), cyOf(0.83), w * 0.29 * k, h * 0.045 * k, () => [173, 105, 128], 0.22)

  // cap
  const capCenterY = cyOf(0.55)
  const capRx = w * 0.33 * k
  const capRy = h * 0.26 * k
  drawEllipse(
    cx,
    capCenterY,
    capRx,
    capRy,
    (x, y) => {
      const t = clamp01((x - (cx - capRx)) / (capRx * 2))
      const light = 1 - Math.hypot((x - cx + capRx * 0.28) / (capRx * 1.6), (y - capCenterY + capRy * 0.5) / (capRy * 1.8))
      return [
        Math.round(mix(245, 207, t) - light * 15),
        Math.round(mix(105, 70, t) - light * 8),
        Math.round(mix(110, 88, t)),
      ]
    },
    1,
  )

  // spots
  const spots = [
    [0.36, 0.5, 0.062, 0.045],
    [0.62, 0.45, 0.05, 0.036],
    [0.5, 0.61, 0.038, 0.026],
    [0.7, 0.61, 0.034, 0.024],
    [0.3, 0.64, 0.028, 0.02],
  ]
  for (const [x, y, rx, ry] of spots) {
    drawEllipse(cxOf(x), cyOf(y), w * rx * k, h * ry * k, () => [255, 246, 234], 0.95)
  }

  // stem
  const stemX0 = cxOf(0.385)
  const stemX1 = cxOf(0.615)
  drawRoundRect(
    stemX0,
    cyOf(0.62),
    stemX1,
    cyOf(0.87),
    w * 0.055 * k,
    [255, 241, 222],
    1,
  )
  drawRoundRect(
    stemX0,
    cyOf(0.83),
    stemX1,
    cyOf(0.87),
    w * 0.055 * k,
    [241, 218, 191],
    0.8,
  )

  // face
  drawEllipse(cxOf(0.455), cyOf(0.72), w * 0.021 * k, h * 0.028 * k, () => [83, 49, 58], 1)
  drawEllipse(cxOf(0.545), cyOf(0.72), w * 0.021 * k, h * 0.028 * k, () => [83, 49, 58], 1)
  drawEllipse(cxOf(0.5), cyOf(0.766), w * 0.035 * k, h * 0.014 * k, () => [138, 75, 87], 0.9)
  drawEllipse(cxOf(0.41), cyOf(0.77), w * 0.028 * k, h * 0.014 * k, () => [255, 154, 178], 0.7)
  drawEllipse(cxOf(0.59), cyOf(0.77), w * 0.028 * k, h * 0.014 * k, () => [255, 154, 178], 0.7)

  // little leaf
  drawEllipse(cxOf(0.27), cyOf(0.36), w * 0.085 * k, h * 0.035 * k, () => [116, 201, 168], 0.95)
  drawEllipse(cxOf(0.72), cyOf(0.32), w * 0.07 * k, h * 0.03 * k, () => [255, 255, 255], 0.5)

  // downsample
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const i = ((y * scale + dy) * w + (x * scale + dx)) * 4
          r += rgba[i]
          g += rgba[i + 1]
          b += rgba[i + 2]
          a += rgba[i + 3]
        }
      }
      const n = scale * scale
      const i = (y * size + x) * 4
      out[i] = Math.round(r / n)
      out[i + 1] = Math.round(g / n)
      out[i + 2] = Math.round(b / n)
      out[i + 3] = Math.round(a / n)
    }
  }
  return out
}

for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
]) {
  const rgba = draw({ size, maskable })
  fs.writeFileSync(path.join(outDir, name), encodePng(size, size, rgba))
  console.log('wrote', name)
}
