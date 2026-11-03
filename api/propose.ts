import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePropose } from '../src/lib/propose.js'

export const maxDuration = 60

/** Propose (PRD P2): text only, effort low. Live calls need PROPOSE_ENABLED=1 in the deployment, set once the proposal set is sealed;
 *  until then this answers 503 and the app picks by hand. GET returns { enabled } so the form can say so before anyone clicks. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const live = process.env.PROPOSE_ENABLED === '1'
  if (req.method === 'GET') return res.status(200).json({ enabled: live })
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' })
  if (Number(req.headers['content-length'] ?? 0) > 4 * 1024 * 1024) return res.status(413).json({ error: 'One request carries at most 4 MB.' })
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
  const { code, body } = await handlePropose(req.body, process.env.META_API_KEY, { live, ip })
  res.status(code).json(body)
}
