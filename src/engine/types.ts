// ── Horse Identity ──────────────────────────────────────────────

export type Sex = 'G' | 'M' | 'F' | 'C' | 'H'

export type RunningStyle = 'E' | 'P' | 'S'  // Early speed, Presser/stalker, Closer (Sustain)

export type SurfacePref = 'dirt' | 'turf' | 'synthetic' | 'neutral'
export type SurfacePrefStrength = 'strong' | 'mild' | 'neutral'

export type DistancePref = 'sprint' | 'route' | 'versatile'

export interface Quirk {
  id: string
  label: string
  description: string
  effect: (ctx: QuirkContext) => number  // returns PSR adjustment
}

export interface QuirkContext {
  surface: Surface
  condition: TrackCondition
  fieldSize: number
  postPosition: number
}

export interface Horse {
  id: string
  name: string
  age: number
  sex: Sex
  psr: number
  runningStyle: RunningStyle
  surfacePref: SurfacePref
  surfacePrefStrength: SurfacePrefStrength
  distancePref: DistancePref
  quirk: Quirk | null
  jockeyId: string
}

// ── Jockey ─────────────────────────────────────────────────────

export type JockeyTier = 'A' | 'B' | 'C'

export interface Jockey {
  id: string
  name: string
  tier: JockeyTier
}

// ── Track & Conditions ─────────────────────────────────────────

export type Surface = 'D' | 'T' | 'A'  // Dirt, Turf, Synthetic

export type TrackCondition =
  | 'FT' | 'GD' | 'SY' | 'MY' | 'WF' | 'SL' | 'HY'  // Dirt
  | 'FM' | 'YL' | 'SF'                                    // Turf (GD/HY shared)

export interface Track {
  code: string
  name: string
  city: string
  surfaces: Surface[]
}

// ── Race ───────────────────────────────────────────────────────

export type RaceClass = 'MCL' | 'CLM' | 'ALW' | 'STK'

export type DistanceCategory = 'sprint' | 'middle' | 'route'

export interface RaceConditions {
  raceClass: RaceClass
  surface: Surface
  condition: TrackCondition
  distanceFurlongs: number
  distanceCategory: DistanceCategory
}

export type ScratchReason = 'veterinary' | 'trainer' | 'off-turf'

export interface Entry {
  horse: Horse
  postPosition: number
  scratched: boolean
  scratchReason: ScratchReason | null
}

export interface Race {
  id: string
  raceNumber: number
  trackCode: string
  conditions: RaceConditions
  entries: Entry[]
}

export interface RaceCard {
  id: string
  trackCode: string
  races: Race[]
}

// ── Pace ───────────────────────────────────────────────────────

export type PaceScenario = 'hot' | 'honest' | 'slow'

// ── Market / Odds ──────────────────────────────────────────────

export interface PoolState {
  totalPool: number
  horsePool: Map<string, number>  // horseId → $ bet on that horse
}

export interface OddsLine {
  horseId: string
  odds: number        // to-1 format (e.g. 4.0 = 4-1)
  impliedProb: number // 1 / (odds + 1)
  poolShare: number   // fraction of pool
}

export interface MarketSnapshot {
  pool: PoolState
  odds: OddsLine[]
  favoriteId: string
}

// ── Race Result ────────────────────────────────────────────────

export interface FinishPosition {
  horseId: string
  position: number
  performance: number
  margin: string          // "nose", "1 length", etc.
  deadHeat: boolean
}

export type MarginLabel = 'nose' | 'head' | 'neck' | '½ length' | string

export interface RaceResult {
  raceId: string
  paceScenario: PaceScenario
  finishOrder: FinishPosition[]
  photoFinish: boolean
  deadHeat: boolean
}

// ── Payouts ────────────────────────────────────────────────────

export type BetType = 'win' | 'place' | 'show' | 'exacta' | 'quinella' | 'dailyDouble'

export interface Bet {
  type: BetType
  amount: number
  selections: string[]  // horseId(s) — 1 for W/P/S, 2 for exacta/quinella
  raceId: string
}

export interface Payout {
  betType: BetType
  displayPayout: number  // return on $2 bet
  won: boolean
  netReturn: number      // actual $ returned to player (0 if lost)
}

export interface PayoutResult {
  raceId: string
  payouts: Payout[]
  totalReturn: number
}

// ── Recap ──────────────────────────────────────────────────────

export interface RaceRecap {
  paceNarrative: string
  playerHorseStory: string
  factorTags: Map<string, string[]>  // horseId → tags
  lessonMoment: string | null
}

// ── Progression ────────────────────────────────────────────────

export interface ProgressionTier {
  tier: number
  bankrollRequired: number
  maxFieldSize: number
  raceClasses: RaceClass[]
  betTypes: BetType[]
  tracks: number
}

export const PROGRESSION_TIERS: ProgressionTier[] = [
  { tier: 0, bankrollRequired: 0,    maxFieldSize: 6,  raceClasses: ['MCL'],             betTypes: ['win'],                                        tracks: 1 },
  { tier: 1, bankrollRequired: 150,  maxFieldSize: 7,  raceClasses: ['MCL'],             betTypes: ['win', 'place', 'show'],                       tracks: 2 },
  { tier: 2, bankrollRequired: 400,  maxFieldSize: 8,  raceClasses: ['MCL', 'CLM'],      betTypes: ['win', 'place', 'show', 'quinella'],            tracks: 2 },
  { tier: 3, bankrollRequired: 800,  maxFieldSize: 9,  raceClasses: ['MCL', 'CLM', 'ALW'], betTypes: ['win', 'place', 'show', 'quinella', 'exacta'], tracks: 3 },
  { tier: 4, bankrollRequired: 2000, maxFieldSize: 12, raceClasses: ['MCL', 'CLM', 'ALW', 'STK'], betTypes: ['win', 'place', 'show', 'quinella', 'exacta', 'dailyDouble'], tracks: 4 },
]

// ── Constants ──────────────────────────────────────────────────

export const TAKEOUT_WIN = 0.18
export const TAKEOUT_EXOTIC = 0.22
export const MIN_PAYOUT_PER_DOLLAR = 1.05  // $2.10 on a $2 bet
export const STIPEND_THRESHOLD = 10
export const STIPEND_AMOUNT = 20
export const CARD_COMPLETION_BONUS = 5
export const RACES_PER_CARD = 6
export const SIMULATED_BETTORS = 1000
export const BET_UNIT = 2
