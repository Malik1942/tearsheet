/** Rule before number (spec v2 C4′): the sentence a parameter's value reads as on the two prototype screens, and the row text built from it.
 *  Pure: no React, no model call. Each sentence was written from shell.css, ListScreen.tsx and DetailScreen.tsx; change one of those and change its sentence here. */
import { DEFAULT_PARAMS, RELATIONSHIP_KEYS, accentShows, type ParameterKey, type Params } from '../shell/params'
import type { Project, Resolved } from './mapRelations'
import type { Brick, Measurement, ParameterValue } from './types'

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
const lowerFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1)

/** Hue ranges in degrees: a hue below the first number is red, from there up to the next is orange, and so on; every lower bound is inclusive, 345 and over is red again. */
const HUES: [number, string][] = [[15, 'red'], [45, 'orange'], [70, 'yellow'], [165, 'green'], [190, 'teal'], [255, 'blue'], [290, 'purple'], [345, 'pink']]

/** A plain name for #RRGGBB, read from lightness, then saturation, then hue, then a qualifier (`light` from 0.7 up, `dark` up to 0.3; a dark orange or yellow is `brown`).
 *  A pale, nearly neutral color (lighter than 0.85, under 0.3 saturated) is `off-white`. Anything that is not #RRGGBB is grey. */
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
  if (l > 0.85 && s < 0.3) return 'off-white'
  const h = max === r ? (60 * (g - b)) / d + (g < b ? 360 : 0) : max === g ? (60 * (b - r)) / d + 120 : (60 * (r - g)) / d + 240
  const hue = HUES.find(([below]) => h < below)?.[1] ?? 'red'
  if ((hue === 'orange' || hue === 'yellow') && l < 0.35) return 'brown'
  return l >= 0.7 ? `light ${hue}` : l <= 0.3 ? `dark ${hue}` : hue
}

/** `side` is where a type-led item puts its poster square: the right, or the left under `alignment_edge: right` (see `landsOn`). */
const HIERARCHY = (side: string): Record<string, string> => ({
  'type-led': `The artist name leads each list item at headline size and the poster shrinks to a square on the ${side}; year-review rows drop their thumbnails.`,
  'image-led': 'The poster leads each list item, full width above the text; year-review rows become full-width images.',
  balanced: 'Poster and text sit side by side in each list item.',
})
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
  alternating: 'Every other item puts its poster on the other side, on both screens.',
  'featured-first': 'The first show becomes a large feature; the year review opens with “Show of the year” and puts the biggest section first.',
}
/** `alternating` moves the poster to the other side, which depends on where the hierarchy put it: type-led already has it at `side`, image-led has it above the text.
 *  "Every other", not "every second": section titles shift the `nth-child` parity, so the first row to move is not always the second. */
const ALTERNATING = (side: string): Record<string, string> => ({
  'type-led': `With type-led items the poster is already on the ${side}, so alternating changes nothing on the list; on the year review every other row moves its date to the front.`,
  'image-led': 'Every other item puts its poster below the text, on both screens.',
})
/** `left` and `right` also say where the poster goes, which the hierarchy decides. `.shell[data-align="right"] .item { direction: rtl }` reverses the grid tracks:
 *  balanced has the poster in the first track, so it is on the right under `right`; type-led has it in the second track (`order: 2`), so it is on the left under `right` and on the right under `left`;
 *  image-led is a single column, so the poster stays full width above the text. Anything that is not type-led or image-led reads as balanced. */
const ALIGNMENT = (hierarchy: string): Record<string, string> => {
  const typeLed = hierarchy === 'type-led', imageLed = hierarchy === 'image-led'
  return {
    left: typeLed ? 'Text hugs the left edge; the poster square sits on the right.'
      : imageLed ? 'Text hugs the left edge; posters stay full width above the text.'
      : 'Text hugs the left edge; the right side stays empty.',
    right: typeLed ? 'Text hugs the right edge and the poster square moves to the left.'
      : imageLed ? 'Text hugs the right edge; posters stay full width above the text.'
      : 'Text hugs the right edge and posters move to the right.',
    center: 'Titles, dates and headings are centered.',
    split: 'Artist names sit left and the date line sits right.',
  }
}
const HERO_ONE = "the first show's title does not stand out."
const heroTitle = (n: string) => `Only the first show's title and the “2025” headline are ${n}.`
/** Where the accent lands, by placement and then coverage: [with two hues or more (n = the accent's color name), with one hue, where the accent is the text color, after "With one hue the accent is the text color: "]. `none` is handled in landsOn. */
const ACCENT: Record<string, Record<string, [(n: string) => string, string]>> = {
  labels: {
    '<=15%': [n => `Genre tags are filled ${n}; year-review totals are ${n}.`, 'genre tags are filled with it.'],
    '<=5%': [n => `Genre tags are outlined in ${n}; year-review totals are ${n}.`, 'genre tags are outlined in it.'],
    '<=2%': [n => `Genre tags stay grey with a small ${n} dot; year-review totals are ${n}.`, 'genre tags stay grey with a small dot in it.'],
  },
  actions: {
    '<=15%': [n => `Only the Details buttons are filled ${n}.`, 'the Details buttons are filled with it.'],
    '<=5%': [n => `Only the Details buttons are ${n}.`, 'the Details buttons are outlined in it.'],
    '<=2%': [n => `Only the Details buttons carry the accent, as a ${n} underline.`, 'the Details buttons get an underline in it.'],
  },
  dividers: {
    '<=15%': [n => `The lines between items are ${n} and 6 px thick.`, 'the lines between items are 6 px thick in it.'],
    '<=5%': [n => `The lines between items are ${n} and 2 px thick.`, 'the lines between items are 2 px thick in it.'],
    '<=2%': [n => `The lines between items are ${n} and 1 px thick.`, 'the lines between items are drawn in it.'],
  },
  'one-hero': {
    '<=15%': [n => `The first show is filled ${n} and the “2025” headline is ${n}.`, 'the first show is filled with it.'],
    '<=5%': [heroTitle, HERO_ONE],
    '<=2%': [heroTitle, HERO_ONE],
  },
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
  // shell.css reverses each item under `alignment_edge: right` (`direction: rtl`), which moves the type-led square from the right end of the row to the left
  const side = params.alignment_edge === 'right' ? 'left' : 'right'
  switch (key) {
    case 'type_scale_ratio': {
      const base = H === 'type-led' ? `Artist names lead at ${R}× the body text; the “2025” headline is ${R}× too.`
        : H === 'image-led' ? `List titles stay small under the poster; year-review section titles are ${r}× and the “2025” headline is ${R}×.`
        : `Artist names are ${r}× the body text; the “2025” headline is ${R}×.`
      // the featured first show sets its title in the display size; under type-led every name already does
      return params.rhythm === 'featured-first' && H !== 'type-led' ? `${base} The first show's title is ${R}×.` : base
    }
    case 'hierarchy_mode': return entry(HIERARCHY(side), key, params)
    case 'density': return entry(DENSITY, key, params)
    case 'grouping': return entry(GROUPING, key, params)
    case 'rhythm': return (params.rhythm === 'alternating' ? ALTERNATING(side)[String(H)] : undefined) ?? entry(RHYTHM, key, params)
    case 'alignment_edge': return entry(ALIGNMENT(String(H)), key, params)
    case 'image_text_dominance': {
      const base = H === 'type-led' ? `The poster sits on the ${side} as a square up to ${Math.round(layout * 60)}% of the item's width; year-review rows have no thumbnails.`
        : H === 'image-led' ? `Posters run full width above the text, ${P}% of the item's height; year-review images grow with it.`
        : `Posters take ${P}% of each list item's width; year-review thumbnails grow with it.`
      return s > 0.8 ? `${base} Capped at 80% so the text stays readable.` : s < 0.15 ? `${base} Raised to 15% so the poster stays visible.` : base
    }
    case 'accent_placement': {
      if (params.accent_placement === 'none') return 'No element takes the accent color.'
      const [two, one] = entry(entry(ACCENT, key, params), 'accent_coverage', params)
      return accentShows(params) ? two(n) : `With one hue the accent is the text color: ${one}`
    }
    case 'accent_coverage':
      return params.accent_placement === 'none' ? 'No element takes the accent, so coverage has no effect.'
        : `At ${String(params.accent_coverage).replace('<=', '≤')} coverage: ${lowerFirst(landsOn('accent_placement', params))}`
    case 'palette_hue_count':
      return hues < 2 ? (params.accent_set ? `One hue, used as the accent: ${n}; everything else is the text color.` : 'One hue: the accent falls back to the text color, so nothing is colored.')
        : hues < 3 ? `Two hues: the text color plus ${n} for the accent.`
        : 'A third hue tints the genre tags on the list.'
    case 'color_bg': return `${cap(colorName(String(params.color_bg)))} page background on both screens.`
    case 'color_fg': return `${cap(colorName(String(params.color_fg)))} text; muted text and lines are mixed from it.`
    case 'color_accent': return accentShows(params) ? `${cap(n)} accent; accent_placement decides where it shows.` : 'Unused: with one hue the accent is the text color.'
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

/** The measurement a footnote cites, one pick for the Sheet and the Brick screen (the footnote prints it, the Brick screen highlights it on hover). Of the measurements a value rests on, the first one
 *  (in the order of `measurementIds`) that the brick has and whose value contains a digit; when none has a digit, the first that exists; undefined when there is none. */
export function footnoteMeasurement(brick: Brick | undefined, measurementIds: string[] | undefined): Measurement | undefined {
  const have = (measurementIds ?? []).map(id => brick?.measurements.find(m => m.id === id)).filter((m): m is Measurement => m !== undefined)
  return have.find(x => /\d/.test(String(x.value))) ?? have[0]
}

/** The footnote under a row: `m3: ~4% of frame`, the measurement `footnoteMeasurement` picks; null when there is none. */
export function footnoteFor(brick: Brick | undefined, measurementIds: string[] | undefined): string | null {
  const m = footnoteMeasurement(brick, measurementIds)
  return m ? `${m.id}: ${m.value}` : null
}

/** The footnote of a value: `footnoteFor` its brick and the measurements it cites. */
export const footnoteOf = (pv: ParameterValue, bricks: Brick[]): string | null => footnoteFor(bricks.find(b => b.id === pv.source?.brickId), pv.source?.measurementIds)

/** The conclusion the phone preview leads with (V1, "What changed and why"): up to three relationship values that a brick of this project set by a rule, so the person reads what the references did.
 *  Not `user` and not a shell default; ordered by the brick's position in `project.brickIds`, then by the vocabulary's key order. */
export function whatChanged(project: Project, resolved: Resolved, bricks: Brick[]): ParameterValue[] {
  const position = (pv: ParameterValue) => bricks.some(b => b.id === pv.source?.brickId) ? project.brickIds.indexOf(pv.source?.brickId ?? '') : -1
  return RELATIONSHIP_KEYS.map((k, order) => ({ pv: resolved.values[k], order, at: position(resolved.values[k]) }))
    .filter(({ pv, at }) => at >= 0 && ruleTextOf(pv, bricks) !== null)
    .sort((a, b) => a.at - b.at || a.order - b.order)
    .slice(0, 3)
    .map(({ pv }) => pv)
}
