import type { Params } from './params'
import { Shell } from './Shell'

/** The shell renders at a phone's size and is scaled down; there is no second renderer. */
const SHELL_W = 320
const SHELL_H = 568

/** Spec v3 B2/L6/P7/P8: a thumbnail-size List screen. The existing `<Shell>` rendered at 320 x 568 and scaled by `width / 320` (origin top-left); nothing inside takes a click, a tap or focus.
 *  It is drawn with `staticRender`, so it holds no button, link or input either: a mini-preview sits inside the conflict tile's button and the Library card's link, and neither may nest an interactive element.
 *  The badge ("N couldn't carry over") is chrome, so it uses the chrome tokens and never a color from the shell (principle 6). */
export function MiniPreview({ params, width = 120, badge }: { params: Params; width?: number; badge?: number }) {
  const scale = width / SHELL_W
  const height = Math.round(SHELL_H * scale)
  return (
    <div className="relative inline-block max-w-full align-top" style={{ width, height }}>
      <div role="img" aria-label="Preview of the list screen" className="overflow-hidden" style={{ width, height, borderRadius: 'var(--radius)', boxShadow: '0 0 0 1px var(--line)' }}>
        <div inert className="[&_.shell]:overflow-hidden" style={{ width: SHELL_W, height: SHELL_H, transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
          <Shell params={params} screen="list" height={SHELL_H} staticRender />
        </div>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="absolute bottom-1 left-1 rounded border px-1 text-[10px] leading-[14px]" style={{ maxWidth: 'calc(100% - 8px)', background: 'var(--panel)', color: 'var(--ink)', borderColor: 'var(--line)' }}>
          {badge} couldn't carry over
        </span>
      )}
    </div>
  )
}
