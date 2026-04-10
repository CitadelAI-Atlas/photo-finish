import type {
  Race, Entry, PaceScenario, RaceResult, FinishPosition, MarginLabel,
} from './types'
import { JOCKEYS, JOCKEY_RACE_BONUS } from '@/data/jockeys'
import { surfaceFitBonus, distanceFitBonus } from './field'
import type { Rng } from './rng'

// ── Pace Scenario ──────────────────────────────────────────────

export function determinePaceScenario(entries: Entry[]): PaceScenario {
  const active = entries.filter(e => !e.scratched)
  const earlySpeedCount = active.filter(e => e.horse.runningStyle === 'E').length

  if (earlySpeedCount >= 3) return 'hot'
  if (earlySpeedCount === 0) return 'slow'
  return 'honest'
}

function paceAdjustment(style: string, scenario: PaceScenario): number {
  if (scenario === 'hot') {
    if (style === 'E') return -6  // speed horses tire
    if (style === 'S') return +4  // closers benefit
    return 0                       // pressers unaffected
  }
  if (scenario === 'slow') {
    if (style === 'E' || style === 'P') return +4  // soft lead
    if (style === 'S') return -4                     // no pace to close into
    return 0
  }
  return 0 // honest pace — no adjustments
}

// ── Performance Calculation ────────────────────────────────────

function postPositionPenalty(pp: number, fieldSize: number): number {
  // Linear interpolation: post 1 = 0, widest post = -2
  if (fieldSize <= 1) return 0
  return -2 * ((pp - 1) / (fieldSize - 1))
}

function jockeyRaceBonus(jockeyId: string, rng: Rng): number {
  const jockey = JOCKEYS.find(j => j.id === jockeyId)
  if (!jockey) return 0
  const base = JOCKEY_RACE_BONUS[jockey.tier] ?? 0
  const variance = rng.next() * 4 - 2  // random(-2, +2)
  return base + variance
}

export function calculatePerformance(
  entry: Entry,
  race: Race,
  paceScenario: PaceScenario,
  rng: Rng,
): number {
  const h = entry.horse
  const cond = race.conditions
  const fieldSize = race.entries.filter(e => !e.scratched).length

  const base = h.psr
  const pace = paceAdjustment(h.runningStyle, paceScenario)
  const surface = surfaceFitBonus(h, cond.surface)
  const distance = distanceFitBonus(h, cond.distanceCategory)
  const jockey = jockeyRaceBonus(h.jockeyId, rng)
  const post = postPositionPenalty(entry.postPosition, fieldSize)

  const quirkAdj = h.quirk
    ? h.quirk.effect({
        surface: cond.surface,
        condition: cond.condition,
        fieldSize,
        postPosition: entry.postPosition,
      })
    : 0

  const variance = rng.normal(0, 12)

  return base + pace + surface + distance + jockey + post + quirkAdj + variance
}

// ── Margin Labels ──────────────────────────────────────────────

export function performanceGapToMargin(gap: number): MarginLabel {
  const abs = Math.abs(gap)
  if (abs <= 0.5) return 'nose'
  if (abs <= 1.0) return 'head'
  if (abs <= 1.5) return 'neck'
  if (abs <= 2.5) return '½ length'
  if (abs <= 4.0) return `${Math.round(abs - 1)} length${abs > 2.5 ? 's' : ''}`
  if (abs <= 10) return `${Math.round(abs - 1)} lengths`
  return `${Math.round(abs)} lengths`
}

// ── Execute Race ───────────────────────────────────────────────

export function executeRace(rng: Rng, race: Race): RaceResult {
  const activeEntries = race.entries.filter(e => !e.scratched)
  const paceScenario = determinePaceScenario(race.entries)

  // Calculate performance for each horse
  const performances = activeEntries.map(entry => ({
    entry,
    performance: calculatePerformance(entry, race, paceScenario, rng),
  }))

  // Sort by performance descending
  performances.sort((a, b) => b.performance - a.performance)

  // Build finish order with margins
  const finishOrder: FinishPosition[] = performances.map((p, idx) => {
    const prevGap = idx === 0 ? 0 : performances[idx - 1]!.performance - p.performance

    return {
      horseId: p.entry.horse.id,
      position: idx + 1,
      performance: p.performance,
      margin: idx === 0 ? '' : performanceGapToMargin(prevGap),
      deadHeat: false,
    }
  })

  // Check for dead heats (within 0.1 points)
  let deadHeat = false
  for (let i = 0; i < finishOrder.length - 1; i++) {
    const gap = Math.abs(finishOrder[i]!.performance - finishOrder[i + 1]!.performance)
    if (gap <= 0.1) {
      finishOrder[i]!.deadHeat = true
      finishOrder[i + 1]!.deadHeat = true
      // Dead heat horses share the same position
      finishOrder[i + 1]!.position = finishOrder[i]!.position
      finishOrder[i + 1]!.margin = 'dead heat'
      deadHeat = true
    }
  }

  // Check for photo finish (within 0.5 points between 1st and 2nd)
  const photoFinish = finishOrder.length >= 2 &&
    Math.abs(finishOrder[0]!.performance - finishOrder[1]!.performance) <= 0.5

  return {
    raceId: race.id,
    paceScenario,
    finishOrder,
    photoFinish,
    deadHeat,
  }
}
