import { useEffect, useState, type ReactNode } from 'react'
import { useStore } from '../lib/store'
import { Link, navigate } from '../lib/router'
import { Photo } from '../bricks/Photo'
import { Reseau } from '../bricks/Reseau'
import { proposeValue, provenanceOf, titleLedReadings, typeFamilyOf } from '../lib/mapRelations'
import { footnoteFor, footnoteMeasurement, landsOn } from '../lib/landing'
import { shortLabel } from '../lib/shortLabels'
import { DEFAULT_PARAMS, type ParameterKey } from '../shell/params'
import { MiniPreview } from '../shell/MiniPreview'
import { brickParams } from '../lib/brickPreview'
import { originLabel } from '../lib/brickLabels'
import { originOf } from '../lib/starters'
import { retryBlocked } from '../lib/queue'
import { useFrameIds } from '../lib/useFrameIds'
import type { Brick, Region, Relation } from '../lib/types'
import { RETRY_TITLE } from '../bricks/retryCopy'

/** A starter ships with Tearsheet: it cannot be removed, only hidden. */
const STARTER_KEEP = 'Starters ship with Tearsheet; hide them with Include starters in ⋯.'

const COPY = {
  onScreens: 'On your screens: ',
  exact: 'The exact rules',
  carries: 'What this photo carries',
}

/** Measured drawing: what the photo has, in words, when the short-label table has nothing for the value (a middle value says nothing short). */
const PLAIN: Record<ParameterKey, string> = {
  type_scale_ratio: 'Type sizes', hierarchy_mode: 'What leads', image_text_dominance: 'Image size', density: 'Spacing', grouping: 'Grouping', alignment_edge: 'Alignment',
  rhythm: 'Rhythm', accent_placement: 'Where the accent goes', accent_coverage: 'How much accent', palette_hue_count: 'Number of colors',
  color_bg: 'Background color', color_fg: 'Text color', color_accent: 'Accent color', radius: 'Corners', type_family: 'Typeface', spacing_unit: 'Spacing step',
}

/** "Artist names lead…" reads on after "On your screens:" as "artist names lead…"; a sentence that opens with a quote or a capitalized name keeps it. */
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)

/** One rule read the way the Brick screen reads it: the value it sets (read off the rule, or a dominant title said in words), the readings beside it,
 *  and where it would land on the shell (C4′: every other parameter at its default, or at this rule's other readings). */
function readRelation(brick: Brick, r: Relation, accentSet: boolean | undefined) {
  const prov = provenanceOf(brick, r)
  const read = r.parameter === 'none' ? null : proposeValue(r.parameter as ParameterKey, r)
  const byRule = titleLedReadings(brick, r).filter(c => read === null || c.key !== r.parameter)
  const ruleOwn = read === null ? byRule.find(c => c.key === r.parameter) : undefined
  const value = read ?? ruleOwn?.value ?? null
  const siblings = byRule.filter(c => c.key !== r.parameter)
  const lands = value === null ? null : landsOn(r.parameter as ParameterKey, { ...DEFAULT_PARAMS, accent_set: accentSet, ...Object.fromEntries(siblings.map(c => [c.key, c.value])), [r.parameter]: value })
  return { prov, value, siblings, byRule, lands, cites: footnoteMeasurement(brick, prov.measurementIds)?.id ?? null }
}

/** The plain reading's lines, one per rule that sets something: its tag (the measurement it rests on, else the rule's own id), what the photo has, where it lands. */
function readingLines(brick: Brick) {
  const accentSet = brickParams(brick).params.accent_set
  return brick.relations.filter(r => r.parameter !== 'none').flatMap(r => {
    const x = readRelation(brick, r, accentSet)
    if (x.value === null || !x.lands) return []
    const key = r.parameter as ParameterKey
    return [{ id: r.id, tag: x.cites ?? r.id, has: shortLabel(key, x.value) ?? PLAIN[key], lands: x.lands }]
  })
}

/** Regions whose boxes coincide (each side within 1% of the frame) are drawn as one box carrying all their ids, so no tag hides under another. */
function mergeCoinciding(regions: Region[]): Region[] {
  const out: Region[] = []
  for (const r of regions) {
    const same = out.find(o => o.box_1000.every((v, i) => Math.abs(v - r.box_1000[i]) <= 10))
    if (same) { same.measurement_ids = [...new Set([...same.measurement_ids, ...r.measurement_ids])]; same.label = `${same.label} · ${r.label}` }
    else out.push({ ...r, measurement_ids: [...r.measurement_ids] })
  }
  return out
}

/** Measured drawing (Details): the plain reading under the measured photo, one line per rule that sets something. The tag is the measurement it rests on, the same id
 *  the box on the photo carries (the rule's own id when it cites none); then what the photo has, in a short label; then where it lands on your screens. */
export function PlainReading({ brick, onPoint }: { brick: Brick; onPoint?: (id: string | null) => void }) {
  const lines = readingLines(brick)
  if (lines.length === 0) return null
  return (
    <ul className="reading-lines" aria-label={COPY.carries}>
      {lines.map(l => (
        <li key={l.id} className="reading-line" onMouseEnter={() => onPoint?.(l.tag)} onMouseLeave={() => onPoint?.(null)}>
          <span className="idtag">{l.tag}</span>
          <div><b>{l.has}</b><span className="to">{COPY.onScreens}{lowerFirst(l.lands)}</span></div>
        </li>
      ))}
    </ul>
  )
}

/** Brick screen (spec v3 B2, B3): the `/brick/:id` route, which provenance chips and the Brick sheet's labels link to (`#m3`). Its body is `BrickDetails`, the same one the Library's Brick sheet folds under `The exact rules ▸`. */
export function BrickScreen({ id }: { id: string }) {
  const store = useStore()
  const brick = store.bricks.find(b => b.id === id)
  if (!brick) return <div className="chrome min-h-full p-4"><Link href="/" className="ink-2 text-[12px]">← Library</Link><p className="mt-4 ink-2">No brick with id {id}.</p></div>
  return <div className="chrome min-h-full"><BrickDetails key={brick.id} brick={brick} /></div>
}

/** One brick in full (spec v3 B2, B3), as a measured drawing (2026-11-04): the photo on the 0–1000 réseau with the regions its rules rest on boxed and tagged; under it the plain
 *  reading (what the photo has, then on your screens); a mini-preview of the List screen made from this brick alone; then, folded under `The exact rules`, the transferable relations
 *  (rule → where it would land, `none` last as `no slot`), the measurements they rest on, the letterforms, the hypotheses and the fragile sentence. Every item has an id anchor
 *  (#m3, #h2, #r1) so a provenance chip anywhere can land here; a link to one opens the fold. `page`: the route's two columns, photo left. `sheet` (15_SIMPLIFY §2): one column
 *  for the Brick sheet; the sheet's photo, then `summary` (the plain reading and the primary), then, while `open`, the exact rules. */
export function BrickDetails({ brick, variant = 'page', open = true, summary, onRemoved }: { brick: Brick; variant?: 'page' | 'sheet'; open?: boolean; summary?: ReactNode; onRemoved?: () => void }) {
  const store = useStore()
  const frame = useFrameIds().get(brick.id)
  const page = variant === 'page'
  const [regions, setRegions] = useState(true)
  const [hl, setHl] = useState<string | null>(null)
  const target = page && typeof location !== 'undefined' ? location.hash.slice(1) : ''
  const [exact, setExact] = useState(() => page && target !== '')   // a link to #m3 lands inside the fold, so the fold opens
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
  /* the measured drawing: the réseau and, whenever regions are on, the regions the plain reading's lines rest on, so the photo and the lines carry the same ids;
     a measurement pointed at (a line, or one in the exact rules) lights its box */
  const tags = new Set(read ? readingLines(brick).map(l => l.tag) : [])
  const drawn = read && regions ? mergeCoinciding(brick.regions.filter(r => r.measurement_ids.some(id => tags.has(id)) || (hl !== null && (r.measurement_ids.includes(hl) || r.label === hl)))) : []
  const ratio = brick.photo.width / brick.photo.height
  const fold = page ? exact : open

  /* the route's own header: the frame id, the origin line (with the version), and the regions toggle */
  const toolbar = (
    <div className="flex items-center gap-3">
      <span className="ink-2 min-w-0 flex-1 truncate" title={brick.id}><span className="mono">{frame ?? brick.id}</span> · {originLabel(brick)}{(brick.version ?? 1) > 1 ? ` · v${brick.version}` : ''}</span>
      {read && brick.regions.length > 0 && <button type="button" className={`btn shrink-0 ${regions ? '' : 'btn-quiet'}`} aria-pressed={regions} onClick={() => setRegions(v => !v)}>Regions {regions ? 'on' : 'off'}</button>}
    </div>
  )
  const photo = (
    <div className={`relative overflow-hidden ${page ? 'rounded-[6px]' : 'sheet-photo mx-auto'}`} style={{ background: page ? '#1f1e1c' : 'var(--paper)', aspectRatio: `${brick.photo.width} / ${brick.photo.height}`, ...(page ? {} : { width: `min(calc(100% - 32px), calc(46dvh * ${ratio}))` }) }}>
      <Photo src={brick.photo.url} className="h-full w-full object-cover" />
      {read && regions && <Reseau small={!page} />}
      {drawn.map((r, i) => {
        const on = hl !== null && (r.measurement_ids.includes(hl) || r.label === hl)
        const [x1, y1, x2, y2] = r.box_1000
        // a tag whose corner lands on an earlier box's tag (within 6% of the photo either way) moves to its box's bottom corner, so no tag hides another
        const below = drawn.slice(0, i).some(o => Math.abs(o.box_1000[0] - x1) < 60 && Math.abs(o.box_1000[1] - y1) < 60)
        return (
          <div key={r.label} className={`region ${on ? 'is-on' : ''}`} title={`${r.label} · ${r.measurement_ids.join(', ')}`}
            style={{ left: `${x1 / 10}%`, top: `${y1 / 10}%`, width: `${(x2 - x1) / 10}%`, height: `${(y2 - y1) / 10}%` }}>
            <span className={`idtag ${below ? 'below' : ''}`}>{r.measurement_ids.join(' ')}</span>
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

  /* the exact rules: verbatim, with every m and r id as a tag */
  const lists = read ? (
    <>
          <section className="panel p-3">
            <h2 className="mb-2 text-[13px] font-semibold">Transferable relations</h2>
            <ol className="space-y-2">
              {relations.map(r => {
                const { prov, value, siblings, byRule, lands } = readRelation(brick, r, mini.params.accent_set)
                const note = footnoteFor(brick, prov.measurementIds)
                return (
                  <li key={r.id} id={r.id} className="rounded px-2 py-1" onMouseEnter={() => setHl(footnoteMeasurement(brick, prov.measurementIds)?.id ?? null)} onMouseLeave={() => setHl(null)}>
                    <div className="flex items-baseline gap-2"><span className="idtag">{r.id}</span><span>{r.rule}{lands && ` → ${lands}`}</span></div>
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
                  className="rounded px-2 py-1" style={hl === m.id ? { background: 'color-mix(in oklab, var(--trace) 8%, transparent)' } : undefined}>
                  <div className="flex items-baseline gap-2"><span className="idtag">{m.id}</span><span>{m.statement}</span></div>
                  <div className="mono mt-0.5 pl-8">{m.value}</div>
                  <div className="ink-2 pl-8 text-[12px]">{m.how_measured}</div>
                </li>
              ))}
            </ol>
          </section>

          {(() => { const tf = typeFamilyOf(brick); return tf ? (
            <section className="panel p-3">
              <h2 className="mb-1 text-[13px] font-semibold">Letterforms</h2>
              <p className="text-[12px]"><span className="ink-2">Described in </span><a href={`#${tf.source?.measurementIds?.[0]}`} className="idtag">{tf.source?.measurementIds?.[0]}</a><span className="ink-2">, mapped to </span><span className="mono">{String(tf.value)}</span></p>
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
                      <span className="ink-2 min-w-0 [overflow-wrap:anywhere]">rests on {h.rests_on.length ? h.rests_on.map(x => mIds.has(x)
                        ? <a key={x} href={`#${x}`} className="idtag mr-1">{x}</a>
                        : <span key={x} className="mono mr-1" style={{ color: 'var(--ink)', fontWeight: 600 }}>{x}</span>) : <span style={{ color: 'var(--ink)', fontWeight: 600 }}>nothing</span>}</span>
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
      <div className="flex flex-col gap-4">
        {read && <PlainReading brick={brick} onPoint={setHl} />}
        {read && <div><MiniPreview params={mini.params} width={160} badge={mini.unexpressed} /></div>}
        {read && <button type="button" className="btn btn-quiet exact-toggle" aria-expanded={fold} aria-controls={`exact-${brick.id}`} onClick={() => setExact(v => !v)}>{COPY.exact} {fold ? '▾' : '▸'}</button>}
        {fold && <div id={`exact-${brick.id}`} className="flex flex-col gap-4">{lists}</div>}
        {footer}
      </div>
    </div>
  )
  return (
    <div>
      <div style={{ background: '#1f1e1c' }}>{photo}</div>
      {summary}
      {fold && <div id={`details-${brick.id}`} className="flex flex-col gap-4 px-6 pb-8">{toolbar}{meta}{read && <div><MiniPreview params={mini.params} width={160} badge={mini.unexpressed} /></div>}{lists}{footer}</div>}
    </div>
  )
}
