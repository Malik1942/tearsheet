/** The user's real content for the prototype: a 2025 concert log. Replace with content.json later; shape stays. */
export type Concert = {
  id: string
  date: string   // ISO
  artist: string
  venue: string
  city: string
  tags: string[]
  note: string
  rating: number // 1-5
}

export const INTENT = 'A concert log for someone who goes to a lot of shows and wants to look back on a year.'

/** The words the shell writes on its screens besides the entries: the two screen titles and the three tab labels (list, chart, person, in that order).
 *  The concert log is the fallback value; no tab label repeats a screen title (layout contract rule 5). */
export type ShellContent = { screenTitles: { list: string; review: string }; tabs: [string, string, string] }
export const CONCERT_CONTENT: ShellContent = { screenTitles: { list: 'Shows', review: 'Year review' }, tabs: ['Log', 'Stats', 'Profile'] }

export const CONCERTS: Concert[] = [
  { id: 'c01', date: '2025-01-18', artist: 'Khruangbin', venue: 'Fox Theater', city: 'Oakland', tags: ['funk', 'instrumental'], note: 'Bass tone carried the whole room. Sat upstairs, still felt it.', rating: 5 },
  { id: 'c02', date: '2025-02-07', artist: 'Mitski', venue: 'The Masonic', city: 'San Francisco', tags: ['indie', 'pop'], note: 'Choreographed to the second. Crowd silent in the quiet parts.', rating: 4 },
  { id: 'c03', date: '2025-02-28', artist: 'Floating Points', venue: '1015 Folsom', city: 'San Francisco', tags: ['electronic'], note: 'Modular set, no laptop. Lights synced by hand.', rating: 4 },
  { id: 'c04', date: '2025-03-15', artist: 'Big Thief', venue: 'The Greek Theatre', city: 'Berkeley', tags: ['indie', 'folk'], note: 'Rain for the first three songs. Nobody left.', rating: 5 },
  { id: 'c05', date: '2025-04-05', artist: 'Yussef Dayes', venue: 'The Independent', city: 'San Francisco', tags: ['jazz', 'instrumental'], note: 'Drum solo at the end went on for nine minutes and earned it.', rating: 5 },
  { id: 'c06', date: '2025-04-26', artist: 'Japanese Breakfast', venue: 'Fox Theater', city: 'Oakland', tags: ['indie', 'pop'], note: 'Gong. Enough said.', rating: 3 },
  { id: 'c07', date: '2025-05-17', artist: 'Caroline Polachek', venue: 'Bill Graham Civic', city: 'San Francisco', tags: ['pop', 'electronic'], note: 'Voice is the instrument. Stage design did the rest.', rating: 4 },
  { id: 'c08', date: '2025-06-21', artist: 'Four Tet', venue: 'Outside Lands Night Show', city: 'San Francisco', tags: ['electronic'], note: 'Sunset set outdoors. Fog arrived on cue.', rating: 4 },
  { id: 'c09', date: '2025-07-12', artist: 'Alabama Shakes', venue: 'The Greek Theatre', city: 'Berkeley', tags: ['rock', 'soul'], note: 'Brittany Howard at full power. Hoarse the next day.', rating: 5 },
  { id: 'c10', date: '2025-08-09', artist: 'Sampha', venue: 'The Warfield', city: 'San Francisco', tags: ['soul', 'electronic'], note: 'Two drummers facing each other. Tight.', rating: 4 },
  { id: 'c11', date: '2025-09-13', artist: 'Jessica Pratt', venue: 'Swedish American Hall', city: 'San Francisco', tags: ['folk'], note: 'Small room, no amplification to speak of. Perfect.', rating: 4 },
  { id: 'c12', date: '2025-10-04', artist: 'Hiatus Kaiyote', venue: 'Fox Theater', city: 'Oakland', tags: ['soul', 'funk'], note: 'Odd time signatures the whole crowd somehow clapped along to.', rating: 5 },
  { id: 'c13', date: '2025-10-25', artist: 'Kelela', venue: 'The Regency Ballroom', city: 'San Francisco', tags: ['electronic', 'soul'], note: 'Lighting was mostly darkness. It worked.', rating: 3 },
  { id: 'c14', date: '2025-11-15', artist: 'Bonobo', venue: 'The Masonic', city: 'San Francisco', tags: ['electronic', 'instrumental'], note: 'Full band version. Strings on three songs.', rating: 4 },
]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const monthOf = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1]
export const shortDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${Number(iso.slice(8, 10))}`

export function groupBy(items: Concert[], mode: string): { label: string; items: Concert[] }[] {
  if (mode === 'none') return [{ label: '', items }]
  const key = (c: Concert) => mode === 'by-time' ? monthOf(c.date) : mode === 'by-place' ? c.city : c.tags[0]
  const map = new Map<string, Concert[]>()
  for (const c of items) {
    const k = key(c)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(c)
  }
  return [...map.entries()].map(([label, items]) => ({ label, items }))
}
