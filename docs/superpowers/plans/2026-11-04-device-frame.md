# Device Frame Implementation Plan

> Executed inline in the session that wrote it (small, three files and a test). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Every phone frame around a shell draws an iPhone's proportions: a 320 × 694 screen, 46 px screen corners, an 8 px bezel and a Dynamic Island, with the status bar laid out around the island.

**Spec:** `docs/superpowers/specs/2026-11-04-device-frame-design.md`

## Global Constraints

- `PHONE = { screenW: 320, screenH: 694, bezel: 8, screenRadius: 46, islandW: 112, islandH: 32, islandTop: 10 }`. The outer size is 336 × 710 and the outer radius 54.
- Inside the frame the status bar is 52 tall: a grid `1fr 112px 1fr`, with the time centered in column 1 and the icons centered in column 3.
- The status bar markup does not change, so `device.test.ts`'s existing regexes hold. MiniPreview gets no frame and no island.
- Do not touch `Compare.tsx` or `../meta-eval/`. No commits.

### Task 1: PhoneFrame (TDD)

- [ ] Add a test to `scripts/device.test.ts`. It renders `PhoneFrame` around a `Shell` and asserts:
  - the markup is `<div class="phone"><div class="phone-screen">…shell…</div><span class="phone-island" aria-hidden="true"></span></div>`;
  - `PHONE_W === 336`, `PHONE_H === 710` and `PHONE.screenH === 694`.
- [ ] Run it and see it fail, because `PhoneFrame` is not exported.
- [ ] In `src/shell/Device.tsx`, add `PHONE`, `PHONE_W`, `PHONE_H` and `PhoneFrame({ children })`. In `src/shell/shell.css`, add `.phone`, `.phone-screen`, `.phone-island` and `.phone .status-bar` / `.status-time` / `.status-icons`.
- [ ] Run it and see it pass.

### Task 2: Use it

- [ ] `src/make/Screens.tsx`:
  - Replace `SHELL_W/SHELL_H/PAD/FRAME_*` with `PHONE_W`, `PHONE_H` and `PHONE.screenH`.
  - The scaled `inert` wrapper holds `<PhoneFrame><Shell height={PHONE.screenH} …/></PhoneFrame>`.
- [ ] `src/screens/Compose.tsx`:
  - Replace the hand-built frame with `PhoneFrame` at `width: 100%; max-width: 336px; height: PHONE_H`.
  - Pass the Shell `height={PHONE.screenH}`.
- [ ] Run `npm test`, `npm run lint` and `npm run build`.

### Task 3: Browser

- [ ] Run `tray`-style seeding on a new dev config (`device-dev`, port 5181).
- [ ] Check Make at 1280 × 800 and at 375 × 812, Fine-tune, a Library card and the shared page. Use the checks in the spec.
- [ ] Take screenshots.
