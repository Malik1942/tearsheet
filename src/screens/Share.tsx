import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { resolveProject } from '../lib/mapRelations'
import { canShare, generateCode, readSync, runSync, shareLink } from '../lib/syncClient'
import { instructionsLink, projectSteps } from '../lib/makeFlow'
import { Fold, StepLine, StepPage, StepTitle } from '../make/Steps'
import { FilesView } from './Export'

/** E1 minimal. false is the fallback: no link, and the Downloads fold open. */
const SHARE_LINK = true

const COPY = {
  title: 'Share',
  line: 'Opens the screens and the reasons behind them',
  copy: 'Copy link',
  copied: 'Copied',
  making: 'Making the link…',
  noLink: "Couldn't make the link.",
  copyFailed: "Couldn't copy. Select the link and copy it.",
  shared: 'Sent.',
  retry: 'Try again',
  send: 'Send…',
  downloads: 'Downloads',
  page: 'See the page it opens',
  missing: "This project isn't on this device.",
  projects: 'Projects',
}

/** Make, step 4 Share (15_SIMPLIFY §2): one sheet. The link opens the project's Instructions page on another device (E1 minimal): arriving here uploads the library and
 *  the project under the library's sync code (a library without one gets a code, which Sync then shows), the same path the phone footer used, and the link is
 *  `/open?code=…&project=…&to=instructions`. Copy runs in the tap itself: iOS Safari allows the clipboard only inside a user gesture, which the upload would outlast.
 *  `Downloads ▸` holds what the Export page was. `/project/:id/export` lands here with the fold open. */
export function ShareScreen({ id, openDownloads = false }: { id: string; openDownloads?: boolean }) {
  const store = useStore()
  const project = store.projects.find(p => p.id === id)
  const resolved = useMemo(() => project ? resolveProject(project, store.bricks) : null, [project, store.bricks])
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // a failed first upload keeps its code for the retry instead of making a new one
  const pending = useRef<string | null>(null)
  const started = useRef(false)

  const prepare = async () => {
    const code = readSync()?.code ?? (pending.current ??= generateCode())
    setBusy(true); setError(null); setNote(null)
    try {
      const { info } = await runSync(code, store)
      pending.current = null
      setLink(instructionsLink(location.origin, info.code, id))
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  useEffect(() => {
    if (!SHARE_LINK || !project || started.current) return
    started.current = true
    void prepare()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!project || !resolved) return <div className="chrome min-h-full"><StepPage><p className="ink-2 m-0">{COPY.missing}</p><Link href="/projects" className="btn w-fit no-underline">{COPY.projects}</Link></StepPage></div>
  const onCopy = () => { if (link) navigator.clipboard.writeText(link).then(() => setNote(COPY.copied), () => setNote(COPY.copyFailed)) }
  const onSend = () => { if (link) shareLink(link).then(r => setNote(r === 'shared' ? COPY.shared : r === 'copied' ? COPY.copied : r === 'failed' ? COPY.copyFailed : null)) }

  return (
    <div className="chrome min-h-full">
      <StepPage>
        <StepLine current={4} back={`/project/${id}`} go={projectSteps(id)} />
        <StepTitle>{COPY.title}</StepTitle>
        {SHARE_LINK && (
          <section className="panel flex flex-col gap-3 p-4" aria-label="Link" style={{ background: 'var(--panel)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <input readOnly value={link ?? ''} placeholder={error ? COPY.noLink : COPY.making} onFocus={e => e.currentTarget.select()} aria-label="Link to this project"
                className="min-w-0 flex-1 rounded border px-3 py-2 text-[13px] hairline" style={{ background: 'var(--paper)', color: link ? 'var(--ink)' : 'var(--ink-2)' }} />
              <button type="button" className="btn btn-accent px-4 py-2" disabled={!link} onClick={onCopy}>{COPY.copy}</button>
              {link && canShare() && <button type="button" className="btn btn-quiet" onClick={onSend}>{COPY.send}</button>}
            </div>
            <span className="text-[13px]">{COPY.line}</span>
            {(note || error) && (
              <span className="ink-2 flex flex-wrap items-center gap-2 text-[12px]" role="status" aria-live="polite">
                {error ? <><span title={error}>{COPY.noLink}</span><button type="button" className="btn btn-quiet px-2 py-0.5 text-[12px]" disabled={busy} onClick={() => void prepare()}>{COPY.retry}</button></> : note}
              </span>
            )}
          </section>
        )}
        <div className="flex flex-col gap-6">
          <Fold summary={COPY.downloads} defaultOpen={openDownloads || !SHARE_LINK}>
            <FilesView project={project} resolved={resolved} bricks={store.bricks} />
          </Fold>
          <Link href={`/project/${id}/instructions`} className="ink-2 w-fit text-[13px]">{COPY.page}</Link>
        </div>
      </StepPage>
    </div>
  )
}
