import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleSync, MAX_BODY } from '../../src/lib/sync.js'

export const maxDuration = 60

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = String(req.query.code ?? '').toUpperCase()
  const len = Number(req.headers['content-length'] ?? 0)
  if (len > MAX_BODY) return res.status(413).json({ error: 'One request carries at most 4 MB. The app sends bricks in smaller batches.' })
  try {
    const out = await handleSync(req.method ?? 'GET', code, req.body)
    res.status(out.code).json(out.body)
  } catch (e) {
    res.status(502).json({ error: `Sync store: ${(e as Error).message}` })
  }
}
