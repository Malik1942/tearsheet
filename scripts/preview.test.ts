/** Spec v2 V1: the phone preview reads the conclusion first. `whatChanged` picks the up-to-three relationship values a brick rule set, on the real sample bricks.
 *  Expected keys are typed out from the spec's order (brick position in the project, then the vocabulary's key order), never read from landing.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { resolveProject, type Project } from '../src/lib/mapRelations.ts'
import type { Brick } from '../src/lib/types.ts'
import { RELATIONSHIP_KEYS } from '../src/shell/params.ts'
import { ruleTextOf, whatChanged } from '../src/lib/landing.ts'

const project = (patch: Partial<Project> = {}): Project => ({ id: 't', intent: 'x', createdAt: '', brickIds: ['g1', 'g2', 'calmmouse'], disabled: {}, choice: {}, locks: {}, manual: {}, ...patch })
const changed = (p: Project, bricks: Brick[] = SAMPLES) => whatChanged(p, resolveProject(p, bricks), bricks)
const keysOf = (p: Project, bricks: Brick[] = SAMPLES) => changed(p, bricks).map(pv => pv.key)
const brickOf = (p: Project, bricks: Brick[] = SAMPLES) => changed(p, bricks).map(pv => pv.source?.brickId)

describe('whatChanged on g1 + g2 + calmmouse', () => {
  const p = project()
  const out = changed(p)
  it('gives at most three lines', () => {
    assert.equal(out.length, 3)
  })
  it('takes only values a brick of the project set, each with a rule to read', () => {
    for (const pv of out) {
      assert.ok(p.brickIds.includes(pv.source?.brickId ?? ''), pv.key)
      assert.notEqual(ruleTextOf(pv, SAMPLES), null, pv.key)
      assert.ok((RELATIONSHIP_KEYS as readonly string[]).includes(pv.key), pv.key)
    }
  })
  it("orders by the brick's position in the project, then by the vocabulary's key order", () => {
    // g1 is first and sets hierarchy_mode and palette_hue_count (its rhythm rule has no value to express); g2 follows with image_text_dominance and accent_coverage; calmmouse's type_scale_ratio is cut
    // key order alone would put type_scale_ratio first, so this also shows that the brick position comes before the key
    assert.deepEqual(keysOf(p), ['hierarchy_mode', 'palette_hue_count', 'image_text_dominance'])
    assert.deepEqual(brickOf(p), ['g1', 'g1', 'g2'])
  })
  it("follows the project's brick order: the same bricks the other way round start with calmmouse", () => {
    const back = project({ brickIds: ['calmmouse', 'g2', 'g1'] })
    assert.deepEqual(keysOf(back), ['type_scale_ratio', 'image_text_dominance', 'accent_coverage'])
    assert.deepEqual(brickOf(back), ['calmmouse', 'calmmouse', 'calmmouse'])
  })
  it('cuts the list at three from a longer one, keeping the first three', () => {
    const r = resolveProject(p, SAMPLES)
    const settable = RELATIONSHIP_KEYS.filter(k => p.brickIds.includes(r.values[k].source?.brickId ?? '') && ruleTextOf(r.values[k], SAMPLES) !== null)
    assert.equal(settable.length, 5)   // type_scale_ratio, hierarchy_mode, image_text_dominance, accent_coverage, palette_hue_count
    assert.deepEqual(out.map(pv => pv.key), ['hierarchy_mode', 'palette_hue_count', 'image_text_dominance'])
  })
  it('hands back the resolved values themselves', () => {
    const r = resolveProject(p, SAMPLES)
    for (const pv of whatChanged(p, r, SAMPLES)) assert.equal(pv, r.values[pv.key])
  })
  it('fills the three from the first brick before it looks at the second', () => {
    const two = project({ brickIds: ['g2', 'calmmouse'] })
    // g2 sets image_text_dominance, accent_coverage and palette_hue_count; calmmouse adds type_scale_ratio, its other two keys being g2's already
    assert.deepEqual(keysOf(two), ['image_text_dominance', 'accent_coverage', 'palette_hue_count'])
    assert.deepEqual(brickOf(two), ['g2', 'g2', 'g2'])
  })
  it('lets a later brick in when the first sets fewer than three', () => {
    const two = project({ brickIds: ['g2', 'calmmouse'], disabled: { 'g2/r2': true, 'g2/r3': true } })
    const out2 = whatChanged(two, resolveProject(two, SAMPLES), SAMPLES)
    // g2 keeps only image_text_dominance; calmmouse then adds type_scale_ratio and accent_coverage, in key order
    assert.deepEqual(out2.map(pv => pv.key), ['image_text_dominance', 'type_scale_ratio', 'accent_coverage'])
    assert.deepEqual(out2.map(pv => pv.source?.brickId), ['g2', 'calmmouse', 'calmmouse'])
  })
})

describe('whatChanged leaves out what a person set', () => {
  it('never lists density when project.manual.density is set: its brick is user', () => {
    const p = project({ manual: { density: 2 } })
    assert.ok(!keysOf(p).includes('density'))
    const r = resolveProject(p, SAMPLES)
    assert.equal(r.values.density.source?.brickId, 'user')
  })
  it('drops density from a project whose brick does set it, once it is typed by hand', () => {
    const c1 = project({ brickIds: ['c1'] })
    assert.deepEqual(keysOf(c1), ['density', 'image_text_dominance', 'palette_hue_count'])
    const typed = project({ brickIds: ['c1'], manual: { density: 2 } })
    assert.deepEqual(keysOf(typed), ['image_text_dominance', 'palette_hue_count'])
  })
  it('leaves out a locked value whose brick has left the project, and keeps one whose brick is still in it', () => {
    const full = resolveProject(project(), SAMPLES)
    const gone = project({ brickIds: ['calmmouse'], locks: { hierarchy_mode: full.values.hierarchy_mode } })
    assert.equal(full.values.hierarchy_mode.source?.brickId, 'g1')
    assert.ok(!keysOf(gone).includes('hierarchy_mode'))
    const kept = project({ brickIds: ['g1', 'calmmouse'], locks: { hierarchy_mode: full.values.hierarchy_mode } })
    assert.ok(keysOf(kept).includes('hierarchy_mode'))
  })
})

describe('whatChanged with nothing to say', () => {
  it('leaves out a locked value whose brick is in the project but no longer in the library: there is no thumbnail to link', () => {
    const full = resolveProject(project(), SAMPLES)
    const lockedToG1 = project({ brickIds: ['g1'], locks: { hierarchy_mode: full.values.hierarchy_mode } })
    const without = SAMPLES.filter(b => b.id !== 'g1')
    assert.deepEqual(whatChanged(lockedToG1, resolveProject(lockedToG1, without), without), [])
  })
  const bare: Brick = { ...SAMPLES.find(b => b.id === 'g1')!, id: 'bare', relations: [], measurements: [], regions: [] }
  it('returns [] for a project whose only brick has no relations', () => {
    assert.deepEqual(changed(project({ brickIds: ['bare'] }), [...SAMPLES, bare]), [])
  })
  it('returns [] for a project with no bricks', () => {
    assert.deepEqual(changed(project({ brickIds: [] })), [])
  })
  it('returns [] when every relation is switched off', () => {
    const off = Object.fromEntries(SAMPLES.find(b => b.id === 'g1')!.relations.map(r => [`g1/${r.id}`, true as const]))
    assert.deepEqual(changed(project({ brickIds: ['g1'], disabled: off })), [])
  })
})
