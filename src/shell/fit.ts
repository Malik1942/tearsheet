/** Layout contract rule 7's fit (docs/superpowers/specs/2026-11-04-whole-words-design.md): when a screen's longest title word is wider than its box, the
 *  screen's display and title steps scale down until it fits, one factor per step, so the screen keeps one display size and one title size (rule 3).
 *  Display never goes under the title size and title never under body; a word that still does not fit is left for rule 7 to report. A rendering fit,
 *  not a parameter change. `fitFactors` is the pure math; `fitSamples` reads the rendered words. */
import { TITLE_BLOCKS, wordBoxes } from './wholeWords'

export type Step = 'display' | 'title'
/** One word: its width at the step's own (unscaled) size, and the room its block gives it. */
export type FitSample = { step: Step; natural: number; avail: number }
export type Factors = Record<Step, number>
export const NO_FIT: Factors = { display: 1, title: 1 }

/** The factor that makes the widest word of a step fit with a 1 px margin, floored to 0.001 so rounding never pushes it back over. */
const need = (samples: FitSample[], step: Step) => Math.min(1, ...samples.filter(s => s.step === step && s.natural > 0).map(s => Math.floor(((s.avail - 1) / s.natural) * 1000) / 1000))

export function fitFactors(samples: FitSample[], sizes: { body: number; title: number; display: number }): Factors {
  // both capped at one size (a high ratio): a rendered size cannot tell the steps apart, so they are one step with one factor
  if (Math.abs(sizes.title - sizes.display) < 1) {
    const k = Math.min(1, Math.max(sizes.body / sizes.title, Math.min(need(samples, 'title'), need(samples, 'display'))))
    return { display: k, title: k }
  }
  const title = Math.max(sizes.body / sizes.title, need(samples, 'title'))
  // 1 px over the title, never on it: two steps at one rendered size could not be told apart, and the fit would read them wrong and oscillate
  const display = Math.max((sizes.title * title + 1) / sizes.display, need(samples, 'display'))
  return { display: Math.min(1, display), title: Math.min(1, title) }
}

/** Every title word on a rendered shell, tagged with the step its block is set in (its font size equals the scaled display or title size), at the
 *  step's unscaled size: the rendered width over the factor in force. A word the browser already broke counts whole (the sum of its line boxes).
 *  Blocks at body or caption size are not fitted. Browser only. */
export function fitSamples(shell: HTMLElement, sizes: { title: number; display: number }, current: Factors): FitSample[] {
  const out: FitSample[] = []
  const at = { display: sizes.display * current.display, title: sizes.title * current.title }
  for (const el of Array.from(shell.querySelectorAll<HTMLElement>(TITLE_BLOCKS))) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.whiteSpace === 'nowrap') continue
    const fs = parseFloat(cs.fontSize)
    const step: Step | null = Math.abs(fs - at.display) < 0.5 ? 'display' : Math.abs(fs - at.title) < 0.5 ? 'title' : null
    if (!step) continue
    const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    // a Range's boxes come back drawn (after a transform: Make scales the frame, MiniPreview the card); the room is in layout px, so undo the scale
    const drawn = el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1
    for (const w of wordBoxes(el, true)) {
      const width = w.rects.reduce((t, r) => t + (r.right - r.left), 0) / (drawn || 1)
      out.push({ step, natural: width / current[step], avail })
    }
  }
  return out
}
