import type { ParameterKey, ParamValue } from '../shell/params'
import type { BrickExtraction } from './schema'

export type Measurement = BrickExtraction['measurements'][number]
export type Hypothesis = BrickExtraction['hypotheses'][number]
export type Region = BrickExtraction['regions'][number]
export type Relation = BrickExtraction['transferable_relations'][number] & { id: string }

/** A photo's outer ring, read once from its pixels (photoFit.ts): `plain` when it is one color to the eye, `color` its median as sRGB hex. Presentation only. */
export type PhotoBorder = { plain: boolean; color: string }

export type Brick = {
  id: string
  /** `border` is measured at save (client.ts prepareImage); a starter's comes from fixtures/borders.json. A brick saved before it has none, and its tiles keep the crop. */
  photo: { url: string; width: number; height: number; border?: PhotoBorder }
  saved_at: string
  /** When the photo was taken, `YYYY-MM-DD`, from its EXIF DateTimeOriginal at import; absent when the file carried none. */
  taken_at?: string
  /** Licensed sample material only: the one line that must travel with the photo wherever it is shown (see README, Sample credits). */
  credit?: string
  /** Where the brick came from (spec v3 SB2): `own` is anything a person added, `starter` ships with Tearsheet. Absent reads by id (see `originOf` in starters.ts). Not a provenance. */
  origin?: 'own' | 'starter'
  /** A short name for the photo, shown first on its card (Malik, 2026-11-03). Metadata only: never sent to the extraction, never read from it.
   *  A licensed starter's is its catalogue title, shortened; any other is written by hand, `adapted · by you` (`titleProvenance` in brickLabels.ts). */
  title?: string
  /** A licensed work's catalogue title in its own language when `title` is the English one (Lissitzky's "Dlya Golosa"); Details only, never on a card. */
  title_original?: string
  measurements: Measurement[]
  hypotheses: Hypothesis[]
  relations: Relation[]
  fragile_if_changed: string
  regions: Region[]
  model: { id: string; effort: string; latency_ms: number; input_tokens: number; output_tokens: number }
  /** Skin colors measured from the sent pixels by the harness, not by the model. */
  skin_measured?: { color_bg: string; color_fg: string; color_accent: string; how_measured: string }
  status?: BrickStatus
  /** Why a `pending` brick is not being sent (spec v3 L11): the server's daily or hourly limit, or no network. Cleared when it is sent. */
  held?: 'limit' | 'offline'
  error?: string
  retries?: number
  /** Which prompt produced it; values are frozen at save time, a re-extraction is a new brick. */
  prompt_version?: string
  /** Versions: a retry creates a new brick that supersedes the old one; the old one keeps its values. */
  version?: number
  supersedes?: string
  superseded_by?: string
}

export type Provenance = 'measured' | 'interpreted' | 'adapted'

export type ParameterValue = {
  key: ParameterKey
  value: ParamValue
  provenance: Provenance
  source?: { brickId: string; relationId?: string; relationRule?: string; measurementIds?: string[]; regionLabels?: string[]; note?: string }
  locked: boolean
  /** Set when the layout contract (src/shell/contract.ts) changed this value: the value as resolved before it, kept whole so the sheet and the export show both. */
  before?: ParameterValue
}

export type Unexpressed = { brickId: string; rule: string; reason: 'parameter-none' | 'unsupported-target' | 'no-slot' | 'fragile' }

export type Composition = {
  id: string
  intent: string
  brickIds: string[]
  parameters: Partial<Record<ParameterKey, ParameterValue>>
  unexpressed: Unexpressed[]
}

/** A relation the user switched off by hand inside a project. Not derived; recorded so the handoff can say so. */
export type DisabledRelation = { brickId: string; relationId: string; reason: string }

/** Library card state. Absent means ready (bricks from fixtures predate the field). `pending` = queued, not yet sent. */
export type BrickStatus = 'pending' | 'extracting' | 'ready' | 'unparsed'
