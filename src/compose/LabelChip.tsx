import type { ShortLabel } from '../lib/shortLabels'

/** 15_SIMPLIFY §4: a short label with its one provenance glyph. The glyph has no word; hovering it shows the provenance tooltip, and screen readers get the same words. */
export function LabelChip({ l, className = '' }: { l: ShortLabel; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] ${className}`}>
      <span className="glyph ink-2" title={l.tip} aria-label={l.tip} role="img">{l.glyph}</span>
      <span>{l.label}</span>
    </span>
  )
}
