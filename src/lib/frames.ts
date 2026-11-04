/** Frame ids (Measured drawing, 2026-11-04): every photo is a frame on one roll, numbered in the order it was saved, as a contact sheet numbers its frames.
 *  TS-01-0013 is Tearsheet, roll 01 (this library), frame 13. Starters count, in the order they were saved, so hiding them renumbers nothing;
 *  removing a photo renumbers the ones after it. Shown before the credit wherever a photo is a card, and in Details. Pure: the hook is useFrameIds. */
import { SAMPLES } from '../fixtures/samples'
import type { Brick } from './types'

const ROLL = 'TS-01'
const starterOrder = new Map(SAMPLES.map((b, i) => [b.id, i]))

/** Frame id by brick id: saved date first; on the same day starters before the person's own photos, in the order they ship; then by id. */
export function frameIds(bricks: Pick<Brick, 'id' | 'saved_at'>[]): Map<string, string> {
  const rank = (id: string) => starterOrder.get(id) ?? SAMPLES.length
  const order = [...new Map(bricks.map(b => [b.id, b])).values()]
    .sort((a, b) => a.saved_at.localeCompare(b.saved_at) || rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
  return new Map(order.map((b, i) => [b.id, `${ROLL}-${String(i + 1).padStart(4, '0')}`]))
}

/** "TS-01-0013 · Mia, 1923": the frame id before a card's second line; the line alone when the photo has no frame yet. */
export const withFrame = (frame: string | undefined, line: string): string => (frame ? `${frame} · ${line}` : line)
