import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Race, MarketSnapshot, BetType, Entry, OddsLine } from '@/engine/types'
import { HorseRow } from '@/ui/components/HorseRow'
import { HorseDetail } from '@/ui/components/HorseDetail'
import { BetSlip, type PendingBet } from '@/ui/components/BetSlip'

interface PendingBetWithSelections extends PendingBet {
  selections: string[]
}

interface RaceCardProps {
  race: Race
  market: MarketSnapshot
  morningLine: OddsLine[]
  raceIndex: number
  totalRaces: number
  bankroll: number
  availableBetTypes: BetType[]
  onRunRace: (bets: { betType: BetType; amount: number; selections: string[] }[]) => void
}

const SURFACE_LABELS = { D: 'Dirt', T: 'Turf', A: 'Synthetic' } as const
const CLASS_LABELS = { MCL: 'Maiden Claiming', CLM: 'Claiming', ALW: 'Allowance', STK: 'Stakes' } as const

export function RaceCard({
  race, market, morningLine, raceIndex, totalRaces, bankroll, availableBetTypes, onRunRace,
}: RaceCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [secondId, setSecondId] = useState<string | null>(null)
  const [selectingSecond, setSelectingSecond] = useState(false)
  const [inspectingId, setInspectingId] = useState<string | null>(null)
  const [pendingBets, setPendingBets] = useState<PendingBetWithSelections[]>([])

  const cond = race.conditions
  const activeEntries = race.entries.filter(e => !e.scratched)
  const fieldSize = activeEntries.length

  const selectedEntry = activeEntries.find(e => e.horse.id === selectedId) ?? null
  const secondEntry = activeEntries.find(e => e.horse.id === secondId) ?? null
  const inspectingEntry = race.entries.find(e => e.horse.id === inspectingId) ?? null

  const pendingTotal = pendingBets.reduce((sum, b) => sum + b.amount, 0)

  const handleSelect = useCallback((entry: Entry) => {
    // A scratched horse cannot be selected for a bet — it won't run.
    if (entry.scratched) return
    if (selectingSecond) {
      if (entry.horse.id !== selectedId) {
        setSecondId(entry.horse.id)
        setSelectingSecond(false)
      }
    } else {
      setSelectedId(entry.horse.id)
      setSecondId(null)
    }
  }, [selectingSecond, selectedId])

  const handleAddBet = useCallback((betType: BetType, amount: number) => {
    if (!selectedEntry) return
    const isExotic = betType === 'exacta' || betType === 'quinella'
    if (isExotic && !secondEntry) return

    const selections = isExotic ? [selectedEntry.horse.id, secondEntry!.horse.id] : [selectedEntry.horse.id]
    const newBet: PendingBetWithSelections = {
      betType,
      amount,
      selections,
      primaryName: selectedEntry.horse.name,
      primaryPP: selectedEntry.postPosition,
      ...(isExotic && secondEntry ? {
        secondaryName: secondEntry.horse.name,
        secondaryPP: secondEntry.postPosition,
      } : {}),
    }
    setPendingBets(prev => [...prev, newBet])
    // Clear selection so user can pick a different horse for the next bet
    setSelectedId(null)
    setSecondId(null)
    setSelectingSecond(false)
  }, [selectedEntry, secondEntry])

  const handleRemoveBet = useCallback((index: number) => {
    setPendingBets(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleRunRace = useCallback(() => {
    if (pendingBets.length === 0) return
    onRunRace(pendingBets.map(b => ({ betType: b.betType, amount: b.amount, selections: b.selections })))
  }, [pendingBets, onRunRace])

  return (
    <div className="min-h-screen bg-amber-50 pb-4">
      {/* Race header */}
      <div className="bg-stone-800 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-stone-400">Race {raceIndex + 1} of {totalRaces}</p>
            <p className="font-bold text-lg">{race.trackCode} — {CLASS_LABELS[cond.raceClass]}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm text-green-400">${bankroll.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-1 text-xs text-stone-400">
          <span>{cond.distanceFurlongs}f</span>
          <span>{SURFACE_LABELS[cond.surface]}</span>
          <span>{cond.condition}</span>
          <span>{fieldSize} runners</span>
        </div>
        {/* Pool sizes — demystifies where your payoff comes from. Every
            dollar on a winning ticket is drawn from these pools after
            takeout; exotic pools are the smallest and thus swing the
            hardest on a single ticket. */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] font-mono text-stone-500">
          <span>Win ${(market.winPool.totalPool / 1000).toFixed(1)}K</span>
          <span>Pl ${(market.placePool.totalPool / 1000).toFixed(1)}K</span>
          <span>Sh ${(market.showPool.totalPool / 1000).toFixed(1)}K</span>
          <span>Ex ${(market.exactaPool.totalPool / 1000).toFixed(1)}K</span>
          {market.quinellaPool.totalPool > 0 && (
            <span>Qn ${(market.quinellaPool.totalPool / 1000).toFixed(1)}K</span>
          )}
          {market.dailyDoublePool && market.dailyDoublePool.totalPool > 0 && (
            <span>DD ${(market.dailyDoublePool.totalPool / 1000).toFixed(1)}K</span>
          )}
        </div>
      </div>

      {selectingSecond && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-amber-200 px-4 py-2 text-center text-sm font-bold text-amber-900"
        >
          Tap the post # of your second horse
        </motion.div>
      )}

      {/* Field */}
      <div className="px-4 pt-3 space-y-2">
        {race.entries.map(entry => {
          const oddsLine = market.oddsByHorse.get(entry.horse.id)
          const mlOdds = morningLine.find(o => o.horseId === entry.horse.id)
          const isFavorite = entry.horse.id === market.favoriteId
          const isSelected = entry.horse.id === selectedId || entry.horse.id === secondId

          return (
            <motion.div
              key={entry.horse.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (entry.postPosition - 1) * 0.03 }}
            >
              <HorseRow
                entry={entry}
                oddsLine={oddsLine}
                morningLineOdds={mlOdds}
                isFavorite={isFavorite}
                isSelected={isSelected}
                onSelect={() => handleSelect(entry)}
                onInspect={() => !entry.scratched && setInspectingId(entry.horse.id)}
              />
            </motion.div>
          )
        })}
      </div>

      {/* Bet slip */}
      <div className="px-4 mt-4 sticky bottom-0">
        <BetSlip
          selectedHorse={selectedEntry}
          secondHorse={secondEntry}
          availableBetTypes={availableBetTypes}
          bankroll={bankroll}
          pendingBets={pendingBets}
          pendingTotal={pendingTotal}
          onAddBet={handleAddBet}
          onRemoveBet={handleRemoveBet}
          onRunRace={handleRunRace}
          onSelectSecondHorse={() => setSelectingSecond(true)}
          needsSecondHorse={selectingSecond}
        />
      </div>

      {/* Horse detail sheet */}
      <AnimatePresence>
        {inspectingEntry && !inspectingEntry.scratched && (
          <HorseDetail
            entry={inspectingEntry}
            oddsLine={inspectingId ? market.oddsByHorse.get(inspectingId) : undefined}
            isFavorite={inspectingId === market.favoriteId}
            conditions={cond}
            fieldSize={fieldSize}
            isSelected={inspectingId === selectedId}
            onClose={() => setInspectingId(null)}
            onSelect={() => {
              handleSelect(inspectingEntry)
              setInspectingId(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
