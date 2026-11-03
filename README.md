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

Relationship parameters carry character: `type_scale_ratio`, `hierarchy_mode`, `density`, `grouping`, `rhythm`, `alignment_edge`, `image_text_dominance`, `accent_placement`, `accent_coverage`, `palette_hue_count`. Appearance parameters are the skin: `color_bg`, `color_fg`, `color_accent`, `radius`, `type_family`, `spacing_unit`. See `src/shell/params.ts`. All of them become CSS custom properties plus six data-attribute switches; one JSON in, one render out, no generator.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

The dev server serves `/api/extract`, `/api/propose` and `/api/sync/:code` itself (the same handlers as the Vercel functions) and reads `META_API_KEY` from the environment or from `../meta-eval/.env`. The key never reaches the browser. In development, `localStorage.setItem('tearsheet.dry', '1')` makes the app send `dry: true`: both model proxies then return the request they would have sent and nothing leaves the server.

Deploy: Vercel, with `META_API_KEY` set as an environment variable, `PROPOSE_ENABLED=1` once the proposal set has passed. `api/extract.ts` (`maxDuration` 120 s; a medium-effort extraction takes 10 to 26 s), `api/propose.ts` (60 s) and `api/sync/[code].ts` (60 s) are the serverless functions. `npm run check:prompts` compares the prompts and schemas with the harness files in `../meta-eval`.

## Verification

- **UI checks** (`scripts/check-ui.js`): paste it into the browser console on the public URL and run `checkUI({ all: true })`. It reports page overflow with the offending elements, controls without a label, and images without alt text, for every main route, at whatever viewport the window has. The acceptance record in `docs/ACCEPTANCE.md` quotes its output at 375 px and 1440 px.
- **Extraction harness** (`../meta-eval`): `scripts/gate.sh --send --effort medium fixtures/images/<photo>` reproduces a brick from a photo with the same request the product sends; `PROMPT_FILE=fixtures/prompts/extract_brick_v3.md` selects the production prompt. Every live call is appended to `ledger.csv`.

## Evidence

Prompt in production: v3, sha256 `2a2e7fa5684fe352cf5ecfd8476776c07ff7c9878baa0168b05a61f1a4beba60` (the harness file `extract_brick_v3.md`; `src/lib/extractPrompt.ts` holds the same text without the final newline). It is the gated prompt (sha256 `5cb75981a5b31e823d6037af31173c8b6ba2542455a5143ccd1eecfd7bd197f4`) plus one instruction to describe the type when text is visible. A v2 that forced a layout relation was tried on the same three photos and rejected. Measured values are the model's reading in one run; another run can differ (one accent coverage moved from under 6% to under 15% between runs), which is why every value carries its provenance and nothing is treated as a single truth.

The extraction prompt and schema were gated before any of this was built: three sealed photos, one call each, judged against pre-registered notes. The harness, the sealed notes, the run report and the overlays live in `../meta-eval`. Extraction costs about $0.013 to $0.023 per photo.

## Layout

```
api/extract.ts          Vercel function: image in, Brick out (key stays server-side)
api/propose.ts          Vercel function: intent + rules in, up to three picks with verbatim quotes out (off until PROPOSE_ENABLED=1)
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

The sample library holds Malik's own photos and licensed public-domain works, each with a credit line. The downloaded posters used in the gate and probe runs are not in the repository. The only exceptions are the public-domain and free-to-use images under Sample credits, which are kept with their credit.

## Sync

A library can be opened on another device with a six-character code (letters A–Z and digits 2–9, never 0, O, 1 or I). The code is made on the device, shown as text and as a QR code on `/sync`, and is the only key: there is no account, no listing endpoint and no index. Anyone who has the code can open the library.

What the store holds: under `libraries/<code>/` in a Vercel Blob store, one JPEG per brick at 2048 px on the long side plus a `manifest.json` with the brick values and the projects (intent, bricks, choices, proposal record; at most 50, the most recently edited). Photos are stored under that unguessable id and are not indexed. Entering a code on a second device merges by brick id, newest version wins. `Forget this code` on `/sync` deletes everything under the prefix; the bricks stay on the device that pressed it. The manifest is gone at once; the CDN can still serve a deleted photo for up to a minute. Caps: 60 bricks and 40 MB per code; one request carries at most 4 MB, so the app uploads in batches. The function authenticates with Vercel's OIDC token for the store; no long-lived token exists anywhere.

## Propose

When a project gets its one-line intent, the model proposes up to three bricks from the library (PRD P2–P3). It is a second kind of call, text only: `/api/propose` sends the intent and, for every ready brick, its id and its transferable rules with their parameter. No photo, no measurement and no hypothesis leaves the device. `muse-spark-1.3`, effort low, constrained to the schema `{ picks: [{ brick_id, quoted_rule, why }] }`, at most 4000 output tokens, `store: false`, about $0.006 a call.

The honest part is the check: each pick must quote one of that brick's rules character for character (`quoted_rule` equals the rule after trimming). A pick that paraphrases, names an unknown brick, repeats a brick or comes fourth is dropped and reported, never repaired. If nothing survives, or the call fails, the project form falls back to picking by hand with one line of text and no error modal. The accepted set is recorded on the project: each brick carries `proposed · model` with the quoted rule and the model's sentence, a swapped card carries `adapted · by you` and names what it replaced; `parameters.json` holds the whole record under `proposal`, and `handoff.md` says per brick how it got there. Picking by hand records nothing.

Live proposals are off in production: the function answers 503 unless `PROPOSE_ENABLED=1` is set in the deployment, and it is not set. `GET /api/propose` returns `{ enabled }`, so the project form says so before anyone clicks and offers picking by hand. The dev server also turns live proposals on when `../meta-eval/fixtures/propose_notes.md` is sealed (its `.sha256` beside it matches). The sealed proposal set has run twice (2026-11-02, six calls): every quoted rule was verbatim, but the picks overlapped the sealed ones in only one of three intents per run, so the set failed as sealed and production stays off; the record is `../meta-eval/docs/PROPOSE_RUN_2026-11-02.md`. The procedure is in `../meta-eval/docs/PROPOSE.md`; `scripts/propose.sh` there builds the request the product builds for the sample library (the product sorts the library by brick id, as the harness does). Prompt: `src/lib/proposePrompt.ts`, sha256 `11156a48cd52eec26614fb0c1264a157e74b9e23323cd216da5fbd3d88447c38`, identical to `../meta-eval/fixtures/prompts/propose.md`; `npm run check:prompts` verifies both prompts and both schemas against the harness files. Every live call writes one JSON line to the function log with tokens, cost and latency, including calls that come back unfinished or unparsed (PRD 10.4). Guards on the function: per-address 20 calls an hour and `MAX_DAILY_CALLS` a day (default 300), counted in memory.

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
