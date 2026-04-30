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
// horse's final number. Sized in concert with trouble events (below):
// Gaussian variance models day-level fitness wobble, trouble models
// discrete trip incidents. Together they pull the favorite-win rate
// toward the real-world ~33% target without distorting margins.
const PERFORMANCE_VARIANCE_SIGMA = 10

// ── Trouble events ─────────────────────────────────────────────
// Real-world racing upsets come from discrete bad luck — bumped at
// the gate, checked in traffic, lost path through the turn — not from
// symmetric Gaussian noise. Without a trouble mechanic, the chalk wins
// too often (audit: 45% vs real ~33%) because the favorite has no way
// to BLOW the race short of a 2-sigma negative variance roll.
//
// Trouble fires per-horse independently and only ever subtracts. Three
// severity tiers loosely mirror chart-call language: minor (had to
// take up briefly), moderate (steadied/checked), major (bumped hard,
// lost rider's whip, badly hampered). Tuned alongside the Gaussian
// variance so total field spread stays inside the realistic band.
const TROUBLE_RATE = 0.25
const TROUBLE_MINOR_P = 0.55
const TROUBLE_MODERATE_P = 0.30
// Remainder (15%) is major.
const TROUBLE_MINOR_MIN = 4
const TROUBLE_MINOR_MAX = 9
const TROUBLE_MODERATE_MIN = 10
const TROUBLE_MODERATE_MAX = 18
const TROUBLE_MAJOR_MIN = 19
const TROUBLE_MAJOR_MAX = 30

// Perf-points per length. Engine performance is computed in PSR-like
// units (scale 0–110ish); margins between horses get reported in
// lengths. Real broadcasts stretch ½ second of running time across
// ~3 lengths, and our engine variance is sized to that scale. Without
// the divisor, a 30-point perf gap rendered as "29 lengths" — wider
// than the screen and unrealistic for any real claiming race. Using
// 2.5 perf-points per length keeps the visual spread inside the cap
// and the labels honest. This is the SINGLE knob that ties summary
// margin labels to rail-cam pixels — both consult performanceGapToMargin
// and perfGapToLengths via this constant.
const PERF_PER_LENGTH = 2.5

export function perfGapToLengths(gap: number): number {
  return Math.max(0, gap) / PERF_PER_LENGTH
}

// Dead-heat threshold: if two (or more) horses finish within this many
// performance points of the cluster leader, they share the position.
// Anchored to the cluster leader, not pairwise — see executeRace().
const DEAD_HEAT_THRESHOLD = 0.1

// Photo finish gap: the winner's margin over 2nd, in performance points.
// At/under this, the result renders as a photo finish in the UI.
// Sized so a photo only triggers in nose/head territory (≤0.4 lengths).
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

function rollTrouble(rng: Rng): number {
  if (rng.next() >= TROUBLE_RATE) return 0
  const tier = rng.next()
  let lo: number, hi: number
  if (tier < TROUBLE_MINOR_P) {
    lo = TROUBLE_MINOR_MIN; hi = TROUBLE_MINOR_MAX
  } else if (tier < TROUBLE_MINOR_P + TROUBLE_MODERATE_P) {
    lo = TROUBLE_MODERATE_MIN; hi = TROUBLE_MODERATE_MAX
  } else {
    lo = TROUBLE_MAJOR_MIN; hi = TROUBLE_MAJOR_MAX
  }
  return -(lo + rng.next() * (hi - lo))
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
  const trouble = rollTrouble(rng)

  return base + pace + surface + distance + jockey + post + quirkAdj + variance + trouble
}

// ── Margin Labels ──────────────────────────────────────────────

export function performanceGapToMargin(gap: number): MarginLabel {
  // Convert perf-points → lengths via the single scaling knob, then
  // bucket. Sub-length labels (nose/head/neck/½) are body-overlap
  // territory; from 1 length up we round to the nearest length.
  const lengths = perfGapToLengths(Math.abs(gap))
  if (lengths <= 0.15) return 'nose'
  if (lengths <= 0.30) return 'head'
  if (lengths <= 0.55) return 'neck'
  if (lengths <= 0.85) return '½ length'
  if (lengths < 1.5) return '1 length'
  return `${Math.round(lengths)} lengths`
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
