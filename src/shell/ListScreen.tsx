import { CONCERTS, groupBy, posterFor, shortDate, type Concert } from './content'
import type { Params } from './params'

function Item({ c, hues }: { c: Concert; hues: number }) {
  return (
    <article className="item">
      <div className="pic"><img src={posterFor(c)} alt="" /></div>
      <div className="text">
        <h3 className="title">{c.artist}</h3>
        <p className="meta">{shortDate(c.date)} · {c.venue}, {c.city}</p>
        <p className="note">{c.note}</p>
        <div className={hues >= 3 ? 'palette-3' : ''}>
          {c.tags.map(t => <span key={t} className="tag">{t}</span>)}
          <button className="action" type="button">Details</button>
        </div>
      </div>
    </article>
  )
}

export function ListScreen({ params }: { params: Params }) {
  const groups = groupBy(CONCERTS, String(params.grouping))
  const hues = Number(params.palette_hue_count)
  return (
    <div>
      {groups.map(g => (
        <section className="group" key={g.label || 'all'}>
          {g.label && <h2 className="group-title">{g.label}</h2>}
          {g.items.map(c => <Item key={c.id} c={c} hues={hues} />)}
        </section>
      ))}
    </div>
  )
}
