/** Spec v3 C9: every accepted change in Compose bumps the project `version` and records what it moved, as `changed_since_previous`.
 *  Pure: no React, no model call. The change highlight (C11), the agent bundle (E1–E2) and the version list (E5) all read what is built here. */
import { resolveProject, type Project, type Resolved } from './mapRelations'
import type { Brick } from './types'
import { PARAMETER_KEYS, type ParameterKey } from '../shell/params'

/** A value as a version records it: the value, the brick that set it (`''` for a shell default) and how it is known. */
export type ValueRef = { value: string | number; brickId: string; provenance: string }
export type Change = { key: ParameterKey; from: ValueRef; to: ValueRef }
/** The composition of a project at one version: everything Compose changes, and nothing else (not the name, the intent or the proposal). */
export type Snapshot = Pick<Project, 'brickIds' | 'lockedBricks' | 'disabled' | 'choice' | 'locks' | 'manual'>
export type VersionEntry = { v: number; at: string; changed: Change[]; snapshot: Snapshot }

/** The history keeps this many entries, the latest last. */
export const MAX_VERSIONS = 50

/** A copy of the project's composition. A missing `lockedBricks` reads as none locked, so the same composition always gives the same snapshot. */
export function snapshotOf(p: Project): Snapshot {
  const { brickIds, lockedBricks, disabled, choice, locks, manual } = p
  return JSON.parse(JSON.stringify({ brickIds, lockedBricks: lockedBricks ?? {}, disabled, choice, locks, manual })) as Snapshot
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

/** `next` as the project's next version, or `next` itself when the composition did not change (a rename or anything outside it does not bump).
 *  A change that moves no value, such as a lock, still bumps: the person did accept it, and its `changed` is empty. */
export function withNextVersion(prev: Project, next: Project, bricks: Brick[], at: string): Project {
  const snapshot = snapshotOf(next)
  if (sameJson(snapshotOf(prev), snapshot)) return next
  const version = (prev.version ?? 1) + 1
  const changed = diffValues(resolveProject(prev, bricks).values, resolveProject(next, bricks).values)
  return { ...next, version, versions: [...(prev.versions ?? []), { v: version, at, changed, snapshot }].slice(-MAX_VERSIONS) }
}

/** What the latest version moved: the last entry's changes, or none. */
export function changedSincePrevious(p: Project): Change[] {
  return p.versions?.[p.versions.length - 1]?.changed ?? []
}
