import type {
  Entry, Race, BetPool, OddsLine, MarketSnapshot, BetType, TakeoutRates,
} from './types'
import {
  DEFAULT_TAKEOUT_RATES, SIMULATED_BETTORS, POOL_BETTOR_FRACTIONS, BET_UNIT,
} from './types'
import { JOCKEYS, JOCKEY_PERCEIVED_BONUS } from '@/data/jockeys'
import { surfaceFitBonus, distanceFitBonus } from './field'
import type { Rng } from './rng'

// ── How the "crowd" decides ────────────────────────────────────
//
// We model the betting public as a mix of two types of bettor:
//
//  1. Handicappers (majority) — form an opinion of each horse's true
//     strength (PSR + jockey + surface/distance fit) with individual
//     noise, then back their top pick. The *average* of many noisy
//     handicappers approximates the truth — this is the "wisdom of
//     the crowd" that makes favorites win ~33% of the time.
//
//  2. Recreational bettors (minority) — pick flashy names, lucky
//     numbers, silks they like. Modeled as a uniform random pick from
//     the field. This is the engine of the FAVORITE–LONGSHOT BIAS:
//     recreational dollars land disproportionately on longshots,
//     overbetting them relative to true probability (so their payouts
//     are worse than they "should" be; favorites are slightly underbet
//     and thus slightly overlay).
//
// Exotic pools (Exacta/Quinella/Daily Double) attract proportionally
// more recreational action — those are the "dreamer" pools.

const RECREATIONAL_FRACTION: Record<BetType, number> = {
  win: 0.15,
  place: 0.12,   // place bettors lean conservative → more handicapped
  show: 0.10,
  exacta: 0.28,  // exotics attract chasers of big payouts
  quinella: 0.28,
  dailyDouble: 0.25,
}

// ── Tuning constants ───────────────────────────────────────────

// Per-handicapper noise (PSR points). Wider σ = more disagreement.
const HANDICAPPER_NOISE_SIGMA = 12

// Morning line is produced by a single handicapper, not a crowd, so
// we crank the noise up.
const MORNING_LINE_NOISE_SIGMA = 18
const MORNING_LINE_BETTORS = 100

// Probability the final MTP snapshot contains a "sharp money" surge.
const LATE_MONEY_CHANCE = 0.05
// Surge only lands on horses holding less than this share of the Win pool.
const LATE_MONEY_SHARE_THRESHOLD = 0.15
// Size of the surge, as a fraction of the current total pool.
const LATE_MONEY_SURGE_FRACTION = 0.30

// MTP ticker pool fill fractions (0.25 = 25% of final betting volume).
const MTP_POOL_FRACTIONS = [0.25, 0.50, 0.75, 1.0] as const

function getJockeyBonus(jockeyId: string): number {
  const jockey = JOCKEYS.find(j => j.id === jockeyId)
  if (!jockey) return 0
  return JOCKEY_PERCEIVED_BONUS[jockey.tier] ?? 0
}

function estimateHorseStrength(entry: Entry, race: Race, rng: Rng, noiseSigma = HANDICAPPER_NOISE_SIGMA): number {
  const h = entry.horse
  const cond = race.conditions
  return h.psr
    + getJockeyBonus(h.jockeyId)
    + surfaceFitBonus(h, cond.surface)
    + distanceFitBonus(h, cond.distanceCategory)
    + rng.normal(0, noiseSigma)
}

// Pick one horse for one bettor — either handicap-driven or random.
function pickOne(rng: Rng, entries: Entry[], race: Race, recFrac: number, noiseSigma = HANDICAPPER_NOISE_SIGMA): Entry {
  if (rng.next() < recFrac) return rng.pick(entries)

  let best = entries[0]!
  let bestEst = -Infinity
  for (const entry of entries) {
    const est = estimateHorseStrength(entry, race, rng, noiseSigma)
    if (est > bestEst) { bestEst = est; best = entry }
  }
  return best
}

// Pick top-N by handicapped estimate, or random N for recreational.
function pickTopN(rng: Rng, entries: Entry[], race: Race, n: number, recFrac: number): Entry[] {
  if (rng.next() < recFrac) {
    const copy = [...entries]
    const picks: Entry[] = []
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(rng.next() * copy.length)
      picks.push(copy.splice(idx, 1)[0]!)
    }
    return picks
  }
  const scored = entries.map(e => ({ entry: e, score: estimateHorseStrength(e, race, rng) }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, n).map(s => s.entry)
}

function numBettors(betType: BetType): number {
  return Math.floor(SIMULATED_BETTORS * POOL_BETTOR_FRACTIONS[betType])
}

// ── Simulate each pool ─────────────────────────────────────────

function simulateWinPool(rng: Rng, race: Race, active: Entry[]): BetPool {
  const buckets = new Map<string, number>()
  for (const e of active) buckets.set(e.horse.id, 0)
  const n = numBettors('win')
  for (let b = 0; b < n; b++) {
    const pick = pickOne(rng, active, race, RECREATIONAL_FRACTION.win)
    buckets.set(pick.horse.id, (buckets.get(pick.horse.id) ?? 0) + BET_UNIT)
  }
  return { totalPool: n * BET_UNIT, buckets }
}

function simulatePlacePool(rng: Rng, race: Race, active: Entry[]): BetPool {
  const buckets = new Map<string, number>()
  for (const e of active) buckets.set(e.horse.id, 0)
  const n = numBettors('place')
  for (let b = 0; b < n; b++) {
    const pick = pickOne(rng, active, race, RECREATIONAL_FRACTION.place)
    buckets.set(pick.horse.id, (buckets.get(pick.horse.id) ?? 0) + BET_UNIT)
  }
  return { totalPool: n * BET_UNIT, buckets }
}

function simulateShowPool(rng: Rng, race: Race, active: Entry[]): BetPool {
  const buckets = new Map<string, number>()
  for (const e of active) buckets.set(e.horse.id, 0)
  const n = numBettors('show')
  for (let b = 0; b < n; b++) {
    const pick = pickOne(rng, active, race, RECREATIONAL_FRACTION.show)
    buckets.set(pick.horse.id, (buckets.get(pick.horse.id) ?? 0) + BET_UNIT)
  }
  return { totalPool: n * BET_UNIT, buckets }
}

function simulateExactaPool(rng: Rng, race: Race, active: Entry[]): BetPool {
  const buckets = new Map<string, number>()
  const n = numBettors('exacta')
  for (let b = 0; b < n; b++) {
    const [first, second] = pickTopN(rng, active, race, 2, RECREATIONAL_FRACTION.exacta)
    if (!first || !second) continue
    const key = `${first.horse.id}|${second.horse.id}`
    buckets.set(key, (buckets.get(key) ?? 0) + BET_UNIT)
  }
  return { totalPool: n * BET_UNIT, buckets }
}

function simulateQuinellaPool(rng: Rng, race: Race, active: Entry[]): BetPool {
  const buckets = new Map<string, number>()
  const n = numBettors('quinella')
  for (let b = 0; b < n; b++) {
    const [a, bEntry] = pickTopN(rng, active, race, 2, RECREATIONAL_FRACTION.quinella)
    if (!a || !bEntry) continue
    const key = quinellaKey(a.horse.id, bEntry.horse.id)
    buckets.set(key, (buckets.get(key) ?? 0) + BET_UNIT)
  }
  return { totalPool: n * BET_UNIT, buckets }
}

function simulateDailyDoublePool(rng: Rng, leg1: Race, leg2: Race, active1: Entry[], active2: Entry[]): BetPool {
  // Each DD bettor independently picks one horse per leg. Their ticket
  // is locked as the pair; it wins only if BOTH horses win their leg.
  const buckets = new Map<string, number>()
  const n = numBettors('dailyDouble')
  for (let b = 0; b < n; b++) {
    const a = pickOne(rng, active1, leg1, RECREATIONAL_FRACTION.dailyDouble)
    const c = pickOne(rng, active2, leg2, RECREATIONAL_FRACTION.dailyDouble)
    const key = `${a.horse.id}|${c.horse.id}`
    buckets.set(key, (buckets.get(key) ?? 0) + BET_UNIT)
  }
  return { totalPool: n * BET_UNIT, buckets }
}

// Canonical ordering so (A,B) and (B,A) become the same ticket.
export function quinellaKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`
}

// ── Tote board display ─────────────────────────────────────────
// Real boards never show arbitrary decimals — they round odds down to
// specific "buckets". Rounding DOWN is pro-bettor on the odds side
// (your horse pays at least the displayed odds, usually a hair more
// before breakage eats it).

const TOTE_BUCKETS = [
  0.20, 0.40, 0.50, 0.60, 0.80,
  1.0, 1.2, 1.4, 1.5, 1.6, 1.8,
  2.0, 2.5,
  3.0, 3.5,
  4.0, 4.5,
  5.0, 6.0, 7.0, 8.0, 9.0,
  10, 12, 15, 20, 30, 50, 99,
] as const

function snapToBucket(rawOdds: number): number {
  if (rawOdds <= TOTE_BUCKETS[0]!) return TOTE_BUCKETS[0]!
  if (rawOdds >= 99) return 99
  for (let i = TOTE_BUCKETS.length - 1; i >= 0; i--) {
    if (TOTE_BUCKETS[i]! <= rawOdds) return TOTE_BUCKETS[i]!
  }
  return TOTE_BUCKETS[0]!
}

// Derive tote-board odds from the Win pool. This is what bettors see;
// it is NOT used to compute exotic payouts (those have their own pool).
export function calculateOdds(pool: BetPool, takeout: number = DEFAULT_TAKEOUT_RATES.win): {
  odds: OddsLine[]
  byHorse: Map<string, OddsLine>
  favoriteId: string
} {
  const odds: OddsLine[] = []
  for (const [horseId, amount] of pool.buckets) {
    const poolShare = pool.totalPool > 0 ? amount / pool.totalPool : 0
    // Fair odds would be (1/poolShare - 1). Takeout skims the top
    // of the pool first, so we shrink the numerator before dividing.
    const rawOdds = poolShare > 0 ? (1 - takeout) / poolShare - 1 : 99
    const displayOdds = snapToBucket(rawOdds)
    const impliedProb = 1 / (displayOdds + 1)
    odds.push({ horseId, odds: displayOdds, impliedProb, poolShare })
  }
  odds.sort((a, b) => a.odds - b.odds)
  const byHorse = new Map(odds.map(o => [o.horseId, o]))
  const favoriteId = odds[0]?.horseId ?? ''
  return { odds, byHorse, favoriteId }
}

// ── Build the full multi-pool snapshot ─────────────────────────

export function buildMarketSnapshot(
  rng: Rng,
  race: Race,
  nextRace?: Race,
  takeoutRates: TakeoutRates = DEFAULT_TAKEOUT_RATES,
): MarketSnapshot {
  const active = race.entries.filter(e => !e.scratched)
  const winPool = simulateWinPool(rng, race, active)
  const placePool = simulatePlacePool(rng, race, active)
  const showPool = simulateShowPool(rng, race, active)
  const exactaPool = simulateExactaPool(rng, race, active)
  const quinellaPool = simulateQuinellaPool(rng, race, active)
  let dailyDoublePool: BetPool | null = null
  if (nextRace) {
    const nextActive = nextRace.entries.filter(e => !e.scratched)
    dailyDoublePool = simulateDailyDoublePool(rng, race, nextRace, active, nextActive)
  }

  const { odds, byHorse, favoriteId } = calculateOdds(winPool, takeoutRates.win)
  return {
    winPool, placePool, showPool, exactaPool, quinellaPool, dailyDoublePool,
    takeoutRates,
    odds, oddsByHorse: byHorse, favoriteId,
  }
}

// Morning line — the track handicapper's pre-betting estimate, printed
// in the program before a single dollar is wagered. It's what THEY
// think the final odds will be; the real crowd often disagrees. A
// horse whose live odds fall well below ML has been "bet down"
// (smart money or stable connections); one drifting upward is
// perceived as worse than advertised.
export function generateMorningLine(rng: Rng, race: Race): OddsLine[] {
  const active = race.entries.filter(e => !e.scratched)
  const buckets = new Map<string, number>()
  for (const e of active) buckets.set(e.horse.id, 0)

  for (let b = 0; b < MORNING_LINE_BETTORS; b++) {
    const pick = pickOne(rng, active, race, 0, MORNING_LINE_NOISE_SIGMA)
    buckets.set(pick.horse.id, (buckets.get(pick.horse.id) ?? 0) + BET_UNIT)
  }

  const pool: BetPool = { totalPool: MORNING_LINE_BETTORS * BET_UNIT, buckets }
  return calculateOdds(pool).odds
}

// MTP (Minutes To Post) snapshots — odds evolve as the pool fills. We
// simulate progressively larger partial crowds to show how the board
// moves. At MTP 0:00 (post time), a 5% chance of "late money" triggers
// a surge onto a non-favorite: think stable connections or a sharp
// pro dropping a big ticket in the last seconds. This is visible on
// real tote boards as a sudden drop in a horse's odds.
export function generateMTPSnapshots(
  rng: Rng,
  race: Race,
  nextRace?: Race,
  takeoutRates: TakeoutRates = DEFAULT_TAKEOUT_RATES,
): MarketSnapshot[] {
  const snapshots: MarketSnapshot[] = []
  const active = race.entries.filter(e => !e.scratched)

  for (const fraction of MTP_POOL_FRACTIONS) {
    const partial = Math.floor(SIMULATED_BETTORS * fraction)
    const buckets = new Map<string, number>()
    for (const e of active) buckets.set(e.horse.id, 0)

    for (let b = 0; b < partial; b++) {
      const pick = pickOne(rng, active, race, RECREATIONAL_FRACTION.win)
      buckets.set(pick.horse.id, (buckets.get(pick.horse.id) ?? 0) + BET_UNIT)
    }

    let totalPool = partial * BET_UNIT

    if (fraction === 1.0 && rng.next() < LATE_MONEY_CHANCE) {
      // Late "sharp money" surge lands on a horse under the share threshold.
      const candidates = active.filter(e => {
        const amount = buckets.get(e.horse.id) ?? 0
        return amount / totalPool < LATE_MONEY_SHARE_THRESHOLD
      })
      if (candidates.length > 0) {
        const surgeHorse = rng.pick(candidates)
        const surgeAmount = Math.floor(totalPool * LATE_MONEY_SURGE_FRACTION)
        buckets.set(surgeHorse.horse.id, (buckets.get(surgeHorse.horse.id) ?? 0) + surgeAmount)
        totalPool += surgeAmount
      }
    }

    // Stub pools for non-Win bets on MTP — the tote display only needs
    // Win-derived odds for the MTP ticker, so we leave the others as
    // empty placeholders. A fuller sim could animate all pools.
    const winPool: BetPool = { totalPool, buckets }
    const emptyPool = (): BetPool => ({ totalPool: 0, buckets: new Map() })
    const { odds, byHorse, favoriteId } = calculateOdds(winPool, takeoutRates.win)
    snapshots.push({
      winPool,
      placePool: emptyPool(),
      showPool: emptyPool(),
      exactaPool: emptyPool(),
      quinellaPool: emptyPool(),
      dailyDoublePool: nextRace ? emptyPool() : null,
      takeoutRates,
      odds, oddsByHorse: byHorse, favoriteId,
    })
  }

  return snapshots
}
