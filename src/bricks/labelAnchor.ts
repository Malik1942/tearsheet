import { candidatesOf } from '../lib/mapRelations'
import { footnoteMeasurement } from '../lib/landing'
import type { ShortLabel } from '../lib/shortLabels'
import type { Brick } from '../lib/types'

/** Where a label on the Brick sheet links on `/brick/:id`: the measurement its value rests on (`#m3`, the one the footnote cites, which also lights its region),
 *  else the rule it came from (`#r1`), else nowhere (the measured background, read by the harness and not by the model, has no anchor). */
export function labelAnchor(brick: Brick, l: Pick<ShortLabel, 'key' | 'value'>): string | null {
  const c = candidatesOf(brick).candidates.find(x => x.key === l.key && x.value === l.value)
  if (!c) return null
  return footnoteMeasurement(brick, c.source?.measurementIds)?.id ?? c.source?.relationId ?? null
}

/** The link for a label: `/brick/<id>#m3`, or the brick's page when there is no anchor. */
export const labelHref = (brick: Brick, l: Pick<ShortLabel, 'key' | 'value'>): string => {
  const a = labelAnchor(brick, l)
  return `/brick/${encodeURIComponent(brick.id)}${a ? `#${a}` : ''}`
}
