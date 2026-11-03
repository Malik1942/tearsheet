import type { Brick } from './types'
import type { ExtractResult } from './extract'

/** Formats the file picker accepts. Never list heic and never use a bare image/*: iOS converts library HEICs to JPEG only when heic is absent, and Safari 17+ turns jpeg/png picks into .heic when it is present. */
export const ACCEPT = 'image/jpeg,image/png,image/webp'

/** Make the photo upright and at most 2048 px on the long side, as JPEG, before it leaves the browser. Same prep as the gate harness.
 *  Decodes through an <img> element rather than createImageBitmap: WebKit drops EXIF orientation when decoding a Blob with
 *  createImageBitmap (bug 237895) and ignores it again when drawing the bitmap (242137); <img> is upright in every modern browser. */
export async function prepareImage(file: File, maxSide = 2048): Promise<{ dataUrl: string; width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error(`could not decode ${file.name}`))
      el.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: w, height: h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Sends one photo. Never throws on the network: a fetch that got no answer comes back as `offline`, and an HTTP refusal keeps its status
 *  and the server's `limited` flag, so the queue can hold the photo instead of failing it (spec v3 L11). */
export async function extractBrick(prepared: { dataUrl: string; width: number; height: number }, dry = false): Promise<{ brick?: Brick; result: ExtractResult | { dry: true; request: unknown } }> {
  let res: Response
  try { res = await fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: prepared.dataUrl, dry }) }) }
  catch { return { result: { ok: false, error: 'offline', latency_ms: 0, offline: true } } }
  const result = await res.json().catch(() => null)
  if (!res.ok) return { result: { ok: false, error: result?.error ?? `HTTP ${res.status}`, latency_ms: 0, http: res.status, limited: !!result?.limited } }
  if (!result) return { result: { ok: false, error: `HTTP ${res.status}: the answer was not JSON`, latency_ms: 0, http: res.status } }
  if (result.dry) return { result }
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
