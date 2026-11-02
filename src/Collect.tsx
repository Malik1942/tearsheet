import { useState } from 'react'
import { useStore } from './lib/store'
import { ACCEPT, extractBrick, prepareImage } from './lib/client'
import { BrickCard } from './bricks/BrickCard'

type Job = { name: string; state: 'preparing' | 'extracting' | 'done' | 'failed'; note?: string }

/** Collect: drop photos whenever you like them. Each is extracted once; no project needs to exist. */
export function CollectPage() {
  const store = useStore()
  const [jobs, setJobs] = useState<Job[]>([])
  const [dry, setDry] = useState(false)
  const setJob = (i: number, patch: Partial<Job>) => setJobs(js => js.map((j, k) => k === i ? { ...j, ...patch } : j))

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    const start = jobs.length
    setJobs(js => [...js, ...Array.from(files).map(f => ({ name: f.name, state: 'preparing' as const }))])
    for (let i = 0; i < files.length; i++) {
      const idx = start + i
      try {
        const prepared = await prepareImage(files[i])
        setJob(idx, { state: 'extracting', note: `${prepared.width}x${prepared.height}` })
        const { brick, result } = await extractBrick(prepared, dry)
        if ('dry' in result) { setJob(idx, { state: 'done', note: 'dry run: request built, nothing sent (see console)' }); console.info('dry-run request', result.request); continue }
        if (!result.ok || !brick) { setJob(idx, { state: 'failed', note: result.ok ? 'no brick' : result.error }); continue }
        store.addBrick(brick)
        setJob(idx, { state: 'done', note: `${(result.latency_ms / 1000).toFixed(1)} s · ${result.usage.input_tokens} in / ${result.usage.output_tokens} out${result.retried ? ' · retried at a higher cap' : ''}` })
      } catch (e) {
        setJob(idx, { state: 'failed', note: (e as Error).message })
      }
    }
  }

  return (
    <div className="p-4">
      <div className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center gap-3 rounded-lg border-2 border-dashed border-stone-400 bg-white p-4"
        onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files) }}>
        <div className="flex-1">
          <div className="text-sm font-semibold">Drop a photo of something you like</div>
          <div className="text-[12px] text-stone-600">It is made upright, downscaled to 2048 px and sent once to Muse Spark with the product-agnostic prompt. The brick persists in this browser. No product needs to exist yet.</div>
        </div>
        <label className="cursor-pointer rounded bg-stone-800 px-3 py-1.5 text-sm text-white">Choose photos<input type="file" accept={ACCEPT} multiple className="hidden" onChange={e => onFiles(e.target.files)} /></label>
        <label className="flex items-center gap-1 text-[11px] text-stone-500"><input type="checkbox" checked={dry} onChange={e => setDry(e.target.checked)} /> dry run (build the request, send nothing)</label>
      </div>
      {jobs.length > 0 && (
        <ul className="mx-auto mb-4 max-w-5xl space-y-1 text-[12px]">
          {jobs.map((j, i) => <li key={i} className={j.state === 'failed' ? 'text-rose-700' : 'text-stone-700'}><b>{j.name}</b>: {j.state}{j.note ? ` · ${j.note}` : ''}</li>)}
        </ul>
      )}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {store.bricks.map(b => (
          <BrickCard key={b.id} brick={b} actions={<button type="button" onClick={() => confirm(`Remove ${b.id}? Projects using it lose its parameters and unexpressed items.`) && store.removeBrick(b.id)} className="rounded border border-stone-300 px-2 py-0.5 text-[11px] hover:bg-rose-50">Remove</button>} />
        ))}
      </div>
    </div>
  )
}
