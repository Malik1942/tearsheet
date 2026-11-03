import type { Brick, BrickStatus } from './types'
import type { ExtractResult } from './extract'

/** What the store does with one answer from /api/extract (spec v3 L11, "Nothing is ever dropped").
 *  The server's refusal (daily cap, per-IP rate; an upstream 429 counts too) and a fetch that never got an answer are not failures of
 *  the photo: it goes back to `pending`, held, and the pump stops. Anything else is an ordinary failure, one counted retry as before. */
export type Held = NonNullable<Brick['held']>
export type Decision = { status: BrickStatus; held?: Held; error?: string; stop: boolean }

export function afterResult(result: ExtractResult): Decision {
  if (result.ok) return { status: 'ready', held: undefined, error: undefined, stop: false }
  if (result.offline) return { status: 'pending', held: 'offline', error: undefined, stop: true }
  if (result.http === 429 || result.limited) return { status: 'pending', held: 'limit', error: undefined, stop: true }
  return { status: 'unparsed', held: undefined, error: result.error, stop: false }
}
