import { useState } from 'react'
import { useStore } from '../lib/store'
import { Link, navigate } from '../lib/router'
import { Photo } from '../bricks/Photo'

const MAX_BRICKS = 5

/** Projects: name an intent, pick bricks, open Compose. Desktop only by spec; on a phone the Library says so. */
export function ProjectsScreen() {
  const store = useStore()
  const preselect = new URLSearchParams(location.search).get('brick')
  const [open, setOpen] = useState(store.projects.length === 0 || !!preselect)
  const [name, setName] = useState('')
  const [intent, setIntent] = useState('')
  const [picked, setPicked] = useState<string[]>(preselect && store.bricks.some(b => b.id === preselect) ? [preselect] : [])
  const ready = store.bricks.filter(b => (b.status ?? 'ready') === 'ready')
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length < MAX_BRICKS ? [...p, id] : p)
  const create = () => {
    if (!intent.trim() || picked.length === 0) return
    const id = store.createProject(intent.trim(), picked, name.trim() || undefined)
    navigate(`/project/${id}`)
  }
  const projects = [...store.projects].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))

  return (
    <div className="chrome min-h-full">
      <header className="flex items-center gap-3 border-b px-4 py-2 hairline" style={{ background: 'var(--panel)' }}>
        <Link href="/" className="font-semibold no-underline" style={{ color: 'var(--ink)' }}>Tearsheet</Link>
        <span className="ink-2">/ Projects</span>
        <div className="ml-auto"><button type="button" className="btn btn-accent" onClick={() => setOpen(true)}>New project</button></div>
      </header>

      <div className="mx-auto max-w-4xl p-4">
        {open && (
          <section className="panel mb-4 p-4">
            <h2 className="mb-3">Decide what to make</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-[12px] ink-2">Name
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Concert log" className="rounded border px-2 py-1 text-[13px] hairline" style={{ color: 'var(--ink)', background: 'var(--panel)' }} />
              </label>
              <label className="flex flex-col gap-1 text-[12px] ink-2">Intent, one line
                <input value={intent} onChange={e => setIntent(e.target.value)} placeholder="A concert log for someone who goes to a lot of shows" className="rounded border px-2 py-1 text-[13px] hairline" style={{ color: 'var(--ink)', background: 'var(--panel)' }} />
              </label>
            </div>
            <div className="mt-3 text-[12px] ink-2">Shell family</div>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="chip chip-measured">List + Year review</span>
              <span className="chip chip-adapted" title="next">Dashboard · next</span>
              <span className="chip chip-adapted" title="next">Form · next</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between text-[12px] ink-2"><span>Bricks from your library, up to {MAX_BRICKS}</span><span className="mono">{picked.length}/{MAX_BRICKS}</span></div>
            <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {ready.map(b => {
                const on = picked.includes(b.id)
                return (
                  <button key={b.id} type="button" onClick={() => toggle(b.id)} className="overflow-hidden rounded text-left" style={{ border: `2px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: 'var(--panel)' }}>
                    <div style={{ aspectRatio: '16 / 10', background: '#2a2a2a' }}><Photo src={b.photo.url} className="h-full w-full object-cover" /></div>
                    <div className="px-1.5 py-1 text-[11px]"><span className="mono">{b.id}</span> <span className="ink-2">{b.saved_at}</span></div>
                  </button>
                )
              })}
              {ready.length === 0 && <span className="ink-2 text-[12px]">Nothing in the library yet. Add photos or load the sample library first.</span>}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button type="button" className="btn btn-accent" onClick={create} disabled={!intent.trim() || picked.length === 0}>Open Compose</button>
              {store.projects.length > 0 && <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>Cancel</button>}
            </div>
          </section>
        )}

        {projects.length > 0 && (
          <ul className="space-y-2">
            {projects.map(p => (
              <li key={p.id} className="panel flex items-center gap-3 p-3">
                <div className="flex -space-x-2">
                  {p.brickIds.map(id => { const b = store.bricks.find(x => x.id === id); return b ? <Photo key={id} src={b.photo.url} className="h-10 w-10 rounded-full object-cover" style={{ border: '2px solid var(--panel)' }} /> : null })}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{p.name || 'Untitled project'}</div>
                  <div className="ink-2 truncate text-[12px]">{p.intent}</div>
                </div>
                <span className="ink-2 text-[11px]">edited {(p.updatedAt ?? p.createdAt).slice(0, 16).replace('T', ' ')}</span>
                <Link href={`/project/${p.id}`} className="btn">Open Compose</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
