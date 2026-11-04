import { useEffect, useRef, useState } from 'react'
import { Shell } from '../shell/Shell'
import type { Params } from '../shell/params'
import { measureShell } from '../shell/contractMeasure'

type Shown = { params: Params; screen: 'list' | 'review' }
declare global {
  interface Window {
    /** Render one screen of the shell full-window and resolve after it has painted. */
    __shell?: (params: Params, screen: 'list' | 'review') => Promise<void>
    /** Measure the rendered screen against the layout contract (contractMeasure.ts). */
    __measure?: () => ReturnType<typeof measureShell>
  }
}

/** Dev only (/dev/contract): the shell alone at the window's size, driven from scripts/shell-contract.test.ts through `window.__shell` and `window.__measure`. */
export function DevContract() {
  const [shown, setShown] = useState<Shown | null>(null)
  const done = useRef<(() => void) | null>(null)
  useEffect(() => {
    window.__shell = (params, screen) => new Promise<void>(resolve => { done.current = resolve; setShown({ params, screen }) })
    window.__measure = () => {
      const shell = document.querySelector<HTMLElement>('.shell')
      return shell && shown ? measureShell(shell, shown.screen) : []
    }
  }, [shown])
  useEffect(() => {
    if (!shown || !done.current) return
    const resolve = done.current
    done.current = null
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }, [shown])
  return shown
    ? <div style={{ width: '100vw', height: '100vh' }}><Shell params={shown.params} screen={shown.screen} height={window.innerHeight} /></div>
    : <p style={{ padding: 16 }}>Waiting for window.__shell(params, screen).</p>
}
