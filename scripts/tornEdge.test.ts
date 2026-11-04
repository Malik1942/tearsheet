/** The torn bottom of a display title (src/brand/tornEdge.ts), read off the board's rim under the name. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { nameBite, tornBottom, TITLE_TEAR } from '../src/brand/tornEdge.ts'

/** The y values (em) of a polygon() string, in order. */
const ys = (poly: string, pick: (s: string) => number) => poly.slice('polygon('.length, -1).split(', ').map(pick)

describe('the tear under a display title', () => {
  it('keeps the box whole above and tears only its bottom: the deepest bite on the bottom edge, every other bite above it', () => {
    assert.match(TITLE_TEAR.clip, /^polygon\(0 0, 100% 0, /)
    const bites = ys(TITLE_TEAR.clip, s => Number(/100% - (-?[\d.]+)em/.exec(s)?.[1] ?? NaN)).slice(2)
    assert.ok(bites.every(b => b >= 0), 'no bite below the bottom edge')
    assert.equal(Math.min(...bites), 0)
    assert.ok(Math.abs(Math.max(...bites) - TITLE_TEAR.above) < 1e-9, 'the rim box starts at the highest bite')
  })
  it('hangs the fibre below the bite, inside its box, at the board’s depth (a few hundredths of an em)', () => {
    const rim = ys(TITLE_TEAR.rim, s => Number(/ (-?[\d.]+)em$/.exec(s)?.[1] ?? NaN))
    assert.ok(rim.every(y => y >= 0 && y <= TITLE_TEAR.height + 1e-9))
    assert.ok(TITLE_TEAR.height > TITLE_TEAR.above && TITLE_TEAR.height < 0.12)
  })
  it('is the same every time: read from the board, never random', () => {
    assert.deepEqual(tornBottom(), TITLE_TEAR)
  })
  it('bites the header name with every sample of the board’s edge, set nearer the baseline than the board draws it', () => {
    const ys = (d: string) => [...d.matchAll(/L(-?[\d.]+),(-?[\d.]+)/g)].map(m => Number(m[2])).filter(y => y > 0)
    const board = ys(nameBite(0)), header = ys(nameBite())
    assert.ok(header.length > 150, 'the board’s own teeth, not a thinned copy')
    assert.ok(header.every((y, i) => y === board[i] + 35))
    assert.ok(header.every(y => y < 686), 'every letter still bitten')
  })
})
