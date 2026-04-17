# Market Simulation

> *How the crowd forms an opinion in `src/engine/market.ts`.*

Pari-mutuel odds are derived from **where the money went** — not from
any external probability model. If 20% of the Win pool is on a horse,
the tote shows that horse at roughly 4-1 (minus takeout). To simulate a
believable betting market we have to simulate a crowd.

## The two-bettor-type model

Every bettor who throws a ticket into a pool is one of:

1. **Handicappers** (the majority). They compute an estimated strength
   per horse — PSR + jockey bonus + surface/distance fit — with individual
   noise, then back their top pick. The *average* of a thousand noisy
   handicappers converges on truth: that's why favorites win ~33% of the
   time.
2. **Recreational** bettors (the minority). They pick based on names,
   silks, lucky numbers — modeled as a uniform random choice from the
   active field.

Exotic pools (Exacta/Quinella/DD) attract proportionally more
recreational action — they're the dreamer pools. `RECREATIONAL_FRACTION`
encodes that per bet type.

## Why this produces favorite–longshot bias

Because the recreational dollars are spread uniformly across the field,
they add a roughly flat per-horse amount. That flat amount is a larger
*fraction* of the longshot's pool than of the favorite's. The net effect:
longshots end up slightly overbet relative to their true probability
(their payoffs are worse than they "should" be) while favorites are
slightly underbet (a small overlay edge). That's the favorite–longshot
bias you can read about in any honest handicapping book — and our market
reproduces it naturally from first principles, not by injecting a fudge
factor.

## Building a snapshot

`buildMarketSnapshot(rng, race, nextRace?)` simulates ALL of:

- Win, Place, Show (each with own pool, own recreational fraction)
- Exacta (ordered pair), Quinella (unordered pair)
- Daily Double (when `nextRace` is supplied — the pool is attached to
  leg 1 because DD is always sold on the earlier race)

Each pool is just a `{ totalPool, buckets: Map<key, $> }`. For W/P/S the
key is a horseId; for exotics, a concatenated pair.

## Odds → tote board

`calculateOdds(pool, takeout)` takes a pool and produces the display
odds. The raw math is `rawOdds = (1 − takeout) / poolShare − 1`. Real
boards never display arbitrary decimals; they snap to a set of fixed
buckets — 0.20, 0.40, 0.50, 0.60, 0.80, 1.0, 1.2, ... 99. We snap
**down** (pro-bettor on the odds side) to mirror real tote rounding.

Snapshot also exposes `oddsByHorse: Map<string, OddsLine>` so UI
components can do O(1) lookups instead of scanning the `odds` array.

## Morning line

`generateMorningLine` simulates a *single* track handicapper: one
bettor's 100-ticket "vote" with higher noise (σ=18) and no recreational
component. The morning line is what the track's in-house expert
**predicts** the odds will be — it's printed in the program before a
single dollar is wagered. Comparing ML to live odds tells the player:

- **Bet down** — live < ML → smart/stable money or late inside info.
- **Drifting** — live > ML → perceived worse than advertised.

This diff is surfaced in `HorseRow`, `Results`, and the recap system.

## MTP snapshots

`generateMTPSnapshots` simulates the tote board ticking through the
last 5 minutes before post: 25%, 50%, 75%, then 100% of the final
crowd, plus a 5% chance of a **late-money surge** on a non-favorite at
MTP 0:00. (Think: stable connections or a sharp pro dropping a big
ticket in the last seconds — visible on real tote boards as a sudden
odds drop.)

The MTP ticker drives the `ToteBoard` animation during the `tote`
phase of `RaceView`.

## Why single-RNG matters

`useGameFlow` keeps ONE RNG ref for the whole card; every market
simulation, morning line, MTP sequence, and race execution pulls from
that same stream. Seed → deterministic replay. This is how debug
sessions, test fixtures, and (eventually) "shareable race codes" can
work without persisting every single outcome.

## Where to read

- `src/engine/market.ts` — simulation, odds calc, morning line, MTP.
- `src/engine/rng.ts` — the seeded xoshiro128** PRNG.
- `src/ui/components/ToteBoard.tsx` — the MTP-aware display.
