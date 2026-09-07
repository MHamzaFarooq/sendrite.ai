/**
 * Generates placeholder tray icons so the app can boot before real art exists.
 * Run once: node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** Draws a filled ring — recognisable at 16px and easy to replace later. */
function png(size, [r, g, b]) {
  const rows = []
  const c = (size - 1) / 2
  const outer = size * 0.46
  const inner = size * 0.24

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c)
      // Antialias the two edges of the ring over one pixel.
      const a = Math.max(0, Math.min(1, outer - d)) * Math.max(0, Math.min(1, d - inner + 1))
      const o = 1 + x * 4
      row[o] = r
      row[o + 1] = g
      row[o + 2] = b
      row[o + 3] = Math.round(a * 255)
    }
    rows.push(row)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

mkdirSync(join(root, 'resources'), { recursive: true })

// Windows: brand blue. macOS: black template image, tinted by the OS.
writeFileSync(join(root, 'resources/tray.png'), png(32, [47, 155, 255]))
writeFileSync(join(root, 'resources/trayTemplate.png'), png(22, [0, 0, 0]))
writeFileSync(join(root, 'resources/trayTemplate@2x.png'), png(44, [0, 0, 0]))

console.log('Wrote resources/tray.png, trayTemplate.png, trayTemplate@2x.png')
