import { motion } from 'framer-motion'
import type { Race, RaceResult, PayoutResult, RaceRecap, MarketSnapshot, OddsLine } from '@/engine/types'
import { formatOdds } from '@/engine/odds'
import { PayoutBreakdown } from '@/ui/components/PayoutBreakdown'

interface ResultsProps {
  race: Race
  result: RaceResult
  payoutResult: PayoutResult
  recap: RaceRecap
  market: MarketSnapshot
  morningLine: OddsLine[]
  bankroll: number
  onNextRace: () => void
  isLastRace: boolean
}

const BET_LABELS: Record<string, string> = {
  win: 'Win', place: 'Place', show: 'Show',
  quinella: 'Quinella', exacta: 'Exacta', dailyDouble: 'Daily Double',
}

export function Results({
  race, result, payoutResult, recap, market, morningLine, bankroll, onNextRace, isLastRace,
}: ResultsProps) {
  const totalWagered = payoutResult.payouts.reduce((sum, p) => sum + p.amount, 0)
  const netProfit = payoutResult.totalReturn - totalWagered

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-amber-100 via-amber-50 to-stone-50 pb-6">
      {/* Subtle grandstand silhouette behind the header — adds depth
          without competing with content. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(41,37,36,0.25) 0 2px, transparent 2px 8px)',
        }}
      />
      {/* Header */}
      <div
        className={`relative px-4 py-4 text-white shadow-inner ${
          netProfit > 0 ? 'bg-gradient-to-r from-green-700 via-green-600 to-green-700' : 'bg-gradient-to-r from-stone-800 via-stone-700 to-stone-800'
        }`}
      >
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">
            {result.photoFinish ? 'Photo Finish!' : 'Official Results'}
          </p>
          <p className="text-2xl font-bold mt-1">
            {netProfit > 0
              ? `You won $${netProfit.toFixed(2)}!`
              : netProfit < 0
                ? `You lost $${Math.abs(netProfit).toFixed(2)}`
                : 'Even money'}
          </p>
          <p className="text-sm opacity-80 mt-1 font-mono">Bankroll: ${bankroll.toFixed(2)}</p>
        </motion.div>
      </div>

      {/* Finish order */}
      <div className="px-4 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Finish Order</p>
        <div className="space-y-1.5">
          {result.finishOrder.slice(0, 5).map((fp, idx) => {
            const entry = race.entries.find(e => e.horse.id === fp.horseId)
            if (!entry) return null
            const odds = market.oddsByHorse.get(fp.horseId)
            const ml = morningLine.find(o => o.horseId === fp.horseId)
            const tags = recap.factorTags.get(fp.horseId) ?? []
            const oddsShifted = ml && odds && Math.abs(ml.odds - odds.odds) >= 0.5

            return (
              <motion.div
                key={fp.horseId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  idx === 0 ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-white'
                }`}
              >
                <span className={`w-7 text-center font-mono font-bold text-lg ${
                  idx === 0 ? 'text-amber-600' : 'text-stone-400'
                }`}>
                  {fp.position}{fp.deadHeat ? '*' : ''}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-stone-900 truncate">{entry.horse.name}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {tags.map(tag => (
                      <span key={tag} className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm text-stone-900 font-bold">
                    {odds ? formatOdds(odds.odds) : ''}
                  </p>
                  {ml && (
                    <p className={`text-[9px] font-mono ${oddsShifted ? 'text-amber-600' : 'text-stone-400'}`}>
                      ML {formatOdds(ml.odds)}
                    </p>
                  )}
                  {idx > 0 && (
                    <p className="text-[10px] text-stone-400 mt-0.5">{fp.margin}</p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Payouts — the teaching spine. Each winning ticket expands into a
          full pari-mutuel breakdown via PayoutBreakdown. */}
      {payoutResult.payouts.length > 0 && (
        <div className="px-4 pt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Your Bets</p>
          <div className="space-y-1.5">
            {payoutResult.payouts.map((payout, i) => {
              const borderClass = payout.won
                ? 'border-green-400 bg-green-50'
                : payout.refunded
                  ? 'border-stone-300 bg-stone-50'
                  : 'border-stone-200 bg-white'
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className={`rounded-lg border px-3 py-2 ${borderClass}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-stone-700">{BET_LABELS[payout.betType]}</span>
                      <span className="text-[10px] text-stone-400 font-mono">${payout.amount.toFixed(2)} bet</span>
                    </div>
                    <span className={`font-mono font-bold ${
                      payout.won
                        ? 'text-green-700'
                        : payout.refunded
                          ? 'text-stone-500'
                          : 'text-red-500'
                    }`}>
                      {payout.won
                        ? `+$${(payout.netReturn - payout.amount).toFixed(2)}`
                        : payout.refunded
                          ? `Refunded $${payout.amount.toFixed(2)}`
                          : `-$${payout.amount.toFixed(2)}`}
                    </span>
                  </div>
                  {payout.won && <PayoutBreakdown payout={payout} />}
                  {payout.refunded && (
                    <p className="text-[10px] text-stone-500 italic mt-1">
                      One of your selections was scratched — stake returned.
                    </p>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recap */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="px-4 pt-4"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Race Recap</p>
        <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
          <p className="text-sm text-stone-700 leading-relaxed">{recap.paceNarrative}</p>
          {recap.playerHorseStory && (
            <p className="text-sm text-stone-600 italic leading-relaxed">{recap.playerHorseStory}</p>
          )}
        </div>

        {/* Lesson moment */}
        {recap.lessonMoment && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-3 rounded-lg border-2 border-amber-500 bg-amber-50 p-3"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-1">Lesson</p>
            <p className="text-sm text-amber-900 leading-relaxed">{recap.lessonMoment}</p>
          </motion.div>
        )}
      </motion.div>

      {/* Next race button */}
      <div className="px-4 pt-6">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          onClick={onNextRace}
          className="w-full rounded-xl bg-stone-800 py-4 text-sm font-bold uppercase tracking-wide text-white hover:bg-stone-700 active:bg-stone-900 transition-colors"
        >
          {isLastRace ? 'Back to Track Selection' : 'Next Race'}
        </motion.button>
      </div>
    </div>
  )
}
