/** Spec v3 SB2, SB3 (thin library), SB4, L7: starter bricks are built in, labeled by origin, and fill a thin library after the person's own bricks.
 *  Pure parts only (the store and the screens read these). Run: npm test */
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { FILLS, STARTER_IDS, orderOwnFirst, originOf, ownBricks, proposalPool, starterBricks, withStarters, withoutStarters } from '../src/lib/starters.ts'
import { creditLine, originLabel } from '../src/lib/brickLabels.ts'
import { runSync } from '../src/lib/syncClient.ts'
import type { Brick } from '../src/lib/types.ts'

const today = new Date(2026, 10, 2)   // 2 Nov 2026, local time
const sample = (id: string) => SAMPLES.find(b => b.id === id)!

/** An own brick: ready by default, with `rules` rules. */
const own = (id: string, over: Partial<Brick> = {}, rules = 1): Brick => ({
  id, photo: { url: 'data:image/jpeg;base64,AAAA', width: 10, height: 10 }, saved_at: '2025-06-21', status: 'ready', version: 1,
  measurements: [], hypotheses: [], fragile_if_changed: '', regions: [],
  relations: Array.from({ length: rules }, (_, i) => ({ id: `r${i + 1}`, rule: `rule ${i + 1}`, parameter: 'density' })),
  model: { id: 'muse-spark-1.3', effort: 'medium', latency_ms: 1, input_tokens: 1, output_tokens: 1 },
  ...over,
} as unknown as Brick)

describe('the starters', () => {
  it('are the twelve shipped bricks, ready, prompt v3, origin starter, with plain /samples photos', () => {
    const s = starterBricks()
    assert.equal(s.length, 12)
    assert.equal(STARTER_IDS.size, 12)
    assert.deepEqual(s.map(b => b.id), SAMPLES.map(b => b.id))
    for (const b of s) {
      assert.equal(b.status, 'ready')
      assert.equal(b.prompt_version, 'v3')
      assert.equal(b.origin, 'starter')
      assert.match(b.photo.url, /^\/samples\/[\w.-]+\.jpg$/)
    }
  })
  it('are built from SAMPLES without changing it', () => {
    starterBricks()
    assert.equal((SAMPLES[0] as Brick).origin, undefined)
    assert.equal(SAMPLES[0].status, undefined)
  })
})

describe('originOf', () => {
  it('reads a shipped sample as a starter, by id', () => {
    for (const b of SAMPLES) assert.equal(originOf(b), 'starter')
  })
  it('reads any other brick as own', () => {
    assert.equal(originOf(own('b_x')), 'own')
    assert.equal(originOf(own('b_x.v2')), 'own')
    assert.equal(originOf(own('g1.v2')), 'own')   // a retry of a starter would be a new id: not a starter
  })
  it('lets an explicit origin win, either way', () => {
    assert.equal(originOf({ ...sample('g1'), origin: 'own' }), 'own')
    assert.equal(originOf(own('b_x', { origin: 'starter' })), 'starter')
  })
})

describe('creditLine and originLabel', () => {
  it('a starter with a credit reads "starter · <credit>"', () => {
    assert.equal(originLabel(sample('lissitzky-1923-dlya-golosa')), 'starter · Minneapolis Institute of Art, 1923')
    assert.equal(originLabel(sample('jpl-2016-visions-mars')), 'starter · Courtesy NASA/JPL-Caltech')
  })
  it('a starter without a credit is Malik\'s own work, with the year it was saved', () => {
    assert.equal(originLabel(sample('g2')), 'starter · Malik Zhang, 2025')
    assert.equal(creditLine(sample('g2')), 'Malik Zhang, 2025')
    assert.equal(creditLine(sample('haeckel-1904-trochilidae-plate-99')), 'Wikimedia Commons, 1904')
  })
  it('an own brick reads "saved <date>", as savedLabel does (today passes through)', () => {
    assert.equal(originLabel(own('b_x', { saved_at: '2025-06-21' }), today), 'saved Jun 21, 2025')
    assert.equal(originLabel(own('b_x', { saved_at: '2026-06-21' }), today), 'saved Jun 21')
  })
  it('follows the origin field when it is set', () => {
    assert.equal(originLabel({ ...sample('g1'), origin: 'own' }, today), 'saved Apr 6, 2025')
  })
})

describe('proposalPool', () => {
  const starters = starterBricks()
  it('with no own bricks is the twelve starters, each with the fill reason', () => {
    const pool = proposalPool([], true)
    assert.equal(pool.length, 12)
    assert.equal(FILLS, 'fills: fewer than three of your own')
    for (const p of pool) { assert.equal(p.fills, FILLS); assert.equal(originOf(p.brick), 'starter') }
  })
  it('does not care whether the list it is given already holds the starters', () => {
    assert.deepEqual(proposalPool(withStarters([]), true).map(p => p.brick.id), proposalPool([], true).map(p => p.brick.id))
  })
  it('with two own bricks is those two first, then the twelve: fourteen', () => {
    const pool = proposalPool([own('b_1'), own('b_2')], true)
    assert.equal(pool.length, 14)
    assert.deepEqual(pool.slice(0, 2).map(p => p.brick.id), ['b_1', 'b_2'])
    assert.ok(pool.slice(0, 2).every(p => p.fills === undefined))
    assert.ok(pool.slice(2).every(p => p.fills === FILLS))
  })
  it('with three own bricks is those three and no starter', () => {
    const pool = proposalPool([own('b_1'), own('b_2'), own('b_3'), ...starters], true)
    assert.deepEqual(pool.map(p => p.brick.id), ['b_1', 'b_2', 'b_3'])
    assert.ok(pool.every(p => p.fills === undefined))
  })
  it('with starters hidden is the own bricks only, thin or not', () => {
    assert.equal(proposalPool([], false).length, 0)
    assert.deepEqual(proposalPool([own('b_1')], false).map(p => p.brick.id), ['b_1'])
    assert.equal(proposalPool([own('b_1'), ...starters], false).length, 1)
  })
  it('does not count an unready own brick, a superseded one or one without a rule toward the three', () => {
    const three = [own('b_1'), own('b_2'), own('b_3', { status: 'pending' }), own('b_4', { status: 'unparsed' }), own('b_5', { status: 'extracting' }), own('b_6', { superseded_by: 'b_6.v2' }), own('b_7', {}, 0)]
    const pool = proposalPool(three, true)
    assert.equal(pool.filter(p => p.fills).length, 12, 'only two count: the starters fill')
    // the pool itself holds the ready own bricks (the manual grid shows one with no rule to quote) and never a pending or superseded one
    assert.deepEqual(pool.filter(p => !p.fills).map(p => p.brick.id), ['b_1', 'b_2', 'b_7'])
  })
  it('counts a brick with no status as ready (older saves)', () => {
    const noStatus = (id: string) => { const b = own(id); delete b.status; return b }
    assert.equal(proposalPool([noStatus('b_1'), noStatus('b_2'), noStatus('b_3')], true).length, 3)
  })
  it('drops a starter the person shadowed with an own brick of the same id', () => {
    const pool = proposalPool([{ ...sample('g1'), origin: 'own' } as Brick], true)
    assert.equal(pool.filter(p => p.brick.id === 'g1').length, 1)
    assert.equal(pool.find(p => p.brick.id === 'g1')!.fills, undefined)
    assert.equal(pool.length, 12)
  })
})

describe('orderOwnFirst', () => {
  const pick = (brickId: string) => ({ brickId, quotedRule: `rule of ${brickId}`, why: '' })
  it('puts own bricks before starters and keeps the model\'s order inside each group', () => {
    const bricks = [own('b_a'), own('b_b'), ...starterBricks()]
    const out = orderOwnFirst([pick('g1'), pick('b_b'), pick('lissitzky-1923-dlya-golosa'), pick('b_a')], bricks)
    assert.deepEqual(out.map(p => p.brickId), ['b_b', 'b_a', 'g1', 'lissitzky-1923-dlya-golosa'])
  })
  it('keeps the picks themselves, untouched, and does not reorder a list that is already in order', () => {
    const picks = [pick('b_a'), pick('b_b'), pick('g1')]
    const out = orderOwnFirst(picks, [own('b_a'), own('b_b')])
    assert.deepEqual(out, picks)
    assert.equal(out[0], picks[0])
  })
  it('reads a brick the list does not hold by its id', () => {
    assert.deepEqual(orderOwnFirst([pick('g2'), pick('b_zzz')], []).map(p => p.brickId), ['b_zzz', 'g2'])
  })
})

describe('withStarters (what the store exposes as bricks)', () => {
  it('is the own bricks, then every starter', () => {
    const out = withStarters([own('b_1'), own('b_2')])
    assert.deepEqual(out.slice(0, 2).map(b => b.id), ['b_1', 'b_2'])
    assert.equal(out.length, 14)
  })
  it('has exactly one entry for a starter the saved state also holds, and it is the built-in starter', () => {
    const oldCopy = { ...sample('g1'), status: 'ready', prompt_version: 'v3' } as Brick   // what `Load sample library` saved
    const out = withStarters([own('b_1'), oldCopy])
    assert.equal(out.filter(b => b.id === 'g1').length, 1)
    assert.equal(originOf(out.find(b => b.id === 'g1')!), 'starter')
    assert.equal(out.find(b => b.id === 'g1')!.origin, 'starter')
    assert.equal(out.length, 13)
  })
  it('keeps an own brick that carries a starter\'s id by an explicit origin, and drops the starter behind it', () => {
    const mine = { ...sample('g1'), origin: 'own' } as Brick
    const out = withStarters([mine])
    assert.equal(out.filter(b => b.id === 'g1').length, 1)
    assert.equal(out.find(b => b.id === 'g1'), mine)
  })
  it('does not change the list it is given', () => {
    const state = [own('b_1')]
    withStarters(state)
    assert.equal(state.length, 1)
  })
})

describe('withoutStarters (what is kept in the saved state)', () => {
  it('drops the copies of starters an older save holds and keeps every other brick, in order', () => {
    const state = { bricks: [own('b_1'), { ...sample('g1'), status: 'ready' } as Brick, own('b_2'), sample('c1')], projects: [], activeProjectId: 'p_1', showStarters: false }
    const out = withoutStarters(state)
    assert.deepEqual(out.bricks.map(b => b.id), ['b_1', 'b_2'])
    assert.equal(out.activeProjectId, 'p_1')
    assert.equal(out.showStarters, false)
  })
  it('returns the same object when there is nothing to drop', () => {
    const state = { bricks: [own('b_1')] }
    assert.equal(withoutStarters(state), state)
  })
  it('keeps an own brick that carries a starter id by an explicit origin', () => {
    const mine = { ...sample('g1'), origin: 'own' } as Brick
    assert.deepEqual(withoutStarters({ bricks: [mine] }).bricks, [mine])
  })
})

describe('ownBricks', () => {
  it('keeps what a person added or synced and drops the starters (what Sync merges in and uploads)', () => {
    const list = [sample('g1'), own('b_1'), sample('c1'), own('b_2.v2')]
    assert.deepEqual(ownBricks(list).map(b => b.id), ['b_1', 'b_2.v2'])
  })
})

describe('Sync sends own bricks only', () => {
  const realFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = realFetch })
  it('a store that holds the starters uploads none of them', async () => {
    const posts: { bricks: Brick[] }[] = []
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      if (init?.method === 'POST') posts.push(JSON.parse(String(init.body)))
      return new Response(JSON.stringify({ code: 'ABCDEF', updated_at: '', bricks: [], projects: [], bytes: 0 }), { status: 200 })
    }) as typeof fetch
    const store = { bricks: withStarters([own('b_1'), own('b_2')]), projects: [], mergeBricks: () => 0, mergeProjects: () => 0 }
    await runSync('ABCDEF', store)
    assert.deepEqual(posts.flatMap(p => p.bricks.map(b => b.id)).sort(), ['b_1', 'b_2'])
  })
})
