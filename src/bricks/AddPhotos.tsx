import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { useStore, LIBRARY_CAP } from '../lib/store'
import { ACCEPT, prepareImage } from '../lib/client'
import { brickFromPhoto } from '../lib/addPhotos'

const COPY = {
  full: `The library holds ${LIBRARY_CAP} bricks. Remove one to add another.`,
  unreadable: (name: string, why: string) => `Could not read ${name}: ${why}`,
}

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

/** The one place photos come in (PRD L2, L3, L5): the header's Shoot, the phone's bottom bar and Add from library all open these two inputs.
 *  Each file is made upright and small, becomes a pending brick (`taken_at` from its EXIF when there is one), and goes in the store's queue. */
export function AddPhotosProvider({ children }: { children: ReactNode }) {
  const store = useStore()
  const shoot = useRef<HTMLInputElement>(null)
  const pick = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return
    setNotice(null)
    for (const file of Array.from(files)) {
      let prepared
      try { prepared = await prepareImage(file) } catch (e) { setNotice(COPY.unreadable(file.name, (e as Error).message)); continue }
      const brick = brickFromPhoto(prepared)
      if (!store.addBrick(brick)) { setNotice(COPY.full); break }
      store.enqueue(brick.id)
    }
  }

  const value: AddPhotos = { shoot: () => shoot.current?.click(), pickMany: () => pick.current?.click(), notice, dismiss: () => setNotice(null) }
  return (
    <Ctx.Provider value={value}>
      {children}
      {/* L2: capture opens the camera directly on iOS. L3: multiple, no capture, for the camera roll. Never list heic (L3). */}
      <input ref={shoot} type="file" accept={ACCEPT} capture="environment" className="hidden" aria-hidden tabIndex={-1} onChange={e => { onFiles(e.target.files); e.target.value = '' }} />
      <input ref={pick} type="file" accept={ACCEPT} multiple className="hidden" aria-hidden tabIndex={-1} onChange={e => { onFiles(e.target.files); e.target.value = '' }} />
    </Ctx.Provider>
  )
}

export function useAddPhotos(): AddPhotos {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAddPhotos outside AddPhotosProvider')
  return v
}
