import type { Rng } from './rng'

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
  rng: Rng                // quirks with stochastic effects must roll from the seeded RNG
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

// Real US tracks negotiate their own takeout rates with state
// regulators. We model this per-track so the UI can show a player
// WHY two tracks with identical pool sizes pay differently. Defaults
// in DEFAULT_TAKEOUT_RATES apply when a snapshot is built without
// a track context (e.g. isolated unit tests).
export interface TakeoutRates {
  win: number
  place: number
  show: number
  exacta: number
  quinella: number
  dailyDouble: number
}

export interface Track {
  code: string
  name: string
  city: string
  surfaces: Surface[]
  takeout: TakeoutRates
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

// ── Market / Pools ─────────────────────────────────────────────
//
// Pari-mutuel racing has SEPARATE pools for each bet type. Money bet on
// exacta does not affect win payouts, and vice-versa. Every pool stands
// on its own: takeout comes out, the rest is split among the winning
// tickets weighted by stake.
//
// Pool bucket keys:
//   Win/Place/Show : horseId
//   Exacta         : `${firstId}|${secondId}` (ordered)
//   Quinella       : `${idA}|${idB}` where idA < idB lexicographically
//   Daily Double   : `${leg1Id}|${leg2Id}`

export interface BetPool {
  totalPool: number                   // gross $ in the pool
  buckets: Map<string, number>        // key → $ bet on that outcome
}

export interface OddsLine {
  horseId: string
  odds: number        // to-1 format (e.g. 4.0 = 4-1)
  impliedProb: number // 1 / (odds + 1)
  poolShare: number   // fraction of WIN pool
}

export interface MarketSnapshot {
  // Separate pools — each is its own pari-mutuel universe
  winPool: BetPool
  placePool: BetPool
  showPool: BetPool
  exactaPool: BetPool
  quinellaPool: BetPool
  dailyDoublePool: BetPool | null     // only present on leg 1 of a DD

  // Per-track takeout applied when pools pay out
  takeoutRates: TakeoutRates

  // Derived display from Win pool (odds shown on tote board)
  odds: OddsLine[]
  oddsByHorse: Map<string, OddsLine>  // O(1) lookup for hot paths
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
  selections: string[]  // horseId(s) — 1 for W/P/S, 2 for exacta/quinella, 2 for DD (leg1, leg2)
  raceId: string        // for DD, this is leg 1's raceId
}

// Attached to every Payout so the UI can explain HOW the number was reached.
// This is the teaching spine of the game — every payout becomes a little lesson.
export interface PayoutExplanation {
  poolLabel: string            // "Win", "Place", "Show", "Exacta", ...
  grossPool: number            // $ in this pool before takeout
  takeoutRate: number          // e.g. 0.16
  takeoutAmount: number        // grossPool * takeoutRate
  netPool: number              // grossPool - takeoutAmount
  betBack: number              // $ returned to winners first (Place/Show); 0 for Win
  profitPool: number           // netPool - betBack
  splitWays: number            // 1 Win, 2 Place, 3 Show, 1 exotic
  poolOnSelection: number      // $ bet on the winning selection in THIS pool
  rawPayoutPerDollar: number   // before breakage rounding
  payoutPerDollar: number      // after dime breakage (per $1)
  breakagePerDollar: number    // raw - final, per $1 — the "hidden" house keep
  minPayoutApplied: boolean    // true if we floored at $2.10/$2
  deadHeatHalved: boolean      // true if split due to a tie for the paying position
}

export interface Payout {
  betType: BetType
  amount: number         // amount wagered
  displayPayout: number  // return on the standard $2 bet
  won: boolean
  netReturn: number      // actual $ returned to player (0 if lost, amount if refunded)
  refunded: boolean      // scratched selection → stake returned, not counted as loss
  explanation: PayoutExplanation | null  // null for refunds / losses
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
//
// Takeout rates vary by bet type and jurisdiction. These are plausible
// mid-range US values. Straight pools (W/P/S) are cheapest to play;
// exotics cost more because the tracks/associations need bigger slices
// of smaller pools to operate them.

// Fallback takeout rates (mid-range US values). Used when a market
// snapshot is built without a track (e.g. unit tests); real gameplay
// always threads the host track's rates.
export const DEFAULT_TAKEOUT_RATES: TakeoutRates = {
  win: 0.16,
  place: 0.16,
  show: 0.16,
  exacta: 0.20,
  quinella: 0.20,
  dailyDouble: 0.20,
}

// Minimum payout floor, enshrined in US racing: a winning $2 ticket
// must return at least $2.10 (a nickel profit per dollar). Comes from
// state rules protecting bettors on odds-on favorites.
export const MIN_PAYOUT_PER_DOLLAR = 1.05

// Breakage: real tote boards round the per-$1 payout DOWN to the next
// dime. A "true" $3.47/$1 payout is shown as $3.40. Those lost pennies
// are a second, usually-invisible source of house revenue. We model it
// explicitly so the UI can reveal it.
export const BREAKAGE_INCREMENT = 0.10

// The unit stake US tracks quote payouts against. Every display value
// is "pays $X for a $2 ticket." Bigger bets scale proportionally.
export const BET_UNIT = 2

// Relative pool sizes, expressed as fractions of a standard "crowd".
// Real tracks see Win pools biggest, then Place/Show, then exotics
// (Exacta is often the liveliest exotic). Used to size each pool's
// simulated crowd.
export const POOL_BETTOR_FRACTIONS: Record<BetType, number> = {
  win: 1.00,
  place: 0.55,
  show: 0.35,
  exacta: 0.35,
  quinella: 0.10,
  dailyDouble: 0.15,
}

export const STIPEND_THRESHOLD = 10
export const STIPEND_AMOUNT = 20
export const CARD_COMPLETION_BONUS = 5
export const RACES_PER_CARD = 6
export const SIMULATED_BETTORS = 1000
