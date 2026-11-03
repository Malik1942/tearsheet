/** The prototype shell's parameter vocabulary. Fixed and product-agnostic; bricks map onto it, projects pick which brick sets which key. */

export const RELATIONSHIP_KEYS = [
  'type_scale_ratio', 'hierarchy_mode', 'density', 'grouping', 'rhythm',
  'alignment_edge', 'image_text_dominance', 'accent_placement', 'accent_coverage', 'palette_hue_count',
] as const
export const SKIN_KEYS = ['color_bg', 'color_fg', 'color_accent', 'radius', 'type_family', 'spacing_unit'] as const
export const PARAMETER_KEYS = [...RELATIONSHIP_KEYS, ...SKIN_KEYS] as const

export type RelationshipKey = typeof RELATIONSHIP_KEYS[number]
export type SkinKey = typeof SKIN_KEYS[number]
export type ParameterKey = typeof PARAMETER_KEYS[number]
export type ParamValue = string | number

export type ParamSpec =
  | { kind: 'enum'; values: readonly ParamValue[]; default: ParamValue; effect: string }
  | { kind: 'range'; min: number; max: number; default: number; effect: string }
  | { kind: 'free'; default: string; effect: string }

export const PARAM_SPEC: Record<ParameterKey, ParamSpec> = {
  type_scale_ratio: { kind: 'enum', values: [1.125, 1.25, 1.414, 1.6, 2.0, 3.0], default: 1.25, effect: 'title vs body size contrast' },
  hierarchy_mode: { kind: 'enum', values: ['type-led', 'image-led', 'balanced'], default: 'balanced', effect: 'what leads a list item' },
  density: { kind: 'enum', values: [1, 2, 4, 6], default: 4, effect: 'items per viewport' },
  grouping: { kind: 'enum', values: ['none', 'by-time', 'by-place', 'by-tag'], default: 'none', effect: 'how items are grouped' },
  rhythm: { kind: 'enum', values: ['uniform', 'alternating', 'featured-first'], default: 'uniform', effect: 'list cadence' },
  alignment_edge: { kind: 'enum', values: ['left', 'right', 'center', 'split'], default: 'left', effect: 'which edge text hugs; the opposite side stays empty' },
  image_text_dominance: { kind: 'range', min: 0, max: 1, default: 0.4, effect: 'image share of each item' },
  accent_placement: { kind: 'enum', values: ['none', 'labels', 'actions', 'dividers', 'one-hero'], default: 'labels', effect: 'where the accent color appears' },
  accent_coverage: { kind: 'enum', values: ['<=2%', '<=5%', '<=15%'], default: '<=5%', effect: 'how much accent appears' },
  palette_hue_count: { kind: 'enum', values: [1, 2, 3], default: 2, effect: 'number of hues' },
  color_bg: { kind: 'free', default: '#F4F2EE', effect: 'background' },
  color_fg: { kind: 'free', default: '#1B1B1B', effect: 'text' },
  color_accent: { kind: 'free', default: '#2F6FED', effect: 'accent' },
  radius: { kind: 'free', default: '8px', effect: 'corner radius' },
  type_family: { kind: 'free', default: 'system-ui, -apple-system, "Segoe UI", sans-serif', effect: 'type family' },
  spacing_unit: { kind: 'free', default: '8px', effect: 'spacing unit' },
}

/** The parameters, plus one fact the shell needs that no single value carries: `accent_set`, true when a brick, a lock or a person set accent_coverage
 *  (the shell's default does not count). Without it a value set reads as unset, so one hue stays monochrome. */
export type Params = Record<ParameterKey, ParamValue> & { accent_set?: boolean }

/** Whether the accent color shows: at two or more hues, or at one hue when accent_coverage is set. One hue plus a set coverage is "one hue, used once
 *  as the bright spot": that hue is the accent, not the text color. */
export const accentShows = (p: Params): boolean => Number(p.palette_hue_count) >= 2 || !!p.accent_set

export const DEFAULT_PARAMS: Params = Object.fromEntries(
  PARAMETER_KEYS.map(k => [k, PARAM_SPEC[k].default]),
) as Record<ParameterKey, ParamValue>

/** Snap a proposed value onto the vocabulary. Returns null when the value cannot be expressed. */
export function normalize(key: ParameterKey, raw: ParamValue): ParamValue | null {
  const spec = PARAM_SPEC[key]
  if (spec.kind === 'free') return String(raw)
  if (spec.kind === 'range') {
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
    if (Number.isNaN(n)) return null
    return Math.min(spec.max, Math.max(spec.min, n))
  }
  const s = String(raw).trim().toLowerCase().replace('≤', '<=')
  for (const v of spec.values) {
    if (String(v).toLowerCase() === s) return v
  }
  if (typeof spec.values[0] === 'number') {
    const n = parseFloat(s)
    if (!Number.isNaN(n)) {
      // nearest allowed numeric value, so "10:1" type scale clamps to the top of the scale
      const nums = spec.values as readonly number[]
      return nums.reduce((best, v) => Math.abs(v - n) < Math.abs(best - n) ? v : best, nums[0])
    }
  }
  return null
}

const COVERAGE_FRACTION: Record<string, number> = { '<=2%': 0.02, '<=5%': 0.05, '<=15%': 0.15 }

/** Design pass A2: density sets the padding above and below a list item, in spacing units (32 24 16 12 px at 8 px), and never a min-height.
 *  Fewer items per screen means more room around each, not empty space under it. */
export const ITEM_PAD: Record<number, number> = { 1: 4, 2: 3, 4: 2, 6: 1.5 }

/** The shell's type scale (design pass A1): four sizes generated from type_scale_ratio r on a 15 px body. Caption is body / r but never under 11 px;
 *  display is body × r² capped at 44 px, and title (body × r) never passes display. A screen shows three of the four. */
export const BODY_PX = 15
export const CAPTION_MIN_PX = 11
export const DISPLAY_CAP_PX = 44
export function typeScale(ratio: number): { caption: number; body: number; title: number; display: number } {
  const display = Math.min(DISPLAY_CAP_PX, BODY_PX * ratio * ratio)
  return { caption: Math.max(CAPTION_MIN_PX, BODY_PX / ratio), body: BODY_PX, title: Math.min(display, BODY_PX * ratio), display }
}
const px = (n: number) => `${Number(n.toFixed(2))}px`

/** Under the shell's default family (the neutral skin) titles and display set in a display cut, body in Inter. Any other type_family (a letterform rule) sets both. */
export const NEUTRAL_TEXT_FAMILY = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif'
export const NEUTRAL_DISPLAY_FAMILY = '"Inter Display", "SF Pro Display", Inter, system-ui, -apple-system, sans-serif'

/** One JSON in, one set of CSS custom properties out. Layout switches ride as data attributes (see dataAttributes). */
export function toCssVars(p: Params): Record<string, string> {
  const ratio = Number(p.type_scale_ratio)
  const density = Number(p.density)
  const share = Number(p.image_text_dominance)
  // the list item needs a readable text column: the layout uses at most 80% image share even when the measured value is higher; the sheet keeps the measured value
  const layoutShare = Math.min(0.8, Math.max(0.15, share))
  const hues = Number(p.palette_hue_count)
  const t = typeScale(ratio)
  const family = String(p.type_family), neutral = family === PARAM_SPEC.type_family.default
  return {
    '--type-scale-ratio': String(ratio),
    '--t-caption': px(t.caption),
    '--t-body': px(t.body),
    '--t-title': px(t.title),
    '--t-display': px(t.display),
    '--density': String(density),
    '--item-pad': `calc(var(--space) * ${ITEM_PAD[density] ?? ITEM_PAD[Number(PARAM_SPEC.density.default)]})`,
    '--image-share': String(layoutShare),
    '--image-share-pct': `${Math.round(layoutShare * 100)}%`,
    '--accent-coverage': String(COVERAGE_FRACTION[String(p.accent_coverage)] ?? 0.05),
    '--hue-count': String(hues),
    '--color-bg': String(p.color_bg),
    '--color-fg': String(p.color_fg),
    '--color-accent': accentShows(p) ? String(p.color_accent) : String(p.color_fg),
    '--color-muted': `color-mix(in oklab, ${p.color_fg} 55%, ${p.color_bg})`,
    '--color-line': `color-mix(in oklab, ${p.color_fg} 18%, ${p.color_bg})`,
    '--color-surface': `color-mix(in oklab, ${p.color_fg} 6%, ${p.color_bg})`,
    '--color-tertiary': hues >= 3 ? `color-mix(in oklab, ${p.color_accent} 35%, ${p.color_bg})` : `color-mix(in oklab, ${p.color_fg} 10%, ${p.color_bg})`,
    '--radius': String(p.radius),
    '--font-family': neutral ? NEUTRAL_TEXT_FAMILY : family,
    '--font-display': neutral ? NEUTRAL_DISPLAY_FAMILY : family,
    '--space': String(p.spacing_unit),
  }
}

export function dataAttributes(p: Params): Record<string, string> {
  return {
    'data-hierarchy': String(p.hierarchy_mode),
    'data-grouping': String(p.grouping),
    'data-rhythm': String(p.rhythm),
    'data-align': String(p.alignment_edge),
    'data-accent': String(p.accent_placement),
    'data-coverage': String(p.accent_coverage).replace('<=', 'le'),
  }
}
