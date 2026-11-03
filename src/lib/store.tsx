import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SAMPLES } from '../fixtures/samples'
import type { Brick } from './types'
import type { Project } from './mapRelations'

/** Versioned key. The library starts empty; `Load sample library` seeds it. (The earlier bricks.v1/v2 keys held step-2 fixtures and are ignored.) */
const KEY = 'tearsheet.v1'
export const LIBRARY_CAP = 60

export type State = { bricks: Brick[]; projects: Project[]; activeProjectId: string | null }

const EMPTY: State = { bricks: [], projects: [], activeProjectId: null }

const initial = (): State => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as State
      // an extraction interrupted by a reload cannot resume; show it as unparsed with a retry
      return { ...s, bricks: s.bricks.map(b => b.status === 'extracting' ? { ...b, status: 'unparsed', error: 'Interrupted before the reading came back.' } : b) }
    }
  } catch { /* storage unavailable: run in memory */ }
  return EMPTY
}

export type Actions = {
  addBrick: (b: Brick) => boolean
  updateBrick: (id: string, patch: Partial<Brick>) => void
  removeBrick: (id: string) => void
  loadSamples: () => void
  createProject: (intent: string, brickIds?: string[], name?: string) => string
  updateProject: (id: string, patch: Partial<Project> | ((p: Project) => Partial<Project>)) => void
  setActive: (id: string | null) => void
  reset: () => void
}

const Ctx = createContext<(State & Actions) | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial)
  const [full, setFull] = useState(false)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* quota or private mode: keep running in memory */ }
  }, [state])
  const actions = useMemo<Actions>(() => ({
    addBrick: b => {
      let ok = true
      setState(s => {
        if (s.bricks.filter(x => x.id !== b.id).length >= LIBRARY_CAP) { ok = false; return s }
        return { ...s, bricks: [b, ...s.bricks.filter(x => x.id !== b.id)] }
      })
      setFull(!ok)
      return ok
    },
    updateBrick: (id, patch) => setState(s => ({ ...s, bricks: s.bricks.map(b => b.id === id ? { ...b, ...patch } : b) })),
    removeBrick: id => setState(s => ({ ...s, bricks: s.bricks.filter(b => b.id !== id), projects: s.projects.map(p => ({ ...p, brickIds: p.brickIds.filter(x => x !== id) })) })),
    loadSamples: () => setState(s => {
      const have = new Set(s.bricks.map(b => b.id))
      const fresh = SAMPLES.filter(b => !have.has(b.id)).map(b => ({ ...b, status: 'ready' as const, prompt_version: 'v3' }))
      return { ...s, bricks: [...fresh, ...s.bricks].slice(0, LIBRARY_CAP) }
    }),
    createProject: (intent, brickIds = [], name) => {
      const id = `p_${Date.now().toString(36)}`
      const now = new Date().toISOString()
      setState(s => ({ ...s, activeProjectId: id, projects: [...s.projects, { id, name, intent, createdAt: now, updatedAt: now, shell: 'list-review', brickIds, lockedBricks: {}, disabled: {}, choice: {}, locks: {}, manual: {} }] }))
      return id
    },
    updateProject: (id, patch) => setState(s => ({ ...s, projects: s.projects.map(p => p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch), updatedAt: new Date().toISOString() } : p) })),
    setActive: id => setState(s => ({ ...s, activeProjectId: id })),
    reset: () => setState(EMPTY),
  }), [])
  return <Ctx.Provider value={{ ...state, ...actions, ...(full ? { libraryFull: true } : {}) } as State & Actions}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}
