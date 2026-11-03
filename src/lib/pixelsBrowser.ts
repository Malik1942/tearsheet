/** Browser glue for the pixel measurements (spec §1b): decode a photo, draw it onto a canvas with its long side at most PX_PARAMS.downsample, read the pixels, measure.
 *  The decoder and the scaler belong to the browser, so values are repeatable in one browser and may differ in the last digit between browsers;
 *  a canvas is sRGB, so a photo with another embedded profile is converted to sRGB by the browser before it is read. */
import { measurePixels, PX_PARAMS, type PixelFields } from './pixels'

/** The re-saved copies spec validation step 2 compares against the original. */
export type PhotoVariant = 'original' | 'white-balance' | 'jpeg-q50'
export const PHOTO_VARIANTS: PhotoVariant[] = ['original', 'white-balance', 'jpeg-q50']

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (/^https?:/i.test(url)) img.crossOrigin = 'anonymous'       // a cross-origin canvas read is blocked without it
    img.onload = () => (img.naturalWidth > 0 && img.naturalHeight > 0 ? resolve(img) : reject(new Error(`image has no size: ${url.slice(0, 80)}`)))
    img.onerror = () => reject(new Error(`could not load image: ${url.slice(0, 80)}`))
    img.src = url
  })
}

function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d canvas')
  return [canvas, ctx]
}

/** Downsample (never upscale) so the long side is at most PX_PARAMS.downsample, read the pixels and measure. */
function measureSource(source: CanvasImageSource, width: number, height: number): PixelFields {
  const scale = Math.min(1, PX_PARAMS.downsample / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale))
  const [, ctx] = canvasOf(w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  return measurePixels(ctx.getImageData(0, 0, w, h).data, w, h)
}

export async function measurePhoto(url: string): Promise<PixelFields> {
  const img = await loadImage(url)
  return measureSource(img, img.naturalWidth, img.naturalHeight)
}

/** Measure a re-saved copy of the photo, made at full size: a slight white-balance shift (R x 1.04, B x 0.96), or a JPEG re-encode at quality 0.5. */
export async function measurePhotoVariant(url: string, variant: PhotoVariant): Promise<PixelFields> {
  if (variant === 'original') return measurePhoto(url)
  const img = await loadImage(url)
  const [canvas, ctx] = canvasOf(img.naturalWidth, img.naturalHeight)
  ctx.drawImage(img, 0, 0)
  if (variant === 'white-balance') {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < data.data.length; i += 4) { data.data[i] = data.data[i] * 1.04; data.data[i + 2] = data.data[i + 2] * 0.96 }   // Uint8ClampedArray clamps and rounds
    ctx.putImageData(data, 0, 0)
    return measureSource(canvas, canvas.width, canvas.height)
  }
  const again = await loadImage(canvas.toDataURL('image/jpeg', 0.5))
  return measureSource(again, again.naturalWidth, again.naturalHeight)
}
