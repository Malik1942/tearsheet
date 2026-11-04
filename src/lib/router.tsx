import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'

type ViewTransitions = Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } }

/** Which side of the app a path is on (the Library's, then Make's), so a page transfer slides the way the tabs run. */
const sideOf = (path: string) => (/^\/(make|project)(\/|$|\?)/.test(path) ? 1 : 0)

/** Tiny path router: history API, no dependency. Routes are matched in App. A move between pages is a view transition where the browser has one and
 *  motion is welcome (Malik, 2026-11-04: tokens.css "motion"): the page cross-fades, sliding on a phone the way the tabs run, the header and the tab bar
 *  held still. `data-nav` on the root says which way. Back and forward in the browser stay instant. */
export function navigate(path: string) {
  if (location.pathname + location.search + location.hash === path) return
  const go = () => { history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }
  const doc = document as ViewTransitions
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return go()
  const from = sideOf(location.pathname), to = sideOf(path)
  document.documentElement.dataset.nav = to > from ? 'forward' : to < from ? 'back' : 'same'
  doc.startViewTransition(() => flushSync(go))
}

export function usePath(): string {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => setPath(location.pathname)
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [])
  return path
}

/** Match "/brick/:id" style patterns. Returns params or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean), s = path.split('/').filter(Boolean)
  if (p.length !== s.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i])
    else if (p[i] !== s[i]) return null
  }
  return params
}

export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigate(href)
  }
  return <a href={href} onClick={handle} {...rest} />
}
