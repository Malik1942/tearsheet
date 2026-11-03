/** Spec v3 P7: the saved date on a proposal card. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { savedLabel } from '../src/lib/brickLabels.ts'

const today = new Date(2026, 10, 2)   // 2 Nov 2026, local time

describe('savedLabel', () => {
  it('drops the year when the date is in the current calendar year', () => {
    assert.equal(savedLabel('2026-06-21', today), 'saved Jun 21')
    assert.equal(savedLabel('2026-11-02', today), 'saved Nov 2')
  })
  it('keeps the year when it is another year', () => {
    assert.equal(savedLabel('2025-06-21', today), 'saved Jun 21, 2025')
    assert.equal(savedLabel('2025-01-05', new Date(2026, 0, 1)), 'saved Jan 5, 2025')
  })
  it('writes the day without a leading zero and names all twelve months', () => {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    names.forEach((m, i) => assert.equal(savedLabel(`2026-${String(i + 1).padStart(2, '0')}-09`, today), `saved ${m} 9`))
  })
  it('reads the string by hand, so the time zone cannot move the day', () => {
    assert.equal(savedLabel('2026-01-01', new Date(2026, 5, 1)), 'saved Jan 1')
    assert.equal(savedLabel('2025-12-31', new Date(2026, 5, 1)), 'saved Dec 31, 2025')
  })
  it('falls back to the raw string when it is not a date', () => {
    assert.equal(savedLabel('garbage'), 'saved garbage')
    assert.equal(savedLabel(''), 'saved ')
    assert.equal(savedLabel('2026-13-01', today), 'saved 2026-13-01')
    assert.equal(savedLabel('2026-06-00', today), 'saved 2026-06-00')
    assert.equal(savedLabel('2026-6-21', today), 'saved 2026-6-21')
    assert.equal(savedLabel('2026-02-29', today), 'saved 2026-02-29')   // 2026 is not a leap year
    assert.equal(savedLabel('2024-02-29', today), 'saved Feb 29, 2024')
  })
  it('defaults today to the real date', () => {
    const now = new Date()
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    assert.equal(savedLabel(iso).includes(','), false)
  })
})
