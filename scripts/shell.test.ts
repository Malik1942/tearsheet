/** Design pass (14_DESIGN_PASS §A) on the prototype shell: the type scale tokens toCssVars hands the two screens, the spacing density picks, and the landing sentences that describe them.
 *  Expected values are typed out from the spec, never read from params.ts or landing.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_PARAMS, PARAM_SPEC, dataAttributes, toCssVars, typeScale, type Params } from '../src/shell/params.ts'
import { landsOn } from '../src/lib/landing.ts'

describe('accent_coverage reaches shell.css', () => {
  it('data-coverage is the token the coverage rules match: le15, le5, le2 (no % sign)', () => {
    const p = (accent_coverage: string): Params => ({ ...DEFAULT_PARAMS, accent_coverage })
    assert.deepEqual(['<=15%', '<=5%', '<=2%'].map(c => dataAttributes(p(c))['data-coverage']), ['le15', 'le5', 'le2'])
    const css = readFileSync(new URL('../src/shell/shell.css', import.meta.url), 'utf8')
    for (const token of ['le15', 'le5', 'le2']) assert.ok(css.includes(`[data-coverage="${token}"]`), token)
  })
})

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
  it('pads 4, 3, 2 and 2 spacing units as density goes 1, 2, 4, 6 (32 24 16 16 px at 8 px: the layout contract keeps item padding within 16–32)', () => {
    assert.deepEqual([1, 2, 4, 6].map(density => toCssVars(p({ density }))['--item-pad']), ['calc(var(--space) * 4)', 'calc(var(--space) * 3)', 'calc(var(--space) * 2)', 'calc(var(--space) * 2)'])
    assert.equal(toCssVars(p({ density: 5 }))['--item-pad'], 'calc(var(--space) * 2)', 'a value outside the vocabulary pads as the default')
  })
  it('has no --item-h and no min-height on an item', () => {
    assert.doesNotMatch(css, /--item-h\b/)
    assert.equal(toCssVars(p())['--item-vh'], undefined)
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (/\.item\b/.test(m[1]) && !/\.pic|\.title/.test(m[1])) assert.doesNotMatch(m[2], /min-height/, m[1].trim())
  })
  it('the list item pads by --item-pad and the side margin', () => {
    assert.match(css, /\.item \{[^}]*padding: var\(--item-pad\) var\(--side\);/)   // the chevron's room is the text column's own 24 (contract rule 2: only scale steps)
    assert.match(css, /--side: calc\(var\(--space\) \* 2\);/)
  })
})

describe('A2 spacing: landsOn says the padding density sets', () => {
  it('in px when spacing_unit is in px, else as a multiple of it', () => {
    assert.equal(landsOn('density', p({ density: 1, spacing_unit: '12px' })), 'The loosest list: 48 px above and below each item; notes show.')
    assert.equal(landsOn('density', p({ density: 6, spacing_unit: '0.5rem' })), 'The tightest list: 2 × 0.5rem above and below each item; notes are hidden and a poster is at most a sixth of the screen tall.')
  })
  it('spacing_unit names the multiple density picks', () => {
    assert.equal(landsOn('spacing_unit', p({ density: 1 })), 'Padding and gaps step in 8px; list items pad 4×.')
    assert.equal(landsOn('spacing_unit', p({ density: 6, spacing_unit: '10px' })), 'Padding and gaps step in 10px; list items pad 2×.')
  })
})

/** The declarations shell.css gives a selector, from every rule whose selector list names it exactly (comments dropped). */
const declsOf = (selector: string): string => {
  const css = readFileSync(new URL('../src/shell/shell.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].split(',').map(s => s.trim()).includes(selector)).map(m => m[2]).join(';')
}

describe('A6 year review hierarchy', () => {
  it('the year and the three totals are display size; their labels are captions', () => {
    for (const s of ['.screen-title', '.stats strong']) assert.match(declsOf(s), /font-size: var\(--t-display\)/, s)
    assert.match(declsOf('.stats li'), /font-size: var\(--t-caption\)/)
  })
  it('month headings are caption labels: uppercase, 0.06em, muted, not large bold headings', () => {
    assert.match(declsOf('.group-title'), /font-size: var\(--t-caption\)/)
    assert.match(declsOf('.group-title'), /text-transform: uppercase/)
    assert.match(declsOf('.group-title'), /letter-spacing: 0\.06em/)
    assert.match(declsOf('.group-title'), /color: var\(--color-muted\)/)
    assert.equal(declsOf('.review-section .group-title'), '', 'no review-only heading size')
  })
  it('rows: title size, caption meta, a date that never wraps, 12 px vertical padding', () => {
    assert.match(declsOf('.row .title'), /font-size: var\(--t-title\)/)
    assert.match(declsOf('.row .meta'), /font-size: var\(--t-caption\)/)
    assert.match(declsOf('.row .when'), /white-space: nowrap; min-width: 5ch/)
    assert.match(declsOf('.row'), /padding: calc\(var\(--space\) \* 1\.5\) var\(--side\)/)
  })
  it('the totals follow the alignment: centered under center, at the right edge under right', () => {
    assert.match(declsOf('.shell[data-align="center"] .stats'), /justify-content: center/)
    assert.match(declsOf('.shell[data-align="right"] .stats'), /justify-content: flex-end/)
  })
})

describe('A5 alignment fixes', () => {
  const markup = readFileSync(new URL('../src/shell/ListScreen.tsx', import.meta.url), 'utf8')
  it('the list meta is a date, a separator and a venue, so center can put date and venue on lines of their own', () => {
    // item 1: the venue span holds the entry's subtitle, with its place where the content has one (the concert log's "venue, city")
    assert.match(markup, /<p className="meta"><span className="date">\{shortDate\(e\.date\)\}<\/span><span className="sep"> · <\/span><span className="venue">\{e\.place \? `\$\{e\.subtitle\}, \$\{e\.place\}` : e\.subtitle\}<\/span><\/p>/)
  })
  it('under center: one line each for date and venue, cut with an ellipsis; no separator; tags on one line', () => {
    assert.ok(readFileSync(new URL('../src/shell/shell.css', import.meta.url), 'utf8').includes('.shell[data-align="center"] .item .meta :is(.date, .venue) { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }'))
    assert.match(declsOf('.shell[data-align="center"] .item .meta .sep'), /display: none/)
    assert.match(declsOf('.shell[data-align="center"] .item .tags'), /white-space: nowrap; overflow: hidden; text-overflow: ellipsis/)
  })
  it('the text column stops at 32 characters', () => {
    assert.match(declsOf('.item .text'), /max-width: calc\(32ch \+ var\(--space\) \* 3\)/)   // 32 characters of text, plus the chevron's 24
  })
  it('the balanced poster column never drops under a 48 px tall 16:10 poster, and the text keeps 9em; the type-led square keeps its 48 px floor', () => {
    assert.match(declsOf('.item'), /grid-template-columns: minmax\(calc\(48px \* 16 \/ 10\), calc\(var\(--image-share\) \* 100%\)\) minmax\(calc\(9em \+ var\(--space\) \* 3\), 1fr\)/)
    assert.match(declsOf('.shell[data-hierarchy="type-led"] .item'), /grid-template-columns: 1fr minmax\(48px, calc\(var\(--image-share\) \* 60%\)\)/)
  })
})
