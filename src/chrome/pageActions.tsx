import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'

/** One item a page adds to the header's ⋯, above the app's own items: there is one ⋯ per view. */
export type PageMenuItem = { label: string; onSelect: () => void; pressed?: boolean; disabled?: boolean; sep?: boolean }
/** C+D, as a rule (Malik, 2026-11-03): the header's right side holds the page's single primary action, then ⋯. Make puts Share and its menu items there;
 *  the Library's Shoot is the header's own. */
export type PageActions = { primary?: ReactNode; items?: PageMenuItem[] }

const Value = createContext<PageActions>({})
// the setter has its own context, so a page that sets its actions does not re-render when the header takes them
const Setter = createContext<(actions: PageActions) => void>(() => {})

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<PageActions>({})
  return <Setter.Provider value={setActions}><Value.Provider value={actions}>{children}</Value.Provider></Setter.Provider>
}

export const usePageActionsValue = (): PageActions => useContext(Value)

/** A page calls this on every render (its items close over its current state); the header shows them, before paint, until the page goes. */
export function usePageActions(actions: PageActions): void {
  const set = useContext(Setter)
  useLayoutEffect(() => { set(actions) })
  useLayoutEffect(() => () => set({}), [set])
}
