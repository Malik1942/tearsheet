/** Spec §1b, pixel measurements for color: synthetic images built here, never read from a photo, so every expected number is known in advance.
 *  Expected values are typed from the CSS Color 4 / WCAG 2.2 references and from the brief, never read back from the code under test. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MEASURE_VERSION, PX_PARAMS, coverageBand, fieldsEqualTo2dp, measurePixels, type PixelFields } from '../src/lib/pixels.ts'
import { contrastRatio, deriveSkin } from '../src/lib/skinRule.ts'
import { hexToOklch, oklchToHex, rgbToHex } from '../src/lib/colorMath.ts'

type Rgb = [number, number, number]
type Img = { rgba: Uint8ClampedArray; width: number; height: number }

const BLACK: Rgb = [0, 0, 0]
const WHITE: Rgb = [255, 255, 255]
const GREY: Rgb = [190, 190, 190]
const RED: Rgb = [255, 0, 0]
const BLUE: Rgb = [0, 0, 255]

function solid(width: number, height: number, c: Rgb, a = 255): Img {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) rgba.set([c[0], c[1], c[2], a], i * 4)
  return { rgba, width, height }
}
function paint(img: Img, x: number, y: number, w: number, h: number, c: Rgb, a = 255): Img {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) img.rgba.set([c[0], c[1], c[2], a], (yy * img.width + xx) * 4)
  return img
}
/** The same picture seen through a slight white-balance shift (R x 1.04, B x 0.96), clamped. */
function warm(img: Img): Img {
  const rgba = new Uint8ClampedArray(img.rgba)
  for (let i = 0; i < rgba.length; i += 4) { rgba[i] = Math.min(255, rgba[i] * 1.04); rgba[i + 2] = rgba[i + 2] * 0.96 }
  return { ...img, rgba }
}
const measure = (img: Img) => measurePixels(img.rgba, img.width, img.height)
const near = (actual: number, expected: number, tol: number, what: string) => assert.ok(Math.abs(actual - expected) <= tol, `${what}: ${actual} is not within ${tol} of ${expected}`)

const redSquare = () => paint(solid(50, 50, GREY), 10, 10, 10, 10, RED)          // 100 of 2500 pixels = 4%
const fourDots = () => {                                                          // four separate 5x5 squares = 100 of 2500 pixels, none touching another
  const img = solid(50, 50, GREY)
  for (const [x, y] of [[5, 5], [35, 5], [5, 35], [35, 35]]) paint(img, x, y, 5, 5, RED)
  return img
}

describe('color math follows CSS Color 4', () => {
  it('converts the sRGB primaries to the published OKLCH values', () => {
    for (const [hex, L, C, h] of [['#FF0000', 0.628, 0.2577, 29.23], ['#00FF00', 0.8664, 0.2948, 142.5], ['#0000FF', 0.452, 0.3132, 264.05]] as const) {
      const o = hexToOklch(hex)
      near(o.L, L, 0.0005, `${hex} L`); near(o.C, C, 0.0005, `${hex} C`); near(o.h, h, 0.05, `${hex} h`)
    }
  })
  it('puts white at L 1 and every grey at no chroma', () => {
    const w = hexToOklch('#FFFFFF')
    near(w.L, 1, 1e-4, 'white L'); assert.ok(w.C < 1e-4, `white C ${w.C}`)
    for (const g of ['#000000', '#404040', '#808080', '#C0C0C0']) assert.ok(hexToOklch(g).C < 1e-4, g)
  })
  it('round-trips every 8-bit color it is asked about back to the same hex', () => {
    for (const hex of ['#D11D1B', '#2F6FED', '#F2C200', '#673F1E', '#A6D4E3', '#010203', '#FEFDFC', '#808080']) {
      const o = hexToOklch(hex)
      assert.equal(oklchToHex(o.L, o.C, o.h), hex)
    }
  })
  it('maps a color outside sRGB into the gamut by lowering chroma, keeping lightness and hue', () => {
    const hex = oklchToHex(0.9, 0.3, 140)                  // far outside sRGB
    assert.match(hex, /^#[0-9A-F]{6}$/)
    const back = hexToOklch(hex)
    assert.ok(back.C < 0.3, 'chroma was lowered')
    near(back.h, 140, 3, 'hue kept'); near(back.L, 0.9, 0.03, 'lightness kept')
  })
  it('writes uppercase hex and clamps channels', () => {
    assert.equal(rgbToHex(209, 29, 27), '#D11D1B')
    assert.equal(rgbToHex(-4, 300, 0.4), '#00FF00')
  })
})

describe('contrastRatio (WCAG 2.2 relative luminance)', () => {
  it('is 21 for black on white, either way round, and 1 for a color on itself', () => {
    assert.equal(contrastRatio('#000000', '#FFFFFF'), 21)
    assert.equal(contrastRatio('#FFFFFF', '#000000'), 21)
    assert.equal(contrastRatio('#2F6FED', '#2F6FED'), 1)
  })
  it('matches the well-known grey-on-white pair that sits on the 4.5 line, and never rounds up across it', () => {
    assert.equal(contrastRatio('#767676', '#FFFFFF'), 4.54)
    assert.equal(contrastRatio('#777777', '#FFFFFF'), 4.47)         // 4.478: cut to two decimals, not rounded up to the 4.48 some tools print
    assert.ok(contrastRatio('#777777', '#FFFFFF') < 4.5)
  })
})

describe('measurePixels: luminance shares', () => {
  it('reads an all-black image as 100% near-black with no hue, no coverage and no photo contrast', () => {
    const f = measure(solid(32, 32, BLACK))
    assert.equal(f.measure_version, MEASURE_VERSION)
    assert.equal(MEASURE_VERSION, 'px-1')
    assert.deepEqual(f.luminance_shares, { near_black: 1, near_white: 0, between: 0 })
    assert.equal(f.hue_count, 0)
    assert.deepEqual(f.hue_clusters, [])
    assert.equal(f.high_chroma_coverage, 0)
    assert.deepEqual(f.high_chroma_components, { count: 0, largest_component_share: 0 })
    assert.equal(f.chroma_ratio, null)
    assert.equal(f.photo_contrast, null)
  })
  it('splits a black top half and a white bottom half into 50% and 50%, and describes the photo as 21:1', () => {
    const f = measure(paint(solid(32, 32, BLACK), 0, 16, 32, 16, WHITE))
    assert.deepEqual(f.luminance_shares, { near_black: 0.5, near_white: 0.5, between: 0 })
    assert.equal(f.photo_contrast, 21)
  })
  it('puts a mid grey in between, using CIE L* thresholds of 15 and 90', () => {
    const f = measure(solid(8, 8, [128, 128, 128]))                  // L* = 53.6
    assert.deepEqual(f.luminance_shares, { near_black: 0, near_white: 0, between: 1 })
    const dark = measure(solid(8, 8, [40, 40, 40]))                 // L* = 16.1: just over the near-black line
    assert.equal(dark.luminance_shares.near_black, 0)
    const darker = measure(solid(8, 8, [35, 35, 35]))               // L* = 13.7
    assert.equal(darker.luminance_shares.near_black, 1)
  })
  it('counts shares over pixels with alpha of 128 or more, and ignores the rest', () => {
    const img = paint(solid(10, 10, WHITE), 0, 0, 10, 5, BLACK, 127)            // top half: almost-transparent black
    const f = measure(img)
    assert.deepEqual(f.luminance_shares, { near_black: 0, near_white: 1, between: 0 })
    const half = measure(paint(solid(10, 10, WHITE), 0, 0, 10, 5, BLACK, 128))  // alpha 128 counts
    assert.deepEqual(half.luminance_shares, { near_black: 0.5, near_white: 0.5, between: 0 })
  })
  it('returns empty, finite fields for an image with no counted pixel', () => {
    const f = measure(solid(4, 4, WHITE, 0))
    assert.deepEqual(f.luminance_shares, { near_black: 0, near_white: 0, between: 0 })
    assert.equal(f.hue_count, 0)
    assert.equal(f.photo_contrast, null)
    assert.equal(f.chroma_ratio, null)
    assert.deepEqual(f.tone_clusters, [])
  })
  it('refuses a buffer shorter than width x height x 4', () => {
    assert.throws(() => measurePixels(new Uint8ClampedArray(10), 4, 4), /width/)
  })
})

describe('measurePixels: hue clusters and high-chroma distribution', () => {
  it('finds one small saturated red square on grey: 4% coverage in one component, one hue', () => {
    const f = measure(redSquare())
    assert.equal(f.high_chroma_coverage, 0.04)
    assert.deepEqual(f.high_chroma_components, { count: 1, largest_component_share: 1 })
    assert.equal(f.hue_count, 1)
    const c = f.hue_clusters[0]
    near(c.hue, 29.23, 1, 'hue of #FF0000')                          // the brief allows 20; a single exact color has no excuse
    assert.equal(c.share, 0.04)
    assert.equal(c.hex, '#FF0000')
    assert.equal(c.representative, true)
    near(c.chroma, 0.258, 0.001, 'chroma of #FF0000')
    assert.equal(f.chroma_ratio, null, 'one cluster has no second to compare with')
  })
  it('counts four separate 5x5 red squares as four components of equal size, with the same coverage', () => {
    const f = measure(fourDots())
    assert.equal(f.high_chroma_coverage, 0.04)
    assert.deepEqual(f.high_chroma_components, { count: 4, largest_component_share: 0.25 })
    assert.equal(f.hue_count, 1)
  })
  it('joins 4-connected pixels only: a diagonal touch is two components', () => {
    const img = paint(paint(solid(40, 40, GREY), 4, 4, 4, 4, RED), 8, 8, 4, 4, RED)   // the squares meet at one corner
    assert.equal(measure(img).high_chroma_components.count, 2)
    const joined = paint(paint(solid(40, 40, GREY), 4, 4, 4, 4, RED), 8, 4, 4, 4, RED) // sharing an edge
    assert.deepEqual(measure(joined).high_chroma_components, { count: 1, largest_component_share: 1 })
  })
  it('ignores components under component_min pixels but keeps them in the coverage', () => {
    const img = paint(paint(solid(50, 50, GREY), 5, 5, 3, 1, RED), 20, 20, 10, 10, RED)   // 3 pixels, then 100
    const f = measure(img)
    assert.equal(f.high_chroma_coverage, 0.0412)
    assert.deepEqual(f.high_chroma_components, { count: 1, largest_component_share: 1 })
    const four = measure(paint(solid(50, 50, GREY), 5, 5, 2, 2, RED))                   // exactly component_min = 4: kept
    assert.equal(PX_PARAMS.component_min, 4)
    assert.equal(four.high_chroma_components.count, 1)
  })
  it('finds two hue clusters for red and blue regions of 5% or more each, and a chroma ratio', () => {
    const img = paint(paint(solid(40, 40, GREY), 0, 0, 10, 8, RED), 20, 20, 10, 8, BLUE)    // 5% each
    const f = measure(img)
    assert.equal(f.hue_count, 2)
    assert.notEqual(f.chroma_ratio, null)
    // red chroma 0.258, blue 0.313: both 5%, so the sort tie-breaks on hue, red (29) before blue (264); the ratio is the first cluster over the second
    assert.deepEqual(f.hue_clusters.map(c => c.hex), ['#FF0000', '#0000FF'])
    near(f.chroma_ratio as number, 0.258 / 0.313, 0.01, 'chroma ratio')
  })
  it('sorts clusters by share, largest first', () => {
    const img = paint(paint(solid(40, 40, GREY), 0, 0, 10, 10, BLUE), 20, 20, 5, 5, RED)    // blue 6.25%, red 1.56%
    const f = measure(img)
    assert.deepEqual(f.hue_clusters.map(c => c.hex), ['#0000FF', '#FF0000'])
    assert.ok(f.hue_clusters[0].share > f.hue_clusters[1].share)
  })
  it('merges clusters whose hues are within dh_min (20 deg), around the 0/360 wrap too', () => {
    const at = (h: number) => { const hex = oklchToHex(0.65, 0.14, h); return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as Rgb }
    const two = (h1: number, h2: number) => measure(paint(paint(solid(40, 40, GREY), 0, 0, 10, 10, at(h1)), 20, 20, 10, 10, at(h2)))
    assert.equal(two(355, 8).hue_count, 1, '13 deg apart, across the wrap')
    assert.equal(two(355, 40).hue_count, 2, '45 deg apart, across the wrap')
    assert.equal(two(100, 112).hue_count, 1)
    assert.equal(two(100, 130).hue_count, 2)
    near(two(355, 8).hue_clusters[0].hue, 1.5, 3, 'merged hue is the circular mean, not 181')
  })
  it('drops a hue cluster under min_share (1%) of all counted pixels', () => {
    const f = measure(paint(paint(solid(100, 100, GREY), 0, 0, 20, 20, BLUE), 50, 50, 7, 7, RED))   // blue 4%, red 0.49%
    assert.equal(f.hue_count, 1)
    assert.equal(f.hue_clusters[0].hex, '#0000FF')
    assert.equal(f.high_chroma_coverage, 0.0449)                      // the dropped cluster still counts as coverage
  })
  it('ignores low-chroma pixels for the clusters (c_min 0.04) and transparent pixels for everything', () => {
    const f = measure(paint(redSquare(), 0, 0, 50, 5, RED, 0))        // a transparent red stripe across the top: 2250 pixels count, not 2500
    assert.equal(f.hue_clusters[0].share, 0.0444)                     // 100 / 2250
    assert.equal(f.high_chroma_coverage, 0.0444)
    const faint = measure(paint(solid(50, 50, GREY), 10, 10, 10, 10, [200, 180, 180]))   // chroma ~0.03: under c_min, so no hue cluster
    assert.equal(faint.hue_count, 0)
  })
  it('records the version, the parameters and the size with the values', () => {
    const f = measure(redSquare())
    assert.deepEqual(f.params, PX_PARAMS)
    assert.deepEqual(PX_PARAMS, { downsample: 256, c_min: 0.04, c_high: 0.12, dh_min: 20, min_share: 0.01, seed: 7, k: 8, iters: 20, component_min: 4, near_black_L: 15, near_white_L: 90 })
    assert.equal(f.width, 50); assert.equal(f.height, 50)
  })
})

describe('measurePixels: tone clusters and photo contrast', () => {
  it('reports the k-means tone clusters the contrast is read from, with L, chroma, hue, share and hex', () => {
    const f = measure(paint(solid(32, 32, BLACK), 0, 16, 32, 16, WHITE))
    assert.equal(f.tone_clusters.length, 2)
    assert.deepEqual(f.tone_clusters.map(t => [t.hex, t.share, t.L]), [['#000000', 0.5, 0], ['#FFFFFF', 0.5, 1]])
  })
  it('is null when only one side exists', () => {
    assert.equal(measure(solid(8, 8, WHITE)).photo_contrast, null)
    assert.equal(measure(solid(8, 8, [128, 128, 128])).photo_contrast, null)    // L 0.6: light cluster only
  })
  it('is the WCAG ratio between the largest light and the largest dark cluster, two decimals', () => {
    const img = paint(paint(solid(40, 40, [235, 235, 235]), 0, 0, 40, 25, [20, 20, 20]), 0, 0, 40, 8, [60, 60, 60])   // rows: 8 of 60-grey, 17 of 20-grey, 15 of 235-grey
    const f = measure(img)
    assert.equal(f.tone_clusters.length, 3)
    // Y(235) = 0.83077, Y(20) = 0.00700, Y(60) = 0.04519 (typed from the WCAG formula); the larger dark cluster is the 20-grey one
    assert.equal(f.photo_contrast, 15.45)                              // (0.83077 + 0.05) / (0.00700 + 0.05) = 15.453
  })
})

describe('measurePixels: determinism and robustness', () => {
  const photoLike = (): Img => {                                      // a seeded pseudo-photo: smooth gradient plus noise plus two colored blobs
    let s = 12345
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
    const img = solid(64, 48, BLACK)
    for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) {
      const g = 30 + (x / 64) * 160 + rnd() * 12
      img.rgba.set([g + (x > 40 ? 40 : 0), g, g + (y > 30 ? 50 : 0), 255], (y * 64 + x) * 4)
    }
    paint(img, 8, 8, 12, 9, [200, 40, 30]); paint(img, 44, 30, 10, 10, [30, 140, 60])
    return img
  }
  it('gives deep-equal output for identical input, and nothing a JSON round trip changes', () => {
    const a = measure(photoLike()), b = measure(photoLike())
    assert.deepEqual(a, b)
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a)
    assert.ok(a.hue_count >= 1)
  })
  it('does not change its input', () => {
    const img = photoLike(); const copy = new Uint8ClampedArray(img.rgba)
    measure(img)
    assert.deepEqual(img.rgba, copy)
  })
  it('keeps hue_count and the coverage band under a slight white-balance shift', () => {
    const base = redSquare(), shifted = warm(redSquare())
    const a = measure(base), b = measure(shifted)
    assert.equal(a.hue_count, b.hue_count)
    assert.equal(coverageBand(a.high_chroma_coverage), coverageBand(b.high_chroma_coverage))
    assert.equal(measure(fourDots()).hue_count, measure(warm(fourDots())).hue_count)
  })
  it('names the coverage bands [0, .02), [.02, .05), [.05, .15), [.15, 1]', () => {
    assert.equal(coverageBand(0), 0); assert.equal(coverageBand(0.0199), 0)
    assert.equal(coverageBand(0.02), 1); assert.equal(coverageBand(0.0499), 1)
    assert.equal(coverageBand(0.05), 2); assert.equal(coverageBand(0.1499), 2)
    assert.equal(coverageBand(0.15), 3); assert.equal(coverageBand(1), 3)
  })
  it('compares two measurements to two decimals', () => {
    const a = measure(redSquare())
    const b: PixelFields = JSON.parse(JSON.stringify(a))
    assert.equal(fieldsEqualTo2dp(a, b), true)
    b.hue_clusters[0].hue += 0.004                                    // under half of the second decimal: still the same value at two decimals unless it crosses a rounding edge
    assert.equal(fieldsEqualTo2dp(a, b), true)
    b.hue_clusters[0].hue += 0.05
    assert.equal(fieldsEqualTo2dp(a, b), false)
    const c: PixelFields = JSON.parse(JSON.stringify(a)); c.hue_count = 2
    assert.equal(fieldsEqualTo2dp(a, c), false)
  })
})

describe('deriveSkin (adapted, by rule)', () => {
  it('derives a base, a readable fg and, when one place holds the red, an accent', () => {
    const f = measure(redSquare())
    const s = deriveSkin(f)
    assert.equal(s.accent, f.hue_clusters[0].hex)
    assert.ok(f.hue_clusters[0].chroma >= PX_PARAMS.c_high, 'the accent comes from a high-chroma cluster')
    const fgOnBase = s.checks.find(c => c.pair === 'fg on base')
    assert.ok(fgOnBase, 'fg on base is checked')
    assert.equal(fgOnBase.pass, true)
    assert.ok(fgOnBase.ratio >= 4.5)
    assert.equal(fgOnBase.ratio, contrastRatio(s.fg, s.base))
    const label = s.checks.find(c => c.pair === 'label on accent')
    assert.ok(label, 'label on accent is checked when there is an accent')
    assert.equal(label.ratio, Math.max(contrastRatio(s.fg, s.accent as string), contrastRatio(s.base, s.accent as string)))
    assert.ok(s.rules.includes('base: centroid of the largest low-chroma cluster, chroma clamped to 0.03'))
    assert.ok(hexToOklch(s.base).C <= 0.0301, 'base chroma is clamped')
  })
  it('makes no accent for four scattered dots and says so', () => {
    const s = deriveSkin(measure(fourDots()))
    assert.equal(s.accent, null)
    assert.ok(s.rules.includes('no single-place accent found'))
    assert.deepEqual(s.checks.map(c => c.pair), ['fg on base'], 'no accent, no label check')
  })
  it('puts accent on one place only when the largest component holds 60% of the high-chroma pixels', () => {
    const at = (big: number, small: number) => measure(paint(paint(solid(40, 40, GREY), 2, 2, big, 1, RED), 10, 30, small, 1, RED))
    // one row of 20 and one of 12: 20/32 = 0.625 -> one place; one row of 18 and one of 14: 18/32 = 0.5625 -> scatter
    assert.equal(deriveSkin(at(20, 12)).accent, '#FF0000')
    assert.equal(deriveSkin(at(18, 14)).accent, null)
  })
  it('takes the darkest tone cluster as base when over half the frame is near-black, and light text', () => {
    const f = measure(paint(solid(40, 40, BLACK), 30, 30, 10, 10, WHITE))
    const s = deriveSkin(f)
    assert.equal(f.luminance_shares.near_black, 0.9375)
    assert.equal(s.base, '#000000')
    assert.equal(s.fg, '#F5F5F5')
    assert.ok(s.rules.some(r => r.startsWith('base: centroid of the darkest tone cluster')))
    assert.equal(s.checks[0].pass, true)
  })
  it('takes the lightest tone cluster as base when over half the frame is near-white, and dark text', () => {
    const s = deriveSkin(measure(paint(solid(40, 40, WHITE), 0, 0, 10, 10, [60, 60, 60])))
    assert.equal(s.base, '#FFFFFF')
    assert.equal(s.fg, '#111111')
    assert.ok(s.rules.some(r => r.startsWith('base: centroid of the lightest tone cluster')))
  })
  it('clamps the base chroma to 0.03 without moving its hue or lightness', () => {
    const rgb: Rgb = [0xD8, 0xC8, 0xB0]                              // a warm paper: chroma 0.037, under c_min, so it is a low-chroma cluster
    const src = hexToOklch('#D8C8B0')
    assert.ok(src.C > 0.03 && src.C < PX_PARAMS.c_min, 'the source is more colorful than the clamp and less than c_min')
    const s = deriveSkin(measure(solid(20, 20, rgb)))
    const b = hexToOklch(s.base)
    near(b.C, 0.03, 0.003, 'clamped chroma'); near(b.L, src.L, 0.01, 'lightness kept'); near(b.h, src.h, 4, 'hue kept')
    assert.ok(s.rules.includes('base: centroid of the largest low-chroma cluster, chroma clamped to 0.03'))
  })
  it('falls back to the largest tone cluster, and says so, when no cluster is low-chroma', () => {
    const s = deriveSkin(measure(solid(20, 20, [0xE0, 0xB0, 0x80])))   // chroma ~0.07 everywhere: no tone cluster under c_min
    near(hexToOklch(s.base).C, 0.03, 0.003, 'clamped chroma')
    assert.ok(s.rules.some(r => r.startsWith('base: no low-chroma cluster')))
  })
  it('switches fg to the other neutral, and records it, when the opposite side misses 4.5:1', () => {
    const f = measure(solid(20, 20, [126, 126, 126]))              // L 0.593: the dark side, where #F5F5F5 gets 3.7 and #111111 gets 4.7
    const s = deriveSkin(f)
    assert.equal(s.base, '#7E7E7E')
    assert.equal(s.fg, '#111111')
    assert.ok(s.rules.includes('fg adjusted for 4.5:1'))
    assert.equal(s.checks[0].pass, true)
  })
  it('records a failure when neither neutral reaches 4.5:1, and still leaves the accent alone', () => {
    const f = measure(paint(solid(40, 40, [118, 118, 118]), 5, 5, 8, 8, RED))   // mid grey (Y 0.181): #F5F5F5 and #111111 both get about 4.2
    const s = deriveSkin(f)
    assert.equal(s.checks[0].pair, 'fg on base')
    assert.equal(s.checks[0].pass, false)
    assert.ok(s.checks[0].ratio < 4.5)
    assert.equal(s.accent, f.hue_clusters[0].hex, 'accent is never adjusted for a failing check')
  })
  it('does not break on an image with nothing to count', () => {
    const s = deriveSkin(measure(solid(4, 4, WHITE, 0)))
    assert.match(s.base, /^#[0-9A-F]{6}$/)
    assert.equal(s.accent, null)
    assert.ok(s.rules.length > 0)
  })
  it('is deterministic', () => {
    assert.deepEqual(deriveSkin(measure(redSquare())), deriveSkin(measure(redSquare())))
  })
})
