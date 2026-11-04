import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { rowHeadline, whatChanged } from '../lib/landing'
import { resolveProject, relRef, type Project } from '../lib/mapRelations'
import { standInLine } from '../lib/standIns'
import { PARAMETER_KEYS, RELATIONSHIP_KEYS, SKIN_KEYS } from '../shell/params'
import type { ParameterValue } from '../lib/types'
import { Shell } from '../shell/Shell'
import { MiniPreview } from '../shell/MiniPreview'
import { choiceStands, conflictTiles } from '../lib/conflictPreview'
import { Photo } from '../bricks/Photo'
import { tileFit } from '../lib/photoFit'
import { ProvenanceChip } from '../compose/ProvenanceChip'
import { Section, Row } from '../compose/Sheet'
import { useChangeFlash } from '../compose/useChangeFlash'
import { download, exportCss, exportHandoff, exportJson } from '../export'
import { originLabel } from '../lib/brickLabels'
import { originOf } from '../lib/starters'
import { NEUTRAL_SKIN } from '../lib/makeFlow'
import { screensOf, toShellContent, type ScreenKey } from '../shell/content'

const NEUTRAL = NEUTRAL_SKIN
const CONFLICT_W = 130   // C6: width of each mini-screen in a conflict tile
const COPY = { unexpressedEmpty: 'Everything from these bricks found a slot.', conflictDefault: 'Using the top brick until you choose.', changed: 'What changed and why', changedEmpty: 'These bricks set no relationship yet; the screens use the shell defaults.' }

/** Fine-tune: today's Compose, opened in a drawer from the Make page's ⋯; logic unchanged. Three columns at >= 960 px, stacked below:
 *  materials (left) feed the shell (center); the sheet (right) shows every value with its provenance. Neutral skin is the page's, so the drawer and the page agree. */
export function ComposePanel({ project, neutral, onNeutral, screen }: { project: Project; neutral: boolean; onNeutral: () => void; screen: 'both' | ScreenKey }) {
  const store = useStore()
  const [swapping, setSwapping] = useState<string | null>(null)
  const resolved = useMemo(() => resolveProject(project, store.bricks), [project, store.bricks])
  // C11: for one second after an accepted change (Swap, Rotate, a conflict choice, a lock release, swap-in), the parameters it moved are outlined on both shells and tinted in the sheet
  const flash = useChangeFlash(project)

  const update = (patch: Partial<Project> | ((p: Project) => Partial<Project>)) => store.updateProject(project.id, patch)
  const materials = project.brickIds.map(bid => store.bricks.find(b => b.id === bid)).filter((b): b is NonNullable<typeof b> => !!b)
  const locked = project.lockedBricks ?? {}
  const spare = store.bricks.filter(b => (b.status ?? 'ready') === 'ready' && !project.brickIds.includes(b.id) && (store.showStarters || originOf(b) === 'own'))   // SB3: with starters hidden, Swap and Add offer own bricks only
  const params = neutral ? { ...resolved.params, ...NEUTRAL } : resolved.params

  const rotate = () => update(p => {
    const lk = p.lockedBricks ?? {}
    const free = p.brickIds.filter(b => !lk[b])
    if (free.length < 2) return {}
    const cycled = [...free.slice(1), free[0]]
    let i = 0
    return { brickIds: p.brickIds.map(b => lk[b] ? b : cycled[i++]) }
  })
  const toggleLock = (bid: string) => update(p => { const lk = { ...(p.lockedBricks ?? {}) }; if (lk[bid]) delete lk[bid]; else lk[bid] = true; return { lockedBricks: lk } })
  const swap = (from: string, to: string) => { update(p => ({ brickIds: p.brickIds.map(b => b === from ? to : b) })); setSwapping(null) }
  const remove = (bid: string) => update(p => { const lk = { ...(p.lockedBricks ?? {}) }; delete lk[bid]; return { brickIds: p.brickIds.filter(b => b !== bid), lockedBricks: lk } })
  const toggleRelation = (ref: ReturnType<typeof relRef>) => update(p => { const d = { ...p.disabled }; if (d[ref]) delete d[ref]; else d[ref] = true; return { disabled: d } })
  const thumbOf = (pv: ParameterValue) => store.bricks.find(b => b.id === pv.source?.brickId)?.photo.url
  // what a brick sets on the screens, whatever its label: measured, interpreted, or adapted (by rule, by the layout contract, or chosen by you in a conflict); shell defaults carry no brick
  const byBrick = (bid: string) => PARAMETER_KEYS.filter(k => resolved.values[k].source?.brickId === bid)
  const pickOf = (bid: string) => project.proposal?.picks.find(p => p.brickId === bid)
  const changed = whatChanged(project, resolved, store.bricks)

  return (
    <div className="chrome">
      {/* V1, moved from the phone Preview: up to three rule lines with the brick that set them */}
      <div className="px-4 pt-4"><Section title={COPY.changed}>
        {changed.length === 0 ? <div className="ink-2 text-[12px]">{COPY.changedEmpty}</div> : (
          <ul className="space-y-2">
            {changed.map(pv => (
              <li key={pv.key} className="flex items-start gap-2 text-[12px]">
                <Photo src={thumbOf(pv)} className="mt-px h-6 w-6 shrink-0 rounded object-cover" />
                <span className="min-w-0 flex-1 break-words">{rowHeadline(pv, resolved.params, store.bricks)} <span className="inline-block max-w-full align-middle"><ProvenanceChip pv={pv} showKey={false} /></span></span>
              </li>
            ))}
          </ul>
        )}
      </Section></div>
      <div className="grid min-w-0 gap-4 p-4 min-[960px]:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* Materials */}
        <aside className="flex min-w-0 flex-col gap-2">
          <div className="flex items-baseline justify-between"><h2 className="text-[13px]">Materials</h2><span className="ink-2 text-[11px]">top brick wins conflicts</span></div>
          {materials.map(b => (
            <div key={b.id} className="panel p-2" style={locked[b.id] ? { borderColor: 'var(--ink)' } : undefined}>
              <div className="flex items-center gap-2">
                <Link href={`/brick/${b.id}`} aria-label={`Open brick ${b.id}`}><Photo src={b.photo.url} className="h-10 w-14 rounded object-cover" style={{ outline: '1px solid var(--line)', ...tileFit(b.photo, 56 / 40) }} /></Link>
                <div className="min-w-0 flex-1">
                  <div className="mono text-[12px]">{b.id}</div><div className="ink-2 truncate text-[11px]" title={originLabel(b)}>{originLabel(b)}</div>
                  {(() => { const p = pickOf(b.id); return p ? <span className={`chip ${p.status === 'proposed' ? 'chip-proposed' : 'chip-adapted'} mt-0.5 px-1.5 text-[10px]`} title={p.status === 'proposed' ? `Proposed by the model for this intent, quoting: ${p.quotedRule}` : p.status === 'anchor' ? 'Chosen by you as the starting point' : `Swapped in by you for ${p.swappedFrom}`}>{p.status === 'proposed' ? 'proposed · model' : 'adapted · by you'}</span> : null })()}
                </div>
                {locked[b.id] && <span title="Locked: keeps its values through Swap and Rotate">🔒</span>}
              </div>
              <div className="mt-2 flex min-w-0 flex-wrap gap-1">
                {byBrick(b.id).map(k => <ProvenanceChip key={k} pv={resolved.values[k]} />)}
                {byBrick(b.id).length === 0 && <span className="ink-2 text-[11px]">contributes nothing right now</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <button type="button" className={`btn ${locked[b.id] ? '' : 'btn-quiet'} px-2 py-0.5 text-[11px]`} onClick={() => toggleLock(b.id)}>{locked[b.id] ? 'Unlock' : 'Lock'}</button>
                <button type="button" className="btn btn-quiet px-2 py-0.5 text-[11px]" disabled={!!locked[b.id] || spare.length === 0} onClick={() => setSwapping(swapping === b.id ? null : b.id)}>Swap</button>
                <button type="button" className="btn btn-quiet px-2 py-0.5 text-[11px]" disabled={!!locked[b.id]} onClick={() => remove(b.id)}>Remove</button>
              </div>
              {swapping === b.id && (
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {spare.map(s => <button key={s.id} type="button" onClick={() => swap(b.id, s.id)} className="overflow-hidden rounded" style={{ border: '1px solid var(--line)' }} title={`Swap in ${s.id}`}><div style={{ aspectRatio: '16 / 10' }}><Photo src={s.photo.url} className="h-full w-full object-cover" style={tileFit(s.photo, 16 / 10)} /></div><div className="mono px-1 text-[10px]">{s.id}</div></button>)}
                </div>
              )}
              <details className="mt-2 text-[11px]">
                <summary className="ink-2 cursor-pointer">relations</summary>
                <ul className="mt-1 space-y-1">
                  {b.relations.map(r => { const ref = relRef(b.id, r.id); return (
                    <li key={r.id} className="flex items-start gap-1">
                      {r.parameter !== 'none' ? <input type="checkbox" className="mt-0.5" checked={!project.disabled[ref]} onChange={() => toggleRelation(ref)} /> : <span className="chip chip-adapted mt-0.5 px-1 py-0 text-[10px]">no slot</span>}
                      <span className={project.disabled[ref] ? 'opacity-50' : ''}><span className="mono ink-2">{r.id}</span> {r.rule}</span>
                    </li>) })}
                </ul>
              </details>
            </div>
          ))}
          {materials.length < 5 && spare.length > 0 && (
            <details className="panel p-2 text-[12px]"><summary className="ink-2 cursor-pointer">Add a brick</summary>
              <div className="mt-2 grid grid-cols-3 gap-1">{spare.map(s => <button key={s.id} type="button" onClick={() => update(p => ({ brickIds: [...p.brickIds, s.id] }))} className="overflow-hidden rounded" style={{ border: '1px solid var(--line)' }}><div style={{ aspectRatio: '16 / 10' }}><Photo src={s.photo.url} className="h-full w-full object-cover" style={tileFit(s.photo, 16 / 10)} /></div><div className="mono px-1 text-[10px]">{s.id}</div></button>)}</div>
            </details>
          )}
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={rotate} disabled={materials.filter(b => !locked[b.id]).length < 2} title="Cycles which brick sits on top; locked bricks stay">Rotate</button>
            <button type="button" className={`btn ${neutral ? '' : 'btn-quiet'}`} onClick={onNeutral} title="Same colors, radius, type and spacing on every shell; only the relationship parameters remain">Neutral skin{neutral ? ' on' : ''}</button>
          </div>
        </aside>

        {/* Shell */}
        <div className="flex flex-wrap justify-center gap-4 self-start">
          {(screen === 'both' ? screensOf(toShellContent(project.content)) : [screen]).map(s => (
            <div key={s} className="w-full max-w-[320px] overflow-hidden rounded-[20px]" style={{ border: '1px solid var(--line)', background: '#111', padding: 6, height: 652 }}>
              <div className="h-full overflow-hidden rounded-[14px]"><Shell params={params} screen={s} height={640} flash={flash} content={toShellContent(project.content)} /></div>
            </div>
          ))}
          <p className="w-full text-center text-[11px] ink-2">Renders locally from one parameters.json; no model call. Edits happen through materials and the sheet.</p>
        </div>

        {/* Parameter sheet (block 3 version; block 4 adds conflicts and the cap rows) */}
        <aside className="flex min-w-0 flex-col gap-3">
          <Section title="Relationship">{RELATIONSHIP_KEYS.map(k => <Row key={k} k={k} pv={resolved.values[k]} params={resolved.params} bricks={store.bricks} thumb={thumbOf(resolved.values[k])} flash={flash.includes(k)} />)}</Section>
          <Section title="Skin">{SKIN_KEYS.map(k => <Row key={k} k={k} pv={resolved.values[k]} params={resolved.params} bricks={store.bricks} swatch={k.startsWith('color')} thumb={thumbOf(resolved.values[k])} flash={flash.includes(k)} />)}</Section>
          {resolved.conflicts.length > 0 && (
            <Section title="Conflicts">
              {resolved.conflicts.map(k => {
                const tiles = conflictTiles(resolved, k, project.choice[k])
                return (
                <div key={k} className="py-1 text-[12px]">
                  <div className="mono pb-1">{k}</div>
                  {/* C6: choose by preview. One tile per candidate: a mini-screen rendered with that brick's value, the whole tile one button (the mini-screen is static, so the button holds nothing interactive). */}
                  <div role="group" aria-label={`Choose ${k}`} className="flex flex-wrap gap-2">
                    {tiles.map(t => (
                      <button key={t.ref} type="button" aria-pressed={t.pressed} aria-label={`Use ${t.brickId}'s ${k} = ${t.value}`} onClick={() => update(p => ({ choice: { ...p.choice, [k]: t.ref } }))}
                        className="flex cursor-pointer flex-col items-start gap-1 rounded p-1 text-left" style={{ width: CONFLICT_W + 12, background: 'transparent', color: 'var(--ink)', border: `2px solid ${t.pressed ? 'var(--ink)' : 'var(--line)'}` }}>
                        <MiniPreview params={t.params} width={CONFLICT_W} />
                        <span className="mono block max-w-full break-words text-[11px]">{t.brickId} · {String(t.value)}</span>
                        <span className="ink-2 text-[11px]">{t.provenance}</span>
                      </button>
                    ))}
                  </div>
                  {!choiceStands(tiles, project.choice[k]) ? <div className="ink-2 pt-1 text-[11px]">{COPY.conflictDefault}</div> : <div className="pt-1"><ProvenanceChip pv={resolved.values[k]} showKey={false} /></div>}
                </div>
                )
              })}
            </Section>
          )}
          {resolved.capped.length > 0 && (
            <Section title="Switched off: cap of three">
              <ul className="space-y-1 text-[12px]">
                {resolved.capped.map(c => {
                  const bid = c.ref.split('/')[0]
                  const active = (resolved.candidates[c.key] ?? []).concat(...Object.values(resolved.candidates).map(x => x ?? [])).filter(x => x.ref.startsWith(bid + '/') && x.ref !== c.ref)
                  const last = [...new Set(active.map(x => x.ref))].pop()
                  return (
                    <li key={c.ref} className="flex items-center gap-2">
                      <span className="mono">{c.key}</span><span className="mono">= {String(c.value)}</span><span className="ink-2">· {c.provenance} · {c.ref}</span>
                      <button type="button" className="btn btn-quiet ml-auto px-2 py-0.5 text-[11px]" disabled={!last} title={last ? `Switches ${last} off so this one takes its place` : 'No active row of this brick to switch off'} onClick={() => last && update(p => ({ disabled: { ...p.disabled, [last as ReturnType<typeof relRef>]: true } }))}>swap in</button>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}
          <Section title="Could not be expressed">
            {resolved.unexpressed.length === 0 ? <div className="ink-2 text-[12px]">{COPY.unexpressedEmpty}</div> : (
              <ul className="space-y-1 text-[12px]">
                {resolved.unexpressed.map((u, i) => <li key={i} className="flex gap-2"><span className="chip chip-adapted shrink-0 px-1.5 text-[10px]">{u.reason === 'fragile' ? 'fragile if changed' : 'no slot'}</span><span><Link href={`/brick/${u.brickId}`} className="mono ink-2">{u.brickId}</Link> {u.rule}<span className="ink-2 mt-0.5 block text-[11px]">{standInLine(u.rule)}</span></span></li>)}
              </ul>
            )}
          </Section>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => download('parameters.json', exportJson(project.intent, resolved, project.proposal, project.brickIds), 'application/json')}>parameters.json</button>
            <button type="button" className="btn" onClick={() => download('tokens.css', exportCss(resolved, store.bricks), 'text/css')}>tokens.css</button>
            <button type="button" className="btn" onClick={() => download('handoff.md', exportHandoff(project.intent, materials, resolved, project.proposal), 'text/markdown')}>handoff.md</button>
          </div>
        </aside>
      </div>
    </div>
  )
}

