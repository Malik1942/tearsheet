import { createPortal } from 'react-dom'
import type { Brick, Measurement } from '../lib/types'
import type { Rect } from '../lib/highlight'
import { peekPosition, peekRegions, peekSize } from '../lib/highlight'
import { Photo } from '../bricks/Photo'

/** Spec v3 C12: a floating card beside a sheet row with the photo its value was read from and the region box(es) of the measurement the row's footnote cites, labelled with that measurement's id,
 *  drawn the way the Brick screen draws them. Provenance as a pixel location. Without a region it shows the photo and says so. It does not take pointer events, so it never holds a hover open and a tap on it closes the peek.
 *  Rendered into the body so no scrolling or clipping ancestor of the row can cut it, and placed from the row's rect with a size known up front (`peekPosition`, `peekSize`). */
export function PhotoPeek({ id, brick, measurement, label, anchor }: { id: string; brick: Brick; measurement: Measurement | undefined; label: string; anchor: Rect }) {
  const size = peekSize(brick)
  const at = peekPosition(anchor, size, { w: window.innerWidth, h: window.innerHeight })
  const regions = peekRegions(brick, measurement?.id)
  return createPortal(
    <div id={id} role="region" aria-label={`Photo peek for ${label}`} className="pointer-events-none fixed z-50 flex flex-col gap-1.5 overflow-hidden p-2"
      style={{ left: at.left, top: at.top, width: size.w, height: size.h, boxSizing: 'border-box', background: 'var(--panel)', borderRadius: 8, boxShadow: '0 0 0 1px var(--line), 0 8px 24px rgba(26, 25, 23, 0.18)', color: 'var(--ink)', font: '12px/16px var(--font-ui)' }}>
      <div className="flex h-5 min-w-0 items-center gap-2 leading-5">
        <span className="truncate" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{brick.id}</span>
        <span className="shrink-0" style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{measurement ? measurement.id : label}</span>
      </div>
      <div className="relative mx-auto shrink-0 overflow-hidden" style={{ width: size.photo.w, height: size.photo.h, borderRadius: 4, background: '#1f1e1c' }}>
        <Photo src={brick.photo.url} alt={`${brick.id}, the photo this value was read from`} className="h-full w-full object-cover" />
        {measurement && regions.map(r => {
          const [x1, y1, x2, y2] = r.box_1000
          return (
            <div key={r.label} className="absolute"
              style={{ left: `${x1 / 10}%`, top: `${y1 / 10}%`, width: `${(x2 - x1) / 10}%`, height: `${(y2 - y1) / 10}%`, border: '2px solid var(--accent)', background: 'color-mix(in oklab, var(--accent) 18%, transparent)' }}>
              <span className="absolute left-0 top-0 px-1" style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: '14px' }}>{measurement.id}</span>
            </div>
          )
        })}
      </div>
      <p className="line-clamp-2 m-0 h-8" style={{ color: 'var(--ink-2)', fontSize: 11, lineHeight: '16px' }}>
        {!measurement || regions.length === 0 ? `No region recorded for ${measurement ? measurement.id : label}` : `${measurement.id}: ${measurement.value}`}
      </p>
    </div>,
    document.body,
  )
}
