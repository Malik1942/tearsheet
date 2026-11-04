import { useEffect, useMemo, useState } from 'react'
import { Link } from '../lib/router'
import { CODE_RE, normalizeCode, pull } from '../lib/syncClient'
import { SAMPLES } from '../fixtures/samples'
import { resolveProject, type Project } from '../lib/mapRelations'
import { autoName, sharedView } from '../lib/makeFlow'
import { exportHandoff } from '../export'
import { Markdown } from '../lib/markdown'
import { ScaledScreens } from '../make/Screens'
import { toShellContent } from '../shell/content'
import type { Brick } from '../lib/types'

const COPY = {
  loading: 'Opening the shared project…',
  badLink: 'This link is not a Tearsheet share link.',
  missing: 'Nothing is shared under this link any more.',
  readOnly: 'Shared with you, read-only. Nothing here is saved to this device.',
  reasons: 'The reasons behind them',
  copy: 'Copy handoff.md', copied: 'Copied',
  own: 'Make your own',
}

/** E1, read-only (Malik, 2026-11-03): what a Share link opens. It reads the project's share code once and shows the two screens and the handoff (the reasons
 *  behind them). It never adopts the code, never merges into this device's library and never writes anything here; the starters come from the app itself. */
export function SharedScreen() {
  const params = new URLSearchParams(location.search)
  const code = normalizeCode(params.get('code') ?? '')
  const projectId = params.get('project') ?? ''
  const [view, setView] = useState<{ project: Project; bricks: Brick[] } | null>(null)
  const [error, setError] = useState<string | null>(CODE_RE.test(code) && projectId ? null : COPY.badLink)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!CODE_RE.test(code) || !projectId) return
    let live = true
    pull(code)
      .then(m => { if (!live) return; const v = sharedView(m, projectId, SAMPLES); if (v) setView(v); else setError(COPY.missing) })
      .catch(e => { if (live) setError((e as Error).message) })
    return () => { live = false }
  }, [code, projectId])

  const resolved = useMemo(() => view ? resolveProject(view.project, view.bricks) : null, [view])
  if (error) return <Frame><p className="m-0">{error}</p><Link href="/make" className="btn w-fit no-underline">{COPY.own}</Link></Frame>
  if (!view || !resolved) return <Frame><p className="ink-2 m-0" role="status" aria-live="polite">{COPY.loading}</p></Frame>

  const { project, bricks } = view
  const used = project.brickIds.map(id => bricks.find(b => b.id === id)).filter((b): b is Brick => !!b)
  const page = exportHandoff(project.intent, used, resolved, project.proposal, { photos: 'inline' })
  const copy = async () => { try { await navigator.clipboard.writeText(exportHandoff(project.intent, used, resolved, project.proposal)); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ } }
  return (
    <Frame>
      <header className="flex flex-col gap-1">
        {/* Data tear: the title is already the share card's (the sans, 600, 24); the meta line takes the card's mono */}
        <h1 className="title">{project.name || autoName(project.intent) || project.intent}</h1>
        <p className="ink-2 m-0">{project.intent}</p>
        <p className="ink-2 m-0" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: '16px', letterSpacing: '0.04em' }}>{COPY.readOnly}</p>
      </header>
      <ScaledScreens params={resolved.params} flash={[]} reserve={48} content={toShellContent(project.content)} />
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="em">{COPY.reasons}</h2>
          <button type="button" className="btn" onClick={copy}>{copied ? COPY.copied : COPY.copy}</button>
        </div>
        <Markdown text={page} />
      </section>
    </Frame>
  )
}

/** The page's frame: the chrome's gutter at a readable width, the 32 px section gap. */
function Frame({ children }: { children: React.ReactNode }) {
  return <div className="chrome min-h-full"><div className="gutter mx-auto flex w-full max-w-5xl flex-col gap-8 py-6">{children}</div></div>
}
