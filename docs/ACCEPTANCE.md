# Acceptance record (PRD 08 §10.3)

Public URL under test: https://tearsheet-malik1942s-projects.vercel.app (commit 5739bf5 + 049fb4f). Times are America/Los_Angeles. "Pass" means the step was performed and the stated result observed; "not run" names who or what it waits on. Nothing here is inferred from code alone.

| # | Test | Result | When | Evidence |
|---|---|---|---|---|
| 1 | Public URL → empty Library → `Load sample library` populates in < 2 s | **pass** | 2026-11-02 22:55 | 12 cards in 102 ms after the click, 7 credit lines, 0 broken images (console: `document.images` with naturalWidth 0) |
| 2 | iPhone Safari: `Shoot` opens the camera; a portrait photo becomes a brick with regions on the right things | **not run** | | Needs Malik's iPhone on the public URL. `Shoot` with `capture="environment"` is not built yet (PRD L2); today's button opens the file picker |
| 3 | iPhone: select 5 photos at once → queue counts → all five become bricks or `unparsed` | **not run on iPhone** | 2026-11-02, desktop Chromium, dev dry switch | Built (PRD L3, L5). Desktop check: three files through `Add from library` → header `Saved 6 · reading 3`, two cards Reading, one Queued, counts tick down; a brick left mid-flight is sent again on reload; `Try again` makes a `v2` brick, keeps the old one hidden, and is disabled after the one retry. iPhone run still owed |
| 4 | Sync: code on phone → entered on desktop → same bricks with thumbnails | **not run** | | Sync is not built (PRD S1–S5) |
| 5 | Intent → three proposals, each reason a verbatim rule from that brick | **not run** | | Propose is not built (PRD P2–P3); `fixtures/propose_notes.md` must be sealed by Malik before any proposal call |
| 6 | Compose: swapping one brick changes only its rows; locked brick survives Rotate; conflict row appears when two bricks set `accent_coverage` | **pass** | 2026-11-02 22:58 | On the public URL, project g1/g2/calmmouse: Conflicts lists image_text_dominance, accent_coverage, palette_hue_count. Lock on the top brick, Rotate: the locked brick stays on top. Swap g2 → greencar: the only changed sheet row is `rhythm` (greencar's r3); every other row unchanged |
| 7 | Neutral skin on: the three sample bricks still produce three distinguishable List screens, judged blind by someone who has not seen the photos | **not run** | | Needs a person who has not seen the photos. Screenshots at phone size with the neutral skin exist for g1/g2/g3 (bricks/docs/screens/neutral_*.jpg, local only); the default sample set is now g1/g2/calmmouse and needs a fresh set |
| 8 | Unexpressed list shows every `none` relation and the fragile sentence; the empty message appears when a brick has none | **pass, with a note** | 2026-11-02 22:58 | The list on the public project shows the fragile sentence of each brick and every unreadable rule. The empty message "Everything from these bricks found a slot." renders only for a project with no bricks, because every brick carries a fragile sentence and the PRD (C7) tags it as unexpressed; the two sentences of the test cannot both hold for a brick with a fragile line |
| 9 | `tokens.css` export compiles in an empty Vite project | **pass** | 2026-11-02 23:02 | `exportCss` output for g1/g2/calmmouse written to an empty folder with an `index.html` that reads `--font-family`, `--color-bg`, `--title-size`; `vite build` exit 0, 0.80 kB CSS, `--type-scale-ratio` present in the built stylesheet |
| 10 | Repo: no key, no downloaded posters, `fixtures/images/` ignored, sample photos are Malik's or credited | **pass** | 2026-11-02 22:55 | `git ls-files` has no g3, probe, smoke or .env file; `public/samples/` = 5 own photos + 7 credited public-domain works (README "Sample credits"); no `LLM_` strings in tracked text. meta-eval is not a git repository, its `fixtures/images/` never leaves the machine |

## UI checks (spec 07 polish: nothing clips, nothing unlabeled)

`scripts/check-ui.js` pasted into the console, 2026-11-02 22:35, local build identical to the deployed commit:

| Route | 375 px overflow | 1440 px overflow | Unlabeled controls | Images without alt |
|---|---|---|---|---|
| `/` | no | no | 0 | 0 |
| `/brick/calmmouse` | no | no | 0 | 0 |
| `/projects` | no | no | 0 | 0 |
| `/project/:id` | no (frames shrink to the column) | no | 0 | 0 |
| `/project/:id/export` | no | no | 0 | 0 |

## Credit links (sample library)

Checked 2026-11-02 22:55 with curl: Mia 40353, 8553, 119894 and Wikimedia Commons return 200; the two Met pages return 429 (rate limiting a non-browser client) and the JPL gallery returns 403 (bot protection). None is a broken link; a browser opens all seven.
