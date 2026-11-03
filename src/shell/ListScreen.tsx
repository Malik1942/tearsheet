import type { ReactNode } from 'react'
import { CONCERTS, groupBy, posterFor, shortDate, type Concert } from './content'
import type { Params } from './params'

/** The minimal top bar inside each phone frame (design pass A3): the screen title at title size, one control on the right, a hairline below. */
export function TopBar({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="bar">
      <h1 className="bar-title">{title}</h1>
      {children}
    </header>
  )
}

/** The plus and the row chevron, drawn in currentColor so the skin colors them. */
const PlusIcon = () => <svg className="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
const Chevron = () => <svg className="chev" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>

/** The list's one action. Under `accent_placement: actions` it is the "Add show" button and carries the accent; under any other placement it is a quiet plus with the same name. */
function AddShow({ labelled, staticRender }: { labelled: boolean; staticRender: boolean }) {
  const inside = labelled ? <><PlusIcon />Add show</> : <PlusIcon />
  return staticRender
    ? <span className="action">{inside}</span>
    : <button className="action" type="button" aria-label={labelled ? undefined : 'Add show'}>{inside}</button>
}

/** A list item has no button of its own: the whole row is the target, and the chevron says so. Tags are text, separated by a middle dot (shell.css). */
function Item({ c, hues }: { c: Concert; hues: number }) {
  return (
    <article className="item">
      <div className="pic"><img src={posterFor(c)} alt="" /></div>
      <div className="text">
        <h3 className="title">{c.artist}</h3>
        <p className="meta"><span className="date">{shortDate(c.date)}</span><span className="sep"> · </span><span className="venue">{c.venue}, {c.city}</span></p>
        <p className="note">{c.note}</p>
        <p className={hues >= 3 ? 'tags palette-3' : 'tags'}>
          {c.tags.map(t => <span key={t} className="tag">{t}</span>)}
        </p>
      </div>
      <Chevron />
    </article>
  )
}

/** `staticRender` draws every control as a non-interactive element with the same class (a span for the top bar's Add show), for a copy that sits inside a button or a link. */
export function ListScreen({ params, staticRender = false }: { params: Params; staticRender?: boolean }) {
  const groups = groupBy(CONCERTS, String(params.grouping))
  const hues = Number(params.palette_hue_count)
  return (
    <div>
      <TopBar title="Shows"><AddShow labelled={params.accent_placement === 'actions'} staticRender={staticRender} /></TopBar>
      {groups.map(g => (
        <section className="group" key={g.label || 'all'}>
          {g.label && <h2 className="group-title">{g.label}</h2>}
          {g.items.map(c => <Item key={c.id} c={c} hues={hues} />)}
        </section>
      ))}
    </div>
  )
}
