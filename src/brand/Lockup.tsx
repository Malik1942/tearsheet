import { useId } from 'react'
import { LOCKUP_MARK_EDGES, LOCKUP_VIEWBOX } from './board'
import { easeEdges, pagePolygon, pathOf } from './tear'
import { nameBite } from './tornEdge'

/** The lockup's mark: its own tear from the board, eased as scripts/brand.ts eases it for public/brand/lockup-*.svg. */
const MARK = pathOf(pagePolygon(easeEdges(LOCKUP_MARK_EDGES)))
const BITE = nameBite()
const [, , VBW, VBH] = LOCKUP_VIEWBOX.split(' ').map(Number)

/** The header's lockup: the Claude Design board's primary lockup (Malik, 2026-11-04: "use the one from Claude Design"), its mark as drawn and TEARSHEET
 *  bitten by the board's own tear, set a little nearer the baseline than the board's ("cut the letters a little less"), without the rim under them
 *  ("no brown lines"); 150 px wide on a phone, 228 from the tablet up. The letters are set whole in the face the board's are drawn from (Archivo 900 at
 *  width 62, 1000 units to the em, from x 768) and clipped. Decorative: the link names it. `mark` colors the tear alone (the header's is ultramarine). */
export function Lockup({ width = 150, mark }: { width?: number; mark?: string }) {
  const clip = useId()
  return (
    <svg width={width} height={(width * VBH) / VBW} viewBox={LOCKUP_VIEWBOX} aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <clipPath id={clip}><path d={BITE} /></clipPath>
      <path d={MARK} fill="currentColor" style={mark ? { fill: mark } : undefined} />
      <text x="768" y="686" fill="currentColor" clipPath={`url(#${clip})`} style={{ fontFamily: 'var(--font-poster)', fontWeight: 900, fontStretch: '62%', fontSize: 1000 }}>TEARSHEET</text>
    </svg>
  )
}
