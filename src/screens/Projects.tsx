import { useEffect } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { Photo } from '../bricks/Photo'
import { proposedNow } from '../export'
import { autoName } from '../lib/makeFlow'
import { StepPage, StepTitle } from '../make/Steps'

const COPY = {
  title: 'Projects',
  make: 'Make something new',
  proposedBy: 'proposed · model',
  empty: 'Nothing made yet.',
}

/** Projects (the header's ⋯ → Projects, 15_SIMPLIFY §3): every project, most recently edited first; each opens on its Make page. Making a new one is the Make tab (`/make`). */
export function ProjectsScreen() {
  const store = useStore()
  // an older link (Brick → Use in a project) carries `?brick=`: that is a starting point for Make now
  const brick = new URLSearchParams(location.search).get('brick')
  useEffect(() => { if (brick) { history.replaceState(null, '', `/make?brick=${encodeURIComponent(brick)}`); window.dispatchEvent(new PopStateEvent('popstate')) } }, [brick])
  const projects = [...store.projects].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
  return (
    <div className="chrome min-h-full">
      <StepPage>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StepTitle>{COPY.title}</StepTitle>
          <Link href="/make" className="btn btn-accent no-underline">{COPY.make}</Link>
        </div>
        {projects.length === 0 ? <p className="ink-2 m-0">{COPY.empty}</p> : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {projects.map(p => (
              <li key={p.id}>
                <Link href={`/project/${p.id}`} className="panel flex flex-wrap items-center gap-3 p-3 no-underline" style={{ color: 'var(--ink)' }}>
                  <span className="flex -space-x-2">
                    {p.brickIds.map(id => { const b = store.bricks.find(x => x.id === id); return b ? <Photo key={id} src={b.photo.url} className="h-10 w-10 rounded-full object-cover" style={{ border: '2px solid var(--panel)' }} /> : null })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.name || autoName(p.intent) || 'Untitled project'}{proposedNow(p.brickIds, p.proposal) > 0 && <span className="chip chip-proposed ml-2 px-1.5 text-[10px]" title={`${proposedNow(p.brickIds, p.proposal)} of ${p.brickIds.length} photos were proposed by the model`}>{COPY.proposedBy}</span>}</span>
                    <span className="ink-2 block truncate text-[12px]">{p.intent}</span>
                  </span>
                  <span className="ink-2 hidden text-[11px] sm:inline">edited {(p.updatedAt ?? p.createdAt).slice(0, 16).replace('T', ' ')}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </StepPage>
    </div>
  )
}
