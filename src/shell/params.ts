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

export type Params = Record<ParameterKey, ParamValue>

export const DEFAULT_PARAMS: Params = Object.fromEntries(
  PARAMETER_KEYS.map(k => [k, PARAM_SPEC[k].default]),
) as Params

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

/** One JSON in, one set of CSS custom properties out. Layout switches ride as data attributes (see dataAttributes). */
export function toCssVars(p: Params): Record<string, string> {
  const ratio = Number(p.type_scale_ratio)
  const density = Number(p.density)
  const share = Number(p.image_text_dominance)
  const hues = Number(p.palette_hue_count)
  return {
    '--type-scale-ratio': String(ratio),
    '--title-size': `calc(var(--body-size) * ${ratio})`,
    '--display-size': `calc(var(--body-size) * ${ratio} * ${ratio})`,
    '--density': String(density),
    '--item-vh': `${100 / density}svh`,
    '--image-share': String(share),
    '--image-share-pct': `${Math.round(share * 100)}%`,
    '--accent-coverage': String(COVERAGE_FRACTION[String(p.accent_coverage)] ?? 0.05),
    '--hue-count': String(hues),
    '--color-bg': String(p.color_bg),
    '--color-fg': String(p.color_fg),
    '--color-accent': hues >= 2 ? String(p.color_accent) : String(p.color_fg),
    '--color-muted': `color-mix(in oklab, ${p.color_fg} 55%, ${p.color_bg})`,
    '--color-line': `color-mix(in oklab, ${p.color_fg} 18%, ${p.color_bg})`,
    '--color-surface': `color-mix(in oklab, ${p.color_fg} 6%, ${p.color_bg})`,
    '--color-tertiary': hues >= 3 ? `color-mix(in oklab, ${p.color_accent} 35%, ${p.color_bg})` : `color-mix(in oklab, ${p.color_fg} 10%, ${p.color_bg})`,
    '--radius': String(p.radius),
    '--font-family': String(p.type_family),
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
