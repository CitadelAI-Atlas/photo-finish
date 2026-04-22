import type {
  Bet, Payout, PayoutResult, RaceResult, MarketSnapshot, BetPool, PayoutExplanation, FinishPosition,
} from './types'
import {
  MIN_PAYOUT_PER_DOLLAR, BREAKAGE_INCREMENT, BET_UNIT,
} from './types'
import { quinellaKey } from './market'

// ─────────────────────────────────────────────────────────────────
// Pari-mutuel payout engine.
//
// Everything here follows the SAME recipe with small variations:
//
//   1. Start with the gross pool for this bet type.
//   2. The track takes out a percentage (the "takeout") off the top.
//      That money pays purses, taxes, and the track itself.
//   3. Remaining money is the NET POOL — the prize money.
//   4. For Place and Show, "bet back" the winning-ticket stakes FIRST:
//      every winning ticket gets its dollars returned before profits
//      are computed. The leftover PROFIT POOL is split among the
//      paying positions (2 ways for Place, 3 for Show).
//   5. BREAKAGE: the per-$1 payout is rounded DOWN to the next dime.
//      Those fractions-of-a-cent the track keeps are a second,
//      usually-invisible source of house revenue.
//   6. A minimum-payout floor (~$2.10 on a $2 ticket) protects bettors
//      on odds-on favorites.
//   7. DEAD HEATS: if K horses tie for the paying position, each
//      "side" only gets its share of a 1/K slice of the pool. A
//      dead-heat for win effectively halves both sides' payouts.
//
// Every payout returns a PayoutExplanation object — that's what the UI
// uses to show "your $8.40 came from: $2,000 pool, $320 taken out, …".
// The teaching spine of the game lives in these numbers.
// ─────────────────────────────────────────────────────────────────

// Round per-dollar payout DOWN to the next breakage increment (dime).
function applyBreakage(rawPayoutPerDollar: number): number {
  return Math.floor(rawPayoutPerDollar / BREAKAGE_INCREMENT) * BREAKAGE_INCREMENT
}

// Apply breakage + minimum-payout floor and return how much we kept.
function finalizePayoutPerDollar(raw: number): {
  payoutPerDollar: number
  breakagePerDollar: number
  minPayoutApplied: boolean
} {
  const broken = applyBreakage(raw)
  const floored = Math.max(MIN_PAYOUT_PER_DOLLAR, broken)
  return {
    payoutPerDollar: floored,
    breakagePerDollar: Math.max(0, raw - broken),
    minPayoutApplied: broken < MIN_PAYOUT_PER_DOLLAR,
  }
}

// Wrap every payout in a standard shape + explanation.
function buildPayout(args: {
  bet: Bet
  exp: PayoutExplanation | null
  won: boolean
  refunded?: boolean
}): Payout {
  const { bet, exp, won, refunded = false } = args
  if (refunded) {
    return {
      betType: bet.type, amount: bet.amount,
      displayPayout: BET_UNIT, won: false, refunded: true,
      netReturn: bet.amount, explanation: null,
    }
  }
  if (!won || !exp) {
    return {
      betType: bet.type, amount: bet.amount,
      displayPayout: 0, won: false, refunded: false,
      netReturn: 0, explanation: null,
    }
  }
  const displayPayout = exp.payoutPerDollar * BET_UNIT
  const scale = bet.amount / BET_UNIT
  return {
    betType: bet.type, amount: bet.amount,
    displayPayout, won: true, refunded: false,
    netReturn: displayPayout * scale, explanation: exp,
  }
}

// ── Win ────────────────────────────────────────────────────────
//
// Straight pari-mutuel: after takeout, the remaining net pool is
// distributed proportionally among tickets on the winner. A
// $1 ticket collects netPool / $on-winner (which already includes
// the return of the original stake).
//
// Dead heat for win: K horses tie, each "side" pays on netPool/K.

function explainWin(market: MarketSnapshot, winnerIds: string[], selectionId: string, bet: Bet): PayoutExplanation | null {
  if (!winnerIds.includes(selectionId)) return null
  const pool = market.winPool
  const k = winnerIds.length
  const poolOnSelection = pool.buckets.get(selectionId) ?? bet.amount  // sole-winner fallback
  const grossPool = pool.totalPool
  const takeoutRate = market.takeoutRates.win
  const takeoutAmount = grossPool * takeoutRate
  const netPool = grossPool - takeoutAmount
  const sharedNet = netPool / k
  const rawPayoutPerDollar = sharedNet / Math.max(poolOnSelection, bet.amount)
  const { payoutPerDollar, breakagePerDollar, minPayoutApplied } = finalizePayoutPerDollar(rawPayoutPerDollar)
  return {
    poolLabel: 'Win',
    grossPool, takeoutRate, takeoutAmount, netPool,
    betBack: 0, profitPool: netPool, splitWays: 1,
    poolOnSelection,
    rawPayoutPerDollar, payoutPerDollar, breakagePerDollar,
    minPayoutApplied, deadHeatHalved: k > 1,
  }
}

// ── Place / Show (bet-back model) ──────────────────────────────
//
// Place pool pays the top-2 finishers. Show pool pays the top-3.
// The CORRECT formula is NOT "divide net pool equally." It's:
//
//   1. Bet back: winning-ticket STAKES are returned first.
//   2. What's left = profitPool. Split by splitWays (2 for Place,
//      3 for Show) into per-side pools.
//   3. Each side's payout per $1 = 1 + (sideProfit / poolOnSelection)
//
// This is why a longshot can pay more in Place/Show than in Win:
// fewer bettors keyed that horse in the Place/Show pools, so their
// slice of the profit is larger per ticket.

function explainPlaceOrShow(
  betType: 'place' | 'show',
  market: MarketSnapshot,
  result: RaceResult,
  selectionId: string,
  bet: Bet,
): PayoutExplanation | null {
  const splitWays = betType === 'place' ? 2 : 3
  const pool = betType === 'place' ? market.placePool : market.showPool
  const takeoutRate = betType === 'place' ? market.takeoutRates.place : market.takeoutRates.show
  const paidPositions = result.finishOrder.slice(0, splitWays)
  const paidIds = paidPositions.map(p => p.horseId)
  if (!paidIds.includes(selectionId)) return null

  // Dead-heat handling: if more horses than splitWays are at-or-above the
  // payout cutoff (e.g. a 3-way tie for 1st in a Place pool), extend the
  // winning set to include them and note the DH.
  const cutoffPosition = paidPositions[paidPositions.length - 1]!.position
  const winners = result.finishOrder.filter(f => f.position <= cutoffPosition)
  const deadHeatHalved = winners.length > splitWays
  const effectiveSplit = Math.max(splitWays, winners.length)
  const winnerIds = winners.map(w => w.horseId)

  const grossPool = pool.totalPool
  const takeoutAmount = grossPool * takeoutRate
  const netPool = grossPool - takeoutAmount
  const betBack = winnerIds.reduce((s, id) => s + (pool.buckets.get(id) ?? 0), 0)
  const profitPool = Math.max(0, netPool - betBack)
  const perSideProfit = profitPool / effectiveSplit
  const poolOnSelection = pool.buckets.get(selectionId) ?? bet.amount
  const rawPayoutPerDollar = 1 + perSideProfit / Math.max(poolOnSelection, bet.amount)
  const { payoutPerDollar, breakagePerDollar, minPayoutApplied } = finalizePayoutPerDollar(rawPayoutPerDollar)
  return {
    poolLabel: betType === 'place' ? 'Place' : 'Show',
    grossPool, takeoutRate, takeoutAmount, netPool,
    betBack, profitPool, splitWays: effectiveSplit,
    poolOnSelection,
    rawPayoutPerDollar, payoutPerDollar, breakagePerDollar,
    minPayoutApplied, deadHeatHalved,
  }
}

// ── Exacta / Quinella / Daily Double ───────────────────────────
//
// These are "combination" pools: each ticket is one specific pair.
// After takeout, the net pool is split proportionally among the
// tickets holding the winning combination. No bet-back arithmetic —
// it's the straight Win formula applied at the combo level.

function explainComboPool(
  label: string,
  pool: BetPool,
  takeoutRate: number,
  winningKey: string,
  bet: Bet,
): PayoutExplanation | null {
  const poolOnSelection = pool.buckets.get(winningKey) ?? 0
  if (pool.totalPool === 0) return null
  const grossPool = pool.totalPool
  const takeoutAmount = grossPool * takeoutRate
  const netPool = grossPool - takeoutAmount
  // Sole-winner fallback: if the crowd somehow didn't hit this combo,
  // we treat the player as the only winning ticket to avoid div-by-0.
  const effective = Math.max(poolOnSelection, bet.amount)
  const rawPayoutPerDollar = netPool / effective
  const { payoutPerDollar, breakagePerDollar, minPayoutApplied } = finalizePayoutPerDollar(rawPayoutPerDollar)
  return {
    poolLabel: label,
    grossPool, takeoutRate, takeoutAmount, netPool,
    betBack: 0, profitPool: netPool, splitWays: 1,
    poolOnSelection,
    rawPayoutPerDollar, payoutPerDollar, breakagePerDollar,
    minPayoutApplied, deadHeatHalved: false,
  }
}

// ── Resolve one bet against one race ───────────────────────────
//
// Daily Double is special: it spans TWO races. This single-race
// resolver never pays a DD — it's held open until leg 2 runs. The
// useGameFlow layer calls resolveDailyDouble when leg 2 is over.

export function resolveBet(
  bet: Bet,
  result: RaceResult,
  market: MarketSnapshot,
): Payout {
  // Dead-heat-aware winner detection: find every horse at position 1.
  const winnerIds = winnersAtPosition(result.finishOrder, 1)
  const firstId = winnerIds[0] ?? ''
  const secondId = result.finishOrder.find(f => f.position === 2)?.horseId ?? ''

  switch (bet.type) {
    case 'win': {
      const exp = explainWin(market, winnerIds, bet.selections[0]!, bet)
      return buildPayout({ bet, exp, won: !!exp })
    }
    case 'place': {
      const exp = explainPlaceOrShow('place', market, result, bet.selections[0]!, bet)
      return buildPayout({ bet, exp, won: !!exp })
    }
    case 'show': {
      const exp = explainPlaceOrShow('show', market, result, bet.selections[0]!, bet)
      return buildPayout({ bet, exp, won: !!exp })
    }
    case 'exacta': {
      // Strict order: selections must match (1st, 2nd) exactly.
      const [s1, s2] = bet.selections
      const won = winnerIds.length === 1 && s1 === firstId && s2 === secondId
      if (!won) return buildPayout({ bet, exp: null, won: false })
      const exp = explainComboPool('Exacta', market.exactaPool, market.takeoutRates.exacta, `${firstId}|${secondId}`, bet)
      return buildPayout({ bet, exp, won: true })
    }
    case 'quinella': {
      const [s1, s2] = bet.selections
      const sels = new Set([s1, s2])
      const won = winnerIds.length === 1 && sels.has(firstId) && sels.has(secondId)
      if (!won) return buildPayout({ bet, exp: null, won: false })
      const exp = explainComboPool('Quinella', market.quinellaPool, market.takeoutRates.quinella, quinellaKey(firstId, secondId), bet)
      return buildPayout({ bet, exp, won: true })
    }
    case 'dailyDouble':
      // Held open — resolved later by resolveDailyDouble when leg 2 runs.
      return buildPayout({ bet, exp: null, won: false })
  }
}

// Resolve an open Daily Double bet once BOTH legs have run.
// leg1Market is the snapshot that contained the DD pool.
export function resolveDailyDouble(
  bet: Bet,
  leg1Result: RaceResult,
  leg2Result: RaceResult,
  leg1Market: MarketSnapshot,
): Payout {
  if (!leg1Market.dailyDoublePool) return buildPayout({ bet, exp: null, won: false })
  const leg1Winner = winnersAtPosition(leg1Result.finishOrder, 1)[0] ?? ''
  const leg2Winner = winnersAtPosition(leg2Result.finishOrder, 1)[0] ?? ''
  const [sel1, sel2] = bet.selections
  const won = sel1 === leg1Winner && sel2 === leg2Winner
  if (!won) return buildPayout({ bet, exp: null, won: false })
  const key = `${leg1Winner}|${leg2Winner}`
  const exp = explainComboPool('Daily Double', leg1Market.dailyDoublePool, leg1Market.takeoutRates.dailyDouble, key, bet)
  return buildPayout({ bet, exp, won: true })
}

// Return the stake to the player without loss — used for scratches.
export function refundBet(bet: Bet): Payout {
  return buildPayout({ bet, exp: null, won: false, refunded: true })
}

function winnersAtPosition(order: FinishPosition[], pos: number): string[] {
  return order.filter(f => f.position === pos).map(f => f.horseId)
}

// ── Resolve all bets for a race ────────────────────────────────

export function resolveRace(
  bets: Bet[],
  result: RaceResult,
  market: MarketSnapshot,
): PayoutResult {
  const payouts = bets.map(bet => resolveBet(bet, result, market))
  const totalReturn = payouts.reduce((sum, p) => sum + p.netReturn, 0)
  return { raceId: result.raceId, payouts, totalReturn }
}
