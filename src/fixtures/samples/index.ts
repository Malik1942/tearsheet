/** The sample library: Malik's own photos, pre-extracted with prompt v3 on 2026-11-02 (meta-eval/out/s_*). Never the downloaded posters. */
import g1 from './g1.json'
import g2 from './g2.json'
import calmmouse from './calmmouse.json'
import greencar from './greencar.json'
import c1 from './c1.json'
import type { Brick } from '../../lib/types'

export const SAMPLES = [g1, g2, calmmouse, greencar, c1] as unknown as Brick[]
/** Default sample project: the three the acceptance test uses; the other two are swap candidates. */
export const SAMPLE_PROJECT_IDS = ['g1', 'g2', 'calmmouse']
