import { useLayoutEffect, useRef } from 'react'
import { Photo } from '../bricks/Photo'
import type { Brick } from '../lib/types'

const COPY = {
  go: 'Find photos',
  finding: 'Looking through your photos',
  startingFrom: 'Starting from this photo',
  clear: 'Clear the starting point',
}

/** Make's headline is its input (Malik, 2026-11-03: affordance over signifiers). The question is the placeholder, set like the page's h1 (the field sits in
 *  the same .intent-headline box), and the typed text grows to three lines at that size. Enter proposes; Shift+Enter does nothing. A round ink arrow
 *  appears at the end once there is text, never disabled; while proposing it goes and a thin line runs under the headline (the Library's reading line). */
export function HeadlineField({ value, onChange, onSubmit, busy, label, autoFocus, onEscape, onLeave }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean; label: string
  autoFocus?: boolean; onEscape?: () => void; onLeave?: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  // the field grows with its text (tokens.css stops it at three lines), also where field-sizing is not supported
  useLayoutEffect(() => { const t = area.current; if (!t) return; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px` }, [value])
  return (
    <div ref={box} className="intent-headline headline-field">
      <textarea ref={area} className="headline-input" value={value} rows={1} maxLength={300} readOnly={busy} autoFocus={autoFocus} aria-label={label} placeholder={label} enterKeyHint="go"
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); if (!e.shiftKey && !busy) onSubmit() }
          if (e.key === 'Escape') onEscape?.()
        }}
        onBlur={e => { if (!box.current?.contains(e.relatedTarget as Node | null)) onLeave?.() }} />
      {/* mousedown keeps the focus in the field, so leaving it (which can put a project's headline back) never swallows this tap */}
      {value.trim() && !busy && (
        <button type="button" className="headline-go" aria-label={COPY.go} title={COPY.go} onMouseDown={e => e.preventDefault()} onClick={onSubmit}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
        </button>
      )}
      {busy && <div className="card-progress headline-progress" role="progressbar" aria-label={COPY.finding} />}
    </div>
  )
}

/** A starting point set from the Library (Use in Make) or from ⋯ → Adjust style: the photo itself under the headline, with × to clear it. No words. */
export function AnchorThumb({ brick, onClear }: { brick: Brick; onClear: () => void }) {
  return (
    <div className="make-anchor">
      <Photo src={brick.photo.url} alt={COPY.startingFrom} title={COPY.startingFrom} />
      <button type="button" className="make-anchor-clear" aria-label={COPY.clear} title={COPY.clear} onClick={onClear}>×</button>
    </div>
  )
}
