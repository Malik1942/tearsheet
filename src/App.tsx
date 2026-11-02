import { useEffect, useState } from 'react'
import { StoreProvider } from './lib/store'
import { Compare } from './Compare'
import { CollectPage } from './Collect'
import { ProjectPage } from './Project'

const ROUTES = [['#/collect', 'Collect'], ['#/project', 'Project'], ['#/compare', 'Compare (step 2)']] as const

export default function App() {
  const [hash, setHash] = useState(location.hash || '#/collect')
  useEffect(() => {
    const on = () => setHash(location.hash || '#/collect')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return (
    <StoreProvider>
      <nav className="flex items-center gap-1 border-b border-stone-300 bg-white px-4 py-2 text-sm">
        <span className="mr-3 font-semibold">Bricks</span>
        {ROUTES.map(([h, label]) => <a key={h} href={h} className={`rounded px-2 py-1 ${hash === h ? 'bg-stone-800 text-white' : 'hover:bg-stone-100'}`}>{label}</a>)}
        <span className="ml-auto text-[11px] text-stone-500">collect first, decide later</span>
      </nav>
      {hash === '#/project' ? <ProjectPage /> : hash === '#/compare' ? <Compare /> : <CollectPage />}
    </StoreProvider>
  )
}
