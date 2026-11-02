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
  return {
    name: 'bricks-dev-api',
    configureServer(server) {
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
