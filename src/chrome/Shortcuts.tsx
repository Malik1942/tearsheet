import { useModal } from './useModal'

const COPY = {
  title: 'Keyboard shortcuts',
  close: 'Close',
  rows: [['1', 'Library'], ['2', 'Make'], ['N', 'Shoot'], ['⌘ V', 'Save a copied photo'], null, ['← →', 'Previous or next photo'], ['Esc', 'Close a sheet'], ['?', 'This list']] as ([string, string] | null)[],
}

/** The list of shortcuts, as a centered sheet like About. */
export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useModal(open)
  return (
    <dialog ref={ref} className="sheet sheet-center shortcuts-sheet" aria-labelledby="shortcuts-title" onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 id="shortcuts-title" className="em">{COPY.title}</h2>
          <button type="button" className="btn btn-quiet icon-btn" aria-label={COPY.close} title={COPY.close} onClick={onClose}>×</button>
        </div>
        <dl className="shortcuts">
          {COPY.rows.map((r, i) => r
            ? <div key={r[0]} className="contents"><dt>{r[0].split(' ').map(k => <kbd key={k} className="kbd">{k}</kbd>)}</dt><dd>{r[1]}</dd></div>
            : <hr key={`sep-${i}`} />)}
        </dl>
      </div>
    </dialog>
  )
}
