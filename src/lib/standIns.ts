/** Spec v3 C7 (v2 C7′, Principle 4): what stood in for a feature the shell could not carry. A fixed table, read from the text of an unexpressed item.
 *  Pure: no React, no model call. The patterns were calibrated on the sentences the model wrote for the 12 sample bricks and the 4 gate fixtures (scripts/standins.test.ts). */

export type Concept = 'shallow focus' | 'one-sided light' | 'diagonal recession' | 'overlap/occlusion' | 'cropped display type'

/** The spec table. Only shallow focus has a stand-in: the shell's whitespace and its luminance steps carry the isolation. `none` is shown, never hidden. */
export const STAND_INS: Record<Concept, string> = {
  'shallow focus': 'whitespace + luminance hierarchy',
  'one-sided light': 'none',
  'diagonal recession': 'none',
  'overlap/occlusion': 'none',
  'cropped display type': 'none',
}

/** Case-insensitive patterns per concept, checked in this order; the first concept with a match wins. Near misses the patterns must not read: `soft gray shading`, `equal in size`. */
const PATTERNS: [Concept, RegExp[]][] = [
  ['shallow focus', [/\b(shallow|selective|soft) (focus|depth of field)\b/i, /\bdepth of field\b/i, /\bout of focus\b/i, /\bblur(red|ry|s)?\b/i, /\bbokeh\b/i, /\binto (sharp|equal|full)\b[^.;]{0,24}\bfocus\b/i]],
  ['one-sided light', [/\b(one|single)[- ]sided light/i, /\bside[- ]?light/i, /\braking light/i, /\bdirectional light/i, /\blight (from|on) (the )?(left|right|one side)/i, /\bspotlight/i, /\blow[- ]key\b/i]],
  ['diagonal recession', [/\bdiagonal/i, /\brecession\b/i, /\brecedes?\b/i, /\bvanishing point/i, /\bconverging lines/i]],
  ['overlap/occlusion', [/\boverlap/i, /\boccl(u|ud)/i, /\bin front of\b/i, /\blayered over\b/i]],
  ['cropped display type', [/\bcrop(ped|s)? (type|letters|letterforms|headline|word|display)/i, /\b(type|letters|headline|wordmark)\b[^.;]{0,20}\b(cropped|cut off|bleeds?|runs? off)\b/i]],
]

/** The concept an unexpressed item's text names (a relation's rule or a fragile sentence), or null when it names none of the five. */
export function conceptOf(text: string): Concept | null {
  return PATTERNS.find(([, patterns]) => patterns.some(p => p.test(text)))?.[0] ?? null
}

/** What stood in for the item: its concept's table entry, or `none` when the text names no concept. */
export function standInFor(text: string): string {
  const concept = conceptOf(text)
  return concept ? STAND_INS[concept] : 'none'
}
