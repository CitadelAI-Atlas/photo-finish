import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RaceCard, BetType, RaceClass } from '@/engine/types'
import { PROGRESSION_TIERS, STIPEND_THRESHOLD, STIPEND_AMOUNT, CARD_COMPLETION_BONUS, RACES_PER_CARD } from '@/engine/types'

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
}

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      placeBet: (amount: number) => set(s => ({
        bankroll: s.bankroll - amount,
        totalWagered: s.totalWagered + amount,
      })),

      collectPayout: (amount: number) => set(s => ({
        bankroll: s.bankroll + amount,
        totalReturned: s.totalReturned + amount,
      })),

      checkStipend: () => set(s => {
        if (s.bankroll < STIPEND_THRESHOLD) {
          return {
            bankroll: s.bankroll + STIPEND_AMOUNT,
            stipendsReceived: s.stipendsReceived + 1,
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
        const bonus = newBetsPlaced >= RACES_PER_CARD ? CARD_COMPLETION_BONUS : 0
        return {
          cardBetsPlaced: newBetsPlaced,
          bankroll: s.bankroll + bonus,
        }
      }),

      markTooltipSeen: (id: string) => set(s => ({
        seenTooltips: s.seenTooltips.includes(id) ? s.seenTooltips : [...s.seenTooltips, id],
      })),

      markLessonSeen: (id: string) => set(s => ({
        seenLessons: s.seenLessons.includes(id) ? s.seenLessons : [...s.seenLessons, id],
      })),

      hasSeenTooltip: (id: string) => get().seenTooltips.includes(id),

      recordWin: (amount: number) => set(s => ({
        totalRaces: s.totalRaces + 1,
        totalWins: s.totalWins + 1,
        currentStreak: s.currentStreak + 1,
        longestStreak: Math.max(s.longestStreak, s.currentStreak + 1),
        biggestWin: Math.max(s.biggestWin, amount),
      })),

      recordLoss: () => set(s => ({
        totalRaces: s.totalRaces + 1,
        currentStreak: 0,
      })),

      unlockAchievement: (id: string) => set(s => ({
        achievements: s.achievements.includes(id) ? s.achievements : [...s.achievements, id],
      })),

      hasAchievement: (id: string) => get().achievements.includes(id),

      resetGame: () => set(INITIAL_STATE),
    }),
    {
      name: 'photo-finish-game',
    }
  )
)
