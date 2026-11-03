import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { resolveProject, type Project } from '../lib/mapRelations'
import { standInLine } from '../lib/standIns'
import { rotations } from '../lib/brickPreview'
import { NEUTRAL_SKIN, autoName, projectSteps, seeRows, toggleRef } from '../lib/makeFlow'
import { shortLabel } from '../lib/shortLabels'
import type { ParameterKey, Params } from '../shell/params'
import { Shell } from '../shell/Shell'
import { MiniPreview } from '../shell/MiniPreview'
import { Photo } from '../bricks/Photo'
import { LabelChip } from '../compose/LabelChip'
import { useChangeFlash } from '../compose/useChangeFlash'
import { Fold, MoreMenu, Overlay, StepLine, StepPage, StepTitle, Switch } from '../make/Steps'
import { ComposePanel } from './Compose'

const COPY = {
  title: "Here's what they do",
  fromPhotos: 'From your photos',
  nothing: 'Nothing here to switch',
  overruled: 'Another photo sets this here. Choose between them in Fine-tune.',
  carried: 'Everything carried over',
  couldnt: (n: number) => `${n} ${n === 1 ? 'thing' : 'things'} couldn't carry over`,
  share: 'Share',
  fineTune: 'Fine-tune',
  arrangement: 'Try another arrangement',
  neutral: 'Neutral skin',
  rename: 'Rename',
  versions: 'Versions',
  more: 'More for this project',
  current: 'Current',
  useThis: 'Use this one',
  arrangementHint: 'The same photos, each with a different one on top. Worked out here from their rules; no model call.',
  save: 'Save',
  missing: "This project isn't on this device.",
  projects: 'Projects',
  list: 'List', review: 'Year review', both: 'Both',
  noMove: 'no value moved',
}
const SCREENS = [['list', 'List screen'], ['review', 'Year review screen']] as const

const useMedia = (q: string) => {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q), f = () => setOn(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [q])
  return on
}

/** Make, step 3 See (15_SIMPLIFY §2): the two screens, large; under them "From your photos", one row per brick with a switch per short label (a switch is
 *  `project.disabled[ref]`, so each flip is a version and the change highlight runs on it); one folded line for what couldn't carry over; Share, and Fine-tune,
 *  today's Compose in a drawer. ⋯: another arrangement (P8), Neutral skin, Rename, Versions (C9). The phone Preview route shows this screen too. */
export function SeeScreen({ id }: { id: string }) {
  const store = useStore()
  const project = store.projects.find(p => p.id === id)
  const resolved = useMemo(() => project ? resolveProject(project, store.bricks) : null, [project, store.bricks])
  const flash = useChangeFlash(project)
  const [neutral, setNeutral] = useState(false)
  const [dialog, setDialog] = useState<null | 'arrange' | 'rename' | 'versions' | 'tune'>(null)
  const [screen, setScreen] = useState<'both' | 'list' | 'review'>('both')
  if (!project || !resolved) return <Missing />

  const params = neutral ? { ...resolved.params, ...NEUTRAL_SKIN } : resolved.params
  const rows = seeRows(project, resolved, store.bricks)
  const update = (patch: Partial<Project> | ((p: Project) => Partial<Project>)) => store.updateProject(project.id, patch)
  const name = project.name || autoName(project.intent) || 'Untitled'

  return (
    <div className="chrome min-h-full">
      <StepPage wide>
        <StepLine current={3} back="/make" go={projectSteps(project.id)} />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <StepTitle>{COPY.title}</StepTitle>
            <span className="ink-2 truncate text-[13px]">{name}</span>
          </div>
          <MoreMenu label={COPY.more} items={[
            { label: COPY.arrangement, onSelect: () => setDialog('arrange'), disabled: project.brickIds.length < 2 },
            { label: COPY.neutral, onSelect: () => setNeutral(v => !v), pressed: neutral },
            { label: COPY.rename, onSelect: () => setDialog('rename') },
            { label: COPY.versions, onSelect: () => setDialog('versions') },
          ]} />
        </div>

        <ShellPair params={params} flash={flash} />

        <section className="flex flex-col gap-3" aria-labelledby="see-from">
          <h2 id="see-from" style={{ fontSize: 15, lineHeight: '20px', fontWeight: 600, margin: 0 }}>{COPY.fromPhotos}</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {rows.map(({ brick, labels }) => (
              <li key={brick.id} className="panel flex items-center gap-4 p-3">
                <Link href={`/brick/${brick.id}`} className="shrink-0" aria-label="Open this photo"><Photo src={brick.photo.url} className="h-12 w-12 rounded object-cover" /></Link>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2">
                  {labels.length === 0 && <span className="ink-2 text-[13px]">{COPY.nothing}</span>}
                  {labels.map(l => (
                    <span key={l.ref} className="inline-flex items-center gap-2" title={l.on && !l.inUse ? COPY.overruled : undefined}>
                      <LabelChip l={l} className={l.on && l.inUse ? '' : 'opacity-50'} />
                      <Switch on={l.on} label={`${l.label}: ${l.on ? 'on' : 'off'}`} onChange={() => update(p => ({ disabled: toggleRef(p.disabled, l.ref) }))} />
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {resolved.unexpressed.length === 0 ? <span className="ink-2 text-[13px]">{COPY.carried}</span> : (
            <Fold summary={COPY.couldnt(resolved.unexpressed.length)}>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[12px]">
                {resolved.unexpressed.map((u, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="chip chip-adapted shrink-0 px-1.5 text-[10px]">{u.reason === 'fragile' ? 'fragile if changed' : 'no slot'}</span>
                    <span><Link href={`/brick/${u.brickId}`} className="mono ink-2">{u.brickId}</Link> {u.rule}<span className="ink-2 mt-0.5 block text-[11px]">{standInLine(u.rule)}</span></span>
                  </li>
                ))}
              </ul>
            </Fold>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/project/${project.id}/share`} className="btn btn-accent px-4 py-2 text-[15px] no-underline">{COPY.share}</Link>
          <button type="button" className="btn px-4 py-2 text-[15px]" onClick={() => setDialog('tune')}>{COPY.fineTune}</button>
        </div>
      </StepPage>

      {dialog === 'tune' && (
        <Overlay full title={COPY.fineTune} onClose={() => setDialog(null)} actions={
          <div className="flex overflow-hidden rounded border hairline text-[12px]" role="group" aria-label="Screens">
            {(['list', 'review', 'both'] as const).map(s => <button key={s} type="button" aria-pressed={screen === s} onClick={() => setScreen(s)} className="cursor-pointer border-0 px-2 py-1" style={screen === s ? { background: 'var(--ink)', color: '#fff' } : { background: 'var(--panel)', color: 'var(--ink)' }}>{COPY[s]}</button>)}
          </div>}>
          <ComposePanel project={project} neutral={neutral} onNeutral={() => setNeutral(v => !v)} screen={screen} />
        </Overlay>
      )}
      {dialog === 'arrange' && <Arrangements project={project} onClose={() => setDialog(null)} onPick={order => { update({ brickIds: order }); setDialog(null) }} />}
      {dialog === 'rename' && <Rename initial={name} onClose={() => setDialog(null)} onSave={n => { update({ name: n }); setDialog(null) }} />}
      {dialog === 'versions' && <Versions project={project} onClose={() => setDialog(null)} />}
    </div>
  )
}

function Missing() {
  return <div className="chrome min-h-full"><StepPage><p className="ink-2 m-0">{COPY.missing}</p><Link href="/projects" className="btn w-fit no-underline">{COPY.projects}</Link></StepPage></div>
}

/** The two screens, large and centered: side by side on a wide screen; on a phone one at a time, swiped, with a two-dot pager. */
function ShellPair({ params, flash }: { params: Params; flash: ParameterKey[] }) {
  const wide = useMedia('(min-width: 768px)')
  const pane = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [phoneH, setPhoneH] = useState(() => paneHeight())
  useEffect(() => {
    // only on a width change (rotation): iOS Safari fires resize while its toolbar collapses during a scroll
    let w = window.innerWidth
    const on = () => { if (window.innerWidth !== w) { w = window.innerWidth; setPhoneH(paneHeight()) } }
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const height = wide ? 680 : phoneH
  const go = (i: number) => { const el = pane.current; if (!el) return; el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }); setActive(i) }
  // the dot follows the pane once it rests on a snap point, so a tapped dot does not flicker back mid-scroll
  const onScroll = () => { const el = pane.current; if (!el || wide) return; const i = Math.round(el.scrollLeft / el.clientWidth); if (i !== active && Math.abs(el.scrollLeft - i * el.clientWidth) < 2) setActive(i) }
  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={pane} onScroll={onScroll} className="flex w-full snap-x snap-mandatory overflow-x-auto md:justify-center md:gap-8 md:overflow-visible" style={{ scrollbarWidth: 'none' }}>
        {SCREENS.map(([key, label]) => (
          <div key={key} className="flex w-full shrink-0 snap-center justify-center md:w-auto" aria-label={label} role="group">
            <div className="w-full max-w-[340px] overflow-hidden rounded-[22px]" style={{ border: '1px solid var(--line)', background: '#111', padding: 6, height: height + 12 }}>
              <div className="h-full overflow-hidden rounded-[16px]"><Shell params={params} screen={key} height={height} flash={flash} /></div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 md:hidden" role="tablist" aria-label="Screen">
        {SCREENS.map(([key, label], i) => <button key={key} type="button" role="tab" aria-selected={active === i} aria-label={label} onClick={() => go(i)} className="h-2 w-2 cursor-pointer rounded-full border-0 p-0" style={{ background: active === i ? 'var(--ink)' : 'var(--line)' }} />)}
      </div>
    </div>
  )
}

/** On a phone the shell is as tall as what is left of the screen under the step line, within sane bounds. */
function paneHeight(): number {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  return Math.max(420, Math.min(vh - 200, 680))
}

/** P8, moved into See's ⋯: the same bricks in their (at most three) rotations, each a mini-screen; picking one reorders the project (a new version). */
function Arrangements({ project, onClose, onPick }: { project: Project; onClose: () => void; onPick: (order: string[]) => void }) {
  const store = useStore()
  const options = useMemo(() => rotations(project.brickIds).map(order => ({ order, params: resolveProject({ ...project, brickIds: order }, store.bricks).params })), [project, store.bricks])
  return (
    <Overlay title={COPY.arrangement} onClose={onClose}>
      <p className="ink-2 m-0 mb-3 text-[12px]">{COPY.arrangementHint}</p>
      <ul className="m-0 flex list-none flex-wrap justify-center gap-4 p-0">
        {options.map(o => {
          const current = o.order.join(',') === project.brickIds.join(',')
          const top = store.bricks.find(b => b.id === o.order[0])
          return (
            <li key={o.order.join(',')} className="flex flex-col items-center gap-2">
              <MiniPreview params={o.params} width={180} />
              {top && <span className="inline-flex items-center gap-1 text-[12px]"><Photo src={top.photo.url} className="h-5 w-5 rounded object-cover" /><span className="ink-2">on top</span></span>}
              {current ? <span className="ink-2 text-[12px]">{COPY.current}</span> : <button type="button" className="btn" onClick={() => onPick(o.order)}>{COPY.useThis}</button>}
            </li>
          )
        })}
      </ul>
    </Overlay>
  )
}

function Rename({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <Overlay title={COPY.rename} onClose={onClose}>
      <form className="flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); if (value.trim()) onSave(value.trim()) }}>
        <input value={value} onChange={e => setValue(e.target.value)} autoFocus maxLength={80} aria-label="Project name" className="min-w-0 flex-1 rounded border px-3 py-2 text-[15px] hairline" style={{ color: 'var(--ink)', background: 'var(--panel)' }} />
        <button type="submit" className="btn btn-accent" disabled={!value.trim()}>{COPY.save}</button>
      </form>
    </Overlay>
  )
}

/** One change as a version shows it: the new value's short label; a label that went away reads "<label> off"; otherwise the parameter's name. */
const changeLine = (c: NonNullable<Project['versions']>[number]['changed'][number]): string => {
  const to = shortLabel(c.key, c.to.value), from = shortLabel(c.key, c.from.value)
  return to ?? (from ? `${from} off` : c.key)
}

/** C9, read-only: v1…vn, latest first, each with what it moved (as short labels where the table has one). */
function Versions({ project, onClose }: { project: Project; onClose: () => void }) {
  const entries = [...(project.versions ?? [])].reverse()
  return (
    <Overlay title={COPY.versions} onClose={onClose}>
      <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
        {entries.map(e => (
          <li key={e.v} className="flex flex-wrap items-baseline gap-x-3" style={{ borderTop: '1px solid var(--line)', paddingTop: 6 }}>
            <span className="font-semibold tabular-nums">v{e.v}</span>
            <span className="ink-2 text-[12px]">{new Date(e.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="min-w-0 flex-1">{e.v === 1 ? 'First version' : e.changed.length === 0 ? <span className="ink-2">{COPY.noMove}</span> : e.changed.map(changeLine).join(', ')}</span>
          </li>
        ))}
        {entries.length === 0 && <li className="ink-2">v{project.version ?? 1}</li>}
      </ol>
    </Overlay>
  )
}
