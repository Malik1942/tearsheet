import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

/** §5: a page title, 24 px. Set inline: the chrome's own h1 rule would win over a utility class. */
export function StepTitle({ children, id }: { children: ReactNode; id?: string }) {
  return <h1 id={id} style={{ fontSize: 24, lineHeight: '30px', fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>{children}</h1>
}

/** §5: the page gutter (32 desktop, 20 phone) and the 32 px section gap, at a readable width. */
export function StepPage({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto flex w-full flex-col gap-8 px-5 py-6 md:px-8 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>{children}</div>
}

/** Three dots, drawn: the same glyph as the header's ⋯ (AppChrome) at the same size. */
export const MoreIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>

/** The page's ⋯ menu, built like the header's (`.menu`, `.menu-item`): a quiet icon button that opens a short list of actions, grouped by separators
 *  (`sep` draws one before an item). Opening it focuses the first action; the arrow keys move between them; Escape or a click outside closes it and
 *  gives focus back to the button. */
export function MoreMenu({ items, label = 'More' }: { items: { label: string; onSelect: () => void; pressed?: boolean; disabled?: boolean; sep?: boolean }[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc) }
  }, [open])
  const arrows = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const all = [...(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const i = all.indexOf(document.activeElement as HTMLButtonElement)
    all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus()
  }
  return (
    <div ref={box} className="relative">
      <button ref={trigger} type="button" className="btn btn-quiet icon-btn" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}><MoreIcon /></button>
      {open && (
        <div ref={list} role="menu" aria-label={label} className="menu" onKeyDown={arrows}>
          {items.map(it => (
            <div key={it.label} className="contents">
              {it.sep && <div className="menu-sep" role="separator" />}
              <button type="button" role={it.pressed === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={it.pressed} disabled={it.disabled}
                className="menu-item disabled:cursor-default disabled:opacity-50" onClick={() => { setOpen(false); it.onSelect() }}>
                <span>{it.label}</span>{it.pressed !== undefined && <span className="ink-2 text-[12px]">{it.pressed ? 'On' : 'Off'}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** A dialog laid over the page: Escape or the close button closes it. `full` takes the whole screen (the Fine-tune drawer). */
export function Overlay({ title, onClose, children, full = false, actions, closeLabel = 'Done' }: { title: string; onClose: () => void; children: ReactNode; full?: boolean; actions?: ReactNode; closeLabel?: string }) {
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = prev }
  }, [onClose])
  // focus moves into the dialog when it opens and back to what opened it when it closes (WAI-ARIA dialog pattern)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    // a text field the person came to fill (Rename), else the dialog itself; a control inside a closed fold cannot take focus
    const field = dialog.current?.querySelector<HTMLElement>('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select')
    const target = field && field.checkVisibility?.() !== false ? field : dialog.current
    target?.focus()
    return () => { opener?.focus?.() }
  }, [])
  return (
    <div className="chrome fixed inset-0 z-40 flex items-start justify-center overflow-y-auto overscroll-contain" style={{ background: full ? 'var(--paper)' : 'color-mix(in oklab, var(--ink) 35%, transparent)' }}
      onMouseDown={e => { if (!full && e.target === e.currentTarget) onClose() }}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`outline-none ${full ? 'min-h-full w-full' : 'panel mx-4 my-12 w-full max-w-2xl p-5'}`} style={full ? undefined : { background: 'var(--panel)' }}>
        <div className={`flex flex-wrap items-center gap-3 ${full ? 'sticky top-0 z-10 border-b px-5 py-3 hairline md:px-8' : 'mb-4'}`} style={full ? { background: 'var(--panel)' } : undefined}>
          <h2 style={{ fontSize: 15, lineHeight: '20px', fontWeight: 600, margin: 0 }}>{title}</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">{actions}<button type="button" className="btn" onClick={onClose}>{closeLabel}</button></div>
        </div>
        {children}
      </div>
    </div>
  )
}

/** A fold: "Label ▸", closed by default. What used to be visible lives behind one of these (§3). */
export function Fold({ summary, children, defaultOpen = false, className = '', onToggle }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string; onToggle?: (open: boolean) => void }) {
  // read once: a prop that changed later would make React open or close the fold under the person's hand
  const [initial] = useState(defaultOpen)
  return (
    <details className={`group ${className}`} open={initial || undefined} onToggle={onToggle ? e => onToggle((e.currentTarget as HTMLDetailsElement).open) : undefined}>
      <summary className="ink-2 inline-flex cursor-pointer list-none items-center gap-1 text-[13px] [&::-webkit-details-marker]:hidden">
        {summary}<span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">▸</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

