import type { ReactNode } from 'react'
import { groupTiles, type ShellContent, type Tile } from './content'
import { TopBar } from './ListScreen'
import type { Params } from './params'
import { keepLastTwo } from './wholeWords'

/** The board's one control: its period, named by the content ("Today"). Under `accent_placement: actions` it is labelled and carries the accent, like the list's Add;
 *  under any other placement it is a quiet clock with the same name. */
const ClockIcon = () => <svg className="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 5v3.2l2 1.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
function Period({ label, labelled, staticRender }: { label: string; labelled: boolean; staticRender: boolean }) {
  const inside: ReactNode = labelled ? <><ClockIcon />{label}</> : <ClockIcon />
  return staticRender
    ? <span className="action">{inside}</span>
    : <button className="action" type="button" aria-label={labelled ? undefined : label}>{inside}</button>
}

/** A tile is a surface, never a row: a label at caption size, the value at title size (display under type-led), a note the tighter densities hide, and the one tag that
 *  names its state. The flat block stands for a chart (contract rule 6: no text, no glyph inside): under image-led it leads, under balanced it is a strip below, under
 *  type-led there is none. Its children sit directly in the tile, so the grid areas the densities, the rhythm and the alignment use are the tile's own. */
function TileCard({ t, hues }: { t: Tile; hues: number }) {
  return (
    <article className="tile">
      <div className="pic" aria-hidden="true" />
      <p className="label">{keepLastTwo(t.label)}</p>
      <p className="value">{t.value}</p>
      <p className="note">{keepLastTwo(t.note)}</p>
      <p className={hues >= 3 ? 'tags palette-3' : 'tags'}><span className="tag">{t.tag}</span></p>
    </article>
  )
}

/** Screen 1 of a board (2026-11-04): the overview, titled by `screenTitles.review`. The same bar and large-title navigation as the list: the bar holds the period,
 *  the title sits under it at the screen's largest size; centred, the title sits in the bar between the period and its hidden twin. Density chooses the form
 *  (one column, two columns, rows), rhythm the cadence (uniform, a featured first tile, a full tile every third), grouping `by-tag` sections the tiles by state. */
export function BoardScreen({ params, staticRender = false, content }: { params: Params; staticRender?: boolean; content: ShellContent }) {
  const groups = groupTiles(content.tiles, String(params.grouping))
  const hues = Number(params.palette_hue_count)
  const centred = params.alignment_edge === 'center'
  const labelled = params.accent_placement === 'actions'
  return (
    <div>
      <TopBar title={centred ? content.screenTitles.review : undefined} balance={centred && <Period label={content.add} labelled={labelled} staticRender />}>
        <Period label={content.add} labelled={labelled} staticRender={staticRender} />
      </TopBar>
      {!centred && <h1 className="large-title">{keepLastTwo(content.screenTitles.review)}</h1>}
      {groups.map(g => (
        <section className="group board" key={g.label || 'all'}>
          {g.label && <h2 className="group-title">{g.label}</h2>}
          <div className="tiles">
            {g.items.map(t => <TileCard key={t.id} t={t} hues={hues} />)}
          </div>
        </section>
      ))}
    </div>
  )
}
