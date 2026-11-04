/** The user's real content for the prototype: a 2025 concert log. It is the shell's fallback content; a project's own (item 1, written by the propose call) replaces it whole. */
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

/** One entry on the screens: a show, a book, a ride. Written content has a title, a subtitle, a date and up to two tags; `place`, `note` and `rating` are the concert sample's own. */
export type Entry = { id: string; title: string; subtitle: string; date: string; tags: string[]; place?: string; note?: string; rating?: number }
/** A total on the year review: what it counts, and its word. */
export type Stat = { count: 'entries' | 'places' | 'months' | 'tags'; label: string }

/** Every word the shell writes on its screens: the two screen titles, the three tab labels (list, chart, person, in that order), the entries, the list's one action,
 *  the year review's three totals and its featured line. No tab label repeats a screen title (layout contract rule 5). */
export type ShellContent = {
  screenTitles: { list: string; review: string }
  tabs: [string, string, string]
  entries: Entry[]
  add: string
  stats: [Stat, Stat, Stat]
  feature: string
}

/** What the propose call writes (item 1), in the schema's own shape; `toShellContent` lays it onto the screens. Model-written placeholder, never a design decision. */
export type SampleContent = { screen_titles: { list: string; review: string }; tabs: string[]; entries: { title: string; subtitle: string; date: string; tags: string[] }[] }

/** The fallback: the concert log, word for word as the shell has always shown it. */
export const CONCERT_CONTENT: ShellContent = {
  screenTitles: { list: 'Shows', review: 'Year review' },
  tabs: ['Log', 'Stats', 'Profile'],
  entries: CONCERTS.map(c => ({ id: c.id, title: c.artist, subtitle: c.venue, place: c.city, date: c.date, tags: c.tags, note: c.note, rating: c.rating })),
  add: 'Add show',
  stats: [{ count: 'entries', label: 'shows' }, { count: 'places', label: 'cities' }, { count: 'tags', label: 'genres' }],
  feature: 'Show of the year',
}

/** A project's written content on the screens, or the concert log when it has none. Written content has no places, so its totals are entries, months and tags
 *  ("8 entries", never the list's title, which is not always a plural noun: "My Weekly Shelf"); its action is "Add" and its featured line "Highlight". */
export function toShellContent(sample: SampleContent | null | undefined): ShellContent {
  if (!sample) return CONCERT_CONTENT
  const [a, b, c] = sample.tabs
  return {
    screenTitles: { list: sample.screen_titles.list, review: sample.screen_titles.review },
    tabs: [a, b, c],
    entries: [...sample.entries].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0)).map((e, i) => ({ id: `e${i + 1}`, title: e.title, subtitle: e.subtitle, date: e.date, tags: e.tags })),
    add: 'Add',
    stats: [{ count: 'entries', label: 'entries' }, { count: 'months', label: 'months' }, { count: 'tags', label: 'tags' }],
    feature: 'Highlight',
  }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const monthOf = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1]
export const shortDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${Number(iso.slice(8, 10))}`

/** The year the entries share most, which the year review is about. */
export function yearOf(entries: Entry[]): string {
  const n = new Map<string, number>()
  for (const e of entries) n.set(e.date.slice(0, 4), (n.get(e.date.slice(0, 4)) ?? 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0]?.[0] ?? ''
}

/** A total's number: how many entries, places (a written entry's place is its subtitle), months or tags. */
export function statValue(entries: Entry[], count: Stat['count']): number {
  if (count === 'entries') return entries.length
  const keys = count === 'places' ? entries.map(e => e.place ?? e.subtitle) : count === 'months' ? entries.map(e => e.date.slice(0, 7)) : entries.flatMap(e => e.tags)
  return new Set(keys).size
}

/** The entry the featured line names: the best rated, else the first. */
export const featured = (entries: Entry[]): Entry | undefined => [...entries].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]

export function groupBy(items: Entry[], mode: string): { label: string; items: Entry[] }[] {
  if (mode === 'none') return [{ label: '', items }]
  const key = (e: Entry) => mode === 'by-time' ? monthOf(e.date) : mode === 'by-place' ? (e.place ?? e.subtitle) : (e.tags[0] ?? 'other')
  const map = new Map<string, Entry[]>()
  for (const e of items) {
    const k = key(e)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(e)
  }
  return [...map.entries()].map(([label, items]) => ({ label, items }))
}
