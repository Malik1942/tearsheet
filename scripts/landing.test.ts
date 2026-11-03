/** Spec v2 C4′, rule before number: the landing sentences, the row headline and footnote, and the tokens.css comments, checked on the real sample bricks.
 *  Expected strings are typed out from the spec, never read from landing.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { resolveProject, type Project, type Resolved } from '../src/lib/mapRelations.ts'
import type { Brick } from '../src/lib/types.ts'
import { DEFAULT_PARAMS, PARAMETER_KEYS, PARAM_SPEC, type ParameterKey, type Params } from '../src/shell/params.ts'
import { colorName, footnoteOf, landsOn, rowHeadline, ruleTextOf } from '../src/lib/landing.ts'
import { exportCss } from '../src/export/index.ts'

const p = (patch: Partial<Params> = {}): Params => ({ ...DEFAULT_PARAMS, ...patch })
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

describe('colorName', () => {
  it('names the required cases', () => {
    for (const [hex, name] of [['#2F6FED', 'blue'], ['#C8502A', 'red'], ['#1B1B1B', 'black'], ['#F4F2EE', 'white'], ['#6B6B6B', 'grey'], ['#2E8B57', 'green'], ['#F2C200', 'yellow']]) assert.equal(colorName(hex), name, hex)
  })
  it('names each hue range from a pure color', () => {
    for (const [hex, name] of [['#FF0000', 'red'], ['#FF8000', 'orange'], ['#FFFF00', 'yellow'], ['#00FF00', 'green'], ['#00FFFF', 'teal'], ['#0000FF', 'blue'], ['#8000FF', 'purple'], ['#FF00FF', 'pink']]) assert.equal(colorName(hex), name, hex)
  })
  it('puts a hue exactly on a boundary in the range above it, one step lower in the range below', () => {
    const edges: [string, string, string, number][] = [   // [on the boundary, just under it, name under it, boundary in degrees]
      ['#C83200', '#C83100', 'red', 15], ['#C89600', '#C89500', 'orange', 45], ['#C8F000', '#C8EF00', 'yellow', 70], ['#00F0C8', '#00F0C7', 'green', 170],
      ['#00A0F0', '#00A0EF', 'teal', 200], ['#3200C8', '#3100C7', 'blue', 255], ['#C800F0', '#C700F0', 'purple', 290], ['#C80032', '#C80033', 'pink', 345],
    ]
    const above: Record<number, string> = { 15: 'orange', 45: 'yellow', 70: 'green', 170: 'teal', 200: 'blue', 255: 'purple', 290: 'pink', 345: 'red' }
    for (const [on, under, nameUnder, deg] of edges) {
      assert.equal(colorName(on), above[deg], `${on} sits at ${deg}°`)
      assert.equal(colorName(under), nameUnder, `${under} sits just under ${deg}°`)
    }
  })
  it('calls very dark black and very light white before looking at saturation', () => {
    assert.equal(colorName('#1E1E1E'), 'black')     // l = 0.1176
    assert.equal(colorName('#1F1F1F'), 'grey')      // l = 0.1216
    assert.equal(colorName('#000000'), 'black')
    assert.equal(colorName('#171818'), 'black')     // teal hue, but l < 0.12 first
    assert.equal(colorName('#F0F0F0'), 'white')     // l = 0.9412
    assert.equal(colorName('#EFEFEF'), 'grey')      // l = 0.9373
    assert.equal(colorName('#FFFFFF'), 'white')
  })
  it('calls a color grey only when its saturation is under 0.12', () => {
    assert.equal(colorName('#8A8680'), 'grey')      // s = 0.041
    assert.equal(colorName('#967878'), 'red')       // s = 0.125
    assert.equal(colorName('#917373'), 'red')       // s = 0.12 exactly: not under it
  })
  it('reads lower-case hex', () => assert.equal(colorName('#2f6fed'), 'blue'))
  it('answers grey for anything that is not #RRGGBB', () => {
    for (const bad of ['', 'blue', '#FFF', '2F6FED', '#12345', '#1234567', '#2F6FEDFF', '#GGGGGG', 'rgb(47, 111, 237)', ' #2F6FED']) assert.equal(colorName(bad), 'grey', JSON.stringify(bad))
  })
})

describe('landsOn: type_scale_ratio', () => {
  it('type-led: the names lead at the squared ratio', () => {
    assert.equal(landsOn('type_scale_ratio', p({ hierarchy_mode: 'type-led', type_scale_ratio: 1.25 })), 'Artist names lead at 1.56× the body text; the “2025” headline is 1.56× too.')
    assert.equal(landsOn('type_scale_ratio', p({ hierarchy_mode: 'type-led', type_scale_ratio: 2 })), 'Artist names lead at 4× the body text; the “2025” headline is 4× too.')
  })
  it('image-led: list titles stay small; section titles take the ratio and the headline its square', () => {
    assert.equal(landsOn('type_scale_ratio', p({ hierarchy_mode: 'image-led', type_scale_ratio: 1.414 })), 'List titles stay small under the poster; year-review section titles are 1.414× and the “2025” headline is 2×.')
    assert.equal(landsOn('type_scale_ratio', p({ hierarchy_mode: 'image-led', type_scale_ratio: 2 })), 'List titles stay small under the poster; year-review section titles are 2× and the “2025” headline is 4×.')
  })
  it('balanced: the names take the ratio and the headline its square', () => {
    assert.equal(landsOn('type_scale_ratio', p({ hierarchy_mode: 'balanced', type_scale_ratio: 1.25 })), 'Artist names are 1.25× the body text; the “2025” headline is 1.56×.')
  })
  it('squares every ratio of the vocabulary to two places', () => {
    for (const [ratio, square] of [[1.125, '1.27'], [1.25, '1.56'], [1.414, '2'], [1.6, '2.56'], [2, '4'], [3, '9']] as const) {
      assert.equal(landsOn('type_scale_ratio', p({ type_scale_ratio: ratio })), `Artist names are ${ratio}× the body text; the “2025” headline is ${square}×.`)
    }
  })
})

describe('landsOn: the plain enums', () => {
  const table: [ParameterKey, Record<string, string>][] = [
    ['hierarchy_mode', {
      'type-led': 'The artist name leads each list item at headline size and the poster shrinks to a square on the right; year-review rows drop their thumbnails.',
      'image-led': 'The poster leads each list item, full width above the text; year-review rows become full-width images.',
      balanced: 'Poster and text sit side by side in each list item.',
    }],
    ['density', {
      1: 'One list item fills the screen, with its note.',
      2: 'Two list items per screen, with notes.',
      4: 'Four list items per screen; notes are hidden.',
      6: 'Six list items per screen; notes are hidden.',
    }],
    ['grouping', {
      none: 'One ungrouped list; the year review still groups by month.',
      'by-time': 'Shows are grouped under month headings on both screens.',
      'by-place': 'Shows are grouped by city on both screens.',
      'by-tag': 'Shows are grouped by genre on both screens.',
    }],
    ['rhythm', {
      uniform: 'Every list item has the same shape.',
      alternating: 'Every second item puts its poster on the other side, on both screens.',
      'featured-first': 'The first show becomes a large feature; the year review opens with “Show of the year” and puts the biggest section first.',
    }],
    ['alignment_edge', {
      left: 'Text hugs the left edge; the right side stays empty.',
      right: 'Text hugs the right edge and posters move to the right.',
      center: 'Titles, dates and headings are centered.',
      split: 'Artist names sit left and the date line sits right.',
    }],
  ]
  for (const [key, sentences] of table) {
    it(`${key}: one sentence per value`, () => {
      for (const [value, sentence] of Object.entries(sentences)) assert.equal(landsOn(key, p({ [key]: /^\d+$/.test(value) ? Number(value) : value })), sentence, `${key} = ${value}`)
    })
  }
  it('has a sentence for every value of the shell vocabulary', () => {
    // a value added to PARAM_SPEC without a sentence fails here, and in the test above where it falls back to the default's sentence
    for (const [key, sentences] of table) assert.deepEqual(Object.keys(sentences).sort(), (PARAM_SPEC[key] as { values: readonly (string | number)[] }).values.map(String).sort(), key)
  })
  it('reads a value outside the vocabulary as the default and never throws', () => {
    for (const [key, sentences] of table) assert.equal(landsOn(key, p({ [key]: 'zzz' })), sentences[String(DEFAULT_PARAMS[key])], key)
    assert.equal(landsOn('accent_placement', p({ accent_placement: 'zzz' })), 'Genre tags are outlined in blue; year-review totals are blue.')
    assert.equal(landsOn('accent_placement', p({ accent_coverage: 'zzz' })), 'Genre tags are outlined in blue; year-review totals are blue.')
  })
})

describe('landsOn: image_text_dominance', () => {
  it('type-led: a square up to 60% of the share, as a percent of the item width', () => {
    assert.equal(landsOn('image_text_dominance', p({ hierarchy_mode: 'type-led', image_text_dominance: 0.4 })), "The poster sits right as a square up to 24% of the item's width; year-review rows have no thumbnails.")
    assert.equal(landsOn('image_text_dominance', p({ hierarchy_mode: 'type-led', image_text_dominance: 0.8 })), "The poster sits right as a square up to 48% of the item's width; year-review rows have no thumbnails.")
  })
  it('image-led: full-width posters, the share as a percent of the item height', () => {
    assert.equal(landsOn('image_text_dominance', p({ hierarchy_mode: 'image-led', image_text_dominance: 0.55 })), "Posters run full width above the text, 55% of the item's height; year-review images grow with it.")
  })
  it('balanced: posters take the share of each list item width', () => {
    assert.equal(landsOn('image_text_dominance', p({ hierarchy_mode: 'balanced', image_text_dominance: 0.4 })), "Posters take 40% of each list item's width; year-review thumbnails grow with it.")
  })
  it('adds the cap note above 0.8 and the raise note below 0.15, each after one space', () => {
    assert.equal(landsOn('image_text_dominance', p({ hierarchy_mode: 'image-led', image_text_dominance: 0.95 })), "Posters run full width above the text, 80% of the item's height; year-review images grow with it. Capped at 80% so the text stays readable.")
    assert.equal(landsOn('image_text_dominance', p({ hierarchy_mode: 'balanced', image_text_dominance: 0.1 })), "Posters take 15% of each list item's width; year-review thumbnails grow with it. Raised to 15% so the poster stays visible.")
    assert.equal(landsOn('image_text_dominance', p({ hierarchy_mode: 'type-led', image_text_dominance: 1 })), "The poster sits right as a square up to 48% of the item's width; year-review rows have no thumbnails. Capped at 80% so the text stays readable.")
    assert.equal(landsOn('image_text_dominance', p({ hierarchy_mode: 'type-led', image_text_dominance: 0 })), "The poster sits right as a square up to 9% of the item's width; year-review rows have no thumbnails. Raised to 15% so the poster stays visible.")
  })
  it('adds no note exactly at 0.8 and at 0.15', () => {
    assert.equal(landsOn('image_text_dominance', p({ image_text_dominance: 0.8 })), "Posters take 80% of each list item's width; year-review thumbnails grow with it.")
    assert.equal(landsOn('image_text_dominance', p({ image_text_dominance: 0.15 })), "Posters take 15% of each list item's width; year-review thumbnails grow with it.")
  })
})

describe('landsOn: accent_placement and accent_coverage', () => {
  const BY: Record<string, Record<string, string>> = {   // default accent #2F6FED is blue
    labels: { '<=15%': 'Genre tags are filled blue; year-review totals are blue.', '<=5%': 'Genre tags are outlined in blue; year-review totals are blue.', '<=2%': 'Genre tags stay grey with a small blue dot; year-review totals are blue.' },
    actions: { '<=15%': 'Only the Details buttons are filled blue.', '<=5%': 'Only the Details buttons are blue.', '<=2%': 'Only the Details buttons carry the accent, as a blue underline.' },
    dividers: { '<=15%': 'The lines between items are blue and 6 px thick.', '<=5%': 'The lines between items are blue and 2 px thick.', '<=2%': 'The lines between items are blue and 1 px thick.' },
    'one-hero': { '<=15%': 'The first show is filled blue and the “2025” headline is blue.', '<=5%': "Only the first show's title and the “2025” headline are blue.", '<=2%': "Only the first show's title and the “2025” headline are blue." },
  }
  it('every placement × coverage has its sentence', () => {
    const spec = (k: 'accent_placement' | 'accent_coverage') => (PARAM_SPEC[k] as { values: readonly string[] }).values
    assert.deepEqual(Object.keys(BY).sort(), spec('accent_placement').filter(v => v !== 'none').sort(), 'every placement but none')
    for (const [placement, byCoverage] of Object.entries(BY)) {
      assert.deepEqual(Object.keys(byCoverage).sort(), [...spec('accent_coverage')].sort(), `every coverage of ${placement}`)
      for (const [coverage, sentence] of Object.entries(byCoverage)) assert.equal(landsOn('accent_placement', p({ accent_placement: placement, accent_coverage: coverage })), sentence, `${placement} ${coverage}`)
    }
  })
  it('takes the color name from color_accent', () => {
    assert.equal(landsOn('accent_placement', p({ accent_placement: 'actions', accent_coverage: '<=5%', color_accent: '#C8502A' })), 'Only the Details buttons are red.')
    assert.equal(landsOn('accent_placement', p({ accent_placement: 'labels', accent_coverage: '<=15%', color_accent: '#2E8B57' })), 'Genre tags are filled green; year-review totals are green.')
  })
  it('none keeps its sentence', () => {
    assert.equal(landsOn('accent_placement', p({ accent_placement: 'none' })), 'No element takes the accent color.')
    assert.equal(landsOn('accent_placement', p({ accent_placement: 'none', palette_hue_count: 1 })), 'No element takes the accent color.')
  })
  it('with one hue the accent is the text color, whatever the coverage', () => {
    const who = { labels: 'genre tags', actions: 'the Details buttons', dividers: 'the lines between items', 'one-hero': 'the first show' }
    for (const [placement, w] of Object.entries(who)) for (const coverage of ['<=15%', '<=5%', '<=2%']) {
      assert.equal(landsOn('accent_placement', p({ accent_placement: placement, accent_coverage: coverage, palette_hue_count: 1 })), `With one hue the accent is the text color, so ${w} do not stand out.`, `${placement} ${coverage}`)
    }
  })
  it('with three hues the accent still lands as with two', () => {
    assert.equal(landsOn('accent_placement', p({ accent_placement: 'actions', accent_coverage: '<=5%', palette_hue_count: 3 })), 'Only the Details buttons are blue.')
  })
  it('accent_coverage: placement none means coverage has no effect', () => {
    for (const coverage of ['<=15%', '<=5%', '<=2%']) assert.equal(landsOn('accent_coverage', p({ accent_placement: 'none', accent_coverage: coverage })), 'No element takes the accent, so coverage has no effect.')
  })
  it('accent_coverage: shows ≤, then the placement sentence with its first letter lower-cased', () => {
    assert.equal(landsOn('accent_coverage', p({ accent_placement: 'actions', accent_coverage: '<=5%' })), 'At ≤5% coverage: only the Details buttons are blue.')
    for (const [placement, byCoverage] of Object.entries(BY)) for (const [coverage, sentence] of Object.entries(byCoverage)) {
      assert.equal(landsOn('accent_coverage', p({ accent_placement: placement, accent_coverage: coverage })), `At ${coverage.replace('<=', '≤')} coverage: ${lower(sentence)}`, `${placement} ${coverage}`)
    }
  })
  it('accent_coverage: with one hue it carries the one-hue sentence', () => {
    assert.equal(landsOn('accent_coverage', p({ accent_placement: 'actions', accent_coverage: '<=5%', palette_hue_count: 1 })), 'At ≤5% coverage: with one hue the accent is the text color, so the Details buttons do not stand out.')
  })
})

describe('landsOn: palette_hue_count and the skin', () => {
  it('palette_hue_count', () => {
    assert.equal(landsOn('palette_hue_count', p({ palette_hue_count: 1 })), 'One hue: the accent falls back to the text color, so nothing is colored.')
    assert.equal(landsOn('palette_hue_count', p({ palette_hue_count: 2 })), 'Two hues: the text color plus blue for the accent.')
    assert.equal(landsOn('palette_hue_count', p({ palette_hue_count: 2, color_accent: '#C8502A' })), 'Two hues: the text color plus red for the accent.')
    assert.equal(landsOn('palette_hue_count', p({ palette_hue_count: 3 })), 'A third hue tints the genre tags on the list.')
  })
  it('color_bg and color_fg name the color', () => {
    assert.equal(landsOn('color_bg', p({ color_bg: '#F4F2EE' })), 'White page background on both screens.')
    assert.equal(landsOn('color_bg', p({ color_bg: '#2F6FED' })), 'Blue page background on both screens.')
    assert.equal(landsOn('color_fg', p({ color_fg: '#1B1B1B' })), 'Black text; muted text and lines are mixed from it.')
    assert.equal(landsOn('color_fg', p({ color_fg: '#6B6B6B' })), 'Grey text; muted text and lines are mixed from it.')
  })
  it('color_accent is used with two hues or more and unused with one', () => {
    assert.equal(landsOn('color_accent', p({ palette_hue_count: 2 })), 'Blue accent; accent_placement decides where it shows.')
    assert.equal(landsOn('color_accent', p({ palette_hue_count: 3, color_accent: '#C8502A' })), 'Red accent; accent_placement decides where it shows.')
    assert.equal(landsOn('color_accent', p({ palette_hue_count: 1 })), 'Unused: with one hue the accent is the text color.')
  })
  it('radius: zero is square, anything else is named', () => {
    assert.equal(landsOn('radius', p({ radius: '0px' })), 'Posters, tags and buttons have square corners.')
    assert.equal(landsOn('radius', p({ radius: '0' })), 'Posters, tags and buttons have square corners.')
    assert.equal(landsOn('radius', p({ radius: 0 })), 'Posters, tags and buttons have square corners.')
    assert.equal(landsOn('radius', p({ radius: '8px' })), 'Corners of posters, tags and buttons are 8px.')
    assert.equal(landsOn('radius', p({ radius: '50%' })), 'Corners of posters, tags and buttons are 50%.')
  })
  it('type_family: the first family of the stack, trimmed, without its quotes', () => {
    assert.equal(landsOn('type_family', p()), 'Every text on both screens is set in system-ui.')
    assert.equal(landsOn('type_family', p({ type_family: '"Helvetica Neue", "Inter", Arial, sans-serif' })), 'Every text on both screens is set in Helvetica Neue.')
    assert.equal(landsOn('type_family', p({ type_family: "'Gill Sans', serif" })), 'Every text on both screens is set in Gill Sans.')
    assert.equal(landsOn('type_family', p({ type_family: '  Georgia , serif' })), 'Every text on both screens is set in Georgia.')
    assert.equal(landsOn('type_family', p({ type_family: 'monospace' })), 'Every text on both screens is set in monospace.')
  })
  it('spacing_unit', () => {
    assert.equal(landsOn('spacing_unit', p()), 'Padding and gaps step in 8px; list items pad 2×.')
    assert.equal(landsOn('spacing_unit', p({ spacing_unit: '12px' })), 'Padding and gaps step in 12px; list items pad 2×.')
  })
  it('answers every key of the vocabulary with a sentence', () => {
    for (const key of PARAMETER_KEYS) assert.match(landsOn(key, p()), /^\S.*\.$/, key)
  })
})

/* ---------------- on the real sample bricks ---------------- */

const brick = (id: string): Brick => SAMPLES.find(b => b.id === id)!
const ruleOf = (id: string, relation: string) => brick(id).relations.find(r => r.id === relation)!.rule
const measurement = (id: string, m: string) => brick(id).measurements.find(x => x.id === m)!
const statementOf = (id: string, m: string) => measurement(id, m).statement
const footnoteFrom = (id: string, m: string) => `${m}: ${measurement(id, m).value}`
const project = (patch: Partial<Project> = {}): Project => ({ id: 't', intent: 'x', createdAt: '', brickIds: ['g1', 'g2', 'calmmouse'], disabled: {}, choice: {}, locks: {}, manual: {}, ...patch })
const resolved = resolveProject(project(), SAMPLES)

/** What g1, g2 and calmmouse resolve to, row by row: the headline typed out from the spec, with rules and statements read from the fixtures. */
const HEADLINES: Record<ParameterKey, string> = {
  type_scale_ratio: `${ruleOf('calmmouse', 'r1')} → List titles stay small under the poster; year-review section titles are 2× and the “2025” headline is 4×.`,
  hierarchy_mode: `${ruleOf('g1', 'r1')} → The poster leads each list item, full width above the text; year-review rows become full-width images.`,
  density: 'Shell default → Four list items per screen; notes are hidden.',
  grouping: 'Shell default → One ungrouped list; the year review still groups by month.',
  rhythm: 'Shell default → Every list item has the same shape.',
  alignment_edge: 'Shell default → Text hugs the left edge; the right side stays empty.',
  image_text_dominance: `${ruleOf('g2', 'r1')} → Posters run full width above the text, 80% of the item's height; year-review images grow with it. Capped at 80% so the text stays readable.`,
  accent_placement: 'Shell default → Genre tags are outlined in teal; year-review totals are teal.',
  accent_coverage: `${ruleOf('g2', 'r2')} → At ≤5% coverage: genre tags are outlined in teal; year-review totals are teal.`,
  palette_hue_count: `${ruleOf('g1', 'r3')} → A third hue tints the genre tags on the list.`,
  color_bg: 'Teal page background on both screens.',
  color_fg: 'Black text; muted text and lines are mixed from it.',
  color_accent: 'Teal accent; accent_placement decides where it shows.',
  radius: 'Shell default → Corners of posters, tags and buttons are 8px.',
  type_family: `${statementOf('g2', 'm4')} → Every text on both screens is set in Helvetica Neue.`,
  spacing_unit: 'Shell default → Padding and gaps step in 8px; list items pad 2×.',
}
const FOOTNOTES: Partial<Record<ParameterKey, string>> = {
  type_scale_ratio: footnoteFrom('calmmouse', 'm1'),
  hierarchy_mode: footnoteFrom('g1', 'm_foreground_coverage'),
  image_text_dominance: footnoteFrom('g2', 'm4'),
  accent_coverage: footnoteFrom('g2', 'm3'),
  palette_hue_count: footnoteFrom('g1', 'm_palette'),
  type_family: footnoteFrom('g2', 'm4'),
}

describe('ruleTextOf, rowHeadline and footnoteOf on g1 + g2 + calmmouse', () => {
  const v = resolved.values
  it('a relation-sourced value shows its relation rule verbatim, then →, then where it lands', () => {
    for (const [key, brickId, rel] of [['type_scale_ratio', 'calmmouse', 'r1'], ['hierarchy_mode', 'g1', 'r1'], ['image_text_dominance', 'g2', 'r1'], ['accent_coverage', 'g2', 'r2'], ['palette_hue_count', 'g1', 'r3']] as const) {
      assert.equal(ruleTextOf(v[key], SAMPLES), ruleOf(brickId, rel), key)
      assert.ok(rowHeadline(v[key], resolved.params, SAMPLES).startsWith(`${ruleOf(brickId, rel)} → `), key)
    }
  })
  it('a by-rule value with a measurement shows that measurement statement as its rule', () => {
    assert.equal(v.type_family.provenance, 'adapted')
    assert.ok(v.type_family.source?.note?.startsWith('by rule'))
    assert.equal(ruleTextOf(v.type_family, SAMPLES), statementOf('g2', 'm4'))
  })
  it('the alignment_edge by-rule value of a single-brick project starts with its measurement statement', () => {
    const id = 'secession-1902-beethoven-catalogue'
    const r = resolveProject(project({ brickIds: [id] }), SAMPLES)
    assert.ok(r.values.alignment_edge.source?.note?.startsWith('by rule'), 'this brick fills alignment_edge by rule')
    assert.equal(r.params.alignment_edge, 'center')
    assert.equal(rowHeadline(r.values.alignment_edge, r.params, SAMPLES), `${statementOf(id, 'm_caption')} → Titles, dates and headings are centered.`)
    assert.equal(footnoteOf(r.values.alignment_edge, SAMPLES), footnoteFrom(id, 'm_caption'))
  })
  it('a shell default starts with Shell default → and has neither rule nor footnote', () => {
    for (const key of ['density', 'grouping', 'rhythm', 'alignment_edge', 'accent_placement', 'radius', 'spacing_unit'] as const) {
      assert.ok(rowHeadline(v[key], resolved.params, SAMPLES).startsWith('Shell default → '), key)
      assert.equal(ruleTextOf(v[key], SAMPLES), null, key)
      assert.equal(footnoteOf(v[key], SAMPLES), null, key)
    }
  })
  it('a hand-set value starts with Set by you →', () => {
    const r = resolveProject(project({ manual: { density: 2 } }), SAMPLES)
    assert.equal(rowHeadline(r.values.density, r.params, SAMPLES), 'Set by you → Two list items per screen, with notes.')
    assert.equal(ruleTextOf(r.values.density, SAMPLES), null)
    assert.equal(footnoteOf(r.values.density, SAMPLES), null)
  })
  it('a measured skin color is the landing sentence alone', () => {
    for (const key of ['color_bg', 'color_fg', 'color_accent'] as const) {
      assert.equal(v[key].provenance, 'measured')
      const headline = rowHeadline(v[key], resolved.params, SAMPLES)
      assert.equal(ruleTextOf(v[key], SAMPLES), null, key)
      assert.equal(headline, landsOn(key, resolved.params), key)
      assert.ok(headline.length > 0 && !headline.includes(' → '), `${key} has no prefix: ${headline}`)
      assert.equal(footnoteOf(v[key], SAMPLES), null, key)
    }
  })
  it('a conflict picked by hand keeps the chosen relation rule', () => {
    assert.ok(resolved.conflicts.includes('palette_hue_count'))
    const r = resolveProject(project({ choice: { palette_hue_count: 'g2/r3' } }), SAMPLES)
    assert.ok(r.values.palette_hue_count.source?.note?.startsWith('by you'))
    assert.ok(rowHeadline(r.values.palette_hue_count, r.params, SAMPLES).startsWith(`${ruleOf('g2', 'r3')} → `))
  })
  it('without the source brick there is no rule text and no footnote to quote', () => {
    assert.equal(ruleTextOf(v.type_family, []), null)
    assert.equal(footnoteOf(v.type_family, []), null)
    assert.equal(rowHeadline(v.type_family, resolved.params, []), 'Every text on both screens is set in Helvetica Neue.')
  })
  it('the footnote is "id: value" of the first measurement the brick has', () => {
    for (const [key, note] of Object.entries(FOOTNOTES)) assert.equal(footnoteOf(v[key as ParameterKey], SAMPLES), note, key)
    const skipsAMissingId = { ...v.type_scale_ratio, source: { ...v.type_scale_ratio.source!, measurementIds: ['not-in-this-brick', 'm2'] } }
    assert.equal(footnoteOf(skipsAMissingId, SAMPLES), footnoteFrom('calmmouse', 'm2'))
    assert.equal(footnoteOf({ ...v.type_scale_ratio, source: { ...v.type_scale_ratio.source!, measurementIds: ['not-in-this-brick'] } }, SAMPLES), null)
  })
  it('all sixteen rows read as typed out from the spec', () => {
    for (const key of PARAMETER_KEYS) assert.equal(rowHeadline(v[key], resolved.params, SAMPLES), HEADLINES[key], key)
  })
})

describe('exportCss', () => {
  const escaped = (s: string) => s.replaceAll('*/', '* /')
  const css = exportCss(resolved, SAMPLES)
  const commentOf = (text: string, key: ParameterKey) => {
    const line = text.split('\n').find(l => l.startsWith(`  --${key.replace(/_/g, '-')}:`) && l.includes('/* '))
    assert.ok(line, `a commented line for ${key}`)
    return line.slice(line.indexOf('/* ') + 3, line.lastIndexOf(' */'))
  }
  const count = (text: string, token: string) => text.split(token).length - 1

  it('every parameter line carries a comment that starts with its row headline', () => {
    for (const key of PARAMETER_KEYS) assert.ok(commentOf(css, key).startsWith(`${escaped(HEADLINES[key])} · `), key)
  })
  it('then the origin it had, then the footnote when there is one', () => {
    assert.equal(commentOf(css, 'type_scale_ratio'), `${HEADLINES.type_scale_ratio} · measured · calmmouse · r1 · from m1, m2, m7 · ${FOOTNOTES.type_scale_ratio}`)
    assert.equal(commentOf(css, 'density'), `${HEADLINES.density} · adapted · shell default`)
    assert.equal(commentOf(css, 'color_bg'), `${HEADLINES.color_bg} · measured · g1`)
  })
  it('keeps the values and the resolved shell variables as they were', () => {
    assert.match(css, /^\/\* Tearsheet tokens\./)
    assert.ok(css.includes('  --type-scale-ratio: 2; /* '))
    assert.ok(css.includes('  --color-bg: #D4DFE0; /* '))
    assert.ok(css.includes('\n  /* resolved shell variables, what the two reference screens actually consume */\n'))
    assert.ok(css.includes('  --title-size: calc(var(--body-size) * 2);\n'))
  })
  it('opens and closes the same number of comments', () => {
    assert.equal(count(css, '/*'), count(css, '*/'))
    assert.equal(count(css, '*/'), 1 + PARAMETER_KEYS.length + 1)   // the header, one per parameter, the shell-variables note
  })
  it('turns a */ inside a rule, an origin or a measurement into * / so a comment never closes early', () => {
    const evil: Brick = { ...brick('g1'), id: 'evil*/brick', measurements: [{ id: 'mx', statement: 'closes */ here', value: 'a */ b', how_measured: '' }] }
    const values = { ...resolved.values, density: { ...resolved.values.density, provenance: 'measured' as const, source: { brickId: evil.id, relationRule: 'close */ early', measurementIds: ['mx'], relationId: 'r*/1' } } }
    const r: Resolved = { ...resolved, values }
    const text = exportCss(r, [...SAMPLES, evil])
    const comment = commentOf(text, 'density')
    assert.equal(comment, 'close * / early → Four list items per screen; notes are hidden. · measured · evil* /brick · r* /1 · from mx · mx: a * / b')
    assert.equal(count(text, '/*'), count(text, '*/'))
  })
})
