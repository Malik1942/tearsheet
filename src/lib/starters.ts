/** Starter bricks (spec v3 SB1–SB4, L7): the shipped, pre-extracted bricks are built in, never stored. The person's own bricks are the saved state;
 *  the starters are added to what the screens see, fill a thin library after the person's own bricks, and can be hidden. Pure: no React. */
import { SAMPLES } from '../fixtures/samples'
import BORDERS from '../fixtures/borders.json'
import type { Brick, PhotoBorder } from './types'

/** Every shipped brick is a starter, Malik's own five photos included: for anyone else they are not "yours". */
export const STARTER_IDS: ReadonlySet<string> = new Set(SAMPLES.map(b => b.id))

/** `own` is any brick a person adds (Shoot, Add from library, a retry of one) or syncs in; `starter` is a shipped one. An explicit `origin` wins; older saves hold copies
 *  of the samples with no origin, and those are starters by id. */
export const originOf = (b: Pick<Brick, 'id' | 'origin'>): 'own' | 'starter' => b.origin ?? (STARTER_IDS.has(b.id) ? 'starter' : 'own')

let built: Brick[] | undefined
/** The starters as ready bricks (prompt v3), the same objects every time so a screen can rely on their identity. Their photos are plain `/samples/*.jpg` URLs, never IndexedDB,
 *  each with the border scripts/borders.ts measured into fixtures/borders.json the way a photo is measured at save (the extraction fixtures stay as they are). */
export function starterBricks(): Brick[] {
  return built ??= SAMPLES.map(b => {
    const border = (BORDERS as Record<string, PhotoBorder | undefined>)[b.id]
    return { ...b, photo: border ? { ...b.photo, border } : b.photo, status: 'ready' as const, prompt_version: 'v3', origin: 'starter' as const }
  })
}

/** What the store exposes as `bricks`: the saved bricks that are the person's, then every starter that no brick of theirs shadows, so every screen can still resolve a project that uses one.
 *  A saved copy of a starter (older saves seeded them) is replaced by the built-in one: one entry per id, origin `starter`. */
export function withStarters(saved: Brick[]): Brick[] {
  const mine = ownBricks(saved)
  const ids = new Set(mine.map(b => b.id))
  return [...mine, ...starterBricks().filter(s => !ids.has(s.id))]
}

/** The bricks that belong in the saved state, in order: what a person added or synced in, never a starter. */
export const ownBricks = (bricks: Brick[]): Brick[] => bricks.filter(b => originOf(b) === 'own')

/** The saved state as it is kept: no starters in it. The same object when there is nothing to drop. */
export function withoutStarters<T extends { bricks: Brick[] }>(state: T): T {
  const bricks = ownBricks(state.bricks)
  return bricks.length === state.bricks.length ? state : { ...state, bricks }
}

/** The reason a starter carries in a proposal pool (SB3, the thin-library case). */
export const FILLS = 'fills: fewer than three of your own'

const isReady = (b: Brick) => (b.status ?? 'ready') === 'ready' && !b.superseded_by
/** Own bricks needed before the starters step aside. */
const ENOUGH = 3

/** The bricks Projects offers, for the chips, the proposal and the manual grid (SB3): the ready own bricks first; the ready starters follow, each with the fill reason, only while
 *  starters are shown and fewer than three own bricks have a rule to quote (an unready brick, a superseded one or one without a rule does not count). The starters come from the built-in list,
 *  so `bricks` may or may not hold them already. */
export function proposalPool(bricks: Brick[], showStarters: boolean): { brick: Brick; fills?: string }[] {
  const mine = ownBricks(bricks).filter(isReady)
  const pool: { brick: Brick; fills?: string }[] = mine.map(brick => ({ brick }))
  if (!showStarters || mine.filter(b => b.relations.length > 0).length >= ENOUGH) return pool
  const ids = new Set(ownBricks(bricks).map(b => b.id))
  return [...pool, ...starterBricks().filter(s => !ids.has(s.id) && isReady(s)).map(brick => ({ brick, fills: FILLS }))]
}

/** After a proposal comes back: the person's own bricks before the starters, the model's order kept inside each group. A brick the list does not hold is read by its id. */
export function orderOwnFirst<P extends { brickId: string }>(picks: P[], bricks: Brick[]): P[] {
  const byId = new Map(bricks.map(b => [b.id, b]))
  const isOwn = (p: P) => originOf(byId.get(p.brickId) ?? { id: p.brickId }) === 'own'
  return [...picks.filter(isOwn), ...picks.filter(p => !isOwn(p))]
}
