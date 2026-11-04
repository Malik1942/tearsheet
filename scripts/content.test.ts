/** Shell item 1 (Malik, 2026-11-03 "3 then 1"): sample content for the intent, written by the same propose call and stored as project.content. Read leniently,
 *  like the ranking: any failure falls back to the concert sample and never costs the proposal. The shell reads every word from its content; the concert
 *  sample is the fallback value. Expected values are typed out from the brief, never read from the code under test. Run: npm test */
import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { PROPOSE_PROMPT } from '../src/lib/proposePrompt.ts'
import { PROPOSE_SCHEMA, handlePropose, renderPrompt, validateContent } from '../src/lib/propose.ts'
import { libraryFor, propose as proposeFromApp } from '../src/lib/proposeClient.ts'
import { CONCERT_CONTENT, toShellContent, yearOf, type SampleContent } from '../src/shell/content.ts'
import { DEFAULT_PARAMS } from '../src/shell/params.ts'

;(globalThis as { React?: typeof React }).React = React
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: 'export default ""', shortCircuit: true }
    return nextLoad(url, context)
  },
})
let Shell: typeof import('../src/shell/Shell.tsx').Shell
before(async () => { ({ Shell } = await import('../src/shell/Shell.tsx')) })

const READING: SampleContent = JSON.parse(readFileSync(new URL('../src/fixtures/content/reading-tracker.json', import.meta.url), 'utf8'))
const INTENT = 'a reading tracker for someone who finishes a book a week'
const LIB = libraryFor(SAMPLES)
const firstRule = (id: string) => LIB.find(b => b.brick_id === id)!.rules[0].rule
const SENTENCE = 'Also return content: placeholder text for the two screens of what they are making, written from the intent alone, never from a photo or a rule. screen_titles: list, the title of the screen that lists the items, and review, the title of the screen that looks back on the year. tabs: three short labels for a list, a chart and a profile tab, none repeating a screen title. entries: eight items, each with a short title, a subtitle, a date in {{YEAR}} (YYYY-MM-DD, spread over the year) and up to two one-word tags.'

describe('the propose call also writes sample content', () => {
  it('requires content with two screen titles, three tabs and eight entries', () => {
    assert.deepEqual(PROPOSE_SCHEMA.required, ['picks', 'ranking', 'content'])
    const c = PROPOSE_SCHEMA.properties.content
    assert.deepEqual(c.required, ['screen_titles', 'tabs', 'entries'])
    assert.deepEqual([c.properties.tabs.minItems, c.properties.tabs.maxItems], [3, 3])
    assert.deepEqual([c.properties.entries.minItems, c.properties.entries.maxItems], [8, 8])
    assert.deepEqual(c.properties.entries.items.required, ['title', 'subtitle', 'date', 'tags'])
    assert.equal(c.properties.entries.items.properties.tags.maxItems, 2)
  })
  it('asks for it in one sentence after the ranking, with the year filled in', () => {
    assert.ok(PROPOSE_PROMPT.includes(`by the same preferences as your picks.\n\n${SENTENCE}\n\nLibrary:\n{{LIBRARY}}`))
    const out = renderPrompt(INTENT, LIB, undefined, 2026)
    assert.ok(out.includes('a date in 2026 (YYYY-MM-DD'))
    assert.equal(out.includes('{{YEAR}}'), false)
    assert.ok(renderPrompt('my {{YEAR}} log', LIB, undefined, 2026).includes('"my {{YEAR}} log"'), 'a placeholder typed into the intent is never expanded')
  })
})

describe('validateContent', () => {
  it('keeps well-formed content, trimmed', () => {
    assert.deepEqual(validateContent(READING), READING)
    const padded = { ...READING, screen_titles: { list: '  Books ', review: 'Reading year' } }
    assert.equal(validateContent(padded)?.screen_titles.list, 'Books')
  })
  it('reads anything malformed as none: a missing part, a bad date, a fourth tab, too few entries', () => {
    for (const bad of [undefined, null, 'books', {}, { ...READING, tabs: ['a', 'b'] }, { ...READING, tabs: ['a', 'b', 'c', 'd'] },
      { ...READING, entries: READING.entries.slice(0, 2) }, { ...READING, entries: [{ ...READING.entries[0], date: 'March' }, ...READING.entries.slice(1)] },
      { ...READING, entries: [{ ...READING.entries[0], tags: ['a', 'b', 'c'] }, ...READING.entries.slice(1)] }, { ...READING, screen_titles: { list: '', review: 'x' } }]) {
      assert.equal(validateContent(bad), null, JSON.stringify(bad)?.slice(0, 60))
    }
  })
  it('refuses a tab that repeats a screen title (layout contract rule 5)', () => {
    assert.equal(validateContent({ ...READING, tabs: ['my weekly shelf', 'Pace', 'Me'] }), null)
  })
})

describe('handlePropose: content from the same call, never at the cost of the picks', () => {
  async function call(answer: unknown) {
    const real = globalThis.fetch
    let sent = 0
    globalThis.fetch = (async () => { sent++; return new Response(JSON.stringify({ status: 'completed', usage: { input_tokens: 10, output_tokens: 5 }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] }), { status: 200 }) }) as typeof fetch
    const lines: string[] = []
    try { return { out: await handlePropose({ intent: INTENT, library: LIB }, 'test-key', { live: true, ip: 'content-test', log: l => lines.push(l) }), sent, log: JSON.parse(lines[0]) } } finally { globalThis.fetch = real }
  }
  const picks = [{ brick_id: 'g2', quoted_rule: firstRule('g2'), why: 'it fits' }]
  it('returns the checked content beside the picks, in one call, and logs that it came', async () => {
    const { out, sent, log } = await call({ picks, ranking: ['g2'], content: READING })
    assert.equal(sent, 1)
    assert.deepEqual(out.body.content, READING)
    assert.deepEqual(out.body.picks.map((p: any) => p.brickId), ['g2'])
    assert.equal(log.content, true)
  })
  it('keeps the picks and returns no content when the content is malformed', async () => {
    const { out, log } = await call({ picks, ranking: ['g2'], content: { screen_titles: 'Books' } })
    assert.equal(out.body.ok, true)
    assert.equal(out.body.content, null)
    assert.deepEqual(out.body.picks.map((p: any) => p.brickId), ['g2'])
    assert.equal(log.content, false)
  })
  it('the app hands Make the content, or null when the server sent none', async () => {
    const real = globalThis.fetch
    const ok = { ok: true, picks: [{ brickId: 'g2', quotedRule: 'r', why: 'w' }], dropped: [], ranking: [], status: 'completed', latency_ms: 1, usage: { input_tokens: 1, output_tokens: 1, reasoning_tokens: 0 }, cost_usd: 0, model: 'muse-spark-1.3', effort: 'low' }
    try {
      globalThis.fetch = (async () => new Response(JSON.stringify({ ...ok, content: READING }), { status: 200 })) as unknown as typeof fetch
      const a = await proposeFromApp(INTENT, SAMPLES)
      assert.deepEqual(a.ok && a.content, READING)
      globalThis.fetch = (async () => new Response(JSON.stringify(ok), { status: 200 })) as unknown as typeof fetch
      const b = await proposeFromApp(INTENT, SAMPLES)
      assert.equal(b.ok && b.content, null)
    } finally { globalThis.fetch = real }
  })
})

describe('the shell reads every word from its content', () => {
  const render = (screen: 'list' | 'review', content = toShellContent(READING)) => renderToStaticMarkup(h(Shell, { params: DEFAULT_PARAMS, screen, content }))
  /** The words as a reader sees them: tags and the server renderer's text separators dropped. */
  const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '')
  it('falls back to the concert sample when there is none', () => {
    assert.equal(toShellContent(null), CONCERT_CONTENT)
    assert.equal(toShellContent(undefined), CONCERT_CONTENT)
  })
  it('shows the written titles, tabs and entries on the List', () => {
    const html = render('list')
    assert.match(html, /<h1 class="large-title">My Weekly Shelf<\/h1>/)
    assert.deepEqual([...html.matchAll(/<span class="tab-label">([^<]*)<\/span>/g)].map(m => m[1]), ['Shelf', 'Pace', 'Me'])
    for (const e of READING.entries) assert.ok(html.includes(`>${e.title}<`), e.title)
    assert.ok(text(html).includes('Jan 11 · Ursula K. Le Guin'))
    assert.equal(/Khruangbin|Fox Theater|Add show/.test(html), false, 'no concert word is left')
  })
  it('shows its year, generic totals and a highlight on the year review', () => {
    const html = render('review', toShellContent(READING))
    assert.match(html, /<h1 class="bar-title">My Year in Books<\/h1>/)
    assert.match(html, /<h2 class="screen-title">2026<\/h2>/)
    // eight entries in eight months (the first total's word is fixed, not the list title); seven tags, since sci-fi and literary come back
    assert.ok(text(html).includes('8 entries8 months7 tags'), text(html).slice(0, 200))
    assert.equal(/shows|cities|genres|Show of the year/.test(html), false)
  })
  it('keeps the concert sample word for word: Shows, Year review, Add show, shows, cities, genres, Show of the year', () => {
    const list = renderToStaticMarkup(h(Shell, { params: { ...DEFAULT_PARAMS, accent_placement: 'actions' }, screen: 'list' }))
    assert.match(list, /<h1 class="large-title">Shows<\/h1>/)
    assert.ok(text(list).includes('Jan 18 · Fox Theater, Oakland') && list.includes('Bass tone carried the whole room.') && list.includes('Add show'))
    const review = renderToStaticMarkup(h(Shell, { params: { ...DEFAULT_PARAMS, rhythm: 'featured-first' }, screen: 'review' }))
    assert.match(review, /<h2 class="screen-title">2025<\/h2>/)
    assert.ok(text(review).includes('14 shows3 cities'))
    assert.ok(text(review).includes('Show of the year: Khruangbin'))
  })
  it('takes the year the entries share', () => {
    assert.equal(yearOf(toShellContent(READING).entries), '2026')
    assert.equal(yearOf(CONCERT_CONTENT.entries), '2025')
  })
})
