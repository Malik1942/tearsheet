import { useState } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { dateLine } from '../lib/brickLabels'
import { labelsOfBrick } from '../lib/shortLabels'
import { retryBlocked } from '../lib/queue'
import { LabelChip } from '../compose/LabelChip'
import { BrickDetails } from '../screens/Brick'
import { RETRY_TITLE } from './retryCopy'
import { useModal } from '../chrome/useModal'
import { labelHref } from './labelAnchor'
import type { Brick } from '../lib/types'

const COPY = {
  carries: 'What it carries',
  noLabels: 'No short labels for this one.',
  use: 'Use in Make',
  details: 'Details',
  unparsed: "Couldn't read this one",
  retry: 'Try again',
  close: 'Close',
}

/** 15_SIMPLIFY §2, the Brick sheet: a side panel on a desktop, a bottom sheet on a phone. Above the fold: the photo, what it carries (up to three short labels,
 *  each linking to the measurement behind it on `/brick/:id`), and `Use in Make`. `Details ▸` folds today's Brick screen, unchanged (`BrickDetails`).
 *  A native modal <dialog>: Escape, the × and a tap on the backdrop close it. */
export function BrickSheet({ brick, onClose }: { brick: Brick | null; onClose: () => void }) {
  const ref = useModal(brick !== null)
  return (
    <dialog ref={ref} className="sheet sheet-side" aria-label={brick ? `Photo, ${dateLine(brick)}` : undefined} onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {brick && <SheetBody key={brick.id} brick={brick} onClose={onClose} />}
    </dialog>
  )
}

function SheetBody({ brick, onClose }: { brick: Brick; onClose: () => void }) {
  const store = useStore()
  const [open, setOpen] = useState(false)
  const status = brick.status ?? 'ready'
  const labels = status === 'ready' ? labelsOfBrick(brick) : []
  const blocked = retryBlocked(brick)

  const summary = (
    <div className="flex flex-col gap-5 px-6 pb-6 pt-4">
      <div className="caption ink-2 truncate" title={dateLine(brick)}>{dateLine(brick)}</div>
      {status === 'ready' ? (
        <section aria-labelledby={`carries-${brick.id}`}>
          <h2 id={`carries-${brick.id}`} className="em">{COPY.carries}</h2>
          {labels.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1.5">
              {labels.map(l => <li key={l.label}><Link href={labelHref(brick, l)} className="no-underline hover:underline" style={{ color: 'inherit' }} onClick={onClose}><LabelChip l={l} /></Link></li>)}
            </ul>
          ) : <p className="ink-2 mt-2">{COPY.noLabels}</p>}
        </section>
      ) : status === 'unparsed' ? <p className="em">{COPY.unparsed}</p> : null}
      <div className="flex">
        {status === 'ready' && <Link href={`/make?brick=${encodeURIComponent(brick.id)}`} className="btn btn-accent w-full text-center no-underline md:w-auto" onClick={onClose}>{COPY.use}</Link>}
        {status === 'unparsed' && <button type="button" className="btn btn-accent w-full md:w-auto" disabled={blocked !== null} title={RETRY_TITLE[blocked ?? 'ok']} onClick={() => { store.retry(brick.id); onClose() }}>{COPY.retry}</button>}
      </div>
      <button type="button" className="btn btn-quiet self-start" style={{ paddingLeft: 0 }} aria-expanded={open} aria-controls={`details-${brick.id}`} onClick={() => setOpen(v => !v)}>{COPY.details} {open ? '▾' : '▸'}</button>
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
