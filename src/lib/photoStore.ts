/** A tiny IndexedDB wrapper for own photos (spec v3 L11): database `tearsheet`, version 1, object store `photos`, key = brick id, value = the data URL.
 *  No dependencies. Every function rejects when something fails, and the callers decide what that means: a failed put keeps the photo in
 *  localStorage as before, a failed get leaves the brick on its `idb:` pointer. */
const DB = 'tearsheet'
const STORE = 'photos'

let opened: { factory: unknown; db: Promise<IDBDatabase> } | null = null

function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('no indexedDB'))
  if (opened && opened.factory === indexedDB) return opened.db
  const db = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE) }
    req.onsuccess = () => {
      const handle = req.result
      // another tab upgrading the database, or the browser reclaiming it: let go and open afresh on the next call
      handle.onversionchange = () => { handle.close(); opened = null }
      resolve(handle)
    }
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
  })
  opened = { factory: indexedDB, db }
  db.catch(() => { if (opened?.db === db) opened = null })
  return db
}

/** One transaction; resolves when it has committed, not merely when the request was queued. */
async function transact(mode: IDBTransactionMode, work: (store: IDBObjectStore) => void): Promise<void> {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    work(tx.objectStore(STORE))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('indexedDB transaction aborted'))
  })
}

export function putPhoto(id: string, dataUrl: string): Promise<void> {
  return transact('readwrite', store => { store.put(dataUrl, id) })
}

/** The photos that exist, by id. An id with no photo is simply absent from the map. */
export async function getPhotos(ids: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>()
  await transact('readonly', store => {
    for (const id of ids) {
      const req = store.get(id)
      req.onsuccess = () => { if (typeof req.result === 'string') found.set(id, req.result) }
    }
  })
  return found
}

export function deletePhoto(id: string): Promise<void> {
  return transact('readwrite', store => { store.delete(id) })
}
