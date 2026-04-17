import { useState } from 'react'
import type { BetType, Entry } from '@/engine/types'
import { BET_UNIT } from '@/engine/types'

export interface PendingBet {
  betType: BetType
  amount: number
  primaryName: string
  primaryPP: number
  secondaryName?: string
  secondaryPP?: number
}

interface BetSlipProps {
  selectedHorse: Entry | null
  secondHorse: Entry | null
  availableBetTypes: BetType[]
  bankroll: number
  pendingBets: PendingBet[]
  pendingTotal: number
  onAddBet: (betType: BetType, amount: number) => void
  onRemoveBet: (index: number) => void
  onRunRace: () => void
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
  pendingBets,
  pendingTotal,
  onAddBet,
  onRemoveBet,
  onRunRace,
  onSelectSecondHorse,
  needsSecondHorse,
}: BetSlipProps) {
  const [betType, setBetType] = useState<BetType>('win')
  const [amount, setAmount] = useState(BET_UNIT)

  const requiresTwo = betType === 'exacta' || betType === 'quinella'
  const remaining = bankroll - pendingTotal
  // Same-horse exotic is impossible at the track; if the UI ever hands us
  // one we refuse it here so a bad ticket never reaches the engine.
  const sameHorseExotic = requiresTwo &&
    secondHorse?.horse.id === selectedHorse?.horse.id
  const canAdd = !!selectedHorse
    && amount > 0
    && amount <= remaining
    && (!requiresTwo || (!!secondHorse && !sameHorseExotic))

  return (
    <div className="rounded-lg border-2 border-stone-700 bg-stone-800 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Bet Slip</p>
        {pendingBets.length > 0 && (
          <p className="text-[10px] font-mono text-stone-500">
            ${remaining.toFixed(2)} left
          </p>
        )}
      </div>

      {/* Pending bets list */}
      {pendingBets.length > 0 && (
        <div className="space-y-1.5 border-b border-stone-700 pb-3">
          {pendingBets.map((b, i) => (
            <div key={i} className="flex items-center gap-2 rounded bg-stone-900 px-2 py-1.5">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-400">
                  ${b.amount} {BET_LABELS[b.betType]}
                </p>
                <p className="text-xs text-stone-300 truncate">
                  <span className="font-mono text-stone-500">#{b.primaryPP}</span> {b.primaryName}
                  {b.secondaryName && (
                    <>
                      {' '}
                      <span className="text-stone-500">{b.betType === 'exacta' ? '/' : '&'}</span>{' '}
                      <span className="font-mono text-stone-500">#{b.secondaryPP}</span> {b.secondaryName}
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => onRemoveBet(i)}
                className="shrink-0 text-stone-500 hover:text-red-400 px-1.5 text-lg leading-none"
                aria-label="Remove bet"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

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
        {BET_AMOUNTS.filter(a => a <= remaining).map(a => (
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

      {/* Add bet button */}
      <button
        disabled={!canAdd}
        onClick={() => {
          if (canAdd) {
            if (needsSecondHorse && !secondHorse) {
              onSelectSecondHorse()
            } else {
              onAddBet(betType, amount)
            }
          }
        }}
        className={`w-full rounded-lg py-2.5 text-sm font-bold uppercase tracking-wide transition-colors ${
          canAdd
            ? 'bg-stone-700 text-amber-400 hover:bg-stone-600 active:bg-stone-800 border border-amber-600/50'
            : 'bg-stone-700 text-stone-500 cursor-not-allowed border border-transparent'
        }`}
      >
        {!selectedHorse
          ? 'Select a horse'
          : requiresTwo && !secondHorse
            ? 'Select second horse'
            : `+ Add $${amount} ${BET_LABELS[betType]}`}
      </button>

      {/* Run race button */}
      <button
        disabled={pendingBets.length === 0}
        onClick={onRunRace}
        className={`w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
          pendingBets.length > 0
            ? 'bg-green-600 text-white hover:bg-green-500 active:bg-green-700'
            : 'bg-stone-900 text-stone-600 cursor-not-allowed'
        }`}
      >
        {pendingBets.length === 0
          ? 'Add bets to run race'
          : `Run Race — $${pendingTotal.toFixed(2)} on ${pendingBets.length} bet${pendingBets.length > 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
