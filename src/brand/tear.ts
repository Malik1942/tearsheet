/** The Data tear (Claude Design board "Data tear", 2026-11-04): a page torn by its photo's own brightness and filled with its photo's colors.
 *  The photo's rows, top to bottom, tear the page's right edge (a brighter row pushes it out); its columns, left to right, tear the bottom (a brighter
 *  column pushes it down). The page is filled with the photo's three main colors as vertical stripes, largest share first, each as wide as it must be
 *  for its visible area to match its share. A rim, the paper's torn fibre, follows both torn edges.
 *  Pure and deterministic: no randomness, so the same photo always gives the same tear. Used by the share page, the brand build (scripts/brand.ts,
 *  which writes the marks, icons and kit) and the review renders; the header uses the static mark that build wrote, never a live render. */
import { hexToOklab, lStar, oklabToHex, relativeLuminance, SRGB8_TO_LINEAR } from '../lib/colorMath'

/** The board's values. Rims are the torn fibre: warm grey on paper, a light blue on ultramarine; on ink (not on the board) the board's muted grey. */
export const BRAND = {
  ink: '#1B1E21', ultramarine: '#2338E8', paper: '#FFFFFF', muted: '#6B6E72', hairline: '#E4E4E4',
  rimOnPaper: '#D3CDC1', rimOnUltramarine: '#6F7DF2', rimOnInk: '#6B6E72',
  tagline: 'Taste you can trace.',
} as const

/** Every tear is drawn in a 104-unit square, as on the board. */
export const BOX = 104
/** Samples per torn edge: about 1.05 units apart, the board's spacing. */
const SAMPLES = 84
/** Where a torn edge can sit: the darkest band at the low end, the brightest at the high end. Fitted to the board: the master mark is the tear of
 *  TS-01-0001 (the Bauhaus poster), and from that photo these give its edges' mean and spread (right 86.1, sd 2.0; bottom 86.7, sd 1.3). */
const RIGHT_RANGE: readonly [number, number] = [82, 94.5]
const BOTTOM_RANGE: readonly [number, number] = [84.3, 96]
/** The rim's depth beyond the torn edge, in box units (the board's is 1.7 to 2.2, with the odd longer fibre). */
export const RIM_DEPTH = 1.8
/** Samples eased toward the baseline at an edge's free end (the top of the right edge, the left end of the bottom): about a tenth of the edge, so a
 *  photo's border (a white margin, a black frame) cannot leave a tooth at the corner. */
const EASE_FREE = 8

export type Pt = [number, number]
export type Tone = { hex: string; share: number }
/** A tear's two torn edges, in drawing units: the right edge's x, row by row from the top; the bottom's y, column by column from the left. */
export type TornEdges = { right: number[]; bottom: number[] }
export type Tear = { page: Pt[]; rim: Pt[] | null; stripes: { hex: string; share: number; pts: Pt[] }[] }

const mean = (v: number[]) => v.reduce((t, x) => t + x, 0) / v.length
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Ease the first `head` and last `tail` samples toward the edge's baseline (its mean), so an edge starts and ends on its baseline: no hairline spike
 *  at the top-right corner, no stray tooth at the bottom-left, and the two edges meet cleanly at the corner. */
export function easeEnds(values: number[], head: number, tail: number): number[] {
  const base = mean(values), n = values.length
  return values.map((v, i) => {
    const w = Math.min(i < head ? smooth(i / head) : 1, n - 1 - i < tail ? smooth((n - 1 - i) / tail) : 1)
    return base + (v - base) * w
  })
}

/** Ease both edges: the free ends by a few samples; the corner ends over every sample that lies within reach of the other edge, so they cannot cross. */
export function easeEdges(e: TornEdges): TornEdges {
  const baseR = mean(e.right), baseB = mean(e.bottom)
  const reach = (n: number, base: number, otherMin: number) => Math.max(EASE_FREE, n - Math.floor(((otherMin - 1) / base) * (n - 1)))
  return {
    right: easeEnds(e.right, EASE_FREE, reach(e.right.length, baseB, Math.min(...e.bottom))),
    bottom: easeEnds(e.bottom, EASE_FREE, reach(e.bottom.length, baseR, Math.min(...e.right))),
  }
}

/** The page: the top-left corner, along the top to the right edge, down the torn right edge to the corner, back along the torn bottom, up the left.
 *  The edges must be eased (their ends on their baselines), so the corner is where both baselines meet. */
export function pagePolygon(e: TornEdges): Pt[] {
  const xc = e.right[e.right.length - 1], yc = e.bottom[e.bottom.length - 1]
  const pts: Pt[] = [[0, 0]]
  e.right.forEach((x, j) => pts.push([x, (j * yc) / (e.right.length - 1)]))
  for (let i = e.bottom.length - 2; i >= 0; i--) pts.push([(i * xc) / (e.bottom.length - 1), e.bottom[i]])
  return pts
}

/** A deterministic hash of an integer to [0, 1). */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** The rim: the same outline pushed out by `depth`, a little more here and there where a fibre pulled (one sample in eight or so), from a hash of the
 *  sample and its value, never from a random number. Flat at the eased ends, so the ends stay clean. Drawn behind the page. */
export function rimPolygon(e: TornEdges, depth: number): Pt[] {
  const fibre = (edge: number, i: number, v: number, n: number) => {
    if (i < EASE_FREE || n - 1 - i < EASE_FREE) return depth
    const k = edge * 7919 + i * 104729 + Math.round(v * 10)
    const a = hash(k), b = hash(k + 1), c = hash(k + 2)
    return depth * (1 + 0.22 * a) + (b > 0.88 ? depth * (0.7 + 1.3 * c) : 0)
  }
  const xc = e.right[e.right.length - 1], yc = e.bottom[e.bottom.length - 1]
  const nR = e.right.length, nB = e.bottom.length
  const pts: Pt[] = [[0, 0]]
  e.right.forEach((x, j) => pts.push([x + fibre(1, j, x, nR), (j * yc) / (nR - 1)]))
  pts.push([xc + depth, yc + depth])
  for (let i = nB - 1; i >= 0; i--) pts.push([(i * xc) / (nB - 1), e.bottom[i] + fibre(2, i, e.bottom[i], nB)])
  return pts
}

/** How much of the polygon lies in each thin column from x = 0 (crossings of the column's centre line, paired). */
function columnAreas(poly: Pt[], dx: number): { x: number[]; area: number[] } {
  const maxX = Math.max(...poly.map(p => p[0]))
  const x: number[] = [], area: number[] = []
  for (let c = dx / 2; c < maxX; c += dx) {
    const ys: number[] = []
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]
      if ((x1 <= c && x2 > c) || (x2 <= c && x1 > c)) ys.push(y1 + ((c - x1) / (x2 - x1)) * (y2 - y1))
    }
    ys.sort((a, b) => a - b)
    let len = 0
    for (let k = 0; k + 1 < ys.length; k += 2) len += ys[k + 1] - ys[k]
    x.push(c + dx / 2); area.push(len * dx)
  }
  return { x, area }
}

/** Where the stripes meet: each boundary at the x where the visible area to its left reaches the running total of the shares, so every stripe covers
 *  its share of the torn page (the tear never shrinks a stripe, the smallest included). */
export function stripeBounds(poly: Pt[], shares: number[]): number[] {
  const { x, area } = columnAreas(poly, 0.05)
  const total = area.reduce((t, a) => t + a, 0)
  const bounds: number[] = []
  let run = 0, acc = 0, k = 0
  for (const s of shares.slice(0, -1)) {
    run += s * total
    while (k < area.length && acc + area[k] < run) acc += area[k++]
    if (k >= area.length) { bounds.push(x[x.length - 1]); continue }
    const x0 = k === 0 ? 0 : x[k - 1]
    bounds.push(x0 + ((run - acc) / area[k]) * (x[k] - x0))
  }
  return bounds
}

/** The part of a polygon between two vertical lines (Sutherland–Hodgman, one half-plane at a time). */
export function clipBand(poly: Pt[], a: number, b: number): Pt[] {
  const half = (pts: Pt[], inside: (p: Pt) => boolean, cut: number) => {
    const out: Pt[] = []
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length]
      const pin = inside(p), qin = inside(q)
      if (pin) out.push(p)
      if (pin !== qin) out.push([cut, p[1] + ((cut - p[0]) / (q[0] - p[0])) * (q[1] - p[1])])
    }
    return out
  }
  return half(half(poly, p => p[0] >= a, a), p => p[0] <= b, b)
}

/** The three colors a tear is filled with, from the photo's measured tone clusters (pixels.ts, px-2: six clusters, each a color and the share of the
 *  photo it covers). Not recomputed: the six are joined, two at a time, where joining costs least (Ward's rule: the shares times the squared OKLab
 *  distance), until three are left; a joined color is the share-weighted mean of its two in OKLab, and its share their sum. Largest share first. */
export function threeTones(clusters: Tone[]): Tone[] {
  type C = { L: number; a: number; b: number; share: number }
  let cs: C[] = clusters.filter(c => c.share > 0).map(c => ({ ...hexToOklab(c.hex), share: c.share }))
  while (cs.length > 3) {
    let best = Infinity, bi = 0, bj = 1
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const p = cs[i], q = cs[j], d2 = (p.L - q.L) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2
      const cost = ((p.share * q.share) / (p.share + q.share)) * d2
      if (cost < best) { best = cost; bi = i; bj = j }
    }
    const p = cs[bi], q = cs[bj], s = p.share + q.share
    const joined = { L: (p.L * p.share + q.L * q.share) / s, a: (p.a * p.share + q.a * q.share) / s, b: (p.b * p.share + q.b * q.share) / s, share: s }
    cs = cs.filter((_, k) => k !== bi && k !== bj).concat(joined)
  }
  const total = cs.reduce((t, c) => t + c.share, 0)
  return cs.map(c => ({ hex: oklabToHex(c.L, c.a, c.b), share: c.share / total })).sort((p, q) => q.share - p.share)
}

/** A photo's brightness down and across: the mean CIE L* (0 to 1) of each row, top to bottom, and of each column, left to right. */
export function brightnessProfile(rgba: ArrayLike<number>, width: number, height: number): { rows: number[]; cols: number[] } {
  const rows = new Array<number>(height).fill(0), cols = new Array<number>(width).fill(0)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4
    const l = lStar(relativeLuminance(SRGB8_TO_LINEAR[rgba[i]], SRGB8_TO_LINEAR[rgba[i + 1]], SRGB8_TO_LINEAR[rgba[i + 2]])) / 100
    rows[y] += l / width; cols[x] += l / height
  }
  return { rows, cols }
}

/** A profile in `n` equal bands, each band's mean. */
function bands(profile: number[], n: number): number[] {
  return Array.from({ length: n }, (_, k) => {
    const a = (k * profile.length) / n, b = ((k + 1) * profile.length) / n
    let t = 0, w = 0
    for (let i = Math.floor(a); i < Math.ceil(b); i++) { const o = Math.min(b, i + 1) - Math.max(a, i); t += profile[i] * o; w += o }
    return w ? t / w : 0
  })
}

/** The torn edges from a brightness profile: banded; a band that stands alone against both neighbours is taken at their median (a one-band needle
 *  reads as a hairline, not a tear); stretched across the photo's own range between its 5th and 95th percentiles, so a border row does not set the
 *  scale (scaled back for a flat photo, so a near-blank page tears gently rather than from noise); placed in the board's ranges; eased at the ends. */
export function edgesFromProfile(p: { rows: number[]; cols: number[] }): TornEdges {
  const median3 = (v: number[]) => v.map((x, i) => (i === 0 || i === v.length - 1 ? x : [v[i - 1], x, v[i + 1]].sort((a, b) => a - b)[1]))
  const place = (raw: number[], [lo, hi]: readonly [number, number]) => {
    const v = median3(raw), s = [...v].sort((a, b) => a - b)
    const min = s[Math.floor(0.05 * (s.length - 1))], spread = s[Math.ceil(0.95 * (s.length - 1))] - min
    const depth = (hi - lo) * Math.min(1, Math.max(0.35, spread / 0.25))
    return v.map(x => (spread > 1e-6 ? lo + Math.min(1.1, Math.max(-0.1, (x - min) / spread)) * depth : lo + depth / 2))
  }
  return easeEdges({ right: place(bands(p.rows, SAMPLES), RIGHT_RANGE), bottom: place(bands(p.cols, SAMPLES), BOTTOM_RANGE) })
}

/** A tear from eased edges: the page, its rim (or none) and its stripes. One tone fills the page whole. */
export function buildTear(e: TornEdges, tones: Tone[], rimDepth: number | null = RIM_DEPTH): Tear {
  const page = pagePolygon(e)
  const top = tones.slice(0, 3)
  const total = top.reduce((t, c) => t + c.share, 0) || 1
  const shares = top.map(t => t.share / total)
  const cuts = [0, ...stripeBounds(page, shares), Infinity]
  return {
    page, rim: rimDepth == null ? null : rimPolygon(e, rimDepth),
    stripes: top.map((t, i) => ({ hex: t.hex, share: shares[i], pts: clipBand(page, cuts[i], cuts[i + 1]) })).filter(s => s.pts.length >= 3),
  }
}

/** The tear of one photo, from its pixels (downsampled, as pixels.ts measures them) and its measured tone clusters. */
export function photoTear(rgba: ArrayLike<number>, width: number, height: number, toneClusters: Tone[]): Tear {
  return buildTear(edgesFromProfile(brightnessProfile(rgba, width, height)), threeTones(toneClusters))
}

/** The 32 px mark: the same tear, heavily smoothed to three large teeth per edge and no rim. Each edge keeps its baseline; the teeth's depths come from
 *  the profile's own swings in five bands (tips out, notches in), at least `minDepth` deep so they still read at 32 px. */
export function toothedEdges(e: TornEdges, minDepth = 7): TornEdges {
  const tooth = (v: number[]) => {
    const base = v[0], n = v.length   // an eased edge starts and ends on its baseline
    const swing = bands(v.map(x => Math.abs(x - base)), 5)
    const top = Math.max(...swing) || 1
    const pts = [base, ...swing.map((s, k) => base + (k % 2 === 0 ? 1 : -1) * (minDepth / 2) * (0.6 + (0.4 * s) / top)), base]
    return Array.from({ length: n }, (_, i) => {
      const t = (i / (n - 1)) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(t))
      return pts[k] + (pts[k + 1] - pts[k]) * (t - k)
    })
  }
  return { right: tooth(e.right), bottom: tooth(e.bottom) }
}

/** The 16 px mark, drawn on its own 16-px grid: the page with one clearly torn corner (bottom right), no rim. */
export const MARK_16: Pt[] = [[2, 1], [14, 1], [14, 7], [10.5, 10], [12.5, 12.5], [8, 15], [2, 15]]

const r1 = (n: number) => (Math.round(n * 10) / 10).toString()
/** An SVG path from a polygon, to 0.1 unit (the board's precision). */
export const pathOf = (pts: Pt[], scale = 1, dx = 0, dy = 0): string =>
  'M' + pts.map(([x, y]) => `${r1(x * scale + dx)},${r1(y * scale + dy)}`).join(' L') + ' Z'

/** A tear as a standalone SVG in its 104 box: rim behind, then the stripes (or one page color). */
export function tearSvg(t: Tear, o: { size?: number; rim?: string; page?: string; label?: string } = {}): string {
  const size = o.size ?? BOX
  const body = [
    t.rim && o.rim !== 'none' ? `<path d="${pathOf(t.rim)}" fill="${o.rim ?? BRAND.rimOnPaper}"/>` : '',
    ...(o.page ? [`<path d="${pathOf(t.page)}" fill="${o.page}"/>`] : t.stripes.map(s => `<path d="${pathOf(s.pts)}" fill="${s.hex}"/>`)),
  ].join('')
  const a11y = o.label ? `role="img" aria-label="${o.label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${BOX} ${BOX}" ${a11y}>${body}</svg>`
}
