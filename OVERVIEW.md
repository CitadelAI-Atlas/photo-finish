# Photo Finish — Project Overview
## Agent Briefing Document

---

## What Is This?

**Photo Finish** is a mobile-first web game about horse racing. It is playful, retro-styled, and educational — built to teach players how horse racing works through gameplay, not lectures.

The game has three planned versions targeting progressively more sophisticated audiences:

| Version | Name | Focus |
|---------|------|-------|
| V1 | *At the Track* | Fun, personality, learn the lingo |
| V2 | *In the Money* | CAW signals, form analysis, strategy |
| V3 | *The Edge* | Quantitative handicapping, rebates, model testing |

**We are building V1 first.** Everything below describes V1 unless noted otherwise.

---

## Audience

**V1 target: everyone.** Casual mobile gamers, curious non-bettors, people who've never watched a race. The hook is fun — retro art, horse personality, the thrill of watching your pick run. Terminology is learned naturally through play, never front-loaded.

The design philosophy: *they came for the fun, they stayed for the edge formula* (in V2/V3).

---

## V1 Design: *At the Track*

### The Feel
You wandered into a retro racetrack with $100 and a Racing Form you can't quite read yet. You learn by doing.

### Core Loop
```
Pick a race → Study the card → Place a bet → Watch the race → Read the recap → Collect or cry → Repeat
```

### Progression Gates
Players start simple and unlock complexity by growing their bankroll:

```
Start:      1 track · 6 horses · Win bet only · MCL (Maiden Claiming) races
↓ $150      2nd track unlocks · 7 horses · Place & Show bets unlock
↓ $400      CLM (Claiming) races · 8 horses · Quinella unlocks
↓ $800      ALW (Allowance) races · 9 horses · Exacta unlocks
↓ $2,000    Stakes preview · full fields (10+) · Daily Double unlocks
```

**Why this order:** Quinella (either order) is conceptually simpler than Exacta (exact order), so it unlocks first. Field sizes grow with the player's experience reading race cards.

### Bankruptcy Protection
Players will go broke — it's inevitable with ~18% takeout. Going broke should feel like a setback, not a game-over screen.

**Track Stipend:** When a player's bankroll drops below $10, the track "fronts" them $20 at the start of each new card. Narrative wrapper: *"The regulars at the rail chipped in. Don't let 'em down."*

Rules:
- Stipend is automatic — no shame screen, no pop-up begging
- Stipend resets per card (not per race) to prevent infinite grinding on one bad card
- Stipend-funded wins pay out normally — once you're back above $10, the safety net disappears
- Track the number of stipends taken (hidden stat) — used for achievement: *"Self-Made"* = reach $2,000 without ever taking a stipend

### Terminology — Introduced In-Context, Never Front-Loaded
Each new term appears the first time the player encounters it, as a small tooltip or overlay. Examples:

- First time "6f" appears → *"Furlongs. 6 furlongs = ¾ of a mile. A sprint."*
- First favorite shown → *"The crowd's top pick. Wins about 1 in 3 races."*
- First loss → unlocks Place bet with explanation: *"Place pays if your horse finishes 1st or 2nd. Safer, smaller return."*
- First claiming race → *"Any horse here can be bought for the claiming price. It keeps the competition honest."*
- First longshot winner → *"A 20-1 shot wins about 1 in 20 races. Today was that race."*

Terminology is a reward mechanic — players feel smarter as they go, not overwhelmed upfront.

### Personality Layer (What Makes It Fun)
- Horses have **names**, **quirks**, and **running styles** (e.g. *"likes to lead," "always closes late," "hates the mud," "loves a big field"*)
- Jockeys have **cartoon portraits** and personality
- **Crowd reacts** to upsets, photo finishes, big longshot wins
- **Track announcer** calls the race in retro ticker/typewriter text
- **Your stable**: horses you follow accumulate history over time

---

## Post-Race Breakdown

Every race ends with a brief recap screen. This is where the real education happens — players learn *why* they won or lost, not just *that* they did.

### Recap Components

**1. Pace Narrative (always shown)**
A 1–2 sentence summary of how the race unfolded, generated from the pace scenario and running styles:
- *"Hot early pace — Thunder Bay and Iron Rail dueled through a :22.1 quarter. The closers loved it."*
- *"Slow pace — nobody wanted the lead. Midnight Express stole the race on the front end."*
- *"Honest pace — the best horse won. No excuses."*

**2. Your Horse's Story (always shown)**
A sentence about what happened to the player's pick:
- *"Lady Valor broke alertly but was outrun in the final furlong by two closers."*
- *"Dusty Creek sat 4th early and timed his move perfectly, drawing off by 2 lengths."*

**3. Key Factor Tags (shown on the result bar)**
Small tags on each horse's result row highlighting what mattered:
- 🏃 `Led early` / `Closed late` / `Stalked`
- 🎯 `Pace fit` — this horse's style matched the pace scenario
- ⬆️ `Class drop` — dropping in class (positive signal, introduced contextually)
- 🌧️ `Mud lover` — surface preference matched conditions
- 🆕 `Debut` — first career start

**4. Lesson Moment (first occurrence only)**
On specific triggers, the recap includes a highlighted learning moment:
- First time player's speed horse loses to a closer → *"Pace kills speed. When multiple horses fight for the lead, they tire each other out — and the closers pounce."*
- First time a favorite loses → *"Favorites win ~33% of the time. That means they lose ~67% of the time. Upsets aren't flukes — they're the norm."*
- First time player wins on a non-favorite → *"You just beat the crowd. They liked the favorite. You saw something they didn't."*

---

## Retention: The Daily Card

Each game "day" presents a fresh **race card** — a slate of 6 races at the player's current track(s). Cards are generated fresh, never repeated.

### Daily Mechanics
- **Fresh card on each visit**: Returning to the game generates a new day's card (real-time or on-demand, not clock-gated — this is a game, not a gacha)
- **Featured Race**: The last race on each card is always one tier above the player's current unlock — a "stretch" race with bigger fields and higher stakes. It's a preview of what's coming.
- **Card completion bonus**: Betting on all 6 races on a card earns a small bonus ($5–$10). Encourages players to engage with the full card, not just cherry-pick.

### Streaks & Achievements
Lightweight achievement system that tracks milestones, not daily engagement (no punishing missed days):

| Achievement | Condition |
|-------------|-----------|
| *First Winner* | Win your first bet |
| *In the Money* | Cash a Place or Show bet |
| *Chalk Eater* | Win 5 bets on the favorite |
| *Giant Killer* | Win a bet at 10-1 or higher |
| *Sharp Eye* | Win 3 bets in a row |
| *Bankroll Builder* | Reach $500 |
| *Self-Made* | Reach $2,000 with zero stipends |
| *Closer's Friend* | Win on a closer 5 times |
| *Mud Runner* | Win on an off-track (sloppy/muddy) 3 times |
| *Photo Finish* | Win (or lose) by a nose |
| *Full Card* | Bet every race on a card 10 times |
| *Lingo Master* | See every tooltip in the game |

Achievements unlock **cosmetic rewards**: new track color palettes, alternate announcer voice styles, custom stable banners.

---

## Simulation Engine

The engine must feel realistic without being opaque. The primer doc (`docs/horse_racing_primer.md`) is the authoritative reference — read it before building.

### Overview

A race simulation proceeds in four phases:
```
1. Field Generation  →  who's running
2. Market Simulation →  what the crowd thinks (odds)
3. Race Execution    →  what actually happens (performance + variance)
4. Payout Resolution →  who gets paid
```

### Phase 1: Field Generation

Each race in a card is generated with:
- **Race type**: MCL, CLM, ALW, or STK (based on player progression)
- **Surface**: Dirt (70%), Turf (20%), Synthetic (10%). Conditions drawn from distribution (Fast 65%, Good 15%, Off-track 20%)
- **Distance**: Drawn from real distribution. Sprints (5f–6.5f) = 60%, Middle (7f) = 10%, Routes (1mi+) = 30%
- **Field size**: Per progression tier (6 at start, up to 10+ at Stakes)

Each horse is generated with:

| Attribute | How generated |
|-----------|---------------|
| Name | Random from curated name pool (~500 names, themed by class) |
| Age | 3–7, weighted toward 3–5 |
| Sex | G 47%, M 25%, F 19%, C 6%, H 3% (matches real distribution) |
| PSR | Drawn from class-appropriate distribution (see below) |
| Running style | E (early speed) 30%, P (presser/stalker) 40%, C (closer) 30% |
| Surface pref | Strong (±8 PSR), Mild (±3 PSR), Neutral (0). 40% have a strong pref |
| Distance pref | Sprint-pref, Route-pref, or Versatile. Mismatch costs 3–8 PSR |
| Quirk | Optional flavor text from a pool of ~30 quirks (cosmetic + functional) |
| Jockey | Random from pool of ~20 jockeys with skill ratings (A/B/C tier) |

**PSR Distribution by Class:**

| Class | PSR Mean | PSR Std Dev | Range |
|-------|----------|-------------|-------|
| MCL | 48 | 10 | 25–70 |
| CLM | 62 | 10 | 40–85 |
| ALW | 76 | 8 | 55–95 |
| STK | 90 | 8 | 70–115 |

PSR is drawn from a normal distribution, clamped to the range.

**Scratches:** After generating the field, each horse has a **10% scratch chance** (reduced from real 17% for gameplay — empty fields aren't fun). Scratched horses appear on the card as greyed out with a reason: *"Veterinary scratch," "Trainer decision," "Off-turf."* Minimum 4 runners after scratches; if a scratch would drop below 4, it doesn't happen.

### Phase 2: Market Simulation (Odds)

The parimutuel pool is built by a **simulated crowd** of ~1,000 virtual bettors. No fixed odds are assigned — odds emerge from the pool.

**Crowd Betting Model:**

Each virtual bettor allocates a $2 Win bet based on a noisy estimate of each horse's strength:

```
bettor_estimate[i] = PSR[i] + jockey_bonus[i] + surface_fit[i] + distance_fit[i] + noise
noise ~ Normal(0, σ=12)
```

- `jockey_bonus`: A-tier = +5, B-tier = +2, C-tier = 0
- `surface_fit`: +8 if strong match, +3 if mild match, 0 neutral, −3 mild mismatch, −8 strong mismatch
- `distance_fit`: +5 if preferred distance, 0 versatile, −5 if mismatched

Each bettor picks the horse with the highest `bettor_estimate` and bets on it. This naturally produces:
- Favorites at short odds (many bettors agree on the top horse)
- Longshots at high odds (few bettors land on weak horses by chance)
- The **favorite-longshot bias** (longshots are slightly overbet due to noise), matching real data

**Odds Calculation:**
```
pool_share[i] = total_bet_on_horse[i] / total_pool
raw_odds[i]   = (1 - takeout) / pool_share[i] - 1
display_odds[i] = round_down_to_nearest_dime(raw_odds[i])
```
- **Takeout**: 18% for Win/Place/Show, 22% for exotics
- **Minimum odds**: 0.1-1 (1-10). No horse pays less than $2.20 on a $2 bet.

**Tote Board Animation:**
Odds are revealed in 4 updates during a simulated MTP (minutes to post) countdown:
- MTP 5:00 — Morning line shown (track handicapper's estimate, ≈ crowd_estimate without noise)
- MTP 3:00 — Pool at 25% capacity. Odds are volatile.
- MTP 1:00 — Pool at 70% capacity. Odds stabilizing.
- MTP 0:00 — Final odds. Pool closed.

Late money: 5% chance per race that one horse receives a 30% surge in late betting (odds shorten sharply at MTP 1:00 → 0:00). Narrative: *"Late money pouring in on #4..."*

### Phase 3: Race Execution

The race is resolved in two stages: **pace scenario**, then **final performance**.

**Stage 1: Pace Scenario**

Each race draws a pace scenario based on the field's running style composition:

| Scenario | Condition | Effect |
|----------|-----------|--------|
| **Hot pace** | 3+ early speed horses (E) in field | E horses get −6 PSR penalty (tired), C horses get +4 bonus |
| **Honest pace** | 1–2 E horses, balanced field | No adjustments — race is "fair" |
| **Slow pace** | 0 E horses or only 1 E + mostly C | E/P horses get +4 bonus (soft lead), C horses get −4 penalty (no pace to close into) |

The pace scenario is the single biggest source of "upsets" — a closer at 8-1 winning a hot-pace race is not a fluke, it's pace dynamics. This is a core lesson for V1.

**Stage 2: Final Performance**

Each horse's finishing performance is calculated as:

```
base        = PSR
pace_adj    = pace_scenario_adjustment (see above)
surface_adj = surface_fit_bonus (same scale as crowd model: ±8/±3/0)
distance_adj = distance_fit_bonus (±5/0)
jockey_adj  = jockey_skill_bonus (A=+3, B=+1, C=0) + random(-2, +2)
post_adj    = post_position_penalty (post 1: 0, post 10+: −2, linear interpolation)
quirk_adj   = quirk_effect (if applicable, e.g., "hates mud" = −6 on off-track)

performance = base + pace_adj + surface_adj + distance_adj + jockey_adj + post_adj + quirk_adj + variance
variance    ~ Normal(0, σ=12)
```

**Variance σ=12 rationale:** With a typical field PSR spread of ~15–20 points, σ=12 ensures:
- The best horse wins ~30–35% of the time (matches real data for favorites)
- A 10-point PSR gap is overcome often enough for realistic upsets
- Longshots (10-1+) win ~10–15% of races, matching real data
- Upsets are common but not random — they have explanations (pace, surface, jockey)

**Finish Order:** Horses are ranked by `performance` descending. Ties within 0.5 points are a **photo finish** (narrative moment). Ties within 0.1 points are a **dead heat** (~0.5% of races — slightly above real 0.14% for more drama).

**Margin Calculation:** The gap between 1st and 2nd in performance points maps to a display margin:
- 0–0.5 points → "nose" / "head"
- 0.5–2 points → "neck" / "½ length"
- 2–5 points → "1–3 lengths"
- 5–10 points → "4–8 lengths"
- 10+ points → "drew off" / "10+ lengths"

### Phase 4: Payout Resolution

**Win Pool:**
```
gross_pool    = sum of all Win bets (player + simulated crowd)
net_pool      = gross_pool × (1 - takeout)
payout_per_$1 = net_pool / total_bet_on_winner
display_payout = payout_per_$1 × $2  (standard US $2 base)
```

**Place Pool:**
- Net pool split between 1st and 2nd place proportionally (each gets pool_share based on bets on them)
- Each winner's payout: `(their_share_of_net_pool / total_bet_on_that_horse) × $2`

**Show Pool:**
- Same as Place but split three ways (1st, 2nd, 3rd)

**Exacta:**
- Pool of all Exacta combinations bet
- Only the exact 1st-2nd combination wins
- Payout = `net_exacta_pool / total_bet_on_winning_combo × $2`
- Simulated crowd bets ~50 Exacta combinations per race, weighted toward likely outcomes

**Quinella:**
- Same as Exacta but 1st-2nd in either order wins
- Lower payouts than Exacta (easier to hit)

**Daily Double:**
- Must win two consecutive races
- Pool is separate; carries over between the two races

**Minimum payout rule:** No bet pays less than $2.10 on a $2 wager (5% minimum profit). If the pool math would pay less, the track absorbs the loss (called a "minus pool" — rare but real).

### Calibration Targets

The engine must produce outcomes matching these distributions from real data:

| Metric | Target |
|--------|--------|
| Favorite win rate | 30–35% |
| Top-2 favorite exacta rate | ~18% |
| Odds 0.5-1 win rate | ~55% |
| Odds 2-1 win rate | ~28–32% |
| Odds 5-1 win rate | ~15–19% |
| Odds 10-1 win rate | ~7–11% |
| Odds 20-1+ win rate | ~3–6% |
| Average winning odds | ~4-1 to 5-1 |
| Longshot (10-1+) win rate | ~15% of races |
| Dead heat rate | ~0.5% |
| Photo finish rate | ~8–12% |

---

## Race Animation

### The Strip
The race plays out as a **horizontal side-scrolling strip** on a canvas element. Portrait orientation: the strip scrolls left-to-right with the camera tracking the leaders.

### Visual Beats
Each race has 4 visual beats, timed to the race distance:

| Beat | What happens | Duration |
|------|-------------|----------|
| **Gate** | Horses load, gates spring open. Camera tight. | 2s |
| **Early pace** | Field spreads out. Speed horses go to front. Positions reflect running styles. | 3–4s |
| **Turn / mid-race** | Pack reshuffles. Closers begin to move up. Stalkers hold position. | 3–4s |
| **Stretch drive** | Camera widens. Closers launch. Leader tires or holds. Crowd noise rises. | 3–4s |

Total race animation: **11–14 seconds** (sprints shorter, routes longer).

### Announcer
Retro ticker-style text overlay at the bottom of the screen, typewriter-animated:

- Gate: *"And they're OFF!"*
- Early pace: *"Thunder Bay goes to the lead, Iron Rail pressing from the outside..."*
- Mid-race: *"Dusty Creek moving up on the rail, three wide around the turn..."*
- Stretch: *"Here comes Midnight Express on the far outside! Thunder Bay is tiring!"*
- Finish: *"MIDNIGHT EXPRESS wins it by a length!"* or *"PHOTO FINISH — too close to call!"*

The announcer text is generated from race state (leader, positions, closers making moves) — not canned. It references horses by name and describes the actual pace dynamics.

### Post-Finish
- **Result freeze**: Final positions displayed as a finishing order overlay
- **Photo finish**: If margin < 0.5 points, play a freeze-frame "photo" effect with a 2-second delay before revealing the winner
- **Payout reveal**: Animated tote board shows Win/Place/Show payouts, then exotic payouts
- **Recap screen**: Transitions to the post-race breakdown (see above)

---

## Persistence

### State Shape
All game state is managed in Zustand and persisted to `localStorage` via the `persist` middleware.

```typescript
interface GameState {
  // Player
  bankroll: number              // current balance in dollars
  startingBankroll: number      // initial bankroll (for stats)
  totalWagered: number          // lifetime wagered amount
  totalReturned: number         // lifetime payout received
  stipendsReceived: number      // bankruptcy protection counter

  // Progression
  currentTier: number           // 0–4, maps to unlock gates
  unlockedTracks: string[]      // track codes available
  unlockedBetTypes: string[]    // bet types available
  maxFieldSize: number          // current max runners per race

  // Knowledge
  seenTooltips: Set<string>     // tooltip IDs already shown
  achievements: Set<string>     // unlocked achievement IDs

  // Current Card
  currentCard: RaceCard | null  // today's races
  currentRaceIndex: number      // which race we're on
  cardBetsPlaced: number        // how many races bet on this card

  // Stable
  followedHorses: string[]     // horse IDs the player is tracking
  horseHistory: Record<string, HorseRecord[]>  // past results for followed horses

  // Stats
  totalRaces: number
  totalWins: number
  biggestWin: number            // largest single payout
  longestStreak: number         // consecutive wins
  currentStreak: number
}
```

### Persistence Rules
- State saves after every race resolution (not mid-race)
- On app load, hydrate from `localStorage` — if corrupt or missing, start fresh
- No cloud sync in V1 (future consideration for V2)
- Export/import as JSON for backup (accessible from settings)

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Bundler | **Vite** | Fast, modern, great DX |
| Framework | **React + TypeScript** | Component model fits game UI well |
| Styling | **Tailwind CSS** | Mobile-first by default; easy retro theming |
| State | **Zustand** | Lightweight; `persist` middleware for localStorage |
| Animation | **Framer Motion** | Tote board updates, race replay, tutorial overlays |
| Race visuals | **Canvas (React)** | The actual horse race animation strip |
| Testing | **Vitest** | Vite-native, fast, good for engine unit tests |

**Mobile-first** throughout. All UI designed for portrait phone screen first, then expanded for tablet/desktop.

---

## Art Direction

- **Retro pixel art** — think 16-bit era. Bright silks, chunky horses, expressive crowds.
- **Color palette**: warm track browns, green turf, bold primary silks colors, cream/sepia UI backgrounds.
- **Typography**: retro serif or slab font for headers; monospace for tote board numbers.
- **Tracks have personality**: AQU feels like New York (cold, gritty), GP feels like Florida (bright, sunny), KEE feels like Kentucky (elegant, green).
- **Animations**: gates open, horses animate in a side-scroll strip, photo finish freeze frame.
- **Sound**: crowd murmur, gate bell, hoofbeats, announcer call (text ticker style).

---

## File Structure

```
photo-finish/
├── OVERVIEW.md                  ← you are here
├── docs/
│   └── horse_racing_primer.md   ← full domain reference (read this)
├── src/
│   ├── engine/
│   │   ├── field.ts             ← horse + field generation
│   │   ├── market.ts            ← simulated crowd, parimutuel pool, odds
│   │   ├── race.ts              ← pace scenario, performance calc, finish order
│   │   ├── payout.ts            ← pool math, payout resolution
│   │   ├── recap.ts             ← post-race narrative generation
│   │   └── types.ts             ← shared engine types
│   ├── store/
│   │   ├── gameStore.ts         ← Zustand store (bankroll, progression, state)
│   │   └── selectors.ts         ← derived state (unlocked bets, current tier, etc.)
│   ├── ui/
│   │   ├── screens/
│   │   │   ├── RaceCard.tsx     ← field display, bet selector
│   │   │   ├── RaceView.tsx     ← animation canvas, announcer ticker
│   │   │   ├── Results.tsx      ← payout reveal, recap screen
│   │   │   ├── Stable.tsx       ← followed horses, history
│   │   │   └── Home.tsx         ← track select, daily card overview
│   │   ├── components/
│   │   │   ├── ToteBoard.tsx    ← animated odds display
│   │   │   ├── BetSlip.tsx      ← bet type selector, amount input
│   │   │   ├── HorseRow.tsx     ← single horse entry on race card
│   │   │   ├── Tooltip.tsx      ← first-seen terminology overlay
│   │   │   ├── Announcer.tsx    ← typewriter text overlay
│   │   │   └── Achievement.tsx  ← unlock notification toast
│   │   └── hooks/
│   │       ├── useTooltip.ts    ← first-seen trigger logic
│   │       └── useProgression.ts ← bankroll gate checks, unlock triggers
│   ├── data/
│   │   ├── names.ts             ← horse name pool (~500)
│   │   ├── jockeys.ts           ← jockey pool (~20) with skill tiers
│   │   ├── tracks.ts            ← track definitions (AQU, GP, KEE, etc.)
│   │   ├── quirks.ts            ← horse quirk pool (~30)
│   │   └── tooltips.ts          ← all tooltip definitions and trigger conditions
│   └── App.tsx
├── assets/
│   ├── sprites/                 ← pixel art
│   ├── sounds/                  ← audio
│   └── fonts/                   ← retro typefaces
├── tests/
│   ├── engine/
│   │   ├── field.test.ts        ← field gen distributions
│   │   ├── market.test.ts       ← odds calibration, favorite-longshot bias
│   │   ├── race.test.ts         ← outcome distributions, pace effects
│   │   └── payout.test.ts       ← payout math, minimum payout, edge cases
│   └── store/
│       └── gameStore.test.ts    ← progression, bankroll, persistence
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```

---

## What To Build First

Start with these in order:

1. **Vite + React + TypeScript + Tailwind scaffold** — base project setup with Vitest configured
2. **Engine types** — define `Horse`, `Race`, `Field`, `BetType`, `RaceResult`, `PaceScenario` types
3. **Field generator** — horse generation, PSR distributions, scratch logic
4. **Market simulator** — simulated crowd, pool math, odds calculation
5. **Race executor** — pace scenarios, performance calculation, finish order, margin/photo logic
6. **Payout resolver** — Win/Place/Show/Exotic pool math
7. **Engine tests** — verify all calibration targets from the table above. Run 10,000 simulated races and assert distributions are within tolerance.
8. **Zustand store** — bankroll, unlocks, race state, seen-tooltips, persistence
9. **Race card screen** — mobile-first, shows field with names, odds, running style, bet selector
10. **Tote board** — animated odds updates during MTP countdown
11. **Race animation screen** — canvas side-scroll strip, 4 visual beats, announcer ticker
12. **Post-race recap** — pace narrative, your horse's story, factor tags, lesson moments
13. **Results & payout screen** — animated payout reveal, bankroll update
14. **Tutorial overlay system** — fires on first-seen triggers, teaches one term at a time
15. **Progression system** — bankroll gates, unlock notifications, tier transitions
16. **Achievements** — tracking, unlock notifications, cosmetic rewards
17. **Daily card system** — card generation, featured race, completion bonus
18. **Stable** — follow horses, view history across cards

---

## Key Reference

The full domain reference lives at `docs/horse_racing_primer.md`. It contains:
- Real US race data (334k rows) — field sizes, PSR distributions, win % by odds
- All race types, surface conditions, distance encoding
- Parimutuel math, takeout, overround
- Jockey/trainer dynamics, equipment changes, medication
- 13 design principles for realistic simulation

**Read it before building the engine.**

---

## What This Is NOT (V1)

- Not a real money wagering app
- Not focused on CAW (Computer Assisted Wagering) — that's V2
- Not a PSR/form analysis tool — that's V2/V3
- Not trying to teach the edge formula — that's V3
- Not a daily-login-required engagement trap — no FOMO mechanics, no punishing missed days

V1 is a game. It should be fun first, educational second, and never feel like homework.
