import type { Brick } from './types'
import type { ExtractResult } from './extract'

/** Make the photo upright and at most 2048 px on the long side, as JPEG, before it leaves the browser. Same prep as the gate harness. */
export async function prepareImage(file: File, maxSide = 2048): Promise<{ dataUrl: string; width: number; height: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: w, height: h }
}

export async function extractBrick(prepared: { dataUrl: string; width: number; height: number }, dry = false): Promise<{ brick?: Brick; result: ExtractResult | { dry: true; request: unknown } }> {
  const res = await fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: prepared.dataUrl, dry }) })
  const result = await res.json()
  if (result.dry) return { result }
  if (!res.ok) return { result: { ok: false, error: result.error ?? `HTTP ${res.status}`, latency_ms: 0 } }
  if (!result.ok) return { result }
  const x = result.extraction
  const brick: Brick = {
    id: `b_${Date.now().toString(36)}`,
    photo: { url: prepared.dataUrl, width: prepared.width, height: prepared.height },
    saved_at: new Date().toISOString().slice(0, 10),
    measurements: x.measurements, hypotheses: x.hypotheses,
    relations: x.transferable_relations.map((r: Brick['relations'][number], i: number) => ({ ...r, id: `r${i + 1}` })),
    fragile_if_changed: x.fragile_if_changed, regions: x.regions,
    model: { id: 'muse-spark-1.3', effort: 'medium', latency_ms: result.latency_ms, input_tokens: result.usage.input_tokens, output_tokens: result.usage.output_tokens },
  }
  return { brick, result }
}
