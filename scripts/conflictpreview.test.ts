/** Spec v3 C6: a conflict is chosen by preview. Each candidate becomes a tile: one mini-screen rendered with the project's params and only that candidate's value for the conflicting key.
 *  Expected values are typed out from the sample data (g1, g2, calmmouse), never read from the code under test. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { resolveProject, type Project, type RelationRef } from '../src/lib/mapRelations.ts'
import { conflictTiles } from '../src/lib/conflictPreview.ts'
import { PARAMETER_KEYS, type ParameterKey } from '../src/shell/params.ts'

const project = (choice: Project['choice'] = {}): Project => ({ id: 'p', intent: '', createdAt: '', brickIds: ['g1', 'g2', 'calmmouse'], disabled: {}, choice, locks: {}, manual: {} })
const resolve = (choice: Project['choice'] = {}) => resolveProject(project(choice), SAMPLES)

describe('conflictTiles (C6)', () => {
  it('the sample project has the three conflicts the tiles are tested on', () => {
    assert.deepEqual(resolve().conflicts, ['image_text_dominance', 'accent_coverage', 'palette_hue_count'])
  })

  it('one tile per candidate, in the resolver\'s order, with brick id, value and provenance as the sample data has them', () => {
    const tiles = conflictTiles(resolve(), 'image_text_dominance')
    assert.deepEqual(tiles.map(t => [t.ref, t.brickId, t.value, t.provenance]), [
      ['g2/r1', 'g2', 0.95, 'measured'],
      ['calmmouse/r2', 'calmmouse', 0.5, 'measured'],
    ])
    assert.deepEqual(conflictTiles(resolve(), 'palette_hue_count').map(t => [t.ref, t.brickId, t.value]), [['g1/r3', 'g1', 3], ['g2/r3', 'g2', 2]])
  })

  it('params differ from the project\'s params only in key k, where each holds that candidate\'s own value', () => {
    const resolved = resolve()
    for (const k of resolved.conflicts) {
      const tiles = conflictTiles(resolved, k)
      assert.equal(tiles.length, resolved.candidates[k]!.length)
      for (const t of tiles) {
        assert.equal(t.params[k], t.value)
        for (const other of PARAMETER_KEYS.filter(x => x !== k)) assert.equal(t.params[other], resolved.params[other], `${other} must stay as the project has it`)
      }
    }
  })

  it('the two tiles of image_text_dominance really render two different values', () => {
    const [a, b] = conflictTiles(resolve(), 'image_text_dominance')
    assert.equal(a.params.image_text_dominance, 0.95)
    assert.equal(b.params.image_text_dominance, 0.5)
  })

  it('does not change resolved.params', () => {
    const resolved = resolve()
    const before = JSON.stringify(resolved.params)
    conflictTiles(resolved, 'palette_hue_count')
    assert.equal(JSON.stringify(resolved.params), before)
  })

  it('with no choice, only the first candidate (the top brick) is pressed', () => {
    for (const k of resolve().conflicts) {
      const tiles = conflictTiles(resolve(), k)
      assert.deepEqual(tiles.map(t => t.pressed), tiles.map((_, i) => i === 0), k)
    }
  })

  it('with a choice, only that candidate is pressed', () => {
    const choice: Project['choice'] = { image_text_dominance: 'calmmouse/r2' }
    const tiles = conflictTiles(resolve(choice), 'image_text_dominance', choice.image_text_dominance)
    assert.deepEqual(tiles.map(t => [t.ref, t.pressed]), [['g2/r1', false], ['calmmouse/r2', true]])
    const second: RelationRef = 'g2/r3'
    assert.deepEqual(conflictTiles(resolve({ palette_hue_count: second }), 'palette_hue_count', second).map(t => t.pressed), [false, true])
  })

  it('choosing the first candidate explicitly still presses it alone', () => {
    const tiles = conflictTiles(resolve({ palette_hue_count: 'g1/r3' }), 'palette_hue_count', 'g1/r3')
    assert.deepEqual(tiles.map(t => t.pressed), [true, false])
  })

  it('a choice that names no candidate of this key falls back to the first candidate', () => {
    const tiles = conflictTiles(resolve(), 'palette_hue_count', 'calmmouse/r2')
    assert.deepEqual(tiles.map(t => t.pressed), [true, false])
  })

  it('a choice of the top brick keeps the tile values; a project that records it reads adapted · by you', () => {
    const resolved = resolve({ accent_coverage: 'calmmouse/r3' })
    assert.equal(resolved.values.accent_coverage.provenance, 'adapted')
    assert.equal(resolved.values.accent_coverage.source?.note?.startsWith('by you:'), true)
    // tiles built from the chosen project still carry each candidate's own measured provenance
    assert.deepEqual(conflictTiles(resolved, 'accent_coverage', 'calmmouse/r3').map(t => t.provenance), ['measured', 'measured'])
  })

  it('a key nobody sets as a relation gives no tiles', () => {
    assert.deepEqual(conflictTiles(resolve(), 'color_bg' as ParameterKey), [])
  })
})
