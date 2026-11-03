/** What the dev validation page (/dev/pixels) may say about a run (spec §1b validation steps 1 and 2). Pure.
 *  A result is claimed only when it exists: "every repeat identical" and "no brick flagged" need every row measured. A difference or a flag is reported as soon as it is seen. */
import { COVERAGE_BAND_LABELS, coverageBand, fieldsEqualTo2dp, type PixelFields } from './pixels'

export type ReportRow = { state: 'waiting' | 'measuring' | 'done' | 'error'; first?: PixelFields; second?: PixelFields; wb?: PixelFields; jpeg?: PixelFields }

/** Step 2: what a re-saved copy changed against the original, as readable lines: the hue count, or the coverage band. */
export function flagsOf(o: PixelFields, variants: [string, PixelFields | undefined][]): string[] {
  const out: string[] = []
  for (const [name, v] of variants) {
    if (!v) continue
    if (v.hue_count !== o.hue_count) out.push(`${name}: hue_count ${o.hue_count} → ${v.hue_count}`)
    const [bo, bv] = [coverageBand(o.high_chroma_coverage), coverageBand(v.high_chroma_coverage)]
    if (bo !== bv) out.push(`${name}: coverage band ${COVERAGE_BAND_LABELS[bo]} → ${COVERAGE_BAND_LABELS[bv]}`)
  }
  return out
}

export type Summary = {
  total: number; done: number; errors: number; notIdentical: number; flagged: number
  step1: string; step2: string; line: string
}

export function summarize(rows: ReportRow[]): Summary {
  const total = rows.length
  const done = rows.filter(r => r.state === 'done').length
  const errors = rows.filter(r => r.state === 'error').length
  const running = rows.some(r => r.state === 'waiting' || r.state === 'measuring')
  const notIdentical = rows.filter(r => r.first && r.second && !fieldsEqualTo2dp(r.first, r.second)).length
  const flagged = rows.filter(r => r.first && flagsOf(r.first, [['wb', r.wb], ['jpeg', r.jpeg]]).length > 0).length
  const allDone = total > 0 && done === total
  // A finding is reported when it is there; a clean result only when every row is done; otherwise the run is still going, or it ended with a row that failed.
  const open = running || total === 0 ? 'pending' : 'incomplete'
  const step1 = notIdentical > 0 ? `${notIdentical} not identical` : allDone ? 'every repeat identical' : open
  const step2 = flagged > 0 ? `${flagged} flagged` : allDone ? 'no brick flagged' : open
  return { total, done, errors, notIdentical, flagged, step1, step2, line: `${done} of ${total} measured · ${errors} ${errors === 1 ? 'error' : 'errors'} · step 1: ${step1} · step 2: ${step2}` }
}
