import { COMPOSITIONS } from './fixtures/compositions'
import { resolveParams } from './lib/mapRelations'
import { Shell } from './shell/Shell'

/** One shell, full viewport, no chrome: for screenshots, the video, and blind tests.
 *  #/solo/<compositionId>/<list|review>. A single letter instead of an id is looked up in localStorage.blindKey,
 *  so a blind assignment drawn in the browser never has to appear in a URL. */
export function Solo({ target, screen }: { target: string; screen: 'list' | 'review' }) {
  let id = target
  if (target.length === 1) {
    try { id = JSON.parse(localStorage.getItem('blindKey') ?? '{}')[target] ?? target } catch { /* ignore */ }
  }
  const comp = COMPOSITIONS[id]
  if (!comp) return <div className="p-4 text-sm">unknown composition</div>
  const { params } = resolveParams(comp)
  return (
    <div className="h-dvh w-full overflow-hidden">
      <Shell params={params} screen={screen} height={typeof window !== 'undefined' ? window.innerHeight : 800} />
    </div>
  )
}
