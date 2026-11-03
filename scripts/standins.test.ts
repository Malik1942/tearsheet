/** Spec v3 C7 (v2 C7′): "Stood in by" under every item that could not be expressed. The classifier is calibrated on the sentences the model actually wrote
 *  (the 12 sample bricks and the 4 gate fixtures), the near misses are named, and the handoff carries the line under every item.
 *  Expected strings are typed out from the spec, never read from standIns.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import bricksJson from '../src/fixtures/bricks.json'
import { candidatesOf, resolveProject, type Project } from '../src/lib/mapRelations.ts'
import type { Brick } from '../src/lib/types.ts'
import { STAND_INS, conceptOf, standInFor, type Concept } from '../src/lib/standIns.ts'
import { exportHandoff } from '../src/export/index.ts'

const GATE = bricksJson as unknown as Brick[]
const SHALLOW = 'whitespace + luminance hierarchy'

/** Every fragile_if_changed plus every relation rule that has no parameter, named `set/brick`. Today no relation has `none`, so these are the 16 fragile sentences. */
const sentencesOf = (set: string, bricks: Brick[]) => bricks.flatMap(b => [
  { name: `${set}/${b.id}`, text: b.fragile_if_changed },
  ...b.relations.filter(r => r.parameter === 'none').map(r => ({ name: `${set}/${b.id}/${r.id}`, text: r.rule })),
])
const CALIBRATION = [...sentencesOf('samples', SAMPLES), ...sentencesOf('gate', GATE)]
const textOf = (name: string) => CALIBRATION.find(s => s.name === name)!.text

const BAUHAUS = 'samples/bauhaus-1923-staatliches-bauhaus-weimar'
const HAECKEL = 'samples/haeckel-1904-trochilidae-plate-99'
const TILES = 'samples/iran-1260s-star-cross-luster-tiles'
const MARS = 'samples/jpl-2016-visions-mars'
const LISSITZKY = 'samples/lissitzky-1923-dlya-golosa'
const MATTHEWS = 'samples/matthews-19c-glyphography-trade-card'
const SECESSION = 'samples/secession-1902-beethoven-catalogue'

/** What each of the sixteen sentences is, read by eye from the text. */
const EXPECTED: Record<string, Concept | null> = {
  'samples/g1': 'shallow focus', 'gate/g1': 'shallow focus',
  'samples/g2': 'one-sided light', 'gate/g2': 'one-sided light',
  [HAECKEL]: 'overlap/occlusion',
  [LISSITZKY]: 'diagonal recession',
  [BAUHAUS]: null, [SECESSION]: null, 'samples/c1': null, 'samples/greencar': null, 'samples/calmmouse': null,
  [TILES]: null, [MARS]: null, [MATTHEWS]: null, 'gate/g3': null, 'gate/c1': null,
}

describe('STAND_INS: the spec table', () => {
  it('shallow focus is stood in by whitespace + luminance hierarchy; every other concept by none', () => {
    assert.deepEqual(STAND_INS, {
      'shallow focus': 'whitespace + luminance hierarchy',
      'one-sided light': 'none',
      'diagonal recession': 'none',
      'overlap/occlusion': 'none',
      'cropped display type': 'none',
    })
  })
})

describe('conceptOf and standInFor on the sixteen real calibration sentences', () => {
  it('there are sixteen: 12 samples + 4 gate fixtures, each with one fragile sentence and no relation without a parameter', () => {
    assert.equal(SAMPLES.length, 12)
    assert.equal(GATE.length, 4)
    assert.deepEqual(CALIBRATION.map(s => s.name).sort(), Object.keys(EXPECTED).sort())
  })
  it('exactly two get whitespace + luminance hierarchy: the two g1 sentences, "into sharp equal focus" and "into sharp focus"', () => {
    assert.deepEqual(CALIBRATION.filter(s => standInFor(s.text) === SHALLOW).map(s => s.name).sort(), ['gate/g1', 'samples/g1'])
    assert.ok(textOf('samples/g1').includes('into sharp equal focus'))
    assert.ok(textOf('gate/g1').includes('into sharp focus'))
  })
  it('the other fourteen get none', () => {
    const rest = CALIBRATION.filter(s => !s.name.endsWith('/g1'))
    assert.equal(rest.length, 14)
    for (const s of rest) assert.equal(standInFor(s.text), 'none', s.name)
  })
  it('each sentence reads as the concept it names (or as none of them)', () => {
    for (const [name, concept] of Object.entries(EXPECTED)) assert.equal(conceptOf(textOf(name)), concept, name)
  })
  it('both g2 sentences say spotlight: one-sided light', () => {
    for (const name of ['samples/g2', 'gate/g2']) { assert.ok(textOf(name).includes('spotlight'), name); assert.equal(conceptOf(textOf(name)), 'one-sided light', name) }
  })
  it('haeckel says overlapping: overlap/occlusion; lissitzky says diagonal tilt: diagonal recession', () => {
    assert.ok(textOf(HAECKEL).includes('overlapping'))
    assert.equal(conceptOf(textOf(HAECKEL)), 'overlap/occlusion')
    assert.ok(textOf(LISSITZKY).includes('diagonal tilt'))
    assert.equal(conceptOf(textOf(LISSITZKY)), 'diagonal recession')
  })
  it('near misses, each by name, are no concept at all', () => {
    const near: [string, string][] = [
      [BAUHAUS, 'shrinking the type'],
      [SECESSION, 'soft gray shading'],
      ['samples/c1', 'equal in size'],
      ['samples/greencar', 'bright direct sun'],
      ['samples/calmmouse', 'vast empty white background'],
    ]
    for (const [name, phrase] of near) {
      assert.ok(textOf(name).includes(phrase), `${name} still says "${phrase}"`)
      assert.equal(conceptOf(textOf(name)), null, name)
      assert.equal(standInFor(textOf(name)), 'none', name)
    }
  })
})

describe('conceptOf and standInFor on the relation rules that could not be read (unsupported-target)', () => {
  // the real rules the model wrote and the mapping could not turn into a value: they land in the same list as the fragile sentences
  const unread = [...SAMPLES, ...GATE].flatMap(b => candidatesOf(b).unexpressed.filter(u => u.reason === 'unsupported-target').map(u => ({ brick: b.id, rule: u.rule })))
  const BLURRED = 'Keep one sharp organic subject filling the left two-thirds with a heavily blurred contextual backdrop confined to the right third.'
  const OVERLAPPING = 'Create hierarchy by overlapping large-scale color forms in the upper-center with smaller heavy solids offset below, not by linear reading order'
  it('there are nine today; the blurred backdrop is shallow focus, the overlapping color forms are overlap/occlusion, the other seven are none', () => {
    assert.equal(unread.length, 9)
    assert.deepEqual(unread.filter(u => conceptOf(u.rule) === 'shallow focus').map(u => u.rule), [BLURRED])
    assert.deepEqual(unread.filter(u => conceptOf(u.rule) === 'overlap/occlusion').map(u => u.rule), [OVERLAPPING])
    assert.equal(unread.filter(u => conceptOf(u.rule) === null).length, 7)
  })
  it('stands in by whitespace + luminance hierarchy for the blurred backdrop only', () => {
    assert.deepEqual(unread.filter(u => standInFor(u.rule) === SHALLOW).map(u => u.rule), [BLURRED])
  })
})

describe('conceptOf: the rules', () => {
  const cases: [Concept, string[]][] = [
    ['shallow focus', ['Shallow focus on the subject', 'selective focus', 'soft depth of field', 'a narrow depth of field', 'the backdrop is out of focus', 'blur', 'a blurred wall', 'blurry edges', 'the sky blurs', 'creamy bokeh', 'pulled into sharp focus', 'brought into equal focus with the blossoms', 'moved into full focus']],
    ['one-sided light', ['one-sided light', 'single sided lighting', 'sidelight', 'side light', 'side-light', 'raking light', 'directional light', 'light from the left', 'light on one side', 'light from right', 'a spotlight', 'low-key', 'low key lighting']],
    ['diagonal recession', ['diagonal lines', 'recession into depth', 'the road recedes', 'it recede', 'a vanishing point', 'converging lines']],
    ['overlap/occlusion', ['overlap', 'overlapping forms', 'occlusion', 'occluded by a wall', 'stands in front of the door', 'layered over a field']],
    ['cropped display type', ['cropped type', 'crops letters', 'crop letterforms', 'cropped headline', 'crop word', 'crops display', 'the letters bleed off', 'the headline runs off the page', 'type is cut off', 'wordmark bleeds', 'The display type is cropped by the right edge']],
  ]
  for (const [concept, texts] of cases) {
    it(`${concept}: ${texts.length} phrasings`, () => {
      for (const text of texts) assert.equal(conceptOf(text), concept, text)
    })
  }
  it('ignores case', () => {
    assert.equal(conceptOf('BOKEH'), 'shallow focus')
    assert.equal(conceptOf('Raking Light across the plaster'), 'one-sided light')
  })
  it('the first concept in the order wins when a sentence names two', () => {
    assert.equal(conceptOf('A spotlight on a blurred background'), 'shallow focus')
    assert.equal(conceptOf('Diagonal lines overlapping the frame'), 'diagonal recession')
    assert.equal(conceptOf('Overlapping letters cropped by the edge'), 'overlap/occlusion')
  })
  it('does not read soft gray shading, equal in size, a plain sharp subject or a period-separated focus as shallow focus', () => {
    for (const text of ['soft gray shading', 'make the yellow car equal in size to the dark coupe', 'one sharp organic subject', 'Bring the tower into sharp detail. Focus is elsewhere.', '']) assert.equal(conceptOf(text), null, text)
  })
  it('a focus word too far from "into sharp" is not the phrase', () => {
    assert.equal(conceptOf('into sharp and very, very, very evenly lit focus'), null)
    assert.equal(conceptOf('into sharp, even focus'), 'shallow focus')
  })
})

describe('standInFor', () => {
  it('shallow focus: whitespace + luminance hierarchy', () => {
    assert.equal(conceptOf('Background blur isolates the subject'), 'shallow focus')
    assert.equal(standInFor('Background blur isolates the subject'), 'whitespace + luminance hierarchy')
  })
  it('cropped display type: none', () => {
    assert.equal(conceptOf('The display type is cropped by the right edge'), 'cropped display type')
    assert.equal(standInFor('The display type is cropped by the right edge'), 'none')
  })
  it('overlap/occlusion: none', () => {
    assert.equal(conceptOf('The figure stands in front of the doorway'), 'overlap/occlusion')
    assert.equal(standInFor('The figure stands in front of the doorway'), 'none')
  })
  it('one-sided light and diagonal recession: none', () => {
    assert.equal(standInFor('Light from the left rakes across the wall'), 'none')
    assert.equal(standInFor('The diagonal makes the street recede'), 'none')
  })
  it('a sentence no concept reads, and an empty one, are none, shown and not hidden', () => {
    assert.equal(standInFor('Replacing the flat field with a gradient would collapse the confrontation'), 'none')
    assert.equal(standInFor(''), 'none')
  })
})

/* ---------------- the handoff ---------------- */

const project = (patch: Partial<Project> = {}): Project => ({ id: 't', intent: 'x', createdAt: '', brickIds: ['g1', 'g2', 'calmmouse'], disabled: {}, choice: {}, locks: {}, manual: {}, ...patch })
const bricksOf = (ids: string[]) => ids.map(id => SAMPLES.find(b => b.id === id)!)
const sectionOf = (md: string, heading: string): string[] => {
  const lines = md.split('\n')
  const from = lines.indexOf(`## ${heading}`)
  assert.notEqual(from, -1, `a "## ${heading}" section`)
  const to = lines.findIndex((l, i) => i > from && l.startsWith('## '))
  return lines.slice(from + 1, to === -1 ? undefined : to)
}

describe('exportHandoff: Stood in by under every item in "Could not be expressed"', () => {
  const ids = ['g1', 'g2', 'calmmouse']
  const r = resolveProject(project({ brickIds: ids }), SAMPLES)
  const md = exportHandoff('x', bricksOf(ids), r)
  const lines = sectionOf(md, 'Could not be expressed')
  const bullets = lines.map((l, i) => ({ l, i })).filter(x => x.l.startsWith('- '))

  it('lists one bullet for every unexpressed item of the project (g1 has two, g2 and calmmouse one each)', () => {
    assert.equal(r.unexpressed.length, 4)
    assert.equal(bullets.length, 4)
  })
  it('every bullet is followed directly by a nested "Stood in by:" line', () => {
    for (const { l, i } of bullets) assert.match(lines[i + 1] ?? '', /^ {2}- Stood in by: \S/, l)
  })
  it('g1\'s fragile sentence (into sharp equal focus) says whitespace + luminance hierarchy; g2 and calmmouse say none', () => {
    const standIn = (brick: string, reason: string) => {
      const b = bullets.find(x => x.l.startsWith(`- [${brick}, ${reason}]`))
      assert.ok(b, `${brick} ${reason}`)
      return lines[b.i + 1]
    }
    assert.equal(standIn('g1', 'fragile if changed'), '  - Stood in by: whitespace + luminance hierarchy')
    assert.equal(standIn('g2', 'fragile if changed'), '  - Stood in by: none')
    assert.equal(standIn('calmmouse', 'fragile if changed'), '  - Stood in by: none')
  })
  it('the item without a slot (a g1 relation no value could be read from) gets its own line, read from its rule', () => {
    const b = bullets.find(x => x.l.startsWith('- [g1, no slot]'))
    assert.ok(b)
    assert.equal(lines[b.i + 1], '  - Stood in by: none')
  })
  it('the bullets themselves are unchanged', () => {
    for (const u of r.unexpressed) assert.ok(lines.includes(`- [${u.brickId}, ${u.reason === 'fragile' ? 'fragile if changed' : 'no slot'}] ${u.rule}`), u.rule)
  })
  it('an empty list keeps its one sentence and gets no Stood in by line', () => {
    const empty = exportHandoff('x', [], resolveProject(project({ brickIds: [] }), SAMPLES))
    assert.deepEqual(sectionOf(empty, 'Could not be expressed'), ['', '- Everything from these bricks found a slot.', ''])
    assert.ok(!empty.includes('Stood in by'))
  })
  it('does not add the line anywhere else in the handoff', () => {
    assert.equal(md.split('\n').filter(l => l.includes('Stood in by')).length, 4)
  })
})
