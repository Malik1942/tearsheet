# Tearsheet design system: Measured drawing

**Color rule.** Ultramarine marks what Tearsheet traced to a photo (the READING crosses and line, region boxes, the numbered callouts that tie a photo to the screens, the m and r ids), always on a white halo and never on graphite, plus one solid field, the Library's count block; everything else is graphite on white.

**Bleed rule.** A number bleeds off an edge only from a solid field; inside an outline it sits whole.

Adopted on 2026-11-04 from Round 2, tile M, with Malik's changes: both counts are solid graphite blocks, Make has no dimension lines and no title block, and Details gains a plain reading. It replaces C+D's color and material; the warm paper and the brick red are retired. C+D's type, layouts and non-color rules stay (§12). All values live in `src/chrome/tokens.css`.

## 1. Palette

| Token | Value | Role |
|---|---|---|
| `--paper` | `#FFFFFF` | Page, every zone, raised surfaces. Elevation is a 1 px rule, never a shadow. |
| `--ink` | `#1B1E21` | Graphite: text, display type, buttons, tabs, Make's count block, toasts, focus rings. |
| `--ink-2` | `#727475` | Muted graphite: captions, credits, the issue line, placeholders, an input's edge. |
| `--line`, `--rule` | graphite at 12% (`#E4E4E4` on white) | 1 px rules. Decoration only. |
| `--trace` | `#2338E8` | Ultramarine: traces, and the Library's count block (the color rule). |
| `--halo` | `#FFFFFF` | Sits under every trace mark on a photo or a screen. |
| `--measured`, `--interpreted`, `--adapted` | `#1B1E21`, `#727475`, `#8A8C8E` | Provenance chips: filled, dotted, outlined. |
| `--accent` | `var(--trace)` | Old name. `shell.css` reads it for the one-second change outline, and Fine-tune's row tint uses it. Both trace a photo's change. |

Removed: `--red-display`, `--red-ui` and the warm paper. The primary button (`.btn-accent`) is graphite with white text in both volumes. A selected tab has a 2 px graphite bar. A toggle switch is `--adapted` when off and graphite when on.

## 2. Volumes

The Library is loud: display type, plus the masthead with its count block. Every other view is quiet. Both volumes use the same palette; the one difference is the loud Library's ultramarine count block.

## 3. Type

Same as C+D:
- **UI:** Archivo.
- **Display:** Archivo at width 62, weight 900, uppercase, `clamp(56px, 11vw, 160px)`, line height 0.84. Only LIBRARY and its count use it.
- **Mono:** IBM Plex Mono, for frame ids, m and r ids, dates and credits.
- **Sizes:** title 24, label 15, body 13, caption 12.

## 4. Counts

The Library's loud count is a solid ultramarine block at the right of the masthead, the Library's one iconic color (Malik, 2026-11-04). It is the tally of what Tearsheet has measured. The count is white display type (7.49:1) and bleeds off the block's bottom edge, which crops it (as in C+D). A count has no dimension line.

LIBRARY sits on the count's baseline, so the masthead's rule crops both alike and the two read as one line of type.

On a phone the issue line under the masthead is dropped, because the block already says how many. Screen readers still hear it, since the block itself is hidden from them.

Make's count is meant to be the same block in graphite (Make is quiet), in the B2 masthead. B2 is not built yet, so Make shows no count for now.

## 4a. The phone's tab bar

The tab bar follows Apple's HIG for an iPhone tab bar:
- 49 px tall, above the home indicator.
- Three items of equal width: Library, Shoot and Make. Each is a 24 px glyph over a 10 px label, and the whole item is the touch target.
- Unselected items are muted graphite. The selected one is graphite, with the 2 px bar over its glyph.
- Shoot sits in the middle: the camera in a 30 px graphite disc. On Make the disc becomes an outline, since shooting is the Library's job.

## 5. The measured layer

| Mark | Where it shows |
|---|---|
| Réseau | 5 × 5 crosses at 100 to 900 on the 0–1000 grid that regions are measured on; the center cross is double size. It shows on a Library card only while Spark reads the photo, and in Details while regions are shown. Never as a texture on the chrome. |
| READING | A white mono tag on ultramarine at the card's top left, plus an ultramarine line on a white track under the photo. A queued or held photo keeps the plain graphite line. |
| Region box | 2 px ultramarine with a 1.5 px white halo inside and out, tagged with its measurement ids. Only the regions the plain reading's lines rest on are drawn, so the photo and the lines carry the same ids, plus the one pointed at. Boxes that coincide (each side within 1% of the frame) are drawn as one box with all their ids. |
| Id tag | An m or r id in white mono 600 at 11 px on ultramarine. On a photo it also gets a halo. |
| Callout | A number always means a photo in the project, in slot order. It shows on the photo's thumbnail in Make's photo row, and only while that photo is on. From 768 px up, a leader runs from the number at the spread's left edge to the first element on the List screen that the photo's lead parameter changes. Rules and measurements keep their ids (r1, m4), so no number means two things. |

The halo means a trace mark's adjacent color is always white: 7.49:1 against ultramarine. The halo itself meets the darkest photo ground at 20.27:1.

## 6. Frame ids

Every photo has a frame id, `TS-01-0013`, shown before its credit wherever a card shows one: the Library, the Pick, Adjust and Swap sheets, the Brick sheet and Details. Frames are numbered in saved order. Starters keep their built-in order on a tie. The id is computed (`src/lib/frames.ts`), not stored, so removing a photo renumbers every photo saved after it.

## 7. One left edge

Kept from C+D. The masthead sits in the same `.gutter` as the grid. LIBRARY moves left by the L's side bearing, so its ink and the grid's first column share one left edge at every width.

## 8. Make

- **No dimension lines and no title block.** There is no 390 × 844. On Make, PROJECT would repeat the h1 and FRAMES would repeat the photo row. The title block is for exported sheets only, which are not built.
- **Callouts 1 and 2 stay.** They are the numbers on the photos that are on, with their leaders.
- **Paper, not a block.** The two screens are a spread on paper with crop marks, never on a block.

## 9. Details

Details means the `/brick/:id` page and the Brick sheet.

1. **The measured drawing comes first:** the photo on the 0–1000 réseau, with its cited regions boxed and tagged.
2. **The plain reading comes under it.** Each line starts with the tag it rests on (the measurement id when the rule cites one, otherwise the rule id). Then it says what the photo has, then "On your screens: …".
3. **"The exact rules ▸"** folds the verbatim rules, token values and measurements. A link to `#m3` opens the fold.

Numbers stay reserved for photos, so a line in Details is keyed by the same tag its region box shows, not by a number.

## 10. Contrast

WCAG 2.2, measured:

| Pair | Ratio | Needs | Used for |
|---|---|---|---|
| graphite on white | 16.74:1 | 4.5 | Text, display type, labels |
| white on graphite | 16.74:1 | 4.5 | Primary button label, the count, toast |
| muted on white | 4.70:1 | 4.5 | Captions, credits, issue line, placeholders |
| muted on white | 4.70:1 | 3 | An input's edge |
| adapted on white | 3.37:1 | 3 | The adapted chip's outline |
| graphite on white | 16.74:1 | 3 | Selected tab bar, focus ring |
| ultramarine on white | 7.49:1 | 3 | Crosses, region boxes, leaders and circles on a light ground, a mark against its own halo |
| white on ultramarine | 7.49:1 | 4.5 | READING, id tags, callout numbers, the Library's count |
| white halo on `#060605` (the Chicago field) | 20.27:1 | 3 | Every mark on the darkest photo |
| ultramarine alone on `#060605` | 2.71:1 | fails | Never used without its halo |
| ultramarine on graphite | 2.23:1 | fails | Never used |
| the 12% rule on white | 1.27:1 | none | Decoration; never a control's only boundary |

## 11. Hue check

This check compares the chrome with the two shells shown next to it: the dark Chicago shell and the light blossoms shell, the same pair as Round 2.

- **Neutrals:** graphite and muted are neutral (OKLCH chroma 0.007 and 0.003, under 0.04). So are both shells' grounds and text.
- **Ultramarine** `#2338E8` sits at hue 267.4°:
  - 120.8° from the dark shell's accent `#D11D1B` (28.2°);
  - 47.6° from the light shell's accent `#A6D4E3` (219.8°).
- **Result:** both pass the 45° line (under 30° fails, 30–45° warns).
- **No warm accent:** ultramarine is cool, outside the warm band of 330° to 110°.
- **Not covered by Round 2:** the shell's own default accent, `#2F6FED` at 262.0°, is 5.4° from ultramarine, which is the same hue family. It shows only where no photo sets an accent. The old Chicago JSON has no measured colors, so Details' mini preview for Chicago shows it. Changing that default is a shell change.

## 12. Carried over from C+D

The code's "C+D §n" comments refer to these rules, which stay as C+D wrote them:
- §2 volumes;
- §7 one left edge;
- §8 the issue line with real counts only;
- §12.3–4 the masthead in the gutter;
- §12.6–7 Make's "couldn't carry over" line;
- the header's single primary action, then ⋯;
- crop marks round the spread.

Only color and material changed.

## 13. Limits and decisions

- **Shell default accent:** see §11. It is the one place a shell can show the chrome's hue family.
- **Shell flash below 3:1.** `shell.css` draws its one-second change outline from `--accent` with no halo. On the darkest shell that is ultramarine at 2.71:1 for one second. The flash is transient and not needed to read the screen. A halo would need a shell change, which is out of scope here.
- **Not built:** Make's count block (B2), layouts A and C2, and exported sheets with their title block.
- **New copy:**
  - the plain names used when a rule has no short label ("Type sizes", "What leads", "Image size" and so on);
  - "On your screens:";
  - "The exact rules";
  - "READING".
