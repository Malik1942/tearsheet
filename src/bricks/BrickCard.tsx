import { useState } from 'react'
import type { Brick } from '../lib/types'
import { proposeValue, provenanceOf } from '../lib/mapRelations'
import type { ParameterKey } from '../shell/params'
import { RegionOverlay } from './RegionOverlay'

/** One brick: the photo with region boxes, the three lists, and the fragile-if-changed line. Click a measurement to see where it was read. */
export function BrickCard({ brick, compact = false, actions }: { brick: Brick; compact?: boolean; actions?: React.ReactNode }) {
  const [hl, setHl] = useState<string[]>([])
  const [showAll, setShowAll] = useState(false)
  const toggle = (id: string) => setHl(h => h.includes(id) ? h.filter(x => x !== id) : [...h, id])
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-stone-300 bg-white p-3 text-[12px] shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div><span className="font-semibold">{brick.id}</span> <span className="text-stone-500">saved {brick.saved_at}</span></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowAll(v => !v)} className="rounded border border-stone-300 px-2 py-0.5 text-[11px] hover:bg-stone-100">{showAll ? 'Hide boxes' : 'All boxes'}</button>
          {actions}
        </div>
      </div>
      <RegionOverlay brick={brick} highlight={hl} showAll={showAll} />
      <p className="text-[11px] text-stone-500">{brick.model.id} · effort {brick.model.effort} · {(brick.model.latency_ms / 1000).toFixed(1)} s · {brick.model.input_tokens} in / {brick.model.output_tokens} out</p>
      {!compact && (
        <>
          <section>
            <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Measurements</h4>
            <ul className="space-y-1">
              {brick.measurements.map(m => (
                <li key={m.id}>
                  <button type="button" onClick={() => toggle(m.id)} className={`w-full rounded px-1 text-left hover:bg-emerald-50 ${hl.includes(m.id) ? 'bg-emerald-100' : ''}`}>
                    <span className="font-mono text-[10px] text-stone-500">{m.id}</span> {m.statement} <span className="text-stone-500">· {m.value}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Hypotheses</h4>
            <ul className="space-y-1">
              {brick.hypotheses.map(h => (
                <li key={h.id} className="rounded border border-dotted border-amber-400 px-1">
                  <span className="font-mono text-[10px] text-stone-500">{h.id} · {Math.round(h.confidence * 100)}%</span> {h.statement}
                  <span className="text-stone-500"> · rests on {h.rests_on.length ? h.rests_on.join(', ') : 'nothing'}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-sky-800">Transferable relations</h4>
            <ul className="space-y-1">
              {brick.relations.map(r => {
                const prov = provenanceOf(brick, r)
                const value = r.parameter === 'none' ? null : proposeValue(r.parameter as ParameterKey, r)
                return (
                  <li key={r.id} className="rounded bg-sky-50 px-1">
                    <span className="font-mono text-[10px] text-stone-500">{r.id}</span> {r.rule}
                    <div className="text-[11px]">
                      <span className="rounded bg-sky-200 px-1 font-mono">{r.parameter}</span>
                      {r.parameter !== 'none' && <span> → {value === null ? <em className="text-rose-700">no value could be read</em> : <b>{String(value)}</b>}</span>}
                      <span className="text-stone-500"> · from {r.source_hypothesis} · {prov.provenance}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
          <p className="rounded border border-rose-300 bg-rose-50 px-2 py-1"><b>Fragile if changed:</b> {brick.fragile_if_changed}</p>
        </>
      )}
    </article>
  )
}
