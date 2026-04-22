// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Results } from '@/ui/screens/Results'
import type {
  Race, RaceResult, RaceRecap, MarketSnapshot, Entry,
  Horse, OddsLine, Payout,
} from '@/engine/types'
import { DEFAULT_TAKEOUT_RATES } from '@/engine/types'

// These smoke tests cover the post-race summary screen. They don't
// render Framer Motion animations in a meaningful way (jsdom has no
// layout) — what we care about is that the right *strings* and *roles*
// render for each result-shape branch (profit vs loss, refund vs win,
// photo-finish header, scratched-refund copy).

function horse(id: string, name: string): Horse {
  return {
    id, name, age: 4, sex: 'G', psr: 90,
    runningStyle: 'P', surfacePref: 'dirt', surfacePrefStrength: 'neutral',
    distancePref: 'versatile', quirk: null, jockeyId: 'J01',
  }
}

function entry(h: Horse, post: number): Entry {
  return { horse: h, postPosition: post, scratched: false, scratchReason: null }
}

const H1 = horse('h1', 'First Light')
const H2 = horse('h2', 'Second Wind')
const H3 = horse('h3', 'Third Rail')

const race: Race = {
  id: 'AQU-R1',
  raceNumber: 1,
  trackCode: 'AQU',
  conditions: {
    raceClass: 'MCL', surface: 'D', condition: 'FT',
    distanceFurlongs: 6, distanceCategory: 'sprint',
  },
  entries: [entry(H1, 1), entry(H2, 2), entry(H3, 3)],
}

const result: RaceResult = {
  raceId: race.id,
  paceScenario: 'honest',
  photoFinish: false,
  deadHeat: false,
  finishOrder: [
    { horseId: 'h1', position: 1, performance: 100, margin: '',         deadHeat: false },
    { horseId: 'h2', position: 2, performance: 97,  margin: '1 length', deadHeat: false },
    { horseId: 'h3', position: 3, performance: 95,  margin: '2 lengths', deadHeat: false },
  ],
}

const morningLine: OddsLine[] = [
  { horseId: 'h1', odds: 3.0, impliedProb: 0.25, poolShare: 0.25 },
  { horseId: 'h2', odds: 5.0, impliedProb: 0.167, poolShare: 0.167 },
  { horseId: 'h3', odds: 8.0, impliedProb: 0.11, poolShare: 0.11 },
]

function marketWithOdds(oddsMap: Record<string, number>): MarketSnapshot {
  const odds: OddsLine[] = Object.entries(oddsMap).map(([horseId, o]) => ({
    horseId, odds: o, impliedProb: 1 / (o + 1), poolShare: 0,
  }))
  return {
    winPool:      { totalPool: 1000, buckets: new Map() },
    placePool:    { totalPool: 500,  buckets: new Map() },
    showPool:     { totalPool: 300,  buckets: new Map() },
    exactaPool:   { totalPool: 400,  buckets: new Map() },
    quinellaPool: { totalPool: 200,  buckets: new Map() },
    dailyDoublePool: null,
    takeoutRates: DEFAULT_TAKEOUT_RATES,
    odds,
    oddsByHorse: new Map(odds.map(o => [o.horseId, o])),
    favoriteId: 'h1',
  }
}

const market = marketWithOdds({ h1: 3.0, h2: 5.0, h3: 8.0 })

const recap: RaceRecap = {
  paceNarrative: 'An honest pace set up a fair stretch run.',
  playerHorseStory: 'Your pick sat just off the pace.',
  factorTags: new Map([['h1', ['speed-figure', 'good-form']]]),
  lessonMoment: 'Class wins when the pace is honest.',
}

const winningPayout: Payout = {
  betType: 'win', amount: 2, displayPayout: 8.00, won: true,
  netReturn: 8.00, refunded: false,
  explanation: {
    poolLabel: 'Win',
    grossPool: 1000, takeoutRate: 0.16, takeoutAmount: 160, netPool: 840,
    betBack: 0, profitPool: 840, splitWays: 1, poolOnSelection: 200,
    rawPayoutPerDollar: 4.00, payoutPerDollar: 4.00, breakagePerDollar: 0,
    minPayoutApplied: false, deadHeatHalved: false,
  },
}

const losingPayout: Payout = {
  betType: 'place', amount: 5, displayPayout: 0, won: false,
  netReturn: 0, refunded: false, explanation: null,
}

const refundedPayout: Payout = {
  betType: 'exacta', amount: 4, displayPayout: 0, won: false,
  netReturn: 4, refunded: true, explanation: null,
}

function props(over: Partial<Parameters<typeof Results>[0]> = {}) {
  const onNextRace = vi.fn()
  return {
    race, result, recap, market, morningLine,
    payoutResult: { raceId: race.id, payouts: [winningPayout], totalReturn: 8.00 },
    bankroll: 156.00,
    onNextRace,
    isLastRace: false,
    ...over,
  }
}

describe('Results', () => {
  it('shows "You won $X" when profit is positive', () => {
    render(<Results {...props()} />)
    expect(screen.getByText(/You won \$6\.00!/)).toBeInTheDocument()
    expect(screen.getByText(/Bankroll: \$156\.00/)).toBeInTheDocument()
  })

  it('shows "You lost $X" when net profit is negative', () => {
    render(<Results {...props({
      payoutResult: { raceId: race.id, payouts: [losingPayout], totalReturn: 0 },
    })} />)
    expect(screen.getByText(/You lost \$5\.00/)).toBeInTheDocument()
  })

  it('shows "Even money" when profit is exactly zero', () => {
    render(<Results {...props({
      payoutResult: { raceId: race.id, payouts: [refundedPayout], totalReturn: 4 },
    })} />)
    expect(screen.getByText(/Even money/)).toBeInTheDocument()
  })

  it('renders the "Photo Finish!" header when result.photoFinish is true', () => {
    render(<Results {...props({ result: { ...result, photoFinish: true } })} />)
    expect(screen.getByText(/Photo Finish!/)).toBeInTheDocument()
  })

  it('renders finish order with position, name, and margin', () => {
    render(<Results {...props()} />)
    expect(screen.getByText('First Light')).toBeInTheDocument()
    expect(screen.getByText('Second Wind')).toBeInTheDocument()
    expect(screen.getByText('1 length')).toBeInTheDocument()
  })

  it('renders refund copy instead of a loss for scratched selections', () => {
    render(<Results {...props({
      payoutResult: { raceId: race.id, payouts: [refundedPayout], totalReturn: 4 },
    })} />)
    expect(screen.getByText(/Refunded \$4\.00/)).toBeInTheDocument()
    expect(screen.getByText(/selections was scratched/i)).toBeInTheDocument()
  })

  it('shows lesson card when recap.lessonMoment is present', () => {
    render(<Results {...props()} />)
    expect(screen.getByText(/Class wins when the pace is honest\./)).toBeInTheDocument()
  })

  it('changes the next-race button label on the last race of the card', () => {
    render(<Results {...props({ isLastRace: true })} />)
    expect(screen.getByRole('button', { name: /Back to Track Selection/i })).toBeInTheDocument()
  })

  it('fires onNextRace when the next button is clicked', () => {
    const onNextRace = vi.fn()
    render(<Results {...props({ onNextRace })} />)
    screen.getByRole('button', { name: /Next Race/i }).click()
    expect(onNextRace).toHaveBeenCalledOnce()
  })
})
