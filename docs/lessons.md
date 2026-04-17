# Teaching Moments

> *The explicit curriculum: which real-racing concepts the game reveals,
> and where it does it.*

Photo-Finish's stated purpose is to teach real pari-mutuel mechanics
through play. Every mechanic in the engine has a corresponding teaching
surface in the UI. This doc enumerates them so designers can audit
coverage.

## The teaching surfaces

There are four places players encounter a lesson:

1. **PayoutBreakdown** (Results screen) — every winning ticket can be
   expanded to show the full pari-mutuel math: pool, takeout, bet-back,
   your slice, breakage, minimum payout. This is the core classroom.
2. **Race Recap + Lesson Moments** (Results screen) — `recap.ts`
   detects significant events and writes a contextual one-liner.
3. **Morning-line vs Live odds diff** (RaceCard, Results) — drifting
   and bet-down horses get color-coded tags.
4. **Tote Board MTP animation** (RaceView) — live odds motion plus
   late-money surges demonstrate how a pool fills.

## Concepts covered

| Concept                        | Where it's surfaced                   |
|--------------------------------|---------------------------------------|
| Takeout (track's cut)          | PayoutBreakdown "− Takeout" line      |
| Net pool vs gross pool         | PayoutBreakdown                       |
| Bet-back mechanic              | PayoutBreakdown Place/Show rows       |
| Dead-heat K-way split          | PayoutBreakdown deadHeatHalved flag   |
| Breakage                       | PayoutBreakdown "− Breakage" line     |
| Minimum payout floor (\$2.10)  | PayoutBreakdown min-payout flag       |
| Sole-winner fallback           | (engine only; documented for devs)    |
| Morning line vs live odds      | HorseRow drift badge; Results         |
| Favorite–longshot bias         | Recap lesson "longshot_wins"          |
| Pace kills speed               | Recap lesson "pace_kills_speed"       |
| Slow pace hurts closers        | Recap lesson "slow_pace_speed"        |
| Favorites lose often           | Recap lesson "favorites_lose"         |
| Beating the crowd              | Recap lesson "beat_the_crowd"         |
| Photo finish vs dead heat      | Results banner + finish-order '*'     |
| Surface/distance fit           | HorseDetail assessment                |
| Jockey tier impact             | HorseDetail assessment                |
| Post position penalty          | HorseDetail assessment                |
| Running style (E/P/S)          | HorseRow tag; recap factor tags       |
| Pace scenario (hot/honest/slow)| Recap paceNarrative                   |
| Daily Double two-leg parlay    | BetSlip bet-type, DD pool resolution  |
| Exacta vs Quinella distinction | BetSlip descriptions                  |
| Tote rounding / odds buckets   | (engine only)                         |
| Late money / MTP drift         | ToteBoard animation                   |
| Scratch refunds                | Results "Refunded" row                |
| Pool sizes (Win/Pl/Sh/Ex/Qn/DD)| RaceCard header ticker                |
| % of Win pool per horse        | HorseDetail odds block                |
| Tote-bucket rounding           | HorseDetail odds-explainer line       |
| Stipend rescue                 | Toast (Toasts.tsx)                    |
| Card-completion bonus          | Toast (Toasts.tsx)                    |

## Gaps worth filling

- **Tier-up celebration**: crossing a progression threshold (new tracks,
  new bet types) is currently silent. Should be its own toast.
- **Jockey head-to-head**: a reason-why when a B-tier jockey beats an
  A-tier one isn't called out. Could be a recap lesson.
- **Overround explainer**: the tote's ~120% implied probability sum is
  the house's cut made visible, but nothing teaches that specifically.

## Design principle

Every mechanic we model should have an explicit reveal. If the player
can feel an effect (a bigger payout, an upset, a refund) but can't see
why, that's an unhooked lesson. The `PayoutExplanation` contract on
every `Payout` is the structural guarantee that *everything* the
engine computes is available to the UI — adding a reveal is always
just a UI change, never an engine change.
