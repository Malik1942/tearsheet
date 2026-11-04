/** A Library card's caption in two parts (Malik, 2026-11-03: the credit read as one grey line, with no hierarchy, too small on a phone): who leads,
 *  when follows. Expected values are typed out from the request, never read from brickLabels.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { originParts } from '../src/lib/brickLabels.ts'
import type { Brick } from '../src/lib/types.ts'

const today = new Date(2026, 10, 3)   // 3 Nov 2026, local time
const sample = (id: string) => SAMPLES.find(b => b.id === id)!
const own = (extra: Partial<Brick>): Pick<Brick, 'id' | 'origin' | 'credit' | 'saved_at' | 'taken_at'> => ({ id: 'mine', origin: 'own', saved_at: '2026-11-03', ...extra })

describe('a Library card caption: who leads, when follows', () => {
  it('splits a credited starter into its short institution and its date', () => {
    assert.deepEqual(originParts(sample('bauhaus-1923-staatliches-bauhaus-weimar'), today), { lead: 'Mia', note: '1923', noteFirst: false })
    assert.deepEqual(originParts(sample('matthews-19c-glyphography-trade-card'), today), { lead: 'The Met', note: '19th century', noteFirst: false })
    assert.deepEqual(originParts(sample('iran-1260s-star-cross-luster-tiles'), today), { lead: 'The Met', note: '1260–70', noteFirst: false })
    assert.deepEqual(originParts(sample('haeckel-1904-trochilidae-plate-99'), today), { lead: 'Wikimedia', note: '1904', noteFirst: false })
  })
  it('leaves a credit with no date whole', () => {
    assert.deepEqual(originParts(sample('jpl-2016-visions-mars'), today), { lead: 'NASA/JPL', note: '', noteFirst: false })
  })
  it('keeps an institution it has no short name for whole, with its date apart', () => {
    assert.deepEqual(originParts(own({ origin: 'starter', credit: 'Art Institute of Chicago, 1890' }), today), { lead: 'Art Institute of Chicago', note: '1890', noteFirst: false })
  })
  it("leads an own photo with the day it was taken, or the day it was saved after a quiet 'saved'", () => {
    assert.deepEqual(originParts(own({ taken_at: '2025-12-27' }), today), { lead: 'Dec 27, 2025', note: '', noteFirst: false })
    assert.deepEqual(originParts(own({}), today), { lead: 'Nov 3', note: 'saved', noteFirst: true })
  })
  it("treats the author's own starters as own photos, never with the author's name", () => {
    assert.deepEqual(originParts(sample('g1'), today), { lead: 'Apr 6, 2025', note: 'saved', noteFirst: true })
  })
})
