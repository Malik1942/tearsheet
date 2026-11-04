/** Make, one page (Malik, 2026-11-03, over 15_SIMPLIFY's steps): the pure parts. No React, no model call. */
import { candidatesOf, resolveProject, type Project, type Resolved } from './mapRelations'
import { labelsOf, labelsOfBrick } from './shortLabels'
import { creditLine, savedLabel } from './brickLabels'
import { originOf, ownBricks } from './starters'
import { PARAMETER_KEYS } from '../shell/params'
import type { Brick, Unexpressed } from './types'

/** Spec v3 P2: three examples of the expected granularity, shown under the empty field. */
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

/** The line under a photo in a picker: the day it was taken ("Dec 27, 2025") when the photo said, else "saved Nov 3"; a starter carries its credit line (SB2). */
export function photoLine(b: Pick<Brick, 'id' | 'origin' | 'credit' | 'saved_at' | 'taken_at'>, today: Date = new Date()): string {
  if (originOf(b) === 'starter') return creditLine(b)
  return b.taken_at ? savedLabel(b.taken_at, today).slice('saved '.length) : savedLabel(b.saved_at, today)
}

/** The photo row under the screens: each photo of the project that sets something on them, judged with that photo unmuted (a photo tapped off
 *  stays in the row, dimmed, as long as turning it back on would show), with its one short label. A photo that sets nothing is left out. */
export type PhotoChip = { brick: Brick; muted: boolean; label: string | null }

export function photoRow(project: Project, bricks: Brick[]): PhotoChip[] {
  return project.brickIds.flatMap(id => {
    const brick = bricks.find(b => b.id === id)
    if (!brick) return []
    const muted = !!project.mutedBricks?.[id]
    const r = resolveProject(muted ? { ...project, mutedBricks: toggleMuted(project.mutedBricks, id) } : project, bricks)
    if (!PARAMETER_KEYS.some(k => r.values[k].source?.brickId === id)) return []
    return [{ brick, muted, label: oneLabel(brick, r) }]
  })
}

/** A photo's one label: the first short label among the values it sets on the screens (in the order of its own rules, then its skin);
 *  when none of those has a label, its first label overall. Never a glyph, never rule text. */
export function oneLabel(brick: Brick, resolved: Resolved): string | null {
  const order: string[] = candidatesOf(brick).candidates.map(c => c.key)
  const rank = (k: string) => { const i = order.indexOf(k); return i === -1 ? order.length : i }
  const sets = PARAMETER_KEYS.filter(k => resolved.values[k].source?.brickId === brick.id).sort((a, b) => rank(a) - rank(b)).map(k => resolved.values[k])
  return labelsOf(sets)[0]?.label ?? labelsOfBrick(brick, 1)[0]?.label ?? null
}

/** C+D (DESIGN_SYSTEM.md §12.6–7): what Make's "couldn't carry over" line counts and its fold lists. Only the rules with no slot, grouped by the photo they
 *  come from, in the order they appear. A fragile note did carry over (it says what would break the effect), so it stays in Fine-tune and the handoff. */
export function carryOver(unexpressed: Unexpressed[]): { brickId: string; items: Unexpressed[] }[] {
  const groups: { brickId: string; items: Unexpressed[] }[] = []
  for (const u of unexpressed) {
    if (u.reason === 'fragile') continue
    const group = groups.find(g => g.brickId === u.brickId)
    if (group) group.items.push(u)
    else groups.push({ brickId: u.brickId, items: [u] })
  }
  return groups
}

/** `mutedBricks` with one photo flipped: off if it was on, on if it was off. */
export function toggleMuted(muted: Project['mutedBricks'], id: string): Record<string, true> {
  const next = { ...(muted ?? {}) }
  if (next[id]) delete next[id]
  else next[id] = true
  return next
}

const PROJECT_PAGE = /^\/project\/([^/]+)(?:\/(share|export|preview))?\/?$/

/** Which Make page a path shows: `/make` (no project yet) or `/project/:id`. The older step routes land on the project's page, `share` and `export`
 *  with the Share popover open. `/project/:id/instructions` is not Make (it is E1's target), so it is null, as is every other path. */
export function makeRoute(path: string): { id: string | null; share: boolean } | null {
  if (path === '/make' || path === '/make/') return { id: null, share: false }
  const m = PROJECT_PAGE.exec(path)
  return m ? { id: decodeURIComponent(m[1]), share: m[2] === 'share' || m[2] === 'export' } : null
}

/** E1, read-only (Malik, 2026-11-03): the link Share hands out. Its code holds this project and the photos it uses, never the library's own sync code,
 *  and it opens /shared, which shows the screens and the reasons behind them and adopts nothing, merges nothing, saves nothing on the device that opens it. */
export const sharedLink = (origin: string, code: string, projectId: string): string =>
  `${origin}/shared?code=${code}&project=${encodeURIComponent(projectId)}`

/** What a share uploads: the project, and the person's own photos it uses. The starters ship with the app, so the page that opens the link has them already. */
export function shareContent(project: Project, bricks: Brick[]): Brick[] {
  return ownBricks(bricks).filter(b => project.brickIds.includes(b.id) && b.status !== 'extracting')
}

/** One share code per project, kept on this device, so sharing the project again updates the same link. A new project gets a fresh code from `make`. */
const SHARES_KEY = 'tearsheet.shares'
export function shareCodeFor(projectId: string, make: () => string, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): string {
  let codes: Record<string, string> = {}
  try { codes = JSON.parse(storage.getItem(SHARES_KEY) ?? '{}') ?? {} } catch { /* a damaged map starts over */ }
  if (codes[projectId]) return codes[projectId]
  const code = make()
  try { storage.setItem(SHARES_KEY, JSON.stringify({ ...codes, [projectId]: code })) } catch { /* storage refused: the next share makes a new link */ }
  return code
}

/** The read-only page's view of a shared code: the project and the bricks it names, the shared ones first, then the starters that ship with the app.
 *  Null when the code does not hold that project. */
export function sharedView(manifest: { bricks: Brick[]; projects?: Project[] }, projectId: string, starters: Brick[]): { project: Project; bricks: Brick[] } | null {
  const project = (manifest.projects ?? []).find(p => p.id === projectId)
  if (!project) return null
  return { project, bricks: [...manifest.bricks, ...starters.filter(s => !manifest.bricks.some(b => b.id === s.id))] }
}

/** Where `/open` lands once the library is in: the project's Instructions page when the link asks for it (`to=instructions`), else the project's Make page, else the Projects list or the Library. */
export function openDestination(projectId: string | null, known: boolean, to: string | null): string {
  if (projectId && known) return to === 'instructions' ? `/project/${projectId}/instructions` : `/project/${projectId}`
  return projectId ? '/projects' : '/'
}

/** Neutral skin: the same colors, radius, type and spacing on every shell, so only the relationship parameters remain (Make's ⋯ and Fine-tune share it). */
export const NEUTRAL_SKIN = { color_bg: '#F4F2EE', color_fg: '#1B1B1B', color_accent: '#6B6B6B', radius: '8px', type_family: 'system-ui, -apple-system, "Segoe UI", sans-serif', spacing_unit: '8px' } as const
