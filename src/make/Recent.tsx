import { Link } from '../lib/router'
import { Photo } from '../bricks/Photo'
import { tileFit } from '../lib/photoFit'
import { byRecent, sharedHeading } from '../lib/makeFlow'
import type { Project } from '../lib/mapRelations'
import type { Brick } from '../lib/types'

/** How many projects Make's empty page lists before it hands over to the Projects page. */
const SHOWN = 4
/** Each row shows this many of the project's photos, in fixed slots, so every title starts at the same left edge. */
const THUMBS = 3
const COPY = {
  label: 'Projects',
  all: (n: number) => `All ${n}`,
  untitled: 'Untitled project',
}

/** Under Make's empty field, your projects, most recently edited first (Malik, 2026-11-04: Projects sat too deep in ⋯, and the phone had no way back to them).
 *  Each row is its photos and its heading (the intent, or the name a person gave with the intent under it; Pick photos myself with an empty field makes one with neither) and opens the project on its Make page.
 *  Past four, the label's link opens the Projects page with the rest. Nothing renders before the first project. */
export function RecentProjects({ projects, bricks }: { projects: Project[]; bricks: Brick[] }) {
  if (projects.length === 0) return null
  const shown = byRecent(projects).slice(0, SHOWN)
  return (
    <section className="make-recent" aria-labelledby="make-recent-label">
      <div className="dock-label">
        <h2 id="make-recent-label">{COPY.label}</h2>
        {/* the photo dock's carry link, in the same place on the same label row */}
        {projects.length > SHOWN && <Link href="/projects" className="dock-carry">{COPY.all(projects.length)}<span aria-hidden="true"> ›</span></Link>}
      </div>
      <ProjectRows projects={shown} bricks={bricks} />
    </section>
  )
}

/** One row per project, in the order given: its photos in three fixed slots and its heading; each opens the project on its Make page.
 *  Make's empty page shows the first four; the Projects page shows them all, in the same rows. */
export function ProjectRows({ projects, bricks }: { projects: Project[]; bricks: Brick[] }) {
  return (
    <ul className="make-recent-list">
      {projects.map(p => {
        const heading = sharedHeading(p)
        const photos = p.brickIds.flatMap(id => bricks.find(b => b.id === id) ?? []).slice(0, THUMBS)
        return (
          <li key={p.id}>
            <Link href={`/project/${p.id}`} className="make-recent-row">
              <span className="make-recent-thumbs" aria-hidden="true">
                {photos.map(b => <Photo key={b.id} src={b.photo.url} style={tileFit(b.photo, 1)} />)}
              </span>
              <span className="make-recent-text">
                <span className="make-recent-title">{heading.title || COPY.untitled}</span>
                {heading.sub && <span className="make-recent-sub">{heading.sub}</span>}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
