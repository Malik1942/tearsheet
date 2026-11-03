/** Color math for the pixel measurements (spec §1b). Pure, no DOM, no dependency.
 *  sRGB <-> linear <-> XYZ D65 <-> OKLab <-> OKLCH follow CSS Color 4 (matrices and the gamut-mapping loop are the ones in its sample code);
 *  relative luminance and the contrast ratio follow WCAG 2.2 (1.4.3). The input is treated as sRGB: no white-balance correction. */

type Vec3 = [number, number, number]
type Mat3 = [Vec3, Vec3, Vec3]

const mul = (m: Mat3, v: Vec3): Vec3 => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]]
const mm = (a: Mat3, b: Mat3): Mat3 => {
  const r: Mat3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]
  return r
}

const LIN_SRGB_TO_XYZ: Mat3 = [[0.41239079926595934, 0.357584339383878, 0.1804807884018343], [0.21263900587151027, 0.715168678767756, 0.07219231536073371], [0.01933081871559182, 0.11919477979462598, 0.9505321522496607]]
const XYZ_TO_LIN_SRGB: Mat3 = [[3.2409699419045226, -1.537383177570094, -0.4986107602930034], [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559], [0.05563007969699366, -0.20397695888897652, 1.0569715142428786]]
const XYZ_TO_LMS: Mat3 = [[0.819022437996703, 0.3619062600528904, -0.1288737815209879], [0.0329836539323885, 0.9292868615863434, 0.0361446663506424], [0.0481771893596242, 0.2642395317527308, 0.6335478284694309]]
const LMS_TO_OKLAB: Mat3 = [[0.210454268309314, 0.7936177747023054, -0.0040720430116193], [1.9779985324311684, -2.4285922420485799, 0.450593709617411], [0.0259040424655478, 0.7827717124575296, -0.8086757549230774]]
const OKLAB_TO_LMS: Mat3 = [[1, 0.3963377773761749, 0.2158037573099136], [1, -0.1055613458156586, -0.0638541728258133], [1, -0.0894841775298119, -1.2914855480194092]]
const LMS_TO_XYZ: Mat3 = [[1.2268798758459243, -0.5578149944602171, 0.2813910456659647], [-0.0405757452148008, 1.112286803280317, -0.0716110580655164], [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816]]

const RGB_TO_LMS = mm(XYZ_TO_LMS, LIN_SRGB_TO_XYZ)
const LMS_TO_RGB = mm(XYZ_TO_LIN_SRGB, LMS_TO_XYZ)

/** sRGB transfer function, 0..1 -> linear light. */
export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
export const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
/** The 256 8-bit values decoded once. */
export const SRGB8_TO_LINEAR: Float64Array = (() => { const t = new Float64Array(256); for (let i = 0; i < 256; i++) t[i] = srgbToLinear(i / 255); return t })()

export type Oklab = { L: number; a: number; b: number }
export type Oklch = { L: number; C: number; h: number }

export function linearRgbToOklab(r: number, g: number, b: number): Oklab {
  const [l, m, s] = mul(RGB_TO_LMS, [r, g, b])
  const [L, a, bb] = mul(LMS_TO_OKLAB, [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)])
  return { L, a, b: bb }
}
export function oklabToLinearRgb(L: number, a: number, b: number): Vec3 {
  const [l, m, s] = mul(OKLAB_TO_LMS, [L, a, b])
  return mul(LMS_TO_RGB, [l * l * l, m * m * m, s * s * s])
}
export const oklabToOklch = ({ L, a, b }: Oklab): Oklch => {
  const C = Math.sqrt(a * a + b * b)
  if (C < 1e-4) return { L, C, h: 0 }                      // hue is powerless on greys
  let h = (Math.atan2(b, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { L, C, h }
}
export const oklchToOklab = ({ L, C, h }: Oklch): Oklab => ({ L, a: C * Math.cos((h * Math.PI) / 180), b: C * Math.sin((h * Math.PI) / 180) })

/** CSS Color 4 gamut mapping into sRGB: hold lightness and hue, lower chroma (binary search) until the clipped color is within a JND (0.02 in OKLab) of the unclipped one. */
const GAMUT_EPS = 0.000075, JND = 0.02, SEARCH_EPS = 0.0001
const inGamut = (c: Vec3) => c.every(v => v >= -GAMUT_EPS && v <= 1 + GAMUT_EPS)
const clip = (c: Vec3): Vec3 => [Math.min(1, Math.max(0, c[0])), Math.min(1, Math.max(0, c[1])), Math.min(1, Math.max(0, c[2]))]
const deltaEOK = (x: Oklab, y: Oklab) => Math.sqrt((x.L - y.L) ** 2 + (x.a - y.a) ** 2 + (x.b - y.b) ** 2)
export function oklabToGamutLinear(L: number, a: number, b: number): Vec3 {
  if (L >= 1) return [1, 1, 1]
  if (L <= 0) return [0, 0, 0]
  const origin = oklabToLinearRgb(L, a, b)
  if (inGamut(origin)) return clip(origin)
  const { C, h } = oklabToOklch({ L, a, b })
  let clipped = clip(origin)
  const at = (chroma: number): { lab: Oklab; rgb: Vec3 } => { const lab = oklchToOklab({ L, C: chroma, h }); return { lab, rgb: oklabToLinearRgb(lab.L, lab.a, lab.b) } }
  const err = (clippedRgb: Vec3, lab: Oklab) => deltaEOK(linearRgbToOklab(clippedRgb[0], clippedRgb[1], clippedRgb[2]), lab)
  if (err(clipped, { L, a, b }) < JND) return clipped
  let min = 0, max = C, minInGamut = true
  while (max - min > SEARCH_EPS) {
    const chroma = (min + max) / 2
    const cur = at(chroma)
    if (minInGamut && inGamut(cur.rgb)) { min = chroma; continue }
    clipped = clip(cur.rgb)
    const E = err(clipped, cur.lab)
    if (E < JND) {
      if (JND - E < SEARCH_EPS) return clipped
      minInGamut = false; min = chroma
    } else max = chroma
  }
  return clipped
}

export const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
export function hexToRgb(hex: string): Vec3 {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`not a #RRGGBB color: ${hex}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const linearRgbToHex = ([r, g, b]: Vec3) => rgbToHex(linearToSrgb(r) * 255, linearToSrgb(g) * 255, linearToSrgb(b) * 255)
export const oklabToHex = (L: number, a: number, b: number) => linearRgbToHex(oklabToGamutLinear(L, a, b))
export const oklchToHex = (L: number, C: number, h: number) => { const o = oklchToOklab({ L, C, h }); return oklabToHex(o.L, o.a, o.b) }
export function hexToOklab(hex: string): Oklab {
  const [r, g, b] = hexToRgb(hex)
  return linearRgbToOklab(SRGB8_TO_LINEAR[r], SRGB8_TO_LINEAR[g], SRGB8_TO_LINEAR[b])
}
export const hexToOklch = (hex: string): Oklch => oklabToOklch(hexToOklab(hex))

/** WCAG 2.2 relative luminance of linear-light sRGB. */
export const relativeLuminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b
export const luminanceOfHex = (hex: string) => { const [r, g, b] = hexToRgb(hex); return relativeLuminance(SRGB8_TO_LINEAR[r], SRGB8_TO_LINEAR[g], SRGB8_TO_LINEAR[b]) }
/** WCAG contrast ratio of two relative luminances, unrounded, lighter over darker. */
export const contrastOfLuminances = (y1: number, y2: number) => (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05)
/** CIE L* (0..100) from relative luminance Y. */
const DELTA = 6 / 29
const labF = (t: number) => (t > DELTA ** 3 ? Math.cbrt(t) : t / (3 * DELTA * DELTA) + 4 / 29)
export const lStar = (Y: number) => 116 * labF(Y) - 16
