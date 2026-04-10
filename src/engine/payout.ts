import type {
  Bet, Payout, PayoutResult, RaceResult, MarketSnapshot,
} from './types'
import { TAKEOUT_WIN, TAKEOUT_EXOTIC, MIN_PAYOUT_PER_DOLLAR, BET_UNIT } from './types'

// ── Pool-based payout calculation ──────────────────────────────

function winPayout(market: MarketSnapshot, winnerId: string): number {
  const winnerPool = market.pool.horsePool.get(winnerId) ?? 0
  if (winnerPool === 0) return 0
  const netPool = market.pool.totalPool * (1 - TAKEOUT_WIN)
  const payoutPerDollar = netPool / winnerPool
  return Math.max(MIN_PAYOUT_PER_DOLLAR * BET_UNIT, Math.floor(payoutPerDollar * BET_UNIT * 10) / 10)
}

function placePayout(market: MarketSnapshot, horseId: string, firstId: string, secondId: string): number {
  if (horseId !== firstId && horseId !== secondId) return 0

  const horsePool = market.pool.horsePool.get(horseId) ?? 0
  if (horsePool === 0) return 0

  const netPool = market.pool.totalPool * (1 - TAKEOUT_WIN)
  // Place pool splits evenly between the two in-the-money horses
  const halfNet = netPool / 2
  const payoutPerDollar = halfNet / horsePool

  // Ensure minimum payout — but Place typically pays less than Win
  return Math.max(MIN_PAYOUT_PER_DOLLAR * BET_UNIT, Math.floor(payoutPerDollar * BET_UNIT * 10) / 10)
}

function showPayout(market: MarketSnapshot, horseId: string, topThree: string[]): number {
  if (!topThree.includes(horseId)) return 0

  const horsePool = market.pool.horsePool.get(horseId) ?? 0
  if (horsePool === 0) return 0

  const netPool = market.pool.totalPool * (1 - TAKEOUT_WIN)
  // Show pool splits three ways
  const thirdNet = netPool / 3
  const payoutPerDollar = thirdNet / horsePool

  return Math.max(MIN_PAYOUT_PER_DOLLAR * BET_UNIT, Math.floor(payoutPerDollar * BET_UNIT * 10) / 10)
}

function exactaPayout(market: MarketSnapshot, firstId: string, secondId: string): number {
  // Approximate exotic pool — in reality this is a separate pool.
  // We simulate it as a function of the win pool and field size.
  const prob1 = market.pool.horsePool.get(firstId)! / market.pool.totalPool
  const prob2 = market.pool.horsePool.get(secondId)! / market.pool.totalPool

  // Estimated probability of this exact combo
  const comboProbEstimate = prob1 * (prob2 / (1 - prob1))
  if (comboProbEstimate === 0) return 0

  const netReturn = (1 - TAKEOUT_EXOTIC) / comboProbEstimate
  return Math.max(MIN_PAYOUT_PER_DOLLAR * BET_UNIT, Math.floor(netReturn * BET_UNIT * 10) / 10)
}

function quinellaPayout(market: MarketSnapshot, firstId: string, secondId: string): number {
  const prob1 = market.pool.horsePool.get(firstId)! / market.pool.totalPool
  const prob2 = market.pool.horsePool.get(secondId)! / market.pool.totalPool

  // Quinella = either order, so roughly 2x the probability of exacta
  const comboProbEstimate = 2 * prob1 * (prob2 / (1 - prob1))
  if (comboProbEstimate === 0) return 0

  const netReturn = (1 - TAKEOUT_EXOTIC) / comboProbEstimate
  return Math.max(MIN_PAYOUT_PER_DOLLAR * BET_UNIT, Math.floor(netReturn * BET_UNIT * 10) / 10)
}

// ── Resolve a single bet ───────────────────────────────────────

export function resolveBet(
  bet: Bet,
  result: RaceResult,
  market: MarketSnapshot,
): Payout {
  const finish = result.finishOrder
  const firstId = finish[0]?.horseId ?? ''
  const secondId = finish[1]?.horseId ?? ''
  const thirdId = finish[2]?.horseId ?? ''
  const topThree = [firstId, secondId, thirdId]
  const scale = bet.amount / BET_UNIT // how many $2 units

  switch (bet.type) {
    case 'win': {
      const won = bet.selections[0] === firstId
      const displayPayout = winPayout(market, firstId)
      return {
        betType: 'win',
        displayPayout,
        won,
        netReturn: won ? displayPayout * scale : 0,
      }
    }

    case 'place': {
      const won = bet.selections[0] === firstId || bet.selections[0] === secondId
      const displayPayout = placePayout(market, bet.selections[0]!, firstId, secondId)
      return {
        betType: 'place',
        displayPayout,
        won,
        netReturn: won ? displayPayout * scale : 0,
      }
    }

    case 'show': {
      const won = topThree.includes(bet.selections[0]!)
      const displayPayout = showPayout(market, bet.selections[0]!, topThree)
      return {
        betType: 'show',
        displayPayout,
        won,
        netReturn: won ? displayPayout * scale : 0,
      }
    }

    case 'exacta': {
      const won = bet.selections[0] === firstId && bet.selections[1] === secondId
      const displayPayout = exactaPayout(market, firstId, secondId)
      return {
        betType: 'exacta',
        displayPayout,
        won,
        netReturn: won ? displayPayout * scale : 0,
      }
    }

    case 'quinella': {
      const sel = new Set(bet.selections)
      const won = sel.has(firstId) && sel.has(secondId)
      const displayPayout = quinellaPayout(market, firstId, secondId)
      return {
        betType: 'quinella',
        displayPayout,
        won,
        netReturn: won ? displayPayout * scale : 0,
      }
    }

    case 'dailyDouble': {
      // Daily double is handled across two races — this resolves one leg.
      // For now, treat as a win bet on the selection.
      const won = bet.selections[0] === firstId
      const displayPayout = winPayout(market, firstId)
      return {
        betType: 'dailyDouble',
        displayPayout,
        won,
        netReturn: won ? displayPayout * scale : 0,
      }
    }
  }
}

// ── Resolve all bets for a race ────────────────────────────────

export function resolveRace(
  bets: Bet[],
  result: RaceResult,
  market: MarketSnapshot,
): PayoutResult {
  const payouts = bets.map(bet => resolveBet(bet, result, market))
  const totalReturn = payouts.reduce((sum, p) => sum + p.netReturn, 0)

  return {
    raceId: result.raceId,
    payouts,
    totalReturn,
  }
}
