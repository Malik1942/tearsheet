/** Shell item 3 (Malik, 2026-11-03 "3 then 1"): device details inside each phone frame. A status bar (9:41, signal, battery), a large title on the List,
 *  a bottom tab bar of three (list, chart, person) and a home indicator, colored from the skin. Rendered to a string with react-dom/server, set up as in
 *  staticrender.test.ts. Sizes, colors and the six contract rules are measured in a browser by scripts/shell-contract.test.ts. Run: npm test */
import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_PARAMS } from '../src/shell/params.ts'
import { PHONE, PHONE_H, PHONE_W } from '../src/shell/phone.ts'

;(globalThis as { React?: typeof React }).React = React
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: 'export default ""', shortCircuit: true }
    return nextLoad(url, context)
  },
})

let Shell: typeof import('../src/shell/Shell.tsx').Shell
let Device: typeof import('../src/shell/Device.tsx')
before(async () => { ({ Shell } = await import('../src/shell/Shell.tsx')); Device = await import('../src/shell/Device.tsx') })

const render = (screen: 'list' | 'review', staticRender = false) => renderToStaticMarkup(h(Shell, { params: DEFAULT_PARAMS, screen, staticRender }))
const tabs = (html: string) => [...html.matchAll(/<(button|span) [^>]*class="tab-item"[^>]*>[^]*?<span class="tab-label">([^<]*)<\/span>/g)].map(m => ({ tag: m[1], label: m[2], active: /data-active="true"/.test(m[0]) }))

describe('device details inside each phone frame', () => {
  it('draws a status bar at 9:41, a tab bar of three and a home indicator on both screens', () => {
    for (const screen of ['list', 'review'] as const) {
      const html = render(screen)
      assert.match(html, /<div class="status-bar"[^>]*><span class="status-time">9:41<\/span>/, screen)
      assert.match(html, /class="status-icons"[^]*?data-icon="signal"[^]*?data-icon="battery"/, screen)
      assert.equal(tabs(html).length, 3, screen)
      assert.match(html, /<div class="home-indicator" aria-hidden="true"><span><\/span><\/div><\/div>$/, screen)
    }
  })
  it('uses the three icons in a fixed order: list, chart, person', () => {
    assert.deepEqual([...render('list').matchAll(/class="tab-icon" data-icon="([a-z]+)"/g)].map(m => m[1]), ['list', 'chart', 'person'])
  })
  it('marks the list tab active on the List and the chart tab on the year review', () => {
    assert.deepEqual(tabs(render('list')).map(t => t.active), [true, false, false])
    assert.deepEqual(tabs(render('review')).map(t => t.active), [false, true, false])
  })
  it('gives the List a large title and no small bar title, so the title is said once; the year review keeps its bar title', () => {
    const list = render('list'), review = render('review')
    assert.match(list, /<h1 class="large-title">Shows<\/h1>/)
    assert.doesNotMatch(list, /bar-title/)
    assert.match(review, /<h1 class="bar-title">Year review<\/h1>/)
    assert.doesNotMatch(review, /large-title/)
  })
  it('on a centred screen the List title sits in the bar, with a hidden twin of the control on the empty side so it sits on the centre (Malik, 2026-11-03)', () => {
    const centred = { ...DEFAULT_PARAMS, alignment_edge: 'center' }
    const list = renderToStaticMarkup(h(Shell, { params: centred, screen: 'list' })), review = renderToStaticMarkup(h(Shell, { params: centred, screen: 'review' }))
    assert.match(list, /<h1 class="bar-title">Shows<\/h1>/)
    assert.doesNotMatch(list, /large-title/)
    assert.match(list, /<span class="bar-balance" aria-hidden="true"><span class="action">/, 'the twin is a span, never a second button')
    assert.equal((list.match(/<button class="action"/g) ?? []).length, 1, 'one real control')
    assert.match(review, /<span class="bar-balance" aria-hidden="true"><span class="bar-icon">/)
    assert.doesNotMatch(render('list'), /bar-balance/, 'a left-aligned bar has no twin')
  })
  it('never repeats a screen title in the tab bar', () => {
    const titles = ['shows', 'year review']
    for (const screen of ['list', 'review'] as const) for (const t of tabs(render(screen))) assert.equal(titles.includes(t.label.trim().toLowerCase()), false, t.label)
  })
  it('draws the tabs as buttons, and as spans with the same class in a static copy', () => {
    assert.deepEqual(tabs(render('list')).map(t => t.tag), ['button', 'button', 'button'])
    assert.deepEqual(tabs(render('list', true)).map(t => t.tag), ['span', 'span', 'span'])
    assert.doesNotMatch(render('review', true), /<button/)
  })
})

describe('the phone around a shell (device frame spec 2026-11-04)', () => {
  it('has an iPhone 15/16 Pro shape at 320 pt wide, measured off the hi-fi bezel: a 320 × 694 screen with 50 px corners in a 10 px bezel, 340 × 714 outside, and a 75 × 28 island 11 below the top', () => {
    assert.equal(PHONE.screenW, 320)
    assert.equal(PHONE.screenH, 694)
    assert.equal(PHONE.bezel, 10)
    assert.equal(PHONE.screenRadius, 50)
    assert.deepEqual([PHONE.islandW, PHONE.islandH, PHONE.islandTop], [75, 28, 11])
    assert.equal(PHONE_W, 340)
    assert.equal(PHONE_H, 714)
  })
  it('holds the shell in a screen and draws the island over it, hidden from assistive technology', () => {
    const html = renderToStaticMarkup(h(Device.PhoneFrame, null, h(Shell, { params: DEFAULT_PARAMS, screen: 'list', height: PHONE.screenH })))
    assert.match(html, /^<div class="phone"><div class="phone-screen"><div class="shell"[^]*<\/div><\/div><span class="phone-island" aria-hidden="true"><\/span><\/div>$/)
    assert.match(html, /--viewport-h:694px/)
  })
  it('a shell without the frame (a Library thumbnail) has no island', () => {
    assert.doesNotMatch(render('list'), /phone-island/)
  })
})
