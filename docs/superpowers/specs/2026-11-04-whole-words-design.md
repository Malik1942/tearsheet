# Layout contract rule 7: whole words

Approved by Malik 2026-11-04 ("Yes, build it"). Asked: "text layout, orphans or text lines, weird and ugly. make sure these will not happen". Builds on `shell-title-wrap` (b1cd1cd, unmerged), brought in first because it touches the same files: bar titles wrap instead of an ellipsis, and rule 4 checks that no title is cut.

## What happens today

- `.item .title` has `overflow-wrap: anywhere; hyphens: auto` (shell.css). A display-size title in a narrow text column breaks inside a word ("Dashb / oard / kit") or hyphenates it ("Brand / re- / fresh").
- `.large-title`, `.row .title`, `.tile .label` and `.tile .note` also break anywhere.
- Short meta lines end on one word ("Moodboard, 40 / frames").

## The rule

On every screen, every visible block of text in the shell:

1. **keeps each word whole.** No word is split across lines and none is hyphenated by the browser.
2. **holds its words inside its box.** A word is never wider than its box, so it is never clipped.
3. **never ends on a one-word line** when the block has three words or more. With two words, "Dashboard / kit" is allowed: no wrap can avoid it.

The blocks are:
- titles: `.bar-title`, `.large-title`, `.screen-title`, `.group-title`, `.item .title`, `.row .title`, `.feature .title`, `.tile .label`
- body text: `.item .meta`, `.item .note`, `.row .meta`, `.feature .meta`, `.tile .note`

Text set to one line with an ellipsis (`nowrap`) is outside the rule. It never wraps.

## How

- **CSS (shell.css):**
  - `hyphens: manual` everywhere in the shell.
  - Titles get `text-wrap: balance`, and body text `text-wrap: pretty`, so the last line is never a lone word.
  - `overflow-wrap: anywhere` goes. `break-word` stays on titles only as a last resort: it never fires once the fit below holds, and rule 7 reports it if it does.
- **Fit (Shell.tsx, `src/shell/fit.ts`):** when a screen's longest title word is wider than its box, that screen's size step scales down until it fits.
  - The fit runs after layout and before paint, from the real rendered words (a Range per word, at the font the skin loaded). It runs again when fonts finish loading and when the shell resizes.
  - The display step and the title step each get one factor, the smallest any of their words needs. So the screen keeps one display size and one title size, and rule 3 (three type sizes) still holds.
  - Clamps: display never goes under the title size, and title never under the body size. If a word still does not fit at the clamp, rule 7 reports it rather than hiding it.
  - It is a rendering fit, not a parameter change: the sheet and the export keep the parameters as they are.
  - A static render, such as server-side tests, has no layout and no fit.
- **Measurement (contractMeasure.ts, rule `whole-words`):** for each block above it takes every word's line boxes (`Range.getClientRects`). It then flags:
  - a word on two lines;
  - a block wider than its box;
  - a last line with one word in a block of three words or more.
  
  The line-grouping is pure and unit-tested (`wordIssues`).

## Revisions while building (2026-11-04)

- **The contract renders at the frame's size too.** `CONTRACT_VIEW=frame` renders at 320 × 694, the size Make's phone frame draws a screen at and where a long word has the least room. Before the fix, 1,003 of 1,320 compositions broke the rule there. The 390 run alone would have missed most of them.
- **Balance, not pretty, for short body text.** Chrome 152's `pretty` left "Moodboard, 40 / frames", "Twelve comments / open" and others on a lone word. `balance` gives "Moodboard, / 40 frames". Notes are paragraphs that can pass six lines, where `balance` stops. They get `pretty` for their rag, and their last two words are bound by a no-break space when the pair is 12 characters or fewer (`keepLastTwo`). That also covers a board tile's note.
- **An orphan is one a wrap could avoid.** A lone last word counts only when it would have fitted beside the previous line's last word. "Fox Theater, / Oakland" in a 135 px monospace column cannot be avoided; that is a narrow column, which rule 4 judges.
- **Marks belong to the word before them.** A token with no letter or digit, such as the "·" between tags, belongs to the word before it. The dot between tags is now text held to the tag before it (`Tags.tsx`) instead of a CSS inline-block with no space around it, which the browser broke at but `pretty`/`balance` could not see.
- **Equal steps share a factor.** At a high ratio the title and display steps are both capped at 44 px. A rendered size cannot tell them apart, so they share one factor.
- **The scale is undone before measuring.** A Range's boxes come back drawn, after Make's or MiniPreview's `transform: scale`, so the fit divides by the element's own scale.

## Verification

- **Unit tests:**
  - `wordIssues` on hand-built rects: split, orphan, two-word allowance.
  - The fit's pure math (`fitFactors`): factors, clamps, one factor per step.
- **Browser contract:** `npm run test:contract` with the concert log, `CONTRACT_CONTENT=reading` and `CONTRACT_CONTENT=board`, 1,320 compositions each. Pass means zero `whole-words` violations and no new violation of rules 1–6.
- **Make in the browser:** the "designer tool" board at 375 and 1280, and the type-led red skin from the screenshot.
- No commits: Malik commits on request.
