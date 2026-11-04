/** Make as one page, the pure parts: the auto name (spec v3 P2), the date line, a photo muted as a whole, which photos the row shows and their one label, the routes, and the E1 link and landing.
 *  Expected strings are typed out from the specs, never read from makeFlow.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { resolveProject, type Project } from '../src/lib/mapRelations.ts'
import { autoName, carryOver, makeRoute, oneLabel, openDestination, photoLine, photoRow, shareCodeFor, shareContent, sharedLink, sharedView, toggleMuted } from '../src/lib/makeFlow.ts'
import { changedSincePrevious, firstVersion, withNextVersion } from '../src/lib/versions.ts'
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

describe('the date line under a photo', () => {
  const today = new Date(2026, 10, 3)
  it('own photo: the day it was taken when known, else the saved day', () => {
    assert.equal(photoLine({ id: 'x', origin: 'own', saved_at: '2026-11-03', taken_at: '2025-12-27' }, today), 'Dec 27, 2025')
    assert.equal(photoLine({ id: 'x', origin: 'own', saved_at: '2026-11-03' }, today), 'saved Nov 3')
  })
  it('a starter carries its credit line', () => {
    assert.equal(photoLine({ id: 'x', origin: 'starter', credit: 'Minneapolis Institute of Art, 1923', saved_at: '2026-11-02' }, today), 'Minneapolis Institute of Art, 1923')
  })
})

// a photo whose one relation loses to Chicago's (the top brick wins a conflict) and that has no skin: it sets nothing while Chicago is on
const ECHO = { parameter: 'image_text_dominance', rule: 'let the photo fill 80% of each item', target: '80% image', source_hypothesis: 'h1' } as const
const echo = brick('echo', [ECHO], { fragile_if_changed: '' })
const g2 = SAMPLES.find(b => b.id === 'g2')!

describe('a photo muted as a whole (mutedBricks)', () => {
  it('a muted brick sets nothing: no rule, no skin, nothing unexpressed from it', () => {
    const on = resolveProject(project({ brickIds: ['chicago', 'g2'] }), [chicago, g2])
    assert.ok(Object.values(on.values).some(v => v.source?.brickId === 'chicago'))
    assert.ok(on.unexpressed.some(u => u.brickId === 'chicago'))
    const off = resolveProject(project({ brickIds: ['chicago', 'g2'], mutedBricks: { chicago: true } }), [chicago, g2])
    assert.ok(!Object.values(off.values).some(v => v.source?.brickId === 'chicago'))
    assert.ok(!off.unexpressed.some(u => u.brickId === 'chicago'))
    assert.ok(!Object.values(off.candidates).flat().some(c => c?.source?.brickId === 'chicago'))
  })
  it('the skin follows the photo that supplies it: muting g2 takes its colors away', () => {
    const p = project({ brickIds: ['chicago', 'g2'] })
    assert.equal(resolveProject(p, [chicago, g2]).values.color_bg.source?.brickId, 'g2')
    assert.notEqual(resolveProject({ ...p, mutedBricks: { g2: true } }, [chicago, g2]).values.color_bg.source?.brickId, 'g2')
  })
  it('a project without the field resolves as before', () => {
    const p = project({ brickIds: ['chicago', 'g2'] })
    assert.deepEqual(resolveProject(p, [chicago, g2]).params, resolveProject({ ...p, mutedBricks: {} }, [chicago, g2]).params)
  })
  it('a tap is a new version that records what moved, so the change highlight runs; on again is another', () => {
    const at = '2026-11-03T15:00:00.000Z'
    const v1 = { ...project({ brickIds: ['chicago', 'g2'] }), ...firstVersion(project({ brickIds: ['chicago', 'g2'] }), at) }
    const v2 = withNextVersion(v1, { ...v1, mutedBricks: toggleMuted(v1.mutedBricks, 'chicago') }, [chicago, g2], at)
    assert.equal(v2.version, 2)
    assert.deepEqual(v2.mutedBricks, { chicago: true })
    assert.ok(changedSincePrevious(v2).some(c => c.key === 'hierarchy_mode'), JSON.stringify(changedSincePrevious(v2).map(c => c.key)))
    const v3 = withNextVersion(v2, { ...v2, mutedBricks: toggleMuted(v2.mutedBricks, 'chicago') }, [chicago, g2], at)
    assert.equal(v3.version, 3)
    assert.deepEqual(v3.mutedBricks, {})
    assert.ok(changedSincePrevious(v3).some(c => c.key === 'hierarchy_mode'))
  })
})

describe('the photo row: which photos show, and the one label', () => {
  it('Chicago and g2 both set something and show; echo sets nothing under Chicago and is left out', () => {
    const p = project({ brickIds: ['chicago', 'g2', 'echo'] })
    assert.deepEqual(photoRow(p, [chicago, g2, echo]).map(c => [c.brick.id, c.muted]), [['chicago', false], ['g2', false]])
  })
  it('a muted photo that would set something stays, dimmed; one that would not stays out', () => {
    const p = project({ brickIds: ['chicago', 'g2', 'echo'], mutedBricks: { chicago: true, echo: true } })
    assert.deepEqual(photoRow(p, [chicago, g2, echo]).map(c => [c.brick.id, c.muted]), [['chicago', true], ['g2', false]])
  })
  it('with Chicago off, echo (next in line) sets its share and shows', () => {
    const on = project({ brickIds: ['chicago', 'echo', 'g2'] })
    assert.deepEqual(photoRow(on, [chicago, g2, echo]).map(c => c.brick.id), ['chicago', 'g2'])
    const off = project({ brickIds: ['chicago', 'echo', 'g2'], mutedBricks: { chicago: true } })
    assert.deepEqual(photoRow(off, [chicago, g2, echo]).map(c => c.brick.id), ['chicago', 'echo', 'g2'])
  })
  it('the label is the first one among the values the photo sets, in its own rule order', () => {
    const p = project({ brickIds: ['chicago', 'g2'] })
    const row = photoRow(p, [chicago, g2])
    assert.equal(row[0].label, 'Mostly text')
    // g2's first rule (big images) loses to Chicago's text-led share; its accent is the first thing it sets that has a label
    assert.equal(row[1].label, 'One small accent')
  })
  it('a muted photo keeps the label it would have when on', () => {
    const p = project({ brickIds: ['chicago', 'g2'], mutedBricks: { chicago: true } })
    assert.equal(photoRow(p, [chicago, g2])[0].label, 'Mostly text')
  })
  it('with nothing set that has a label, the photo\'s first label overall', () => {
    const r = resolveProject(project({ brickIds: ['chicago'] }), [chicago])
    assert.equal(oneLabel(echo, r), 'Big images')
  })
})

describe('Make routes', () => {
  it('/make is the empty page; a project and its older step routes are its page; share and export open Share', () => {
    assert.deepEqual(makeRoute('/make'), { id: null, share: false })
    assert.deepEqual(makeRoute('/project/p_1'), { id: 'p_1', share: false })
    assert.deepEqual(makeRoute('/project/p_1/preview'), { id: 'p_1', share: false })
    assert.deepEqual(makeRoute('/project/p_1/share'), { id: 'p_1', share: true })
    assert.deepEqual(makeRoute('/project/p_1/export'), { id: 'p_1', share: true })
    assert.deepEqual(makeRoute('/project/p%201'), { id: 'p 1', share: false })
  })
  it('Instructions, Projects and the Library are not Make', () => {
    assert.equal(makeRoute('/project/p_1/instructions'), null)
    assert.equal(makeRoute('/projects'), null)
    assert.equal(makeRoute('/'), null)
  })
})

describe('E1, read-only: a share link carries one project, never the library', () => {
  it('the link opens /shared with the share code and the project', () => {
    assert.equal(sharedLink('https://tearsheet.app', 'ABC234', 'p_1 x'), 'https://tearsheet.app/shared?code=ABC234&project=p_1%20x')
  })
  it('a share uploads only the person\'s own photos this project uses: no starter, no other photo, nothing still being read', () => {
    const own = (id: string, extra: Partial<Brick> = {}) => brick(id, [TITLE], { origin: 'own', ...extra })
    const lib = [own('chicago'), own('elsewhere'), own('reading', { status: 'extracting' }), SAMPLES.find(b => b.id === 'g2')!]
    assert.deepEqual(shareContent(project({ brickIds: ['chicago', 'g2', 'reading'] }), lib).map(b => b.id), ['chicago'])
  })
  it('each project keeps one share code on this device, so sharing again updates the same link', () => {
    const mem = new Map<string, string>()
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) } }
    let n = 0
    const make = () => ['AAAAA2', 'BBBBB3'][n++]
    assert.equal(shareCodeFor('p_1', make, storage), 'AAAAA2')
    assert.equal(shareCodeFor('p_1', make, storage), 'AAAAA2')
    assert.equal(shareCodeFor('p_2', make, storage), 'BBBBB3')
    mem.set('tearsheet.shares', 'not json')
    assert.equal(shareCodeFor('p_3', () => 'CCCCC4', storage), 'CCCCC4', 'a damaged map starts over')
  })
  it('the read-only page finds the project and fills in the starters from the app; an unknown project is nothing', () => {
    const shared = { bricks: [chicago], projects: [project({ id: 'p_1', brickIds: ['chicago', 'g2'] })] }
    const v = sharedView(shared, 'p_1', SAMPLES)
    assert.deepEqual([v?.project.id, v?.bricks.some(b => b.id === 'chicago'), v?.bricks.some(b => b.id === 'g2')], ['p_1', true, true])
    assert.equal(sharedView(shared, 'p_9', SAMPLES), null)
  })
})

describe('/open (a library on another device of your own): where it lands', () => {
  it('to=instructions lands on the Instructions page; without it, on the project; an unknown project on the list', () => {
    assert.equal(openDestination('p_1', true, 'instructions'), '/project/p_1/instructions')
    assert.equal(openDestination('p_1', true, null), '/project/p_1')
    assert.equal(openDestination('p_1', false, 'instructions'), '/projects')
    assert.equal(openDestination(null, false, null), '/')
  })
})

describe("C+D: what couldn't carry over on Make", () => {
  it('counts only the rules with no slot, grouped by photo in the order they appear; fragile notes stay out', () => {
    const groups = carryOver([
      { brickId: 'chicago', rule: 'brighten the field and it collapses', reason: 'fragile' },
      { brickId: 'secession', rule: 'link two focal elements with one curve', reason: 'unsupported-target' },
      { brickId: 'g2', rule: 'daylight would flatten it', reason: 'fragile' },
      { brickId: 'secession', rule: 'a second rule with no slot', reason: 'no-slot' },
      { brickId: 'g2', rule: 'a rule with no parameter', reason: 'parameter-none' },
    ])
    assert.deepEqual(groups.map(g => [g.brickId, g.items.map(u => u.rule)]), [
      ['secession', ['link two focal elements with one curve', 'a second rule with no slot']],
      ['g2', ['a rule with no parameter']],
    ])
  })
  it('only fragile notes: nothing to show', () => {
    assert.deepEqual(carryOver([{ brickId: 'g2', rule: 'daylight would flatten it', reason: 'fragile' }]), [])
  })
})
