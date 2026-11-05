import { useEffect } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { byRecent } from '../lib/makeFlow'
import { StepPage, StepTitle } from '../make/Steps'
import { ProjectRows } from '../make/Recent'

const COPY = {
  title: 'Projects',
  make: 'Make something new',
  empty: 'Nothing made yet.',
}

/** Projects (Make's empty page → All, and the header's ⋯ → Projects; 15_SIMPLIFY §3): every project, most recently edited first, in the rows Make's empty page
 *  uses for the four most recent; each opens on its Make page. Making a new one is the Make tab (`/make`). */
export function ProjectsScreen() {
  const store = useStore()
  // an older link (Brick → Use in a project) carries `?brick=`: that is a starting point for Make now
  const brick = new URLSearchParams(location.search).get('brick')
  useEffect(() => { if (brick) { history.replaceState(null, '', `/make?brick=${encodeURIComponent(brick)}`); window.dispatchEvent(new PopStateEvent('popstate')) } }, [brick])
  const projects = byRecent(store.projects)
  return (
    <div className="chrome min-h-full">
      <StepPage>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StepTitle>{COPY.title}</StepTitle>
          <Link href="/make" className="btn btn-accent no-underline">{COPY.make}</Link>
        </div>
        {projects.length === 0 ? <p className="ink-2 m-0">{COPY.empty}</p> : <ProjectRows projects={projects} bricks={store.bricks} />}
      </StepPage>
    </div>
  )
}
