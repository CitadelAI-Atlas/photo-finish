# Pixellab Horse Sprite Learnings

## API Access
- MCP tool: `mcp__pixellab__*`
- Use `create_object` (not `create_character`) for single-direction sprites
- `create_character` minimum is 4 directions and generates inconsistently across them — avoid for horses
- `animate_object` returns an `animation_id` — save it immediately, it's the only way to download frames later
- Frame URLs: `https://backblaze.pixellab.ai/file/pixellab-characters/objects/{bucket_id}/{object_id}/animations/{animation_id}/unknown/{frame_index}.png`
- Bucket ID for this account: `b62575af-0963-4cf2-9f51-95e6b504d883`
- Frames are 0-indexed

## create_object Parameters That Work
```
directions: 1
view: "side"          # for rail-cam sprites
view: "high top-down" # for overhead sprites
size: 128             # 128×128px canvas
```
- No `shading` parameter on create_object (causes validation error)

## vary_object
- Has a `seed` parameter — use a fixed seed (e.g. 42) for consistency across a batch
- Works excellently for side-view color variations from a strong master
- Does NOT work well for overhead variations — horse anatomy degrades into unrecognizable shapes
- Always vary from the best master image, not from a previous variation

## Animation
- `frame_count`: 4–6 max. More frames = more AI inconsistency between poses = choppier playback
- 16 frames is too many — avoid without explicit user approval
- Do NOT use the word "gallop" in animation descriptions — model defaults to a slow canter
- Animation speed is controlled in code (`strideFrameIndex`), not in the sprite — can be tuned independently

## What Works: The Winning Animation Prompt
The simplest prompt produced the best result:

> **"race horse running as fast as it can down the final stretch"**

This prompt on a full-extension base image produced realistic jockey up-and-down movement and convincing leg cycling.

## What Doesn't Work
- Describing the motion in too much detail (Muybridge-style frame descriptions, suspension phase, etc.) — model ignores it
- "gallop" — always reads as canter
- Long descriptive prompts about body mechanics — simple racing context beats technical anatomy

## Base Image Is Everything
The most important discovery: **the animation model interpolates from the base pose**. If the static frame already shows full leg extension (forelegs forward, hindlegs back, body airborne), the animation has a strong reference and produces better cycling motion.

A relaxed mid-stride base = relaxed animation. A full-extension base = racing animation.

## Side View Sprites
**Master:** `11b387e5-560e-4243-98d3-29ffea23f50c` (blood bay, purple/white stars)
- Best leg extension in static frame
- Best animation result with "race horse running as fast as it can down the final stretch"
- Jockey visibly moves up and down — very realistic

**Note:** Master is currently facing left (west). Flip with `scale(-1, 1)` in canvas code — no need to regenerate.

Good side view prompt structure:
```
Pixel-art thoroughbred racehorse at peak full-extension suspension, east-facing side profile.
[Coat] coat — [description], [mane], [tail] blown back.
Both forelegs fully extended and reaching as far forward as possible,
both hindlegs fully extended and stretched as far back as possible,
all four hooves off the ground. Body long and horizontal, head and neck
driving low and forward, powerful haunches and defined shoulder muscles.
Jockey locked in tight racing crouch over withers, [silks], [cap].
Hard pixel edges, flat solid colors, transparent background.
```

## Overhead View Sprites
**Master:** `96ee7d7f-c249-408d-8113-db54c1ca4d66` (dapple gray, emerald/white hoops)
- Only reliable overhead that reads as a horse
- Animation rotates/tilts through frames — overhead animation is unstable
- `vary_object` from overhead master fails — anatomy degrades

**New master:** `e98fd429-f464-480a-afea-33ac64ee55ec` (true 90° nadir, 1 animation)
- `vary_object` produces wrong foot/tail markings on most horses — only `454f69ef` (bay, blue X sash) passed review
- Anatomy degradation is the consistent failure mode, not coat color
- **Do NOT batch vary overhead** — verify each one before proceeding to the next

Best overhead result for animation: `d7a7d6d5-38e5-4b7c-81eb-b606e748c4b0` (vary of gray master, seed 67)
- Legs extend forward and back (not laterally) — correct running axis

Overhead still needs a better base image with:
- True 90° nadir view (not angled high top-down)
- Legs stretched maximally front and back along running axis
- No lateral leg spread

## Color Rules
- Light coats (gray, palomino, chestnut) read better overhead — more contrast with track
- Dark coats (black, dark bay) lose detail from above
- Silk colors need high contrast against coat color
- Complex patterns (hoops, stars, chevrons, diamonds) are preferred — more realistic and distinctive at small flag sizes
- Each horse needs a unique primary silk color for in-game flag UI

## The 12 Horse Spec

| # | Coat | Silks | Cap | Side ID | Side Anim | Overhead ID | Overhead Anim |
|---|---|---|---|---|---|---|---|
| 1 | Bay | Royal blue + white X sash | White | `ef722cb6` | ✅ 7fr | `454f69ef` | ✅ matched |
| 2 | Blood bay | Purple + white stars | White | `11b387e5` | ✅ 7fr (master) | `5bf7d007` | ✅ matched |
| 3 | Dark bay + blaze | Red + yellow star | Yellow | `eed79915` | ✅ 7fr | `42591ebb` | ✅ matched |
| 4 | Chestnut + socks | Teal + red diagonal sash | Red | `4a2c463a` | ⏳ queued | `a3ac5240` | ✅ matched |
| 5 | Dapple gray | Emerald + white hoops | Emerald | `e88dc86f` | ⏳ queued | `56e6b6db` | ✅ matched |
| 6 | Dark bay | Gold + black polka dots | Gold | `9039e5d9` | ⏳ queued | `cbd1136c` | ✅ matched |
| 7 | Jet black | Hot pink + black diamond | Black | `602c7809` | ⏳ queued | `59a8c739` | ✅ matched |
| 8 | Palomino | Maroon + gray quarters | Gray | `fc90c7f9` | ⏳ queued | `40a16a1c` | ✅ matched |
| 9 | Light chestnut | Orange + navy chevron | Navy | `d288be7e` | ⏳ queued | `675444fc` | ✅ matched |
| 10 | Liver chestnut | Yellow + black polka dots | Black | `e3707f53` | ❌ needs anim | `c3c4afc6` | ✅ matched |
| 11 | Red roan | Navy + orange vertical halves | Orange | `6a5b2dd7` | ❌ needs anim | `1d01d5e4` | ✅ matched |
| 12 | Bay + 4 white socks | White + red hoop | Red | `fcaca6b4` | ❌ needs anim | `21bc890c` | ✅ matched |

## Photo Finish Sprites (Close-Up)

### Goal
Replace the current film-grain PHOTO overlay with a close-up slit-scan-style panel showing
the noses of the top finishers at the wire. Each horse needs a **side-view close-up** sprite:
just the head, neck, and nose — no legs or body below chest — at the nose-stretching wire moment.

### Spec
```
create_object(directions=1, view="side", size=128)
Description template:
  "Pixel-art close-up of a thoroughbred racehorse head and neck at peak nose-stretch
  crossing the finish wire, extreme side profile, east-facing.
  [COAT] coat, [SILKS], [CAP] cap.
  Jockey helmet and hand visible gripping reins, horse nostrils flared,
  neck driving low and forward, head fully extended.
  No legs, no body below chest.
  Hard pixel edges, flat solid colors, transparent background."
```

### Status

| # | Coat | Silks | Object ID | Status |
|---|---|---|---|---|
| 1 | Bay | Royal blue + white X sash | `8251cd7c` | ⏳ generating |
| 2–12 | — | — | — | — |

### Usage Plan
- Stack 2–3 close-up sprites side-by-side in a horizontal "photo finish strip" panel
- Freeze at wire, show strip centered on canvas with PHOTO FINISH banner above
- Resolve to winner after pause

## Storage Plan
```
src/ui/screens/raceView/sprites/
  horse-{1..12}/
    side/
      1.png … 6.png     ← animation frames (rail-cam)
    overhead/
      1.png … 6.png     ← animation frames (primary race view)
```

## Pipeline Summary
1. `create_object` (directions=1, view=side, size=128) — generate master at full extension
2. Review static frame — confirm leg extension and pose
3. `animate_object` (frame_count=6) with prompt: "race horse running as fast as it can down the final stretch"
4. Download frames via backblaze URL pattern
5. `vary_object` from master (seed=42) — coat + silk color changes only
6. Animate each variation with same prompt
7. Store frames to `sprites/horse-{n}/side/`
