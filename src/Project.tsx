import { useMemo, useState } from 'react'
import { useStore } from './lib/store'
import { resolveProject, type Project as ProjectT } from './lib/mapRelations'
import type { ParameterValue } from './lib/types'
import { Shell } from './shell/Shell'
import { ParameterPanel } from './compose/ParameterPanel'
import { RelationList } from './compose/RelationList'
import { UnexpressedStrip } from './compose/UnexpressedStrip'
import { RegionOverlay } from './bricks/RegionOverlay'
import { download, exportCss, exportHandoff, exportJson } from './export'

function NewProject({ onCreate }: { onCreate: (intent: string) => void }) {
  const [intent, setIntent] = useState('A concert log for someone who goes to a lot of shows and wants to look back on a year.')
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-stone-300 bg-white p-4">
      <h2 className="mb-1 text-base font-semibold">Decide what to make</h2>
      <p className="mb-3 text-sm text-stone-600">One sentence: who it is for and what task it completes. This creates a project; your bricks stay as they are.</p>
      <textarea value={intent} onChange={e => setIntent(e.target.value)} rows={2} className="w-full rounded border border-stone-300 p-2 text-sm" />
      <button type="button" onClick={() => intent.trim() && onCreate(intent.trim())} className="mt-2 rounded bg-stone-800 px-3 py-1.5 text-sm text-white">Create project</button>
    </div>
  )
}

export function ProjectPage() {
  const store = useStore()
  const project = store.projects.find(p => p.id === store.activeProjectId) ?? null
  const [screen, setScreen] = useState<'list' | 'review' | 'both'>('both')
  const [hl, setHl] = useState<ParameterValue | null>(null)
  const resolved = useMemo(() => project ? resolveProject(project, store.bricks) : null, [project, store.bricks])

  if (!project || !resolved) {
    return (
      <div className="p-4">
        {store.projects.length > 0 && (
          <div className="mx-auto mb-4 max-w-xl text-sm">Open: {store.projects.map(p => <button key={p.id} type="button" onClick={() => store.setActive(p.id)} className="mr-2 underline">{p.intent.slice(0, 40)}…</button>)}</div>
        )}
        <NewProject onCreate={intent => store.createProject(intent)} />
      </div>
    )
  }
  const update = (patch: Partial<ProjectT> | ((p: ProjectT) => Partial<ProjectT>)) => store.updateProject(project.id, patch)
  const inProject = project.brickIds.map(id => store.bricks.find(b => b.id === id)!).filter(Boolean)
  const toggleBrick = (id: string) => update(p => ({ brickIds: p.brickIds.includes(id) ? p.brickIds.filter(x => x !== id) : [...p.brickIds, id] }))
  const swap = (from: string, to: string) => update(p => ({ brickIds: p.brickIds.map(x => x === from ? to : x) }))
  const hlBrick = hl?.source?.brickId ? inProject.find(b => b.id === hl.source!.brickId) : null

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <section className="rounded-lg border border-stone-300 bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div><div className="text-[10px] uppercase tracking-wide text-stone-500">Intent</div><div className="text-sm">{project.intent}</div></div>
            <button type="button" onClick={() => store.setActive(null)} className="text-[11px] text-stone-500 underline">switch project</button>
          </div>
        </section>

        <section className="rounded-lg border border-stone-300 bg-white p-3">
          <h3 className="mb-2 text-sm font-semibold">Pick materials</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {store.bricks.map(b => {
              const on = project.brickIds.includes(b.id)
              return (
                <div key={b.id} className={`rounded border p-1.5 ${on ? 'border-stone-800' : 'border-stone-200'}`}>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px]"><input type="checkbox" checked={on} onChange={() => toggleBrick(b.id)} /><b>{b.id}</b><span className="text-stone-500">{b.saved_at}</span></label>
                  <img src={b.photo.url} alt="" className="mt-1 h-20 w-full rounded object-cover" />
                  {on && store.bricks.length > project.brickIds.length && (
                    <select className="mt-1 w-full rounded border border-stone-300 text-[11px]" value="" onChange={e => e.target.value && swap(b.id, e.target.value)}>
                      <option value="">Swap for…</option>
                      {store.bricks.filter(x => !project.brickIds.includes(x.id)).map(x => <option key={x.id} value={x.id}>{x.id} ({x.saved_at})</option>)}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {inProject.map(b => (
          <section key={b.id} className="rounded-lg border border-stone-300 bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold">{b.id} · relations</h3>
            <RelationList brick={b} project={project} onToggle={ref => update(p => { const disabled = { ...p.disabled }; if (disabled[ref]) delete disabled[ref]; else disabled[ref] = true; return { disabled } })} />
          </section>
        ))}

        <section className="rounded-lg border border-stone-300 bg-white p-3">
          <h3 className="mb-2 text-sm font-semibold">Parameters {resolved.conflicts.length > 0 && <span className="ml-2 rounded bg-amber-200 px-1.5 text-[11px]">{resolved.conflicts.length} conflict{resolved.conflicts.length > 1 ? 's' : ''}: pick one</span>}</h3>
          <ParameterPanel project={project} resolved={resolved} onChange={update} onHighlight={pv => setHl(h => h?.key === pv?.key ? null : pv)} />
        </section>

        <section className="flex flex-wrap gap-2">
          <button type="button" onClick={() => download('parameters.json', exportJson(project.intent, resolved), 'application/json')} className="rounded border border-stone-400 bg-white px-3 py-1 text-sm hover:bg-stone-100">parameters.json</button>
          <button type="button" onClick={() => download('tokens.css', exportCss(resolved), 'text/css')} className="rounded border border-stone-400 bg-white px-3 py-1 text-sm hover:bg-stone-100">tokens.css</button>
          <button type="button" onClick={() => download('handoff.md', exportHandoff(project.intent, inProject, resolved), 'text/markdown')} className="rounded border border-stone-400 bg-white px-3 py-1 text-sm hover:bg-stone-100">handoff.md</button>
        </section>
      </div>

      <div className="flex flex-col gap-3 xl:sticky xl:top-4 xl:self-start">
        {hlBrick && hl && (
          <div className="rounded-lg border border-emerald-400 bg-white p-2">
            <div className="mb-1 text-[11px] text-emerald-900"><b>{hl.key}</b> = {String(hl.value)} · {hl.provenance} · read from {hl.source?.measurementIds?.join(', ')} on {hlBrick.id}</div>
            <RegionOverlay brick={hlBrick} highlight={hl.source?.regionLabels} className="max-h-56" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded border border-stone-400 text-sm">
            {(['list', 'review', 'both'] as const).map(s => <button key={s} type="button" onClick={() => setScreen(s)} className={`px-3 py-1 ${screen === s ? 'bg-stone-800 text-white' : 'bg-white hover:bg-stone-100'}`}>{s === 'list' ? 'List' : s === 'review' ? 'Year review' : 'Both'}</button>)}
          </div>
          <span className="text-[11px] text-stone-500">renders locally; no model call</span>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {(screen === 'both' ? ['list', 'review'] as const : [screen]).map(s => (
            <div key={s} className="w-[320px] overflow-hidden rounded-[22px] border-[7px] border-stone-800 bg-stone-800 shadow-xl" style={{ height: 640 }}>
              <Shell params={resolved.params} screen={s} height={626} />
            </div>
          ))}
        </div>
        <UnexpressedStrip items={resolved.unexpressed} />
      </div>
    </div>
  )
}
