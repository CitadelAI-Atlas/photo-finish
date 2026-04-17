import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Payout } from '@/engine/types'

// The payout breakdown is the game's in-race classroom. Every time a
// ticket cashes, we crack it open and show where the money came from —
// gross pool, takeout, bet-back, your slice, breakage — so the player
// can watch real pari-mutuel math unfold on their own ticket.
//
// We deliberately avoid jargon-without-explanation: each line has a short
// human gloss, and the whole thing is collapsible so the player can
// ignore it once it's familiar.

interface PayoutBreakdownProps {
  payout: Payout
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PayoutBreakdown({ payout }: PayoutBreakdownProps) {
  const [open, setOpen] = useState(false)
  const exp = payout.explanation
  if (!exp) return null

  const scale = payout.amount / 2  // per-$2 → scale to actual stake
  const profitShare = exp.profitPool / exp.splitWays

  return (
    <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50/60">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800"
      >
        <span>How was this paid?</span>
        <span className="font-mono">{open ? '−' : '+'}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2.5 pt-0.5 space-y-1 text-[11px] text-stone-700 font-mono">
              <Line label={`${exp.poolLabel} pool`} value={`$${fmt(exp.grossPool)}`}
                hint="Every dollar bet in this pool, by every bettor." />
              <Line label={`− Takeout (${(exp.takeoutRate * 100).toFixed(0)}%)`} value={`−$${fmt(exp.takeoutAmount)}`}
                hint="Track + state's cut off the top — purses, taxes, overhead." neg />
              <Line label="Net pool" value={`$${fmt(exp.netPool)}`}
                hint="What's left for winning tickets." bold />
              {exp.betBack > 0 && (
                <>
                  <Line label="− Bet back" value={`−$${fmt(exp.betBack)}`}
                    hint="Winning stakes are refunded first; then profits are split." neg />
                  <Line label="Profit pool" value={`$${fmt(exp.profitPool)}`}
                    hint={`Split ${exp.splitWays} way${exp.splitWays > 1 ? 's' : ''}.`} />
                  <Line label={`÷ ${exp.splitWays} way${exp.splitWays > 1 ? 's' : ''}`} value={`$${fmt(profitShare)}`}
                    hint={exp.deadHeatHalved ? 'Includes dead-heat split.' : 'Per paying position.'} />
                </>
              )}
              <Line label="$ on your pick" value={`$${fmt(exp.poolOnSelection)}`}
                hint="How much the crowd put on this outcome. Smaller = bigger payout." />
              <div className="border-t border-stone-300 my-1" />
              <Line label="Raw per $1" value={`$${fmt(exp.rawPayoutPerDollar)}`}
                hint="Before rounding." />
              <Line label="− Breakage" value={`−$${fmt(exp.breakagePerDollar)}`}
                hint="Track rounds DOWN to next dime per $1. The hidden house keep." neg />
              {exp.minPayoutApplied && (
                <Line label="Min payout floor" value="$1.05 / $1"
                  hint="State law protects bettors on odds-on favorites." />
              )}
              <Line label="Pays per $1" value={`$${fmt(exp.payoutPerDollar)}`} bold />
              <div className="border-t border-stone-300 my-1" />
              <Line label={`Your $${fmt(payout.amount)} returns`} value={`$${fmt(exp.payoutPerDollar * 2 * scale)}`}
                hint="Includes your original stake back." bold />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Line({ label, value, hint, bold, neg }: {
  label: string; value: string; hint?: string; bold?: boolean; neg?: boolean
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`${bold ? 'font-bold text-stone-900' : ''} ${neg ? 'text-red-700' : ''}`}>
          {label}
        </span>
        <span className={`${bold ? 'font-bold text-stone-900' : ''} ${neg ? 'text-red-700' : ''}`}>
          {value}
        </span>
      </div>
      {hint && <p className="text-[9px] text-stone-500 leading-tight mt-0.5 font-sans">{hint}</p>}
    </div>
  )
}
