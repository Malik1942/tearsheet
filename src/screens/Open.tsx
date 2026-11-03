import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { Link } from '../lib/router'
import { CODE_RE, normalizeCode, pull, runSync } from '../lib/syncClient'
import { openDestination } from '../lib/makeFlow'

const COPY = {
  opening: (code: string) => `Opening library ${code}…`,
  hint: 'Merging the bricks under this code into this device, then uploading what is only here.',
  badLink: 'This link has no valid library code.',
  empty: (code: string) => `Nothing is stored under ${code}. Check the link; this device keeps its own library and code.`,
  back: 'Back to library',
  sync: 'Open Sync',
}

/** S4: the deep link a phone shares, and E1's Share link. Adopts the code, merges the library (bricks and projects), then lands in the project
 *  (its Instructions page when the link says `to=instructions`, else 3 See) or the Library. */
export function OpenScreen() {
  const store = useStore()
  const params = new URLSearchParams(location.search)
  const code = normalizeCode(params.get('code') ?? '')
  const projectId = params.get('project')
  const [error, setError] = useState<string | null>(CODE_RE.test(code) ? null : COPY.badLink)
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!CODE_RE.test(code) || started.current) return
    started.current = true
    // an empty code is never adopted: a mistyped link must not take this device's library to a new code
    pull(code)
      .then(m => {
        if (!m.bricks.length && !(m.projects ?? []).length) throw new Error(COPY.empty(code))
        return runSync(code, store, (sent, total) => setProgress({ sent, total }))
      })
      .then(({ projects }) => {
        const known = !!projectId && (projects.some(p => p.id === projectId) || store.projects.some(p => p.id === projectId))
        // replace, not push: Back from the landed page must not return here and sync again. A Share link (to=instructions) lands on the Instructions page; See works at any width
        history.replaceState(null, '', openDestination(projectId, known, params.get('to')))
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
      .catch(e => setError((e as Error).message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="chrome min-h-full">
      <header className="flex items-center gap-3 border-b px-4 py-2 hairline" style={{ background: 'var(--panel)' }}>
        <Link href="/" className="font-semibold no-underline" style={{ color: 'var(--ink)' }}>Tearsheet</Link>
        <span className="ink-2">/ Open</span>
      </header>
      <div className="mx-auto max-w-md p-4">
        <section className="panel p-4" role="status" aria-live="polite">
          {error ? (
            <>
              <h1>{error}</h1>
              <div className="mt-4 flex gap-2"><Link href="/" className="btn">{COPY.back}</Link><Link href="/sync" className="btn btn-quiet">{COPY.sync}</Link></div>
            </>
          ) : (
            <>
              <h1><span className="mono tracking-[0.2em]" style={{ fontSize: 18 }}>{code}</span></h1>
              <p className="mt-2" style={{ color: 'var(--accent)' }}>{COPY.opening(code)}{progress?.total ? ` uploading ${progress.sent}/${progress.total}` : ''}</p>
              <p className="ink-2 mt-2 text-[12px]">{COPY.hint}</p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
