import { LOCKUP_NAME_RIM } from './board'

/** The torn bottom of a display title (Malik, 2026-11-04: titles in the lettering with the tear underneath), read off the board's rim under the name:
 *  the band's upper edge is where the letters' bottoms are bitten, its lower edge is the fibre. Both are stretched across the title's full width and
 *  kept in the lockup's units, 1000 to the em, so a tear under LIBRARY at 160 px bites as deep as the board's under TEARSHEET at that size. */

type Edge = { x: number; y: number }[]

/** The band as two edges from left to right, in the lockup's units (down is larger): the path runs out along the fibre and back along the bite. */
function nameRimUnits(): { bite: Edge; fibre: Edge } {
  const pts = [...LOCKUP_NAME_RIM.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: Number(m[1]), y: Number(m[2]) }))
  const turn = pts.findIndex((p, i) => i > 0 && p.x < pts[i - 1].x)
  return { fibre: pts.slice(0, turn), bite: pts.slice(turn).reverse() }
}

/** The same edges with x in 0..1 across the name. */
function nameRim(): { bite: Edge; fibre: Edge } {
  const { bite, fibre } = nameRimUnits()
  const x0 = fibre[0].x, x1 = fibre[fibre.length - 1].x
  const norm = (e: Edge) => e.map(p => ({ x: (p.x - x0) / (x1 - x0), y: p.y }))
  return { fibre: norm(fibre), bite: norm(bite) }
}

const pct = (x: number) => `${(Math.min(1, Math.max(0, x)) * 100).toFixed(2)}%`
const em = (units: number) => `${(units / 1000).toFixed(4)}em`

/** `clip`: the title's box with its bottom torn along the bite (a clip-path, in the title's own em). `rim`: the fibre under it, for a box that starts
 *  `above` em over the title's bottom edge and is `height` em tall. The deepest bite sits on the title's bottom edge; the fibre hangs below it. */
export function tornBottom(): { clip: string; rim: string; above: number; height: number } {
  const { bite, fibre } = nameRim()
  const base = Math.max(...bite.map(p => p.y))   // the lowest point the letters keep
  const top = Math.min(...bite.map(p => p.y)), bottom = Math.max(...fibre.map(p => p.y))
  const clip = ['0 0', '100% 0', ...[...bite].reverse().map(p => `${pct(p.x)} calc(100% - ${em(base - p.y)})`)].join(', ')
  const rim = [...bite.map(p => `${pct(p.x)} ${em(p.y - top)}`), ...[...fibre].reverse().map(p => `${pct(p.x)} ${em(p.y - top)}`)].join(', ')
  return { clip: `polygon(${clip})`, rim: `polygon(${rim})`, above: (base - top) / 1000, height: (bottom - top) / 1000 }
}

export const TITLE_TEAR = tornBottom()
