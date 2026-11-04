import { useLayoutEffect, useRef, useState } from 'react'
import type { ParameterKey } from '../shell/params'

/** Where a parameter shows on the List screen: the elements shell.css outlines for that parameter's one-second change (C11), most telling first.
 *  Read off the rendered screen, so a callout follows the scale and the layout; the shell is not touched. */
const TARGET: Record<ParameterKey, string[]> = {
  type_scale_ratio: ['.item .title', '.large-title', '.bar-title'],
  hierarchy_mode: ['.item'], spacing_unit: ['.item'], density: ['.item'],
  grouping: ['.group-title', '.item'],
  alignment_edge: ['.item .text', '.bar', '.group-title'],
  rhythm: ['.item:nth-child(even)', '.item'],
  image_text_dominance: ['.pic', '.item'],
  radius: ['.pic', '.action', '.bar-title'],
  palette_hue_count: ['.tag', '.action', '.item .title'], color_accent: ['.tag', '.action', '.item .title'],
  accent_coverage: ['.tag', '.action', '.item'], accent_placement: ['.tag', '.action', '.item'],
  color_bg: ['.bar', '.item'], color_fg: ['.item .title', '.item .text'], type_family: ['.item .title', '.item .text'],
}

type Mark = { n: number; key: ParameterKey }
type Leader = { n: number; y: number; ty: number; tx: number }

/** Measured drawing: the numbered callouts that tie a photo to the screens. Each photo that is on keeps its slot number (on its thumbnail too); from the tablet up a leader runs
 *  from the number, at the spread's left edge, to the first thing its lead parameter changes on the List screen. Ultramarine on a white halo, so it reads over the dark bezel and any shell.
 *  Numbers too close to share a line step apart; the leaders still end on their own targets. */
export function Callouts({ marks }: { marks: Mark[] }) {
  const svg = useRef<SVGSVGElement>(null)
  const [leaders, setLeaders] = useState<Leader[]>([])
  const sig = marks.map(m => `${m.n}:${m.key}`).join(',')

  useLayoutEffect(() => {
    const host = svg.current?.parentElement
    if (!host) return
    const measure = () => {
      const box = host.getBoundingClientRect()
      const list = host.querySelector('[aria-label="List screen"] .shell')
      if (!list || box.width === 0 || getComputedStyle(svg.current!).display === 'none') { setLeaders([]); return }
      const found = marks.flatMap(m => {
        const el = TARGET[m.key].map(s => list.querySelector(s)).find((e): e is Element => e !== null && e.getBoundingClientRect().height > 0)
        if (!el) return []
        const r = el.getBoundingClientRect()
        const ty = Math.round(r.top - box.top + Math.min(r.height / 2, 24)), tx = Math.round(r.left - box.left - 4)   // ends just before the element, never on its text
        return [{ n: m.n, y: ty, ty, tx }]
      }).sort((a, b) => a.y - b.y)
      for (let i = 1; i < found.length; i++) if (found[i].y - found[i - 1].y < 26) found[i].y = found[i - 1].y + 26
      setLeaders(found)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  return (
    <svg ref={svg} className="callouts" aria-hidden="true">
      {leaders.map(l => (
        <g key={l.n}>
          <path className="halo" d={`M 24 ${l.y} H ${Math.max(28, l.tx - 16)} L ${l.tx} ${l.ty}`} />
          <path className="leader" d={`M 24 ${l.y} H ${Math.max(28, l.tx - 16)} L ${l.tx} ${l.ty}`} />
          <circle className="end" cx={l.tx} cy={l.ty} r="3" />
          <circle className="num" cx="12" cy={l.y} r="11" />
          <text x="12" y={l.y}>{l.n}</text>
        </g>
      ))}
    </svg>
  )
}
