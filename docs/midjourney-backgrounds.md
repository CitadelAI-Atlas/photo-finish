# Midjourney Background Art

## Rail-Cam Grandstand Background

### Spec
- **Dimensions:** 2048 × 512px
- **Aspect ratio:** 4:1 (`--ar 4:1`)
- **Usage:** Parallax background layer behind rail-cam horse sprites
- **Composite:** Game renders track band (bottom ~22% of viewport) on top — background only needs to fill sky + grandstand zone

### Compositional zones
```
┌──────────────────────────────────────────────────────────────────┐  0px
│                          SKY / ATMOSPHERE                        │
│         (blue sky, afternoon haze, soft clouds)                  │  ~160px
├──────────────────────────────────────────────────────────────────┤
│    GRANDSTAND  │  TOTE BOARD  │   GRANDSTAND CONTINUES          │
│  (covered roof, packed crowd, flags/banners on fascia)           │  ~320px
├──────────────────────────────────────────────────────────────────┤
│              INFIELD + FAR RAIL (green grass, white rail)        │  ~440px
└──────────────────────────────────────────────────────────────────┘  512px
        ▲ game overlays track band + horses above this line
```

### Prompt
```
Flat orthographic illustration of a horse racing grandstand, 
perfectly side-on elevation view, no perspective, no vanishing point, 
2D architectural silhouette, packed crowd visible in tiered seating, 
covered roof with pennant flags along the fascia, tote board center, 
green infield strip and white rail at base, clear sky above, 
painterly watercolor wash, muted broadcast palette, 
no horses, no track surface. --ar 4:1 --stylize 150
```

**Why flat orthographic:** angled/perspective prompts pull toward 3D cinematic feel which competes with the 2D sprite layer. Flat elevation reads as a stage backdrop — horses run in front of it naturally.

## Layout Mockup

```
VIEWPORT (e.g. 1280 × 720px — fully responsive)
┌────────────────────────────────────────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ SKY (Midjourney layer) ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ 0%
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ GRANDSTAND + CROWD ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ 78%
├────────────────────────────────────────────────────────────────────────────┤ ← trackTop
│░░░░░░░░░░░░░░░░░░░░ TRACK BAND (game canvas layer) ░░░░░░░░░░░░░░░░░░░░░│
│  🐴  🐴  🐴  🐴  🐴  🐴  ← horses run here (128px sprites, scaled)       │
└────────────────────────────────────────────────────────────────────────────┘ 99%

Midjourney image scrolls horizontally behind horses (parallax).
Track band is drawn by canvas — NOT in the Midjourney image.
```

## Notes
- Test at 50% opacity blend if background competes with horses
- The image should be horizontally tileable OR wide enough (2048px) that scroll never reveals an edge
- Parallax scroll freezes during wire-crossing pause (coded)

---

## Per-Track Grandstand Prompts

All tracks use the same base spec: **2048×512px, --ar 4:1**, flat orthographic side elevation, no perspective, no track surface. Swap the track-specific details below into the prompt template.

### Base template
```
Flat orthographic illustration of [TRACK DESCRIPTION],
perfectly side-on elevation view, no perspective, no vanishing point,
2D architectural silhouette, packed crowd in tiered seating,
covered roof with pennant flags along the fascia, tote board center,
green infield strip and white rail at base, [SKY],
painterly watercolor wash, muted broadcast palette,
no horses, no track surface. --ar 4:1 --stylize 150
```

---

### AQU — Aqueduct (New York)

**Style 1 — Winter/overcast (signature season)**
```
Flat orthographic illustration of Aqueduct Racetrack grandstand, Jamaica Queens New York,
brutalist concrete 1950s architecture, low flat roofline, no ornate spires,
perfectly side-on elevation view, no perspective, no vanishing point,
2D architectural silhouette, packed crowd in tiered seating,
covered concrete roof with pennant flags along the fascia, tote board center,
green infield strip and white rail at base, grey overcast winter sky, bare trees visible,
painterly watercolor wash, muted slate and concrete palette,
no horses, no track surface. --ar 4:1 --stylize 150
```

**Style 2 — Flat ink line art**
```
Flat orthographic ink illustration of Aqueduct Racetrack grandstand, Queens New York,
brutalist 1950s concrete stands, low flat roofline, dense crowd,
side-on architectural elevation, no perspective, tote board center,
white rail at base, overcast sky, limited color palette grey and cream,
crisp ink outlines, editorial sports illustration style,
no horses, no track surface. --ar 4:1 --stylize 80
```

**Style 3 — Retro poster**
```
Vintage retro travel poster style, Aqueduct Racetrack New York,
flat orthographic side elevation, concrete grandstand, packed crowd,
bold graphic shapes, limited 3-color palette charcoal grey cream and red,
no perspective, tote board, white rail, overcast sky,
no horses, no track surface. --ar 4:1 --stylize 250
```

---

### GP — Gulfstream Park (Miami)

**Style 1 — Sunny Florida afternoon**
```
Flat orthographic illustration of Gulfstream Park grandstand, Hallandale Beach Florida,
modern curved white architecture, glass facades, palm trees behind the stands,
perfectly side-on elevation view, no perspective, no vanishing point,
2D architectural silhouette, packed crowd in tiered seating,
white cantilevered roof with colorful pennant flags, tote board center,
green infield strip and white rail at base, bright blue Florida sky with soft white clouds,
painterly watercolor wash, warm sunny palette turquoise and white,
no horses, no track surface. --ar 4:1 --stylize 150
```

**Style 2 — Flat ink line art**
```
Flat orthographic ink illustration of Gulfstream Park grandstand, Miami Florida,
modern white curved architecture, palm trees, glass and steel,
side-on architectural elevation, no perspective, dense crowd, tote board,
bright blue sky, white rail at base, vivid tropical color palette,
crisp ink outlines, editorial sports illustration style,
no horses, no track surface. --ar 4:1 --stylize 80
```

**Style 3 — Retro poster**
```
Vintage retro travel poster style, Gulfstream Park Florida,
flat orthographic side elevation, white modern grandstand, packed crowd, palm trees,
bold graphic shapes, limited 3-color palette aqua white and coral,
no perspective, tote board, white rail, sunny blue sky,
no horses, no track surface. --ar 4:1 --stylize 250
```

---

### KEE — Keeneland (Lexington)

**Style 1 — Autumn limestone classic**
```
Flat orthographic illustration of Keeneland Race Course grandstand, Lexington Kentucky,
classic limestone stone architecture, traditional low-slung grandstand, white trim,
perfectly side-on elevation view, no perspective, no vanishing point,
2D architectural silhouette, packed crowd in tiered seating,
white covered roof with pennant flags along the fascia, tote board center,
green infield strip and white three-board fence rail at base,
golden autumn foliage visible behind stands, clear blue October sky,
painterly watercolor wash, warm limestone and autumn palette,
no horses, no track surface. --ar 4:1 --stylize 150
```

**Style 2 — Flat ink line art**
```
Flat orthographic ink illustration of Keeneland Race Course grandstand, Lexington Kentucky,
limestone stone architecture, traditional low grandstand, white trim,
side-on architectural elevation, no perspective, dense crowd, tote board,
autumn trees, blue sky, white three-board rail at base,
warm stone and gold color palette, crisp ink outlines, editorial sports illustration style,
no horses, no track surface. --ar 4:1 --stylize 80
```

**Style 3 — Retro poster**
```
Vintage retro travel poster style, Keeneland Race Course Kentucky,
flat orthographic side elevation, limestone grandstand, packed crowd, autumn trees,
bold graphic shapes, limited 3-color palette stone grey gold and white,
no perspective, tote board, white board fence rail, clear sky,
no horses, no track surface. --ar 4:1 --stylize 250
```

---

### SA — Santa Anita (Los Angeles)

**Style 1 — Sunny San Gabriel Mountains backdrop**
```
Flat orthographic illustration of Santa Anita Park grandstand, Arcadia California,
Spanish mission revival architecture, arched colonnades, red tile roof, white stucco,
perfectly side-on elevation view, no perspective, no vanishing point,
2D architectural silhouette, packed crowd in tiered seating,
red tiled covered roof with pennant flags, tote board center,
green infield strip and white rail at base,
San Gabriel Mountains silhouette visible behind stands, clear sunny California sky,
painterly watercolor wash, warm terracotta and sky blue palette,
no horses, no track surface. --ar 4:1 --stylize 150
```

**Style 2 — Flat ink line art**
```
Flat orthographic ink illustration of Santa Anita Park grandstand, Los Angeles California,
Spanish mission arched architecture, red tile roof, white stucco, mountain backdrop,
side-on architectural elevation, no perspective, dense crowd, tote board,
sunny sky, mountain silhouette, white rail at base,
terracotta and blue color palette, crisp ink outlines, editorial sports illustration style,
no horses, no track surface. --ar 4:1 --stylize 80
```

**Style 3 — Retro poster**
```
Vintage retro travel poster style, Santa Anita Park Los Angeles,
flat orthographic side elevation, Spanish mission grandstand, packed crowd, mountain backdrop,
bold graphic shapes, limited 3-color palette terracotta sky-blue and cream,
no perspective, tote board, white rail, clear sunny sky,
no horses, no track surface. --ar 4:1 --stylize 250
```
