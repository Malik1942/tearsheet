/** The layout contract, measured on the rendered DOM (src/shell/contract.ts sets the parameters; this checks the screen that results).
 *  Runs in the browser on one rendered `.shell`: the dev page /dev/contract exposes it, and scripts/shell-contract.test.ts calls it for
 *  every three-brick composition of the sample library. Reads layout only: no parameter, no measurement of a brick. */

export type RuleId = 'one-axis' | 'spacing-scale' | 'type-sizes' | 'readable-item' | 'no-duplicates' | 'no-text-in-thumbnails'
export const RULES: Record<RuleId, string> = {
  'one-axis': 'one alignment axis',
  'spacing-scale': 'spacing scale',
  'type-sizes': 'three type sizes',
  'readable-item': 'readable item',
  'no-duplicates': 'no duplicated information',
  'no-text-in-thumbnails': 'no text in thumbnails',
}
/** The spacing steps at an 8 px spacing unit; a unit of u px multiplies each by u / 8. */
export const SCALE_AT_8 = [4, 8, 12, 16, 24, 32, 48] as const
export const MAX_BAND = 24
export const MIN_TEXT_EM = 9
export const MIN_TARGET = 44
export const MAX_SIZES = 3

export type Violation = { rule: RuleId; magnitude: number; detail: string }

const visible = (el: Element | null): el is HTMLElement => {
  if (!el) return false
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
  return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0
}
const px = (v: string) => parseFloat(v) || 0
const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol
const label = (el: Element) => (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/)[0] : el.tagName.toLowerCase())

/** The edge a block of text hugs: left, center or right, with start and end read through the element's direction. */
function edgeOf(el: HTMLElement): 'left' | 'center' | 'right' {
  const cs = getComputedStyle(el)
  const rtl = cs.direction === 'rtl'
  switch (cs.textAlign) {
    case 'center': case '-webkit-center': return 'center'
    case 'right': case '-webkit-right': return 'right'
    case 'end': return rtl ? 'left' : 'right'
    case 'start': return rtl ? 'right' : 'left'
    default: return 'left'
  }
}

export function measureShell(shell: HTMLElement, screen: 'list' | 'review' | 'board', year = '2025'): Violation[] {
  const out: Violation[] = []
  const unit = px(getComputedStyle(shell).getPropertyValue('--space')) || 8
  const scale = [0, ...SCALE_AT_8.map(s => s * unit / 8)]
  const onScale = (v: number) => scale.some(s => near(v, s, 0.6))
  const top = shell.getBoundingClientRect().top, bottom = top + shell.clientHeight
  const inView = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return r.bottom > top && r.top < bottom }
  const all = <T extends Element = HTMLElement>(sel: string) => Array.from(shell.querySelectorAll<T & HTMLElement>(sel)).filter(visible)

  // 1. one alignment axis: every heading and title on the screen hugs the same edge; under center no list thumbnail sits beside or below its text
  const heads = all('.bar-title, .large-title, .screen-title, .group-title, .item .title, .row .title, .feature .title, .tile .label')
  const edges = new Map<string, string[]>()
  for (const h of heads) { const e = edgeOf(h); edges.set(e, [...(edges.get(e) ?? []), label(h)]) }
  if (edges.size > 1) out.push({ rule: 'one-axis', magnitude: edges.size - 1, detail: [...edges].map(([e, ls]) => `${e}: ${[...new Set(ls)].join(' ')}`).join('; ') })
  // a centred title must sit on the screen's centre, not only be set to center: a column beside it (a hidden poster's) moves its centre off the axis
  if (shell.dataset.align === 'center') {
    const box = shell.getBoundingClientRect(), mid = box.left + shell.clientWidth / 2
    const off = heads.filter(h => edgeOf(h) === 'center').map(h => { const r = h.getBoundingClientRect(); return { h, d: Math.round((r.left + r.right) / 2 - mid) } }).filter(o => Math.abs(o.d) > 2)
    if (off.length) out.push({ rule: 'one-axis', magnitude: off.length, detail: `${off.length} centred titles off the screen's centre: ${[...new Set(off.map(o => `${label(o.h)} ${o.d > 0 ? '+' : ''}${o.d}px`))].slice(0, 4).join(', ')}` })
  }
  if (screen === 'list' && shell.dataset.align === 'center') {
    const beside = all('.item').filter(item => {
      const pic = item.querySelector('.pic'), text = item.querySelector('.text')
      return visible(pic) && visible(text) && pic.getBoundingClientRect().bottom > text.getBoundingClientRect().top + 1
    })
    if (beside.length) out.push({ rule: 'one-axis', magnitude: beside.length, detail: `${beside.length} list thumbnails beside or below their centered text` })
  }

  // 2. spacing only from the scale (× spacing_unit); inside an item title → meta 4, meta → next 8, item padding 16–32
  const off: string[] = []
  const check = (el: HTMLElement, props: (keyof CSSStyleDeclaration)[]) => {
    const cs = getComputedStyle(el)
    for (const p of props) { const v = px(String(cs[p])); if (!onScale(v)) off.push(`${label(el)} ${String(p)} ${v.toFixed(1)}`) }
  }
  // the device details (item 3) are held to the same scale: the status bar, the large title, the tab bar and the home indicator, and the gaps inside them
  for (const el of all('.bar, .item, .row, .group-title, .review-head, .feature, .large-title, .status-bar, .tab-bar, .home-indicator, .tiles, .tile')) check(el, ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'])
  for (const el of all('.item, .row, .stats, .status-icons, .tab-item, .tiles, .tile')) check(el, ['columnGap', 'rowGap'])
  for (const el of all('.item .text')) check(el, ['paddingLeft', 'paddingRight'])
  // a board's tile is held to the item's padding (16–32) and gaps (label → value 4, then 8)
  for (const tile of all('.tile')) {
    const pad = px(getComputedStyle(tile).paddingTop)
    if (![16, 24, 32].some(s => near(pad, s * unit / 8, 0.6))) off.push(`.tile padding ${pad.toFixed(1)} (not 16–32)`)
    const kids = ['.label', '.value', '.note', '.tags'].map(s => tile.querySelector<HTMLElement>(s)).filter(visible)
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect(), b = kids[i].getBoundingClientRect()
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) <= 0) continue   // side by side (the value at the right of a row or a split tile): no vertical gap to hold to the scale
      const gap = b.top - a.bottom, want = i === 1 ? 4 : 8
      if (!near(gap, want * unit / 8)) off.push(`${label(kids[i - 1])} → ${label(kids[i])} ${gap.toFixed(1)} (want ${want * unit / 8})`)
    }
  }
  for (const item of all('.item')) {
    const pad = px(getComputedStyle(item).paddingTop)
    if (![16, 24, 32].some(s => near(pad, s * unit / 8, 0.6))) off.push(`.item padding ${pad.toFixed(1)} (not 16–32)`)
    const kids = ['.title', '.meta', '.note', '.tags'].map(s => item.querySelector<HTMLElement>(s)).filter(visible)
    for (let i = 1; i < kids.length; i++) {
      const gap = kids[i].getBoundingClientRect().top - kids[i - 1].getBoundingClientRect().bottom
      const want = i === 1 ? 4 : 8
      if (!near(gap, want * unit / 8)) off.push(`${label(kids[i - 1])} → ${label(kids[i])} ${gap.toFixed(1)} (want ${want * unit / 8})`)
    }
  }
  if (off.length) out.push({ rule: 'spacing-scale', magnitude: off.length, detail: [...new Set(off)].slice(0, 6).join('; ') })

  // 3. at most three type sizes visible on the screen
  const sizes = new Set<number>()
  const walker = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement
    if (!n.textContent?.trim() || !el || !visible(el) || !inView(el)) continue
    sizes.add(Math.round(px(getComputedStyle(el).fontSize) * 4) / 4)
  }
  if (sizes.size > MAX_SIZES) out.push({ rule: 'type-sizes', magnitude: sizes.size - MAX_SIZES, detail: [...sizes].sort((a, b) => b - a).map(s => `${s}px`).join(' ') })

  // 4. a readable item: no empty band over 24 px inside a list item, a text column of at least 9em, tap targets of at least 44 px
  const bad: string[] = []
  let worstBand = 0
  for (const item of all('.item')) {
    const r = item.getBoundingClientRect(), cs = getComputedStyle(item)
    const from = r.top + px(cs.paddingTop) + px(cs.borderTopWidth), to = r.bottom - px(cs.paddingBottom)
    const spans = ['.pic', '.title', '.meta', '.note', '.tags'].map(s => item.querySelector<HTMLElement>(s)).filter(visible)
      .map(el => el.getBoundingClientRect()).map(b => [Math.max(from, b.top), Math.min(to, b.bottom)] as const).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])
    let at = from, band = 0
    for (const [a, b] of spans) { band = Math.max(band, a - at); at = Math.max(at, b) }
    band = Math.max(band, to - at)
    if (band > MAX_BAND) { worstBand = Math.max(worstBand, band); bad.push(`empty band ${band.toFixed(0)}px`) }
    const text = item.querySelector<HTMLElement>('.text')
    if (visible(text)) {
      const tcs = getComputedStyle(text), w = text.clientWidth - px(tcs.paddingLeft) - px(tcs.paddingRight)
      if (w < MIN_TEXT_EM * px(tcs.fontSize) - 1) bad.push(`text column ${w.toFixed(0)}px < 9em`)
    }
  }
  // a tile: no empty band over 24 px between what it holds, a text column of 9em at its label's size (its text is caption-size, the value aside), at least 44 px tall
  for (const tile of all('.tile')) {
    const r = tile.getBoundingClientRect(), cs = getComputedStyle(tile)
    const from = r.top + px(cs.paddingTop) + px(cs.borderTopWidth), to = r.bottom - px(cs.paddingBottom) - px(cs.borderBottomWidth)
    const spans = ['.pic', '.label', '.value', '.note', '.tags'].map(s => tile.querySelector<HTMLElement>(s)).filter(visible)
      .map(el => el.getBoundingClientRect()).map(b => [Math.max(from, b.top), Math.min(to, b.bottom)] as const).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])
    let at = from, band = 0
    for (const [a, b] of spans) { band = Math.max(band, a - at); at = Math.max(at, b) }
    band = Math.max(band, to - at)
    if (band > MAX_BAND) { worstBand = Math.max(worstBand, band); bad.push(`tile empty band ${band.toFixed(0)}px`) }
    const lab = tile.querySelector<HTMLElement>('.label')
    if (visible(lab)) {
      const w = tile.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight)
      if (w < MIN_TEXT_EM * px(getComputedStyle(lab).fontSize) - 1) bad.push(`tile text column ${w.toFixed(0)}px < 9em`)
    }
  }
  for (const el of all('.tile')) if (el.getBoundingClientRect().height < MIN_TARGET - 0.5) bad.push(`${label(el)} ${el.getBoundingClientRect().height.toFixed(0)}px tall`)
  for (const el of all('.item, .row')) if (el.getBoundingClientRect().height < MIN_TARGET - 0.5) bad.push(`${label(el)} ${el.getBoundingClientRect().height.toFixed(0)}px tall`)
  // a screen's titles are read whole: none is cut with an ellipsis or clipped (a written title can be longer than the concert log's)
  for (const el of all('.bar-title, .large-title, .screen-title')) if (el.scrollWidth > el.clientWidth + 1) bad.push(`${label(el)} cut: "${el.textContent?.trim()}"`)
  for (const el of all('button, a, [role="button"], .action, .bar-icon')) {
    const b = el.getBoundingClientRect()
    if (b.width < MIN_TARGET - 0.5 || b.height < MIN_TARGET - 0.5) bad.push(`${label(el)} target ${b.width.toFixed(0)}×${b.height.toFixed(0)}`)
  }
  if (bad.length) out.push({ rule: 'readable-item', magnitude: bad.length + worstBand / 24, detail: [...new Set(bad)].slice(0, 6).join('; ') })

  // 5. no duplicated information: no tab label repeats a title on the screen (item 3), and the year appears once on the year review, in its head
  const titles = new Set(all('.bar-title, .large-title, .screen-title').map(t => t.textContent?.trim().toLowerCase()))
  const echoed = all('.tab-label').map(t => t.textContent?.trim() ?? '').filter(t => titles.has(t.toLowerCase()))
  if (echoed.length) out.push({ rule: 'no-duplicates', magnitude: echoed.length, detail: `tab label repeats the title: ${echoed.join(', ')}` })
  if (screen === 'review') {
    let n = 0
    const w = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT)
    for (let t = w.nextNode(); t; t = w.nextNode()) if (t.textContent?.includes(year) && visible(t.parentElement)) n++
    const inHead = shell.querySelector('.review-head')?.textContent?.includes(year)
    if (n !== 1 || !inHead) out.push({ rule: 'no-duplicates', magnitude: Math.abs(n - 1) || 1, detail: `"${year}" appears ${n} time(s)${inHead ? '' : ', not in the head'}` })
  }

  // 6. no text inside thumbnails: a placeholder is a flat block, no image, no glyph
  const texty = all('.pic').filter(p => p.querySelector('img, svg, canvas') || p.textContent?.trim())
  if (texty.length) out.push({ rule: 'no-text-in-thumbnails', magnitude: texty.length, detail: `${texty.length} thumbnails hold an image or text` })

  return out
}
