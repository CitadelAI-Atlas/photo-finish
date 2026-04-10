# Horse Racing Primer
## For Game Design & Agent Training

This document captures everything learned building Alydar — an ML betting model on US thoroughbred racing.
Use it to design a semi-realistic horse racing simulation or game.

---

## 1. Race Structure

### The Card
A race **card** is a day's schedule at a single track — typically 8–12 races per day.
Each race on the card is numbered sequentially (Race 1, Race 2, ...).
Races are classified as either **day** or **evening** (day/eve flag `C`).

### The Field
- Each race has a **field** of runners — horses entered to compete.
- Typical US field size: **7–9 runners**. Range: 2 (small stakes) to 14+ (big fields).
- Real distribution from 334k rows of US data:
  - Average field size: **7.9 runners per race**
  - Small fields (≤5): ~15% of races
  - Mid fields (6–9): ~55% of races
  - Large fields (10+): ~30% of races
- Each runner is assigned a **post position (PP)** — their starting gate number, 1 = rail.

### Race Key
A race is uniquely identified by four fields:
- **Track code** (e.g. AQU, GP, SA, KEE, PHA)
- **Date**
- **Race number**
- **Day/eve indicator**

---

## 2. Horse Identity

### Identity Fields
A horse is uniquely identified by the **triple key**:
- **Name** — e.g. "Hurricane Jane"
- **Year of birth (YOB)** — e.g. 2022
- **Foaling area** — country/region of birth (US, IRE, GB, FR, etc.)

Name alone is NOT sufficient — different horses can share a name across foaling years.

### Demographics
- **Age**: Horses race from age 2 (debut year) through 10+. Peak: ages 3–6.
- **Sex**:
  - `G` = Gelding (castrated male) — 47% of US starters
  - `M` = Mare (female, 4+) — 25%
  - `F` = Filly (female, ≤3) — 19%
  - `C` = Colt (male, ≤3) — 6%
  - `H` = Horse (intact male, 4+) — 4%
  - `R` = Ridgling (partially castrated)
- **Weight carried**: jockey + saddle. Typical: 116–126 lbs. Higher weight = slight disadvantage.

### Career Tracking
- **Career race number (`R_.`)**: Horse's lifetime start count. `1` = first career race ("debut").
  Increases by 1 for every actual start (scratches don't count).
- **Days since last race (DSLR)**: How many days since the horse's previous start.
  - Null for first-time starters and scratches.
  - Typical range: 7–90 days. Horses running back in <7 days are rare.
  - Very long layoffs (90+ days) often signal injury recovery.

---

## 3. Race Classification

### Race Types (US Equibase 7-type system)

| Code | Name | Description |
|------|------|-------------|
| `CLM` | Claiming | Any horse in the field can be "claimed" (purchased) for a set price. Largest category (~37%). |
| `MCL` | Maiden Claiming | Claiming race for horses that have never won. ~15%. |
| `OCL` | Optional Claiming | Open to non-claimers OR claimers at owner's choice. ~14%. |
| `MSW` | Maiden Special Weight | Non-claiming race for horses that have never won. ~12%. Debuts happen here. |
| `ALW` | Allowance | Better quality than claiming. Conditions based on earnings/wins. ~9%. |
| `STK` | Stakes | Top tier. Graded stakes (G1/G2/G3) are the most prestigious. ~6%. |
| `STR` | Starter | Allowance for horses that started for a claiming price. ~2%. |

**Hierarchy (low → high quality):** MCL → CLM → OCL → STR → MSW → ALW → STK

### Claiming Prices
In claiming races, horses are assigned a **claiming price** — any licensed owner can buy the horse for that price by filing a claim before the race. This self-regulates: owners only run a horse in a claiming race they're comfortable losing it at.

### Purse
Prize money distributed among the top finishers (typically 1st–5th).
- Maiden/Claiming: $12,000–$35,000
- Allowance: $40,000–$80,000
- Stakes: $75,000–$2,000,000+

---

## 4. Surface & Conditions

### Surface Types
| Code | Name | Description |
|------|------|-------------|
| `D` | Dirt | Main track, compacted dirt. Most common (~72% of US races). |
| `T` | Turf | Grass course. ~18% of races. |
| `A` | Synthetic | Artificial surface (Polytrack, Tapeta). ~10%. |

Horses often have strong surface **preferences** — a dirt specialist may run poorly on turf.

### Track Conditions
Describes how firm or wet the surface is on race day.

**Dirt conditions (dry → wet):**
| Code | Name |
|------|------|
| `FT` | Fast (firm/dry) — most common, ~65% |
| `GD` | Good |
| `SY` | Sloppy (wet but uniform) |
| `MY` | Muddy |
| `WF` | Wet Fast |
| `SL` | Slow |
| `HY` | Heavy |

**Turf conditions:**
| Code | Name |
|------|------|
| `FM` | Firm — ~15% overall |
| `GD` | Good |
| `YL` | Yielding |
| `SF` | Soft |
| `HY` | Heavy |

**Off-turf**: When turf is unraceable (heavy rain), races are moved to dirt. Horses bred for turf often struggle on dirt.

---

## 5. Distance

### Measurement
US racing distances are measured in **furlongs** (1 furlong = 660 feet = 1/8 mile).
Common distances:

| Distance | Furlongs | Type |
|----------|----------|------|
| 4.5f | 2,970 ft | Sprint |
| 5.0f | 3,300 ft | Sprint |
| 5.5f | 3,630 ft | Sprint (~12% of races) |
| 6.0f | 3,960 ft | Sprint (most common, ~25%) |
| 6.5f | 4,290 ft | Sprint |
| 7.0f | 4,620 ft | Middle |
| 1 mile | 5,280 ft | Route (~18%) |
| 1m 40y | 5,400 ft | Route |
| 1m 70y | 5,490 ft | Route |
| 1.125m | 5,940 ft | Route |

### Special Distance Encoding (HDW)
The HDW data uses a quirky decimal encoding:
- `.18` suffix = +40 yards (e.g. `8.18` = 1 mile 40 yards)
- `.32` suffix = +70 yards (e.g. `8.32` = 1 mile 70 yards)
- Plain decimal = furlongs (e.g. `6.0` = exactly 6 furlongs)

### Distance Preference
Horses develop strong distance preferences through their career. A sprinter (best at 5–6f) may fade badly in a mile race.

---

## 6. The Parimutuel (Tote) System

### How It Works
US horse racing uses **parimutuel wagering** — the track pools all bets, takes a cut (**takeout**), and distributes the remainder to winners proportionally.

There is **no bookmaker** setting fixed prices. Odds are determined entirely by where the crowd bets.

### Key Mechanics
1. Bettors place wagers into a **pool** for each bet type (Win, Place, Show, Exacta, etc.)
2. The track deducts **takeout** (~16–20% on Win bets) before payout
3. Remaining pool is divided among winning tickets
4. Odds update in real-time as bets come in until the gate opens (**MTP = 0**)

### Implied Probability
If the tote shows a horse at **4-1 odds**:
- Implied win probability = 1 / (4 + 1) = **20%**
- After ~18% takeout, the "true" pool-implied probability ≈ 20% × 0.82 ≈ **16.4%**

### Overround
The sum of all implied probabilities in a race **exceeds 100%** — the excess is the house margin (overround). On a typical Win pool with 18% takeout, the overround is ~22%.

### Odds Format
- **"To-1" format**: "4-1" means win $4 for every $1 bet (plus your stake back = $5 return per $1)
- **Decimal format**: "5.0" means your $1 becomes $5 total
- **Morning line (ML)**: The track handicapper's estimate of fair odds, set the morning of the race. NOT a market price — purely an opinion.
- **Final odds**: Actual tote odds at race time. These are the true market.

### Rebates
Large-volume bettors (liquidity providers) negotiate **rebates** from ADWs (advance deposit wagering platforms):
- Typical rebate: 5–10% of handle
- Effective takeout for a rebate bettor: ~18% - 8% = **~10%**
- This is what makes a quantitative betting strategy viable — retail bettors face ~18% headwind; rebate bettors face ~10%

### The Edge Formula
```
edge = model_win_probability - tote_implied_probability
```
Bet when `edge > 0` (after accounting for effective takeout).
In practice, a threshold of **+5% edge** filters out noise.

---

## 7. Speed Ratings

### What They Are
Speed ratings translate raw race times into a single number accounting for track conditions and distance. Higher = faster.

### PSR (HDW Projected Speed Rating)
- HDW's proprietary pre-race speed figure
- **Gold standard pre-race feature** — available before the race, no leakage
- Range: typically 0–120 for active US horses; negative values exist for very poor/incomplete figures
- Null (~10% of rows): first-time starters, some foreign-trained horses, Quarter Horses
- Meaning: a horse with PSR 90 is expected to run faster than a PSR 75 horse

### Using PSR in Simulation
- PSR alone correctly identifies the winner in **~30–35% of races** (vs ~13% random in 8-horse field)
- The public favorite wins ~33% of races
- Top-PSR and public favorite agree ~60% of the time
- When they disagree, top-PSR outperforms (~28% vs ~24% hit rate in disagreement races)

### Form-Based Features
Beyond PSR, horse form is built from prior race history:

| Feature | Description |
|---------|-------------|
| `last_1_psr` | PSR from most recent race |
| `last_3_avg_psr` | Average PSR over last 3 races |
| `last_5_avg_psr` | Average PSR over last 5 races |
| `best_psr_last_5` | Best (peak) PSR in last 5 races |
| `last_1_fp_ofl` | Finish position in last race |
| `last_1_won` | Did the horse win last time out? |
| `wins_last_5` | Win count over last 5 starts |
| `days_since_last_start` | Layoff length |
| `starts_last_90d` | Fitness indicator (how active?) |
| `same_surface_avg_psr_last_5` | PSR on today's surface type |
| `same_dist_avg_psr_last_5` | PSR at today's distance (±0.5f) |

---

## 8. The Race Event

### Before the Race
1. **Entries**: Horses are entered days in advance. A trainer scratches a horse (withdraws) if it draws an unfavorable post or the surface changes.
2. **Morning line**: Track handicapper posts estimated odds.
3. **Wagering opens**: Pools open ~20–30 minutes before post time.
4. **MTP countdown**: Odds update every ~90 seconds. Final odds locked at gate open.
5. **Post parade**: Horses walk to the gate. Bettors watch for signs of distress.

### The Race
- Starter loads horses into starting gates.
- Gates open simultaneously — **the break** matters enormously in sprints.
- **Early speed** horses try to lead from the front.
- **Closers** hang back and make a late run.
- **Pace dynamics**: A fast early pace tires front-runners, setting up closers; a slow pace favors speed horses.

### After the Race
- Official finish posted (sometimes after a **stewards' inquiry** for interference).
- **DQ (disqualification)**: A horse can be placed down or removed for interference.
  - `FP` = original finish position
  - `FP_Ofl` = official finish position after DQ (use this as your target)
- **Dead heat**: Two horses finish simultaneously — both declared winners.
- **Claiming**: Filed claims are revealed; the claimed horse leaves with the new owner.

---

## 9. Betting Types

### Straight Wagers
| Bet | Win condition |
|-----|--------------|
| **Win** | Your horse finishes 1st |
| **Place** | Your horse finishes 1st or 2nd |
| **Show** | Your horse finishes 1st, 2nd, or 3rd |

### Exotic Wagers
| Bet | Win condition |
|-----|--------------|
| **Exacta** | Pick 1st and 2nd in exact order |
| **Quinella** | Pick 1st and 2nd in either order |
| **Trifecta** | Pick 1st, 2nd, 3rd in exact order |
| **Superfecta** | Pick 1st–4th in exact order |
| **Daily Double** | Win two consecutive races |
| **Pick 3/4/5/6** | Win 3/4/5/6 consecutive races |

### Bet Sizing
Standard US unit: **$2 win bet**.
Payouts shown as return on a $2 bet (e.g. "$9.40" = $9.40 back on a $2 bet = 4.7-1 odds).

---

## 10. Jockeys & Trainers

### Jockeys
- Ride the horse during the race; control pace, position, and when to ask for effort.
- Top jockeys (e.g. Irad Ortiz Jr, Luis Saez, Flavien Prat) significantly boost win probability.
- **Jockey switch**: A horse switching to a top jockey is a positive signal.
- Weight: jockeys target riding weight ~112–118 lbs. "Overweight" declared if above assigned weight.

### Trainers
- Responsible for conditioning, race selection, and daily care.
- **Trainer intent**: Trainers dropping a horse in class or adding blinkers are often signaling an attempt to win.
- Top trainers (Todd Pletcher, Bob Baffert, Chad Brown) have higher base win rates.

### Connections
The jockey + trainer combination is called **connections**. Powerful connections (top trainer + top jockey) are a strong positive signal, especially in high-value races.

---

## 11. Equipment & Medication

### Common Equipment Changes
| Change | Implication |
|--------|-------------|
| **Blinkers on** | Horse was easily distracted; trainer trying to focus it |
| **Blinkers off** | Horse was over-focused; relaxing it |
| **Lasix (Furosemide)** | Prevents exercise-induced pulmonary hemorrhage. ~83% of US starters run on Lasix. |
| **Bar shoe** | Hoof/foot issue — watch for improvement or worsening |

### Medication Codes (US)
- `L` = Lasix — by far most common
- `BL` = Bute + Lasix
- `B` = Bute (phenylbutazone, anti-inflammatory)
- Null = no reported medication

---

## 12. Realistic Simulation Parameters

Based on real US data (334k starter rows, Jan 2025 – Feb 2026):

### Race Calendar
- US racing runs **year-round** at major tracks
- ~93 race days per track per year (varies widely)
- ~8.5 races per card on average

### Track Distribution (top US tracks by volume)
Tracks by starter share in the data: AQU (New York), PHA (Philadelphia), BEL (New York), KEE (Keeneland/Lexington), GP (Gulfstream/Florida), SA (Santa Anita/California), CD (Churchill Downs/Kentucky), DEL (Delaware), PEN (Penn National).

### Field Sizes by Race Type
- Sprint claiming (CLM/MCL): avg 7–8 runners
- Route allowance (ALW): avg 8–9 runners
- Stakes (STK): avg 8–10 runners; G1 often capped at 14

### PSR Distribution
- Range: negative (poor) to ~130 (elite)
- Median: ~60–65 for active US horses
- Null rate: ~10% (mostly debuts and Quarter Horses)

### Win Probability vs Odds (from real data)
| Odds range | Approx true win % |
|------------|------------------|
| 0.5-1 (heavy fav) | ~55% |
| 1-1 (even) | ~40% |
| 2-1 | ~30% |
| 5-1 | ~17% |
| 10-1 | ~9% |
| 20-1 | ~5% |
| 30-1+ (longshot) | ~2–3% |

The tote market is **well-calibrated at short odds** but **overestimates longshots** (people love betting long shots). This creates systematic value on mid-range prices (4-1 to 9-1) relative to the crowd's assessment.

### Scratches
~17% of entered horses are scratched (withdrawn) before the race. Scratches:
- Have null `FP_Ofl` and null `career_race_num`
- Common reasons: off-surface (turf race moved to dirt), veterinary scratch, equipment issue
- When a horse scratches, remaining horses keep their post positions (no renumbering in US racing)

### Dead Heats
~52 dead heats per ~37,000 races (~0.14%). Rare but possible.

### Cancelled Races
~5% of race-keys have no official winner — cancelled or abandoned races (weather, track unsafe).

---

## 13. Key Design Principles for a Realistic Game

1. **Odds are emergent** — don't assign fixed win probabilities. Let a simulated crowd bet based on visible factors (PSR, recent form, jockey, odds drift), and let the pool determine the price.

2. **Pace matters** — races aren't just "roll the dice on finish order." Include an early-pace dynamic: speed horses lead, closers come late, pace scenarios affect outcomes.

3. **Surface & distance switches** are major narrative moments. A horse running on turf for the first time is a genuine unknown.

4. **Class changes** are predictive: a horse dropping from ALW to CLM is likely trying to win (positive signal); a horse rising from CLM to ALW may be outclassed.

5. **Layoff length** matters:
   - 7–28 days off = fresh but fit
   - 29–90 days = slight rust possible
   - 90+ days = significant fitness question; often returning from injury

6. **First-time starters** (debut horses) have no form to evaluate — pure uncertainty. The morning line is the only signal. In reality, well-bred debuters from top trainers often run well fresh.

7. **Jockey agency** creates narrative: a good jockey can "save" a horse from a bad position; a poor decision (going too wide, too early) can cost the race.

8. **The tote moves** — late money on a horse (odds shortening sharply in the last 2 minutes) often signals insider confidence. This is a real phenomenon in US racing.

9. **Variance is high** — even the best horse in the race wins only ~35–40% of the time. Upsets are normal. A 15-1 shot wins roughly 1 in 16 races it "should" win.

10. **Rebates change the math** — a game featuring professional bettors should model the rebate structure. Without rebates, no systematic strategy is profitable long-term.
