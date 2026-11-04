import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import './shell.css'
import { dataAttributes, toCssVars, typeScale, type ParameterKey, type Params } from './params'
import { ListScreen } from './ListScreen'
import { DetailScreen } from './DetailScreen'
import { BoardScreen } from './BoardScreen'
import { applyContract } from './contract'
import { CONCERT_CONTENT, type ScreenKey, type ShellContent } from './content'
import { HomeIndicator, StatusBar, TabBar } from './Device'
import { NO_FIT, fitFactors, fitSamples, type Factors } from './fit'
import { keepTails } from './wholeWords'

const pxOf = (n: number) => `${Number(n.toFixed(2))}px`

/** One JSON in, one render out. `screen` picks which of the three screens (a content shows two: `screensOf`); `data-shape` on the shell says which product it is, so a board's list hides its dates; everything else is parameters, and `content` is the words they show (the concert log unless given).
 *  The phone (item 3): a status bar, the screen that scrolls, a tab bar and a home indicator; the screen's top bar stays at the top of what scrolls.
 *  `flash` (spec v3 C11) names the parameters whose regions get the one-second outline; shell.css has one rule per key.
 *  `staticRender` draws every control as a non-interactive element with the same class, for a copy inside a button or a link (a mini-preview): a button must not hold a button.
 *  Whole words (contract rule 7, fit.ts): after layout and before paint, when the longest title word is wider than its box, the display and title steps
 *  scale down until it fits, one factor per step; then a body block that would end on an avoidable short tail binds its last two words (keepTails). Again
 *  when fonts finish loading and when the shell resizes. A static render has no layout, no fit and no tails. */
export function Shell({ params: given, screen, height = 640, flash, staticRender = false, content = CONCERT_CONTENT }: { params: Params; screen: ScreenKey; height?: number; flash?: ParameterKey[]; staticRender?: boolean; content?: ShellContent }) {
  // the layout contract (contract.ts) holds on every render, whoever resolved the parameters: a project's are already laid out, so this changes nothing there
  const params = applyContract(given).params
  const t = typeScale(Number(params.type_scale_ratio))
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<Factors>(NO_FIT)
  // a guard: the fit settles in one step, but a few refits for the same words and parameters are the most it may take, never a loop
  const inputs = `${JSON.stringify(given)}|${screen}|${height}`
  const tries = useRef<{ inputs: string; content: ShellContent | null; n: number }>({ inputs: '', content: null, n: 0 })
  // the short tails bound for the last layout (keepTails), undone before every new pass so a pair never outlives the layout it was bound for
  const untail = useRef<() => void>(() => {})
  // the observers call the latest render's refit (its type scale, words and factors), never the first one's
  const refitNow = useRef<() => void>(() => {})
  const refit = () => {
    const el = ref.current
    if (!el) return
    untail.current()
    untail.current = () => {}
    if (tries.current.n < 4) {
      const next = fitFactors(fitSamples(el, t, fit), t)
      // the new size re-renders and comes back here; the tails are bound on that pass, at the size that stays
      if (Math.abs(next.display - fit.display) > 0.001 || Math.abs(next.title - fit.title) > 0.001) { tries.current.n++; setFit(next); return }
    }
    untail.current = keepTails(el)
  }
  // every render: the words, the parameters or the screen may have changed; the factor comes from the words' unscaled widths, so it settles in one step
  useLayoutEffect(() => {
    if (tries.current.inputs !== inputs || tries.current.content !== content) tries.current = { inputs, content, n: 0 }
    refitNow.current = refit
    refit()
  })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let live = true
    document.fonts?.ready.then(() => { if (live) refitNow.current() })
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => refitNow.current()) : null
    ro?.observe(el)
    return () => { live = false; ro?.disconnect() }
  }, [])
  const style = { ...toCssVars(params), '--t-title': pxOf(t.title * fit.title), '--t-display': pxOf(t.display * fit.display), '--viewport-h': `${height}px` } as CSSProperties
  return (
    <div ref={ref} className="shell" lang="en" style={style} {...dataAttributes(params)} data-density={String(params.density)} data-shape={content.shape} data-flash={flash?.length ? flash.join(' ') : undefined}>
      <StatusBar />
      <div className="screen">
        {screen === 'list' ? <ListScreen params={params} staticRender={staticRender} content={content} /> : screen === 'board' ? <BoardScreen params={params} staticRender={staticRender} content={content} /> : <DetailScreen params={params} staticRender={staticRender} content={content} />}
      </div>
      <TabBar labels={content.tabs} active={screen === 'list' ? 0 : 1} staticRender={staticRender} />
      <HomeIndicator />
    </div>
  )
}
