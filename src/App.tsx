import { useCallback } from 'react'
import { useGameFlow } from '@/ui/hooks/useGameFlow'
import { Home } from '@/ui/screens/Home'
import { RaceCard } from '@/ui/screens/RaceCard'
import { RaceView } from '@/ui/screens/RaceView'
import { Results } from '@/ui/screens/Results'
import { Toasts } from '@/ui/components/Toasts'
import { RACES_PER_CARD } from '@/engine/types'
import type { BetType } from '@/engine/types'

function App() {
  const flow = useGameFlow()

  const handleRunRace = useCallback((bets: { betType: BetType; amount: number; selections: string[] }[]) => {
    if (bets.length === 0) return
    const raceId = flow.currentRace?.id ?? ''
    const fullBets = bets.map(b => ({
      type: b.betType,
      amount: b.amount,
      selections: b.selections,
      raceId,
    }))
    // Use the first bet's primary selection as the "player horse" for narrative purposes
    const playerHorseId = bets[0]!.selections[0]!
    flow.placeBetsAndRun(fullBets, playerHorseId)
  }, [flow])

  const screen = (() => {
    switch (flow.screen) {
      case 'home':
        return (
          <Home
            bankroll={flow.bankroll}
            currentTier={flow.currentTier}
            totalRaces={flow.totalRaces}
            totalWins={flow.totalWins}
            onStartCard={flow.startNewCard}
          />
        )

      case 'raceCard':
        if (!flow.currentRace || !flow.market) return null
        return (
          <RaceCard
            race={flow.currentRace}
            market={flow.market}
            morningLine={flow.morningLine}
            raceIndex={flow.currentRaceIndex}
            totalRaces={RACES_PER_CARD}
            bankroll={flow.bankroll}
            availableBetTypes={flow.availableBetTypes}
            onRunRace={handleRunRace}
          />
        )

      case 'raceView':
        if (!flow.currentRace || !flow.market) return null
        return (
          <RaceView
            race={flow.currentRace}
            market={flow.market}
            mtpSnapshots={flow.mtpSnapshots}
            playerHorseId={flow.playerHorseId}
            onRaceComplete={flow.resolveCurrentRace}
          />
        )

      case 'results':
        if (!flow.currentRace || !flow.result || !flow.payoutResult || !flow.recap || !flow.market) return null
        return (
          <Results
            race={flow.currentRace}
            result={flow.result}
            payoutResult={flow.payoutResult}
            recap={flow.recap}
            market={flow.market}
            morningLine={flow.morningLine}
            bankroll={flow.bankroll}
            onNextRace={flow.nextRace}
            isLastRace={flow.currentRaceIndex >= RACES_PER_CARD - 1}
          />
        )
    }
  })()

  return (
    <>
      {screen}
      <Toasts />
    </>
  )
}

export default App
