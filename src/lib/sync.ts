/** Sync (PRD 7.3): one six-character code is the only key to a library. Shared by the Vercel function (api/sync/[code].ts) and the
 *  Vite dev middleware. Runs on the server only. Store: Vercel Blob, prefix `libraries/<code>/`, auth by the function's OIDC token
 *  plus BLOB_STORE_ID (no long-lived token anywhere). No listing endpoint, no index: a code that nobody enters is unreachable. */
import { del, list, put } from '@vercel/blob'
import type { Brick } from './types.js'
import type { Project } from './mapRelations.js'

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/
export const CAP_BRICKS = 60
export const CAP_BYTES = 40 * 1024 * 1024
export const MAX_BODY = 4 * 1024 * 1024

export type Manifest = { code: string; updated_at: string; bricks: Brick[]; projects: Project[]; bytes: number }
export const CAP_PROJECTS = 50
const MAX_PROJECT_JSON = 64 * 1024

const prefix = (code: string) => `libraries/${code}/`
const manifestPath = (code: string) => `${prefix(code)}manifest.json`

/** What the prefix holds, by listing (the store API, not the CDN): bytes, every URL, and the manifest blob if any. Paginated. */
async function held(code: string): Promise<{ bytes: number; urls: string[]; manifest?: { url: string; etag: string } }> {
  let cursor: string | undefined, bytes = 0, manifest: { url: string; etag: string } | undefined
  const urls: string[] = []
  do {
    const page = await list({ prefix: prefix(code), cursor, limit: 1000 })
    for (const b of page.blobs) { bytes += b.size; urls.push(b.url); if (b.pathname === manifestPath(code)) manifest = { url: b.url, etag: b.etag } }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return { bytes, urls, manifest }
}

/** The manifest is fetched by its listed URL with the ETag as a cache-buster, so an overwrite or a delete is seen at once
 *  instead of after the CDN's 60 s. */
async function readManifest(code: string, h?: Awaited<ReturnType<typeof held>>): Promise<Manifest> {
  const empty: Manifest = { code, updated_at: '', bricks: [], projects: [], bytes: 0 }
  const got = h ?? await held(code)
  if (!got.manifest) return empty
  const res = await fetch(`${got.manifest.url}?e=${encodeURIComponent(got.manifest.etag)}`, { cache: 'no-store' })
  if (res.status === 404) return empty
  if (!res.ok) throw new Error(`manifest read failed: HTTP ${res.status}`)
  const m = await res.json() as Manifest
  return { ...empty, ...m, code, bytes: got.bytes }
}

/** S3: merge by brick id, newest version wins; on the same version a ready brick beats a pending one, and a superseded link is kept. */
export function mergeBricks(existing: Brick[], incoming: Brick[]): Brick[] {
  const byId = new Map(existing.map(b => [b.id, b]))
  for (const inc of incoming) {
    const cur = byId.get(inc.id)
    if (!cur) { byId.set(inc.id, inc); continue }
    const vi = inc.version ?? 1, vc = cur.version ?? 1
    const incWins = vi > vc || (vi === vc && inc.status === 'ready' && cur.status !== 'ready')
    const merged = incWins ? { ...cur, ...inc } : { ...inc, ...cur }
    merged.superseded_by = cur.superseded_by ?? inc.superseded_by
    byId.set(inc.id, merged)
  }
  return [...byId.values()]
}

/** Projects ride along with the bricks they point at (small JSON, no photo): merge by id, the newest `updatedAt` wins. */
export function mergeProjects(existing: Project[], incoming: Project[]): Project[] {
  const byId = new Map(existing.map(p => [p.id, p]))
  for (const inc of incoming) {
    const cur = byId.get(inc.id)
    if (!cur || (inc.updatedAt ?? inc.createdAt ?? '') >= (cur.updatedAt ?? cur.createdAt ?? '')) byId.set(inc.id, inc)
  }
  return [...byId.values()]
}

const isDataJpeg = (u: string) => u.startsWith('data:image/jpeg;base64,')

export async function handleSync(method: string, code: string, body: unknown): Promise<{ code: number; body: unknown }> {
  if (!CODE_RE.test(code)) return { code: 400, body: { error: 'A code is six characters from A–Z and 2–9, without 0, O, 1 or I.' } }
  if (method === 'GET') return { code: 200, body: await readManifest(code) }
  if (method === 'DELETE') {
    const { urls } = await held(code)
    for (let i = 0; i < urls.length; i += 100) await del(urls.slice(i, i + 100))
    return { code: 200, body: { deleted: urls.length } }
  }
  if (method !== 'POST') return { code: 405, body: { error: 'GET, POST or DELETE' } }

  const bricks = (body as { bricks?: unknown })?.bricks
  if (!Array.isArray(bricks)) return { code: 400, body: { error: 'Body must be { bricks: [] }.' } }
  for (const b of bricks as Brick[]) {
    if (!b || typeof b.id !== 'string' || !b.photo || typeof b.photo.url !== 'string') return { code: 400, body: { error: 'Each brick needs an id and a photo url.' } }
    if (!/^[\w.-]{1,80}$/.test(b.id)) return { code: 400, body: { error: `Brick id not allowed: ${b.id.slice(0, 20)}` } }
  }

  const projects = ((body as { projects?: unknown })?.projects ?? []) as Project[]
  if (!Array.isArray(projects) || projects.length > CAP_PROJECTS) return { code: 400, body: { error: `projects must be a list of at most ${CAP_PROJECTS}.` } }
  for (const p of projects) {
    if (!p || typeof p.id !== 'string' || !/^[\w.-]{1,80}$/.test(p.id) || typeof p.intent !== 'string' || !Array.isArray(p.brickIds)) return { code: 400, body: { error: 'Each project needs an id, an intent and brickIds.' } }
    if (JSON.stringify(p).length > MAX_PROJECT_JSON) return { code: 400, body: { error: `Project ${p.id} is larger than ${MAX_PROJECT_JSON / 1024} KB.` } }
  }

  const h = await held(code)
  const manifest = await readManifest(code, h)
  if (bricks.length === 0 && projects.length === 0) return { code: 200, body: manifest }
  let bytes = h.bytes
  const uploaded: Brick[] = []
  for (const b of bricks as Brick[]) {
    let url = b.photo.url
    if (isDataJpeg(url)) {
      const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
      if (bytes + buf.byteLength > CAP_BYTES) return { code: 413, body: { error: `This code holds its 40 MB. Forget it or remove bricks before adding more.`, bytes } }
      const r = await put(`${prefix(code)}${b.id}.jpg`, buf, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'image/jpeg', cacheControlMaxAge: 31536000 })
      url = r.url
      bytes += buf.byteLength
    } else if (url.startsWith('data:')) {
      return { code: 400, body: { error: 'Photos must be JPEG data URLs or plain URLs.' } }
    }
    uploaded.push({ ...b, photo: { ...b.photo, url } })
  }
  const merged = mergeBricks(manifest.bricks, uploaded)
  const live = merged.filter(b => !b.superseded_by).length
  if (live > CAP_BRICKS) return { code: 409, body: { error: `This code holds ${CAP_BRICKS} bricks. Remove some before adding more.`, live } }
  const next: Manifest = { code, updated_at: new Date().toISOString(), bricks: merged, projects: mergeProjects(manifest.projects ?? [], projects), bytes }
  await put(manifestPath(code), JSON.stringify(next), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 })
  return { code: 200, body: next }
}
