# Acceptance record (PRD 08 §10.3)

Public URL under test: https://tearsheet-malik1942s-projects.vercel.app (commit 5739bf5 + 049fb4f). Times are America/Los_Angeles (PST), read from the session logs and git; the first version of this file stamped them about five hours late. "Pass" means the step was performed and the stated result observed; "not run" names who or what it waits on. Nothing here is inferred from code alone.

| # | Test | Result | When | Evidence |
|---|---|---|---|---|
| 1 | Public URL → empty Library → `Load sample library` populates in < 2 s | **pass** | 2026-11-02 17:48 | 12 cards in 102 ms after the click, 7 credit lines, 0 broken images (console: `document.images` with naturalWidth 0) |
| 2 | iPhone Safari: `Shoot` opens the camera; a portrait photo becomes a brick with regions on the right things | **not run** | | Needs Malik's iPhone on the public URL. `Shoot` with `capture="environment"` (PRD L2) is built and live since 679b937; it has not been tried on a phone yet |
| 3 | iPhone: select 5 photos at once → queue counts → all five become bricks or `unparsed` | **not run on iPhone** | 2026-11-02, desktop Chromium, dev dry switch | Built (PRD L3, L5). Desktop check: three files through `Add from library` → header `Saved 6 · reading 3`, two cards Reading, one Queued, counts tick down; a brick left mid-flight is sent again on reload; `Try again` makes a `v2` brick, keeps the old one hidden, and is disabled after the one retry. iPhone run still owed |
| 4 | Sync: code on phone → entered on desktop → same bricks with thumbnails | **pass (one browser, two profiles)** | 2026-11-02, dev server against the real Blob store | Device A: 12 samples + 1 photo brick → `Make a code and upload` → 13 under the code, the photo at `libraries/<code>/<id>.jpg`. Device B (storage wiped): entered the code → 13 bricks, the photo served from the Blob URL and rendered at 1200 px. `Forget this code` → the prefix is empty at once and the local photo is inlined. Bad code → 400; unknown code → empty manifest. Phone ↔ desktop run with Malik's iPhone still owed |
| 5 | Intent → three proposals, each reason a verbatim rule from that brick | **built; live call not run** | 2026-11-02 18:33–18:38, dev server | `/api/propose` and the proposal UI are built (PRD P2–P3). Server: the quoted rule must equal one of the brick's rules after trimming; paraphrases, unknown ids, repeats and a fourth pick are dropped and reported (assertions in a tsx script: verbatim kept, `colour` for `color` dropped, unknown id dropped, duplicate dropped; 20 calls an hour per address then 429; dry mode returns the request; switched off → 503; no key → 500). UI: with the dev server's 503 (proposals are off until the set is sealed) the form falls back to picking by hand with one line of text and no modal. With `/api/propose` answered by a canned proposal injected into the page (three real rules of g1, g2 and calmmouse, one dropped pick), the three cards show the quoted rule, the model's sentence and `proposed · model`; Swap g2 → greencar shows `adapted · by you` and names g2; Accept all creates the project, Compose shows the tags on the materials, `parameters.json` carries `proposal` (picks g1:proposed, greencar:swapped, calmmouse:proposed, dropped 1) and `handoff.md` says per brick how it got there. The product has made no live proposal call. Afterwards the proposal notes were sealed and the harness ran the set twice with Malik's go (six calls, every quoted rule verbatim): sealed sets v1 and v2, 0 of 3 then 1 of 3 intents passed (`../meta-eval/docs/PROPOSE_RUN_2026-11-02.md`). Shipped off by decision: production keeps `PROPOSE_ENABLED` unset, and the form reads `GET /api/propose` and offers picking by hand |
| 6 | Compose: swapping one brick changes only its rows; locked brick survives Rotate; conflict row appears when two bricks set `accent_coverage` | **pass** | 2026-11-02 17:49 | On the public URL, project g1/g2/calmmouse: Conflicts lists image_text_dominance, accent_coverage, palette_hue_count. Lock on the top brick, Rotate: the locked brick stays on top. Swap g2 → greencar: the only changed sheet row is `rhythm` (greencar's r3); every other row unchanged |
| 7 | Neutral skin on: the three sample bricks still produce three distinguishable List screens, judged blind by someone who has not seen the photos | **not run** | | Needs a person who has not seen the photos. Screenshots at phone size with the neutral skin exist for g1/g2/g3 (bricks/docs/screens/neutral_*.jpg, local only); the default sample set is now g1/g2/calmmouse and needs a fresh set |
| 8 | Unexpressed list shows every `none` relation and the fragile sentence; the empty message appears when a brick has none | **pass, with a note** | 2026-11-02 17:49 | The list on the public project shows the fragile sentence of each brick and every unreadable rule. The empty message "Everything from these bricks found a slot." renders only for a project with no bricks, because every brick carries a fragile sentence and the PRD (C7) tags it as unexpressed; the two sentences of the test cannot both hold for a brick with a fragile line |
| 9 | `tokens.css` export compiles in an empty Vite project | **pass** | 2026-11-02 17:49 | `exportCss` output for g1/g2/calmmouse written to an empty folder with an `index.html` that reads `--font-family`, `--color-bg`, `--title-size`; `vite build` exit 0, 0.80 kB CSS, `--type-scale-ratio` present in the built stylesheet |
| 10 | Repo: no key, no downloaded posters, `fixtures/images/` ignored, sample photos are Malik's or credited | **pass** | 2026-11-02 17:47 | `git ls-files` has no g3, probe, smoke or .env file; `public/samples/` = 5 own photos + 7 credited public-domain works (README "Sample credits"); no `LLM_` strings in tracked text. meta-eval was not a git repository then; since 19:12 it is a private one, and its `.gitignore` keeps `fixtures/images/` out, so those images still never leave the machine |

## Phone-first additions (2026-11-02 18:37–18:42, dev server on localhost)

What was checked by hand in the dev browser. Nothing here has run on an iPhone or on the public URL yet.

| Check | Result | Evidence |
|---|---|---|
| `/project/:id/preview` at 375 px | **pass** | List and Year review each fill the 375 px width at 592 px tall; scroll-snap swipe to the second pane marks `Year review` selected; tapping `List` scrolls back. Below: the bricks, ten relationship rows with provenance chips, the Could-not-be-expressed list (the `none` rule and each fragile sentence). Footer is fixed. |
| `/project/:id/instructions` at 375 px | **pass** | Renders the Export generator's `handoff.md` as a page: title, eight sections, three brick thumbnails loaded, sixteen nested rule and note lines, and the proposal sentence per brick. `Copy handoff.md` copies the download text. |
| `Open on desktop to compose` footer | **pass** | On a library with no code, the first tap made code `XQ2SNA`, uploaded the twelve sample bricks and the project to the real Blob store, and produced `/open?code=XQ2SNA&project=<id>`. The headless browser blocks the clipboard, so the link appeared in the fallback field. After review the footer syncs on every tap (a project made after the code existed was otherwise never uploaded) and Copy/Share became their own tap for iOS. `navigator.share` is absent on desktop Chromium, so the `Share` button stayed hidden there; on phones it opens the share sheet. |
| `/open?code=…&project=…` on a fresh device | **pass** | With local storage wiped: at 1280 px the link merged twelve bricks and the project and landed in Compose with g1, greencar and calmmouse; at 375 px it landed on `/preview`. A bad code shows "This link has no valid library code." |
| `/sync` | **pass** | The QR now encodes the `/open?code=` link; `Copy link` (or `Share link` on phones) sits next to `Sync now`. |
| UI sweep at 375 px | **pass** | `/`, `/projects`, `/project/:id/preview`, `/project/:id/instructions`, `/project/:id` (phone notice now links Preview and Instructions), `/sync`, `/open`: no page overflow, 0 unlabeled controls, 0 images without alt. |

## UI checks (spec 07 polish: nothing clips, nothing unlabeled)

The same checks run inline in the console (saved as `scripts/check-ui.js` at 17:48), 2026-11-02 17:43–17:45, on the dev server with the code committed at 17:45 as 5739bf5:

| Route | 375 px overflow | 1440 px overflow | Unlabeled controls | Images without alt |
|---|---|---|---|---|
| `/` | no | no | 0 | 0 |
| `/brick/calmmouse` | no | no | 0 | 0 |
| `/projects` | no | no | 0 | 0 |
| `/project/:id` | no (frames shrink to the column) | no | 0 | 0 |
| `/project/:id/export` | no | no | 0 | 0 |

## Credit links (sample library)

Checked 2026-11-02 17:47 with curl: Mia 40353, 8553, 119894 and Wikimedia Commons return 200; the two Met pages return 429 (rate limiting a non-browser client) and the JPL gallery returns 403 (bot protection). None is a broken link; a browser opens all seven.
