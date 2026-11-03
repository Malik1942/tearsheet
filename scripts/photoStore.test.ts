/** The IndexedDB wrapper, against a small in-memory stand-in for the browser's API (Node has none). It checks the glue: the store is created
 *  once, a put resolves only when its transaction commits, a get returns what it finds, and without IndexedDB every call rejects. Run: npm test */
import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deletePhoto, getPhotos, putPhoto } from '../src/lib/photoStore.ts'

type Req = { result?: unknown; error?: unknown; onsuccess?: () => void; onerror?: () => void; onupgradeneeded?: () => void }

/** Just enough of IDBFactory: databases by name, object stores by name, put/get/delete, transactions that complete on a later turn. */
function fakeIndexedDB(opts: { failPut?: boolean } = {}) {
  const dbs = new Map<string, Map<string, Map<string, unknown>>>()
  const log = { opens: 0, upgrades: 0 }
  const factory = {
    open(name: string, version: number) {
      assert.equal(version, 1)
      log.opens++
      const req: Req = {}
      setTimeout(() => {
        const fresh = !dbs.has(name)
        const stores = dbs.get(name) ?? new Map<string, Map<string, unknown>>()
        dbs.set(name, stores)
        req.result = {
          objectStoreNames: { contains: (n: string) => stores.has(n) },
          createObjectStore: (n: string) => { stores.set(n, new Map()); return {} },
          close() {},
          transaction(storeName: string, mode: string) {
            const store = stores.get(storeName)
            assert.ok(store, `store ${storeName} exists`)
            const tx: { oncomplete?: () => void; onerror?: () => void; onabort?: () => void; error?: unknown; objectStore: (n: string) => unknown } = {
              objectStore: () => ({
                put(value: unknown, key: string) { assert.equal(mode, 'readwrite'); if (!opts.failPut) store.set(key, value); return {} },
                delete(key: string) { assert.equal(mode, 'readwrite'); store.delete(key); return {} },
                get(key: string) { const r: Req = {}; setTimeout(() => { r.result = store.get(key); r.onsuccess?.() }, 0); return r },
              }),
            }
            setTimeout(() => { if (opts.failPut && mode === 'readwrite') { tx.error = new Error('QuotaExceededError'); tx.onabort?.() } else tx.oncomplete?.() }, 5)
            return tx
          },
        }
        if (fresh) { log.upgrades++; req.onupgradeneeded?.() }
        req.onsuccess?.()
      }, 0)
      return req
    },
  }
  return { factory, dbs, log }
}
const install = (f: unknown) => { (globalThis as { indexedDB?: unknown }).indexedDB = f }
afterEach(() => { delete (globalThis as { indexedDB?: unknown }).indexedDB })

describe('photoStore without IndexedDB', () => {
  it('rejects every call with "no indexedDB"', async () => {
    await assert.rejects(putPhoto('a', 'data:x'), /no indexedDB/)
    await assert.rejects(getPhotos(['a']), /no indexedDB/)
    await assert.rejects(deletePhoto('a'), /no indexedDB/)
  })
})

describe('photoStore', () => {
  it('puts, gets and deletes by brick id in the "photos" store of the "tearsheet" database', async () => {
    const { factory, dbs, log } = fakeIndexedDB()
    install(factory)
    await putPhoto('b_1', 'data:image/jpeg;base64,AAA')
    await putPhoto('b_2', 'data:image/jpeg;base64,BBB')
    assert.deepEqual([...dbs.get('tearsheet')!.get('photos')!.keys()], ['b_1', 'b_2'])
    const got = await getPhotos(['b_1', 'b_2', 'b_missing'])
    assert.deepEqual([...got], [['b_1', 'data:image/jpeg;base64,AAA'], ['b_2', 'data:image/jpeg;base64,BBB']])
    await deletePhoto('b_1')
    assert.deepEqual([...(await getPhotos(['b_1', 'b_2'])).keys()], ['b_2'])
    assert.equal(log.upgrades, 1, 'the store is created once')
  })
  it('answers an empty map for no ids', async () => {
    install(fakeIndexedDB().factory)
    assert.equal((await getPhotos([])).size, 0)
  })
  it('rejects a put whose transaction aborts (quota), so the caller keeps the data URL', async () => {
    install(fakeIndexedDB({ failPut: true }).factory)
    await assert.rejects(putPhoto('b_1', 'data:image/jpeg;base64,AAA'), /Quota/)
  })
})
