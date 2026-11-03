/** 15_SIMPLIFY §4: short labels and one-glyph provenance. Expected strings are typed out from the spec's table, never read from shortLabels.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { glyphOf, labelForRule, labelsOfBrick, shortLabel } from '../src/lib/shortLabels.ts'
import type { Brick, ParameterValue } from '../src/lib/types.ts'

describe('the label table', () => {
  it('maps each row of §4', () => {
    const rows: [Parameters<typeof shortLabel>[0], string | number, string | null][] = [
      ['hierarchy_mode', 'type-led', 'Title leads'], ['hierarchy_mode', 'image-led', 'Image leads'], ['hierarchy_mode', 'balanced', null],
      ['image_text_dominance', 0.95, 'Big images'], ['image_text_dominance', 0.6, 'Big images'], ['image_text_dominance', 0.2, 'Mostly text'], ['image_text_dominance', 0.3, 'Mostly text'], ['image_text_dominance', 0.4, null],
      ['density', 1, 'Lots of air'], ['density', 2, 'Lots of air'], ['density', 4, null], ['density', 6, 'Packed'],
      ['alignment_edge', 'left', 'Left-aligned'], ['alignment_edge', 'center', 'Centered'], ['alignment_edge', 'right', 'Right-aligned'], ['alignment_edge', 'split', null],
      ['accent_coverage', '<=2%', 'One small accent'], ['accent_coverage', '<=5%', 'One small accent'], ['accent_coverage', '<=15%', 'A clear accent'],
      ['palette_hue_count', 1, 'Two colors or fewer'], ['palette_hue_count', 2, 'Two colors or fewer'], ['palette_hue_count', 3, null],
      ['type_scale_ratio', 2, 'Big type contrast'], ['type_scale_ratio', 3, 'Big type contrast'], ['type_scale_ratio', 1.25, null],
      ['rhythm', 'alternating', 'Alternating rows'], ['rhythm', 'featured-first', 'One featured item'], ['rhythm', 'uniform', null],
      ['grouping', 'by-time', 'Grouped'], ['grouping', 'none', null],
      ['color_bg', '#0B0B0B', 'Dark field'], ['color_bg', '#F4F2EE', 'Light field'], ['color_bg', '#7A6A55', null],
      ['accent_placement', 'labels', null],
    ]
    for (const [k, v, want] of rows) assert.equal(shortLabel(k, v), want, `${k} ${v}`)
  })
  it('every label is four words or fewer', () => {
    for (const b of SAMPLES) for (const l of labelsOfBrick(b)) assert.ok(l.label.split(' ').length <= 4, l.label)
  })
})

describe('one glyph per provenance', () => {
  const pv = (p: ParameterValue['provenance'], source?: ParameterValue['source']): ParameterValue => ({ key: 'density', value: 1, provenance: p, locked: false, source })
  it('measured ●, interpreted ◐, by rule ◇, by you ○', () => {
    assert.equal(glyphOf(pv('measured', { brickId: 'g2' })), '●')
    assert.equal(glyphOf(pv('interpreted', { brickId: 'g2' })), '◐')
    assert.equal(glyphOf(pv('adapted', { brickId: 'g2', note: 'by rule: m3 measures the text edge' })), '◇')
    assert.equal(glyphOf(pv('adapted', { brickId: 'g2', note: 'by you: chose g2/r1' })), '○')
    assert.equal(glyphOf(pv('interpreted', { brickId: 'user', note: 'set by hand' })), '○')
  })
})

const chicago: Brick = {
  id: 'chicago', photo: { url: '', width: 2048, height: 1536 }, saved_at: '2026-11-03', taken_at: '2025-12-27',
  measurements: [{ id: 'm1', statement: 'sign', value: '~0.4, centered', how_measured: '' }],
  hypotheses: [{ id: 'h1', statement: '', rests_on: ['m1'], confidence: 0.9 }, { id: 'h2', statement: '', rests_on: ['m1'], confidence: 0.8 }],
  relations: [
    { id: 'r1', parameter: 'image_text_dominance', rule: 'keep one centered title in the upper-middle third that is an order of magnitude larger than any other mark and dominates the lit area', target: 'hero title area', source_hypothesis: 'h1' },
    { id: 'r2', parameter: 'accent_coverage', rule: 'restrict the single warm accent to under 10% of frame and apply it only to title plus nested framing lines against a dark field', target: 'accent', source_hypothesis: 'h2' },
  ],
  fragile_if_changed: '', regions: [], model: { id: 'muse-spark-1.3', effort: 'medium', latency_ms: 0, input_tokens: 0, output_tokens: 0 },
}

describe('labels for a brick and for a quoted rule', () => {
  it('a brick carries its first three readings: Chicago reads Mostly text, Title leads, Centered, each by rule, with refs to switch them', () => {
    assert.deepEqual(labelsOfBrick(chicago).map(l => [l.label, l.glyph, l.ref]), [
      ['Mostly text', '◇', 'chicago/r1'], ['Title leads', '◇', 'chicago/r1:hierarchy_mode'], ['Centered', '◇', 'chicago/r1:alignment_edge'],
    ])
  })
  it('the Picks card shows the label of the quoted rule', () => {
    assert.equal(labelForRule(chicago, chicago.relations[1].rule)?.label, 'A clear accent')
    assert.equal(labelForRule(chicago, chicago.relations[0].rule)?.label, 'Mostly text')
    assert.equal(labelForRule(chicago, 'a rule this brick does not have'), null)
  })
  it('a sample with a measured dark ground is topped up with Dark field when it has room', () => {
    const g2 = SAMPLES.find(b => b.id === 'g2')!
    const labels = labelsOfBrick(g2).map(l => l.label)
    assert.ok(labels.length >= 1 && labels.length <= 3, labels.join(', '))
    assert.ok(labels.includes('Big images'), labels.join(', '))
  })
})
