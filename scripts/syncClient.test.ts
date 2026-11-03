/** C9 fix round: a project's history can never break a push. The server accepts up to 256 KB a project, the client sends at most 60 KB, and the first
 *  POST counts the projects in its size so it stays under the 4 MB body limit. Run: npm test */
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_BODY, MAX_PROJECT_JSON, handleSync } from '../src/lib/sync.ts'
import { push } from '../src/lib/syncClient.ts'
import type { Project } from '../src/lib/mapRelations.ts'
import type { Brick } from '../src/lib/types.ts'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { firstVersion, withNextVersion } from '../src/lib/versions.ts'

/** A project with `n` accepted changes after v1, each a real swap on the sample bricks. */
const heavyProject = (id: string, n = 50): Project => {
  let p: Project = { id, intent: 'x', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', brickIds: ['g1', 'g2', 'calmmouse'], disabled: {}, choice: {}, locks: {}, manual: {} }
  p = { ...p, ...firstVersion(p, p.createdAt) }
  for (let i = 0; i < n; i++) p = withNextVersion(p, { ...p, brickIds: i % 2 === 0 ? ['calmmouse', 'g2', 'g1'] : ['g1', 'g2', 'calmmouse'] }, SAMPLES, `2026-11-02T10:00:${String(i).padStart(2, '0')}.000Z`)
  return p
}
const fatBrick = (id: string, chars: number): Brick => ({ id, photo: { url: 'data:image/jpeg;base64,' + 'A'.repeat(chars), width: 1, height: 1 }, saved_at: '2026-11-02T00:00:00.000Z', status: 'ready', version: 1 }) as unknown as Brick

describe('the server limit', () => {
  it('is 256 KB a project', () => assert.equal(MAX_PROJECT_JSON, 256 * 1024))
  it('still rejects a project over it, with a 400 that names the limit', async () => {
    const big = { id: 'p', intent: 'x'.repeat(MAX_PROJECT_JSON), brickIds: [] }
    const r = await handleSync('POST', 'ABCDEF', { bricks: [], projects: [big] })
    assert.equal(r.code, 400)
    assert.match((r.body as { error: string }).error, /256 KB/)
  })
})

describe('push', () => {
  const realFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = realFetch })
  /** A server that holds nothing and records the body of each POST. */
  const fakeServer = () => {
    const posts: { bricks: Brick[]; projects?: Project[]; len: number }[] = []
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      const empty = { code: 'ABCDEF', updated_at: '', bricks: [], projects: [], bytes: 0 }
      if (init?.method === 'POST') { const body = String(init.body); posts.push({ ...JSON.parse(body), len: body.length }) }
      return new Response(JSON.stringify(empty), { status: 200 })
    }) as typeof fetch
    return posts
  }

  it('sends each project under 60 KB with its latest entry, and leaves the local projects alone', async () => {
    const posts = fakeServer()
    const local = [heavyProject('a'), heavyProject('b')]
    const before = JSON.stringify(local)
    assert.ok(JSON.stringify(local[0]).length > 60 * 1024, 'the local project is over 60 KB')
    await push('ABCDEF', [], local)
    assert.equal(JSON.stringify(local), before, 'the local projects are untouched')
    assert.equal(posts.length, 1)
    assert.equal(posts[0].projects!.length, 2)
    for (const sent of posts[0].projects!) {
      const mine = local.find(p => p.id === sent.id)!
      assert.ok(JSON.stringify(sent).length <= 60 * 1024, `${sent.id} is ${JSON.stringify(sent).length}`)
      assert.deepEqual(sent.versions![sent.versions!.length - 1], mine.versions![mine.versions!.length - 1])
      assert.equal(sent.version, mine.version)
    }
  })

  it('counts the projects in the first POST so no POST goes over the 4 MB body limit', async () => {
    const posts = fakeServer()
    // fifty projects at about 60 KB are about 3 MB: with only the bricks counted, the first batch of three 1.1 MB bricks and the projects would pass 4 MB
    const projects = Array.from({ length: 50 }, (_, i) => heavyProject('p' + i))
    const bricks = [fatBrick('b1', 1_100_000), fatBrick('b2', 1_100_000), fatBrick('b3', 1_100_000)]
    await push('ABCDEF', bricks, projects)
    assert.ok(posts.length >= 2)
    for (const p of posts) assert.ok(p.len <= MAX_BODY, `a POST of ${p.len} bytes`)
    assert.equal(posts.filter(p => p.projects).length, 1, 'the projects go once')
    assert.deepEqual(posts.flatMap(p => p.bricks.map(b => b.id)).sort(), ['b1', 'b2', 'b3'])
  })

  it('still sends the projects alone when every brick is already there', async () => {
    const posts = fakeServer()
    await push('ABCDEF', [], [heavyProject('a')])
    assert.equal(posts.length, 1)
    assert.deepEqual(posts[0].bricks, [])
  })
})
