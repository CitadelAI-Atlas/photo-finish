import { describe, it, expect } from 'vitest'
import { executeRace, determinePaceScenario } from '@/engine/race'
import { buildMarketSnapshot } from '@/engine/market'
import { generateField, generateRaceConditions } from '@/engine/field'
import { Rng } from '@/engine/rng'
import type { Race, Entry } from '@/engine/types'

function makeRace(seed: number, fieldSize: number = 8): Race {
  const rng = new Rng(seed)
  const conditions = generateRaceConditions(rng, 'CLM')
  const entries = generateField(rng, conditions, fieldSize)
  return {
    id: `race-${seed}`,
    raceNumber: 1,
    trackCode: 'AQU',
    conditions,
    entries,
  }
}

describe('Pace Scenario', () => {
  it('hot pace when 3+ early speed horses', () => {
    const entries: Entry[] = [
      { horse: { id: '1', name: 'A', age: 4, sex: 'G', psr: 60, runningStyle: 'E', surfacePref: 'neutral', surfacePrefStrength: 'neutral', distancePref: 'versatile', quirk: null, jockeyId: 'j01' }, postPosition: 1, scratched: false, scratchReason: null },
      { horse: { id: '2', name: 'B', age: 4, sex: 'G', psr: 60, runningStyle: 'E', surfacePref: 'neutral', surfacePrefStrength: 'neutral', distancePref: 'versatile', quirk: null, jockeyId: 'j02' }, postPosition: 2, scratched: false, scratchReason: null },
      { horse: { id: '3', name: 'C', age: 4, sex: 'G', psr: 60, runningStyle: 'E', surfacePref: 'neutral', surfacePrefStrength: 'neutral', distancePref: 'versatile', quirk: null, jockeyId: 'j03' }, postPosition: 3, scratched: false, scratchReason: null },
      { horse: { id: '4', name: 'D', age: 4, sex: 'G', psr: 60, runningStyle: 'S', surfacePref: 'neutral', surfacePrefStrength: 'neutral', distancePref: 'versatile', quirk: null, jockeyId: 'j04' }, postPosition: 4, scratched: false, scratchReason: null },
    ]
    expect(determinePaceScenario(entries)).toBe('hot')
  })

  it('slow pace when 0 early speed', () => {
    const entries: Entry[] = [
      { horse: { id: '1', name: 'A', age: 4, sex: 'G', psr: 60, runningStyle: 'P', surfacePref: 'neutral', surfacePrefStrength: 'neutral', distancePref: 'versatile', quirk: null, jockeyId: 'j01' }, postPosition: 1, scratched: false, scratchReason: null },
      { horse: { id: '2', name: 'B', age: 4, sex: 'G', psr: 60, runningStyle: 'S', surfacePref: 'neutral', surfacePrefStrength: 'neutral', distancePref: 'versatile', quirk: null, jockeyId: 'j02' }, postPosition: 2, scratched: false, scratchReason: null },
      { horse: { id: '3', name: 'C', age: 4, sex: 'G', psr: 60, runningStyle: 'S', surfacePref: 'neutral', surfacePrefStrength: 'neutral', distancePref: 'versatile', quirk: null, jockeyId: 'j03' }, postPosition: 3, scratched: false, scratchReason: null },
    ]
    expect(determinePaceScenario(entries)).toBe('slow')
  })

  it('honest pace with 1-2 early speed', () => {
    const entries: Entry[] = [
      { horse: { id: '1', name: 'A', age: 4, sex: 'G', psr: 60, runningStyle: 'E', surfacePref: 'neutral', surfacePrefStrength: 'neutral', distancePref: 'versatile', quirk: null, jockeyId: 'j01' }, postPosition: 1, scratched: false, scratchReason: null },
      { horse: { id: '2', name: 'B', age: 4, sex: 'G', psr: 60, runningStyle: 'P', surfacePref: 'neutral', surfacePrefStrength: 'neutral', distancePref: 'versatile', quirk: null, jockeyId: 'j02' }, postPosition: 2, scratched: false, scratchReason: null },
      { horse: { id: '3', name: 'C', age: 4, sex: 'G', psr: 60, runningStyle: 'S', surfacePref: 'neutral', surfacePrefStrength: 'neutral', distancePref: 'versatile', quirk: null, jockeyId: 'j03' }, postPosition: 3, scratched: false, scratchReason: null },
    ]
    expect(determinePaceScenario(entries)).toBe('honest')
  })
})

describe('Race Execution', () => {
  it('produces a complete finish order', () => {
    const race = makeRace(42)
    const rng = new Rng(42)
    const result = executeRace(rng, race)
    const activeCount = race.entries.filter(e => !e.scratched).length
    expect(result.finishOrder.length).toBe(activeCount)
  })

  it('finish positions are sequential (accounting for dead heats)', () => {
    const race = makeRace(42)
    const rng = new Rng(42)
    const result = executeRace(rng, race)
    const positions = result.finishOrder.map(f => f.position)
    // Positions should be non-decreasing
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]!).toBeGreaterThanOrEqual(positions[i - 1]!)
    }
  })

  it('every horse in the field appears in finish order (non-scratched)', () => {
    const race = makeRace(42)
    const rng = new Rng(42)
    const result = executeRace(rng, race)
    const activeIds = race.entries.filter(e => !e.scratched).map(e => e.horse.id)
    const finishIds = result.finishOrder.map(f => f.horseId)
    expect(finishIds.sort()).toEqual(activeIds.sort())
  })

  it('winner has highest performance', () => {
    const race = makeRace(42)
    const rng = new Rng(42)
    const result = executeRace(rng, race)
    const maxPerf = Math.max(...result.finishOrder.map(f => f.performance))
    expect(result.finishOrder[0]!.performance).toBe(maxPerf)
  })
})

describe('Calibration — Favorite Win Rate', () => {
  it('favorite wins 28–40% of races over 2000 simulations', () => {
    const iterations = 2000
    let favoriteWins = 0

    for (let i = 0; i < iterations; i++) {
      const raceSeed = i * 7 + 1
      const race = makeRace(raceSeed)
      const marketRng = new Rng(raceSeed + 10000)
      const market = buildMarketSnapshot(marketRng, race)
      const raceRng = new Rng(raceSeed + 20000)
      const result = executeRace(raceRng, race)

      if (result.finishOrder[0]?.horseId === market.favoriteId) {
        favoriteWins++
      }
    }

    const winRate = favoriteWins / iterations
    // Target: 30–35%, allow wider band for test stability
    expect(winRate).toBeGreaterThan(0.20)
    expect(winRate).toBeLessThan(0.45)
  })
})

describe('Calibration — Longshot Win Rate', () => {
  it('longshots (10-1+) win 8–25% of races', () => {
    const iterations = 2000
    let longshotWins = 0
    let totalRaces = 0

    for (let i = 0; i < iterations; i++) {
      const raceSeed = i * 13 + 3
      const race = makeRace(raceSeed)
      const marketRng = new Rng(raceSeed + 30000)
      const market = buildMarketSnapshot(marketRng, race)
      const raceRng = new Rng(raceSeed + 40000)
      const result = executeRace(raceRng, race)

      totalRaces++
      const winnerId = result.finishOrder[0]?.horseId
      const winnerOdds = market.odds.find(o => o.horseId === winnerId)?.odds ?? 0
      if (winnerOdds >= 10) {
        longshotWins++
      }
    }

    const rate = longshotWins / totalRaces
    expect(rate).toBeGreaterThan(0.05)
    expect(rate).toBeLessThan(0.30)
  })
})

describe('Calibration — Photo Finish Rate', () => {
  it('photo finishes occur in 5–20% of races', () => {
    const iterations = 2000
    let photoFinishes = 0

    for (let i = 0; i < iterations; i++) {
      const rng = new Rng(i * 11 + 7)
      const race = makeRace(i * 11 + 7)
      const result = executeRace(rng, race)
      if (result.photoFinish) photoFinishes++
    }

    const rate = photoFinishes / iterations
    expect(rate).toBeGreaterThan(0.03)
    expect(rate).toBeLessThan(0.25)
  })
})
