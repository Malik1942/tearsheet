import { useLayoutEffect, useRef } from 'react'

/** How long a sheet takes to leave (tokens.css: the sheets' exit). */
const CLOSE_MS = 220
const timers = new WeakMap<HTMLDialogElement, number>()

/** Close with the sheet's exit: `data-closing` plays it (tokens.css), then the dialog closes. Instant when motion is unwelcome. */
function closeSoftly(d: HTMLDialogElement) {
  if (timers.has(d)) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { d.close(); return }
  d.setAttribute('data-closing', '')
  timers.set(d, window.setTimeout(() => { timers.delete(d); d.removeAttribute('data-closing'); if (d.open) d.close() }, CLOSE_MS))
}

/** A native <dialog> opened modal while `open` is true: the browser traps focus, Escape closes it, and focus goes back where it was.
 *  The dialog's own `close` event (Escape, a form button) must call the owner's onClose so the state follows. It opens in the commit (a layout effect),
 *  so a view transition sees it open; it leaves with its exit, Escape included (Malik, 2026-11-04: motion). */
export function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const d = ref.current
    if (!d) return
    if (open) {
      const t = timers.get(d)
      if (t !== undefined) { clearTimeout(t); timers.delete(d); d.removeAttribute('data-closing') }   // reopened while leaving
      if (!d.open) d.showModal()
    } else if (d.open) closeSoftly(d)
  }, [open])
  useLayoutEffect(() => {
    const d = ref.current
    if (!d) return
    const cancel = (e: Event) => { e.preventDefault(); closeSoftly(d) }   // Escape: the same exit as the ×
    d.addEventListener('cancel', cancel)
    return () => d.removeEventListener('cancel', cancel)
  }, [])
  return ref
}
