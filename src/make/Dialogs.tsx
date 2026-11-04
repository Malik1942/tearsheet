import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { resolveProject, type Project } from '../lib/mapRelations'
import { rotations } from '../lib/brickPreview'
import { shortLabel } from '../lib/shortLabels'
import { photoLine } from '../lib/makeFlow'
import { originOf } from '../lib/starters'
import { tileCaption, type SwapGroup } from '../lib/swapSheet'
import type { ChipId } from '../lib/leanFamilies'
import type { Brick } from '../lib/types'
import { MiniPreview } from '../shell/MiniPreview'
import { Photo } from '../bricks/Photo'
import { tileFit } from '../lib/photoFit'
import { Overlay } from './Steps'

const COPY = {
  arrangement: 'Try another arrangement',
  arrangementHint: 'The same photos, each with a different one on top. Worked out here from their rules; no model call.',
  current: 'Current', useThis: 'Use this one', onTop: 'on top',
  rename: 'Rename', save: 'Save',
  versions: 'Versions', first: 'First version', noMove: 'no value moved',
  style: 'Adjust style', lean: 'Lean', leanHint: 'from your library · adapted · by rule', moreLikeThis: 'More like this one', clearAnchor: 'Clear the starting point',
  styleNote: 'Press Enter in the field to look again with these. On a project, click its title to get the field back.',
  pick: 'Pick photos myself', count: (n: number, max: number) => `${n} of ${max}`, show: 'Show the screens', starter: 'starter',
  empty: 'Nothing to pick from yet. Add photos, or include the starters from ⋯.', needIntent: 'Type what you are making first.',
  swap: 'Swap', noSpare: 'No other photo to swap in.', inProject: 'Already in this project',
}

/** P8, in Make's ⋯: the same bricks in their (at most three) rotations, each a mini-screen; picking one reorders the project (a new version). */
export function Arrangements({ project, onClose, onPick }: { project: Project; onClose: () => void; onPick: (order: string[]) => void }) {
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
              {top && <span className="inline-flex items-center gap-1 text-[12px]"><Photo src={top.photo.url} className="h-5 w-5 rounded object-cover" /><span className="ink-2">{COPY.onTop}</span></span>}
              {current ? <span className="ink-2 text-[12px]">{COPY.current}</span> : <button type="button" className="btn" onClick={() => onPick(o.order)}>{COPY.useThis}</button>}
            </li>
          )
        })}
      </ul>
    </Overlay>
  )
}

export function Rename({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <Overlay title={COPY.rename} onClose={onClose} closeLabel="Cancel">
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

/** C9, read-only: v1…vn, latest first, each with what it moved (as short labels where the table has one). Shown inside Fine-tune. */
export function VersionList({ project }: { project: Project }) {
  const entries = [...(project.versions ?? [])].reverse()
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
      {entries.map(e => (
        <li key={e.v} className="flex flex-wrap items-baseline gap-x-3" style={{ borderTop: '1px solid var(--line)', paddingTop: 6 }}>
          <span className="font-semibold tabular-nums">v{e.v}</span>
          <span className="ink-2 text-[12px]">{new Date(e.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          <span className="min-w-0 flex-1">{e.v === 1 ? COPY.first : e.changed.length === 0 ? <span className="ink-2">{COPY.noMove}</span> : e.changed.map(changeLine).join(', ')}</span>
        </li>
      ))}
      {entries.length === 0 && <li className="ink-2">v{project.version ?? 1}</li>}
    </ol>
  )
}

/** P3/P4: the lean chips (derived from the library's relations) and the starting point ("More like this one"). Enter in the field runs the proposal with them. */
export function AdjustStyle({ offered, active, onChip, anchor, anchorable, onAnchor, onClose }: {
  offered: { id: ChipId; note: string }[]; active: ChipId[]; onChip: (id: ChipId) => void
  anchor: Brick | undefined; anchorable: Brick[]; onAnchor: (id: string | null) => void; onClose: () => void
}) {
  const [picking, setPicking] = useState(false)
  return (
    <Overlay title={COPY.style} onClose={onClose}>
      <div className="flex flex-wrap items-baseline gap-x-2"><span className="text-[12px] ink-2">{COPY.lean}</span><span className="ink-2 text-[11px]">{COPY.leanHint}</span></div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {offered.map(c => {
          const on = active.includes(c.id)
          return <button key={c.id} type="button" aria-pressed={on} title={c.note} onClick={() => onChip(c.id)} className="chip chip-adapted min-h-7 cursor-pointer" style={on ? { borderColor: 'var(--ink)', borderWidth: 2, padding: '1px 7px', color: 'var(--ink)', fontWeight: 600 } : undefined}>{c.id}</button>
        })}
        <button type="button" className="btn px-2 py-0.5 text-[12px]" aria-expanded={picking} onClick={() => setPicking(v => !v)}>{COPY.moreLikeThis}</button>
        {anchor && (
          <span className="inline-flex items-center gap-1 rounded border py-0.5 pl-0.5 pr-1 text-[12px] hairline" style={{ background: 'var(--panel)' }}>
            <Photo src={anchor.photo.url} className="h-6 w-6 rounded object-cover" />
            <span className="ink-2">{photoLine(anchor)}</span>
            <button type="button" className="btn btn-quiet px-1 py-0 text-[14px]" aria-label={COPY.clearAnchor} title={COPY.clearAnchor} onClick={() => onAnchor(null)}>×</button>
          </span>
        )}
      </div>
      {picking && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {anchorable.map(b => {
            const cap = tileCaption(b)
            return (
              <button key={b.id} type="button" onClick={() => { onAnchor(b.id); setPicking(false) }} aria-pressed={b.id === anchor?.id} className="cursor-pointer overflow-hidden rounded p-0 text-left" style={{ border: `2px solid ${b.id === anchor?.id ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--panel)' }} title={`Start from ${cap.title}`}>
                <div className="overflow-hidden" style={{ aspectRatio: '16 / 10', background: '#2a2a2a' }}><Photo src={b.photo.url} className="h-full w-full object-cover" style={tileFit(b.photo, 16 / 10)} /></div>
                <div className="flex flex-col px-1.5 py-1"><span className="cap-title">{cap.title}</span><span className="cap-line tnum">{cap.line}</span></div>
              </button>
            )
          })}
        </div>
      )}
      <p className="ink-2 m-0 mt-4 text-[12px]">{COPY.styleNote}</p>
    </Overlay>
  )
}

/** Picking by hand: a grid of the photos on offer, up to `max`; Show the screens makes (or updates) the project. `note` is the one short line when the proposal was off or failed. */
export function PickMyself({ pool, initial, max, note, canCreate, onClose, onDone }: { pool: Brick[]; initial: string[]; max: number; note?: { line: string; detail?: string } | null; canCreate: boolean; onClose: () => void; onDone: (ids: string[]) => void }) {
  const [picked, setPicked] = useState(() => initial.filter(id => pool.some(b => b.id === id)).slice(0, max))
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length < max ? [...p, id] : p)
  return (
    <Overlay title={COPY.pick} onClose={onClose} closeLabel="Cancel" actions={<span className="ink-2 text-[13px] tabular-nums">{COPY.count(picked.length, max)}</span>}>
      {note && <p className="ink-2 m-0 mb-3 text-[13px]" role="status" title={note.detail}>{note.line}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {pool.map(b => {
          const on = picked.includes(b.id), cap = tileCaption(b)
          return (
            <button key={b.id} type="button" onClick={() => toggle(b.id)} aria-pressed={on} aria-label={`${cap.title}, ${cap.line}`} className="relative cursor-pointer overflow-hidden rounded p-0 text-left" style={{ border: `2px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--panel)' }}>
              <div className="overflow-hidden" style={{ aspectRatio: '16 / 10', background: '#2a2a2a' }}><Photo src={b.photo.url} className="h-full w-full object-cover" style={tileFit(b.photo, 16 / 10)} /></div>
              {/* the starter mark sits on the photo, opposite the check, so the two caption lines keep the tile's width */}
              {originOf(b) === 'starter' && <span className="chip chip-adapted absolute left-1.5 top-1.5 px-1.5 text-[10px]" style={{ background: 'var(--panel)' }}>{COPY.starter}</span>}
              <div className="flex flex-col px-2 py-1.5">
                <span className="cap-title">{cap.title}</span>
                <span className="cap-line tnum">{cap.line}</span>
              </div>
              {on && <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[12px]" style={{ background: 'var(--ink)', color: '#fff' }}>✓</span>}
            </button>
          )
        })}
        {pool.length === 0 && <span className="ink-2 col-span-full text-[13px]">{COPY.empty}</span>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-accent px-4 py-2" disabled={picked.length === 0 || !canCreate} onClick={() => onDone(picked)}>{COPY.show}</button>
        {!canCreate && <span className="ink-2 text-[12px]">{COPY.needIntent}</span>}
      </div>
    </Overlay>
  )
}

/** Swap one photo of the project for another (2026-11-03): Same job, Adds something, Everything else, each in the proposal's ranking and then newest saved
 *  (src/lib/swapSheet.ts). The photo being replaced is not offered; a photo already in the project shows a check and cannot be chosen. One tap swaps and closes. */
export function SwapPicker({ groups, onClose, onPick }: { groups: SwapGroup[]; onClose: () => void; onPick: (id: string) => void }) {
  const choosable = groups.some(g => g.tiles.some(t => !t.inProject))
  return (
    <Overlay title={COPY.swap} onClose={onClose}>
      {!choosable && <p className="ink-2 m-0 mb-3 text-[13px]">{COPY.noSpare}</p>}
      <div className="flex flex-col gap-4">
        {groups.map(g => (
          <section key={g.id} aria-label={g.title}>
            <h3 className="caption ink-2 m-0 mb-2 font-normal uppercase tracking-wide">{g.title}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {g.tiles.map(({ brick, inProject }) => {
                const { title, line } = tileCaption(brick)
                const name = `${title}, ${line}`
                return (
                  <button key={brick.id} type="button" disabled={inProject} onClick={() => onPick(brick.id)}
                    className={`relative overflow-hidden rounded p-0 text-left ${inProject ? 'cursor-default' : 'cursor-pointer'}`} style={{ border: '1px solid var(--line)', background: 'var(--panel)' }}
                    aria-label={inProject ? `${name}: ${COPY.inProject}` : `Swap in: ${name}`} title={inProject ? COPY.inProject : undefined}>
                    {/* the hover shows a licensed work's full credit; an uncredited photo has none, so the author's name never shows here */}
                    <div className="overflow-hidden" style={{ aspectRatio: '16 / 10' }}><Photo src={brick.photo.url} title={brick.credit ?? ''} className="h-full w-full object-cover" style={tileFit(brick.photo, 16 / 10)} /></div>
                    <div className="flex flex-col px-2 py-1.5">
                      <span className="cap-title">{title}</span>
                      <span className="cap-line tnum">{line}</span>
                    </div>
                    {inProject && <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none" style={{ background: 'var(--ink)', color: '#fff' }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </Overlay>
  )
}
