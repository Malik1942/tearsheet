/** Writes src/fixtures/borders.json: each starter's photo border ({ plain, color }, keyed by brick id), measured by the code that measures a photo at save
 *  (client.ts prepareImage, photoFit.ts) in a real browser, so a starter's tiles crop exactly as the same photo added by hand would. The extraction fixtures
 *  are not touched. Run after a starter photo changes: npm run borders */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { SAMPLES } from '../src/fixtures/samples/index.ts'

const OUT = new URL('../src/fixtures/borders.json', import.meta.url)
const photos = SAMPLES.map(b => ({ id: b.id, url: b.photo.url }))

const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), logLevel: 'error', server: { port: 0 } })
await server.listen()
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  // any same-origin page will do; a sample photo keeps the app itself from starting
  await page.goto(new URL(photos[0].url, server.resolvedUrls!.local[0]).href)
  // a string, so the import reaches the browser as written and Vite serves the app's own modules
  const borders = await page.evaluate(`(async photos => {
    const { prepareImage } = await import('/src/lib/client.ts')
    const out = {}
    for (const { id, url } of photos) {
      const blob = await fetch(url).then(r => r.blob())
      out[id] = (await prepareImage(new File([blob], url.split('/').pop(), { type: blob.type }))).border ?? null
    }
    return out
  })(${JSON.stringify(photos)})`) as Record<string, { plain: boolean; color: string } | null>
  const missing = photos.filter(p => !borders[p.id]).map(p => p.id)
  if (missing.length) throw new Error(`no border read for ${missing.join(', ')}`)
  writeFileSync(OUT, `${JSON.stringify(borders, null, 2)}\n`)
  for (const [id, b] of Object.entries(borders)) console.log(`${b!.plain ? 'plain' : '     '} ${b!.color}  ${id}`)
} finally {
  await browser.close()
  await server.close()
}
