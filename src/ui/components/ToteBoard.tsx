import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { MarketSnapshot, Race } from '@/engine/types'
import { formatOdds } from '@/engine/odds'

interface ToteBoardProps {
  race: Race
  snapshots: MarketSnapshot[]
  onComplete: () => void
}

const MTP_LABELS = ['MTP 5:00', 'MTP 3:00', 'MTP 1:00', 'FINAL']

export function ToteBoard({ race, snapshots, onComplete }: ToteBoardProps) {
  const [snapshotIdx, setSnapshotIdx] = useState(0)
  const current = snapshots[snapshotIdx]

  useEffect(() => {
    if (snapshotIdx >= snapshots.length - 1) {
      const timer = setTimeout(onComplete, 1500)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setSnapshotIdx(i => i + 1), 2000)
    return () => clearTimeout(timer)
  }, [snapshotIdx, snapshots.length, onComplete])

  if (!current) return null

  const activeEntries = race.entries.filter(e => !e.scratched)

  return (
    <div className="rounded-lg border-2 border-stone-700 bg-stone-900 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-widest text-green-400 font-mono">
          Tote Board
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={snapshotIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs font-mono text-amber-400"
          >
            {MTP_LABELS[snapshotIdx] ?? 'FINAL'}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="space-y-1">
        {activeEntries.map(entry => {
          const oddsLine = current.oddsByHorse.get(entry.horse.id)
          const isFavorite = entry.horse.id === current.favoriteId
          return (
            <motion.div
              key={entry.horse.id}
              layout
              className={`flex items-center justify-between rounded px-2 py-1 font-mono text-sm ${
                isFavorite ? 'bg-amber-900/50 text-amber-200' : 'text-stone-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 text-right text-stone-500">{entry.postPosition}</span>
                <span className="truncate max-w-[140px]">{entry.horse.name}</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.span
                  key={`${entry.horse.id}-${snapshotIdx}`}
                  initial={{ opacity: 0, scale: 1.2 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`font-bold ${isFavorite ? 'text-amber-300' : 'text-green-400'}`}
                >
                  {oddsLine ? formatOdds(oddsLine.odds) : '--'}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

