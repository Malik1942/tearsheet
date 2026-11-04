/** Shell item 3 (Malik, 2026-11-03): the device details inside each phone frame. A 44 px status bar, a 49 px tab bar of three and a 34 px home indicator,
 *  drawn in currentColor so the skin colors them (shell.css). They read the skin and change no parameter. Their text is at caption size, a size every
 *  screen already uses, so a screen keeps three type sizes (layout contract rule 3). */

/** The tab icons, a fixed mapping: list, chart, person (lucide `list`, `chart-column`, `user`, ISC license), at 24 units drawn 22 px. */
const TAB_ICONS = [
  { id: 'list', paths: ['M3 12h.01', 'M3 18h.01', 'M3 6h.01', 'M8 12h13', 'M8 18h13', 'M8 6h13'] },
  { id: 'chart', paths: ['M3 3v16a2 2 0 0 0 2 2h16', 'M18 17V9', 'M13 17V5', 'M8 17v-3'] },
  { id: 'person', paths: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'] },
] as const

/** 9:41, signal and battery. Decorative, so hidden from assistive technology. */
export function StatusBar() {
  return (
    <div className="status-bar" aria-hidden="true">
      <span className="status-time">9:41</span>
      <span className="status-icons">
        <svg data-icon="signal" viewBox="0 0 18 12" width="18" height="12"><path d="M1 10h2v1H1zM5.5 7.5h2V11h-2zM10 5h2v6h-2zM14.5 2h2v9h-2z" fill="currentColor" /></svg>
        <svg data-icon="battery" viewBox="0 0 26 12" width="26" height="12"><rect x="0.75" y="0.75" width="21.5" height="10.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" /><rect x="2.5" y="2.5" width="16" height="7" rx="1.5" fill="currentColor" /><path d="M24 4v4a2 2 0 0 0 0-4z" fill="currentColor" opacity="0.5" /></svg>
      </span>
    </div>
  )
}

/** Three tabs; `active` is the one this screen belongs to. `staticRender` draws them as spans with the same class, for a copy inside a button or a link. */
export function TabBar({ labels, active, staticRender }: { labels: readonly [string, string, string]; active: 0 | 1 | 2; staticRender: boolean }) {
  return (
    <nav className="tab-bar" aria-label="Tabs">
      {TAB_ICONS.map((icon, i) => {
        const inside = (
          <>
            <svg className="tab-icon" data-icon={icon.id} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {icon.paths.map(d => <path key={d} d={d} />)}
            </svg>
            <span className="tab-label">{labels[i]}</span>
          </>
        )
        return staticRender
          ? <span key={icon.id} className="tab-item" data-active={i === active}>{inside}</span>
          : <button key={icon.id} type="button" className="tab-item" data-active={i === active} aria-current={i === active ? 'page' : undefined}>{inside}</button>
      })}
    </nav>
  )
}

export const HomeIndicator = () => <div className="home-indicator" aria-hidden="true"><span></span></div>
