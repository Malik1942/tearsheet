import { useId, useRef, type ReactNode } from 'react'
import type { ParameterKey, Params } from '../shell/params'
import type { Brick, ParameterValue } from '../lib/types'
import { footnoteMeasurement, footnoteOf, isShellDefault, rowHeadline } from '../lib/landing'
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
 *  C11: `flash` tints the row for the second its parameter is outlined on the shell.
 *  C12: a row with a source brick (not a shell default, not typed by you) is a button that opens a `PhotoPeek` of that brick's photo with the region of the measurement its footnote cites:
 *  on hover (a mouse), or pinned by a tap, a click, Enter or Space; `aria-expanded` says which. */
export function Row({ k, pv, params, bricks, swatch, thumb, flash = false }: { k: ParameterKey; pv: ParameterValue; params: Params; bricks: Brick[]; swatch?: boolean; thumb?: string; flash?: boolean }) {
  const note = footnoteOf(pv, bricks)
  const brick = isShellDefault(pv) || pv.source?.brickId === 'user' ? undefined : bricks.find(b => b.id === pv.source?.brickId)
  const ref = useRef<HTMLDivElement>(null)
  const peek = usePeek(ref, brick !== undefined)
  const peekId = useId()
  return (
    <div ref={ref} className={'py-1 text-[12px] transition-colors duration-300 motion-reduce:transition-none' + (brick ? ' cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]' : '')}
      style={{ borderTop: '1px solid var(--line)', background: flash ? 'color-mix(in oklab, var(--accent) 14%, transparent)' : undefined }}
      {...(brick ? { ...peek.handlers, role: 'button', tabIndex: 0, 'aria-expanded': peek.open, 'aria-controls': peek.open ? peekId : undefined } : {})}>
      <div className="break-words">{rowHeadline(pv, params, bricks)}</div>
      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <div className="flex min-w-0 max-w-full items-center gap-2">
          <span className="mono w-28 shrink-0 truncate sm:w-36" title={k}>{k}</span>
          {thumb ? <Photo src={thumb} className="h-4 w-4 shrink-0 rounded-sm object-cover" /> : <span className="inline-block h-4 w-4 shrink-0" />}
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
