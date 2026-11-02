# Bricks

Turn a few photos of things you like into composable visual material with evidence, then apply that material to a small prototype of your own product and see, with your real content, whether the character survives.

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

Reference photos and screenshots that show downloaded material are kept out of the repository.
