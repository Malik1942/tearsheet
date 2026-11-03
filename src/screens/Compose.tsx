import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { resolveProject, relRef, type Project } from '../lib/mapRelations'
import { PARAMETER_KEYS, RELATIONSHIP_KEYS, SKIN_KEYS, type ParameterKey } from '../shell/params'
import type { ParameterValue } from '../lib/types'
import { Shell } from '../shell/Shell'
import { Photo } from '../bricks/Photo'
import { ProvenanceChip } from '../compose/ProvenanceChip'
import { download, exportCss, exportHandoff, exportJson } from '../export'

const NEUTRAL = { color_bg: '#F4F2EE', color_fg: '#1B1B1B', color_accent: '#6B6B6B', radius: '8px', type_family: 'system-ui, -apple-system, "Segoe UI", sans-serif', spacing_unit: '8px' } as const
const COPY = { unexpressedEmpty: 'Everything from these bricks found a slot.', conflictDefault: 'Using the top brick until you choose.', phone: 'Compose needs a wider screen. Your library is here on your phone.' }

/** Compose: three columns at >= 960 px. Materials (left) feed the shell (center); the sheet (right) shows every value with its provenance. */
export function ComposeScreen({ id }: { id: string }) {
  const store = useStore()
  const project = store.projects.find(p => p.id === id)
  const [screen, setScreen] = useState<'both' | 'list' | 'review'>('both')
  const [neutral, setNeutral] = useState(false)
  const [swapping, setSwapping] = useState<string | null>(null)
  const resolved = useMemo(() => project ? resolveProject(project, store.bricks) : null, [project, store.bricks])
  if (!project || !resolved) return <div className="chrome min-h-full p-4"><Link href="/projects" className="ink-2 text-[12px]">← Projects</Link><p className="mt-4 ink-2">No project with id {id}.</p></div>

  const update = (patch: Partial<Project> | ((p: Project) => Partial<Project>)) => store.updateProject(project.id, patch)
  const materials = project.brickIds.map(bid => store.bricks.find(b => b.id === bid)).filter((b): b is NonNullable<typeof b> => !!b)
  const locked = project.lockedBricks ?? {}
  const spare = store.bricks.filter(b => (b.status ?? 'ready') === 'ready' && !project.brickIds.includes(b.id))
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
  const byBrick = (bid: string) => PARAMETER_KEYS.filter(k => resolved.values[k].source?.brickId === bid && resolved.values[k].provenance !== 'adapted')

  return (
    <div className="chrome min-h-full">
      <header className="flex items-center gap-3 border-b px-4 py-2 hairline" style={{ background: 'var(--panel)' }}>
        <Link href="/" className="font-semibold no-underline" style={{ color: 'var(--ink)' }}>Tearsheet</Link>
        <span className="ink-2">/ <Link href="/projects" className="ink-2">Projects</Link> / {project.name || 'Untitled'}</span>
        <span className="ink-2 hidden truncate md:inline">· {project.intent}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded border hairline text-[12px]">
            {(['list', 'review', 'both'] as const).map(s => <button key={s} type="button" onClick={() => setScreen(s)} className="px-2 py-1" style={screen === s ? { background: 'var(--ink)', color: '#fff' } : { background: 'var(--panel)' }}>{s === 'list' ? 'List' : s === 'review' ? 'Year review' : 'Both'}</button>)}
          </div>
          <Link href={`/project/${project.id}/export`} className="btn btn-accent">Export</Link>
        </div>
      </header>
      <div className="px-4 py-1 text-[12px] ink-2 min-[960px]:hidden" style={{ borderBottom: '1px solid var(--line)' }}>{COPY.phone}</div>

      <div className="grid min-w-0 gap-4 p-4 min-[960px]:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* Materials */}
        <aside className="flex min-w-0 flex-col gap-2">
          <div className="flex items-baseline justify-between"><h2 className="text-[13px]">Materials</h2><span className="ink-2 text-[11px]">top brick wins conflicts</span></div>
          {materials.map(b => (
            <div key={b.id} className="panel p-2" style={locked[b.id] ? { borderColor: 'var(--ink)' } : undefined}>
              <div className="flex items-center gap-2">
                <Link href={`/brick/${b.id}`} aria-label={`Open brick ${b.id}`}><Photo src={b.photo.url} className="h-10 w-14 rounded object-cover" /></Link>
                <div className="min-w-0 flex-1"><div className="mono text-[12px]">{b.id}</div><div className="ink-2 text-[11px]">saved {b.saved_at}</div></div>
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
                  {spare.map(s => <button key={s.id} type="button" onClick={() => swap(b.id, s.id)} className="overflow-hidden rounded" style={{ border: '1px solid var(--line)' }} title={`Swap in ${s.id}`}><div style={{ aspectRatio: '16 / 10' }}><Photo src={s.photo.url} className="h-full w-full object-cover" /></div><div className="mono px-1 text-[10px]">{s.id}</div></button>)}
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
              <div className="mt-2 grid grid-cols-3 gap-1">{spare.map(s => <button key={s.id} type="button" onClick={() => update(p => ({ brickIds: [...p.brickIds, s.id] }))} className="overflow-hidden rounded" style={{ border: '1px solid var(--line)' }}><div style={{ aspectRatio: '16 / 10' }}><Photo src={s.photo.url} className="h-full w-full object-cover" /></div><div className="mono px-1 text-[10px]">{s.id}</div></button>)}</div>
            </details>
          )}
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={rotate} disabled={materials.filter(b => !locked[b.id]).length < 2} title="Cycles which brick sits on top; locked bricks stay">Rotate</button>
            <button type="button" className={`btn ${neutral ? '' : 'btn-quiet'}`} onClick={() => setNeutral(v => !v)} title="Same colors, radius, type and spacing on every shell; only the relationship parameters remain">Neutral skin{neutral ? ' on' : ''}</button>
          </div>
        </aside>

        {/* Shell */}
        <main className="flex flex-wrap justify-center gap-4 self-start">
          {(screen === 'both' ? (['list', 'review'] as const) : [screen]).map(s => (
            <div key={s} className="w-full max-w-[320px] overflow-hidden rounded-[20px]" style={{ border: '1px solid var(--line)', background: '#111', padding: 6, height: 652 }}>
              <div className="h-full overflow-hidden rounded-[14px]"><Shell params={params} screen={s} height={640} /></div>
            </div>
          ))}
          <p className="w-full text-center text-[11px] ink-2">Renders locally from one parameters.json; no model call. Edits happen through materials and the sheet.</p>
        </main>

        {/* Parameter sheet (block 3 version; block 4 adds conflicts and the cap rows) */}
        <aside className="flex min-w-0 flex-col gap-3">
          <Section title="Relationship">{RELATIONSHIP_KEYS.map(k => <Row key={k} k={k} pv={resolved.values[k]} thumb={thumbOf(resolved.values[k])} />)}</Section>
          <Section title="Skin">{SKIN_KEYS.map(k => <Row key={k} k={k} pv={resolved.values[k]} swatch={k.startsWith('color')} thumb={thumbOf(resolved.values[k])} />)}</Section>
          {resolved.conflicts.length > 0 && (
            <Section title="Conflicts">
              {resolved.conflicts.map(k => (
                <div key={k} className="py-1 text-[12px]">
                  <div className="mono">{k}</div>
                  {(resolved.candidates[k] ?? []).map(c => (
                    <label key={c.ref} className="flex cursor-pointer items-center gap-2 py-0.5">
                      <input type="radio" name={`c-${k}`} checked={(project.choice[k] ?? resolved.candidates[k]![0].ref) === c.ref} onChange={() => update(p => ({ choice: { ...p.choice, [k]: c.ref } }))} />
                      <span className="mono">{c.ref}</span><span className="mono">= {String(c.value)}</span><span className="ink-2">· {c.provenance}</span>
                    </label>
                  ))}
                  {!project.choice[k] ? <div className="ink-2 text-[11px]">{COPY.conflictDefault}</div> : <div className="pt-1"><ProvenanceChip pv={resolved.values[k]} showKey={false} /></div>}
                </div>
              ))}
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
                {resolved.unexpressed.map((u, i) => <li key={i} className="flex gap-2"><span className="chip chip-adapted shrink-0 px-1.5 text-[10px]">{u.reason === 'fragile' ? 'fragile if changed' : 'no slot'}</span><span><Link href={`/brick/${u.brickId}`} className="mono ink-2">{u.brickId}</Link> {u.rule}</span></li>)}
              </ul>
            )}
          </Section>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => download('parameters.json', exportJson(project.intent, resolved), 'application/json')}>parameters.json</button>
            <button type="button" className="btn" onClick={() => download('tokens.css', exportCss(resolved), 'text/css')}>tokens.css</button>
            <button type="button" className="btn" onClick={() => download('handoff.md', exportHandoff(project.intent, materials, resolved), 'text/markdown')}>handoff.md</button>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel p-3"><h2 className="mb-2 text-[13px]">{title}</h2>{children}</section>
}

function Row({ k, pv, swatch, thumb }: { k: ParameterKey; pv: ParameterValue; swatch?: boolean; thumb?: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[12px]" style={{ borderTop: '1px solid var(--line)' }}>
      <span className="mono w-36 shrink-0 truncate" title={k}>{k}</span>
      {thumb ? <Photo src={thumb} className="h-4 w-4 shrink-0 rounded-sm object-cover" /> : <span className="inline-block h-4 w-4 shrink-0" />}
      {swatch && <span className="inline-block h-3 w-3 rounded-sm" style={{ background: String(pv.value), border: '1px solid var(--line)' }} />}
      {pv.provenance === 'adapted' && !pv.source?.measurementIds?.length && pv.source?.brickId !== 'user'
        ? <span className="ink-2"><span className="mono">{String(pv.value)}</span> · default</span>
        : <span className="min-w-0 flex-1 overflow-hidden"><ProvenanceChip pv={pv} showKey={false} /></span>}
    </div>
  )
}
