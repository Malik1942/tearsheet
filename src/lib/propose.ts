/** Propose (PRD P2): one Muse Spark TEXT call per project intent. Shared by the Vercel function (api/propose.ts) and the Vite dev
 *  middleware; runs on the server only. Input: the intent and the library's rules (brick id, rule text, parameter), nothing else.
 *  Output: up to three brick ids, each with a rule quoted verbatim (a pick whose quote is not one of that brick's rules is dropped), a ranking
 *  of the whole library for the swap sheet, and sample content for the screens (item 1: placeholder text written from the intent alone). */
import { z } from 'zod'
import { cleanKey } from './extract.js'
import { reserveCall } from './guard.js'
import { CHIP_FAMILIES, CHIP_IDS, DARK_RULE, canonicalChips, type Lean } from './leanFamilies.js'
import { PROPOSE_PROMPT } from './proposePrompt.js'
import type { SampleContent } from '../shell/content.js'

export const MODEL = 'muse-spark-1.3'
export const EFFORT = 'low'
/** Reasoning counts against it: with the ranking, thirteen bricks took 3,129 output tokens (2,791 reasoning) on 2026-11-03, and an unfinished answer fails the whole proposal. */
export const MAX_OUT = 8000
/** The ranking names the best ten at most; the swap sheet orders the rest by save date. */
export const RANKING_MAX = 10
const API = 'https://api.meta.ai/v1/responses'
/** Muse Spark Standard, USD per token (meta-eval/docs/ENDPOINTS.md). Reasoning tokens are billed as output. */
const PRICE_IN = 1.25 / 1e6, PRICE_OUT = 4.25 / 1e6
export const MAX_INTENT_CHARS = 300

export type LibraryBrick = { brick_id: string; rules: { rule: string; parameter: string }[] }

/** The sample entries the content asks for. */
export const CONTENT_ENTRIES = 8

/** Exactly the schema the model is constrained to (meta-eval/fixtures/schemas/propose.json). `ranking` orders the library for the swap sheet;
 *  `content` is the screens' placeholder text (item 1). */
export const PROPOSE_SCHEMA = {
  title: 'ProposeResult', type: 'object', additionalProperties: false, required: ['picks', 'ranking', 'content'],
  properties: {
    picks: { type: 'array', maxItems: 3, items: {
      type: 'object', additionalProperties: false, required: ['brick_id', 'quoted_rule', 'why'],
      properties: { brick_id: { type: 'string' }, quoted_rule: { type: 'string' }, why: { type: 'string' } } } },
    ranking: { type: 'array', maxItems: RANKING_MAX, items: { type: 'string' } },
    content: {
      type: 'object', additionalProperties: false, required: ['screen_titles', 'tabs', 'entries'],
      properties: {
        screen_titles: { type: 'object', additionalProperties: false, required: ['list', 'review'], properties: { list: { type: 'string' }, review: { type: 'string' } } },
        tabs: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string' } },
        entries: { type: 'array', minItems: CONTENT_ENTRIES, maxItems: CONTENT_ENTRIES, items: {
          type: 'object', additionalProperties: false, required: ['title', 'subtitle', 'date', 'tags'],
          properties: { title: { type: 'string' }, subtitle: { type: 'string' }, date: { type: 'string' }, tags: { type: 'array', maxItems: 2, items: { type: 'string' } } } } },
      },
    },
  },
} as const

const PickSchema = z.object({ brick_id: z.string(), quoted_rule: z.string(), why: z.string() })
/** `ranking` and `content` are read leniently and checked by `validateRanking` and `validateContent`: a missing or malformed one costs itself, never the proposal. */
export const ProposeResultSchema = z.object({ picks: z.array(PickSchema), ranking: z.unknown().optional(), content: z.unknown().optional() })

const ISO_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const words = (max: number) => z.string().trim().min(1).max(max)
const ContentSchema = z.object({
  screen_titles: z.object({ list: words(24), review: words(24) }),
  tabs: z.array(words(12)).length(3),
  entries: z.array(z.object({ title: words(60), subtitle: words(60), date: z.string().regex(ISO_DAY), tags: z.array(words(16)).max(2) })).min(3).max(CONTENT_ENTRIES),
})

/** The sample content (item 1), checked on its own: anything malformed, or a tab that repeats a screen title (layout contract rule 5), is none, and the
 *  shell keeps the concert sample. It is placeholder text, never a design decision, so it carries no provenance. */
export function validateContent(raw: unknown): SampleContent | null {
  const r = ContentSchema.safeParse(raw)
  if (!r.success) return null
  const titles = new Set([r.data.screen_titles.list, r.data.screen_titles.review].map(t => t.toLowerCase()))
  return r.data.tabs.some(t => titles.has(t.toLowerCase())) ? null : r.data
}
export type RawPick = z.infer<typeof PickSchema>
export type Pick = { brickId: string; quotedRule: string; why: string }

const LeanSchema = z.object({ chips: z.array(z.enum(CHIP_IDS)).max(6), anchor_id: z.string().min(1).max(80).optional() })

const LibrarySchema = z.array(z.object({
  brick_id: z.string().min(1).max(80),
  rules: z.array(z.object({ rule: z.string().max(1000), parameter: z.string().max(40) })).max(3),
})).max(60)

/** The {{LEAN}} text (spec v3 P5): a pure function of the library and the lean, with its chips in canonical order; '' without one.
 *  Chips become parameter families; `dark` becomes the ids of the library bricks with a rule that names a dark ground. No chip word,
 *  "dark" included, is ever sent: the model prefers rules and bricks, it does not match adjectives against photos. */
export function renderLean(library: LibraryBrick[], lean?: Lean): string {
  if (!lean) return ''
  const chips = canonicalChips(lean.chips)
  const families = [...new Set(chips.flatMap(c => CHIP_FAMILIES[c]))]
  const darkIds = chips.includes('dark') ? library.filter(b => b.rules.some(r => DARK_RULE.test(r.rule))).map(b => b.brick_id) : []
  return (families.length ? `\n\nLean. The designer asked to lean the choice toward rules that set these layout parameters: ${families.join(', ')}. Prefer picks whose quoted rule maps to one of them, when such a rule serves what they are making.` : '')
    + (darkIds.length ? `\n\nAlso prefer these bricks when they serve what they are making: ${darkIds.join(', ')}.` : '')
    + (lean.anchor_id ? `\n\nAnchor. The designer has already chosen brick "${lean.anchor_id}" as the starting point. Do not pick it. Pick at most two other bricks whose rules work with it.` : '')
}

/** `year` dates the sample entries (the model does not know today's date); it defaults to the current one. */
export function renderPrompt(intent: string, library: LibraryBrick[], lean?: Lean, year: number = new Date().getFullYear()): string {
  // replacer functions, so `$&`-style patterns in the intent or a rule are inserted literally (as Python's str.replace does);
  // the library is substituted first, then the lean and the year, and the intent last, so a placeholder typed into the intent is never expanded
  const lib = JSON.stringify(library, null, 1), sentence = intent.replace(/"/g, '”'), leanText = renderLean(library, lean)
  return PROPOSE_PROMPT.replace('{{LIBRARY}}', () => lib).replace('{{LEAN}}', () => leanText).replace('{{YEAR}}', () => String(year)).replace('{{INTENT}}', () => sentence)
}

export function buildProposeRequest(intent: string, library: LibraryBrick[], lean?: Lean, year?: number) {
  return {
    model: MODEL,
    input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: renderPrompt(intent, library, lean, year) }] }],
    text: { format: { type: 'json_schema', name: 'ProposeResult', schema: PROPOSE_SCHEMA } },
    reasoning: { effort: EFFORT },
    max_output_tokens: MAX_OUT,
    store: false,
  }
}

/** The check that makes a proposal honest: the quoted rule must be one of that brick's rules, character for character after trimming.
 *  Unknown ids, paraphrases and repeats are dropped and reported, never repaired. With an anchor (chosen by the designer, so not a model
 *  pick) a pick of it is dropped and at most two others are kept. */
export function validatePicks(raw: RawPick[], library: LibraryBrick[], anchorId?: string): { picks: Pick[]; dropped: { brick_id: string; reason: string }[] } {
  const byId = new Map(library.map(b => [b.brick_id, b]))
  const picks: Pick[] = [], dropped: { brick_id: string; reason: string }[] = []
  for (const p of raw) {
    const brick = byId.get(p.brick_id)
    if (!brick) { dropped.push({ brick_id: p.brick_id, reason: 'not a brick in the library' }); continue }
    if (anchorId && p.brick_id === anchorId) { dropped.push({ brick_id: p.brick_id, reason: 'already chosen by the designer' }); continue }
    if (picks.some(x => x.brickId === p.brick_id)) { dropped.push({ brick_id: p.brick_id, reason: 'picked twice' }); continue }
    const quote = p.quoted_rule.trim()
    if (!brick.rules.some(r => r.rule.trim() === quote)) { dropped.push({ brick_id: p.brick_id, reason: 'the reason does not quote one of its rules verbatim' }); continue }
    if (picks.length >= (anchorId ? 2 : 3)) { dropped.push({ brick_id: p.brick_id, reason: anchorId ? 'more than two picks besides the anchor' : 'more than three picks' }); continue }
    picks.push({ brickId: p.brick_id, quotedRule: quote, why: p.why.trim() })
  }
  return { picks, dropped }
}

/** The swap sheet's order (2026-11-03), from the same call as the picks: library ids only, in the model's order, each once, the first ten.
 *  Anything else is dropped, and a missing or malformed ranking is none: it orders photos, it never costs a proposal. */
export function validateRanking(raw: unknown, library: LibraryBrick[]): string[] {
  if (!Array.isArray(raw)) return []
  const ids = new Set(library.map(b => b.brick_id)), kept = new Set<string>()
  for (const id of raw) {
    if (kept.size >= RANKING_MAX) break
    if (typeof id === 'string' && ids.has(id)) kept.add(id)
  }
  return [...kept]
}

const outputText = (body: any): string =>
  (body?.output ?? []).filter((i: any) => i?.type === 'message').flatMap((i: any) => i.content ?? []).filter((p: any) => p?.type === 'output_text').map((p: any) => p.text ?? '').join('\n')

export type ProposeResponse =
  | { ok: true; picks: Pick[]; dropped: { brick_id: string; reason: string }[]; ranking: string[]; content: SampleContent | null; status: string; latency_ms: number; usage: { input_tokens: number; output_tokens: number; reasoning_tokens: number }; cost_usd: number; model: string; effort: string }
  | { ok: false; error: string; http?: number; status?: string; latency_ms: number; usage?: { input_tokens: number; output_tokens: number; reasoning_tokens: number }; cost_usd?: number }

/** One call, no retry: a proposal that fails falls back to picking by hand, so a second paid attempt buys nothing. */
export async function propose(apiKey: string, intent: string, library: LibraryBrick[], lean?: Lean): Promise<ProposeResponse> {
  const t0 = Date.now()
  let res: Response
  try {
    res = await fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(buildProposeRequest(intent, library, lean)), signal: AbortSignal.timeout(55_000) })
  } catch (e) {
    return { ok: false, error: `request failed: ${(e as Error).message}`, latency_ms: Date.now() - t0 }
  }
  const latency_ms = Date.now() - t0
  const text = await res.text()
  let body: any = null
  try { body = JSON.parse(text) } catch { /* not json */ }
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}`, http: res.status, latency_ms }
  const status = String(body?.status ?? '')
  const u = body?.usage ?? {}
  const usage = { input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0, reasoning_tokens: u.output_tokens_details?.reasoning_tokens ?? 0 }
  const cost_usd = usage.input_tokens * PRICE_IN + usage.output_tokens * PRICE_OUT
  if (status !== 'completed') return { ok: false, error: `the model did not finish (status ${status || 'unknown'})`, status, latency_ms, usage, cost_usd }
  try {
    const parsed = ProposeResultSchema.parse(JSON.parse(outputText(body)))
    const { picks, dropped } = validatePicks(parsed.picks, library, lean?.anchor_id)
    return { ok: true, picks, dropped, ranking: validateRanking(parsed.ranking, library), content: validateContent(parsed.content), status, latency_ms, usage, cost_usd, model: MODEL, effort: EFFORT }
  } catch (e) {
    return { ok: false, error: `unparsed: ${(e as Error).message.slice(0, 200)}`, status, latency_ms, usage, cost_usd }
  }
}

export type ProposeOptions = {
  /** Live calls are off unless the deployment says so (PROPOSE_ENABLED=1 on Vercel; the dev server also accepts a sealed
   *  meta-eval/fixtures/propose_notes.md). Until then the UI falls back to picking by hand. */
  live: boolean
  ip?: string
  log?: (line: string) => void
}

/** HTTP handler shared by Vercel and the dev server. Body: { intent, library: [{ brick_id, rules: [{ rule, parameter }] }], lean?: { chips[], anchor_id? }, dry? }. */
export async function handlePropose(bodyJson: any, apiKey: string | undefined, opts: ProposeOptions): Promise<{ code: number; body: any }> {
  const intent = String(bodyJson?.intent ?? '').trim()
  if (!intent) return { code: 400, body: { error: 'intent is required' } }
  if (intent.length > MAX_INTENT_CHARS) return { code: 400, body: { error: `intent is at most ${MAX_INTENT_CHARS} characters` } }
  const lib = LibrarySchema.safeParse(bodyJson?.library)
  if (!lib.success) return { code: 400, body: { error: 'library must be up to 60 bricks, each { brick_id, rules: [{ rule, parameter }] } with at most three rules' } }
  const library = lib.data.filter(b => b.rules.length > 0)
  if (library.length === 0) return { code: 400, body: { error: 'no brick in the library has a rule to quote' } }
  // an absent lean, or one with neither chips nor an anchor, is no lean: the request is then the one a lean-less app sends
  let lean: Lean | undefined
  if (bodyJson?.lean !== undefined && bodyJson.lean !== null) {
    const parsed = LeanSchema.safeParse(bodyJson.lean)
    if (!parsed.success) return { code: 400, body: { error: 'lean must be { chips: [known chip ids, at most six], anchor_id? }' } }
    const { chips, anchor_id } = parsed.data
    if (anchor_id && !library.some(b => b.brick_id === anchor_id)) return { code: 400, body: { error: 'the anchor is not a brick in the library' } }
    if (chips.length || anchor_id) lean = { chips: canonicalChips(chips), ...(anchor_id ? { anchor_id } : {}) }
  }
  if (bodyJson?.dry) return { code: 200, body: { dry: true, request: buildProposeRequest(intent, library, lean) } }
  if (!opts.live) return { code: 503, body: { error: 'Proposals are off on this server', disabled: true } }
  const key = cleanKey(apiKey)
  if (!key) return { code: 500, body: { error: 'META_API_KEY is not set on the server' } }
  const refused = reserveCall(opts.ip ?? 'unknown')
  if (refused) return { code: refused.code, body: { error: refused.error } }
  const result = await propose(key, intent, library, lean)
  // PRD 10.4: one line per live call in the function log, the product's half of the cost ledger
  const log = opts.log ?? ((l: string) => console.log(l))
  log(JSON.stringify(result.ok
    ? { call: 'propose', model: MODEL, effort: EFFORT, status: result.status, latency_ms: result.latency_ms, ...result.usage, cost_usd: Number(result.cost_usd.toFixed(6)), picks: result.picks.length, dropped: result.dropped.length, ranked: result.ranking.length, content: !!result.content, bricks_offered: library.length, lean_chips: lean?.chips.length ?? 0, anchor: !!lean?.anchor_id }
    : { call: 'propose', model: MODEL, effort: EFFORT, error: result.error, http: result.http, status: result.status, latency_ms: result.latency_ms, ...(result.usage ?? {}), ...(result.cost_usd !== undefined ? { cost_usd: Number(result.cost_usd.toFixed(6)) } : {}), bricks_offered: library.length, lean_chips: lean?.chips.length ?? 0, anchor: !!lean?.anchor_id }))
  return { code: 200, body: result }
}
