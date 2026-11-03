/** The sample library, pre-extracted with prompt v3 on 2026-11-02 (meta-eval/out/s_*): Malik's own photos, then seven public-domain or
 *  free-to-use works picked by axis, each with its `credit` (README, Sample credits). Never the downloaded posters with unverified rights. */
import g1 from './g1.json'
import g2 from './g2.json'
import calmmouse from './calmmouse.json'
import greencar from './greencar.json'
import c1 from './c1.json'
import bauhaus from './bauhaus-1923-staatliches-bauhaus-weimar.json'
import haeckel from './haeckel-1904-trochilidae-plate-99.json'
import tiles from './iran-1260s-star-cross-luster-tiles.json'
import matthews from './matthews-19c-glyphography-trade-card.json'
import lissitzky from './lissitzky-1923-dlya-golosa.json'
import secession from './secession-1902-beethoven-catalogue.json'
import mars from './jpl-2016-visions-mars.json'
import type { Brick } from '../../lib/types'

export const SAMPLES = [g1, g2, calmmouse, greencar, c1, bauhaus, haeckel, tiles, matthews, lissitzky, secession, mars] as unknown as Brick[]
/** Default sample project: the three the acceptance test uses; the other two are swap candidates. */
export const SAMPLE_PROJECT_IDS = ['g1', 'g2', 'calmmouse']
