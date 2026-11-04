import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore, LIBRARY_CAP } from '../lib/store'
import { ACCEPT, prepareImage } from '../lib/client'
import { brickFromPhoto } from '../lib/addPhotos'

const COPY = {
  full: `The library holds ${LIBRARY_CAP} bricks. Remove one to add another.`,
  unreadable: (name: string, why: string) => `Could not read ${name}: ${why}`,
  notPhotos: 'Only JPEG, PNG and WebP photos can be saved.',
  drop: 'Drop to save',
  dropLine: "They're read as they land, like Shoot. ⌘V works too.",
}

const TYPES = ACCEPT.split(',')
const photosOf = (files: Iterable<File>) => [...files].filter(f => TYPES.includes(f.type))
/** Whether a drag or a paste carries files at all (a dragged link or text does not open the drop). */
const carriesFiles = (dt: DataTransfer | null) => !!dt && [...dt.types].includes('Files')

type AddPhotos = {
  /** L2: opens the camera directly on a phone (one photo). */
  shoot: () => void
  /** L3: several photos at once from the camera roll or disk. */
  pickMany: () => void
  /** The last thing that went wrong while adding (a file that would not decode, a full library), or null. */
  notice: string | null
  dismiss: () => void
}

const Ctx = createContext<AddPhotos | null>(null)

/** The one place photos come in (PRD L2, L3, L5): the header's Shoot, the phone's bottom bar and Add from library all open these two inputs, and on a
 *  desktop (Malik, 2026-11-04) photos dropped anywhere on the window or pasted (⌘V) come in the same way. Each file is made upright and small, becomes a
 *  pending brick (`taken_at` from its EXIF when there is one), and goes in the store's queue. */
export function AddPhotosProvider({ children }: { children: ReactNode }) {
  const store = useStore()
  const shoot = useRef<HTMLInputElement>(null)
  const pick = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [dragging, setDragging] = useState<number | null>(null)   // files over the window, or null

  const onFiles = async (files: Iterable<File> | null) => {
    if (!files) return
    const list = [...files]
    if (!list.length) return
    setNotice(null)
    for (const file of list) {
      let prepared
      try { prepared = await prepareImage(file) } catch (e) { setNotice(COPY.unreadable(file.name, (e as Error).message)); continue }
      const brick = brickFromPhoto(prepared)
      if (!store.addBrick(brick)) { setNotice(COPY.full); break }
      store.enqueue(brick.id)
    }
  }

  // drop anywhere on the window, or paste: the same path as Shoot. A drag that carries no files (a link, some text) is left to the page
  const files = useRef(onFiles)
  useEffect(() => { files.current = onFiles })
  useEffect(() => {
    let depth = 0
    const enter = (e: DragEvent) => { if (!carriesFiles(e.dataTransfer)) return; e.preventDefault(); depth++; setDragging([...(e.dataTransfer?.items ?? [])].filter(i => i.kind === 'file').length) }
    const over = (e: DragEvent) => { if (carriesFiles(e.dataTransfer)) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy' } }
    const leave = (e: DragEvent) => { if (!carriesFiles(e.dataTransfer)) return; depth = Math.max(0, depth - 1); if (depth === 0) setDragging(null) }
    const drop = (e: DragEvent) => {
      if (!carriesFiles(e.dataTransfer)) return
      e.preventDefault(); depth = 0; setDragging(null)
      const all = [...(e.dataTransfer?.files ?? [])], photos = photosOf(all)
      if (photos.length) void files.current(photos); else if (all.length) setNotice(COPY.notPhotos)
    }
    const paste = (e: ClipboardEvent) => {
      const photos = photosOf(e.clipboardData?.files ?? [])
      if (!photos.length) return   // text pastes into a field as before
      e.preventDefault(); void files.current(photos)
    }
    window.addEventListener('dragenter', enter); window.addEventListener('dragover', over); window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop); document.addEventListener('paste', paste)
    return () => {
      window.removeEventListener('dragenter', enter); window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop); document.removeEventListener('paste', paste)
    }
  }, [])

  const value: AddPhotos = { shoot: () => shoot.current?.click(), pickMany: () => pick.current?.click(), notice, dismiss: () => setNotice(null) }
  return (
    <Ctx.Provider value={value}>
      {children}
      {/* L2: capture opens the camera directly on iOS. L3: multiple, no capture, for the camera roll. Never list heic (L3). */}
      <input ref={shoot} type="file" accept={ACCEPT} capture="environment" className="hidden" aria-hidden tabIndex={-1} onChange={e => { onFiles(e.target.files); e.target.value = '' }} />
      <input ref={pick} type="file" accept={ACCEPT} multiple className="hidden" aria-hidden tabIndex={-1} onChange={e => { onFiles(e.target.files); e.target.value = '' }} />
      {dragging !== null && <DropOverlay count={dragging} />}
    </Ctx.Provider>
  )
}

export function useAddPhotos(): AddPhotos {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAddPhotos outside AddPhotosProvider')
  return v
}

/** While photos are dragged over the window: the page fades, the window shows its crop marks, and DROP TO SAVE stands over a small stack of sheets
 *  with the count (when the browser says how many). Decorative: it never takes the pointer, so the drop lands on the window. */
function DropOverlay({ count }: { count: number }) {
  const sheets = Math.min(3, Math.max(1, count))
  return (
    <div className="drop-overlay" aria-hidden="true">
      <i className="cm tl" /><i className="cm tr" /><i className="cm bl" /><i className="cm br" />
      <div className="drop-body">
        <div className="drop-stack">{Array.from({ length: sheets }, (_, i) => <span key={i} className="drop-sheet" />)}{count > 0 && <span className="drop-count tnum">{count}</span>}</div>
        <p className="display">{COPY.drop}</p>
        <p className="drop-line">{COPY.dropLine}</p>
      </div>
    </div>
  )
}

