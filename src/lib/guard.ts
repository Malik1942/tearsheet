/** Best-effort call guards for the model proxies (PRD §8): per-IP 20 calls an hour and MAX_DAILY_CALLS a day (default 300), counted in
 *  memory. A function instance that restarts forgets its counts, which is why they are "best effort"; the spend cap in the billing
 *  console is the real ceiling. */
const PER_IP_PER_HOUR = 20
const HOUR = 60 * 60 * 1000

const byIp = new Map<string, number[]>()
let day = '', dayCount = 0

export function dailyCap(): number {
  const n = Number(process.env.MAX_DAILY_CALLS ?? 300)
  return Number.isFinite(n) && n > 0 ? n : 300
}

/** Reserve one call. Returns null when allowed, otherwise the refusal to send. */
export function reserveCall(ip: string, now = Date.now()): { code: number; error: string } | null {
  const today = new Date(now).toISOString().slice(0, 10)
  if (today !== day) { day = today; dayCount = 0 }
  if (dayCount >= dailyCap()) return { code: 429, error: `This server has made its ${dailyCap()} model calls for today.` }
  const recent = (byIp.get(ip) ?? []).filter(t => now - t < HOUR)
  if (recent.length >= PER_IP_PER_HOUR) return { code: 429, error: `${PER_IP_PER_HOUR} model calls an hour from one address; try again later.` }
  recent.push(now); byIp.set(ip, recent); dayCount++
  if (byIp.size > 5000) for (const [k, v] of byIp) if (!v.some(t => now - t < HOUR)) byIp.delete(k)
  return null
}
