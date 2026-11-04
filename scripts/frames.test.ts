/** Measured drawing: frame ids, numbered in the order photos were saved. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { frameIds, withFrame } from '../src/lib/frames.ts'
import { SAMPLES } from '../src/fixtures/samples/index.ts'

const starters = SAMPLES.map(b => ({ id: b.id, saved_at: b.saved_at }))
const chicago = { id: 'b_img6966', saved_at: '2026-11-03' }

describe('frameIds', () => {
  it('numbers the twelve starters 1 to 12 by the day they were saved, so the person’s first photo after them is frame 13', () => {
    const ids = frameIds([chicago, ...starters])
    assert.equal(ids.get('g1'), 'TS-01-0001')   // saved 2025-04-06, the earliest
    assert.equal(ids.get('b_img6966'), 'TS-01-0013')
    assert.deepEqual([...ids.values()].sort(), Array.from({ length: 13 }, (_, i) => `TS-01-${String(i + 1).padStart(4, '0')}`))
  })
  it('breaks a same-day tie by the order the starters ship, before any photo of the person’s own', () => {
    const ids = frameIds([{ id: 'zz-own', saved_at: '2026-11-02' }, ...starters])
    const sameDay = starters.filter(s => s.saved_at === '2026-11-02').map(s => s.id)
    assert.ok(sameDay.length > 1)
    sameDay.forEach((id, i) => assert.ok(ids.get(id)! < ids.get(sameDay[i + 1] ?? 'zz-own')!, `${id} before the next`))
  })
  it('does not depend on the order the bricks arrive in, and counts a repeated id once', () => {
    const a = frameIds([chicago, ...starters]), b = frameIds([...starters].reverse().concat([chicago, chicago]))
    assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort())
  })
})

describe('withFrame', () => {
  it('puts the frame id before the line, and leaves the line alone without one', () => {
    assert.equal(withFrame('TS-01-0013', 'Dec 27, 2025'), 'TS-01-0013 · Dec 27, 2025')
    assert.equal(withFrame(undefined, 'Mia, 1923'), 'Mia, 1923')
  })
})
