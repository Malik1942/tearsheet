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
import { PEEK_WIDTH, flashKeys, peekPosition, peekRegions, peekSize } from '../src/lib/highlight.ts'

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
  const markup = ['ListScreen.tsx', 'DetailScreen.tsx'].map(f => readFileSync(new URL(`../src/shell/${f}`, import.meta.url), 'utf8')).join('\n')
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
    for (const c of ['item', 'row', 'pic', 'text', 'title', 'meta', 'tag', 'action', 'stats', 'feature', 'group', 'group-title', 'screen-title', 'review-head', 'review-section']) assert.ok(rendered.has(c), `the markup reading finds .${c}`)
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
})
