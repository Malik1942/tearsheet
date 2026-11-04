/** Swap sheet §2–§3: the groups, their order, who is shown and marked, and the two caption lines. Expected values are typed out from the spec
 *  (docs/superpowers/specs/2026-11-03-swap-sheet-design.md), never read from swapSheet.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import type { Project, Proposal } from '../src/lib/mapRelations.ts'
import { swapGroups, tileCaption, type SwapGroup } from '../src/lib/swapSheet.ts'
import { shortCredit } from '../src/lib/brickLabels.ts'
import type { Brick, Relation } from '../src/lib/types.ts'

type Rel = Omit<Relation, 'id'>
const M = (id: string, value: string) => ({ id, statement: value, value, how_measured: 'visual estimate' })
const brick = (id: string, relations: Rel[], saved_at = '2026-10-01', extra: Partial<Brick> = {}): Brick => ({
  id, photo: { url: '', width: 100, height: 100 }, saved_at,
  measurements: [M('m1', 'two hues, about 5% coverage')], hypotheses: [{ id: 'h1', statement: '', rests_on: ['m1'], confidence: 0.9 }],
  relations: relations.map((r, i) => ({ ...r, id: `r${i + 1}` })), fragile_if_changed: '', regions: [],
  model: { id: 'muse-spark-1.3', effort: 'medium', latency_ms: 0, input_tokens: 0, output_tokens: 0 }, ...extra,
})
// one rule per relationship parameter, each read to a value by the rule table
const SCALE: Rel = { parameter: 'type_scale_ratio', rule: 'set the title at 3:1 to the body', target: 'type scale', source_hypothesis: 'h1' }
const SCALE_2: Rel = { parameter: 'type_scale_ratio', rule: 'set the title at 2:1 to the body', target: 'type scale', source_hypothesis: 'h1' }
const RHYTHM: Rel = { parameter: 'rhythm', rule: 'alternate wide and narrow rows', target: 'list rhythm', source_hypothesis: 'h1' }
const ALIGN: Rel = { parameter: 'alignment_edge', rule: 'keep every block flush left', target: 'blocks', source_hypothesis: 'h1' }
const HUES: Rel = { parameter: 'palette_hue_count', rule: 'use two hues only', target: 'palette', source_hypothesis: 'h1' }
const LEADS: Rel = { parameter: 'hierarchy_mode', rule: 'make the title lead every item', target: 'items', source_hypothesis: 'h1' }

// `top` sets the hue count; `x` (being replaced) sets the type scale and the rhythm
const top = brick('top', [HUES], '2026-01-05')
const x = brick('x', [SCALE, RHYTHM])
const same1 = brick('same1', [SCALE_2], '2026-09-01')
const same2 = brick('same2', [RHYTHM, ALIGN], '2026-08-01')
const adds = brick('adds', [ALIGN], '2026-07-01')
const rest = brick('rest', [HUES], '2026-06-01')
const bare = brick('bare', [], '2026-03-01')
const ALL = [top, x, same1, same2, adds, rest, bare]
const project = (p: Partial<Project> = {}): Project => ({ id: 'p', intent: 'a concert log', createdAt: '', brickIds: ['top', 'x'], disabled: {}, choice: {}, locks: {}, manual: {}, ...p })
const proposal = (ranking: unknown[]): Proposal => ({ at: '2026-11-03T10:00:00.000Z', model: 'muse-spark-1.3', effort: 'low', intent: 'a concert log', latency_ms: 1, dropped: 0, picks: [], ranking: ranking as string[] })
/** Each group as [title, ids], a photo already in the project marked ✓. */
const view = (groups: SwapGroup[]) => groups.map(g => [g.title, g.tiles.map(t => (t.inProject ? `${t.brick.id}✓` : t.brick.id))])

describe('swap sheet groups', () => {
  it('puts each photo in the first group it qualifies for, newest saved first without a ranking', () => {
    assert.deepEqual(view(swapGroups(project(), ALL, 'x', ALL)), [
      ['Same job', ['same1', 'same2']],
      ['Adds something', ['adds']],
      ['Everything else', ['rest', 'bare', 'top✓']],
    ])
  })
  it('orders each group by the stored ranking, then the unranked by save date; unknown ids, repeats and non-strings are ignored', () => {
    const p = project({ proposal: proposal(['bare', 'same2', 'ghost', 7, 'top', 'same2', 'same1']) })
    assert.deepEqual(view(swapGroups(p, ALL, 'x', ALL)), [
      ['Same job', ['same2', 'same1']],
      ['Adds something', ['adds']],
      ['Everything else', ['bare', 'top✓', 'rest']],
    ])
  })
  it('breaks a save-date tie by id', () => {
    const b2 = brick('b2', [HUES], '2026-06-01'), b1 = brick('b1', [HUES], '2026-06-01')
    assert.deepEqual(view(swapGroups(project(), [b2, b1], 'x', [...ALL, b1, b2])), [['Everything else', ['b1', 'b2']]])
  })
  it('judges a muted photo by what it sets when on', () => {
    assert.deepEqual(view(swapGroups(project({ mutedBricks: { x: true } }), ALL, 'x', ALL)), [
      ['Same job', ['same1', 'same2']],
      ['Adds something', ['adds']],
      ['Everything else', ['rest', 'bare', 'top✓']],
    ])
  })
  it('counts a value set by hand as taken', () => {
    assert.deepEqual(view(swapGroups(project({ manual: { alignment_edge: 'center' } }), ALL, 'x', ALL)), [
      ['Same job', ['same1', 'same2']],
      ['Everything else', ['adds', 'rest', 'bare', 'top✓']],
    ])
  })
  it('has no Same job when the photo being replaced sets nothing on the screens', () => {
    // `rest` sets the hue count too, but `top` is above it and wins
    assert.deepEqual(view(swapGroups(project({ brickIds: ['top', 'rest'] }), ALL, 'rest', ALL)), [
      ['Adds something', ['x', 'same1', 'same2', 'adds']],
      ['Everything else', ['bare', 'top✓']],
    ])
  })
  it('offers only the pool, never the photo being replaced', () => {
    assert.deepEqual(view(swapGroups(project(), [x, adds, top], 'x', ALL)), [
      ['Adds something', ['adds']],
      ['Everything else', ['top✓']],
    ])
  })
})

describe('tile captions', () => {
  const today = new Date(2026, 10, 3)   // 3 Nov 2026, local time
  const sample = (id: string) => SAMPLES.find(b => b.id === id)!
  it('line 1 is the first short label from the label table', () => {
    assert.equal(tileCaption(brick('t', [LEADS]), today).label, 'Title leads')
    assert.equal(tileCaption(brick('s', [SCALE, RHYTHM]), today).label, 'Big type contrast')
  })
  it('line 1 is empty when the table has nothing for the photo', () => {
    assert.equal(tileCaption(brick('n', []), today).label, null)
  })
  it('line 2 of an own photo is the day it was taken, else the day it was saved', () => {
    assert.equal(tileCaption(brick('o', [], '2026-11-03', { taken_at: '2025-12-27' }), today).line, 'Dec 27, 2025')
    assert.equal(tileCaption(brick('o', [], '2026-11-03'), today).line, 'saved Nov 3')
  })
  it('line 2 of a credited starter is its short credit', () => {
    assert.equal(tileCaption(sample('bauhaus-1923-staatliches-bauhaus-weimar'), today).line, 'Mia, 1923')
    assert.equal(tileCaption(sample('secession-1902-beethoven-catalogue'), today).line, 'Mia, 1902')
    assert.equal(tileCaption(sample('iran-1260s-star-cross-luster-tiles'), today).line, 'The Met, 1260–70')
    assert.equal(tileCaption(sample('matthews-19c-glyphography-trade-card'), today).line, 'The Met, 19th century')
    assert.equal(tileCaption(sample('jpl-2016-visions-mars'), today).line, 'NASA/JPL')
    assert.equal(tileCaption(sample('haeckel-1904-trochilidae-plate-99'), today).line, 'Wikimedia, 1904')
  })
  it("line 2 of the author's own starters is their date, never the author's name", () => {
    assert.equal(tileCaption(sample('g1'), today).line, 'saved Apr 6, 2025')
    for (const id of ['g1', 'g2', 'c1', 'calmmouse', 'greencar']) assert.equal(tileCaption(sample(id), today).line.includes('Malik'), false, id)
  })
})

describe('shortCredit', () => {
  it('shortens the four known institutions and keeps the rest of the credit', () => {
    assert.equal(shortCredit('The Metropolitan Museum of Art, 1830s'), 'The Met, 1830s')
    assert.equal(shortCredit('Minneapolis Institute of Art, 1923'), 'Mia, 1923')
    assert.equal(shortCredit('Courtesy NASA/JPL-Caltech'), 'NASA/JPL')
    assert.equal(shortCredit('Wikimedia Commons, 1904'), 'Wikimedia, 1904')
  })
  it('shows an institution it does not know whole', () => {
    assert.equal(shortCredit('Art Institute of Chicago, 1890'), 'Art Institute of Chicago, 1890')
  })
})
