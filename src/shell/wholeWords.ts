/** Layout contract rule 7, whole words (docs/superpowers/specs/2026-11-04-whole-words-design.md). A block of text keeps every word whole and never ends
 *  on a one-word line when it has three words or more. `wordIssues` is the pure reading of a block's word boxes; `wordBoxes` takes them off the DOM. */

export type Box = { top: number; bottom: number; left: number; right: number }
/** A word and its line boxes; read off the DOM it also carries where it starts (`keepTails` edits the space before it). */
export type WordBox = { text: string; rects: Box[]; node?: Text; start?: number }
export type TextIssue = { kind: 'split' | 'orphan'; word: string }

/** The blocks the rule holds, by role (titles balance their lines, body text avoids a lone last word). Text set to one line with an ellipsis is outside it. */
export const TITLE_BLOCKS = '.bar-title, .large-title, .screen-title, .group-title, .item .title, .row .title, .feature .title, .tile .label'
export const BODY_BLOCKS = '.item .meta, .item .note, .item .tags, .row .meta, .feature .meta, .tile .note'

/** The line a box sits on: boxes whose tops are within half a line of each other share one. */
function lineOf(lines: number[], b: Box): number {
  const tol = Math.max(2, (b.bottom - b.top) / 2)
  const i = lines.findIndex(top => Math.abs(top - b.top) <= tol)
  if (i !== -1) return i
  lines.push(b.top)
  return lines.length - 1
}

/** A token with no letter or digit (the "·" between tags, a dash) belongs to the word before it: Tags.tsx holds the dot to the tag before it with a
 *  no-break space, so it never moves on its own and is not a word of the block. */
function withMarks(words: WordBox[]): WordBox[] {
  const out: WordBox[] = []
  for (const w of words) {
    const prev = out[out.length - 1]
    if (prev && !/[\p{L}\p{N}]/u.test(w.text)) out[out.length - 1] = { text: `${prev.text} ${w.text}`, rects: [...prev.rects, ...w.rects] }
    else out.push(w)
  }
  return out
}

/** A paragraph's last two words bound with a no-break space when together they are 12 characters or fewer, in three words or more, so its last line never
 *  holds one word. `text-wrap: pretty` does not do it on every paragraph (Chrome 152), and `balance` stops at six lines; the bound pair fits any text column
 *  rule 4 allows (9em holds about 16 characters). */
export function keepLastTwo(text: string): string {
  const m = /^(.*\S)\s+(\S+)\s+(\S+)(\s*)$/su.exec(text)
  if (!m || m[2].length + 1 + m[3].length > 12) return text
  return `${m[1]} ${m[2]} ${m[3]}${m[4]}`
}

/** A word whose boxes sit on two lines is split. A last line that holds one short word (under half the width of the line before), in a block of three words
 *  or more, is an orphan when it could have sat beside the last word of the line before within `width` (the block's box): only then can a wrap avoid it.
 *  Two words on two lines are allowed, so is a balanced stack whose last word is as wide as the line before ("Hand of / Darkness"), and so is a lone word
 *  that would not fit beside its neighbour (a narrow column is rule 4's to judge). */
export function wordIssues(input: WordBox[], width = Infinity): TextIssue[] {
  const words = withMarks(input)
  const issues: TextIssue[] = []
  const lines: number[] = []
  const boxes = words.map(w => w.rects.filter(r => r.right - r.left > 0.5).map(r => ({ r, line: lineOf(lines, r) })))
  const onLines = boxes.map(bs => new Set(bs.map(b => b.line)))
  words.forEach((w, i) => { if (onLines[i].size > 1) issues.push({ kind: 'split', word: w.text }) })
  if (words.length >= 3 && lines.length >= 2) {
    const order = [...lines].sort((a, b) => a - b)
    const last = lines.indexOf(order[order.length - 1]), before = lines.indexOf(order[order.length - 2])
    const onLast = words.map((_, i) => i).filter(i => onLines[i].has(last))
    if (onLast.length === 1) {
      const lone = onLast[0]
      // a word's extent on one line, first box to last: a word held to its mark ("funk ·") is measured whole, the no-break space between them included
      const extent = (i: number, line: number) => { const on = boxes[i].filter(b => b.line === line); return on.length ? Math.max(...on.map(b => b.r.right)) - Math.min(...on.map(b => b.r.left)) : 0 }
      const loneW = extent(lone, last)
      // the last word of the line before (the one furthest along it), not the lone word's own first half when it was split
      const prevAt = boxes.map((bs, i) => ({ i, right: Math.max(-Infinity, ...bs.filter(b => b.line === before).map(b => b.r.right)) })).filter(x => x.i !== lone && x.right > -Infinity).sort((a, b) => b.right - a.right)[0]
      const prev = prevAt && { r: { left: 0, right: extent(prevAt.i, before) } }
      // a space as this block sets it: the narrowest gap between two words on one line, else 4 px
      const gaps = boxes.flatMap((bs, i) => (i + 1 < boxes.length ? bs.flatMap(a => boxes[i + 1].filter(b => b.line === a.line).map(b => b.r.left - a.r.right)) : [])).filter(g => g > 0)
      const space = gaps.length ? Math.min(...gaps) : 4
      // a short tail: the lone word under half the width of the line before ("Moodboard, 40 / frames"); a balanced stack ("Hand of / Darkness") is not one
      const onBefore = boxes.flatMap(bs => bs.filter(b => b.line === before))
      const beforeW = Math.max(...onBefore.map(b => b.r.right)) - Math.min(...onBefore.map(b => b.r.left))
      if (prev && loneW < beforeW / 2 && prev.r.right - prev.r.left + space + loneW <= width) issues.push({ kind: 'orphan', word: words[lone].text })
    }
  }
  return issues
}

/** Every word of an element with its line boxes, read with a Range per word over each text node (a word never spans two nodes in the shell: a separator
 *  span sits between words). With `units`, a no-break space joins its two words into one unit (keepLastTwo's pair), which is what the fit must make fit
 *  whole. Browser only. */
export function wordBoxes(el: Element, units = false): WordBox[] {
  const out: WordBox[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? ''
    for (const m of text.matchAll(units ? /[^\x20\t\n\r\f\v]+/g : /\S+/g)) {
      const range = document.createRange()
      range.setStart(n, m.index)
      range.setEnd(n, m.index + m[0].length)
      out.push({ text: m[0], rects: Array.from(range.getClientRects(), r => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })), node: n as Text, start: m.index })
    }
  }
  return out
}

/** The nearest plain space before a word, walking back through the block's text nodes. */
function spaceBefore(el: Element, node: Text, start: number): { node: Text; index: number } | null {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)
  for (let i = nodes.indexOf(node), from = start - 1; i >= 0; i--, from = (nodes[i - 1]?.data.length ?? 0) - 1) {
    const at = nodes[i].data.lastIndexOf(' ', from)
    if (at !== -1) return { node: nodes[i], index: at }
  }
  return null
}

/** After layout (Shell): every body block that ends on an avoidable short tail ("… sci-fi · / fantasy") gets the plain space before its last word turned
 *  into a no-break space, so the word before moves down with it; undone if the pair then splits or overflows its box. Width-aware where `keepLastTwo` can
 *  only count characters: whether "sci-fi · fantasy" fits depends on the skin's face. Returns the undo, which runs before every new pass, so a pair bound
 *  for one layout never outlives it. Browser only. */
export function keepTails(shell: HTMLElement): () => void {
  const edits: { node: Text; index: number }[] = []
  for (const el of Array.from(shell.querySelectorAll<HTMLElement>(BODY_BLOCKS))) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.whiteSpace === 'nowrap') continue
    const width = el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    const words = wordBoxes(el)
    if (!wordIssues(words, width).some(i => i.kind === 'orphan')) continue
    const last = [...words].reverse().find(w => /[\p{L}\p{N}]/u.test(w.text))
    const at = last?.node && last.start !== undefined ? spaceBefore(el, last.node, last.start) : null
    if (!at) continue
    at.node.replaceData(at.index, 1, ' ')
    if (el.scrollWidth > el.clientWidth + 1 || wordIssues(wordBoxes(el), width).some(i => i.kind === 'split')) at.node.replaceData(at.index, 1, ' ')
    else edits.push(at)
  }
  return () => { for (const e of edits) if (e.node.data[e.index] === ' ') e.node.replaceData(e.index, 1, ' ') }
}
