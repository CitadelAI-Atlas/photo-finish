import type {
  Entry, Race, PoolState, OddsLine, MarketSnapshot,
} from './types'
import { TAKEOUT_WIN, SIMULATED_BETTORS } from './types'
import { JOCKEYS, JOCKEY_BONUS } from '@/data/jockeys'
import { surfaceFitBonus, distanceFitBonus } from './field'
import type { Rng } from './rng'

// ── Simulated Crowd Betting ────────────────────────────────────

function getJockeyBonus(jockeyId: string): number {
  const jockey = JOCKEYS.find(j => j.id === jockeyId)
  if (!jockey) return 0
  return JOCKEY_BONUS[jockey.tier] ?? 0
}

function estimateHorseStrength(entry: Entry, race: Race, rng: Rng): number {
  const h = entry.horse
  const cond = race.conditions

  const base = h.psr
  const jockey = getJockeyBonus(h.jockeyId)
  const surface = surfaceFitBonus(h, cond.surface)
  const distance = distanceFitBonus(h, cond.distanceCategory)
  const noise = rng.normal(0, 12) // crowd noise — makes odds imperfect

  return base + jockey + surface + distance + noise
}

export function simulatePool(rng: Rng, race: Race): PoolState {
  const activeEntries = race.entries.filter(e => !e.scratched)
  const horsePool = new Map<string, number>()

  // Initialize pools
  for (const entry of activeEntries) {
    horsePool.set(entry.horse.id, 0)
  }

  // Each virtual bettor picks their top horse
  for (let b = 0; b < SIMULATED_BETTORS; b++) {
    let bestId = activeEntries[0]!.horse.id
    let bestEstimate = -Infinity

    for (const entry of activeEntries) {
      const est = estimateHorseStrength(entry, race, rng)
      if (est > bestEstimate) {
        bestEstimate = est
        bestId = entry.horse.id
      }
    }

    horsePool.set(bestId, (horsePool.get(bestId) ?? 0) + 2) // $2 per bettor
  }

  const totalPool = Array.from(horsePool.values()).reduce((a, b) => a + b, 0)
  return { totalPool, horsePool }
}

export function calculateOdds(pool: PoolState, takeout: number = TAKEOUT_WIN): OddsLine[] {
  const odds: OddsLine[] = []

  for (const [horseId, amount] of pool.horsePool) {
    const poolShare = amount / pool.totalPool
    const rawOdds = poolShare > 0
      ? (1 - takeout) / poolShare - 1
      : 99 // nobody bet on this horse

    // Round down to nearest 0.1 (dime), minimum 0.1
    const displayOdds = Math.max(0.1, Math.floor(rawOdds * 10) / 10)
    const impliedProb = 1 / (displayOdds + 1)

    odds.push({ horseId, odds: displayOdds, impliedProb, poolShare })
  }

  // Sort by odds ascending (favorite first)
  odds.sort((a, b) => a.odds - b.odds)
  return odds
}

export function buildMarketSnapshot(rng: Rng, race: Race): MarketSnapshot {
  const pool = simulatePool(rng, race)
  const odds = calculateOdds(pool)
  const favoriteId = odds[0]?.horseId ?? ''

  return { pool, odds, favoriteId }
}

// Generate MTP snapshots — odds evolve as the pool fills
export function generateMTPSnapshots(
  rng: Rng,
  race: Race,
): MarketSnapshot[] {
  // Morning line (rough estimate, small pool)
  const snapshots: MarketSnapshot[] = []

  // 4 snapshots: MTP 5:00 (25%), 3:00 (50%), 1:00 (75%), 0:00 (100%)
  const poolFractions = [0.25, 0.50, 0.75, 1.0]

  for (const fraction of poolFractions) {
    // Simulate a partial pool by running fewer bettors
    const partialBettors = Math.floor(SIMULATED_BETTORS * fraction)
    const activeEntries = race.entries.filter(e => !e.scratched)
    const horsePool = new Map<string, number>()

    for (const entry of activeEntries) {
      horsePool.set(entry.horse.id, 0)
    }

    for (let b = 0; b < partialBettors; b++) {
      let bestId = activeEntries[0]!.horse.id
      let bestEstimate = -Infinity

      for (const entry of activeEntries) {
        const est = estimateHorseStrength(entry, race, rng)
        if (est > bestEstimate) {
          bestEstimate = est
          bestId = entry.horse.id
        }
      }

      horsePool.set(bestId, (horsePool.get(bestId) ?? 0) + 2)
    }

    const totalPool = Array.from(horsePool.values()).reduce((a, b) => a + b, 0)
    const pool: PoolState = { totalPool, horsePool }

    // Apply late money surge on final snapshot (5% chance)
    if (fraction === 1.0 && rng.next() < 0.05) {
      const entries = activeEntries.filter(e => {
        const amount = horsePool.get(e.horse.id) ?? 0
        return amount / totalPool < 0.15 // only on non-favorites
      })
      if (entries.length > 0) {
        const surgeHorse = rng.pick(entries)
        const surgeAmount = Math.floor(totalPool * 0.30)
        horsePool.set(surgeHorse.horse.id, (horsePool.get(surgeHorse.horse.id) ?? 0) + surgeAmount)
        pool.totalPool += surgeAmount
      }
    }

    const odds = calculateOdds(pool)
    const favoriteId = odds[0]?.horseId ?? ''
    snapshots.push({ pool, odds, favoriteId })
  }

  return snapshots
}
