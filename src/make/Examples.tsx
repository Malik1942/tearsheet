import { EXAMPLE_INTENTS, isColdStart } from '../lib/coldStart'
import type { Brick } from '../lib/types'

/** Make on a cold start (lib/coldStart.ts), a new project with an empty field: two example intents under it. A tap fills the field and focuses it;
 *  nothing is sent until Enter. Renders nothing once there is text, or once the library holds a photo of the person's own. */
export function ExampleIntents({ bricks, showStarters, intent, onPick }: {
  bricks: Pick<Brick, 'id' | 'origin'>[]; showStarters: boolean; intent: string; onPick: (intent: string) => void
}) {
  if (intent.trim() || !isColdStart(bricks, showStarters)) return null
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Examples">
      {EXAMPLE_INTENTS.map(x => <button key={x} type="button" className="chip chip-adapted min-h-8 cursor-pointer" onClick={() => onPick(x)}>{x}</button>)}
    </div>
  )
}
