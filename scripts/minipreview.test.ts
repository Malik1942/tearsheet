/** Spec v3 B2/L6/P7/P8: the mini-preview's parameters (one brick, its own skin) and the three rotations the composition picker shows.
 *  Expected values are typed out from the spec and the sample data, never read from the code under test. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import type { Brick } from '../src/lib/types.ts'
import { resolveProject } from '../src/lib/mapRelations.ts'
import { brickParams, rotations } from '../src/lib/brickPreview.ts'
import { DEFAULT_PARAMS, RELATIONSHIP_KEYS } from '../src/shell/params.ts'

const byId = (id: string): Brick => SAMPLES.find(b => b.id === id)!

describe('rotations (P8)', () => {
  it('three ids give three arrays, each starting at a different position', () => {
    assert.deepEqual(rotations(['a', 'b', 'c']), [['a', 'b', 'c'], ['b', 'c', 'a'], ['c', 'a', 'b']])
  })
  it('two ids give two arrays', () => {
    assert.deepEqual(rotations(['a', 'b']), [['a', 'b'], ['b', 'a']])
  })
  it('one id gives one array', () => {
    assert.deepEqual(rotations(['a']), [['a']])
  })
  it('no ids give none', () => {
    assert.deepEqual(rotations([]), [])
  })
  it('more than three ids rotate only the first three positions; the rest stay in place', () => {
    assert.deepEqual(rotations(['a', 'b', 'c', 'd', 'e']), [['a', 'b', 'c', 'd', 'e'], ['b', 'c', 'a', 'd', 'e'], ['c', 'a', 'b', 'd', 'e']])
    assert.deepEqual(rotations(['a', 'b', 'c', 'd']).map(r => r.join('')), ['abcd', 'bcad', 'cabd'])
  })
  it('never returns more than three, and every array holds the same ids as the input', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    const out = rotations(ids)
    assert.equal(out.length, 3)
    for (const r of out) assert.deepEqual([...r].sort(), ids)
  })
  it('does not change the array it is given', () => {
    const ids = ['a', 'b', 'c']
    rotations(ids)
    assert.deepEqual(ids, ['a', 'b', 'c'])
  })
  it('puts a different brick on top in each array', () => {
    assert.deepEqual(rotations(['a', 'b', 'c']).map(r => r[0]), ['a', 'b', 'c'])
  })
})

describe('brickParams (B2, L6, P7)', () => {
  it('calmmouse: its own type scale, its own accent coverage, its own measured background', () => {
    const b = byId('calmmouse')
    const { params } = brickParams(b)
    assert.equal(params.type_scale_ratio, 2)
    assert.equal(params.accent_coverage, '<=5%')
    assert.equal(params.color_bg, b.skin_measured!.color_bg)
    assert.equal(params.color_bg, '#FFFFFF')
  })
  it('calmmouse: the count of items that could not carry over is the resolved count (one)', () => {
    const b = byId('calmmouse')
    const resolved = resolveProject({ id: 'mini', intent: '', createdAt: '', brickIds: [b.id], disabled: {}, choice: {}, locks: {}, manual: {} }, [b])
    assert.equal(brickParams(b).unexpressed, resolved.unexpressed.length)
    assert.equal(brickParams(b).unexpressed, 1)
  })
  it('sets at most three relationship parameters away from the shell defaults (the per-brick cap)', () => {
    for (const b of SAMPLES) {
      const { params } = brickParams(b)
      const moved = RELATIONSHIP_KEYS.filter(k => params[k] !== DEFAULT_PARAMS[k])
      assert.ok(moved.length <= 3, `${b.id} moved ${moved.join(', ')}`)
    }
  })
  it('every sample shows its own measured skin colors', () => {
    for (const b of SAMPLES) {
      const { params } = brickParams(b)
      assert.equal(params.color_bg, b.skin_measured!.color_bg, b.id)
      assert.equal(params.color_fg, b.skin_measured!.color_fg, b.id)
      assert.equal(params.color_accent, b.skin_measured!.color_accent, b.id)
    }
  })
  it('a brick with no relations gives the shell defaults for every relationship parameter and its measured skin', () => {
    const b: Brick = { ...byId('calmmouse'), relations: [], fragile_if_changed: '' }
    const { params, unexpressed } = brickParams(b)
    for (const k of RELATIONSHIP_KEYS) assert.equal(params[k], DEFAULT_PARAMS[k], k)
    assert.equal(params.color_bg, b.skin_measured!.color_bg)
    assert.equal(params.color_fg, b.skin_measured!.color_fg)
    assert.equal(params.color_accent, b.skin_measured!.color_accent)
    assert.equal(params.radius, DEFAULT_PARAMS.radius)
    assert.equal(params.spacing_unit, DEFAULT_PARAMS.spacing_unit)
    assert.equal(unexpressed, 0)
  })
  it('a brick with neither relations nor a measured skin is the shell defaults throughout', () => {
    const { skin_measured: _s, ...rest } = byId('calmmouse')
    const b: Brick = { ...rest, relations: [], measurements: [], fragile_if_changed: '' }
    const { params, unexpressed } = brickParams(b)
    assert.deepEqual(params, DEFAULT_PARAMS)
    assert.equal(unexpressed, 0)
  })
  it('resolveProject keeps the order it is given, so the top brick of a picker column wins where two bricks set the same parameter', () => {
    const g1 = byId('g1'), calm = byId('calmmouse')
    const base = { id: 'mini', intent: '', createdAt: '', disabled: {}, choice: {}, locks: {}, manual: {} }
    const a = resolveProject({ ...base, brickIds: [calm.id, g1.id] }, [calm, g1]).params
    const z = resolveProject({ ...base, brickIds: [g1.id, calm.id] }, [calm, g1]).params
    assert.equal(a.color_bg, calm.skin_measured!.color_bg)
    assert.equal(z.color_bg, g1.skin_measured!.color_bg)
  })
})
