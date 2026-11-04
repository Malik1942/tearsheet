/** Make's headline is its input (Malik, 2026-11-03: affordance over signifiers): the question is the placeholder, set in the h1's own box; the round arrow
 *  appears only with text and is never disabled; while proposing it goes and the reading line runs. Rendered to a string with react-dom/server, set up as in
 *  staticrender.test.ts (React on the global, .css answered with an empty module). Run: npm test */
import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

;(globalThis as { React?: typeof React }).React = React
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: 'export default ""', shortCircuit: true }
    return nextLoad(url, context)
  },
})

let HeadlineField: typeof import('../src/make/Start.tsx').HeadlineField
before(async () => { ({ HeadlineField } = await import('../src/make/Start.tsx')) })

const render = (value: string, busy = false) => renderToStaticMarkup(h(HeadlineField, { value, busy, label: 'What are you making?', onChange: () => {}, onSubmit: () => {} }))

describe('the headline is the input', () => {
  it('asks the question as its placeholder, inside the h1 box, with nothing else when empty', () => {
    const html = render('')
    assert.match(html, /^<div class="intent-headline headline-field">/)
    assert.match(html, /<textarea class="headline-input"[^>]*aria-label="What are you making\?"[^>]*placeholder="What are you making\?"/)
    assert.doesNotMatch(html, /headline-go|progressbar|<button/)
    assert.match(html, /<div class="headline-track" aria-hidden="true"><\/div>/, 'the still track a touch screen shows as the empty field\'s underline')
  })
  it('shows the round arrow once there is text, never disabled', () => {
    const html = render('a reading tracker')
    assert.match(html, /<button type="button" class="headline-go" aria-label="Find photos"/)
    assert.doesNotMatch(html, /disabled/)
  })
  it('while proposing: no arrow, the reading line and the wait said under it, the text kept and read-only', () => {
    const html = render('a reading tracker', true)
    assert.doesNotMatch(html, /headline-go/)
    assert.match(html, /<div class="card-progress headline-progress" role="progressbar"/)
    assert.match(html, /<textarea class="headline-input"[^>]*readOnly=""/)
    assert.match(html, /<p class="headline-wait" aria-hidden="true">Looking through your photos · usually 15–25 s<\/p>/, 'the wait, said under the line')
    assert.doesNotMatch(html, /headline-track/)
  })
})
