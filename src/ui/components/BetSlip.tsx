import { useState } from 'react'
import type { BetType, Entry } from '@/engine/types'
import { BET_UNIT } from '@/engine/types'

interface BetSlipProps {
  selectedHorse: Entry | null
  secondHorse: Entry | null
  availableBetTypes: BetType[]
  bankroll: number
  onPlaceBet: (betType: BetType, amount: number) => void
  onSelectSecondHorse: () => void
  needsSecondHorse: boolean
}

const BET_LABELS: Record<BetType, string> = {
  win: 'Win',
  place: 'Place',
  show: 'Show',
  quinella: 'Quinella',
  exacta: 'Exacta',
  dailyDouble: 'Daily Double',
}

const BET_DESCRIPTIONS: Record<BetType, string> = {
  win: '1st place',
  place: '1st or 2nd',
  show: '1st, 2nd, or 3rd',
  quinella: 'Top 2, any order',
  exacta: 'Top 2, exact order',
  dailyDouble: 'Win 2 in a row',
}

const BET_AMOUNTS = [2, 4, 6, 10, 20]

export function BetSlip({
  selectedHorse,
  secondHorse,
  availableBetTypes,
  bankroll,
  onPlaceBet,
  onSelectSecondHorse,
  needsSecondHorse,
}: BetSlipProps) {
  const [betType, setBetType] = useState<BetType>('win')
  const [amount, setAmount] = useState(BET_UNIT)

  const requiresTwo = betType === 'exacta' || betType === 'quinella'
  const canPlace = selectedHorse && amount <= bankroll && (!requiresTwo || secondHorse)

  return (
    <div className="rounded-lg border-2 border-stone-700 bg-stone-800 p-3 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Bet Slip</p>

      {selectedHorse ? (
        <div className="rounded bg-stone-700 px-3 py-2">
          <p className="text-sm text-stone-300">
            <span className="font-mono text-amber-400">#{selectedHorse.postPosition}</span>{' '}
            <span className="font-bold text-white">{selectedHorse.horse.name}</span>
          </p>
          {requiresTwo && (
            <div className="mt-1">
              {secondHorse ? (
                <p className="text-sm text-stone-300">
                  {betType === 'exacta' ? 'with' : '&'}{' '}
                  <span className="font-mono text-amber-400">#{secondHorse.postPosition}</span>{' '}
                  <span className="font-bold text-white">{secondHorse.horse.name}</span>
                </p>
              ) : (
                <button
                  onClick={onSelectSecondHorse}
                  className="text-xs text-amber-400 underline"
                >
                  Select second horse...
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-stone-500 italic">Select a horse above</p>
      )}

      {/* Bet type selector */}
      <div className="flex flex-wrap gap-1.5">
        {availableBetTypes.map(bt => (
          <button
            key={bt}
            onClick={() => setBetType(bt)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              betType === bt
                ? 'bg-amber-500 text-stone-900'
                : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
            }`}
          >
            {BET_LABELS[bt]}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-stone-500">{BET_DESCRIPTIONS[betType]}</p>

      {/* Amount selector */}
      <div className="flex gap-1.5">
        {BET_AMOUNTS.filter(a => a <= bankroll).map(a => (
          <button
            key={a}
            onClick={() => setAmount(a)}
            className={`flex-1 rounded py-1.5 text-sm font-mono font-bold transition-colors ${
              amount === a
                ? 'bg-green-600 text-white'
                : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
            }`}
          >
            ${a}
          </button>
        ))}
      </div>

      {/* Place bet button */}
      <button
        disabled={!canPlace}
        onClick={() => {
          if (canPlace) {
            if (needsSecondHorse && !secondHorse) {
              onSelectSecondHorse()
            } else {
              onPlaceBet(betType, amount)
            }
          }
        }}
        className={`w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
          canPlace
            ? 'bg-green-600 text-white hover:bg-green-500 active:bg-green-700'
            : 'bg-stone-700 text-stone-500 cursor-not-allowed'
        }`}
      >
        {!selectedHorse
          ? 'Select a horse'
          : requiresTwo && !secondHorse
            ? 'Select second horse'
            : `Place $${amount} ${BET_LABELS[betType]} Bet`}
      </button>
    </div>
  )
}
