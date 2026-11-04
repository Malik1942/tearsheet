import { HEADER_MARK } from './staticMarks'

/** The header's lockup (the board's nameplate: 150 px wide in a 56 px header). Under 240 px the letters drop the tear's bite and the rim under the
 *  name: TEARSHEET is set whole, in the face the board's letters are drawn from (Archivo 900 at width 62, 1000 units to the em, from x 768, so the
 *  letters stand where the board's do), beside the static mark, smoothed to three teeth a side for its size. Decorative: the link names it.
 *  `mark` colors the tear alone (the header's is ultramarine, Malik 2026-11-04); the letters keep currentColor. */
export function Lockup({ width = 150, mark }: { width?: number; mark?: string }) {
  const [x, y, w, h] = [0, -15, 5124, 715]
  return (
    <svg width={width} height={(width * h) / w} viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <path d={HEADER_MARK} fill="currentColor" style={mark ? { fill: mark } : undefined} />
      <text x="768" y="686" fill="currentColor" style={{ fontFamily: 'var(--font-poster)', fontWeight: 900, fontStretch: '62%', fontSize: 1000 }}>TEARSHEET</text>
    </svg>
  )
}
