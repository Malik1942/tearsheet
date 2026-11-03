/** Lean chips (spec v3 P3-P5): the table shared by the browser (src/lib/lean.ts) and the server (src/lib/propose.ts).
 *  No imports on purpose: the server runs transpiled without bundling and may only import `.js`-suffixed siblings, so anything the
 *  server needs from here must not pull in a client module. */

/** In this order: the order chips are sent, rendered into the prompt and looked up when counted. */
export const CHIP_IDS = ['dark', 'airy', 'one accent', 'text-heavy', 'big titles', 'left-aligned', 'two colors', 'grid'] as const
export type ChipId = typeof CHIP_IDS[number]

/** What the designer set before asking (spec v3 P5): chips constrain parameter families; the anchor is a fixed pick. */
export type Lean = { chips: ChipId[]; anchor_id?: string }

/** Parameter families each chip asks the proposer to prefer. The model sees these names, never a chip word. `dark` has none: it is a
 *  value of the ground, not a parameter, so the server turns it into brick ids instead (DARK_RULE). */
export const CHIP_FAMILIES: Record<ChipId, string[]> = {
  dark: [],
  airy: ['density'],
  'one accent': ['accent_coverage'],
  'text-heavy': ['image_text_dominance', 'hierarchy_mode'],
  'big titles': ['type_scale_ratio'],
  'left-aligned': ['alignment_edge'],
  'two colors': ['palette_hue_count'],
  grid: ['rhythm'],
}

/** A rule that names a dark ground. `dark` is read from relation rule text (rule only, not target), never from a measured skin color, so
 *  the chip stays true under a neutral skin. Calibrated on the twelve samples: bauhaus ("on a dark ground"), g2 ("darkness covering ~60%")
 *  and secession ("across a dark field") match; iran ("light neutral ground plus one dark …") and lissitzky ("black on light ground") do not. */
export const DARK_RULE = /\b(dark|near-black|black)\s+(ground|field|background|base|surround)\b|\bdarkness cover(s|ing)\b/i

/** Chips in CHIP_IDS order, each once, whatever order they were clicked in. The client sends them this way and the server sorts again, so
 *  the families and the dark bricks in the prompt always follow the table, and one lean renders one prompt. */
export function canonicalChips(chips: readonly ChipId[]): ChipId[] {
  return CHIP_IDS.filter(id => chips.includes(id))
}
