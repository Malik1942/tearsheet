/** Swap sheet §3 as rendered: caption, uppercase, muted group headers in order; a tile's two lines (13/500 ink, then 12 muted); a photo already in the
 *  project checked and not choosable. Rendered to a string with react-dom/server, set up as in staticrender.test.ts (React on the global, .css answered
 *  with an empty module). Expected values come from the spec (docs/superpowers/specs/2026-11-03-swap-sheet-design.md). Run: npm test */
import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import type { SwapGroup } from '../src/lib/swapSheet.ts'

;(globalThis as { React?: typeof React }).React = React
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: 'export default ""', shortCircuit: true }
    return nextLoad(url, context)
  },
})

let SwapPicker: typeof import('../src/make/Dialogs.tsx').SwapPicker
before(async () => { ({ SwapPicker } = await import('../src/make/Dialogs.tsx')) })

const sample = (id: string) => SAMPLES.find(b => b.id === id)!
const GROUPS: SwapGroup[] = [
  { id: 'same', title: 'Same job', tiles: [{ brick: sample('bauhaus-1923-staatliches-bauhaus-weimar'), inProject: false }] },
  { id: 'rest', title: 'Everything else', tiles: [{ brick: sample('g2'), inProject: true }, { brick: sample('jpl-2016-visions-mars'), inProject: false }] },
]
const render = (groups: SwapGroup[]) => renderToStaticMarkup(h(SwapPicker, { groups, onClose: () => {}, onPick: () => {} }))
/** Every tile button's opening tag (the Overlay's own Done button has no aria-label). */
const tiles = (html: string) => [...html.matchAll(/<button[^>]*aria-label="[^"]*"[^>]*>/g)].map(m => m[0])

describe('the swap sheet as rendered', () => {
  it('shows the groups in order under caption, uppercase, muted headers', () => {
    const heads = [...render(GROUPS).matchAll(/<h3 class="([^"]*)">([^<]*)<\/h3>/g)]
    assert.deepEqual(heads.map(m => m[2]), ['Same job', 'Everything else'])
    for (const [, cls] of heads) for (const c of ['caption', 'uppercase', 'ink-2']) assert.ok(cls.split(' ').includes(c), `${c} in "${cls}"`)
  })
  it('lays the tiles out two to a row, four from the sm breakpoint', () => {
    const grid = /<div class="grid ([^"]*)">/.exec(render(GROUPS))
    assert.ok(grid)
    assert.ok(grid[1].split(' ').includes('grid-cols-2') && grid[1].split(' ').includes('sm:grid-cols-4'), grid[1])
  })
  it('captions a tile as every card is captioned: its title, then its short credit (the classes are sized in tokens.css, caption.test.ts)', () => {
    const html = render(GROUPS)
    assert.match(html, /<span class="cap-title">Staatliches Bauhaus<\/span><span class="cap-line[^"]*">Mia, 1923<\/span>/)
    assert.match(html, /<span class="cap-title">Visions of the Future: Mars<\/span><span class="cap-line[^"]*">NASA\/JPL<\/span>/)
    assert.equal(html.includes('Malik'), false)
  })
  it('checks a photo already in the project and does not let it be chosen; the others can be', () => {
    const html = render(GROUPS)
    const [bauhaus, g2, jpl] = tiles(html)
    assert.equal(tiles(html).length, 3)
    assert.match(g2, / disabled=""/)
    assert.match(g2, /aria-label="[^"]*: Already in this project"/)
    for (const t of [bauhaus, jpl]) { assert.doesNotMatch(t, / disabled=""/); assert.match(t, /aria-label="Swap in: /) }
    assert.equal(html.split('✓').length - 1, 1)
  })
  it('says there is nothing to swap in only when no tile can be chosen', () => {
    assert.equal(render(GROUPS).includes('No other photo to swap in.'), false)
    assert.equal(render([{ id: 'rest', title: 'Everything else', tiles: [{ brick: sample('g2'), inProject: true }] }]).includes('No other photo to swap in.'), true)
  })
})
