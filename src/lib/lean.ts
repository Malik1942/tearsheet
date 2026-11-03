/** Lean chips (spec v3 P3): plain-language chips for the proposal page, generated from the library's own relations, never from skin colors.
 *  The app ranks them (no model call: principle 7) and the server turns the chosen ones into parameter families (src/lib/propose.ts). */
import type { Brick } from './types'
import { candidatesOf, type Candidate } from './mapRelations'
import { CHIP_IDS, DARK_RULE, type ChipId } from './leanFamilies'

export type { Lean } from './leanFamilies'

const DESC: Record<ChipId, string> = {
  dark: 'have a rule that sets a dark ground',
  airy: 'set density low (1–2 items per screen)',
  'one accent': 'keep the accent at or under 5%',
  'text-heavy': 'lead with text (image share at most half, or type-led)',
  'big titles': 'set titles at 2× the body or more',
  'left-aligned': 'align text to the left edge',
  'two colors': 'use two hues or fewer',
  grid: 'repeat items uniformly',
}

/** Whether a brick carries a chip, read from its relation layer: the parameter candidates, and for `dark` the rule text (DARK_RULE).
 *  Candidate values are read as the shell holds them (`density` 1|2|4|6, `accent_coverage` '<=2%'|'<=5%'|'<=15%', …). */
export const carries = (brick: Brick, chip: ChipId): boolean => carriesWith(brick, candidatesOf(brick).candidates, chip)

function carriesWith(brick: Brick, candidates: Candidate[], chip: ChipId): boolean {
  if (chip === 'dark') return brick.relations.some(r => DARK_RULE.test(r.rule))
  const values = (key: string) => candidates.filter(c => c.key === key).map(c => c.value)
  switch (chip) {
    case 'airy': return values('density').some(v => v === 1 || v === 2)
    case 'one accent': return values('accent_coverage').some(v => v === '<=2%' || v === '<=5%')
    case 'text-heavy': return values('image_text_dominance').some(v => typeof v === 'number' && v <= 0.5) || values('hierarchy_mode').includes('type-led')
    case 'big titles': return values('type_scale_ratio').some(v => typeof v === 'number' && v >= 2)
    case 'left-aligned': return values('alignment_edge').includes('left')
    case 'two colors': return values('palette_hue_count').some(v => typeof v === 'number' && v <= 2)
    case 'grid': return values('rhythm').includes('uniform')
  }
}

/** Which chips an intent names, in the order it names them. A heuristic to tune after the five-friend wording test: word-bounded and
 *  case-insensitive, checked group by group in this order, and a chip takes the position of the first group that names it. */
const INTENT_KEYWORDS: [RegExp, ChipId[]][] = [
  [/\b(?:read|reader|reading|document|documents|contract|contracts|article|essay|book|notes?|text|writing|manual|docs?)\b/i, ['text-heavy', 'left-aligned', 'big titles']],
  [/\b(?:glance|outdoor|sunlight|sun|speed|cycling|bike|driving|car|dashboard|watch|meter|gauge)\b/i, ['big titles', 'two colors', 'one accent']],
  [/\b(?:concert|music|show|shows|gig|club|night|film|cinema|gallery|photo|photos|portfolio)\b/i, ['dark', 'one accent']],
  [/\b(?:log|list|archive|history|collection|catalog|journal|diary|entries|feed|year)\b/i, ['one accent', 'airy', 'grid']],
]

const MAX_CHIPS = 6

/** The chips to offer under the intent: only values the library actually contains (a count of at least one over its ready bricks that
 *  have a rule to quote, which is the library the app sends), those the intent names first, then the rest by how many bricks carry them
 *  (ties in CHIP_IDS order), at most six. `note` is the tooltip. */
export function chipsFor(bricks: Brick[], intent: string): { id: ChipId; count: number; note: string }[] {
  const library = bricks.filter(b => (b.status ?? 'ready') === 'ready' && !b.superseded_by && b.relations.length > 0)
  const named: ChipId[] = []
  for (const [re, chips] of INTENT_KEYWORDS) if (re.test(intent)) for (const c of chips) if (!named.includes(c)) named.push(c)
  const read = library.map(b => ({ brick: b, candidates: candidatesOf(b).candidates }))
  const counted = CHIP_IDS.map(id => ({ id, count: read.filter(r => carriesWith(r.brick, r.candidates, id)).length })).filter(c => c.count >= 1)
  const rank = (id: ChipId) => { const i = named.indexOf(id); return i === -1 ? named.length : i }
  return counted
    .sort((a, b) => rank(a.id) - rank(b.id) || (rank(a.id) === named.length ? b.count - a.count : 0) || CHIP_IDS.indexOf(a.id) - CHIP_IDS.indexOf(b.id))
    .slice(0, MAX_CHIPS)
    .map(c => ({ ...c, note: `${c.count} ${c.count === 1 ? 'brick' : 'bricks'} in your library ${DESC[c.id]}` }))
}
