/** A dominant title said in words (Malik, Tue 2026-11-03): "keep one centered title … an order of magnitude larger than any other mark" reads by rule as
 *  hierarchy_mode type-led, image_text_dominance text-led and alignment_edge center, `adapted · by rule`, citing the relation. And one hue with accent
 *  coverage set keeps the accent. The Chicago brick below is IMG_6966's real extraction (prompt v3, 2026-11-03), trimmed to ids and values. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { TEXT_LED_SHARE, candidatesOf, resolveProject, type Project } from '../src/lib/mapRelations.ts'
import { landsOn } from '../src/lib/landing.ts'
import { DEFAULT_PARAMS, toCssVars } from '../src/shell/params.ts'
import type { Brick, Relation } from '../src/lib/types.ts'

const M = (id: string, value: string) => ({ id, statement: value, value, how_measured: 'visual estimate' })
const brick = (id: string, relations: Omit<Relation, 'id'>[]): Brick => ({
  id, photo: { url: '', width: 2048, height: 1536 }, saved_at: '2025-12-27',
  measurements: [M('m1', 'sign width : frame width ~0.4, centered'), M('m2', 'heavy wide low-contrast sans, tight spacing'), M('m3', '~70% dark'), M('m4', '1 hue, ~5% coverage'), M('m5', '2 nested frames')],
  hypotheses: [{ id: 'h1', statement: '', rests_on: ['m1', 'm2', 'm4'], confidence: 0.95 }, { id: 'h2', statement: '', rests_on: ['m5', 'm3', 'm4'], confidence: 0.88 }, { id: 'h3', statement: '', rests_on: ['m3', 'm1'], confidence: 0.82 }],
  relations: relations.map((r, i) => ({ ...r, id: `r${i + 1}` })),
  fragile_if_changed: 'brightening the field', regions: [{ label: 'CHICAGO marquee letters', box_1000: [290, 355, 702, 472], measurement_ids: ['m1', 'm2'] }],
  model: { id: 'muse-spark-1.3', effort: 'medium', latency_ms: 0, input_tokens: 0, output_tokens: 0 },
})
const TITLE = { parameter: 'image_text_dominance', rule: 'keep one centered title in the upper-middle third that is an order of magnitude larger than any other mark and dominates the lit area', target: 'hero title area', source_hypothesis: 'h1' } as const
const ACCENT = { parameter: 'accent_coverage', rule: 'restrict the single warm accent to under 10% of frame and apply it only to title plus nested framing lines against a dark field', target: 'accent and framing system', source_hypothesis: 'h2' } as const
const HUE = { parameter: 'palette_hue_count', rule: 'use a near-black field with exactly one saturated warm hue for emphasis plus tiny multicolor points', target: 'overall palette', source_hypothesis: 'h3' } as const
const chicago = brick('chicago', [TITLE, ACCENT, HUE])
const project = (p: Partial<Project> = {}): Project => ({ id: 'p', intent: '', createdAt: '', brickIds: ['chicago'], disabled: {}, choice: {}, locks: {}, manual: {}, ...p })

describe('a dominant title said in words reads by rule', () => {
  it('Chicago r1 gives text-led, type-led and center, each adapted by rule and citing r1', () => {
    const { candidates, unexpressed } = candidatesOf(chicago)
    const r1 = candidates.filter(c => c.source?.relationId === 'r1')
    assert.deepEqual(r1.map(c => [c.ref, c.key, c.value, c.provenance]), [
      ['chicago/r1', 'image_text_dominance', TEXT_LED_SHARE, 'adapted'],
      ['chicago/r1:hierarchy_mode', 'hierarchy_mode', 'type-led', 'adapted'],
      ['chicago/r1:alignment_edge', 'alignment_edge', 'center', 'adapted'],
    ])
    for (const c of r1) {
      assert.match(c.source?.note ?? '', /^by rule: r1 says a title dominates but gives no number/)
      assert.equal(c.source?.relationRule, TITLE.rule)
      assert.deepEqual(c.source?.measurementIds, ['m1', 'm2', 'm4'])
    }
    assert.equal(unexpressed.some(u => u.rule === TITLE.rule), false)
  })

  it('each phrase alone is enough; a share or a number the rule gives still wins', () => {
    for (const rule of ['the title dominates the frame', 'set the headline an order of magnitude larger than the body', 'one centered title over a dark field']) {
      assert.equal(candidatesOf(brick('x', [{ ...TITLE, rule }])).candidates.find(c => c.key === 'hierarchy_mode')?.value, 'type-led', rule)
    }
    const numbered = candidatesOf(brick('x', [{ ...TITLE, rule: 'the image takes 30% of each item while the title dominates' }])).candidates
    assert.deepEqual(numbered.filter(c => c.key === 'image_text_dominance').map(c => [c.value, c.provenance]), [[0.3, 'measured']])
  })

  it('filed under hierarchy_mode, the rule reads as type-led for its own slot and text-led beside it', () => {
    const c = candidatesOf(brick('x', [{ ...TITLE, parameter: 'hierarchy_mode', rule: 'the title dominates the lit area' }])).candidates
    assert.deepEqual(c.map(x => [x.ref, x.key, x.value]), [['x/r1', 'hierarchy_mode', 'type-led'], ['x/r1:image_text_dominance', 'image_text_dominance', TEXT_LED_SHARE]])
  })

  it('a reading for another slot yields to a relation of the same brick that sets that slot itself', () => {
    const c = candidatesOf(brick('x', [TITLE, { parameter: 'hierarchy_mode', rule: 'let the photo lead every item', target: 'items', source_hypothesis: 'h2' }])).candidates
    assert.deepEqual(c.filter(x => x.key === 'hierarchy_mode').map(x => [x.ref, x.value]), [['x/r2', 'image-led']])
  })

  it('no sample brick reads differently', () => {
    for (const b of SAMPLES) assert.equal(candidatesOf(b).candidates.some(c => c.ref.includes(':')), false, b.id)
  })

  it('switching r1 off switches off all three readings; one reading can be switched off alone', () => {
    const off = resolveProject(project({ disabled: { 'chicago/r1': true } }), [chicago])
    assert.deepEqual([off.values.hierarchy_mode.value, off.values.alignment_edge.value], [DEFAULT_PARAMS.hierarchy_mode, DEFAULT_PARAMS.alignment_edge])
    const one = resolveProject(project({ disabled: { 'chicago/r1:alignment_edge': true } }), [chicago])
    assert.deepEqual([one.values.hierarchy_mode.value, one.values.image_text_dominance.value], ['type-led', TEXT_LED_SHARE])
  })

  it('the cap of three keeps r1 and switches off the color relations, which can be swapped in', () => {
    const r = resolveProject(project(), [chicago])
    assert.deepEqual(r.capped.map(c => c.key), ['accent_coverage', 'palette_hue_count'])
    assert.equal(r.values.hierarchy_mode.source?.note?.startsWith('by rule'), true)
  })
})

describe('one hue keeps the accent when accent coverage is set', () => {
  const colors = { color_fg: '#111111', color_accent: '#E8A33D' }
  it('the shell colors the accent at one hue with coverage set, and falls back to the text color without it', () => {
    assert.equal(toCssVars({ ...DEFAULT_PARAMS, ...colors, palette_hue_count: 1, accent_set: true })['--color-accent'], '#E8A33D')
    assert.equal(toCssVars({ ...DEFAULT_PARAMS, ...colors, palette_hue_count: 1 })['--color-accent'], '#111111')
    assert.equal(toCssVars({ ...DEFAULT_PARAMS, ...colors, palette_hue_count: 2 })['--color-accent'], '#E8A33D')
  })

  it('Chicago with r1 off: hue count 1 from r3, coverage <=15% from r2, so the accent is set and shows', () => {
    const r = resolveProject(project({ disabled: { 'chicago/r1': true } }), [chicago])
    assert.deepEqual([r.values.palette_hue_count.value, r.values.accent_coverage.value, r.params.accent_set], [1, '<=15%', true])
    assert.match(landsOn('palette_hue_count', r.params), /^One hue, used as the accent: /)
  })

  it('a brick with one hue and no accent coverage stays monochrome', () => {
    const r = resolveProject(project({ brickIds: ['mono'] }), [brick('mono', [HUE])])
    assert.deepEqual([r.values.palette_hue_count.value, r.params.accent_set], [1, false])
    assert.equal(landsOn('palette_hue_count', r.params), 'One hue: the accent falls back to the text color, so nothing is colored.')
    assert.equal(toCssVars(r.params)['--color-accent'], String(r.params.color_fg))
  })
})
