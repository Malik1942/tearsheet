import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { Link, navigate } from '../lib/router'
import { Photo } from '../bricks/Photo'
import { proposeValue, provenanceOf, typeFamilyOf } from '../lib/mapRelations'
import { footnoteFor, landsOn } from '../lib/landing'
import { DEFAULT_PARAMS, type ParameterKey } from '../shell/params'

/** Brick screen: one photo, its measurements (the honest layer, first), relations, hypotheses, and the fragile sentence.
 *  Every item has an id anchor (#m3, #h2, #r1) so a provenance chip anywhere can land here. */
export function BrickScreen({ id }: { id: string }) {
  const store = useStore()
  const brick = store.bricks.find(b => b.id === id)
  const [regions, setRegions] = useState(true)
  const [hl, setHl] = useState<string | null>(null)
  const target = typeof location !== 'undefined' ? location.hash.slice(1) : ''
  useEffect(() => {
    if (!target) return
    const el = document.getElementById(target)
    if (el) { el.scrollIntoView({ block: 'center' }); setHl(target) }
  }, [target, id])

  if (!brick) return <div className="chrome min-h-full p-4"><Link href="/" className="ink-2 text-[12px]">← Library</Link><p className="mt-4 ink-2">No brick with id {id}.</p></div>
  const mIds = new Set(brick.measurements.map(m => m.id))
  const relations = [...brick.relations].sort((a, b) => (a.parameter === 'none' ? 1 : 0) - (b.parameter === 'none' ? 1 : 0))

  return (
    <div className="chrome min-h-full">
      <header className="flex items-center gap-3 border-b px-4 py-2 hairline" style={{ background: 'var(--panel)' }}>
        <Link href="/" className="font-semibold no-underline" style={{ color: 'var(--ink)' }}>Tearsheet</Link>
        <span className="ink-2">/ <span className="mono">{brick.id}</span> · saved {brick.saved_at}</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className={`btn ${regions ? '' : 'btn-quiet'}`} onClick={() => setRegions(v => !v)}>Regions {regions ? 'on' : 'off'}</button>
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="relative overflow-hidden rounded-[6px]" style={{ background: '#1f1e1c', aspectRatio: `${brick.photo.width} / ${brick.photo.height}` }}>
            <Photo src={brick.photo.url} className="h-full w-full object-cover" />
            {regions && brick.regions.map(r => {
              const on = hl !== null && (r.measurement_ids.includes(hl) || r.label === hl)
              const [x1, y1, x2, y2] = r.box_1000
              return (
                <div key={r.label} className="absolute" title={`${r.label} · ${r.measurement_ids.join(', ')}`}
                  style={{ left: `${x1 / 10}%`, top: `${y1 / 10}%`, width: `${(x2 - x1) / 10}%`, height: `${(y2 - y1) / 10}%`, border: `${on ? 2 : 1}px solid var(--accent)`, background: on ? 'rgba(200,80,42,0.18)' : 'transparent' }}>
                  <span className="mono absolute left-0 top-0 px-1 text-[10px]" style={{ background: 'var(--accent)', color: '#fff' }}>{r.measurement_ids.join(' ')}</span>
                </div>
              )
            })}
          </div>
          {brick.credit && <p className="mt-2 text-[12px]">{brick.credit}</p>}
          <p className="mono ink-2 mt-2 text-[11px]">{brick.model.id} · effort {brick.model.effort} · {(brick.model.latency_ms / 1000).toFixed(1)} s · {brick.model.input_tokens} in / {brick.model.output_tokens} out{brick.prompt_version ? ` · prompt ${brick.prompt_version}` : ''}</p>
        </div>

        <div className="flex flex-col gap-4">
          <section className="panel p-3">
            <h2 className="mb-2 text-[13px] font-semibold">Measurements</h2>
            <ol className="space-y-2">
              {brick.measurements.map(m => (
                <li key={m.id} id={m.id} onMouseEnter={() => setHl(m.id)} onMouseLeave={() => setHl(h => h === m.id ? null : h)}
                  className={`rounded px-2 py-1 ${hl === m.id ? 'bg-[rgba(200,80,42,0.08)]' : ''}`}>
                  <div className="flex items-baseline gap-2"><span className="mono ink-2">{m.id}</span><span>{m.statement}</span></div>
                  <div className="mono mt-0.5 pl-8">{m.value}</div>
                  <div className="ink-2 pl-8 text-[12px]">{m.how_measured}</div>
                </li>
              ))}
            </ol>
          </section>

          {(() => { const tf = typeFamilyOf(brick); return tf ? (
            <section className="panel p-3">
              <h2 className="mb-1 text-[13px] font-semibold">Letterforms</h2>
              <p className="text-[12px]"><span className="ink-2">Described in </span><a href={`#${tf.source?.measurementIds?.[0]}`} className="mono">{tf.source?.measurementIds?.[0]}</a><span className="ink-2">, mapped to </span><span className="mono">{String(tf.value)}</span></p>
              <p className="mt-1 text-[11px]"><span className="chip chip-adapted">adapted · by rule</span> <span className="ink-2">no font name reported; the stack is the shell's substitute for the description.</span></p>
            </section>
          ) : null })()}
          <section className="panel p-3">
            <h2 className="mb-2 text-[13px] font-semibold">Transferable relations</h2>
            <ol className="space-y-2">
              {relations.map(r => {
                const prov = provenanceOf(brick, r)
                const value = r.parameter === 'none' ? null : proposeValue(r.parameter as ParameterKey, r)
                // C4′: where the rule would land on the shell (every other parameter at its default); the footnote is the first measurement it rests on
                const lands = value === null ? null : landsOn(r.parameter as ParameterKey, { ...DEFAULT_PARAMS, [r.parameter]: value })
                const first = brick.measurements.find(m => m.id === prov.measurementIds[0])
                return (
                  <li key={r.id} id={r.id} className="rounded px-2 py-1" onMouseEnter={() => setHl(prov.measurementIds[0] ?? null)} onMouseLeave={() => setHl(null)}>
                    <div className="flex items-baseline gap-2"><span className="mono ink-2">{r.id}</span><span>{r.rule}{lands && ` → ${lands}`}</span></div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 pl-8 text-[12px]">
                      {r.parameter === 'none'
                        ? <span className="chip chip-adapted">no slot</span>
                        : <span className="chip chip-measured"><span className="mono">{r.parameter}</span>{value !== null && <span className="mono">= {String(value)}</span>}</span>}
                      {r.parameter !== 'none' && value === null && <span className="ink-2">no value could be read from the rule</span>}
                      <span className="ink-2">from <a href={`#${r.source_hypothesis}`} className="mono">{r.source_hypothesis}</a> · {prov.provenance}</span>
                      {first && <span className="mono ink-2 min-w-0 break-words">{footnoteFor(first)}</span>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="panel p-3" style={{ opacity: 0.85 }}>
            <h2 className="mb-2 text-[13px] font-semibold">Hypotheses</h2>
            <ol className="space-y-2">
              {brick.hypotheses.map(h => {
                const dangling = h.rests_on.filter(x => !mIds.has(x))
                return (
                  <li key={h.id} id={h.id} className="rounded px-2 py-1">
                    <div className="flex items-baseline gap-2"><span className="mono ink-2">{h.id}</span><span>{h.statement}</span></div>
                    <div className="mt-1 flex items-center gap-2 pl-8 text-[12px]">
                      <span className="inline-block h-1 w-24 overflow-hidden rounded" style={{ background: 'var(--line)' }}><span className="block h-full" style={{ width: `${Math.round(h.confidence * 100)}%`, background: 'var(--ink-2)' }} /></span>
                      <span className="mono ink-2">{Math.round(h.confidence * 100)}%</span>
                      <span className="ink-2">rests on {h.rests_on.length ? h.rests_on.map(x => <a key={x} href={`#${x}`} className="mono mr-1" style={mIds.has(x) ? undefined : { color: 'var(--accent)' }}>{x}</a>) : <span style={{ color: 'var(--accent)' }}>nothing</span>}</span>
                      {(dangling.length > 0 || h.rests_on.length === 0) && <span style={{ color: 'var(--accent)' }}>no support</span>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="panel p-3">
            <h2 className="mb-1 text-[13px] font-semibold">Fragile if changed</h2>
            <blockquote className="m-0 border-l-2 pl-3 italic" style={{ borderColor: 'var(--accent)' }}>{brick.fragile_if_changed}</blockquote>
          </section>

          <footer className="flex items-center gap-2">
            <button type="button" className="btn btn-accent" onClick={() => navigate(`/projects?brick=${brick.id}`)}>Use in a project →</button>
            <button type="button" className="btn btn-quiet" onClick={() => { if (confirm(`Remove ${brick.id}? Projects using it lose its parameters and unexpressed items.`)) { store.removeBrick(brick.id); navigate('/') } }}>Remove</button>
          </footer>
        </div>
      </div>
    </div>
  )
}
