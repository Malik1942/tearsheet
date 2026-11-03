import { useEffect, useState } from 'react'
import type { Project } from '../lib/mapRelations'
import type { ParameterKey } from '../shell/params'
import { FLASH_MS, nextFlash, type FlashSeen } from '../lib/highlight'

/** Spec v3 C11: the keys the project's latest accepted change moved, for one second after the version goes up, then none.
 *  Never on the first render of a project (what was saved is not a change): the version has to go up while this is mounted. Switching to another project clears whatever was running.
 *  An edit that bumps nothing (a rename) leaves a running highlight alone. The rule is `nextFlash`; this only holds its state. */
export function useChangeFlash(project: Project | undefined): ParameterKey[] {
  const [seen, setSeen] = useState<FlashSeen>(null)
  const [flash, setFlash] = useState<ParameterKey[]>([])
  // State adjusted while rendering, from the version this component last saw: the supported way to react to a change in props without an effect that sets state.
  const next = nextFlash(seen, project, flash)
  if (next.seen !== seen) setSeen(next.seen)
  if (next.flash !== flash) setFlash(next.flash)
  useEffect(() => {
    if (flash.length === 0) return
    const t = window.setTimeout(() => setFlash([]), FLASH_MS)
    return () => window.clearTimeout(t)
  }, [flash])
  return flash
}
