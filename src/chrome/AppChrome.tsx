import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreIcon } from '../make/Steps'
import { Link, usePath } from '../lib/router'
import { useStore } from '../lib/store'
import { useAddPhotos } from '../bricks/AddPhotos'
import { originOf } from '../lib/starters'
import { readingCount } from '../lib/addPhotos'
import { tabOf, volumeOf, type Tab } from '../lib/nav'
import { useModal } from './useModal'
import { PageActionsProvider, usePageActionsValue, type PageMenuItem } from './pageActions'
import { Lockup } from '../brand/Lockup'
import { useInstall } from './install'
import { ShortcutsSheet } from './Shortcuts'
import { useShortcuts } from './useShortcuts'

const COPY = {
  library: 'Library',
  make: 'Make',
  shoot: 'Shoot',
  reading: (n: number) => `Shoot, ${n} ${n === 1 ? 'photo' : 'photos'} reading`,
  more: 'More',
  projects: 'Projects',
  sync: 'Sync',
  addMany: 'Add from library…',
  /** SB3: the toggle that hides every starter (Library, proposals, Compose's swap and add lists). */
  includeStarters: 'Include starters',
  includeTitle: 'Starters fill your proposals only while you have fewer than three bricks of your own.',
  install: 'Install Tearsheet',
  installHint: 'Own window',
  installSafari: 'In Safari, choose File › Add to Dock. Tearsheet opens in its own window from the Dock.',
  shortcuts: 'Keyboard shortcuts',
  about: 'About…',
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

/** 15_SIMPLIFY §1: one header above every screen (not the solo shell renders): wordmark · `Library` `Make` · the page's primary action · `⋯`.
 *  On a phone the tabs and Shoot move to a bottom bar, Shoot in the middle. */
export function AppChrome({ children }: { children: ReactNode }) {
  const path = usePath()
  const tab = tabOf(path)
  const add = useAddPhotos()
  const [help, setHelp] = useState(false)
  const showHelp = useCallback(() => setHelp(true), [])
  useShortcuts({ onShoot: add.shoot, onHelp: showHelp })
  return (
    <PageActionsProvider>
      <div className="chrome flex min-h-full flex-col" data-volume={volumeOf(path)}>
        <a href="#content" className="skip-link">Skip to content</a>
        <AppHeader tab={tab} onShortcuts={showHelp} />
        <AddNotice />
        <main id="content" tabIndex={-1} className="with-bar flex min-w-0 flex-1 flex-col outline-none">{children}</main>
        <BottomBar tab={tab} />
        <ShortcutsSheet open={help} onClose={() => setHelp(false)} />
      </div>
    </PageActionsProvider>
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

/** A camera (lucide `camera`, ISC), drawn in currentColor. */
const CameraIcon = () => (
  <svg className="shoot-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" />
  </svg>
)

/** The phone's tab bar glyphs, drawn like the camera: the Library a grid of photos (lucide `layout-grid`, ISC), Make the spread of two screens. */
const GridIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
)
const SpreadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="8" height="18" x="2.5" y="3" rx="2" /><rect width="8" height="18" x="13.5" y="3" rx="2" />
  </svg>
)

/** Shoot is a camera (Malik, 2026-11-03: an icon, not plain text): the camera beside its word in the header; in the phone's tab bar (`bar`) the middle item,
 *  a shutter with no word showing (2026-11-04), its word kept for a screen reader. The queue count rides on it as a small badge ("3"), never as a text line. */
function ShootButton({ className = '', bar = false }: { className?: string; bar?: boolean }) {
  const store = useStore()
  const add = useAddPhotos()
  const n = readingCount(store.bricks, b => originOf(b) === 'own')
  if (bar) return (
    <button type="button" className={`bar-item bar-shoot ${className}`} onClick={add.shoot} aria-label={n ? COPY.reading(n) : undefined}>
      <span className="shutter"><CameraIcon />{n > 0 && <span className="count-badge" aria-hidden>{n}</span>}</span><span className="sr-only">{COPY.shoot}</span>
    </button>
  )
  return (
    <button type="button" className={`btn btn-accent shoot whitespace-nowrap ${className}`} onClick={add.shoot} aria-label={n ? COPY.reading(n) : undefined} title={COPY.shoot}>
      <CameraIcon /><span className="shoot-label">{COPY.shoot}</span>{n > 0 && <span className="count-badge" aria-hidden>{n}</span>}
    </button>
  )
}

function AppHeader({ tab, onShortcuts }: { tab: Tab; onShortcuts: () => void }) {
  const page = usePageActionsValue()
  return (
    // the front page's nameplate (Malik, 2026-11-04): the lockup centered, its tear ultramarine, the sections at the left, the page's actions at the right
    <header className="app-header gutter">
      <Link href="/" className="wordmark" aria-label="Tearsheet"><Lockup mark="var(--trace)" /></Link>
      <nav aria-label="Main" className="header-sections hidden items-center gap-5 md:flex"><Tabs tab={tab} /></nav>
      {/* relative: on a phone the page's popover (Share) hangs from this group, so it ends at the gutter */}
      <div className="header-actions relative flex items-center gap-3">
        <QueueStatus />
        {/* C+D, as a rule: the right side holds the page's single primary action, then ⋯. Shoot on the Library side (the phone's bottom bar keeps it
            everywhere); Share on Make, which also puts its menu items at the top of this ⋯ */}
        {tab === 'library' && <ShootButton className="hidden md:inline-flex" />}
        {page.primary}
        <MoreMenu pageItems={page.items ?? []} onShortcuts={onShortcuts} />
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

function MoreMenu({ pageItems, onShortcuts }: { pageItems: PageMenuItem[]; onShortcuts: () => void }) {
  const store = useStore()
  const add = useAddPhotos()
  const app = useInstall()
  const [open, setOpen] = useState(false)
  const [about, setAbout] = useState(false)
  const [safariHint, setSafariHint] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLElement>('[role^="menuitem"]:not(:disabled)')?.focus()
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); button.current?.focus(); return }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const items = [...(root.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [])]
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
      <button ref={button} type="button" className="btn btn-quiet icon-btn" aria-haspopup="menu" aria-expanded={open} aria-label={COPY.more} title={COPY.more} onClick={() => setOpen(v => !v)}><MoreIcon /></button>
      {open && (
        <div role="menu" aria-label={COPY.more} className="menu">
          {pageItems.map(it => (
            <div key={it.label} className="contents">
              {it.sep && <div className="menu-sep" role="separator" />}
              <button type="button" role={it.pressed === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={it.pressed} disabled={it.disabled}
                className="menu-item disabled:cursor-default disabled:opacity-50" onClick={() => { close(); it.onSelect() }}>
                <span>{it.label}</span>{it.pressed !== undefined && <span className="switch" data-on={it.pressed || undefined} aria-hidden />}
              </button>
            </div>
          ))}
          {pageItems.length > 0 && <div role="separator" className="menu-sep" />}
          <Link role="menuitem" href="/projects" className="menu-item" onClick={close}>{COPY.projects}</Link>
          <Link role="menuitem" href="/sync" className="menu-item" onClick={close}>{COPY.sync}</Link>
          <button role="menuitem" type="button" className="menu-item" onClick={() => { close(); add.pickMany() }}>{COPY.addMany}</button>
          <div role="separator" className="menu-sep" />
          <button role="menuitemcheckbox" type="button" aria-checked={store.showStarters} className="menu-item" title={COPY.includeTitle} onClick={() => store.setShowStarters(!store.showStarters)}>
            {COPY.includeStarters}<span className="switch" data-on={store.showStarters || undefined} aria-hidden />
          </button>
          <div role="separator" className="menu-sep" />
          {/* the desktop's app items (Malik, 2026-11-04): install where the browser can, and the keys; a phone has neither */}
          {app.kind !== 'none' && (
            <button role="menuitem" type="button" className="menu-item desktop-only" onClick={() => { close(); if (app.kind === 'prompt') void app.install(); else setSafariHint(true) }}>
              <span>{COPY.install}</span><span className="ink-2 caption">{COPY.installHint}</span>
            </button>
          )}
          <button role="menuitem" type="button" className="menu-item desktop-only" onClick={() => { close(); onShortcuts() }}><span>{COPY.shortcuts}</span><kbd className="kbd">?</kbd></button>
          <button role="menuitem" type="button" className="menu-item" onClick={() => { close(); setAbout(true) }}>{COPY.about}</button>
        </div>
      )}
      <AboutSheet open={about} onClose={() => setAbout(false)} />
      <NoteSheet open={safariHint} title={COPY.install} line={COPY.installSafari} onClose={() => setSafariHint(false)} />
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

/** One sentence in a centered sheet, as About: how Safari installs the app. */
function NoteSheet({ open, title, line, onClose }: { open: boolean; title: string; line: string; onClose: () => void }) {
  const ref = useModal(open)
  return (
    <dialog ref={ref} className="sheet sheet-center" aria-labelledby="note-title" onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="p-6">
        <h2 id="note-title" className="em">{title}</h2>
        <p className="mt-2 max-w-[60ch]">{line}</p>
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
      <button type="button" className="btn btn-quiet icon-btn" aria-label={COPY.dismiss} title={COPY.dismiss} onClick={dismiss}>×</button>
    </div>
  )
}

function BottomBar({ tab }: { tab: Tab }) {
  return (
    <nav aria-label="Main" className="bottom-bar">
      <Link href="/" className="bar-item" aria-current={tab === 'library' ? 'page' : undefined}><GridIcon /><span>{COPY.library}</span></Link>
      <ShootButton bar className={tab === 'library' ? '' : 'shoot-quiet'} />
      <Link href="/make" className="bar-item" aria-current={tab === 'make' ? 'page' : undefined}><SpreadIcon /><span>{COPY.make}</span></Link>
    </nav>
  )
}
