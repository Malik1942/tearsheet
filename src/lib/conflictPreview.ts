import type { Resolved, RelationRef } from './mapRelations'
import type { ParameterKey, Params, ParamValue } from '../shell/params'
import type { Provenance } from './types'

export type ConflictTile = {
  ref: RelationRef
  brickId: string
  value: ParamValue
  provenance: Provenance
  /** The project's resolved params with only `k` set to this candidate's value: what the tile's mini-screen renders. */
  params: Params
  /** True for the chosen candidate; when nothing is chosen (or the choice names no candidate of this key), for the first one, the top brick. */
  pressed: boolean
}

/** Spec v3 C6: a conflict is chosen by preview. One tile per candidate of `k`, in the resolver's order; each tile's `params` differ from the project's only in `k`.
 *  `choice` is the ref the person picked (`project.choice[k]`); the pressed tile is that one, else the first. */
export function conflictTiles(resolved: Resolved, k: ParameterKey, choice?: RelationRef): ConflictTile[] {
  const cands = resolved.candidates[k] ?? []
  const pressedRef = (cands.find(c => c.ref === choice) ?? cands[0])?.ref
  return cands.map(c => ({
    ref: c.ref,
    brickId: c.source?.brickId ?? c.ref.slice(0, c.ref.indexOf('/')),
    value: c.value,
    provenance: c.provenance,
    params: { ...resolved.params, [k]: c.value },
    pressed: c.ref === pressedRef,
  }))
}
