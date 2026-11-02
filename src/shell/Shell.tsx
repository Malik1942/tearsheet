import type { CSSProperties } from 'react'
import './shell.css'
import { dataAttributes, toCssVars, type Params } from './params'
import { ListScreen } from './ListScreen'
import { DetailScreen } from './DetailScreen'

/** One JSON in, one render out. `screen` picks which of the two screens; everything else is parameters. */
export function Shell({ params, screen, height = 640 }: { params: Params; screen: 'list' | 'review'; height?: number }) {
  const style = { ...toCssVars(params), '--viewport-h': `${height}px` } as CSSProperties
  return (
    <div className="shell" style={style} {...dataAttributes(params)} data-density={String(params.density)}>
      {screen === 'list' ? <ListScreen params={params} /> : <DetailScreen params={params} />}
    </div>
  )
}
