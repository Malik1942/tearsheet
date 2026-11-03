/** Spec v3 C10: the chip tooltip says where a value came from, and the adapted line says by whom.
 *  Measured and interpreted keep their wording; adapted splits into by a rule, by you and the shell's default. Expected strings are typed out from the spec. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { COMPOSITIONS } from '../src/fixtures/compositions.ts'
import { resolveParams, resolveProject, type Project } from '../src/lib/mapRelations.ts'
import type { ParameterValue } from '../src/lib/types.ts'
import { tooltipOf } from '../src/compose/provenanceCopy.ts'

const MEASURED = 'Read off the image by the model in this run; another run may differ.'
const INTERPRETED = "The model's reading; rests on the measurements listed."
const BY_RULE = 'Set by a rule from a measurement.'
const BY_YOU = 'Set by you.'
const SHELL = "The shell's default; no brick sets this."

const project = (patch: Partial<Project> = {}): Project => ({ id: 't', intent: 'x', createdAt: '', brickIds: ['g1', 'g2', 'calmmouse'], disabled: {}, choice: {}, locks: {}, manual: {}, ...patch })
const resolved = resolveProject(project(), SAMPLES)
const pv = (patch: Partial<ParameterValue>): ParameterValue => ({ key: 'density', value: 2, provenance: 'adapted', locked: false, ...patch })

describe('tooltipOf: measured and interpreted keep their wording', () => {
  it('measured: a value a relation read off a measurement (g1 r1 → hierarchy_mode)', () => {
    assert.equal(resolved.values.hierarchy_mode.provenance, 'measured')
    assert.equal(tooltipOf(resolved.values.hierarchy_mode), MEASURED)
  })
  it('measured: a skin color the harness measured', () => {
    assert.equal(resolved.values.color_bg.provenance, 'measured')
    assert.equal(tooltipOf(resolved.values.color_bg), MEASURED)
  })
  it('interpreted: a value read from a hypothesis, from the g1 fixture composition', () => {
    const v = resolveParams(COMPOSITIONS.g1).values.accent_placement
    assert.equal(v.provenance, 'interpreted')
    assert.equal(tooltipOf(v), INTERPRETED)
  })
})

describe('tooltipOf: adapted says by whom', () => {
  it('by rule: the alignment_edge a measurement filled, from a resolved single-brick sample project', () => {
    const r = resolveProject(project({ brickIds: ['secession-1902-beethoven-catalogue'] }), SAMPLES)
    assert.equal(r.values.alignment_edge.provenance, 'adapted')
    assert.ok(r.values.alignment_edge.source?.note?.startsWith('by rule'))
    assert.equal(tooltipOf(r.values.alignment_edge), BY_RULE)
  })
  it('by rule: the type_family stack a described typeface was mapped to, and the no-match fallback', () => {
    assert.ok(resolved.values.type_family.source?.note?.startsWith('by rule:'))
    assert.equal(tooltipOf(resolved.values.type_family), BY_RULE)
    const r = resolveProject(project({ brickIds: ['iran-1260s-star-cross-luster-tiles'] }), SAMPLES)
    assert.ok(r.values.type_family.source?.note?.startsWith('by rule · no match'))
    assert.equal(tooltipOf(r.values.type_family), BY_RULE)
  })
  it('by you: a conflict you settled (note starts with "by you")', () => {
    const r = resolveProject(project({ choice: { palette_hue_count: 'g2/r3' } }), SAMPLES)
    assert.equal(r.values.palette_hue_count.provenance, 'adapted')
    assert.ok(r.values.palette_hue_count.source?.note?.startsWith('by you'))
    assert.equal(tooltipOf(r.values.palette_hue_count), BY_YOU)
  })
  it('by you: a value typed by hand (a manual value, brick "user")', () => {
    const v = resolveProject(project({ manual: { density: 2 } }), SAMPLES).values.density
    assert.equal(v.source?.brickId, 'user')
    assert.equal(tooltipOf(v), BY_YOU)
  })
  it('by you: an adapted value whose brick is "user"', () => {
    assert.equal(tooltipOf(pv({ source: { brickId: 'user', note: 'set by hand' } })), BY_YOU)
  })
  it('shell default: adapted, no measurement, no "by" note (density in a project no brick sets it for)', () => {
    assert.ok(resolved.values.density.provenance === 'adapted' && !resolved.values.density.source?.measurementIds)
    assert.equal(tooltipOf(resolved.values.density), SHELL)
    for (const k of ['grouping', 'rhythm', 'alignment_edge', 'accent_placement', 'radius', 'spacing_unit'] as const) assert.equal(tooltipOf(resolved.values[k]), SHELL, k)
  })
  it('shell default: a value with no source at all', () => {
    assert.equal(tooltipOf(pv({})), SHELL)
  })
  it('a hand remap in the /compare fixtures (adapted, a measurement behind it, no "by" note) still says set by you', () => {
    const v = resolveParams(COMPOSITIONS.g1).values.image_text_dominance
    assert.equal(v.provenance, 'adapted')
    assert.ok(v.source?.measurementIds?.length && !v.source.note?.startsWith('by'))
    assert.equal(tooltipOf(v), BY_YOU)
  })
})
