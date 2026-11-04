import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { useStore } from '../lib/store'
import { ownBricks } from '../lib/starters'
import { readSync, writeSync, generateCode, normalizeCode, CODE_RE, forget, inlineBlobPhotos, runSync, openLink, shareLink, canShare, type SyncInfo } from '../lib/syncClient'

const COPY = {
  title: 'Sync',
  noCode: 'This library has no code yet.',
  noCodeHint: 'A code puts this library on another device. Nothing else is shared: no account, no listing. Anyone with the code can open it.',
  make: 'Make a code and upload',
  enter: 'Enter a code from another device',
  use: 'Open that library',
  yours: 'Your code',
  show: 'Open Tearsheet on the other device, tap Sync, and enter this code or scan it.',
  syncNow: 'Sync now',
  forget: 'Forget this code',
  forgetConfirm: 'Delete everything stored under this code? Bricks stay on this device; other devices lose the link.',
  forgotten: 'The code and everything under it were deleted. This device keeps its bricks.',
  busy: 'Syncing…',
  bad: 'A code is six characters from A–Z and 2–9.',
  share: 'Share link',
  copy: 'Copy link',
  copied: 'Link copied. Open it on the other device.',
  copyFailed: 'Could not copy the link; the code above works too.',
}

/** Sync (PRD 7.3): the code is the only key. Pull first, then upload what the store does not hold; merge by id, newest version wins. */
export function SyncScreen() {
  const store = useStore()
  const [info, setInfo] = useState<SyncInfo | null>(() => readSync())
  const [entry, setEntry] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const fromUrl = new URLSearchParams(location.search).get('code')
  const live = ownBricks(store.bricks).filter(b => b.status !== 'extracting')   // the starters ship with Tearsheet and are not under the code

  const save = (next: SyncInfo | null) => { writeSync(next); setInfo(next) }

  const run = async (code: string, label = COPY.busy) => {
    setBusy(label); setNotice(null); setProgress(null)
    try {
      const { info: next, live: n, got } = await runSync(code, store, (sent, total) => setProgress({ sent, total }))
      setInfo(next)
      setNotice(`${n} ${n === 1 ? 'brick' : 'bricks'} under ${code}${got ? ` · ${got} ${got === 1 ? 'item' : 'items'} new or updated here` : ''}.`)
    } catch (e) {
      setNotice((e as Error).message)
    } finally { setBusy(null); setProgress(null) }
  }

  // Scanned QR or shared link: /sync?code=XXXXXX adopts that code and syncs at once.
  useEffect(() => {
    if (fromUrl && CODE_RE.test(normalizeCode(fromUrl)) && normalizeCode(fromUrl) !== info?.code) {
      const code = normalizeCode(fromUrl)
      history.replaceState(null, '', '/sync')
      run(code)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!info?.code || !canvas.current) return
    const url = openLink(info.code)
    QRCode.toCanvas(canvas.current, url, { width: 176, margin: 1, color: { dark: '#1A1917', light: '#F4F2EE' } }).catch(() => undefined)
  }, [info?.code])

  const onMake = () => run(generateCode())
  const onShare = async () => {
    if (!info?.code) return
    const r = await shareLink(openLink(info.code))
    if (r === 'copied') setNotice(COPY.copied)
    else if (r === 'failed') setNotice(COPY.copyFailed)
  }
  const onEnter = () => {
    const code = normalizeCode(entry)
    if (!CODE_RE.test(code)) { setNotice(COPY.bad); return }
    setEntry('')
    run(code)
  }
  const onForget = async () => {
    if (!info?.code || !confirm(COPY.forgetConfirm)) return
    setBusy('Deleting…'); setNotice(null)
    try {
      store.replaceBricks(await inlineBlobPhotos(store.bricks))
      await forget(info.code)
      save(null)
      setNotice(COPY.forgotten)
    } catch (e) { setNotice((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <div className="chrome min-h-full">
      <div className="gutter mx-auto w-full max-w-md py-8">
        <h1 className="title mb-4">{COPY.title}</h1>
        {notice && <div className="mb-3 rounded px-3 py-2 text-[12px]" role="status" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>{notice}</div>}
        {busy && <div className="mb-3 text-[12px]" style={{ color: 'var(--ink)' }} aria-live="polite">{busy}{progress && progress.total ? ` uploading ${progress.sent}/${progress.total}` : ''}</div>}

        {info?.code ? (
          <section className="panel p-4">
            <div className="ink-2 text-[12px]">{COPY.yours}</div>
            <div className="mono mt-1 select-all text-[32px] tracking-[0.2em]" style={{ fontSize: 32 }} aria-label={`Library code ${info.code.split('').join(' ')}`}>{info.code}</div>
            <p className="ink-2 mt-2 text-[12px]">{COPY.show}</p>
            <canvas ref={canvas} className="mt-3" width={176} height={176} aria-label={`QR code that opens this library on another device`} />
            <div className="ink-2 mt-3 text-[12px]">
              {live.length} on this device{info.server_count !== undefined ? ` · ${info.server_count} under the code` : ''}{info.last_synced ? ` · synced ${new Date(info.last_synced).toLocaleString()}` : ''}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-accent" disabled={!!busy} onClick={() => run(info.code)}>{COPY.syncNow}</button>
              <button type="button" className="btn" disabled={!!busy} onClick={onShare} title="A link that opens this library on another device">{canShare() ? COPY.share : COPY.copy}</button>
              <button type="button" className="btn btn-quiet" disabled={!!busy} onClick={onForget} title="Deletes the photos and bricks stored under this code">{COPY.forget}</button>
            </div>
          </section>
        ) : (
          <section className="panel p-4">
            <h2>{COPY.noCode}</h2>
            <p className="ink-2 mt-2 text-[12px]">{COPY.noCodeHint}</p>
            <button type="button" className="btn btn-accent mt-4" disabled={!!busy || live.length === 0} onClick={onMake} title={live.length === 0 ? 'Add a photo first' : undefined}>{COPY.make}</button>
          </section>
        )}

        <section className="panel mt-4 p-4">
          <label htmlFor="sync-code" className="ink-2 block text-[12px]">{COPY.enter}</label>
          <div className="mt-2 flex gap-2">
            <input id="sync-code" className="mono w-40 rounded border px-2 py-1 uppercase tracking-[0.2em]" style={{ borderColor: 'var(--line)', background: 'var(--paper)', fontSize: 16 }} value={entry} maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="A B 2 C D 3" onChange={e => setEntry(normalizeCode(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') onEnter() }} />
            <button type="button" className="btn" disabled={!!busy || entry.length !== 6} onClick={onEnter}>{COPY.use}</button>
          </div>
          {info?.code && <p className="ink-2 mt-2 text-[12px]">Entering another code merges that library into this one and switches this device to that code.</p>}
        </section>
      </div>
    </div>
  )
}
