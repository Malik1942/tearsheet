/** First-run guidance (lib/coldStart.ts): on a cold start (starters shown, no photo of the person's own) the Library says what the starters are and Make offers two
 *  example intents. Once there is any photo of their own, neither renders, so every screen of an owned library is unchanged.
 *  The components are rendered to a string with react-dom/server, as in staticrender.test.ts: React on the global for the classic JSX transform tsx falls back to,
 *  and an empty module for any .css. localStorage is replaced per test. Run: npm test */
import { afterEach, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EXAMPLE_INTENTS, dismissStarterNote, isColdStart, starterNoteDismissed } from '../src/lib/coldStart.ts'
import { starterBricks, withStarters } from '../src/lib/starters.ts'
import type { Brick } from '../src/lib/types.ts'

;(globalThis as { React?: typeof React }).React = React
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: 'export default ""', shortCircuit: true }
    return nextLoad(url, context)
  },
})

let StarterNote: typeof import('../src/bricks/StarterNote.tsx').StarterNote
let ExampleIntents: typeof import('../src/make/Examples.tsx').ExampleIntents
before(async () => {
  ;({ StarterNote } = await import('../src/bricks/StarterNote.tsx'))
  ;({ ExampleIntents } = await import('../src/make/Examples.tsx'))
})

/** What the store hands the screens: the person's own bricks, then the starters. */
const cold = withStarters([])
const own = (over: Partial<Brick> = {}): Brick => ({ id: 'b_own1', origin: 'own', status: 'ready', saved_at: '2026-11-04', photo: { url: 'idb:b_own1', width: 4, height: 5 }, relations: [], ...over } as unknown as Brick)
const owned = (over: Partial<Brick> = {}) => withStarters([own(over)])

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const setStorage = (s: unknown) => Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true, writable: true })
const memory = (seed: Record<string, string> = {}) => {
  const m = new Map(Object.entries(seed))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), map: m }
}
const blocked = { getItem: () => { throw new Error('SecurityError') }, setItem: () => { throw new Error('QuotaExceededError') }, removeItem: () => { throw new Error('SecurityError') } }
beforeEach(() => setStorage(memory()))
afterEach(() => { if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete (globalThis as { localStorage?: unknown }).localStorage })

const note = (bricks: Brick[], showStarters = true) => renderToStaticMarkup(h(StarterNote, { bricks, showStarters }))
const examples = (bricks: Brick[], intent = '', showStarters = true) => renderToStaticMarkup(h(ExampleIntents, { bricks, showStarters, intent, onPick: () => {} }))
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'")

describe('a cold start', () => {
  it('is the starters shown and no photo of the person\'s own', () => {
    assert.equal(isColdStart(cold, true), true)
    assert.equal(isColdStart(starterBricks(), true), true)
    assert.equal(isColdStart([], true), true)
  })
  it('ends with any photo of their own, whatever its state: read, being read, queued, failed', () => {
    for (const status of ['ready', 'extracting', 'pending', 'unparsed'] as const) assert.equal(isColdStart(owned({ status }), true), false, status)
    // an older save's photo has no origin; any id that is not a starter's is the person's
    assert.equal(isColdStart([{ id: 'b_legacy' }], true), false)
  })
  it('is not one when the starters are hidden: the library holds no starters then', () => {
    assert.equal(isColdStart(cold, false), false)
  })
})

describe('the Library\'s starter line', () => {
  it('renders on a cold start: one line in the meta style, Make as a link to /make, and a dismiss ×', () => {
    const html = note(cold)
    assert.equal(text(html).replace('×', ''), 'These are starter photos. Open Make to build something from them, or Shoot to add your own.')
    assert.match(html, /<p class="caption ink-2[^"]*">/)
    assert.match(html, /<a href="\/make" class="underline">Make<\/a>/)
    assert.match(html, /<button type="button" class="btn btn-quiet icon-btn" aria-label="Dismiss" title="Dismiss">×<\/button>/)
  })
  it('renders nothing once the library holds a photo of the person\'s own', () => {
    assert.equal(note(owned()), '')
    assert.equal(note(owned({ status: 'extracting' })), '')
  })
  it('renders nothing while the starters are hidden', () => {
    assert.equal(note(cold, false), '')
  })
  it('stays gone once dismissed on this device', () => {
    const s = memory(); setStorage(s)
    assert.equal(starterNoteDismissed(), false)
    dismissStarterNote()
    assert.equal(s.map.get('tearsheet.starterNote'), 'dismissed')
    assert.equal(starterNoteDismissed(), true)
    assert.equal(note(cold), '')
  })
  it('never throws where storage is blocked: the line shows, and the × still closes it for the visit', () => {
    setStorage(blocked)
    assert.equal(starterNoteDismissed(), false)
    assert.doesNotThrow(() => dismissStarterNote())
    assert.notEqual(note(cold), '')
    setStorage(undefined)   // no storage at all (the global is missing)
    assert.equal(starterNoteDismissed(), false)
    assert.doesNotThrow(() => dismissStarterNote())
  })
})

describe('Make\'s example intents', () => {
  it('are two, each a plain answer to "What are you making?", with no em dash', () => {
    assert.equal(EXAMPLE_INTENTS.length, 2)
    for (const x of EXAMPLE_INTENTS) { assert.match(x, /^A [a-z ]+$/i); assert.doesNotMatch(x, /—/) }
  })
  it('render as two buttons under an empty field on a cold start', () => {
    const html = examples(cold)
    assert.match(html, /^<div class="[^"]*" role="group" aria-label="Examples">/)
    assert.deepEqual([...html.matchAll(/<button type="button"[^>]*>([^<]+)<\/button>/g)].map(m => m[1]), [...EXAMPLE_INTENTS])
  })
  it('render nothing once the field holds text', () => {
    assert.equal(examples(cold, EXAMPLE_INTENTS[0]), '')
    assert.equal(examples(cold, 'A trip journal'), '')
    assert.notEqual(examples(cold, '   '), '')   // spaces are still an empty field, as for Enter
  })
  it('render nothing once the library holds a photo of the person\'s own, or while the starters are hidden', () => {
    assert.equal(examples(owned()), '')
    assert.equal(examples(owned({ status: 'pending' })), '')
    assert.equal(examples(cold, '', false), '')
  })
})
