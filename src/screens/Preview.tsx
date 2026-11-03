import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { resolveProject } from '../lib/mapRelations'
import { RELATIONSHIP_KEYS } from '../shell/params'
import type { ParameterValue } from '../lib/types'
import { Shell } from '../shell/Shell'
import { Photo } from '../bricks/Photo'
import { Section, Row } from '../compose/Sheet'
import { DesktopFooter } from '../compose/DesktopFooter'

const SCREENS = [['list', 'List'], ['review', 'Year review']] as const
const COPY = { unexpressedEmpty: 'Everything from these bricks found a slot.', note: 'Rendered on this device from one parameters.json; nothing hand-edited. Swipe to switch screens.', instructions: 'Instructions →', materials: 'Bricks in this project' }

/** Phone preview (read-only): the two shell screens full-width, swipe or tap to switch; below, the relationship rows with their provenance
 *  and the Could-not-be-expressed list. Editing happens in Compose on a desktop; the footer hands over the link. */
export function PreviewScreen({ id }: { id: string }) {
  const store = useStore()
  const project = store.projects.find(p => p.id === id)
  const resolved = useMemo(() => project ? resolveProject(project, store.bricks) : null, [project, store.bricks])
  const pane = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [height, setHeight] = useState(() => paneHeight())
  useEffect(() => {
    // only on a width change (rotation): iOS Safari fires resize while its toolbar collapses during a scroll
    let w = window.innerWidth
    const on = () => { if (window.innerWidth !== w) { w = window.innerWidth; setHeight(paneHeight()) } }
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  if (!project || !resolved) return <div className="chrome min-h-full p-4"><Link href="/projects" className="ink-2 text-[12px]">← Projects</Link><p className="mt-4 ink-2">No project with id {id}.</p></div>
  const materials = project.brickIds.map(bid => store.bricks.find(b => b.id === bid)).filter((b): b is NonNullable<typeof b> => !!b)
  const thumbOf = (pv: ParameterValue) => store.bricks.find(b => b.id === pv.source?.brickId)?.photo.url
  const go = (i: number) => { const el = pane.current; if (!el) return; el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }); setActive(i) }
  // the selected tab follows the pane only once it rests on a snap point, so a tapped switch does not flicker back mid-scroll
  const onScroll = () => { const el = pane.current; if (!el) return; const i = Math.round(el.scrollLeft / el.clientWidth); if (i !== active && Math.abs(el.scrollLeft - i * el.clientWidth) < 2) setActive(i) }

  return (
    <div className="chrome min-h-full pb-40">
      <header className="flex items-center gap-3 border-b px-4 py-2 hairline" style={{ background: 'var(--panel)' }}>
        <Link href="/" className="font-semibold no-underline" style={{ color: 'var(--ink)' }}>Tearsheet</Link>
        <span className="ink-2 min-w-0 truncate">/ <Link href="/projects" className="ink-2">Projects</Link> / {project.name || 'Untitled'}</span>
        <Link href={`/project/${project.id}/instructions`} className="btn btn-quiet ml-auto shrink-0">{COPY.instructions}</Link>
      </header>
      <div className="px-4 py-1 text-[12px] ink-2 truncate" style={{ borderBottom: '1px solid var(--line)' }}>{project.intent}</div>

      <div className="flex items-center justify-center gap-1 px-4 py-2" role="tablist" aria-label="Screen">
        {SCREENS.map(([key, label], i) => <button key={key} type="button" role="tab" aria-selected={active === i} onClick={() => go(i)} className="rounded-full px-3 py-1 text-[12px]" style={active === i ? { background: 'var(--ink)', color: '#fff' } : { background: 'var(--panel)', border: '1px solid var(--line)' }}>{label}</button>)}
      </div>
      <div ref={pane} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: 'none', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        {SCREENS.map(([key]) => (
          <div key={key} className="w-full shrink-0 snap-start" style={{ height }} aria-label={key === 'list' ? 'List screen' : 'Year review screen'}>
            <Shell params={resolved.params} screen={key} height={height} />
          </div>
        ))}
      </div>
      <p className="ink-2 px-4 py-2 text-center text-[11px]">{COPY.note}</p>

      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4">
        <Section title={COPY.materials}>
          <div className="flex flex-wrap gap-2">
            {materials.map(b => <Link key={b.id} href={`/brick/${b.id}`} className="flex items-center gap-2 no-underline" style={{ color: 'inherit' }} aria-label={`Open brick ${b.id}`}><Photo src={b.photo.url} className="h-10 w-14 rounded object-cover" /><span className="mono text-[11px]">{b.id}</span></Link>)}
          </div>
        </Section>
        <Section title="Relationship">{RELATIONSHIP_KEYS.map(k => <Row key={k} k={k} pv={resolved.values[k]} params={resolved.params} bricks={store.bricks} thumb={thumbOf(resolved.values[k])} />)}</Section>
        <Section title="Could not be expressed">
          {resolved.unexpressed.length === 0 ? <div className="ink-2 text-[12px]">{COPY.unexpressedEmpty}</div> : (
            <ul className="space-y-1 text-[12px]">
              {resolved.unexpressed.map((u, i) => <li key={i} className="flex gap-2"><span className="chip chip-adapted shrink-0 px-1.5 text-[10px]">{u.reason === 'fragile' ? 'fragile if changed' : 'no slot'}</span><span><Link href={`/brick/${u.brickId}`} className="mono ink-2">{u.brickId}</Link> {u.rule}</span></li>)}
            </ul>
          )}
        </Section>
      </div>
      <DesktopFooter projectId={project.id} />
    </div>
  )
}

/** The shell fills the width; its height is what is left of a phone screen under the header and the switch, within sane bounds. */
function paneHeight(): number {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  return Math.max(420, Math.min(vh - 220, 760))
}
