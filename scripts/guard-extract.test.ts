/** Spec v3 L11 + section 6: /api/extract is guarded like /api/propose. A refusal never reaches the model, and dry runs are never counted.
 *  The guard's counters live in module memory, so each test uses its own address and the daily-cap test runs last. Run: npm test */
import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { handleExtract } from '../src/lib/extract.ts'
import { reserveCall } from '../src/lib/guard.ts'

const TINY = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
const realFetch = globalThis.fetch
let fetchCalls = 0
const stubFetch = (reply?: () => Response) => {
  fetchCalls = 0
  globalThis.fetch = (async () => {
    fetchCalls++
    if (!reply) throw new Error('fetch must not be called')
    return reply()
  }) as typeof fetch
}
afterEach(() => { globalThis.fetch = realFetch })

const exhaust = (ip: string) => { for (let i = 0; i < 20; i++) assert.equal(reserveCall(ip), null, `call ${i + 1} of 20 is allowed`) }

describe('handleExtract guard', () => {
  it('answers 429 with limited: true once the address has used its 20 an hour, and never reaches the network', async () => {
    exhaust('203.0.113.1')
    stubFetch()
    const out = await handleExtract({ image: TINY, dry: false }, 'fake-key', { ip: '203.0.113.1' })
    assert.equal(out.code, 429)
    assert.equal(out.body.limited, true)
    assert.equal(typeof out.body.error, 'string')
    assert.equal(fetchCalls, 0)
  })

  it('lets another address through to the model', async () => {
    exhaust('203.0.113.2')
    stubFetch(() => new Response(JSON.stringify({ error: 'boom' }), { status: 500 }))
    const out = await handleExtract({ image: TINY, dry: false }, 'fake-key', { ip: '203.0.113.3' })
    assert.equal(out.code, 200)
    assert.equal(out.body.ok, false)
    assert.equal(out.body.http, 500)
    assert.equal(fetchCalls, 1)
  })

  it('counts a live call against the address: the 21st from one address is refused', async () => {
    stubFetch(() => new Response('{}', { status: 500 }))
    for (let i = 0; i < 20; i++) assert.equal((await handleExtract({ image: TINY }, 'fake-key', { ip: '203.0.113.4' })).code, 200, `call ${i + 1}`)
    assert.equal(fetchCalls, 20)
    const out = await handleExtract({ image: TINY }, 'fake-key', { ip: '203.0.113.4' })
    assert.equal(out.code, 429)
    assert.equal(fetchCalls, 20)
  })

  it('never limits or counts a dry run', async () => {
    exhaust('203.0.113.5')
    stubFetch()
    const out = await handleExtract({ image: TINY, dry: true }, 'fake-key', { ip: '203.0.113.5' })
    assert.equal(out.code, 200)
    assert.equal(out.body.dry, true)
    // twenty-five dry runs from a fresh address leave its 20 live calls untouched
    for (let i = 0; i < 25; i++) assert.equal((await handleExtract({ image: TINY, dry: true }, undefined, { ip: '203.0.113.6' })).body.dry, true)
    stubFetch(() => new Response('{}', { status: 500 }))
    assert.equal((await handleExtract({ image: TINY }, 'fake-key', { ip: '203.0.113.6' })).code, 200)
  })

  it('checks the image and the key before it reserves a call', async () => {
    exhaust('203.0.113.7')
    stubFetch()
    assert.equal((await handleExtract({ image: 'nope' }, 'fake-key', { ip: '203.0.113.7' })).code, 400)
    assert.equal((await handleExtract({ image: TINY }, undefined, { ip: '203.0.113.8' })).code, 500)
    // the missing key used no reservation for .8
    exhaust('203.0.113.8')
  })

  it('treats a missing address as "unknown" and still guards it', async () => {
    exhaust('unknown')
    stubFetch()
    const out = await handleExtract({ image: TINY }, 'fake-key')
    assert.equal(out.code, 429)
    assert.equal(out.body.limited, true)
    assert.equal(fetchCalls, 0)
  })

  it('answers 429 with limited: true when MAX_DAILY_CALLS is spent, whatever the address', async () => {
    const before = process.env.MAX_DAILY_CALLS
    process.env.MAX_DAILY_CALLS = '1'   // earlier tests already spent more than one today
    try {
      stubFetch()
      const out = await handleExtract({ image: TINY }, 'fake-key', { ip: '203.0.113.99' })
      assert.equal(out.code, 429)
      assert.equal(out.body.limited, true)
      assert.match(out.body.error, /model calls for today/)
      assert.equal(fetchCalls, 0)
    } finally {
      if (before === undefined) delete process.env.MAX_DAILY_CALLS; else process.env.MAX_DAILY_CALLS = before
    }
  })
})
