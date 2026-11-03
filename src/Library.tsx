import { useRef, useState } from 'react'
import { useStore, LIBRARY_CAP } from './lib/store'
import { ACCEPT, prepareImage } from './lib/client'
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
  hint: "Add anything you like the look of. You don't need to know what it's for.",
  extracting: 'Reading… usually 15–25 s',
  /** Second line under the extracting state: what the reading is, said plainly (spec v3 L6). */
  measuring: 'Measuring ratios, shares and hues. Not tagging.',
  queued: 'Queued',
  /** L11: the server's daily or hourly limit; the photo stays pending and is read on a later open. */
  limit: 'Daily reading limit reached. Your photo is saved and will be read later.',
  offline: (waiting: number) => `Offline · ${waiting} waiting`,
  unparsed: "Couldn't read this one.",
  /** L9: the phone line under the header; the link keeps the phone's way to a project's Preview and Instructions. */
  composePhone: 'Compose needs a wider screen. Your library is here on your phone.',
  phoneProjects: 'Projects →',
  full: `The library holds ${LIBRARY_CAP} bricks. Remove one to add another.`,
  /** L7 and SB4: under the empty state; the starters are built in and persistent, and they step aside as the library fills. */
  starters: 'These are starters. Yours replace them as you save.',
  startersHidden: 'Starters are hidden.',
  showStarters: 'Show starters',
  /** SB3: the toggle that hides every starter (also on the Projects form). */
  includeStarters: 'Include starters',
  includeTitle: 'Starters fill your proposals only while you have fewer than three bricks of your own.',
}

/** Library: collect photos over time; see what was extracted. Adding never asks for an intent.
 *  `Shoot` opens the camera (PRD L2); `Add from library` takes several photos at once (L3); the store's queue sends them two at a time (L5). */
export function Library() {
  const store = useStore()
  const shoot = useRef<HTMLInputElement>(null)
  const pick = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // L7: the Library is the person's own bricks; the starters show only while there are none (below), and Saved counts the own ones
  const live = store.bricks.filter(b => originOf(b) === 'own' && !b.superseded_by)
  const newestFirst = (list: Brick[]) => [...list].sort((a, b) => (b.saved_at > a.saved_at ? 1 : b.saved_at < a.saved_at ? -1 : 0))
  const bricks = newestFirst(live)
  const starters = newestFirst(store.bricks.filter(b => originOf(b) === 'starter'))
  const reading = live.filter(b => b.status === 'pending' || b.status === 'extracting').length
  const waiting = live.filter(b => b.status === 'pending').length

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return
    setNotice(null)
    for (const file of Array.from(files)) {
      let prepared
      try { prepared = await prepareImage(file) } catch (e) { setNotice(`Could not read ${file.name}: ${(e as Error).message}`); continue }
      const brick: Brick = {
        id: `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, photo: { url: prepared.dataUrl, width: prepared.width, height: prepared.height },
        saved_at: new Date().toISOString().slice(0, 10), ...(prepared.takenAt ? { taken_at: prepared.takenAt } : {}), origin: 'own', status: 'pending', retries: 0, version: 1,
        measurements: [], hypotheses: [], relations: [], regions: [], fragile_if_changed: '',
        model: { id: 'muse-spark-1.3', effort: 'medium', latency_ms: 0, input_tokens: 0, output_tokens: 0 },
      }
      if (!store.addBrick(brick)) { setNotice(COPY.full); break }
      store.enqueue(brick.id)
    }
  }

  return (
    <div className="chrome min-h-full">
      <header className="flex items-center gap-3 border-b px-4 py-2 hairline" style={{ background: 'var(--panel)' }}>
        <Link href="/" className="font-semibold no-underline" style={{ color: 'var(--ink)' }}>Tearsheet</Link>
        <span className="ink-2 mono min-w-0 truncate text-[12px]" aria-live="polite">{store.online ? `Saved ${live.length}${reading ? ` · reading ${reading}` : ''}` : COPY.offline(waiting)}</span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link href="/sync" className="btn btn-quiet" title="Show this library's code, or enter one">Sync</Link>
          <Link href="/projects" className="btn btn-quiet hidden sm:inline-block">Projects</Link>
          <button type="button" className="btn whitespace-nowrap" onClick={() => pick.current?.click()}>Add from library</button>
          <button type="button" className="btn btn-accent whitespace-nowrap" onClick={() => shoot.current?.click()}>Shoot</button>
          {/* L2: capture opens the camera directly on iOS. L3: multiple, no capture, for the camera roll. Never list heic (L3). */}
          <input ref={shoot} type="file" accept={ACCEPT} capture="environment" className="hidden" onChange={e => { onFiles(e.target.files); e.target.value = '' }} />
          <input ref={pick} type="file" accept={ACCEPT} multiple className="hidden" onChange={e => { onFiles(e.target.files); e.target.value = '' }} />
        </div>
      </header>
      <div className="sm:hidden px-4 py-1 text-[12px] ink-2" style={{ borderBottom: '1px solid var(--line)' }}>{COPY.composePhone} <Link href="/projects">{COPY.phoneProjects}</Link></div>

      {bricks.length > 0 && (
        <label className="ink-2 flex items-center gap-2 px-4 py-1 text-[12px]" style={{ borderBottom: '1px solid var(--line)' }} title={COPY.includeTitle}>
          <input type="checkbox" checked={store.showStarters} onChange={e => store.setShowStarters(e.target.checked)} />{COPY.includeStarters}
        </label>
      )}

      {notice && <div className="mx-4 mt-3 rounded px-3 py-2 text-[12px]" style={{ background: 'var(--panel)', border: '1px solid var(--accent)' }}>{notice}</div>}

      {bricks.length === 0 ? (
        <>
          <div className="mx-auto max-w-md px-4 pt-12 text-center">
            <h1>{COPY.empty}</h1>
            <p className="ink-2 mt-2">{COPY.hint}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button type="button" className="btn btn-accent" onClick={() => shoot.current?.click()}>Shoot</button>
              <button type="button" className="btn" onClick={() => pick.current?.click()}>Add from library</button>
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
