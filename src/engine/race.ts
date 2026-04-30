import type {
  Race, Entry, PaceScenario, RaceResult, FinishPosition, MarginLabel,
} from './types'
import { JOCKEYS, JOCKEY_ACTUAL_BONUS } from '@/data/jockeys'
import { surfaceFitBonus, distanceFitBonus } from './field'
import type { Rng } from './rng'

// ── Tuning constants ───────────────────────────────────────────
// All the numeric "knobs" of the race engine live here. Editing any
// of these changes the feel of the game without touching logic.

// Pace scenario thresholds.
const HOT_PACE_MIN_EARLY_SPEED = 3       // 3+ E-style horses → hot pace
const PACE_HOT_E_PENALTY = -6            // speed horses tire in a hot pace
const PACE_HOT_S_BONUS = +4              // closers benefit from hot pace
const PACE_SLOW_E_P_BONUS = +4           // soft lead: front-runners & pressers cruise
const PACE_SLOW_S_PENALTY = -4           // no pace to close into

// Post-position penalty: post 1 = 0, widest post = this value.
const POST_POSITION_PENALTY_MAX = -2

// Per-race jockey variance, applied on top of tier base. Uniform [-N, +N].
const JOCKEY_RACE_VARIANCE = 2

// Performance noise — sigma of the normal distribution applied to every
// horse's final number. ~12 PSR points gives real upsets without chaos.
const PERFORMANCE_VARIANCE_SIGMA = 12

// Dead-heat threshold: if two (or more) horses finish within this many
// performance points of the cluster leader, they share the position.
// Anchored to the cluster leader, not pairwise — see executeRace().
const DEAD_HEAT_THRESHOLD = 0.1

// Photo finish gap: the winner's margin over 2nd, in performance points.
// At/under this, the result renders as a photo finish in the UI.
const PHOTO_FINISH_THRESHOLD = 1.0

// ── Pace Scenario ──────────────────────────────────────────────

export function determinePaceScenario(entries: Entry[]): PaceScenario {
  const active = entries.filter(e => !e.scratched)
  const earlySpeedCount = active.filter(e => e.horse.runningStyle === 'E').length

  if (earlySpeedCount >= HOT_PACE_MIN_EARLY_SPEED) return 'hot'
  if (earlySpeedCount === 0) return 'slow'
  return 'honest'
}

function paceAdjustment(style: string, scenario: PaceScenario): number {
  if (scenario === 'hot') {
    if (style === 'E') return PACE_HOT_E_PENALTY
    if (style === 'S') return PACE_HOT_S_BONUS
    return 0
  }
  if (scenario === 'slow') {
    if (style === 'E' || style === 'P') return PACE_SLOW_E_P_BONUS
    if (style === 'S') return PACE_SLOW_S_PENALTY
    return 0
  }
  return 0 // honest pace — no adjustments
}

// ── Performance Calculation ────────────────────────────────────

function postPositionPenalty(pp: number, fieldSize: number): number {
  if (fieldSize <= 1) return 0
  return POST_POSITION_PENALTY_MAX * ((pp - 1) / (fieldSize - 1))
}

function jockeyRaceBonus(jockeyId: string, rng: Rng): number {
  const jockey = JOCKEYS.find(j => j.id === jockeyId)
  if (!jockey) return 0
  const base = JOCKEY_ACTUAL_BONUS[jockey.tier] ?? 0
  const variance = rng.next() * (JOCKEY_RACE_VARIANCE * 2) - JOCKEY_RACE_VARIANCE
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
        rng,
        surface: cond.surface,
        condition: cond.condition,
        fieldSize,
        postPosition: entry.postPosition,
      })
    : 0

  const variance = rng.normal(0, PERFORMANCE_VARIANCE_SIGMA)

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

  // Dead-heat clustering.
  //
  // Real racing: a dead heat is called when the photo can't separate two
  // noses. We model that with a performance threshold — if a trailing
  // horse's performance is within DH_THRESHOLD of the cluster LEADER,
  // it's indistinguishable. Crucially, we anchor to the cluster leader
  // (not the previous horse): if A=100.0, B=99.92, C=99.83, only A+B
  // tie — C is 0.17 behind the leader, measurably back. A naive pairwise
  // chain would wrongly rope C into the tie because B-C is tight.
  //
  // All horses in a cluster share the cluster's starting position, so a
  // 3-way dead heat for win produces three "1st place" finishers and the
  // next horse is 4th (not 2nd). That matters for payouts: the Place pool
  // pays all three as winners, each at a 1/3 slice.
  let deadHeat = false
  let i = 0
  while (i < finishOrder.length) {
    const anchor = finishOrder[i]!.performance
    let j = i + 1
    while (
      j < finishOrder.length &&
      Math.abs(anchor - finishOrder[j]!.performance) <= DEAD_HEAT_THRESHOLD
    ) {
      j++
    }
    const clusterSize = j - i
    if (clusterSize > 1) {
      const sharedPosition = finishOrder[i]!.position
      for (let k = i; k < j; k++) {
        finishOrder[k]!.deadHeat = true
        finishOrder[k]!.position = sharedPosition
        if (k > i) finishOrder[k]!.margin = 'dead heat'
      }
      deadHeat = true
    }
    i = j
  }

  const photoFinish = finishOrder.length >= 2 &&
    Math.abs(finishOrder[0]!.performance - finishOrder[1]!.performance) <= PHOTO_FINISH_THRESHOLD

  return {
    raceId: race.id,
    paceScenario,
    finishOrder,
    photoFinish,
    deadHeat,
  }
}
