import { useEffect, useRef } from 'react'

/** A native <dialog> opened modal while `open` is true: the browser traps focus, Escape closes it, and focus goes back where it was.
 *  The dialog's own `close` event (Escape, a form button) must call the owner's onClose so the state follows. */
export function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])
  return ref
}
