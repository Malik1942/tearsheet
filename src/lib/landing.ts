/** Rule before number (spec v2 C4′): the sentence a parameter's value reads as on the two prototype screens, and the row text built from it.
 *  Pure: no React, no model call. Each sentence was written from shell.css, ListScreen.tsx and DetailScreen.tsx; change one of those and change its sentence here. */
import { DEFAULT_PARAMS, type ParameterKey, type Params } from '../shell/params'
import type { Brick, Measurement, ParameterValue } from './types'

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
const lowerFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1)

/** Hue ranges in degrees: a hue below the first number is red, from there up to the next is orange, and so on; every lower bound is inclusive, 345 and over is red again. */
const HUES: [number, string][] = [[15, 'red'], [45, 'orange'], [70, 'yellow'], [170, 'green'], [200, 'teal'], [255, 'blue'], [290, 'purple'], [345, 'pink']]

/** A plain name for #RRGGBB, read from lightness, then saturation, then hue. Anything that is not #RRGGBB is grey. */
export function colorName(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return 'grey'
  // whole-number channels, so a value that sits exactly on a threshold is exactly on it and the inclusive lower bounds hold
  const [r, g, b] = [m[1], m[2], m[3]].map(c => parseInt(c, 16))
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = (max + min) / 510
  const s = d === 0 ? 0 : d / (255 - Math.abs(max + min - 255))
  if (l < 0.12) return 'black'
  if (l > 0.94) return 'white'
  if (s < 0.12) return 'grey'
  const h = max === r ? (60 * (g - b)) / d + (g < b ? 360 : 0) : max === g ? (60 * (b - r)) / d + 120 : (60 * (r - g)) / d + 240
  return HUES.find(([below]) => h < below)?.[1] ?? 'red'
}

const HIERARCHY: Record<string, string> = {
  'type-led': 'The artist name leads each list item at headline size and the poster shrinks to a square on the right; year-review rows drop their thumbnails.',
  'image-led': 'The poster leads each list item, full width above the text; year-review rows become full-width images.',
  balanced: 'Poster and text sit side by side in each list item.',
}
const DENSITY: Record<string, string> = {
  1: 'One list item fills the screen, with its note.',
  2: 'Two list items per screen, with notes.',
  4: 'Four list items per screen; notes are hidden.',
  6: 'Six list items per screen; notes are hidden.',
}
const GROUPING: Record<string, string> = {
  none: 'One ungrouped list; the year review still groups by month.',
  'by-time': 'Shows are grouped under month headings on both screens.',
  'by-place': 'Shows are grouped by city on both screens.',
  'by-tag': 'Shows are grouped by genre on both screens.',
}
const RHYTHM: Record<string, string> = {
  uniform: 'Every list item has the same shape.',
  alternating: 'Every second item puts its poster on the other side, on both screens.',
  'featured-first': 'The first show becomes a large feature; the year review opens with “Show of the year” and puts the biggest section first.',
}
const ALIGNMENT: Record<string, string> = {
  left: 'Text hugs the left edge; the right side stays empty.',
  right: 'Text hugs the right edge and posters move to the right.',
  center: 'Titles, dates and headings are centered.',
  split: 'Artist names sit left and the date line sits right.',
}
const heroTitle = (n: string) => `Only the first show's title and the “2025” headline are ${n}.`
/** Where the accent lands, by placement and then coverage (n = the accent's color name); `who` is what the one-hue sentence says cannot stand out. `none` is handled in landsOn. */
const ACCENT: Record<string, { who: string; by: Record<string, (n: string) => string> }> = {
  labels: { who: 'genre tags', by: {
    '<=15%': n => `Genre tags are filled ${n}; year-review totals are ${n}.`,
    '<=5%': n => `Genre tags are outlined in ${n}; year-review totals are ${n}.`,
    '<=2%': n => `Genre tags stay grey with a small ${n} dot; year-review totals are ${n}.`,
  } },
  actions: { who: 'the Details buttons', by: {
    '<=15%': n => `Only the Details buttons are filled ${n}.`,
    '<=5%': n => `Only the Details buttons are ${n}.`,
    '<=2%': n => `Only the Details buttons carry the accent, as a ${n} underline.`,
  } },
  dividers: { who: 'the lines between items', by: {
    '<=15%': n => `The lines between items are ${n} and 6 px thick.`,
    '<=5%': n => `The lines between items are ${n} and 2 px thick.`,
    '<=2%': n => `The lines between items are ${n} and 1 px thick.`,
  } },
  'one-hero': { who: 'the first show', by: {
    '<=15%': n => `The first show is filled ${n} and the “2025” headline is ${n}.`,
    '<=5%': heroTitle,
    '<=2%': heroTitle,
  } },
}

/** The entry for a parameter's value; a value outside the vocabulary reads as the default's entry, so every call answers. */
const entry = <T>(table: Record<string, T>, key: ParameterKey, params: Params): T => table[String(params[key])] ?? table[String(DEFAULT_PARAMS[key])]

/** One sentence on where this parameter's value lands on the two prototype screens, read off the whole parameter set (a ratio lands differently under type-led than under image-led). */
export function landsOn(key: ParameterKey, params: Params): string {
  const r = Number(params.type_scale_ratio), R = Number((r * r).toFixed(2))
  const H = params.hierarchy_mode
  const s = Number(params.image_text_dominance), layout = Math.min(0.8, Math.max(0.15, s)), P = Math.round(layout * 100)   // the shell clamps the share the same way (toCssVars)
  const hues = Number(params.palette_hue_count)
  const n = colorName(String(params.color_accent))
  switch (key) {
    case 'type_scale_ratio':
      return H === 'type-led' ? `Artist names lead at ${R}× the body text; the “2025” headline is ${R}× too.`
        : H === 'image-led' ? `List titles stay small under the poster; year-review section titles are ${r}× and the “2025” headline is ${R}×.`
        : `Artist names are ${r}× the body text; the “2025” headline is ${R}×.`
    case 'hierarchy_mode': return entry(HIERARCHY, key, params)
    case 'density': return entry(DENSITY, key, params)
    case 'grouping': return entry(GROUPING, key, params)
    case 'rhythm': return entry(RHYTHM, key, params)
    case 'alignment_edge': return entry(ALIGNMENT, key, params)
    case 'image_text_dominance': {
      const base = H === 'type-led' ? `The poster sits right as a square up to ${Math.round(layout * 60)}% of the item's width; year-review rows have no thumbnails.`
        : H === 'image-led' ? `Posters run full width above the text, ${P}% of the item's height; year-review images grow with it.`
        : `Posters take ${P}% of each list item's width; year-review thumbnails grow with it.`
      return s > 0.8 ? `${base} Capped at 80% so the text stays readable.` : s < 0.15 ? `${base} Raised to 15% so the poster stays visible.` : base
    }
    case 'accent_placement': {
      if (params.accent_placement === 'none') return 'No element takes the accent color.'
      const placed = entry(ACCENT, key, params)
      return hues < 2 ? `With one hue the accent is the text color, so ${placed.who} do not stand out.` : entry(placed.by, 'accent_coverage', params)(n)
    }
    case 'accent_coverage':
      return params.accent_placement === 'none' ? 'No element takes the accent, so coverage has no effect.'
        : `At ${String(params.accent_coverage).replace('<=', '≤')} coverage: ${lowerFirst(landsOn('accent_placement', params))}`
    case 'palette_hue_count':
      return hues < 2 ? 'One hue: the accent falls back to the text color, so nothing is colored.'
        : hues < 3 ? `Two hues: the text color plus ${n} for the accent.`
        : 'A third hue tints the genre tags on the list.'
    case 'color_bg': return `${cap(colorName(String(params.color_bg)))} page background on both screens.`
    case 'color_fg': return `${cap(colorName(String(params.color_fg)))} text; muted text and lines are mixed from it.`
    case 'color_accent': return hues >= 2 ? `${cap(n)} accent; accent_placement decides where it shows.` : 'Unused: with one hue the accent is the text color.'
    case 'radius': {
      const radius = String(params.radius)
      return radius === '0px' || radius === '0' ? 'Posters, tags and buttons have square corners.' : `Corners of posters, tags and buttons are ${radius}.`
    }
    case 'type_family': {
      const first = String(params.type_family).split(',')[0].trim().replace(/^["']|["']$/g, '')
      return `Every text on both screens is set in ${first}.`
    }
    case 'spacing_unit': return `Padding and gaps step in ${String(params.spacing_unit)}; list items pad 2×.`
  }
}

/** A value nobody set: adapted, no measurement behind it, not typed by a person, no `by rule` or `by you` note. The sheet shows `value · default` for these. */
export const isShellDefault = (pv: ParameterValue): boolean =>
  pv.provenance === 'adapted' && !pv.source?.measurementIds?.length && pv.source?.brickId !== 'user' && !pv.source?.note?.startsWith('by')

/** The first measurement this value cites that its brick actually has. */
const measurementOf = (pv: ParameterValue, bricks: Brick[]): Measurement | undefined => {
  const have = bricks.find(b => b.id === pv.source?.brickId)?.measurements
  return pv.source?.measurementIds?.map(id => have?.find(m => m.id === id)).find(Boolean)
}

/** The rule a value carries: its relation's rule verbatim, or, for a value filled `by rule`, the statement of the measurement it rests on. */
export function ruleTextOf(pv: ParameterValue, bricks: Brick[]): string | null {
  if (pv.source?.relationRule) return pv.source.relationRule
  if (!pv.source?.note?.startsWith('by rule')) return null
  return measurementOf(pv, bricks)?.statement ?? null
}

/** Line 1 of a parameter row: the rule, then where it lands on this shell. Without a rule it says whose choice it is; a measured skin color is the landing sentence alone. */
export function rowHeadline(pv: ParameterValue, params: Params, bricks: Brick[]): string {
  const L = landsOn(pv.key, params)
  const rule = ruleTextOf(pv, bricks)
  if (rule) return `${rule} → ${L}`
  if (isShellDefault(pv)) return `Shell default → ${L}`
  if (pv.source?.brickId === 'user') return `Set by you → ${L}`
  return L
}

/** A measurement as the footnote under a row: `m3: ~4% of frame`. */
export const footnoteFor = (m: Pick<Measurement, 'id' | 'value'>): string => `${m.id}: ${m.value}`

/** The footnote of a value: the first measurement it cites that its brick has, or null when there is none. */
export function footnoteOf(pv: ParameterValue, bricks: Brick[]): string | null {
  const m = measurementOf(pv, bricks)
  return m ? footnoteFor(m) : null
}
