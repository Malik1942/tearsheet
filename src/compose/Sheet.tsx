import type { ReactNode } from 'react'
import type { ParameterKey, Params } from '../shell/params'
import type { Brick, ParameterValue } from '../lib/types'
import { footnoteOf, isShellDefault, rowHeadline } from '../lib/landing'
import { Photo } from '../bricks/Photo'
import { ProvenanceChip } from './ProvenanceChip'

/** One titled block of the parameter sheet. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel p-3"><h2 className="mb-2 text-[13px]">{title}</h2>{children}</section>
}

/** One parameter row, rule before number (C4′). Line 1: the rule and where it lands on the two screens, wrapping freely.
 *  Line 2: key, 16 px source thumbnail, swatch for colors, the provenance chip (or `default`), then the measurement as a footnote, which drops below when the row is too narrow for it. */
export function Row({ k, pv, params, bricks, swatch, thumb }: { k: ParameterKey; pv: ParameterValue; params: Params; bricks: Brick[]; swatch?: boolean; thumb?: string }) {
  const note = footnoteOf(pv, bricks)
  return (
    <div className="py-1 text-[12px]" style={{ borderTop: '1px solid var(--line)' }}>
      <div className="break-words">{rowHeadline(pv, params, bricks)}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="mono w-28 shrink-0 truncate sm:w-36" title={k}>{k}</span>
          {thumb ? <Photo src={thumb} className="h-4 w-4 shrink-0 rounded-sm object-cover" /> : <span className="inline-block h-4 w-4 shrink-0" />}
          {swatch && <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: String(pv.value), border: '1px solid var(--line)' }} />}
          {isShellDefault(pv)
            ? <span className="ink-2"><span className="mono">{String(pv.value)}</span> · default</span>
            : <span className="min-w-0 overflow-hidden"><ProvenanceChip pv={pv} showKey={false} /></span>}
        </div>
        {note && <span className="mono ink-2 min-w-0 break-words">{note}</span>}
      </div>
    </div>
  )
}
