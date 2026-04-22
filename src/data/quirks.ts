import type { Quirk, QuirkContext } from '@/engine/types'

// ── Quirk effect tuning ────────────────────────────────────────
// Quirks are flavor features that nudge a horse's race-day PSR in a
// direction tied to the trip. Magnitudes stay below a jockey-tier
// swing so they shape outcomes without dominating them.

// A rare, decisive condition (perfect surface or hated going).
const QUIRK_MAJOR = 6
// A strong, single-condition specialty (synthetic lover).
const QUIRK_STRONG = 5
// A solid, context-dependent swing (turf/dirt specialist).
const QUIRK_MODERATE = 4
// A modest, reliable bonus (rail, big field, headstrong upside).
const QUIRK_MILD = 3
// Near-baseline flavor (gate speed, "old pro", late bloomer).
const QUIRK_TINY = 2
// Intangible grit — rounding-error scale.
const QUIRK_TRACE = 1

// Condition codes that indicate an off/wet track.
const OFF_TRACK_CONDITIONS = ['SY', 'MY', 'SL', 'HY', 'SF', 'YL']

// Field-size cutoff for "big field" effects.
const BIG_FIELD_SIZE = 8
// Post cutoffs for rail/wide specialists.
const RAIL_POST_MAX = 3
const WIDE_POST_MIN = 6

// Headstrong: coin flip — swings the PSR hard either direction.
const HEADSTRONG_FLIP_P = 0.5
// Nervous type: low-probability tantrum that wastes energy.
const NERVOUS_TANTRUM_P = 0.7
const NERVOUS_TANTRUM_PENALTY = 5

export const QUIRKS: Quirk[] = [
  {
    id: 'hates_mud',
    label: 'Hates the mud',
    description: 'Runs poorly on wet/sloppy tracks',
    effect: (ctx: QuirkContext) =>
      OFF_TRACK_CONDITIONS.includes(ctx.condition) ? -QUIRK_MAJOR : 0,
  },
  {
    id: 'mud_lover',
    label: 'Mud lover',
    description: 'Thrives on wet tracks',
    effect: (ctx: QuirkContext) =>
      OFF_TRACK_CONDITIONS.includes(ctx.condition) ? +QUIRK_MAJOR : 0,
  },
  {
    id: 'gate_speed',
    label: 'Quick from the gate',
    description: 'Breaks sharply every time',
    effect: () => +QUIRK_TINY,
  },
  {
    id: 'slow_starter',
    label: 'Slow starter',
    description: 'Always breaks a step slow',
    effect: () => -QUIRK_TINY,
  },
  {
    id: 'loves_big_field',
    label: 'Loves a big field',
    description: 'Runs better with more competition',
    effect: (ctx: QuirkContext) => (ctx.fieldSize >= BIG_FIELD_SIZE ? +QUIRK_MILD : 0),
  },
  {
    id: 'hates_crowd',
    label: 'Hates traffic',
    description: 'Struggles in large fields',
    effect: (ctx: QuirkContext) =>
      ctx.fieldSize >= BIG_FIELD_SIZE ? -QUIRK_MODERATE : +QUIRK_TINY,
  },
  {
    id: 'rail_runner',
    label: 'Rail runner',
    description: 'Best from inside post positions',
    effect: (ctx: QuirkContext) =>
      ctx.postPosition <= RAIL_POST_MAX ? +QUIRK_MILD : -QUIRK_TRACE,
  },
  {
    id: 'wide_runner',
    label: 'Likes it wide',
    description: 'Prefers outside posts',
    effect: (ctx: QuirkContext) =>
      ctx.postPosition >= WIDE_POST_MIN ? +QUIRK_MILD : -QUIRK_TRACE,
  },
  {
    id: 'turf_specialist',
    label: 'Turf specialist',
    description: 'Born to run on grass',
    effect: (ctx: QuirkContext) => (ctx.surface === 'T' ? +QUIRK_MODERATE : -QUIRK_TINY),
  },
  {
    id: 'dirt_demon',
    label: 'Dirt demon',
    description: 'All business on the main track',
    effect: (ctx: QuirkContext) => (ctx.surface === 'D' ? +QUIRK_MODERATE : -QUIRK_TINY),
  },
  {
    id: 'headstrong',
    label: 'Headstrong',
    description: 'Fights the jockey — unpredictable',
    effect: (ctx: QuirkContext) =>
      ctx.rng.next() > HEADSTRONG_FLIP_P ? +QUIRK_MODERATE : -QUIRK_MODERATE,
  },
  {
    id: 'morning_glory',
    label: 'Morning glory',
    description: 'Works great in training, disappoints in races',
    effect: () => -QUIRK_MILD,
  },
  {
    id: 'late_bloomer',
    label: 'Late bloomer',
    description: 'Gets better with each start',
    effect: () => +QUIRK_TINY,
  },
  {
    id: 'front_runner_or_bust',
    label: 'Lead or nothing',
    description: 'Must be on the lead to win',
    effect: () => 0, // handled in pace logic as narrative
  },
  {
    id: 'never_quits',
    label: 'Never quits',
    description: 'Always tries hard, even when beaten',
    effect: () => +QUIRK_TRACE,
  },
  {
    id: 'nervous_type',
    label: 'Nervous type',
    description: 'Wastes energy in the post parade',
    effect: (ctx: QuirkContext) =>
      ctx.rng.next() > NERVOUS_TANTRUM_P ? -NERVOUS_TANTRUM_PENALTY : 0,
  },
  {
    id: 'veteran',
    label: 'Old pro',
    description: 'Knows every trick in the book',
    effect: () => +QUIRK_TRACE,
  },
  {
    id: 'class_dropper',
    label: 'Drops and fires',
    description: 'Always runs big when dropping in class',
    effect: () => 0, // class drop logic handled separately
  },
  {
    id: 'synthetic_lover',
    label: 'Likes the fake stuff',
    description: 'Performs well on synthetic surfaces',
    effect: (ctx: QuirkContext) => (ctx.surface === 'A' ? +QUIRK_STRONG : 0),
  },
  {
    id: 'tough_as_nails',
    label: 'Tough as nails',
    description: 'Never misses a beat, runs on anything',
    effect: () => +QUIRK_TRACE,
  },
]

// ~40% of horses get a quirk
export const QUIRK_CHANCE = 0.4
