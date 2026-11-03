/** The dev-only pixel page (/dev/pixels) and the color math behind it must not reach the production bundle: production builds are made here, in memory,
 *  and searched for text that only those modules contain. Run: npm test */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build, type InlineConfig } from 'vite'

/** Digits that only src/lib/colorMath.ts holds (minified output drops the leading "0."): matrix entries of sRGB -> XYZ, OKLab -> LMS, XYZ -> sRGB, OKLab -> LMS. */
const COLOR_MATH = ['41239079926595934', '2158037573099136', '3.2409699419045226', '1.2914855480194092']
/** Text that only the dev page holds. */
const DEV_PAGE = ['every repeat identical', '/dev/pixels']

async function bundleOf(config: InlineConfig) {
  const out = await build({ logLevel: 'silent', ...config, build: { write: false, ...config.build } })
  const outputs = (Array.isArray(out) ? out : [out]).flatMap(o => ('output' in o ? o.output : []))
  return outputs.filter(o => o.type === 'chunk')
}

describe('production bundle', () => {
  it('holds nothing of the dev pixel page or the color math, and builds no chunk for them', { timeout: 120_000 }, async () => {
    const chunks = await bundleOf({})
    assert.ok(chunks.length > 0, 'a production build makes at least one chunk')
    const code = chunks.map(c => c.code).join('\n')
    assert.ok(code.includes('/solo/:target/:screen'), 'the search is over the real app bundle')
    for (const needle of [...COLOR_MATH, ...DEV_PAGE]) assert.equal(code.includes(needle), false, `the production bundle contains ${JSON.stringify(needle)}`)
    assert.equal(chunks.some(c => /DevPixels|colorMath/.test(c.fileName) || c.moduleIds.some(id => /DevPixels|colorMath/.test(id))), false, 'no chunk is built from the dev page or the color math')
  })

  it('drops the color math top-level work when something imports colorMath and uses none of it', { timeout: 120_000 }, async () => {
    const colorMath = fileURLToPath(new URL('../src/lib/colorMath.ts', import.meta.url))
    const entry = '\0unused-colormath-entry'
    const chunks = await bundleOf({
      configFile: false,
      plugins: [{ name: 'unused-colormath-entry', resolveId: id => (id === 'virtual:entry' ? entry : null), load: id => (id === entry ? `import { rgbToHex } from ${JSON.stringify(colorMath)}\nconsole.log('entry ran')\n` : null) }],
      build: { rollupOptions: { input: 'virtual:entry' } },
    })
    const code = chunks.map(c => c.code).join('\n')
    assert.ok(code.includes('entry ran'), 'the search is over the entry that was built')
    for (const needle of COLOR_MATH) assert.equal(code.includes(needle), false, `colorMath top-level work survived: ${needle}`)
  })
})

describe('the dev route', () => {
  it('loads the dev page lazily, inside the DEV branch, and nothing imports it statically', () => {
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
    assert.doesNotMatch(app, /^import .* from '\.\/screens\/DevPixels'/m, 'no static import of the dev page')
    assert.match(app, /import\.meta\.env\.DEV\s*\?\s*lazy\(\s*\(\)\s*=>\s*import\('\.\/screens\/DevPixels'\)/, 'the lazy import sits in the DEV branch')
    assert.match(app, /<Suspense[^>]*>\s*<DevPixels\s*\/>\s*<\/Suspense>/, 'the route is wrapped in Suspense')
  })
})
