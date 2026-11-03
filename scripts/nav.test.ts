/** 15_SIMPLIFY §1: the shared header's two tabs, where the header and the phone's bottom bar show, and the one way photos come in. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hasHeader, tabOf } from '../src/lib/nav.ts'
import { brickFromPhoto, readingCount } from '../src/lib/addPhotos.ts'
import { originOf } from '../src/lib/starters.ts'
import type { Brick } from '../src/lib/types.ts'

describe('tabOf', () => {
  it('selects Make for the make flow and anything inside a project', () => {
    for (const p of ['/make', '/make/picks', '/project/p_1', '/project/p_1/export', '/project/p_1/share', '/project/p_1/preview']) assert.equal(tabOf(p), 'make', p)
  })
  it('selects Library everywhere else', () => {
    for (const p of ['/', '/brick/b_1', '/sync', '/projects', '/open', '/compare', '/maker', '/projects/x']) assert.equal(tabOf(p), 'library', p)
  })
})

describe('where the header and the bottom bar show', () => {
  it('every route has the header but the solo renders', () => {
    assert.equal(hasHeader('/solo/chicago/list'), false)
    for (const p of ['/', '/make', '/brick/b_1', '/project/p_1', '/sync', '/open', '/compare']) assert.equal(hasHeader(p), true, p)
  })
})

describe('brickFromPhoto', () => {
  const prepared = { dataUrl: 'data:image/jpeg;base64,AAAA', width: 1200, height: 1600, takenAt: '2025-12-27' }
  const now = new Date('2026-11-03T18:00:00Z')
  it('makes a pending brick of your own, nothing read yet, with the capture date', () => {
    const b = brickFromPhoto(prepared, now, () => 0.5)
    assert.equal(b.origin, 'own')
    assert.equal(b.status, 'pending')
    assert.equal(b.saved_at, '2026-11-03')
    assert.equal(b.taken_at, '2025-12-27')
    assert.deepEqual(b.photo, { url: prepared.dataUrl, width: 1200, height: 1600 })
    assert.deepEqual([b.measurements, b.hypotheses, b.relations, b.regions], [[], [], [], []])
    assert.equal(b.retries, 0)
    assert.equal(b.version, 1)
    assert.match(b.id, /^b_[0-9a-z]+$/)
  })
  it('leaves taken_at out when the file carried no EXIF date', () => {
    const b = brickFromPhoto({ ...prepared, takenAt: null }, now)
    assert.equal('taken_at' in b, false)
  })
})

describe('readingCount (the badge on Shoot)', () => {
  const b = (id: string, status: Brick['status'], extra: Partial<Brick> = {}) => ({ id, status, origin: 'own' as const, ...extra })
  it('counts your own photos waiting or being read, not the read, failed, superseded or starter ones', () => {
    const list = [b('a', 'pending'), b('b', 'extracting'), b('c', 'ready'), b('d', 'unparsed'), b('e', 'pending', { superseded_by: 'e.v2' }), { id: 'g2', status: 'pending' as const, origin: 'starter' as const }]
    assert.equal(readingCount(list, x => originOf(x) === 'own'), 2)
  })
})
