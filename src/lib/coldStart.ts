/** First-run guidance, contextual and never a tour: on a cold start the Library says what the starters are and Make offers two example intents.
 *  A cold start is a library that shows the starters and holds no photo of the person's own (one being read or one that failed counts as theirs).
 *  Once they have one, neither element renders, so nothing changes for a library of owned photos. Pure: no React. */
import { originOf } from './starters'
import type { Brick } from './types'

/** Each was run live once against the twelve starters alone (2026-11-04): three picks, every quote verbatim, three different labels. */
export const EXAMPLE_INTENTS = ['A concert log for the shows I go to', 'A reading log for the books I finish'] as const

export const isColdStart = (bricks: Pick<Brick, 'id' | 'origin'>[], showStarters: boolean): boolean =>
  showStarters && !bricks.some(b => originOf(b) === 'own')

const NOTE_KEY = 'tearsheet.starterNote'

/** Whether the Library's starter line was dismissed on this device. Storage can be blocked (private mode, a sandboxed frame): then it was not. */
export function starterNoteDismissed(): boolean {
  try { return localStorage.getItem(NOTE_KEY) === 'dismissed' } catch { return false }
}

/** Remembers the dismissal; where storage is blocked it lasts until the page is reloaded. */
export function dismissStarterNote(): void {
  try { localStorage.setItem(NOTE_KEY, 'dismissed') } catch { /* blocked storage: dismissed for this visit only */ }
}
