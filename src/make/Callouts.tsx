import { useLayoutEffect, useRef, useState } from 'react'
import type { ParameterKey } from '../shell/params'

/** Where a parameter shows on the List screen: the elements shell.css outlines for that parameter's one-second change (C11), most telling first.
 *  Read off the rendered screen, so a pin follows the scale and the layout; the shell is not touched. */
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
type Pin = { n: number; x: number; y: number }

/** The pin's diameter and the room it keeps from what it marks, in px. */
const SIZE = 20, GAP = 4

/** Measured drawing: the numbered callouts that tie a photo to the screens. Each photo that is on keeps its slot number (on its thumbnail too); from the
 *  tablet up the same number sits on the List screen as a pin at the first thing its lead parameter changes (Malik, 2026-11-04: no leader lines, no white
 *  outlines along them). A wide element (a row, a full-width title) gets the pin inside its left edge; a narrow one (a tag, a thumbnail) just left of it.
 *  The pin's thin white ring keeps it visible on any screen, a blue one included. Pins too close to share a place step down. */
export function Callouts({ marks }: { marks: Mark[] }) {
  const layer = useRef<HTMLDivElement>(null)
  const [pins, setPins] = useState<Pin[]>([])
  const sig = marks.map(m => `${m.n}:${m.key}`).join(',')

  useLayoutEffect(() => {
    const host = layer.current?.parentElement
    if (!host) return
    const measure = () => {
      const box = host.getBoundingClientRect()
      const list = host.querySelector('[aria-label="List screen"] .shell')
      if (!list || box.width === 0 || getComputedStyle(layer.current!).display === 'none') { setPins([]); return }
      const screen = list.getBoundingClientRect()
      const found = marks.flatMap(m => {
        const el = TARGET[m.key].map(s => list.querySelector(s)).find((e): e is Element => e !== null && e.getBoundingClientRect().height > 0)
        if (!el) return []
        const r = el.getBoundingClientRect()
        const wide = r.width > screen.width * 0.6
        const x = wide ? r.left + GAP + SIZE / 2 : Math.max(screen.left + GAP + SIZE / 2, r.left - GAP - SIZE / 2)
        return [{ n: m.n, x: Math.round(x - box.left), y: Math.round(r.top - box.top + Math.min(r.height / 2, 24)) }]
      }).sort((a, b) => a.y - b.y || a.x - b.x)
      for (let i = 1; i < found.length; i++) {
        const p = found[i - 1], q = found[i]
        if (Math.abs(q.x - p.x) < SIZE + GAP && q.y - p.y < SIZE + GAP) q.y = p.y + SIZE + GAP
      }
      setPins(found)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  return (
    <div ref={layer} className="callouts" aria-hidden="true">
      {pins.map(p => <span key={p.n} className="callout" style={{ left: p.x, top: p.y }}>{p.n}</span>)}
    </div>
  )
}
