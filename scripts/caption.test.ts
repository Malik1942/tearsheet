/** A card's caption in two lines wherever a photo is shown as a card: the Library, Make's photo row, the swap sheet (Malik, 2026-11-03: a card said only
 *  "saved" and a date, with nothing about the photo). Line 1 the photo's title, else its first short label; line 2 a starter's short credit or the photo's date.
 *  Expected values are typed out from the request, never read from brickLabels.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { cardCaption, titleProvenance } from '../src/lib/brickLabels.ts'
import type { Brick } from '../src/lib/types.ts'

const today = new Date(2026, 10, 3)   // 3 Nov 2026, local time
const sample = (id: string) => SAMPLES.find(b => b.id === id)!
const own = (extra: Partial<Brick>): Pick<Brick, 'id' | 'origin' | 'credit' | 'saved_at' | 'taken_at' | 'title'> => ({ id: 'mine', origin: 'own', saved_at: '2026-11-03', ...extra })

describe('the licensed starters carry their catalogue titles, shortened for recognition', () => {
  const titles: [string, string][] = [
    ['bauhaus-1923-staatliches-bauhaus-weimar', 'Staatliches Bauhaus'],
    ['haeckel-1904-trochilidae-plate-99', 'Hummingbirds'],   // Malik: Trochilidae is the family name; a card title is for recognition
    ['iran-1260s-star-cross-luster-tiles', 'Star and cross tiles'],
    ['matthews-19c-glyphography-trade-card', 'Matthews trade card'],
    ['lissitzky-1923-dlya-golosa', 'For the Voice'],
    ['secession-1902-beethoven-catalogue', 'Beethoven catalogue'],
    ['jpl-2016-visions-mars', 'Visions of the Future: Mars'],
  ]
  for (const [id, title] of titles) it(id, () => assert.equal(sample(id).title, title))
  it('keeps the transliterated title for Details only', () => {
    assert.equal(sample('lissitzky-1923-dlya-golosa').title_original, 'Dlya Golosa')
    assert.equal(SAMPLES.filter(b => b.title_original).length, 1)
  })
})

describe("the author's own five carry the titles he wrote", () => {
  const titles: [string, string][] = [['g1', 'Cherry blossoms'], ['g2', 'Porsche 911'], ['c1', 'BMW E24'], ['greencar', 'BMW M4'], ['calmmouse', 'CalmMouse']]
  for (const [id, title] of titles) it(id, () => {
    assert.equal(sample(id).title, title)
    assert.equal(titleProvenance(sample(id)), 'adapted · by you')
  })
  it('so every starter has a title', () => assert.equal(SAMPLES.filter(b => b.title).length, 12))
})

describe("a card's two lines", () => {
  it('leads a starter with its title and follows with its short credit', () => {
    assert.deepEqual(cardCaption(sample('bauhaus-1923-staatliches-bauhaus-weimar'), null, today), { title: 'Staatliches Bauhaus', line: 'Mia, 1923' })
    assert.deepEqual(cardCaption(sample('haeckel-1904-trochilidae-plate-99'), null, today), { title: 'Hummingbirds', line: 'Wikimedia, 1904' })
    assert.deepEqual(cardCaption(sample('g2'), 'Big images', today), { title: 'Porsche 911', line: 'Jun 21, 2025' })
    assert.deepEqual(cardCaption(sample('matthews-19c-glyphography-trade-card'), null, today), { title: 'Matthews trade card', line: 'The Met, 19th century' })
    assert.deepEqual(cardCaption(sample('jpl-2016-visions-mars'), null, today), { title: 'Visions of the Future: Mars', line: 'NASA/JPL' })
  })
  it('a title outranks the label it is given', () => {
    assert.equal(cardCaption(sample('jpl-2016-visions-mars'), 'Big type contrast', today).title, 'Visions of the Future: Mars')
  })
  it("follows an own photo's title with the day it was taken", () => {
    assert.deepEqual(cardCaption(own({ title: 'Green coupe', taken_at: '2025-12-27' }), 'Image leads', today), { title: 'Green coupe', line: 'Dec 27, 2025' })
  })
  it('falls back to the first short label and the date when there is no title', () => {
    assert.deepEqual(cardCaption(own({ taken_at: '2025-12-27' }), 'Big images', today), { title: 'Big images', line: 'Dec 27, 2025' })
    assert.deepEqual(cardCaption(own({}), 'Big images', today), { title: 'Big images', line: 'Nov 3' })
  })
  it('says Untitled before a photo has a title or a label (still being read)', () => {
    assert.deepEqual(cardCaption(own({ saved_at: '2025-06-21' }), null, today), { title: 'Untitled', line: 'Jun 21, 2025' })
  })
  it('keeps an institution it has no short name for whole', () => {
    assert.equal(cardCaption(own({ origin: 'starter', credit: 'Art Institute of Chicago, 1890' }), null, today).line, 'Art Institute of Chicago, 1890')
  })
  it("never says 'saved', never the author's name, never an empty line, on any starter", () => {
    for (const b of SAMPLES) {
      const c = cardCaption(b, null, today)
      assert.ok(c.title.length > 0 && c.line.length > 0, b.id)
      assert.doesNotMatch(`${c.title} ${c.line}`, /saved|Malik/, b.id)
    }
  })
})

describe("a title's provenance", () => {
  it('a licensed work\'s title is its catalogue\'s, so it carries no label of its own (its credit says where it is from)', () => {
    assert.equal(titleProvenance(sample('bauhaus-1923-staatliches-bauhaus-weimar')), null)
  })
  it('a title written by hand is adapted · by you', () => {
    assert.equal(titleProvenance(own({ title: 'Green coupe' })), 'adapted · by you')
    assert.equal(titleProvenance(own({ origin: 'starter', title: 'Cherry blossoms' })), 'adapted · by you')
  })
  it('no title, no label', () => {
    assert.equal(titleProvenance(own({})), null)
  })
})

describe('the two lines as set (tokens.css)', () => {
  const css = readFileSync(new URL('../src/chrome/tokens.css', import.meta.url), 'utf8')
  const rule = (sel: string) => new RegExp(`(^|\\n)${sel.replace('.', '\\.')} \\{([^}]*)\\}`).exec(css)?.[2] ?? ''
  it('line 1 in ink at 13/500, two lines at most', () => {
    assert.match(rule('.cap-title'), /font: 500 13px\/18px var\(--font-ui\)/)
    assert.match(rule('.cap-title'), /color: var\(--ink\)/)
    assert.match(rule('.cap-title'), /-webkit-line-clamp: 2/)
  })
  it('line 2 in the mono at 12, muted, never hidden on a phone', () => {
    assert.match(rule('.cap-line'), /font: 400 12px\/16px var\(--font-mono\)/)
    assert.match(rule('.cap-line'), /color: var\(--ink-2\)/)
    assert.doesNotMatch(css, /cap-line[^{]*\{[^}]*display: none/)
  })
})
