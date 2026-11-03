import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { Link, navigate } from '../lib/router'
import { Photo } from '../bricks/Photo'
import { propose, proposeEnabled } from '../lib/proposeClient'
import { orderOwnFirst, originOf, proposalPool } from '../lib/starters'
import { chipsFor, type Lean } from '../lib/lean'
import type { ChipId } from '../lib/leanFamilies'
import type { Proposal, ProposalPick } from '../lib/mapRelations'
import { brickParams } from '../lib/brickPreview'
import { INTENT_EXAMPLES, autoName, photoLine, pickLabel } from '../lib/makeFlow'
import { MiniPreview } from '../shell/MiniPreview'
import { LabelChip } from '../compose/LabelChip'
import { Fold, StepLine, StepPage, StepTitle } from '../make/Steps'
import type { Brick } from '../lib/types'

const MAX_BRICKS = 5
const COPY = {
  title: 'What are you making?',
  continue: 'Continue:',
  adjust: 'Adjust style',
  find: 'Find photos',
  findHint: 'One text call: your intent and the rules of your photos. No photo, no measurement leaves the device.',
  self: "I'll pick myself",
  finding: 'Looking through your photos…',
  picksTitle: 'We found these in your photos',
  manualTitle: 'Pick your photos',
  use: 'Use these',
  why: 'Why',
  swap: 'Swap this photo',
  starter: 'starter',
  off: 'Finding is off here. Pick them yourself.',
  noRules: 'Nothing here has a rule to quote yet. Pick them yourself.',
  noProposal: 'Nothing came back. Pick them yourself.',
  dropped: (n: number) => `${n} ${n === 1 ? 'pick was' : 'picks were'} dropped: not a verbatim rule of a library brick, or a repeat.`,
  empty: 'Nothing to pick from yet. Add photos, or include the starters from ⋯.',
  lean: 'Lean',
  leanHint: 'from your library · adapted · by rule',
  moreLikeThis: 'More like this one',
  clearAnchor: 'Clear the starting point',
  anchorNote: 'Your starting point.',
  proposedBy: 'proposed · model',
  swappedBy: 'adapted · by you',
  count: (n: number) => `${n} of ${MAX_BRICKS}`,
}

type Stage = 'what' | 'proposing' | 'picks' | 'manual'
type Meta = { model: string; effort: string; latency_ms: number; dropped: number; intent: string; lean?: Lean }
type Card = ProposalPick & { original?: ProposalPick }

/** Make, steps 1 What and 2 Picks (15_SIMPLIFY §2). One field for the intent; the style lean folded under it; Find photos asks the model for up to three photos,
 *  each quoting one of its rules verbatim (spec v3 P1–P5); Use these creates the project with the proposal record and goes straight to 3 See with the first
 *  arrangement (the others are in See's ⋯). The project is named from the intent (P2). `?brick=<id>` arrives with that brick as the starting point. */
export function MakeScreen() {
  const store = useStore()
  const preselect = new URLSearchParams(location.search).get('brick')
  const pre = preselect ? store.bricks.find(b => b.id === preselect) : undefined
  const [intent, setIntent] = useState('')
  const [stage, setStage] = useState<Stage>('what')
  const [picked, setPicked] = useState<string[]>(pre ? [pre.id] : [])
  const [anchor, setAnchor] = useState<string | null>(pre && (pre.status ?? 'ready') === 'ready' && !pre.superseded_by && pre.relations.length > 0 ? pre.id : null)
  const [chips, setChips] = useState<ChipId[]>([])
  const [pickingAnchor, setPickingAnchor] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [note, setNote] = useState<{ line: string; detail?: string } | null>(null)
  const [swapping, setSwapping] = useState<string | null>(null)
  const [example, setExample] = useState(0)
  const req = useRef(0)
  useEffect(() => { proposeEnabled().then(setEnabled) }, [])
  // P2: the placeholder rotates three examples while the field is empty
  useEffect(() => {
    if (intent || stage !== 'what') return
    const t = window.setInterval(() => setExample(i => (i + 1) % INTENT_EXAMPLES.length), 3500)
    return () => window.clearInterval(t)
  }, [intent, stage])

  // SB3: one pool feeds the chips, the proposal, the swap list and the manual grid; Include starters lives in the header's ⋯ (store.showStarters)
  const pool = useMemo(() => proposalPool(store.bricks, store.showStarters), [store.bricks, store.showStarters])
  const ready = useMemo(() => pool.map(p => p.brick), [pool])
  const fillsOf = (id: string) => pool.find(p => p.brick.id === id)?.fills
  const withRules = ready.filter(b => b.relations.length > 0)
  const offered = useMemo(() => chipsFor(ready, intent), [ready, intent])
  const active = chips.filter(c => offered.some(o => o.id === c))
  const anchorBrick = anchor ? withRules.find(b => b.id === anchor) : undefined
  const withAnchor = (p: string[]) => anchorBrick && !p.includes(anchorBrick.id) ? [anchorBrick.id, ...p].slice(0, MAX_BRICKS) : p
  const brickOf = (id: string) => store.bricks.find(b => b.id === id)
  const spare = ready.filter(b => !cards.some(c => c.brickId === b.id))
  // with the starters hidden from ⋯, a starter picked by hand drops out of the set
  const chosen = picked.filter(id => ready.some(b => b.id === id))
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.filter(x => ready.some(b => b.id === x)).length < MAX_BRICKS ? [...p, id] : p)
  const latest = [...store.projects].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))[0]

  const toManual = (line?: string, detail?: string) => { req.current++; setPicked(withAnchor(chosen)); setNote(line ? { line, detail } : null); setSwapping(null); setStage('manual') }
  const onPropose = async () => {
    if (!intent.trim()) return
    const sent = intent.trim(), id = ++req.current
    const lean: Lean = { chips: active, ...(anchorBrick ? { anchor_id: anchorBrick.id } : {}) }
    setStage('proposing'); setNote(null); setSwapping(null)
    const dry = import.meta.env.DEV && localStorage.getItem('tearsheet.dry') === '1'
    const out = await propose(sent, ready, dry, lean)
    if (id !== req.current) return   // the person went back or asked again meanwhile; this answer is stale
    if (!out.ok) { if (out.disabled) setEnabled(false); toManual(out.disabled ? COPY.off : COPY.noProposal, out.reason); return }
    // the starting point is the first card: the person's own pick, not the model's
    const first: Card[] = lean.anchor_id ? [{ brickId: lean.anchor_id, quotedRule: '', why: '', status: 'anchor' }] : []
    // SB3: own bricks outrank starters; the starting point stays ahead of both
    setCards([...first, ...orderOwnFirst(out.picks.map((p): Card => ({ brickId: p.brickId, quotedRule: p.quotedRule, why: p.why, status: 'proposed' })), ready)])
    setMeta({ model: out.model, effort: out.effort, latency_ms: out.latency_ms, dropped: out.dropped, intent: sent, ...(lean.chips.length || lean.anchor_id ? { lean } : {}) })
    setNote(out.dropped ? { line: COPY.dropped(out.dropped) } : null)
    setStage('picks')
  }
  const onFind = () => {
    if (!intent.trim()) return
    if (enabled === false) toManual(COPY.off)
    else if (withRules.length === 0) toManual(ready.length ? COPY.noRules : undefined)
    else void onPropose()
  }
  // a swap keeps the id the model proposed, so the record says what was replaced even after a second swap
  const swapCard = (from: string, to: string) => {
    setCards(cs => cs.map(c => {
      if (c.brickId !== from) return c
      const original = c.original ?? c
      return to === original.brickId ? original : { brickId: to, quotedRule: '', why: '', status: 'swapped', swappedFrom: original.brickId, original }
    }))
    setSwapping(null)
  }
  // Use these: the project is created with the proposal record (accepted = proposed · model, swapped = adapted · by you) in the order shown, which is the first arrangement
  const useThese = () => {
    if (!cards.length || !meta) return
    const picks: ProposalPick[] = cards.map(({ original: _o, ...p }) => p)
    const proposal: Proposal = { at: new Date().toISOString(), model: meta.model, effort: meta.effort, intent: meta.intent, latency_ms: meta.latency_ms, dropped: meta.dropped, picks, ...(meta.lean ? { lean: meta.lean } : {}) }
    navigate(`/project/${store.createProject(meta.intent, picks.map(c => c.brickId), autoName(meta.intent) || undefined, { proposal })}`)
  }
  const createManual = () => {
    if (!intent.trim() || chosen.length === 0) return
    navigate(`/project/${store.createProject(intent.trim(), chosen, autoName(intent) || undefined)}`)
  }
  // back to 1 What with the intent, the lean and the starting point kept; asking again is a new call
  const backToWhat = () => { req.current++; setCards([]); setMeta(null); setNote(null); setSwapping(null); setStage('what') }
  const busy = stage === 'proposing'
  const onWhat = stage === 'what' || busy

  return (
    <div className="chrome min-h-full">
      <StepPage wide={!onWhat}>
        <StepLine current={onWhat ? 1 : 2} back={onWhat ? '/' : backToWhat} go={onWhat ? {} : { 1: backToWhat }} />

        {onWhat && (
          <>
            <div className="flex flex-col gap-3">
              {latest && <Link href={`/project/${latest.id}`} className="ink-2 w-fit text-[13px]">{COPY.continue} <span style={{ color: 'var(--ink)' }}>{latest.name || autoName(latest.intent) || 'Untitled'}</span></Link>}
              <label htmlFor="make-intent"><StepTitle>{COPY.title}</StepTitle></label>
              <input id="make-intent" value={intent} disabled={busy} maxLength={300} autoFocus
                onChange={e => setIntent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) onFind() }}
                placeholder={INTENT_EXAMPLES[example]}
                className="w-full rounded border px-3 py-2.5 text-[15px] hairline" style={{ color: 'var(--ink)', background: 'var(--panel)' }} />
            </div>

            {withRules.length > 0 && (
              <Fold summary={COPY.adjust} defaultOpen={!!anchorBrick}>
                <div className="flex flex-wrap items-baseline gap-x-2"><span className="text-[12px] ink-2">{COPY.lean}</span><span className="ink-2 text-[11px]">{COPY.leanHint}</span></div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {offered.map(c => {
                    const on = active.includes(c.id)
                    return <button key={c.id} type="button" aria-pressed={on} title={c.note} disabled={busy} onClick={() => setChips(cs => cs.includes(c.id) ? cs.filter(x => x !== c.id) : [...cs, c.id])} className="chip chip-adapted min-h-7 cursor-pointer" style={on ? { borderColor: 'var(--ink)', borderWidth: 2, padding: '1px 7px', color: 'var(--ink)', fontWeight: 600 } : undefined}>{c.id}</button>
                  })}
                  <button type="button" className="btn px-2 py-0.5 text-[12px]" aria-expanded={pickingAnchor} disabled={busy} onClick={() => setPickingAnchor(v => !v)}>{COPY.moreLikeThis}</button>
                  {anchorBrick && (
                    <span className="inline-flex items-center gap-1 rounded border py-0.5 pl-0.5 pr-1 text-[12px] hairline" style={{ background: 'var(--panel)' }} title={COPY.anchorNote}>
                      <Photo src={anchorBrick.photo.url} className="h-6 w-6 rounded object-cover" />
                      <span className="ink-2">{photoLine(anchorBrick)}</span>
                      <button type="button" className="btn btn-quiet px-1 py-0 text-[14px]" aria-label={COPY.clearAnchor} title={COPY.clearAnchor} onClick={() => setAnchor(null)}>×</button>
                    </span>
                  )}
                </div>
                {pickingAnchor && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {withRules.map(b => (
                      <button key={b.id} type="button" onClick={() => { setAnchor(b.id); setPickingAnchor(false) }} aria-pressed={b.id === anchor} className="cursor-pointer overflow-hidden rounded p-0 text-left" style={{ border: `2px solid ${b.id === anchor ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--panel)' }} title={`Start from ${b.id}`}>
                        <div className="overflow-hidden" style={{ aspectRatio: '16 / 10', background: '#2a2a2a' }}><Photo src={b.photo.url} className="h-full w-full object-cover" /></div>
                        <div className="ink-2 truncate px-1.5 py-1 text-[11px]">{photoLine(b)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </Fold>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <button type="button" className="btn btn-accent px-4 py-2 text-[15px]" disabled={!intent.trim() || busy} onClick={onFind} title={COPY.findHint}>{COPY.find}</button>
              <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[13px] underline underline-offset-2 disabled:cursor-default disabled:opacity-50" style={{ color: 'var(--ink-2)', font: 'inherit' }} disabled={!intent.trim() || busy} onClick={() => toManual()}>{COPY.self}</button>
            </div>
            {busy && <p className="ink-2 m-0 text-[13px]" aria-live="polite">{COPY.finding}</p>}
          </>
        )}

        {stage === 'picks' && (
          <>
            <StepTitle>{COPY.picksTitle}</StepTitle>
            <div className="grid gap-4 sm:grid-cols-3" aria-live="polite" aria-label="Proposed photos">
              {cards.map(c => <PickCard key={c.brickId} pick={c} brick={brickOf(c.brickId)} fills={fillsOf(c.brickId)} meta={meta} note={note?.line} spare={spare} swapping={swapping === c.brickId} onSwap={() => setSwapping(swapping === c.brickId ? null : c.brickId)} onPick={to => swapCard(c.brickId, to)} />)}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" className="btn btn-accent px-4 py-2 text-[15px]" onClick={useThese}>{COPY.use}</button>
              <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[13px] underline underline-offset-2" style={{ color: 'var(--ink-2)', font: 'inherit' }} onClick={() => toManual()}>{COPY.self}</button>
            </div>
          </>
        )}

        {stage === 'manual' && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <StepTitle>{COPY.manualTitle}</StepTitle>
              <span className="ink-2 text-[13px] tabular-nums">{COPY.count(chosen.length)}</span>
            </div>
            {note && <p className="ink-2 m-0 text-[13px]" role="status" title={note.detail}>{note.line}</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {ready.map(b => {
                const on = chosen.includes(b.id)
                return (
                  <button key={b.id} type="button" onClick={() => toggle(b.id)} aria-pressed={on} aria-label={photoLine(b)} className="relative cursor-pointer overflow-hidden rounded p-0 text-left" style={{ border: `2px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--panel)' }}>
                    <div className="overflow-hidden" style={{ aspectRatio: '16 / 10', background: '#2a2a2a' }}><Photo src={b.photo.url} className="h-full w-full object-cover" /></div>
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[12px]">
                      <span className="ink-2 truncate" title={photoLine(b)}>{photoLine(b)}</span>
                      {originOf(b) === 'starter' && <span className="chip chip-adapted shrink-0 px-1.5 text-[10px]">{COPY.starter}</span>}
                    </div>
                    {on && <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[12px]" style={{ background: 'var(--ink)', color: '#fff' }}>✓</span>}
                  </button>
                )
              })}
              {ready.length === 0 && <span className="ink-2 col-span-full text-[13px]">{COPY.empty}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" className="btn btn-accent px-4 py-2 text-[15px]" onClick={createManual} disabled={!intent.trim() || chosen.length === 0}>{COPY.use}</button>
            </div>
          </>
        )}
      </StepPage>
    </div>
  )
}

/** One Picks card: the photo, its date (a starter: its credit) with a small `starter` tag, and one short label, the one for the rule it was proposed for.
 *  Why ▸ holds what the card used to show: the rule quoted verbatim, the model's sentence, the mini-preview, how it got here, and the call's details.
 *  Swap is an icon on the photo, shown on hover or focus (always on a touch screen). */
function PickCard({ pick: c, brick: b, fills, meta, note, spare, swapping, onSwap, onPick }: { pick: ProposalPick; brick?: Brick; fills?: string; meta: Meta | null; note?: string; spare: Brick[]; swapping: boolean; onSwap: () => void; onPick: (to: string) => void }) {
  const label = b ? pickLabel(b, c.quotedRule) : null
  return (
    <article className="panel group relative flex flex-col overflow-hidden">
      <div className="relative overflow-hidden" style={{ aspectRatio: '4 / 3', background: '#2a2a2a' }}>
        {b && <Photo src={b.photo.url} className="absolute inset-0 h-full w-full object-cover" />}
        <button type="button" className="btn absolute right-2 top-2 px-2 py-1 text-[14px] leading-none opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 max-sm:opacity-100 [@media(hover:none)]:opacity-100"
          aria-label={COPY.swap} title={COPY.swap} aria-expanded={swapping} disabled={spare.length === 0} onClick={onSwap}>⇄</button>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2 text-[12px]">
          {b && <span className="ink-2 truncate" title={photoLine(b)}>{photoLine(b)}</span>}
          {b && originOf(b) === 'starter' && <span className="chip chip-adapted shrink-0 px-1.5 text-[10px]">{COPY.starter}</span>}
        </div>
        {label && <LabelChip l={label} className="text-[15px] font-semibold" />}
        <Fold summary={COPY.why} className="mt-auto">
          <div className="flex flex-col gap-2 text-[12px]">
            {c.status === 'proposed' ? (
              <>
                <blockquote className="m-0 border-l-2 pl-2" style={{ borderColor: 'var(--line)' }} title="This photo's rule, quoted by the model character for character">“{c.quotedRule}”</blockquote>
                {c.why && <p className="ink-2 m-0">{c.why}</p>}
              </>
            ) : c.status === 'anchor' ? <p className="ink-2 m-0">{COPY.anchorNote}</p>
              : <p className="ink-2 m-0">Swapped in by you for <span className="mono">{c.swappedFrom}</span>.</p>}
            {b && <WhyPreview brick={b} />}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip ${c.status === 'proposed' ? 'chip-proposed' : 'chip-adapted'} px-1.5 text-[10px]`}>{c.status === 'proposed' ? COPY.proposedBy : COPY.swappedBy}</span>
              <a href={`/brick/${c.brickId}`} target="_blank" rel="noopener" className="mono ink-2 truncate text-[11px]" title="Opens the photo's brick in a new tab; the picks stay here">{c.brickId}</a>
            </div>
            {fills && <div className="ink-2 text-[11px]">{fills}</div>}
            {meta && <div className="mono ink-2 text-[11px]">{meta.model} · effort {meta.effort} · {(meta.latency_ms / 1000).toFixed(1)} s</div>}
            {note && <div className="ink-2 text-[11px]">{note}</div>}
          </div>
        </Fold>
      </div>
      {swapping && (
        <div className="grid grid-cols-3 gap-1 border-t p-2 hairline">
          {spare.map(s => <button key={s.id} type="button" onClick={() => onPick(s.id)} className="cursor-pointer overflow-hidden rounded p-0" style={{ border: '1px solid var(--line)' }} title={photoLine(s)} aria-label={`Swap in: ${photoLine(s)}`}><div className="overflow-hidden" style={{ aspectRatio: '16 / 10' }}><Photo src={s.photo.url} className="h-full w-full object-cover" /></div></button>)}
        </div>
      )}
    </article>
  )
}

/** P7: the tiny List screen this photo makes alone, in place of a sentence about what it would change. */
function WhyPreview({ brick }: { brick: Brick }) {
  const { params, unexpressed } = useMemo(() => brickParams(brick), [brick])
  return <MiniPreview params={params} width={140} badge={unexpressed} />
}
