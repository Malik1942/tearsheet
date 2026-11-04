# Swap Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The swap sheet groups photos (Same job / Adds something / Everything else), orders each group by a ranking the propose call now returns, and captions each tile with a short label and a short date or credit.

**Architecture:** The existing propose call gains a `ranking` field (schema, one prompt sentence, a lenient validator) that Make stores on `project.proposal`. A new pure module `src/lib/swapSheet.ts` turns a project, the pool and the photo being replaced into ordered groups and tile captions; `SwapPicker` only renders them. Spec: `docs/superpowers/specs/2026-11-03-swap-sheet-design.md`.

**Tech Stack:** Vite 8, React 19, TypeScript, Tailwind 4, zod 4; tests with `node:test` + `tsx` (`npm test` runs `scripts/*.test.ts`).

## Global Constraints

- Library order stays newest-first; do not change it.
- No new model call: the ranking comes from the same propose call as the picks.
- No live model call while building or verifying: dev proposals are live in this checkout (the notes are sealed), so a real call needs Malik's go. Browser checks stub `/api/propose` and set `localStorage['tearsheet.dry'] = '1'` as a second guard.
- Do not touch `../meta-eval/` (another session has uncommitted work there).
- No commits: Malik commits on request.
- Copy, verbatim: group titles `Same job`, `Adds something`, `Everything else`; prompt sentence `Also return ranking: every brick_id in the library exactly once, best fit first for what they are making, by the same preferences as your picks.`
- Tile type: line 1 13 px / 500 / ink; line 2 12 px / muted; group headers `caption`, uppercase, muted.
- Imports: client modules are extensionless (as `src/lib/makeFlow.ts`); server-shared modules (`src/lib/propose.ts`) keep their `.js` imports.

---

### Task 1: Ranking from the propose call

**Files:**
- Modify: `src/lib/propose.ts` (schema, zod schema, `validateRanking`, response type, `propose()`, log line)
- Modify: `src/lib/proposePrompt.ts` (one sentence)
- Modify: `src/lib/proposeClient.ts` (`ProposeOutcome.ranking`)
- Modify: `src/lib/mapRelations.ts:143-144` (`Proposal.ranking?`)
- Modify: `src/screens/Make.tsx:109` (store it)
- Modify: `scripts/lean.test.ts` (the v1 pin becomes v1 + the sentence)
- Create: `scripts/ranking.test.ts`

**Interfaces:**
- Produces: `validateRanking(raw: unknown, library: LibraryBrick[]): string[]`; `ProposeResponse` ok branch has `ranking: string[]`; `ProposeOutcome` ok branch has `ranking: string[]`; `Proposal.ranking?: string[]`.

- [ ] **Step 1: Write the failing test** — `scripts/ranking.test.ts`:

```ts
/** Swap sheet §1: the propose call also ranks the whole library (no new model call). Expected values are typed out from the spec
 *  (docs/superpowers/specs/2026-11-03-swap-sheet-design.md), never read from the code under test. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { PROPOSE_PROMPT } from '../src/lib/proposePrompt.ts'
import { PROPOSE_SCHEMA, handlePropose, validateRanking, type LibraryBrick } from '../src/lib/propose.ts'
import { libraryFor, propose as proposeFromApp } from '../src/lib/proposeClient.ts'

const INTENT = 'A concert log for someone who goes to a lot of shows'
const LIB = libraryFor(SAMPLES)
const SENTENCE = 'Also return ranking: every brick_id in the library exactly once, best fit first for what they are making, by the same preferences as your picks.'
const firstRule = (id: string) => LIB.find(b => b.brick_id === id)!.rules[0].rule

/** Stubs the model with one answer, runs `fn`, restores fetch; returns every request body sent. */
async function withModel(answer: unknown, fn: () => Promise<void>): Promise<any[]> {
  const real = globalThis.fetch, sent: any[] = []
  globalThis.fetch = (async (_url: any, init: any) => {
    sent.push(JSON.parse(init.body))
    return new Response(JSON.stringify({ status: 'completed', usage: { input_tokens: 10, output_tokens: 5 }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] }), { status: 200 })
  }) as typeof fetch
  try { await fn() } finally { globalThis.fetch = real }
  return sent
}

describe('the propose schema', () => {
  it('requires a ranking of at most 60 strings next to the picks', () => {
    assert.deepEqual(PROPOSE_SCHEMA.required, ['picks', 'ranking'])
    assert.deepEqual(PROPOSE_SCHEMA.properties.ranking, { type: 'array', maxItems: 60, items: { type: 'string' } })
  })
})

describe('the prompt', () => {
  it('asks for the ranking in one sentence after the lean slot and before the library', () => {
    assert.ok(PROPOSE_PROMPT.includes(`{{LEAN}}\n\n${SENTENCE}\n\nLibrary:\n{{LIBRARY}}`))
    assert.equal(PROPOSE_PROMPT.split(SENTENCE).length, 2)
  })
})

describe('validateRanking', () => {
  const lib: LibraryBrick[] = ['a', 'b', 'c'].map(brick_id => ({ brick_id, rules: [{ rule: `rule of ${brick_id}`, parameter: 'none' }] }))
  it('keeps library ids in the order the model gave', () => {
    assert.deepEqual(validateRanking(['c', 'a', 'b'], lib), ['c', 'a', 'b'])
  })
  it('drops ids not in the library, repeats, near-misses and anything that is not a string', () => {
    assert.deepEqual(validateRanking(['x', 'b', 7, 'b', null, ' a', 'a', { id: 'c' }], lib), ['b', 'a'])
  })
  it('reads a missing or malformed ranking as none', () => {
    for (const raw of [undefined, null, 'a,b', {}, 3]) assert.deepEqual(validateRanking(raw, lib), [])
  })
})

describe('handlePropose: the ranking comes from the same call', () => {
  it('returns the checked ranking beside the picks and logs how many ids it kept', async () => {
    const lines: string[] = []
    let out: any
    const sent = await withModel({ picks: [{ brick_id: 'g2', quoted_rule: firstRule('g2'), why: 'it fits' }], ranking: ['g2', 'no-such-brick', 'c1', 'g2', 'calmmouse'] }, async () => {
      out = await handlePropose({ intent: INTENT, library: LIB }, 'test-key', { live: true, ip: 'ranking-test', log: l => lines.push(l) })
    })
    assert.equal(sent.length, 1)
    assert.ok(sent[0].input[0].content[0].text.includes(SENTENCE))
    assert.deepEqual(sent[0].text.format.schema.required, ['picks', 'ranking'])
    assert.equal(out.code, 200)
    assert.deepEqual(out.body.picks.map((p: any) => p.brickId), ['g2'])
    assert.deepEqual(out.body.ranking, ['g2', 'c1', 'calmmouse'])
    assert.equal(JSON.parse(lines[0]).ranked, 3)
  })
  it('keeps the picks when the answer has no ranking', async () => {
    const lines: string[] = []
    let out: any
    await withModel({ picks: [{ brick_id: 'g2', quoted_rule: firstRule('g2'), why: 'it fits' }] }, async () => {
      out = await handlePropose({ intent: INTENT, library: LIB }, 'test-key', { live: true, ip: 'ranking-test', log: l => lines.push(l) })
    })
    assert.equal(out.body.ok, true)
    assert.deepEqual(out.body.picks.map((p: any) => p.brickId), ['g2'])
    assert.deepEqual(out.body.ranking, [])
    assert.equal(JSON.parse(lines[0]).ranked, 0)
  })
})

describe('the app passes the ranking on', () => {
  const server = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch
  const ok = { ok: true, picks: [{ brickId: 'g2', quotedRule: 'r', why: 'w' }], dropped: [], status: 'completed', latency_ms: 1, usage: { input_tokens: 1, output_tokens: 1, reasoning_tokens: 0 }, cost_usd: 0, model: 'muse-spark-1.3', effort: 'low' }
  it('hands Make the ranking the server returned', async () => {
    const real = globalThis.fetch
    globalThis.fetch = server({ ...ok, ranking: ['g2', 'c1'] })
    try {
      const out = await proposeFromApp(INTENT, SAMPLES)
      assert.equal(out.ok, true)
      assert.deepEqual(out.ok && out.ranking, ['g2', 'c1'])
    } finally { globalThis.fetch = real }
  })
  it('reads a response without one as an empty ranking', async () => {
    const real = globalThis.fetch
    globalThis.fetch = server(ok)
    try {
      const out = await proposeFromApp(INTENT, SAMPLES)
      assert.deepEqual(out.ok && out.ranking, [])
    } finally { globalThis.fetch = real }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --disable-warning=DEP0205 --import tsx --test scripts/ranking.test.ts`
Expected: FAIL (`validateRanking` is not exported; schema `required` is `['picks']`).

- [ ] **Step 3: Implement**

`src/lib/propose.ts` — header line 3 becomes: ` *  Output: up to three brick ids, each with a rule quoted verbatim (a pick whose quote is not one of that brick's rules is dropped), and a ranking of the whole library for the swap sheet. */`

Schema and zod:

```ts
/** Exactly the schema the model is constrained to (meta-eval/fixtures/schemas/propose.json). `ranking` orders the whole library for the swap sheet. */
export const PROPOSE_SCHEMA = {
  title: 'ProposeResult', type: 'object', additionalProperties: false, required: ['picks', 'ranking'],
  properties: {
    picks: { type: 'array', maxItems: 3, items: {
      type: 'object', additionalProperties: false, required: ['brick_id', 'quoted_rule', 'why'],
      properties: { brick_id: { type: 'string' }, quoted_rule: { type: 'string' }, why: { type: 'string' } } } },
    ranking: { type: 'array', maxItems: 60, items: { type: 'string' } },
  },
} as const

const PickSchema = z.object({ brick_id: z.string(), quoted_rule: z.string(), why: z.string() })
/** `ranking` is read leniently and checked by `validateRanking`: a missing or malformed one costs the ranking, never the proposal. */
export const ProposeResultSchema = z.object({ picks: z.array(PickSchema), ranking: z.unknown().optional() })
```

After `validatePicks`:

```ts
/** The swap sheet's order (2026-11-03), from the same call as the picks: library ids only, in the model's order, each once. Anything else is
 *  dropped, and a missing or malformed ranking is none: it orders photos, it never costs a proposal. */
export function validateRanking(raw: unknown, library: LibraryBrick[]): string[] {
  if (!Array.isArray(raw)) return []
  const ids = new Set(library.map(b => b.brick_id)), kept = new Set<string>()
  for (const id of raw) if (typeof id === 'string' && ids.has(id)) kept.add(id)
  return [...kept]
}
```

`ProposeResponse` ok branch: add `ranking: string[];` after `dropped: …[];`. In `propose()`:

```ts
    return { ok: true, picks, dropped, ranking: validateRanking(parsed.ranking, library), status, latency_ms, usage, cost_usd, model: MODEL, effort: EFFORT }
```

Log line, ok branch: `…, picks: result.picks.length, dropped: result.dropped.length, ranked: result.ranking.length, bricks_offered: …`.

`src/lib/proposePrompt.ts` — the template's end becomes:

```
Prefer picks whose quoted rules map to different parameters. Do not pick the same brick twice.{{LEAN}}

Also return ranking: every brick_id in the library exactly once, best fit first for what they are making, by the same preferences as your picks.

Library:
{{LIBRARY}}`
```

and the doc comment's last sentence becomes: `{{LEAN}} is empty without a lean (spec v3 P5); the ranking sentence after it (swap sheet, 2026-11-03) is the only change to the v1 text besides the slot.`

`src/lib/proposeClient.ts`: ok branch of `ProposeOutcome` gets `ranking: string[]`; the success return becomes `return { ok: true, picks: json.picks, ranking: json.ranking ?? [], dropped: json.dropped.length, latency_ms: json.latency_ms, model: json.model, effort: json.effort, cost_usd: json.cost_usd }`.

`src/lib/mapRelations.ts`: `Proposal` gets `; ranking?: string[]` after `lean?`, and its comment gains: `` `ranking` is the same call's order of the whole library, best fit first (swap sheet); older projects have none. ``

`src/screens/Make.tsx` `run()`: the proposal literal ends `…, picks, ...(lean.chips.length || lean.anchor_id ? { lean } : {}), ...(out.ranking.length ? { ranking: out.ranking } : {}) }`.

`scripts/lean.test.ts`: after `v1Render`, add

```ts
/** The one sentence added after v1 for the swap sheet's ranking (2026-11-03), and v1 with it: the base every request now starts from. */
const RANKING = '\n\nAlso return ranking: every brick_id in the library exactly once, best fit first for what they are making, by the same preferences as your picks.'
const BASE_PROMPT = V1_PROMPT.replace('\n\nLibrary:\n', `${RANKING}\n\nLibrary:\n`)
const baseRender = (intent: string, library: LibraryBrick[]) => {
  const lib = JSON.stringify(library, null, 1), sentence = intent.replace(/"/g, '”')
  return BASE_PROMPT.replace('{{LIBRARY}}', () => lib).replace('{{INTENT}}', () => sentence)
}
```

then: `leanSlot` ends at the ranking sentence (`prompt.indexOf(RANKING, i)` instead of `prompt.indexOf('\n\nLibrary:\n', i)`); the first prompt test asserts `` PROPOSE_PROMPT.includes(`${ENDS}{{LEAN}}${RANKING}\n\nLibrary:\n{{LIBRARY}}`) `` and `PROPOSE_PROMPT.replace('{{LEAN}}', '') === BASE_PROMPT`, with titles saying "the v1 text plus the ranking sentence"; every `v1Render(` call becomes `baseRender(`; `v1Render` is then removed if unused.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --disable-warning=DEP0205 --import tsx --test scripts/ranking.test.ts scripts/lean.test.ts`
Expected: PASS, 0 failures.

- [ ] **Step 5: No commit** (Malik commits on request).

### Task 2: Groups, order and captions

**Files:**
- Modify: `src/lib/brickLabels.ts` (add `shortCredit`, `shortOriginLine`)
- Create: `src/lib/swapSheet.ts`
- Create: `scripts/swapsheet.test.ts`

**Interfaces:**
- Consumes: `Proposal.ranking?: string[]` (Task 1).
- Produces: `shortCredit(credit: string): string`; `shortOriginLine(b, today?): string`; `type SwapTile = { brick: Brick; inProject: boolean }`; `type SwapGroup = { id: 'same' | 'adds' | 'rest'; title: string; tiles: SwapTile[] }`; `swapGroups(project: Project, pool: Brick[], replacing: string, bricks: Brick[]): SwapGroup[]`; `tileCaption(brick: Brick, today?: Date): { label: string | null; line: string }`.

- [ ] **Step 1: Write the failing test** — `scripts/swapsheet.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --disable-warning=DEP0205 --import tsx --test scripts/swapsheet.test.ts`
Expected: FAIL (module `src/lib/swapSheet.ts` not found).

- [ ] **Step 3: Implement**

`src/lib/brickLabels.ts`, after `creditLine`:

```ts
/** Institutions with a short name for picker tiles (swap sheet, 2026-11-03); the rest of the credit, its date, is kept. A credit that starts with none of these
 *  is shown whole: an institution's name is never cut. */
const SHORT_NAMES: [string, string][] = [
  ['Minneapolis Institute of Art', 'Mia'],
  ['The Metropolitan Museum of Art', 'The Met'],
  ['Courtesy NASA/JPL-Caltech', 'NASA/JPL'],
  ['Wikimedia Commons', 'Wikimedia'],
]

export function shortCredit(credit: string): string {
  const hit = SHORT_NAMES.find(([full]) => credit.startsWith(full))
  return hit ? hit[1] + credit.slice(hit[0].length) : credit
}

/** A picker tile's second line (swap sheet): a credited starter's short credit; anything else its date as an own photo shows it ("Dec 27, 2025", else "saved Nov 3").
 *  The author's own starters carry no credit, so they show their date, never the author's name. */
export function shortOriginLine(b: Pick<Brick, 'id' | 'origin' | 'credit' | 'saved_at' | 'taken_at'>, today: Date = new Date()): string {
  if (originOf(b) === 'starter' && b.credit) return shortCredit(b.credit)
  return b.taken_at ? dayLabel(b.taken_at, today) : savedLabel(b.saved_at, today)
}
```

`src/lib/swapSheet.ts`:

```ts
/** The swap sheet (2026-11-03; docs/superpowers/specs/2026-11-03-swap-sheet-design.md): which photos it offers in place of one, in which group and order,
 *  and each tile's two lines. Deterministic and pure: no model call, no React. Inside a group the order is the proposal's ranking (the same call as the
 *  picks), then the newest saved; the Library's own order is untouched. */
import { CAP_PER_BRICK, candidatesOf, resolveProject, type Project } from './mapRelations'
import { isShellDefault } from './landing'
import { labelsOfBrick } from './shortLabels'
import { shortOriginLine } from './brickLabels'
import { RELATIONSHIP_KEYS, type ParameterKey } from '../shell/params'
import type { Brick } from './types'

export type SwapTile = { brick: Brick; inProject: boolean }
export type SwapGroup = { id: 'same' | 'adds' | 'rest'; title: string; tiles: SwapTile[] }

const TITLES = { same: 'Same job', adds: 'Adds something', rest: 'Everything else' } as const
const isRelationship = (k: ParameterKey) => (RELATIONSHIP_KEYS as readonly string[]).includes(k)

/** The relationship parameters a brick would set on its own: its first three candidates (the cap), the set its short labels come from. */
const ownSets = (brick: Brick): ParameterKey[] =>
  [...new Set(candidatesOf(brick).candidates.filter(c => isRelationship(c.key)).slice(0, CAP_PER_BRICK).map(c => c.key))]

/** Ranked first, in the ranking's order; the rest after, newest saved first, then by id. A ranking from another device is read defensively. */
function byRanking(ranking: unknown): (a: Brick, b: Brick) => number {
  const at = new Map<string, number>()
  if (Array.isArray(ranking)) ranking.forEach((id, i) => { if (typeof id === 'string' && !at.has(id)) at.set(id, i) })
  return (a, b) => {
    const ra = at.get(a.id) ?? Infinity, rb = at.get(b.id) ?? Infinity
    if (ra !== rb) return ra < rb ? -1 : 1
    if (a.saved_at !== b.saved_at) return a.saved_at < b.saved_at ? 1 : -1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  }
}

/** The sheet that replaces `replacing`: Same job (sets a parameter the replaced photo sets on the screens now, judged unmuted), Adds something (sets a parameter
 *  still at the shell default), Everything else; each photo in the first group it qualifies for, empty groups left out. `pool` is what the sheet may offer,
 *  `bricks` resolves the project. The replaced photo is never offered; photos already in the project come marked. */
export function swapGroups(project: Project, pool: Brick[], replacing: string, bricks: Brick[]): SwapGroup[] {
  const unmuted: Project = project.mutedBricks?.[replacing]
    ? { ...project, mutedBricks: Object.fromEntries(Object.entries(project.mutedBricks).filter(([id]) => id !== replacing)) as Record<string, true> }
    : project
  const before = resolveProject(unmuted, bricks).values
  const job = new Set(RELATIONSHIP_KEYS.filter(k => before[k].source?.brickId === replacing))
  const now = resolveProject(project, bricks).values
  const taken = new Set(RELATIONSHIP_KEYS.filter(k => !isShellDefault(now[k])))
  const tiles: Record<SwapGroup['id'], SwapTile[]> = { same: [], adds: [], rest: [] }
  for (const brick of [...pool].sort(byRanking(project.proposal?.ranking))) {
    if (brick.id === replacing) continue
    const sets = ownSets(brick)
    const id = sets.some(k => job.has(k)) ? 'same' : sets.some(k => !taken.has(k)) ? 'adds' : 'rest'
    tiles[id].push({ brick, inProject: project.brickIds.includes(brick.id) })
  }
  return (['same', 'adds', 'rest'] as const).filter(id => tiles[id].length > 0).map(id => ({ id, title: TITLES[id], tiles: tiles[id] }))
}

/** A tile's two lines: the first short label from the label table (null when it has none) and the short origin line ("Mia, 1923", "Dec 27, 2025", "saved Nov 3"). */
export const tileCaption = (brick: Brick, today: Date = new Date()): { label: string | null; line: string } =>
  ({ label: labelsOfBrick(brick, 1)[0]?.label ?? null, line: shortOriginLine(brick, today) })
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --disable-warning=DEP0205 --import tsx --test scripts/swapsheet.test.ts`
Expected: PASS, 0 failures.

- [ ] **Step 5: No commit.**

### Task 3: The sheet itself

**Files:**
- Modify: `src/make/Dialogs.tsx` (`SwapPicker`, COPY)
- Modify: `src/screens/Make.tsx` (pass `swapGroups(...)`; drop `spare`)

**Interfaces:**
- Consumes: `swapGroups`, `tileCaption`, `SwapGroup` (Task 2).
- Produces: `SwapPicker({ groups, onClose, onPick }: { groups: SwapGroup[]; onClose: () => void; onPick: (id: string) => void })`.

- [ ] **Step 1: Implement** — `src/make/Dialogs.tsx`: COPY gains `inProject: 'Already in this project'`; imports gain `import { tileCaption, type SwapGroup } from '../lib/swapSheet'`; `SwapPicker` becomes:

```tsx
/** Swap one photo of the project for another (2026-11-03): Same job, Adds something, Everything else, each in the proposal's ranking and then newest saved
 *  (src/lib/swapSheet.ts). The photo being replaced is not offered; a photo already in the project shows a check and cannot be chosen. One tap swaps and closes. */
export function SwapPicker({ groups, onClose, onPick }: { groups: SwapGroup[]; onClose: () => void; onPick: (id: string) => void }) {
  const choosable = groups.some(g => g.tiles.some(t => !t.inProject))
  return (
    <Overlay title={COPY.swap} onClose={onClose}>
      {!choosable && <p className="ink-2 m-0 mb-3 text-[13px]">{COPY.noSpare}</p>}
      <div className="flex flex-col gap-4">
        {groups.map(g => (
          <section key={g.id} aria-label={g.title}>
            <h3 className="caption ink-2 m-0 mb-2 font-normal uppercase tracking-wide">{g.title}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {g.tiles.map(({ brick, inProject }) => {
                const { label, line } = tileCaption(brick)
                const name = [label, line].filter(Boolean).join(', ')
                return (
                  <button key={brick.id} type="button" disabled={inProject} onClick={() => onPick(brick.id)}
                    className={`relative overflow-hidden rounded p-0 text-left ${inProject ? 'cursor-default' : 'cursor-pointer'}`} style={{ border: '1px solid var(--line)', background: 'var(--panel)' }}
                    aria-label={inProject ? `${name}: ${COPY.inProject}` : `Swap in: ${name}`} title={inProject ? COPY.inProject : undefined}>
                    <div className="overflow-hidden" style={{ aspectRatio: '16 / 10' }}><Photo src={brick.photo.url} className="h-full w-full object-cover" /></div>
                    <div className="flex flex-col px-2 py-1.5">
                      <span className="truncate text-[13px] font-medium leading-[18px]" style={{ color: 'var(--ink)' }}>{label ?? ' '}</span>
                      <span className="ink-2 text-[12px] leading-4">{line}</span>
                    </div>
                    {inProject && <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none" style={{ background: 'var(--ink)', color: '#fff' }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </Overlay>
  )
}
```

`src/screens/Make.tsx`: add `import { swapGroups } from '../lib/swapSheet'`; delete `const spare = project ? ready.filter(b => !project.brickIds.includes(b.id)) : []`; the dialog renders `<SwapPicker groups={swapGroups(project, ready, dialog.swap, store.bricks)} onClose={…} onPick={…unchanged…} />`.

- [ ] **Step 2: Type-check, lint and build**

Run: `npm run build && npm run lint`
Expected: build succeeds; lint exits 0 with no new warnings (9 before).

- [ ] **Step 3: No commit.**

### Task 4: Verify

- [ ] **Step 1:** `npm test` → 0 failures (583 before, plus the new tests).
- [ ] **Step 2:** `npm run check:prompts` → `DIFF` on the propose prompt and the propose schema only (the harness copies are refreshed outside this change); extract prompt and brick schema `ok`.
- [ ] **Step 3: Browser** (`build-dev`, port 5176): set `localStorage['tearsheet.dry'] = '1'`; stub `window.fetch` so `POST /api/propose` returns a canned ok body with `picks` and a `ranking`; type an intent and press Enter; confirm the new project's `proposal.ranking` in localStorage; open ⇄ on a photo: groups in order, headers uppercase muted, the replaced photo absent, project photos checked and disabled, captions as specified (no "Malik"); click a tile: the sheet closes and `.shell[data-flash]` appears on the screens. Confirm in the network log that no POST to `/api/propose` reached the server. Screenshot as proof.
