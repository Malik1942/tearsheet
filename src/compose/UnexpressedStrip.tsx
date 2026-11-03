import type { Unexpressed } from '../lib/types'
import { standInFor } from '../lib/standIns'

/** Always visible when non-empty: reference features no shell parameter can carry. */
export function UnexpressedStrip({ items }: { items: Unexpressed[] }) {
  if (!items.length) return null
  return (
    <div className="rounded-md border border-dashed border-rose-400 bg-rose-50 p-2 text-[12px] text-rose-900">
      <div className="mb-1 font-semibold uppercase tracking-wide text-[10px]">Could not be expressed</div>
      <ul className="space-y-1">
        {items.map((u, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="shrink-0 rounded bg-rose-200 px-1 text-[10px]">{u.reason === 'fragile' ? 'fragile if changed' : u.reason}</span>
            <span>{u.rule}<span className="mt-0.5 block text-[11px] text-rose-700">{`Stood in by: ${standInFor(u.rule)}`}</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}
