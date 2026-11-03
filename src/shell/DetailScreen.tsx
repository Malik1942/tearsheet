import { CONCERTS, groupBy, posterFor, shortDate } from './content'
import type { Params } from './params'

/** Screen 2: the year in review. Exercises grouping and rhythm on a second layout.
 *  `staticRender` is the same contract as on `ListScreen`: no interactive element. This screen has none today (rows, tags and totals are plain text), so it has nothing to swap; a control added here has to honor the prop. */
export function DetailScreen({ params }: { params: Params; staticRender?: boolean }) {
  const grouping = String(params.grouping) === 'none' ? 'by-time' : String(params.grouping)
  const groups = groupBy(CONCERTS, grouping)
  const rhythm = String(params.rhythm)
  const cities = new Set(CONCERTS.map(c => c.city)).size
  const best = [...CONCERTS].sort((a, b) => b.rating - a.rating)[0]
  const ordered = rhythm === 'featured-first' ? [...groups].sort((a, b) => b.items.length - a.items.length) : groups
  return (
    <div>
      <header className="review-head">
        <h1 className="screen-title">2025</h1>
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
                <p className="meta">{c.venue} · {c.tags.map(t => <span key={t} className="tag">{t}</span>)}</p>
              </div>
              <span className="when">{shortDate(c.date)}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
