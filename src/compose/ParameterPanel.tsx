import type { Candidate, Project, Resolved } from '../lib/mapRelations'
import type { ParameterValue } from '../lib/types'
import { PARAMETER_KEYS, PARAM_SPEC, RELATIONSHIP_KEYS, type ParameterKey, type ParamValue } from '../shell/params'
import { ProvenanceChip } from './ProvenanceChip'

type Props = {
  project: Project
  resolved: Resolved
  onChange: (patch: (p: Project) => Partial<Project>) => void
  onHighlight: (pv: ParameterValue | null) => void
}

function ValueEditor({ k, value, onSet }: { k: ParameterKey; value: ParamValue; onSet: (v: ParamValue | null) => void }) {
  const spec = PARAM_SPEC[k]
  if (spec.kind === 'enum') {
    return (
      <select className="rounded border border-stone-300 bg-white px-1 py-0.5 text-[11px]" value={String(value)} onChange={e => onSet(typeof spec.values[0] === 'number' ? Number(e.target.value) : e.target.value)}>
        {spec.values.map(v => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
      </select>
    )
  }
  if (spec.kind === 'range') {
    return <input type="range" min={spec.min} max={spec.max} step={0.05} value={Number(value)} onChange={e => onSet(Number(e.target.value))} className="w-24" />
  }
  return <input type="text" value={String(value)} onChange={e => onSet(e.target.value)} className="w-28 rounded border border-stone-300 px-1 py-0.5 font-mono text-[11px]" />
}

/** Every parameter: its value and provenance, who else wanted to set it, a lock, and a manual override. */
export function ParameterPanel({ project, resolved, onChange, onHighlight }: Props) {
  const lock = (k: ParameterKey) => onChange(p => {
    const locks = { ...p.locks }
    if (locks[k]) delete locks[k]
    else locks[k] = { ...resolved.values[k], locked: true }
    return { locks }
  })
  const setManual = (k: ParameterKey, v: ParamValue | null) => onChange(p => {
    const manual = { ...p.manual }
    if (v === null) delete manual[k]; else manual[k] = v
    return { manual }
  })
  const choose = (k: ParameterKey, ref: Candidate['ref']) => onChange(p => ({ choice: { ...p.choice, [k]: ref } }))

  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-[12px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wide text-stone-500"><th className="py-1">Parameter</th><th>Value · provenance</th><th>Also wanted by</th><th>Set by hand</th><th>Lock</th></tr>
      </thead>
      <tbody>
        {PARAMETER_KEYS.map(k => {
          const v = resolved.values[k]
          const cands = resolved.candidates[k] ?? []
          const conflict = resolved.conflicts.includes(k)
          const isRel = (RELATIONSHIP_KEYS as readonly string[]).includes(k)
          return (
            <tr key={k} className={`border-t border-stone-200 align-top ${isRel ? '' : 'opacity-80'} ${conflict ? 'bg-amber-50' : ''}`}>
              <td className="py-1.5 pr-2 font-mono text-[11px]">{k}<div className="font-sans text-[10px] text-stone-400">{PARAM_SPEC[k].effect}</div></td>
              <td className="py-1.5 pr-2"><ProvenanceChip pv={v} onClick={pv => onHighlight(pv.source?.regionLabels?.length ? pv : null)} /></td>
              <td className="py-1.5 pr-2">
                {cands.length > 1 ? (
                  <div className="flex flex-col gap-0.5">
                    {cands.map(c => (
                      <label key={c.ref} className="flex cursor-pointer items-center gap-1">
                        <input type="radio" name={`c-${k}`} checked={(project.choice[k] ?? cands[0].ref) === c.ref && !project.manual[k] && !project.locks[k]} onChange={() => choose(k, c.ref)} />
                        <span className="font-mono text-[11px]">{c.ref}</span> = {String(c.value)} <span className="text-stone-500">· {c.provenance}</span>
                      </label>
                    ))}
                  </div>
                ) : cands.length === 1 ? <span className="text-stone-500">only {cands[0].ref}</span> : <span className="text-stone-400">nobody</span>}
              </td>
              <td className="py-1.5 pr-2">
                <div className="flex items-center gap-1">
                  <ValueEditor k={k} value={project.manual[k] ?? v.value} onSet={val => setManual(k, val)} />
                  {project.manual[k] !== undefined && <button type="button" onClick={() => setManual(k, null)} className="text-[10px] text-stone-500 underline">clear</button>}
                </div>
              </td>
              <td className="py-1.5">
                <button type="button" onClick={() => lock(k)} title={project.locks[k] ? 'Unlock' : 'Lock this value; swapping bricks will not change it'}
                  className={`rounded border px-1.5 py-0.5 text-[11px] ${project.locks[k] ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-300 bg-white hover:bg-stone-100'}`}>
                  {project.locks[k] ? '🔒 locked' : 'lock'}
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table></div>
  )
}
