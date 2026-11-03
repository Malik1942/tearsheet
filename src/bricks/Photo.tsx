import { useState, type ImgHTMLAttributes } from 'react'
import { SAMPLES } from '../fixtures/samples'
import { IDB } from '../lib/persist'

/** Licensed samples carry their credit everywhere, including thumbnails too small for a visible line. */
const CREDITS = new Map(SAMPLES.flatMap(b => (b.credit ? [[b.photo.url, b.credit] as const] : [])))

const WITHHELD = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#2a2a2a"/><text x="200" y="140" font-family="system-ui, sans-serif" font-size="18" fill="#bbb" text-anchor="middle">reference photo withheld</text><text x="200" y="168" font-family="system-ui, sans-serif" font-size="13" fill="#888" text-anchor="middle">downloaded material is not published with the repo</text></svg>`,
)}`

/** A reference photo that degrades honestly: if the file is not deployed, say so instead of showing a broken image.
 *  An `idb:` source is an own photo still on its way back from IndexedDB (or gone from this device): a plain dark box, never an <img>. */
export function Photo(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false)
  if (typeof props.src === 'string' && props.src.startsWith(IDB)) return <div className={props.className} style={{ background: '#2a2a2a', ...props.style }} role="img" aria-label={props.alt || 'Photo not loaded'} title={props.title} />
  const credit = typeof props.src === 'string' ? CREDITS.get(props.src) : undefined
  return <img {...props} src={failed ? WITHHELD : props.src} onError={() => setFailed(true)} alt={props.alt ?? ''} title={props.title ?? credit} />
}
