import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { useStore } from './lib/store'
import { retryBlocked } from './lib/queue'
import { Photo } from './bricks/Photo'
import { tileFit } from './lib/photoFit'
import { BrickSheet } from './bricks/BrickSheet'
import { RETRY_TITLE } from './bricks/retryCopy'
import { cardCaption, dateLine, issueParts } from './lib/brickLabels'
import { labelsOfBrick } from './lib/shortLabels'
import { originOf } from './lib/starters'
import { Reseau } from './bricks/Reseau'
import { TITLE_TEAR } from './brand/tornEdge'
import type { Brick } from './lib/types'

const COPY = {
  title: 'Library',
  empty: 'Nothing saved yet.',
  /** The card's state is on the photo (a thin line, a `!`); these words are its tooltip and its name for a screen reader. */
  extracting: 'Reading… usually 15–25 s. Measuring ratios, shares and hues. Not tagging.',
  queued: 'Queued',
  /** L11: the server's daily or hourly limit; the photo stays pending and is read on a later open. */
  limit: 'Daily reading limit reached. Your photo is saved and will be read later.',
  offline: 'Offline. Your photo is saved and will be read when you are back online.',
  unparsed: "Couldn't read this one",
  retry: 'Try again',
  /** Measured drawing: the tag on a photo while Spark reads it, with the réseau over the photo and the line under it in ultramarine */
  reading: 'READING',
  open: (title: string, date: string) => `Open ${title}, ${date}`,
  /** L7 and SB4: the starters are built in and persistent, and they step aside as the library fills. Said once, in the issue line, with their count. */
  starterCount: (n: number) => `${n} starter ${n === 1 ? 'photo' : 'photos'}`,
  startersHidden: 'Starters are hidden.',
  showStarters: 'Show starters',
}

/** Library (15_SIMPLIFY §2): a grid of photos, each with its two-line caption (`cardCaption`) and nothing else. Tapping one opens the Brick sheet. Adding never asks for an intent:
 *  `Shoot` is in the header (PRD L2), `Add from library` takes several photos at once (L3), and the store's queue sends them two at a time (L5). */
export function Library() {
  const store = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  // L7: the Library is the person's own bricks; the starters show only while there are none (below)
  const live = store.bricks.filter(b => originOf(b) === 'own' && !b.superseded_by)
  const newestFirst = (list: Brick[]) => [...list].sort((a, b) => (b.saved_at > a.saved_at ? 1 : b.saved_at < a.saved_at ? -1 : 0))
  const bricks = newestFirst(live)
  const starters = newestFirst(store.bricks.filter(b => originOf(b) === 'starter'))
  // a removed brick closes its sheet; so does a retry, which supersedes it
  const selected = openId ? store.bricks.find(b => b.id === openId && !b.superseded_by) ?? null : null
  // from the tablet up, a card's photo grows into the sheet's (a view transition, tokens.css "motion"); elsewhere, or with motion unwelcome, the sheet just opens
  const openCard = (id: string, from?: HTMLElement | null) => {
    const doc = document as Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } }
    const img = from?.querySelector('img')
    if (!img || !doc.startViewTransition || !matchMedia('(min-width: 768px)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return setOpenId(id)
    img.style.viewTransitionName = 'photo'
    const t = doc.startViewTransition(() => {
      img.style.viewTransitionName = ''
      flushSync(() => setOpenId(id))
      const sheet = document.querySelector<HTMLDialogElement>('dialog.sheet-side[open]')
      sheet?.classList.add('is-morphing')
      const to = sheet?.querySelector<HTMLElement>('.sheet-photo img')
      if (to) to.style.viewTransitionName = 'photo'
    })
    t.finished.finally(() => {
      const sheet = document.querySelector<HTMLDialogElement>('dialog.sheet-side')
      sheet?.classList.remove('is-morphing')
      const to = sheet?.querySelector<HTMLElement>('.sheet-photo img')
      if (to) to.style.viewTransitionName = ''
    })
  }

  // ← → step through the photos the grid shows, in its order, while the sheet is open (Malik, 2026-11-04: the desktop's keys); a photo still being read has no sheet
  const shown = (bricks.length === 0 && store.showStarters ? starters : bricks).filter(b => b.status !== 'extracting' && b.status !== 'pending')
  useEffect(() => {
    if (!openId) return
    const keys = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement | null)?.closest('input, textarea, select')) return
      const at = shown.findIndex(b => b.id === openId), next = shown[at + (e.key === 'ArrowRight' ? 1 : -1)]
      if (at < 0 || !next) return
      e.preventDefault(); setOpenId(next.id)
    }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [openId, shown])

  // C+D (DESIGN_SYSTEM.md §7, §12.3–4): the masthead sits in the same .gutter as the grid, so LIBRARY's ink and the grid share one left edge
  return (
    <div className="chrome min-h-full">
      <div className="gutter pb-8">
        <Masthead bricks={bricks} starters={store.showStarters ? starters.length : 0} />
        {bricks.length === 0 ? (
          store.showStarters ? (
            // the masthead already says what these are and how many (Malik, 2026-11-03: no bare "0 photos")
            <section aria-label="Starters"><Grid bricks={starters} onOpen={openCard} /></section>
          ) : (
            <div>
              <p className="empty-line">{COPY.empty}</p>
              <p className="ink-2">{COPY.startersHidden}</p>
              <button type="button" className="btn mt-2" onClick={() => store.setShowStarters(true)}>{COPY.showStarters}</button>
            </div>
          )
        ) : (
          <Grid bricks={bricks} onOpen={openCard} />
        )}
      </div>
      <BrickSheet brick={selected} onClose={() => setOpenId(null)} />
    </div>
  )
}

/** The tear under the masthead (tokens.css .masthead): the clip and the fibre, in the masthead's em, so they scale with LIBRARY. */
const TEAR_VARS = { '--tear': TITLE_TEAR.clip, '--rim-clip': TITLE_TEAR.rim, '--tear-above': TITLE_TEAR.above, '--tear-height': TITLE_TEAR.height } as CSSProperties

/** The loud Library's masthead (C+D §12.3): LIBRARY in display type and the count, on a phone simply on one baseline, from the tablet up as the front
 *  page's poster with the count in white on a graphite block and a torn bottom (Malik, 2026-11-04). The issue line is for a screen reader only.
 *  The block counts what the grid shows and names it (Malik, 2026-11-03: a bare "0" beside twelve photos said nothing): the person's own photos and since
 *  when (the earliest date a card shows, so a photo's EXIF date counts), or, before there are any, the starters standing in for them. */
function Masthead({ bricks, starters }: { bricks: Brick[]; starters: number }) {
  const first = bricks.map(b => b.taken_at ?? b.saved_at).sort()[0]
  const own = bricks.length, startersShown = own === 0 && starters > 0
  const parts = startersShown ? { count: COPY.starterCount(starters), since: '' } : issueParts(own, first)
  return (
    <section aria-label={COPY.title}>
      <div className="masthead-wrap" style={TEAR_VARS}>
        <div className="masthead">
          <h1 className="display">{COPY.title}</h1>
          <div className="count-block" aria-hidden="true"><span className="display tnum">{startersShown ? starters : own}</span></div>
        </div>
        <span className="masthead-rim" aria-hidden="true" />
      </div>
      {/* names the count for a screen reader (Malik, 2026-11-03): "12 starter photos", or "14 photos" and since when */}
      <p className="issue-line" id="library-count">
        <span className="issue-count">{parts.count}</span>
        {parts.since && <span className="issue-since">{parts.since}</span>}
      </p>
    </section>
  )
}

function Grid({ bricks, onOpen }: { bricks: Brick[]; onOpen: (id: string, from?: HTMLElement | null) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {bricks.map(b => <Card key={b.id} brick={b} onOpen={onOpen} />)}
    </ul>
  )
}

/** What a waiting card's thin line means, as its tooltip. */
function waitingTip(b: Brick): string {
  if (b.status === 'extracting') return COPY.extracting
  return b.held === 'limit' ? COPY.limit : b.held === 'offline' ? COPY.offline : COPY.queued
}

/** One card (15_SIMPLIFY §2): the photo and its two-line caption. The state is on the photo: a thin line while it waits or is read (no text), a small `!` when it could not be read,
 *  which opens "Couldn't read this one · Try again". A read or failed card is a link to `/brick/:id` that opens the Brick sheet in place (a new tab still gets the page). */
function Card({ brick: b, onOpen }: { brick: Brick; onOpen: (id: string, from?: HTMLElement | null) => void }) {
  const store = useStore()
  const status = b.status ?? 'ready'
  const busy = status === 'extracting' || status === 'pending'
  const reading = status === 'extracting'   // being read now; a pending photo is only queued or held
  const blocked = retryBlocked(b)
  const date = dateLine(b), cap = cardCaption(b, labelsOfBrick(b, 1)[0]?.label ?? null)
  const [alert, setAlert] = useState(false)
  const root = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (!alert) return
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setAlert(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAlert(false) }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', esc) }
  }, [alert])

  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    onOpen(b.id, e.currentTarget)
  }
  const photo = <Photo src={b.photo.url} className={`h-full w-full object-cover ${busy ? 'opacity-60' : ''}`} style={tileFit(b.photo, 4 / 5)} />   // .card-tile is 4:5
  return (
    <li ref={root} className="relative min-w-0">
      {busy ? (
        <div className="card-tile" role="img" aria-label={`${waitingTip(b)} ${cap.title}, ${date}`} title={waitingTip(b)} data-reading={reading || undefined}>
          {photo}
          {reading && <><Reseau /><span className="reading-tag" aria-hidden="true">{COPY.reading}</span></>}
          <div className="card-progress" data-held={b.status === 'pending' && b.held ? b.held : undefined} />
        </div>
      ) : (
        <a href={`/brick/${b.id}`} className="card-tile" aria-label={COPY.open(cap.title, date)} onClick={open}>{photo}</a>
      )}
      {status === 'unparsed' && (
        <button type="button" className="alert-badge" aria-label={COPY.unparsed} title={COPY.unparsed} aria-expanded={alert} onClick={() => setAlert(v => !v)}>!</button>
      )}
      {alert && (
        <div className="alert-pop" role="status">
          <span>{COPY.unparsed}</span><span aria-hidden className="ink-2">·</span>
          <button type="button" className="underline" style={{ font: 'inherit', background: 'none', border: 0, padding: 0, color: 'var(--ink)', cursor: blocked ? 'default' : 'pointer', opacity: blocked ? 0.5 : 1 }}
            disabled={blocked !== null} title={RETRY_TITLE[blocked ?? 'ok']} onClick={() => { setAlert(false); store.retry(b.id) }}>{COPY.retry}</button>
        </div>
      )}
      {/* two lines, as on every card (Malik, 2026-11-03): what the photo is, then whose or when (its frame id is Details' alone, Malik 2026-11-04). The full
          credit is its hover and the Brick sheet's. The id lets a capture name the caption exactly */}
      <p className="card-caption" id={`caption-${b.id}`} title={date}>
        <span className="cap-title">{cap.title}</span>
        <span className="cap-line tnum">{cap.line}</span>
      </p>
    </li>
  )
}
