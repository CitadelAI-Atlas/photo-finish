import type { Quirk, QuirkContext } from '@/engine/types'

export const QUIRKS: Quirk[] = [
  {
    id: 'hates_mud',
    label: 'Hates the mud',
    description: 'Runs poorly on wet/sloppy tracks',
    effect: (ctx: QuirkContext) =>
      ['SY', 'MY', 'SL', 'HY', 'SF', 'YL'].includes(ctx.condition) ? -6 : 0,
  },
  {
    id: 'mud_lover',
    label: 'Mud lover',
    description: 'Thrives on wet tracks',
    effect: (ctx: QuirkContext) =>
      ['SY', 'MY', 'SL', 'HY', 'SF', 'YL'].includes(ctx.condition) ? +6 : 0,
  },
  {
    id: 'gate_speed',
    label: 'Quick from the gate',
    description: 'Breaks sharply every time',
    effect: () => +2,
  },
  {
    id: 'slow_starter',
    label: 'Slow starter',
    description: 'Always breaks a step slow',
    effect: () => -2,
  },
  {
    id: 'loves_big_field',
    label: 'Loves a big field',
    description: 'Runs better with more competition',
    effect: (ctx: QuirkContext) => (ctx.fieldSize >= 8 ? +3 : 0),
  },
  {
    id: 'hates_crowd',
    label: 'Hates traffic',
    description: 'Struggles in large fields',
    effect: (ctx: QuirkContext) => (ctx.fieldSize >= 8 ? -4 : +2),
  },
  {
    id: 'rail_runner',
    label: 'Rail runner',
    description: 'Best from inside post positions',
    effect: (ctx: QuirkContext) => (ctx.postPosition <= 3 ? +3 : -1),
  },
  {
    id: 'wide_runner',
    label: 'Likes it wide',
    description: 'Prefers outside posts',
    effect: (ctx: QuirkContext) => (ctx.postPosition >= 6 ? +3 : -1),
  },
  {
    id: 'turf_specialist',
    label: 'Turf specialist',
    description: 'Born to run on grass',
    effect: (ctx: QuirkContext) => (ctx.surface === 'T' ? +4 : -2),
  },
  {
    id: 'dirt_demon',
    label: 'Dirt demon',
    description: 'All business on the main track',
    effect: (ctx: QuirkContext) => (ctx.surface === 'D' ? +4 : -2),
  },
  {
    id: 'headstrong',
    label: 'Headstrong',
    description: 'Fights the jockey — unpredictable',
    effect: () => (Math.random() > 0.5 ? +4 : -4),
  },
  {
    id: 'morning_glory',
    label: 'Morning glory',
    description: 'Works great in training, disappoints in races',
    effect: () => -3,
  },
  {
    id: 'late_bloomer',
    label: 'Late bloomer',
    description: 'Gets better with each start',
    effect: () => +2,
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
    effect: () => +1,
  },
  {
    id: 'nervous_type',
    label: 'Nervous type',
    description: 'Wastes energy in the post parade',
    effect: () => (Math.random() > 0.7 ? -5 : 0),
  },
  {
    id: 'veteran',
    label: 'Old pro',
    description: 'Knows every trick in the book',
    effect: () => +1,
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
    effect: (ctx: QuirkContext) => (ctx.surface === 'A' ? +5 : 0),
  },
  {
    id: 'tough_as_nails',
    label: 'Tough as nails',
    description: 'Never misses a beat, runs on anything',
    effect: () => +1,
  },
]

// ~40% of horses get a quirk
export const QUIRK_CHANCE = 0.4
