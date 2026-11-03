/** 15_SIMPLIFY §2: the Brick sheet's labels link to `/brick/:id` at the item they rest on (`#m3`), so the full screen opens on it. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { labelsOfBrick } from '../src/lib/shortLabels.ts'
import { labelAnchor, labelHref } from '../src/bricks/labelAnchor.ts'

describe('labelAnchor', () => {
  it('points every label of every sample at a measurement or a rule the Brick screen anchors, or at the page itself', () => {
    let anchored = 0
    for (const b of SAMPLES) {
      const ids = new Set([...b.measurements.map(m => m.id), ...b.relations.map(r => r.id)])
      for (const l of labelsOfBrick(b)) {
        const a = labelAnchor(b, l)
        const href = labelHref(b, l)
        if (a === null) { assert.equal(href, `/brick/${b.id}`, `${b.id} ${l.label}`); continue }
        assert.ok(ids.has(a), `${b.id} ${l.label} -> #${a}`)
        assert.equal(href, `/brick/${b.id}#${a}`)
        anchored++
      }
    }
    assert.ok(anchored > 0, 'some labels rest on a measurement')
  })
  it('prefers the measurement a relation rests on over the relation itself', () => {
    const hits = SAMPLES.flatMap(b => labelsOfBrick(b).map(l => labelAnchor(b, l))).filter((a): a is string => a !== null)
    assert.ok(hits.some(a => a.startsWith('m')), hits.join(' '))
  })
  it('has no anchor for the measured background (read by the harness, not the model)', () => {
    const b = SAMPLES.find(x => x.skin_measured)
    assert.ok(b)
    assert.equal(labelAnchor(b, { key: 'color_bg', value: b.skin_measured!.color_bg }), null)
  })
})
