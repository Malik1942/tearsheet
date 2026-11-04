# Tearsheet

Designers tear pages out of magazines to keep what they like. Tearsheet turns those photos into composable visual material with evidence (bricks), then apply that material to a small prototype of your own product and see, with your real content, whether the character survives.

Built for the Meta Global AI Developer Hackathon (Indie track) on the Meta Model API. Vision extraction uses Muse Spark (`muse-spark-1.3`) with a constrained JSON schema; the prototype renders locally from parameters alone.

## How it works

1. **Collect.** Drop a photo whenever you like something. It is made upright, downscaled to 2048 px, and sent once to Muse Spark with a product-agnostic prompt. The result is a *brick*: measurements (read off the image, with how they were measured), hypotheses (each resting on measurement ids, with a confidence), at most three transferable relations mapped onto a fixed parameter vocabulary or `none`, region boxes on a 0-1000 grid, and the one change that would destroy the image's character. Bricks persist in the browser; no project needs to exist.
2. **Decide what to make.** One sentence of intent creates a project.
3. **Pick materials.** Choose bricks. Each relation can be switched on or off and shows the parameter it sets. Two bricks wanting the same parameter is a conflict; you choose.
4. **See the prototype.** Two screens (a list and a year review) render immediately from the parameters with your content. Every parameter carries a provenance chip: **measured** (its relation rests on a measurement), **interpreted** (a hypothesis or a hand remap; dotted outline), or **adapted** (the shell's own default). Click a measured chip to see the region it was read from. Relations no parameter can carry appear in the "could not be expressed" strip.
5. **Lock and swap.** Lock any value. Swap one brick for another: only unlocked parameters that the new brick contributes change.
6. **Export** `parameters.json`, `tokens.css`, and `handoff.md` for a coding agent.

## Parameters

One parameter is filled in by rule rather than by the model: `alignment_edge`. The model measures where text aligns ("all text starts in the left sixth", "three lines left-aligned") but, in every run so far, never proposes alignment as a transferable relation. When a measurement about text names an edge, the product emits an `alignment_edge` candidate labeled `adapted · by rule` with that measurement as its source, so the chip says the rule did it, not the model. The same pattern maps a measured type description ("heavy wide low-contrast sans") onto a substitute font stack, and falls back to `system-ui` marked `no match` rather than guess.

Two more readings by rule:
- **A dominant title said in words.** A rule under `image_text_dominance` or `hierarchy_mode` that says a title dominates without giving a number ("an order of magnitude larger", "the title dominates", "one centered title") reads as `hierarchy_mode` type-led, `image_text_dominance` 0.2 (text-led), and the alignment the same sentence names. Each is `adapted · by rule` and cites the relation.
- **One hue keeps its accent.** `palette_hue_count` 1 normally makes the accent the text color. It keeps the accent when something sets `accent_coverage`, because one hue used once as the bright spot is the accent.

Relationship parameters carry character: `type_scale_ratio`, `hierarchy_mode`, `density`, `grouping`, `rhythm`, `alignment_edge`, `image_text_dominance`, `accent_placement`, `accent_coverage`, `palette_hue_count`. Appearance parameters are the skin: `color_bg`, `color_fg`, `color_accent`, `radius`, `type_family`, `spacing_unit`. See `src/shell/params.ts`. All of them become CSS custom properties plus six data-attribute switches; one JSON in, one render out, no generator.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

The dev server serves `/api/extract`, `/api/propose` and `/api/sync/:code` itself (the same handlers as the Vercel functions) and reads `META_API_KEY` from the environment or from `../meta-eval/.env`. The key never reaches the browser. In development, `localStorage.setItem('tearsheet.dry', '1')` makes the app send `dry: true`: both model proxies then return the request they would have sent and nothing leaves the server.

Deploy: Vercel, with `META_API_KEY` set as an environment variable and `PROPOSE_ENABLED=1` for live proposals. `api/extract.ts` (`maxDuration` 120 s; a medium-effort extraction takes 10 to 26 s), `api/propose.ts` (60 s) and `api/sync/[code].ts` (60 s) are the serverless functions. `npm run check:prompts` compares the prompts and schemas with the harness files in `../meta-eval`.

## Verification

- **UI checks** (`scripts/check-ui.js`): paste it into the browser console on the public URL and run `checkUI({ all: true })`. It reports page overflow with the offending elements, controls without a label, and images without alt text, for every main route, at whatever viewport the window has. The acceptance record in `docs/ACCEPTANCE.md` quotes its output at 375 px and 1440 px.
- **Extraction harness** (`../meta-eval`): `scripts/gate.sh --send --effort medium fixtures/images/<photo>` reproduces a brick from a photo with the same request the product sends; `PROMPT_FILE=fixtures/prompts/extract_brick_v3.md` selects the production prompt. Every live call is appended to `ledger.csv`.

## Evidence

Prompt in production: v3, sha256 `2a2e7fa5684fe352cf5ecfd8476776c07ff7c9878baa0168b05a61f1a4beba60` (the harness file `extract_brick_v3.md`; `src/lib/extractPrompt.ts` holds the same text without the final newline). It is the gated prompt (sha256 `5cb75981a5b31e823d6037af31173c8b6ba2542455a5143ccd1eecfd7bd197f4`) plus one instruction to describe the type when text is visible. A v2 that forced a layout relation was tried on the same three photos and rejected. Measured values are the model's reading in one run; another run can differ (one accent coverage moved from under 6% to under 15% between runs), which is why every value carries its provenance and nothing is treated as a single truth.

The extraction prompt and schema were gated before any of this was built: three sealed photos, one call each, judged against pre-registered notes. The harness, the sealed notes, the run report and the overlays live in `../meta-eval`. Extraction costs about $0.013 to $0.023 per photo.

## Layout

```
api/extract.ts          Vercel function: image in, Brick out (key stays server-side)
api/propose.ts          Vercel function: intent + rules in, up to three picks with verbatim quotes out (live when PROPOSE_ENABLED=1)
api/sync/[code].ts      Vercel function: the library under a six-character code in a Blob store
src/lib/                schema.ts (zod, exactly the Spark schema), extract.ts / propose.ts / sync.ts (shared with the dev server), guard.ts (call limits),
                        mapRelations.ts (relations -> parameters, provenance, conflicts, locks; the Project type), store.tsx (library, queue, projects), syncClient.ts, markdown.tsx
src/screens/            Brick, Projects (intent + proposal), Compose (desktop), Export, Sync, Open (/open?code=), Preview and Instructions (phone)
src/shell/              params.ts, shell.css, ListScreen, DetailScreen (year review), content.ts
src/bricks/             Photo, BrickCard, RegionOverlay
src/compose/            ProvenanceChip, Sheet (parameter rows), UnexpressedStrip, DesktopFooter
src/export/             parameters.json, tokens.css, handoff.md
src/fixtures/           the sample library, the three gate bricks and the step-2 compositions
scripts/                check-ui.js (console sweep), check-prompt-sha.ts (prompts and schemas against the harness)
```

The sample library holds Malik's own photos and licensed public-domain works, each with a credit line. In the product these twelve are the starters (spec v3 SB1–SB4, L7): built in, never saved or synced, `origin: "starter"`, shown under an empty Library and used by Projects only until a person has three bricks of their own; the `Include starters` checkbox hides them. The downloaded posters used in the gate and probe runs are not in the repository. The only exceptions are the public-domain and free-to-use images under Sample credits, which are kept with their credit.

## Sync

A library can be opened on another device with a six-character code (letters A–Z and digits 2–9, never 0, O, 1 or I). The code is made on the device, shown as text and as a QR code on `/sync`, and is the only key: there is no account, no listing endpoint and no index. Anyone who has the code can open the library.

What the store holds: under `libraries/<code>/` in a Vercel Blob store, one JPEG per brick at 2048 px on the long side plus a `manifest.json` with the brick values and the projects (intent, bricks, choices, proposal record; at most 50, the most recently edited). Photos are stored under that unguessable id and are not indexed. Entering a code on a second device merges by brick id, newest version wins. `Forget this code` on `/sync` deletes everything under the prefix; the bricks stay on the device that pressed it. The manifest is gone at once; the CDN can still serve a deleted photo for up to a minute. Caps: 60 bricks and 40 MB per code; one request carries at most 4 MB, so the app uploads in batches. The function authenticates with Vercel's OIDC token for the store; no long-lived token exists anywhere.

**Sharing a project** (Make → Share) never sends the library's code, the only key to the whole library.
- **What goes up:** the project and the person's own photos it uses, under a code of its own (one per project, so sharing again updates the same link). The starters ship with the app and never travel.
- **What the link opens:** `/shared?code=…&project=…`, a read-only page with the two screens and the reasons behind them.
- **What it leaves alone:** it adopts no code, merges nothing into the library of the device that opens it, and saves nothing there.

## Propose

When a project gets its one-line intent, the model proposes up to three bricks from the library (PRD P2–P3). It is a second kind of call, text only: `/api/propose` sends the intent and, for every ready brick, its id and its transferable rules with their parameter. No photo, no measurement and no hypothesis leaves the device. `muse-spark-1.3`, effort low, constrained to the schema `{ picks: [{ brick_id, quoted_rule, why }] }`, at most 4000 output tokens, `store: false`, about $0.006 a call.

The honest part is the check: each pick must quote one of that brick's rules character for character (`quoted_rule` equals the rule after trimming). A pick that paraphrases, names an unknown brick, repeats a brick or comes fourth is dropped and reported, never repaired. If nothing survives, or the call fails, the project form falls back to picking by hand with one line of text and no error modal. The accepted set is recorded on the project: each brick carries `proposed · model` with the quoted rule and the model's sentence, a swapped card carries `adapted · by you` and names what it replaced; `parameters.json` holds the whole record under `proposal`, and `handoff.md` says per brick how it got there. Picking by hand records nothing.

Live proposals are on in production (`PROPOSE_ENABLED=1` since 2026-11-03); without it the function answers 503. `GET /api/propose` returns `{ enabled }`, so the project form can say so before anyone clicks and offer picking by hand, which stays one tap away. Across three sealed runs the proposer quoted 27 of 27 rules verbatim, never matched a photo by subject, and returned stable picks. But it agreed with the designer's picks on at most one of three intents (0, then 1, then 1). Adding a designer's lean (run 3) did not change that score. On the public site, the concert intent with `dark` + `one accent` returned the Chicago photo first, both before and after the ranking sentence below was added (in its first, whole-library wording). That was one call each on 2026-11-03, with the same three picks in the same order. The ten-brick wording has not been checked live yet. We ship proposals on because the reasons are always real rules and picking by hand is one tap away, not because they match a designer's taste. The records are `../meta-eval/docs/PROPOSE_RUN_2026-11-02.md` and `PROPOSE_RUN_2026-11-03.md`. The procedure is in `../meta-eval/docs/PROPOSE.md`; `scripts/propose.sh` there builds the request the product builds for the sample library (the product sorts the library by brick id, as the harness does). Prompt: `src/lib/proposePrompt.ts`, sha256 `51fcc3a0907e79480695ee3cbd6e676d7fb156b47e382a3301c997d240487043`. It is the harness prompt the sealed runs used (`../meta-eval/fixtures/prompts/propose.md`, sha256 `6b9984be1d06547b4b86e32195555146d7391c5562e8a7567cd6b6d8445e86a7`) plus one sentence, added on 2026-11-03 for the swap sheet, asking for a ranking of the ten bricks that fit best. The schema gains the matching `ranking` field (at most ten). The sentence first asked for the whole library; one call with thirteen bricks (the twelve starters and the Chicago photo) then used 3,129 of the 4,000 output tokens (2,791 of them reasoning), and an unfinished answer fails the whole proposal, so the ranking was capped at ten and the output limit raised to 8,000 the same evening. Until the harness copies are refreshed, `npm run check:prompts` reports DIFF for the propose prompt and schema; the extract prompt and the brick schema match. Every live call writes one JSON line to the function log with tokens, cost and latency, including calls that come back unfinished or unparsed (PRD 10.4). Guards on the function: per-address 20 calls an hour and `MAX_DAILY_CALLS` a day (default 300), counted in memory.

## Why not just ask a chat

We ran the same task both ways on 2026-11-03, one call each. The input was the twelve sample photos plus one of our own (a December 2025 photo of the CHICAGO marquee over a stage) and the intent "a concert log for someone who goes to a lot of shows".
- **The chat:** the same model Tearsheet uses (`muse-spark-1.3`, effort low) with the thirteen photos attached to one plain message: no system prompt, no schema, no rules.
- **Tearsheet:** the live proposal on the public site, with a lean of `dark` + `one accent`.

| | General chat | Tearsheet |
|---|---|---|
| Surfaced the photo we hadn't thought of (CHICAGO) | yes, "for *content* reference, not style": it is "the only actual live-performance photo" | yes, first pick, quoting its rule "restrict the single warm accent to under 10% of frame …" |
| Reason lands on a screen element | partly: "header title, subhead info, footer details" for a template it does not show | yes: the quoted rule sets `accent_coverage`; the photo's title rule moves the list and year-review titles |
| We kept the change | no screen changed, so there was nothing to keep | yes: the title-led layout is the shot in the video |

**The chat picked it because it's a concert. Tearsheet picked it because of a rule, and it never saw the photo.** The chat also set aside the three car photos because they are cars ("wrong subject"). Tearsheet picked a car photo (g2) for the same kind of accent rule, and the change shows on the screen with its provenance. The chat's answer is kept verbatim in `../meta-eval/docs/FAIR_COMPARISON_2026-11-03.md`.

## Measured by mask (after the video)

SAM 3.1 passed its gate on 2026-11-03: 2 of 3 photos, with masks tight on discrete objects (the taillights, the lit sign, the audience) and missing or partial on soft, out-of-focus or flat regions. Two runs on the same photo were identical. Mask-measured subject share and accent coverage land after the video. They will be used only for sharp, separate objects; everything else keeps the model's estimate, labeled `estimated`. The gate record is `../meta-eval/docs/SAM_GATE.md`.

## Phone

Tearsheet is installable (`manifest.webmanifest`, a service worker that caches the app shell and never `/api/`). On a phone, `Shoot` opens the camera and `Add from library` takes several photos; the queue sends two at a time and shows `Saved N · reading M`. Compose stays desktop-only. Two read-only routes make a project useful on the phone that collected it:

- `/project/:id/preview`: List and Year review full-width, swipe or tap to switch; below, the ten relationship rows with their provenance chips and the Could-not-be-expressed list.
- `/project/:id/instructions`: `handoff.md` rendered as a page, from the same generator as Export (bricks with thumbnails, every parameter with its origin, unexpressed list, conflicts and choices).

Both end in a sticky footer, `Open on desktop to compose`: each tap first uploads the library and the project under the library's code (a library without one gets a code on its first tap), then offers a link of the form `/open?code=XXXXXX&project=<id>` to copy, or to the system share sheet where there is one. Copy and Share are their own tap because iOS Safari only allows them inside a user gesture. Opening the link on another device adopts the code, merges the library, and lands in that project: Compose on a wide screen, the preview on a phone. A code with nothing stored under it is not adopted. Projects travel with the bricks: the sync manifest holds them next to the bricks, merged by id with the newest `updatedAt` winning.

## Sample credits

`public/samples/` holds the sample library. `g1`, `g2`, `calmmouse`, `greencar` and `c1` are the author's own photos. The images below were picked by axis, not by looks: type only, image only, all-over pattern, at least 60% negative space, a single accent colour, and black and white, plus one counterpoint. They were downscaled to 2048 px on the long edge, the extraction size, and each file name is its slug. Wherever the product shows one of these images, it carries the line in the Credit column.

| Slug | Axis | Credit | Work | License | Source |
|---|---|---|---|---|---|
| `bauhaus-1923-staatliches-bauhaus-weimar` | Type only: letters fill the cover, no image | Minneapolis Institute of Art, 1923 | Herbert Bayer and László Moholy-Nagy, *Staatliches Bauhaus in Weimar 1919–1923*, cover | Public Domain (Mia rights field) | [Mia 40353](https://collections.artsmia.org/art/40353) |
| `haeckel-1904-trochilidae-plate-99` | Image only, no text; dense, four hue families | Wikimedia Commons, 1904 | Ernst Haeckel, *Kunstformen der Natur*, plate 99, Trochilidae | Public domain (Commons PD-old) | [Commons](https://commons.wikimedia.org/wiki/File:Haeckel_Trochilidae.jpg) |
| `iran-1260s-star-cross-luster-tiles` | All-over repeat with no focal point; the highest edge density of the 18 designed candidates | The Metropolitan Museum of Art, 1260–70 | Panel of star and cross tiles, Kashan | Met Open Access, public domain | [Met 450438](https://www.metmuseum.org/art/collection/search/450438) |
| `matthews-19c-glyphography-trade-card` | Negative space: 88% of pixels are paper colour; centre axis | The Metropolitan Museum of Art, 19th century | Trade card for Charles H. Matthews, glyphographic draughtsman | Met Open Access, public domain | [Met 813051](https://www.metmuseum.org/art/collection/search/813051) |
| `lissitzky-1923-dlya-golosa` | Single accent: red is the only hue, about 7% of pixels, on cream with black | Minneapolis Institute of Art, 1923 | El Lissitzky, *Dlya Golosa* (For the Voice), page | Public Domain (Mia rights field) | [Mia 8553](https://collections.artsmia.org/art/8553) |
| `secession-1902-beethoven-catalogue` | Black and white: 0.3% chromatic pixels; a woodcut with one caption line | Minneapolis Institute of Art, 1902 | Ernst Stöhr, woodcut in the catalogue of the 14th Vienna Secession exhibition (Beethoven) | Public Domain (Mia rights field) | [Mia 119894](https://collections.artsmia.org/art/119894) |
| `jpl-2016-visions-mars` | Counterpoint: the most saturated hues, image-led, large sans title at the bottom | Courtesy NASA/JPL-Caltech | NASA/JPL, *Visions of the Future: Mars* | JPL image use policy: free to use with credit, no logos, no implied endorsement | [JPL](https://www.jpl.nasa.gov/galleries/visions-of-the-future/) |
