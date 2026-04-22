# Handicapping Model

> *How the game assigns a true-strength score to each horse, and what
> the player can reason about at the rail.*

"Handicapping" is the handicapper's job: predict who will win by
weighing real factors. Photo-Finish uses a transparent, additive model
so the player can learn to think in the same terms without ever
needing to squint at a Daily Racing Form.

## The factors (in order of importance)

| Factor          | Magnitude    | Source                              |
|-----------------|--------------|-------------------------------------|
| PSR             | ±20          | `horse.psr` (class-scaled)          |
| Pace fit        | ±6           | `paceAdjustment` (race.ts)          |
| Surface fit     | ±4           | `surfaceFitBonus` (field.ts)        |
| Distance fit    | ±4           | `distanceFitBonus` (field.ts)       |
| Jockey tier     | ±3 (+noise)  | `jockeyRaceBonus` (race.ts)         |
| Post position   | 0 to −2      | `postPositionPenalty` (race.ts)     |
| Quirk           | ±5           | `horse.quirk.effect` (quirks.ts)    |
| Noise           | σ=12         | normal(0,12)                        |

Noise sigma of 12 is intentionally close to the sum of every
non-PSR factor — that's what keeps "form can flip" real. A 20-PSR
edge is not a lock; it just means the horse wins maybe 50–60% of
matchups.

## PSR — the spine of the model

Performance Speed Rating is the single number that dominates every
other factor. It's analogous to a Beyer speed figure: 60 is a weak
maiden, 80 is a decent claimer, 100 is stakes-level. Horses in a
Maiden Claiming race will cluster around 60–75; a Grade 1 stakes
field hits 95–110.

Class-based PSR distributions are defined in `src/engine/field.ts`
(`PSR_RANGES`). When the game generates a race, it draws PSRs from
the correct range for the race's class — which is why stepping up
in class means competing against better numbers.

## Running styles

- **E (Early)** — goes to the lead, tries to wire the field. Benefits
  from soft paces; cooked by duels.
- **P (Presser)** — stalks the leader. Style-agnostic — works in most
  scenarios.
- **S (Sustainer / Closer)** — drops back early, launches a move. Needs
  pace to close into; dies on slow days.

Scenario × style interactions in `paceAdjustment` are where the lesson
"pace kills speed" becomes a tangible outcome.

## Surface and distance fit

Each horse has a `surfacePref` (dirt/turf/synthetic/neutral) and a
`surfacePrefStrength` (strong/mild/neutral). `surfaceFitBonus` grants
a boost for running over a preferred surface and a penalty for an
off-surface. Similarly `distanceFitBonus` for sprint/middle/route.

Neutral-preference horses are unaffected either way — they're the
all-weather types. Strong-preference horses are the specialists who
pay big when conditions match and bomb when they don't.

## Jockey tier

Three tiers — A (top 15%), B (middle 60%), C (bottom 25%). Bonus
lookup in `JOCKEY_ACTUAL_BONUS`. Each race, the jockey's contribution
is `baseBonus + uniform(-2, +2)` — good days and bad days happen.

## Post position

Linear interpolation from post 1 (rail, penalty 0) to the widest
post (penalty −2). This undersells how much post matters in short
sprints and oversells it in routes, but it's a reasonable first
approximation and easy for the player to reason about.

## Quirks

Optional per-horse effect with a one-sentence rationale: "loves the
slop" (+ on SY/MY conditions), "speed-favoring posts" (+ at rail),
"big-field specialist" (+ when fieldSize ≥ 10), etc. These are the
flavor layer — they give individual horses personality and another
axis the player can exploit.

## What the player sees

`HorseDetail` packages all the above into an English assessment:
surface grade, distance grade, jockey tier, perceived speed, quirk
callout. The goal is that a player who reads these consistently
starts to recognize the handicapping structure on their own.

## What the crowd sees

The crowd (market simulation) applies the same formula but with more
noise per bettor. Their collective opinion IS the odds. Which means:
when the player's handicapping disagrees with the odds, the disagreement
is interpretable — either you see something the crowd missed (value),
or the crowd sees something you missed (avoid).

## Where to read

- `src/engine/field.ts` — PSR ranges, surface/distance fit.
- `src/engine/race.ts` — performance calc, pace.
- `src/data/jockeys.ts` — tier bonuses.
- `src/data/quirks.ts` — the full quirk catalog with descriptions.
