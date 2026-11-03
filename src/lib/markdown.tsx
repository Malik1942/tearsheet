import type { ReactNode } from 'react'
import { Photo } from '../bricks/Photo'

/** Renders the Markdown the handoff generator emits, and only that: `#`/`##` headings, paragraphs, `- ` lists with one level of
 *  `  - ` nesting, **bold**, `code` and ![alt](url) images. Not a general parser; the Instructions page runs the Export text through it. */
type Block = { kind: 'h1' | 'h2' | 'p'; text: string } | { kind: 'list'; items: { text: string; children: string[] }[] }

function parseBlocks(md: string): Block[] {
  const blocks: Block[] = []
  const lines = md.split('\n')
  let para: string[] = []
  const flush = () => { if (para.length) { blocks.push({ kind: 'p', text: para.join(' ') }); para = [] } }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) { flush(); continue }
    if (line.startsWith('## ')) { flush(); blocks.push({ kind: 'h2', text: line.slice(3) }); continue }
    if (line.startsWith('# ')) { flush(); blocks.push({ kind: 'h1', text: line.slice(2) }); continue }
    if (line.startsWith('- ')) {
      flush()
      const items: { text: string; children: string[] }[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('  - '))) {
        if (lines[i].startsWith('- ')) items.push({ text: lines[i].slice(2), children: [] })
        else if (items.length) items[items.length - 1].children.push(lines[i].slice(4))
        i++
      }
      i--
      blocks.push({ kind: 'list', items })
      continue
    }
    para.push(line)
  }
  flush()
  return blocks
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|!\[[^\]]*\]\([^)\s]+\))/g

function Inline({ text }: { text: string }): ReactNode {
  return text.split(INLINE).filter(s => s !== '').map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="mono">{part.slice(1, -1)}</code>
    const img = part.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)
    if (img) return img[2].startsWith('(') ? <span key={i} className="ink-2">[{img[1]}: photo not embedded]</span> : <Photo key={i} src={img[2]} alt={img[1]} className="my-1 block max-h-40 max-w-full rounded object-contain" />
    return <span key={i}>{part}</span>
  })
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      {parseBlocks(text).map((b, i) => {
        if (b.kind === 'list') return (
          <ul key={i} className="my-1 list-disc space-y-1 pl-5 text-[13px]">
            {b.items.map((it, j) => (
              <li key={j}><Inline text={it.text} />{it.children.length > 0 && <ul className="mt-0.5 list-[circle] space-y-0.5 pl-4 ink-2 text-[12px]">{it.children.map((c, k) => <li key={k}><Inline text={c} /></li>)}</ul>}</li>
            ))}
          </ul>
        )
        if (b.kind === 'h1') return <h1 key={i} className="mt-2"><Inline text={b.text} /></h1>
        if (b.kind === 'h2') return <h2 key={i} className="mt-5 mb-1 text-[15px]"><Inline text={b.text} /></h2>
        return <p key={i} className="my-2 text-[13px]"><Inline text={b.text} /></p>
      })}
    </div>
  )
}
