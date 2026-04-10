import type {
  Horse, Entry, Race, RaceConditions, RaceClass, Surface, TrackCondition,
  DistanceCategory, Sex, RunningStyle, SurfacePref, SurfacePrefStrength,
  DistancePref, RaceCard,
} from './types'
import { RACES_PER_CARD } from './types'
import { NAME_POOLS } from '@/data/names'
import { JOCKEYS } from '@/data/jockeys'
import { QUIRKS, QUIRK_CHANCE } from '@/data/quirks'
import type { Rng } from './rng'

// ── PSR distributions by class ─────────────────────────────────

const PSR_PARAMS: Record<RaceClass, { mean: number; std: number; min: number; max: number }> = {
  MCL: { mean: 48, std: 10, min: 25, max: 70 },
  CLM: { mean: 62, std: 10, min: 40, max: 85 },
  ALW: { mean: 76, std: 8,  min: 55, max: 95 },
  STK: { mean: 90, std: 8,  min: 70, max: 115 },
}

// ── Distribution tables ────────────────────────────────────────

const SEX_TABLE: [Sex, number][] = [
  ['G', 0.47], ['M', 0.25], ['F', 0.19], ['C', 0.06], ['H', 0.03],
]

const AGE_TABLE: [number, number][] = [
  [3, 0.30], [4, 0.28], [5, 0.22], [6, 0.12], [7, 0.08],
]

const RUNNING_STYLE_TABLE: [RunningStyle, number][] = [
  ['E', 0.30], ['P', 0.40], ['S', 0.30],
]

// Surface distributions
const SURFACE_WEIGHTS: [Surface, number][] = [
  ['D', 0.70], ['T', 0.20], ['A', 0.10],
]

// Condition distributions per surface
const DIRT_CONDITIONS: [TrackCondition, number][] = [
  ['FT', 0.65], ['GD', 0.12], ['SY', 0.10], ['MY', 0.08], ['WF', 0.03], ['SL', 0.01], ['HY', 0.01],
]

const TURF_CONDITIONS: [TrackCondition, number][] = [
  ['FM', 0.60], ['GD', 0.20], ['YL', 0.10], ['SF', 0.07], ['HY', 0.03],
]

const SYNTHETIC_CONDITIONS: [TrackCondition, number][] = [
  ['FT', 0.85], ['GD', 0.15],
]

// Distance distributions (furlongs)
const DISTANCE_TABLE: [number, number][] = [
  [5.0, 0.08], [5.5, 0.12], [6.0, 0.25], [6.5, 0.08], [7.0, 0.10],
  [8.0, 0.18], [8.5, 0.10], [9.0, 0.06], [10.0, 0.03],
]

// ── Generators ─────────────────────────────────────────────────

function weightedPick<T>(rng: Rng, table: [T, number][]): T {
  const items = table.map(([v]) => v)
  const weights = table.map(([, w]) => w)
  return rng.weightedPick(items, weights)
}

function generatePSR(rng: Rng, raceClass: RaceClass): number {
  const p = PSR_PARAMS[raceClass]
  const raw = rng.normal(p.mean, p.std)
  return Math.round(Math.max(p.min, Math.min(p.max, raw)))
}

function categorizeDistance(furlongs: number): DistanceCategory {
  if (furlongs <= 6.5) return 'sprint'
  if (furlongs <= 7.5) return 'middle'
  return 'route'
}

export function generateRaceConditions(rng: Rng, raceClass: RaceClass): RaceConditions {
  const surface = weightedPick(rng, SURFACE_WEIGHTS)

  let condition: TrackCondition
  if (surface === 'D') condition = weightedPick(rng, DIRT_CONDITIONS)
  else if (surface === 'T') condition = weightedPick(rng, TURF_CONDITIONS)
  else condition = weightedPick(rng, SYNTHETIC_CONDITIONS)

  const distanceFurlongs = weightedPick(rng, DISTANCE_TABLE)
  const distanceCategory = categorizeDistance(distanceFurlongs)

  return { raceClass, surface, condition, distanceFurlongs, distanceCategory }
}

function generateSurfacePref(rng: Rng): { pref: SurfacePref; strength: SurfacePrefStrength } {
  const roll = rng.next()
  if (roll < 0.40) {
    // Strong preference
    const pref = weightedPick(rng, [['dirt' as SurfacePref, 0.6], ['turf' as SurfacePref, 0.3], ['synthetic' as SurfacePref, 0.1]])
    return { pref, strength: 'strong' }
  }
  if (roll < 0.70) {
    const pref = weightedPick(rng, [['dirt' as SurfacePref, 0.6], ['turf' as SurfacePref, 0.3], ['synthetic' as SurfacePref, 0.1]])
    return { pref, strength: 'mild' }
  }
  return { pref: 'neutral', strength: 'neutral' }
}

function surfaceMatchesCode(pref: SurfacePref): Surface | null {
  if (pref === 'dirt') return 'D'
  if (pref === 'turf') return 'T'
  if (pref === 'synthetic') return 'A'
  return null
}

export function surfaceFitBonus(horse: Horse, surface: Surface): number {
  if (horse.surfacePrefStrength === 'neutral') return 0
  const prefSurface = surfaceMatchesCode(horse.surfacePref)
  const match = prefSurface === surface
  if (horse.surfacePrefStrength === 'strong') return match ? 8 : -8
  return match ? 3 : -3 // mild
}

export function distanceFitBonus(horse: Horse, distanceCategory: DistanceCategory): number {
  if (horse.distancePref === 'versatile') return 0
  if (horse.distancePref === 'sprint' && distanceCategory === 'sprint') return 5
  if (horse.distancePref === 'sprint' && distanceCategory === 'route') return -5
  if (horse.distancePref === 'route' && distanceCategory === 'route') return 5
  if (horse.distancePref === 'route' && distanceCategory === 'sprint') return -5
  return 0 // middle distances are neutral for both
}

export function generateHorse(rng: Rng, raceClass: RaceClass, id: string): Horse {
  const names = NAME_POOLS[raceClass]
  const name = rng.pick(names)
  const age = weightedPick(rng, AGE_TABLE)
  const sex = weightedPick(rng, SEX_TABLE)
  const psr = generatePSR(rng, raceClass)
  const runningStyle = weightedPick(rng, RUNNING_STYLE_TABLE)
  const { pref: surfacePref, strength: surfacePrefStrength } = generateSurfacePref(rng)
  const distancePref = weightedPick<DistancePref>(rng, [['sprint', 0.35], ['route', 0.30], ['versatile', 0.35]])
  const quirk = rng.next() < QUIRK_CHANCE ? rng.pick(QUIRKS) : null
  const jockey = rng.pick(JOCKEYS)

  return {
    id, name, age, sex, psr, runningStyle,
    surfacePref, surfacePrefStrength, distancePref,
    quirk, jockeyId: jockey.id,
  }
}

export function generateField(rng: Rng, conditions: RaceConditions, fieldSize: number): Entry[] {
  const usedNames = new Set<string>()
  const usedJockeys = new Set<string>()
  const entries: Entry[] = []

  for (let i = 0; i < fieldSize; i++) {
    let horse: Horse
    let attempts = 0
    do {
      horse = generateHorse(rng, conditions.raceClass, `h${i + 1}`)
      attempts++
    } while ((usedNames.has(horse.name) || usedJockeys.has(horse.jockeyId)) && attempts < 50)

    usedNames.add(horse.name)
    usedJockeys.add(horse.jockeyId)

    entries.push({
      horse: { ...horse, id: `h${i + 1}` },
      postPosition: i + 1,
      scratched: false,
      scratchReason: null,
    })
  }

  return entries
}

export function applyScratches(rng: Rng, entries: Entry[], minRunners: number = 4): Entry[] {
  const scratchReasons = ['veterinary', 'trainer', 'off-turf'] as const
  let activeCount = entries.length

  return entries.map(entry => {
    if (activeCount <= minRunners) return entry
    if (rng.next() < 0.10) {
      activeCount--
      return {
        ...entry,
        scratched: true,
        scratchReason: rng.pick(scratchReasons),
      }
    }
    return entry
  })
}

export function generateRace(
  rng: Rng,
  raceNumber: number,
  trackCode: string,
  raceClass: RaceClass,
  maxFieldSize: number,
): Race {
  const conditions = generateRaceConditions(rng, raceClass)
  const fieldSize = Math.min(maxFieldSize, rng.int(maxFieldSize - 1, maxFieldSize))
  const entries = applyScratches(rng, generateField(rng, conditions, fieldSize))

  return {
    id: `${trackCode}-${raceNumber}`,
    raceNumber,
    trackCode,
    conditions,
    entries,
  }
}

export function generateCard(
  rng: Rng,
  trackCode: string,
  availableClasses: RaceClass[],
  maxFieldSize: number,
): RaceCard {
  const races: Race[] = []

  for (let i = 1; i <= RACES_PER_CARD; i++) {
    // Last race is the "featured" race — one tier above if possible
    const isFeature = i === RACES_PER_CARD
    let raceClass: RaceClass

    if (isFeature) {
      const classOrder: RaceClass[] = ['MCL', 'CLM', 'ALW', 'STK']
      const highestIdx = Math.max(...availableClasses.map(c => classOrder.indexOf(c)))
      const featureIdx = Math.min(highestIdx + 1, classOrder.length - 1)
      raceClass = classOrder[featureIdx]!
    } else {
      raceClass = rng.pick(availableClasses)
    }

    const featureFieldBonus = isFeature ? 2 : 0
    races.push(generateRace(rng, i, trackCode, raceClass, maxFieldSize + featureFieldBonus))
  }

  return {
    id: `${trackCode}-card-${Date.now()}`,
    trackCode,
    races,
  }
}
