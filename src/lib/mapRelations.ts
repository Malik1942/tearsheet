import { DEFAULT_PARAMS, PARAMETER_KEYS, PARAM_SPEC, normalize, type ParameterKey, type ParamValue, type Params } from '../shell/params'
import type { Brick, Composition, ParameterValue, Provenance, Relation, Unexpressed } from './types'

/** Resolve a hand-authored composition (fixtures) into the full parameter set. Keys no brick sets fall back to a neutral default labeled adapted. */
export function resolveParams(c: Composition): { params: Params; values: Record<ParameterKey, ParameterValue> } {
  const params = { ...DEFAULT_PARAMS }
  const values = {} as Record<ParameterKey, ParameterValue>
  for (const key of PARAMETER_KEYS) {
    const pv = c.parameters[key]
    if (pv) { params[key] = pv.value; values[key] = pv }
    else values[key] = adaptedDefault(key)
  }
  return { params, values }
}

export const adaptedDefault = (key: ParameterKey): ParameterValue =>
  ({ key, value: DEFAULT_PARAMS[key], provenance: 'adapted', locked: false, source: { brickId: '', note: 'shell default; no brick sets this' } })

/* ------------------------------------------------------------------ */
/* Reading a value out of a relation. The model's `target` is often a description of where the rule applies, not a value, */
/* so the number or keyword is looked for in target first and then in the rule text. null = cannot be expressed.          */

const WORD_NUM: Record<string, number> = { one: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }
const firstNumber = (s: string): number | null => {
  const m = s.match(/(\d+(?:\.\d+)?)/)
  if (m) return parseFloat(m[1])
  const w = s.toLowerCase().match(/\b(one|single|two|three|four|five|six)\b/)
  return w ? WORD_NUM[w[1]] : null
}
const percentRange = (s: string): number | null => {
  const r = s.match(/(\d+)\s*(?:-|–|to)\s*(\d+)\s*%/)
  if (r) return (parseInt(r[1]) + parseInt(r[2])) / 200
  const p = s.match(/(\d+)\s*%/)
  if (p) return parseInt(p[1]) / 100
  const frac = s.match(/(\d+)\s*\/\s*(\d+)/)
  if (frac && parseInt(frac[2]) >= 10) return parseInt(frac[1]) / (parseInt(frac[1]) + parseInt(frac[2]))
  if (frac && parseInt(frac[2]) <= 4 && parseInt(frac[1]) < parseInt(frac[2])) return parseInt(frac[1]) / parseInt(frac[2])
  const words: [RegExp, number][] = [[/two[- ]thirds/, 0.67], [/three[- ]quarters/, 0.75], [/half/, 0.5], [/one[- ]third/, 0.33], [/quarter/, 0.25]]
  for (const [re, v] of words) if (re.test(s)) return v
  return null
}

export function proposeValue(key: ParameterKey, rel: { rule: string; target: string }): ParamValue | null {
  const spec = PARAM_SPEC[key]
  const texts = [rel.target, rel.rule]
  if (spec.kind === 'enum' && typeof spec.values[0] === 'string' && key !== 'accent_coverage' && key !== 'hierarchy_mode') {
    for (const t of texts) {
      const low = t.toLowerCase()
      for (const v of spec.values as readonly string[]) if (low.includes(v.replace('<=', ''))) return v
    }
    return null
  }
  switch (key) {
    case 'hierarchy_mode': {
      for (const t of texts) {
        const low = t.toLowerCase()
        if (/\b(type|headline|title|wordmark|text|display)\b.*\b(lead|first|dominant|largest|hero)/.test(low) || /\bhero (headline|title|type|wordmark)/.test(low)) return 'type-led'
        if (/\bhero (object|image|photo|subject|product)|\b(image|photo|subject)\b.*\b(lead|dominant|fill|span)|image alone|no text overlay|without text/.test(low)) return 'image-led'
        if (/balanced|equal weight|side by side/.test(low)) return 'balanced'
      }
      return null
    }
    case 'type_scale_ratio': {
      for (const t of texts) { const m = t.match(/(\d+(?:\.\d+)?)\s*:\s*1/); if (m) return normalize(key, parseFloat(m[1])) }
      for (const t of texts) { const n = firstNumber(t); if (n !== null && n >= 1 && n <= 20) return normalize(key, n) }
      return null
    }
    case 'image_text_dominance': {
      for (const t of texts) { const p = percentRange(t); if (p !== null) return Math.round(p * 100) / 100 }
      return null
    }
    case 'density': {
      for (const t of texts) {
        const p = percentRange(t)
        if (p !== null && /empty|negative|white ?space|clear/i.test(t)) return p >= 0.5 ? 1 : p >= 0.3 ? 2 : p >= 0.15 ? 4 : 6
        const n = firstNumber(t); if (n !== null && /item|per (screen|view|viewport)/i.test(t)) return normalize(key, n)
      }
      return null
    }
    case 'accent_coverage': {
      for (const t of texts) { const p = percentRange(t); if (p !== null) return p <= 0.03 ? '<=2%' : p <= 0.09 ? '<=5%' : '<=15%' }
      return null
    }
    case 'palette_hue_count': {
      for (const t of texts) {
        if (/monochrome|achromatic|zero saturated|no saturated/i.test(t) && !/plus|\+|accent/i.test(t)) return 1
        const n = firstNumber(t.replace(/\d+\s*%/g, '')); if (n !== null && n >= 1 && n <= 3) return n
        if (/monochrome|neutral/i.test(t) && /accent/i.test(t)) return 2
      }
      return null
    }
    default: return null
  }
}

/* ------------------------------------------------------------------ */
/* A project: which bricks are in, which relations are enabled, which candidate wins a conflict, what is locked. */

export type RelationRef = `${string}/${string}`   // brickId/relationId
export const relRef = (brickId: string, relationId: string): RelationRef => `${brickId}/${relationId}`

export type Project = {
  id: string
  intent: string
  createdAt: string
  brickIds: string[]
  disabled: Record<RelationRef, true>
  choice: Partial<Record<ParameterKey, RelationRef>>
  locks: Partial<Record<ParameterKey, ParameterValue>>   // a lock freezes the whole value, provenance and source included
  manual: Partial<Record<ParameterKey, ParamValue>>      // values set by hand; provenance interpreted, source user
}

export type Candidate = ParameterValue & { ref: RelationRef; relation: Relation }

export type Resolved = {
  params: Params
  values: Record<ParameterKey, ParameterValue>
  candidates: Partial<Record<ParameterKey, Candidate[]>>
  conflicts: ParameterKey[]
  unexpressed: Unexpressed[]
}

/** Provenance per the brief: a relation whose rests_on chain reaches a measurement is measured; otherwise interpreted. */
export function provenanceOf(brick: Brick, rel: Relation): { provenance: Provenance; measurementIds: string[] } {
  const hyp = brick.hypotheses.find(h => h.id === rel.source_hypothesis)
  const mIds = new Set(brick.measurements.map(m => m.id))
  const measurementIds = (hyp?.rests_on ?? []).filter(id => mIds.has(id))
  return { provenance: measurementIds.length ? 'measured' : 'interpreted', measurementIds }
}

export function candidatesOf(brick: Brick): { candidates: Candidate[]; unexpressed: Unexpressed[] } {
  const candidates: Candidate[] = []
  const unexpressed: Unexpressed[] = []
  for (const rel of brick.relations) {
    if (rel.parameter === 'none') { unexpressed.push({ brickId: brick.id, rule: rel.rule, reason: 'parameter-none' }); continue }
    const key = rel.parameter as ParameterKey
    const value = proposeValue(key, rel)
    if (value === null) { unexpressed.push({ brickId: brick.id, rule: rel.rule, reason: 'unsupported-target' }); continue }
    const { provenance, measurementIds } = provenanceOf(brick, rel)
    const regionLabels = brick.regions.filter(r => r.measurement_ids.some(id => measurementIds.includes(id))).map(r => r.label)
    candidates.push({ key, value, provenance, locked: false, ref: relRef(brick.id, rel.id), relation: rel,
      source: { brickId: brick.id, relationId: rel.id, relationRule: rel.rule, measurementIds, regionLabels } })
  }
  if (brick.fragile_if_changed) unexpressed.push({ brickId: brick.id, rule: brick.fragile_if_changed, reason: 'fragile' })
  return { candidates, unexpressed }
}

/** Map a measured description of the type (weight, width, contrast, serif/sans) onto a font stack. The stack is adapted; the description it rests on is measured. */
const TYPE_STACKS: [RegExp, string, string][] = [
  [/condensed|narrow|compressed/, '"Oswald", "Arial Narrow", "Helvetica Neue Condensed", sans-serif', 'condensed sans'],
  [/geometric/, '"Futura", "Avenir Next", "Century Gothic", sans-serif', 'geometric sans'],
  [/grotesque|grotesk|low[- ]contrast sans|bold sans|heavy sans/, '"Helvetica Neue", "Inter", Arial, sans-serif', 'grotesque sans'],
  [/humanist sans/, '"Gill Sans", "Source Sans 3", "Segoe UI", sans-serif', 'humanist sans'],
  [/high[- ]contrast serif|didone|modern serif/, '"Didot", "Bodoni Moda", "Playfair Display", serif', 'high-contrast serif'],
  [/slab/, '"Rockwell", "Roboto Slab", "Zilla Slab", serif', 'slab serif'],
  [/\bserif\b/, '"Georgia", "Times New Roman", serif', 'serif'],
  [/mono|typewriter/, '"SF Mono", Menlo, Consolas, monospace', 'monospace'],
  [/script|handwrit|brush/, '"Snell Roundhand", "Brush Script MT", cursive', 'script'],
  [/\bsans\b/, '"Helvetica Neue", "Inter", Arial, sans-serif', 'sans'],
]

export function typeFamilyOf(brick: Brick): ParameterValue | null {
  for (const m of brick.measurements) {
    const full = `${m.statement} ${m.value}`.toLowerCase()
    if (!/\b(sans|serif|typeface|font|letterspac|grotesque|geometric|condensed|mono)/.test(full)) continue
    if (/no text|0 text|not visible/.test(full)) continue
    // the primary description: the first clause that names a type class; later clauses usually describe secondary text
    const clause = full.split(/[;.]|\bwhile\b|\bwhereas\b|,\s*(?=(?:cast|body|plate|tagline|subtitle|secondary|small))/).find(c => /\b(sans|serif|mono|script)/.test(c)) ?? full
    const text = /\b(wide|extended|heavy|extra-bold|black)\b/.test(clause) && !/\b(condensed|narrow)\b/.test(clause) ? clause.replace(/narrow/g, '') : clause
    for (const [re, stack, label] of TYPE_STACKS) {
      if (re.test(text)) {
        return { key: 'type_family', value: stack, provenance: 'adapted', locked: false,
          source: { brickId: brick.id, measurementIds: [m.id], regionLabels: brick.regions.filter(r => r.measurement_ids.includes(m.id)).map(r => r.label),
            note: `${label}; the description is measured (${m.id}), the stack is the shell's substitute. No typeface is named: the prompt forbids names unless unmistakable.` } }
      }
    }
  }
  return null
}

export function skinOf(brick: Brick): Partial<Record<ParameterKey, ParameterValue>> {
  const s = brick.skin_measured
  if (!s) return {}
  const mk = (key: ParameterKey, value: string): ParameterValue => ({ key, value, provenance: 'measured', locked: false, source: { brickId: brick.id, note: s.how_measured } })
  const tf = typeFamilyOf(brick)
  return { color_bg: mk('color_bg', s.color_bg), color_fg: mk('color_fg', s.color_fg), color_accent: mk('color_accent', s.color_accent), ...(tf ? { type_family: tf } : {}) }
}

/** Derive everything the prototype and the panel need. `unexpressed` is never hand-edited. */
export function resolveProject(project: Project, bricks: Brick[]): Resolved {
  const inProject = project.brickIds.map(id => bricks.find(b => b.id === id)).filter((b): b is Brick => !!b)
  const candidates: Partial<Record<ParameterKey, Candidate[]>> = {}
  const unexpressed: Unexpressed[] = []
  const skins: Partial<Record<ParameterKey, ParameterValue[]>> = {}
  for (const brick of inProject) {
    const c = candidatesOf(brick)
    unexpressed.push(...c.unexpressed)
    for (const cand of c.candidates) {
      if (project.disabled[cand.ref]) continue
      ;(candidates[cand.key] ??= []).push(cand)
    }
    for (const [k, pv] of Object.entries(skinOf(brick))) (skins[k as ParameterKey] ??= []).push(pv)
  }
  const values = {} as Record<ParameterKey, ParameterValue>
  const conflicts: ParameterKey[] = []
  for (const key of PARAMETER_KEYS) {
    const locked = project.locks[key]
    if (locked) { values[key] = { ...locked, locked: true }; continue }
    const manual = project.manual[key]
    if (manual !== undefined) { values[key] = { key, value: manual, provenance: 'interpreted', locked: false, source: { brickId: 'user', note: 'set by hand' } }; continue }
    const cands = candidates[key] ?? []
    if (cands.length > 1) conflicts.push(key)
    const chosen = cands.find(c => c.ref === project.choice[key]) ?? cands[0]
    if (chosen) { values[key] = { key: chosen.key, value: chosen.value, provenance: chosen.provenance, locked: false, source: chosen.source }; continue }
    const skin = skins[key]
    if (skin?.length) { values[key] = skin[0]; continue }   // first brick's measured skin; the panel can pick another
    values[key] = adaptedDefault(key)
  }
  const params = Object.fromEntries(PARAMETER_KEYS.map(k => [k, values[k].value])) as Params
  return { params, values, candidates, conflicts, unexpressed }
}
