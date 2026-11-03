import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { resolveProject } from '../lib/mapRelations'
import { standInLine } from '../lib/standIns'
import { rowHeadline, whatChanged } from '../lib/landing'
import { RELATIONSHIP_KEYS, SKIN_KEYS } from '../shell/params'
import type { ParameterValue } from '../lib/types'
import { Shell } from '../shell/Shell'
import { Photo } from '../bricks/Photo'
import { Section, Row } from '../compose/Sheet'
import { ProvenanceChip } from '../compose/ProvenanceChip'
import { DesktopFooter } from '../compose/DesktopFooter'

const SCREENS = [['list', 'List'], ['review', 'Year review']] as const
const COPY = {
  unexpressedEmpty: 'Everything from these bricks found a slot.', note: 'Rendered on this device from one parameters.json; nothing hand-edited. Swipe to switch screens.', instructions: 'Instructions →',
  changed: 'What changed and why', changedEmpty: 'These bricks set no relationship yet; the screens use the shell defaults.', sheet: 'Parameter sheet',
}

/** Phone preview (read-only), conclusion first (V1): the two shell screens full-width, swipe or tap to switch; then "What changed and why" (up to three rule lines with the brick that set them),
 *  Could-not-be-expressed with its stand-ins, and the full parameter sheet collapsed. Editing happens in Compose on a desktop; the footer hands over the link. */
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
  const changed = whatChanged(project, resolved, store.bricks)
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
        <Section title={COPY.changed}>
          {changed.length === 0 ? <div className="ink-2 text-[12px]">{COPY.changedEmpty}</div> : (
            <ul className="space-y-2">
              {changed.map(pv => (
                <li key={pv.key} className="flex items-start gap-2 text-[12px]">
                  <Link href={`/brick/${pv.source?.brickId}`} className="mt-px shrink-0" aria-label={`Open brick ${pv.source?.brickId}`}><Photo src={thumbOf(pv)} className="h-6 w-6 rounded object-cover" /></Link>
                  <span className="min-w-0 flex-1 break-words">{rowHeadline(pv, resolved.params, store.bricks)} <span className="inline-block max-w-full align-middle"><ProvenanceChip pv={pv} showKey={false} /></span></span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Could not be expressed">
          {resolved.unexpressed.length === 0 ? <div className="ink-2 text-[12px]">{COPY.unexpressedEmpty}</div> : (
            <ul className="space-y-1 text-[12px]">
              {resolved.unexpressed.map((u, i) => <li key={i} className="flex gap-2"><span className="chip chip-adapted shrink-0 px-1.5 text-[10px]">{u.reason === 'fragile' ? 'fragile if changed' : 'no slot'}</span><span><Link href={`/brick/${u.brickId}`} className="mono ink-2">{u.brickId}</Link> {u.rule}<span className="ink-2 mt-0.5 block text-[11px]">{standInLine(u.rule)}</span></span></li>)}
            </ul>
          )}
        </Section>
        <details className="text-[12px]">
          <summary className="ink-2 cursor-pointer py-1">{COPY.sheet}</summary>
          <div className="mt-2 flex flex-col gap-3">
            <Section title="Relationship">{RELATIONSHIP_KEYS.map(k => <Row key={k} k={k} pv={resolved.values[k]} params={resolved.params} bricks={store.bricks} thumb={thumbOf(resolved.values[k])} />)}</Section>
            <Section title="Skin">{SKIN_KEYS.map(k => <Row key={k} k={k} pv={resolved.values[k]} params={resolved.params} bricks={store.bricks} swatch={k.startsWith('color')} thumb={thumbOf(resolved.values[k])} />)}</Section>
          </div>
        </details>
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
