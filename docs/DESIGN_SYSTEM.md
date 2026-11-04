# Tearsheet design system: Measured drawing

**Color rule.** Ultramarine is Tearsheet's own mark: the tear in its nameplate and what it traced to a photo (the READING crosses and line, region boxes, the numbered callouts that tie a photo to the screens, the m and r ids), on a white halo wherever it sits on a photo and never on graphite; everything else is graphite on white.

**Bleed rule.** A number bleeds off an edge only from a solid field; inside an outline it sits whole.

Adopted on 2026-11-04 from Round 2, tile M, with Malik's changes: both counts are solid graphite blocks, Make has no dimension lines and no title block, and Details gains a plain reading. It replaces C+D's color and material; the warm paper and the brick red are retired. C+D's type, layouts and non-color rules stay (§12). All values live in `src/chrome/tokens.css`.

The same day it took in the Data tear brand (`brand/data-tear`): the nameplate in the header, and the lockup's torn bottom on the Library's poster masthead from the tablet up. The phone stays simple (§4).

## 1. Palette

| Token | Value | Role |
|---|---|---|
| `--paper` | `#FFFFFF` | Page, every zone, raised surfaces. Elevation is a 1 px rule, never a shadow. |
| `--ink` | `#1B1E21` | Graphite: text, display type, the lockup's letters, buttons, tabs, the count block, toasts, focus rings. |
| `--ink-2` | `#727475` | Muted graphite: captions, credits, the issue line, placeholders, an input's edge. |
| `--line`, `--rule` | graphite at 12% (`#E4E4E4` on white) | 1 px rules. Decoration only. |
| `--trace` | `#2338E8` | Ultramarine: the tear in the header's lockup, and traces (the color rule). Never a solid field. |
| `--halo` | `#FFFFFF` | Sits under every trace mark on a photo or a screen. |
| `--rim` | `#D3CDC1` | The torn fibre under a tear on paper (the brand's rim). Decoration only. |
| `--measured`, `--interpreted`, `--adapted` | `#1B1E21`, `#727475`, `#8A8C8E` | Provenance chips: filled, dotted, outlined. |
| `--accent` | `var(--trace)` | Old name. `shell.css` reads it for the one-second change outline, and Fine-tune's row tint uses it. Both trace a photo's change. |

Removed: `--red-display`, `--red-ui` and the warm paper. The primary button (`.btn-accent`) is graphite with white text in both volumes. A selected tab has a 2 px graphite bar. A toggle switch is `--adapted` when off and graphite when on.

## 2. Volumes

The Library is loud: display type, plus the masthead with its count. Every other view is quiet. Both volumes use the same palette.

## 3. Type

Same as C+D:
- **UI:** Archivo.
- **Display:** Archivo at width 62, weight 900, uppercase, line height 0.84: the lockup's letters, and LIBRARY and its count (`clamp(56px, 11vw, 160px)` from the tablet up, 44 px on a phone).
- **Mono:** IBM Plex Mono, for frame ids, m and r ids, dates and credits.
- **Sizes:** title 24, label 15, body 13, caption 12.

## 4. Header and the Library masthead

Malik's direction (2026-11-04): a newspaper front page on the desktop, clear and direct, no text that says nothing; a simpler version on the phone.

**Header.**
- **From the tablet up**, the header is a nameplate. The lockup (the Data tear mark and TEARSHEET) is centered, the sections (Library, Make) sit at the left, and the page's actions sit at the right.
- **On the Library**, the header has no line of its own.
- **On a phone**, the lockup sits at the left and the actions at the right.
- **The lockup** is the Claude Design board's primary lockup, drawn as the board draws it: its mark is the board's own tear, and TEARSHEET's letters have their bottoms bitten by the board's own bite line, set 35 units (0.035 em) nearer the baseline so the letters keep a little more. It is drawn without the rim (no brown line), at every size (Malik, 2026-11-04).
- **Everywhere**, the lockup's tear is ultramarine and its letters graphite.

**Masthead, from the tablet up: the front page's poster.**
- LIBRARY is in display type, with the count in white on a graphite block at the right (16.74:1); the count bleeds off the block's bottom. LIBRARY sits on the count's baseline.
- The masthead's bottom is torn like the lockup's letters, and the brand's fibre (`--rim`) shows under the bite. It is the board's rim under the name, stretched across the page in em (`src/brand/tornEdge.ts`), so it scales with LIBRARY.
- There is no straight rule; the torn edge is the page's one edge.

**Masthead, on a phone: simple.** LIBRARY and the count in display type at 44 px on one baseline, with no block, no rule and no tear.

**No issue line.** There is no line under the masthead at any width. A screen reader still hears "12 starter photos" (or "14 photos" and since when), since the count is hidden from it.

**Make's count.** It is meant to be the same block, in the B2 masthead. B2 is not built yet, so Make shows no count for now. A count has no dimension line.

## 4a. The phone's tab bar

**Height.** The bar is 64 px tall, above the home indicator.
- iOS draws its own tab bar at 49 pt, but a page in a browser sits beside the browser's toolbar and carries a shutter.
- Android's navigation bar is 80 dp, with 48 px touch targets.
- The 49 px bar with its 30 px Shoot was too tight (Malik, 2026-11-04).

**Items.** Three items of equal width, each with its whole third as the touch target.
- Library and Make are a 24 px glyph over an 11 px label.
- Unselected items are muted graphite. The selected one is graphite, with the 2 px bar over its glyph.

**Shoot.**
- **On the Library:** a 60 px graphite shutter riding the bar's top edge, with a white ring that separates it from the page and an inner ring. No word shows; a screen reader still hears "Shoot".
- **On Make:** a 44 px outline inside the bar, since shooting is the Library's job.

## 4b. The desktop as an app

Added 2026-11-04, after Malik asked how to make the desktop feel like an app. There is no footer: about and credits stay in ⋯.
- **Drop and paste to save.** Photos dropped anywhere on the window, or pasted with ⌘V, are saved the same way Shoot saves them. While files are dragged over the window, the page fades and DROP TO SAVE stands in its crop marks over a small stack of sheets with the count. Files that aren't JPEG, PNG or WebP are refused with one line.
- **Install.** "Install Tearsheet" sits in ⋯ where the browser can install: Chrome and Edge show their prompt, and Safari gets one sentence pointing to File › Add to Dock. It is hidden once the app runs in its own window, and in browsers that can't install.
- **Keys.**
  - 1 and 2 go to Library and Make, and N shoots.
  - ← and → step through photos in the Brick sheet, and Esc closes a sheet.
  - ? opens the list (also in ⋯).
  - Keys never fire while you type in a field, or while a sheet is open (except the sheet's own arrows). Phones show neither the list nor its item.
- **Make as a workspace, from 1180 px.** The screens sit at the left. At the right, in a sticky column, are the intent, then "From your photos": each photo with what it sets and why it was picked. That list is the photo row re-laid, with its switches, swap and badges as they are. Below 1180 px, the photo row stays under the screens.

## 5. The measured layer

| Mark | Where it shows |
|---|---|
| Réseau | 5 × 5 crosses at 100 to 900 on the 0–1000 grid that regions are measured on; the center cross is double size. It shows on a Library card only while Spark reads the photo, and in Details while regions are shown. Never as a texture on the chrome. |
| READING | A white mono tag on ultramarine at the card's top left, plus an ultramarine line on a white track under the photo. A queued or held photo keeps the plain graphite line. |
| Region box | 2 px ultramarine with a 1.5 px white halo inside and out, tagged with its measurement ids. Only the regions the plain reading's lines rest on are drawn, so the photo and the lines carry the same ids, plus the one pointed at. Boxes that coincide (each side within 1% of the frame) are drawn as one box with all their ids. |
| Id tag | An m or r id in white mono 600 at 11 px on ultramarine. On a photo it also gets a halo. |
| Callout | A number always means a photo in the project, in slot order. It shows on the photo's thumbnail in Make's photo row, and only while that photo is on. From 768 px up, the number also stands in a column at the spread's left edge, and a leader runs from it to the first element the photo's lead parameter changes on the List screen, ending on a dot just before it (for text, just before its first word, not its box). Leaders were briefly replaced by pins and brought back: they are orderly and reach small elements exactly (Malik, 2026-11-04). The leader is ultramarine with a hairline of white either side (a 3 px casing under a 1.5 px line), so it reads over the dark bezel and any screen, a blue one included. Rules and measurements keep their ids (r1, m4), so no number means two things. |

The halo means a trace mark's adjacent color is always white: 7.49:1 against ultramarine. The halo itself meets the darkest photo ground at 20.27:1.

## 6. Frame ids

Every photo has a frame id, `TS-01-0013`.
- **Where it shows:** only on the photo's own record, before its credit: Details (the page and the Brick sheet), and the share card the brand draws.
- **Where it doesn't:** the cards in the Library and the Pick, Adjust and Swap sheets. You know a photo by looking at it there, and the id was noise (Malik, 2026-11-04).
- **Numbering:** frames are numbered in saved order, and starters keep their built-in order on a tie.
- **Computed, not stored** (`src/lib/frames.ts`), so removing a photo renumbers every photo saved after it.

## 7. One left edge

Kept from C+D. The masthead sits in the same `.gutter` as the grid. LIBRARY moves left by the L's side bearing, so its ink and the grid's first column share one left edge at every width.

## 8. Make

- **No dimension lines and no title block.** There is no 390 × 844. On Make, PROJECT would repeat the h1 and FRAMES would repeat the photo row. The title block is for exported sheets only, which are not built.
- **Callouts 1 and 2 stay.** They are the numbers on the photos that are on, with their leaders to the List screen.
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
| white on ultramarine | 7.49:1 | 4.5 | READING, id tags, callout numbers |
| ultramarine on white | 7.49:1 | 3 | The lockup's tear (a graphic, beside its graphite letters) |
| `--rim` on white | 1.58:1 | none | The torn fibre; decoration, never the only edge of anything |
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
- **Not built:** Make's count block (B2), layout C2, and exported sheets with their title block. Layout A's nameplate is built as the desktop header.
- **The tear on smaller titles.** It stays at display size. On the 30 px Projects and Sync titles its bite would be under 2 px, so they keep the display face without it, as the brand's lockup drops its bite under 240 px.
- **New copy:**
  - the plain names used when a rule has no short label ("Type sizes", "What leads", "Image size" and so on);
  - "On your screens:";
  - "The exact rules";
  - "READING".
