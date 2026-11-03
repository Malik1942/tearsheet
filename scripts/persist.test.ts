/** Spec v3 L11, "Nothing is ever dropped": own photos live in IndexedDB, localStorage keeps only the metadata and an `idb:<id>` pointer.
 *  These are the pure halves (what is stripped, what is looked up, what is put back); the wrapper has its own test. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { IDB, hydrate, needsHydration, persistState, toPersisted } from '../src/lib/persist.ts'
import type { State } from '../src/lib/store.tsx'
import type { Brick } from '../src/lib/types.ts'

const brick = (id: string, url: string): Brick => ({
  id, photo: { url, width: 2048, height: 1365 }, saved_at: '2026-11-02', status: 'ready',
  measurements: [], hypotheses: [], relations: [], fragile_if_changed: '', regions: [],
  model: { id: 'muse-spark-1.3', effort: 'medium', latency_ms: 1, input_tokens: 1, output_tokens: 1 },
})
const jpeg = (n: number) => `data:image/jpeg;base64,${'A'.repeat(n)}`
const BLOB = 'https://x.public.blob.vercel-storage.com/libraries/ABC234/b_synced.jpg'

const state = (): State => ({
  bricks: [brick('b_own', jpeg(900_000)), brick('g1', '/samples/g1.jpg'), brick('b_synced', BLOB)],
  projects: [], activeProjectId: null,
})

describe('toPersisted', () => {
  it('strips only the data URL and lists exactly that one photo', () => {
    const s = state()
    const { json, photos } = toPersisted(s)
    assert.deepEqual(photos, [{ id: 'b_own', dataUrl: s.bricks[0].photo.url }])
    assert.equal(json.bricks[0].photo.url, `${IDB}b_own`)
    assert.equal(json.bricks[1].photo.url, '/samples/g1.jpg')
    assert.equal(json.bricks[2].photo.url, BLOB)
    assert.deepEqual(json.bricks[0].photo, { url: 'idb:b_own', width: 2048, height: 1365 })
  })
  it('does not touch the state it was given', () => {
    const s = state(), before = JSON.stringify(s)
    toPersisted(s)
    assert.equal(JSON.stringify(s), before)
  })
  it('leaves what is not a brick photo alone, and the JSON is small', () => {
    const s = { ...state(), activeProjectId: 'p_1' }
    const { json } = toPersisted(s)
    assert.equal(json.activeProjectId, 'p_1')
    assert.deepEqual(json.projects, [])
    assert.ok(JSON.stringify(json).length < 5_000, 'metadata only')
    assert.ok(!JSON.stringify(json).includes('data:'), 'no data URL left')
  })
  it('moves a legacy library (data URLs in localStorage) on the next save: every data URL listed, none left in the JSON', () => {
    const legacy = JSON.parse(JSON.stringify({ ...state(), bricks: [brick('b_1', jpeg(700_000)), brick('b_2', jpeg(800_000)), brick('b_3', jpeg(600_000)), brick('g1', '/samples/g1.jpg')] })) as State
    const { json, photos } = toPersisted(legacy)
    assert.deepEqual(photos.map(p => p.id), ['b_1', 'b_2', 'b_3'])
    assert.deepEqual(json.bricks.map(b => b.photo.url), ['idb:b_1', 'idb:b_2', 'idb:b_3', '/samples/g1.jpg'])
  })
  it('is stable: saving what was already saved lists no photo and changes nothing', () => {
    const { json } = toPersisted(state())
    const again = toPersisted(json)
    assert.deepEqual(again.photos, [])
    assert.deepEqual(again.json, json)
  })
})

describe('needsHydration', () => {
  it('lists exactly the stripped id', () => {
    const { json } = toPersisted(state())
    assert.deepEqual(needsHydration(json), ['b_own'])
  })
  it('lists nothing for a state that holds its photos', () => {
    assert.deepEqual(needsHydration(state()), [])
  })
})

describe('hydrate', () => {
  it('round-trips to the original state', () => {
    const s = state()
    const { json, photos } = toPersisted(s)
    assert.deepEqual(hydrate(json, new Map(photos.map(p => [p.id, p.dataUrl]))), s)
  })
  it('leaves idb:<id> in place when the photo is not in the map', () => {
    const { json } = toPersisted(state())
    const out = hydrate(json, new Map())
    assert.equal(out.bricks[0].photo.url, 'idb:b_own')
    assert.deepEqual(needsHydration(out), ['b_own'])
  })
  it('puts back the photos it has and leaves the rest', () => {
    const s: State = { ...state(), bricks: [brick('b_1', jpeg(10)), brick('b_2', jpeg(20))] }
    const { json } = toPersisted(s)
    const out = hydrate(json, new Map([['b_2', jpeg(20)]]))
    assert.deepEqual(out.bricks.map(b => b.photo.url), ['idb:b_1', jpeg(20)])
  })
  it('does not touch the state it was given', () => {
    const { json, photos } = toPersisted(state()), before = JSON.stringify(json)
    hydrate(json, new Map(photos.map(p => [p.id, p.dataUrl])))
    assert.equal(JSON.stringify(json), before)
  })
})

describe('persistState', () => {
  /** Records the order of puts and writes, so "photos first, then the metadata" is checked, not assumed. */
  const rig = (opts: { failPut?: (id: string) => boolean; failWrite?: boolean } = {}) => {
    const calls: string[] = [], written: string[] = [], stored = new Map<string, number>()
    const io = {
      stored,
      put: async (id: string) => { await Promise.resolve(); if (opts.failPut?.(id)) throw new Error('QuotaExceededError'); calls.push(`put ${id}`) },
      write: (json: string) => { if (opts.failWrite) throw new Error('QuotaExceededError'); calls.push('write'); written.push(json) },
    }
    return { io, calls, written, stored }
  }
  const own = (): State => ({ ...state(), bricks: [brick('b_1', jpeg(700_000)), brick('b_2', jpeg(800_000)), brick('g1', '/samples/g1.jpg')] })

  it('puts every own photo, then writes the metadata with pointers only', async () => {
    const { io, calls, written } = rig()
    await persistState(own(), io)
    assert.deepEqual(calls, ['put b_1', 'put b_2', 'write'])
    assert.ok(written[0].length < 5_000, 'localStorage gets metadata only')
    assert.deepEqual((JSON.parse(written[0]) as State).bricks.map(b => b.photo.url), ['idb:b_1', 'idb:b_2', '/samples/g1.jpg'])
  })
  it('writes a photo once: a second save with the same photos puts nothing', async () => {
    const { io, calls } = rig()
    await persistState(own(), io)
    await persistState(own(), io)
    assert.deepEqual(calls, ['put b_1', 'put b_2', 'write', 'write'])
  })
  it('writes a photo again when it is a different photo under the same id', async () => {
    const { io, calls } = rig()
    await persistState(own(), io)
    await persistState({ ...own(), bricks: [brick('b_1', jpeg(710_000))] }, io)
    assert.deepEqual(calls, ['put b_1', 'put b_2', 'write', 'put b_1', 'write'])
  })
  it('keeps the data URL in the JSON for a photo IndexedDB refused, and tries that photo again on the next save', async () => {
    let refuse = true
    const { io, written, stored } = rig({ failPut: id => refuse && id === 'b_2' })
    await persistState(own(), io)
    const saved = (JSON.parse(written[0]) as State).bricks
    assert.equal(saved[0].photo.url, 'idb:b_1')
    assert.equal(saved[1].photo.url, own().bricks[1].photo.url, 'never lost')
    assert.deepEqual([...stored.keys()], ['b_1'])
    refuse = false
    await persistState(own(), io)
    assert.equal((JSON.parse(written[1]) as State).bricks[1].photo.url, 'idb:b_2')
  })
  it('without IndexedDB at all it saves what it saved before: every data URL in the JSON', async () => {
    const { io, written } = rig({ failPut: () => true })
    await persistState(own(), io)
    assert.deepEqual((JSON.parse(written[0]) as State).bricks.map(b => b.photo.url), own().bricks.map(b => b.photo.url))
  })
  it('does not throw when localStorage refuses; the photos are already safe in IndexedDB', async () => {
    const { io, calls } = rig({ failWrite: true })
    await persistState(own(), io)
    assert.deepEqual(calls, ['put b_1', 'put b_2'])
  })
  it('leaves a pointer that is not yet hydrated as it is', async () => {
    const { io, calls, written } = rig()
    const pending = toPersisted(own()).json
    await persistState(pending, io)
    assert.deepEqual(calls, ['write'])
    assert.deepEqual((JSON.parse(written[0]) as State).bricks.map(b => b.photo.url), ['idb:b_1', 'idb:b_2', '/samples/g1.jpg'])
  })
})
