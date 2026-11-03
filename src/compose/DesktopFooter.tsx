import { useRef, useState } from 'react'
import { Link } from '../lib/router'
import { useStore } from '../lib/store'
import { readSync, openLink, shareLink, canShare, runSync, generateCode, type SyncInfo } from '../lib/syncClient'

const COPY = {
  open: 'Open on desktop to compose',
  syncing: 'Uploading this library and project…',
  making: 'Making a code and uploading this library…',
  copied: 'Link copied. Paste it in a desktop browser.',
  ready: 'Link ready: copy or share it.',
  shared: 'Link shared.',
  failed: 'Could not copy; select the link above.',
  what: 'Uploads this library and project under its code, then gives you a link that opens this project on another device.',
  noCode: 'No code yet: the first tap makes one and uploads the library (see Sync).',
}

/** The sticky footer of the phone routes. Compose is desktop-only, so the phone hands over a /open?code= link. Every tap syncs first,
 *  so the project and its bricks are under the code before the link leaves the phone. Copy and Share then run in their own tap:
 *  iOS Safari only allows them inside a user gesture, which a network round trip would outlast. */
export function DesktopFooter({ projectId }: { projectId: string }) {
  const store = useStore()
  const [info, setInfo] = useState<SyncInfo | null>(() => readSync())
  const pending = useRef<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const prepare = async () => {
    // a failed first upload keeps its code for the retry instead of making a new one
    const code = info?.code ?? (pending.current ??= generateCode())
    setBusy(true); setNote(info?.code ? COPY.syncing : COPY.making)
    try {
      const { info: next } = await runSync(code, store)
      setInfo(next); pending.current = null
      const url = openLink(next.code, projectId)
      setLink(url)
      // works where the browser still counts the tap (desktop, Android); otherwise the Copy button below does it
      navigator.clipboard.writeText(url).then(() => setNote(COPY.copied), () => setNote(COPY.ready))
    } catch (e) { setNote((e as Error).message) } finally { setBusy(false) }
  }
  const onCopy = () => { if (link) navigator.clipboard.writeText(link).then(() => setNote(COPY.copied), () => setNote(COPY.failed)) }
  const onShare = () => { if (link) shareLink(link).then(r => { if (r === 'shared') setNote(COPY.shared); else if (r === 'copied') setNote(COPY.copied); else if (r === 'failed') setNote(COPY.failed) }) }

  return (
    <footer className="fixed inset-x-0 bottom-0 border-t hairline" style={{ background: 'var(--panel)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-2">
        <button type="button" className={`btn ${link ? '' : 'btn-accent'}`} disabled={busy} onClick={prepare} title={COPY.what}>{COPY.open}</button>
        {link && <button type="button" className="btn btn-accent" onClick={onCopy}>Copy link</button>}
        {link && canShare() && <button type="button" className="btn" onClick={onShare} aria-label="Share the link to open this project on another device">Share</button>}
        {link && <input readOnly value={link} onFocus={e => e.currentTarget.select()} className="mono w-full rounded border px-2 py-1 text-[11px] hairline" style={{ background: 'var(--paper)', color: 'var(--ink)' }} aria-label="Link to open this project on another device" />}
        <span className="ink-2 w-full text-[11px]" role="status" aria-live="polite">{note ?? (info?.code ? <>code <span className="mono">{info.code}</span> · <Link href="/sync">Sync</Link></> : COPY.noCode)}</span>
      </div>
    </footer>
  )
}
