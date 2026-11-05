/** The brand build (Data tear): writes every static brand file from src/brand/tear.ts and the board's geometry (src/brand/board.ts), then draws the PNGs
 *  in a headless browser (playwright-core; the tagline needs Archivo from Google Fonts). Run after changing either: `npm run brand`. Its output is
 *  committed, so the site's own build never runs it.
 *    public/brand/   the master mark, the 32 and 16 px marks, the lockup on paper, on ultramarine and on ink, the default share image, the README
 *                    banner and the video title card
 *    public/         favicon.svg (the 32 px mark, white in a dark tab strip), favicon-16.png, favicon-32.png
 *    public/icons/   the home-screen icons: the ultramarine tile, a white page with a light-blue rim
 *    src/brand/staticMarks.ts   the header's mark, as a path */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { BOX, BRAND, buildTear, easeEdges, MARK_16, pagePolygon, pathOf, rimPolygon, RIM_DEPTH, tearSvg, toothedEdges } from '../src/brand/tear'
import { LOCKUP_LETTERS, LOCKUP_MARK_EDGES, LOCKUP_NAME_RIM, LOCKUP_VIEWBOX, MASTER_EDGES } from '../src/brand/board'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core') as typeof import('playwright-core')
const ROOT = new URL('..', import.meta.url).pathname
const out = (p: string) => ROOT + p

// ---- the shapes
const master = easeEdges(MASTER_EDGES)
const masterTear = buildTear(master, [{ hex: BRAND.ink, share: 1 }])
const toothed = toothedEdges(master, 10)
const toothedPage = pagePolygon(toothed)
/** The lockup's mark, its own tear from the board, eased the same way; its rim scaled from the 104 box by the mark's size in the lockup. */
const LOCKUP_SCALE = 6.5
const lockupMark = easeEdges(LOCKUP_MARK_EDGES)
const lockupPage = pagePolygon(lockupMark), lockupRim = rimPolygon(lockupMark, RIM_DEPTH * LOCKUP_SCALE)

/** The full lockup (240 px and wider): the rim under the mark and the name, then the mark and the bitten letters. Transparent; colored for its ground. */
const lockupSvg = (page: string, rim: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="145" viewBox="${LOCKUP_VIEWBOX}" role="img" aria-label="Tearsheet">` +
  `<path d="${pathOf(lockupRim)} ${LOCKUP_NAME_RIM}" fill="${rim}"/><path d="${pathOf(lockupPage)} ${LOCKUP_LETTERS}" fill="${page}"/></svg>`
const GROUNDS = { paper: { page: BRAND.ink, rim: BRAND.rimOnPaper, ground: BRAND.paper }, ultramarine: { page: BRAND.paper, rim: BRAND.rimOnUltramarine, ground: BRAND.ultramarine }, ink: { page: BRAND.paper, rim: BRAND.rimOnInk, ground: BRAND.ink } } as const
const [, , VBW, VBH] = LOCKUP_VIEWBOX.split(' ').map(Number)

/** The 32 px mark's box: the 104-unit box drawn at 32 px is 3.25 units a pixel; starting it one pixel early puts the page's straight top and left
 *  edges on whole pixels (no grey half-pixel row), with the teeth in the room left at the right and bottom. */
const MARK32_VIEWBOX = `-3.25 -3.25 ${BOX} ${BOX}`
const mark32 = (fill: string, dark = false) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK32_VIEWBOX}">` +
  (dark ? `<style>path{fill:${fill}}@media (prefers-color-scheme:dark){path{fill:${BRAND.paper}}}</style>` : '') + `<path d="${pathOf(toothedPage)}" fill="${fill}"/></svg>`
const mark16 = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="${pathOf(MARK_16)}" fill="${fill}"/></svg>`
/** The home-screen tile: ultramarine, the master mark as a white page with a light-blue rim, the 104 box at `mark` of the tile (the board: 112 of 180).
 *  Centred on the mark as drawn (page and rim), not on its box: the box leaves room for the tear at the right and bottom only, so centring the box
 *  sets the page up and to the left. */
const markBounds = (() => { const xs = masterTear.rim!.map(p => p[0]), ys = masterTear.rim!.map(p => p[1]); return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 } })()
const tile = (size: number, mark: number, radius: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
  `<rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND.ultramarine}"/>` +
  `<g transform="translate(${(size / 2 - (markBounds.cx * mark) / BOX).toFixed(2)} ${(size / 2 - (markBounds.cy * mark) / BOX).toFixed(2)}) scale(${mark / BOX})"><path d="${pathOf(masterTear.rim!)}" fill="${BRAND.rimOnUltramarine}"/><path d="${pathOf(masterTear.page)}" fill="${BRAND.paper}"/></g></svg>`

// ---- the SVG files
mkdirSync(out('public/brand'), { recursive: true })
const svgs: Record<string, string> = {
  'public/brand/mark.svg': tearSvg(masterTear, { page: BRAND.ink, label: 'Tearsheet' }),
  'public/brand/mark-on-ultramarine.svg': tearSvg(masterTear, { page: BRAND.paper, rim: BRAND.rimOnUltramarine, label: 'Tearsheet' }),
  'public/brand/mark-32.svg': mark32(BRAND.ink),
  'public/brand/mark-16.svg': mark16(BRAND.ink),
  'public/brand/lockup-on-paper.svg': lockupSvg(GROUNDS.paper.page, GROUNDS.paper.rim),
  'public/brand/lockup-on-ultramarine.svg': lockupSvg(GROUNDS.ultramarine.page, GROUNDS.ultramarine.rim),
  'public/brand/lockup-on-ink.svg': lockupSvg(GROUNDS.ink.page, GROUNDS.ink.rim),
  // the board's ultramarine banner (600 x 120, lockup 420 wide) at twice the size, the lockup centered both ways (it was 36 in from the left, 2026-11-04)
  'public/brand/readme-banner.svg': `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240" role="img" aria-label="Tearsheet"><rect width="1200" height="240" fill="${BRAND.ultramarine}"/>` +
    `<svg x="${(1200 - 840) / 2}" y="${(240 - (840 * VBH) / VBW) / 2}" width="840" height="${(840 * VBH) / VBW}" viewBox="${LOCKUP_VIEWBOX}"><path d="${pathOf(lockupRim)} ${LOCKUP_NAME_RIM}" fill="${BRAND.rimOnUltramarine}"/><path d="${pathOf(lockupPage)} ${LOCKUP_LETTERS}" fill="${BRAND.paper}"/></svg></svg>`,
  'public/favicon.svg': mark32(BRAND.ink, true),
}
for (const [p, s] of Object.entries(svgs)) writeFileSync(out(p), s + '\n')

// the header's mark: the 32 px mark (three teeth, no rim) in the lockup's units, beside the name set in Archivo (src/brand/Lockup.tsx)
writeFileSync(out('src/brand/staticMarks.ts'), `/** Written by scripts/brand.ts (npm run brand); do not edit. The header's mark: the master tear smoothed to three teeth a side, no rim, in the
 *  lockup's units (the page's top-left at 0,0; the name's letters start at x 768). */
export const HEADER_MARK = '${pathOf(toothedPage, LOCKUP_SCALE)}'
`)

// ---- the PNGs
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">'
const browser = await chromium.launch()
async function png(body: string, w: number, h: number, path: string, transparent = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.setContent(`<!doctype html><html><head>${FONTS}<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${transparent ? 'transparent' : '#fff'}}svg{display:block}</style></head><body>${body}</body></html>`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: out(path), omitBackground: transparent })
  await page.close()
}
const sized = (svg: string, w: number, h: number) => svg.replace(/ width="[\d.]+" height="[\d.]+"/, '').replace('<svg ', `<svg width="${w}" height="${h}" `)

await png(sized(svgs['public/favicon.svg'].replace(/<style>.*<\/style>/, ''), 32, 32), 32, 32, 'public/favicon-32.png', true)
await png(sized(svgs['public/brand/mark-16.svg'], 16, 16), 16, 16, 'public/favicon-16.png', true)
await png(tile(180, 112, 0), 180, 180, 'public/icons/apple-touch-icon.png')            // iOS rounds the corners itself
await png(tile(192, 119.5, 42.7), 192, 192, 'public/icons/icon-192.png', true)         // the board's tile: radius 40 of 180
await png(tile(512, 318.6, 113.8), 512, 512, 'public/icons/icon-512.png', true)
await png(tile(512, 264, 0), 512, 512, 'public/icons/icon-512-maskable.png')           // full bleed; the mark inside the 80 % safe circle
// the default share image: the master lockup on ultramarine
const ogW = 720, ogH = (ogW * VBH) / VBW
await png(`<div style="width:1200px;height:630px;background:${BRAND.ultramarine};display:flex;align-items:center;justify-content:center">${sized(svgs['public/brand/lockup-on-ultramarine.svg'], ogW, ogH)}</div>`, 1200, 630, 'public/brand/og-default.png')
await png(svgs['public/brand/readme-banner.svg'], 1200, 240, 'public/brand/readme-banner.png')
// the video title card: the board's primary lockup frame (1440 x 810: lockup 1120 wide, Archivo 600) at 1920 x 1080. The tagline is larger than the
// board's 30/36 scaled (40/48), which read as a footnote under 200 px letters (Malik, 2026-11-04): 56/64, 80 below the lockup
const tcW = 1493
await png(`<div style="width:1920px;height:1080px;background:${BRAND.paper};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:80px">` +
  `${sized(svgs['public/brand/lockup-on-paper.svg'], tcW, (tcW * VBH) / VBW)}<p style="margin:0;font-family:Archivo,'Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:56px;line-height:64px;color:${BRAND.ink}">${BRAND.tagline}</p></div>`,
  1920, 1080, 'public/brand/title-card.png')
await browser.close()
console.log('brand: wrote', Object.keys(svgs).length, 'SVGs, 9 PNGs and src/brand/staticMarks.ts')
