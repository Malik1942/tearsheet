/** Shared by the Vercel function (api/extract.ts) and the Vite dev middleware. Runs on the server only; the key never reaches the browser. */
import schema from './brick.schema.json'
import { EXTRACT_PROMPT } from './extractPrompt'
import { BrickExtractionSchema, type BrickExtraction } from './schema'

export const MODEL = 'muse-spark-1.3'
export const EFFORT = 'medium'
export const MAX_OUT = 12000
const API = 'https://api.meta.ai/v1/responses'

export function buildRequest(imageDataUrl: string, maxOutputTokens = MAX_OUT) {
  return {
    model: MODEL,
    input: [{ type: 'message', role: 'user', content: [
      { type: 'input_text', text: EXTRACT_PROMPT },
      { type: 'input_image', image_url: imageDataUrl },
    ] }],
    text: { format: { type: 'json_schema', name: 'BrickExtraction', schema } },
    reasoning: { effort: EFFORT },
    max_output_tokens: maxOutputTokens,
    store: false,
  }
}

export type ExtractResult =
  | { ok: true; extraction: BrickExtraction; status: string; latency_ms: number; usage: { input_tokens: number; output_tokens: number; reasoning_tokens: number }; retried: boolean }
  | { ok: false; error: string; http?: number; status?: string; raw_text?: string; latency_ms: number }

const outputText = (body: any): string =>
  (body?.output ?? []).filter((i: any) => i?.type === 'message').flatMap((i: any) => i.content ?? []).filter((p: any) => p?.type === 'output_text').map((p: any) => p.text ?? '').join('\n')

async function once(apiKey: string, imageDataUrl: string, maxOut: number) {
  const t0 = Date.now()
  const res = await fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(buildRequest(imageDataUrl, maxOut)) })
  const latency_ms = Date.now() - t0
  const text = await res.text()
  let body: any = null
  try { body = JSON.parse(text) } catch { /* not json */ }
  return { res, body, text, latency_ms }
}

/** One call per photo. A status other than completed (the output cap) gets one retry at a higher cap; 4xx and 504 are never retried. */
export async function extract(apiKey: string, imageDataUrl: string): Promise<ExtractResult> {
  let retried = false
  let attempt = await once(apiKey, imageDataUrl, MAX_OUT)
  if (!attempt.res.ok) return { ok: false, error: `HTTP ${attempt.res.status}: ${attempt.text.slice(0, 300)}`, http: attempt.res.status, latency_ms: attempt.latency_ms }
  if (attempt.body?.status && attempt.body.status !== 'completed') {
    retried = true
    const second = await once(apiKey, imageDataUrl, 16000)
    if (!second.res.ok) return { ok: false, error: `HTTP ${second.res.status} on retry: ${second.text.slice(0, 300)}`, http: second.res.status, latency_ms: attempt.latency_ms + second.latency_ms }
    attempt = { ...second, latency_ms: attempt.latency_ms + second.latency_ms }
  }
  const status = String(attempt.body?.status ?? '')
  const raw = outputText(attempt.body)
  const u = attempt.body?.usage ?? {}
  const usage = { input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0, reasoning_tokens: u.output_tokens_details?.reasoning_tokens ?? 0 }
  try {
    const extraction = BrickExtractionSchema.parse(JSON.parse(raw))
    return { ok: true, extraction, status, latency_ms: attempt.latency_ms, usage, retried }
  } catch (e) {
    return { ok: false, error: `unparsed (${status}): ${(e as Error).message.slice(0, 200)}`, status, raw_text: raw, latency_ms: attempt.latency_ms }
  }
}

/** HTTP handler shared by Vercel and the dev server. Body: { image: dataURL, dry?: boolean }. */
export async function handleExtract(bodyJson: any, apiKey: string | undefined): Promise<{ code: number; body: any }> {
  const image = String(bodyJson?.image ?? '')
  if (!image.startsWith('data:image/')) return { code: 400, body: { error: 'image must be a data URL' } }
  if (image.length > 6_000_000) return { code: 413, body: { error: 'image too large; downscale to a 2048 px long side first' } }
  if (bodyJson?.dry) {
    const req = buildRequest(image)
    return { code: 200, body: { dry: true, request: { ...req, input: [{ ...req.input[0], content: [req.input[0].content[0], { type: 'input_image', image_url: `<data url, ${image.length} chars>` }] }] } } }
  }
  if (!apiKey) return { code: 500, body: { error: 'META_API_KEY is not set on the server' } }
  return { code: 200, body: await extract(apiKey, image) }
}
