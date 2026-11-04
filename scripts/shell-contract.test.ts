/** The layout contract, measured (layer 2): render every ordered three-brick composition of the sample library (12 × 11 × 10 = 1,320) at 390 × 844 in a
 *  real browser, both screens, measure the DOM against the six rules (src/shell/contractMeasure.ts) and fail on any violation. Writes the count per rule
 *  and the three worst examples, as screenshots, to docs/contract/ (or $CONTRACT_OUT).
 *  Needs a browser and a dev server, so it runs only when asked: `npm run test:contract` (CONTRACT=1). Plain `npm test` skips it. */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { resolveProject, type Project } from '../src/lib/mapRelations.ts'
import type { Params } from '../src/shell/params.ts'
import { RULES, type RuleId, type Violation } from '../src/shell/contractMeasure.ts'
import { readFileSync } from 'node:fs'
import { CONCERT_CONTENT, toShellContent, type SampleContent } from '../src/shell/content.ts'

const RUN = process.env.CONTRACT === '1'
/** Which words the screens carry (shell item 1): the concert log, or with CONTRACT_CONTENT=reading the hand-written reading tracker (src/fixtures/content). */
const READING = process.env.CONTRACT_CONTENT === 'reading'
const CONTENT = READING ? toShellContent(JSON.parse(readFileSync(new URL('../src/fixtures/content/reading-tracker.json', import.meta.url), 'utf8')) as SampleContent) : CONCERT_CONTENT
const OUT = process.env.CONTRACT_OUT ?? (READING ? 'docs/contract/reading' : 'docs/contract')
const VIEW = { width: 390, height: 844 }
const SCREENS = ['list', 'review'] as const

type Combo = { ids: string[]; params: Params }
function compositions(): Combo[] {
  const ids = SAMPLES.map(b => b.id), out: Combo[] = []
  for (const a of ids) for (const b of ids) for (const c of ids) {
    if (a === b || b === c || a === c) continue
    const project: Project = { id: 'p', intent: '', createdAt: '', brickIds: [a, b, c], disabled: {}, choice: {}, locks: {}, manual: {} }
    out.push({ ids: [a, b, c], params: resolveProject(project, SAMPLES).params })
  }
  return out
}

describe('layout contract on every three-brick composition', { skip: !RUN && 'set CONTRACT=1 (npm run test:contract): needs a browser and a dev server' }, () => {
  it('no composition breaks a rule on either screen at 390 px', { timeout: 30 * 60_000 }, async () => {
    const { createServer } = await import('vite')
    const { chromium } = await import('playwright-core')
    const server = await createServer({ logLevel: 'error', server: { port: 0, strictPort: false } })
    await server.listen()
    const base = (server.resolvedUrls?.local[0] ?? 'http://localhost:5173/').replace(/\/$/, '')
    const browser = await chromium.launch()
    try {
      const page = await (await browser.newContext({ viewport: VIEW })).newPage()
      await page.goto(`${base}/dev/contract`)
      await page.waitForFunction(() => typeof window.__shell === 'function', null, { timeout: 60_000 })

      const combos = compositions()
      const unique = new Map<string, { params: Params; combos: Combo[] }>()
      for (const c of combos) {
        const key = JSON.stringify(c.params)
        const u = unique.get(key) ?? { params: c.params, combos: [] }
        u.combos.push(c); unique.set(key, u)
      }
      const results: { params: Params; combos: Combo[]; v: Record<(typeof SCREENS)[number], Violation[]> }[] = []
      for (const u of unique.values()) {
        const v = { list: [] as Violation[], review: [] as Violation[] }
        for (const screen of SCREENS) {
          await page.evaluate(([p, s, c]) => window.__shell!(p, s, c), [u.params, screen, CONTENT] as const)
          v[screen] = await page.evaluate(() => window.__measure!())
        }
        results.push({ ...u, v })
      }

      // count per rule: compositions (of 1,320) that break it on at least one screen
      const perRule = Object.fromEntries(Object.keys(RULES).map(r => [r, 0])) as Record<RuleId, number>
      const perRuleScreens = Object.fromEntries(Object.keys(RULES).map(r => [r, { list: 0, review: 0 }])) as Record<RuleId, { list: number; review: number }>
      let failing = 0
      for (const r of results) {
        const broken = new Set([...r.v.list, ...r.v.review].map(x => x.rule))
        if (broken.size) failing += r.combos.length
        for (const rule of broken) perRule[rule] += r.combos.length
        for (const s of SCREENS) for (const rule of new Set(r.v[s].map(x => x.rule))) perRuleScreens[rule][s] += r.combos.length
      }
      const score = (r: (typeof results)[number]) => { const all = [...r.v.list, ...r.v.review]; return new Set(all.map(x => x.rule)).size * 100 + all.reduce((t, x) => t + x.magnitude, 0) }
      const worst = [...results].filter(r => score(r) > 0).sort((a, b) => score(b) - score(a)).slice(0, 3)

      mkdirSync(OUT, { recursive: true })
      const shots = await (await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 })).newPage()
      await shots.goto(`${base}/dev/contract`)
      await shots.waitForFunction(() => typeof window.__shell === 'function', null, { timeout: 60_000 })
      const worstLines: string[] = []
      for (const [i, r] of worst.entries()) {
        const screen = r.v.list.length >= r.v.review.length ? 'list' : 'review'
        await shots.evaluate(([p, s, c]) => window.__shell!(p, s, c), [r.params, screen, CONTENT] as const)
        const file = `worst-${i + 1}-${screen}.png`
        await shots.screenshot({ path: join(OUT, file) })
        worstLines.push(`### ${i + 1}. ${r.combos[0].ids.join(' + ')} (${screen}; ${r.combos.length} composition${r.combos.length > 1 ? 's' : ''} render the same)`, '',
          `![worst ${i + 1}](${file})`, '',
          ...SCREENS.flatMap(s => r.v[s].map(x => `- ${s} · **${RULES[x.rule]}**: ${x.detail}`)), '')
      }
      const report = [
        '# Layout contract report', '',
        `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${combos.length} compositions (ordered triples of the ${SAMPLES.length} samples), ${unique.size} distinct parameter sets, both screens at ${VIEW.width} × ${VIEW.height}, with the ${READING ? 'reading-tracker' : 'concert'} content.`, '',
        `**${failing} of ${combos.length} compositions break at least one rule.**`, '',
        '| Rule | Compositions breaking it | List | Year review |', '|---|---|---|---|',
        ...(Object.keys(RULES) as RuleId[]).map(r => `| ${RULES[r]} | ${perRule[r]} | ${perRuleScreens[r].list} | ${perRuleScreens[r].review} |`), '',
        worst.length ? '## The three worst' : '## The three worst: none, every composition passes', '',
        ...worstLines,
      ].join('\n')
      writeFileSync(join(OUT, 'REPORT.md'), report + '\n')
      console.log(report.split('\n').slice(0, 14).join('\n'))
      assert.equal(failing, 0, `${failing} compositions break the layout contract; see ${OUT}/REPORT.md`)
    } finally {
      await browser.close()
      await server.close()
    }
  })
})
