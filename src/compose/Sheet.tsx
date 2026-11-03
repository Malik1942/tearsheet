import type { ReactNode } from 'react'
import type { ParameterKey } from '../shell/params'
import type { ParameterValue } from '../lib/types'
import { Photo } from '../bricks/Photo'
import { ProvenanceChip } from './ProvenanceChip'

/** One titled block of the parameter sheet. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel p-3"><h2 className="mb-2 text-[13px]">{title}</h2>{children}</section>
}

/** One parameter row: key, 16 px source thumbnail, swatch for colors, then the value with its provenance chip (or `default`). */
export function Row({ k, pv, swatch, thumb }: { k: ParameterKey; pv: ParameterValue; swatch?: boolean; thumb?: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[12px]" style={{ borderTop: '1px solid var(--line)' }}>
      <span className="mono w-28 shrink-0 truncate sm:w-36" title={k}>{k}</span>
      {thumb ? <Photo src={thumb} className="h-4 w-4 shrink-0 rounded-sm object-cover" /> : <span className="inline-block h-4 w-4 shrink-0" />}
      {swatch && <span className="inline-block h-3 w-3 rounded-sm" style={{ background: String(pv.value), border: '1px solid var(--line)' }} />}
      {pv.provenance === 'adapted' && !pv.source?.measurementIds?.length && pv.source?.brickId !== 'user' && !pv.source?.note?.startsWith('by')
        ? <span className="ink-2"><span className="mono">{String(pv.value)}</span> · default</span>
        : <span className="min-w-0 flex-1 overflow-hidden"><ProvenanceChip pv={pv} showKey={false} /></span>}
    </div>
  )
}
