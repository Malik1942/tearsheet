/** Layout contract rule 7, whole words (docs/superpowers/specs/2026-11-04-whole-words-design.md): the pure parts. How a block's word boxes read as lines
 *  (a word split over two lines, a one-word last line), and the fit that scales a screen's display and title steps until its longest word fits.
 *  Expected values are typed out from the spec, never read from the code under test. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { keepLastTwo, wordIssues, type WordBox } from '../src/shell/wholeWords.ts'
import { fitFactors } from '../src/shell/fit.ts'

/** A word on line `line` (0, 1, …) of a block with 20 px lines, `x` and `w` across. */
const at = (line: number, x: number, w: number) => ({ top: line * 20, bottom: line * 20 + 18, left: x, right: x + w })
const word = (text: string, ...rects: ReturnType<typeof at>[]): WordBox => ({ text, rects })

describe('rule 7: how a block reads as lines', () => {
  it('a block on one line, or with a two-word last line, has no issue', () => {
    assert.deepEqual(wordIssues([word('Nightly', at(0, 0, 50)), word('build', at(0, 55, 35))]), [])
    assert.deepEqual(wordIssues([word('Moodboard,', at(0, 0, 80)), word('40', at(1, 0, 16)), word('frames', at(1, 20, 50))]), [])
  })
  it('a word whose boxes sit on two lines is split', () => {
    assert.deepEqual(wordIssues([word('Dashboard', at(0, 0, 120), at(1, 0, 60)), word('kit', at(2, 0, 30))]), [{ kind: 'split', word: 'Dashboard' }])
  })
  it('a last line with one short word (under half the line before), in a block of three words or more, is an orphan when it would fit beside the word before it', () => {
    assert.deepEqual(wordIssues([word('Moodboard,', at(0, 0, 80)), word('40', at(0, 85, 16)), word('frames', at(1, 0, 50))], 120), [{ kind: 'orphan', word: 'frames' }])
  })
  it('a lone last word that could not sit beside the word before it in this box is not an orphan: no wrap avoids it (a narrow column is rule 4)', () => {
    // "Theater," (60) + a 5 px space + "Oakland" (60) is wider than the 110 px box
    assert.deepEqual(wordIssues([word('Fox', at(0, 0, 25)), word('Theater,', at(1, 0, 60)), word('Oakland', at(2, 0, 60))], 110), [])
  })
  it('two words on two lines are allowed: no wrap can avoid it', () => {
    assert.deepEqual(wordIssues([word('Dashboard', at(0, 0, 120)), word('kit', at(1, 0, 30))]), [])
  })
  it('a split word is reported once, and its tail is not also an orphan when it is not short beside the line before', () => {
    // "re- ref" (42) over "resh" (50): split, not a short tail
    const issues = wordIssues([word('Brand', at(0, 0, 60)), word('re-', at(1, 0, 30)), word('refresh', at(1, 32, 10), at(2, 0, 50))], 200)
    assert.deepEqual(issues.map(i => i.kind), ['split'])
  })
  it('a lone last word as wide as the line before is a balanced stack, not an orphan ("The Left / Hand of / Darkness")', () => {
    assert.deepEqual(wordIssues([word('The', at(0, 0, 30)), word('Left', at(0, 35, 40)), word('Hand', at(1, 0, 45)), word('of', at(1, 50, 20)), word('Darkness', at(2, 0, 80))], 200), [])
  })
  it('a block with no words has no issue', () => {
    assert.deepEqual(wordIssues([]), [])
  })
  it('a word held to its mark is measured whole ("funk ·", not the dot alone) when judging whether the lone last word could have joined it', () => {
    // "funk ·" spans 30–70 (40 wide) + a 4 px space + "instrumental" (90) = 134, wider than the 120 px box: no wrap avoids the lone last word
    assert.deepEqual(wordIssues([word('Fox', at(0, 0, 25)), word('funk', at(0, 30, 26)), word('·', at(0, 64, 6)), word('instrumental', at(1, 0, 90))], 120), [])
    // a short tail ("pop", 24, under half the 70 px line before) that fits beside "funk ·" (40 + 4 + 24 = 68) in a 140 px box is an orphan
    assert.deepEqual(wordIssues([word('Fox', at(0, 0, 25)), word('funk', at(0, 30, 26)), word('·', at(0, 64, 6)), word('pop', at(1, 0, 24))], 140), [{ kind: 'orphan', word: 'pop' }])
  })
  it('a mark with no letter or digit (the "·" between tags, held to the tag before it) is part of the word before it, not a word', () => {
    // "funk ·" then "instrumental": two words on two lines, allowed
    assert.deepEqual(wordIssues([word('funk', at(0, 0, 30)), word('·', at(0, 34, 6)), word('instrumental', at(1, 0, 90))], 120), [])
  })
})

describe('rule 7: a paragraph keeps its last two words together when they are short', () => {
  it('binds the last two words with a no-break space when together they are 12 characters or fewer, in three words or more', () => {
    assert.equal(keepLastTwo('Sat upstairs, still felt it.'), 'Sat upstairs, still felt it.')
    assert.equal(keepLastTwo('Moodboard, 40 frames'), 'Moodboard, 40 frames')
  })
  it('leaves two words, a long pair and one word alone', () => {
    assert.equal(keepLastTwo('Dashboard kit'), 'Dashboard kit')
    assert.equal(keepLastTwo('the whole electronic set'), 'the whole electronic set')
    assert.equal(keepLastTwo('Archived'), 'Archived')
  })
})

describe('rule 7: the fit', () => {
  const SIZES = { body: 13, title: 20, display: 40 }
  it('every word fits: both factors stay 1', () => {
    assert.deepEqual(fitFactors([{ step: 'display', natural: 150, avail: 200 }, { step: 'title', natural: 90, avail: 200 }], SIZES), { display: 1, title: 1 })
  })
  it('the display step scales to its widest word, one factor for the whole screen, with a 1 px margin', () => {
    // 201 px of room less the margin over a 250 px word, and a 300 px one: the smaller wins
    assert.deepEqual(fitFactors([{ step: 'display', natural: 250, avail: 201 }, { step: 'display', natural: 300, avail: 241 }], SIZES), { display: 0.8, title: 1 })
  })
  it('the title step scales on its own', () => {
    assert.deepEqual(fitFactors([{ step: 'title', natural: 200, avail: 151 }], SIZES), { display: 1, title: 0.75 })
  })
  it('display stays at least 1 px over the title size (so the two steps never render at one size and cannot be told apart), and title never goes under body', () => {
    // display: 40 × k ≥ 20 + 1, so k ≥ 0.525
    assert.deepEqual(fitFactors([{ step: 'display', natural: 1000, avail: 101 }], SIZES), { display: 0.525, title: 1 })
    assert.deepEqual(fitFactors([{ step: 'title', natural: 1000, avail: 101 }], SIZES), { display: 1, title: 0.65 })
  })
  it('when the title and display steps are the same size (both capped, ratio 3), they are one step with one factor: a rendered size cannot tell them apart', () => {
    const SAME = { body: 15, title: 44, display: 44 }
    assert.deepEqual(fitFactors([{ step: 'display', natural: 264, avail: 133 }], SAME), { display: 0.5, title: 0.5 })
    assert.deepEqual(fitFactors([{ step: 'title', natural: 264, avail: 133 }, { step: 'display', natural: 100, avail: 200 }], SAME), { display: 0.5, title: 0.5 })
  })
  it('display follows a scaled title down, staying 1 px over it', () => {
    // title 20 × 0.75 = 15, so display ≥ 16 / 40 = 0.4
    assert.deepEqual(fitFactors([{ step: 'title', natural: 200, avail: 151 }, { step: 'display', natural: 1000, avail: 101 }], SIZES), { display: 0.4, title: 0.75 })
  })
})
