import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { resolveProject } from '../lib/mapRelations'
import { exportHandoff } from '../export'
import { Markdown } from '../lib/markdown'
import { DesktopFooter } from '../compose/DesktopFooter'

const COPY = { copy: 'Copy handoff.md', copied: 'Copied', preview: '← Preview', note: 'This is the handoff.md that Export produces, rendered as a page: the same generator, the same words.' }

/** Phone instructions (read-only): handoff.md as a page, from the same generator Export uses. */
export function InstructionsScreen({ id }: { id: string }) {
  const store = useStore()
  const project = store.projects.find(p => p.id === id)
  const resolved = useMemo(() => project ? resolveProject(project, store.bricks) : null, [project, store.bricks])
  const [copied, setCopied] = useState(false)
  if (!project || !resolved) return <div className="chrome min-h-full p-4"><Link href="/projects" className="ink-2 text-[12px]">← Projects</Link><p className="mt-4 ink-2">No project with id {id}.</p></div>
  const bricks = project.brickIds.map(b => store.bricks.find(x => x.id === b)).filter((b): b is NonNullable<typeof b> => !!b)
  const page = exportHandoff(project.intent, bricks, resolved, project.proposal, { photos: 'inline' })
  const copy = async () => { try { await navigator.clipboard.writeText(exportHandoff(project.intent, bricks, resolved, project.proposal)); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ } }
  return (
    <div className="chrome min-h-full pb-40">
      <header className="flex items-center gap-3 border-b px-4 py-2 hairline" style={{ background: 'var(--panel)' }}>
        <Link href="/" className="font-semibold no-underline" style={{ color: 'var(--ink)' }}>Tearsheet</Link>
        <span className="ink-2 min-w-0 truncate">/ <Link href="/projects" className="ink-2">Projects</Link> / {project.name || 'Untitled'} / Instructions</span>
        <div className="ml-auto flex shrink-0 gap-2">
          <Link href={`/project/${project.id}/preview`} className="btn btn-quiet">{COPY.preview}</Link>
          <button type="button" className="btn" onClick={copy}>{copied ? COPY.copied : COPY.copy}</button>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-3">
        <p className="ink-2 text-[11px]">{COPY.note}</p>
        <Markdown text={page} />
      </div>
      <DesktopFooter projectId={project.id} />
    </div>
  )
}
