/** Browser side of Propose (PRD P2–P3). Sends the intent and each ready brick's rules; never a photo, a measurement or a hypothesis. */
import type { Brick } from './types'
import type { LibraryBrick, Pick, ProposeResponse } from './propose'

export type ProposeOutcome =
  | { ok: true; picks: Pick[]; dropped: number; latency_ms: number; model: string; effort: string; cost_usd: number }
  | { ok: false; reason: string; disabled?: boolean; dry?: boolean }

export function libraryFor(bricks: Brick[]): LibraryBrick[] {
  return bricks
    .filter(b => (b.status ?? 'ready') === 'ready' && !b.superseded_by && b.relations.length > 0)
    .map(b => ({ brick_id: b.id, rules: b.relations.slice(0, 3).map(r => ({ rule: r.rule, parameter: r.parameter })) }))
    // sorted by id, the order the harness uses (meta-eval/meta_eval/propose.py reads the sample files sorted), so the same library
    // gives the same request; capped at the server's 60
    .sort((a, b) => (a.brick_id < b.brick_id ? -1 : a.brick_id > b.brick_id ? 1 : 0))
    .slice(0, 60)
}

/** Whether this deployment makes live proposals (GET /api/propose; no model call). null when unknown. */
export async function proposeEnabled(): Promise<boolean | null> {
  try { const r = await fetch('/api/propose'); if (!r.ok) return null; return !!(await r.json()).enabled } catch { return null }
}

export async function propose(intent: string, bricks: Brick[], dry = false): Promise<ProposeOutcome> {
  const library = libraryFor(bricks)
  if (library.length === 0) return { ok: false, reason: 'no brick in the library has a rule to quote' }
  let res: Response
  try {
    res = await fetch('/api/propose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent, library, dry }) })
  } catch (e) { return { ok: false, reason: (e as Error).message } }
  const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as (ProposeResponse & { dry?: boolean; disabled?: boolean; error?: string })
  if (json.dry) return { ok: false, dry: true, reason: 'Dry run: nothing was sent.' }
  if (!res.ok) return { ok: false, reason: json.error ?? `HTTP ${res.status}`, disabled: !!json.disabled }
  if (!json.ok) return { ok: false, reason: json.error }
  if (json.picks.length === 0) return { ok: false, reason: json.dropped.length ? 'every pick was dropped: none quoted a rule of a library brick verbatim, once' : 'the model proposed nothing for this intent' }
  return { ok: true, picks: json.picks, dropped: json.dropped.length, latency_ms: json.latency_ms, model: json.model, effort: json.effort, cost_usd: json.cost_usd }
}
