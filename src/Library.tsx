import { useState } from 'react'
import { useStore } from './lib/store'
import { useAddPhotos } from './bricks/AddPhotos'
import { retryBlocked } from './lib/queue'
import { Link } from './lib/router'
import { Photo } from './bricks/Photo'
import { MiniPreview } from './shell/MiniPreview'
import { brickParams } from './lib/brickPreview'
import { originLabel } from './lib/brickLabels'
import { originOf } from './lib/starters'
import type { Brick } from './lib/types'

const COPY = {
  empty: 'Nothing saved yet.',
  /** 15_SIMPLIFY: one short line, no paragraph. */
  hint: 'Add anything you like the look of.',
  addMany: 'Add from library',
  extracting: 'Reading… usually 15–25 s',
  /** Second line under the extracting state: what the reading is, said plainly (spec v3 L6). */
  measuring: 'Measuring ratios, shares and hues. Not tagging.',
  queued: 'Queued',
  /** L11: the server's daily or hourly limit; the photo stays pending and is read on a later open. */
  limit: 'Daily reading limit reached. Your photo is saved and will be read later.',
  unparsed: "Couldn't read this one.",
  /** L7 and SB4: under the empty state; the starters are built in and persistent, and they step aside as the library fills. */
  starters: 'These are starters. Yours replace them as you save.',
  startersHidden: 'Starters are hidden.',
  showStarters: 'Show starters',
}

/** Library: collect photos over time; see what was extracted. Adding never asks for an intent.
 *  `Shoot` opens the camera (PRD L2); `Add from library` takes several photos at once (L3); the store's queue sends them two at a time (L5). */
export function Library() {
  const store = useStore()
  const add = useAddPhotos()
  // L7: the Library is the person's own bricks; the starters show only while there are none (below)
  const live = store.bricks.filter(b => originOf(b) === 'own' && !b.superseded_by)
  const newestFirst = (list: Brick[]) => [...list].sort((a, b) => (b.saved_at > a.saved_at ? 1 : b.saved_at < a.saved_at ? -1 : 0))
  const bricks = newestFirst(live)
  const starters = newestFirst(store.bricks.filter(b => originOf(b) === 'starter'))

  return (
    <div className="chrome min-h-full">
      {bricks.length === 0 ? (
        <>
          <div className="mx-auto max-w-md px-4 pt-12 text-center">
            <h1 className="title">{COPY.empty}</h1>
            <p className="ink-2 mt-2">{COPY.hint}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {/* Shoot is in the header (the bottom bar on a phone); several photos at once is here and in ⋯ */}
              <button type="button" className="btn" onClick={add.pickMany}>{COPY.addMany}</button>
            </div>
          </div>
          {store.showStarters ? (
            <section className="px-4 pb-4 pt-10" aria-label="Starters">
              <p className="ink-2 mb-3 text-center">{COPY.starters}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {starters.map(b => <Card key={b.id} brick={b} onRetry={noop} onRemove={noop} />)}
              </div>
            </section>
          ) : (
            <div className="mx-auto max-w-md px-4 pt-8 text-center">
              <p className="ink-2">{COPY.startersHidden}</p>
              <button type="button" className="btn mt-2" onClick={() => store.setShowStarters(true)}>{COPY.showStarters}</button>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bricks.map(b => <Card key={b.id} brick={b} onRetry={() => store.retry(b.id)} onRemove={() => store.removeBrick(b.id)} />)}
        </div>
      )}
    </div>
  )
}

const noop = () => undefined

/** The 16:10 photo box is at least ~180 px tall at the narrowest layouts; a 9:16 preview 96 px wide is 170 px tall and fits in all of them. */
const PREVIEW_W = 96
/** The tooltip on "Try again": why it is off, or what it does. A photo that is not on this device cannot be read again, so a retry would only spend the one allowed. */
const RETRY_TITLE = { ok: 'One manual retry, counted; makes a new version and keeps this one', used: 'One manual retry only', gone: 'The photo is not on this device any more' }
/** L6: the flip between the photo and the mini-preview, for touch. */
const FLIP = { showPreview: 'Show preview', showPhoto: 'Show photo' }

/** A ready card (spec v3 L6): the photo, and on mouse hover the mini-preview of what this brick alone makes, in the same 16:10 box. A touch device has no hover, so a small toggle flips photo and preview;
 *  it never follows the card's link. A tap's emulated hover is ignored (only a mouse counts), so the toggle is the one thing that decides on touch. */
function Card({ brick: b, onRetry, onRemove }: { brick: Brick; onRetry: () => void; onRemove: () => void }) {
  const status = b.status ?? 'ready'
  const rules = b.relations.slice(0, 2)
  const busy = status === 'extracting' || status === 'pending'
  const blocked = retryBlocked(b)
  const [hover, setHover] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const preview = status === 'ready' && (hover || flipped)
  const inner = (
    <>
      <div className="relative overflow-hidden" style={{ aspectRatio: '16 / 10', background: '#2a2a2a' }}
        onPointerEnter={e => { if (e.pointerType === 'mouse') setHover(true) }} onPointerLeave={() => setHover(false)}>
        <Photo src={b.photo.url} className={`h-full w-full object-cover ${busy ? 'opacity-50' : ''}`} />
        {status === 'extracting' && <div className="card-progress" />}
        {preview && <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--paper)' }}><MiniPreview params={brickParams(b).params} width={PREVIEW_W} /></div>}
        {status === 'ready' && (
          <button type="button" className="btn absolute bottom-1 right-1 px-2 py-0.5 text-[11px]" aria-pressed={flipped} title="Flip between the photo and what this brick makes on its own"
            onClick={e => { e.preventDefault(); e.stopPropagation(); setFlipped(v => !v) }}>{flipped ? FLIP.showPhoto : FLIP.showPreview}</button>
        )}
      </div>
      <div className="flex flex-col gap-1 px-3 py-2">
        <div className="flex items-center justify-between">
          {/* SB2: one origin line, `saved Jun 21, 2025` or `starter · <credit>`; a starter's credit travels with it here */}
          <span className="ink-2 min-w-0 truncate text-[12px]" title={originLabel(b)}>{originLabel(b)}{(b.version ?? 1) > 1 ? ` · v${b.version}` : ''}</span>
          {status === 'extracting' && <span className="text-[12px]" style={{ color: 'var(--accent)' }}>{COPY.extracting}</span>}
          {status === 'pending' && b.held !== 'limit' && <span className="ink-2 text-[12px]">{COPY.queued}</span>}
          {status === 'unparsed' && <span className="text-[12px]" style={{ color: 'var(--accent)' }}>{COPY.unparsed}</span>}
        </div>
        {status === 'extracting' && <span className="ink-2 text-[11px]">{COPY.measuring}</span>}
        {status === 'pending' && b.held === 'limit' && <span className="ink-2 text-[12px]">{COPY.limit}</span>}
        {status === 'ready' && rules.map(r => (
          <div key={r.id} className="flex items-baseline gap-2 text-[12px]">
            <span className="min-w-0 flex-1 truncate">{r.rule}</span>
            <span className="mono shrink-0 ink-2">→ {r.parameter}</span>
          </div>
        ))}
        {status === 'ready' && rules.length === 0 && <span className="ink-2 text-[12px]">No transferable relation came back.</span>}
        {status === 'unparsed' && (
          <div className="flex items-center gap-2 pt-1">
            <button type="button" className="btn" onClick={e => { e.preventDefault(); onRetry() }} disabled={blocked !== null} title={RETRY_TITLE[blocked ?? 'ok']}>Try again</button>
            <button type="button" className="btn btn-quiet" onClick={e => { e.preventDefault(); onRemove() }}>Remove</button>
            {b.error && <span className="ink-2 truncate text-[11px]" title={b.error}>{b.error}</span>}
          </div>
        )}
      </div>
    </>
  )
  return status === 'ready'
    ? <Link href={`/brick/${b.id}`} className="panel block overflow-hidden no-underline" style={{ color: 'inherit' }}>{inner}</Link>
    : <div className="panel overflow-hidden">{inner}</div>
}
