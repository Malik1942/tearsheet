/** Spec v3 C9: every accepted change bumps the project version and records `changed_since_previous`, checked on the real sample bricks.
 *  The expected keys are computed in the test from two `resolveProject` calls, never read from versions.ts. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { resolveProject, type Project } from '../src/lib/mapRelations.ts'
import { PARAMETER_KEYS, type ParameterKey } from '../src/shell/params.ts'
import { MAX_VERSIONS, changedSincePrevious, diffValues, firstVersion, fitProjectForSync, mergeProjectLists, snapshotOf, withNextVersion, type Change } from '../src/lib/versions.ts'

const AT = '2026-11-02T10:00:00.000Z'
const project = (patch: Partial<Project> = {}): Project => ({ id: 't', intent: 'x', createdAt: '', brickIds: ['g1', 'g2', 'calmmouse'], disabled: {}, choice: {}, locks: {}, manual: {}, ...patch })
/** What createProject builds: v1 with its one entry. */
const created = (patch: Partial<Project> = {}): Project => { const p = project(patch); return { ...p, ...firstVersion(p, AT) } }
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
  it('keeps its v1: the first change makes [v1 (the original composition), v2]', () => {
    const prev = project({ createdAt: '2026-10-01T09:00:00.000Z' })
    assert.equal(prev.version, undefined)
    const next = { ...prev, brickIds: ['g1', 'greencar', 'calmmouse'] }
    const out = withNextVersion(prev, next, SAMPLES, AT)
    assert.equal(out.version, 2)
    assert.deepEqual(out.versions?.map(e => e.v), [1, 2])
    assert.deepEqual(out.versions![0], { v: 1, at: '2026-10-01T09:00:00.000Z', changed: [], snapshot: snapshotOf(prev) })
    assert.equal(out.versions![1].at, AT)
    assert.deepEqual(out.versions![1].snapshot, snapshotOf(next))
    assert.deepEqual(changedSincePrevious(out).map(c => c.key), keysThatDiffer(prev, next))
  })
  it('does the same for an empty versions list at version 1', () => {
    const prev = project({ version: 1, versions: [] })
    const out = withNextVersion(prev, { ...prev, brickIds: ['g1', 'greencar', 'calmmouse'] }, SAMPLES, AT)
    assert.deepEqual(out.versions?.map(e => e.v), [1, 2])
  })
  it('does not change the project it was given', () => {
    const prev = project()
    withNextVersion(prev, { ...prev, brickIds: ['g1', 'greencar', 'calmmouse'] }, SAMPLES, AT)
    assert.equal(prev.versions, undefined)
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

describe('firstVersion', () => {
  it('is version 1 with one entry: the project\'s composition, the time, and nothing changed', () => {
    const p = project({ lockedBricks: { g1: true } })
    assert.deepEqual(firstVersion(p, AT), { version: 1, versions: [{ v: 1, at: AT, changed: [], snapshot: snapshotOf(p) }] })
  })
  it('does not share objects with the project', () => {
    const p = project()
    const f = firstVersion(p, AT)
    p.brickIds.push('x')
    assert.deepEqual(f.versions![0].snapshot.brickIds, ['g1', 'g2', 'calmmouse'])
  })
})

describe('fitProjectForSync', () => {
  /** 50 entries, each a real swap of g1 and calmmouse on the sample bricks. */
  const heavy = (): Project => {
    let p = created()
    for (let i = 0; i < 50; i++) p = withNextVersion(p, { ...p, brickIds: i % 2 === 0 ? ['calmmouse', 'g2', 'g1'] : ['g1', 'g2', 'calmmouse'] }, SAMPLES, `2026-11-02T10:00:${String(i).padStart(2, '0')}.000Z`)
    return p
  }
  const MAX = 60 * 1024
  it('the test project is heavy enough to matter: over 60 KB with 50 entries', () => {
    const p = heavy()
    assert.equal(p.versions?.length, MAX_VERSIONS)
    assert.ok(JSON.stringify(p).length > MAX, `size ${JSON.stringify(p).length}`)
  })
  it('drops the oldest entries until it is under 60 KB and keeps the latest', () => {
    const p = heavy()
    const out = fitProjectForSync(p)
    assert.ok(JSON.stringify(out).length <= MAX, `size ${JSON.stringify(out).length}`)
    assert.ok(out.versions!.length < p.versions!.length)
    assert.ok(out.versions!.length >= 1)
    assert.deepEqual(out.versions![out.versions!.length - 1], p.versions![p.versions!.length - 1])
    assert.equal(out.version, p.version)
    const kept = out.versions!.length
    assert.deepEqual(out.versions, p.versions!.slice(-kept), 'the kept entries are the newest ones, in order')
  })
  it('keeps as many entries as fit: one more would go over', () => {
    const p = heavy()
    const kept = fitProjectForSync(p).versions!.length
    assert.ok(JSON.stringify({ ...p, versions: p.versions!.slice(-(kept + 1)) }).length > MAX)
  })
  it('does not change the project it was given', () => {
    const p = heavy()
    const before = JSON.stringify(p)
    const versions = p.versions
    fitProjectForSync(p)
    assert.equal(JSON.stringify(p), before)
    assert.equal(p.versions, versions)
    assert.equal(p.versions!.length, MAX_VERSIONS)
  })
  it('returns a project that already fits as it is', () => {
    const p = created()
    assert.deepEqual(fitProjectForSync(p), p)
    const legacy = project()
    assert.deepEqual(fitProjectForSync(legacy), legacy)
  })
  it('keeps the latest entry even when it alone is over the limit', () => {
    const p = heavy()
    const out = fitProjectForSync(p, 10)
    assert.equal(out.versions!.length, 1)
    assert.deepEqual(out.versions![0], p.versions![p.versions!.length - 1])
  })
  it('takes the limit as a second argument', () => {
    const p = heavy()
    const small = fitProjectForSync(p, 20 * 1024), big = fitProjectForSync(p, 100 * 1024)
    assert.ok(JSON.stringify(small).length <= 20 * 1024)
    assert.ok(small.versions!.length < big.versions!.length)
  })
})

describe('mergeProjectLists', () => {
  const T1 = '2026-11-01T10:00:00.000Z', T2 = '2026-11-02T10:00:00.000Z', T3 = '2026-11-03T10:00:00.000Z'
  const at = (updatedAt: string, patch: Partial<Project> = {}): Project => created({ id: 'a', updatedAt, ...patch })

  it('the newest updatedAt wins and the winner replaces the old copy', () => {
    const old = at(T1, { name: 'old' }), fresh = at(T2, { name: 'fresh', brickIds: ['g1', 'greencar', 'calmmouse'] })
    const { projects, changed } = mergeProjectLists([old], [fresh])
    assert.equal(changed, 1)
    assert.equal(projects.length, 1)
    assert.equal(projects[0].name, 'fresh')
    assert.deepEqual(projects[0].brickIds, ['g1', 'greencar', 'calmmouse'])
  })
  it('an older incoming project is ignored, and so is one with the same time', () => {
    const have = at(T2, { name: 'have' })
    for (const inc of [at(T1, { name: 'older' }), at(T2, { name: 'same' })]) {
      const out = mergeProjectLists([have], [inc])
      assert.equal(out.changed, 0)
      assert.equal(out.projects[0].name, 'have')
    }
  })
  it('falls back to createdAt when updatedAt is missing', () => {
    const have = { ...at(T1), updatedAt: undefined, createdAt: T2 }
    assert.equal(mergeProjectLists([have], [at(T1, { name: 'older' })]).changed, 0)
    assert.equal(mergeProjectLists([have], [at(T3, { name: 'newer' })]).changed, 1)
  })
  it('takes the incoming version and history verbatim', () => {
    const inc = withNextVersion(at(T1), { ...at(T1), brickIds: ['g1', 'greencar', 'calmmouse'], updatedAt: T3 }, SAMPLES, T3)
    const out = mergeProjectLists([at(T2)], [inc])
    assert.equal(out.projects[0].version, 2)
    assert.deepEqual(out.projects[0].versions, inc.versions)
  })
  it('a legacy incoming project (no versions) replaces the history with undefined, never mixing in the old copy\'s', () => {
    const have = at(T1)
    assert.equal(have.versions?.length, 1)
    const legacy: Project = project({ id: 'a', updatedAt: T2 })
    const out = mergeProjectLists([have], [legacy])
    assert.equal(out.changed, 1)
    assert.equal(out.projects[0].version, undefined)
    assert.equal(out.projects[0].versions, undefined)
  })
  it('a malformed versions becomes undefined: a string, a non-list, entries without v, entries without changed', () => {
    const bad: unknown[] = ['v1,v2', { v: 1 }, [{ at: T1, changed: [] }], [{ v: 1, at: T1 }], [null], [{ v: '1', changed: [] }], [{ v: 1, changed: [] }, { changed: [] }]]
    for (const versions of bad) {
      const inc = { ...at(T2), versions } as unknown as Project
      const out = mergeProjectLists([at(T1)], [inc])
      assert.equal(out.changed, 1)
      assert.equal(out.projects[0].versions, undefined, JSON.stringify(versions))
    }
  })
  it('a version that is not a finite number becomes undefined', () => {
    for (const version of ['2', null, NaN, Infinity, {}]) {
      const out = mergeProjectLists([at(T1)], [{ ...at(T2), version } as unknown as Project])
      assert.equal(out.projects[0].version, undefined, String(version))
    }
    assert.equal(mergeProjectLists([at(T1)], [{ ...at(T2), version: 7 }]).projects[0].version, 7)
  })
  it('a well-formed history is kept, including an empty one', () => {
    const out = mergeProjectLists([], [{ ...at(T2), versions: [] }])
    assert.deepEqual(out.projects[0].versions, [])
  })
  it('keeps the defaults for disabled, choice, locks and manual', () => {
    const inc = { id: 'n', intent: 'i', createdAt: T1, brickIds: [] } as unknown as Project
    const p = mergeProjectLists([], [inc]).projects[0]
    assert.deepEqual([p.disabled, p.choice, p.locks, p.manual], [{}, {}, {}, {}])
  })
  it('adds a project it did not have and counts it', () => {
    const out = mergeProjectLists([at(T1)], [{ ...at(T1), id: 'b' }])
    assert.equal(out.changed, 1)
    assert.deepEqual(out.projects.map(p => p.id), ['a', 'b'])
  })
  it('counts only the projects that changed', () => {
    const have = [at(T2), { ...at(T2), id: 'b' }, { ...at(T2), id: 'c' }]
    const out = mergeProjectLists(have, [{ ...at(T3), id: 'b' }, at(T1), { ...at(T1), id: 'd' }])
    assert.equal(out.changed, 2)
    assert.deepEqual(out.projects.map(p => p.id), ['a', 'b', 'c', 'd'])
  })
  it('skips entries that are not projects', () => {
    const junk = [null, {}, { id: 5, brickIds: [] }, { id: 'x', brickIds: 'g1' }] as unknown as Project[]
    const out = mergeProjectLists([at(T1)], junk)
    assert.equal(out.changed, 0)
    assert.equal(out.projects.length, 1)
  })
  it('does not change the lists it was given', () => {
    const have = [at(T1)], inc = [at(T2, { name: 'x' })]
    const a = JSON.stringify(have), b = JSON.stringify(inc)
    mergeProjectLists(have, inc)
    assert.equal(JSON.stringify(have), a)
    assert.equal(JSON.stringify(inc), b)
  })
})
