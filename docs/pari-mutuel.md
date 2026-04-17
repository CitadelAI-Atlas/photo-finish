# Pari-mutuel Engine

> *How money becomes payouts in `src/engine/payout.ts`.*

Photo-Finish models **pari-mutuel** betting — the system used by every
legal US thoroughbred track. Bettors wager against each other, not against
the house. The track skims a percentage (takeout), and everything that
remains is divided among the winners in proportion to how much they
staked on the winning outcome.

## The universal recipe

Every bet type — Win, Place, Show, Exacta, Quinella, Daily Double — goes
through the same five-step algorithm. Only the pool and a couple of
constants change.

```
grossPool       = Σ stakes in this pool
takeoutAmount   = grossPool × takeoutRate
netPool         = grossPool − takeoutAmount
betBack         = winning stakes returned first (only for Place/Show)
profitPool      = netPool − betBack
perSideProfit   = profitPool / splitWays
rawPayoutPerDollar = betBack? (1 + perSideProfit / yourSlice)
                   : netPool / yourSlice
finalPerDollar     = applyBreakage(raw), then floor to MIN_PAYOUT
```

## Pools are SEPARATE universes

The single most important thing to internalize: **each bet type has its
own pool with its own money**. A $2 Win ticket never interacts with the
Exacta pool. A $2 Show ticket on a longshot can pay *more* than a Win
ticket on the same horse because the Show pool had fewer keyed
tickets. Every pool stands on its own takeout and its own crowd.

| Bet         | Takeout | Pool size relative to Win |
|-------------|--------:|--------------------------:|
| Win         | 16%     | 1.00                      |
| Place       | 16%     | 0.55                      |
| Show        | 16%     | 0.35                      |
| Exacta      | 20%     | 0.35                      |
| Quinella    | 20%     | 0.10                      |
| DailyDouble | 20%     | 0.15                      |

Real US takeout rates drift a bit by state and by bet type; these are
plausible mid-range defaults (see `TAKEOUT_*` in `types.ts`).

## Bet-back: the Place/Show twist

For **Place** (pays top 2) and **Show** (pays top 3), the pool isn't
simply split among the winners. Real tracks:

1. Return every winning ticket's original stake (the **bet back**).
2. Then divide the remaining **profit pool** equally among the paying
   positions — 2 ways for Place, 3 for Show.
3. Each side's payout per \$1 = `1 + (sideProfitPool / $on-your-pick)`.

Consequence: a favorite that attracts huge Place money has very little
profit pool left after bet-back; the payoff barely beats the minimum.
Meanwhile a 15–1 longshot that places pays handsomely because nobody
else keyed it.

## Breakage: the invisible house rake

After computing the raw payout per \$1, the tote board **rounds DOWN to
the next dime** (`BREAKAGE_INCREMENT = $0.10`). A real payoff of
\$3.47 on \$1 is posted as \$3.40. Those fractions of a cent — times
thousands of tickets — are real money the track keeps beyond takeout.
We surface this in `PayoutExplanation.breakagePerDollar` so the game
can show the player exactly what vanished.

## Minimum payout floor

State racing law mandates that a winning \$2 ticket pay **at least
\$2.10** (a nickel profit per dollar). Codified as
`MIN_PAYOUT_PER_DOLLAR = 1.05`. This protects bettors when the crowd
pounds an odds-on favorite hard enough that math alone would pay
less than the stake. `PayoutExplanation.minPayoutApplied` flags when
the floor kicked in.

## Dead heats

When two or more horses cross in a photo-undeterminable tie, the pool
splits further. If K horses tie for a paying position, that position's
slice is divided by K. Example: 2-way dead heat for win — each side
pays on `netPool / 2`, not the full net pool. For Place with a 3-way
tie at 1st, all three are paid as winners but each gets its share of a
1/3 slice.

See `winnersAtPosition` in `payout.ts` and the dead-heat cluster logic
in `race.ts` (the race engine clusters adjacent finishers inside a
performance threshold, anchored on the cluster leader).

## Sole-winner fallback

`poolOnSelection` could in theory be zero — the simulated crowd never
hit your ticket. Without a guard this would produce `Infinity` on the
division. We bound it by `Math.max(poolOnSelection, bet.amount)`, which
effectively says: "if nobody else keyed this, treat the player as the
only winning ticket." This keeps the math safe; in production markets
that behaviour matches what happens when the track is left holding
sole-winning exotic tickets.

## Where to read

- `src/engine/types.ts` — pool types, constants, rate configuration.
- `src/engine/payout.ts` — the resolver functions, one per bet type.
- `src/ui/components/PayoutBreakdown.tsx` — the reveal UI that unpacks
  each winning ticket into these same numbers for the player.
