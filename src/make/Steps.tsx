import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from '../lib/router'

/** 15_SIMPLIFY §1: inside Make, a step line instead of breadcrumbs: a back arrow, then 1 What · 2 Picks · 3 See · 4 Share. */
export type Step = 1 | 2 | 3 | 4
const NAMES: Record<Step, string> = { 1: 'What', 2: 'Picks', 3: 'See', 4: 'Share' }
export type Go = string | (() => void)

/** `go` holds where a step other than the current one leads; a step with nowhere to go is plain text. `back` is the arrow. */
export function StepLine({ current, back, go = {} }: { current: Step; back: Go; go?: Partial<Record<Step, Go>> }) {
  const backLabel = 'Back'
  return (
    <nav aria-label="Make steps" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
      {typeof back === 'string'
        ? <Link href={back} className="btn btn-quiet -ml-2 px-2 py-1 text-[15px] no-underline" aria-label={backLabel} title={backLabel}>←</Link>
        : <button type="button" className="btn btn-quiet -ml-2 px-2 py-1 text-[15px]" aria-label={backLabel} title={backLabel} onClick={back}>←</button>}
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 p-0">
        {([1, 2, 3, 4] as const).map((s, i) => {
          const to = s === current ? undefined : go[s]
          const label = <><span className="tabular-nums">{s}</span> {NAMES[s]}</>
          const style = s === current ? { color: 'var(--ink)', fontWeight: 600 } : { color: 'var(--ink-2)' }
          return (
            <Fragment key={s}>
              {i > 0 && <li aria-hidden="true" className="ink-2">·</li>}
              <li aria-current={s === current ? 'step' : undefined} style={style}>
                {to === undefined ? label
                  : typeof to === 'string' ? <Link href={to} className="no-underline" style={style}>{label}</Link>
                  : <button type="button" className="cursor-pointer border-0 bg-transparent p-0" style={{ ...style, font: 'inherit' }} onClick={to}>{label}</button>}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

/** §5: one page title per step, 24 px. Set inline: the chrome's own h1 rule would win over a utility class. */
export function StepTitle({ children, id }: { children: ReactNode; id?: string }) {
  return <h1 id={id} style={{ fontSize: 24, lineHeight: '30px', fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>{children}</h1>
}

/** §5: the page gutter (32 desktop, 20 phone) and the 32 px section gap, at a readable width. */
export function StepPage({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto flex w-full flex-col gap-8 px-5 py-6 md:px-8 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>{children}</div>
}

/** The step's ⋯ menu: a quiet button that opens a short list of actions. Escape or a click outside closes it. */
export function MoreMenu({ items, label = 'More' }: { items: { label: string; onSelect: () => void; pressed?: boolean; disabled?: boolean }[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div ref={box} className="relative">
      <button type="button" className="btn btn-quiet px-2 py-1 text-[18px] leading-none" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>⋯</button>
      {open && (
        <div role="menu" className="panel absolute right-0 z-30 mt-1 flex min-w-[220px] flex-col py-1" style={{ background: 'var(--panel)' }}>
          {items.map(it => (
            <button key={it.label} type="button" role={it.pressed === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={it.pressed} disabled={it.disabled}
              className="flex cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-3 py-2 text-left text-[13px] hover:bg-[var(--paper)] disabled:cursor-default disabled:opacity-50"
              style={{ color: 'var(--ink)', font: 'inherit' }} onClick={() => { setOpen(false); it.onSelect() }}>
              <span>{it.label}</span>{it.pressed !== undefined && <span className="ink-2 text-[12px]">{it.pressed ? 'On' : 'Off'}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** A toggle switch: accent when on (§5: accent only on the primary button, a selected tab, a toggle that is on and the change highlight). */
export function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} onClick={onChange}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-0 p-0 transition-colors"
      style={{ background: on ? 'var(--accent)' : 'var(--line)' }}>
      <span aria-hidden="true" className="absolute h-4 w-4 rounded-full transition-[left]" style={{ left: on ? 18 : 2, background: '#fff' }} />
    </button>
  )
}

/** A dialog laid over the step: Escape or the close button closes it. `full` takes the whole screen (the Fine-tune drawer). */
export function Overlay({ title, onClose, children, full = false, actions }: { title: string; onClose: () => void; children: ReactNode; full?: boolean; actions?: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="chrome fixed inset-0 z-40 flex items-start justify-center overflow-y-auto" style={{ background: full ? 'var(--paper)' : 'color-mix(in oklab, var(--ink) 35%, transparent)' }}
      onMouseDown={e => { if (!full && e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={full ? 'min-h-full w-full' : 'panel mx-4 my-12 w-full max-w-2xl p-5'} style={full ? undefined : { background: 'var(--panel)' }}>
        <div className={`flex flex-wrap items-center gap-3 ${full ? 'sticky top-0 z-10 border-b px-5 py-3 hairline md:px-8' : 'mb-4'}`} style={full ? { background: 'var(--panel)' } : undefined}>
          <h2 style={{ fontSize: 15, lineHeight: '20px', fontWeight: 600, margin: 0 }}>{title}</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">{actions}<button type="button" className="btn" onClick={onClose}>Done</button></div>
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

