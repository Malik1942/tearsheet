# Photo tray: every photo, one signal, a caption that says what moved, three slots

Approved by Malik 2026-11-04 ("Yes, write them"). Make's photo row only (src/screens/Make.tsx, src/lib/makeFlow.ts, src/chrome/tokens.css, src/make/Dialogs.tsx, src/lib/swapSheet.ts).

## Why

Two screenshots of one board project (CalmMouse, MARS, Lissitzky) read as two unrelated states. Reproduced with the samples:

- All on: CalmMouse is first and sets every skin key and three relationship keys; MARS sets nothing, so `photoRow` leaves it out and the tray shows two photos in three slots.
- CalmMouse tapped off: MARS sets its share and appears, the skin moves to the next photo, and the whole look changes. The only feedback is "Big type contrast · off" for two seconds: CalmMouse's first short label, which reads like a setting, not a photo.
- On has no mark at all (the CSS comment promises a 2 px ring; no rule draws one), so a pale photo that is on looks off.
- An empty slot draws nothing, so a missing third photo looks taken away rather than open.

## 1. Every photo stays in the row

- `photoRow(project, bricks)` returns one chip per id in `project.brickIds` that resolves to a brick, in that order. Nothing is filtered out.
- `PhotoChip` gains `status: 'used' | 'off' | 'unused'`:
  - `off`: the photo is muted.
  - `used`: not muted, and at least one parameter on the screens has it as `source.brickId`.
  - `unused`: not muted, and it sets nothing (earlier photos, a lock or a value set by hand took everything it would set).
- `muted` stays (it is `status === 'off'`) so callers that read it keep working. `label` is computed as today (`oneLabel`, judged with the photo unmuted).

## 2. One signal: the callout number

**Revision, 2026-11-04 (moved onto origin/main, Malik: "make changes on my newest designs"):** main already marks an on photo with its numbered callout (the slot number on the thumbnail, and from the tablet up a leader to what it changes). A ring on top would be a second mark for the same state, so the ring is dropped and the number is the one signal.

- `used`: the photo as it is with its callout number (its slot number, `i + 1`). This is the only "it shapes the screens" mark, and only these photos get a leader.
- `off`: faded and grey, as today, no number.
- `unused`: the photo as it is, no number, no fade (main gave it a number with no leader).
- No new corner mark; ⇄ and the carry-over dot keep their corners.
- The button keeps `aria-pressed={!muted}`. Its `aria-label` is the photo's name, plus `, not used` when `unused`.

## 3. The caption says what moved

The caption still shows above the photo for two seconds after a tap (`CAPTION_MS`), and on hover on a desktop (the photo's name, as today).

- Pure, in makeFlow: `effectOf(before: Resolved['values'], after: Resolved['values'])` returns the families whose **value** changed, in the order Colors, Type, Layout. A key whose value is equal and whose source moved is not a change (CalmMouse and MARS can both say Helvetica; the screens do not move).
  - Colors: `color_bg`, `color_fg`, `color_accent`, `palette_hue_count`, `accent_placement`, `accent_coverage`
  - Type: `type_family`, `type_scale_ratio`, `hierarchy_mode`
  - Layout: `density`, `grouping`, `rhythm`, `alignment_edge`, `image_text_dominance`, `spacing_unit`, `radius`
- Pure, in makeFlow: `toggleCaption(project, bricks, id)` resolves the project as it is and with `id` toggled, and returns the text for after the tap, the first that applies:
  1. the photo sets nothing when on (it is, or would be, `unused`), either direction: `Not used: earlier photos set the same things`
  2. turning off, something moved: `{Families} removed`
  3. turning on, something moved: `{Families} back`
  4. otherwise (it sets values the screens already had): `No visible change`
- Families join as `Colors`, `Colors and type`, `Colors, type and layout` (first capitalized, the rest lowercase).
- Copy, verbatim: `removed`, `back`, `added`, `No visible change`, `Not used: earlier photos set the same things`.
- `isOn` / `isOff` and the `· on` / `· off` caption are removed.

## 4. Three slots, the empty ones open

- The row always has at least three slots (`--slots` is already `max(3, photos.length)`). Each slot with no photo holds an add button: a thumbnail-sized frame with a 1 px dashed `var(--line)` border and a `+`, `aria-label="Add a photo"`, the same 44 px touch target as the other controls.
- With three or more photos there are no empty slots and no add button (⋯ → Pick photos myself still allows up to five).
- Tap opens the existing swap sheet with the title `Add a photo` and the empty-state line `No other photo to add.`. Groups come from `swapGroups(project, pool, '', bricks)`: no photo is being replaced, so Same job is empty and the sheet shows Adds something, then Everything else. Photos already in the project show the check and cannot be chosen, as in a swap.
- One tap appends the photo to the end of `brickIds` (lowest priority, so it does not take over what is already there) and closes the sheet. The version bump runs the change highlight, as a swap does.
- After an add, the caption shows over the new photo for two seconds: `{Families} added`, or `Not used: earlier photos set the same things` when it sets nothing. The added photo can be moved first with ⋯ → Try another arrangement.

## 5. Layout and marks (2026-11-04, on main 2059b59; Malik: "refine the visual, especially the spacing and gaps … not matching my branding"; mockup approved "Build as mocked")

What was wrong on main, measured at 375:
- 56 px photos sat centered in 106 px slots, about 58 between them, the first at x 45 rather than the 20 px gutter (DESIGN_SYSTEM §7, one left edge).
- Three marks of three sizes on each photo: ⇄ 20 at the upper left, a black count 16 at the upper right, the blue number 20 at the lower left.
- The black count is a number that is not a photo, against §5 ("no number means two things").
- The row ended 8 above the tab bar, and main's 60 px shutter, which rises 13 above the bar, covered the middle photo.

Now:
- **Row:** 64 px photos on the left edge with an even 12 between them (`--thumb` on `.photo-row`). Past three photos on a phone the thumbnails shrink to keep the gaps inside the gutters. From the tablet up the dock sits in the intent's own 680 column, so the h1, the label and the first photo share one left edge.
- **Label line over the row:** `From your photos` (mono caption, uppercase, muted) at the left. When anything couldn't carry over, `{n} rule(s) didn’t carry over ›` sits at the right. It opens one list for the project, `Didn’t carry over`, grouped by photo. Each group is headed by the photo's thumbnail and its own title, not its short label, because two photos can share a label.
- **Marks:** at most two, both 20 px, inside opposite corners on the photo. The callout number sits at the lower left (used photos only). ⇄ sits at the upper right (always on a phone, on hover or focus on a desktop). The black count is gone.
- **Targets:** ⇄'s target is 32 × 28 and grows up and out only. Grown inward, it took 32% of the photo's own tap (measured), so a tap meant to switch a photo off opened Swap. The count line's target is 28 tall. Neither overlaps the other, a neighbour or the photo beyond the mark. Both are above WCAG 2.5.8's 24 px.
- **Clearance:** on a phone the dock is padded 12 / 32, so the row clears the shutter.

## Not in scope

Standing labels under each photo; ⇄ and the carry-over dot; Fine-tune (src/screens/Compose.tsx); the propose call, its prompt and the pick limits (three proposed, five by hand); `meta-eval/`.

## Verification

Unit tests in `scripts/makeflow.test.ts` and `scripts/swapsheet.test.ts`, expected values typed out from this spec: the three statuses (including the existing Chicago/echo cases, which now keep echo as `unused`), `effectOf` families and the value-only rule, every `toggleCaption` branch, the add groups with no Same job. Then `npm test`, `npm run lint`, `npm run build`, and the tray on the dev server with the CalmMouse, MARS and Lissitzky samples: all on (MARS shows, no ring), CalmMouse off (ring moves, caption names the families), and a two-photo project (one add slot, adding MARS appends it). No live proposal: `/api/propose` is stubbed and `localStorage['tearsheet.dry'] = '1'`. No commits: Malik commits on request.
