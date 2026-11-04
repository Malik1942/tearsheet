/** The handoff never prints an internal `idb:` pointer: a photo that is not on this device is named as such. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLES } from '../src/fixtures/samples/index.ts'
import { resolveProject, type Project } from '../src/lib/mapRelations.ts'
import type { Brick } from '../src/lib/types.ts'
import { exportHandoff } from '../src/export/index.ts'

const project: Project = { id: 't', intent: 'x', createdAt: '', brickIds: ['g1'], disabled: {}, choice: {}, locks: {}, manual: {} }
const base = SAMPLES.find(b => b.id === 'g1')!
const withUrl = (url: string): Brick => ({ ...base, photo: { ...base.photo, url } })
const usedLine = (md: string) => md.split('\n').find(l => l.startsWith(`- **${base.id}**`))!

describe('exportHandoff: photo links', () => {
  const r = resolveProject(project, SAMPLES)
  it('an idb: pointer is "(photo not on this device)" and never printed, stub or inline', () => {
    for (const photos of [undefined, 'stub', 'inline'] as const) {
      const md = exportHandoff('x', [withUrl('idb:g1')], r, undefined, { photos })
      assert.ok(!md.includes('idb:'), String(photos))
      assert.ok(usedLine(md).includes(`![${base.id}]((photo not on this device))`), String(photos))
    }
  })
  it('a data URL is still "(embedded photo)" in the download and stays whole inline', () => {
    const data = 'data:image/jpeg;base64,AAAA'
    assert.ok(usedLine(exportHandoff('x', [withUrl(data)], r)).includes(`![${base.id}]((embedded photo))`))
    assert.ok(usedLine(exportHandoff('x', [withUrl(data)], r, undefined, { photos: 'inline' })).includes(`![${base.id}](${data})`))
  })
  it('the page can name a photo by something other than its id: the alt text, brackets dropped; the download keeps the id', () => {
    const md = exportHandoff('x', [withUrl('/samples/g1.jpg')], r, undefined, { photos: 'inline', alt: () => 'Chicago [sign]' })
    assert.ok(usedLine(md).includes('![Chicago sign](/samples/g1.jpg)'))
    assert.ok(usedLine(exportHandoff('x', [withUrl('/samples/g1.jpg')], r, undefined, { photos: 'inline' })).includes(`![${base.id}](/samples/g1.jpg)`))
  })
  it('any other link is printed as it is', () => {
    assert.ok(usedLine(exportHandoff('x', [withUrl('/samples/g1.jpg')], r)).includes(`![${base.id}](/samples/g1.jpg)`))
  })
})
