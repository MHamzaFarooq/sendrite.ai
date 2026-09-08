/**
 * Generates the tray and installer icons from the master SVG logo.
 * Run once, or whenever src/renderer/src/assets/logo.svg changes:
 *   node scripts/make-icons.mjs
 */
import sharp from 'sharp'
import * as png2icons from 'png2icons'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'src/renderer/src/assets/logo.svg'), 'utf8')

// macOS template images are tinted (and masked) by the OS itself -- any
// color in the source is ignored and can render wrong. A flat black
// silhouette is the only thing that displays correctly there.
const blackSvg = svg.replace('fill="url(#paint0_linear_39_33)"', 'fill="#000000"')

/** Rasterize the (non-square) logo into a centered, transparent square. */
async function rasterize(source, size, paddingRatio = 0) {
  const pad = Math.round(size * paddingRatio)
  const inner = size - pad * 2
  const mark = await sharp(Buffer.from(source), { density: 300 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  return sharp(mark)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

mkdirSync(join(root, 'resources'), { recursive: true })
mkdirSync(join(root, 'build'), { recursive: true })

// Tray icons: full color on Windows, silhouette (for OS tinting) on macOS.
writeFileSync(join(root, 'resources/tray.png'), await rasterize(svg, 32))
writeFileSync(join(root, 'resources/trayTemplate.png'), await rasterize(blackSvg, 22))
writeFileSync(join(root, 'resources/trayTemplate@2x.png'), await rasterize(blackSvg, 44))

// Window icon: `build/` isn't shipped in the packaged app (see the `files`
// list in electron-builder.yml), so the BrowserWindow's own taskbar/alt-tab
// icon -- shown in both dev and packaged builds -- needs its own copy here.
writeFileSync(join(root, 'resources/icon.png'), await rasterize(svg, 256, 0.12))

// Installer/app icons: one high-res master, padded so the mark doesn't
// touch the edges, then packed into every size .ico/.icns need.
const master = await rasterize(svg, 1024, 0.12)
writeFileSync(join(root, 'build/icon.ico'), png2icons.createICO(master, png2icons.BICUBIC2, 0, true))
writeFileSync(join(root, 'build/icon.icns'), png2icons.createICNS(master, png2icons.BICUBIC2, 0))

console.log('Wrote resources/tray.png, trayTemplate.png, trayTemplate@2x.png, build/icon.ico, build/icon.icns')
