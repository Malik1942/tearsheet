/** Photo tiles keep their crop and fix only the crops that look broken (Malik, 2026-11-04). Every photo tile larger than 24 px keeps object-fit: cover,
 *  except it shows the photo whole, centred on the photo's border color, when all three hold: the photo is wider than the tile (cover would cut its sides),
 *  cover would hide more than 20% of its width, and its border is plain. Side crops cut words in half; top and bottom crops only drop whole lines, so a tall
 *  photo always stays cover. Presentation only: nothing here reaches the extraction, the shell or the layout contract. */
import type { CSSProperties } from 'react'
import type { PhotoBorder } from './types'

/** The border is read on a copy at most this many px on its long side. */
const SAMPLE = 96
/** The ring's depth: this share of the copy's long side, never under 2 px (2.88 → 3 px on a 96 px copy). */
const RING = 0.03
/** A ring pixel is near the ring's median within this distance in OKLab. */
const NEAR = 0.06
/** Cover must show at least this share of a photo's width (tileRatio / photoRatio); below it, the side crop reads as broken. */
const SHOWN = 0.8

// OKLab from 8-bit sRGB (Björn Ottosson's matrices), written out here because colorMath.ts stays out of the production bundle (devPixelsBundle.test.ts)
const linear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
function oklab(r8: number, g8: number, b8: number): [number, number, number] {
  const r = linear(r8), g = linear(g8), b = linear(b8)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

/** The border of an RGBA copy at most 96 px long: its outer ring, the ring's median color (per sRGB channel), and whether at least 95% of the ring
 *  is within ΔE 0.06 in OKLab of that median. */
export function borderOfPixels(rgba: ArrayLike<number>, width: number, height: number): PhotoBorder {
  const depth = Math.max(2, Math.round(RING * Math.max(width, height)))
  const ring: number[] = []
  const counts = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x >= depth && x < width - depth && y >= depth && y < height - depth) continue
    const i = (y * width + x) * 4
    ring.push(i)
    for (let c = 0; c < 3; c++) counts[c][rgba[i + c]]++
  }
  // the lower median of each channel: the first value that more than half of the ring sits at or under
  const median = counts.map(n => { let seen = 0; for (let v = 0; v < 256; v++) if ((seen += n[v]) * 2 > ring.length - 1) return v; return 255 })
  const [L, a, b] = oklab(median[0], median[1], median[2])
  const near = ring.filter(i => { const [l2, a2, b2] = oklab(rgba[i], rgba[i + 1], rgba[i + 2]); return Math.hypot(l2 - L, a2 - a, b2 - b) <= NEAR }).length
  return { plain: near * 20 >= ring.length * 19, color: `#${median.map(v => v.toString(16).padStart(2, '0')).join('')}` }
}

/** The border of the photo on `canvas` (prepareImage draws it), read on a copy at most 96 px long. Browser only. */
export function borderOfCanvas(canvas: HTMLCanvasElement): PhotoBorder {
  const scale = Math.min(1, SAMPLE / Math.max(canvas.width, canvas.height))
  const w = Math.max(1, Math.round(canvas.width * scale)), h = Math.max(1, Math.round(canvas.height * scale))
  const copy = document.createElement('canvas')
  copy.width = w; copy.height = h
  const ctx = copy.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'   // the browser's best resampling, so the small copy averages the photo rather than skipping most of it
  ctx.drawImage(canvas, 0, 0, w, h)
  return borderOfPixels(ctx.getImageData(0, 0, w, h).data, w, h)
}

/** The one helper every photo tile larger than 24 px uses: its style for a photo in a tile `tileRatio` wide (width / height). Undefined keeps the tile's own
 *  object-fit: cover; otherwise the photo shows whole, centred (object-position's default), the rest of the tile in its border color. */
export function tileFit(photo: { width: number; height: number; border?: PhotoBorder }, tileRatio: number): CSSProperties | undefined {
  // "wider than the tile" and "more than 20% of its width hidden" in one test: cover shows tileRatio / photoRatio of the width, all of it for a taller photo
  if (!photo.border?.plain || tileRatio / (photo.width / photo.height) >= SHOWN) return undefined
  return { objectFit: 'contain', background: photo.border.color }
}
