/** The swap sheet (2026-11-03; docs/superpowers/specs/2026-11-03-swap-sheet-design.md): which photos it offers in place of one, in which group and order,
 *  and each tile's two lines. Deterministic and pure: no model call, no React. Inside a group the order is the proposal's ranking (the same call as the
 *  picks), then the newest saved; the Library's own order is untouched. */
import { CAP_PER_BRICK, candidatesOf, resolveProject, type Project } from './mapRelations'
import { isShellDefault } from './landing'
import { labelsOfBrick } from './shortLabels'
import { cardCaption } from './brickLabels'
import { RELATIONSHIP_KEYS, type ParameterKey, type RelationshipKey } from '../shell/params'
import type { Brick } from './types'

export type SwapTile = { brick: Brick; inProject: boolean }
export type SwapGroup = { id: 'same' | 'adds' | 'rest'; title: string; tiles: SwapTile[] }

const TITLES = { same: 'Same job', adds: 'Adds something', rest: 'Everything else' } as const
const isRelationship = (k: ParameterKey): k is RelationshipKey => (RELATIONSHIP_KEYS as readonly string[]).includes(k)

/** The relationship parameters a brick would set on its own: its first three candidates (the cap), the set its short labels come from. */
const ownSets = (brick: Brick): RelationshipKey[] =>
  [...new Set(candidatesOf(brick).candidates.map(c => c.key).filter(isRelationship).slice(0, CAP_PER_BRICK))]

/** Ranked first, in the ranking's order; the rest after, newest saved first, then by id. A ranking from another device is read defensively. */
function byRanking(ranking: unknown): (a: Brick, b: Brick) => number {
  const at = new Map<string, number>()
  if (Array.isArray(ranking)) ranking.forEach((id, i) => { if (typeof id === 'string' && !at.has(id)) at.set(id, i) })
  return (a, b) => {
    const ra = at.get(a.id) ?? Infinity, rb = at.get(b.id) ?? Infinity
    if (ra !== rb) return ra < rb ? -1 : 1
    if (a.saved_at !== b.saved_at) return a.saved_at < b.saved_at ? 1 : -1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  }
}

/** The sheet that replaces `replacing`: Same job (sets a parameter the replaced photo sets on the screens now, judged unmuted), Adds something (sets a parameter
 *  still at the shell default), Everything else; each photo in the first group it qualifies for, empty groups left out. `pool` is what the sheet may offer,
 *  `bricks` resolves the project. The replaced photo is never offered; photos already in the project come marked. */
export function swapGroups(project: Project, pool: Brick[], replacing: string, bricks: Brick[]): SwapGroup[] {
  const unmuted: Project = project.mutedBricks?.[replacing]
    ? { ...project, mutedBricks: Object.fromEntries(Object.entries(project.mutedBricks).filter(([id]) => id !== replacing)) as Record<string, true> }
    : project
  const before = resolveProject(unmuted, bricks).values
  const job = new Set(RELATIONSHIP_KEYS.filter(k => before[k].source?.brickId === replacing))
  const now = resolveProject(project, bricks).values
  // judged before the layout contract: a value it filled in is set by a rule, not by a photo, so a photo that sets it still adds something
  const taken = new Set(RELATIONSHIP_KEYS.filter(k => !isShellDefault(now[k].before ?? now[k])))
  const tiles: Record<SwapGroup['id'], SwapTile[]> = { same: [], adds: [], rest: [] }
  for (const brick of [...pool].sort(byRanking(project.proposal?.ranking))) {
    if (brick.id === replacing) continue
    const sets = ownSets(brick)
    const id = sets.some(k => job.has(k)) ? 'same' : sets.some(k => !taken.has(k)) ? 'adds' : 'rest'
    tiles[id].push({ brick, inProject: project.brickIds.includes(brick.id) })
  }
  return (['same', 'adds', 'rest'] as const).filter(id => tiles[id].length > 0).map(id => ({ id, title: TITLES[id], tiles: tiles[id] }))
}

/** A tile's two lines, as every card shows them (`cardCaption`): the title, else the first short label from the label table; then the short credit or the date. */
export const tileCaption = (brick: Brick, today: Date = new Date()): { title: string; line: string } =>
  cardCaption(brick, labelsOfBrick(brick, 1)[0]?.label ?? null, today)
