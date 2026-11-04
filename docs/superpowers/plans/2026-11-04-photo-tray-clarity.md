# Photo Tray Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make's photo row shows every photo with one "it shapes the screens" ring, a tap caption that says what moved on the screens, and at least three slots where an empty slot adds a photo.

**Architecture:** The pure parts live in `src/lib/makeFlow.ts` (statuses, families, captions) and `src/lib/swapSheet.ts` (an add mode for the existing groups). `SwapPicker` gains a `mode` prop. `src/screens/Make.tsx` and `src/chrome/tokens.css` only render them. Spec: `docs/superpowers/specs/2026-11-04-photo-tray-clarity-design.md`.

**Tech Stack:** Vite 8, React 19, TypeScript, Tailwind 4; tests with `node:test` + `tsx` (`npm test` runs `scripts/*.test.ts`).

## Global Constraints

- No commits: Malik commits on request. Each task ends with the tests passing and the files left uncommitted.
- No live model call while building or verifying. Browser checks stub `/api/propose` and set `localStorage['tearsheet.dry'] = '1'`.
- Do not touch `../meta-eval/`, `src/screens/Compose.tsx`, the propose call, its prompt or the pick limits (three proposed, `MAX_BRICKS = 5` by hand).
- Copy, verbatim: `removed`, `back`, `added`, `No visible change`, `Not used: earlier photos set the same things`, `Add a photo`, `No other photo to add.`, `, not used` (aria-label suffix).
- Families, verbatim: Colors = `color_bg`, `color_fg`, `color_accent`, `palette_hue_count`, `accent_placement`, `accent_coverage`; Type = `type_family`, `type_scale_ratio`, `hierarchy_mode`; Layout = `density`, `grouping`, `rhythm`, `alignment_edge`, `image_text_dominance`, `spacing_unit`, `radius`. Joined `Colors`, `Colors and type`, `Colors, type and layout`.
- A family counts as moved only when a key's **value** changes; a source that moves with an equal value is not a change.
- Ring: `used` only, `outline: 2px solid var(--ink); outline-offset: 2px`. `off` keeps today's fade; `unused` is the photo as it is.
- Test files keep their header rule: expected values are typed out from the spec, never read from the code under test.
- Client imports are extensionless; test files import with `.ts` / `.tsx`.

---

### Task 1: Every photo in the row, with a status

**Files:**
- Modify: `src/lib/makeFlow.ts:37-49` (`PhotoChip`, `photoRow`)
- Modify: `scripts/makeflow.test.ts:94-107` (the photo-row describe)

**Interfaces:**
- Produces: `export type PhotoStatus = 'used' | 'off' | 'unused'`; `PhotoChip = { brick: Brick; muted: boolean; status: PhotoStatus; label: string | null }`; `photoRow(project: Project, bricks: Brick[]): PhotoChip[]` (one chip per id in `brickIds` that resolves to a brick, in order); module-private `setsSomething(r: Resolved, id: string): boolean`, used again in Task 2.

- [ ] **Step 1: Replace the three filtering tests and add a samples test.** In `scripts/makeflow.test.ts`, replace the first three `it(...)` blocks of `describe('the photo row: which photos show, and the one label', ...)` (lines 95-107) with:

```ts
  it('every photo shows: Chicago and g2 set something (used); echo sets nothing under Chicago (unused)', () => {
    const p = project({ brickIds: ['chicago', 'g2', 'echo'] })
    assert.deepEqual(photoRow(p, [chicago, g2, echo]).map(c => [c.brick.id, c.status]), [['chicago', 'used'], ['g2', 'used'], ['echo', 'unused']])
  })
  it('a muted photo is off, whether or not it would set something; muted mirrors it', () => {
    const p = project({ brickIds: ['chicago', 'g2', 'echo'], mutedBricks: { chicago: true, echo: true } })
    assert.deepEqual(photoRow(p, [chicago, g2, echo]).map(c => [c.brick.id, c.status, c.muted]), [['chicago', 'off', true], ['g2', 'used', false], ['echo', 'off', true]])
  })
  it('with Chicago off, echo (next in line) sets its share and is used', () => {
    const on = project({ brickIds: ['chicago', 'echo', 'g2'] })
    assert.deepEqual(photoRow(on, [chicago, g2, echo]).map(c => [c.brick.id, c.status]), [['chicago', 'used'], ['echo', 'unused'], ['g2', 'used']])
    const off = project({ brickIds: ['chicago', 'echo', 'g2'], mutedBricks: { chicago: true } })
    assert.deepEqual(photoRow(off, [chicago, g2, echo]).map(c => [c.brick.id, c.status]), [['chicago', 'off'], ['echo', 'used'], ['g2', 'used']])
  })
  it('the board screenshots (2026-11-04): MARS is in the row while CalmMouse sets everything first, and used once CalmMouse is off', () => {
    const T = ['calmmouse', 'jpl-2016-visions-mars', 'lissitzky-1923-dlya-golosa']
    assert.deepEqual(photoRow(project({ brickIds: T }), SAMPLES).map(c => c.status), ['used', 'unused', 'used'])
    assert.deepEqual(photoRow(project({ brickIds: T, mutedBricks: { calmmouse: true } }), SAMPLES).map(c => c.status), ['off', 'used', 'used'])
  })
  it('an id with no brick is skipped', () => {
    assert.deepEqual(photoRow(project({ brickIds: ['chicago', 'ghost'] }), [chicago]).map(c => c.brick.id), ['chicago'])
  })
```

- [ ] **Step 2: Run to see them fail.** Run: `node --disable-warning=DEP0205 --import tsx --test --test-name-pattern="photo row" scripts/makeflow.test.ts`. Expected: FAIL (`status` is `undefined`; echo is missing).

- [ ] **Step 3: Implement.** In `src/lib/makeFlow.ts` (`type Resolved` is already imported on line 2), replace lines 37-49 (the `PhotoChip` comment, type and `photoRow`) with:

```ts
/** The photo row under the screens (spec 2026-11-04 §1): every photo of the project, in its order, with its state and its one short label (judged with
 *  the photo unmuted). `used` sets something on the screens now; `off` is tapped off; `unused` is on but sets nothing (earlier photos, a lock or a
 *  value set by hand took everything it would set). */
export type PhotoStatus = 'used' | 'off' | 'unused'
export type PhotoChip = { brick: Brick; muted: boolean; status: PhotoStatus; label: string | null }

/** Whether any value on the screens comes from this photo. */
const setsSomething = (r: Resolved, id: string) => PARAMETER_KEYS.some(k => r.values[k].source?.brickId === id)

export function photoRow(project: Project, bricks: Brick[]): PhotoChip[] {
  return project.brickIds.flatMap(id => {
    const brick = bricks.find(b => b.id === id)
    if (!brick) return []
    const muted = !!project.mutedBricks?.[id]
    const r = resolveProject(muted ? { ...project, mutedBricks: toggleMuted(project.mutedBricks, id) } : project, bricks)
    const status: PhotoStatus = muted ? 'off' : setsSomething(r, id) ? 'used' : 'unused'
    return [{ brick, muted, status, label: oneLabel(brick, r) }]
  })
}
```

- [ ] **Step 4: Run the tests.** Run: `npm test`. Expected: PASS, all files (Make.tsx still compiles: it reads `brick`, `muted`, `label`, which are unchanged).

---

### Task 2: What a tap moved, as a caption

**Files:**
- Modify: `src/lib/makeFlow.ts` (append after `toggleMuted`)
- Modify: `scripts/makeflow.test.ts` (import line 7; a new describe at the end of the file)

**Interfaces:**
- Consumes: `setsSomething` (Task 1), `toggleMuted`, `resolveProject`.
- Produces:
  - `export type Family = 'colors' | 'type' | 'layout'`
  - `effectOf(before: Resolved['values'], after: Resolved['values']): Family[]` (moved families, in the order colors, type, layout)
  - `export type CaptionVerb = 'removed' | 'back' | 'added'`
  - `changeCaption(before: Project, after: Project, bricks: Brick[], id: string, verb: CaptionVerb): string`
  - `toggleCaption(project: Project, bricks: Brick[], id: string): string`

- [ ] **Step 1: Write the failing tests.** Change the import on line 7 of `scripts/makeflow.test.ts` to:

```ts
import { autoName, carryOver, changeCaption, effectOf, makeRoute, oneLabel, openDestination, photoLine, photoRow, shareCodeFor, shareContent, sharedLink, sharedView, toggleCaption, toggleMuted } from '../src/lib/makeFlow.ts'
```

and add `import { PARAMETER_KEYS } from '../src/shell/params.ts'` under it. Append at the end of the file:

```ts
describe('the caption after a tap says what moved (spec 2026-11-04 §3)', () => {
  const T = ['calmmouse', 'jpl-2016-visions-mars', 'lissitzky-1923-dlya-golosa']
  const MARS = 'jpl-2016-visions-mars', LISS = 'lissitzky-1923-dlya-golosa'
  it('every parameter belongs to exactly one family', () => {
    const base = resolveProject(project(), [chicago]).values
    for (const k of PARAMETER_KEYS) {
      const after = { ...base, [k]: { ...base[k], value: '__moved' } }
      assert.equal(effectOf(base, after).length, 1, k)
    }
  })
  it('a value that stays while its source moves is not a change', () => {
    const base = resolveProject(project(), [chicago]).values
    const after = { ...base, type_family: { ...base.type_family, source: { ...base.type_family.source, brickId: 'other' } } }
    assert.deepEqual(effectOf(base, after), [])
  })
  it('CalmMouse off moves colors, the type scale and the image share; on again brings them back', () => {
    assert.equal(toggleCaption(project({ brickIds: T }), SAMPLES, 'calmmouse'), 'Colors, type and layout removed')
    assert.equal(toggleCaption(project({ brickIds: T, mutedBricks: { calmmouse: true } }), SAMPLES, 'calmmouse'), 'Colors, type and layout back')
  })
  it('Lissitzky off moves only the hue count', () => {
    assert.equal(toggleCaption(project({ brickIds: T }), SAMPLES, LISS), 'Colors removed')
  })
  it('MARS sets nothing while CalmMouse is on: off or on, it says so', () => {
    assert.equal(toggleCaption(project({ brickIds: T }), SAMPLES, MARS), 'Not used: earlier photos set the same things')
    assert.equal(toggleCaption(project({ brickIds: T, mutedBricks: { [MARS]: true } }), SAMPLES, MARS), 'Not used: earlier photos set the same things')
  })
  it('a photo whose values the next one repeats moves nothing', () => {
    const twin = brick('twin', [TITLE, ACCENT, HUE])
    assert.equal(toggleCaption(project({ brickIds: ['chicago', 'twin'] }), [chicago, twin], 'chicago'), 'No visible change')
  })
  it('an added photo: what it brings, or that it is not used', () => {
    const two = ['calmmouse', LISS]
    assert.equal(changeCaption(project({ brickIds: two }), project({ brickIds: [...two, MARS] }), SAMPLES, MARS, 'added'), 'Not used: earlier photos set the same things')
    const off = { calmmouse: true } as const
    assert.equal(changeCaption(project({ brickIds: two, mutedBricks: off }), project({ brickIds: [...two, MARS], mutedBricks: off }), SAMPLES, MARS, 'added'), 'Type and layout added')
  })
})
```

- [ ] **Step 2: Run to see them fail.** Run: `node --disable-warning=DEP0205 --import tsx --test --test-name-pattern="caption after a tap" scripts/makeflow.test.ts`. Expected: FAIL with `effectOf` / `toggleCaption` / `changeCaption` not exported.

- [ ] **Step 3: Implement.** Make sure `import type { ParameterKey } from '../shell/params'` sits next to the `PARAMETER_KEYS` import in `src/lib/makeFlow.ts` (combine as `import { PARAMETER_KEYS, type ParameterKey } from '../shell/params'`). Append after `toggleMuted`:

```ts
/** Spec 2026-11-04 §3: what the screens show, in three families, for the caption after a tap. Every parameter is in exactly one. */
export type Family = 'colors' | 'type' | 'layout'
const FAMILIES: readonly { name: Family; keys: readonly ParameterKey[] }[] = [
  { name: 'colors', keys: ['color_bg', 'color_fg', 'color_accent', 'palette_hue_count', 'accent_placement', 'accent_coverage'] },
  { name: 'type', keys: ['type_family', 'type_scale_ratio', 'hierarchy_mode'] },
  { name: 'layout', keys: ['density', 'grouping', 'rhythm', 'alignment_edge', 'image_text_dominance', 'spacing_unit', 'radius'] },
]

/** The families whose value moved, in the order colors, type, layout. A value that stays while its source moves is not a change: the screens do not move. */
export function effectOf(before: Resolved['values'], after: Resolved['values']): Family[] {
  return FAMILIES.filter(f => f.keys.some(k => before[k].value !== after[k].value)).map(f => f.name)
}

const CAPTION = { notUsed: 'Not used: earlier photos set the same things', none: 'No visible change' } as const
/** `Colors`, `Colors and type`, `Colors, type and layout`. */
function joinFamilies(fs: Family[]): string {
  const s = fs.length < 3 ? fs.join(' and ') : `${fs.slice(0, -1).join(', ')} and ${fs[fs.length - 1]}`
  return s[0].toUpperCase() + s.slice(1)
}

/** The caption over photo `id` after a change from `before` to `after`: that it is not used when it sets nothing while on (judged on whichever side has
 *  it on), else the families that moved and the verb, else that nothing moved. */
export type CaptionVerb = 'removed' | 'back' | 'added'
export function changeCaption(before: Project, after: Project, bricks: Brick[], id: string, verb: CaptionVerb): string {
  if (!setsSomething(resolveProject(verb === 'removed' ? before : after, bricks), id)) return CAPTION.notUsed
  const fs = effectOf(resolveProject(before, bricks).values, resolveProject(after, bricks).values)
  return fs.length ? `${joinFamilies(fs)} ${verb}` : CAPTION.none
}

/** The caption for a tap on photo `id`: off if it was on (`removed`), on if it was off (`back`). */
export function toggleCaption(project: Project, bricks: Brick[], id: string): string {
  const wasOff = !!project.mutedBricks?.[id]
  return changeCaption(project, { ...project, mutedBricks: toggleMuted(project.mutedBricks, id) }, bricks, id, wasOff ? 'back' : 'removed')
}
```

- [ ] **Step 4: Run the tests.** Run: `npm test`. Expected: PASS. If `'Type and layout added'` fails, print `effectOf` for that pair before changing anything: the spec's expected value came from the sample values (type scale 1.25 → 3, image share 0.4 → 0.6, nothing else), so a different answer means a resolve-order bug, not a wrong test.

---

### Task 3: The swap sheet in add mode

**Files:**
- Modify: `src/lib/swapSheet.ts:33-41` (`swapGroups` signature and the first lines)
- Modify: `src/make/Dialogs.tsx:25` (COPY) and `:160-185` (`SwapPicker`)
- Modify: `scripts/swapsheet.test.ts` (one test in `describe('swap sheet groups')`)
- Modify: `scripts/swappicker.test.ts` (one test)

**Interfaces:**
- Produces: `swapGroups(project: Project, pool: Brick[], replacing: string | null, bricks: Brick[]): SwapGroup[]` (`null` = add: nothing is replaced, Same job is empty); `SwapPicker` props gain `mode?: 'swap' | 'add'` (default `'swap'`).

- [ ] **Step 1: Write the failing tests.** In `scripts/swapsheet.test.ts`, inside `describe('swap sheet groups', ...)`, add:

```ts
  it('add mode (null): nothing is replaced, so there is no Same job; a photo that sets a free parameter adds something', () => {
    assert.deepEqual(view(swapGroups(project(), ALL, null, ALL)), [
      ['Adds something', ['same2', 'adds']],
      ['Everything else', ['x✓', 'same1', 'rest', 'bare', 'top✓']],
    ])
  })
```

In `scripts/swappicker.test.ts`, add a test in its existing describe:

```ts
  it('add mode: the sheet is titled Add a photo, each tile is an Add, the empty line says so', () => {
    const html = renderToStaticMarkup(h(SwapPicker, { groups: GROUPS, mode: 'add', onClose: () => {}, onPick: () => {} }))
    assert.ok(html.includes('Add a photo'))
    assert.ok(tiles(html).filter(t => !t.includes('disabled')).every(t => /aria-label="Add: /.test(t)), tiles(html).join('\n'))
    const none = renderToStaticMarkup(h(SwapPicker, { groups: [{ id: 'rest', title: 'Everything else', tiles: [{ brick: sample('g2'), inProject: true }] }], mode: 'add', onClose: () => {}, onPick: () => {} }))
    assert.ok(none.includes('No other photo to add.'))
  })
```

- [ ] **Step 2: Run to see them fail.** Run: `node --disable-warning=DEP0205 --import tsx --test --test-name-pattern="add mode" scripts/swapsheet.test.ts scripts/swappicker.test.ts`. Expected: FAIL. The groups test puts `same2` and `adds` under Same job (a shell default's source id is `''`, so `''` cannot stand for "nothing replaced"); the picker test finds `Swap` as the title.

- [ ] **Step 3: Implement the groups.** In `src/lib/swapSheet.ts`, change the doc comment's first sentence to start `The sheet that replaces \`replacing\`, or adds a photo when it is null:` and replace the signature and the first five lines of the body with:

```ts
export function swapGroups(project: Project, pool: Brick[], replacing: string | null, bricks: Brick[]): SwapGroup[] {
  const unmuted: Project = replacing !== null && project.mutedBricks?.[replacing]
    ? { ...project, mutedBricks: Object.fromEntries(Object.entries(project.mutedBricks).filter(([id]) => id !== replacing)) as Record<string, true> }
    : project
  const before = resolveProject(unmuted, bricks).values
  const job = new Set(replacing === null ? [] : RELATIONSHIP_KEYS.filter(k => before[k].source?.brickId === replacing))
```

(The rest of the function is unchanged; `brick.id === replacing` is simply never true for `null`.)

- [ ] **Step 4: Implement the picker.** In `src/make/Dialogs.tsx`, extend the last COPY line to:

```ts
  swap: 'Swap', noSpare: 'No other photo to swap in.', inProject: 'Already in this project',
  add: 'Add a photo', noSpareAdd: 'No other photo to add.',
```

Change `SwapPicker`'s doc comment to add `With mode 'add' (spec 2026-11-04 §4) the same sheet adds a photo: its own title, empty line and tile labels.` and its first lines to:

```tsx
export function SwapPicker({ groups, mode = 'swap', onClose, onPick }: { groups: SwapGroup[]; mode?: 'swap' | 'add'; onClose: () => void; onPick: (id: string) => void }) {
  const choosable = groups.some(g => g.tiles.some(t => !t.inProject))
  const add = mode === 'add'
  return (
    <Overlay title={add ? COPY.add : COPY.swap} onClose={onClose}>
      {!choosable && <p className="ink-2 m-0 mb-3 text-[13px]">{add ? COPY.noSpareAdd : COPY.noSpare}</p>}
```

and the tile's `aria-label` to:

```tsx
                    aria-label={inProject ? `${name}: ${COPY.inProject}` : `${add ? 'Add' : 'Swap in'}: ${name}`} title={inProject ? COPY.inProject : undefined}>
```

- [ ] **Step 5: Run the tests.** Run: `npm test`. Expected: PASS, including the existing swap-sheet and picker tests (swap mode is unchanged).

---

### Task 4: Make renders it

**Files:**
- Modify: `src/screens/Make.tsx` (imports line 11, `Dialog` line 49, COPY line 41, toggle lines 104-110, photo row lines 202-226, dialogs after line 280)
- Modify: `src/chrome/tokens.css:153-160` (comment, ring, add slot)

**Interfaces:**
- Consumes: `photoRow` / `PhotoChip.status` (Task 1), `toggleCaption`, `changeCaption` (Task 2), `swapGroups(…, null, …)`, `SwapPicker mode="add"` (Task 3).

- [ ] **Step 1: Wire the caption and the add dialog.** In `src/screens/Make.tsx`:

Line 11 becomes:

```ts
import { NEUTRAL_SKIN, autoName, changeCaption, photoRow, toggleCaption, toggleMuted } from '../lib/makeFlow'
```

Under `const CAPTION_MS = 2000` add:

```ts
/** The photo row always has at least this many slots; an empty one adds a photo (spec 2026-11-04 §4). */
const SLOTS = 3
```

In COPY, replace `isOn: 'on', isOff: 'off', swap: 'Swap',` with:

```ts
  swap: 'Swap', add: 'Add a photo', notUsed: 'not used',
```

`Dialog` becomes:

```ts
type Dialog = null | 'tune' | 'style' | 'arrange' | 'pick' | 'rename' | { swap: string } | { carry: string } | { add: true }
```

Replace the toggle (lines 104-110) with:

```ts
  // the caption over a photo for two seconds: what a tap or an add moved on the screens
  const say = (id: string, text: string) => {
    setCaption({ id, text })
    window.clearTimeout(captionTimer.current)
    captionTimer.current = window.setTimeout(() => setCaption(null), CAPTION_MS)
  }
  // a tap turns the photo off or on
  const toggle = (id: string) => {
    if (!project) return
    say(id, toggleCaption(project, store.bricks, id))
    update(p => ({ mutedBricks: toggleMuted(p.mutedBricks, id) }))
  }
```

(`toggle` is declared before `update`, as today; it only calls `update` when a tap runs, after render.)

- [ ] **Step 2: Render the statuses and the empty slots.** Replace the photo-row comment and `<ul>` block (lines 202-226) with:

```tsx
            {/* each photo is one switch. A 2 px ink ring means it shapes the screens now; off is faded and grey; on but not used is the photo as it is.
                A tap says for two seconds what it moved; on a desktop hover shows its name. A dot in one corner counts what couldn't carry over, ⇄ in the
                other swaps it. There are always at least three slots, and an empty one adds a photo. The slots are fixed, so a photo never moves. */}
            <div className="photo-dock">
              <ul className="photo-row" style={{ '--slots': Math.max(SLOTS, photos.length) } as CSSProperties} aria-label="Photos">
                {photos.map(({ brick, muted, status, label }) => {
                  const why = project.proposal?.picks.find(p => p.brickId === brick.id)?.why
                  const name = label ?? cardCaption(brick, null).title
                  const missing = unexpressedBy.get(brick.id)?.length ?? 0
                  const shown = caption?.id === brick.id
                  return (
                    <li key={brick.id} className="photo-cell">
                      <button type="button" className="photo-switch" data-state={status} aria-pressed={!muted} aria-label={status === 'unused' ? `${name}, ${COPY.notUsed}` : name} title={why} onClick={() => toggle(brick.id)}>
                        <Photo src={brick.photo.url} alt="" />
                      </button>
                      <span className={`photo-caption ${shown ? 'is-shown' : ''}`} aria-hidden={!shown} role={shown ? 'status' : undefined}>{shown ? caption.text : name}</span>
                      {missing > 0 && (
                        <button type="button" className="photo-badge tnum" aria-label={COPY.carryBadge(missing, name)} title={COPY.carryBadge(missing, name)} onClick={() => setDialog({ carry: brick.id })}>{missing}</button>
                      )}
                      <button type="button" className="photo-swap" aria-label={`${COPY.swap}: ${name}`} title={COPY.swap} onClick={() => setDialog({ swap: brick.id })}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5.5h9.5L10 3M13 10.5H3.5L6 13" /></svg>
                      </button>
                    </li>
                  )
                })}
                {Array.from({ length: Math.max(0, SLOTS - photos.length) }, (_, i) => (
                  <li key={`add-${i}`} className="photo-cell">
                    <button type="button" className="photo-add" aria-label={COPY.add} title={COPY.add} onClick={() => setDialog({ add: true })}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
```

- [ ] **Step 3: The add dialog.** After the swap dialog block (the `{dialog && typeof dialog === 'object' && 'swap' in dialog && project && (...)}` that ends near line 280), add:

```tsx
      {dialog && typeof dialog === 'object' && 'add' in dialog && project && (
        <SwapPicker mode="add" groups={swapGroups(project, ready, null, store.bricks)} onClose={() => setDialog(null)} onPick={to => {
          // appended, so it takes over nothing that is already there; ⋯ → Try another arrangement puts it first
          say(to, changeCaption(project, { ...project, brickIds: [...project.brickIds, to] }, store.bricks, to, 'added'))
          update(p => ({ brickIds: [...p.brickIds, to] }))
          setDialog(null)
        }} />
      )}
```

- [ ] **Step 4: The CSS.** In `src/chrome/tokens.css`, replace the comment on lines 153-154 with:

```css
/* Make: the photo row. Each photo is a switch (the thumbnail and its title in one target), its credit or date under it, Swap a quiet icon.
   Used = a 2 px ink ring, the one mark that says it shapes the screens; off = faded and grey; on but not used = the photo as it is.
   An empty slot (fewer than three photos) is a dashed frame that adds one. The slots are fixed, so a photo never moves when another one appears or goes */
```

and after line 160 (`.photo-switch[aria-pressed="false"] img …`) add:

```css
.photo-switch[data-state="used"] img { outline: 2px solid var(--ink); outline-offset: 2px; }
.photo-add { display: flex; align-items: center; justify-content: center; width: var(--thumb); height: var(--thumb); padding: 0; border: 1px dashed var(--ink-2); border-radius: var(--radius-brand); background: transparent; color: var(--ink-2); cursor: pointer; }
.photo-add:hover { color: var(--ink); border-color: var(--ink); }
.photo-add:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
```

(`--ink-2` rather than `--line` for the dashes: at 12% ink a dashed 1 px line does not read as a slot on paper.)

- [ ] **Step 5: Check the build.** Run: `npm test && npm run lint && npm run build`. Expected: all pass, no type errors (`isOn` / `isOff` have no other reader: `grep -n "COPY.isO" src/screens/Make.tsx` prints nothing).

- [ ] **Step 6: Check in the browser.** Start the dev server with `preview_start` (`build-dev`, port 5176; add it to `.claude/launch.json` if it is missing). Before loading Make, stub `/api/propose` and set `localStorage['tearsheet.dry'] = '1'`. Seed a project with `brickIds: ['calmmouse', 'jpl-2016-visions-mars', 'lissitzky-1923-dlya-golosa']` and starters shown, then check at 375 × 812 and at desktop width:
  - All on: three photos. CalmMouse and Lissitzky have the ring; MARS has none and is not faded. MARS's button `aria-label` ends `, not used`.
  - Tap CalmMouse: it fades, the caption reads `Colors, type and layout removed`, MARS gets the ring, the screens flash.
  - Tap MARS while CalmMouse is on: the caption reads `Not used: earlier photos set the same things`.
  - Edit the project to `['calmmouse', 'lissitzky-1923-dlya-golosa']`: the third slot is a dashed `+`. Tap it: the sheet is titled `Add a photo`, with Adds something before Everything else. Choose MARS: it is appended in the third slot, the caption reads `Not used: earlier photos set the same things`, and no `+` is left.
  - Keyboard: Tab reaches every photo, ⇄ and `+` with a visible focus ring.
  Take one screenshot of each state for Malik. Leave everything uncommitted.
