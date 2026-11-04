# Front page: the header, the Library masthead and the phone's tab bar

Date: 2026-11-04. Decided with Malik in review, on mocks rendered against the running app (Claude outputs/chrome-m/ny-mocks).

## What Malik asked
- **Blue:** the Library's ultramarine count block was "not coherent"; a small amount of blue is enough.
- **Branding:** bring in the Data tear brand (`brand/data-tear`, b1d9c7a).
- **Library head:** make it "New York style", like a newspaper front page or a poster, clear and direct, with no useless text (no dates, no count line). Use the lettering with the tear at its bottom. Do this on the desktop only; the phone gets an improved, simple version.
- **Tab bar:** Shoot was too tight and tiny, and the bar's height needed checking against the usual UX rules.
- **Frame ids:** take them off wherever they are not useful.

## Decisions
1. **Blue is Tearsheet's own mark (V1).**
   - The lockup's tear in the header is ultramarine; the letters are graphite.
   - Everything else in ultramarine is a trace: READING, region boxes, callouts, m and r ids.
   - No solid blue field. The count block is graphite again.
2. **Header.**
   - From 768 px up, it is a nameplate: the lockup (228 px) is centered, Library and Make sit at the left, and the page's actions at the right.
   - On the Library the header has no line of its own.
   - On a phone, the lockup (150 px) sits at the left with ⋯ at the right.
3. **Library masthead, desktop.**
   - LIBRARY and the count block, as before, on one baseline.
   - Its bottom is torn: the board's rim under the name, stretched across the page in em. The fibre (`#D3CDC1`) shows under the bite.
   - No straight rule, and no line of text under it.
4. **Library masthead, phone.** LIBRARY and the count in display type at 44 px, on one baseline. No block, rule or tear.
5. **Issue line.** For a screen reader only, at every width.
6. **Tab bar (Nav A).**
   - The bar is 64 px over the home indicator, with three equal items.
   - Library and Make are a 24 px glyph over an 11 px label.
   - Shoot is a 60 px shutter riding the bar's top edge on the Library, with no visible word, and a 44 px outline inside the bar on Make.
7. **Frame ids.** Only in Details (the page and the Brick sheet) and on the share card.

## Rejected
- **V2 (blue frame ids):** quieter, but it read less as a brand color.
- **Nav B (two tabs and a floating shutter):** truer to Apple's HIG, but further from the thumb.
- **S (an app's large "Library" title):** generic.
- **F with a folio line (count and date under one rule):** text that says nothing.

## Where it lives
- `src/chrome/tokens.css`: the header, `.masthead`, `.masthead-rim` and `.bottom-bar`.
- `src/brand/tornEdge.ts`: the tear's geometry, tested in `scripts/tornEdge.test.ts`.
- `src/Library.tsx`: the masthead's markup.
- `src/chrome/AppChrome.tsx` and `src/brand/Lockup.tsx`: the header and the lockup's `mark` color.
- `docs/DESIGN_SYSTEM.md` §1, §4, §4a, §6, §10.

## Later the same day
- **Header lockup.** It is the Claude Design board's primary lockup: the board's mark tear, and the letters clipped by the board's own bite set 35 units lower ("cut the letters a little less"), without the rim. Two attempts to thin the tear for small sizes were rejected as too regular and artificial: a resampled bite, and a mark with fibres added along its edges.
- **Make's callouts.** For a while they were pins on the List screen, because the thick white casing on the leaders was clumsy. The leaders came back (orderly, and exact on small elements) with a hairline casing instead: a 3 px white casing under the 1.5 px line, which still reads on a blue screen. A text target's leader now ends at its first word, not at its box.

