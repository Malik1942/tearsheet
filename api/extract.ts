import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleExtract } from '../src/lib/extract.js'

export const maxDuration = 120

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { code, body } = await handleExtract(req.body, process.env.META_API_KEY)
  res.status(code).json(body)
}
