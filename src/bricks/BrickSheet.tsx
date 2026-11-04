import { useRef, useState, type PointerEvent, type RefObject } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { dateLine, titleProvenance } from '../lib/brickLabels'
import { retryBlocked } from '../lib/queue'
import { withFrame } from '../lib/frames'
import { useFrameIds } from '../lib/useFrameIds'
import { BrickDetails, PlainReading } from '../screens/Brick'
import { RETRY_TITLE } from './retryCopy'
import { useModal } from '../chrome/useModal'
import type { Brick } from '../lib/types'

const COPY = {
  carries: 'What it carries',
  noLabels: 'No short labels for this one.',
  use: 'Use in Make',
  exact: 'The exact rules',
  unparsed: "Couldn't read this one",
  retry: 'Try again',
  close: 'Close',
}

/** How far down, or how fast, a swipe on the sheet's top row closes it (px, px/ms); and how long it takes to settle (tokens.css --t-exit). */
const SWIPE = { distance: 90, speed: 0.6, settle: 200 }

/** Set the sheet's slide, with a transition or none (the swipe below moves the dialog itself, outside React). */
function slide(d: HTMLElement, to: string, transition = '') { d.style.transition = transition; d.style.transform = to }

/** On a phone, the sheet follows a finger dragged down its top row and closes past `SWIPE`, else springs back. A mouse drags nothing. */
function useSwipeDown(dialog: RefObject<HTMLDialogElement | null>) {
  const start = useRef<{ y: number; t: number } | null>(null)
  const settle = (d: HTMLDialogElement, to: string, then?: () => void) => {
    slide(d, to, `transform ${SWIPE.settle}ms var(--ease)`)
    window.setTimeout(() => { slide(d, ''); then?.() }, SWIPE.settle)
  }
  const end = (e: PointerEvent, cancelled: boolean) => {
    const s = start.current, d = dialog.current
    start.current = null
    if (!s || !d) return
    const dy = e.clientY - s.y, speed = dy / Math.max(1, performance.now() - s.t)
    if (!cancelled && (dy > SWIPE.distance || speed > SWIPE.speed)) settle(d, 'translateY(100%)', () => d.close())
    else settle(d, '')
  }
  return {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' || (e.target as HTMLElement).closest('button')) return
      start.current = { y: e.clientY, t: performance.now() }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const s = start.current, d = dialog.current
      if (s && d) slide(d, `translateY(${Math.max(0, e.clientY - s.y)}px)`)
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => end(e, false),
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => end(e, true),
  }
}

/** 15_SIMPLIFY §2, the Brick sheet: a side panel on a desktop, a bottom sheet on a phone. Above the fold, as a measured drawing (2026-11-04): the photo with the réseau and the
 *  regions its rules rest on, its title, its frame id and dates, the plain reading (what the photo has, then on your screens); `The exact rules ▸` folds the verbatim rules,
 *  measurements and the rest (`BrickDetails`); `Use in Make` stays pinned at the bottom. A native modal <dialog>: Escape, the ×, a tap on the backdrop and, on a phone, a
 *  swipe down its top row close it. It keeps the photo it showed while it leaves (useModal's exit). */
export function BrickSheet({ brick, onClose }: { brick: Brick | null; onClose: () => void }) {
  const ref = useModal(brick !== null)
  const swipe = useSwipeDown(ref)
  const [kept, setKept] = useState<Brick | null>(brick)
  if (brick !== null && brick !== kept) setKept(brick)
  const shown = brick ?? kept
  return (
    <dialog ref={ref} className="sheet sheet-side" aria-label={shown ? `${shown.title ?? 'Photo'}, ${dateLine(shown)}` : undefined} onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {shown && <SheetBody key={shown.id} brick={shown} onClose={onClose} swipe={swipe} />}
    </dialog>
  )
}

function SheetBody({ brick, onClose, swipe }: { brick: Brick; onClose: () => void; swipe: ReturnType<typeof useSwipeDown> }) {
  const store = useStore()
  const frame = useFrameIds().get(brick.id)
  const [open, setOpen] = useState(false)
  const status = brick.status ?? 'ready'
  const blocked = retryBlocked(brick)
  const by = titleProvenance(brick)

  const summary = (
    <div className="flex flex-col gap-5 px-6 pb-2 pt-4">
      {/* the title above the frame id and the full credit or dates; one written by hand says so (Malik, 2026-11-03). No rename yet */}
      <div>
        {brick.title && <p className="em m-0 flex flex-wrap items-center gap-2">{brick.title}{by && <span className="chip chip-adapted px-1.5 text-[10px]">{by}</span>}</p>}
        <div className="caption ink-2 truncate" title={dateLine(brick)}>{withFrame(frame, dateLine(brick))}</div>
      </div>
      {status === 'ready' ? (
        <section aria-labelledby={`carries-${brick.id}`} className="flex flex-col gap-3">
          <h2 id={`carries-${brick.id}`} className="em">{COPY.carries}</h2>
          <PlainReading brick={brick} />
          {brick.relations.every(r => r.parameter === 'none') && <p className="ink-2 m-0">{COPY.noLabels}</p>}
        </section>
      ) : status === 'unparsed' ? <p className="em">{COPY.unparsed}</p> : null}
      <button type="button" className="btn btn-quiet exact-toggle" aria-expanded={open} aria-controls={`details-${brick.id}`} onClick={() => setOpen(v => !v)}><span>{COPY.exact}</span><span aria-hidden="true">{open ? '▾' : '▸'}</span></button>
    </div>
  )

  return (
    <>
      {/* the top row: a handle to swipe the sheet away on a phone, and the × on paper, never on the photo */}
      <div className="sheet-top" {...swipe}>
        <span className="sheet-grabber" aria-hidden="true" />
        <button type="button" className="btn btn-quiet icon-btn sheet-close" aria-label={COPY.close} title={COPY.close} onClick={onClose}>×</button>
      </div>
      <BrickDetails brick={brick} variant="sheet" open={open} summary={summary} onRemoved={onClose} />
      {(status === 'ready' || status === 'unparsed') && (
        <div className="sheet-actions">
          {status === 'ready' && <Link href={`/make?brick=${encodeURIComponent(brick.id)}`} className="btn btn-accent w-full text-center no-underline md:w-auto" onClick={onClose}>{COPY.use}</Link>}
          {status === 'unparsed' && <button type="button" className="btn btn-accent w-full md:w-auto" disabled={blocked !== null} title={RETRY_TITLE[blocked ?? 'ok']} onClick={() => { store.retry(brick.id); onClose() }}>{COPY.retry}</button>}
        </div>
      )}
    </>
  )
}
