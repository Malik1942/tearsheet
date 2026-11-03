import type { CSSProperties } from 'react'
import './shell.css'
import { dataAttributes, toCssVars, type ParameterKey, type Params } from './params'
import { ListScreen } from './ListScreen'
import { DetailScreen } from './DetailScreen'

/** One JSON in, one render out. `screen` picks which of the two screens; everything else is parameters.
 *  `flash` (spec v3 C11) names the parameters whose regions get the one-second outline; shell.css has one rule per key. */
export function Shell({ params, screen, height = 640, flash }: { params: Params; screen: 'list' | 'review'; height?: number; flash?: ParameterKey[] }) {
  const style = { ...toCssVars(params), '--viewport-h': `${height}px` } as CSSProperties
  return (
    <div className="shell" style={style} {...dataAttributes(params)} data-density={String(params.density)} data-flash={flash?.length ? flash.join(' ') : undefined}>
      {screen === 'list' ? <ListScreen params={params} /> : <DetailScreen params={params} />}
    </div>
  )
}
