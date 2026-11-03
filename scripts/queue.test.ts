/** Spec v3 L11: what the queue does with each answer. 429 and "offline" keep the photo pending and stop the pump; anything else is an ordinary failure. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_OFFLINE_RETRIES, OFFLINE_RETRY_MS, afterResult, reinsertFirst, retryBlocked, shouldArmRetry } from '../src/lib/queue.ts'
import type { ExtractResult } from '../src/lib/extract.ts'
import type { Brick } from '../src/lib/types.ts'

const fail = (more: Partial<Extract<ExtractResult, { ok: false }>>): ExtractResult => ({ ok: false, error: 'x', latency_ms: 0, ...more })

describe('afterResult', () => {
  it('an HTTP 429 puts the photo back to pending, held for the limit, and stops the pump', () => {
    assert.deepEqual(afterResult(fail({ http: 429, error: '20 model calls an hour from one address; try again later.' })), { status: 'pending', held: 'limit', error: undefined, stop: true })
  })
  it('limited: true means the same, whatever the status', () => {
    assert.deepEqual(afterResult(fail({ http: 200, limited: true })), { status: 'pending', held: 'limit', error: undefined, stop: true })
    assert.deepEqual(afterResult(fail({ limited: true })), { status: 'pending', held: 'limit', error: undefined, stop: true })
  })
  it('offline puts the photo back to pending, held for the network, and stops the pump', () => {
    assert.deepEqual(afterResult(fail({ offline: true, error: 'offline' })), { status: 'pending', held: 'offline', error: undefined, stop: true })
  })
  it('a 500 is unparsed with its error and the pump goes on', () => {
    assert.deepEqual(afterResult(fail({ http: 500, error: 'HTTP 500: boom' })), { status: 'unparsed', held: undefined, error: 'HTTP 500: boom', stop: false })
  })
  it('an unparsed answer is unparsed with its error and the pump goes on', () => {
    assert.deepEqual(afterResult(fail({ error: 'unparsed (completed): bad json', status: 'completed', raw_text: '{' })), { status: 'unparsed', held: undefined, error: 'unparsed (completed): bad json', stop: false })
  })
  it('other 4xx answers are ordinary failures, not limits', () => {
    for (const http of [400, 401, 413, 502, 504]) assert.equal(afterResult(fail({ http })).status, 'unparsed', String(http))
  })
  it('ok is ready, nothing held, no stop', () => {
    const ok: ExtractResult = { ok: true, extraction: {} as never, status: 'completed', latency_ms: 1, usage: { input_tokens: 1, output_tokens: 1, reasoning_tokens: 0 }, retried: false }
    assert.deepEqual(afterResult(ok), { status: 'ready', held: undefined, error: undefined, stop: false })
  })
})

describe('shouldArmRetry: a thrown fetch while the browser says it is online must not stall the queue', () => {
  it('arms the timer for an offline answer when navigator.onLine is true, and when it is unknown', () => {
    assert.equal(shouldArmRetry('offline', true, 0), true)
    assert.equal(shouldArmRetry('offline', undefined, 0), true)
  })
  it('does not arm it when the browser itself says it is offline: the online event does that', () => {
    assert.equal(shouldArmRetry('offline', false, 0), false)
  })
  it('is for offline holds only: the daily limit waits for the next open', () => {
    assert.equal(shouldArmRetry('limit', true, 0), false)
    assert.equal(shouldArmRetry(undefined, true, 0), false)
  })
  it(`allows ${MAX_OFFLINE_RETRIES} automatic retries per session, no more (a fetch killed mid-flight may already have reached the model)`, () => {
    assert.equal(MAX_OFFLINE_RETRIES, 3)
    for (const n of [0, 1, 2]) assert.equal(shouldArmRetry('offline', true, n), true, String(n))
    for (const n of [3, 4, 10]) assert.equal(shouldArmRetry('offline', true, n), false, String(n))
  })
  it('waits 15 seconds', () => assert.equal(OFFLINE_RETRY_MS, 15_000))
})

describe('reinsertFirst: bricks that failed offline go back to the front in their original order', () => {
  const started = (...ids: string[]) => new Map(ids.map((id, i) => [id, i + 1]))
  it('A started first and failed first: A, B, then what never started', () => {
    const q = reinsertFirst(reinsertFirst(['C', 'D'], 'A', started('A', 'B')), 'B', started('A', 'B'))
    assert.deepEqual(q, ['A', 'B', 'C', 'D'])
  })
  it('B fails before A: still A, B (the order they were sent in, not the order they failed in)', () => {
    const q = reinsertFirst(reinsertFirst(['C', 'D'], 'B', started('A', 'B')), 'A', started('A', 'B'))
    assert.deepEqual(q, ['A', 'B', 'C', 'D'])
  })
  it('goes ahead of bricks that never started, and into an empty queue', () => {
    assert.deepEqual(reinsertFirst(['X'], 'A', started('A')), ['A', 'X'])
    assert.deepEqual(reinsertFirst([], 'A', started('A')), ['A'])
  })
  it('a brick already waiting is not added twice, and the input is not changed', () => {
    const q = ['A', 'C']
    assert.deepEqual(reinsertFirst(q, 'A', started('A')), ['A', 'C'])
    reinsertFirst(q, 'B', started('A', 'B'))
    assert.deepEqual(q, ['A', 'C'])
  })
  it('a brick sent again later (a higher number) lands after one re-inserted earlier', () => {
    assert.deepEqual(reinsertFirst(['A', 'C'], 'B', new Map([['A', 1], ['B', 5]])), ['A', 'B', 'C'])
  })
})

describe('retryBlocked: no wasted retry on a gone photo', () => {
  const b = (url: string, retries = 0) => ({ photo: { url, width: 1, height: 1 }, retries }) as Brick
  it('a pointer that was never found (idb:<id>) blocks the retry for "gone"', () => assert.equal(retryBlocked(b('idb:b_1')), 'gone'))
  it('one counted retry only', () => assert.equal(retryBlocked(b('data:image/jpeg;base64,AA', 1)), 'used'))
  it('gone wins over used: the photo is the reason the button is off', () => assert.equal(retryBlocked(b('idb:b_1', 1)), 'gone'))
  it('a brick with its photo and no retry yet may retry', () => {
    assert.equal(retryBlocked(b('data:image/jpeg;base64,AA')), null)
    assert.equal(retryBlocked(b('https://x.public.blob.vercel-storage.com/a.jpg')), null)
    assert.equal(retryBlocked({ photo: { url: '/samples/g1.jpg', width: 1, height: 1 } } as Brick), null)
  })
})
