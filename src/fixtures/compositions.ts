import type { Composition, DisabledRelation } from '../lib/types'
import { INTENT } from '../shell/content'

/**
 * Step-2 fixtures: the three gate bricks applied to the concert-log shell, three relationship parameters per brick
 * (06_step2_fixtures.json, Malik's values and provenance labels) plus skin colors measured from the sent pixels.
 * Provenance labels follow 06_step2_fixtures.json: measured = read from a measurement id; interpreted = from a relation
 * or hypothesis; adapted = remapped by hand or filled in by the shell.
 */
const skin = (brickId: string, bg: string, fg: string, accent: string, bgProv: 'measured' | 'interpreted' = 'measured', bgNote?: string) => ({
  color_bg: { key: 'color_bg' as const, value: bg, provenance: bgProv, locked: false, source: { brickId, note: bgNote ?? 'dominant k-means cluster of the sent pixels (harness, not the model)' } },
  color_fg: { key: 'color_fg' as const, value: fg, provenance: 'measured' as const, locked: false, source: { brickId, note: 'highest-contrast k-means cluster of the sent pixels (harness)' } },
  color_accent: { key: 'color_accent' as const, value: accent, provenance: 'measured' as const, locked: false, source: { brickId, note: 'median of the most saturated pixels inside the cited region box (harness)' } },
})

export const COMPOSITIONS: Record<string, Composition & { disabled: DisabledRelation[]; title: string }> = {
  g1: {
    id: 'g1', title: 'Blossoms', intent: INTENT, brickIds: ['g1'],
    parameters: {
      density: { key: 'density', value: 2, provenance: 'measured', locked: false,
        source: { brickId: 'g1', relationId: 'r2', relationRule: 'Preserve ~40% pale negative space in the upper center-right to keep the composition airy and uncluttered.', measurementIds: ['m3'], regionLabels: ['empty pale sky negative space'], note: '"low": ~40% negative space read as two items per viewport' } },
      palette_hue_count: { key: 'palette_hue_count', value: 3, provenance: 'measured', locked: false,
        source: { brickId: 'g1', relationId: 'r3', relationRule: 'Restrict palette to ~3 low-saturation hues with light dominant tones.', measurementIds: ['m5'], regionLabels: ['empty pale sky negative space'], note: 'low saturation, light base' } },
      image_text_dominance: { key: 'image_text_dominance', value: 0.65, provenance: 'adapted', locked: false,
        source: { brickId: 'g1', relationId: 'r1', relationRule: 'Keep one sharp organic subject filling the left two-thirds with a heavily blurred contextual backdrop confined to the right third.', measurementIds: ['m1'], regionLabels: ['sharp blossom foreground mass'], note: 'image 65 / text 35, image on the left; the model mapped this rule to grouping, remapped by hand' } },
      accent_placement: { key: 'accent_placement', value: 'none', provenance: 'interpreted', locked: false,
        source: { brickId: 'g1', measurementIds: ['m5'], note: 'skin says accent: none (m5, h3), so the shell places no accent' } },
      ...skin('g1', '#D4DFE0', '#171818', '#C2E0E9'),
    },
    unexpressed: [
      { brickId: 'g1', rule: 'Shallow focus: sharp foreground, blurred backdrop (m4). The model\'s own fragile_if_changed names this as the defining feature, and no shell parameter can carry it.', reason: 'fragile' },
      { brickId: 'g1', rule: 'Diagonal branch lines entering from the left edge (m6).', reason: 'no-slot' },
    ],
    disabled: [],
  },
  g2: {
    id: 'g2', title: 'Silver car', intent: INTENT, brickIds: ['g2'],
    parameters: {
      image_text_dominance: { key: 'image_text_dominance', value: 0.75, provenance: 'measured', locked: false,
        source: { brickId: 'g2', relationId: 'r1', relationRule: 'Keep a single hero subject covering ~65-80% of frame width with dark negative space surrounding it to preserve spotlight hierarchy.', measurementIds: ['m1', 'm2'], regionLabels: ['hero car body', 'overall low-key field'], note: 'hero 70-80% of width, dark surround' } },
      accent_coverage: { key: 'accent_coverage', value: '<=5%', provenance: 'interpreted', locked: false,
        source: { brickId: 'g2', relationId: 'r2', relationRule: 'Restrict saturated warm accent to <6% of frame placed directly on the hero to anchor focus.', measurementIds: ['m3'], regionLabels: ['red taillight accents'], note: '< 6%, warm, placed on the hero' } },
      palette_hue_count: { key: 'palette_hue_count', value: 2, provenance: 'interpreted', locked: false,
        source: { brickId: 'g2', relationId: 'r3', relationRule: 'Limit palette to near-monochrome base plus at most two small complementary warm and cool accents.', measurementIds: ['m3'], regionLabels: ['red taillight accents', 'blue background glow'], note: '1 near-monochrome base + 2 small accents (warm, cool)' } },
      accent_placement: { key: 'accent_placement', value: 'one-hero', provenance: 'adapted', locked: false,
        source: { brickId: 'g2', relationId: 'r2', measurementIds: ['m3'], note: 'the shell needs a placement; "placed on the hero" from accent_coverage\'s detail; not one of the three counted parameters' } },
      ...skin('g2', '#060605', '#E5DFD7', '#A32420'),
    },
    unexpressed: [
      { brickId: 'g2', rule: 'Light from one side only (sealed feature; the model only implied it via m4\'s highlight location).', reason: 'no-slot' },
      { brickId: 'g2', rule: 'Diagonal recession to the upper left (m5).', reason: 'no-slot' },
      { brickId: 'g2', rule: 'Foreground out-of-focus occluder bottom-right (m6); verified real on the overlay.', reason: 'no-slot' },
    ],
    disabled: [],
  },
  g3: {
    id: 'g3', title: 'Yellow poster', intent: INTENT, brickIds: ['g3'],
    parameters: {
      type_scale_ratio: { key: 'type_scale_ratio', value: 2.0, provenance: 'measured', locked: false,
        source: { brickId: 'g3', relationId: 'r2', relationRule: 'Maintain display cap-height to body cap-height ratio >=8:1, with display used as cropped background texture and body confined to a narrow column.', measurementIds: ['m2'], regionLabels: ['giant cropped letters versus small top text'], note: 'largest : smallest >= 8:1, per step ~2.0 over three steps' } },
      image_text_dominance: { key: 'image_text_dominance', value: 0.6, provenance: 'measured', locked: false,
        source: { brickId: 'g3', relationId: 'r1', relationRule: 'Keep a ~50/50 flat-color field versus solid silhouette split, with giant display type cropped by the frame edge and partially overlapped by the silhouette.', measurementIds: ['m1', 'm6'], regionLabels: ['black silhouette on right versus yellow field'], note: 'field 40 / figure 60' } },
      accent_coverage: { key: 'accent_coverage', value: '<=2%', provenance: 'measured', locked: false,
        source: { brickId: 'g3', relationId: 'r3', relationRule: 'Restrict saturated accent to a single word covering <=3% of frame at the bottom of the text column.', measurementIds: ['m3'], regionLabels: ['red CHRISTMAS accent at bottom-left'], note: '<= 3%, one word, bottom of the text column' } },
      ...skin('g3', '#EFD92E', '#000000', '#E3271C', 'measured', 'high-chroma yellow: the 26% cluster, chosen as ground over the 63% silhouette per m1 (figure/ground)'),
    },
    unexpressed: [
      { brickId: 'g3', rule: 'Silhouette overlapping and partially covering the display letters (relation 1).', reason: 'no-slot' },
      { brickId: 'g3', rule: 'Four letters stacked vertically along the left edge (m6).', reason: 'no-slot' },
      { brickId: 'g3', rule: 'White shapes sitting exactly on the yellow/black seam (m5, h4).', reason: 'no-slot' },
    ],
    disabled: [
      { brickId: 'g3', relationId: 'm4', reason: 'alignment_edge=left (all text in the left third, m4): fourth parameter, cap is three; dropped so g3 is not the only shell that moves the text edge in the swap test' },
      { brickId: 'g3', relationId: 'h2', reason: 'hierarchy_mode two-level, impact first (h2): covered by type_scale_ratio in practice; dropped' },
    ],
  },
}
