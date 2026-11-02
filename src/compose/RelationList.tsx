import { candidatesOf, relRef, type Project } from '../lib/mapRelations'
import type { Brick } from '../lib/types'

/** Each transferable relation of a brick with an on/off switch and what it would set. */
export function RelationList({ brick, project, onToggle }: { brick: Brick; project: Project; onToggle: (ref: ReturnType<typeof relRef>) => void }) {
  const { candidates } = candidatesOf(brick)
  return (
    <ul className="space-y-1 text-[12px]">
      {brick.relations.map(r => {
        const ref = relRef(brick.id, r.id)
        const cand = candidates.find(c => c.ref === ref)
        const off = !!project.disabled[ref]
        return (
          <li key={r.id} className={`flex items-start gap-2 rounded px-1 py-0.5 ${off ? 'opacity-50' : ''}`}>
            {cand ? <input type="checkbox" checked={!off} onChange={() => onToggle(ref)} className="mt-1" /> : <span className="mt-1 inline-block h-3 w-3 rounded-sm bg-rose-300" title="cannot be expressed" />}
            <div>
              <div>{r.rule}</div>
              <div className="text-[11px] text-stone-500">
                {cand ? <><span className="font-mono">{cand.key}</span> = <b>{String(cand.value)}</b> · {cand.provenance}</> : <>parameter <span className="font-mono">{r.parameter}</span>: could not be expressed</>}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
