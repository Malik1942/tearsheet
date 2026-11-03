import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SAMPLES } from '../fixtures/samples'
import type { Brick } from './types'
import type { Project } from './mapRelations'

const KEY = 'bricks.v2'   // v2: the library is seeded from the v3 sample bricks (own photos only); v1 held the step-2 fixtures
const SEED: Brick[] = SAMPLES

export type State = { bricks: Brick[]; projects: Project[]; activeProjectId: string | null }

const initial = (): State => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as State
  } catch { /* storage unavailable: run in memory */ }
  return { bricks: SEED, projects: [], activeProjectId: null }
}

export type Actions = {
  addBrick: (b: Brick) => void
  removeBrick: (id: string) => void
  createProject: (intent: string) => string
  updateProject: (id: string, patch: Partial<Project> | ((p: Project) => Partial<Project>)) => void
  setActive: (id: string | null) => void
  reset: () => void
}

const Ctx = createContext<(State & Actions) | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ } }, [state])
  const actions = useMemo<Actions>(() => ({
    addBrick: b => setState(s => ({ ...s, bricks: [b, ...s.bricks.filter(x => x.id !== b.id)] })),
    removeBrick: id => setState(s => ({ ...s, bricks: s.bricks.filter(b => b.id !== id), projects: s.projects.map(p => ({ ...p, brickIds: p.brickIds.filter(x => x !== id) })) })),
    createProject: intent => {
      const id = `p_${Date.now().toString(36)}`
      setState(s => ({ ...s, activeProjectId: id, projects: [...s.projects, { id, intent, createdAt: new Date().toISOString(), brickIds: [], disabled: {}, choice: {}, locks: {}, manual: {} }] }))
      return id
    },
    updateProject: (id, patch) => setState(s => ({ ...s, projects: s.projects.map(p => p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p) })),
    setActive: id => setState(s => ({ ...s, activeProjectId: id })),
    reset: () => setState({ bricks: SEED, projects: [], activeProjectId: null }),
  }), [])
  return <Ctx.Provider value={{ ...state, ...actions }}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}
