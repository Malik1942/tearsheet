/** 15_SIMPLIFY §1: which of the two tabs a path belongs to, and where the shared header and the phone's bottom bar show. Pure, so it is tested without a DOM. */
export type Tab = 'library' | 'make' | 'none'

/** `Make` for the make flow and anything inside a project; `none` for a project someone shared with you (/shared, read-only: it is in neither of your tabs);
 *  `Library` for everything else (the Library, a brick, Sync, Projects, Open). */
export function tabOf(path: string): Tab {
  if (path === '/shared') return 'none'
  return path === '/make' || path.startsWith('/make/') || path.startsWith('/project/') ? 'make' : 'library'
}

/** C+D (DESIGN_SYSTEM.md §2): the Library is loud (display type, the red masthead), every other view quiet. Set on the app root, header included. */
export const volumeOf = (path: string): 'loud' | 'quiet' => (path === '/' || path === '' ? 'loud' : 'quiet')

/** Every route has the shared header except the solo shell renders (`/solo/*`) and the contract test's page (`/dev/contract`), which are bare screens for capture. */
export const hasHeader = (path: string): boolean => !path.startsWith('/solo/') && path !== '/dev/contract'

