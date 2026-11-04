/** Swap sheet §1: the propose call also ranks the whole library (no new model call). Expected values are typed out from the spec
 *  (docs/superpowers/specs/2026-11-03-swap-sheet-design.md), never read from the code under test. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { PROPOSE_PROMPT } from '../src/lib/proposePrompt.ts'
import { PROPOSE_SCHEMA, buildProposeRequest, handlePropose, validateRanking, type LibraryBrick } from '../src/lib/propose.ts'
import { libraryFor, propose as proposeFromApp } from '../src/lib/proposeClient.ts'

const INTENT = 'A concert log for someone who goes to a lot of shows'
const LIB = libraryFor(SAMPLES)
// capped at ten (2026-11-03 evening): ranking the whole library took 3,129 of 4,000 output tokens with twelve bricks
const SENTENCE = 'Also return ranking: up to ten brick_ids from the library, best fit first for what they are making, each once, by the same preferences as your picks.'
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
  it('requires a ranking of at most ten strings next to the picks', () => {
    assert.deepEqual(PROPOSE_SCHEMA.required, ['picks', 'ranking'])
    assert.deepEqual(PROPOSE_SCHEMA.properties.ranking, { type: 'array', maxItems: 10, items: { type: 'string' } })
  })
  it('leaves the reasoning room to finish: 8,000 output tokens', () => {
    assert.equal(buildProposeRequest('a concert log', LIB).max_output_tokens, 8000)
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
  it('keeps at most ten, the first ten valid ones', () => {
    const many: LibraryBrick[] = Array.from({ length: 12 }, (_, i) => ({ brick_id: `b${i}`, rules: [{ rule: `rule ${i}`, parameter: 'none' }] }))
    assert.deepEqual(validateRanking(['nope', ...many.map(b => b.brick_id)], many), many.slice(0, 10).map(b => b.brick_id))
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
