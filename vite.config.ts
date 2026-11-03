import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Dev-only stand-in for the Vercel function: same handler, key from META_API_KEY or ../meta-eval/.env. The key is never logged. */
function devApi(): Plugin {
  const readKey = (): string | undefined => {
    if (process.env.META_API_KEY) return process.env.META_API_KEY
    const envFile = resolve(import.meta.dirname, '../meta-eval/.env')
    if (!existsSync(envFile)) return undefined
    const line = readFileSync(envFile, 'utf8').split('\n').find(l => l.startsWith('META_API_KEY='))
    return line?.slice('META_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '')
  }
  /** Blob credentials for /api/sync in dev: BLOB_STORE_ID and VERCEL_OIDC_TOKEN from .env.local (vercel env pull). Never logged. */
  const loadBlobEnv = () => {
    const f = resolve(import.meta.dirname, '.env.local')
    if (!existsSync(f)) return
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^(BLOB_STORE_ID|VERCEL_OIDC_TOKEN)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }
  const readJson = async (req: import('node:http').IncomingMessage): Promise<{ ok: true; json: unknown; bytes: number } | { ok: false }> => {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const buf = Buffer.concat(chunks)
    if (!buf.length) return { ok: true, json: undefined, bytes: 0 }
    try { return { ok: true, json: JSON.parse(buf.toString('utf8')), bytes: buf.length } } catch { return { ok: false } }
  }
  return {
    name: 'bricks-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/sync', async (req, res) => {
        loadBlobEnv()
        const code = (req.url ?? '').split('?')[0].replace(/^\//, '').toUpperCase()
        const read = await readJson(req)
        res.setHeader('Content-Type', 'application/json')
        if (!read.ok) { res.statusCode = 400; res.end(JSON.stringify({ error: 'bad json' })); return }
        if (read.bytes > 4 * 1024 * 1024) { res.statusCode = 413; res.end(JSON.stringify({ error: 'One request carries at most 4 MB.' })); return }
        const { handleSync } = await server.ssrLoadModule('/src/lib/sync.ts') as { handleSync: (m: string, c: string, b: unknown) => Promise<{ code: number; body: unknown }> }
        try { const out = await handleSync(req.method ?? 'GET', code, read.json); res.statusCode = out.code; res.end(JSON.stringify(out.body)) }
        catch (e) { res.statusCode = 502; res.end(JSON.stringify({ error: `Sync store: ${(e as Error).message}` })) }
      })
      server.middlewares.use('/api/extract', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        let json: any = null
        try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { res.statusCode = 400; res.end('bad json'); return }
        const { handleExtract } = await server.ssrLoadModule('/src/lib/extract.ts') as { handleExtract: (body: unknown, key: string | undefined) => Promise<{ code: number; body: unknown }> }
        const { code, body } = await handleExtract(json, readKey())
        res.statusCode = code
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(body))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
})
