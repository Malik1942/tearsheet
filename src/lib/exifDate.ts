/** The date a photo was taken, from its JPEG's EXIF DateTimeOriginal (tag 0x9003 in the Exif IFD). Pure; no library.
 *  Only that tag is read: DateTime (0x0132) is when the file was last written, and a file's lastModified can be the
 *  day it was copied, so neither stands in for "taken". Returns `YYYY-MM-DD`, or null when the bytes carry no such date. */
export function exifTakenAt(bytes: ArrayBuffer): string | null {
  const v = new DataView(bytes)
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null   // not a JPEG
  let p = 2
  while (p + 4 <= v.byteLength) {
    if (v.getUint8(p) !== 0xff) return null
    const marker = v.getUint8(p + 1)
    if (marker === 0xda || marker === 0xd9) return null   // image data starts; EXIF comes before it
    const len = v.getUint16(p + 2)
    if (marker === 0xe1 && p + 10 <= v.byteLength && v.getUint32(p + 4) === 0x45786966 && v.getUint16(p + 8) === 0) {   // "Exif\0\0"
      return fromTiff(v, p + 10, Math.min(v.byteLength, p + 2 + len))
    }
    p += 2 + len
  }
  return null
}

function fromTiff(v: DataView, t: number, end: number): string | null {
  if (t + 8 > end) return null
  const order = v.getUint16(t)
  if (order !== 0x4949 && order !== 0x4d4d) return null
  const le = order === 0x4949
  const u16 = (o: number) => v.getUint16(o, le), u32 = (o: number) => v.getUint32(o, le)
  /** The value offset of `tag` in the IFD at `ifd` (relative to the TIFF header), or null. */
  const find = (ifd: number, tag: number): number | null => {
    const at = t + ifd
    if (at + 2 > end) return null
    const n = u16(at)
    for (let i = 0; i < n; i++) {
      const e = at + 2 + i * 12
      if (e + 12 > end) return null
      if (u16(e) === tag) return e + 8
    }
    return null
  }
  const exifPtr = find(u32(t + 4), 0x8769)
  if (exifPtr === null) return null
  const dto = find(u32(exifPtr), 0x9003)
  if (dto === null) return null
  const at = t + u32(dto)
  if (at + 10 > end) return null
  let s = ''
  for (let i = 0; i < 10; i++) s += String.fromCharCode(v.getUint8(at + i))
  const m = /^(\d{4}):(\d{2}):(\d{2})$/.exec(s)
  if (!m || m[1] === '0000') return null
  const month = Number(m[2]), day = Number(m[3])
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? `${m[1]}-${m[2]}-${m[3]}` : null
}
