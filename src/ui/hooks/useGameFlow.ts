import { useState, useCallback, useRef } from 'react'
import type { Race, RaceCard, MarketSnapshot, RaceResult, Bet, PayoutResult, RaceRecap } from '@/engine/types'
import { useGameStore } from '@/store/gameStore'
import { generateCard } from '@/engine/field'
import { buildMarketSnapshot, generateMTPSnapshots } from '@/engine/market'
import { executeRace } from '@/engine/race'
import { resolveRace } from '@/engine/payout'
import { buildRecap } from '@/engine/recap'
import { createRng } from '@/engine/rng'

export type Screen = 'home' | 'raceCard' | 'raceView' | 'results'

export interface GameFlowState {
  screen: Screen
  card: RaceCard | null
  currentRace: Race | null
  market: MarketSnapshot | null
  mtpSnapshots: MarketSnapshot[]
  result: RaceResult | null
  payoutResult: PayoutResult | null
  recap: RaceRecap | null
  playerBets: Bet[]
  playerHorseId: string | null
}

export function useGameFlow() {
  const store = useGameStore()
  const rngRef = useRef(createRng())

  const [state, setState] = useState<GameFlowState>({
    screen: 'home',
    card: null,
    currentRace: null,
    market: null,
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
    const classes = store.getAvailableClasses()
    const maxField = store.getMaxFieldSize()
    const card = generateCard(rng, trackCode, classes, maxField)
    store.setCard(card)
    store.checkStipend()

    const firstRace = card.races[0]!
    const marketRng = createRng()
    const market = buildMarketSnapshot(marketRng, firstRace)
    const mtpSnapshots = generateMTPSnapshots(createRng(), firstRace)

    setState({
      screen: 'raceCard',
      card,
      currentRace: firstRace,
      market,
      mtpSnapshots,
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
    const { currentRace, market, playerBets, playerHorseId } = state
    if (!currentRace || !market) return

    const raceRng = createRng()
    const result = executeRace(raceRng, currentRace)
    const payoutResult = resolveRace(playerBets, result, market)

    const seenLessons = new Set(store.seenLessons)
    const recap = buildRecap(currentRace, result, market, playerHorseId ?? '', seenLessons)

    // Update store
    store.collectPayout(payoutResult.totalReturn)
    if (payoutResult.totalReturn > 0) {
      store.recordWin(payoutResult.totalReturn)
    } else {
      store.recordLoss()
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
      // Card complete — back to home
      setState(prev => ({ ...prev, screen: 'home' }))
      return
    }

    store.advanceRace()
    store.checkStipend()
    const race = card.races[nextIdx]!
    const market = buildMarketSnapshot(createRng(), race)
    const mtpSnapshots = generateMTPSnapshots(createRng(), race)

    setState(prev => ({
      ...prev,
      screen: 'raceCard',
      currentRace: race,
      market,
      mtpSnapshots,
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

  return {
    ...state,
    bankroll: store.bankroll,
    currentTier: store.currentTier,
    currentRaceIndex: store.currentRaceIndex,
    totalRaces: store.totalRaces,
    totalWins: store.totalWins,
    achievements: store.achievements,
    seenTooltips: store.seenTooltips,
    availableBetTypes: store.getAvailableBetTypes(),
    startNewCard,
    placeBetsAndRun,
    resolveCurrentRace,
    nextRace,
    goHome,
    markTooltipSeen: store.markTooltipSeen,
    markLessonSeen: store.markLessonSeen,
    unlockAchievement: store.unlockAchievement,
  }
}
