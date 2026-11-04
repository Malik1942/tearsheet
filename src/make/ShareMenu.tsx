import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import type { Project, Resolved } from '../lib/mapRelations'
import { generateCode, push } from '../lib/syncClient'
import { shareCodeFor, shareContent, sharedLink } from '../lib/makeFlow'
import { download, exportCss, exportHandoff, exportJson } from '../export'

/** E1 minimal. false is the 18:30 fallback: the popover offers Download only. */
const SHARE_LINK = true

const COPY = {
  share: 'Share',
  copy: 'Copy link',
  copied: 'Copied',
  making: 'Making the link…',
  noLink: "Couldn't make the link.",
  retry: 'Try again',
  copyFailed: "Couldn't copy.",
  line: 'Opens these screens and the reasons behind them, read-only. The photos in this project go with it; nothing else does.',
  download: 'Download',
}

/** Make's Share. Opening it uploads this project and the photos it uses under the project's own share code (never the library's sync code, which is the
 *  only key to the whole library), so by the time Copy is tapped the read-only link `/shared?code=…&project=…` is ready and the clipboard write runs inside
 *  the tap (iOS). Download gives the three files. `initialOpen`: the older /share and /export routes land with it open. */
export function ShareMenu({ project, resolved, initialOpen = false }: { project: Project; resolved: Resolved; initialOpen?: boolean }) {
  const store = useStore()
  const [open, setOpen] = useState(initialOpen)
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const storeRef = useRef(store); storeRef.current = store

  const prepare = async () => {
    const code = shareCodeFor(project.id, generateCode)
    setBusy(true); setError(null)
    try {
      await push(code, shareContent(project, storeRef.current.bricks), [project])
      setLink(sharedLink(location.origin, code, project.id))
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  // every opening uploads what changed since, so the link always opens the project as it is now; a link made earlier stays usable meanwhile
  useEffect(() => {
    if (!open) return
    setNote(null)
    if (SHARE_LINK && !busy) void prepare()
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', esc) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onCopy = () => { if (link) navigator.clipboard.writeText(link).then(() => setNote(COPY.copied), () => setNote(COPY.copyFailed)) }
  const used = project.brickIds.map(id => store.bricks.find(b => b.id === id)).filter((b): b is NonNullable<typeof b> => !!b)
  const files = [
    ['parameters.json', () => exportJson(project.intent, resolved, project.proposal, project.brickIds), 'application/json'],
    ['tokens.css', () => exportCss(resolved, store.bricks), 'text/css'],
    ['handoff.md', () => exportHandoff(project.intent, used, resolved, project.proposal), 'text/markdown'],
  ] as const

  return (
    <div ref={root} className="relative">
      <button type="button" className="btn btn-accent flex min-h-9 items-center gap-1.5 max-md:min-h-11 max-md:min-w-11 max-md:justify-center" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3" /><path d="M7 8l5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
        <span className="max-md:sr-only">{COPY.share}</span>
      </button>
      {open && (
        <div role="dialog" aria-label={COPY.share} className="menu flex w-[min(320px,calc(100vw-40px))] flex-col gap-1 p-2">
          {SHARE_LINK && (
            <>
              <button type="button" className="btn min-h-9 w-full" disabled={!link} aria-busy={busy && !link} onClick={onCopy}>{note === COPY.copied ? COPY.copied : link ? COPY.copy : busy ? COPY.making : COPY.copy}</button>
              <span className="ink-2 px-1 text-[12px]" role="status" aria-live="polite">
                {(note && note !== COPY.copied ? note : null) ?? (error && !link ? <>{COPY.noLink} <button type="button" className="cursor-pointer border-0 bg-transparent p-0 underline" style={{ color: 'inherit', font: 'inherit' }} disabled={busy} title={error} onClick={() => void prepare()}>{COPY.retry}</button></> : COPY.line)}
              </span>
              <div className="menu-sep" role="separator" />
            </>
          )}
          <span className="ink-2 px-1 pt-1 text-[12px]">{COPY.download}</span>
          {files.map(([name, text, mime]) => <button key={name} type="button" className="menu-item" onClick={() => download(name, text(), mime)}>{name}</button>)}
        </div>
      )}
    </div>
  )
}
