import { useState } from 'react'
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

/** 15_SIMPLIFY §2, the Brick sheet: a side panel on a desktop, a bottom sheet on a phone. Above the fold, as a measured drawing (2026-11-04): the photo with the réseau and the
 *  regions its rules rest on, its title, its frame id and dates, the plain reading (what the photo has, then on your screens), and `Use in Make`. `The exact rules ▸` folds
 *  the verbatim rules, measurements and the rest (`BrickDetails`). A native modal <dialog>: Escape, the × and a tap on the backdrop close it. */
export function BrickSheet({ brick, onClose }: { brick: Brick | null; onClose: () => void }) {
  const ref = useModal(brick !== null)
  return (
    <dialog ref={ref} className="sheet sheet-side" aria-label={brick ? `${brick.title ?? 'Photo'}, ${dateLine(brick)}` : undefined} onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {brick && <SheetBody key={brick.id} brick={brick} onClose={onClose} />}
    </dialog>
  )
}

function SheetBody({ brick, onClose }: { brick: Brick; onClose: () => void }) {
  const store = useStore()
  const frame = useFrameIds().get(brick.id)
  const [open, setOpen] = useState(false)
  const status = brick.status ?? 'ready'
  const blocked = retryBlocked(brick)
  const by = titleProvenance(brick)

  const summary = (
    <div className="flex flex-col gap-5 px-6 pb-6 pt-4">
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
      <div className="flex">
        {status === 'ready' && <Link href={`/make?brick=${encodeURIComponent(brick.id)}`} className="btn btn-accent w-full text-center no-underline md:w-auto" onClick={onClose}>{COPY.use}</Link>}
        {status === 'unparsed' && <button type="button" className="btn btn-accent w-full md:w-auto" disabled={blocked !== null} title={RETRY_TITLE[blocked ?? 'ok']} onClick={() => { store.retry(brick.id); onClose() }}>{COPY.retry}</button>}
      </div>
      <button type="button" className="btn btn-quiet exact-toggle" aria-expanded={open} aria-controls={`details-${brick.id}`} onClick={() => setOpen(v => !v)}>{COPY.exact} {open ? '▾' : '▸'}</button>
    </div>
  )

  return (
    <>
      <div className="sticky top-0 z-10 h-0">
        <button type="button" className="btn absolute right-3 top-3" style={{ padding: '4px 10px', fontSize: 16, borderRadius: 999 }} aria-label={COPY.close} title={COPY.close} onClick={onClose}>×</button>
      </div>
      <BrickDetails brick={brick} variant="sheet" open={open} summary={summary} onRemoved={onClose} />
    </>
  )
}
