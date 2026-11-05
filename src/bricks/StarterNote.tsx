import { useState } from 'react'
import { Link } from '../lib/router'
import { dismissStarterNote, isColdStart, starterNoteDismissed } from '../lib/coldStart'
import type { Brick } from '../lib/types'

const COPY = {
  before: 'These are starter photos. Open ',
  make: 'Make',
  after: ' to build something from them, or Shoot to add your own.',
  dismiss: 'Dismiss',
}

/** The Library on a cold start (lib/coldStart.ts): one line above the starters, in the meta style, with Make as a link and × to dismiss it for good.
 *  Renders nothing once the library holds a photo of the person's own, or after the ×. */
export function StarterNote({ bricks, showStarters }: { bricks: Pick<Brick, 'id' | 'origin'>[]; showStarters: boolean }) {
  const [dismissed, setDismissed] = useState(starterNoteDismissed)
  if (dismissed || !isColdStart(bricks, showStarters)) return null
  return (
    <div className="mb-4 flex items-center gap-2">
      <p className="caption ink-2 m-0 min-w-0 flex-1">{COPY.before}<Link href="/make" className="underline">{COPY.make}</Link>{COPY.after}</p>
      <button type="button" className="btn btn-quiet icon-btn" aria-label={COPY.dismiss} title={COPY.dismiss} onClick={() => { dismissStarterNote(); setDismissed(true) }}>×</button>
    </div>
  )
}
