import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { resolveProject } from '../lib/mapRelations'
import { exportHandoff } from '../export'
import { Markdown } from '../lib/markdown'
import { StepPage } from '../make/Steps'

const COPY = { copy: 'Copy handoff.md', copied: 'Copied', see: 'See the screens', note: 'This is the handoff.md that Share downloads, rendered as a page: the same generator, the same words.', missing: "This project isn't on this device.", projects: 'Projects' }

/** Instructions: handoff.md as a page, from the same generator Share's Downloads use. It is what Share's link opens on another device (E1 minimal),
 *  read-only. See the screens leads to the project's Make page, Fine-tune included. */
export function InstructionsScreen({ id }: { id: string }) {
  const store = useStore()
  const project = store.projects.find(p => p.id === id)
  const resolved = useMemo(() => project ? resolveProject(project, store.bricks) : null, [project, store.bricks])
  const [copied, setCopied] = useState(false)
  if (!project || !resolved) return <div className="chrome min-h-full"><StepPage><p className="ink-2 m-0">{COPY.missing}</p><Link href="/projects" className="btn w-fit no-underline">{COPY.projects}</Link></StepPage></div>
  const bricks = project.brickIds.map(b => store.bricks.find(x => x.id === b)).filter((b): b is NonNullable<typeof b> => !!b)
  const page = exportHandoff(project.intent, bricks, resolved, project.proposal, { photos: 'inline' })
  const copy = async () => { try { await navigator.clipboard.writeText(exportHandoff(project.intent, bricks, resolved, project.proposal)); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ } }
  return (
    <div className="chrome min-h-full">
      <StepPage>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/project/${project.id}`} className="btn btn-accent no-underline">{COPY.see}</Link>
          <button type="button" className="btn" onClick={copy}>{copied ? COPY.copied : COPY.copy}</button>
        </div>
        <div>
          <p className="ink-2 m-0 text-[11px]">{COPY.note}</p>
          <Markdown text={page} />
        </div>
      </StepPage>
    </div>
  )
}
