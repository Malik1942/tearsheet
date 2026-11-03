import { useEffect, useState } from 'react'
import type { Project } from '../lib/mapRelations'
import type { ParameterKey } from '../shell/params'
import { FLASH_MS, flashKeys } from '../lib/highlight'

/** Spec v3 C11: the keys the project's latest accepted change moved, for one second after the version goes up, then none.
 *  Never on the first render of a project (what was saved is not a change): the version has to go up while this is mounted.
 *  An edit that bumps nothing (a rename) leaves a running highlight alone. */
export function useChangeFlash(project: Project | undefined): ParameterKey[] {
  const [seen, setSeen] = useState<{ id: string; v: number } | null>(null)
  const [flash, setFlash] = useState<ParameterKey[]>([])
  const v = project?.version ?? 1
  // State adjusted while rendering, from the version this component last saw: the supported way to react to a change in props without an effect that sets state.
  if (project && (seen === null || seen.id !== project.id)) setSeen({ id: project.id, v })
  else if (project && seen && seen.v !== v) {
    setSeen({ id: project.id, v })
    const keys = flashKeys(seen.v, project)
    if (keys.length > 0) setFlash(keys)
  }
  useEffect(() => {
    if (flash.length === 0) return
    const t = window.setTimeout(() => setFlash([]), FLASH_MS)
    return () => window.clearTimeout(t)
  }, [flash])
  return flash
}
