import { useState, useCallback, useRef } from 'react'
import type { Race, RaceCard, MarketSnapshot, RaceResult, Bet, PayoutResult, RaceRecap, OddsLine, TakeoutRates } from '@/engine/types'
import { DEFAULT_TAKEOUT_RATES } from '@/engine/types'
import { useGameStore } from '@/store/gameStore'
import { generateCard } from '@/engine/field'
import { buildMarketSnapshot, generateMTPSnapshots, generateMorningLine } from '@/engine/market'
import { executeRace } from '@/engine/race'
import { resolveRace, resolveDailyDouble, refundBet } from '@/engine/payout'
import { buildRecap } from '@/engine/recap'
import { createRng } from '@/engine/rng'
import type { Rng } from '@/engine/rng'
import { TRACKS } from '@/data/tracks'

function getTakeout(trackCode: string): TakeoutRates {
  return TRACKS.find(t => t.code === trackCode)?.takeout ?? DEFAULT_TAKEOUT_RATES
}

export type Screen = 'home' | 'raceCard' | 'raceView' | 'results'

export interface GameFlowState {
  screen: Screen
  card: RaceCard | null
  currentRace: Race | null
  market: MarketSnapshot | null
  morningLine: OddsLine[]
  mtpSnapshots: MarketSnapshot[]
  result: RaceResult | null
  payoutResult: PayoutResult | null
  recap: RaceRecap | null
  playerBets: Bet[]
  playerHorseId: string | null
}

// An open Daily Double bet waiting for its second leg. We pin the leg-1
// market snapshot (which owns the DD pool) so we can resolve against it
// after leg 2 runs, even though the active market has moved on.
interface OpenDailyDouble {
  bet: Bet
  leg1Result: RaceResult
  leg1Market: MarketSnapshot
}

// Build a fresh view of one race: market + morning line + MTP ticker.
// A single RNG threaded through every call keeps a card reproducible
// from one seed — useful for replay, debugging, and tests.
function buildRaceView(rng: Rng, race: Race, nextRace: Race | undefined) {
  const takeout = getTakeout(race.trackCode)
  const market = buildMarketSnapshot(rng, race, nextRace, takeout)
  const morningLine = generateMorningLine(rng, race)
  const mtpSnapshots = generateMTPSnapshots(rng, race, nextRace, takeout)
  return { market, morningLine, mtpSnapshots }
}

export function useGameFlow() {
  const store = useGameStore()
  // ONE rng per card. All race-day randomness (markets, MTP, execution)
  // flows through this stream so an entire card replays deterministically
  // from one seed. Previously every call did `createRng()`, silently
  // losing reproducibility and wasting a PRNG init per call.
  const rngRef = useRef<Rng>(createRng())
  const openDDRef = useRef<OpenDailyDouble[]>([])

  const [state, setState] = useState<GameFlowState>({
    screen: 'home',
    card: null,
    currentRace: null,
    market: null,
    morningLine: [],
    mtpSnapshots: [],
    result: null,
    payoutResult: null,
    recap: null,
    playerBets: [],
    playerHorseId: null,
  })

  const startNewCard = useCallback((trackCode: string) => {
    const rng = createRng()
    rngRef.current = rng
    openDDRef.current = []

    const classes = store.getAvailableClasses()
    const maxField = store.getMaxFieldSize()
    const card = generateCard(rng, trackCode, classes, maxField)
    store.setCard(card)
    store.checkStipend()

    const firstRace = card.races[0]!
    const nextRace = card.races[1]
    const view = buildRaceView(rng, firstRace, nextRace)

    setState({
      screen: 'raceCard',
      card,
      currentRace: firstRace,
      ...view,
      result: null,
      payoutResult: null,
      recap: null,
      playerBets: [],
      playerHorseId: null,
    })
  }, [store])

  const placeBetsAndRun = useCallback((bets: Bet[], playerHorseId: string) => {
    const totalWager = bets.reduce((sum, b) => sum + b.amount, 0)
    store.placeBet(totalWager)
    store.recordBetPlaced()

    setState(prev => ({
      ...prev,
      screen: 'raceView',
      playerBets: bets,
      playerHorseId,
    }))
  }, [store])

  const resolveCurrentRace = useCallback(() => {
    const { currentRace, market, playerBets, playerHorseId, card } = state
    if (!currentRace || !market || !card) return

    const rng = rngRef.current
    const result = executeRace(rng, currentRace)

    // Scratch-aware resolution: any bet whose selections include a
    // horse that was scratched after the ticket was written is refunded
    // at face value. Real tracks do this on W/P/S for veterinary scratches
    // and off-turf races; we extend it uniformly here.
    const activeIds = new Set(
      currentRace.entries.filter(e => !e.scratched).map(e => e.horse.id),
    )
    const refunds = playerBets.filter(b => b.selections.some(id => !activeIds.has(id)))
    const liveBets = playerBets.filter(b => b.selections.every(id => activeIds.has(id)))

    // Pull DD bets out of the live set — they don't resolve this race.
    const ddBets = liveBets.filter(b => b.type === 'dailyDouble')
    const straightBets = liveBets.filter(b => b.type !== 'dailyDouble')

    const payoutResult = resolveRace(straightBets, result, market)

    // Leg 1 of any DD: park the bet until leg 2 runs.
    for (const bet of ddBets) {
      openDDRef.current.push({ bet, leg1Result: result, leg1Market: market })
    }

    // Leg 2: any open DD whose leg-1 raceId matches the PREVIOUS race
    // (we track by raceId on the bet) resolves now.
    const stillOpen: OpenDailyDouble[] = []
    for (const open of openDDRef.current) {
      if (open.leg1Result.raceId !== result.raceId && open.bet.raceId === open.leg1Result.raceId) {
        // This DD's leg 1 already ran; is THIS race its leg 2? DD bets
        // are placed on leg 1, so leg 2 is whichever race runs right
        // after leg 1 in this card.
        const leg1Idx: number = card.races.findIndex(r => r.id === open.leg1Result.raceId)
        const leg2Idx = leg1Idx + 1
        if (card.races[leg2Idx]?.id === result.raceId) {
          const ddPayout = resolveDailyDouble(open.bet, open.leg1Result, result, open.leg1Market)
          payoutResult.payouts.push(ddPayout)
          payoutResult.totalReturn += ddPayout.netReturn
          continue
        }
      }
      stillOpen.push(open)
    }
    openDDRef.current = stillOpen

    // Tack refunds onto the displayed payouts so the user sees them.
    for (const bet of refunds) {
      const r = refundBet(bet)
      payoutResult.payouts.push(r)
      payoutResult.totalReturn += r.netReturn
    }

    const seenLessons = new Set(store.seenLessons)
    const recap = buildRecap(currentRace, result, market, playerHorseId ?? '', seenLessons)

    store.collectPayout(payoutResult.totalReturn)
    // Count a "win" as any race where the player's straight tickets
    // returned more than they staked (refunds are a wash, not a win).
    const stakedOnStraight = straightBets.reduce((s, b) => s + b.amount, 0)
    const wonStraight = payoutResult.payouts.some(p => p.won)
    if (wonStraight && payoutResult.totalReturn > stakedOnStraight) {
      store.recordWin(payoutResult.totalReturn)
    } else {
      store.recordLoss()
    }

    // Context-rich achievements — signals only available at resolution
    // time (bet type, odds on the winning selection, photo finish flag).
    const winningPayouts = payoutResult.payouts.filter(p => p.won)
    if (winningPayouts.some(p => p.betType === 'place' || p.betType === 'show')) {
      store.unlockAchievement('inTheMoney')
    }
    for (const p of winningPayouts) {
      if (p.betType !== 'win') continue
      const selection = straightBets.find(b => b.type === 'win')?.selections[0]
      if (!selection) continue
      const odds = market.oddsByHorse.get(selection)?.odds ?? 0
      if (odds >= 10) store.unlockAchievement('giantKiller')
    }
    if (result.photoFinish && winningPayouts.length > 0) {
      store.unlockAchievement('photoFinish')
    }

    store.checkProgression()

    setState(prev => ({
      ...prev,
      screen: 'results',
      result,
      payoutResult,
      recap,
    }))
  }, [state, store])

  const nextRace = useCallback(() => {
    const { card } = state
    if (!card) return

    const nextIdx = store.currentRaceIndex + 1
    if (nextIdx >= card.races.length) {
      setState(prev => ({ ...prev, screen: 'home' }))
      return
    }

    store.advanceRace()
    store.checkStipend()
    const race = card.races[nextIdx]!
    const followup = card.races[nextIdx + 1]
    const view = buildRaceView(rngRef.current, race, followup)

    setState(prev => ({
      ...prev,
      screen: 'raceCard',
      currentRace: race,
      ...view,
      result: null,
      payoutResult: null,
      recap: null,
      playerBets: [],
      playerHorseId: null,
    }))
  }, [state, store])

  const goHome = useCallback(() => {
    setState(prev => ({ ...prev, screen: 'home' }))
  }, [])

  const resetGame = useCallback(() => {
    store.resetGame()
    rngRef.current = createRng()
    openDDRef.current = []
    setState({
      screen: 'home',
      card: null,
      currentRace: null,
      market: null,
      morningLine: [],
      mtpSnapshots: [],
      result: null,
      payoutResult: null,
      recap: null,
      playerBets: [],
      playerHorseId: null,
    })
  }, [store])

  return {
    ...state,
    bankroll: store.bankroll,
    currentTier: store.currentTier,
    currentRaceIndex: store.currentRaceIndex,
    totalRaces: store.totalRaces,
    totalWins: store.totalWins,
    biggestWin: store.biggestWin,
    longestStreak: store.longestStreak,
    currentStreak: store.currentStreak,
    achievements: store.achievements,
    seenTooltips: store.seenTooltips,
    availableBetTypes: store.getAvailableBetTypes(),
    startNewCard,
    placeBetsAndRun,
    resolveCurrentRace,
    nextRace,
    goHome,
    resetGame,
    markTooltipSeen: store.markTooltipSeen,
    markLessonSeen: store.markLessonSeen,
    unlockAchievement: store.unlockAchievement,
  }
}
