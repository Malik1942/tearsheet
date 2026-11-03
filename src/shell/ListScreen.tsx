import { CONCERTS, groupBy, posterFor, shortDate, type Concert } from './content'
import type { Params } from './params'

function Item({ c, hues, staticRender }: { c: Concert; hues: number; staticRender: boolean }) {
  return (
    <article className="item">
      <div className="pic"><img src={posterFor(c)} alt="" /></div>
      <div className="text">
        <h3 className="title">{c.artist}</h3>
        <p className="meta">{shortDate(c.date)} · {c.venue}, {c.city}</p>
        <p className="note">{c.note}</p>
        <div className={hues >= 3 ? 'palette-3' : ''}>
          {c.tags.map(t => <span key={t} className="tag">{t}</span>)}
          {staticRender ? <span className="action">Details</span> : <button className="action" type="button">Details</button>}
        </div>
      </div>
    </article>
  )
}

/** `staticRender` draws every control as a non-interactive element with the same class (a span for the Details button), for a copy that sits inside a button or a link. */
export function ListScreen({ params, staticRender = false }: { params: Params; staticRender?: boolean }) {
  const groups = groupBy(CONCERTS, String(params.grouping))
  const hues = Number(params.palette_hue_count)
  return (
    <div>
      {groups.map(g => (
        <section className="group" key={g.label || 'all'}>
          {g.label && <h2 className="group-title">{g.label}</h2>}
          {g.items.map(c => <Item key={c.id} c={c} hues={hues} staticRender={staticRender} />)}
        </section>
      ))}
    </div>
  )
}
