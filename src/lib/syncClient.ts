/** Browser side of Sync (PRD 7.3). The code lives in localStorage; the server holds the library under `libraries/<code>/`. */
import type { Brick } from './types'
import type { Project } from './mapRelations'
import { fitProjectForSync } from './versions'

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/
const KEY = 'tearsheet.sync'
/** Keep each request well under the 4 MB server limit (a 2048-side JPEG as base64 is usually 0.3–1.2 MB). */
const BATCH_BYTES = 3 * 1024 * 1024

export type SyncInfo = { code: string; last_synced?: string; server_count?: number }
export type Manifest = { code: string; updated_at: string; bricks: Brick[]; projects?: Project[]; bytes: number }

export function readSync(): SyncInfo | null {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
export function writeSync(info: SyncInfo | null) {
  try { info ? localStorage.setItem(KEY, JSON.stringify(info)) : localStorage.removeItem(KEY) } catch { /* private mode */ }
}

/** S1: six characters, generated here, unambiguous alphabet. */
export function generateCode(): string {
  const a = new Uint8Array(6); crypto.getRandomValues(a)
  return [...a].map(n => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('')
}
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z2-9]/g, '').replace(/[OI01]/g, '').slice(0, 6)

async function call(method: string, code: string, body?: unknown): Promise<Manifest> {
  const res = await fetch(`/api/sync/${code}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`)
  return json as Manifest
}

export const pull = (code: string) => call('GET', code)
export const forget = (code: string) => call('DELETE', code)

/** S2: upload in batches sized by JSON length. Only bricks the server does not already hold at this version are sent; the projects
 *  (small JSON) go with the first batch, or alone when every brick is already there. */
export async function push(code: string, bricks: Brick[], allProjects: Project[], onProgress?: (sent: number, total: number) => void): Promise<Manifest> {
  // the server holds at most 50 projects per code: send the most recently edited. A long history is trimmed in the copy that is sent (C9); the local project keeps it.
  const projects = [...allProjects].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)).slice(0, 50).map(p => fitProjectForSync(p))
  let manifest = await pull(code)
  const held = new Map(manifest.bricks.map(b => [b.id, b]))
  const todo = bricks.filter(b => {
    const h = held.get(b.id)
    if (!h) return true
    const vb = b.version ?? 1, vh = h.version ?? 1
    return vb > vh || (b.status === 'ready' && h.status !== 'ready') || (!!b.superseded_by && !h.superseded_by)
  })
  let sent = 0
  onProgress?.(0, todo.length)
  // The first POST carries the projects, so they count toward its size; if they leave no room for the next brick they go alone first.
  const projectsBytes = projects.length ? JSON.stringify(projects).length + 12 : 0   // + the `"projects":` key and its comma
  let batch: Brick[] = [], size = 2 + projectsBytes, projectsSent = false
  const flush = async () => {
    if (!batch.length && (projectsSent || !projects.length)) return
    manifest = await call('POST', code, { bricks: batch, ...(projectsSent ? {} : { projects }) }); projectsSent = true
    sent += batch.length; onProgress?.(sent, todo.length); batch = []; size = 2
  }
  for (const b of todo) {
    const len = JSON.stringify(b).length + 1
    if (size + len > BATCH_BYTES) await flush()
    batch.push(b); size += len
  }
  if (batch.length) await flush()
  if (!projectsSent && projects.length) manifest = await call('POST', code, { bricks: [], projects })
  return manifest
}

export type SyncStore = { bricks: Brick[]; projects: Project[]; mergeBricks: (b: Brick[]) => number; mergeProjects: (p: Project[]) => number }

/** One sync, used by /sync, /open and the project footer: pull and merge, push what the store lacks, merge the answer, remember the code.
 *  Returns how many bricks the code holds and how many items changed on this device. */
export async function runSync(code: string, store: SyncStore, onProgress?: (sent: number, total: number) => void): Promise<{ info: SyncInfo; live: number; got: number; projects: Project[] }> {
  const before = await pull(code)
  let got = store.mergeBricks(before.bricks) + store.mergeProjects(before.projects ?? [])
  const local = store.bricks.filter(b => b.status !== 'extracting')
  const after = await push(code, local, store.projects, onProgress)
  got += store.mergeBricks(after.bricks) + store.mergeProjects(after.projects ?? [])
  const live = after.bricks.filter(b => !b.superseded_by).length
  const info: SyncInfo = { code, last_synced: new Date().toISOString(), server_count: live }
  writeSync(info)
  return { info, live, got, projects: after.projects ?? [] }
}

/** S4: the deep link a phone hands to a desktop. Opens the library under the code and, when given, lands in that project. */
export const openLink = (code: string, projectId?: string) => `${location.origin}/open?code=${code}${projectId ? `&project=${encodeURIComponent(projectId)}` : ''}`

export const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'

/** S5: the system share sheet where there is one (phones), the clipboard elsewhere. */
export async function shareLink(url: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (canShare()) {
    try { await navigator.share({ url }); return 'shared' } catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled' }
  }
  try { await navigator.clipboard.writeText(url); return 'copied' } catch { return 'failed' }
}

const isBlobUrl = (u: string) => /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(u)

/** Before a code is forgotten its images go away, so any local brick that points at them is inlined first. */
export async function inlineBlobPhotos(bricks: Brick[]): Promise<Brick[]> {
  return Promise.all(bricks.map(async b => {
    if (!isBlobUrl(b.photo.url)) return b
    try {
      const blob = await fetch(b.photo.url).then(r => r.blob())
      const url = await new Promise<string>((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = no; fr.readAsDataURL(blob) })
      return { ...b, photo: { ...b.photo, url } }
    } catch { return b }
  }))
}
