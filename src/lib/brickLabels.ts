/** Display labels for a brick: small, pure, no imports. */

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
