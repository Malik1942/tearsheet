/** 15_SIMPLIFY §1: which of the two tabs a path belongs to, and where the shared header and the phone's bottom bar show. Pure, so it is tested without a DOM. */
export type Tab = 'library' | 'make'

/** `Make` for the make flow and anything inside a project; `Library` for everything else (the Library, a brick, Sync, Projects, Open). */
export function tabOf(path: string): Tab {
  return path === '/make' || path.startsWith('/make/') || path.startsWith('/project/') ? 'make' : 'library'
}

/** Every route has the shared header except the solo shell renders (`/solo/*`) and the contract test's page (`/dev/contract`), which are bare screens for capture. */
export const hasHeader = (path: string): boolean => !path.startsWith('/solo/') && path !== '/dev/contract'

