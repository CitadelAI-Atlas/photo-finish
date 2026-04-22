import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RaceCard, BetType, RaceClass } from '@/engine/types'
import { PROGRESSION_TIERS, STIPEND_THRESHOLD, STIPEND_AMOUNT, CARD_COMPLETION_BONUS, RACES_PER_CARD } from '@/engine/types'
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements'

// Thresholds for bankroll-based achievements — kept here to avoid
// another round trip through the type file.
const BANKROLL_BUILDER_THRESHOLD = 500
const SELF_MADE_THRESHOLD = 2000
const SHARP_EYE_STREAK = 3

export interface GameState {
  // Player
  bankroll: number
  startingBankroll: number
  totalWagered: number
  totalReturned: number
  stipendsReceived: number

  // Progression
  currentTier: number

  // Knowledge
  seenTooltips: string[]
  seenLessons: string[]
  achievements: string[]

  // Current Card
  currentCard: RaceCard | null
  currentRaceIndex: number
  cardBetsPlaced: number

  // Stats
  totalRaces: number
  totalWins: number
  biggestWin: number
  longestStreak: number
  currentStreak: number

  // Ephemeral, UI-only: bonus/stipend events queued for toast display.
  // Not persisted across reloads — these are transient "celebrate this"
  // beats. The UI layer drains them via consumeNotification.
  pendingNotifications: { id: string; message: string; tone: 'stipend' | 'bonus' }[]
}

export interface GameActions {
  // Bankroll
  placeBet: (amount: number) => void
  collectPayout: (amount: number) => void
  checkStipend: () => void

  // Progression
  checkProgression: () => void
  getTier: () => typeof PROGRESSION_TIERS[number]
  getAvailableClasses: () => RaceClass[]
  getAvailableBetTypes: () => BetType[]
  getMaxFieldSize: () => number

  // Card
  setCard: (card: RaceCard) => void
  advanceRace: () => void
  recordBetPlaced: () => void

  // Knowledge
  markTooltipSeen: (id: string) => void
  markLessonSeen: (id: string) => void
  hasSeenTooltip: (id: string) => boolean

  // Stats
  recordWin: (amount: number) => void
  recordLoss: () => void

  // Achievements
  unlockAchievement: (id: string) => void
  hasAchievement: (id: string) => boolean

  // Notifications
  consumeNotification: (id: string) => void

  // Reset
  resetGame: () => void
}

const INITIAL_STATE: GameState = {
  bankroll: 100,
  startingBankroll: 100,
  totalWagered: 0,
  totalReturned: 0,
  stipendsReceived: 0,
  currentTier: 0,
  seenTooltips: [],
  seenLessons: [],
  achievements: [],
  currentCard: null,
  currentRaceIndex: 0,
  cardBetsPlaced: 0,
  totalRaces: 0,
  totalWins: 0,
  biggestWin: 0,
  longestStreak: 0,
  currentStreak: 0,
  pendingNotifications: [],
}

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // Stake must be positive and within bankroll — the UI already gates
      // this via canAdd, but we re-check here so the store never goes
      // negative from a bug or race condition in the caller.
      placeBet: (amount: number) => set(s => {
        if (!Number.isFinite(amount) || amount <= 0) return {}
        if (amount > s.bankroll) return {}
        return {
          bankroll: s.bankroll - amount,
          totalWagered: s.totalWagered + amount,
        }
      }),

      collectPayout: (amount: number) => set(s => {
        if (!Number.isFinite(amount) || amount < 0) return {}
        const newBankroll = s.bankroll + amount
        const unlocks: string[] = []
        if (newBankroll >= BANKROLL_BUILDER_THRESHOLD && !s.achievements.includes('bankrollBuilder')) {
          unlocks.push('bankrollBuilder')
        }
        if (newBankroll >= SELF_MADE_THRESHOLD && s.stipendsReceived === 0 && !s.achievements.includes('selfMade')) {
          unlocks.push('selfMade')
        }
        return {
          bankroll: newBankroll,
          totalReturned: s.totalReturned + amount,
          ...(unlocks.length
            ? {
                achievements: [...s.achievements, ...unlocks],
                pendingNotifications: [
                  ...s.pendingNotifications,
                  ...unlocks.map(id => ({
                    id: `ach-${id}-${Date.now()}`,
                    message: `Achievement unlocked — ${ACHIEVEMENTS_BY_ID[id]?.label ?? id}`,
                    tone: 'bonus' as const,
                  })),
                ],
              }
            : {}),
        }
      }),

      checkStipend: () => set(s => {
        if (s.bankroll < STIPEND_THRESHOLD) {
          return {
            bankroll: s.bankroll + STIPEND_AMOUNT,
            stipendsReceived: s.stipendsReceived + 1,
            pendingNotifications: [
              ...s.pendingNotifications,
              {
                id: `stipend-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                message: `You got a $${STIPEND_AMOUNT} stipend — bankrolls below $${STIPEND_THRESHOLD} are topped up so you can keep learning.`,
                tone: 'stipend',
              },
            ],
          }
        }
        return {}
      }),

      checkProgression: () => set(s => {
        const nextTier = PROGRESSION_TIERS.find(
          t => t.tier === s.currentTier + 1 && s.bankroll >= t.bankrollRequired
        )
        if (nextTier) {
          return { currentTier: nextTier.tier }
        }
        return {}
      }),

      getTier: () => {
        return PROGRESSION_TIERS[get().currentTier] ?? PROGRESSION_TIERS[0]!
      },

      getAvailableClasses: () => {
        const tier = PROGRESSION_TIERS[get().currentTier]
        return tier?.raceClasses ?? ['MCL']
      },

      getAvailableBetTypes: () => {
        const tier = PROGRESSION_TIERS[get().currentTier]
        return tier?.betTypes ?? ['win']
      },

      getMaxFieldSize: () => {
        const tier = PROGRESSION_TIERS[get().currentTier]
        return tier?.maxFieldSize ?? 6
      },

      setCard: (card: RaceCard) => set({
        currentCard: card,
        currentRaceIndex: 0,
        cardBetsPlaced: 0,
      }),

      advanceRace: () => set(s => ({
        currentRaceIndex: s.currentRaceIndex + 1,
      })),

      recordBetPlaced: () => set(s => {
        const newBetsPlaced = s.cardBetsPlaced + 1
        const awardBonus = newBetsPlaced >= RACES_PER_CARD
        const bonus = awardBonus ? CARD_COMPLETION_BONUS : 0
        return {
          cardBetsPlaced: newBetsPlaced,
          bankroll: s.bankroll + bonus,
          pendingNotifications: awardBonus
            ? [
                ...s.pendingNotifications,
                {
                  id: `card-bonus-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  message: `Card complete! +$${CARD_COMPLETION_BONUS} bonus for playing every race.`,
                  tone: 'bonus',
                },
              ]
            : s.pendingNotifications,
        }
      }),

      markTooltipSeen: (id: string) => set(s => ({
        seenTooltips: s.seenTooltips.includes(id) ? s.seenTooltips : [...s.seenTooltips, id],
      })),

      markLessonSeen: (id: string) => set(s => ({
        seenLessons: s.seenLessons.includes(id) ? s.seenLessons : [...s.seenLessons, id],
      })),

      hasSeenTooltip: (id: string) => get().seenTooltips.includes(id),

      recordWin: (amount: number) => set(s => {
        const newStreak = s.currentStreak + 1
        const newWins = s.totalWins + 1
        const unlocks: string[] = []
        if (newWins === 1 && !s.achievements.includes('firstWinner')) {
          unlocks.push('firstWinner')
        }
        if (newStreak >= SHARP_EYE_STREAK && !s.achievements.includes('sharpEye')) {
          unlocks.push('sharpEye')
        }
        return {
          totalRaces: s.totalRaces + 1,
          totalWins: newWins,
          currentStreak: newStreak,
          longestStreak: Math.max(s.longestStreak, newStreak),
          biggestWin: Math.max(s.biggestWin, amount),
          ...(unlocks.length
            ? {
                achievements: [...s.achievements, ...unlocks],
                pendingNotifications: [
                  ...s.pendingNotifications,
                  ...unlocks.map(id => ({
                    id: `ach-${id}-${Date.now()}`,
                    message: `Achievement unlocked — ${ACHIEVEMENTS_BY_ID[id]?.label ?? id}`,
                    tone: 'bonus' as const,
                  })),
                ],
              }
            : {}),
        }
      }),

      recordLoss: () => set(s => ({
        totalRaces: s.totalRaces + 1,
        currentStreak: 0,
      })),

      unlockAchievement: (id: string) => set(s => {
        if (s.achievements.includes(id)) return {}
        const meta = ACHIEVEMENTS_BY_ID[id]
        return {
          achievements: [...s.achievements, id],
          pendingNotifications: [
            ...s.pendingNotifications,
            {
              id: `ach-${id}-${Date.now()}`,
              message: `Achievement unlocked — ${meta?.label ?? id}`,
              tone: 'bonus' as const,
            },
          ],
        }
      }),

      hasAchievement: (id: string) => get().achievements.includes(id),

      consumeNotification: (id: string) => set(s => ({
        pendingNotifications: s.pendingNotifications.filter(n => n.id !== id),
      })),

      resetGame: () => set(INITIAL_STATE),
    }),
    {
      name: 'photo-finish-game',
      // Bump on any change to the shape of persisted state. Older saves
      // get routed through `migrate` below. Without versioning, adding a
      // field would silently leave returning players in a broken state
      // (undefineds where arrays/numbers are expected).
      version: 1,
      migrate: (persisted: unknown, fromVersion: number) => {
        // Merge whatever the old save had on top of the current defaults
        // so any new fields get a sensible starting value instead of
        // undefined. Prior versions had no `achievements` array or the
        // new stats (biggestWin / longestStreak) — this fill guarantees
        // the store is well-formed regardless of save age.
        const base = INITIAL_STATE as unknown as Record<string, unknown>
        const saved = (persisted ?? {}) as Record<string, unknown>
        void fromVersion
        return { ...base, ...saved }
      },
      // pendingNotifications is ephemeral UI glue — don't persist it, or a
      // reload would replay stale toasts from a previous session.
      partialize: (s) => {
        const { pendingNotifications, ...rest } = s
        void pendingNotifications
        return rest
      },
    }
  )
)
