/** The Data tear generator (src/brand/tear.ts): deterministic, the edges' ends on their baselines (no spike at the top right, no tooth at the bottom
 *  left, the master mark included), stripes whose visible areas match their shares, an outline that never crosses itself, the tones joined from the
 *  measured clusters as the board's are. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildTear, easeEdges, edgesFromProfile, pagePolygon, photoTear, tearSvg, threeTones, toothedEdges, type Pt, type TornEdges } from '../src/brand/tear'
import { MASTER_EDGES } from '../src/brand/board'

const area = (pts: Pt[]) => Math.abs(pts.reduce((t, [x, y], i) => { const [u, v] = pts[(i + 1) % pts.length]; return t + x * v - u * y }, 0)) / 2
const mean = (v: number[]) => v.reduce((t, x) => t + x, 0) / v.length
/** A made-up photo, the same every run: bands of light and dark with a little texture. */
function photo(w: number, h: number, seed: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = 128 + 90 * Math.sin((y * (3 + seed)) / h * Math.PI) * Math.cos((x * (2 + seed)) / w * Math.PI) + ((x * 7 + y * 13 + seed * 31) % 17) - 8
    const i = (y * w + x) * 4
    px[i] = v; px[i + 1] = v * 0.9; px[i + 2] = v * 0.7; px[i + 3] = 255
  }
  return px
}
const TONES = [{ hex: '#E5DED8', share: 0.422 }, { hex: '#EFE8E2', share: 0.351 }, { hex: '#D8D1C9', share: 0.099 }, { hex: '#B5B9BC', share: 0.055 }, { hex: '#8E9DAA', share: 0.044 }, { hex: '#5F7B94', share: 0.029 }]
function crosses(poly: Pt[]): boolean {
  const n = poly.length
  const hit = (a: Pt, b: Pt, c: Pt, d: Pt) => {
    const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
  }
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue
    if (hit(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true
  }
  return false
}

describe('the data tear', () => {
  it('is deterministic: the same photo gives the same tear', () => {
    const a = tearSvg(photoTear(photo(200, 150, 1), 200, 150, TONES)), b = tearSvg(photoTear(photo(200, 150, 1), 200, 150, TONES))
    assert.equal(a, b)
    assert.notEqual(a, tearSvg(photoTear(photo(200, 150, 2), 200, 150, TONES)), 'another photo, another tear')
  })

  it('starts and ends each edge on its baseline, the master mark included: no spike at the top right, no tooth at the bottom left', () => {
    const raw = MASTER_EDGES, e = easeEdges(raw)
    const bR = mean(raw.right), bB = mean(raw.bottom)
    assert.ok(Math.abs(raw.right[0] - bR) > 5 && Math.abs(raw.bottom[0] - bB) > 5, 'the board drew both: 94.4 at the top right, 94.6 at the bottom left')
    for (const [v, b] of [[e.right[0], bR], [e.right.at(-1)!, bR], [e.bottom[0], bB], [e.bottom.at(-1)!, bB]] as const) assert.ok(Math.abs(v - b) < 1e-9)
    const page = pagePolygon(e)
    const topRight = page.filter(([, y]) => y > 0 && y < 2).map(([x]) => x)
    assert.ok(Math.max(...topRight) < bR + 2, `the top right stays within 2 of the baseline (${Math.max(...topRight).toFixed(1)} vs ${bR.toFixed(1)})`)
    const bottomLeft = page.filter(([x]) => x < 2).map(([, y]) => y).filter(y => y > 50)
    assert.ok(Math.max(...bottomLeft) < bB + 2, 'the bottom left stays within 2 of the baseline')
  })

  it('never crosses itself, for the master and for photos', () => {
    assert.equal(crosses(pagePolygon(easeEdges(MASTER_EDGES))), false)
    for (const seed of [0, 1, 2, 3, 5, 8]) assert.equal(crosses(pagePolygon(edgesFromProfile({ rows: Array.from({ length: 120 }, (_, i) => 0.5 + 0.5 * Math.sin(i * (seed + 1) * 0.7)), cols: Array.from({ length: 160 }, (_, i) => 0.5 + 0.5 * Math.cos(i * (seed + 2) * 0.9)) }))), false, `seed ${seed}`)
  })

  it('gives every stripe its share of the visible page, the smallest too', () => {
    for (const seed of [1, 2, 3]) {
      const t = photoTear(photo(240, 180, seed), 240, 180, TONES)
      const total = area(t.page)
      assert.equal(t.stripes.length, 3)
      for (const s of t.stripes) assert.ok(Math.abs(area(s.pts) / total - s.share) < 0.006, `${s.hex}: ${(area(s.pts) / total).toFixed(3)} vs ${s.share.toFixed(3)}`)
      assert.ok(t.stripes[0].pts[0][0] <= t.stripes[1].pts[0][0], 'largest share at the left')
    }
  })

  it('joins the measured tone clusters into three as the board does (Matthews trade card: 86 / 11 / 3 on the board)', () => {
    const three = threeTones(TONES)
    assert.deepEqual(three.map(t => Math.round(t.share * 100)), [87, 10, 3])
    assert.equal(three[2].hex, '#5F7B94', 'the small blue is kept, not swallowed')
    const one = buildTear(easeEdges(MASTER_EDGES), [{ hex: '#1B1E21', share: 1 }])
    assert.equal(one.stripes.length, 1)
  })

  it('smooths the 32 px mark to three teeth a side, ends on the baseline', () => {
    const eased = easeEdges(MASTER_EDGES), t: TornEdges = toothedEdges(eased, 10)
    for (const [v, before] of [[t.right, eased.right], [t.bottom, eased.bottom]]) {
      let tips = 0
      for (let i = 1; i < v.length - 1; i++) if (v[i] > v[i - 1] && v[i] >= v[i + 1]) tips++
      assert.equal(tips, 3)
      assert.ok(Math.abs(v[0] - before[0]) < 1e-9 && Math.abs(v.at(-1)! - before.at(-1)!) < 1e-9, 'the ends stay on the baseline')
    }
  })
})
