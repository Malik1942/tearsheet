/** Spec v3 C10: the first line of a provenance chip's tooltip. Pure, so it is tested without React; ProvenanceChip.tsx keeps exporting only its component. */
import { isShellDefault } from '../lib/landing'
import type { ParameterValue } from '../lib/types'

const MEASURED = 'Read off the image by the model in this run; another run may differ.'
const INTERPRETED = "The model's reading; rests on the measurements listed."
const BY_RULE = 'Set by a rule from a measurement.'
const BY_YOU = 'Set by you.'
const SHELL_DEFAULT = "The shell's default; no brick sets this."

/** What the chip says about where a value came from. A value you set (brick `user`, or a note that starts `by you`) is yours whatever its provenance label says;
 *  an adapted value is then by a rule (note starts `by rule`), the shell's default (`isShellDefault`), or a remap by hand, which reads as set by you. */
export function tooltipOf(pv: ParameterValue): string {
  if (pv.source?.brickId === 'user' || pv.source?.note?.startsWith('by you')) return BY_YOU
  if (pv.provenance === 'measured') return MEASURED
  if (pv.provenance === 'interpreted') return INTERPRETED
  if (pv.source?.note?.startsWith('by rule')) return BY_RULE
  return isShellDefault(pv) ? SHELL_DEFAULT : BY_YOU
}
