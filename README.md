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

Relationship parameters carry character: `type_scale_ratio`, `hierarchy_mode`, `density`, `grouping`, `rhythm`, `alignment_edge`, `image_text_dominance`, `accent_placement`, `accent_coverage`, `palette_hue_count`. Appearance parameters are the skin: `color_bg`, `color_fg`, `color_accent`, `radius`, `type_family`, `spacing_unit`. See `src/shell/params.ts`. All of them become CSS custom properties plus six data-attribute switches; one JSON in, one render out, no generator.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

The dev server serves `/api/extract` itself (same handler as the Vercel function) and reads `META_API_KEY` from the environment or from `../meta-eval/.env`. The key never reaches the browser. Tick "dry run" on the Collect page to build the request without sending it.

Deploy: Vercel, with `META_API_KEY` set as an environment variable. `api/extract.ts` is the serverless proxy (`maxDuration` 120 s; a medium-effort extraction takes 10 to 26 s).

## Evidence

Prompt in production: v3, sha256 `2a2e7fa5684fe352cf5ecfd8476776c07ff7c9878baa0168b05a61f1a4beba60` (`src/lib/extractPrompt.ts`). It is the gated prompt (sha256 `5cb75981a5b31e823d6037af31173c8b6ba2542455a5143ccd1eecfd7bd197f4`) plus one instruction to describe the type when text is visible. A v2 that forced a layout relation was tried on the same three photos and rejected. Measured values are the model's reading in one run; another run can differ (one accent coverage moved from under 6% to under 15% between runs), which is why every value carries its provenance and nothing is treated as a single truth.

The extraction prompt and schema were gated before any of this was built: three sealed photos, one call each, judged against pre-registered notes. The harness, the sealed notes, the run report and the overlays live in `../meta-eval`. Extraction costs about $0.013 to $0.023 per photo.

## Layout

```
api/extract.ts          Vercel function: image in, Brick out (key stays server-side)
src/lib/                schema.ts (zod, exactly the Spark schema), extract.ts (shared with the dev server), mapRelations.ts (relations -> parameters, provenance, conflicts, locks), store.tsx
src/shell/              params.ts, shell.css, ListScreen, DetailScreen (year review), content.ts
src/bricks/             BrickCard, RegionOverlay
src/compose/            ParameterPanel, RelationList, ProvenanceChip, UnexpressedStrip
src/export/             parameters.json, tokens.css, handoff.md
src/fixtures/           the three gate bricks and the step-2 compositions
```

Reference photos and screenshots that show downloaded material are kept out of the repository. The only exceptions are the public-domain and free-to-use images under Sample credits, which are kept with their credit.

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
