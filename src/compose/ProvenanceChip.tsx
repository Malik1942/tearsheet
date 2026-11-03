import type { ParameterValue } from '../lib/types'

const COLORS: Record<ParameterValue['provenance'], string> = {
  measured: 'bg-emerald-50 text-emerald-900 border-emerald-500',
  interpreted: 'bg-amber-50 text-amber-900 border-amber-500 border-dotted',
  adapted: 'bg-stone-100 text-stone-600 border-stone-300',
}

/** One parameter value with its provenance class. Interpreted values get a dotted outline so the difference is visible at a glance. */
export function ProvenanceChip({ pv, onClick }: { pv: ParameterValue; onClick?: (pv: ParameterValue) => void }) {
  const MEANING = { measured: 'Read off the image by the model in this run; another run may differ.', interpreted: "The model's reading; rests on the measurements listed.", adapted: 'Set by you or by the shell.' }
  const title = [MEANING[pv.provenance], pv.source?.relationRule, pv.source?.note, pv.source?.measurementIds?.length ? `measurements: ${pv.source.measurementIds.join(', ')}` : ''].filter(Boolean).join('\n')
  return (
    <button type="button" onClick={() => onClick?.(pv)} title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 ${COLORS[pv.provenance]} ${onClick ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}>
      <span className="font-medium">{pv.key}</span>
      <span>= {String(pv.value)}</span>
      <span className="opacity-70">· {pv.provenance}</span>
      {pv.locked && <span aria-label="locked">🔒</span>}
    </button>
  )
}
