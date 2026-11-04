import { useEffect } from 'react'
import { navigate } from '../lib/router'

/** A key typed into a field, or with a modifier, is the field's or the browser's: never a shortcut. */
function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return e.metaKey || e.ctrlKey || e.altKey || !!t?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
}

/** The desktop's keys (Malik, 2026-11-04): 1 and 2 go to Library and Make, N shoots, ? opens the list. Not while a sheet is open (its own keys apply:
 *  Escape closes it, the arrows step through photos in the Brick sheet), and never while typing. */
export function useShortcuts({ onShoot, onHelp }: { onShoot: () => void; onHelp: () => void }) {
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.defaultPrevented || typing(e) || document.querySelector('dialog[open]')) return
      const act = e.key === '1' ? () => navigate('/') : e.key === '2' ? () => navigate('/make') : e.key.toLowerCase() === 'n' ? onShoot : e.key === '?' ? onHelp : null
      if (!act) return
      e.preventDefault(); act()
    }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [onShoot, onHelp])
}
