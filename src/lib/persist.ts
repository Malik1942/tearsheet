/** What goes to localStorage and what goes to IndexedDB (spec v3 L11, "Nothing is ever dropped"). A 2048 px photo is about 930 KB as a data URL and
 *  localStorage holds about 5 MB, so the whole library cannot live there. The metadata stays in localStorage; an own photo (a `data:` URL) is
 *  swapped for the pointer `idb:<brick id>` and kept in IndexedDB. Pure, so it can be tested without a browser. */
import type { State } from './store'

export const IDB = 'idb:'

const isOwn = (url: string) => url.startsWith('data:')
const isPointer = (url: string) => url.startsWith(IDB)

/** The state as localStorage should hold it, and the photos IndexedDB should hold. Bricks without a data URL (samples, synced blob URLs, pointers) are unchanged. */
export function toPersisted(state: State): { json: State; photos: { id: string; dataUrl: string }[] } {
  const photos: { id: string; dataUrl: string }[] = []
  const bricks = state.bricks.map(b => {
    if (!isOwn(b.photo.url)) return b
    photos.push({ id: b.id, dataUrl: b.photo.url })
    return { ...b, photo: { ...b.photo, url: IDB + b.id } }
  })
  return { json: { ...state, bricks }, photos }
}

/** What the Library says on a brick whose photo is no longer on this device (spec v3 L11 keeps the brick; it just cannot be read again). */
export const PHOTO_GONE = 'The photo is not on this device any more.'

/** The keys to look up in IndexedDB after a load: every brick that still holds a pointer. */
export function needsHydration(state: State): string[] {
  return [...new Set(state.bricks.filter(b => isPointer(b.photo.url)).map(b => b.photo.url.slice(IDB.length)))]
}

/** What a look-up in IndexedDB came to. A photo that is absent after a read that worked is `gone`; when the read itself failed (rejected, or no answer in time) we know
 *  nothing about any of them: they are `unread`, and must not be treated as gone. */
export type Hydration = { photos: Map<string, string>; gone: string[]; unread: string[] }

export function hydrationOutcome(readOk: boolean, found: Map<string, string>, ids: string[]): Hydration {
  if (!readOk) return { photos: new Map(), gone: [], unread: [...ids] }
  const photos = new Map(ids.flatMap(id => (found.has(id) ? [[id, found.get(id)!] as const] : [])))
  return { photos, gone: ids.filter(id => !photos.has(id)), unread: [] }
}

/** Read the photos with `get` (IndexedDB), giving up after `timeoutMs` (a read that never answers must not hold the queue forever). A rejection, a throw and a timeout all count as
 *  a failed read. */
export async function readPhotos(get: (ids: string[]) => Promise<Map<string, string>>, ids: string[], timeoutMs = 5000): Promise<Hydration> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeoutMs) })
  try {
    const found = await Promise.race([Promise.resolve().then(() => get(ids)).catch(() => null), timeout])
    return hydrationOutcome(found !== null, found ?? new Map(), ids)
  } finally { clearTimeout(timer) }
}

const pointerId = (url: string) => (isPointer(url) ? url.slice(IDB.length) : null)

/** The ids of the bricks whose photo could not be read this time. */
export function unreadBrickIds(state: State, o: Hydration): string[] {
  const unread = new Set(o.unread)
  return state.bricks.filter(b => { const p = pointerId(b.photo.url); return p !== null && unread.has(p) }).map(b => b.id)
}

/** Apply a look-up to the state: the photos come back; a queued brick (pending or mid-flight from a closed tab) whose photo is gone becomes `unparsed` with the sentence; a brick whose photo
 *  could not be read stays `pending` (back to it if it was mid-flight), with no error, so the next open reads it again. Ready bricks are kept as they are either way. */
export function settleHydration(state: State, o: Hydration): State {
  const gone = new Set(o.gone), unread = new Set(o.unread)
  const s = hydrate(state, o.photos)
  if (!gone.size && !unread.size) return s
  return {
    ...s,
    bricks: s.bricks.map(b => {
      const p = pointerId(b.photo.url)
      if (p === null) return b
      const queued = b.status === 'pending' || b.status === 'extracting'
      if (gone.has(p) && queued) return { ...b, status: 'unparsed', held: undefined, error: PHOTO_GONE }
      if (unread.has(p) && b.status === 'extracting') return { ...b, status: 'pending', held: undefined, error: undefined }
      return b
    }),
  }
}

/** Put the photos back. A pointer whose photo is not in the map is left as it is. */
export function hydrate(state: State, photos: Map<string, string>): State {
  if (!photos.size) return state
  return {
    ...state,
    bricks: state.bricks.map(b => {
      if (!isPointer(b.photo.url)) return b
      const dataUrl = photos.get(b.photo.url.slice(IDB.length))
      return dataUrl === undefined ? b : { ...b, photo: { ...b.photo, url: dataUrl } }
    }),
  }
}

/** The two stores a save talks to, passed in so this stays testable: `put` is IndexedDB, `write` is localStorage, `stored` remembers what `put` has already taken. */
export type PersistIO = {
  put: (id: string, dataUrl: string) => Promise<void>
  write: (json: string) => void
  /** brick id -> length of the data URL already in IndexedDB; an unchanged photo is not written again. */
  stored: Map<string, number>
}

/** One save: own photos to IndexedDB first, then the metadata to localStorage. A photo IndexedDB refuses (no IndexedDB, quota) keeps its data URL in the JSON
 *  for this save, which is how it was saved before, so it is never lost and is tried again on the next save. If localStorage refuses too, nothing throws:
 *  the app goes on from memory (and the photos that did reach IndexedDB are safe). */
export async function persistState(state: State, io: PersistIO): Promise<void> {
  const { json, photos } = toPersisted(state)
  const refused = new Map<string, string>()
  await Promise.all(photos.map(async p => {
    if (io.stored.get(p.id) === p.dataUrl.length) return
    try { await io.put(p.id, p.dataUrl); io.stored.set(p.id, p.dataUrl.length) } catch { refused.set(p.id, p.dataUrl) }
  }))
  const out = refused.size ? { ...json, bricks: json.bricks.map(b => refused.has(b.id) ? { ...b, photo: { ...b.photo, url: refused.get(b.id)! } } : b) } : json
  try { io.write(JSON.stringify(out)) } catch { /* quota or private mode */ }
}
