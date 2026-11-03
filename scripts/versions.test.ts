/** Spec v3 C9: every accepted change bumps the project version and records `changed_since_previous`, checked on the real sample bricks.
 *  The expected keys are computed in the test from two `resolveProject` calls, never read from versions.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { resolveProject, type Project } from '../src/lib/mapRelations.ts'
import { PARAMETER_KEYS, type ParameterKey } from '../src/shell/params.ts'
import { MAX_VERSIONS, changedSincePrevious, diffValues, snapshotOf, withNextVersion, type Change } from '../src/lib/versions.ts'

const AT = '2026-11-02T10:00:00.000Z'
const project = (patch: Partial<Project> = {}): Project => ({ id: 't', intent: 'x', createdAt: '', brickIds: ['g1', 'g2', 'calmmouse'], disabled: {}, choice: {}, locks: {}, manual: {}, ...patch })
/** What createProject builds: v1 with its one entry. */
const created = (patch: Partial<Project> = {}): Project => { const p = project(patch); return { ...p, version: 1, versions: [{ v: 1, at: AT, changed: [], snapshot: snapshotOf(p) }] } }
const sourceOf = (p: Project, k: ParameterKey) => resolveProject(p, SAMPLES).values[k].source?.brickId ?? ''
/** The keys whose resolved value or source brick differs between two projects, in PARAMETER_KEYS order. */
const keysThatDiffer = (a: Project, b: Project): ParameterKey[] => {
  const ra = resolveProject(a, SAMPLES), rb = resolveProject(b, SAMPLES)
  return PARAMETER_KEYS.filter(k => ra.values[k].value !== rb.values[k].value || sourceOf(a, k) !== sourceOf(b, k))
}

describe('swap g2 for greencar', () => {
  const prev = created()
  const next = { ...prev, brickIds: ['g1', 'greencar', 'calmmouse'] }
  const out = withNextVersion(prev, next, SAMPLES, AT)

  it('goes from v1 to v2', () => {
    assert.equal(prev.version, 1)
    assert.equal(out.version, 2)
  })
  it('lists exactly the keys whose resolved value or source brick differs, in parameter order', () => {
    const expected = keysThatDiffer(prev, next)
    assert.ok(expected.includes('rhythm'), 'the swap moves rhythm')
    assert.deepEqual(changedSincePrevious(out).map(c => c.key), expected)
  })
  it('records from and to as the value, the brick that set it and the provenance', () => {
    const before = resolveProject(prev, SAMPLES).values, after = resolveProject(next, SAMPLES).values
    for (const c of changedSincePrevious(out)) {
      assert.deepEqual(c.from, { value: before[c.key].value, brickId: before[c.key].source?.brickId ?? '', provenance: before[c.key].provenance }, c.key)
      assert.deepEqual(c.to, { value: after[c.key].value, brickId: after[c.key].source?.brickId ?? '', provenance: after[c.key].provenance }, c.key)
    }
  })
  it('appends one entry with the new snapshot and the time, after the first', () => {
    assert.equal(out.versions?.length, 2)
    assert.equal(out.versions?.[0].v, 1)
    const last = out.versions![1]
    assert.equal(last.v, 2)
    assert.equal(last.at, AT)
    assert.deepEqual(last.snapshot, snapshotOf(next))
  })
  it('leaves the other fields of the project as they were', () => {
    assert.deepEqual({ ...out, version: undefined, versions: undefined }, { ...next, version: undefined, versions: undefined })
  })
  it('does not change the project it was given', () => {
    assert.equal(prev.version, 1)
    assert.equal(prev.versions?.length, 1)
  })
})

describe('a change that moves no value', () => {
  it('a lock on a brick still bumps the version, with an empty changed', () => {
    const prev = created()
    const next = { ...prev, lockedBricks: { g1: true as const } }
    assert.deepEqual(keysThatDiffer(prev, next), [], 'locking g1 alone leaves g1 first, and nothing moves')
    const out = withNextVersion(prev, next, SAMPLES, AT)
    assert.equal(out.version, 2)
    assert.deepEqual(changedSincePrevious(out), [])
    assert.equal(out.versions?.length, 2)
  })
  it('switching a relation off and on again is two versions, the second back to the start', () => {
    const prev = created()
    const off = withNextVersion(prev, { ...prev, disabled: { 'g1/r1': true } }, SAMPLES, AT)
    const on = withNextVersion(off, { ...off, disabled: {} }, SAMPLES, AT)
    assert.equal(off.version, 2)
    assert.equal(on.version, 3)
    assert.ok(changedSincePrevious(off).some(c => c.key === 'hierarchy_mode'), 'g1/r1 sets hierarchy_mode')
    assert.deepEqual(changedSincePrevious(on).map(c => c.key), changedSincePrevious(off).map(c => c.key))
    for (const c of changedSincePrevious(on)) {
      const o = changedSincePrevious(off).find(x => x.key === c.key)!
      assert.deepEqual(c.from, o.to, c.key)
      assert.deepEqual(c.to, o.from, c.key)
    }
  })
})

describe('what does not bump', () => {
  it('a rename alone returns the same project', () => {
    const prev = created({ name: 'Old' })
    const next = { ...prev, name: 'New', updatedAt: AT }
    const out = withNextVersion(prev, next, SAMPLES, AT)
    assert.equal(out, next)
    assert.equal(out.version, 1)
    assert.equal(out.versions?.length, 1)
  })
  it('a change outside the composition (intent, proposal) does not bump', () => {
    const prev = created()
    const next = { ...prev, intent: 'something else', proposal: { at: AT, model: 'm', effort: 'e', intent: 'i', latency_ms: 1, dropped: 0, picks: [] } }
    assert.equal(withNextVersion(prev, next, SAMPLES, AT).version, 1)
  })
  it('an update that writes the same composition back does not bump, whatever the key order', () => {
    const prev = created({ disabled: { 'g1/r1': true, 'g2/r2': true }, locks: {} })
    const next = { ...prev, disabled: { 'g2/r2': true, 'g1/r1': true } as Project['disabled'], lockedBricks: {}, brickIds: [...prev.brickIds] }
    assert.equal(withNextVersion(prev, next, SAMPLES, AT), next)
  })
  it('an empty lockedBricks and a missing one are the same composition', () => {
    const prev = created()
    const next = { ...prev, lockedBricks: undefined }
    assert.equal(withNextVersion(prev, next, SAMPLES, AT), next)
  })
  it('reordering the bricks is a change', () => {
    const prev = created()
    assert.equal(withNextVersion(prev, { ...prev, brickIds: ['g2', 'g1', 'calmmouse'] }, SAMPLES, AT).version, 2)
  })
})

describe('MAX_VERSIONS', () => {
  it('is 50', () => assert.equal(MAX_VERSIONS, 50))
  it('55 changes keep the last 50 entries, the latest last', () => {
    let p = created()
    for (let i = 0; i < 55; i++) p = withNextVersion(p, { ...p, brickIds: i % 2 === 0 ? ['g1', 'greencar', 'calmmouse'] : ['g1', 'g2', 'calmmouse'] }, SAMPLES, `2026-11-02T10:00:${String(i).padStart(2, '0')}.000Z`)
    assert.equal(p.version, 56)
    assert.equal(p.versions?.length, MAX_VERSIONS)
    assert.equal(p.versions![MAX_VERSIONS - 1].v, 56)
    assert.equal(p.versions![0].v, 7)
    assert.deepEqual(p.versions!.map(e => e.v), Array.from({ length: 50 }, (_, i) => 7 + i))
  })
})

describe('changedSincePrevious', () => {
  it('returns the last entry\'s changes', () => {
    const prev = created()
    const one = withNextVersion(prev, { ...prev, brickIds: ['g1', 'greencar', 'calmmouse'] }, SAMPLES, AT)
    const two = withNextVersion(one, { ...one, lockedBricks: { g1: true } }, SAMPLES, AT)
    assert.deepEqual(changedSincePrevious(one), one.versions![1].changed)
    assert.ok(changedSincePrevious(one).length > 0)
    assert.deepEqual(changedSincePrevious(two), [])
  })
  it('is [] for a project that has no versions yet', () => {
    assert.deepEqual(changedSincePrevious(project()), [])
    assert.deepEqual(changedSincePrevious({ ...project(), versions: [] }), [])
  })
  it('is [] on a fresh v1', () => assert.deepEqual(changedSincePrevious(created()), []))
})

describe('a legacy project with no version or versions', () => {
  it('makes v2 on its next change, with that change as its only entry', () => {
    const prev = project()
    assert.equal(prev.version, undefined)
    const next = { ...prev, brickIds: ['g1', 'greencar', 'calmmouse'] }
    const out = withNextVersion(prev, next, SAMPLES, AT)
    assert.equal(out.version, 2)
    assert.equal(out.versions?.length, 1)
    assert.equal(out.versions![0].v, 2)
    assert.deepEqual(changedSincePrevious(out).map(c => c.key), keysThatDiffer(prev, next))
  })
  it('does not bump on a rename and stays without a version', () => {
    const prev = project()
    const next = { ...prev, name: 'N' }
    assert.equal(withNextVersion(prev, next, SAMPLES, AT), next)
    assert.equal(next.version, undefined)
  })
})

describe('diffValues', () => {
  const a = resolveProject(project(), SAMPLES).values
  it('is [] for the same values', () => assert.deepEqual(diffValues(a, a), []))
  it('uses an empty brickId for a shell default', () => {
    const none = resolveProject(project({ brickIds: [] }), SAMPLES).values
    const g1 = resolveProject(project({ brickIds: ['g1'] }), SAMPLES).values
    const changes = diffValues(none, g1)
    assert.ok(changes.length > 0)
    for (const c of changes) assert.equal(c.from.brickId, '', c.key)
    assert.ok(changes.some(c => c.to.brickId === 'g1'))
    for (const c of diffValues(g1, none)) assert.equal(c.to.brickId, '', c.key)
  })
  it('counts a change of source brick with the same value, and not a change of provenance alone', () => {
    const k: ParameterKey = 'rhythm'
    const sameValueOtherBrick = { ...a, [k]: { ...a[k], source: { ...a[k].source!, brickId: 'other' } } }
    assert.deepEqual(diffValues(a, sameValueOtherBrick).map((c: Change) => c.key), [k])
    const otherProvenance = { ...a, [k]: { ...a[k], provenance: a[k].provenance === 'measured' ? 'adapted' as const : 'measured' as const } }
    assert.deepEqual(diffValues(a, otherProvenance), [])
  })
  it('lists the changes in parameter order', () => {
    const b = resolveProject(project({ brickIds: ['greencar', 'g1', 'calmmouse'], manual: { density: 2 } }), SAMPLES).values
    const keys = diffValues(a, b).map(c => c.key)
    assert.deepEqual(keys, PARAMETER_KEYS.filter(k => keys.includes(k)))
  })
})

describe('snapshotOf', () => {
  it('copies the composition fields and nothing else', () => {
    const p = created({ name: 'N', lockedBricks: { g1: true }, locks: {}, manual: { density: 2 } })
    assert.deepEqual(snapshotOf(p), { brickIds: ['g1', 'g2', 'calmmouse'], lockedBricks: { g1: true }, disabled: {}, choice: {}, locks: {}, manual: { density: 2 } })
  })
  it('gives a project without lockedBricks an empty one', () => assert.deepEqual(snapshotOf(project()).lockedBricks, {}))
  it('does not share arrays or objects with the project', () => {
    const p = project({ lockedBricks: { g1: true } })
    const s = snapshotOf(p)
    p.brickIds.push('x'); p.lockedBricks!.g2 = true
    assert.deepEqual(s.brickIds, ['g1', 'g2', 'calmmouse'])
    assert.deepEqual(s.lockedBricks, { g1: true })
  })
})
