/** Spec v3 L11: what the queue does with each answer. 429 and "offline" keep the photo pending and stop the pump; anything else is an ordinary failure. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { afterResult } from '../src/lib/queue.ts'
import type { ExtractResult } from '../src/lib/extract.ts'

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
