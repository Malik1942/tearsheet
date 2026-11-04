/** Photo tiles keep their crop; only the crops that look broken change (Malik, 2026-11-04). A tile keeps object-fit: cover, except it shows the photo whole
 *  (contain, on the photo's border color) when cover would cut the photo's sides, hide more than 20% of its width, and the border is plain: at least 95% of
 *  the outer ring (3% of the long side, at least 2 px, on a copy at most 96 px long) within ΔE 0.06 in OKLab of the ring's median color.
 *  Expected values are typed out from the request, never read from photoFit.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { borderOfPixels, tileFit } from '../src/lib/photoFit.ts'
import { starterBricks } from '../src/lib/starters.ts'
import { brickFromPhoto } from '../src/lib/addPhotos.ts'

type RGB = [number, number, number]
/** An opaque RGBA image, every pixel painted by `paint`. */
const image = (w: number, h: number, paint: (x: number, y: number) => RGB) => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([...paint(x, y), 255], (y * w + x) * 4)
  return data
}
const WHITE: RGB = [255, 255, 255], BLACK: RGB = [0, 0, 0]
/** A busy middle that is never near white. */
const busy = (x: number, y: number): RGB => [(x * 37) % 200, (y * 53) % 200, ((x + y) * 29) % 200]
/** A 96 x 50 copy (CalmMouse's 1200 x 630 at 96 px): its ring is 3 px (3% of 96 is 2.88), 840 pixels in all. */
const W = 96, H = 50, RING = 3
const inRing = (x: number, y: number, w = W, h = H, r = RING) => x < r || x >= w - r || y < r || y >= h - r

describe('the border: the outer ring of a copy at most 96 px long', () => {
  it('a white ring round a busy middle is plain, and its color is white', () => {
    assert.deepEqual(borderOfPixels(image(W, H, (x, y) => (inRing(x, y) ? WHITE : busy(x, y))), W, H), { plain: true, color: '#ffffff' })
  })
  it('the ring is 3% of the long side: a dark line 2 px in breaks it, one 3 px in is inside it', () => {
    const line = (at: number) => image(W, H, (x, y) => (x === at ? BLACK : inRing(x, y) ? WHITE : busy(x, y)))
    assert.equal(borderOfPixels(line(2), W, H).plain, false)   // 50 of 840 ring pixels off: 94.0% near
    assert.equal(borderOfPixels(line(3), W, H).plain, true)
  })
  it('and at least 2 px: on a 40 x 30 copy (3% is 1.2 px) a dark line 1 px in breaks it, one 2 px in does not', () => {
    const line = (at: number) => image(40, 30, (x, y) => (x === at ? BLACK : inRing(x, y, 40, 30, 2) ? WHITE : busy(x, y)))
    assert.equal(borderOfPixels(line(1), 40, 30).plain, false)
    assert.equal(borderOfPixels(line(2), 40, 30).plain, true)
  })
  it('plain means at least 95% of the ring near its median: 42 of 840 off is plain, 43 is not', () => {
    const off = (n: number) => image(W, H, (x, y) => (y === 0 && x < n ? BLACK : inRing(x, y) ? WHITE : busy(x, y)))
    assert.equal(borderOfPixels(off(42), W, H).plain, true)
    assert.equal(borderOfPixels(off(43), W, H).plain, false)
  })
  it('near means within ΔE 0.06 in OKLab: a #eeeeee strip (0.051 from white) stays plain, a #e8e8e8 strip (0.069) does not', () => {
    const strip = (g: number) => image(W, H, (x, y) => (x < RING ? [g, g, g] : inRing(x, y) ? WHITE : busy(x, y)))   // 150 of 840 ring pixels
    assert.deepEqual(borderOfPixels(strip(0xee), W, H), { plain: true, color: '#ffffff' })
    assert.equal(borderOfPixels(strip(0xe8), W, H).plain, false)
  })
  it("the color is the ring's median as sRGB hex, not its mean", () => {
    // 60% of the ring #141414, 40% #1e1e1e (ΔE 0.044 apart): the median is the first, and the ring is plain
    const ring = image(W, H, (x, y) => (!inRing(x, y) ? busy(x, y) : (x + y) % 5 < 3 ? [0x14, 0x14, 0x14] : [0x1e, 0x1e, 0x1e]))
    assert.deepEqual(borderOfPixels(ring, W, H), { plain: true, color: '#141414' })
  })
})

describe('the rule: cover, except the photo shows whole when all three hold', () => {
  const plain = { plain: true, color: '#ffffff' }
  it('wider than the tile, more than 20% of its width hidden, a plain border: whole, centred, on the border color', () => {
    assert.deepEqual(tileFit({ width: 1200, height: 630, border: plain }, 4 / 5), { objectFit: 'contain', background: '#ffffff' })
  })
  it('a tall photo always stays cover: top and bottom crops drop whole lines, never half words', () => {
    assert.equal(tileFit({ width: 630, height: 1200, border: plain }, 4 / 5), undefined)
    assert.equal(tileFit({ width: 630, height: 1200, border: plain }, 16 / 10), undefined)
  })
  it('20% hidden or less stays cover (tileRatio / photoRatio < 0.8 to change)', () => {
    assert.equal(tileFit({ width: 1250, height: 1000, border: plain }, 1), undefined)   // exactly 0.8
    assert.deepEqual(tileFit({ width: 1260, height: 1000, border: plain }, 1), { objectFit: 'contain', background: '#ffffff' })
  })
  it('a border that is not plain stays cover', () => {
    assert.equal(tileFit({ width: 1200, height: 630, border: { plain: false, color: '#ffffff' } }, 4 / 5), undefined)
  })
  it('a photo without a measured border stays cover', () => {
    assert.equal(tileFit({ width: 1200, height: 630 }, 4 / 5), undefined)
  })
})

describe('at save, the border rides on the brick as photo.border', () => {
  const prepared = { dataUrl: 'data:image/jpeg;base64,AAAA', width: 1200, height: 630, takenAt: null }
  it('the { plain, color } prepareImage measured', () => {
    assert.deepEqual(brickFromPhoto({ ...prepared, border: { plain: true, color: '#ffffff' } }).photo.border, { plain: true, color: '#ffffff' })
  })
  it('none measured, no field: the tiles keep the crop', () => {
    const b = brickFromPhoto(prepared)
    assert.equal('border' in b.photo, false)
    assert.equal(tileFit(b.photo, 4 / 5), undefined)
  })
})

describe("today's starters (borders from src/fixtures/borders.json)", () => {
  const starters = starterBricks()
  const LIBRARY = 4 / 5, MAKE_ROW = 1, SHEET = 16 / 10
  const calm = starters.find(b => b.id === 'calmmouse')!
  const others = starters.filter(b => b.id !== 'calmmouse')
  it('every starter carries a measured border', () => {
    assert.equal(starters.length, 12)
    for (const b of starters) assert.ok(b.photo.border, `${b.id} has no border`)
  })
  it("CalmMouse's border is plain white; Bauhaus's is not plain", () => {
    assert.deepEqual(calm.photo.border, { plain: true, color: '#ffffff' })
    assert.equal(starters.find(b => b.id === 'bauhaus-1923-staatliches-bauhaus-weimar')!.photo.border!.plain, false)
  })
  it('CalmMouse shows whole on white in the Library and in the Make row', () => {
    assert.deepEqual(tileFit(calm.photo, LIBRARY), { objectFit: 'contain', background: '#ffffff' })
    assert.deepEqual(tileFit(calm.photo, MAKE_ROW), { objectFit: 'contain', background: '#ffffff' })
  })
  it('every other tile is unchanged, Bauhaus included', () => {
    assert.deepEqual(others.filter(b => tileFit(b.photo, LIBRARY) || tileFit(b.photo, MAKE_ROW)).map(b => b.id), [])
  })
  it('in the 16:10 sheets nothing changes: CalmMouse loses under 20% there', () => {
    assert.deepEqual(starters.filter(b => tileFit(b.photo, SHEET)).map(b => b.id), [])
  })
})
