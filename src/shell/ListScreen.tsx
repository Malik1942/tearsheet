import type { ReactNode } from 'react'
import { CONCERTS, groupBy, shortDate, type Concert, type ShellContent } from './content'
import type { Params } from './params'

/** The minimal top bar inside each phone frame (design pass A3): the screen title at title size, one control on the right, a hairline below.
 *  Without a title (the List, whose large title sits below it) it holds the control alone, so the title is said once (layout contract rule 5). */
export function TopBar({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <header className="bar">
      {title && <h1 className="bar-title">{title}</h1>}
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
      <div className="pic" aria-hidden="true" />
      <div className="text">
        <h3 className="title">{c.artist}</h3>
        <p className="meta"><span className="date">{shortDate(c.date)}</span><span className="sep"> · </span><span className="venue">{c.venue}, {c.city}</span></p>
        <p className="note">{c.note}</p>
        <p className={hues >= 3 ? 'tags palette-3' : 'tags'}>
          {c.tags.map(t => <span key={t} className="tag">{t}</span>)}
        </p>
        <Chevron />
      </div>
    </article>
  )
}

/** `staticRender` draws every control as a non-interactive element with the same class (a span for the top bar's Add show), for a copy that sits inside a button or a link.
 *  Large-title navigation (item 3): the bar holds the control, and the title sits under it at the screen's largest size (shell.css). */
export function ListScreen({ params, staticRender = false, content }: { params: Params; staticRender?: boolean; content: ShellContent }) {
  const groups = groupBy(CONCERTS, String(params.grouping))
  const hues = Number(params.palette_hue_count)
  return (
    <div>
      <TopBar><AddShow labelled={params.accent_placement === 'actions'} staticRender={staticRender} /></TopBar>
      <h1 className="large-title">{content.screenTitles.list}</h1>
      {groups.map(g => (
        <section className="group" key={g.label || 'all'}>
          {g.label && <h2 className="group-title">{g.label}</h2>}
          {g.items.map(c => <Item key={c.id} c={c} hues={hues} />)}
        </section>
      ))}
    </div>
  )
}
