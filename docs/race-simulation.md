# Race Simulation

> *How a race is run in `src/engine/race.ts`.*

Every race is decided by one number per horse — its **performance** —
computed from a realistic handicapping formula plus noise, then sorted
descending. Dead heats and photo finishes fall out of the performance
gap between adjacent finishers.

## Performance formula

```
performance(horse) = PSR
                   + paceAdjustment(style, scenario)
                   + surfaceFitBonus(horse, surface)
                   + distanceFitBonus(horse, distanceCategory)
                   + jockeyRaceBonus(jockey) + random(-2, +2)
                   + postPositionPenalty(pp, fieldSize)
                   + quirk.effect(ctx)
                   + normalNoise(σ = 12)
```

Every term models a real handicapping concept:

- **PSR** — Performance Speed Rating. The horse's primary quality score
  (Beyer-style). Varies by class.
- **Pace adjustment** — see "Pace scenarios" below.
- **Surface/distance fit** — a grass specialist on dirt, or a sprinter
  going a route, takes a penalty; a perfect fit takes a bonus.
- **Jockey race bonus** — tier A (top) riders add ~3, tier C subtract a
  hair. Plus a small per-race swing for hot/cold days.
- **Post position penalty** — linear 0 → −2 from rail to widest post.
  Wide posts waste ground on the turns.
- **Quirks** — optional per-horse effects keyed to surface, condition,
  field size, or post position.
- **Noise (σ=12)** — the irreducible uncertainty. Real racing has it
  too; this is why even the best horse loses sometimes.

## Pace scenarios

`determinePaceScenario` counts early-speed ('E') horses in the field:

- **Hot** (≥3 E): the speed horses duel and tire. E horses get −6;
  closers (S) get +4.
- **Slow** (0 E): nobody pushes the pace. Front-runners (E/P) get +4;
  closers stall with −4.
- **Honest** (1–2 E): the race sets up normally. No adjustments.

This is a foundational handicapping lesson — "pace kills speed" — and
it emerges mechanically from the formula.

## Dead-heat clustering

A naive implementation of "two horses tie if their performances are
within 0.1" with a pairwise chain would wrongly group three horses that
are each 0.08 apart into a 3-way tie even though the top and bottom are
0.16 apart — unambiguously separated by the photo.

Our fix anchors each cluster on the **leader**: we include trailing
horses only while their gap to the cluster's first horse ≤ 0.1. This
reflects how photo-finish judges actually read the film: they compare
against a clear leader, not transitive hops.

All horses in a dead-heat cluster share the cluster's starting position.
A 3-way tie for 1st produces three "1st place" finishers, and the next
horse is 4th. That distinction matters for payouts — Place/Show must
extend the winning set to include every tied horse and split the slice
K ways (`explainPlaceOrShow` in `payout.ts`).

## Photo finish flag

Separate from dead-heats: if the top two finishers are within 0.5
performance points, we flag the race as a photo finish (but not a dead
heat). The UI uses that flag to play the "Photo Finish!" banner on the
Results screen.

## Margin labels

`performanceGapToMargin` turns a performance delta into the language
racing announcers actually use — "nose", "head", "neck", "½ length",
"2 lengths", etc. This is for flavor; real race charts quote margins
in lengths where 1 length ≈ 0.2 seconds.

## Where to read

- `src/engine/race.ts` — performance calc, pace, dead-heat clustering.
- `src/engine/field.ts` — surface/distance fit bonuses, scratch logic,
  card generation.
- `src/data/jockeys.ts` — jockey tiers and per-tier bonuses.
