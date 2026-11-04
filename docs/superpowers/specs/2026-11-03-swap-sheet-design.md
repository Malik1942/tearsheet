# Swap sheet: ranking, groups and captions

Approved by Malik 2026-11-03 ("Approve, with sentence"). Library order stays newest-first; it is not touched.

## 1. Ranking from the propose call (no new model call)

- `PROPOSE_SCHEMA` (src/lib/propose.ts) gains `ranking: { type: 'array', maxItems: 60, items: { type: 'string' } }`, required next to `picks`.
- `PROPOSE_PROMPT` (src/lib/proposePrompt.ts) gains one sentence after the `{{LEAN}}` slot, before `Library:`:
  `Also return ranking: every brick_id in the library exactly once, best fit first for what they are making, by the same preferences as your picks.`
  "The same preferences" carries the lean without naming it, so the sentence reads the same with or without one.
- Picks are validated exactly as before. `validateRanking(raw, library)` keeps library ids only, in order, first occurrence wins; anything else is dropped. A response with no usable `ranking` still succeeds with `[]`, so the ranking can never cost a proposal.
- The ok response carries `ranking: string[]`; the function log line gains `ranked: n`. The browser client passes it on (`[]` when absent).
- Stored on the project as `proposal.ranking` (optional; older projects have none). It syncs and exports with the proposal.
- `scripts/lean.test.ts` pins "prompt minus lean == v1"; the pin becomes "v1 plus the ranking sentence", on purpose.
- `npm run check:prompts` reports DIFF for the propose prompt and schema until the harness copies (`meta-eval/fixtures/prompts/propose.md`, `schemas/propose.json`) are refreshed. This change does not touch `meta-eval/`. Run 3 is already recorded, so no sealed run waits on the old bytes.

## 2. Groups (pure: src/lib/swapSheet.ts)

Inputs: the project, the pool the sheet offers (today's: ready, not superseded, starters per the ⋯ toggle), the id being replaced, and every brick (to resolve the project).

- **What the replaced photo sets:** the relationship parameters whose value on the screens comes from it now, judged with it unmuted (as the photo row judges a muted photo).
- **What a candidate sets:** the relationship parameters of its own candidates, first three (`CAP_PER_BRICK`), the same set its short labels come from; by-rule readings (alignment from a text measurement, title-led readings) count.
- **Taken:** a relationship parameter whose value in the project is not a shell default (`isShellDefault`), so a value set by hand or locked is taken. It is judged before the layout contract (`before`, added on spec-v2): a value the contract filled in is set by a rule, not by a photo, so it stays free.
- Groups, in order; each photo goes to the first it qualifies for; empty groups are not shown:
  1. **Same job**: the candidate sets at least one parameter the replaced photo sets.
  2. **Adds something**: the candidate sets at least one parameter that is not taken.
  3. **Everything else.**
- Inside a group: position in `project.proposal.ranking`; photos missing from it after those, newest `saved_at` first, ties by id. No ranking: all by date.
- The photo being replaced is not shown. Photos already in the project are shown, marked `inProject`.

## 3. Tiles

- Line 1: `labelsOfBrick(brick, 1)[0]?.label`, 13 px / 500, ink. No label: an empty line, so rows stay aligned.
- Line 2, 12 px muted: a starter with a credit shows a short credit; anything else shows its date as an own photo does ("Dec 27, 2025" from EXIF, else "saved Nov 3"). Malik's own starters have no credit, so they show their date, never "Malik Zhang, 2025".
- Short credit: the institution prefix is replaced from a table and the rest is kept: Minneapolis Institute of Art → Mia, The Metropolitan Museum of Art → The Met, Courtesy NASA/JPL-Caltech → NASA/JPL, Wikimedia Commons → Wikimedia. A credit with no table entry is shown whole, never cut: line 2 wraps rather than end in an ellipsis (no current credit is long enough to wrap at the tile width).
- A tile already in the project: a small check, disabled, not dimmed.
- Grid: 2 columns, 4 from `sm` (was 3/5: at 5 the text is ~108 px and labels such as "Two colors or fewer" would be cut).
- Group headers: `caption`, uppercase, `ink-2`.

## 4. Choosing

One tap swaps (the replaced photo's mute is dropped) and closes the sheet, as today. The version bump drives the change highlight on the screens (`useChangeFlash`); confirmed in the browser, no code change expected.

## Not in scope

Library order; Fine-tune's inline swap list (src/screens/Compose.tsx) keeps today's order; the harness (`meta-eval/`).

## Verification

Unit tests: ranking validation and the response, the prompt pin, groups and ordering, exclusions and checks, short credits and both caption lines. Then `npm test`, lint, build, `check:prompts` (DIFF expected on the propose pair), and the sheet on the dev server (`build-dev`, port 5176) with a seeded project and ranking. No live proposal: dev proposals are live here because the notes are sealed, so a real call needs Malik's go.
