import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { Link, navigate } from '../lib/router'
import { Photo } from '../bricks/Photo'
import { propose, proposeEnabled } from '../lib/proposeClient'
import { orderOwnFirst, proposalPool } from '../lib/starters'
import { chipsFor, type Lean } from '../lib/lean'
import type { ChipId } from '../lib/leanFamilies'
import { resolveProject, type Project, type Proposal, type ProposalPick } from '../lib/mapRelations'
import { standInLine } from '../lib/standIns'
import { INTENT_EXAMPLES, NEUTRAL_SKIN, autoName, photoLine, photoRow, toggleMuted } from '../lib/makeFlow'
import { useChangeFlash } from '../compose/useChangeFlash'
import { Fold, MoreMenu, Overlay } from '../make/Steps'
import { ScaledScreens } from '../make/Screens'
import { ShareMenu } from '../make/ShareMenu'
import { AdjustStyle, Arrangements, PickMyself, Rename, SwapPicker, VersionList } from '../make/Dialogs'
import { swapGroups } from '../lib/swapSheet'
import { ComposePanel } from './Compose'
import { FilesView } from './Export'

const MAX_BRICKS = 5
/** Space kept under the screens for the photo row and its line, so screens + photos fit one 1440x900 viewport. */
const RESERVE = 176
const COPY = {
  field: 'What are you making?',
  examples: 'For example:',
  finding: 'Looking through your photos…',
  off: 'Finding is off here. Pick them yourself.',
  noRules: 'Nothing here has a rule to quote yet. Pick them yourself.',
  noProposal: 'Nothing came back. Pick them yourself.',
  startingFrom: 'Starting from',
  clearAnchor: 'Clear the starting point',
  more: 'More for this page',
  fineTune: 'Fine-tune', style: 'Adjust style', arrangement: 'Try another arrangement', neutral: 'Neutral skin', pick: 'Pick photos myself', rename: 'Rename',
  turnOff: 'Turn this photo off', turnOn: 'Turn this photo back on', swap: 'Swap this photo',
  couldnt: (n: number) => `${n} ${n === 1 ? 'thing' : 'things'} couldn't carry over`,
  files: 'Files', versions: 'Versions',
  list: 'List', review: 'Year review', both: 'Both',
  missing: "This project isn't on this device.", projects: 'Projects',
}

type Dialog = null | 'tune' | 'style' | 'arrange' | 'pick' | 'rename' | { swap: string }

/** Make, one page (Malik, 2026-11-03; overrides 15_SIMPLIFY's four steps). One field; Enter asks the model for up to three photos from the library (spec v3 P5,
 *  with the lean and the starting point from Adjust style), creates the project at once (P2 auto-name, the proposal record, the first arrangement) and shows it:
 *  the two screens, and under them the photos that set something, each with one short label. Tapping a photo turns its whole contribution off or on
 *  (`mutedBricks`, a new version, the change highlight). Share (top right): Copy link (E1) and Download. ⋯: Fine-tune (today's Compose), Adjust style,
 *  Try another arrangement, Neutral skin, Pick photos myself, Rename. `/make` has no project yet; `/project/:id` shows one; `?brick=` sets the starting point. */
export function MakeScreen({ id, share = false }: { id: string | null; share?: boolean }) {
  const store = useStore()
  const project = id ? store.projects.find(p => p.id === id) : undefined
  const preselect = new URLSearchParams(location.search).get('brick')
  const pre = preselect ? store.bricks.find(b => b.id === preselect) : undefined
  const [intent, setIntent] = useState(project?.intent ?? '')
  const [chips, setChips] = useState<ChipId[]>(() => (project?.proposal?.lean?.chips ?? []) as ChipId[])
  const [anchor, setAnchor] = useState<string | null>(() => pre && (pre.status ?? 'ready') === 'ready' && !pre.superseded_by && pre.relations.length > 0 ? pre.id : project?.proposal?.lean?.anchor_id ?? null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ line: string; detail?: string } | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [neutral, setNeutral] = useState(false)
  const [screen, setScreen] = useState<'both' | 'list' | 'review'>('both')
  const [example, setExample] = useState(0)
  const req = useRef(0)
  useEffect(() => { proposeEnabled().then(setEnabled) }, [])
  // the field holds the project's intent; moving to another project (or to /make) brings its own, and its lean
  const [shownId, setShownId] = useState(id)
  if (shownId !== id) {
    setShownId(id)
    setIntent(project?.intent ?? '')
    if (project?.proposal?.lean) { setChips(project.proposal.lean.chips as ChipId[]); setAnchor(project.proposal.lean.anchor_id ?? null) }
  }
  useEffect(() => {
    if (project || intent) return
    const t = window.setInterval(() => setExample(i => (i + 1) % INTENT_EXAMPLES.length), 3500)
    return () => window.clearInterval(t)
  }, [project, intent])

  // SB3: one pool feeds the chips, the proposal, the swap list and the hand-picked grid; Include starters is in the header's ⋯
  const pool = useMemo(() => proposalPool(store.bricks, store.showStarters), [store.bricks, store.showStarters])
  const ready = useMemo(() => pool.map(p => p.brick), [pool])
  const withRules = ready.filter(b => b.relations.length > 0)
  const offered = useMemo(() => chipsFor(ready, intent), [ready, intent])
  const active = chips.filter(c => offered.some(o => o.id === c))
  const anchorBrick = anchor ? withRules.find(b => b.id === anchor) : undefined

  const resolved = useMemo(() => project ? resolveProject(project, store.bricks) : null, [project, store.bricks])
  const flash = useChangeFlash(project)
  const photos = useMemo(() => project ? photoRow(project, store.bricks) : [], [project, store.bricks])
  const update = (patch: Partial<Project> | ((p: Project) => Partial<Project>)) => { if (project) store.updateProject(project.id, patch) }

  const openPick = (line?: string, detail?: string) => { setNote(line ? { line, detail } : null); setDialog('pick') }
  // Enter: propose, then create the project at once with the proposal record (picks `proposed`, the starting point first) in the first arrangement.
  // A new intent on a project's page is a new project; the old one stays under Projects.
  const run = async () => {
    const sent = intent.trim()
    if (!sent || busy) return
    if (enabled === false) return openPick(COPY.off)
    if (withRules.length === 0) return openPick(ready.length ? COPY.noRules : undefined)
    const call = ++req.current
    const lean: Lean = { chips: active, ...(anchorBrick ? { anchor_id: anchorBrick.id } : {}) }
    setBusy(true); setNote(null)
    const dry = import.meta.env.DEV && localStorage.getItem('tearsheet.dry') === '1'
    const out = await propose(sent, ready, dry, lean)
    if (call !== req.current) return
    setBusy(false)
    if (!out.ok) { if (out.disabled) setEnabled(false); return openPick(out.disabled ? COPY.off : COPY.noProposal, out.reason) }
    const first: ProposalPick[] = lean.anchor_id ? [{ brickId: lean.anchor_id, quotedRule: '', why: '', status: 'anchor' }] : []
    const picks = [...first, ...orderOwnFirst(out.picks.map((p): ProposalPick => ({ brickId: p.brickId, quotedRule: p.quotedRule, why: p.why, status: 'proposed' })), ready)].slice(0, MAX_BRICKS)
    const proposal: Proposal = { at: new Date().toISOString(), model: out.model, effort: out.effort, intent: sent, latency_ms: out.latency_ms, dropped: out.dropped, picks, ...(lean.chips.length || lean.anchor_id ? { lean } : {}), ...(out.ranking.length ? { ranking: out.ranking } : {}) }
    navigate(`/project/${store.createProject(sent, picks.map(p => p.brickId), autoName(sent) || undefined, { proposal })}`)
  }
  // by hand: on this project's page with its own intent, the picks replace its photos (a new version); otherwise they make a new project
  const pickDone = (ids: string[]) => {
    const sent = intent.trim()
    setDialog(null)
    if (project && sent === project.intent.trim()) update(p => ({ brickIds: ids, mutedBricks: Object.fromEntries(Object.entries(p.mutedBricks ?? {}).filter(([k]) => ids.includes(k))) as Record<string, true> }))
    else navigate(`/project/${store.createProject(sent, ids, autoName(sent) || undefined)}`)
  }

  if (id && !project) return <div className="chrome min-h-full"><div className="gutter mx-auto flex max-w-3xl flex-col gap-4 py-8"><p className="ink-2 m-0">{COPY.missing}</p><Link href="/projects" className="btn w-fit no-underline">{COPY.projects}</Link></div></div>
  const params = resolved ? (neutral ? { ...resolved.params, ...NEUTRAL_SKIN } : resolved.params) : null
  const menu = [
    ...(project ? [{ label: COPY.fineTune, onSelect: () => setDialog('tune') }] : []),
    { label: COPY.style, onSelect: () => setDialog('style'), disabled: withRules.length === 0 },
    ...(project ? [
      { label: COPY.arrangement, onSelect: () => setDialog('arrange'), disabled: project.brickIds.length < 2 },
      { label: COPY.neutral, onSelect: () => setNeutral(v => !v), pressed: neutral },
    ] : []),
    { label: COPY.pick, onSelect: () => openPick() },
    ...(project ? [{ label: COPY.rename, onSelect: () => setDialog('rename') }] : []),
  ]

  return (
    <div className="chrome min-h-full">
      <div className="gutter mx-auto flex w-full max-w-6xl flex-col gap-4 py-4">
        <div className="flex items-center gap-2">
          <input value={intent} disabled={busy} maxLength={300} autoFocus={!project} aria-label={COPY.field} placeholder={COPY.field}
            onChange={e => setIntent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void run() }}
            className="min-w-0 flex-1 rounded border px-3 py-2.5 text-[15px] hairline" style={{ color: 'var(--ink)', background: 'var(--panel)' }} />
          {project && resolved && <ShareMenu key={project.id} project={project} resolved={resolved} initialOpen={share} />}
          <MoreMenu label={COPY.more} items={menu} />
        </div>
        {(busy || (!project && (anchorBrick || !intent))) && (
          <div className="ink-2 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" aria-live="polite">
            {busy ? <span>{COPY.finding}</span> : !intent && !project && <span>{COPY.examples} <span style={{ color: 'var(--ink)' }}>{INTENT_EXAMPLES[example]}</span></span>}
            {anchorBrick && !project && (
              <span className="inline-flex items-center gap-1.5">{COPY.startingFrom} <Photo src={anchorBrick.photo.url} className="h-5 w-5 rounded object-cover" /><button type="button" className="btn btn-quiet px-1 py-0 text-[14px]" aria-label={COPY.clearAnchor} title={COPY.clearAnchor} onClick={() => setAnchor(null)}>×</button></span>
            )}
          </div>
        )}

        {project && resolved && params && (
          <>
            <ScaledScreens params={params} flash={flash} reserve={RESERVE} />
            <ul className="m-0 flex list-none flex-wrap justify-center gap-5 p-0" aria-label="Photos">
              {photos.map(({ brick, muted, label }) => (
                <li key={brick.id} className="group relative flex w-[104px] flex-col items-center gap-1.5">
                  <button type="button" aria-pressed={!muted} aria-label={`${label ?? photoLine(brick)}: ${muted ? 'off' : 'on'}`} title={muted ? COPY.turnOn : COPY.turnOff}
                    onClick={() => update(p => ({ mutedBricks: toggleMuted(p.mutedBricks, brick.id) }))}
                    className="cursor-pointer rounded border-0 bg-transparent p-0 transition-opacity" style={{ opacity: muted ? 0.35 : 1 }}>
                    <Photo src={brick.photo.url} className="block h-16 w-16 rounded object-cover" style={{ boxShadow: muted ? '0 0 0 1px var(--line)' : '0 0 0 2px var(--ink)' }} />
                  </button>
                  <span className="text-center text-[12px] leading-4" style={{ color: muted ? 'var(--ink-2)' : 'var(--ink)', textDecoration: muted ? 'line-through' : undefined }}>{label}</span>
                  <button type="button" className="btn absolute -right-2 -top-2 px-1.5 py-0.5 text-[12px] leading-none opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 max-md:opacity-100 [@media(hover:none)]:opacity-100"
                    aria-label={COPY.swap} title={COPY.swap} onClick={() => setDialog({ swap: brick.id })}>⇄</button>
                </li>
              ))}
            </ul>
            {resolved.unexpressed.length > 0 && (
              <Fold summary={COPY.couldnt(resolved.unexpressed.length)} className="self-center">
                <ul className="m-0 flex max-w-2xl list-none flex-col gap-2 p-0 text-[12px]">
                  {resolved.unexpressed.map((u, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="chip chip-adapted shrink-0 px-1.5 text-[10px]">{u.reason === 'fragile' ? 'fragile if changed' : 'no slot'}</span>
                      <span><Link href={`/brick/${u.brickId}`} className="mono ink-2">{u.brickId}</Link> {u.rule}<span className="ink-2 mt-0.5 block text-[11px]">{standInLine(u.rule)}</span></span>
                    </li>
                  ))}
                </ul>
              </Fold>
            )}
          </>
        )}
      </div>

      {dialog === 'tune' && project && resolved && (
        <Overlay full title={COPY.fineTune} onClose={() => setDialog(null)} actions={
          <div className="flex overflow-hidden rounded border hairline text-[12px]" role="group" aria-label="Screens">
            {(['list', 'review', 'both'] as const).map(s => <button key={s} type="button" aria-pressed={screen === s} onClick={() => setScreen(s)} className="cursor-pointer border-0 px-2 py-1" style={screen === s ? { background: 'var(--ink)', color: '#fff' } : { background: 'var(--panel)', color: 'var(--ink)' }}>{COPY[s]}</button>)}
          </div>}>
          <ComposePanel project={project} neutral={neutral} onNeutral={() => setNeutral(v => !v)} screen={screen} />
          <div className="flex flex-col gap-4 px-4 pb-8">
            <Fold summary={COPY.versions}><VersionList project={project} /></Fold>
            <Fold summary={COPY.files}><FilesView project={project} resolved={resolved} bricks={store.bricks} /></Fold>
          </div>
        </Overlay>
      )}
      {dialog === 'style' && (
        <AdjustStyle offered={offered} active={active} onChip={c => setChips(cs => cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c])}
          anchor={anchorBrick} anchorable={withRules} onAnchor={setAnchor} onClose={() => setDialog(null)} />
      )}
      {dialog === 'arrange' && project && <Arrangements project={project} onClose={() => setDialog(null)} onPick={order => { update({ brickIds: order }); setDialog(null) }} />}
      {dialog === 'rename' && project && <Rename initial={project.name || autoName(project.intent)} onClose={() => setDialog(null)} onSave={n => { update({ name: n }); setDialog(null) }} />}
      {dialog === 'pick' && (
        <PickMyself pool={ready} max={MAX_BRICKS} note={note} canCreate={!!intent.trim()} onClose={() => setDialog(null)} onDone={pickDone}
          initial={project && intent.trim() === project.intent.trim() ? project.brickIds : anchorBrick ? [anchorBrick.id] : pre ? [pre.id] : []} />
      )}
      {dialog && typeof dialog === 'object' && project && (
        <SwapPicker groups={swapGroups(project, ready, dialog.swap, store.bricks)} onClose={() => setDialog(null)} onPick={to => {
          const from = dialog.swap
          update(p => ({ brickIds: p.brickIds.map(b => b === from ? to : b), mutedBricks: Object.fromEntries(Object.entries(p.mutedBricks ?? {}).filter(([k]) => k !== from)) as Record<string, true> }))
          setDialog(null)
        }} />
      )}
    </div>
  )
}
