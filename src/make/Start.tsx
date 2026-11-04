import { useRef } from 'react'
import { Photo } from '../bricks/Photo'
import { cardCaption } from '../lib/brickLabels'
import { labelsOfBrick } from '../lib/shortLabels'
import { originOf } from '../lib/starters'
import type { Brick } from '../lib/types'

const COPY = {
  go: 'Find photos',
  start: 'Start from one of your photos',
  startHint: 'Optional. The rest is proposed around it.',
  startingFrom: 'Starting from this one',
  clear: 'Clear',
  all: 'All photos…',
}
/** Photos shown as blocks: two rows of four on a wide screen, two rows of three on a phone (shell.css hides the seventh and eighth there). */
const SHOWN = 8, SHOWN_PHONE = 6

/** Make's field (Malik, 2026-11-03: a bigger, designed text box). A textarea, so a long intent wraps in view; Enter or the button proposes.
 *  `primary`: the button is the view's one red block before there is a project; on a project page Share is, so there it is a plain button. */
export function IntentField({ value, onChange, onSubmit, busy, label, placeholder, autoFocus, primary, onEscape, onLeave }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean; label: string; placeholder: string
  autoFocus?: boolean; primary?: boolean; onEscape?: () => void; onLeave?: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  return (
    <div ref={box} className="intent-field">
      <textarea value={value} rows={2} maxLength={300} disabled={busy} autoFocus={autoFocus} aria-label={label} placeholder={placeholder} enterKeyHint="go"
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSubmit() }
          if (e.key === 'Escape') onEscape?.()
        }}
        onBlur={e => { if (!box.current?.contains(e.relatedTarget as Node | null)) onLeave?.() }} />
      {/* mousedown keeps the focus in the field, so leaving it (which can put the headline back) never swallows this click */}
      <button type="button" className={`btn ${primary ? 'btn-accent' : ''} intent-go`} disabled={busy || !value.trim()} onMouseDown={e => e.preventDefault()} onClick={onSubmit}>
        {COPY.go}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
      </button>
    </div>
  )
}

/** The person's photos as large blocks to start from (spec v3 P4, "More like this one", brought out of Adjust style onto the empty page). The chosen one
 *  carries the same red ring as a photo that is on under the screens; tapping it again clears it. Their own photos first, newest saved first, then the starters. */
export function StartPhotos({ bricks, anchorId, onAnchor, onAll }: { bricks: Brick[]; anchorId: string | null; onAnchor: (id: string | null) => void; onAll: () => void }) {
  const own = bricks.filter(b => originOf(b) === 'own').sort((a, b) => (b.saved_at > a.saved_at ? 1 : b.saved_at < a.saved_at ? -1 : 0))
  const ordered = [...own, ...bricks.filter(b => originOf(b) !== 'own')]
  const chosen = anchorId ? ordered.find(b => b.id === anchorId) : undefined
  const shown = chosen ? [chosen, ...ordered.filter(b => b.id !== chosen.id)].slice(0, SHOWN) : ordered.slice(0, SHOWN)
  return (
    <section className="start-photos" aria-labelledby="start-title">
      <div className="start-head">
        <h2 id="start-title" className="em">{chosen ? COPY.startingFrom : COPY.start}</h2>
        {chosen ? <button type="button" className="btn btn-quiet" onClick={() => onAnchor(null)}>{COPY.clear}</button> : <span className="ink-2 caption">{COPY.startHint}</span>}
      </div>
      <ul className="start-grid">
        {shown.map(b => {
          const on = b.id === anchorId
          // the card's two lines, as on every card (Malik, 2026-11-03): its title, else its first short label; then its short credit or its date
          const cap = cardCaption(b, labelsOfBrick(b, 1)[0]?.label ?? null)
          return (
            <li key={b.id}>
              <button type="button" className="start-photo" aria-pressed={on} onClick={() => onAnchor(on ? null : b.id)}>
                <Photo src={b.photo.url} alt="" />
                <span className="cap-title">{cap.title}</span>
                <span className="cap-line tnum">{cap.line}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {ordered.length > SHOWN_PHONE && <button type="button" className="btn btn-quiet start-all" onClick={onAll}>{COPY.all}</button>}
    </section>
  )
}
