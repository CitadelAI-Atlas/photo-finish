import { describe, it, expect } from 'vitest'
import { calculateOdds, buildMarketSnapshot, quinellaKey } from '@/engine/market'
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

describe('Market Simulation — pool shape', () => {
  it('every pool on the snapshot has a non-negative total', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const snap = buildMarketSnapshot(rng, race)
    for (const pool of [snap.winPool, snap.placePool, snap.showPool, snap.exactaPool, snap.quinellaPool]) {
      expect(pool.totalPool).toBeGreaterThanOrEqual(0)
      expect(pool.buckets.size).toBeGreaterThan(0)
    }
  })

  it('every active horse has a Win pool entry', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const snap = buildMarketSnapshot(rng, race)
    const active = race.entries.filter(e => !e.scratched)
    for (const entry of active) {
      expect(snap.winPool.buckets.has(entry.horse.id)).toBe(true)
    }
  })

  it('win pool total equals sum of bucket values', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const snap = buildMarketSnapshot(rng, race)
    const sum = [...snap.winPool.buckets.values()].reduce((a, b) => a + b, 0)
    expect(sum).toBe(snap.winPool.totalPool)
  })

  it('DD pool is null without nextRace, populated with nextRace', () => {
    const rng = new Rng(42)
    const raceA = makeRace(rng, 8)
    const raceB = makeRace(new Rng(99), 8)
    const soloSnap = buildMarketSnapshot(rng, raceA)
    expect(soloSnap.dailyDoublePool).toBeNull()
    const ddSnap = buildMarketSnapshot(rng, raceA, raceB)
    expect(ddSnap.dailyDoublePool).not.toBeNull()
    expect(ddSnap.dailyDoublePool!.totalPool).toBeGreaterThan(0)
  })

  it('quinellaKey is canonical (A,B) == (B,A)', () => {
    expect(quinellaKey('alpha', 'beta')).toBe(quinellaKey('beta', 'alpha'))
  })
})

describe('Market Simulation — odds', () => {
  it('odds are sorted ascending (favorite first)', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const snap = buildMarketSnapshot(rng, race)
    for (let i = 1; i < snap.odds.length; i++) {
      expect(snap.odds[i]!.odds).toBeGreaterThanOrEqual(snap.odds[i - 1]!.odds)
    }
  })

  it('favorite has shortest odds', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const snap = buildMarketSnapshot(rng, race)
    expect(snap.favoriteId).toBe(snap.odds[0]!.horseId)
  })

  it('oddsByHorse lookup returns same entry as array scan', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const snap = buildMarketSnapshot(rng, race)
    for (const o of snap.odds) {
      expect(snap.oddsByHorse.get(o.horseId)).toBe(o)
    }
  })

  it('calculateOdds minimum is the lowest tote bucket (0.20)', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const snap = buildMarketSnapshot(rng, race)
    const { odds } = calculateOdds(snap.winPool)
    for (const o of odds) {
      expect(o.odds).toBeGreaterThanOrEqual(0.20)
    }
  })

  it('sum of implied probabilities exceeds 100% (overround from takeout)', () => {
    const rng = new Rng(42)
    const race = makeRace(rng)
    const snap = buildMarketSnapshot(rng, race)
    const total = snap.odds.reduce((sum, o) => sum + o.impliedProb, 0)
    expect(total).toBeGreaterThan(1.0)
  })

  it('produces realistic odds range over many races', () => {
    let hasShort = false
    let hasLong = false
    for (let i = 0; i < 50; i++) {
      const race = makeRace(new Rng(i + 100))
      const snap = buildMarketSnapshot(new Rng(i + 200), race)
      for (const o of snap.odds) {
        if (o.odds <= 2) hasShort = true
        if (o.odds >= 10) hasLong = true
      }
    }
    expect(hasShort).toBe(true)
    expect(hasLong).toBe(true)
  })
})
