import { useEffect, useState } from 'react'
import { measurePixels, PX_PARAMS } from '../lib/pixels'
import { IDB } from '../lib/persist'
import { BOX, BRAND, pathOf, photoTear, type Tear } from './tear'

/** A photo's tear, read the way pixels.ts measures a photo: decoded by the browser, drawn with its long side at most PX_PARAMS.downsample, then its
 *  brightness down and across and its measured tone clusters (px-2). A cross-origin photo needs CORS; one that cannot be read gives no tear. */
async function tearOf(url: string): Promise<Tear> {
  const img = new Image()
  if (/^https?:/i.test(url)) img.crossOrigin = 'anonymous'
  img.src = url
  await img.decode()
  const s = Math.min(1, PX_PARAMS.downsample / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d canvas')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const rgba = ctx.getImageData(0, 0, w, h).data
  return photoTear(rgba, w, h, measurePixels(rgba, w, h).tone_clusters)
}

/** The Data tear of one photo (the share page: the project's first photo), drawn as the share card draws it. Nothing while it is read, nothing if
 *  it cannot be (a photo kept only on another device, a host without CORS). */
export function PhotoTear({ url, label, className }: { url: string; label: string; className?: string }) {
  const [read, setRead] = useState<{ url: string; tear: Tear } | null>(null)
  useEffect(() => {
    if (url.startsWith(IDB)) return
    let live = true
    tearOf(url).then(tear => { if (live) setRead({ url, tear }) }).catch(() => { /* unreadable: no tear */ })
    return () => { live = false }
  }, [url])
  const tear = read?.url === url ? read.tear : null
  if (!tear) return null
  return (
    <svg viewBox={`0 0 ${BOX} ${BOX}`} role="img" aria-label={label} className={className} style={{ display: 'block', flex: 'none' }}>
      {tear.rim && <path d={pathOf(tear.rim)} fill={BRAND.rimOnPaper} />}
      {tear.stripes.map(s => <path key={s.hex} d={pathOf(s.pts)} fill={s.hex} />)}
    </svg>
  )
}
