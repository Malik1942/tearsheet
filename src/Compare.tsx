import { useState } from 'react'
import bricksJson from './fixtures/bricks.json'
import { COMPOSITIONS } from './fixtures/compositions'
import { resolveParams } from './lib/mapRelations'
import type { Brick, ParameterValue } from './lib/types'
import { RELATIONSHIP_KEYS, SKIN_KEYS } from './shell/params'
import { Shell } from './shell/Shell'
import { ProvenanceChip } from './compose/ProvenanceChip'
import { UnexpressedStrip } from './compose/UnexpressedStrip'
import { Photo } from './bricks/Photo'

const BRICKS = bricksJson as unknown as Brick[]
const IDS = Object.keys(COMPOSITIONS)
/** Same colors, radius, type and spacing for every shell: what is left is the relationship parameters. */
const NEUTRAL = { color_bg: '#F4F2EE', color_fg: '#1B1B1B', color_accent: '#6B6B6B', radius: '8px', type_family: 'system-ui, -apple-system, "Segoe UI", sans-serif', spacing_unit: '8px' } as const

function Column({ slot, compId, onChange, showPhoto, screen, neutral }: { slot: number; compId: string; onChange: (id: string) => void; showPhoto: boolean; screen: 'list' | 'review'; neutral: boolean }) {
  const comp = COMPOSITIONS[compId]
  const brick = BRICKS.find(b => b.id === comp.brickIds[0])!
  const resolved = resolveParams(comp)
  const values = resolved.values
  const params = neutral ? { ...resolved.params, ...NEUTRAL } : resolved.params
  const [hl, setHl] = useState<ParameterValue | null>(null)
  const set = (pv: ParameterValue) => pv.provenance !== 'adapted' && pv.source?.regionLabels ? pv : null
  const regions = hl ? brick.regions.filter(r => hl.source?.regionLabels?.includes(r.label)) : []
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-stone-500">Shell {slot + 1}</span>
        <select className="rounded border border-stone-300 bg-white px-2 py-1 text-sm" value={compId} onChange={e => onChange(e.target.value)}>
          {IDS.map(id => <option key={id} value={id}>{COMPOSITIONS[id].title} ({id})</option>)}
        </select>
      </div>
      {showPhoto && (
        <div className="flex h-56 justify-center overflow-hidden rounded-md bg-stone-900">
          <div className="relative h-full" style={{ aspectRatio: `${brick.photo.width} / ${brick.photo.height}` }}>
            <Photo src={brick.photo.url} className="h-full w-full object-cover" />
            {regions.map(r => (
              <div key={r.label} className="absolute border-2 border-emerald-400 bg-emerald-300/20" title={r.label}
                style={{ left: `${r.box_1000[0] / 10}%`, top: `${r.box_1000[1] / 10}%`, width: `${(r.box_1000[2] - r.box_1000[0]) / 10}%`, height: `${(r.box_1000[3] - r.box_1000[1]) / 10}%` }} />
            ))}
            <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">saved {brick.saved_at}</div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {RELATIONSHIP_KEYS.map(k => <ProvenanceChip key={k} pv={values[k]} onClick={pv => setHl(set(pv) && hl?.key === pv.key ? null : set(pv))} />)}
      </div>
      <div className="flex flex-wrap gap-1 opacity-80">
        {SKIN_KEYS.map(k => <ProvenanceChip key={k} pv={values[k]} />)}
      </div>
      <UnexpressedStrip items={comp.unexpressed} />
      {comp.disabled.length > 0 && (
        <div className="text-[11px] text-stone-500">Switched off by hand: {comp.disabled.map(d => d.reason.split(':')[0]).join('; ')}</div>
      )}
      <div className="mx-auto w-[320px] max-w-full overflow-hidden rounded-[22px] border-[7px] border-stone-800 bg-stone-800 shadow-xl" style={{ height: 640 }}>
        <Shell params={params} screen={screen} height={626} />
      </div>
    </div>
  )
}

/** Step 2: three shells side by side, each next to its reference photo. Swap the assignment and see whether you can still tell which is which. */
export function Compare() {
  const [slots, setSlots] = useState<string[]>(['g1', 'g2', 'c1'])
  const [showPhoto, setShowPhoto] = useState(true)
  const [screen, setScreen] = useState<'list' | 'review'>('list')
  const [neutral, setNeutral] = useState(false)
  const rotate = () => setSlots(s => [s[1], s[2], s[0]])
  return (
    <div className="mx-auto max-w-[1600px] p-4">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Bricks · step 2: does the character survive?</h1>
        <span className="text-sm text-stone-500">Intent: {COMPOSITIONS.g1.intent}</span>
        <div className="ml-auto flex gap-2">
          <div className="flex overflow-hidden rounded border border-stone-400 text-sm">
            {(['list', 'review'] as const).map(s => (
              <button key={s} type="button" onClick={() => setScreen(s)} className={`px-3 py-1 ${screen === s ? 'bg-stone-800 text-white' : 'bg-white hover:bg-stone-100'}`}>{s === 'list' ? 'List' : 'Year review'}</button>
            ))}
          </div>
          <button type="button" onClick={rotate} className="rounded border border-stone-400 bg-white px-3 py-1 text-sm hover:bg-stone-100">Rotate assignments</button>
          <button type="button" onClick={() => setShowPhoto(v => !v)} className="rounded border border-stone-400 bg-white px-3 py-1 text-sm hover:bg-stone-100">{showPhoto ? 'Hide photos' : 'Show photos'}</button>
          <button type="button" onClick={() => setNeutral(v => !v)} title="Same colors, radius, type and spacing on every shell; only the relationship parameters differ" className={`rounded border px-3 py-1 text-sm ${neutral ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-400 bg-white hover:bg-stone-100'}`}>Neutral skin</button>
        </div>
      </header>
      <div className="flex gap-6">
        {slots.map((id, i) => <Column key={i} slot={i} compId={id} showPhoto={showPhoto} screen={screen} neutral={neutral} onChange={v => setSlots(s => s.map((x, j) => j === i ? v : x))} />)}
      </div>
    </div>
  )
}
