/** An old photo imported today must not read as new (Malik, Tue 2026-11-03): the card says "taken Dec 27, 2025 · saved Nov 3" when the JPEG
 *  carries an EXIF DateTimeOriginal, and "saved Nov 3" alone when it does not. The JPEGs below are built byte by byte. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { exifTakenAt } from '../src/lib/exifDate.ts'
import { datesLabel, originLabel } from '../src/lib/brickLabels.ts'

/** SOI, an optional APP0, APP1 "Exif" with IFD0 → Exif IFD → DateTimeOriginal (ASCII, 20 bytes), then SOS and EOI. */
function jpeg(date: string | null, le: boolean, { app0 = false, tag = 0x9003 } = {}): ArrayBuffer {
  const tiff = new DataView(new ArrayBuffer(64))
  tiff.setUint16(0, le ? 0x4949 : 0x4d4d); tiff.setUint16(2, 42, le); tiff.setUint32(4, 8, le)
  tiff.setUint16(8, 1, le); tiff.setUint16(10, 0x8769, le); tiff.setUint16(12, 4, le); tiff.setUint32(14, 1, le); tiff.setUint32(18, 26, le); tiff.setUint32(22, 0, le)
  tiff.setUint16(26, 1, le); tiff.setUint16(28, tag, le); tiff.setUint16(30, 2, le); tiff.setUint32(32, 20, le); tiff.setUint32(36, 44, le); tiff.setUint32(40, 0, le)
  const text = date ?? ''
  for (let i = 0; i < text.length; i++) tiff.setUint8(44 + i, text.charCodeAt(i))
  const parts: number[] = [0xff, 0xd8]
  if (app0) parts.push(0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0))
  if (date !== null) {
    const len = 2 + 6 + 64
    parts.push(0xff, 0xe1, len >> 8, len & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0, ...new Uint8Array(tiff.buffer))
  }
  parts.push(0xff, 0xda, 0x00, 0x02, 0xff, 0xd9)
  return new Uint8Array(parts).buffer
}

describe('exifTakenAt', () => {
  it('reads DateTimeOriginal in both byte orders', () => {
    assert.equal(exifTakenAt(jpeg('2025:12:27 16:50:25', true)), '2025-12-27')
    assert.equal(exifTakenAt(jpeg('2025:12:27 16:50:25', false)), '2025-12-27')
  })
  it('skips segments before the Exif block', () => {
    assert.equal(exifTakenAt(jpeg('2024:06:01 09:00:00', false, { app0: true })), '2024-06-01')
  })
  it('is null without EXIF, without DateTimeOriginal, for a zero date, and for bytes that are not a JPEG', () => {
    assert.equal(exifTakenAt(jpeg(null, true)), null)
    assert.equal(exifTakenAt(jpeg('2025:12:27 16:50:25', true, { tag: 0x0132 })), null)   // DateTime is the file's write time, not "taken"
    assert.equal(exifTakenAt(jpeg('0000:00:00 00:00:00', true)), null)
    assert.equal(exifTakenAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), null)
    assert.equal(exifTakenAt(new ArrayBuffer(0)), null)
  })
  it('does not read past a truncated file', () => {
    assert.equal(exifTakenAt(jpeg('2025:12:27 16:50:25', true).slice(0, 40)), null)
  })
})

describe('the date line on a card', () => {
  const today = new Date(2026, 10, 3)
  it('names both dates when the photo was taken on another day', () => {
    assert.equal(datesLabel({ saved_at: '2026-11-03', taken_at: '2025-12-27' }, today), 'taken Dec 27, 2025 · saved Nov 3')
    assert.equal(datesLabel({ saved_at: '2026-11-03', taken_at: '2026-10-30' }, today), 'taken Oct 30 · saved Nov 3')
  })
  it('says saved alone without a capture date, or when it is the same day', () => {
    assert.equal(datesLabel({ saved_at: '2026-11-03' }, today), 'saved Nov 3')
    assert.equal(datesLabel({ saved_at: '2026-11-03', taken_at: '2026-11-03' }, today), 'saved Nov 3')
  })
  it('is the origin line of an own brick; a starter keeps its credit', () => {
    assert.equal(originLabel({ id: 'b_x', origin: 'own', saved_at: '2026-11-03', taken_at: '2025-12-27' }, today), 'taken Dec 27, 2025 · saved Nov 3')
    assert.equal(originLabel({ id: 'g2', origin: 'starter', saved_at: '2025-06-21', taken_at: '2025-06-01' }, today), 'starter · Malik Zhang, 2025')
  })
})
