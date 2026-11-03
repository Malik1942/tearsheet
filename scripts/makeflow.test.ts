/** 15_SIMPLIFY §2 Make, the pure parts: the auto name (spec v3 P2), the Picks card line and label, the See rows and their switches, and the E1 link and landing.
 *  Expected strings are typed out from the specs, never read from makeFlow.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { resolveProject, type Project } from '../src/lib/mapRelations.ts'
import { autoName, instructionsLink, isOff, openDestination, photoLine, pickLabel, seeRows, toggleRef } from '../src/lib/makeFlow.ts'
import type { Brick, Relation } from '../src/lib/types.ts'

const M = (id: string, value: string) => ({ id, statement: value, value, how_measured: 'visual estimate' })
const brick = (id: string, relations: Omit<Relation, 'id'>[], extra: Partial<Brick> = {}): Brick => ({
  id, photo: { url: '', width: 2048, height: 1536 }, saved_at: '2025-12-27',
  measurements: [M('m1', 'sign width : frame width ~0.4, centered'), M('m2', 'heavy wide low-contrast sans, tight spacing'), M('m3', '~70% dark'), M('m4', '1 hue, ~5% coverage'), M('m5', '2 nested frames')],
  hypotheses: [{ id: 'h1', statement: '', rests_on: ['m1', 'm2', 'm4'], confidence: 0.95 }, { id: 'h2', statement: '', rests_on: ['m5', 'm3', 'm4'], confidence: 0.88 }, { id: 'h3', statement: '', rests_on: ['m3', 'm1'], confidence: 0.82 }],
  relations: relations.map((r, i) => ({ ...r, id: `r${i + 1}` })),
  fragile_if_changed: 'brightening the field', regions: [],
  model: { id: 'muse-spark-1.3', effort: 'medium', latency_ms: 0, input_tokens: 0, output_tokens: 0 },
  ...extra,
})
const TITLE = { parameter: 'image_text_dominance', rule: 'keep one centered title in the upper-middle third that is an order of magnitude larger than any other mark and dominates the lit area', target: 'hero title area', source_hypothesis: 'h1' } as const
const ACCENT = { parameter: 'accent_coverage', rule: 'restrict the single warm accent to under 10% of frame and apply it only to title plus nested framing lines against a dark field', target: 'accent and framing system', source_hypothesis: 'h2' } as const
const HUE = { parameter: 'palette_hue_count', rule: 'use a near-black field with exactly one saturated warm hue for emphasis plus tiny multicolor points', target: 'overall palette', source_hypothesis: 'h3' } as const
const chicago = brick('chicago', [TITLE, ACCENT, HUE])
const project = (p: Partial<Project> = {}): Project => ({ id: 'p', intent: '', createdAt: '', brickIds: ['chicago'], disabled: {}, choice: {}, locks: {}, manual: {}, ...p })

describe('P2 auto name: the first four words of the intent', () => {
  it('names the three placeholder examples', () => {
    assert.equal(autoName('a concert log for someone who goes to a lot of shows'), 'Concert log for someone')
    assert.equal(autoName('a reading tracker'), 'Reading tracker')
    assert.equal(autoName('a ride stats screen for sunlight'), 'Ride stats screen')
  })
  it('keeps four words, trims spaces and end punctuation, capitalizes the first letter', () => {
    assert.equal(autoName('  weekly   grocery list with prices and stores. '), 'Weekly grocery list')
    assert.equal(autoName('Tour diary, Japan'), 'Tour diary Japan')
    assert.equal(autoName('plants!'), 'Plants')
  })
  it('an empty intent has no name; a lone article stays', () => {
    assert.equal(autoName('   '), '')
    assert.equal(autoName('the'), 'The')
  })
})

describe('Picks card: the date line and the one label', () => {
  const today = new Date(2026, 10, 3)
  it('own photo: the day it was taken when known, else the saved day', () => {
    assert.equal(photoLine({ id: 'x', origin: 'own', saved_at: '2026-11-03', taken_at: '2025-12-27' }, today), 'Dec 27, 2025')
    assert.equal(photoLine({ id: 'x', origin: 'own', saved_at: '2026-11-03' }, today), 'saved Nov 3')
  })
  it('a starter carries its credit line', () => {
    assert.equal(photoLine({ id: 'x', origin: 'starter', credit: 'Minneapolis Institute of Art, 1923', saved_at: '2026-11-02' }, today), 'Minneapolis Institute of Art, 1923')
  })
  it('the label of the quoted rule; with no quote, the brick\'s first label', () => {
    assert.equal(pickLabel(chicago, ACCENT.rule)?.label, 'A clear accent')
    assert.equal(pickLabel(chicago, '')?.label, 'Mostly text')
    assert.equal(pickLabel(chicago, 'not a rule of this brick')?.label, 'Mostly text')
  })
})

describe('3 See: one row per brick, one switch per label', () => {
  it('Chicago shows its three active labels, all on, with the refs that switch them', () => {
    const p = project()
    const rows = seeRows(p, resolveProject(p, [chicago]), [chicago])
    assert.equal(rows.length, 1)
    assert.deepEqual(rows[0].labels.map(l => [l.label, l.ref, l.on]), [
      ['Mostly text', 'chicago/r1', true], ['Title leads', 'chicago/r1:hierarchy_mode', true], ['Centered', 'chicago/r1:alignment_edge', true],
    ])
  })
  it('Title leads off: its switch stays, off; the hierarchy goes back to the shell default; on again restores it', () => {
    const off = project({ disabled: toggleRef({}, 'chicago/r1:hierarchy_mode') })
    assert.deepEqual(off.disabled, { 'chicago/r1:hierarchy_mode': true })
    const r = resolveProject(off, [chicago])
    assert.notEqual(r.params.hierarchy_mode, 'type-led')
    const row = seeRows(off, r, [chicago])[0]
    assert.deepEqual(row.labels.find(l => l.label === 'Title leads')?.on, false)
    assert.deepEqual(row.labels.find(l => l.label === 'Mostly text')?.on, true)
    const on = project({ disabled: toggleRef(off.disabled, 'chicago/r1:hierarchy_mode') })
    assert.deepEqual(on.disabled, {})
    assert.equal(resolveProject(on, [chicago]).params.hierarchy_mode, 'type-led')
  })
  it('a relation switched off as a whole holds its readings off; turning one on clears the relation', () => {
    const d = { 'chicago/r1': true } as Project['disabled']
    assert.ok(isOff({ disabled: d }, 'chicago/r1:hierarchy_mode'))
    const p = project({ disabled: d })
    const row = seeRows(p, resolveProject(p, [chicago]), [chicago])[0]
    assert.deepEqual(row.labels.filter(l => l.ref.startsWith('chicago/r1')).map(l => l.on), [false, false, false])
    assert.deepEqual(toggleRef(d, 'chicago/r1:hierarchy_mode'), {})
  })
  it('a freed cap slot brings the held-back label in', () => {
    const p = project()
    const before = seeRows(p, resolveProject(p, [chicago]), [chicago])[0].labels.map(l => l.label)
    assert.ok(!before.includes('A clear accent'), before.join(', '))
    const off = project({ disabled: { 'chicago/r1': true } })
    const after = seeRows(off, resolveProject(off, [chicago]), [chicago])[0].labels.map(l => l.label)
    assert.ok(after.includes('A clear accent'), after.join(', '))
  })
  it('rows follow the project order and skip bricks the library no longer has', () => {
    const g2 = SAMPLES.find(b => b.id === 'g2')!
    const p = project({ brickIds: ['g2', 'gone', 'chicago'] })
    const rows = seeRows(p, resolveProject(p, [chicago, g2]), [chicago, g2])
    assert.deepEqual(rows.map(r => r.brick.id), ['g2', 'chicago'])
  })
  it('a label that is on but overruled by a brick above it is marked not in use', () => {
    const g2 = SAMPLES.find(b => b.id === 'g2')!
    const p = project({ brickIds: ['chicago', 'g2'] })
    const rows = seeRows(p, resolveProject(p, [chicago, g2]), [chicago, g2])
    const find = (id: string, label: string) => rows.find(r => r.brick.id === id)!.labels.find(l => l.label === label)!
    assert.deepEqual([find('chicago', 'Mostly text').on, find('chicago', 'Mostly text').inUse], [true, true])
    assert.deepEqual([find('g2', 'Big images').on, find('g2', 'Big images').inUse], [true, false])
  })
})

describe('E1 minimal: the link and where /open lands', () => {
  it('the link carries the code, the project and to=instructions', () => {
    assert.equal(instructionsLink('https://tearsheet.app', 'ABC234', 'p_1 x'), 'https://tearsheet.app/open?code=ABC234&project=p_1%20x&to=instructions')
  })
  it('to=instructions lands on the Instructions page; without it, on the project; an unknown project on the list', () => {
    assert.equal(openDestination('p_1', true, 'instructions'), '/project/p_1/instructions')
    assert.equal(openDestination('p_1', true, null), '/project/p_1')
    assert.equal(openDestination('p_1', false, 'instructions'), '/projects')
    assert.equal(openDestination(null, false, null), '/')
  })
})
