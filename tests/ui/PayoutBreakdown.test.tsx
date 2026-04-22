// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PayoutBreakdown } from '@/ui/components/PayoutBreakdown'
import type { Payout } from '@/engine/types'

// These smoke tests pin the teaching-spine math: the component renders
// pari-mutuel arithmetic onto the screen, so a regression here would
// silently teach players wrong numbers. We render once in the "open"
// state by clicking the toggle, then read strings.

function baseExplanation(over: Partial<Payout['explanation'] & {}> = {}) {
  return {
    poolLabel: 'Win',
    grossPool: 1000,
    takeoutRate: 0.16,
    takeoutAmount: 160,
    netPool: 840,
    betBack: 0,
    profitPool: 840,
    splitWays: 1,
    poolOnSelection: 200,
    rawPayoutPerDollar: 2.10,
    payoutPerDollar: 2.10,
    breakagePerDollar: 0,
    minPayoutApplied: false,
    deadHeatHalved: false,
    ...over,
  }
}

function renderOpen(payout: Payout) {
  const utils = render(<PayoutBreakdown payout={payout} />)
  // The breakdown starts collapsed; click the toggle to reveal.
  // fireEvent wraps in act() so React flushes state before assertions.
  fireEvent.click(screen.getByRole('button', { name: /how was this paid/i }))
  return utils
}

describe('PayoutBreakdown', () => {
  it('returns null when the payout has no explanation (refunds/losses)', () => {
    const payout: Payout = {
      betType: 'win', amount: 2, displayPayout: 0, won: false,
      netReturn: 0, refunded: false, explanation: null,
    }
    const { container } = render(<PayoutBreakdown payout={payout} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders gross pool, takeout, and net for a simple Win ticket', () => {
    const payout: Payout = {
      betType: 'win', amount: 2, displayPayout: 4.20, won: true,
      netReturn: 4.20, refunded: false, explanation: baseExplanation(),
    }
    renderOpen(payout)
    expect(screen.getByText(/Win pool/)).toBeInTheDocument()
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
    expect(screen.getByText(/Takeout \(16%\)/)).toBeInTheDocument()
    expect(screen.getByText('−$160.00')).toBeInTheDocument()
    expect(screen.getByText('$840.00')).toBeInTheDocument()
  })

  it('scales "your returns" by stake size', () => {
    // $10 bet on a 2.10/$1 payout should show $21.00 returned.
    const payout: Payout = {
      betType: 'win', amount: 10, displayPayout: 4.20, won: true,
      netReturn: 21.00, refunded: false, explanation: baseExplanation(),
    }
    renderOpen(payout)
    expect(screen.getByText(/Your \$10\.00 returns/)).toBeInTheDocument()
    expect(screen.getByText('$21.00')).toBeInTheDocument()
  })

  it('shows bet-back and N-way split for Place/Show pools', () => {
    const payout: Payout = {
      betType: 'place', amount: 2, displayPayout: 3.20, won: true,
      netReturn: 3.20, refunded: false,
      explanation: baseExplanation({
        poolLabel: 'Place',
        betBack: 300,
        profitPool: 540,
        splitWays: 2,
      }),
    }
    renderOpen(payout)
    expect(screen.getByText(/Bet back/)).toBeInTheDocument()
    expect(screen.getByText('−$300.00')).toBeInTheDocument()
    expect(screen.getByText(/÷ 2 ways/)).toBeInTheDocument()
  })

  it('exposes breakage as "hidden house keep" when raw > final', () => {
    const payout: Payout = {
      betType: 'win', amount: 2, displayPayout: 4.00, won: true,
      netReturn: 4.00, refunded: false,
      explanation: baseExplanation({
        rawPayoutPerDollar: 2.18,
        payoutPerDollar: 2.10,
        breakagePerDollar: 0.08,
      }),
    }
    renderOpen(payout)
    expect(screen.getByText(/Breakage/)).toBeInTheDocument()
    expect(screen.getByText('−$0.08')).toBeInTheDocument()
  })

  it('flags the $1.05 floor when minPayoutApplied is true', () => {
    const payout: Payout = {
      betType: 'win', amount: 2, displayPayout: 2.10, won: true,
      netReturn: 2.10, refunded: false,
      explanation: baseExplanation({ minPayoutApplied: true }),
    }
    renderOpen(payout)
    expect(screen.getByText(/Min payout floor/)).toBeInTheDocument()
  })
})
