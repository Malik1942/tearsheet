import { StoreProvider } from './lib/store'
import { match, usePath } from './lib/router'
import { makeRoute } from './lib/makeFlow'
import { hasHeader } from './lib/nav'
import { AppChrome } from './chrome/AppChrome'
import { AddPhotosProvider } from './bricks/AddPhotos'
import { Library } from './Library'
import { BrickScreen } from './screens/Brick'
import { Compare } from './Compare'
import { ProjectsScreen } from './screens/Projects'
import { MakeScreen } from './screens/Make'
import { SyncScreen } from './screens/Sync'
import { OpenScreen } from './screens/Open'
import { SharedScreen } from './screens/Shared'
import { InstructionsScreen } from './screens/Instructions'
import { Solo } from './Solo'
import { lazy, Suspense } from 'react'

/** Dev only (/dev/pixels). The lazy import sits in the DEV branch, so a production build folds this to null and neither the page nor its color math reaches the bundle. */
const DevPixels = import.meta.env.DEV ? lazy(() => import('./screens/DevPixels').then(m => ({ default: m.DevPixels }))) : null
/** Dev only (/dev/contract): one shell screen at the window's size for the layout contract test; folded away in a production build the same way. */
const DevContract = import.meta.env.DEV ? lazy(() => import('./screens/DevContract').then(m => ({ default: m.DevContract }))) : null

function Routes() {
  const path = usePath()
  const solo = match('/solo/:target/:screen', path)
  if (solo) return <Solo target={solo.target} screen={solo.screen as 'list' | 'review'} />
  const brick = match('/brick/:id', path)
  if (brick) return <BrickScreen id={brick.id} />
  if (path === '/projects') return <ProjectsScreen />
  // Make is one page: /make before a project, /project/:id with one (the older share, export and preview routes land there too)
  const make = makeRoute(path)
  if (make) return <MakeScreen id={make.id} share={make.share} />
  if (path === '/sync') return <SyncScreen />
  if (DevPixels && path === '/dev/pixels') return <Suspense fallback={null}><DevPixels /></Suspense>
  if (DevContract && path === '/dev/contract') return <Suspense fallback={null}><DevContract /></Suspense>
  if (path === '/open') return <OpenScreen />
  if (path === '/shared') return <SharedScreen />
  const instr = match('/project/:id/instructions', path)
  if (instr) return <InstructionsScreen id={instr.id} />
  // the step-2 comparison: still a route, no longer in any navigation (15_SIMPLIFY §1)
  if (path === '/compare') return <Compare />
  return <Library />
}

/** 15_SIMPLIFY §1: one shared header above every route but the solo shell renders. */
function Page() {
  const path = usePath()
  if (!hasHeader(path)) return <Routes />
  return <AppChrome><Routes /></AppChrome>
}

export default function App() {
  return (
    <StoreProvider>
      <AddPhotosProvider>
        <Page />
      </AddPhotosProvider>
    </StoreProvider>
  )
}
