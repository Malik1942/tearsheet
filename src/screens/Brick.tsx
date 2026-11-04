import { useEffect, useState, type ReactNode } from 'react'
import { useStore } from '../lib/store'
import { Link, navigate } from '../lib/router'
import { Photo } from '../bricks/Photo'
import { proposeValue, provenanceOf, titleLedReadings, typeFamilyOf } from '../lib/mapRelations'
import { footnoteFor, footnoteMeasurement, landsOn } from '../lib/landing'
import { DEFAULT_PARAMS, type ParameterKey } from '../shell/params'
import { MiniPreview } from '../shell/MiniPreview'
import { brickParams } from '../lib/brickPreview'
import { originLabel } from '../lib/brickLabels'
import { originOf } from '../lib/starters'
import { retryBlocked } from '../lib/queue'
import type { Brick } from '../lib/types'
import { RETRY_TITLE } from '../bricks/retryCopy'

/** A starter ships with Tearsheet: it cannot be removed, only hidden. */
const STARTER_KEEP = 'Starters ship with Tearsheet; hide them with Include starters in ⋯.'

/** Brick screen (spec v3 B2, B3): the `/brick/:id` route, which provenance chips and the Brick sheet's labels link to (`#m3`). Its body is `BrickDetails`, the same one the Library's Brick sheet folds under `Details ▸`. */
export function BrickScreen({ id }: { id: string }) {
  const store = useStore()
  const brick = store.bricks.find(b => b.id === id)
  if (!brick) return <div className="chrome min-h-full p-4"><Link href="/" className="ink-2 text-[12px]">← Library</Link><p className="mt-4 ink-2">No brick with id {id}.</p></div>
  return <div className="chrome min-h-full"><BrickDetails key={brick.id} brick={brick} /></div>
}

/** One brick in full (spec v3 B2, B3): one photo; a mini-preview of the List screen made from this brick alone (its three parameters, its own skin, the shell's defaults for the rest),
 *  then the transferable relations (rule → where it would land, `none` last as `no slot`), the measurements they rest on, the letterform description,
 *  the hypotheses, and the fragile sentence. Every item has an id anchor (#m3, #h2, #r1) so a provenance chip anywhere can land here.
 *  `page`: the route's two columns, photo left. `sheet` (15_SIMPLIFY §2): one column for the Brick sheet; the sheet's own photo, then `summary` (what it carries, the primary),
 *  then, while `open`, everything below and the region boxes on that photo. The content is the same either way. */
export function BrickDetails({ brick, variant = 'page', open = true, summary, onRemoved }: { brick: Brick; variant?: 'page' | 'sheet'; open?: boolean; summary?: ReactNode; onRemoved?: () => void }) {
  const store = useStore()
  const page = variant === 'page'
  const [regions, setRegions] = useState(true)
  const [hl, setHl] = useState<string | null>(null)
  const target = page && typeof location !== 'undefined' ? location.hash.slice(1) : ''
  useEffect(() => {
    if (!target) return
    const el = document.getElementById(target)
    if (el) { el.scrollIntoView({ block: 'center' }); setHl(target) }
  }, [target, brick.id])

  const mIds = new Set(brick.measurements.map(m => m.id))
  const relations = [...brick.relations].sort((a, b) => (a.parameter === 'none' ? 1 : 0) - (b.parameter === 'none' ? 1 : 0))
  const mini = brickParams(brick)
  const starter = originOf(brick) === 'starter'
  const status = brick.status ?? 'ready'
  /** A brick that was never read (failed, or still waiting) has no lists to show: only its line, its note and Remove. */
  const read = status === 'ready'
  const blocked = retryBlocked(brick)
  const remove = () => { if (confirm(`Remove ${brick.id}? Projects using it lose its parameters and unexpressed items.`)) { store.removeBrick(brick.id); if (onRemoved) onRemoved(); else navigate('/') } }
  const boxes = open && regions
  const ratio = brick.photo.width / brick.photo.height

  /* was the route's own header: the id, the origin line (with the version, which the old Library card showed), and the regions toggle */
  const toolbar = (
    <div className="flex items-center gap-3">
      <span className="ink-2 min-w-0 flex-1 truncate"><span className="mono">{brick.id}</span> · {originLabel(brick)}{(brick.version ?? 1) > 1 ? ` · v${brick.version}` : ''}</span>
      {brick.regions.length > 0 && <button type="button" className={`btn shrink-0 ${regions ? '' : 'btn-quiet'}`} onClick={() => setRegions(v => !v)}>Regions {regions ? 'on' : 'off'}</button>}
    </div>
  )
  const photo = (
    <div className={`relative overflow-hidden ${page ? 'rounded-[6px]' : 'mx-auto'}`} style={{ background: '#1f1e1c', aspectRatio: `${brick.photo.width} / ${brick.photo.height}`, ...(page ? {} : { width: `min(100%, calc(52dvh * ${ratio}))` }) }}>
      <Photo src={brick.photo.url} className="h-full w-full object-cover" />
      {boxes && brick.regions.map(r => {
        const on = hl !== null && (r.measurement_ids.includes(hl) || r.label === hl)
        const [x1, y1, x2, y2] = r.box_1000
        return (
          <div key={r.label} className="absolute" title={`${r.label} · ${r.measurement_ids.join(', ')}`}
            style={{ left: `${x1 / 10}%`, top: `${y1 / 10}%`, width: `${(x2 - x1) / 10}%`, height: `${(y2 - y1) / 10}%`, border: on ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.9)', boxShadow: on ? undefined : '0 0 0 1px rgba(0,0,0,0.35)', background: on ? 'rgba(200,80,42,0.18)' : 'transparent' }}>
            <span className="mono absolute left-0 top-0 px-1 text-[10px]" style={{ background: on ? 'var(--accent)' : 'var(--ink)', color: '#fff' }}>{r.measurement_ids.join(' ')}</span>
          </div>
        )
      })}
    </div>
  )
  const meta = (
    <div>
      {brick.title_original && <p className="mt-2 text-[12px]"><cite>{brick.title_original}</cite></p>}
      {brick.credit && <p className="mt-2 text-[12px]">{brick.credit}</p>}
      <p className="mono ink-2 mt-2 text-[11px]">{brick.model.id} · effort {brick.model.effort} · {(brick.model.latency_ms / 1000).toFixed(1)} s · {brick.model.input_tokens} in / {brick.model.output_tokens} out{brick.prompt_version ? ` · prompt ${brick.prompt_version}` : ''}</p>
    </div>
  )
  /* the failed card's controls (Try again, Remove, the error note) now live here; on the route `Use in Make` is the primary, in the sheet it sits above the fold */
  const footer = (
    <footer className="flex flex-wrap items-center gap-2">
      {page && read && <Link href={`/make?brick=${encodeURIComponent(brick.id)}`} className="btn btn-accent no-underline">Use in Make</Link>}
      {page && status === 'unparsed' && <button type="button" className="btn btn-accent" onClick={() => store.retry(brick.id)} disabled={blocked !== null} title={RETRY_TITLE[blocked ?? 'ok']}>Try again</button>}
      <button type="button" className="btn btn-quiet" disabled={starter} title={starter ? STARTER_KEEP : undefined} onClick={remove}>Remove</button>
      {brick.error && <span className="ink-2 min-w-0 text-[11px] [overflow-wrap:anywhere]">{brick.error}</span>}
    </footer>
  )

  const lists = read ? (
    <>
          <div><MiniPreview params={mini.params} width={160} badge={mini.unexpressed} /></div>
          <section className="panel p-3">
            <h2 className="mb-2 text-[13px] font-semibold">Transferable relations</h2>
            <ol className="space-y-2">
              {relations.map(r => {
                const prov = provenanceOf(brick, r)
                const read = r.parameter === 'none' ? null : proposeValue(r.parameter as ParameterKey, r)
                // a dominant title said in words: the rule table's readings, the one for this parameter when nothing could be read off the rule, the others beside it
                const byRule = titleLedReadings(brick, r).filter(c => read === null || c.key !== r.parameter)
                const ruleOwn = read === null ? byRule.find(c => c.key === r.parameter) : undefined
                const value = read ?? ruleOwn?.value ?? null
                const siblings = byRule.filter(c => c.key !== r.parameter)
                // C4′: where the rule would land on the shell (every other parameter at its default, or at this rule's other readings); the footnote is the same helper the Sheet uses, and hovering highlights the measurement it cites
                const lands = value === null ? null : landsOn(r.parameter as ParameterKey, { ...DEFAULT_PARAMS, accent_set: mini.params.accent_set, ...Object.fromEntries(siblings.map(c => [c.key, c.value])), [r.parameter]: value })
                const note = footnoteFor(brick, prov.measurementIds)
                return (
                  <li key={r.id} id={r.id} className="rounded px-2 py-1" onMouseEnter={() => setHl(footnoteMeasurement(brick, prov.measurementIds)?.id ?? null)} onMouseLeave={() => setHl(null)}>
                    <div className="flex items-baseline gap-2"><span className="mono ink-2">{r.id}</span><span>{r.rule}{lands && ` → ${lands}`}</span></div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 pl-8 text-[12px]">
                      {r.parameter === 'none'
                        ? <span className="chip chip-adapted">no slot</span>
                        : <span className="chip chip-measured"><span className="mono">{r.parameter}</span>{value !== null && <span className="mono">= {String(value)}</span>}</span>}
                      {siblings.map(c => <span key={c.key} className="chip chip-measured"><span className="mono">{c.key}</span><span className="mono">= {String(c.value)}</span></span>)}
                      {byRule.length > 0 && <span className="chip chip-adapted" title={byRule[0].source?.note}>adapted · by rule</span>}
                      {r.parameter !== 'none' && value === null && <span className="ink-2">no value could be read from the rule</span>}
                      <span className="ink-2">from <a href={`#${r.source_hypothesis}`} className="mono">{r.source_hypothesis}</a> · {prov.provenance}</span>
                      {note && <span className="mono ink-2 min-w-0 max-w-full truncate" title={note}>{note}</span>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

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

          <section className="panel p-3" style={{ opacity: 0.85 }}>
            <h2 className="mb-2 text-[13px] font-semibold">Hypotheses</h2>
            <ol className="space-y-2">
              {brick.hypotheses.map(h => {
                const dangling = h.rests_on.filter(x => !mIds.has(x))
                return (
                  <li key={h.id} id={h.id} className="rounded px-2 py-1">
                    <div className="flex items-baseline gap-2"><span className="mono ink-2">{h.id}</span><span>{h.statement}</span></div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 pl-8 text-[12px]">
                      <span className="inline-block h-1 w-24 overflow-hidden rounded" style={{ background: 'var(--line)' }}><span className="block h-full" style={{ width: `${Math.round(h.confidence * 100)}%`, background: 'var(--ink-2)' }} /></span>
                      <span className="mono ink-2">{Math.round(h.confidence * 100)}%</span>
                      <span className="ink-2 min-w-0 [overflow-wrap:anywhere]">rests on {h.rests_on.length ? h.rests_on.map(x => <a key={x} href={`#${x}`} className="mono mr-1" style={mIds.has(x) ? undefined : { color: 'var(--ink)', fontWeight: 600 }}>{x}</a>) : <span style={{ color: 'var(--ink)', fontWeight: 600 }}>nothing</span>}</span>
                      {(dangling.length > 0 || h.rests_on.length === 0) && <span style={{ color: 'var(--ink)', fontWeight: 600 }}>no support</span>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="panel p-3">
            <h2 className="mb-1 text-[13px] font-semibold">Fragile if changed</h2>
            <blockquote className="m-0 border-l pl-3 italic" style={{ borderColor: 'var(--line)' }}>{brick.fragile_if_changed}</blockquote>
          </section>

    </>
  ) : null

  if (page) return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-2 lg:sticky lg:top-[72px] lg:self-start">{toolbar}{photo}{meta}</div>
      <div className="flex flex-col gap-4">{lists}{footer}</div>
    </div>
  )
  return (
    <div>
      <div style={{ background: '#1f1e1c' }}>{photo}</div>
      {summary}
      {open && <div id={`details-${brick.id}`} className="flex flex-col gap-4 px-6 pb-8">{toolbar}{meta}{lists}{footer}</div>}
    </div>
  )
}
