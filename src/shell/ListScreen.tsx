import type { ReactNode } from 'react'
import { groupBy, shortDate, type Entry, type ShellContent } from './content'
import type { Params } from './params'
import { Tags } from './Tags'
import { keepLastTwo } from './wholeWords'

/** The minimal top bar inside each phone frame (design pass A3): the screen title at title size, one control on the right, a hairline below.
 *  Without a title (the List under a left or right edge, whose large title sits below it) it holds the control alone, so the title is said once (layout contract rule 5).
 *  `balance` (centred screens): a hidden, inert copy of the control on the empty side, so both sides are as wide and the title sits on the screen's
 *  centre; a long title is cut with an ellipsis instead of sliding toward the empty side. */
export function TopBar({ title, children, balance }: { title?: string; children: ReactNode; balance?: ReactNode }) {
  return (
    <header className="bar">
      {title && balance && <span className="bar-balance" aria-hidden="true">{balance}</span>}
      {title && <h1 className="bar-title">{keepLastTwo(title)}</h1>}
      {children}
    </header>
  )
}

/** The plus and the row chevron, drawn in currentColor so the skin colors them. */
const PlusIcon = () => <svg className="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
const Chevron = () => <svg className="chev" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>

/** The list's one action, named by the content ("Add show" for the concert log). Under `accent_placement: actions` it is labelled and carries the accent; under any other placement it is a quiet plus with the same name. */
function AddShow({ label, labelled, staticRender }: { label: string; labelled: boolean; staticRender: boolean }) {
  const inside = labelled ? <><PlusIcon />{label}</> : <PlusIcon />
  return staticRender
    ? <span className="action">{inside}</span>
    : <button className="action" type="button" aria-label={labelled ? undefined : label}>{inside}</button>
}

/** A list item has no button of its own: the whole row is the target, and the chevron says so. Tags are text, separated by a middle dot (shell.css).
 *  The meta line is the date and the subtitle (with the place where the content has one); the note line shows only where the content has a note. */
function Item({ e, hues }: { e: Entry; hues: number }) {
  return (
    <article className="item">
      <div className="pic" aria-hidden="true" />
      <div className="text">
        <h3 className="title">{keepLastTwo(e.title)}</h3>
        <p className="meta"><span className="date">{shortDate(e.date)}</span><span className="sep">{'\u00A0· '}</span><span className="venue">{e.place ? `${e.subtitle}, ${e.place}` : e.subtitle}</span></p>
        {e.note && <p className="note">{keepLastTwo(e.note)}</p>}
        <p className={hues >= 3 ? 'tags palette-3' : 'tags'}>
          <Tags tags={e.tags} />
        </p>
        <Chevron />
      </div>
    </article>
  )
}

/** `staticRender` draws every control as a non-interactive element with the same class (a span for the top bar's Add show), for a copy that sits inside a button or a link.
 *  Large-title navigation (item 3): the bar holds the control, and the title sits under it at the screen's largest size (shell.css). On a centred screen the
 *  title sits in the bar instead, between nothing and the control, as on the year review: a centred large title under a bar holding only + read as a gap (Malik). */
export function ListScreen({ params, staticRender = false, content }: { params: Params; staticRender?: boolean; content: ShellContent }) {
  const groups = groupBy(content.entries, String(params.grouping))
  const hues = Number(params.palette_hue_count)
  const centred = params.alignment_edge === 'center'
  return (
    <div>
      <TopBar title={centred ? content.screenTitles.list : undefined} balance={centred && <AddShow label={content.add} labelled={params.accent_placement === 'actions'} staticRender />}>
        <AddShow label={content.add} labelled={params.accent_placement === 'actions'} staticRender={staticRender} />
      </TopBar>
      {!centred && <h1 className="large-title">{keepLastTwo(content.screenTitles.list)}</h1>}
      {groups.map(g => (
        <section className="group" key={g.label || 'all'}>
          {g.label && <h2 className="group-title">{g.label}</h2>}
          {g.items.map(e => <Item key={e.id} e={e} hues={hues} />)}
        </section>
      ))}
    </div>
  )
}
