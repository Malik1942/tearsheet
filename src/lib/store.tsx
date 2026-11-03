import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SAMPLES } from '../fixtures/samples'
import type { Brick } from './types'
import type { Project } from './mapRelations'
import { extractBrick } from './client'

/** Versioned key (PRD L9). The library starts empty; `Load sample library` seeds it. Older keys are ignored. */
const KEY = 'tearsheet.v2'
export const LIBRARY_CAP = 60
/** Extraction queue (PRD L5): at most this many requests in flight, first in first out. */
export const MAX_IN_FLIGHT = 2

export type State = { bricks: Brick[]; projects: Project[]; activeProjectId: string | null }
const EMPTY: State = { bricks: [], projects: [], activeProjectId: null }

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
  createProject: (intent: string, brickIds?: string[], name?: string) => string
  updateProject: (id: string, patch: Partial<Project> | ((p: Project) => Partial<Project>)) => void
  setActive: (id: string | null) => void
  reset: () => void
  queue: { waiting: number; inFlight: number }
}

const Ctx = createContext<(State & Actions) | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial)
  const stateRef = useRef(state); stateRef.current = state
  const inFlight = useRef(new Set<string>())
  const waiting = useRef<string[]>([])
  const [queueTick, setQueueTick] = useState(0)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* quota or private mode */ } }, [state])

  const update = (id: string, patch: Partial<Brick>) => setState(s => ({ ...s, bricks: s.bricks.map(b => b.id === id ? { ...b, ...patch } : b) }))

  const pump = () => {
    while (inFlight.current.size < MAX_IN_FLIGHT && waiting.current.length) {
      const id = waiting.current.shift()!
      const brick = stateRef.current.bricks.find(b => b.id === id)
      if (!brick) continue
      inFlight.current.add(id)
      update(id, { status: 'extracting', error: undefined })
      const dry = import.meta.env.DEV && localStorage.getItem('tearsheet.dry') === '1'
      extractBrick({ dataUrl: brick.photo.url, width: brick.photo.width, height: brick.photo.height }, dry)
        .then(({ brick: done, result }) => {
          if ('dry' in result) { update(id, { status: 'unparsed', error: 'Dry run: nothing was sent.' }); return }
          if (!result.ok || !done) update(id, { status: 'unparsed', error: result.ok ? 'No brick came back.' : result.error })
          else update(id, { ...done, id, saved_at: brick.saved_at, version: brick.version, supersedes: brick.supersedes, status: 'ready', prompt_version: 'v3' })
        })
        .catch(e => update(id, { status: 'unparsed', error: (e as Error).message }))
        .finally(() => { inFlight.current.delete(id); setQueueTick(n => n + 1); pump() })
    }
    setQueueTick(n => n + 1)
  }

  // L5: on open, anything left pending or mid-flight by a closed tab is queued again
  useEffect(() => {
    const stale = stateRef.current.bricks.filter(b => b.status === 'pending' || b.status === 'extracting').map(b => b.id)
    if (stale.length) { waiting.current.push(...stale); pump() }
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
    removeBrick: id => setState(s => ({ ...s, bricks: s.bricks.filter(b => b.id !== id), projects: s.projects.map(p => ({ ...p, brickIds: p.brickIds.filter(x => x !== id) })) })),
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
    createProject: (intent, brickIds = [], name) => {
      const id = `p_${Date.now().toString(36)}`
      const now = new Date().toISOString()
      setState(s => ({ ...s, activeProjectId: id, projects: [...s.projects, { id, name, intent, createdAt: now, updatedAt: now, shell: 'list-review', brickIds, lockedBricks: {}, disabled: {}, choice: {}, locks: {}, manual: {} }] }))
      return id
    },
    updateProject: (id, patch) => setState(s => ({ ...s, projects: s.projects.map(p => p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch), updatedAt: new Date().toISOString() } : p) })),
    setActive: id => setState(s => ({ ...s, activeProjectId: id })),
    reset: () => setState(EMPTY),
    queue: { waiting: 0, inFlight: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])
  const queue = useMemo(() => ({ waiting: waiting.current.length, inFlight: inFlight.current.size }), [queueTick, state.bricks.length])
  return <Ctx.Provider value={{ ...state, ...actions, queue }}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}
