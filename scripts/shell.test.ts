/** Design pass (14_DESIGN_PASS §A) on the prototype shell: the type scale tokens toCssVars hands the two screens. Expected values are typed out from the spec table. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PARAMS, PARAM_SPEC, toCssVars, typeScale, type Params } from '../src/shell/params.ts'

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
