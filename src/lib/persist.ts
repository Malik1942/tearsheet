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

/** The keys to look up in IndexedDB after a load: every brick that still holds a pointer. */
export function needsHydration(state: State): string[] {
  return [...new Set(state.bricks.filter(b => isPointer(b.photo.url)).map(b => b.photo.url.slice(IDB.length)))]
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
