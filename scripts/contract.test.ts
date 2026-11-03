/** The layout contract's parameter side (src/shell/contract.ts) and how it is recorded: what it changes, that it changes nothing twice, that every change keeps the
 *  value it replaced and is labeled `adapted · by rule` with the rule's name, and that the export shows the same thing the screens show. The rendered side, all six rules
 *  on every composition of the sample library, is scripts/shell-contract.test.ts (npm run test:contract). Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { applyContract, THUMBNAILS_HIDDEN } from '../src/shell/contract.ts'
import { DEFAULT_PARAMS, type Params } from '../src/shell/params.ts'
import { resolveProject, type Project } from '../src/lib/mapRelations.ts'
import { contractLine, landsOn } from '../src/lib/landing.ts'
import { exportCss, exportHandoff, exportJson } from '../src/export/index.ts'
import type { Brick } from '../src/lib/types.ts'

const p = (o: Partial<Params> = {}): Params => ({ ...DEFAULT_PARAMS, ...o })

describe('applyContract: rule 1, one alignment axis', () => {
  it('under center a balanced item puts its thumbnail above the text (image-led), and alternating rows become uniform', () => {
    const r = applyContract(p({ alignment_edge: 'center', hierarchy_mode: 'balanced', rhythm: 'alternating' }))
    assert.deepEqual(r.adjustments, [
      { key: 'hierarchy_mode', before: 'balanced', after: 'image-led', rule: 'one alignment axis' },
      { key: 'rhythm', before: 'alternating', after: 'uniform', rule: 'one alignment axis' },
    ])
    assert.deepEqual([r.params.hierarchy_mode, r.params.rhythm], ['image-led', 'uniform'])
  })
  it('under center a title-led item hides its thumbnails (image share 0)', () => {
    const r = applyContract(p({ alignment_edge: 'center', hierarchy_mode: 'type-led', image_text_dominance: 0.95 }))
    assert.deepEqual(r.adjustments, [{ key: 'image_text_dominance', before: 0.95, after: THUMBNAILS_HIDDEN, rule: 'one alignment axis' }])
  })
  it('changes nothing off center, or when the layout already holds one axis', () => {
    for (const o of [{ alignment_edge: 'left', hierarchy_mode: 'balanced' }, { alignment_edge: 'right', rhythm: 'alternating' }, { alignment_edge: 'center', hierarchy_mode: 'image-led' },
      { alignment_edge: 'center', hierarchy_mode: 'type-led', image_text_dominance: 0 }, { alignment_edge: 'split', hierarchy_mode: 'balanced' }] as Partial<Params>[]) {
      assert.deepEqual(applyContract(p(o)).adjustments, [], JSON.stringify(o))
    }
  })
})

describe('applyContract: rule 2, the spacing scale', () => {
  it('a unit the scale cannot use (not px, or outside 4–16 px) snaps to 8px; a usable one stays', () => {
    assert.deepEqual(applyContract(p({ spacing_unit: '0.5rem' })).adjustments, [{ key: 'spacing_unit', before: '0.5rem', after: '8px', rule: 'spacing scale' }])
    assert.equal(applyContract(p({ spacing_unit: '20px' })).params.spacing_unit, '8px')
    for (const u of ['4px', '8px', '12px', '16px']) assert.deepEqual(applyContract(p({ spacing_unit: u })).adjustments, [], u)
  })
})

describe('applyContract is pure and settles in one pass', () => {
  it('a second pass changes nothing, and the input is not touched', () => {
    const input = p({ alignment_edge: 'center', hierarchy_mode: 'balanced', rhythm: 'alternating', spacing_unit: '1rem' })
    const copy = { ...input }
    const once = applyContract(input)
    assert.deepEqual(applyContract(once.params).adjustments, [])
    assert.deepEqual(input, copy)
  })
  it('reads parameters only: contract.ts imports the parameter vocabulary and nothing about measurements', () => {
    const src = readFileSync(new URL('../src/shell/contract.ts', import.meta.url), 'utf8')
    assert.deepEqual([...src.matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]), ['./params'])
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    assert.doesNotMatch(code, /measurement|brick/i)
  })
})

/** g2 measures image share 0.95 (r1); this brick sets a leading title and centered text, so the contract hides the thumbnails: Malik's own example. */
const titleCenter: Brick = {
  id: 'titlecenter', photo: { url: '', width: 1000, height: 1000 }, saved_at: '2026-11-03',
  measurements: [{ id: 'm1', statement: 'the headline is the largest mark, centered on the midline', value: 'headline ~3x body, centered', how_measured: 'visual estimate' }],
  hypotheses: [{ id: 'h1', statement: '', rests_on: ['m1'], confidence: 0.9 }],
  relations: [
    { id: 'r1', parameter: 'hierarchy_mode', rule: 'set the headline first, the largest thing on the page', target: 'headline', source_hypothesis: 'h1' },
    { id: 'r2', parameter: 'alignment_edge', rule: 'center every line on the midline', target: 'all text', source_hypothesis: 'h1' },
  ],
  fragile_if_changed: '', regions: [], model: { id: 'muse-spark-1.3', effort: 'medium', latency_ms: 0, input_tokens: 0, output_tokens: 0 },
}
const bricks = [...SAMPLES, titleCenter]
const project = (brickIds: string[]): Project => ({ id: 'p', intent: 'a concert log', createdAt: '', brickIds, disabled: {}, choice: {}, locks: {}, manual: {} })

describe('resolveProject records what the contract changed', () => {
  const r = resolveProject(project(['g2', 'titlecenter']), bricks)
  const v = r.values.image_text_dominance
  it('the value is the contract\'s, adapted by rule, its source naming the rule, the measured value kept as `before`', () => {
    assert.equal(r.params.image_text_dominance, THUMBNAILS_HIDDEN)
    assert.deepEqual([v.value, v.provenance, v.source?.note, v.source?.brickId], [0, 'adapted', 'by rule: layout contract: one alignment axis', 'g2'])
    assert.deepEqual([v.before?.value, v.before?.provenance], [0.95, 'measured'])
    assert.deepEqual(r.adjustments.map(a => [a.key, a.rule]), [['image_text_dominance', 'one alignment axis']])
  })
  it('one line says both values: "image share 0.95 measured → thumbnails hidden by layout contract: one alignment axis"', () => {
    assert.equal(contractLine(v), 'image share 0.95 measured → thumbnails hidden by layout contract: one alignment axis')
    assert.equal(contractLine(r.values.hierarchy_mode), null)
    assert.equal(landsOn('image_text_dominance', r.params), 'No posters on the list and no thumbnails on the year review; the names carry each item.')
  })
  it('a default the contract changes says so: "hierarchy balanced default → image-led …"', () => {
    const s = resolveProject(project(['secession-1902-beethoven-catalogue']), SAMPLES)
    assert.equal(s.params.alignment_edge, 'center')
    assert.equal(contractLine(s.values.hierarchy_mode), 'hierarchy balanced default → image-led (thumbnails above the text) by layout contract: one alignment axis')
  })
  it('contract: false is the mapping alone', () => {
    const raw = resolveProject(project(['g2', 'titlecenter']), bricks, { contract: false })
    assert.deepEqual([raw.params.image_text_dominance, raw.values.image_text_dominance.before, raw.adjustments], [0.95, undefined, []])
  })
})

describe('what is exported is what is shown', () => {
  const r = resolveProject(project(['g2', 'titlecenter']), bricks)
  it('tokens.css carries the laid-out value and both values in its comment', () => {
    const css = exportCss(r, bricks)
    assert.match(css, /--image-text-dominance: 0; \/\* [^\n]*image share 0\.95 measured → thumbnails hidden by layout contract: one alignment axis/)
  })
  it('parameters.json keeps the value it replaced; handoff.md says what the contract did', () => {
    const json = JSON.parse(exportJson('a concert log', r))
    assert.deepEqual([json.parameters.image_text_dominance.value, json.parameters.image_text_dominance.before.value], [0, 0.95])
    assert.match(exportHandoff('a concert log', bricks.filter(b => ['g2', 'titlecenter'].includes(b.id)), r), /- `image_text_dominance` = \*\*0\*\*[^\n]*\n(  - rule: [^\n]*\n)?  - image share 0\.95 measured → thumbnails hidden by layout contract: one alignment axis/)
  })
})
