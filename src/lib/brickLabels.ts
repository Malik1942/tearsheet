/** Display labels for a brick: small and pure. */
import { originOf } from './starters'
import type { Brick } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "saved Jun 21" for a brick saved this calendar year, "saved Jun 21, 2025" for any other year (spec v3 P7: the date that makes
 *  "a photo you forgot you saved" visible). `savedAt` is date-only, `YYYY-MM-DD`, and is read by hand: `new Date(string)` would
 *  read it as UTC midnight and shift the day by the viewer's time zone. Anything that is not a real date reads `saved <as given>`. */
export function savedLabel(savedAt: string, today: Date = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(savedAt)
  if (!m) return `saved ${savedAt}`
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3])
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  if (month < 1 || month > 12 || day < 1 || day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) return `saved ${savedAt}`
  const date = `${MONTHS[month - 1]} ${day}`
  return year === today.getFullYear() ? `saved ${date}` : `saved ${date}, ${year}`
}

/** The one credit line a starter carries wherever its photo is shown (spec v3 SB2). The licensed works have their own (README, Sample credits); a starter without one is the author's own work. */
export const creditLine = (b: Pick<Brick, 'credit' | 'saved_at'>): string => b.credit ?? `Malik Zhang, ${b.saved_at.slice(0, 4)}`

/** The one origin line every place shows (spec v3 SB2): `saved Jun 21` for a brick of the person's own, `starter · The Metropolitan Museum of Art, 19th century` for a starter.
 *  Origin is not a provenance: the four provenance labels are unchanged. */
export function originLabel(b: Pick<Brick, 'id' | 'origin' | 'credit' | 'saved_at'>, today: Date = new Date()): string {
  return originOf(b) === 'starter' ? `starter · ${creditLine(b)}` : savedLabel(b.saved_at, today)
}
