# Device frame: an iPhone's proportions, drawn

Approved by Malik 2026-11-04 ("Yes, build it"; screen shape "Real iPhone, 320×694"). Asked: "refine the screen of the mockup as well, more like iphone, decide to see if the hifi bezel matches or not, making the content fit the round edge."

## The hi-fi bezel: a reference, not an asset

The supplied bezel (a photoreal iPhone 15/16 Pro, 978 × 2000 webp) is not used as an image:

- **Shape:** its screen is about 2.17:1 and ours was exactly 2:1. Our screen inside it would be stretched, or would leave bands.
- **Style:** Make is a measured drawing (paper, crop marks, ink rules, numbered leaders). A titanium render would be the only realistic object on the page, and at about 260 px wide its metal detail turns to mush.
- **Leaders:** its left-side buttons sit where the leaders enter the screen.

It is the proportion reference: the screen shape, the corner radius and the island are taken from it and drawn as vectors.

**Revision, 2026-11-04 (Malik: "Try hifi or smaller dynamic island, right now looks weird"; chose "A: drawn"):** the 112 × 32 island was 50% wider than a real one. Measured off the hi-fi image (its screen scaled to 320 wide): 320 × 696, corners about 50, island 75 × 29 at 11 below the top, about 12 of glass edge and metal. Shipped numbers, which replace the table below: screen 320 × 694, **corners 50**, **bezel 10** (`#0E0E0E` with a 2 px `#3A3A3A` rim at the outside for the metal band, and the 1 px `var(--line)` ring), outside 340 × 714 with corners 60, **island 75 × 28** (radius 14) at **11** below the top, status bar **50**, ears in a `1fr 75px 1fr` grid, both items level with the island's center (25). The hi-fi image itself was tried as the frame (B) and not chosen: its left buttons sit where the desktop leaders come in, it is a fixed raster, and its license would need checking before the public repo deploys it.

## Geometry (points, screen 320 wide as before)

| | Before | After |
|---|---|---|
| Screen | 320 × 640 (2:1) | 320 × 694 (19.5:9) |
| Bezel | 6, `#111` | 8, `#111`, even all round; a 1 px `var(--line)` ring outside, as before |
| Screen corner | 16 | 46 (≈14% of the width, the iPhone ratio) |
| Outer corner | 22 | 54 (46 + 8, concentric) |
| Dynamic Island | none | 112 × 32, `#000`, radius 16, centered, 10 below the screen's top edge |
| Status bar (inside the frame) | 44, time and icons 16 from the edges | 52; time centered in the left ear, signal and battery in the right ear, both level with the island's center (26) |
| Side buttons | none | none |

- The tab bar (49) and the home indicator (34, bar 134 × 5) are already iPhone point sizes and stay.
- The status bar change applies only inside the frame (`.phone .status-bar`). The Library's card thumbnails (MiniPreview, a flat card, no frame) keep the 44 px bar, and get no island.
- The skin colors everything inside the screen as before. The frame and the island are device black and ignore the skin.

## The round corners

- **Top:** the time's center line is 26 below the top. There the 46 px curve is about 5 px in, and the time starts about 39 px in, so it is clear.
- **Bottom:** the tab bar ends 34 above the bottom. There the curve is about 1.6 px in, so the outer tab labels are clear.
- The home indicator bar is centered and away from the corners.

## One frame

- `PhoneFrame` and its size (`PHONE`) live in `src/shell/Device.tsx`, with the CSS in `src/shell/shell.css`, next to the device details.
- Make and the shared page (`ScaledScreens`) and Fine-tune (`Compose.tsx`) use it.
- `Compare.tsx` is a dev page and is not touched.
- `ScaledScreens` keeps its scale rule (fit the height on a wide screen, the width on a phone), so the taller phone is simply drawn a little smaller. Main's callouts read positions off the rendered screen and need no change.

## Verification

- `scripts/device.test.ts`: the frame renders the screen inside a `phone-screen`, an `aria-hidden` island and the size constants. The status bar markup is unchanged, so the existing tests keep passing.
- Then `npm test`, lint and build.
- In the browser:
  - Make at desktop and phone width: corners not clipped, the island clear of the time and the icons, and the leaders landing on their elements.
  - Fine-tune.
  - A Library card, with no island.
- Screenshots go next to the bezel for comparison. No live model call. No commits: Malik commits on request.
