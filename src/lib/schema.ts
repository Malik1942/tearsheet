import { z } from 'zod'

/** Exactly the schema Muse Spark is constrained to (meta-eval/fixtures/schemas/brick.json). Validate model output against this, not against the app's Brick type. */
export const PARAMETER_ENUM = [
  'type_scale_ratio', 'hierarchy_mode', 'density', 'grouping', 'rhythm', 'alignment_edge',
  'image_text_dominance', 'accent_placement', 'accent_coverage', 'palette_hue_count', 'none',
] as const

export const MeasurementSchema = z.object({ id: z.string(), statement: z.string(), value: z.string(), how_measured: z.string() })
export const HypothesisSchema = z.object({ id: z.string(), statement: z.string(), rests_on: z.array(z.string()), confidence: z.number() })
export const RelationSchema = z.object({ rule: z.string(), parameter: z.enum(PARAMETER_ENUM), target: z.string(), source_hypothesis: z.string() })
export const RegionSchema = z.object({
  label: z.string(),
  // clamp rather than reject: the model may emit 1001 for an object touching the edge, and corners may come back swapped
  box_1000: z.array(z.number()).length(4).transform(([a, b, c, d]) => {
    const cl = (n: number) => Math.min(1000, Math.max(0, n))
    return [cl(Math.min(a, c)), cl(Math.min(b, d)), cl(Math.max(a, c)), cl(Math.max(b, d))] as [number, number, number, number]
  }),
  measurement_ids: z.array(z.string()),
})

export const BrickExtractionSchema = z.object({
  measurements: z.array(MeasurementSchema),
  hypotheses: z.array(HypothesisSchema),
  transferable_relations: z.array(RelationSchema).max(3),
  fragile_if_changed: z.string(),
  regions: z.array(RegionSchema),
})
export type BrickExtraction = z.infer<typeof BrickExtractionSchema>
