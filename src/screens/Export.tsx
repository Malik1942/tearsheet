import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { resolveProject } from '../lib/mapRelations'
import { download, exportCss, exportHandoff, exportJson } from '../export'

const TABS = [['parameters.json', 'application/json'], ['tokens.css', 'text/css'], ['handoff.md', 'text/markdown']] as const

/** Export: three tabs with copy and download. The content is exactly what Compose shows, resolved from the same project. */
export function ExportScreen({ id }: { id: string }) {
  const store = useStore()
  const project = store.projects.find(p => p.id === id)
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('parameters.json')
  const [copied, setCopied] = useState(false)
  const resolved = useMemo(() => project ? resolveProject(project, store.bricks) : null, [project, store.bricks])
  if (!project || !resolved) return <div className="chrome min-h-full p-4"><Link href="/projects" className="ink-2 text-[12px]">← Projects</Link><p className="mt-4 ink-2">No project with id {id}.</p></div>
  const bricks = project.brickIds.map(b => store.bricks.find(x => x.id === b)).filter((b): b is NonNullable<typeof b> => !!b)
  const text = tab === 'parameters.json' ? exportJson(project.intent, resolved, project.proposal, project.brickIds) : tab === 'tokens.css' ? exportCss(resolved, store.bricks) : exportHandoff(project.intent, bricks, resolved, project.proposal)
  const mime = TABS.find(t => t[0] === tab)![1]
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked: the textarea below is selectable */ } }
  return (
    <div className="chrome min-h-full">
      <header className="flex items-center gap-3 border-b px-4 py-2 hairline" style={{ background: 'var(--panel)' }}>
        <Link href="/" className="font-semibold no-underline" style={{ color: 'var(--ink)' }}>Tearsheet</Link>
        <span className="ink-2">/ <Link href="/projects" className="ink-2">Projects</Link> / <Link href={`/project/${project.id}`} className="ink-2">{project.name || 'Untitled'}</Link> / Export</span>
      </header>
      <div className="mx-auto max-w-4xl p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded border hairline text-[12px]">
            {TABS.map(([name]) => <button key={name} type="button" onClick={() => setTab(name)} className="mono px-3 py-1" style={tab === name ? { background: 'var(--ink)', color: '#fff' } : { background: 'var(--panel)' }}>{name}</button>)}
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            <button type="button" className="btn btn-accent" onClick={() => download(tab, text, mime)}>Download</button>
          </div>
        </div>
        <textarea readOnly value={text} className="mono w-full rounded border p-3 hairline" style={{ height: '70vh', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12, lineHeight: 1.5 }} />
        <p className="ink-2 mt-2 text-[12px]">tokens.css carries one comment per value naming its source. Pasted into an empty Vite project it compiles; the shell's own variables are included so the List screen renders from it.</p>
      </div>
    </div>
  )
}
