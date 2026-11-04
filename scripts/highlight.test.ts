/** Spec v3 C11 (change highlight) and C12 (row -> photo peek), checked on the real sample bricks.
 *  Expected keys are computed in the test from two `resolveProject` calls, expected ids and labels are typed out, never read from highlight.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { resolveProject, type Project } from '../src/lib/mapRelations.ts'
import { PARAMETER_KEYS, type ParameterKey } from '../src/shell/params.ts'
import { changedSincePrevious, firstVersion, withNextVersion } from '../src/lib/versions.ts'
import { footnoteMeasurement } from '../src/lib/landing.ts'
import { PEEK_WIDTH, flashKeys, nextFlash, peekPosition, peekRegions, peekSize } from '../src/lib/highlight.ts'

const AT = '2026-11-02T10:00:00.000Z'
const project = (patch: Partial<Project> = {}): Project => ({ id: 't', intent: 'x', createdAt: '', brickIds: ['g1', 'g2', 'calmmouse'], disabled: {}, choice: {}, locks: {}, manual: {}, ...patch })
const created = (patch: Partial<Project> = {}): Project => { const p = project(patch); return { ...p, ...firstVersion(p, AT) } }
const sourceOf = (p: Project, k: ParameterKey) => resolveProject(p, SAMPLES).values[k].source?.brickId ?? ''
/** The keys whose resolved value or source brick differs between two projects, in PARAMETER_KEYS order. */
const keysThatDiffer = (a: Project, b: Project): ParameterKey[] => {
  const ra = resolveProject(a, SAMPLES), rb = resolveProject(b, SAMPLES)
  return PARAMETER_KEYS.filter(k => ra.values[k].value !== rb.values[k].value || sourceOf(a, k) !== sourceOf(b, k))
}

describe('flashKeys', () => {
  const prev = created()
  const swapped = { ...prev, brickIds: ['g1', 'greencar', 'calmmouse'] }
  const out = withNextVersion(prev, swapped, SAMPLES, AT)

  it('after a Swap that moved values, gives exactly the keys that moved, in parameter order, when the version went up', () => {
    const expected = keysThatDiffer(prev, swapped)
    assert.ok(expected.length > 0 && expected.includes('rhythm'), 'the swap moves rhythm')
    assert.deepEqual(flashKeys(1, out), expected)
    assert.deepEqual(flashKeys(1, out), changedSincePrevious(out).map(c => c.key))
  })
  it('is empty when the version has not gone up: the same version, or a later one already seen', () => {
    assert.deepEqual(flashKeys(2, out), [])
    assert.deepEqual(flashKeys(3, out), [])
  })
  it('is empty for a project at its first version, however it is asked', () => {
    assert.deepEqual(flashKeys(1, prev), [])
    assert.deepEqual(flashKeys(0, prev), [])   // v1 has an empty `changed`: there is nothing before it to differ from
  })
  it('reads a project saved before versions existed as v1', () => {
    const legacy = project()
    assert.equal(legacy.version, undefined)
    assert.deepEqual(flashKeys(1, legacy), [])
    assert.deepEqual(flashKeys(0, legacy), [])
  })
  it('is empty after a lock that moves no value: it still bumps the version', () => {
    const next = { ...prev, lockedBricks: { g1: true as const } }
    assert.deepEqual(keysThatDiffer(prev, next), [], 'locking g1 alone leaves g1 first, and nothing moves')
    const locked = withNextVersion(prev, next, SAMPLES, AT)
    assert.equal(locked.version, 2)
    assert.deepEqual(flashKeys(1, locked), [])
  })
  it('follows a lock release: the keys that moved when the lock came off', () => {
    const held = withNextVersion(prev, { ...prev, lockedBricks: { g2: true as const } }, SAMPLES, AT)
    const released = withNextVersion(held, { ...held, lockedBricks: {} }, SAMPLES, AT)
    assert.equal(released.version, 3)
    assert.deepEqual(flashKeys(2, released), keysThatDiffer(held, { ...held, lockedBricks: {} }))
    assert.deepEqual(flashKeys(3, released), [])
  })
  it('follows Rotate: the keys that moved when the free bricks cycle', () => {
    const rotated = { ...prev, brickIds: ['g2', 'calmmouse', 'g1'] }
    const after = withNextVersion(prev, rotated, SAMPLES, AT)
    assert.deepEqual(flashKeys(1, after), keysThatDiffer(prev, rotated))
  })
  it('follows a conflict choice: only the keys the choice moved', () => {
    const conflicted = resolveProject(prev, SAMPLES).conflicts[0]
    assert.ok(conflicted, 'the sample trio has a conflict')
    const second = resolveProject(prev, SAMPLES).candidates[conflicted]![1]
    const chosen = { ...prev, choice: { [conflicted]: second.ref } }
    const after = withNextVersion(prev, chosen, SAMPLES, AT)
    assert.deepEqual(flashKeys(1, after), keysThatDiffer(prev, chosen))
    assert.ok(flashKeys(1, after).includes(conflicted))
  })
  it('after two changes, flashes only the latest one', () => {
    const second = withNextVersion(out, { ...out, brickIds: ['g1', 'g2', 'calmmouse'] }, SAMPLES, AT)
    assert.equal(second.version, 3)
    assert.deepEqual(flashKeys(2, second), changedSincePrevious(second).map(c => c.key))
    assert.deepEqual(flashKeys(3, second), [])
  })
  it('does not change the project', () => {
    const before = JSON.stringify(out)
    flashKeys(1, out)
    assert.equal(JSON.stringify(out), before)
  })
})

/** The step `useChangeFlash` takes while rendering: what it has seen of the project, and the keys now flashing, in; the same two, updated, out. */
describe('nextFlash', () => {
  const prev = created()
  const out = withNextVersion(prev, { ...prev, brickIds: ['g1', 'greencar', 'calmmouse'] }, SAMPLES, AT)   // v2, moved rhythm and more
  const moved = flashKeys(1, out)
  const running: ParameterKey[] = ['radius']

  it('has something to flash in these tests', () => {
    assert.ok(moved.length > 0)
  })
  it('flashes nothing on the first render of a project, whatever its version: what was saved is not a change', () => {
    assert.deepEqual(nextFlash(null, out, []), { seen: { id: 't', v: 2 }, flash: [] })
    assert.deepEqual(nextFlash(null, prev, []), { seen: { id: 't', v: 1 }, flash: [] })
  })
  it('flashes the keys the new version moved when the version goes up while the project is mounted', () => {
    assert.deepEqual(nextFlash({ id: 't', v: 1 }, out, []), { seen: { id: 't', v: 2 }, flash: moved })
  })
  it('replaces a running highlight with the newer change\'s keys', () => {
    assert.deepEqual(nextFlash({ id: 't', v: 1 }, out, running).flash, moved)
  })
  it('flashes nothing on an id change, and clears a highlight still running from the project it came from', () => {
    const other = { ...out, id: 'u' }
    assert.deepEqual(nextFlash({ id: 't', v: 1 }, other, []), { seen: { id: 'u', v: 2 }, flash: [] })
    assert.deepEqual(nextFlash({ id: 't', v: 1 }, other, running), { seen: { id: 'u', v: 2 }, flash: [] })
    assert.deepEqual(nextFlash({ id: 't', v: 2 }, { ...prev, id: 'u' }, moved), { seen: { id: 'u', v: 1 }, flash: [] })
  })
  it('flashes nothing when the version goes down, and follows it, so the next rise is read from there', () => {
    assert.deepEqual(nextFlash({ id: 't', v: 3 }, out, []), { seen: { id: 't', v: 2 }, flash: [] })
  })
  it('leaves a running highlight alone when the version goes down or is the same, and when the rise moved nothing', () => {
    assert.deepEqual(nextFlash({ id: 't', v: 3 }, out, running).flash, running)
    const same = nextFlash({ id: 't', v: 2 }, out, running)
    assert.deepEqual(same.flash, running)
    const locked = withNextVersion(out, { ...out, lockedBricks: { g1: true } }, SAMPLES, AT)   // a lock is accepted and bumps the version, but moves no value
    assert.equal(locked.version, 3)
    assert.deepEqual(flashKeys(2, locked), [])
    assert.deepEqual(nextFlash({ id: 't', v: 2 }, locked, running), { seen: { id: 't', v: 3 }, flash: running })
  })
  it('hands back the very same seen object and flash array when nothing changed, so the hook sets no state', () => {
    const seen = { id: 't', v: 2 }
    const step = nextFlash(seen, out, running)
    assert.equal(step.seen, seen)
    assert.equal(step.flash, running)
  })
  it('does nothing without a project', () => {
    const seen = { id: 't', v: 2 }
    const step = nextFlash(seen, undefined, running)
    assert.equal(step.seen, seen)
    assert.equal(step.flash, running)
    assert.equal(nextFlash(null, undefined, []).seen, null)
  })
  it('does not change the project, or the highlight it is given', () => {
    const before = JSON.stringify(out), flashBefore = [...running]
    nextFlash({ id: 't', v: 1 }, out, running)
    assert.equal(JSON.stringify(out), before)
    assert.deepEqual(running, flashBefore)
  })
})

describe('peekRegions', () => {
  const calmmouse = SAMPLES.find(b => b.id === 'calmmouse')!

  it('gives the region(s) of the measurement the type_scale_ratio footnote cites on calmmouse', () => {
    const pv = resolveProject(project({ brickIds: ['calmmouse'] }), SAMPLES).values.type_scale_ratio
    const id = footnoteMeasurement(calmmouse, pv.source?.measurementIds)?.id
    assert.equal(id, 'm2')
    assert.deepEqual(peekRegions(calmmouse, id!).map(r => r.label), ['headline and sublines block'])
    assert.deepEqual(peekRegions(calmmouse, id!)[0].box_1000, [110, 300, 580, 690])
  })
  it('gives every region whose measurement_ids include the id, and no other', () => {
    for (const b of SAMPLES) for (const m of b.measurements) {
      const got = peekRegions(b, m.id)
      assert.deepEqual(got, b.regions.filter(r => r.measurement_ids.includes(m.id)), `${b.id} ${m.id}`)
      for (const r of got) assert.ok(r.measurement_ids.includes(m.id))
    }
  })
  it('gives all of them when several regions rest on one measurement, in the brick\'s order', () => {
    const b = { ...calmmouse, regions: [
      { label: 'a', box_1000: [0, 0, 500, 500] as [number, number, number, number], measurement_ids: ['m2'] },
      { label: 'b', box_1000: [500, 500, 1000, 1000] as [number, number, number, number], measurement_ids: ['m9'] },
      { label: 'c', box_1000: [0, 500, 500, 1000] as [number, number, number, number], measurement_ids: ['m1', 'm2'] },
    ] }
    assert.deepEqual(peekRegions(b, 'm2').map(r => r.label), ['a', 'c'])
  })
  it('is empty for a measurement no region rests on, an unknown id, or no id', () => {
    const b = { ...calmmouse, regions: calmmouse.regions.filter(r => !r.measurement_ids.includes('m2')) }
    assert.deepEqual(peekRegions(b, 'm2'), [])
    assert.deepEqual(peekRegions(calmmouse, 'm99'), [])
    assert.deepEqual(peekRegions(calmmouse, undefined), [])
    assert.deepEqual(peekRegions(calmmouse, ''), [])
  })
})

describe('peekSize', () => {
  const brick = (width: number, height: number) => ({ ...SAMPLES[0], photo: { ...SAMPLES[0].photo, width, height } })

  it('is 240 px wide, with a landscape photo as wide as the card\'s inside and as tall as its ratio says', () => {
    const s = peekSize(brick(1600, 1000))
    assert.equal(PEEK_WIDTH, 240)
    assert.equal(s.w, 240)
    assert.equal(s.photo.w, 224)
    assert.equal(s.photo.h, 140)
    assert.equal(s.h, 140 + 80)
  })
  it('keeps a portrait photo no taller than the card is wide inside, and narrower to hold its ratio', () => {
    const s = peekSize(brick(600, 800))
    assert.equal(s.photo.h, 224)
    assert.equal(s.photo.w, 168)
    assert.equal(s.h, 224 + 80)
  })
  it('reads a photo with no size as square', () => {
    const s = peekSize(brick(0, 0))
    assert.deepEqual([s.photo.w, s.photo.h], [224, 224])
  })
  it('keeps the photo\'s ratio for the sample bricks', () => {
    for (const b of SAMPLES) {
      const { photo } = peekSize(b)
      assert.ok(Math.abs(photo.w / photo.h - b.photo.width / b.photo.height) < 0.02, b.id)
      assert.ok(photo.w <= 224 && photo.h <= 224, b.id)
    }
  })
})

describe('peekPosition', () => {
  const size = { w: 240, h: 300 }
  const view = { w: 1280, h: 800 }
  const row = (left: number, top: number, w = 300, h = 60) => ({ left, top, right: left + w, bottom: top + h })

  it('sits beside the row on its left, level with its top, when the left has room (the sheet is the right column)', () => {
    assert.deepEqual(peekPosition(row(940, 200), size, view), { left: 940 - 8 - 240, top: 200 })
  })
  it('sits on the right of the row when the left has no room and the right does', () => {
    assert.deepEqual(peekPosition(row(100, 200, 200), size, view), { left: 308, top: 200 })
  })
  it('on a phone goes under the row, its left edge on the row\'s, kept inside the screen', () => {
    const phone = { w: 375, h: 700 }
    assert.deepEqual(peekPosition(row(16, 100, 343), size, phone), { left: 16, top: 168 })
    assert.equal(peekPosition(row(200, 100, 160), size, phone).left, 375 - 240 - 8)   // a row starting too far right pulls the card back in
  })
  it('on a phone goes above the row when there is no room under it', () => {
    const phone = { w: 375, h: 700 }
    assert.deepEqual(peekPosition(row(16, 560, 343), size, phone), { left: 16, top: 560 - 8 - 300 })
  })
  it('keeps the card inside the screen vertically', () => {
    assert.equal(peekPosition(row(940, 700), size, view).top, 800 - 300 - 8)
    assert.equal(peekPosition(row(940, -50), size, view).top, 8)
  })
  it('never leaves the screen, even on one too small for the card', () => {
    const tiny = { w: 200, h: 200 }
    const p = peekPosition(row(0, 0, 200), size, tiny)
    assert.deepEqual(p, { left: 8, top: 8 })
  })
})

/** The mapping from parameter to shell element is CSS, so it is checked as text against the two screens' own markup. */
describe('shell.css flash rules', () => {
  const css = readFileSync(new URL('../src/shell/shell.css', import.meta.url), 'utf8')
  // the two screens and the phone around them (item 3: the status bar, tab bar and home indicator in Device.tsx)
  const markup = ['ListScreen.tsx', 'DetailScreen.tsx', 'Device.tsx'].map(f => readFileSync(new URL(`../src/shell/${f}`, import.meta.url), 'utf8')).join('\n')
  const start = css.indexOf('/* ---------- C11')
  const block = css.slice(start)
  const rules = [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), body: m[2] })).filter(r => r.selector.includes('data-flash'))

  it('has a section for the highlight', () => {
    assert.ok(start > 0 && rules.length > 0)
  })
  it('has at least one rule for every parameter key', () => {
    for (const k of PARAMETER_KEYS) assert.ok(rules.some(r => r.selector.includes(`"${k}"`)), k)
  })
  it('names only parameter keys in data-flash selectors', () => {
    for (const r of rules) for (const m of r.selector.matchAll(/data-flash~="([^"]+)"/g)) assert.ok((PARAMETER_KEYS as readonly string[]).includes(m[1]), m[1])
  })
  it('targets only classes the two screens render', () => {
    const rendered = new Set([...markup.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)].flatMap(m => (m[1] ?? m[2]).match(/[a-z][a-z0-9-]*/g) ?? []))
    for (const c of ['item', 'row', 'pic', 'text', 'title', 'meta', 'tag', 'action', 'stats', 'feature', 'group', 'group-title', 'screen-title', 'review-head', 'review-section', 'large-title', 'tab-item']) assert.ok(rendered.has(c), `the markup reading finds .${c}`)
    assert.ok(!rendered.has('hero-mark') && !rendered.has('nonexistent'), 'and not a class the screens never render')
    for (const r of rules) for (const m of r.selector.matchAll(/\.([a-z][a-z0-9-]*)/g)) assert.ok(rendered.has(m[1]) || m[1] === 'shell', `.${m[1]} in ${r.selector}`)
  })
  it('draws an outline and nothing else, in the chrome accent and never a shell color', () => {
    for (const r of rules) assert.match(r.body, /outline/, r.selector)
    const code = block.replace(/\/\*[\s\S]*?\*\//g, '')
    assert.doesNotMatch(code, /var\(--color-/)
    for (const r of rules) assert.match(r.body, /var\(--accent, #C8502A\)/, r.selector)
  })
  it('adds no transition or animation', () => {
    assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, ''), /transition|animation/)
  })

  /* The accent family is gated on `data-accent`: a rule outlines an element only where the shell restyles it under the accent placement it is in.
   * A small evaluator for the subset the block uses: split the selector list at top-level commas, expand each :is(...), split a simple selector into the `.shell` compound and what comes after it,
   * and read the compound's attribute tests ([k~="v"], [k="v"], :not([k="v"])) against the attributes given. What it returns are the element selectors left standing. */
  const splitTop = (s: string, at: (c: string) => boolean): string[] => {
    const parts: string[] = []
    let depth = 0, from = 0
    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      if (c === '(' || c === '[') depth++
      else if (c === ')' || c === ']') depth--
      else if (depth === 0 && at(c)) { parts.push(s.slice(from, i)); from = i + 1 }
    }
    parts.push(s.slice(from))
    return parts.map(p => p.trim()).filter(Boolean)
  }
  const expandIs = (sel: string): string[] => {
    const open = sel.indexOf(':is(')
    if (open < 0) return [sel]
    let depth = 0, close = open + 3
    for (let i = open + 3; i < sel.length; i++) {
      if (sel[i] === '(') depth++
      else if (sel[i] === ')' && --depth === 0) { close = i; break }
    }
    return splitTop(sel.slice(open + 4, close), c => c === ',').flatMap(alt => expandIs(sel.slice(0, open) + alt + sel.slice(close + 1)))
  }
  const holds = (compound: string, attrs: Record<string, string>): boolean => {
    const not = [...compound.matchAll(/:not\(\[([a-z-]+)="([^"]*)"\]\)/g)]
    const has = [...compound.replace(/:not\([^)]*\)/g, '').matchAll(/\[([a-z-]+)(~?)="([^"]*)"\]/g)]
    return has.every(([, name, op, v]) => op === '~' ? (attrs[name] ?? '').split(' ').includes(v) : attrs[name] === v) && not.every(([, name, v]) => attrs[name] !== v)
  }
  /** The element selectors the flash rules outline for `key`, on a shell with these attributes (data-flash is set to `key`), sorted, each once. */
  const outlined = (key: string, attrs: Record<string, string>): string[] => {
    const all = { 'data-flash': key, ...attrs }
    const out = new Set<string>()
    for (const r of rules) for (const one of splitTop(r.selector, c => c === ',').flatMap(expandIs)) {
      const [compound, ...rest] = splitTop(one, c => c === ' ')
      if (holds(compound, all)) out.add(rest.join(' '))
    }
    return [...out].sort()
  }
  const PLACEMENTS = ['none', 'labels', 'actions', 'dividers', 'one-hero']
  const FIRST = '.group:first-of-type .item:first-of-type'
  const under = (key: string, accent: string, coverage = 'le5') => outlined(key, { 'data-accent': accent, 'data-coverage': coverage })

  it('the evaluator reads the block: an ungated key outlines on every placement, a key of another family on none', () => {
    for (const a of PLACEMENTS) {
      assert.deepEqual(under('color_bg', a), [''], a)   // the shell itself: nothing after the compound
      assert.deepEqual(under('grouping', a), ['.group-title'], a)
    }
  })

  it('color_accent outlines the elements the accent colors under the placement the shell is in, and none under none', () => {
    assert.deepEqual(under('color_accent', 'none'), [])
    // item 3: the active tab takes the accent under labels and actions, so it is outlined there too
    assert.deepEqual(under('color_accent', 'labels'), ['.stats strong', '.tab-item[data-active="true"]', '.tag'])
    assert.deepEqual(under('color_accent', 'actions'), ['.action', '.tab-item[data-active="true"]'])
    assert.deepEqual(under('color_accent', 'dividers'), ['.item', '.row'])
    assert.deepEqual(under('color_accent', 'one-hero'), [FIRST, '.screen-title'])
    assert.deepEqual(under('color_accent', 'one-hero', 'le15'), ['.feature', FIRST, '.screen-title'])
  })
  it('accent_coverage outlines only what coverage changes: the tags under labels, the buttons under actions, the item line under dividers, the first item and the card under one-hero', () => {
    assert.deepEqual(under('accent_coverage', 'none'), [])
    assert.deepEqual(under('accent_coverage', 'labels'), ['.tag'])
    assert.deepEqual(under('accent_coverage', 'actions'), ['.action'])
    assert.deepEqual(under('accent_coverage', 'dividers'), ['.item'])
    assert.deepEqual(under('accent_coverage', 'one-hero'), ['.feature', FIRST])
  })
  it('accent_coverage does not outline the buttons under labels, nor the tags under actions (the fix)', () => {
    assert.ok(!under('accent_coverage', 'labels').includes('.action'))
    assert.ok(!under('accent_coverage', 'actions').includes('.tag'))
    assert.ok(!under('accent_coverage', 'labels').includes('.stats strong'), 'the totals ignore coverage')
  })
  it('palette_hue_count outlines the third-hue tags wherever they are, and what the accent colors under each placement (one hue or two recolors every accent consumer)', () => {
    assert.deepEqual(under('palette_hue_count', 'none'), ['.palette-3 .tag'])
    assert.deepEqual(under('palette_hue_count', 'labels'), ['.palette-3 .tag', '.stats strong', '.tab-item[data-active="true"]', '.tag'])
    assert.deepEqual(under('palette_hue_count', 'actions'), ['.action', '.palette-3 .tag', '.tab-item[data-active="true"]'])
    assert.deepEqual(under('palette_hue_count', 'dividers'), ['.item', '.palette-3 .tag', '.row'])
    assert.deepEqual(under('palette_hue_count', 'one-hero'), [FIRST, '.palette-3 .tag', '.screen-title'])
    assert.deepEqual(under('palette_hue_count', 'one-hero', 'le15'), ['.feature', FIRST, '.palette-3 .tag', '.screen-title'])
  })
  it('accent_placement stays an ungated union on every placement, since the previous placement is unknown', () => {
    for (const a of PLACEMENTS) for (const sel of ['.tag', '.action', '.stats strong', '.tab-item[data-active="true"]']) assert.ok(under('accent_placement', a).includes(sel), `${a} ${sel}`)
    assert.deepEqual(under('accent_placement', 'dividers'), ['.action', '.item', '.row', '.stats strong', '.tab-item[data-active="true"]', '.tag'])
    assert.deepEqual(under('accent_placement', 'one-hero'), ['.action', FIRST, '.screen-title', '.stats strong', '.tab-item[data-active="true"]', '.tag'])
  })

  /** The selectors of shell.css above the highlight block, one per entry. */
  const baseSelectors = [...css.slice(0, start).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].flatMap(m => splitTop(m[1], c => c === ','))

  /** Every class an outline names is one that shell.css (above the highlight block) restyles under that very placement; for coverage, under a coverage condition too. */
  it('draws an accent-family outline only on elements a rule of shell.css restyles under that placement', () => {
    const restyled = (accent: string, cls: string, coverage: boolean) => baseSelectors.some(s => s.includes(`[data-accent="${accent}"]`) && s.includes(`.${cls}`) && (!coverage || s.includes('[data-coverage=')))
    for (const key of ['color_accent', 'accent_coverage', 'palette_hue_count']) {
      for (const a of PLACEMENTS) for (const cov of ['le2', 'le5', 'le15']) {
        for (const sel of under(key, a, cov)) {
          if (sel === '.palette-3 .tag') continue   // the third hue is a class of the markup, not a placement
          for (const cls of sel.match(/\.[a-z][a-z0-9-]*/g)!.map(c => c.slice(1))) {
            assert.ok(restyled(a, cls, key === 'accent_coverage'), `${key} outlines ${sel} under ${a} ${cov}, but no rule restyles .${cls} there`)
          }
        }
      }
    }
  })
  it('and the other way: wherever shell.css has a coverage rule for an element under a placement, accent_coverage outlines it there (nothing is left out)', () => {
    for (const [accent, cls] of [['labels', 'tag'], ['actions', 'action'], ['dividers', 'item'], ['one-hero', 'feature']]) {
      assert.ok(baseSelectors.some(s => s.includes(`[data-accent="${accent}"][data-coverage=`) && s.includes(`.${cls}`)), `shell.css has a coverage rule for .${cls} under ${accent}`)
      assert.ok(under('accent_coverage', accent).some(sel => sel.includes(`.${cls}`)), `${accent} .${cls}`)
    }
  })
})
