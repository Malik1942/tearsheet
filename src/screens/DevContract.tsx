import { useEffect, useRef, useState } from 'react'
import { Shell } from '../shell/Shell'
import type { Params } from '../shell/params'
import { measureShell } from '../shell/contractMeasure'
import { CONCERT_CONTENT, yearOf, type ScreenKey, type ShellContent } from '../shell/content'

type Shown = { params: Params; screen: ScreenKey; content: ShellContent }
declare global {
  interface Window {
    /** Render one screen of the shell full-window, with the given content (the concert log unless given), and resolve after it has painted. */
    __shell?: (params: Params, screen: ScreenKey, content?: ShellContent) => Promise<void>
    /** Measure the rendered screen against the layout contract (contractMeasure.ts). */
    __measure?: () => ReturnType<typeof measureShell>
  }
}

/** Dev only (/dev/contract): the shell alone at the window's size, driven from scripts/shell-contract.test.ts through `window.__shell` and `window.__measure`. */
export function DevContract() {
  const [shown, setShown] = useState<Shown | null>(null)
  const done = useRef<(() => void) | null>(null)
  useEffect(() => {
    window.__shell = (params, screen, content = CONCERT_CONTENT) => new Promise<void>(resolve => { done.current = resolve; setShown({ params, screen, content }) })
    window.__measure = () => {
      const shell = document.querySelector<HTMLElement>('.shell')
      // the year review names the content's own year once (rule 5)
      return shell && shown ? measureShell(shell, shown.screen, yearOf(shown.content.entries)) : []
    }
  }, [shown])
  useEffect(() => {
    if (!shown || !done.current) return
    const resolve = done.current
    done.current = null
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }, [shown])
  return shown
    ? <div style={{ width: '100vw', height: '100vh' }}><Shell params={shown.params} screen={shown.screen} height={window.innerHeight} content={shown.content} /></div>
    : <p style={{ padding: 16 }}>Waiting for window.__shell(params, screen).</p>
}
