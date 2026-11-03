import { useRef, useState } from 'react'
import { useStore, LIBRARY_CAP } from './lib/store'
import { ACCEPT, prepareImage } from './lib/client'
import { Link } from './lib/router'
import { Photo } from './bricks/Photo'
import type { Brick } from './lib/types'

const COPY = {
  empty: 'Nothing saved yet.',
  hint: "Add a photo of anything you like the look of. You don't need to know what it's for.",
  extracting: 'Reading… usually 15–25 s',
  /** Second line under the extracting state: what the reading is, said plainly (spec v3 L6). */
  measuring: 'Measuring ratios, shares and hues. Not tagging.',
  queued: 'Queued',
  /** L11: the server's daily or hourly limit; the photo stays pending and is read on a later open. */
  limit: 'Daily reading limit reached. Your photo is saved and will be read later.',
  offline: (waiting: number) => `Offline · ${waiting} waiting`,
  unparsed: "Couldn't read this one.",
  composePhone: 'Open on a larger screen to compose.',
  phoneProjects: 'Projects open here as preview and instructions.',
  full: `The library holds ${LIBRARY_CAP} bricks. Remove one to add another.`,
}

/** Library: collect photos over time; see what was extracted. Adding never asks for an intent.
 *  `Shoot` opens the camera (PRD L2); `Add from library` takes several photos at once (L3); the store's queue sends them two at a time (L5). */
export function Library() {
  const store = useStore()
  const shoot = useRef<HTMLInputElement>(null)
  const pick = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const live = store.bricks.filter(b => !b.superseded_by)
  const bricks = [...live].sort((a, b) => (b.saved_at > a.saved_at ? 1 : b.saved_at < a.saved_at ? -1 : 0))
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
        saved_at: new Date().toISOString().slice(0, 10), status: 'pending', retries: 0, version: 1,
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

      {notice && <div className="mx-4 mt-3 rounded px-3 py-2 text-[12px]" style={{ background: 'var(--panel)', border: '1px solid var(--accent)' }}>{notice}</div>}

      {bricks.length === 0 ? (
        <div className="mx-auto max-w-md px-4 pt-20 text-center">
          <h1>{COPY.empty}</h1>
          <p className="ink-2 mt-2">{COPY.hint}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-accent" onClick={() => shoot.current?.click()}>Shoot</button>
            <button type="button" className="btn" onClick={() => pick.current?.click()}>Add from library</button>
            <button type="button" className="btn" onClick={() => store.loadSamples()}>Load sample library</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bricks.map(b => <Card key={b.id} brick={b} onRetry={() => store.retry(b.id)} onRemove={() => store.removeBrick(b.id)} />)}
        </div>
      )}
    </div>
  )
}

function Card({ brick: b, onRetry, onRemove }: { brick: Brick; onRetry: () => void; onRemove: () => void }) {
  const status = b.status ?? 'ready'
  const rules = b.relations.slice(0, 2)
  const busy = status === 'extracting' || status === 'pending'
  const inner = (
    <>
      <div className="relative overflow-hidden" style={{ aspectRatio: '16 / 10', background: '#2a2a2a' }}>
        <Photo src={b.photo.url} className={`h-full w-full object-cover ${busy ? 'opacity-50' : ''}`} />
        {status === 'extracting' && <div className="card-progress" />}
      </div>
      <div className="flex flex-col gap-1 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="ink-2 text-[12px]">saved {b.saved_at}{(b.version ?? 1) > 1 ? ` · v${b.version}` : ''}</span>
          {status === 'extracting' && <span className="text-[12px]" style={{ color: 'var(--accent)' }}>{COPY.extracting}</span>}
          {status === 'pending' && b.held !== 'limit' && <span className="ink-2 text-[12px]">{COPY.queued}</span>}
          {status === 'unparsed' && <span className="text-[12px]" style={{ color: 'var(--accent)' }}>{COPY.unparsed}</span>}
        </div>
        {status === 'extracting' && <span className="ink-2 text-[11px]">{COPY.measuring}</span>}
        {status === 'pending' && b.held === 'limit' && <span className="ink-2 text-[12px]">{COPY.limit}</span>}
        {b.credit && <span className="ink-2 truncate text-[11px]" title={b.credit}>{b.credit}</span>}
        {status === 'ready' && rules.map(r => (
          <div key={r.id} className="flex items-baseline gap-2 text-[12px]">
            <span className="min-w-0 flex-1 truncate">{r.rule}</span>
            <span className="mono shrink-0 ink-2">→ {r.parameter}</span>
          </div>
        ))}
        {status === 'ready' && rules.length === 0 && <span className="ink-2 text-[12px]">No transferable relation came back.</span>}
        {status === 'unparsed' && (
          <div className="flex items-center gap-2 pt-1">
            <button type="button" className="btn" onClick={e => { e.preventDefault(); onRetry() }} disabled={(b.retries ?? 0) >= 1} title={(b.retries ?? 0) >= 1 ? 'One manual retry only' : 'One manual retry, counted; makes a new version and keeps this one'}>Try again</button>
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
