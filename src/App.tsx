import { useCallback } from 'react'
import { useGameFlow } from '@/ui/hooks/useGameFlow'
import { Home } from '@/ui/screens/Home'
import { RaceCard } from '@/ui/screens/RaceCard'
import { RaceView } from '@/ui/screens/RaceView'
import { Results } from '@/ui/screens/Results'
import { RACES_PER_CARD } from '@/engine/types'
import type { BetType } from '@/engine/types'

function App() {
  const flow = useGameFlow()

  const handlePlaceBet = useCallback((betType: BetType, amount: number, selections: string[]) => {
    const bet = {
      type: betType,
      amount,
      selections,
      raceId: flow.currentRace?.id ?? '',
    }
    flow.placeBetsAndRun([bet], selections[0]!)
  }, [flow])

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
          raceIndex={flow.currentRaceIndex}
          totalRaces={RACES_PER_CARD}
          bankroll={flow.bankroll}
          availableBetTypes={flow.availableBetTypes}
          onPlaceBet={handlePlaceBet}
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
          bankroll={flow.bankroll}
          onNextRace={flow.nextRace}
          isLastRace={flow.currentRaceIndex >= RACES_PER_CARD - 1}
        />
      )
  }
}

export default App
