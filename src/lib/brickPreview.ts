import { resolveProject, type Project } from './mapRelations'
import type { Params } from '../shell/params'
import type { Brick } from './types'

/** Spec v3 B2/L6/P7: what one brick looks like on its own. A one-brick project resolved the ordinary way: this brick's (at most three) relationship values,
 *  its own measured skin, and the shell's defaults for the rest. `unexpressed` is how many of its items could not carry over (the badge on the mini-preview). */
export function brickParams(brick: Brick): { params: Params; unexpressed: number } {
  const project: Project = { id: 'mini', intent: '', createdAt: '', brickIds: [brick.id], disabled: {}, choice: {}, locks: {}, manual: {} }
  const resolved = resolveProject(project, [brick])
  return { params: resolved.params, unexpressed: resolved.unexpressed.length }
}

/** Spec v3 P8: up to three orderings of the accepted bricks, each with a different brick on top (which gives skin, hierarchy and density).
 *  [a,b,c] -> [[a,b,c],[b,c,a],[c,a,b]]. Only the first three positions rotate; a fourth and fifth brick stay where they are. Never more than three, no model call. */
export function rotations(ids: string[]): string[][] {
  const head = ids.slice(0, 3), tail = ids.slice(3)
  return head.map((_, i) => [...head.slice(i), ...head.slice(0, i), ...tail])
}
