/** PRD 10.1: the product's prompts and schemas must be the harness's, byte for byte (trailing newline aside, which git adds to files).
 *  Run: npm run check:prompts   (prints every sha; exit 1 on any mismatch). Not part of `build`: ../meta-eval is not deployed. */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { EXTRACT_PROMPT } from '../src/lib/extractPrompt.ts'
import { PROPOSE_PROMPT } from '../src/lib/proposePrompt.ts'
import { PROPOSE_SCHEMA } from '../src/lib/propose.ts'
import { BRICK_SCHEMA } from '../src/lib/brick.schema.ts'

const harness = resolve(import.meta.dirname, '../../meta-eval/fixtures')
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const norm = (s: string) => s.replace(/\s+$/, '')
const checks: [string, string, string][] = [
  ['extract prompt v3', EXTRACT_PROMPT, 'prompts/extract_brick_v3.md'],
  ['propose prompt', PROPOSE_PROMPT, 'prompts/propose.md'],
  ['brick schema', JSON.stringify(BRICK_SCHEMA, null, 2), 'schemas/brick.json'],
  ['propose schema', JSON.stringify(PROPOSE_SCHEMA, null, 2), 'schemas/propose.json'],
]
let bad = 0
for (const [name, product, file] of checks) {
  const path = resolve(harness, file)
  if (!existsSync(path)) { console.log(`${name}: harness file missing (${path})`); bad++; continue }
  const theirs = readFileSync(path, 'utf8')
  const same = norm(product) === norm(theirs)
  console.log(`${same ? 'ok  ' : 'DIFF'} ${name}: product ${sha(product).slice(0, 16)}… harness file ${sha(theirs).slice(0, 16)}… (${file})`)
  if (!same) bad++
}
process.exit(bad ? 1 : 0)
