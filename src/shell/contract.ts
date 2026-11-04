/** The shell's layout contract (layer 2). Resolved parameters in, parameters the shell can lay out honestly out, plus every value it changed.
 *  Six rules hold on every screen; scripts/shell-contract.test.ts measures all six on the rendered DOM (contractMeasure.ts):
 *   1. one alignment axis per screen   2. spacing only from the scale   3. at most three type sizes
 *   4. a readable item (no empty band over 24 px, a 9em text column, 44 px targets)   5. no duplicated information   6. no text inside thumbnails
 *  Rules 2–6 are the shell's own structure (shell.css, the two screens). Rules 1 and 2 can also need a parameter changed, and only those changes are
 *  made here, each recorded as an `Adjustment` so the sheet and the export show it as `adapted · by rule`, with the value it replaced.
 *  Independent of measurement: it reads Params and nothing else, never a brick's measurements, so the SAM branch needs no change for it. Applying it
 *  twice changes nothing the second time. */
import type { ParameterKey, ParamValue, Params } from './params'

export type ContractRule = 'one alignment axis' | 'spacing scale' | 'three type sizes' | 'readable item' | 'no duplicated information' | 'no text in thumbnails'
export type Adjustment = { key: ParameterKey; before: ParamValue; after: ParamValue; rule: ContractRule }

/** `image_text_dominance` at 0 is the contract's "thumbnails hidden": the shell draws no poster or thumbnail (dataAttributes sets data-thumbs="none"). */
export const THUMBNAILS_HIDDEN = 0
/** The spacing unit's range in px: every gap is a step of 4 8 12 16 24 32 48 × unit / 8, so a unit outside this range or not in px snaps to the default. */
const UNIT_PX = { min: 4, max: 16, fallback: '8px' }

export function applyContract(input: Params): { params: Params; adjustments: Adjustment[] } {
  const p: Params = { ...input }
  const adjustments: Adjustment[] = []
  const set = (key: ParameterKey, after: ParamValue, rule: ContractRule) => {
    if (p[key] === after) return
    adjustments.push({ key, before: p[key], after, rule })
    p[key] = after
  }

  // 1. One alignment axis. Centered text never sits beside a thumbnail: the thumbnail goes above the text (image-led) or, when the title leads, away.
  //    Alternating rows would put every second thumbnail below the text, so the rhythm is uniform there. (The year review's labels and rows follow the
  //    same edge in shell.css; that needs no parameter.)
  if (p.alignment_edge === 'center') {
    if (p.hierarchy_mode === 'type-led') set('image_text_dominance', THUMBNAILS_HIDDEN, 'one alignment axis')
    else {
      set('hierarchy_mode', 'image-led', 'one alignment axis')
      if (p.rhythm === 'alternating') set('rhythm', 'uniform', 'one alignment axis')
    }
  }

  // 2. Spacing only from the scale: the unit every step multiplies must be a px length the scale can use.
  const unit = /^(\d+(?:\.\d+)?)px$/.exec(String(p.spacing_unit).trim())
  if (!unit || Number(unit[1]) < UNIT_PX.min || Number(unit[1]) > UNIT_PX.max) set('spacing_unit', UNIT_PX.fallback, 'spacing scale')

  return { params: p, adjustments }
}
