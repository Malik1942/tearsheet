import type { Brick } from './types'

/** A photo the browser has made upright and small (client.ts `prepareImage`). */
export type Prepared = { dataUrl: string; width: number; height: number; takenAt: string | null }

/** The new brick for one added photo: the person's own, pending, nothing read yet. `taken_at` rides along only when the file's EXIF had a capture date.
 *  Shared by every way in (the header's Shoot, the phone's bottom bar, Add from library): adding never asks for an intent. */
export function brickFromPhoto(prepared: Prepared, now: Date = new Date(), rand: () => number = Math.random): Brick {
  return {
    id: `b_${now.getTime().toString(36)}${rand().toString(36).slice(2, 5)}`, photo: { url: prepared.dataUrl, width: prepared.width, height: prepared.height },
    saved_at: now.toISOString().slice(0, 10), ...(prepared.takenAt ? { taken_at: prepared.takenAt } : {}), origin: 'own', status: 'pending', retries: 0, version: 1,
    measurements: [], hypotheses: [], relations: [], regions: [], fragile_if_changed: '',
    model: { id: 'muse-spark-1.3', effort: 'medium', latency_ms: 0, input_tokens: 0, output_tokens: 0 },
  }
}

/** How many of the person's photos are waiting or being read: the small count on `Shoot`. */
export function readingCount(bricks: Pick<Brick, 'origin' | 'id' | 'status' | 'superseded_by'>[], isOwn: (b: Pick<Brick, 'id' | 'origin'>) => boolean): number {
  return bricks.filter(b => isOwn(b) && !b.superseded_by && (b.status === 'pending' || b.status === 'extracting')).length
}
