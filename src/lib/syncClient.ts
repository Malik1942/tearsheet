/** Browser side of Sync (PRD 7.3). The code lives in localStorage; the server holds the library under `libraries/<code>/`. */
import type { Brick } from './types'

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/
const KEY = 'tearsheet.sync'
/** Keep each request well under the 4 MB server limit (a 2048-side JPEG as base64 is usually 0.3–1.2 MB). */
const BATCH_BYTES = 3 * 1024 * 1024

export type SyncInfo = { code: string; last_synced?: string; server_count?: number }
export type Manifest = { code: string; updated_at: string; bricks: Brick[]; bytes: number }

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

/** S2: upload in batches sized by JSON length. Only bricks the server does not already hold at this version are sent. */
export async function push(code: string, bricks: Brick[], onProgress?: (sent: number, total: number) => void): Promise<Manifest> {
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
  let batch: Brick[] = [], size = 2
  const flush = async () => { if (!batch.length) return; manifest = await call('POST', code, { bricks: batch }); sent += batch.length; onProgress?.(sent, todo.length); batch = []; size = 2 }
  for (const b of todo) {
    const len = JSON.stringify(b).length + 1
    if (batch.length && size + len > BATCH_BYTES) await flush()
    batch.push(b); size += len
  }
  await flush()
  return manifest
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
