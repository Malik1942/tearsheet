import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { Link, navigate } from '../lib/router'
import { Photo } from '../bricks/Photo'
import { propose, proposeEnabled } from '../lib/proposeClient'
import { proposedNow } from '../export'
import { originLabel } from '../lib/brickLabels'
import { orderOwnFirst, originOf, proposalPool } from '../lib/starters'
import { chipsFor, type Lean } from '../lib/lean'
import type { ChipId } from '../lib/leanFamilies'
import { resolveProject, type Project, type Proposal, type ProposalPick } from '../lib/mapRelations'
import { brickParams, rotations } from '../lib/brickPreview'
import { MiniPreview } from '../shell/MiniPreview'
import type { Brick } from '../lib/types'

const MAX_BRICKS = 5
const COPY = {
  title: 'Decide what to make',
  propose: 'Propose from my library',
  proposeHint: 'One text call: your intent and the rules of your bricks. No photo, no measurement leaves the device.',
  noRules: 'Nothing in the library has a rule to quote yet.',
  off: 'Proposals are off on this deployment; pick the bricks by hand.',
  proposing: 'Asking the model which bricks fit… usually 5–15 s',
  manual: 'Pick manually',
  proposeInstead: 'Propose instead',
  acceptAll: 'Accept all',
  compositions: 'Pick a composition',
  compositionsHint: 'The same bricks, each with a different one on top. Worked out here from their rules; no model call.',
  top: (id: string) => `top: ${id}`,
  useThis: 'Use this one',
  back: 'Back',
  swap: 'Swap',
  proposedBy: 'proposed · model',
  swappedBy: 'adapted · by you',
  lean: 'Lean (optional)',
  leanHint: 'from your library · adapted · by rule',
  noLean: 'none set',
  moreLikeThis: 'More like this one',
  clearAnchor: 'Clear the starting point',
  changeLean: 'Change lean',
  anchorNote: 'Your starting point.',
  noProposal: (why: string) => `No proposal came back (${why}). Pick by hand.`,
  dropped: (n: number) => `${n} ${n === 1 ? 'pick was' : 'picks were'} dropped: not a verbatim rule of a library brick, or a repeat.`,
  create: 'Create project',
  openCompose: 'Open Compose',
  preview: 'Preview',
  instructions: 'Instructions',
  phone: 'Compose needs a wider screen. Projects open here as a preview and as instructions.',
  empty: 'Nothing to pick from yet. Add photos, or turn on Include starters.',
  /** SB3: the toggle that hides every starter (also in the Library header). */
  includeStarters: 'Include starters',
  includeTitle: 'Starters fill your proposals only while you have fewer than three bricks of your own.',
}

type Stage = 'intent' | 'proposing' | 'proposal' | 'compositions' | 'manual'
type Meta = { model: string; effort: string; latency_ms: number; dropped: number; intent: string; lean?: Lean }
type Card = ProposalPick & { original?: ProposalPick }

const wide = () => typeof matchMedia === 'function' && matchMedia('(min-width: 960px)').matches
/** Compose is desktop-only (PRD 7.5); a phone lands on the read-only preview of the same project. */
const openProject = (id: string) => navigate(wide() ? `/project/${id}` : `/project/${id}/preview`)

/** Projects: name an intent first; optionally lean the choice (chips derived from the library's relations, and a starting-point brick);
 *  the model proposes up to three bricks, each with one of its rules quoted verbatim as the reason (PRD P2–P3, spec v3 P1–P5);
 *  the person accepts, swaps or picks by hand. The accepted set is recorded on the project as `proposed · model`, a swap as `adapted · by you`,
 *  the starting point as `adapted · by you` too. `?brick=<id>` (Brick → Use in a project) arrives here with that brick as the starting point. */
export function ProjectsScreen() {
  const store = useStore()
  const preselect = new URLSearchParams(location.search).get('brick')
  const pre = preselect ? store.bricks.find(b => b.id === preselect) : undefined
  const [open, setOpen] = useState(store.projects.length === 0 || !!preselect)
  const [name, setName] = useState('')
  const [intent, setIntent] = useState('')
  const [stage, setStage] = useState<Stage>('intent')
  const [picked, setPicked] = useState<string[]>(pre ? [pre.id] : [])
  const [anchor, setAnchor] = useState<string | null>(pre && (pre.status ?? 'ready') === 'ready' && !pre.superseded_by && pre.relations.length > 0 ? pre.id : null)
  const [chips, setChips] = useState<ChipId[]>([])
  const [pickingAnchor, setPickingAnchor] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  /** The record made when Accept all was pressed; the compositions stage creates the project with it, whichever of the three is picked. */
  const [accepted, setAccepted] = useState<Proposal | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const req = useRef(0)
  useEffect(() => { proposeEnabled().then(setEnabled) }, [])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [swapping, setSwapping] = useState<string | null>(null)
  // SB3: one pool feeds the chips, the proposal, the swap list and the manual grid: the ready own bricks, then the starters while the library is thin and they are shown
  const pool = useMemo(() => proposalPool(store.bricks, store.showStarters), [store.bricks, store.showStarters])
  const ready = useMemo(() => pool.map(p => p.brick), [pool])
  const fillsOf = (id: string) => pool.find(p => p.brick.id === id)?.fills
  const withRules = ready.filter(b => b.relations.length > 0)
  // chips are offered for this intent from the pool's own relations; one that has fallen out of the six as the intent changed is no longer set
  const offered = useMemo(() => chipsFor(ready, intent), [ready, intent])
  const active = chips.filter(c => offered.some(o => o.id === c))
  const anchorBrick = anchor ? withRules.find(b => b.id === anchor) : undefined
  const withAnchor = (p: string[]) => anchorBrick && !p.includes(anchorBrick.id) ? [anchorBrick.id, ...p].slice(0, MAX_BRICKS) : p
  const brickOf = (id: string) => store.bricks.find(b => b.id === id)
  const spare = ready.filter(b => !cards.some(c => c.brickId === b.id))
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length < MAX_BRICKS ? [...p, id] : p)
  const projects = [...store.projects].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))

  const onPropose = async () => {
    if (!intent.trim()) return
    const sent = intent.trim(), id = ++req.current
    const lean: Lean = { chips: active, ...(anchorBrick ? { anchor_id: anchorBrick.id } : {}) }
    setStage('proposing'); setNote(null); setSwapping(null)
    const dry = import.meta.env.DEV && localStorage.getItem('tearsheet.dry') === '1'
    const out = await propose(sent, ready, dry, lean)
    if (id !== req.current) return   // the form was reset or asked again meanwhile; this answer is stale
    if (!out.ok) { setStage('manual'); setPicked(withAnchor); if (out.disabled) setEnabled(false); setNote(COPY.noProposal(out.reason.replace(/\.$/, ''))); return }
    // the starting point is the first card: the person's own pick, not the model's
    const first: Card[] = lean.anchor_id ? [{ brickId: lean.anchor_id, quotedRule: '', why: '', status: 'anchor' }] : []
    // SB3: own bricks outrank starters, so the proposed cards go own first, the model's order kept inside each group; the starting point stays ahead of both
    setCards([...first, ...orderOwnFirst(out.picks.map((p): Card => ({ brickId: p.brickId, quotedRule: p.quotedRule, why: p.why, status: 'proposed' })), ready)])
    setMeta({ model: out.model, effort: out.effort, latency_ms: out.latency_ms, dropped: out.dropped, intent: sent, ...(lean.chips.length || lean.anchor_id ? { lean } : {}) })
    setNote(out.dropped ? COPY.dropped(out.dropped) : null)
    setStage('proposal')
  }
  // a swap keeps the id the model proposed, so the record says what was replaced even after a second swap
  const swapCard = (from: string, to: string) => {
    setCards(cs => cs.map(c => {
      if (c.brickId !== from) return c
      const original = c.original ?? c
      // swapping back to the model's own pick restores it as proposed
      return to === original.brickId ? original : { brickId: to, quotedRule: '', why: '', status: 'swapped', swappedFrom: original.brickId, original }
    }))
    setSwapping(null)
  }
  const acceptAll = () => {
    if (!cards.length || !meta) return
    // the record carries the intent the model actually saw (the field is locked while the cards are shown)
    const picks: ProposalPick[] = cards.map(({ original: _o, ...p }) => p)
    const proposal: Proposal = { at: new Date().toISOString(), model: meta.model, effort: meta.effort, intent: meta.intent, latency_ms: meta.latency_ms, dropped: meta.dropped, picks, ...(meta.lean ? { lean: meta.lean } : {}) }
    // P8: one accepted brick has nothing to rotate, so it goes straight in; two or three are shown in their rotations first
    if (picks.length < 2) openProject(store.createProject(meta.intent, picks.map(c => c.brickId), name.trim() || undefined, { proposal }))
    else { setAccepted(proposal); setStage('compositions') }
  }
  // P8: the chosen rotation becomes the project's brick order (the first brick is on top), with the proposal record unchanged
  const chooseComposition = (order: string[]) => {
    if (!accepted) return
    openProject(store.createProject(accepted.intent, order, name.trim() || undefined, { proposal: accepted }))
  }
  // P8: each rotation resolved as a temporary project, in that order, with the same proposal record; the first brick's skin and hierarchy lead
  const compositions = useMemo(() => {
    if (stage !== 'compositions' || !accepted) return []
    return rotations(accepted.picks.map(p => p.brickId)).map(order => {
      const temp: Project = { id: 'mini', intent: accepted.intent, createdAt: accepted.at, brickIds: order, proposal: accepted, disabled: {}, choice: {}, locks: {}, manual: {} }
      return { order, params: resolveProject(temp, store.bricks).params }
    })
  }, [stage, accepted, store.bricks])
  const createManual = () => {
    if (!intent.trim() || picked.length === 0) return
    openProject(store.createProject(intent.trim(), picked, name.trim() || undefined))
  }
  // back to the intent stage with the intent, the chips and the starting point kept; asking again is a new call
  const changeLean = () => { req.current++; setCards([]); setMeta(null); setAccepted(null); setNote(null); setSwapping(null); setStage('intent') }
  const busy = stage === 'proposing'
  // hiding the starters also takes them out of the hand-picked set; the chips and the starting point follow the pool by themselves
  const setStarters = (on: boolean) => {
    store.setShowStarters(on)
    if (!on) setPicked(p => p.filter(id => { const b = brickOf(id); return !b || originOf(b) === 'own' }))
  }

  return (
    <div className="chrome min-h-full">
      <header className="flex items-center gap-3 border-b px-4 py-2 hairline" style={{ background: 'var(--panel)' }}>
        <Link href="/" className="font-semibold no-underline" style={{ color: 'var(--ink)' }}>Tearsheet</Link>
        <span className="ink-2">/ Projects</span>
        <div className="ml-auto"><button type="button" className="btn btn-accent" onClick={() => { req.current++; setOpen(true); setStage('intent'); setCards([]); setAccepted(null); setNote(null); setMeta(null); setSwapping(null); setChips([]); setAnchor(null); setPickingAnchor(false) }}>New project</button></div>
      </header>
      <div className="px-4 py-1 text-[12px] ink-2 min-[960px]:hidden" style={{ borderBottom: '1px solid var(--line)' }}>{COPY.phone}</div>

      <div className="mx-auto max-w-4xl p-4">
        {open && (
          <section className="panel mb-4 p-4">
            <h2 className="mb-3">{COPY.title}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-[12px] ink-2">Name
                <input value={name} disabled={busy} onChange={e => setName(e.target.value)} placeholder="Concert log" className="rounded border px-2 py-1 text-[13px] hairline" style={{ color: 'var(--ink)', background: 'var(--panel)' }} />
              </label>
              <label className="flex flex-col gap-1 text-[12px] ink-2">Intent, one line
                <input value={intent} disabled={busy || stage === 'proposal' || stage === 'compositions'} maxLength={300} onChange={e => setIntent(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && stage === 'intent' && withRules.length && enabled !== false) onPropose() }} placeholder="A concert log for someone who goes to a lot of shows" className="rounded border px-2 py-1 text-[13px] hairline" style={{ color: 'var(--ink)', background: 'var(--panel)' }} />
              </label>
            </div>
            {stage === 'intent' && intent.trim() && withRules.length > 0 && enabled !== false && (
              <div className="mt-3">
                <div className="flex flex-wrap items-baseline gap-x-2"><span className="text-[12px] ink-2">{COPY.lean}</span><span className="ink-2 text-[11px]">{COPY.leanHint}</span></div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {offered.map(c => {
                    const on = active.includes(c.id)
                    return <button key={c.id} type="button" aria-pressed={on} title={c.note} onClick={() => setChips(cs => cs.includes(c.id) ? cs.filter(x => x !== c.id) : [...cs, c.id])} className="chip chip-adapted min-h-7 cursor-pointer" style={on ? { borderColor: 'var(--accent)', borderWidth: 2, padding: '1px 7px', color: 'var(--ink)', fontWeight: 600 } : undefined}>{c.id}</button>
                  })}
                  <button type="button" className="btn px-2 py-0.5 text-[12px]" aria-expanded={pickingAnchor} onClick={() => setPickingAnchor(v => !v)}>{COPY.moreLikeThis}</button>
                  {anchorBrick && (
                    <span className="inline-flex items-center gap-1 rounded border py-0.5 pl-0.5 pr-1 hairline" style={{ background: 'var(--panel)' }}>
                      <Photo src={anchorBrick.photo.url} className="h-6 w-6 rounded object-cover" />
                      <span className="mono">{anchorBrick.id}</span>
                      <button type="button" className="btn btn-quiet px-1 py-0 text-[14px]" aria-label={COPY.clearAnchor} title={COPY.clearAnchor} onClick={() => setAnchor(null)}>×</button>
                    </span>
                  )}
                </div>
                {pickingAnchor && (
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {withRules.map(b => (
                      <button key={b.id} type="button" onClick={() => { setAnchor(b.id); setPickingAnchor(false) }} aria-pressed={b.id === anchor} className="overflow-hidden rounded text-left" style={{ border: `2px solid ${b.id === anchor ? 'var(--accent)' : 'var(--line)'}`, background: 'var(--panel)' }} title={`Start from ${b.id}`}>
                        <div style={{ aspectRatio: '16 / 10', background: '#2a2a2a' }}><Photo src={b.photo.url} className="h-full w-full object-cover" /></div>
                        <div className="mono px-1.5 py-1 text-[11px]">{b.id}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 text-[12px] ink-2">Shell family</div>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="chip chip-measured">List + Year review</span>
              <span className="chip chip-adapted" title="next">Dashboard · next</span>
              <span className="chip chip-adapted" title="next">Form · next</span>
            </div>
            <label className="mt-3 flex w-fit items-center gap-2 text-[12px] ink-2" title={COPY.includeTitle}>
              <input type="checkbox" checked={store.showStarters} disabled={busy || stage === 'proposal' || stage === 'compositions'} onChange={e => setStarters(e.target.checked)} />{COPY.includeStarters}
            </label>

            {stage === 'intent' && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" className={`btn ${enabled === false ? '' : 'btn-accent'}`} disabled={!intent.trim() || withRules.length === 0 || enabled === false} onClick={onPropose} title={enabled === false ? COPY.off : withRules.length === 0 ? COPY.noRules : COPY.proposeHint}>{COPY.propose}</button>
                <button type="button" className={`btn ${enabled === false ? 'btn-accent' : ''}`} disabled={!intent.trim()} onClick={() => { setPicked(withAnchor); setStage('manual') }}>{COPY.manual}</button>
                {projects.length > 0 && <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>Cancel</button>}
                <span className="ink-2 w-full text-[11px] sm:w-auto">{enabled === false ? COPY.off : withRules.length === 0 ? COPY.noRules : COPY.proposeHint}</span>
              </div>
            )}
            {busy && <p className="mt-4 text-[12px]" style={{ color: 'var(--accent)' }} aria-live="polite">{COPY.proposing}</p>}
            {note && <p className="ink-2 mt-3 text-[12px]" role="status">{note}</p>}

            {stage === 'proposal' && (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Lean for this proposal">
                  <span className="text-[12px] ink-2">Lean</span>
                  {meta?.lean?.chips.map(c => <span key={c} className="chip chip-adapted" title={offered.find(o => o.id === c)?.note}>{c}</span>)}
                  {meta?.lean?.anchor_id && <span className="inline-flex items-center gap-1 text-[12px]">starting point <span className="mono">{meta.lean.anchor_id}</span></span>}
                  {!meta?.lean && <span className="ink-2 text-[12px]">{COPY.noLean}</span>}
                  <button type="button" className="btn btn-quiet px-2 py-0.5 text-[11px]" onClick={changeLean}>{COPY.changeLean}</button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3" aria-live="polite" aria-label="Proposed bricks">
                  {cards.map(c => <ProposalCard key={c.brickId} pick={c} brick={brickOf(c.brickId)} fills={fillsOf(c.brickId)} spare={spare} swapping={swapping === c.brickId} onSwap={() => setSwapping(swapping === c.brickId ? null : c.brickId)} onPick={to => swapCard(c.brickId, to)} />)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-accent" onClick={acceptAll}>{COPY.acceptAll}</button>
                  <button type="button" className="btn" onClick={() => { setStage('manual'); setPicked(withAnchor([])) }}>{COPY.manual}</button>
                  {meta && <span className="mono ink-2 text-[11px]">{meta.model} · effort {meta.effort} · {(meta.latency_ms / 1000).toFixed(1)} s</span>}
                </div>
              </>
            )}

            {stage === 'compositions' && accepted && (
              <>
                <h3 className="mt-4 text-[13px] font-semibold">{COPY.compositions}</h3>
                <p className="ink-2 text-[11px]">{COPY.compositionsHint}</p>
                <ul className="mt-2 flex gap-3 overflow-x-auto pb-1" aria-label="Compositions">
                  {compositions.map(c => (
                    <li key={c.order.join(',')} className="panel flex shrink-0 flex-col items-center gap-2 p-3">
                      <MiniPreview params={c.params} width={220} />
                      <div className="mono text-[12px]">{COPY.top(c.order[0])}</div>
                      <button type="button" className="btn btn-accent" onClick={() => chooseComposition(c.order)}>{COPY.useThis}</button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3"><button type="button" className="btn" onClick={() => { setStage('proposal'); setAccepted(null) }}>{COPY.back}</button></div>
              </>
            )}

            {stage === 'manual' && (
              <>
                <div className="mt-3 flex items-baseline justify-between text-[12px] ink-2"><span>Bricks from your library, up to {MAX_BRICKS}</span><span className="mono">{picked.length}/{MAX_BRICKS}</span></div>
                <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {ready.map(b => {
                    const on = picked.includes(b.id)
                    return (
                      <button key={b.id} type="button" onClick={() => toggle(b.id)} aria-pressed={on} className="overflow-hidden rounded text-left" style={{ border: `2px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: 'var(--panel)' }}>
                        <div style={{ aspectRatio: '16 / 10', background: '#2a2a2a' }}><Photo src={b.photo.url} className="h-full w-full object-cover" /></div>
                        <div className="px-1.5 py-1 text-[11px]"><div className="mono truncate">{b.id}</div><div className="ink-2 truncate" title={originLabel(b)}>{originLabel(b)}</div></div>
                      </button>
                    )
                  })}
                  {ready.length === 0 && <span className="ink-2 text-[12px]">{COPY.empty}</span>}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-accent" onClick={createManual} disabled={!intent.trim() || picked.length === 0}>{COPY.create}</button>
                  {withRules.length > 0 && enabled !== false && <button type="button" className="btn btn-quiet" disabled={!intent.trim()} onClick={onPropose}>{COPY.proposeInstead}</button>}
                  {projects.length > 0 && <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>Cancel</button>}
                </div>
              </>
            )}
          </section>
        )}

        {projects.length > 0 && (
          <ul className="space-y-2">
            {projects.map(p => (
              <li key={p.id} className="panel flex flex-wrap items-center gap-3 p-3">
                <div className="flex -space-x-2">
                  {p.brickIds.map(id => { const b = store.bricks.find(x => x.id === id); return b ? <Photo key={id} src={b.photo.url} className="h-10 w-10 rounded-full object-cover" style={{ border: '2px solid var(--panel)' }} /> : null })}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{p.name || 'Untitled project'}{proposedNow(p.brickIds, p.proposal) > 0 && <span className="chip chip-proposed ml-2 px-1.5 text-[10px]" title={`${proposedNow(p.brickIds, p.proposal)} of ${p.brickIds.length} bricks were proposed by the model`}>{COPY.proposedBy}</span>}</div>
                  <div className="ink-2 truncate text-[12px]">{p.intent}</div>
                </div>
                <span className="ink-2 hidden text-[11px] sm:inline">edited {(p.updatedAt ?? p.createdAt).slice(0, 16).replace('T', ' ')}</span>
                <Link href={`/project/${p.id}`} className="btn hidden min-[960px]:inline-block">{COPY.openCompose}</Link>
                <span className="flex gap-2 min-[960px]:hidden">
                  <Link href={`/project/${p.id}/preview`} className="btn">{COPY.preview}</Link>
                  <Link href={`/project/${p.id}/instructions`} className="btn btn-quiet">{COPY.instructions}</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** One proposed brick: the photo, where it came from (SB2: `saved Jun 21` or `starter · <credit>`, and for a starter filling a thin library why it is here), the quoted rule as the reason, the model's one sentence, and Swap. A swapped card says so and names what it replaced;
 *  the starting point the person chose ("More like this one") says so and carries no quote, because the model did not pick it. */
function ProposalCard({ pick: c, brick: b, fills, spare, swapping, onSwap, onPick }: { pick: ProposalPick; brick?: Brick; fills?: string; spare: Brick[]; swapping: boolean; onSwap: () => void; onPick: (to: string) => void }) {
  return (
    <article className="panel overflow-hidden">
      <div style={{ aspectRatio: '16 / 10', background: '#2a2a2a' }}>{b && <Photo src={b.photo.url} className="h-full w-full object-cover" />}</div>
      <div className="flex flex-col gap-1 p-2 text-[12px]">
        <div className="flex items-center justify-between gap-2">
          <a href={`/brick/${c.brickId}`} target="_blank" rel="noopener" className="mono truncate" title="Opens the brick in a new tab; the proposal stays here">{c.brickId}</a>
          <span className={`chip ${c.status === 'proposed' ? 'chip-proposed' : 'chip-adapted'} shrink-0 px-1.5 text-[10px]`}>{c.status === 'proposed' ? COPY.proposedBy : COPY.swappedBy}</span>
        </div>
        {b && <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{originLabel(b)}</div>}
        {fills && <div className="ink-2 text-[11px]">{fills}</div>}
        {c.status === 'proposed' ? (
          <>
            <blockquote className="m-0 border-l-2 pl-2" style={{ borderColor: 'var(--line)' }} title="This brick's rule, quoted by the model character for character">“{c.quotedRule}”</blockquote>
            <p className="ink-2 m-0">{c.why}</p>
          </>
        ) : c.status === 'anchor' ? <p className="ink-2 m-0">{COPY.anchorNote}</p>
          : <p className="ink-2 m-0">Swapped in by you for <span className="mono">{c.swappedFrom}</span>.</p>}
        {b && <ProposalPreview brick={b} />}
        <div className="mt-1 flex gap-1">
          <button type="button" className="btn btn-quiet px-2 py-0.5 text-[11px]" disabled={spare.length === 0} onClick={onSwap} aria-expanded={swapping}>{COPY.swap}</button>
        </div>
        {swapping && (
          <div className="grid grid-cols-3 gap-1">
            {spare.map(s => <button key={s.id} type="button" onClick={() => onPick(s.id)} className="overflow-hidden rounded" style={{ border: '1px solid var(--line)' }} title={`Swap in ${s.id}`}><div style={{ aspectRatio: '16 / 10' }}><Photo src={s.photo.url} className="h-full w-full object-cover" /></div><div className="mono px-1 text-[10px]">{s.id}</div></button>)}
          </div>
        )}
      </div>
    </article>
  )
}

/** P7: the tiny List screen this brick makes alone, in place of a sentence about what it would change. */
function ProposalPreview({ brick }: { brick: Brick }) {
  const { params, unexpressed } = useMemo(() => brickParams(brick), [brick])
  return <div className="mt-1"><MiniPreview params={params} width={120} badge={unexpressed} /></div>
}
