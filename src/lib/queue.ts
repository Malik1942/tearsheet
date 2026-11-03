import type { Brick, BrickStatus } from './types'
import type { ExtractResult } from './extract'
import { IDB } from './persist'

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

/** `client.ts` turns any thrown fetch into `offline`, and a thrown fetch does not mean the browser lost its network (a killed request, a proxy, a flaky
 *  radio). The `online` event never comes in that case, so while the browser still says it is online the store tries again on a timer. */
export const OFFLINE_RETRY_MS = 15_000
/** A fetch killed mid-flight may already have reached the model, so every automatic retry can cost a paid call: three per session, then the hold waits
 *  for the `online` event, for the page becoming visible again, or for the next open. */
export const MAX_OFFLINE_RETRIES = 3

/** Whether to arm the one retry timer: only for an offline hold, only while the browser does not itself say it is offline (then the `online` event lifts the hold),
 *  and only while fewer than `MAX_OFFLINE_RETRIES` automatic retries have fired this session. `onLine` is `navigator.onLine`; unknown counts as online. */
export function shouldArmRetry(held: Held | undefined, onLine: boolean | undefined, retries: number): boolean {
  return held === 'offline' && onLine !== false && retries < MAX_OFFLINE_RETRIES
}

/** Put a brick that failed offline back at the front of the waiting list. When several in-flight bricks fail, they go back in the order they were sent
 *  (`started`: brick id -> send number; an id with a number was sent before and is already ahead of anything that never started), not in the order they failed. */
export function reinsertFirst(waiting: readonly string[], id: string, started: ReadonlyMap<string, number>): string[] {
  if (waiting.includes(id)) return [...waiting]
  const mine = started.get(id) ?? Infinity
  let at = 0
  while (at < waiting.length) {
    const n = started.get(waiting[at])
    if (n === undefined || n > mine) break
    at++
  }
  return [...waiting.slice(0, at), id, ...waiting.slice(at)]
}

/** Why "Try again" is off for a brick, if it is: `gone` when its photo is only an `idb:` pointer that was never found (nothing to send, so a retry would only burn the one allowed),
 *  `used` when the one counted retry is spent. */
export function retryBlocked(b: Pick<Brick, 'photo' | 'retries'>): 'gone' | 'used' | null {
  if (b.photo.url.startsWith(IDB)) return 'gone'
  return (b.retries ?? 0) >= 1 ? 'used' : null
}
