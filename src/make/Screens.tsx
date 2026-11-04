import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ParameterKey, Params } from '../shell/params'
import { Shell } from '../shell/Shell'
import type { ShellContent } from '../shell/content'

/** The shells render at their usual size inside a phone frame and are scaled, as MiniPreview does: one renderer, any size. */
const SHELL_W = 320, SHELL_H = 640, PAD = 6
const FRAME_W = SHELL_W + 2 * PAD, FRAME_H = SHELL_H + 2 * PAD
const SCREENS = [['list', 'List screen'], ['review', 'Year review screen']] as const

const useMedia = (q: string) => {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q), f = () => setOn(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [q])
  return on
}

/** The two screens. On a wide screen side by side, scaled by a factor from the height left under them once `reserve` px are kept for what follows
 *  (the photo row and its line), so the page fits one viewport (1440x900). On a phone one at a time in a swipe pager with two dots, scaled to the width. */
export function ScaledScreens({ params, flash, reserve, content }: { params: Params; flash: ParameterKey[]; reserve: number; content?: ShellContent }) {
  const wide = useMedia('(min-width: 768px)')
  const box = useRef<HTMLDivElement>(null)
  const pane = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.8)
  const [active, setActive] = useState(0)
  const measure = useCallback(() => {
    const el = box.current
    if (!el) return
    if (wide) {
      const top = el.getBoundingClientRect().top + window.scrollY
      const fit = (window.innerHeight - top - reserve) / FRAME_H
      setScale(Math.max(0.4, Math.min(1, fit)))
    } else setScale(Math.min(1, (el.clientWidth - 8) / FRAME_W))
  }, [wide, reserve])
  useLayoutEffect(() => { measure() }, [measure])
  useEffect(() => {
    // a phone: only on a width change (rotation); iOS Safari fires resize while its toolbar collapses during a scroll
    let w = window.innerWidth
    const on = () => { if (wide || window.innerWidth !== w) { w = window.innerWidth; measure() } }
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [measure, wide])

  const go = (i: number) => { const el = pane.current; if (!el) return; el.scrollTo({ left: i * el.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); setActive(i) }
  // the dot follows the pane once it rests on a snap point, so a tapped dot does not flicker back mid-scroll
  const onScroll = () => { const el = pane.current; if (!el || wide) return; const i = Math.round(el.scrollLeft / el.clientWidth); if (i !== active && Math.abs(el.scrollLeft - i * el.clientWidth) < 2) setActive(i) }

  return (
    <div ref={box} className="flex w-full flex-col items-center gap-3">
      <div ref={pane} onScroll={onScroll} className="flex w-full snap-x snap-mandatory overflow-x-auto md:justify-center md:gap-8 md:overflow-visible" style={{ scrollbarWidth: 'none' }}>
        {SCREENS.map(([key, label]) => (
          <div key={key} className="flex w-full shrink-0 snap-center justify-center md:w-auto" role="group" aria-label={label}>
            <div className="relative" style={{ width: FRAME_W * scale, height: FRAME_H * scale }}>
              {/* inert: the preview's own controls ("Add show", its Share) are a picture of the user's product, not this page's; they leave the tab order and the page outline */}
              <div inert className="absolute left-0 top-0 overflow-hidden rounded-[22px]" style={{ width: FRAME_W, height: FRAME_H, padding: PAD, background: '#111', border: '1px solid var(--line)', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <div className="h-full overflow-hidden rounded-[16px]"><Shell params={params} screen={key} height={SHELL_H} flash={flash} content={content} /></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex md:hidden" role="tablist" aria-label="Screen">
        {/* a 44 px target round an 8 px dot; the current one is longer as well as darker, so it never rests on color alone */}
        {SCREENS.map(([key, label], i) => (
          <button key={key} type="button" role="tab" aria-selected={active === i} aria-label={label} onClick={() => go(i)} className="flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0">
            <span aria-hidden="true" className="block h-2 rounded-full" style={{ width: active === i ? 16 : 8, background: active === i ? 'var(--ink)' : 'var(--ink-2)', opacity: active === i ? 1 : 0.5 }} />
          </button>
        ))}
      </div>
    </div>
  )
}
