/** Rule before number (spec v2 C4′): the sentence a parameter's value reads as on the two prototype screens, and the row text built from it.
 *  Pure: no React, no model call. Each sentence was written from shell.css, ListScreen.tsx and DetailScreen.tsx; change one of those and change its sentence here. */
import { DEFAULT_PARAMS, DISPLAY_CAP_PX, ITEM_PAD, NEUTRAL_TEXT_FAMILY, PARAM_SPEC, RELATIONSHIP_KEYS, accentShows, typeScale, type ParameterKey, type Params } from '../shell/params'
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
/** Density sets the padding above and below each list item (params.ts ITEM_PAD, in spacing units) and whether the note shows; an item is as tall as what it holds, so the sentence never counts items per screen.
 *  [how the list reads, what happens to the note]. */
const DENSITY: Record<string, [string, string]> = {
  1: ['The loosest list', 'notes show'],
  2: ['A loose list', 'notes show'],
  4: ['A compact list', 'notes are hidden'],
  6: ['The tightest list', 'notes are hidden'],
}
/** A list item's padding at this density: in px when spacing_unit is in px, else as a multiple of it. */
const itemPad = (params: Params): string => {
  const m = ITEM_PAD[Number(params.density)] ?? ITEM_PAD[Number(DEFAULT_PARAMS.density)]
  const unit = String(params.spacing_unit).trim(), px = /^(\d+(?:\.\d+)?)px$/.exec(unit)
  return px ? `${Number((Number(px[1]) * m).toFixed(2))} px` : `${m} × ${unit}`
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
  // tags are text (design pass A3): the tag text takes the accent, and at 15% only the first show's first tag is filled
  labels: {
    '<=15%': [n => `Genre tags are ${n}, and the first show's first tag is filled ${n}; year-review totals are ${n}.`, "genre tags are set in it, and the first show's first tag is filled with it."],
    '<=5%': [n => `Genre tags are ${n}; year-review totals are ${n}.`, 'genre tags are set in it.'],
    '<=2%': [n => `Genre tags stay grey with a small ${n} dot; year-review totals are ${n}.`, 'genre tags stay grey with a small dot in it.'],
  },
  // no per-row buttons (A3): the list's one action is the "Add show" button in its top bar
  actions: {
    '<=15%': [n => `Only the “Add show” button in the list's top bar is filled ${n}.`, "the “Add show” button in the list's top bar is filled with it."],
    '<=5%': [n => `Only the “Add show” button in the list's top bar is ${n}.`, "the “Add show” button in the list's top bar is outlined in it."],
    '<=2%': [n => `Only the “Add show” button in the list's top bar carries the accent, as a ${n} underline.`, "the “Add show” button in the list's top bar gets an underline in it."],
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
      // params.ts typeScale: title is body × r, display body × r², both capped at 44 px; a capped size is named in px
      const t = typeScale(r)
      const T = t.title >= DISPLAY_CAP_PX ? `${DISPLAY_CAP_PX} px (the cap)` : `${Number(r.toFixed(3))}×`
      const D = t.display >= DISPLAY_CAP_PX ? `${DISPLAY_CAP_PX} px (the cap)` : `${R}×`
      const ofBody = (x: string) => x.endsWith('×') ? `${x} the body text` : x
      const base = H === 'type-led' ? `Artist names lead at ${ofBody(D)}; the “2025” headline and the totals are ${D} too.`
        : H === 'image-led' ? `List titles stay small under the poster; year-review rows are ${T} and the “2025” headline and the totals are ${D}.`
        : `Artist names are ${ofBody(T)}; the “2025” headline and the totals are ${D}.`
      // the featured first show steps its name up to title size under image-led; under balanced and type-led every name already is at least that
      return params.rhythm === 'featured-first' && H === 'image-led' ? `${base} The first show's title is ${T}.` : base
    }
    case 'hierarchy_mode': return entry(HIERARCHY(side), key, params)
    case 'density': {
      const [list, note] = entry(DENSITY, key, params)
      return `${list}: ${itemPad(params)} above and below each item; ${note}.`
    }
    case 'grouping': return entry(GROUPING, key, params)
    case 'rhythm': return (params.rhythm === 'alternating' ? ALTERNATING(side)[String(H)] : undefined) ?? entry(RHYTHM, key, params)
    case 'alignment_edge': return entry(ALIGNMENT(String(H)), key, params)
    case 'image_text_dominance': {
      const base = H === 'type-led' ? `The poster sits on the ${side} as a square up to ${Math.round(layout * 60)}% of the item's width; year-review rows have no thumbnails.`
        : H === 'image-led' ? `Posters run full width above the text, ${P}% as tall as the room density gives each item; year-review images grow with it.`
        : `Posters take up to ${P}% of each list item's width (less on a narrow screen, so names stay whole, and never under 77 px); year-review thumbnails grow with it.`
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
      return radius === '0px' || radius === '0' ? 'Posters and buttons have square corners.' : `Corners of posters and buttons are ${radius}.`
    }
    case 'type_family': {
      // the shell's default family is the neutral skin, which toCssVars sets in Inter
      const family = String(params.type_family) === PARAM_SPEC.type_family.default ? NEUTRAL_TEXT_FAMILY : String(params.type_family)
      const first = family.split(',')[0].trim().replace(/^["']|["']$/g, '')
      return `Every text on both screens is set in ${first}.`
    }
    case 'spacing_unit': return `Padding and gaps step in ${String(params.spacing_unit)}; list items pad ${ITEM_PAD[Number(params.density)] ?? ITEM_PAD[Number(DEFAULT_PARAMS.density)]}×.`
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
