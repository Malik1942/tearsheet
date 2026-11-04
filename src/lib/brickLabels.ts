/** Display labels for a brick: small and pure. */
import { originOf } from './starters'
import type { Brick } from './types'

/** Dates through Intl (Web Interface Guidelines: no hand-built date formats), in the app's English and in UTC, so a date-only value never shifts by the viewer's time zone. */
const SAME_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const OTHER_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** "Jun 21" for a date in this calendar year, "Jun 21, 2025" for any other year. The date is date-only, `YYYY-MM-DD`, and is read by hand:
 *  `new Date(string)` would read it as UTC midnight and shift the day by the viewer's time zone. Anything that is not a real date is returned as given. */
export function dayLabel(iso: string, today: Date): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3])
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  if (month < 1 || month > 12 || day < 1 || day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) return iso
  const at = new Date(Date.UTC(year, month - 1, day))
  return (year === today.getFullYear() ? SAME_YEAR : OTHER_YEAR).format(at)
}

/** "saved Jun 21" for a brick saved this calendar year, "saved Jun 21, 2025" for any other year (spec v3 P7: the date that makes
 *  "a photo you forgot you saved" visible). Anything that is not a real date reads `saved <as given>`. */
export const savedLabel = (savedAt: string, today: Date = new Date()): string => `saved ${dayLabel(savedAt, today)}`

/** "taken Dec 27, 2025 · saved Nov 3" when the photo's EXIF gave a capture date on another day than the save; otherwise the saved label alone.
 *  An old photo imported today would otherwise read as new. */
export function datesLabel(b: Pick<Brick, 'saved_at' | 'taken_at'>, today: Date = new Date()): string {
  const saved = savedLabel(b.saved_at, today)
  return b.taken_at && b.taken_at !== b.saved_at ? `taken ${dayLabel(b.taken_at, today)} · ${saved}` : saved
}

/** 15_SIMPLIFY §2: the one line under a Library card and on the Brick sheet. "Dec 27, 2025" when the photo's EXIF gave a capture date (the day it was taken is the date that matters),
 *  else "saved Nov 3"; a starter shows its credit line instead (spec v3 SB2: the credit travels with the photo). `originLabel` keeps both dates for Make. */
export function dateLine(b: Pick<Brick, 'id' | 'origin' | 'credit' | 'saved_at' | 'taken_at'>, today: Date = new Date()): string {
  if (originOf(b) === 'starter') return creditLine(b)
  return b.taken_at ? dayLabel(b.taken_at, today) : savedLabel(b.saved_at, today)
}

/** The issue line's two halves (Malik, 2026-11-03: the line set as a rail, the count left and the note right): "14 photos" and "since Dec 27, 2025",
 *  the date being the earliest a card shows; no date when empty. */
export const issueParts = (n: number, first: string | undefined, today: Date = new Date()): { count: string; since: string } =>
  ({ count: `${n} ${n === 1 ? 'photo' : 'photos'}`, since: n > 0 && first ? `since ${dayLabel(first, today)}` : '' })

/** The loud Library's issue line (C+D §8), real counts only: "14 photos · since Dec 27, 2025"; "0 photos" when empty. */
export const issueLine = (n: number, first: string | undefined, today: Date = new Date()): string => {
  const p = issueParts(n, first, today)
  return p.since ? `${p.count} · ${p.since}` : p.count
}

/** The one credit line a starter carries wherever its photo is shown (spec v3 SB2). The licensed works have their own (README, Sample credits); a starter without one is the author's own work. */
export const creditLine = (b: Pick<Brick, 'credit' | 'saved_at'>): string => b.credit ?? `Malik Zhang, ${b.saved_at.slice(0, 4)}`

/** Institutions with a short name for picker tiles (swap sheet, 2026-11-03); the rest of the credit, its date, is kept. A credit that starts with none of these
 *  is shown whole: an institution's name is never cut. */
const SHORT_NAMES: [string, string][] = [
  ['Minneapolis Institute of Art', 'Mia'],
  ['The Metropolitan Museum of Art', 'The Met'],
  ['Courtesy NASA/JPL-Caltech', 'NASA/JPL'],
  ['Wikimedia Commons', 'Wikimedia'],
]

export function shortCredit(credit: string): string {
  const hit = SHORT_NAMES.find(([full]) => credit.startsWith(full))
  return hit ? hit[1] + credit.slice(hit[0].length) : credit
}

/** A picker tile's second line (swap sheet): a credited starter's short credit; anything else its date as an own photo shows it ("Dec 27, 2025", else "saved Nov 3").
 *  The author's own starters carry no credit, so they show their date, never the author's name. */
export function shortOriginLine(b: Pick<Brick, 'id' | 'origin' | 'credit' | 'saved_at' | 'taken_at'>, today: Date = new Date()): string {
  if (originOf(b) === 'starter' && b.credit) return shortCredit(b.credit)
  return b.taken_at ? dayLabel(b.taken_at, today) : savedLabel(b.saved_at, today)
}

/** A Library card's caption in two parts (Malik, 2026-11-03: who leads, when follows): a credited starter's short institution and its date ("Mia" and "1923";
 *  an institution with no short name stays whole), or an own photo's date, after a quiet "saved" when the photo gave no EXIF date. The same words as the swap sheet's line. */
export function originParts(b: Pick<Brick, 'id' | 'origin' | 'credit' | 'saved_at' | 'taken_at'>, today: Date = new Date()): { lead: string; note: string; noteFirst: boolean } {
  if (originOf(b) === 'starter' && b.credit) {
    const short = shortCredit(b.credit), at = short.indexOf(', ')
    return at === -1 ? { lead: short, note: '', noteFirst: false } : { lead: short.slice(0, at), note: short.slice(at + 2), noteFirst: false }
  }
  return b.taken_at ? { lead: dayLabel(b.taken_at, today), note: '', noteFirst: false } : { lead: dayLabel(b.saved_at, today), note: 'saved', noteFirst: true }
}

/** The one origin line every place shows (spec v3 SB2): `saved Jun 21` (or `taken … · saved …`) for a brick of the person's own, `starter · The Metropolitan Museum of Art, 19th century` for a starter.
 *  Origin is not a provenance: the four provenance labels are unchanged. */
export function originLabel(b: Pick<Brick, 'id' | 'origin' | 'credit' | 'saved_at' | 'taken_at'>, today: Date = new Date()): string {
  return originOf(b) === 'starter' ? `starter · ${creditLine(b)}` : datesLabel(b, today)
}
