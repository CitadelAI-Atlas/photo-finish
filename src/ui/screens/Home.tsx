import { useState } from 'react'
import { motion } from 'framer-motion'
import { TRACKS } from '@/data/tracks'
import { PROGRESSION_TIERS } from '@/engine/types'
import type { BetType } from '@/engine/types'

function betLabel(b: BetType): string {
  switch (b) {
    case 'win': return 'Win'
    case 'place': return 'Place'
    case 'show': return 'Show'
    case 'exacta': return 'Exacta'
    case 'quinella': return 'Quinella'
    case 'dailyDouble': return 'Daily Double'
  }
}

interface HomeProps {
  bankroll: number
  currentTier: number
  totalRaces: number
  totalWins: number
  biggestWin: number
  longestStreak: number
  onStartCard: (trackCode: string) => void
  onReset: () => void
}

export function Home({
  bankroll, currentTier, totalRaces, totalWins,
  biggestWin, longestStreak, onStartCard, onReset,
}: HomeProps) {
  const tier = PROGRESSION_TIERS[currentTier]!
  const availableTracks = TRACKS.slice(0, tier.tracks)
  const nextTier = PROGRESSION_TIERS[currentTier + 1]
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-amber-100 via-amber-50 to-stone-50 px-4 py-6">
      {/* Faint rail-texture hint — sits behind content so the page
          reads as "the paddock" rather than an empty page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent 0 24px, rgba(120,53,15,0.06) 24px 25px)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-stone-200/60 to-transparent"
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative text-center mb-8"
      >
        <h1 className="text-4xl font-bold tracking-tight text-stone-900 drop-shadow-sm">Photo Finish</h1>
        <p className="text-stone-500 mt-1">At the Track</p>
      </motion.div>

      {/* Bankroll */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="relative rounded-xl border-2 border-stone-300 bg-white p-4 mb-6 text-center shadow-sm"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Bankroll</p>
        <p className="text-4xl font-mono font-bold text-stone-900 mt-1">
          ${bankroll.toFixed(2)}
        </p>
        {nextTier && (
          <p className="text-xs text-stone-400 mt-2">
            Next unlock at ${nextTier.bankrollRequired}
          </p>
        )}
      </motion.div>

      {/* Stats */}
      {totalRaces > 0 && (
        <>
          <div className="flex gap-3 mb-3">
            <div className="flex-1 rounded-lg border border-stone-200 bg-white p-3 text-center">
              <p className="text-2xl font-mono font-bold text-stone-900">{totalRaces}</p>
              <p className="text-[10px] uppercase tracking-wider text-stone-400">Races</p>
            </div>
            <div className="flex-1 rounded-lg border border-stone-200 bg-white p-3 text-center">
              <p className="text-2xl font-mono font-bold text-stone-900">{totalWins}</p>
              <p className="text-[10px] uppercase tracking-wider text-stone-400">Wins</p>
            </div>
            <div className="flex-1 rounded-lg border border-stone-200 bg-white p-3 text-center">
              <p className="text-2xl font-mono font-bold text-stone-900">
                {`${((totalWins / totalRaces) * 100).toFixed(0)}%`}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-stone-400">Win Rate</p>
            </div>
          </div>
          <div className="flex gap-3 mb-6">
            <div className="flex-1 rounded-lg border border-stone-200 bg-white p-3 text-center">
              <p className="text-2xl font-mono font-bold text-stone-900">
                {biggestWin > 0 ? `$${biggestWin.toFixed(0)}` : '--'}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-stone-400">Best Payout</p>
            </div>
            <div className="flex-1 rounded-lg border border-stone-200 bg-white p-3 text-center">
              <p className="text-2xl font-mono font-bold text-stone-900">{longestStreak}</p>
              <p className="text-[10px] uppercase tracking-wider text-stone-400">Best Streak</p>
            </div>
          </div>
        </>
      )}

      {/* How to Play */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl border-2 border-stone-300 bg-white p-4 mb-6"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">How to Play</p>
        <ol className="text-sm text-stone-700 space-y-1 list-decimal list-inside mb-4">
          <li>Pick a track, then study the card — form, odds, pace.</li>
          <li>Tap a horse to open the <em>Bet Slip</em> and stake.</li>
          <li>Watch the race — odds move live as the pool fills.</li>
          <li>Winning tickets pay pari-mutuel: expand the breakdown to see the math.</li>
        </ol>

        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Bet Types Unlock with Bankroll</p>
        <div className="space-y-1">
          {PROGRESSION_TIERS.map(t => {
            const unlocked = currentTier >= t.tier
            const prev = PROGRESSION_TIERS[t.tier - 1]
            const newBets = prev ? t.betTypes.filter(b => !prev.betTypes.includes(b)) : t.betTypes
            return (
              <div
                key={t.tier}
                className={`flex items-center justify-between text-xs rounded px-2 py-1.5 ${
                  unlocked ? 'bg-amber-50 text-stone-800' : 'bg-stone-50 text-stone-400'
                }`}
              >
                <span className="font-mono font-bold w-16 shrink-0">
                  ${t.bankrollRequired}
                </span>
                <span className="flex-1 px-2">{newBets.map(betLabel).join(', ')}</span>
                <span className="text-[10px] uppercase tracking-wider">
                  {unlocked ? 'Unlocked' : 'Locked'}
                </span>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Track Selection */}
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Pick a Track</p>
      <div className="space-y-2">
        {availableTracks.map((track, i) => (
          <motion.button
            key={track.code}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            onClick={() => onStartCard(track.code)}
            className="w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-4 text-left hover:border-amber-500 hover:bg-amber-50 active:bg-amber-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-stone-900 text-lg">{track.name}</p>
                <p className="text-sm text-stone-500">{track.city}</p>
              </div>
              <div className="flex gap-1">
                {track.surfaces.map(s => (
                  <span
                    key={s}
                    className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-500"
                  >
                    {s === 'D' ? 'Dirt' : s === 'T' ? 'Turf' : 'Synth'}
                  </span>
                ))}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Locked bet types tease handled in How to Play above */}

      {/* Locked tracks tease */}
      {TRACKS.length > availableTracks.length && (
        <div className="mt-3 space-y-2">
          {TRACKS.slice(availableTracks.length).map(track => (
            <div
              key={track.code}
              className="w-full rounded-xl border-2 border-dashed border-stone-200 bg-stone-100 px-4 py-4 text-left opacity-50"
            >
              <p className="font-bold text-stone-400">{track.name}</p>
              <p className="text-xs text-stone-400">Unlocks at higher tier</p>
            </div>
          ))}
        </div>
      )}

      {/* Reset — two-step confirm so it's not a one-tap footgun. */}
      <div className="mt-8 pb-6 text-center">
        {confirmReset ? (
          <div className="inline-flex items-center gap-2">
            <span className="text-xs text-stone-500">Erase all progress?</span>
            <button
              onClick={() => { onReset(); setConfirmReset(false) }}
              className="rounded border border-red-400 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-700 hover:bg-red-100"
            >
              Yes, reset
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="rounded border border-stone-300 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="text-[11px] uppercase tracking-wider text-stone-400 hover:text-stone-600 underline underline-offset-4"
          >
            Reset Game
          </button>
        )}
      </div>
    </div>
  )
}
