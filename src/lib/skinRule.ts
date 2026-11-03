/** Skin derivation (spec §1b): `adapted · by rule`. Pure. Takes the pixel measurements and returns candidate skin colors with the rule text that produced each,
 *  and the readability checks on the pairs the shell actually renders (fg on base, label on accent). A failing check is recorded, never hidden:
 *  it moves fg first and never moves the accent. Photo contrast is not consulted here: a 9:1 photo does not pass the interface on its behalf (§1b, definition 3). */
import { contrastOfLuminances, hexToOklch, luminanceOfHex, oklabToHex, oklchToOklab } from './colorMath'
import { PX_TONE, type PixelFields, type ToneCluster } from './pixels'

export type SkinDerivation = { base: string; fg: string; accent: string | null; rules: string[]; checks: { pair: string; ratio: number; pass: boolean }[] }

export const SKIN_RULE = { base_chroma_max: 0.03, text_contrast: 4.5, single_place_share: 0.6, fg_on_light: '#111111', fg_on_dark: '#F5F5F5', neutral_fallback: '#F5F5F5' }

/** WCAG 2.2 contrast ratio of two #RRGGBB colors, cut (never rounded up) to two decimals so `ratio >= 4.5` is the real 1.4.3 test. */
export function contrastRatio(hexA: string, hexB: string): number {
  return Math.floor(contrastOfLuminances(luminanceOfHex(hexA), luminanceOfHex(hexB)) * 100 + 1e-9) / 100
}

/** The base, chroma held to the UI range, hue and lightness kept. */
function clampedHex(t: Pick<ToneCluster, 'L' | 'chroma' | 'hue'>): string {
  const { a, b } = oklchToOklab({ L: t.L, C: Math.min(t.chroma, SKIN_RULE.base_chroma_max), h: t.hue })
  return oklabToHex(t.L, a, b)
}

export function deriveSkin(f: PixelFields): SkinDerivation {
  const rules: string[] = []
  const clamp = `chroma clamped to ${SKIN_RULE.base_chroma_max}`

  // base: the near-black or near-white side when one dominates, else the largest low-chroma cluster.
  const tones = f.tone_clusters.filter(t => t.share >= f.params.min_share)
  const largest = (xs: ToneCluster[]) => xs.reduce((best, t) => (t.share > best.share ? t : best))
  let base: string
  if (tones.length === 0) {
    base = SKIN_RULE.neutral_fallback
    rules.push(`base: no tone cluster measured, so the neutral ${base} is used`)
  } else if (f.luminance_shares.near_black > 0.5) {
    base = clampedHex(tones.reduce((best, t) => (t.L < best.L ? t : best)))
    rules.push(`base: centroid of the darkest tone cluster, because near-black fills over half the frame; ${clamp}`)
  } else if (f.luminance_shares.near_white > 0.5) {
    base = clampedHex(tones.reduce((best, t) => (t.L > best.L ? t : best)))
    rules.push(`base: centroid of the lightest tone cluster, because near-white fills over half the frame; ${clamp}`)
  } else {
    const low = tones.filter(t => t.chroma < f.params.c_min)
    if (low.length > 0) {
      base = clampedHex(largest(low))
      rules.push(`base: centroid of the largest low-chroma cluster, ${clamp}`)
    } else {
      base = clampedHex(largest(tones))
      rules.push(`base: no low-chroma cluster in this photo, so the centroid of the largest tone cluster is used, ${clamp}`)
    }
  }

  // fg: the neutral on the opposite side of base (light base: #111111, dark base: #F5F5F5); the other neutral when the opposite misses 4.5:1.
  const light = hexToOklch(base).L >= PX_TONE.light_L
  const [opposite, other] = light ? [SKIN_RULE.fg_on_light, SKIN_RULE.fg_on_dark] : [SKIN_RULE.fg_on_dark, SKIN_RULE.fg_on_light]
  const need = SKIN_RULE.text_contrast
  let fg = opposite
  if (contrastRatio(opposite, base) >= need) {
    rules.push(`fg: ${opposite}, the ${light ? 'dark' : 'light'} neutral opposite the ${light ? 'light' : 'dark'} base`)
  } else if (contrastRatio(other, base) >= need) {
    fg = other
    rules.push(`fg: the neutral opposite the base (${opposite}) does not reach ${need}:1, so the other neutral (${other}) is used`, `fg adjusted for ${need}:1`)
  } else {
    if (contrastRatio(other, base) > contrastRatio(opposite, base)) fg = other
    rules.push(`fg: neither neutral reaches ${need}:1 on this base; ${fg} gives the higher ratio and the failure is recorded`)
  }
  const checks: SkinDerivation['checks'] = [{ pair: 'fg on base', ratio: contrastRatio(fg, base), pass: contrastRatio(fg, base) >= need }]

  // accent: the highest-chroma hue cluster, only when one place holds most of the high-chroma pixels.
  let accent: string | null = null
  if (f.high_chroma_components.largest_component_share >= SKIN_RULE.single_place_share && f.hue_clusters.length > 0) {
    accent = f.hue_clusters.reduce((best, c) => (c.chroma > best.chroma ? c : best)).hex
    rules.push(`accent: centroid of the highest-chroma hue cluster, because one place holds at least ${SKIN_RULE.single_place_share * 100}% of the high-chroma pixels`)
  } else {
    rules.push('no single-place accent found')
  }

  // label on accent: whichever of fg or base reads better on it. A failure stays a failure: the accent is not moved to fix it.
  if (accent) {
    const onFg = contrastRatio(fg, accent), onBase = contrastRatio(base, accent)
    const label = onBase > onFg ? { name: 'base', hex: base, ratio: onBase } : { name: 'fg', hex: fg, ratio: onFg }
    rules.push(`label on accent: ${label.hex} (${label.name}), whichever of fg and base reads better on the accent`)
    checks.push({ pair: 'label on accent', ratio: label.ratio, pass: label.ratio >= need })
  }

  return { base, fg, accent, rules, checks }
}
