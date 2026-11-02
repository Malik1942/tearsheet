import type { Brick } from '../lib/types'

/** The photo with the model's region boxes drawn on it. `highlight` = measurement ids or region labels to emphasize. */
export function RegionOverlay({ brick, highlight = [], showAll = false, className = '' }: { brick: Brick; highlight?: string[]; showAll?: boolean; className?: string }) {
  const hl = new Set(highlight)
  return (
    <div className={`relative overflow-hidden rounded-md bg-stone-900 ${className}`} style={{ aspectRatio: `${brick.photo.width} / ${brick.photo.height}` }}>
      <img src={brick.photo.url} alt="" className="h-full w-full object-cover" />
      {brick.regions.map(r => {
        const on = hl.has(r.label) || r.measurement_ids.some(id => hl.has(id))
        if (!on && !showAll) return null
        const [x1, y1, x2, y2] = r.box_1000
        return (
          <div key={r.label} title={`${r.label} (${r.measurement_ids.join(', ')})`}
            className={`absolute border-2 ${on ? 'border-emerald-400 bg-emerald-300/20' : 'border-white/60'}`}
            style={{ left: `${x1 / 10}%`, top: `${y1 / 10}%`, width: `${(x2 - x1) / 10}%`, height: `${(y2 - y1) / 10}%` }}>
            <span className={`absolute left-0 top-0 max-w-full truncate px-1 text-[10px] ${on ? 'bg-emerald-400 text-emerald-950' : 'bg-white/70 text-stone-900'}`}>{r.label}</span>
          </div>
        )
      })}
    </div>
  )
}
