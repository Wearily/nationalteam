// Contract between the data pipeline (pipeline/*.ts → public/data/*.json) and the game.
// Everything here is plain JSON. Optional fields are filled by the in-game estimator when absent.

export type Pos = 'GK' | 'RB' | 'CB' | 'LB' | 'DM' | 'CM' | 'AM' | 'RW' | 'LW' | 'ST'

export interface RawPlayer {
  /** Stable id. Wikidata QID when known ("Q123"), otherwise "x:<slug>". */
  id: string
  name: string
  /** ISO date YYYY-MM-DD. If only a year is known use YYYY-07-01 (treated as year-only), or set dobYearOnly. */
  dob: string
  dobYearOnly?: boolean
  /** FIFA three-letter codes. First entry is the sporting nationality if declared. */
  nat: string[]
  /** Positions, most natural first. */
  pos: Pos[]
  /** Club id from clubs.json, or null for free agents / unknown. */
  club: string | null
  heightCm?: number
  foot?: 'L' | 'R' | 'B'
  /** Senior international caps / goals for nat[0]. */
  caps?: number
  goals?: number
  /** True when the player has played a competitive senior international (cap-tied). */
  capTied?: boolean
  /** Country code of birth when different from nat[0] (diaspora flag). */
  born?: string
  /** Shirt number at club or national team, if known. */
  num?: number
  /** Path under public/, e.g. "faces/Q123.jpg". */
  photo?: string
  photoCredit?: string
  /** Market value in EUR if a real figure is known. */
  valueEur?: number
  /** Where this record came from, for the data report. */
  src?: string
}

export interface RawClub {
  id: string
  name: string
  short?: string
  /** FIFA country code. */
  country: string
  league: string
  city?: string
  stadium?: string
  /** 0–100 relative strength inside world football, optional. */
  rep?: number
  colors?: [string, string]
  /** Path under public/, e.g. "logos/irn-persepolis.png". */
  logo?: string
  /** True when the club runs a notable academy. */
  academy?: boolean
}

export interface RawLeague {
  id: string
  name: string
  country: string
  tier: number
  /** 0–100 average quality; Premier League ≈ 92, PGPL ≈ 58. */
  strength: number
  /** Month (1–12) the season starts. */
  startMonth: number
}

export interface RawNation {
  /** FIFA code. */
  code: string
  name: string
  confed: 'AFC' | 'UEFA' | 'CAF' | 'CONMEBOL' | 'CONCACAF' | 'OFC'
  fifaPoints: number
  fifaRank: number
  colors?: [string, string]
  /** AFC sub-region where relevant (e.g. "CAFA", "WAFF"). */
  region?: string
}

export interface RawStaff {
  id: string
  name: string
  dob: string
  nat: string
  role: 'coach' | 'assistant' | 'gk' | 'fitness' | 'scout' | 'physio'
  /** Current job: "nation:IRN:senior", "club:<id>", or null. */
  job: string | null
  rep?: number
}

export interface RawData {
  version: number
  /** ISO date the snapshot represents. */
  asOf: string
  players: RawPlayer[]
  clubs: RawClub[]
  leagues: RawLeague[]
  nations: RawNation[]
  staff: RawStaff[]
}
