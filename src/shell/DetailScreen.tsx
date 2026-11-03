import { CONCERTS, groupBy, posterFor, shortDate } from './content'
import { TopBar } from './ListScreen'
import type { Params } from './params'

const ShareIcon = () => <svg className="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 10V2.5M5 5.2 8 2.3l3 2.9M4 8v5.5h8V8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>

/** Screen 2: the year in review. Exercises grouping and rhythm on a second layout.
 *  `staticRender` is the same contract as on `ListScreen`: no interactive element. The top bar's share control is its only one, drawn as a span with the same class. */
export function DetailScreen({ params, staticRender = false }: { params: Params; staticRender?: boolean }) {
  const grouping = String(params.grouping) === 'none' ? 'by-time' : String(params.grouping)
  const groups = groupBy(CONCERTS, grouping)
  const rhythm = String(params.rhythm)
  const cities = new Set(CONCERTS.map(c => c.city)).size
  const best = [...CONCERTS].sort((a, b) => b.rating - a.rating)[0]
  const ordered = rhythm === 'featured-first' ? [...groups].sort((a, b) => b.items.length - a.items.length) : groups
  return (
    <div>
      <TopBar title="Year in review">
        {staticRender ? <span className="bar-icon"><ShareIcon /></span> : <button className="bar-icon" type="button" aria-label="Share"><ShareIcon /></button>}
      </TopBar>
      <header className="review-head">
        <h2 className="screen-title">2025</h2>
        <ul className="stats">
          <li><strong>{CONCERTS.length}</strong> shows</li>
          <li><strong>{cities}</strong> cities</li>
          <li><strong>{new Set(CONCERTS.flatMap(c => c.tags)).size}</strong> genres</li>
        </ul>
      </header>
      {rhythm === 'featured-first' && (
        <div className="feature">
          <div className="pic"><img src={posterFor(best)} alt="" /></div>
          <h2 className="title">Show of the year: {best.artist}</h2>
          <p className="meta">{shortDate(best.date)} · {best.venue}</p>
        </div>
      )}
      {ordered.map(g => (
        <section className="review-section group" key={g.label}>
          <h2 className="group-title">{g.label}</h2>
          {g.items.map(c => (
            <div className="row" key={c.id}>
              <div className="pic"><img src={posterFor(c)} alt="" /></div>
              <div>
                <p className="title">{c.artist}</p>
                <p className="meta">{c.venue} · <span className="tags">{c.tags.map(t => <span key={t} className="tag">{t}</span>)}</span></p>
              </div>
              <span className="when">{shortDate(c.date)}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
