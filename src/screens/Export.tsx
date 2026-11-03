import { useState } from 'react'
import type { Project, Resolved } from '../lib/mapRelations'
import type { Brick } from '../lib/types'
import { download, exportCss, exportHandoff, exportJson } from '../export'

const TABS = [['parameters.json', 'application/json'], ['tokens.css', 'text/css'], ['handoff.md', 'text/markdown']] as const

/** What the Export page was, now in Fine-tune's Files fold on the Make page (Share's popover has the plain downloads): the three files as tabs, each with Copy and Download, and the text itself.
 *  The content is exactly what See and Fine-tune show, resolved from the same project. */
export function FilesView({ project, resolved, bricks }: { project: Project; resolved: Resolved; bricks: Brick[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('parameters.json')
  const [copied, setCopied] = useState(false)
  const used = project.brickIds.map(b => bricks.find(x => x.id === b)).filter((b): b is NonNullable<typeof b> => !!b)
  const textOf = (name: (typeof TABS)[number][0]) => name === 'parameters.json' ? exportJson(project.intent, resolved, project.proposal, project.brickIds) : name === 'tokens.css' ? exportCss(resolved, bricks) : exportHandoff(project.intent, used, resolved, project.proposal)
  const text = textOf(tab)
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked: the textarea below is selectable */ } }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {TABS.map(([name, mime]) => <button key={name} type="button" className="btn" onClick={() => download(name, textOf(name), mime)}>Download {name}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded border hairline text-[12px]" role="group" aria-label="File">
          {TABS.map(([name]) => <button key={name} type="button" aria-pressed={tab === name} onClick={() => setTab(name)} className="mono cursor-pointer border-0 px-3 py-1" style={tab === name ? { background: 'var(--ink)', color: '#fff' } : { background: 'var(--panel)', color: 'var(--ink)' }}>{name}</button>)}
        </div>
        <button type="button" className="btn btn-quiet ml-auto" onClick={copy}>{copied ? 'Copied' : `Copy ${tab}`}</button>
      </div>
      <textarea readOnly value={text} aria-label={tab} className="mono w-full rounded border p-3 hairline" style={{ height: '50vh', background: 'var(--panel)', color: 'var(--ink)', fontSize: 12, lineHeight: 1.5 }} />
      <p className="ink-2 m-0 text-[12px]">tokens.css carries one comment per value naming its source. Pasted into an empty Vite project it compiles; the shell's own variables are included so the List screen renders from it.</p>
    </div>
  )
}
