# Motion and the photo sheet

Date: 2026-11-04. Decided with Malik on a prototype recorded against the running app (Claude outputs/chrome-m/motion). He approved the phone motion and asked for a smoother desktop.

## Decisions
- **Approach.** The browser's own View Transitions, plus CSS, with no animation library. Firefox switches instantly, as before. Reduced motion turns everything off.
- **Timing.** One curve, and four lengths (`tokens.css` "motion").
- **Pages** (`router.tsx` `navigate`). The header and the tab bar stay still while the page cross-fades. On a phone it also slides 28 px the way the tabs run (`data-nav`). The browser's back and forward stay instant.
- **Sheets** (`useModal.ts`).
  - They enter and leave; the exit plays before the dialog closes, Escape included.
  - On desktop the side panel slides from the right, and on a phone the sheet rises from the bottom.
  - A swipe down the photo sheet's top row closes it on a phone (`BrickSheet.tsx`).
- **The photo sheet's frame:**
  - the handle and the × on paper;
  - the photo on paper, with the réseau at half strength;
  - the exact rules as a full row;
  - Use in Make pinned at the bottom;
  - colliding region tags moved apart (`Brick.tsx`).
- **Content.** The exact rules unfold. Make's result rises, its photos follow, and the leaders draw. Presses give a little.

## Rejected
- **The photo flown from its card into the desktop sheet** (a shared-element view transition). The sheet is a modal in the browser's top layer. The flight measured its landing at the panel's edge, the sheet's photo showed blank until the panel replayed its entrance, and the panel played twice. It was replaced by one slide-in, which reads smoother.
- **A motion library** (about 40 KB). It isn't needed for this.
