import { useRef, useState } from 'react'
import { useStore, LIBRARY_CAP } from './lib/store'
import { ACCEPT, extractBrick, prepareImage } from './lib/client'
import { Link } from './lib/router'
import { Photo } from './bricks/Photo'
import type { Brick } from './lib/types'

const COPY = {
  empty: 'Nothing saved yet.',
  hint: "Add a photo of anything you like the look of. You don't need to know what it's for.",
  extracting: 'Reading… usually 15–25 s',
  unparsed: "Couldn't read this one.",
  composePhone: 'Compose needs a wider screen. Your library is here on your phone.',
  full: `The library holds ${LIBRARY_CAP} bricks. Remove one to add another.`,
}

/** Library: collect photos over time; see what was extracted. Adding never asks for an intent. */
export function Library() {
  const store = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const bricks = [...store.bricks].sort((a, b) => (b.saved_at > a.saved_at ? 1 : b.saved_at < a.saved_at ? -1 : 0))

  const extract = async (brick: Brick, prepared: { dataUrl: string; width: number; height: number }) => {
    const { brick: done, result } = await extractBrick(prepared)
    if ('dry' in result) return
    if (!result.ok || !done) {
      store.updateBrick(brick.id, { status: 'unparsed', error: result.ok ? 'No brick came back.' : result.error })
      return
    }
    store.updateBrick(brick.id, { ...done, id: brick.id, saved_at: brick.saved_at, status: 'ready', prompt_version: 'v3' })
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setNotice(null)
    let prepared
    try { prepared = await prepareImage(file) } catch (e) { setNotice(`Could not read ${file.name}: ${(e as Error).message}`); return }
    const brick: Brick = {
      id: `b_${Date.now().toString(36)}`, photo: { url: prepared.dataUrl, width: prepared.width, height: prepared.height },
      saved_at: new Date().toISOString().slice(0, 10), status: 'extracting', retries: 0,
      measurements: [], hypotheses: [], relations: [], regions: [], fragile_if_changed: '',
      model: { id: 'muse-spark-1.3', effort: 'medium', latency_ms: 0, input_tokens: 0, output_tokens: 0 },
    }
    if (!store.addBrick(brick)) { setNotice(COPY.full); return }
    await extract(brick, prepared)
  }

  const retry = async (b: Brick) => {
    if ((b.retries ?? 0) >= 1) return
    store.updateBrick(b.id, { status: 'extracting', error: undefined, retries: (b.retries ?? 0) + 1 })
    await extract({ ...b, retries: (b.retries ?? 0) + 1 }, { dataUrl: b.photo.url, width: b.photo.width, height: b.photo.height })
  }

  return (
    <div className="chrome min-h-full">
      <header className="flex items-center gap-3 border-b px-4 py-2 hairline" style={{ background: 'var(--panel)' }}>
        <Link href="/" className="font-semibold no-underline" style={{ color: 'var(--ink)' }}>Tearsheet</Link>
        <span className="ink-2 hidden sm:inline">{bricks.length} {bricks.length === 1 ? 'brick' : 'bricks'}</span>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/projects" className="btn btn-quiet hidden sm:inline-block">Projects</Link>
          <button type="button" className="btn btn-accent" onClick={() => input.current?.click()}>Add photo</button>
          <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </header>
      <div className="sm:hidden px-4 py-1 text-[12px] ink-2" style={{ borderBottom: '1px solid var(--line)' }}>{COPY.composePhone}</div>

      {notice && <div className="mx-4 mt-3 rounded px-3 py-2 text-[12px]" style={{ background: 'var(--panel)', border: '1px solid var(--accent)' }}>{notice}</div>}

      {bricks.length === 0 ? (
        <div className="mx-auto max-w-md px-4 pt-20 text-center">
          <h1>{COPY.empty}</h1>
          <p className="ink-2 mt-2">{COPY.hint}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" className="btn btn-accent" onClick={() => input.current?.click()}>Add photo</button>
            <button type="button" className="btn" onClick={() => store.loadSamples()}>Load sample library</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bricks.map(b => <Card key={b.id} brick={b} onRetry={() => retry(b)} onRemove={() => store.removeBrick(b.id)} />)}
        </div>
      )}
    </div>
  )
}

function Card({ brick: b, onRetry, onRemove }: { brick: Brick; onRetry: () => void; onRemove: () => void }) {
  const status = b.status ?? 'ready'
  const rules = b.relations.slice(0, 2)
  const inner = (
    <>
      <div className="relative overflow-hidden" style={{ aspectRatio: '16 / 10', background: '#2a2a2a' }}>
        <Photo src={b.photo.url} className={`h-full w-full object-cover ${status === 'extracting' ? 'opacity-50' : ''}`} />
        {status === 'extracting' && <div className="card-progress" />}
      </div>
      <div className="flex flex-col gap-1 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="ink-2 text-[12px]">saved {b.saved_at}</span>
          {status === 'extracting' && <span className="text-[12px]" style={{ color: 'var(--accent)' }}>{COPY.extracting}</span>}
          {status === 'unparsed' && <span className="text-[12px]" style={{ color: 'var(--accent)' }}>{COPY.unparsed}</span>}
        </div>
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
            <button type="button" className="btn" onClick={e => { e.preventDefault(); onRetry() }} disabled={(b.retries ?? 0) >= 1} title={(b.retries ?? 0) >= 1 ? 'One manual retry only' : 'One manual retry, counted'}>Try again</button>
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
