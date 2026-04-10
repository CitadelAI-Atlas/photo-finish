import { motion } from 'framer-motion'
import { TRACKS } from '@/data/tracks'
import { PROGRESSION_TIERS } from '@/engine/types'

interface HomeProps {
  bankroll: number
  currentTier: number
  totalRaces: number
  totalWins: number
  onStartCard: (trackCode: string) => void
}

export function Home({ bankroll, currentTier, totalRaces, totalWins, onStartCard }: HomeProps) {
  const tier = PROGRESSION_TIERS[currentTier]!
  const availableTracks = TRACKS.slice(0, tier.tracks)
  const nextTier = PROGRESSION_TIERS[currentTier + 1]

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold tracking-tight text-stone-900">Shrug Analytics</h1>
        <p className="text-stone-500 mt-1">At the Track</p>
      </motion.div>

      {/* Bankroll */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border-2 border-stone-300 bg-white p-4 mb-6 text-center"
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
        <div className="flex gap-3 mb-6">
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
              {totalRaces > 0 ? `${((totalWins / totalRaces) * 100).toFixed(0)}%` : '--'}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-stone-400">Win Rate</p>
          </div>
        </div>
      )}

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
    </div>
  )
}
