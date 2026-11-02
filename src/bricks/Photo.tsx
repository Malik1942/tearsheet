import { useState, type ImgHTMLAttributes } from 'react'

const WITHHELD = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#2a2a2a"/><text x="200" y="140" font-family="system-ui, sans-serif" font-size="18" fill="#bbb" text-anchor="middle">reference photo withheld</text><text x="200" y="168" font-family="system-ui, sans-serif" font-size="13" fill="#888" text-anchor="middle">downloaded material is not published with the repo</text></svg>`,
)}`

/** A reference photo that degrades honestly: if the file is not deployed, say so instead of showing a broken image. */
export function Photo(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false)
  return <img {...props} src={failed ? WITHHELD : props.src} onError={() => setFailed(true)} alt={props.alt ?? ''} />
}
