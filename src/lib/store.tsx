import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SAMPLES } from '../fixtures/samples'
import type { Brick } from './types'
import type { Project } from './mapRelations'
import { extractBrick } from './client'
import { afterResult, type Held } from './queue'
import { IDB, hydrate, needsHydration, persistState } from './persist'
import { deletePhoto, getPhotos, putPhoto } from './photoStore'

/** Versioned key (PRD L9). The library starts empty; `Load sample library` seeds it. Older keys are ignored. */
const KEY = 'tearsheet.v2'
export const LIBRARY_CAP = 60
/** Extraction queue (PRD L5): at most this many requests in flight, first in first out. */
export const MAX_IN_FLIGHT = 2

export type State = { bricks: Brick[]; projects: Project[]; activeProjectId: string | null }
const EMPTY: State = { bricks: [], projects: [], activeProjectId: null }

/** What the Library says on a brick whose photo is no longer on this device (spec v3 L11 keeps the brick; it just cannot be read again). */
const PHOTO_GONE = 'The photo is not on this device any more.'

/** localStorage holds the metadata and, for own photos, an `idb:<id>` pointer; older saves still hold the data URLs, which the next save moves. */
const initial = (): State => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as State
  } catch { /* storage unavailable: run in memory */ }
  return EMPTY
}

export type Actions = {
  addBrick: (b: Brick) => boolean
  updateBrick: (id: string, patch: Partial<Brick>) => void
  removeBrick: (id: string) => void
  /** Queue a brick whose photo is in place; the queue sends it when a slot is free. */
  enqueue: (id: string) => void
  /** B4: a retry creates a new version that supersedes the old brick; the old values stay. */
  retry: (id: string) => void
  loadSamples: () => void
  /** S3: merge bricks from the sync store by id; newest version wins. Returns how many were new or changed. */
  mergeBricks: (incoming: Brick[]) => number
  /** Replace bricks wholesale (used before a code is forgotten, to inline photos that lived on the store). */
  replaceBricks: (bricks: Brick[]) => void
  createProject: (intent: string, brickIds?: string[], name?: string, extra?: Partial<Project>) => string
  /** Sync: projects ride along with the bricks; merge by id, the newest `updatedAt` wins. Returns how many were new or changed. */
  mergeProjects: (incoming: Project[]) => number
  updateProject: (id: string, patch: Partial<Project> | ((p: Project) => Partial<Project>)) => void
  setActive: (id: string | null) => void
  reset: () => void
  queue: { waiting: number; inFlight: number }
}

/** `online` follows the browser's online and offline events; the Library reads it for the top-bar line (spec v3 L11). */
const Ctx = createContext<(State & Actions & { online: boolean }) | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial)
  const stateRef = useRef(state); stateRef.current = state
  const inFlight = useRef(new Set<string>())
  const waiting = useRef<string[]>([])
  const [queueTick, setQueueTick] = useState(0)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false)
  /** L11: set when the server refused (daily or hourly limit): nothing more is sent this session; the next open sends again. */
  const limitHit = useRef(false)
  /** L11: set when a send got no answer; cleared by the browser's `online` event. The browser's own `navigator.onLine` is checked as well. */
  const offlineHold = useRef(false)
  /** Own photos already in IndexedDB: brick id -> data URL length, so an unchanged photo is not written again on every change. */
  const stored = useRef(new Map<string, number>())
  const saving = useRef({ running: false, again: false })
  /** L11: false until the photos are back from IndexedDB; the queue sends `brick.photo.url`, so nothing is sent before then. */
  const hydrated = useRef(false)

  /** L11 save (see persistState): photos to IndexedDB, then the metadata to localStorage. Saves never overlap, and each one takes the latest state. */
  const save = async () => {
    if (saving.current.running) { saving.current.again = true; return }
    saving.current.running = true
    try {
      do {
        saving.current.again = false
        await persistState(stateRef.current, { put: putPhoto, write: json => localStorage.setItem(KEY, json), stored: stored.current })
      } while (saving.current.again)
    } finally { saving.current.running = false }
  }
  useEffect(() => { void save() }, [state])

  const update = (id: string, patch: Partial<Brick>) => setState(s => ({ ...s, bricks: s.bricks.map(b => b.id === id ? { ...b, ...patch } : b) }))

  /** L11: bricks still waiting stay `pending` and record why, so a refused or offline photo is never dropped or marked failed. */
  const holdWaiting = (held: Held) => {
    const ids = new Set(waiting.current)
    if (!stateRef.current.bricks.some(b => ids.has(b.id) && b.held !== held)) return
    setState(s => ({ ...s, bricks: s.bricks.map(b => ids.has(b.id) && b.held !== held ? { ...b, status: 'pending', held } : b) }))
  }

  const pump = () => {
    if (!hydrated.current) return   // the mount effect pumps once the photos are in
    if (limitHit.current) holdWaiting('limit')
    else if (offlineHold.current || (typeof navigator !== 'undefined' && navigator.onLine === false)) holdWaiting('offline')
    else while (inFlight.current.size < MAX_IN_FLIGHT && waiting.current.length) {
      const id = waiting.current.shift()!
      const brick = stateRef.current.bricks.find(b => b.id === id)
      if (!brick) continue
      // a pointer whose photo was not in IndexedDB cannot be read again; say so instead of reading forever
      if (brick.photo.url.startsWith(IDB)) { update(id, { status: 'unparsed', held: undefined, error: PHOTO_GONE }); continue }
      inFlight.current.add(id)
      update(id, { status: 'extracting', held: undefined, error: undefined })
      const dry = import.meta.env.DEV && localStorage.getItem('tearsheet.dry') === '1'
      extractBrick({ dataUrl: brick.photo.url, width: brick.photo.width, height: brick.photo.height }, dry)
        .then(({ brick: done, result }) => {
          if ('dry' in result) { update(id, { status: 'unparsed', error: 'Dry run: nothing was sent.' }); return }
          const d = afterResult(result)
          if (d.stop) {
            // the photo goes back in line, first; the pump stops until the limit is over (next open) or the network is back
            if (d.held === 'limit') limitHit.current = true; else offlineHold.current = true
            if (!waiting.current.includes(id)) waiting.current.unshift(id)
            update(id, { status: d.status, held: d.held, error: d.error })
          } else if (d.status === 'ready' && done) update(id, { ...done, id, saved_at: brick.saved_at, version: brick.version, supersedes: brick.supersedes, status: 'ready', prompt_version: 'v3' })
          else update(id, { status: 'unparsed', error: d.error ?? 'No brick came back.' })
        })
        .catch(e => update(id, { status: 'unparsed', error: (e as Error).message }))
        .finally(() => { inFlight.current.delete(id); setQueueTick(n => n + 1); pump() })
    }
    setQueueTick(n => n + 1)
  }

  // L11: the browser says when the network leaves and comes back; on `online` the offline holds are lifted and the queue resumes
  useEffect(() => {
    const up = () => {
      offlineHold.current = false
      setOnline(true)
      setState(s => s.bricks.some(b => b.held === 'offline') ? { ...s, bricks: s.bricks.map(b => b.held === 'offline' ? { ...b, held: undefined } : b) } : s)
      pump()
    }
    const down = () => { setOnline(false); if (!limitHit.current) holdWaiting('offline') }
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // L11 then L5: on open the photos come back from IndexedDB first; then anything left pending or mid-flight by a closed tab is queued again
  useEffect(() => {
    const requeue = () => {
      hydrated.current = true
      const stale = stateRef.current.bricks.filter(b => (b.status === 'pending' || b.status === 'extracting') && !waiting.current.includes(b.id) && !inFlight.current.has(b.id)).map(b => b.id)
      if (stale.length) waiting.current.push(...stale)
      pump()
    }
    const ids = needsHydration(stateRef.current)
    if (!ids.length) { requeue(); return }
    getPhotos(ids).catch(() => new Map<string, string>()).then(photos => {
      photos.forEach((url, id) => stored.current.set(id, url.length))
      if (photos.size) { stateRef.current = hydrate(stateRef.current, photos); setState(s => hydrate(s, photos)) }
      requeue()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actions = useMemo<Actions>(() => ({
    addBrick: b => {
      const live = stateRef.current.bricks.filter(x => x.id !== b.id && !x.superseded_by)
      if (live.length >= LIBRARY_CAP) return false
      setState(s => ({ ...s, bricks: [b, ...s.bricks.filter(x => x.id !== b.id)] }))
      stateRef.current = { ...stateRef.current, bricks: [b, ...stateRef.current.bricks.filter(x => x.id !== b.id)] }
      return true
    },
    updateBrick: update,
    removeBrick: id => {
      stored.current.delete(id)
      deletePhoto(id).catch(() => { /* best effort: an orphan photo costs space, nothing else */ })
      setState(s => ({ ...s, bricks: s.bricks.filter(b => b.id !== id), projects: s.projects.map(p => ({ ...p, brickIds: p.brickIds.filter(x => x !== id) })) }))
    },
    enqueue: id => { if (!waiting.current.includes(id) && !inFlight.current.has(id)) { waiting.current.push(id); update(id, { status: 'pending' }) } ; pump() },
    retry: id => {
      const old = stateRef.current.bricks.find(b => b.id === id)
      if (!old || (old.retries ?? 0) >= 1) return
      const nid = `${id.split('.v')[0]}.v${(old.version ?? 1) + 1}`
      const next: Brick = { ...old, id: nid, version: (old.version ?? 1) + 1, supersedes: id, superseded_by: undefined, status: 'pending', error: undefined, retries: (old.retries ?? 0) + 1,
        measurements: [], hypotheses: [], relations: [], regions: [], fragile_if_changed: '' }
      setState(s => ({ ...s, bricks: [next, ...s.bricks.map(b => b.id === id ? { ...b, superseded_by: nid, retries: (b.retries ?? 0) + 1 } : b)] }))
      stateRef.current = { ...stateRef.current, bricks: [next, ...stateRef.current.bricks] }
      waiting.current.push(nid); pump()
    },
    loadSamples: () => setState(s => {
      const have = new Set(s.bricks.map(b => b.id))
      const fresh = SAMPLES.filter(b => !have.has(b.id)).map(b => ({ ...b, status: 'ready' as const, prompt_version: 'v3' }))
      return { ...s, bricks: [...fresh, ...s.bricks].slice(0, LIBRARY_CAP) }
    }),
    mergeBricks: incoming => {
      const cur = stateRef.current.bricks
      const byId = new Map(cur.map(b => [b.id, b]))
      let changed = 0
      for (const inc of incoming) {
        const have = byId.get(inc.id)
        const vi = inc.version ?? 1, vh = have?.version ?? 1
        if (!have) { byId.set(inc.id, { ...inc, status: inc.status === 'ready' ? 'ready' : inc.status === 'unparsed' ? 'unparsed' : 'pending' }); changed++; continue }
        const incWins = vi > vh || (vi === vh && inc.status === 'ready' && have.status !== 'ready')
        if (!incWins && (have.superseded_by || !inc.superseded_by)) continue
        byId.set(inc.id, incWins ? { ...have, ...inc, photo: have.photo.url.startsWith('data:') ? have.photo : inc.photo } : { ...have, superseded_by: have.superseded_by ?? inc.superseded_by })
        changed++
      }
      const bricks = [...byId.values()]
      setState(s => ({ ...s, bricks }))
      stateRef.current = { ...stateRef.current, bricks }
      const stale = bricks.filter(b => b.status === 'pending' && !waiting.current.includes(b.id) && !inFlight.current.has(b.id)).map(b => b.id)
      if (stale.length) { waiting.current.push(...stale); pump() }
      return changed
    },
    replaceBricks: bricks => { setState(s => ({ ...s, bricks })); stateRef.current = { ...stateRef.current, bricks } },
    createProject: (intent, brickIds = [], name, extra) => {
      const id = `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      const now = new Date().toISOString()
      const project: Project = { id, name, intent, createdAt: now, updatedAt: now, shell: 'list-review', brickIds, lockedBricks: {}, disabled: {}, choice: {}, locks: {}, manual: {}, ...extra }
      setState(s => ({ ...s, activeProjectId: id, projects: [...s.projects, project] }))
      stateRef.current = { ...stateRef.current, activeProjectId: id, projects: [...stateRef.current.projects, project] }
      return id
    },
    mergeProjects: incoming => {
      const byId = new Map(stateRef.current.projects.map(p => [p.id, p]))
      let changed = 0
      for (const inc of incoming) {
        if (!inc || typeof inc.id !== 'string' || !Array.isArray(inc.brickIds)) continue
        const have = byId.get(inc.id)
        if (have && (inc.updatedAt ?? inc.createdAt ?? '') <= (have.updatedAt ?? have.createdAt ?? '')) continue
        byId.set(inc.id, { ...have, ...inc, disabled: inc.disabled ?? {}, choice: inc.choice ?? {}, locks: inc.locks ?? {}, manual: inc.manual ?? {} })
        changed++
      }
      if (!changed) return 0
      const projects = [...byId.values()]
      setState(s => ({ ...s, projects }))
      stateRef.current = { ...stateRef.current, projects }
      return changed
    },
    updateProject: (id, patch) => setState(s => ({ ...s, projects: s.projects.map(p => p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch), updatedAt: new Date().toISOString() } : p) })),
    setActive: id => setState(s => ({ ...s, activeProjectId: id })),
    reset: () => {
      for (const id of stored.current.keys()) deletePhoto(id).catch(() => { /* best effort */ })
      stored.current.clear()
      setState(EMPTY)
    },
    queue: { waiting: 0, inFlight: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])
  const queue = useMemo(() => ({ waiting: waiting.current.length, inFlight: inFlight.current.size }), [queueTick, state.bricks.length])
  return <Ctx.Provider value={{ ...state, ...actions, queue, online }}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}
