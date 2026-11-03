import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, usePath } from '../lib/router'
import { useStore } from '../lib/store'
import { useAddPhotos } from '../bricks/AddPhotos'
import { originOf } from '../lib/starters'
import { readingCount } from '../lib/addPhotos'
import { tabOf, type Tab } from '../lib/nav'
import { useModal } from './useModal'

const COPY = {
  library: 'Library',
  make: 'Make',
  shoot: 'Shoot',
  reading: (n: number) => `Shoot, ${n} ${n === 1 ? 'photo' : 'photos'} reading`,
  more: 'More',
  projects: 'Projects',
  sync: 'Sync',
  addMany: 'Add from library',
  /** SB3: the toggle that hides every starter (Library, proposals, Compose's swap and add lists). */
  includeStarters: 'Include starters',
  includeTitle: 'Starters fill your proposals only while you have fewer than three bricks of your own.',
  about: 'About',
  aboutTitle: 'About Tearsheet',
  aboutLine: 'Save photos you like the look of. Tearsheet reads what makes them work and carries it into screens you can share.',
  credits: 'Sample photos keep their credits:',
  creditsLink: 'Sample credits in the README',
  close: 'Close',
  dismiss: 'Dismiss',
  /** L11: the offline note, now a small pill in the header (was a text line on the Library). */
  offline: 'Offline',
  offlineTip: (waiting: number) => `Offline · ${waiting} waiting`,
  /** L11: the server's daily or hourly limit; the photos stay pending and are read on a later open. */
  limit: 'Daily limit',
  limitTip: 'Daily reading limit reached. Your photos are saved and will be read later.',
}

const CREDITS_URL = 'https://github.com/Malik1942/tearsheet#sample-credits'

/** 15_SIMPLIFY §1: one header above every screen (not the solo shell renders): wordmark · `Library` `Make` · `Shoot` · `⋯`.
 *  On a phone the tabs and Shoot move to a bottom bar, Shoot in the middle. */
export function AppChrome({ children }: { children: ReactNode }) {
  const path = usePath()
  const tab = tabOf(path)
  return (
    <div className="chrome flex min-h-full flex-col">
      <AppHeader tab={tab} />
      <AddNotice />
      <main className="with-bar flex min-w-0 flex-1 flex-col">{children}</main>
      <BottomBar tab={tab} />
    </div>
  )
}

function Tabs({ tab }: { tab: Tab }) {
  return (
    <>
      <Link href="/" className="tab" aria-current={tab === 'library' ? 'page' : undefined}>{COPY.library}</Link>
      <Link href="/make" className="tab" aria-current={tab === 'make' ? 'page' : undefined}>{COPY.make}</Link>
    </>
  )
}

/** The queue count rides on Shoot as a small badge ("3"), never as a text line. */
function ShootButton({ className = '' }: { className?: string }) {
  const store = useStore()
  const add = useAddPhotos()
  const n = readingCount(store.bricks, b => originOf(b) === 'own')
  return (
    <button type="button" className={`btn btn-accent shoot whitespace-nowrap ${className}`} onClick={add.shoot} aria-label={n ? COPY.reading(n) : undefined}>
      {COPY.shoot}{n > 0 && <span className="count-badge" aria-hidden>{n}</span>}
    </button>
  )
}

function AppHeader({ tab }: { tab: Tab }) {
  return (
    <header className="app-header gutter">
      <Link href="/" className="wordmark">Tearsheet</Link>
      <nav aria-label="Main" className="hidden items-center gap-5 md:flex"><Tabs tab={tab} /></nav>
      <div className="ml-auto flex items-center gap-3">
        <QueueStatus />
        {/* Make is one page about the result: Shoot sits in the header on the Library side only (the phone's bottom bar keeps it everywhere) */}
        {tab === 'library' && <ShootButton className="hidden md:inline-block" />}
        <MoreMenu />
      </div>
    </header>
  )
}

/** L11, moved off the Library: offline, or held at the server's limit, as one small pill; the sentence is its tooltip, and a tap shows it on touch. */
function QueueStatus() {
  const store = useStore()
  const [open, setOpen] = useState(false)
  const own = store.bricks.filter(b => originOf(b) === 'own' && !b.superseded_by)
  const waiting = own.filter(b => b.status === 'pending').length
  const limit = own.some(b => b.status === 'pending' && b.held === 'limit')
  const s = !store.online ? { label: COPY.offline, tip: COPY.offlineTip(waiting) } : limit ? { label: COPY.limit, tip: COPY.limitTip } : null
  if (!s) return null
  return (
    <span className="relative" aria-live="polite">
      <button type="button" className="status-pill" title={s.tip} aria-label={s.tip} aria-expanded={open} onClick={() => setOpen(v => !v)} onBlur={() => setOpen(false)}>{s.label}</button>
      {open && <span role="status" className="menu caption" style={{ minWidth: 200, padding: '8px 10px' }}>{s.tip}</span>}
    </span>
  )
}

function MoreMenu() {
  const store = useStore()
  const add = useAddPhotos()
  const [open, setOpen] = useState(false)
  const [about, setAbout] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); button.current?.focus(); return }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const items = [...(root.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
      const at = items.indexOf(document.activeElement as HTMLElement)
      items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
      e.preventDefault()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', keys)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keys) }
  }, [open])

  const close = () => setOpen(false)
  return (
    <div ref={root} className="relative">
      <button ref={button} type="button" className="btn btn-quiet" style={{ fontSize: 18, lineHeight: '16px', padding: '6px 10px' }} aria-haspopup="menu" aria-expanded={open} aria-label={COPY.more} title={COPY.more} onClick={() => setOpen(v => !v)}>⋯</button>
      {open && (
        <div role="menu" aria-label={COPY.more} className="menu">
          <Link role="menuitem" href="/projects" className="menu-item" onClick={close}>{COPY.projects}</Link>
          <Link role="menuitem" href="/sync" className="menu-item" onClick={close}>{COPY.sync}</Link>
          <button role="menuitem" type="button" className="menu-item" onClick={() => { close(); add.pickMany() }}>{COPY.addMany}</button>
          <div role="separator" className="menu-sep" />
          <button role="menuitemcheckbox" type="button" aria-checked={store.showStarters} className="menu-item" title={COPY.includeTitle} onClick={() => store.setShowStarters(!store.showStarters)}>
            {COPY.includeStarters}<span className="switch" data-on={store.showStarters || undefined} aria-hidden />
          </button>
          <div role="separator" className="menu-sep" />
          <button role="menuitem" type="button" className="menu-item" onClick={() => { close(); setAbout(true) }}>{COPY.about}</button>
        </div>
      )}
      <AboutSheet open={about} onClose={() => setAbout(false)} />
    </div>
  )
}

function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useModal(open)
  return (
    <dialog ref={ref} className="sheet sheet-center" aria-labelledby="about-title" onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="p-6">
        <h2 id="about-title" className="em">{COPY.aboutTitle}</h2>
        <p className="mt-2 max-w-[60ch]">{COPY.aboutLine}</p>
        <p className="ink-2 caption mt-2">{COPY.credits} <a href={CREDITS_URL} target="_blank" rel="noreferrer" className="underline">{COPY.creditsLink}</a>.</p>
        <div className="mt-5 flex justify-end"><button type="button" className="btn" onClick={onClose}>{COPY.close}</button></div>
      </div>
    </dialog>
  )
}

/** What went wrong while adding (a file that would not decode, a full library): one line under the header, on whatever screen Shoot was pressed. */
function AddNotice() {
  const { notice, dismiss } = useAddPhotos()
  if (!notice) return null
  return (
    <div role="status" className="notice gutter">
      <span className="min-w-0 flex-1">{notice}</span>
      <button type="button" className="btn btn-quiet" aria-label={COPY.dismiss} title={COPY.dismiss} onClick={dismiss}>×</button>
    </div>
  )
}

function BottomBar({ tab }: { tab: Tab }) {
  return (
    <nav aria-label="Main" className="bottom-bar">
      <Link href="/" className="tab justify-self-center" aria-current={tab === 'library' ? 'page' : undefined}>{COPY.library}</Link>
      <ShootButton />
      <Link href="/make" className="tab justify-self-center" aria-current={tab === 'make' ? 'page' : undefined}>{COPY.make}</Link>
    </nav>
  )
}
