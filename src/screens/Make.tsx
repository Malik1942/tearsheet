import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useStore } from '../lib/store'
import { Link, navigate } from '../lib/router'
import { Photo } from '../bricks/Photo'
import { propose, proposeEnabled } from '../lib/proposeClient'
import { orderOwnFirst, proposalPool } from '../lib/starters'
import { chipsFor, type Lean } from '../lib/lean'
import type { ChipId } from '../lib/leanFamilies'
import { resolveProject, type Project, type Proposal, type ProposalPick } from '../lib/mapRelations'
import { standInLine } from '../lib/standIns'
import { INTENT_EXAMPLES, NEUTRAL_SKIN, autoName, carryOver, photoLine, photoRow, toggleMuted } from '../lib/makeFlow'
import { useChangeFlash } from '../compose/useChangeFlash'
import { Fold, Overlay } from '../make/Steps'
import { ScaledScreens } from '../make/Screens'
import { toShellContent } from '../shell/content'
import { ShareMenu } from '../make/ShareMenu'
import { IntentField, StartPhotos } from '../make/Start'
import { AdjustStyle, Arrangements, PickMyself, Rename, SwapPicker, VersionList } from '../make/Dialogs'
import { swapGroups } from '../lib/swapSheet'
import { ComposePanel } from './Compose'
import { usePageActions } from '../chrome/pageActions'
import { FilesView } from './Export'

const MAX_BRICKS = 5
/** Autofocus the field on a desktop only: on a phone the keyboard would open over the page (Web Interface Guidelines). */
const finePointer = () => typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches
/** Space kept under the screens for the spread's bottom padding (24), the photo row and its line, so screens + photos fit one 1440x900 viewport. */
const RESERVE = 260
const COPY = {
  field: 'What are you making?',
  examples: 'Try',
  placeholder: 'Describe it in one sentence',
  finding: 'Looking through your photos…',
  off: 'Finding is off here. Pick them yourself.',
  noRules: 'Nothing here has a rule to quote yet. Pick them yourself.',
  noProposal: 'Nothing came back. Pick them yourself.',
  edit: 'Edit what you are making',
  fineTune: 'Fine-tune…', style: 'Adjust style…', arrangement: 'Try another arrangement…', neutral: 'Neutral skin', pick: 'Pick photos myself…', rename: 'Rename…',
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
 *  (`mutedBricks`, a new version, the change highlight). After Enter the intent is the page's headline; clicking it brings the field back (Malik, C+D).
 *  The header holds Share (Copy link, E1, and Download) and ⋯, whose first items are this page's: Fine-tune (today's Compose), Adjust style,
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
  const [editing, setEditing] = useState(false)
  const req = useRef(0)
  useEffect(() => { proposeEnabled().then(setEnabled) }, [])
  // the field holds the project's intent; moving to another project (or to /make) brings its own, and its lean
  const [shownId, setShownId] = useState(id)
  if (shownId !== id) {
    setShownId(id)
    setIntent(project?.intent ?? '')
    setEditing(false)
    if (project?.proposal?.lean) { setChips(project.proposal.lean.chips as ChipId[]); setAnchor(project.proposal.lean.anchor_id ?? null) }
  }

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
  const carried = useMemo(() => resolved ? carryOver(resolved.unexpressed) : [], [resolved])
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
    // the starting point is never proposed twice: when the model also picks it, the anchor entry stands for it
    const proposed = out.picks.filter(p => p.brickId !== lean.anchor_id).map((p): ProposalPick => ({ brickId: p.brickId, quotedRule: p.quotedRule, why: p.why, status: 'proposed' }))
    const picks = [...first, ...orderOwnFirst(proposed, ready)].slice(0, MAX_BRICKS)
    const proposal: Proposal = { at: new Date().toISOString(), model: out.model, effort: out.effort, intent: sent, latency_ms: out.latency_ms, dropped: out.dropped, picks, ...(lean.chips.length || lean.anchor_id ? { lean } : {}), ...(out.ranking.length ? { ranking: out.ranking } : {}) }
    navigate(`/project/${store.createProject(sent, picks.map(p => p.brickId), autoName(sent) || undefined, { proposal, ...(out.content ? { content: out.content } : {}) })}`)
  }
  // by hand: on this project's page with its own intent, the picks replace its photos (a new version); otherwise they make a new project
  const pickDone = (ids: string[]) => {
    const sent = intent.trim()
    setDialog(null)
    if (project && sent === project.intent.trim()) update(p => ({ brickIds: ids, mutedBricks: Object.fromEntries(Object.entries(p.mutedBricks ?? {}).filter(([k]) => ids.includes(k))) as Record<string, true> }))
    else navigate(`/project/${store.createProject(sent, ids, autoName(sent) || undefined)}`)
  }

  const menu = [
    ...(project ? [{ label: COPY.fineTune, onSelect: () => setDialog('tune') }] : []),
    { label: COPY.style, onSelect: () => setDialog('style'), disabled: withRules.length === 0, sep: !!project },
    ...(project ? [
      { label: COPY.arrangement, onSelect: () => setDialog('arrange'), disabled: project.brickIds.length < 2 },
      { label: COPY.neutral, onSelect: () => setNeutral(v => !v), pressed: neutral },
    ] : []),
    { label: COPY.pick, onSelect: () => openPick(), sep: true },
    ...(project ? [{ label: COPY.rename, onSelect: () => setDialog('rename') }] : []),
  ]
  // C+D, as a rule: the header's right side holds this page's one primary action, Share, then ⋯ with this page's items first
  usePageActions({ primary: project && resolved ? <ShareMenu key={project.id} project={project} resolved={resolved} initialOpen={share} /> : undefined, items: menu })

  if (id && !project) return <div className="chrome min-h-full"><div className="gutter mx-auto flex max-w-3xl flex-col gap-4 py-8"><p className="ink-2 m-0">{COPY.missing}</p><Link href="/projects" className="btn w-fit no-underline">{COPY.projects}</Link></div></div>
  const params = resolved ? (neutral ? { ...resolved.params, ...NEUTRAL_SKIN } : resolved.params) : null
  const headline = !!project && !editing && !busy

  return (
    <div className="chrome min-h-full">
      <div className="gutter mx-auto flex w-full max-w-6xl flex-col gap-4 py-4">
        {project && !headline && <h1 className="sr-only">{project.intent}</h1>}
        {!project ? (
          // before Enter (Malik, 2026-11-03): the question, a large field with its action, examples to tap, and the photos to start from as large blocks
          <div className="make-start">
            <h1 className="intent-headline">{COPY.field}</h1>
            <IntentField value={intent} onChange={setIntent} onSubmit={() => void run()} busy={busy} label={COPY.field} placeholder={COPY.placeholder} autoFocus={finePointer()} primary />
            {!busy && (
              <div className="intent-examples">
                <span className="ink-2 caption">{COPY.examples}</span>
                {INTENT_EXAMPLES.map(x => <button key={x} type="button" className="btn" onClick={() => setIntent(x)}>{x}</button>)}
              </div>
            )}
            {!busy && withRules.length > 0 && <StartPhotos bricks={withRules} anchorId={anchorBrick?.id ?? null} onAnchor={setAnchor} onAll={() => setDialog('style')} />}
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[680px] items-center gap-2">
            {headline ? (
              // after Enter the intent is the page's headline; clicking it brings the field back, where Enter proposes again and Escape puts the headline back
              <h1 className="intent-headline"><button type="button" className="intent-edit" title={COPY.edit} onClick={() => setEditing(true)}>{project.intent}<span className="sr-only">{` (${COPY.edit.toLowerCase()})`}</span></button></h1>
            ) : (
              <IntentField value={intent} onChange={setIntent} onSubmit={() => void run()} busy={busy} label={COPY.field} placeholder={COPY.placeholder} autoFocus={editing}
                onEscape={() => { setIntent(project.intent); setEditing(false) }} onLeave={() => { if (intent.trim() === project.intent.trim()) setEditing(false) }} />
            )}
          </div>
        )}
        <div className="sr-only" aria-live="polite">{busy ? COPY.finding : ''}</div>

        {busy && (
          // while the photos are found: the two frames at their final size and the photo slots, quiet, so the result lands where the eye already is
          <div aria-hidden="true" className="flex flex-col items-center gap-4">
            <div className="finding pulse w-full">
              <div className="finding-frame" style={{ width: 300, height: 600, maxWidth: '100%' }}>{COPY.finding}</div>
              <div className="finding-frame" style={{ width: 300, height: 600 }} />
            </div>
            <div className="photo-row pulse">{[0, 1, 2].map(i => <div key={i} className="mx-auto h-16 w-16 rounded" style={{ background: 'color-mix(in oklab, var(--ink) 8%, var(--paper))' }} />)}</div>
          </div>
        )}

        {!busy && project && resolved && params && (
          <>
            {/* C+D: the two screens are a spread on paper with crop marks, never on a red block (DESIGN_SYSTEM.md §8, do and don't 4) */}
            <div className="make-spread crop-marks"><ScaledScreens params={params} flash={flash} reserve={RESERVE} content={toShellContent(project.content)} /></div>
            {/* each photo is one switch: the thumbnail (its ring shows on or off) and its label in one target. The slots are fixed, so a photo never moves when another one appears */}
            <div className="photo-dock">
              <ul className="photo-row" style={{ '--slots': Math.max(3, photos.length) } as CSSProperties} aria-label="Photos">
                {photos.map(({ brick, muted, label }) => {
                  const why = project.proposal?.picks.find(p => p.brickId === brick.id)?.why
                  return (
                    <li key={brick.id} className="photo-cell">
                      <button type="button" className="photo-switch" aria-pressed={!muted} aria-label={label ?? photoLine(brick)} title={why || (muted ? COPY.turnOn : COPY.turnOff)}
                        onClick={() => update(p => ({ mutedBricks: toggleMuted(p.mutedBricks, brick.id) }))}>
                        <Photo src={brick.photo.url} alt="" />
                        <span className="photo-label">{label}</span>
                      </button>
                      <span className="photo-meta tnum">{photoLine(brick)}</span>
                      <button type="button" className="photo-swap icon-btn" aria-label={`${COPY.swap}: ${label ?? photoLine(brick)}`} title={COPY.swap} onClick={() => setDialog({ swap: brick.id })}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5.5h9.5L10 3M13 10.5H3.5L6 13" /></svg>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            {carried.length > 0 && (
              // C+D §12.6–7: only the rules with no slot couldn't carry over (the fragile notes stay in Fine-tune and the handoff), grouped by photo, one line each
              <Fold summary={COPY.couldnt(carried.reduce((n, g) => n + g.items.length, 0))} className="w-full text-center">
                <ul className="mx-auto m-0 flex max-w-2xl list-none flex-col gap-3 p-0 text-left text-[12px]">
                  {carried.map(({ brickId, items }) => {
                    const from = store.bricks.find(b => b.id === brickId)
                    return (
                      <li key={brickId} className="flex items-start gap-3">
                        {from && <Link href={`/brick/${brickId}`} className="shrink-0" aria-label={`The photo it comes from, ${photoLine(from)}`}><Photo src={from.photo.url} alt="" className="h-8 w-8 object-cover" /></Link>}
                        <ul className="m-0 flex list-none flex-col gap-2 p-0">
                          {items.map((u, i) => <li key={i}>{u.rule}<span className="ink-2 mt-0.5 block text-[11px]">{standInLine(u.rule)}</span></li>)}
                        </ul>
                      </li>
                    )
                  })}
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
