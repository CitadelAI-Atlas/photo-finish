import { describe, it, expect } from 'vitest'
import { simulatePool, calculateOdds, buildMarketSnapshot } from '@/engine/market'
import { generateField, generateRaceConditions } from '@/engine/field'
import { Rng } from '@/engine/rng'
import type { Race } from '@/engine/types'

function makeRace(rng: Rng, fieldSize: number = 8): Race {
  const conditions = generateRaceConditions(rng, 'CLM')
  const entries = generateField(rng, conditions, fieldSize)
  return {
    id: 'test-race',
    raceNumber: 1,
    trackCode: 'AQU',
    conditions,
    entries,
  }
}

describe('Market Simulation', () => {
  it('pool total equals bettors × $2', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const pool = simulatePool(rng, race)
    expect(pool.totalPool).toBe(1000 * 2) // 1000 bettors × $2
  })

  it('every active horse has a pool entry', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const pool = simulatePool(rng, race)
    const active = race.entries.filter(e => !e.scratched)
    for (const entry of active) {
      expect(pool.horsePool.has(entry.horse.id)).toBe(true)
    }
  })

  it('odds are sorted ascending (favorite first)', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const pool = simulatePool(rng, race)
    const odds = calculateOdds(pool)
    for (let i = 1; i < odds.length; i++) {
      expect(odds[i]!.odds).toBeGreaterThanOrEqual(odds[i - 1]!.odds)
    }
  })

  it('favorite has shortest odds', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const snapshot = buildMarketSnapshot(rng, race)
    expect(snapshot.favoriteId).toBe(snapshot.odds[0]!.horseId)
  })

  it('odds minimum is 0.1', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const pool = simulatePool(rng, race)
    const odds = calculateOdds(pool)
    for (const o of odds) {
      expect(o.odds).toBeGreaterThanOrEqual(0.1)
    }
  })

  it('sum of implied probabilities exceeds 100% (overround)', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const snapshot = buildMarketSnapshot(rng, race)
    const totalImplied = snapshot.odds.reduce((sum, o) => sum + o.impliedProb, 0)
    expect(totalImplied).toBeGreaterThan(1.0) // overround
  })

  it('produces realistic odds range over many races', () => {
    const rng = new Rng(42)
    let hasShortOdds = false
    let hasLongOdds = false

    for (let i = 0; i < 50; i++) {
      const race = makeRace(new Rng(i + 100))
      const snapshot = buildMarketSnapshot(new Rng(i + 200), race)
      for (const o of snapshot.odds) {
        if (o.odds <= 2) hasShortOdds = true
        if (o.odds >= 10) hasLongOdds = true
      }
    }

    expect(hasShortOdds).toBe(true)
    expect(hasLongOdds).toBe(true)
  })
})
