/** Fix round C11/C12/C6, items 1 and 4: a mini-preview is a picture, so it holds no interactive element (it sits inside a tile button and inside a link), and a sheet row's peek trigger is a real button.
 *  Rendered to a string with react-dom/server. The components are plain TSX: the root tsconfig has no JSX setting for tsx to read, so React is put on the global before they load,
 *  and shell.css (imported by Shell) is answered with an empty module. This file is .ts, so elements are built with createElement. Run: npm test */
import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { resolveProject } from '../src/lib/mapRelations.ts'
import { DEFAULT_PARAMS } from '../src/shell/params.ts'

// the classic JSX transform tsx falls back to calls React.createElement; src is written for the automatic one
;(globalThis as { React?: typeof React }).React = React
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: 'export default ""', shortCircuit: true }
    return nextLoad(url, context)
  },
})

const INTERACTIVE = /<(button|a|input|select|textarea)[\s>/]/i

let MiniPreview: typeof import('../src/shell/MiniPreview.tsx').MiniPreview
let Shell: typeof import('../src/shell/Shell.tsx').Shell
let Row: typeof import('../src/compose/Sheet.tsx').Row
before(async () => {
  ;({ MiniPreview } = await import('../src/shell/MiniPreview.tsx'))
  ;({ Shell } = await import('../src/shell/Shell.tsx'))
  ;({ Row } = await import('../src/compose/Sheet.tsx'))
})

describe('MiniPreview holds no interactive element', () => {
  it('has no button, link or input in the string it renders', () => {
    const html = renderToStaticMarkup(h(MiniPreview, { params: DEFAULT_PARAMS, width: 130, badge: 2 }))
    assert.doesNotMatch(html, INTERACTIVE)
    assert.doesNotMatch(html, /tabindex|role="button"/i)
  })
  it('still draws the top bar control, as a span with the same class', () => {
    const html = renderToStaticMarkup(h(MiniPreview, { params: DEFAULT_PARAMS }))
    assert.match(html, /<span class="action"><svg class="icon"/)
    assert.match(renderToStaticMarkup(h(MiniPreview, { params: { ...DEFAULT_PARAMS, accent_placement: 'actions' } })), /<span class="action"><svg class="icon"[^]*?<\/svg>Add show<\/span>/)
  })
  it('does so for every accent placement and grouping, since each lays the control out differently', () => {
    for (const accent_placement of ['none', 'labels', 'actions', 'dividers', 'one-hero']) {
      for (const grouping of ['none', 'by-time', 'by-place', 'by-tag']) {
        const html = renderToStaticMarkup(h(MiniPreview, { params: { ...DEFAULT_PARAMS, accent_placement, grouping } }))
        assert.doesNotMatch(html, INTERACTIVE, `${accent_placement} ${grouping}`)
      }
    }
  })
})

describe('Shell staticRender', () => {
  it('renders both screens without an interactive element', () => {
    for (const screen of ['list', 'review'] as const) {
      assert.doesNotMatch(renderToStaticMarkup(h(Shell, { params: DEFAULT_PARAMS, screen, staticRender: true })), INTERACTIVE, screen)
    }
  })
  it('leaves the top bar controls real buttons when staticRender is off (the Compose shells are live)', () => {
    assert.match(renderToStaticMarkup(h(Shell, { params: DEFAULT_PARAMS, screen: 'list' })), /<button class="action" type="button" aria-label="Add show">/)
    assert.match(renderToStaticMarkup(h(Shell, { params: { ...DEFAULT_PARAMS, accent_placement: 'actions' }, screen: 'list' })), /<button class="action" type="button"><svg class="icon"[^]*?<\/svg>Add show<\/button>/)
    assert.match(renderToStaticMarkup(h(Shell, { params: DEFAULT_PARAMS, screen: 'review' })), /<button class="bar-icon" type="button" aria-label="Share">/)
    assert.doesNotMatch(renderToStaticMarkup(h(Shell, { params: DEFAULT_PARAMS, screen: 'list', staticRender: false })), /<span class="action"/)
  })
  it('draws no per-row Details button on either screen (design pass A3: the whole row is the target)', () => {
    for (const screen of ['list', 'review'] as const) for (const staticRender of [true, false]) {
      const html = renderToStaticMarkup(h(Shell, { params: { ...DEFAULT_PARAMS, accent_placement: 'actions' }, screen, staticRender }))
      assert.doesNotMatch(html, /Details/, `${screen} ${staticRender}`)
      assert.equal((html.match(/class="(action|bar-icon)"/g) ?? []).length, 1, `one top bar control on ${screen}`)
    }
  })
})

describe('PhotoPeek', () => {
  it('draws the region with the chrome .region box and .idtag (the trace token on a white halo), not a copy of a color', () => {
    const src = readFileSync(new URL('../src/compose/PhotoPeek.tsx', import.meta.url), 'utf8')
    assert.match(src, /className="region"/)
    assert.match(src, /className="idtag"/)
    assert.doesNotMatch(src, /rgba\(200, ?80, ?42|#2338E8|#C8502A/i)
  })
})

describe('Sheet Row peek trigger (C12)', () => {
  const calm = SAMPLES.find(b => b.id === 'calmmouse')!
  const project = (brickIds: string[]) => ({ id: 'r', intent: '', createdAt: '', brickIds, disabled: {}, choice: {}, locks: {}, manual: {} })
  const resolved = resolveProject(project(['calmmouse']), SAMPLES)
  const row = () => renderToStaticMarkup(h(Row, { k: 'type_scale_ratio', pv: resolved.values.type_scale_ratio, params: resolved.params, bricks: SAMPLES, thumb: calm.photo.url }))

  it('a row with a source brick is not itself a button: no role, no tabindex', () => {
    const html = row()
    assert.doesNotMatch(html, /role="button"/)
    assert.doesNotMatch(html, /tabindex/i)
  })
  it('its 16 px source thumbnail is one real button with aria-expanded and a label that names the key and the brick', () => {
    const html = row()
    const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map(m => m[0])
    assert.equal(buttons.length, 1)
    assert.match(buttons[0], /type="button"/)
    assert.match(buttons[0], /aria-expanded="false"/)
    assert.match(buttons[0], /aria-label="Show where type_scale_ratio was read on calmmouse(?:'|&#x27;)s photo"/)
    assert.match(html, /<button\b[^>]*><img\b[^>]*class="[^"]*\bh-4\b[^"]*\bw-4\b/)
  })
  it('the provenance chip link stays a link outside the button', () => {
    const html = row()
    const button = html.match(/<button\b[\s\S]*?<\/button>/)![0]
    assert.doesNotMatch(button, /<a\b/)
    assert.match(html, /<a href="\/brick\/calmmouse#/)
  })
  it('the flash tint is set and removed with no fade, so it lasts as long as the outline on the shell', () => {
    const on = renderToStaticMarkup(h(Row, { k: 'type_scale_ratio', pv: resolved.values.type_scale_ratio, params: resolved.params, bricks: SAMPLES, thumb: calm.photo.url, flash: true }))
    assert.match(on, /background:color-mix\(in oklab, ?var\(--accent\) 14%, ?transparent\)/)
    assert.doesNotMatch(on, /transition|duration-/)
    assert.doesNotMatch(row(), /background:color-mix/)
  })
  it('a row with no source brick has no button at all', () => {
    const none = resolveProject(project([]), SAMPLES)
    const html = renderToStaticMarkup(h(Row, { k: 'radius', pv: none.values.radius, params: none.params, bricks: SAMPLES }))
    assert.doesNotMatch(html, /<button/)
  })
})
