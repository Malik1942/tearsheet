import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useStore } from './lib/store'
import { retryBlocked } from './lib/queue'
import { Photo } from './bricks/Photo'
import { BrickSheet } from './bricks/BrickSheet'
import { RETRY_TITLE } from './bricks/retryCopy'
import { dateLine, issueLine, shortOriginLine } from './lib/brickLabels'
import { originOf } from './lib/starters'
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
  open: (date: string) => `Open photo, ${date}`,
  /** L7 and SB4: the starters are built in and persistent, and they step aside as the library fills. Said once, in the issue line, with their count. */
  starterLine: (n: number) => `${n} ${n === 1 ? 'starter' : 'starters'} · yours replace them as you save`,
  startersHidden: 'Starters are hidden.',
  showStarters: 'Show starters',
}

/** Library (15_SIMPLIFY §2): a grid of photos, each with one date line and nothing else. Tapping one opens the Brick sheet. Adding never asks for an intent:
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

  // C+D (DESIGN_SYSTEM.md §7, §12.3–4): the masthead sits in the same .gutter as the grid, so LIBRARY's ink and the grid share one left edge
  return (
    <div className="chrome min-h-full">
      <div className="gutter pb-8">
        <Masthead bricks={bricks} starters={store.showStarters ? starters.length : 0} />
        {bricks.length === 0 ? (
          store.showStarters ? (
            // the masthead already says what these are and how many (Malik, 2026-11-03: no bare "0 photos")
            <section aria-label="Starters"><Grid bricks={starters} onOpen={setOpenId} /></section>
          ) : (
            <div>
              <p className="empty-line">{COPY.empty}</p>
              <p className="ink-2">{COPY.startersHidden}</p>
              <button type="button" className="btn mt-2" onClick={() => store.setShowStarters(true)}>{COPY.showStarters}</button>
            </div>
          )
        ) : (
          <Grid bricks={bricks} onOpen={setOpenId} />
        )}
      </div>
      <BrickSheet brick={selected} onClose={() => setOpenId(null)} />
    </div>
  )
}

/** The loud Library's masthead (C+D §12.3): LIBRARY in display type, the count on the one red block, and the issue line under it with real counts only.
 *  The block counts what the grid shows and names it (Malik, 2026-11-03: a bare "0" beside twelve photos said nothing): the person's own photos and since
 *  when (the earliest date a card shows, so a photo's EXIF date counts), or, before there are any, the starters standing in for them. */
function Masthead({ bricks, starters }: { bricks: Brick[]; starters: number }) {
  const first = bricks.map(b => b.taken_at ?? b.saved_at).sort()[0]
  const own = bricks.length, startersShown = own === 0 && starters > 0
  return (
    <section aria-label={COPY.title}>
      <div className="masthead">
        <h1 className="display">{COPY.title}</h1>
        <div className="count-block" aria-hidden="true"><span className="display tnum">{startersShown ? starters : own}</span></div>
      </div>
      <p className="issue-line"><span>{startersShown ? COPY.starterLine(starters) : issueLine(own, first)}</span></p>
    </section>
  )
}

function Grid({ bricks, onOpen }: { bricks: Brick[]; onOpen: (id: string) => void }) {
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

/** One card (15_SIMPLIFY §2): the photo and its date line. The state is on the photo: a thin line while it waits or is read (no text), a small `!` when it could not be read,
 *  which opens "Couldn't read this one · Try again". A read or failed card is a link to `/brick/:id` that opens the Brick sheet in place (a new tab still gets the page). */
function Card({ brick: b, onOpen }: { brick: Brick; onOpen: (id: string) => void }) {
  const store = useStore()
  const status = b.status ?? 'ready'
  const busy = status === 'extracting' || status === 'pending'
  const blocked = retryBlocked(b)
  const date = dateLine(b)
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
    onOpen(b.id)
  }
  const photo = <Photo src={b.photo.url} className={`h-full w-full object-cover ${busy ? 'opacity-60' : ''}`} />
  return (
    <li ref={root} className="relative min-w-0">
      {busy ? (
        <div className="card-tile" role="img" aria-label={`${waitingTip(b)} ${date}`} title={waitingTip(b)}>
          {photo}
          <div className="card-progress" data-held={b.status === 'pending' && b.held ? b.held : undefined} />
        </div>
      ) : (
        <a href={`/brick/${b.id}`} className="card-tile" aria-label={COPY.open(date)} onClick={open}>{photo}</a>
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
      {/* the short credit ("Mia, 1923"), as on the swap sheet, so an institution's name is never cut; the full credit is its hover and the Brick sheet's */}
      <div className="caption ink-2 mt-2 truncate" title={date}>{shortOriginLine(b)}</div>
    </li>
  )
}
