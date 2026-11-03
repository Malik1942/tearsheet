/** Spec v3 C11 and C12, the pure parts. Pure: no React, no model call.
 *  C11: which parameters the latest accepted change moved, so Compose can outline their regions of the shell and their sheet rows for a second.
 *  C12: which regions of a brick's photo a sheet row's measurement rests on, so a peek can draw them. */
import type { ParameterKey } from '../shell/params'
import type { Project } from './mapRelations'
import type { Brick, Region } from './types'
import { changedSincePrevious } from './versions'

/** How long the highlight stays, in milliseconds. */
export const FLASH_MS = 1000

/** The keys the project's latest version moved, in `PARAMETER_KEYS` order, when that version is newer than `prevVersion`; otherwise none.
 *  This is `changed_since_previous`, so it is exact. A project saved before versions existed reads as v1. */
export function flashKeys(prevVersion: number, project: Project): ParameterKey[] {
  return (project.version ?? 1) > prevVersion ? changedSincePrevious(project).map(c => c.key) : []
}

/** What `useChangeFlash` remembers of the project it is showing: which one and the version it last saw. `null` before it has seen any. */
export type FlashSeen = { id: string; v: number } | null

/** The step `useChangeFlash` takes on each render, from what it has seen, the project now, and the keys now flashing; returns both updated.
 *  A project first seen, or a different project from the one seen, flashes nothing and clears what was running (the highlight belongs to the project it came from).
 *  The same project at a higher version flashes the keys that version moved, but a rise that moved nothing (a lock) leaves a running highlight alone, as does an equal or lower version, which only moves `seen`.
 *  When nothing changed it hands back the very `seen` and `flash` it was given, so the caller can tell by identity and set no state. */
export function nextFlash(seen: FlashSeen, project: Project | undefined, current: ParameterKey[]): { seen: FlashSeen; flash: ParameterKey[] } {
  if (!project) return { seen, flash: current }
  const v = project.version ?? 1
  if (seen === null || seen.id !== project.id) return { seen: { id: project.id, v }, flash: current.length === 0 ? current : [] }
  if (seen.v === v) return { seen, flash: current }
  const keys = flashKeys(seen.v, project)
  return { seen: { id: project.id, v }, flash: keys.length > 0 ? keys : current }
}

/** Every region of the brick whose `measurement_ids` include the measurement, in the brick's order; none for an unknown or missing id. */
export function peekRegions(brick: Brick, measurementId: string | undefined): Region[] {
  return measurementId ? brick.regions.filter(r => r.measurement_ids.includes(measurementId)) : []
}

/** The peek card is this wide, in px. */
export const PEEK_WIDTH = 240
/** Header line, two caption lines, the gaps between, and the padding: everything in the card that is not the photo. */
const PEEK_CHROME_H = 80
const PEEK_INNER_W = PEEK_WIDTH - 16

/** The card's size and the photo's inside it. The photo keeps its own ratio, so the region boxes (percentages of the photo) land where they are: a landscape photo fills the card's inside,
 *  a portrait one is no taller than that is wide and stands narrower. A card of known size lets its position be computed without measuring it. */
export function peekSize(brick: Brick): { w: number; h: number; photo: { w: number; h: number } } {
  const { width, height } = brick.photo
  const aspect = width > 0 && height > 0 ? width / height : 1
  const photo = aspect >= 1 ? { w: PEEK_INNER_W, h: Math.round(PEEK_INNER_W / aspect) } : { w: Math.round(PEEK_INNER_W * aspect), h: PEEK_INNER_W }
  return { w: PEEK_WIDTH, h: photo.h + PEEK_CHROME_H, photo }
}

export type Rect = { left: number; top: number; right: number; bottom: number }

/** Where the card goes (fixed, from the viewport's top left). Beside the row, level with its top: on its left first (the sheet is the right-hand column, so the card lands over the shell it explains), then on its right.
 *  On a screen too narrow for either, under the row with its left edge on the row's, or over it when there is no room under. Always kept inside the viewport by `margin`. */
export function peekPosition(anchor: Rect, size: { w: number; h: number }, view: { w: number; h: number }, gap = 8, margin = 8): { left: number; top: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi))
  const leftOf = anchor.left - gap - size.w
  const rightOf = anchor.right + gap
  let left: number, top: number
  if (leftOf >= margin) { left = leftOf; top = anchor.top }
  else if (rightOf + size.w <= view.w - margin) { left = rightOf; top = anchor.top }
  else {
    left = anchor.left
    top = anchor.bottom + gap + size.h <= view.h - margin ? anchor.bottom + gap : anchor.top - gap - size.h
  }
  return { left: clamp(left, margin, view.w - size.w - margin), top: clamp(top, margin, view.h - size.h - margin) }
}
