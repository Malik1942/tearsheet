/** 15_SIMPLIFY §4: short labels. A fixed table turns a parameter value into four words or fewer, with one provenance glyph and no word.
 *  Deterministic, no model. Shown on Library brick sheets, Picks cards and the See rows; the full rule stays one fold away. */
import { tooltipOf } from '../compose/provenanceCopy'
import { candidatesOf, type Candidate, type RelationRef } from './mapRelations'
import { RELATIONSHIP_KEYS, type ParameterKey, type ParamValue } from '../shell/params'
import type { Brick, ParameterValue } from './types'

/** `●` measured, `◐` interpreted, `◇` by rule, `○` by you. */
export type Glyph = '●' | '◐' | '◇' | '○'

export type ShortLabel = {
  key: ParameterKey
  value: ParamValue
  label: string
  glyph: Glyph
  /** The provenance tooltip, the words the glyph stands for (spec v3 C10 copy). */
  tip: string
  /** The candidate's ref in a project (`brick/r1`, `brick/r1:hierarchy_mode`): switching it off is `project.disabled[ref]`. */
  ref?: RelationRef
  relationId?: string
}

/** The label for one value, or null when the table has none (a middle value says nothing short). */
export function shortLabel(key: ParameterKey, value: ParamValue): string | null {
  const n = Number(value)
  switch (key) {
    case 'hierarchy_mode': return value === 'type-led' ? 'Title leads' : value === 'image-led' ? 'Image leads' : null
    case 'image_text_dominance': return n >= 0.6 ? 'Big images' : n <= 0.3 ? 'Mostly text' : null
    case 'density': return n <= 2 ? 'Lots of air' : n >= 6 ? 'Packed' : null
    case 'alignment_edge': return value === 'left' ? 'Left-aligned' : value === 'center' ? 'Centered' : value === 'right' ? 'Right-aligned' : null
    case 'accent_coverage': return value === '<=15%' ? 'A clear accent' : value === '<=5%' || value === '<=2%' ? 'One small accent' : null
    case 'palette_hue_count': return n <= 2 ? 'Two colors or fewer' : n >= 4 ? 'Many colors' : null
    case 'type_scale_ratio': return n >= 2 ? 'Big type contrast' : null
    case 'rhythm': return value === 'alternating' ? 'Alternating rows' : value === 'featured-first' ? 'One featured item' : null
    case 'grouping': return value && value !== 'none' ? 'Grouped' : null
    case 'color_bg': {
      const L = luminance(String(value))
      return L === null ? null : L <= 0.05 ? 'Dark field' : L >= 0.85 ? 'Light field' : null
    }
    default: return null
  }
}

/** WCAG relative luminance of a `#rrggbb` color, or null. */
function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** One glyph for a value's provenance. A value you set reads as yours whatever its label says, the same rule as the chip's tooltip. */
export function glyphOf(pv: ParameterValue): Glyph {
  if (pv.source?.brickId === 'user' || pv.source?.note?.startsWith('by you')) return '○'
  if (pv.provenance === 'measured') return '●'
  if (pv.provenance === 'interpreted') return '◐'
  return pv.source?.note?.startsWith('by rule') ? '◇' : '○'
}

/** Labels for a list of candidates, in order, skipping values the table has no label for and repeated labels. */
export function labelsOf(cands: (Candidate | ParameterValue)[]): ShortLabel[] {
  const out: ShortLabel[] = []
  for (const c of cands) {
    const label = shortLabel(c.key, c.value)
    if (!label || out.some(l => l.label === label)) continue
    out.push({ key: c.key, value: c.value, label, glyph: glyphOf(c), tip: tooltipOf(c), ref: 'ref' in c ? c.ref : undefined, relationId: c.source?.relationId })
  }
  return out
}

/** What a brick carries, for its sheet: up to three labels from the relationship values it would set on its own (the cap of three applies, as in
 *  a one-brick project), topped up from its measured background when fewer than three have a label. */
export function labelsOfBrick(brick: Brick, max = 3): ShortLabel[] {
  const rel = candidatesOf(brick).candidates.filter(c => (RELATIONSHIP_KEYS as readonly string[]).includes(c.key)).slice(0, 3)
  const labels = labelsOf(rel)
  if (labels.length < max && brick.skin_measured) {
    const bg: ParameterValue = { key: 'color_bg', value: brick.skin_measured.color_bg, provenance: 'measured', locked: false, source: { brickId: brick.id, note: brick.skin_measured.how_measured } }
    labels.push(...labelsOf([bg]).filter(l => !labels.some(x => x.label === l.label)))
  }
  return labels.slice(0, max)
}

/** The one label for the rule a brick was proposed for (Picks cards): the reading of that rule for the parameter it was filed under,
 *  else its first reading that has a label, else null. */
export function labelForRule(brick: Brick, quotedRule: string): ShortLabel | null {
  const rel = brick.relations.find(r => r.rule.trim() === quotedRule.trim())
  if (!rel) return null
  const mine = candidatesOf(brick).candidates.filter(c => c.source?.relationId === rel.id)
  const own = mine.filter(c => c.key === rel.parameter)
  return labelsOf([...own, ...mine.filter(c => c.key !== rel.parameter)])[0] ?? null
}
