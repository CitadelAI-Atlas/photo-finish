import type { Entry, OddsLine } from '@/engine/types'
import { JOCKEYS } from '@/data/jockeys'
import { formatOdds } from '@/engine/odds'

interface HorseRowProps {
  entry: Entry
  oddsLine?: OddsLine
  morningLineOdds?: OddsLine
  isFavorite: boolean
  isSelected: boolean
  onSelect: () => void
  onInspect: () => void
}

const STYLE_LABELS = { E: 'Speed', P: 'Stalker', S: 'Closer' } as const
const STYLE_COLORS = { E: 'text-red-600', P: 'text-blue-600', S: 'text-green-700' } as const

export function HorseRow({ entry, oddsLine, morningLineOdds, isFavorite, isSelected, onSelect, onInspect }: HorseRowProps) {
  const h = entry.horse
  const jockey = JOCKEYS.find(j => j.id === h.jockeyId)
  // Detect if the live odds shifted from the morning line — that's market action
  const drift = oddsLine && morningLineOdds ? oddsLine.odds - morningLineOdds.odds : 0
  const driftDirection: 'down' | 'up' | 'flat' =
    drift <= -0.5 ? 'down' : drift >= 0.5 ? 'up' : 'flat'

  if (entry.scratched) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-stone-300 bg-stone-200 px-3 py-2 opacity-50">
        <span className="w-6 text-center font-mono font-bold text-stone-400">{entry.postPosition}</span>
        <div className="flex-1">
          <p className="font-bold text-stone-400 line-through">{h.name}</p>
          <p className="text-xs text-stone-400">Scratched — {entry.scratchReason}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`w-full flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left transition-colors ${
        isSelected
          ? 'border-amber-600 bg-amber-50 ring-2 ring-amber-300'
          : 'border-stone-300 bg-white'
      }`}
    >
      {/* Post position — tap to select */}
      <button
        onClick={onSelect}
        className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full font-mono font-bold text-sm transition-colors ${
          isSelected
            ? 'bg-amber-500 text-white'
            : 'bg-stone-100 text-stone-500 hover:bg-amber-200 hover:text-amber-800 active:bg-amber-300'
        }`}
        aria-label={`Select ${h.name}`}
      >
        {entry.postPosition}
      </button>

      {/* Horse info — tap to inspect */}
      <button
        onClick={onInspect}
        className="flex-1 min-w-0 text-left active:opacity-70"
        aria-label={`View details for ${h.name}`}
      >
        <div className="flex items-center gap-2">
          <p className="font-bold text-stone-900 truncate">{h.name}</p>
          {isFavorite && (
            <span className="shrink-0 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
              Fav
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
          <span>{h.age}{h.sex}</span>
          <span className={STYLE_COLORS[h.runningStyle]}>{STYLE_LABELS[h.runningStyle]}</span>
          {jockey && <span className="truncate">{jockey.name}</span>}
        </div>
        {h.quirk && (
          <p className="text-xs text-purple-600 mt-0.5 italic">{h.quirk.label}</p>
        )}
        <p className="text-[10px] text-stone-400 mt-0.5">Tap for full stats</p>
      </button>

      {/* Odds */}
      <div className="text-right shrink-0">
        <div className="flex items-center justify-end gap-1">
          <p className="font-mono font-bold text-lg text-stone-900">
            {oddsLine ? formatOdds(oddsLine.odds) : '--'}
          </p>
          {driftDirection === 'down' && (
            <span className="text-green-600 text-xs leading-none" title="Bet down (live > ML)">▼</span>
          )}
          {driftDirection === 'up' && (
            <span className="text-red-500 text-xs leading-none" title="Drifted up (live < ML)">▲</span>
          )}
        </div>
        {morningLineOdds && (
          <p className="text-[9px] text-stone-400 font-mono">
            ML {formatOdds(morningLineOdds.odds)}
          </p>
        )}
      </div>
    </div>
  )
}

