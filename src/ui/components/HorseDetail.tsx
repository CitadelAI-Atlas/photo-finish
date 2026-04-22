import { motion } from 'framer-motion'
import type { Entry, OddsLine, RaceConditions } from '@/engine/types'
import { JOCKEYS, JOCKEY_PERCEIVED_BONUS } from '@/data/jockeys'
import { surfaceFitBonus, distanceFitBonus } from '@/engine/field'
import { formatOdds } from '@/engine/odds'
import { Rng } from '@/engine/rng'

// Deterministic seed so a horse's preview effect doesn't flicker on
// re-render. Real race-day RNG is a separate stream; this is just for
// the pre-race handicapping card.
function seedFromId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

interface HorseDetailProps {
  entry: Entry
  oddsLine?: OddsLine
  isFavorite: boolean
  conditions: RaceConditions
  fieldSize: number
  onClose: () => void
  onSelect: () => void
  isSelected: boolean
}

const STYLE_LABELS: Record<string, string> = { E: 'Early Speed', P: 'Presser / Stalker', S: 'Closer' }
const STYLE_DESC: Record<string, string> = {
  E: 'Breaks fast and tries to lead from gate to wire. Vulnerable if the pace is hot.',
  P: 'Sits just behind the leaders, then makes a move in the stretch. The versatile style.',
  S: 'Hangs at the back early, then unleashes one big run. Loves a hot pace.',
}
const SEX_LABELS: Record<string, string> = {
  G: 'Gelding', M: 'Mare', F: 'Filly', C: 'Colt', H: 'Horse (intact)',
}
const SURFACE_LABELS: Record<string, string> = { D: 'Dirt', T: 'Turf', A: 'Synthetic' }
const SURFACE_PREF_LABELS: Record<string, string> = { dirt: 'Dirt', turf: 'Turf', synthetic: 'Synthetic', neutral: 'No preference' }
const DIST_PREF_LABELS: Record<string, string> = { sprint: 'Sprinter', route: 'Router', versatile: 'Versatile' }
const DIST_CAT_LABELS: Record<string, string> = { sprint: 'Sprint', middle: 'Middle', route: 'Route' }

type Rating = 'strong_pos' | 'mild_pos' | 'neutral' | 'mild_neg' | 'strong_neg'

function ratingColor(r: Rating): string {
  switch (r) {
    case 'strong_pos': return 'text-green-600 bg-green-50 border-green-200'
    case 'mild_pos': return 'text-green-600 bg-green-50/50 border-green-100'
    case 'neutral': return 'text-stone-500 bg-stone-50 border-stone-200'
    case 'mild_neg': return 'text-red-500 bg-red-50/50 border-red-100'
    case 'strong_neg': return 'text-red-600 bg-red-50 border-red-200'
  }
}

function ratingLabel(r: Rating): string {
  switch (r) {
    case 'strong_pos': return 'Strong Edge'
    case 'mild_pos': return 'Slight Edge'
    case 'neutral': return 'Neutral'
    case 'mild_neg': return 'Slight Risk'
    case 'strong_neg': return 'Major Risk'
  }
}

function numToRating(n: number): Rating {
  if (n >= 5) return 'strong_pos'
  if (n >= 2) return 'mild_pos'
  if (n > -2) return 'neutral'
  if (n > -5) return 'mild_neg'
  return 'strong_neg'
}

export function HorseDetail({ entry, oddsLine, isFavorite, conditions, fieldSize, onClose, onSelect, isSelected }: HorseDetailProps) {
  const h = entry.horse
  const jockey = JOCKEYS.find(j => j.id === h.jockeyId)

  // Compute handicapping factors
  const surfFit = surfaceFitBonus(h, conditions.surface)
  const distFit = distanceFitBonus(h, conditions.distanceCategory)
  const jockeyBonus = jockey ? (JOCKEY_PERCEIVED_BONUS[jockey.tier] ?? 0) : 0
  const quirkEffect = h.quirk
    ? h.quirk.effect({ rng: new Rng(seedFromId(h.id)), surface: conditions.surface, condition: conditions.condition, fieldSize, postPosition: entry.postPosition })
    : 0

  // PSR bar — normalize against 0-120 range
  const psrPct = Math.max(0, Math.min(100, (h.psr / 110) * 100))

  const factors: { label: string; value: string; rating: Rating; detail: string }[] = [
    {
      label: 'Surface Fit',
      value: `${SURFACE_PREF_LABELS[h.surfacePref]} pref (${h.surfacePrefStrength}) → ${SURFACE_LABELS[conditions.surface]} today`,
      rating: numToRating(surfFit),
      detail: surfFit > 0 ? `+${surfFit} PSR bonus — this horse likes this surface` : surfFit < 0 ? `${surfFit} PSR penalty — surface mismatch` : 'No strong preference either way',
    },
    {
      label: 'Distance Fit',
      value: `${DIST_PREF_LABELS[h.distancePref]} → ${conditions.distanceFurlongs}f ${DIST_CAT_LABELS[conditions.distanceCategory]} today`,
      rating: numToRating(distFit),
      detail: distFit > 0 ? `+${distFit} PSR bonus — distance suits` : distFit < 0 ? `${distFit} PSR penalty — wrong trip` : 'Comfortable at this distance',
    },
    {
      label: 'Jockey',
      value: jockey ? `${jockey.name} (${jockey.tier}-tier)` : 'Unknown',
      rating: numToRating(jockeyBonus),
      detail: jockey?.tier === 'A' ? 'Elite rider — significant edge in tight races' : jockey?.tier === 'B' ? 'Solid professional — reliable' : 'Journeyman — less of a factor',
    },
    {
      label: 'Post Position',
      value: `Gate #${entry.postPosition} of ${fieldSize}`,
      rating: numToRating(entry.postPosition <= 3 ? 1 : entry.postPosition >= fieldSize - 1 ? -1 : 0),
      detail: entry.postPosition <= 2 ? 'Inside post — shorter path, but can get pinched' : entry.postPosition >= fieldSize - 1 ? 'Wide post — extra ground to cover on the turns' : 'Middle of the gate — no major advantage or disadvantage',
    },
  ]

  if (h.quirk) {
    factors.push({
      label: 'Quirk',
      value: h.quirk.label,
      rating: numToRating(quirkEffect),
      detail: `${h.quirk.description}. Today: ${quirkEffect > 0 ? `+${quirkEffect} PSR boost` : quirkEffect < 0 ? `${quirkEffect} PSR penalty` : 'no effect'}`,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-stone-200 px-4 pt-4 pb-3 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-stone-400">#{entry.postPosition}</span>
                <h2 className="text-xl font-bold text-stone-900">{h.name}</h2>
                {isFavorite && (
                  <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">Fav</span>
                )}
              </div>
              <p className="text-sm text-stone-500 mt-0.5">
                {h.age}yo {SEX_LABELS[h.sex] ?? h.sex} &middot; {STYLE_LABELS[h.runningStyle]}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-bold text-stone-900">
                {oddsLine ? formatOdds(oddsLine.odds) : '--'}
              </p>
              <p className="text-xs text-stone-400 font-mono">
                {oddsLine ? `${(oddsLine.impliedProb * 100).toFixed(1)}% implied` : ''}
              </p>
              {oddsLine && (
                <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                  {(oddsLine.poolShare * 100).toFixed(1)}% of Win pool
                </p>
              )}
            </div>
          </div>
          {/* Odds are derived, not declared — they're the crowd's opinion
              expressed as a fraction of the Win pool. Shown here so the
              player can see why the favorite is the favorite. */}
          {oddsLine && (
            <p className="text-[10px] text-stone-400 mt-2 leading-snug">
              Odds are computed from pool share: more money on this horse → shorter odds.
              The board snaps the raw number DOWN to a standard bucket (0.20, 0.40 … 5, 6, 8, 10 …),
              which is why every horse in a race posts at one of a small set of values.
            </p>
          )}
        </div>

        {/* Speed Rating */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Speed Rating (PSR)</span>
            <span className="font-mono text-lg font-bold text-stone-900">{h.psr}</span>
          </div>
          <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${psrPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                psrPct >= 70 ? 'bg-green-500' : psrPct >= 45 ? 'bg-amber-400' : 'bg-red-400'
              }`}
            />
          </div>
          <p className="text-[11px] text-stone-400 mt-1">
            Higher = faster. The primary measure of a horse's ability.
          </p>
        </div>

        {/* Running Style */}
        <div className="px-4 pt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Running Style</p>
          <div className={`rounded-lg border px-3 py-2 ${
            h.runningStyle === 'E' ? 'border-red-200 bg-red-50' :
            h.runningStyle === 'S' ? 'border-green-200 bg-green-50' :
            'border-blue-200 bg-blue-50'
          }`}>
            <p className={`font-bold text-sm ${
              h.runningStyle === 'E' ? 'text-red-700' :
              h.runningStyle === 'S' ? 'text-green-700' :
              'text-blue-700'
            }`}>
              {STYLE_LABELS[h.runningStyle]}
            </p>
            <p className="text-xs text-stone-600 mt-0.5">{STYLE_DESC[h.runningStyle]}</p>
          </div>
        </div>

        {/* Handicapping Factors */}
        <div className="px-4 pt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Today's Factors</p>
          <div className="space-y-2">
            {factors.map(f => (
              <div key={f.label} className={`rounded-lg border px-3 py-2 ${ratingColor(f.rating)}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide">{f.label}</span>
                  <span className="text-[10px] font-bold uppercase">{ratingLabel(f.rating)}</span>
                </div>
                <p className="text-xs mt-0.5 opacity-80">{f.value}</p>
                <p className="text-[11px] mt-1 text-stone-600">{f.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Overall Assessment */}
        <div className="px-4 pt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Quick Assessment</p>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-sm text-stone-700 leading-relaxed">
              {buildAssessment(h, conditions, surfFit, distFit, jockey?.tier ?? 'C', isFavorite, oddsLine?.odds)}
            </p>
          </div>
        </div>

        {/* Select button */}
        <div className="px-4 pt-4 pb-6">
          <button
            onClick={onSelect}
            className={`w-full rounded-xl py-3.5 text-sm font-bold uppercase tracking-wide transition-colors ${
              isSelected
                ? 'bg-amber-500 text-white'
                : 'bg-stone-800 text-white hover:bg-stone-700 active:bg-stone-900'
            }`}
          >
            {isSelected ? 'Selected' : `Bet on ${h.name}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function buildAssessment(
  h: { psr: number; runningStyle: string; surfacePref: string; distancePref: string; quirk: { label: string } | null },
  cond: RaceConditions,
  surfFit: number,
  distFit: number,
  jockeyTier: string,
  isFavorite: boolean,
  odds?: number,
): string {
  const parts: string[] = []

  // PSR context
  if (h.psr >= 80) parts.push('Strong speed figure — one of the better horses here.')
  else if (h.psr >= 60) parts.push('Solid speed figure — competitive in this field.')
  else parts.push('Modest speed figure — will need everything to go right.')

  // Key edge or risk
  if (surfFit >= 5) parts.push(`Loves the ${cond.surface === 'D' ? 'dirt' : cond.surface === 'T' ? 'turf' : 'synthetic'} — that's a real edge today.`)
  else if (surfFit <= -5) parts.push(`Wrong surface — a significant negative.`)

  if (distFit >= 5) parts.push('Distance suits perfectly.')
  else if (distFit <= -5) parts.push('Distance is a concern — may not see it out.')

  if (jockeyTier === 'A') parts.push('Elite jockey gives an extra gear in tight finishes.')

  // Odds context
  if (isFavorite) {
    parts.push('The crowd has this one on top — the public choice.')
  } else if (odds && odds >= 10) {
    parts.push(`At ${Math.round(odds)}-1, the crowd doesn't fancy this one. Could be an overlay if the pace sets up right.`)
  }

  if (h.quirk) {
    parts.push(`Watch for the "${h.quirk.label}" factor.`)
  }

  return parts.join(' ')
}

