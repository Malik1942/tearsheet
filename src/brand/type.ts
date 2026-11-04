import type { CSSProperties } from 'react'

/** A screen's h1 in the display face (the Data tear board's: Archivo 900 at width 62, upper case by CSS). Each title keeps its own line box; at 30 px
 *  its capitals stand about as tall as the 24 px mixed-case title they replace did from cap to descender. Inline, as StepTitle's own style is: the
 *  chrome's h1 rule would win over a class. */
export const DISPLAY_TITLE: CSSProperties = { fontFamily: 'var(--font-poster)', fontWeight: 900, fontStretch: '62%', textTransform: 'uppercase', fontSize: 30, letterSpacing: 0 }
