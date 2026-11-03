/** Pixel measurements for color (spec §1b): `measured · pixels`. Pure and deterministic: no DOM, no model, no Math.random, no Date.
 *  Same pixels and same params in, deep-equal fields out (k-means is seeded, ties break by index, rounding is fixed).
 *
 *  What a value here refers to (§1b definitions):
 *  - a hex is the representative color of a cluster in THIS image. It is not the color of the wall and not the color to use for a button.
 *  - distribution is measured (coverage, component count and size); whether a place is the focal point is judged elsewhere.
 *  - `photo_contrast` describes the photo only. It never stands in for the interface's readability check (skinRule.ts).
 *  The input is treated as sRGB; no white-balance correction is applied. Anything that changes a threshold, the color space, the downsample or the seed bumps MEASURE_VERSION. */
import { SRGB8_TO_LINEAR, contrastOfLuminances, lStar, linearRgbToOklab, oklabToGamutLinear, oklabToHex, relativeLuminance } from './colorMath'

export const MEASURE_VERSION = 'px-2'
export const PX_PARAMS = { downsample: 256, c_min: 0.04, c_high: 0.12, dh_min: 20, min_share: 0.01, seed: 7, k: 8, iters: 20, component_min: 4, near_black_L: 15, near_white_L: 90 }
/** Fixed with the version, not tunable per call: the k-means size and the OKLab lightness cut-offs of the tone clusters and photo_contrast. Recorded in `params.tone`. */
export const PX_TONE = { k: 6, light_L: 0.6, dark_L: 0.4 }

export type HueCluster = { hue: number; chroma: number; share: number; hex: string; representative: true }
/** One of the k=6 clusters over ALL counted pixels in OKLab (L, a, b). `chroma` and `hue` are those of the centroid; `hex` is the centroid. Sorted by share, largest first. */
export type ToneCluster = { L: number; chroma: number; hue: number; share: number; hex: string }
/** Everything that changes a number, recorded with the measurement: the tunable params and the fixed tone constants. */
export type PixelParams = typeof PX_PARAMS & { tone: typeof PX_TONE }
export type PixelFields = {
  measure_version: string; params: PixelParams; width: number; height: number
  luminance_shares: { near_black: number; near_white: number; between: number }
  hue_clusters: HueCluster[]; hue_count: number
  high_chroma_coverage: number
  high_chroma_components: { count: number; largest_component_share: number }
  chroma_ratio: number | null
  tone_clusters: ToneCluster[]
  photo_contrast: number | null
}

/** Coverage bands used to judge robustness (spec validation step 2): [0, .02), [.02, .05), [.05, .15), [.15, 1]. */
export const COVERAGE_BAND_LABELS = ['[0, 0.02)', '[0.02, 0.05)', '[0.05, 0.15)', '[0.15, 1]'] as const
export const coverageBand = (coverage: number) => (coverage < 0.02 ? 0 : coverage < 0.05 ? 1 : coverage < 0.15 ? 2 : 3)

const rnd = (x: number, decimals: number) => { const m = 10 ** decimals; return Math.round(x * m) / m + 0 }   // + 0 turns -0 into 0

/** Compare two measurements as a person reads them: numbers to two decimals, everything else exactly. */
export function fieldsEqualTo2dp(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return rnd(a, 2) === rnd(b, 2)
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => fieldsEqualTo2dp(x, b[i]))
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b)
    return ka.length === kb.length && ka.every(k => k in b && fieldsEqualTo2dp((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return a === b
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** k-means with k-means++ seeding from a seeded PRNG. `pts` is flat, `dim` numbers per point. Ties go to the lower index, empty clusters keep their center.
 *  Seeding stops early when every point already sits on a center, so identical colors never produce duplicate clusters; the returned k can be smaller than asked. */
function kmeans(pts: Float64Array, dim: number, kWanted: number, seed: number, iters: number): { assign: Int32Array; k: number } {
  const n = pts.length / dim
  const kMax = Math.min(kWanted, n)
  if (n === 0 || kMax < 1) return { assign: new Int32Array(0), k: 0 }
  const rng = mulberry32(seed)
  const picked: number[] = [Math.min(n - 1, Math.floor(rng() * n))]
  const d2 = new Float64Array(n).fill(Infinity)
  const tighten = (c: number) => {
    for (let i = 0; i < n; i++) {
      let d = 0
      for (let j = 0; j < dim; j++) { const x = pts[i * dim + j] - pts[c * dim + j]; d += x * x }
      if (d < d2[i]) d2[i] = d
    }
  }
  tighten(picked[0])
  while (picked.length < kMax) {
    let total = 0
    for (let i = 0; i < n; i++) total += d2[i]
    if (!(total > 0)) break
    const r = rng() * total
    let acc = 0, pick = -1
    for (let i = 0; i < n; i++) if (d2[i] > 0) { acc += d2[i]; pick = i; if (acc >= r) break }
    picked.push(pick)
    tighten(pick)
  }
  const k = picked.length
  const centers = new Float64Array(k * dim)
  picked.forEach((p, c) => { for (let j = 0; j < dim; j++) centers[c * dim + j] = pts[p * dim + j] })
  const assign = new Int32Array(n).fill(-1)
  const assignAll = () => {
    let changed = false
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity
      for (let c = 0; c < k; c++) {
        let d = 0
        for (let j = 0; j < dim; j++) { const x = pts[i * dim + j] - centers[c * dim + j]; d += x * x }
        if (d < bestD) { bestD = d; best = c }
      }
      if (assign[i] !== best) { assign[i] = best; changed = true }
    }
    return changed
  }
  for (let it = 0; it < iters; it++) {
    if (!assignAll() && it > 0) break                        // a fixed point: more iterations would change nothing
    const sums = new Float64Array(k * dim), counts = new Int32Array(k)
    for (let i = 0; i < n; i++) { const c = assign[i]; counts[c]++; for (let j = 0; j < dim; j++) sums[c * dim + j] += pts[i * dim + j] }
    for (let c = 0; c < k; c++) if (counts[c] > 0) for (let j = 0; j < dim; j++) centers[c * dim + j] = sums[c * dim + j] / counts[c]
  }
  assignAll()                                                // settle the assignment against the final centers
  return { assign, k }
}

const circDiff = (a: number, b: number) => { const d = Math.abs(a - b); return d > 180 ? 360 - d : d }

type Hue = { n: number; sin: number; cos: number; a: number; b: number; L: number; C: number }
const hueOf = (h: Hue) => { const d = (Math.atan2(h.sin, h.cos) * 180) / Math.PI; return d < 0 ? d + 360 : d }
const wrapHue = (deg: number) => { const r = rnd(deg, 1); return r >= 360 ? 0 : r }

export function measurePixels(rgba: Uint8ClampedArray, width: number, height: number, params: typeof PX_PARAMS = PX_PARAMS): PixelFields {
  const total = width * height
  if (!(width >= 1 && height >= 1) || rgba.length < total * 4) throw new Error(`rgba holds ${rgba.length} values, but width x height x 4 is ${total * 4}`)

  // Pass 1: per pixel, skip alpha < 128; luminance shares from CIE L*; OKLab and chroma.
  const L = new Float64Array(total), A = new Float64Array(total), B = new Float64Array(total), C = new Float64Array(total), counted = new Uint8Array(total)
  let n = 0, nearBlack = 0, nearWhite = 0
  for (let i = 0; i < total; i++) {
    if (rgba[i * 4 + 3] < 128) continue
    const r = SRGB8_TO_LINEAR[rgba[i * 4]], g = SRGB8_TO_LINEAR[rgba[i * 4 + 1]], b = SRGB8_TO_LINEAR[rgba[i * 4 + 2]]
    const ls = lStar(relativeLuminance(r, g, b))
    if (ls < params.near_black_L) nearBlack++
    else if (ls > params.near_white_L) nearWhite++
    const lab = linearRgbToOklab(r, g, b)
    L[i] = lab.L; A[i] = lab.a; B[i] = lab.b; C[i] = Math.sqrt(lab.a * lab.a + lab.b * lab.b)
    counted[i] = 1; n++
  }
  const base = { measure_version: MEASURE_VERSION, params: { ...params, tone: { ...PX_TONE } }, width, height }
  if (n === 0) {
    return { ...base, luminance_shares: { near_black: 0, near_white: 0, between: 0 }, hue_clusters: [], hue_count: 0, high_chroma_coverage: 0, high_chroma_components: { count: 0, largest_component_share: 0 }, chroma_ratio: null, tone_clusters: [], photo_contrast: null }
  }

  // Hue clusters: chromatic pixels only, k-means on OKLab (a, b), then merge hues closer than dh_min, then drop clusters under min_share of all counted pixels.
  const chromatic: number[] = []
  for (let i = 0; i < total; i++) if (counted[i] && C[i] >= params.c_min) chromatic.push(i)
  const ab = new Float64Array(chromatic.length * 2)
  chromatic.forEach((p, j) => { ab[j * 2] = A[p]; ab[j * 2 + 1] = B[p] })
  const hk = kmeans(ab, 2, params.k, params.seed, params.iters)
  let hues: Hue[] = Array.from({ length: hk.k }, () => ({ n: 0, sin: 0, cos: 0, a: 0, b: 0, L: 0, C: 0 }))
  chromatic.forEach((p, j) => {
    const h = hues[hk.assign[j]]
    h.n++; h.sin += B[p] / C[p]; h.cos += A[p] / C[p]; h.a += A[p]; h.b += B[p]; h.L += L[p]; h.C += C[p]
  })
  hues = hues.filter(h => h.n > 0)
  for (;;) {                                                 // merge the closest pair under dh_min until none is left; sums add, which is the pixel-count weighting
    let bi = -1, bj = -1, bd = params.dh_min
    for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) {
      const d = circDiff(hueOf(hues[i]), hueOf(hues[j]))
      if (d < bd) { bd = d; bi = i; bj = j }
    }
    if (bi < 0) break
    const x = hues[bi], y = hues[bj]
    hues[bi] = { n: x.n + y.n, sin: x.sin + y.sin, cos: x.cos + y.cos, a: x.a + y.a, b: x.b + y.b, L: x.L + y.L, C: x.C + y.C }
    hues.splice(bj, 1)
  }
  const kept = hues.filter(h => h.n / n >= params.min_share)
  const ranked = kept
    .map(h => ({ hue: hueOf(h), chroma: h.C / h.n, share: h.n / n, hex: oklabToHex(h.L / h.n, h.a / h.n, h.b / h.n) }))
    .sort((p, q) => q.share - p.share || p.hue - q.hue)
  const hue_clusters: HueCluster[] = ranked.map(c => ({ hue: wrapHue(c.hue), chroma: rnd(c.chroma, 3), share: rnd(c.share, 4), hex: c.hex, representative: true }))

  // High chroma: coverage over counted pixels, then 4-connected components of the mask (iterative flood fill, no recursion).
  let high = 0
  const mask = new Uint8Array(total)
  for (let i = 0; i < total; i++) if (counted[i] && C[i] >= params.c_high) { mask[i] = 1; high++ }
  const seen = new Uint8Array(total), stack = new Int32Array(total), sizes: number[] = []
  for (let s = 0; s < total; s++) {
    if (!mask[s] || seen[s]) continue
    let top = 0, size = 0
    stack[top++] = s; seen[s] = 1
    while (top > 0) {
      const p = stack[--top]
      size++
      const x = p % width
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[top++] = p - 1 }
      if (x < width - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[top++] = p + 1 }
      if (p >= width && mask[p - width] && !seen[p - width]) { seen[p - width] = 1; stack[top++] = p - width }
      if (p + width < total && mask[p + width] && !seen[p + width]) { seen[p + width] = 1; stack[top++] = p + width }
    }
    sizes.push(size)
  }
  const big = sizes.filter(s => s >= params.component_min)
  const bigTotal = big.reduce((t, s) => t + s, 0)
  const largest_component_share = bigTotal > 0 ? rnd(big.reduce((m, v) => Math.max(m, v), 0) / bigTotal, 4) : 0

  // Tone clusters and photo contrast: k-means over ALL counted pixels in OKLab (L, a, b).
  const all = new Float64Array(n * 3)
  let q = 0
  for (let i = 0; i < total; i++) if (counted[i]) { all[q * 3] = L[i]; all[q * 3 + 1] = A[i]; all[q * 3 + 2] = B[i]; q++ }
  const tk = kmeans(all, 3, PX_TONE.k, params.seed, params.iters)
  const tones = Array.from({ length: tk.k }, () => ({ n: 0, L: 0, a: 0, b: 0 }))
  for (let j = 0; j < n; j++) { const t = tones[tk.assign[j]]; t.n++; t.L += all[j * 3]; t.a += all[j * 3 + 1]; t.b += all[j * 3 + 2] }
  const toneRanked = tones
    .filter(t => t.n > 0)
    .map(t => { const l = t.L / t.n, a = t.a / t.n, b = t.b / t.n; return { L: l, a, b, chroma: Math.sqrt(a * a + b * b), hue: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360, share: t.n / n } })
    .sort((p, r) => r.share - p.share || p.L - r.L)
  const tone_clusters: ToneCluster[] = toneRanked.map(t => ({ L: rnd(t.L, 3), chroma: rnd(t.chroma, 3), hue: t.chroma < 1e-4 ? 0 : wrapHue(t.hue), share: rnd(t.share, 4), hex: oklabToHex(t.L, t.a, t.b) }))
  const lum = (t: { L: number; a: number; b: number }) => { const [r, g, b] = oklabToGamutLinear(t.L, t.a, t.b); return relativeLuminance(r, g, b) }
  const light = toneRanked.find(t => t.L >= PX_TONE.light_L), dark = toneRanked.find(t => t.L < PX_TONE.dark_L)

  return {
    ...base,
    luminance_shares: { near_black: rnd(nearBlack / n, 4), near_white: rnd(nearWhite / n, 4), between: rnd((n - nearBlack - nearWhite) / n, 4) },
    hue_clusters, hue_count: hue_clusters.length,
    high_chroma_coverage: rnd(high / n, 4),
    high_chroma_components: { count: big.length, largest_component_share },
    chroma_ratio: ranked.length >= 2 ? rnd(ranked[0].chroma / ranked[1].chroma, 3) : null,
    tone_clusters,
    photo_contrast: light && dark ? rnd(contrastOfLuminances(lum(light), lum(dark)), 2) : null,
  }
}
