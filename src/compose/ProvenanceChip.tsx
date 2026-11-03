import type { ParameterValue } from '../lib/types'
import { Link } from '../lib/router'
import { tooltipOf } from './provenanceCopy'

/** One value with its provenance. Spec: measured = filled ink, interpreted = dotted outline, adapted = light outline.
 *  The source id is always shown and links to the Brick screen scrolled to that item. */
export function ProvenanceChip({ pv, showKey = true, onClick }: { pv: ParameterValue; showKey?: boolean; onClick?: (pv: ParameterValue) => void }) {
  const src = pv.source
  const srcId = src?.relationId ?? src?.measurementIds?.[0]
  const label = pv.provenance === 'adapted'
    ? (src?.brickId === 'user' || src?.note?.startsWith('by you') ? 'by you' : src?.note?.startsWith('by rule') ? 'by rule' : srcId ? srcId : 'default')
    : srcId ?? (src?.brickId ? src.brickId : '')
  const title = [tooltipOf(pv), src?.relationRule, src?.note, src?.measurementIds?.length ? `measurements: ${src.measurementIds.join(', ')}` : ''].filter(Boolean).join('\n')
  const href = src?.brickId && src.brickId !== 'user' && srcId ? `/brick/${src.brickId}#${srcId}` : null
  return (
    <span className={`chip chip-${pv.provenance}`} title={title} onClick={onClick ? () => onClick(pv) : undefined} style={onClick ? { cursor: 'pointer' } : undefined}>
      {showKey && <span className="mono">{pv.key}</span>}
      <span className="mono">{showKey ? '= ' : ''}{String(pv.value)}</span>
      <span style={{ opacity: 0.8 }}>· {pv.provenance}{label ? ' · ' : ''}{label && (href ? <Link href={href} className="src mono" onClick={e => e.stopPropagation()} style={{ color: 'inherit' }}>{label}</Link> : <span className="mono">{label}</span>)}</span>
      {pv.locked && <span aria-label="locked">🔒</span>}
    </span>
  )
}
