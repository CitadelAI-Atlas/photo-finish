// Milestone achievements. Lightweight, not engagement-driven — they
// exist to mark learning moments, not to punish missed days. IDs are
// stable and stored in state; labels/descriptions are surfaced by the
// toast layer when an unlock fires.

export interface Achievement {
  id: string
  label: string
  description: string
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'firstWinner',
    label: 'First Winner',
    description: 'Cashed your first ticket',
  },
  {
    id: 'inTheMoney',
    label: 'In the Money',
    description: 'Collected on a Place or Show bet',
  },
  {
    id: 'giantKiller',
    label: 'Giant Killer',
    description: 'Won a bet at 10-1 or higher',
  },
  {
    id: 'sharpEye',
    label: 'Sharp Eye',
    description: 'Won three bets in a row',
  },
  {
    id: 'bankrollBuilder',
    label: 'Bankroll Builder',
    description: 'Grew your bankroll to $500',
  },
  {
    id: 'selfMade',
    label: 'Self-Made',
    description: 'Reached $2,000 without ever taking a stipend',
  },
  {
    id: 'photoFinish',
    label: 'Photo Finish',
    description: 'Won (or lost) by a nose',
  },
]

export const ACHIEVEMENTS_BY_ID: Record<string, Achievement> =
  Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]))
