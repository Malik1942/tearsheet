import { LOCKUP_LETTERS, LOCKUP_MARK_EDGES, LOCKUP_VIEWBOX } from './board'
import { easeEdges, pagePolygon, pathOf } from './tear'

/** The lockup's mark: its own tear from the board, eased as scripts/brand.ts eases it for public/brand/lockup-*.svg. */
const MARK = pathOf(pagePolygon(easeEdges(LOCKUP_MARK_EDGES)))
const [, , VBW, VBH] = LOCKUP_VIEWBOX.split(' ').map(Number)

/** The header's lockup: the Claude Design board's primary lockup as drawn (Malik, 2026-11-04: "use the one from Claude Design"), its mark and TEARSHEET
 *  with the letters' bottoms bitten by the tear, without the rim under them ("no brown lines"); 150 px wide on a phone, 228 from the tablet up.
 *  Decorative: the link names it. `mark` colors the tear alone (the header's is ultramarine); the letters keep currentColor. */
export function Lockup({ width = 150, mark }: { width?: number; mark?: string }) {
  return (
    <svg width={width} height={(width * VBH) / VBW} viewBox={LOCKUP_VIEWBOX} aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <path d={MARK} fill="currentColor" style={mark ? { fill: mark } : undefined} />
      <path d={LOCKUP_LETTERS} fill="currentColor" />
    </svg>
  )
}
