import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import type { Rect } from '../lib/highlight'

const HOVER_DELAY_MS = 150

/** Spec v3 C12: when a sheet row shows its photo peek. A mouse hovering the row opens it after a short delay and leaving closes it; a tap, a click, Enter or Space on the row pins it open or closed.
 *  A pinned peek closes on a press anywhere outside the row, on Escape, and when focus leaves the row. While it shows, it follows the row through scrolling and closes once the row is off screen.
 *  A touch never counts as hovering, so a tap is not a hover followed by a click that closes it again. `ref` is the row's element, `enabled` is false for a row with no source brick: nothing opens and nothing is pinned. */
export function usePeek(ref: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const timer = useRef<number | undefined>(undefined)
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [anchor, setAnchor] = useState<Rect | null>(null)
  // a row that stops having a source (a swap made it a shell default) forgets that it was open
  if (!enabled && (hover || pinned)) { setHover(false); setPinned(false) }
  const open = enabled && (hover || pinned) && anchor !== null

  const measure = () => { const r = ref.current?.getBoundingClientRect(); if (r) setAnchor({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }) }
  const toggle = () => {
    if (pinned) { setPinned(false); setHover(false) }
    else { measure(); setPinned(true) }
  }

  useEffect(() => {
    if (!open) return
    const close = () => { window.clearTimeout(timer.current); setHover(false); setPinned(false) }
    const onDown = (e: globalThis.PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close() }
    const follow = () => {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      if (r.bottom < 0 || r.top > window.innerHeight) close()
      else setAnchor({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  }, [open, ref])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const handlers = {
    onPointerEnter: (e: PointerEvent<HTMLDivElement>) => {
      if (!enabled || e.pointerType === 'touch') return
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => { measure(); setHover(true) }, HOVER_DELAY_MS)
    },
    onPointerLeave: (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch') return
      window.clearTimeout(timer.current)
      setHover(false)
    },
    onClick: () => { if (enabled) toggle() },
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (!enabled || e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
      e.preventDefault()
      toggle()
    },
    onBlur: (e: FocusEvent<HTMLDivElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPinned(false) },
  }
  return { open, anchor, handlers }
}
