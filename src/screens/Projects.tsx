import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { Link, navigate } from '../lib/router'
import { Photo } from '../bricks/Photo'
import { propose, proposeEnabled } from '../lib/proposeClient'
import { proposedNow } from '../export'
import { savedLabel } from '../lib/brickLabels'
import type { Proposal, ProposalPick } from '../lib/mapRelations'
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
  swap: 'Swap',
  proposedBy: 'proposed · model',
  swappedBy: 'adapted · by you',
  noProposal: (why: string) => `No proposal came back (${why}). Pick by hand.`,
  dropped: (n: number) => `${n} ${n === 1 ? 'pick was' : 'picks were'} dropped: not a verbatim rule of a library brick, or a repeat.`,
  create: 'Create project',
  openCompose: 'Open Compose',
  preview: 'Preview',
  instructions: 'Instructions',
  phone: 'Compose needs a wider screen. Projects open here as a preview and as instructions.',
  empty: 'Nothing in the library yet. Add photos or load the sample library first.',
}

type Stage = 'intent' | 'proposing' | 'proposal' | 'manual'
type Meta = { model: string; effort: string; latency_ms: number; dropped: number; intent: string }
type Card = ProposalPick & { original?: ProposalPick }

const wide = () => typeof matchMedia === 'function' && matchMedia('(min-width: 960px)').matches
/** Compose is desktop-only (PRD 7.5); a phone lands on the read-only preview of the same project. */
const openProject = (id: string) => navigate(wide() ? `/project/${id}` : `/project/${id}/preview`)

/** Projects: name an intent; the model proposes up to three bricks, each with one of its rules quoted verbatim as the reason (PRD P2–P3);
 *  the person accepts, swaps or picks by hand. The accepted set is recorded on the project as `proposed · model`, a swap as `adapted · by you`. */
export function ProjectsScreen() {
  const store = useStore()
  const preselect = new URLSearchParams(location.search).get('brick')
  const [open, setOpen] = useState(store.projects.length === 0 || !!preselect)
  const [name, setName] = useState('')
  const [intent, setIntent] = useState('')
  const [stage, setStage] = useState<Stage>(preselect ? 'manual' : 'intent')
  const [picked, setPicked] = useState<string[]>(preselect && store.bricks.some(b => b.id === preselect) ? [preselect] : [])
  const [cards, setCards] = useState<Card[]>([])
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const req = useRef(0)
  useEffect(() => { proposeEnabled().then(setEnabled) }, [])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [swapping, setSwapping] = useState<string | null>(null)
  const ready = store.bricks.filter(b => (b.status ?? 'ready') === 'ready' && !b.superseded_by)
  const withRules = ready.filter(b => b.relations.length > 0)
  const brickOf = (id: string) => store.bricks.find(b => b.id === id)
  const spare = ready.filter(b => !cards.some(c => c.brickId === b.id))
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length < MAX_BRICKS ? [...p, id] : p)
  const projects = [...store.projects].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))

  const onPropose = async () => {
    if (!intent.trim()) return
    const sent = intent.trim(), id = ++req.current
    setStage('proposing'); setNote(null); setSwapping(null)
    const dry = import.meta.env.DEV && localStorage.getItem('tearsheet.dry') === '1'
    const out = await propose(sent, ready, dry)
    if (id !== req.current) return   // the form was reset or asked again meanwhile; this answer is stale
    if (!out.ok) { setStage('manual'); if (out.disabled) setEnabled(false); setNote(COPY.noProposal(out.reason.replace(/\.$/, ''))); return }
    setCards(out.picks.map(p => ({ brickId: p.brickId, quotedRule: p.quotedRule, why: p.why, status: 'proposed' })))
    setMeta({ model: out.model, effort: out.effort, latency_ms: out.latency_ms, dropped: out.dropped, intent: sent })
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
    const proposal: Proposal = { at: new Date().toISOString(), model: meta.model, effort: meta.effort, intent: meta.intent, latency_ms: meta.latency_ms, dropped: meta.dropped, picks }
    openProject(store.createProject(meta.intent, picks.map(c => c.brickId), name.trim() || undefined, { proposal }))
  }
  const createManual = () => {
    if (!intent.trim() || picked.length === 0) return
    openProject(store.createProject(intent.trim(), picked, name.trim() || undefined))
  }
  const busy = stage === 'proposing'

  return (
    <div className="chrome min-h-full">
      <header className="flex items-center gap-3 border-b px-4 py-2 hairline" style={{ background: 'var(--panel)' }}>
        <Link href="/" className="font-semibold no-underline" style={{ color: 'var(--ink)' }}>Tearsheet</Link>
        <span className="ink-2">/ Projects</span>
        <div className="ml-auto"><button type="button" className="btn btn-accent" onClick={() => { req.current++; setOpen(true); setStage('intent'); setCards([]); setNote(null) }}>New project</button></div>
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
                <input value={intent} disabled={busy || stage === 'proposal'} maxLength={300} onChange={e => setIntent(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && stage === 'intent' && withRules.length && enabled !== false) onPropose() }} placeholder="A concert log for someone who goes to a lot of shows" className="rounded border px-2 py-1 text-[13px] hairline" style={{ color: 'var(--ink)', background: 'var(--panel)' }} />
              </label>
            </div>
            <div className="mt-3 text-[12px] ink-2">Shell family</div>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="chip chip-measured">List + Year review</span>
              <span className="chip chip-adapted" title="next">Dashboard · next</span>
              <span className="chip chip-adapted" title="next">Form · next</span>
            </div>

            {stage === 'intent' && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" className={`btn ${enabled === false ? '' : 'btn-accent'}`} disabled={!intent.trim() || withRules.length === 0 || enabled === false} onClick={onPropose} title={enabled === false ? COPY.off : withRules.length === 0 ? COPY.noRules : COPY.proposeHint}>{COPY.propose}</button>
                <button type="button" className={`btn ${enabled === false ? 'btn-accent' : ''}`} disabled={!intent.trim()} onClick={() => setStage('manual')}>{COPY.manual}</button>
                {projects.length > 0 && <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>Cancel</button>}
                <span className="ink-2 w-full text-[11px] sm:w-auto">{enabled === false ? COPY.off : withRules.length === 0 ? COPY.noRules : COPY.proposeHint}</span>
              </div>
            )}
            {busy && <p className="mt-4 text-[12px]" style={{ color: 'var(--accent)' }} aria-live="polite">{COPY.proposing}</p>}
            {note && <p className="ink-2 mt-3 text-[12px]" role="status">{note}</p>}

            {stage === 'proposal' && (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-3" aria-live="polite" aria-label="Proposed bricks">
                  {cards.map(c => <ProposalCard key={c.brickId} pick={c} brick={brickOf(c.brickId)} spare={spare} swapping={swapping === c.brickId} onSwap={() => setSwapping(swapping === c.brickId ? null : c.brickId)} onPick={to => swapCard(c.brickId, to)} />)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-accent" onClick={acceptAll}>{COPY.acceptAll}</button>
                  <button type="button" className="btn" onClick={() => { setStage('manual'); setPicked([]) }}>{COPY.manual}</button>
                  {meta && <span className="mono ink-2 text-[11px]">{meta.model} · effort {meta.effort} · {(meta.latency_ms / 1000).toFixed(1)} s</span>}
                </div>
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
                        <div className="px-1.5 py-1 text-[11px]"><span className="mono">{b.id}</span> <span className="ink-2">{b.saved_at}</span></div>
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

/** One proposed brick: the photo, the quoted rule as the reason, the model's one sentence, and Swap. A swapped card says so and names what it replaced. */
function ProposalCard({ pick: c, brick: b, spare, swapping, onSwap, onPick }: { pick: ProposalPick; brick?: Brick; spare: Brick[]; swapping: boolean; onSwap: () => void; onPick: (to: string) => void }) {
  return (
    <article className="panel overflow-hidden">
      <div style={{ aspectRatio: '16 / 10', background: '#2a2a2a' }}>{b && <Photo src={b.photo.url} className="h-full w-full object-cover" />}</div>
      <div className="flex flex-col gap-1 p-2 text-[12px]">
        <div className="flex items-center justify-between gap-2">
          <a href={`/brick/${c.brickId}`} target="_blank" rel="noopener" className="mono truncate" title="Opens the brick in a new tab; the proposal stays here">{c.brickId}</a>
          <span className={`chip ${c.status === 'proposed' ? 'chip-proposed' : 'chip-adapted'} shrink-0 px-1.5 text-[10px]`}>{c.status === 'proposed' ? COPY.proposedBy : COPY.swappedBy}</span>
        </div>
        {b && <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{savedLabel(b.saved_at)}</div>}
        {c.status === 'proposed' ? (
          <>
            <blockquote className="m-0 border-l-2 pl-2" style={{ borderColor: 'var(--line)' }} title="This brick's rule, quoted by the model character for character">“{c.quotedRule}”</blockquote>
            <p className="ink-2 m-0">{c.why}</p>
          </>
        ) : <p className="ink-2 m-0">Swapped in by you for <span className="mono">{c.swappedFrom}</span>.</p>}
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
