import type { CSSProperties } from 'react'
import './shell.css'
import { dataAttributes, toCssVars, type ParameterKey, type Params } from './params'
import { ListScreen } from './ListScreen'
import { DetailScreen } from './DetailScreen'
import { applyContract } from './contract'
import { CONCERT_CONTENT, type ShellContent } from './content'
import { HomeIndicator, StatusBar, TabBar } from './Device'

/** One JSON in, one render out. `screen` picks which of the two screens; everything else is parameters, and `content` is the words they show (the concert log unless given).
 *  The phone (item 3): a status bar, the screen that scrolls, a tab bar and a home indicator; the screen's top bar stays at the top of what scrolls.
 *  `flash` (spec v3 C11) names the parameters whose regions get the one-second outline; shell.css has one rule per key.
 *  `staticRender` draws every control as a non-interactive element with the same class, for a copy inside a button or a link (a mini-preview): a button must not hold a button. */
export function Shell({ params: given, screen, height = 640, flash, staticRender = false, content = CONCERT_CONTENT }: { params: Params; screen: 'list' | 'review'; height?: number; flash?: ParameterKey[]; staticRender?: boolean; content?: ShellContent }) {
  // the layout contract (contract.ts) holds on every render, whoever resolved the parameters: a project's are already laid out, so this changes nothing there
  const params = applyContract(given).params
  const style = { ...toCssVars(params), '--viewport-h': `${height}px` } as CSSProperties
  return (
    <div className="shell" lang="en" style={style} {...dataAttributes(params)} data-density={String(params.density)} data-flash={flash?.length ? flash.join(' ') : undefined}>
      <StatusBar />
      <div className="screen">
        {screen === 'list' ? <ListScreen params={params} staticRender={staticRender} content={content} /> : <DetailScreen params={params} staticRender={staticRender} content={content} />}
      </div>
      <TabBar labels={content.tabs} active={screen === 'list' ? 0 : 1} staticRender={staticRender} />
      <HomeIndicator />
    </div>
  )
}
