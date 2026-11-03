/** Spec v3 C9: every accepted change in Compose bumps the project `version` and records what it moved, as `changed_since_previous`.
 *  Pure: no React, no model call. The change highlight (C11), the agent bundle (E1–E2) and the version list (E5) all read what is built here. */
import { resolveProject, type Project, type Resolved } from './mapRelations'
import type { Brick } from './types'
import { PARAMETER_KEYS, type ParameterKey } from '../shell/params'

/** A value as a version records it: the value, the brick that set it (`''` for a shell default) and how it is known. */
export type ValueRef = { value: string | number; brickId: string; provenance: string }
export type Change = { key: ParameterKey; from: ValueRef; to: ValueRef }
/** The composition of a project at one version: everything Compose changes, and nothing else (not the name, the intent or the proposal). */
export type Snapshot = Pick<Project, 'brickIds' | 'lockedBricks' | 'mutedBricks' | 'disabled' | 'choice' | 'locks' | 'manual'>
export type VersionEntry = { v: number; at: string; changed: Change[]; snapshot: Snapshot }

/** The history keeps this many entries, the latest last. */
export const MAX_VERSIONS = 50

/** A copy of the project's composition. A missing `lockedBricks` reads as none locked, so the same composition always gives the same snapshot.
 *  `mutedBricks` (a photo tapped off on Make) is kept only when some photo is muted, so a snapshot from before it existed reads the same. */
export function snapshotOf(p: Project): Snapshot {
  const { brickIds, lockedBricks, mutedBricks, disabled, choice, locks, manual } = p
  const muted = mutedBricks && Object.keys(mutedBricks).length ? { mutedBricks } : {}
  return JSON.parse(JSON.stringify({ brickIds, lockedBricks: lockedBricks ?? {}, ...muted, disabled, choice, locks, manual })) as Snapshot
}

/** Structural equality for JSON data: key order does not matter, array order does. */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameJson(x, b[i]))
  const ka = Object.keys(a), kb = Object.keys(b)
  return ka.length === kb.length && ka.every(k => k in b && sameJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

const refOf = (pv: Resolved['values'][ParameterKey]): ValueRef => ({ value: pv.value, brickId: pv.source?.brickId ?? '', provenance: pv.provenance })

/** One change per parameter whose value or source brick differs, in `PARAMETER_KEYS` order. A provenance that moves alone is not a change. */
export function diffValues(before: Resolved['values'], after: Resolved['values']): Change[] {
  const changes: Change[] = []
  for (const key of PARAMETER_KEYS) {
    const from = refOf(before[key]), to = refOf(after[key])
    if (from.value !== to.value || from.brickId !== to.brickId) changes.push({ key, from, to })
  }
  return changes
}

/** v1 of a project, the one place it is built: version 1 and its one entry, which has nothing before it to differ from. Spread it into the new project. */
export function firstVersion(p: Project, at: string): Pick<Project, 'version' | 'versions'> {
  return { version: 1, versions: [{ v: 1, at, changed: [], snapshot: snapshotOf(p) }] }
}

/** `next` as the project's next version, or `next` itself when the composition did not change (a rename or anything outside it does not bump).
 *  A change that moves no value, such as a lock, still bumps: the person did accept it, and its `changed` is empty.
 *  A project saved before versions existed reads as v1, so its first change keeps that v1 (its composition before the change) ahead of v2. */
export function withNextVersion(prev: Project, next: Project, bricks: Brick[], at: string): Project {
  const snapshot = snapshotOf(next)
  if (sameJson(snapshotOf(prev), snapshot)) return next
  const version = (prev.version ?? 1) + 1
  const changed = diffValues(resolveProject(prev, bricks).values, resolveProject(next, bricks).values)
  const legacyV1 = !prev.versions?.length && (prev.version ?? 1) === 1
  const history = legacyV1 ? firstVersion(prev, prev.createdAt).versions! : prev.versions ?? []
  return { ...next, version, versions: [...history, { v: version, at, changed, snapshot }].slice(-MAX_VERSIONS) }
}

/** What the latest version moved: the last entry's changes, or none. */
export function changedSincePrevious(p: Project): Change[] {
  return p.versions?.[p.versions.length - 1]?.changed ?? []
}

/** The project as Sync sends it: the oldest history entries dropped until its JSON is at most `maxBytes`, the latest entry always kept.
 *  Fifty real entries run 66–106 KB, and the server refuses a project that is too large, which would fail the whole push; the history is the
 *  one thing that can go, because every other field is what the project is. Client side only: the project on this device keeps every entry. Never mutates `p`. */
export function fitProjectForSync(p: Project, maxBytes = 60 * 1024): Project {
  const v = p.versions
  if (!v || v.length < 2 || JSON.stringify(p).length <= maxBytes) return p
  for (let keep = v.length - 1; keep > 1; keep--) {
    const fit: Project = { ...p, versions: v.slice(-keep) }
    if (JSON.stringify(fit).length <= maxBytes) return fit
  }
  return { ...p, versions: v.slice(-1) }
}

/** The incoming copy's version, if it is a number. */
const validVersion = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined
/** The incoming copy's history, if every entry has a numeric `v` and a `changed` list; the field comes from another device, so it is checked. */
const validVersions = (v: unknown): VersionEntry[] | undefined =>
  Array.isArray(v) && v.every(e => !!e && typeof e.v === 'number' && Number.isFinite(e.v) && Array.isArray(e.changed)) ? v as VersionEntry[] : undefined

/** Merge a list of projects from another device into this one's, by id: the newest `updatedAt` wins, and a tie keeps what is here.
 *  The winner's version and history are taken as they come, never mixed with the older copy's, so a project saved before versions existed
 *  replaces the history with none. Returns the list and how many projects were added or replaced. Pure: neither list is changed. */
export function mergeProjectLists(existing: Project[], incoming: Project[]): { projects: Project[]; changed: number } {
  const byId = new Map(existing.map(p => [p.id, p]))
  let changed = 0
  for (const inc of incoming) {
    if (!inc || typeof inc.id !== 'string' || !Array.isArray(inc.brickIds)) continue
    const have = byId.get(inc.id)
    if (have && (inc.updatedAt ?? inc.createdAt ?? '') <= (have.updatedAt ?? have.createdAt ?? '')) continue
    byId.set(inc.id, { ...have, ...inc, disabled: inc.disabled ?? {}, choice: inc.choice ?? {}, locks: inc.locks ?? {}, manual: inc.manual ?? {}, version: validVersion(inc.version), versions: validVersions(inc.versions) })
    changed++
  }
  return { projects: [...byId.values()], changed }
}
