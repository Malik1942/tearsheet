import { useId, useRef, type ReactNode } from 'react'
import type { ParameterKey, Params } from '../shell/params'
import type { Brick, ParameterValue } from '../lib/types'
import { contractLine, footnoteMeasurement, footnoteOf, isShellDefault, rowHeadline } from '../lib/landing'
import { Photo } from '../bricks/Photo'
import { PhotoPeek } from './PhotoPeek'
import { ProvenanceChip } from './ProvenanceChip'
import { usePeek } from './usePeek'

/** One titled block of the parameter sheet. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel p-3"><h2 className="mb-2 text-[13px]">{title}</h2>{children}</section>
}

/** One parameter row, rule before number (C4′). Line 1: the rule and where it lands on the two screens, wrapping freely.
 *  Line 2: key, 16 px source thumbnail, swatch for colors, the provenance chip (or `default`), then the measurement as a one-line footnote (ellipsis, full text in the tooltip), which drops below when the row is too narrow for it.
 *  C11: `flash` tints the row for the second its parameter is outlined on the shell, the same second as the outline: the tint is set and removed with no fade, so it does not outlast it.
 *  C12: a row with a source brick (not a shell default, not typed by you) opens a `PhotoPeek` of that brick's photo with the region of the measurement its footnote cites: on hover (a mouse) or a tap on the row,
 *  or from its source thumbnail, which is a real button (`aria-expanded`, `aria-controls`; Enter and Space work natively, Escape closes). The row is not itself a button, so the provenance chip's link stays an ordinary link. */
export function Row({ k, pv, params, bricks, swatch, thumb, flash = false }: { k: ParameterKey; pv: ParameterValue; params: Params; bricks: Brick[]; swatch?: boolean; thumb?: string; flash?: boolean }) {
  const note = footnoteOf(pv, bricks)
  const brick = isShellDefault(pv) || pv.source?.brickId === 'user' ? undefined : bricks.find(b => b.id === pv.source?.brickId)
  const ref = useRef<HTMLDivElement>(null)
  const peek = usePeek(ref, brick !== undefined)
  const peekId = useId()
  const source = thumb ? <Photo src={thumb} className="h-4 w-4 shrink-0 rounded-sm object-cover" /> : <span className="inline-block h-4 w-4 shrink-0" />
  return (
    <div ref={ref} className={'py-1 text-[12px]' + (brick ? ' cursor-pointer' : '')}
      style={{ borderTop: '1px solid var(--line)', background: flash ? 'color-mix(in oklab, var(--accent) 14%, transparent)' : undefined }}
      {...(brick ? peek.handlers : {})}>
      <div className="break-words">{rowHeadline(pv, params, bricks)}</div>
      {contractLine(pv) && <div className="ink-2 mt-0.5 break-words">{contractLine(pv)}</div>}
      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <div className="flex min-w-0 max-w-full items-center gap-2">
          <span className="mono w-28 shrink-0 truncate sm:w-36" title={k}>{k}</span>
          {brick
            ? <button type="button" aria-expanded={peek.open} aria-controls={peek.open ? peekId : undefined} aria-label={`Show where ${k} was read on ${brick.id}'s photo`}
                className="flex h-4 w-4 shrink-0 cursor-pointer rounded-sm p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]">{source}</button>
            : source}
          {swatch && <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: String(pv.value), border: '1px solid var(--line)' }} />}
          {isShellDefault(pv)
            ? <span className="ink-2 min-w-0 truncate" title={`${String(pv.value)} · default`}><span className="mono">{String(pv.value)}</span> · default</span>
            : <span className="min-w-0 overflow-hidden"><ProvenanceChip pv={pv} showKey={false} /></span>}
        </div>
        {note && <span className="mono ink-2 min-w-0 max-w-full truncate" title={note}>{note}</span>}
      </div>
      {brick && peek.open && peek.anchor && <PhotoPeek id={peekId} brick={brick} measurement={footnoteMeasurement(brick, pv.source?.measurementIds)} label={k} anchor={peek.anchor} />}
    </div>
  )
}
