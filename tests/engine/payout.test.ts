import { describe, it, expect } from 'vitest'
import { resolveBet, resolveRace } from '@/engine/payout'
import { buildMarketSnapshot } from '@/engine/market'
import { executeRace } from '@/engine/race'
import { generateField, generateRaceConditions } from '@/engine/field'
import { Rng } from '@/engine/rng'
import type { Race, Bet } from '@/engine/types'

function makeRaceAndResult(seed: number) {
  const rng = new Rng(seed)
  const conditions = generateRaceConditions(rng, 'CLM')
  const entries = generateField(rng, conditions, 8)
  const race: Race = {
    id: `payout-race-${seed}`,
    raceNumber: 1,
    trackCode: 'AQU',
    conditions,
    entries,
  }
  const market = buildMarketSnapshot(new Rng(seed + 1000), race)
  const result = executeRace(new Rng(seed + 2000), race)
  return { race, market, result }
}

describe('Payout Resolution', () => {
  it('win bet on winner returns positive payout', () => {
    const { result, market } = makeRaceAndResult(42)
    const winnerId = result.finishOrder[0]!.horseId
    const bet: Bet = { type: 'win', amount: 2, selections: [winnerId], raceId: result.raceId }
    const payout = resolveBet(bet, result, market)
    expect(payout.won).toBe(true)
    expect(payout.netReturn).toBeGreaterThan(0)
    expect(payout.displayPayout).toBeGreaterThanOrEqual(2.10) // min payout
  })

  it('win bet on loser returns 0', () => {
    const { result, market } = makeRaceAndResult(42)
    const loserId = result.finishOrder[result.finishOrder.length - 1]!.horseId
    const bet: Bet = { type: 'win', amount: 2, selections: [loserId], raceId: result.raceId }
    const payout = resolveBet(bet, result, market)
    expect(payout.won).toBe(false)
    expect(payout.netReturn).toBe(0)
  })

  it('place bet on 2nd place horse wins', () => {
    const { result, market } = makeRaceAndResult(42)
    const secondId = result.finishOrder[1]!.horseId
    const bet: Bet = { type: 'place', amount: 2, selections: [secondId], raceId: result.raceId }
    const payout = resolveBet(bet, result, market)
    expect(payout.won).toBe(true)
    expect(payout.netReturn).toBeGreaterThan(0)
  })

  it('show bet on 3rd place horse wins', () => {
    const { result, market } = makeRaceAndResult(42)
    const thirdId = result.finishOrder[2]!.horseId
    const bet: Bet = { type: 'show', amount: 2, selections: [thirdId], raceId: result.raceId }
    const payout = resolveBet(bet, result, market)
    expect(payout.won).toBe(true)
    expect(payout.netReturn).toBeGreaterThan(0)
  })

  it('show bet on 4th place horse loses', () => {
    const { result, market } = makeRaceAndResult(42)
    const fourthId = result.finishOrder[3]!.horseId
    const bet: Bet = { type: 'show', amount: 2, selections: [fourthId], raceId: result.raceId }
    const payout = resolveBet(bet, result, market)
    expect(payout.won).toBe(false)
    expect(payout.netReturn).toBe(0)
  })

  it('exacta with correct 1st-2nd wins', () => {
    const { result, market } = makeRaceAndResult(42)
    const firstId = result.finishOrder[0]!.horseId
    const secondId = result.finishOrder[1]!.horseId
    const bet: Bet = { type: 'exacta', amount: 2, selections: [firstId, secondId], raceId: result.raceId }
    const payout = resolveBet(bet, result, market)
    expect(payout.won).toBe(true)
    expect(payout.netReturn).toBeGreaterThan(0)
    // Exacta should pay more than win
    const winBet: Bet = { type: 'win', amount: 2, selections: [firstId], raceId: result.raceId }
    const winPayout = resolveBet(winBet, result, market)
    expect(payout.displayPayout).toBeGreaterThan(winPayout.displayPayout)
  })

  it('exacta with reversed order loses', () => {
    const { result, market } = makeRaceAndResult(42)
    const firstId = result.finishOrder[0]!.horseId
    const secondId = result.finishOrder[1]!.horseId
    const bet: Bet = { type: 'exacta', amount: 2, selections: [secondId, firstId], raceId: result.raceId }
    const payout = resolveBet(bet, result, market)
    expect(payout.won).toBe(false)
  })

  it('quinella wins with either order', () => {
    const { result, market } = makeRaceAndResult(42)
    const firstId = result.finishOrder[0]!.horseId
    const secondId = result.finishOrder[1]!.horseId

    const bet1: Bet = { type: 'quinella', amount: 2, selections: [firstId, secondId], raceId: result.raceId }
    const bet2: Bet = { type: 'quinella', amount: 2, selections: [secondId, firstId], raceId: result.raceId }

    expect(resolveBet(bet1, result, market).won).toBe(true)
    expect(resolveBet(bet2, result, market).won).toBe(true)
  })

  it('minimum payout is $2.10', () => {
    // Run many races and check no win payout is below $2.10
    for (let seed = 0; seed < 100; seed++) {
      const { result, market } = makeRaceAndResult(seed)
      const winnerId = result.finishOrder[0]!.horseId
      const bet: Bet = { type: 'win', amount: 2, selections: [winnerId], raceId: result.raceId }
      const payout = resolveBet(bet, result, market)
      expect(payout.displayPayout).toBeGreaterThanOrEqual(2.10)
    }
  })

  it('bet scaling works (larger bets = proportional return)', () => {
    const { result, market } = makeRaceAndResult(42)
    const winnerId = result.finishOrder[0]!.horseId

    const small: Bet = { type: 'win', amount: 2, selections: [winnerId], raceId: result.raceId }
    const big: Bet = { type: 'win', amount: 10, selections: [winnerId], raceId: result.raceId }

    const smallPayout = resolveBet(small, result, market)
    const bigPayout = resolveBet(big, result, market)

    // 10/2 = 5x scale
    expect(bigPayout.netReturn).toBeCloseTo(smallPayout.netReturn * 5, 1)
  })

  it('resolveRace aggregates all bet payouts', () => {
    const { result, market } = makeRaceAndResult(42)
    const winnerId = result.finishOrder[0]!.horseId
    const loserId = result.finishOrder[result.finishOrder.length - 1]!.horseId

    const bets: Bet[] = [
      { type: 'win', amount: 2, selections: [winnerId], raceId: result.raceId },
      { type: 'win', amount: 2, selections: [loserId], raceId: result.raceId },
    ]

    const resolved = resolveRace(bets, result, market)
    expect(resolved.payouts.length).toBe(2)
    expect(resolved.payouts[0]!.won).toBe(true)
    expect(resolved.payouts[1]!.won).toBe(false)
    expect(resolved.totalReturn).toBe(resolved.payouts[0]!.netReturn)
  })
})

describe('Payout Calibration — Long-term EV is negative', () => {
  it('betting favorites at $2 loses money over 500 races', () => {
    let totalBet = 0
    let totalReturn = 0

    for (let i = 0; i < 500; i++) {
      const { result, market } = makeRaceAndResult(i * 3)
      const favoriteId = market.favoriteId
      const bet: Bet = { type: 'win', amount: 2, selections: [favoriteId], raceId: result.raceId }
      const payout = resolveBet(bet, result, market)
      totalBet += 2
      totalReturn += payout.netReturn
    }

    const roi = (totalReturn - totalBet) / totalBet
    // Should be negative (house edge) but not catastrophic
    // Typical: -10% to -25%
    expect(roi).toBeLessThan(0)
    expect(roi).toBeGreaterThan(-0.40)
  })
})
