/** 15_SIMPLIFY §2 Make: the pure parts of the four steps (What, Picks, See, Share). No React, no model call. */
import { candidatesOf, type Project, type RelationRef, type Resolved } from './mapRelations'
import { labelsOf, labelForRule, labelsOfBrick, type ShortLabel } from './shortLabels'
import { creditLine, savedLabel } from './brickLabels'
import { originOf } from './starters'
import type { Brick } from './types'

/** Spec v3 P2: the field's placeholder rotates three examples, so the expected granularity is obvious. */
export const INTENT_EXAMPLES = ['a concert log for someone who goes to a lot of shows', 'a reading tracker', 'a ride stats screen for sunlight'] as const

const LEADING = new Set(['a', 'an', 'the'])
const TRAILING = new Set(['a', 'an', 'the', 'for', 'of', 'to', 'with', 'and', 'or', 'that', 'who', 'in', 'on', 'at', 'by', 'from', 'my', 'your'])

/** Spec v3 P2: the project is named from the first four words of the intent. A leading article is skipped and a dangling function word at the end is dropped,
 *  so "a concert log for someone who goes…" reads "Concert log for someone" and "a ride stats screen for sunlight" reads "Ride stats screen". First letter capitalized. */
export function autoName(intent: string): string {
  const words = intent.trim().replace(/[.,;:!?]+$/g, '').split(/\s+/).filter(Boolean)
  while (words.length > 1 && LEADING.has(words[0].toLowerCase())) words.shift()
  const four = words.slice(0, 4).map(w => w.replace(/[.,;:!?]+$/g, ''))
  while (four.length > 1 && TRAILING.has(four[four.length - 1].toLowerCase())) four.pop()
  const name = four.join(' ')
  return name ? name[0].toUpperCase() + name.slice(1) : ''
}

/** The one line under a photo on a Picks card: the day it was taken ("Dec 27, 2025") when the photo said, else "saved Nov 3"; a starter carries its credit line (SB2). */
export function photoLine(b: Pick<Brick, 'id' | 'origin' | 'credit' | 'saved_at' | 'taken_at'>, today: Date = new Date()): string {
  if (originOf(b) === 'starter') return creditLine(b)
  return b.taken_at ? savedLabel(b.taken_at, today).slice('saved '.length) : savedLabel(b.saved_at, today)
}

/** A Picks card's one label: the label for the rule the brick was proposed for; a card with no quote (the starting point, a swap) takes the brick's first label. */
export function pickLabel(brick: Brick, quotedRule: string): ShortLabel | null {
  return (quotedRule ? labelForRule(brick, quotedRule) : null) ?? labelsOfBrick(brick, 1)[0] ?? null
}

/** The ref that switches a whole relation off: `brick/r1` for `brick/r1:hierarchy_mode`. */
export const relationOf = (ref: RelationRef): RelationRef => ref.split(':')[0] as RelationRef

/** Whether a candidate is switched off in the project, by its own ref or by its relation's. */
export const isOff = (project: Pick<Project, 'disabled'>, ref: RelationRef): boolean => !!project.disabled[ref] || !!project.disabled[relationOf(ref)]

/** `inUse`: the screens show this label's value. A label that is on can still lose its parameter to a brick above it (or a choice made in Fine-tune). */
export type SeeLabel = ShortLabel & { ref: RelationRef; on: boolean; inUse: boolean }
export type SeeRow = { brick: Brick; labels: SeeLabel[] }

/** 3 See, "From your photos": one row per brick of the project, in the project's order, each with the short labels of its candidates that are active in the
 *  resolved project or switched off by you (so a label you turned off keeps its switch). A candidate the cap of three holds back has no row until a slot frees. */
export function seeRows(project: Project, resolved: Resolved, bricks: Brick[]): SeeRow[] {
  const active = new Set(Object.values(resolved.candidates).flatMap(cs => (cs ?? []).map(c => c.ref)))
  return project.brickIds.flatMap(id => {
    const brick = bricks.find(b => b.id === id)
    if (!brick) return []
    const shown = candidatesOf(brick).candidates.filter(c => active.has(c.ref) || isOff(project, c.ref))
    const labels = labelsOf(shown).filter((l): l is ShortLabel & { ref: RelationRef } => !!l.ref).map(l => {
      const v = resolved.values[l.key]
      return { ...l, on: !isOff(project, l.ref), inUse: v.source?.brickId === brick.id && v.source?.relationId === l.relationId && v.value === l.value }
    })
    return [{ brick, labels }]
  })
}

/** The project's `disabled` after a See switch is flipped. Off sets the label's own ref. On clears its own ref and its relation's, because a relation
 *  switched off as a whole (the label for the relation's own parameter, or a relation unchecked in Fine-tune) holds every reading off. */
export function toggleRef(disabled: Project['disabled'], ref: RelationRef): Project['disabled'] {
  const d = { ...disabled }
  if (!d[ref] && !d[relationOf(ref)]) { d[ref] = true; return d }
  delete d[ref]
  delete d[relationOf(ref)]
  return d
}

/** E1 minimal: the link a Share hands out. It opens the library under the code on the other device and lands on the project's Instructions page. */
export const instructionsLink = (origin: string, code: string, projectId: string): string =>
  `${origin}/open?code=${code}&project=${encodeURIComponent(projectId)}&to=instructions`

/** Where `/open` lands once the library is in: the project's Instructions page when the link asks for it (`to=instructions`), else the project (See), else the Projects list or the Library. */
export function openDestination(projectId: string | null, known: boolean, to: string | null): string {
  if (projectId && known) return to === 'instructions' ? `/project/${projectId}/instructions` : `/project/${projectId}`
  return projectId ? '/projects' : '/'
}

/** Where the step line's steps lead from inside a project: 1 What starts a new one, 3 See and 4 Share are the project's pages; 2 Picks is gone once the project exists. */
export const projectSteps = (id: string): { 1: string; 3: string; 4: string } => ({ 1: '/make', 3: `/project/${id}`, 4: `/project/${id}/share` })

/** Neutral skin: the same colors, radius, type and spacing on every shell, so only the relationship parameters remain (See's ⋯ and Fine-tune share it). */
export const NEUTRAL_SKIN = { color_bg: '#F4F2EE', color_fg: '#1B1B1B', color_accent: '#6B6B6B', radius: '8px', type_family: 'system-ui, -apple-system, "Segoe UI", sans-serif', spacing_unit: '8px' } as const
