import { featured, groupBy, shortDate, statValue, yearOf, type ShellContent } from './content'
import { TopBar } from './ListScreen'
import type { Params } from './params'
import { Tags } from './Tags'
import { keepLastTwo } from './wholeWords'

const ShareIcon = () => <svg className="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 10V2.5M5 5.2 8 2.3l3 2.9M4 8v5.5h8V8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>

/** Screen 2: the year in review. Exercises grouping and rhythm on a second layout. Every word comes from `content`: its year is the one the entries share,
 *  its totals and featured line are the content's own (the concert log's "shows, cities, genres" and "Show of the year").
 *  `staticRender` is the same contract as on `ListScreen`: no interactive element. The top bar's share control is its only one, drawn as a span with the same class. */
export function DetailScreen({ params, staticRender = false, content }: { params: Params; staticRender?: boolean; content: ShellContent }) {
  const entries = content.entries
  const grouping = String(params.grouping) === 'none' ? 'by-time' : String(params.grouping)
  const groups = groupBy(entries, grouping)
  const rhythm = String(params.rhythm)
  const best = featured(entries)
  const ordered = rhythm === 'featured-first' ? [...groups].sort((a, b) => b.items.length - a.items.length) : groups
  return (
    <div>
      <TopBar title={content.screenTitles.review} balance={params.alignment_edge === 'center' && <span className="bar-icon"><ShareIcon /></span>}>
        {staticRender ? <span className="bar-icon"><ShareIcon /></span> : <button className="bar-icon" type="button" aria-label="Share"><ShareIcon /></button>}
      </TopBar>
      <header className="review-head">
        <h2 className="screen-title">{yearOf(entries)}</h2>
        <ul className="stats">
          {content.stats.map(s => <li key={s.count}><strong>{statValue(entries, s.count)}</strong> {s.label}</li>)}
        </ul>
      </header>
      {rhythm === 'featured-first' && best && (
        <div className="feature">
          <div className="pic" aria-hidden="true" />
          <h2 className="title">{keepLastTwo(`${content.feature}: ${best.title}`)}</h2>
          <p className="meta">{shortDate(best.date)}{'\u00A0· '}{best.subtitle}</p>
        </div>
      )}
      {ordered.map(g => (
        <section className="review-section group" key={g.label}>
          <h2 className="group-title">{g.label}</h2>
          {g.items.map(e => (
            <div className="row" key={e.id}>
              <div className="pic" aria-hidden="true" />
              <div>
                <p className="title">{keepLastTwo(e.title)}</p>
                <p className="meta">{e.subtitle}{'\u00A0· '}<span className="tags"><Tags tags={e.tags} /></span></p>
              </div>
              <span className="when">{shortDate(e.date)}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
