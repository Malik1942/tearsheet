/** The board (2026-11-04): a content whose shape is `board` shows an overview of tiles and then its list, in place of the list and the year review.
 *  The shell reads every word from the content; the shape and the tiles come from the propose call and are read leniently, like the rest of the content. Run: npm test */
import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PROPOSE_PROMPT } from '../src/lib/proposePrompt.ts'
import { validateContent } from '../src/lib/propose.ts'
import { CONCERT_CONTENT, MIN_TILES, SCREEN_NAMES, groupTiles, screensOf, toShellContent, type SampleContent } from '../src/shell/content.ts'
import { DEFAULT_PARAMS, type Params } from '../src/shell/params.ts'

;(globalThis as { React?: typeof React }).React = React
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: 'export default ""', shortCircuit: true }
    return nextLoad(url, context)
  },
})
let Shell: typeof import('../src/shell/Shell.tsx').Shell
before(async () => { ({ Shell } = await import('../src/shell/Shell.tsx')) })

const BOARD: SampleContent = JSON.parse(readFileSync(new URL('../src/fixtures/content/ops-board.json', import.meta.url), 'utf8'))
const READING: SampleContent = JSON.parse(readFileSync(new URL('../src/fixtures/content/reading-tracker.json', import.meta.url), 'utf8'))
const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '')
const render = (screen: 'list' | 'review' | 'board', params: Params = DEFAULT_PARAMS, content = toShellContent(BOARD)) => renderToStaticMarkup(h(Shell, { params, screen, content }))

describe('the shape picks the two screens', () => {
  it('a log shows the list and the year review; a board the overview and then the list', () => {
    assert.deepEqual(screensOf(CONCERT_CONTENT), ['list', 'review'])
    assert.deepEqual(screensOf(toShellContent(READING)), ['list', 'review'])
    assert.deepEqual(screensOf(toShellContent(BOARD)), ['board', 'list'])
    assert.equal(SCREEN_NAMES.board, 'Overview screen')
  })
  it('content stored before shapes existed reads as a log, and so does a board with fewer than three tiles', () => {
    assert.equal(toShellContent(READING).shape, 'log')
    assert.equal(toShellContent({ ...BOARD, shape: 'board', tiles: BOARD.tiles!.slice(0, MIN_TILES - 1) }).shape, 'log')
    assert.equal(toShellContent({ ...BOARD, shape: 'board', tiles: BOARD.tiles!.slice(0, MIN_TILES) }).shape, 'board')
    assert.equal(toShellContent({ ...BOARD, shape: 'log' }).shape, 'log')
    assert.deepEqual(toShellContent({ ...BOARD, shape: 'log' }).tiles, [], 'a log carries no tiles onto the screens')
  })
  it('a board’s one control is its period, Today; a log’s is Add', () => {
    assert.equal(toShellContent(BOARD).add, 'Today')
    assert.equal(toShellContent(READING).add, 'Add')
  })
})

describe('validateContent reads the shape and the tiles leniently', () => {
  it('keeps a well-formed board', () => {
    assert.deepEqual(validateContent(BOARD), BOARD)
  })
  it('a bad shape or a malformed tile is none, as any other malformed part', () => {
    assert.equal(validateContent({ ...BOARD, shape: 'grid' }), null)
    assert.equal(validateContent({ ...BOARD, tiles: [{ label: 'x' }] }), null)
    assert.equal(validateContent({ ...BOARD, tiles: [...BOARD.tiles!, BOARD.tiles![0]] }), null, 'a seventh tile')
  })
  it('the prompt asks for the shape and, for a board, six tiles', () => {
    assert.ok(PROPOSE_PROMPT.includes('shape: "log" when what they are making collects things over time'))
    assert.ok(PROPOSE_PROMPT.includes('tiles: for a board, six, each with a short label, a value'))
  })
})

describe('the overview screen', () => {
  it('shows the overview title, the period control and every tile, with its label, value, note and tag', () => {
    // as it reads: a label's or note's last two words may be bound by a no-break space (whole words, contract rule 7), which reads as a space
    const html = render('board').replaceAll('\u00A0', ' ')
    assert.match(html, /<h1 class="large-title">Overview<\/h1>/)
    assert.match(html, /<button class="action" type="button" aria-label="Today">/)
    assert.equal((html.match(/<article class="tile">/g) ?? []).length, 6)
    for (const t of BOARD.tiles!) {
      assert.ok(html.includes(`<p class="label">${t.label}</p>`), t.label)
      assert.ok(html.includes(`<p class="value">${t.value}</p>`), t.value)
      assert.ok(html.includes(`<p class="note">${t.note}</p>`), t.note)
      assert.ok(html.includes(`<span class="tag">${t.tag}</span>`), t.tag)
    }
    assert.equal(/Khruangbin|Add show|Queue</.test(html), false, 'no concert word, and the list title is not on the overview')
  })
  it('marks the shell with its shape and makes the chart tab active, the list tab on the list', () => {
    assert.match(render('board'), /class="shell" lang="en"[^>]*data-shape="board"/)
    assert.match(render('board'), /<button type="button" class="tab-item" data-active="false"[^>]*>[^]*?Items[^]*?<button type="button" class="tab-item" data-active="true"[^>]*>[^]*?Status/)
    assert.match(render('list'), /<button type="button" class="tab-item" data-active="true"[^>]*>[^]*?Items/)
    assert.match(render('list', DEFAULT_PARAMS, toShellContent(READING)), /data-shape="log"/)
  })
  it('the period is labelled under accent_placement: actions, a quiet clock otherwise', () => {
    assert.match(render('board', { ...DEFAULT_PARAMS, accent_placement: 'actions' }), /<button class="action" type="button"><svg class="icon"[^]*?<\/svg>Today<\/button>/)
    assert.doesNotMatch(render('board'), /<\/svg>Today</)
  })
  it('a centred board puts its title in the bar beside the period’s hidden twin', () => {
    const html = render('board', { ...DEFAULT_PARAMS, alignment_edge: 'center' })
    assert.match(html, /<span class="bar-balance" aria-hidden="true"><span class="action">/)
    assert.match(html, /<h1 class="bar-title">Overview<\/h1>/)
    assert.doesNotMatch(html, /large-title/)
  })
  it('groups the tiles by their state under by-tag, in order of first appearance, and never otherwise', () => {
    const tiles = toShellContent(BOARD).tiles
    assert.deepEqual(groupTiles(tiles, 'by-tag').map(g => [g.label, g.items.length]), [['urgent', 1], ['active', 1], ['steady', 2], ['waiting', 1], ['planned', 1]])
    for (const mode of ['none', 'by-time', 'by-place']) assert.deepEqual(groupTiles(tiles, mode).map(g => [g.label, g.items.length]), [['', 6]])
    const html = render('board', { ...DEFAULT_PARAMS, grouping: 'by-tag' })
    assert.equal((html.match(/<h2 class="group-title">/g) ?? []).length, 5)
    assert.match(html, /<h2 class="group-title">urgent<\/h2>/)
  })
  it('the list behind a board keeps its items and titles them by the list title', () => {
    const html = render('list')
    assert.match(html, /<h1 class="large-title">Queue<\/h1>/)
    assert.ok(text(html).includes('Nightly build'))
    assert.ok(html.includes('<span class="date">Jan 18</span>'), 'the date stays in the markup; the shell hides it by its shape (shell.css)')
  })
  it('the third hue reaches a tile’s tag', () => {
    assert.match(render('board', { ...DEFAULT_PARAMS, palette_hue_count: 3 }), /<p class="tags palette-3"><span class="tag">urgent<\/span><\/p>/)
  })
})
