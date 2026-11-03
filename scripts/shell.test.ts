/** Design pass (14_DESIGN_PASS §A) on the prototype shell: the type scale tokens toCssVars hands the two screens, the spacing density picks, and the landing sentences that describe them.
 *  Expected values are typed out from the spec, never read from params.ts or landing.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_PARAMS, PARAM_SPEC, toCssVars, typeScale, type Params } from '../src/shell/params.ts'
import { landsOn } from '../src/lib/landing.ts'

const p = (patch: Partial<Params> = {}): Params => ({ ...DEFAULT_PARAMS, ...patch })
const tokens = (patch: Partial<Params>) => {
  const v = toCssVars(p(patch))
  return [v['--t-caption'], v['--t-body'], v['--t-title'], v['--t-display']]
}

describe('A1 type scale: four sizes from type_scale_ratio on a 15 px body', () => {
  it('caption = body / r (min 11), title = body × r, display = body × r² (cap 44)', () => {
    assert.deepEqual(tokens({ type_scale_ratio: 1.125 }), ['13.33px', '15px', '16.88px', '18.98px'])
    assert.deepEqual(tokens({ type_scale_ratio: 1.25 }), ['12px', '15px', '18.75px', '23.44px'])
    assert.deepEqual(tokens({ type_scale_ratio: 1.414 }), ['11px', '15px', '21.21px', '29.99px'])
    assert.deepEqual(tokens({ type_scale_ratio: 1.6 }), ['11px', '15px', '24px', '38.4px'])
    assert.deepEqual(tokens({ type_scale_ratio: 2 }), ['11px', '15px', '30px', '44px'])
  })
  it('title never passes display: at r = 3 both stop at the 44 px cap', () => {
    assert.deepEqual(tokens({ type_scale_ratio: 3 }), ['11px', '15px', '44px', '44px'])
    for (const r of (PARAM_SPEC.type_scale_ratio as { values: readonly number[] }).values) {
      const t = typeScale(r)
      assert.ok(t.caption <= t.body && t.body <= t.title && t.title <= t.display, String(r))
    }
  })
  it('drops the old multipliers', () => {
    const v = toCssVars(p())
    assert.equal(v['--title-size'], undefined)
    assert.equal(v['--display-size'], undefined)
  })
})

describe('A1 type family: the neutral skin sets Inter, a letterform rule overrides both stacks', () => {
  it('the default family becomes Inter for text and a display cut for titles', () => {
    const v = toCssVars(p())
    assert.equal(v['--font-family'], 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif')
    assert.equal(v['--font-display'], '"Inter Display", "SF Pro Display", Inter, system-ui, -apple-system, sans-serif')
  })
  it('any other type_family sets text and display alike', () => {
    const v = toCssVars(p({ type_family: '"Helvetica Neue", Arial, sans-serif' }))
    assert.equal(v['--font-family'], '"Helvetica Neue", Arial, sans-serif')
    assert.equal(v['--font-display'], '"Helvetica Neue", Arial, sans-serif')
  })
})

describe('A2 spacing: density pads a list item and never sets its height', () => {
  const css = readFileSync(new URL('../src/shell/shell.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  it('pads 4, 3, 2 and 1.5 spacing units as density goes 1, 2, 4, 6 (32 24 16 12 px at 8 px)', () => {
    assert.deepEqual([1, 2, 4, 6].map(density => toCssVars(p({ density }))['--item-pad']), ['calc(var(--space) * 4)', 'calc(var(--space) * 3)', 'calc(var(--space) * 2)', 'calc(var(--space) * 1.5)'])
    assert.equal(toCssVars(p({ density: 5 }))['--item-pad'], 'calc(var(--space) * 2)', 'a value outside the vocabulary pads as the default')
  })
  it('has no --item-h and no min-height on an item', () => {
    assert.doesNotMatch(css, /--item-h\b/)
    assert.equal(toCssVars(p())['--item-vh'], undefined)
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (/\.item\b/.test(m[1]) && !/\.pic|\.title/.test(m[1])) assert.doesNotMatch(m[2], /min-height/, m[1].trim())
  })
  it('the list item pads by --item-pad and the side margin', () => {
    assert.match(css, /\.item \{[^}]*padding: var\(--item-pad\) var\(--side\);/)
    assert.match(css, /--side: calc\(var\(--space\) \* 2\.5\);/)
  })
})

describe('A2 spacing: landsOn says the padding density sets', () => {
  it('in px when spacing_unit is in px, else as a multiple of it', () => {
    assert.equal(landsOn('density', p({ density: 1, spacing_unit: '12px' })), 'The loosest list: 48 px above and below each item; notes show.')
    assert.equal(landsOn('density', p({ density: 6, spacing_unit: '0.5rem' })), 'The tightest list: 1.5 × 0.5rem above and below each item; notes are hidden.')
  })
  it('spacing_unit names the multiple density picks', () => {
    assert.equal(landsOn('spacing_unit', p({ density: 1 })), 'Padding and gaps step in 8px; list items pad 4×.')
    assert.equal(landsOn('spacing_unit', p({ density: 6, spacing_unit: '10px' })), 'Padding and gaps step in 10px; list items pad 1.5×.')
  })
})
