/** Spec v3 P1-P5: lean chips derived from the relation layer, the anchor, and the server's rendering of both into the propose prompt.
 *  Expected strings are typed out from the spec, never read from the code under test. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import type { Brick } from '../src/lib/types.ts'
import { resolveProject, type Project, type Proposal, type ProposalPick } from '../src/lib/mapRelations.ts'
import { exportHandoff, proposedNow } from '../src/export/index.ts'
import { CHIP_FAMILIES, CHIP_IDS, DARK_RULE, canonicalChips } from '../src/lib/leanFamilies.ts'
import { carries, chipsFor } from '../src/lib/lean.ts'
import { libraryFor, proposeBody } from '../src/lib/proposeClient.ts'
import { PROPOSE_PROMPT } from '../src/lib/proposePrompt.ts'
import { buildProposeRequest, handlePropose, renderPrompt, validatePicks, type LibraryBrick } from '../src/lib/propose.ts'

const byId = (id: string): Brick => SAMPLES.find(b => b.id === id)!
const idsCarrying = (chip: (typeof CHIP_IDS)[number]) => SAMPLES.filter(b => carries(b, chip)).map(b => b.id).sort()
const INTENT = 'A concert log for someone who goes to a lot of shows'
const LIB = libraryFor(SAMPLES)

// the lean text the spec asks for, typed out
const LEAN_HEAD = '\n\nLean. The designer asked to lean the choice toward rules that set these layout parameters: '
const LEAN_TAIL = '. Prefer picks whose quoted rule maps to one of them, when such a rule serves what they are making.'
const DARK_PARA = '\n\nAlso prefer these bricks when they serve what they are making: bauhaus-1923-staatliches-bauhaus-weimar, g2, secession-1902-beethoven-catalogue.'
const anchorPara = (id: string) => `\n\nAnchor. The designer has already chosen brick "${id}" as the starting point. Do not pick it. Pick at most two other bricks whose rules work with it.`
const ENDS = 'Do not pick the same brick twice.'
/** The one sentence added after v1 for the swap sheet's ranking (2026-11-03), between the {{LEAN}} slot and the library. */
const RANKING = '\n\nAlso return ranking: every brick_id in the library exactly once, best fit first for what they are making, by the same preferences as your picks.'
/** What the prompt says between the last instruction line and the ranking sentence: the {{LEAN}} slot. */
const leanSlot = (prompt: string) => { const i = prompt.indexOf(ENDS) + ENDS.length; return prompt.slice(i, prompt.indexOf(RANKING, i)) }

// the v1 template (before {{LEAN}} and the ranking sentence), kept here as a fixture
const V1_PROMPT = `You are helping a designer choose reference material from their own library.

They are about to make: "{{INTENT}}"

The library below is a list of bricks. A brick is one photo the designer saved, reduced to its transferable rules: one sentence each, written by a vision model that read the photo, with the layout parameter the rule maps to ("none" means no parameter carries it). You see only the rules, never the photos.

Pick the bricks whose rules would serve what they are making. At most three; fewer when fewer fit; none when none fit.
For each pick:
- brick_id: the id exactly as listed.
- quoted_rule: ONE rule of that brick, copied character for character. Do not paraphrase, shorten or fix it. If no rule of the brick can be quoted, do not pick the brick.
- why: one sentence on how that rule serves what they are making. Plain language; no new claims about the photo.
Prefer picks whose quoted rules map to different parameters. Do not pick the same brick twice.

Library:
{{LIBRARY}}`
/** v1 plus the ranking sentence: the base every request now starts from, and the way it is rendered. */
const BASE_PROMPT = V1_PROMPT.replace('\n\nLibrary:\n', `${RANKING}\n\nLibrary:\n`)
const baseRender = (intent: string, library: LibraryBrick[]) => {
  const lib = JSON.stringify(library, null, 1), sentence = intent.replace(/"/g, '”')
  return BASE_PROMPT.replace('{{LIBRARY}}', () => lib).replace('{{INTENT}}', () => sentence)
}

describe('chip table', () => {
  it('has the eight chips in the spec order, and `dark` asks for no parameter family', () => {
    assert.deepEqual([...CHIP_IDS], ['dark', 'airy', 'one accent', 'text-heavy', 'big titles', 'left-aligned', 'two colors', 'grid'])
    assert.deepEqual(CHIP_FAMILIES, {
      dark: [], airy: ['density'], 'one accent': ['accent_coverage'], 'text-heavy': ['image_text_dominance', 'hierarchy_mode'],
      'big titles': ['type_scale_ratio'], 'left-aligned': ['alignment_edge'], 'two colors': ['palette_hue_count'], grid: ['rhythm'],
    })
  })
  it('puts chips in canonical order and drops repeats, whatever order they were clicked in', () => {
    assert.deepEqual(canonicalChips(['left-aligned', 'text-heavy']), ['text-heavy', 'left-aligned'])
    assert.deepEqual(canonicalChips(['grid', 'dark', 'airy', 'dark']), ['dark', 'airy', 'grid'])
    assert.deepEqual(canonicalChips([]), [])
  })
})

describe('DARK_RULE', () => {
  it('matches a rule that names a dark ground and nothing in iran or lissitzky', () => {
    for (const s of ['Set the title on a dark ground', 'darkness covering ~60% of the frame', 'type floats across a dark field', 'near-black background', 'a Black Base', 'dark surround']) assert.ok(DARK_RULE.test(s), s)
    for (const s of ['light neutral ground plus one dark accent', 'black on light ground', 'dark tones', 'a ground that is not dark', 'darkness']) assert.equal(DARK_RULE.test(s), false, s)
  })
  it('is not stateful between calls', () => {
    assert.ok(DARK_RULE.test('on a dark ground')); assert.ok(DARK_RULE.test('on a dark ground'))
  })
})

describe('carries, on the 12 samples', () => {
  it('dark is read from the relation rule text, never from the skin: exactly bauhaus, g2, secession', () => {
    assert.deepEqual(idsCarrying('dark'), ['bauhaus-1923-staatliches-bauhaus-weimar', 'g2', 'secession-1902-beethoven-catalogue'])
    assert.equal(carries(byId('iran-1260s-star-cross-luster-tiles'), 'dark'), false)
    assert.equal(carries(byId('lissitzky-1923-dlya-golosa'), 'dark'), false)
  })
  it('dark ignores the skin: a brick with a near-black measured background but no dark rule does not carry it', () => {
    const b = { ...byId('c1'), skin_measured: { ...byId('c1').skin_measured!, color_bg: '#0A0A0A' } }
    assert.equal(carries(b, 'dark'), false)
  })
  it('dark looks at the rule, not the target', () => {
    const b = byId('c1')
    const target = { ...b, relations: b.relations.map(r => ({ ...r, rule: 'Keep the title large', target: 'on a dark ground' })) }
    assert.equal(carries(target, 'dark'), false)
    const rule = { ...b, relations: [{ ...b.relations[0], rule: 'Set the title on a dark ground' }] }
    assert.equal(carries(rule, 'dark'), true)
  })
  it('the other chips are read from the parameter candidates', () => {
    assert.deepEqual(idsCarrying('airy'), ['c1', 'haeckel-1904-trochilidae-plate-99'])
    assert.deepEqual(idsCarrying('one accent'), ['calmmouse', 'g2'])
    assert.deepEqual(idsCarrying('text-heavy'), ['calmmouse'])
    assert.deepEqual(idsCarrying('big titles'), ['calmmouse', 'jpl-2016-visions-mars', 'matthews-19c-glyphography-trade-card'])
    assert.deepEqual(idsCarrying('left-aligned'), ['calmmouse'])
    assert.equal(idsCarrying('two colors').length, 8)
    assert.deepEqual(idsCarrying('grid'), [])
  })
})

describe('chipsFor', () => {
  const count = (intent: string) => Object.fromEntries(chipsFor(SAMPLES, intent).map(c => [c.id, c.count]))
  it('counts what the library has and shows only chips with a count of at least one', () => {
    assert.deepEqual(count('a recipe box'), { 'two colors': 8, dark: 3, 'big titles': 3, airy: 2, 'one accent': 2, 'text-heavy': 1 })
    assert.equal(chipsFor(SAMPLES, 'a recipe box').some(c => c.id === 'grid'), false)
    assert.equal(count('x')['left-aligned'], undefined)   // cut by the six-chip limit, not by count
  })
  it('ranks a concert log: the intent names dark and one accent first', () => {
    assert.deepEqual(chipsFor(SAMPLES, INTENT).map(c => c.id), ['dark', 'one accent', 'airy', 'two colors', 'big titles', 'text-heavy'])
  })
  it('ranks a reader: the intent names text-heavy, left-aligned, big titles first', () => {
    assert.deepEqual(chipsFor(SAMPLES, 'A reader for long documents such as contracts and papers').map(c => c.id), ['text-heavy', 'left-aligned', 'big titles', 'two colors', 'dark', 'airy'])
  })
  it('ranks an intent that names nothing by count, ties in CHIP_IDS order', () => {
    assert.deepEqual(chipsFor(SAMPLES, 'a recipe box').map(c => c.id), ['two colors', 'dark', 'big titles', 'airy', 'one accent', 'text-heavy'])
  })
  it('matches keywords as whole words, case-insensitively', () => {
    assert.equal(chipsFor(SAMPLES, 'A CONCERT log')[0].id, 'dark')
    assert.deepEqual(chipsFor(SAMPLES, 'a catalogue of carpets').map(c => c.id), chipsFor(SAMPLES, 'a recipe box').map(c => c.id))   // "log" inside "catalogue", "car" inside "carpets"
  })
  it('writes the tooltip from the count and the description', () => {
    const n = (id: string, intent = INTENT) => chipsFor(SAMPLES, intent).find(c => c.id === id)!.note
    assert.equal(n('dark'), '3 bricks in your library have a rule that sets a dark ground')
    assert.equal(n('text-heavy'), '1 brick in your library lead with text (image share at most half, or type-led)')
    assert.equal(n('airy'), '2 bricks in your library set density low (1–2 items per screen)')
    assert.equal(n('one accent'), '2 bricks in your library keep the accent at or under 5%')
    assert.equal(n('big titles'), '3 bricks in your library set titles at 2× the body or more')
    assert.equal(n('left-aligned', 'a reader'), '1 brick in your library align text to the left edge')
    assert.equal(n('two colors'), '8 bricks in your library use two hues or fewer')
  })
  it('counts only ready, non-superseded bricks that have a rule', () => {
    const c1 = byId('c1')
    const hidden: Brick[] = [{ ...c1, id: 'p', status: 'pending' }, { ...c1, id: 's', superseded_by: 'c1' }, { ...c1, id: 'n', relations: [] }]
    assert.deepEqual(chipsFor(hidden, 'x'), [])
    assert.equal(chipsFor([c1, ...hidden], 'x').find(c => c.id === 'airy')!.count, 1)
  })
  it('returns at most six', () => { assert.ok(chipsFor(SAMPLES, INTENT).length <= 6) })
})

describe('the library the app sends does not depend on the lean', () => {
  it('is every ready brick that has a rule: the 12 samples, sorted by id', () => {
    assert.equal(LIB.length, 12)
    assert.deepEqual(LIB.map(b => b.brick_id), [...SAMPLES.map(b => b.id)].sort())
  })
  it('is the same 12 bricks for every lean', () => {
    for (const lean of [undefined, { chips: [] }, { chips: ['dark' as const] }, { chips: ['left-aligned' as const] }, { chips: ['dark' as const], anchor_id: 'calmmouse' }, { chips: [], anchor_id: 'g1' }])
      assert.deepEqual(proposeBody(INTENT, SAMPLES, false, lean).library, LIB)
  })
})

describe('the body the app sends', () => {
  it('has no lean field without chips or an anchor', () => {
    assert.deepEqual(Object.keys(proposeBody(INTENT, SAMPLES, false)), ['intent', 'library', 'dry'])
    assert.deepEqual(Object.keys(proposeBody(INTENT, SAMPLES, false, { chips: [] })), ['intent', 'library', 'dry'])
  })
  it('sends chips in canonical order, whatever order they were clicked in, and the anchor when there is one', () => {
    assert.deepEqual(proposeBody(INTENT, SAMPLES, false, { chips: ['left-aligned', 'text-heavy'] }).lean, { chips: ['text-heavy', 'left-aligned'] })
    assert.deepEqual(proposeBody(INTENT, SAMPLES, false, { chips: [], anchor_id: 'g2' }).lean, { chips: [], anchor_id: 'g2' })
    assert.deepEqual(proposeBody(INTENT, SAMPLES, true, { chips: ['grid', 'dark'], anchor_id: 'g2' }), { intent: INTENT, library: LIB, dry: true, lean: { chips: ['dark', 'grid'], anchor_id: 'g2' } })
  })
})

describe('the prompt', () => {
  it('is the v1 text plus the ranking sentence, with {{LEAN}} glued to the end of the last instruction line, and nothing else changed', () => {
    assert.ok(PROPOSE_PROMPT.includes(`${ENDS}{{LEAN}}${RANKING}\n\nLibrary:\n{{LIBRARY}}`))
    assert.equal(PROPOSE_PROMPT.replace('{{LEAN}}', ''), BASE_PROMPT)
    assert.equal(PROPOSE_PROMPT.split('{{LEAN}}').length, 2)
  })
  it('renders without a lean exactly as the base prompt', () => {
    assert.equal(renderPrompt(INTENT, LIB), baseRender(INTENT, LIB))
    assert.equal(renderPrompt(INTENT, LIB, undefined), baseRender(INTENT, LIB))
    assert.equal(renderPrompt(INTENT, LIB, { chips: [] }), baseRender(INTENT, LIB))
    assert.equal(renderPrompt('he said "no" $& $1', LIB), baseRender('he said "no" $& $1', LIB))
    assert.deepEqual(buildProposeRequest(INTENT, LIB).input[0].content[0].text, baseRender(INTENT, LIB))
  })
  it('names the parameter families, and never a chip word', () => {
    const out = renderPrompt(INTENT, LIB, { chips: ['dark', 'one accent'] })
    assert.ok(out.includes('layout parameters: accent_coverage.'))
    assert.equal(leanSlot(out), `${LEAN_HEAD}accent_coverage${LEAN_TAIL}${DARK_PARA}`)
    for (const word of CHIP_IDS) assert.equal(leanSlot(out).toLowerCase().includes(word), false, word)
    assert.equal(leanSlot(out).includes('dark'), false)
  })
  it('turns dark alone into brick ids and no Lean paragraph', () => {
    const slot = leanSlot(renderPrompt(INTENT, LIB, { chips: ['dark'] }))
    assert.equal(slot, DARK_PARA)
    assert.equal(slot.includes('Lean.'), false)
  })
  it('lists the dark bricks of the library it was given, in library order', () => {
    const lib: LibraryBrick[] = [{ brick_id: 'z-last', rules: [{ rule: 'Keep a near-black base', parameter: 'none' }] }, { brick_id: 'a-plain', rules: [{ rule: 'Keep it light', parameter: 'none' }] }, { brick_id: 'm-dark', rules: [{ rule: 'darkness covering most of it', parameter: 'none' }] }]
    assert.equal(leanSlot(renderPrompt(INTENT, lib, { chips: ['dark'] })), '\n\nAlso prefer these bricks when they serve what they are making: z-last, m-dark.')
    assert.equal(leanSlot(renderPrompt(INTENT, [lib[1]], { chips: ['dark'] })), '')   // no dark brick, nothing to prefer
  })
  it('puts families in canonical chip order, and the same lean in any click order renders identically', () => {
    const a = renderPrompt(INTENT, LIB, { chips: ['left-aligned', 'text-heavy'] }), b = renderPrompt(INTENT, LIB, { chips: ['text-heavy', 'left-aligned'] })
    assert.equal(a, b)
    assert.equal(leanSlot(a), `${LEAN_HEAD}image_text_dominance, hierarchy_mode, alignment_edge${LEAN_TAIL}`)
    assert.equal(renderPrompt(INTENT, LIB, { chips: ['grid', 'airy', 'dark'] }), renderPrompt(INTENT, LIB, { chips: ['dark', 'airy', 'grid'] }))
    assert.equal(leanSlot(renderPrompt(INTENT, LIB, { chips: ['grid', 'airy', 'dark'] })), `${LEAN_HEAD}density, rhythm${LEAN_TAIL}${DARK_PARA}`)
  })
  it('names a family once however many times its chip was sent', () => {
    assert.equal(leanSlot(renderPrompt(INTENT, LIB, { chips: ['airy', 'airy'] })), `${LEAN_HEAD}density${LEAN_TAIL}`)
  })
  it('adds the anchor paragraph last, with the id', () => {
    assert.equal(leanSlot(renderPrompt(INTENT, LIB, { chips: [], anchor_id: 'calmmouse' })), anchorPara('calmmouse'))
    assert.equal(leanSlot(renderPrompt(INTENT, LIB, { chips: ['dark', 'airy'], anchor_id: 'calmmouse' })), `${LEAN_HEAD}density${LEAN_TAIL}${DARK_PARA}${anchorPara('calmmouse')}`)
  })
  it('keeps the rest of the prompt as it was, lean or not', () => {
    const lean = renderPrompt(INTENT, LIB, { chips: ['airy'], anchor_id: 'g2' })
    assert.equal(lean.replace(leanSlot(lean), ''), baseRender(INTENT, LIB))
  })
  it('never expands a placeholder typed into the intent', () => {
    const out = renderPrompt('use {{LEAN}} and {{LIBRARY}}', LIB, { chips: ['airy'] })
    assert.ok(out.includes('"use {{LEAN}} and {{LIBRARY}}"'))
    assert.equal(leanSlot(out), `${LEAN_HEAD}density${LEAN_TAIL}`)
  })
})

describe('validatePicks with an anchor', () => {
  const lib: LibraryBrick[] = ['a', 'b', 'c', 'd'].map(id => ({ brick_id: id, rules: [{ rule: `rule of ${id}`, parameter: 'density' }] }))
  const pick = (id: string) => ({ brick_id: id, quoted_rule: `rule of ${id}`, why: 'because' })
  it('drops a pick equal to the anchor', () => {
    const out = validatePicks([pick('a'), pick('b')], lib, 'a')
    assert.deepEqual(out.picks.map(p => p.brickId), ['b'])
    assert.deepEqual(out.dropped, [{ brick_id: 'a', reason: 'already chosen by the designer' }])
  })
  it('keeps at most two other picks', () => {
    const out = validatePicks([pick('b'), pick('c'), pick('d')], lib, 'a')
    assert.deepEqual(out.picks.map(p => p.brickId), ['b', 'c'])
    assert.deepEqual(out.dropped, [{ brick_id: 'd', reason: 'more than two picks besides the anchor' }])
  })
  it('is unchanged without an anchor: three picks, the old reasons', () => {
    const out = validatePicks([pick('a'), pick('b'), pick('c'), pick('d'), pick('zzz')], lib)
    assert.deepEqual(out.picks.map(p => p.brickId), ['a', 'b', 'c'])
    assert.deepEqual(out.dropped, [{ brick_id: 'd', reason: 'more than three picks' }, { brick_id: 'zzz', reason: 'not a brick in the library' }])
  })
})

describe('handlePropose, dry', () => {
  const body = (lean?: unknown) => ({ intent: INTENT, library: LIB, dry: true, ...(lean === undefined ? {} : { lean }) })
  const text = (out: { body: any }) => out.body.request.input[0].content[0].text as string
  it('answers 200 with the unchanged request when there is no lean', async () => {
    const out = await handlePropose(body(), undefined, { live: false })
    assert.equal(out.code, 200)
    assert.deepEqual(out.body.request, buildProposeRequest(INTENT, LIB))
    assert.equal(text(out), baseRender(INTENT, LIB))
  })
  it('treats a lean with neither chips nor an anchor as no lean', async () => {
    const out = await handlePropose(body({ chips: [] }), undefined, { live: false })
    assert.equal(out.code, 200)
    assert.deepEqual(out.body.request, buildProposeRequest(INTENT, LIB))
  })
  it('renders a valid lean into the prompt', async () => {
    const out = await handlePropose(body({ chips: ['dark', 'one accent'], anchor_id: 'calmmouse' }), undefined, { live: false })
    assert.equal(out.code, 200)
    assert.equal(leanSlot(text(out)), `${LEAN_HEAD}accent_coverage${LEAN_TAIL}${DARK_PARA}${anchorPara('calmmouse')}`)
    assert.deepEqual(out.body.request, buildProposeRequest(INTENT, LIB, { chips: ['dark', 'one accent'], anchor_id: 'calmmouse' }))
  })
  it('renders the same request for chips sent in any order', async () => {
    const a = await handlePropose(body({ chips: ['left-aligned', 'text-heavy'] }), undefined, { live: false })
    const b = await handlePropose(body({ chips: ['text-heavy', 'left-aligned'] }), undefined, { live: false })
    assert.equal(a.code, 200)
    assert.deepEqual(a.body, b.body)
  })
  it('refuses an unknown chip, too many chips, a wrong shape and an empty anchor with 400', async () => {
    const msg = 'lean must be { chips: [known chip ids, at most six], anchor_id? }'
    for (const lean of [{ chips: ['neon'] }, { chips: ['dark', 'airy', 'one accent', 'text-heavy', 'big titles', 'left-aligned', 'two colors'] }, { chips: 'dark' }, {}, 'dark', 3, { chips: [], anchor_id: '' }, { chips: [], anchor_id: 'x'.repeat(81) }]) {
      const out = await handlePropose(body(lean), undefined, { live: false })
      assert.deepEqual([out.code, out.body], [400, { error: msg }], JSON.stringify(lean))
    }
  })
  it('refuses an anchor that is not in the library with 400', async () => {
    const out = await handlePropose(body({ chips: [], anchor_id: 'no-such-brick' }), undefined, { live: false })
    assert.deepEqual([out.code, out.body], [400, { error: 'the anchor is not a brick in the library' }])
  })
  it('refuses an anchor whose brick has no rule to quote: the library is filtered first', async () => {
    const lib = [...LIB, { brick_id: 'bare', rules: [] }]
    const out = await handlePropose({ intent: INTENT, library: lib, dry: true, lean: { chips: [], anchor_id: 'bare' } }, undefined, { live: false })
    assert.deepEqual([out.code, out.body], [400, { error: 'the anchor is not a brick in the library' }])
  })
})

describe('handlePropose, a stubbed model call', () => {
  it('sends the lean, drops the anchor and extra picks, and logs the lean without its words', async () => {
    const real = globalThis.fetch
    let sent: any = null
    const pick = (id: string, i = 0) => ({ brick_id: id, quoted_rule: LIB.find(b => b.brick_id === id)!.rules[i].rule, why: 'it fits' })
    const answer = { picks: [pick('calmmouse'), pick('g2'), pick('c1'), pick('g1')] }
    globalThis.fetch = (async (_url: any, init: any) => {
      sent = JSON.parse(init.body)
      return new Response(JSON.stringify({ status: 'completed', usage: { input_tokens: 10, output_tokens: 5 }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] }), { status: 200 })
    }) as typeof fetch
    try {
      const lines: string[] = []
      const out = await handlePropose({ intent: INTENT, library: LIB, lean: { chips: ['dark', 'airy'], anchor_id: 'calmmouse' } }, 'test-key', { live: true, ip: 'lean-test', log: l => lines.push(l) })
      assert.equal(out.code, 200)
      assert.equal(leanSlot(sent.input[0].content[0].text), `${LEAN_HEAD}density${LEAN_TAIL}${DARK_PARA}${anchorPara('calmmouse')}`)
      assert.deepEqual(out.body.picks.map((p: any) => p.brickId), ['g2', 'c1'])
      assert.deepEqual(out.body.dropped, [{ brick_id: 'calmmouse', reason: 'already chosen by the designer' }, { brick_id: 'g1', reason: 'more than two picks besides the anchor' }])
      const log = JSON.parse(lines[0])
      assert.equal(log.lean_chips, 2); assert.equal(log.anchor, true)
      const plain: string[] = []
      await handlePropose({ intent: INTENT, library: LIB }, 'test-key', { live: true, ip: 'lean-test', log: l => plain.push(l) })
      assert.equal(JSON.parse(plain[0]).lean_chips, 0); assert.equal(JSON.parse(plain[0]).anchor, false)
      assert.equal(sent.input[0].content[0].text, baseRender(INTENT, LIB))
    } finally { globalThis.fetch = real }
  })
})

describe('the record of a lean in the handoff', () => {
  const ids = ['g2', 'c1', 'calmmouse']
  const project: Project = { id: 'p', intent: INTENT, createdAt: '2026-11-02T00:00:00.000Z', brickIds: ids, disabled: {}, choice: {}, locks: {}, manual: {} }
  const bricks = ids.map(byId)
  const proposed = (brickId: string): ProposalPick => ({ brickId, quotedRule: 'a rule', why: 'because', status: 'proposed' })
  const anchored: ProposalPick = { brickId: 'g2', quotedRule: '', why: '', status: 'anchor' }
  const proposal = (picks: ProposalPick[], lean?: Proposal['lean']): Proposal => ({ at: '2026-11-02T10:00:00.000Z', model: 'muse-spark-1.3', effort: 'low', intent: INTENT, latency_ms: 5000, dropped: 0, picks, ...(lean ? { lean } : {}) })
  const handoff = (p: Proposal) => exportHandoff(INTENT, bricks, resolveProject(project, SAMPLES), p)

  it('says the anchor was chosen by the person, and does not count it as a model proposal', () => {
    const p = proposal([anchored, proposed('c1'), proposed('calmmouse')], { chips: ['dark', 'airy'], anchor_id: 'g2' })
    assert.equal(proposedNow(ids, p), 2)
    const text = handoff(p)
    assert.ok(text.includes('Chosen by you as the starting point ("More like this one").'))
    assert.ok(text.includes('2 of 3 bricks were proposed by the model'))
    assert.equal(text.includes('Proposed by the model (muse-spark-1.3, effort low) for this intent, quoting its rule: "a rule" (because)'), true)   // c1 and calmmouse only
  })
  it('names the chips and the starting point the proposal leaned on', () => {
    assert.ok(handoff(proposal([anchored, proposed('c1')], { chips: ['dark', 'airy'], anchor_id: 'g2' })).includes(' The proposal leaned on: dark, airy; starting point: g2.'))
    assert.ok(handoff(proposal([proposed('g2'), proposed('c1')], { chips: ['one accent'] })).includes(' The proposal leaned on: one accent.'))
    assert.ok(handoff(proposal([anchored, proposed('c1')], { chips: [], anchor_id: 'g2' })).includes(' The proposal leaned on: starting point: g2.'))
  })
  it('says nothing about a lean when none was recorded, or when no brick is a model proposal any more', () => {
    assert.equal(handoff(proposal([proposed('g2'), proposed('c1')])).includes('leaned on'), false)
    const swapped: ProposalPick = { brickId: 'c1', quotedRule: '', why: '', status: 'swapped', swappedFrom: 'g1' }
    const text = handoff(proposal([anchored, swapped], { chips: ['dark'], anchor_id: 'g2' }))
    assert.ok(text.includes('none of them is a model proposal'))
    assert.equal(text.includes('leaned on'), false)
  })
})
