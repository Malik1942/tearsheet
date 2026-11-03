import { useEffect, useState } from 'react'
import { SAMPLES } from '../fixtures/samples'
import { Link } from '../lib/router'
import { COVERAGE_BAND_LABELS, MEASURE_VERSION, PX_PARAMS, coverageBand, fieldsEqualTo2dp, type PixelFields } from '../lib/pixels'
import { measurePhoto, measurePhotoVariant } from '../lib/pixelsBrowser'
import { deriveSkin } from '../lib/skinRule'

/** Dev only (/dev/pixels): spec §1b validation steps 1 and 2 on the sample library. Step 1: the same file measured twice must agree to two decimals.
 *  Step 2: a slight white-balance shift and a heavier JPEG re-save must not change hue_count or move coverage across a band edge.
 *  Step 3 (end-to-end on g2) is a person's check, after this. Nothing here replaces a sample skin: the colors are candidates and evidence. */

type Row = {
  id: string; url: string; state: 'waiting' | 'measuring' | 'done' | 'error'; error?: string
  first?: PixelFields; second?: PixelFields; wb?: PixelFields; jpeg?: PixelFields
}

const cell = 'border-b px-2 py-1 align-top text-left font-normal'
const head = 'border-b px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide ink-2'
const frac = (x: number) => x.toFixed(4)

function Sw({ hex }: { hex: string }) {
  return <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border hairline" style={{ background: hex }} /><span className="mono">{hex}</span></span>
}

function flagsOf(o: PixelFields, variants: [string, PixelFields | undefined][]): string[] {
  const out: string[] = []
  for (const [name, v] of variants) {
    if (!v) continue
    if (v.hue_count !== o.hue_count) out.push(`${name}: hue_count ${o.hue_count} → ${v.hue_count}`)
    const [bo, bv] = [coverageBand(o.high_chroma_coverage), coverageBand(v.high_chroma_coverage)]
    if (bo !== bv) out.push(`${name}: coverage band ${COVERAGE_BAND_LABELS[bo]} → ${COVERAGE_BAND_LABELS[bv]}`)
  }
  return out
}

export function DevPixels() {
  const [rows, setRows] = useState<Row[]>(() => SAMPLES.map(b => ({ id: b.id, url: b.photo.url, state: 'waiting' })))

  useEffect(() => {
    let dead = false
    const patch = (id: string, p: Partial<Row>) => { if (!dead) setRows(rs => rs.map(r => (r.id === id ? { ...r, ...p } : r))) }
    ;(async () => {
      for (const b of SAMPLES) {
        if (dead) return
        patch(b.id, { state: 'measuring' })
        try {
          const first = await measurePhoto(b.photo.url)
          const second = await measurePhoto(b.photo.url)
          patch(b.id, { first, second })
          const wb = await measurePhotoVariant(b.photo.url, 'white-balance')
          patch(b.id, { wb })
          const jpeg = await measurePhotoVariant(b.photo.url, 'jpeg-q50')
          patch(b.id, { jpeg, state: 'done' })
        } catch (e) {
          patch(b.id, { state: 'error', error: e instanceof Error ? e.message : String(e) })
        }
      }
    })()
    return () => { dead = true }
  }, [])

  const done = rows.filter(r => r.state === 'done').length
  const flagged = rows.filter(r => r.first && flagsOf(r.first, [['wb', r.wb], ['jpeg', r.jpeg]]).length > 0).length
  const notIdentical = rows.filter(r => r.first && r.second && !fieldsEqualTo2dp(r.first, r.second)).length

  return (
    <div className="chrome min-h-full p-4">
      <div className="mb-3 flex items-baseline gap-3">
        <h1>Pixel measurements · validation</h1>
        <span className="mono ink-2">{MEASURE_VERSION}</span>
        <Link href="/" className="ink-2">Library</Link>
      </div>
      <p className="mb-1 max-w-3xl ink-2">
        Spec §1b steps 1 and 2 on the sample library. A hex here refers to this normalized JPEG only: not the color of the wall, and not the color to use for a button.
        Distribution is measured; which place is the focal point is judged elsewhere. Photo contrast describes the photo; readability is checked on the interface pairs.
        Skins below are candidates by rule. Until step 3 passes, the sample library keeps its harness-measured skins.
      </p>
      <p className="mono mb-3 ink-2">{JSON.stringify(PX_PARAMS)} · white balance R×1.04 B×0.96 · JPEG re-encode quality 0.5 · bands {COVERAGE_BAND_LABELS.join(' ')}</p>
      <p className="mb-4">
        {done} of {rows.length} measured · step 1: {notIdentical === 0 ? 'every repeat identical' : `${notIdentical} not identical`} · step 2: {flagged === 0 ? 'no brick flagged' : `${flagged} flagged`}
      </p>

      <h2 className="mb-1">Step 1 repeatability, step 2 robustness</h2>
      <div className="mb-6 overflow-x-auto panel">
        <table className="w-full border-collapse text-[12px]">
          <thead><tr>
            <th className={head}>Brick</th><th className={head}>Size</th><th className={head}>Identical (2 dp)</th>
            <th className={head}>hue_count<br />orig · wb · jpeg</th><th className={head}>Coverage<br />orig · wb · jpeg</th><th className={head}>Band<br />orig · wb · jpeg</th><th className={head}>Flags</th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const o = r.first, flags = o ? flagsOf(o, [['wb', r.wb], ['jpeg', r.jpeg]]) : []
              const trio = (pick: (f: PixelFields) => string) => [o, r.wb, r.jpeg].map(f => (f ? pick(f) : '…')).join(' · ')
              return (
                <tr key={r.id}>
                  <td className={`${cell} mono`}>{r.id}</td>
                  <td className={`${cell} mono`}>{o ? `${o.width}×${o.height}` : r.state === 'error' ? '' : '…'}</td>
                  <td className={`${cell} mono`}>{o && r.second ? (fieldsEqualTo2dp(o, r.second) ? 'yes' : 'no') : r.state === 'error' ? '' : '…'}</td>
                  <td className={`${cell} mono`}>{trio(f => String(f.hue_count))}</td>
                  <td className={`${cell} mono`}>{trio(f => frac(f.high_chroma_coverage))}</td>
                  <td className={`${cell} mono`}>{trio(f => String(coverageBand(f.high_chroma_coverage)))}</td>
                  <td className={cell} style={flags.length || r.error ? { color: 'var(--accent)' } : undefined}>
                    {r.error ?? (flags.length ? flags.map(x => <div key={x}>{x}</div>) : r.state === 'done' ? 'stable' : '')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-1">Evidence and candidate skin</h2>
      <div className="overflow-x-auto panel">
        <table className="w-full border-collapse text-[12px]">
          <thead><tr>
            <th className={head}>Brick</th><th className={head}>Luminance shares</th><th className={head}>Hue clusters (hue · chroma · share)</th>
            <th className={head}>High chroma</th><th className={head}>Photo contrast<br />(descriptive)</th><th className={head}>Candidate skin (by rule)</th><th className={head}>Rules and readability checks</th><th className={head}>Harness skin (kept)</th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const f = r.first
              if (!f) return <tr key={r.id}><td className={`${cell} mono`}>{r.id}</td><td className={cell} colSpan={7}>{r.error ?? '…'}</td></tr>
              const skin = deriveSkin(f), harness = SAMPLES.find(b => b.id === r.id)?.skin_measured
              return (
                <tr key={r.id}>
                  <td className={`${cell} mono`}>{r.id}</td>
                  <td className={`${cell} mono`}>
                    <div>black {frac(f.luminance_shares.near_black)}</div><div>white {frac(f.luminance_shares.near_white)}</div><div>between {frac(f.luminance_shares.between)}</div>
                  </td>
                  <td className={cell}>
                    {f.hue_clusters.length === 0 && <span className="ink-2">none</span>}
                    {f.hue_clusters.map(c => <div key={c.hex + c.hue}><Sw hex={c.hex} /> <span className="mono ink-2">{c.hue}° · {c.chroma} · {frac(c.share)}</span></div>)}
                    <div className="mono ink-2">hue_count {f.hue_count} · chroma_ratio {f.chroma_ratio ?? 'null'}</div>
                  </td>
                  <td className={`${cell} mono`}>
                    <div>coverage {frac(f.high_chroma_coverage)}</div><div>components {f.high_chroma_components.count}</div><div>largest {frac(f.high_chroma_components.largest_component_share)}</div>
                  </td>
                  <td className={`${cell} mono`}>{f.photo_contrast ?? 'null'}</td>
                  <td className={cell}>
                    <div>base <Sw hex={skin.base} /></div><div>fg <Sw hex={skin.fg} /></div><div>accent {skin.accent ? <Sw hex={skin.accent} /> : <span className="ink-2">none</span>}</div>
                  </td>
                  <td className={cell}>
                    {skin.rules.map(x => <div key={x} className="ink-2">{x}</div>)}
                    {skin.checks.map(c => <div key={c.pair} className="mono" style={c.pass ? undefined : { color: 'var(--accent)' }}>{c.pair} {c.ratio}:1 {c.pass ? 'pass' : 'FAIL'}</div>)}
                  </td>
                  <td className={cell}>
                    {harness ? <><div>bg <Sw hex={harness.color_bg} /></div><div>fg <Sw hex={harness.color_fg} /></div><div>accent <Sw hex={harness.color_accent} /></div></> : <span className="ink-2">none</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
