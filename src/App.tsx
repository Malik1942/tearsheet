import { StoreProvider } from './lib/store'
import { match, usePath, Link } from './lib/router'
import { Library } from './Library'
import { BrickScreen } from './screens/Brick'
import { Compare } from './Compare'
import { ProjectsScreen } from './screens/Projects'
import { ComposeScreen } from './screens/Compose'
import { Solo } from './Solo'

function Routes() {
  const path = usePath()
  const solo = match('/solo/:target/:screen', path)
  if (solo) return <Solo target={solo.target} screen={solo.screen as 'list' | 'review'} />
  const brick = match('/brick/:id', path)
  if (brick) return <BrickScreen id={brick.id} />
  if (path === '/projects') return <ProjectsScreen />
  const proj = match('/project/:id', path) ?? match('/project/:id/export', path)
  if (proj) return <ComposeScreen id={proj.id} />
  if (path === '/compare') return <div className="chrome min-h-full"><Nav /><Compare /></div>
  return <Library />
}

function Nav() {
  const path = usePath()
  const items = [['/', 'Library'], ['/projects', 'Projects'], ['/compare', 'Compare (step 2)']] as const
  return (
    <nav className="flex items-center gap-1 border-b px-4 py-2 hairline" style={{ background: 'var(--panel)' }}>
      <Link href="/" className="mr-3 font-semibold no-underline" style={{ color: 'var(--ink)' }}>Tearsheet</Link>
      {items.map(([h, label]) => <Link key={h} href={h} className={`btn btn-quiet ${path === h ? 'font-semibold' : ''}`} style={path === h ? { color: 'var(--ink)' } : undefined}>{label}</Link>)}
    </nav>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Routes />
    </StoreProvider>
  )
}
