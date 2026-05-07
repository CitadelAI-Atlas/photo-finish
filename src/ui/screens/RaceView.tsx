import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Race, MarketSnapshot, RaceResult } from '@/engine/types'
import { perfGapToLengths } from '@/engine/race'
import { Announcer } from '@/ui/components/Announcer'
import {
  type Particle,
  spawnHoofKick,
  updateParticles,
  drawParticles,
} from './raceView/particles'
import {
  type RacePhase,
  PHASES,
  PHASE_DURATION,
  phaseLabel,
  easeInOutCubic,
  baseProgress,
  styleOffset,
} from './raceView/phaseTiming'
import { ppColor } from '@/ui/utils/postPosition'
import { ensureSpritesLoaded, getTintedFrames, strideFrameIndex } from './raceView/horseSprite'
import { ensureOverheadLoaded, getOverheadFrame } from './raceView/overheadSprite'
const GRANDSTAND_URL = '/_grandcru_Flat_orthographic_illustration_of_a_horse_racing_gran_25fa3c74-9066-45c6-9216-122f8e0afdd8.png'

let grandstandImg: HTMLImageElement | null = null
let grandstandLoading = false
function ensureGrandstandLoaded(): void {
  if (grandstandLoading) return
  grandstandLoading = true
  const img = new Image()
  img.onload = () => { grandstandImg = img }
  img.src = GRANDSTAND_URL
}

interface RaceViewProps {
  race: Race
  market: MarketSnapshot
  mtpSnapshots: MarketSnapshot[]
  playerHorseId: string | null
  result: RaceResult | null
  onRaceComplete: () => void
}

type CameraMode = 'start' | 'wide' | 'rail'
// Camera mapping. The 'stretch' phase covers t≈0.55→0.85 of the oval —
// horses are still on the back stretch / bottom turn, far from the
// finish wire. We previously locked the camera to the wire here, which
// left the field off-screen for several seconds. Wide cam keeps the
// whole oval visible until we transition into the rail-cam photo finish.
function cameraForPhase(p: RacePhase): CameraMode {
  if (p === 'tote' || p === 'gate' || p === 'early') return 'start'
  if (p === 'mid' || p === 'stretch') return 'wide'
  return 'rail'
}

const SILK_COLORS = [
  '#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#9333ea',
  '#0891b2', '#e11d48', '#ea580c', '#4f46e5', '#059669',
  '#d97706', '#7c3aed',
]

type SilkPattern = 'solid' | 'sash' | 'stripes' | 'quartered' | 'diamond'
const SILK_PATTERNS: SilkPattern[] = ['solid', 'sash', 'stripes', 'quartered', 'diamond']

// Deterministic silk permutation for a given race. Without this every
// field would show post 1 in red, post 2 in blue, etc. — the same
// visual signature race after race. Fisher-Yates seeded off the race
// id keeps colors varied between races but reproducible per seed.
function seedFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
function shuffledSilks(raceId: string): string[] {
  let state = seedFromString(raceId) || 1
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
  const out = [...SILK_COLORS]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = out[i]!; out[i] = out[j]!; out[j] = tmp
  }
  return out
}

function silksFor(raceId: string, idx: number): {
  primary: string; secondary: string; pattern: SilkPattern
} {
  const colors = shuffledSilks(raceId)
  const primary = colors[idx % colors.length]!
  // Offset secondary so it rarely matches primary; bump if collision.
  let secondary = colors[(idx + 5) % colors.length]!
  if (secondary === primary) secondary = colors[(idx + 7) % colors.length]!
  const seed = seedFromString(raceId + ':' + idx)
  const pattern = SILK_PATTERNS[seed % SILK_PATTERNS.length]!
  return { primary, secondary, pattern }
}

// ── Track geometry ─────────────────────────────────────────────
// Stadium shape: two vertical straights connected by semicircle turns.
// Built relative to viewport so it always fills portrait naturally.
//
//        ╭───╮
//  back  │   │  home (right straight)
//        │   │  horses run UP here (t=0 bottom, ~0.35 top)
//        ╰───╯
//         gate at bottom-right

interface TrackGeo {
  cx: number; cy: number
  rx: number        // turn radius (half the track width)
  ry: number        // half the straight length
  tw: number        // track lane band width
}

function buildGeo(w: number, h: number): TrackGeo {
  // Size the oval to fill the portrait viewport.
  // Leave room for padding and ensure the turns aren't too tight.
  const padX = w * 0.08
  const padY = h * 0.06
  const availW = w - padX * 2
  const availH = h - padY * 2

  // The full width of the oval = 2 * rx + tw (inner gap) but for stadium:
  // total width = 2 * (rx + tw/2)  → rx = availW/2 - tw/2
  // total height = 2 * ry + 2 * rx  → ry = (availH - 2*rx) / 2
  const tw = Math.max(30, Math.min(60, w * 0.14))
  const rx = Math.max(30, (availW - tw) / 2 * 0.45)
  const ry = Math.max(60, (availH - 2 * rx) / 2)

  return { cx: w / 2, cy: h / 2, rx, ry, tw }
}

function trackPoint(t: number, geo: TrackGeo, laneOff: number): { x: number; y: number; angle: number } {
  const straight = 2 * geo.ry
  const turn = Math.PI * geo.rx
  const total = 2 * straight + 2 * turn
  const s1 = straight / total  // right straight fraction
  const s2 = turn / total      // top turn fraction
  const s3 = s1                // left straight fraction

  const r = geo.rx + laneOff
  let x: number, y: number, angle: number

  if (t < s1) {
    // Right straight — bottom to top
    const f = t / s1
    x = geo.cx + geo.rx + laneOff
    y = geo.cy + geo.ry - f * straight
    angle = -Math.PI / 2
  } else if (t < s1 + s2) {
    // Top turn — right to left semicircle
    const f = (t - s1) / s2
    x = geo.cx + r * Math.cos(-f * Math.PI)
    y = (geo.cy - geo.ry) - r * Math.sin(f * Math.PI)
    angle = -Math.PI / 2 - f * Math.PI
  } else if (t < s1 + s2 + s3) {
    // Left straight — top to bottom
    const f = (t - s1 - s2) / s3
    x = geo.cx - geo.rx - laneOff
    y = geo.cy - geo.ry + f * straight
    angle = Math.PI / 2
  } else {
    // Bottom turn — left to right semicircle
    const f = (t - s1 - s2 - s3) / (1 - s1 - s2 - s3)
    x = geo.cx - r * Math.cos(f * Math.PI)
    y = (geo.cy + geo.ry) + r * Math.sin(f * Math.PI)
    angle = Math.PI / 2 - f * Math.PI
  }

  return { x, y, angle }
}

// ── Horse state ────────────────────────────────────────────────

interface HorseState {
  id: string; name: string; pp: number
  targetT: number; currentT: number; lane: number
  isPlayer: boolean
  silkPrimary: string; silkSecondary: string; silkPattern: SilkPattern
  style: string; gallop: number
}

// ── Drawing: track ─────────────────────────────────────────────

function stadiumPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.moveTo(cx + rx, cy - ry)
  ctx.arc(cx, cy - ry, rx, 0, -Math.PI, true)
  ctx.lineTo(cx - rx, cy + ry)
  ctx.arc(cx, cy + ry, rx, Math.PI, 0, true)
  ctx.lineTo(cx + rx, cy - ry)
}

function stadiumPathRev(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.moveTo(cx + rx, cy - ry)
  ctx.lineTo(cx + rx, cy + ry)
  ctx.arc(cx, cy + ry, rx, 0, Math.PI, false)
  ctx.lineTo(cx - rx, cy - ry)
  ctx.arc(cx, cy - ry, rx, Math.PI, 0, false)
}

function drawTrack(ctx: CanvasRenderingContext2D, geo: TrackGeo, surface: string) {
  const { cx, cy, rx, ry, tw } = geo

  // Track band (even-odd fill)
  ctx.beginPath()
  stadiumPath(ctx, cx, cy, rx + tw / 2, ry + tw / 2)
  stadiumPathRev(ctx, cx, cy, rx - tw / 2, ry - tw / 2)
  ctx.closePath()
  ctx.fillStyle = surface === 'T' ? '#3d6b4a' : '#b08968'
  ctx.fill('evenodd')

  // Rails
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.beginPath(); stadiumPath(ctx, cx, cy, rx + tw / 2, ry + tw / 2); ctx.stroke()
  ctx.beginPath(); stadiumPath(ctx, cx, cy, rx - tw / 2, ry - tw / 2); ctx.stroke()

  // Infield
  ctx.beginPath()
  stadiumPath(ctx, cx, cy, rx - tw / 2 - 2, ry - tw / 2 - 2)
  ctx.closePath()
  ctx.fillStyle = surface === 'T' ? '#2d5a3a' : '#6b8f71'
  ctx.fill()

  // Finish line (near top of right straight, t ≈ 0.995)
  const fi = trackPoint(0.995, geo, -tw / 2 + 2)
  const fo = trackPoint(0.995, geo, tw / 2 - 2)
  ctx.save()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2.5
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(fi.x, fi.y); ctx.lineTo(fo.x, fo.y)
  ctx.stroke()
  ctx.setLineDash([])
  // Checkerboard squares along finish
  const dx = fo.x - fi.x, dy = fo.y - fi.y
  const len = Math.sqrt(dx * dx + dy * dy)
  const nx = dx / len, ny = dy / len
  const sq = 4
  for (let i = 0; i < len; i += sq * 2) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(fi.x + nx * i - sq / 2, fi.y + ny * i - sq / 2, sq, sq)
  }
  ctx.restore()
}

// ── Drawing: horse ─────────────────────────────────────────────

function drawHorse(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, angle: number,
  silkPrimary: string, silkSecondary: string, pattern: SilkPattern,
  isPlayer: boolean,
  gallop: number, pp: number, moving: boolean, s: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  // Body bob and head nod are driven separately so the head leads the
  // body slightly (real horses bob their heads down on the foreleg landing).
  const bob = moving ? Math.sin(gallop) * 1.8 * s : 0
  const headNod = moving ? Math.sin(gallop + Math.PI * 0.25) * 1.1 * s : 0

  // Body
  ctx.fillStyle = '#5c3d2e'
  ctx.beginPath(); ctx.ellipse(0, bob, 8 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill()
  // Neck + head (with extra nod on top of body bob)
  ctx.beginPath(); ctx.ellipse(8 * s, -2 * s + bob + headNod * 0.4, 4 * s, 2.5 * s, -0.5, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(12 * s, -3.5 * s + bob + headNod, 3 * s, 2 * s, -0.3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(13 * s, -5.5 * s + bob + headNod, 1 * s, 1.5 * s, -0.2, 0, Math.PI * 2); ctx.fill()

  // Legs
  ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 1.5 * s
  const lb = 3.5 * s
  if (moving) {
    leg(ctx, 5 * s, lb + bob, Math.sin(gallop) * 5, s)
    leg(ctx, 3 * s, lb + bob, Math.sin(gallop + Math.PI) * 5, s)
    leg(ctx, -4 * s, lb + bob, Math.sin(gallop + Math.PI * 0.5) * 5, s)
    leg(ctx, -6 * s, lb + bob, Math.sin(gallop + Math.PI * 1.5) * 5, s)
  } else {
    leg(ctx, 5 * s, lb, 0, s); leg(ctx, 3 * s, lb, 0, s)
    leg(ctx, -4 * s, lb, 0, s); leg(ctx, -6 * s, lb, 0, s)
  }

  // Tail
  ctx.strokeStyle = '#3a2518'; ctx.lineWidth = 1.5 * s
  const ts = moving ? Math.sin(gallop * 0.7) * 4 * s : 0
  ctx.beginPath(); ctx.moveTo(-8 * s, bob)
  ctx.quadraticCurveTo(-12 * s, -3 * s + ts + bob, -13 * s, 1 * s + ts + bob); ctx.stroke()

  // Saddle cloth — track-standard PP color sits on the rump, behind the
  // jockey. This is the piece a railside fan reads to identify a horse.
  const pc = ppColor(pp)
  ctx.save()
  ctx.fillStyle = pc.bg
  ctx.beginPath(); ctx.ellipse(-2 * s, -2 * s + bob, 3.6 * s, 2.4 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = pc.fg
  ctx.font = `bold ${Math.max(6, 7 * s)}px monospace`
  ctx.textAlign = 'center'
  ctx.fillText(String(pp), -2 * s, -0.5 * s + bob)
  ctx.restore()

  // Jockey silks with pattern. Crouch sinusoid translates the upper body
  // forward/back per stride to read as the rider's pumping motion.
  const crouch = moving ? Math.sin(gallop + Math.PI * 0.5) * 0.6 * s : 0
  drawSilksTopDown(ctx, 1 * s + crouch, -3 * s + bob, 3.5 * s, 2.5 * s, silkPrimary, silkSecondary, pattern)
  // Jockey head + helmet
  ctx.fillStyle = '#f5deb3'
  ctx.beginPath(); ctx.arc(3 * s + crouch, -5.5 * s + bob, 2 * s, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = silkPrimary
  ctx.beginPath(); ctx.arc(3 * s + crouch, -6 * s + bob, 2 * s, Math.PI, 0); ctx.fill()

  // Player ring
  if (isPlayer) {
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2 * s
    ctx.beginPath(); ctx.ellipse(0, bob, 14 * s, 10 * s, 0, 0, Math.PI * 2); ctx.stroke()
  }

  ctx.restore()
}

// Draw an elliptical jockey-silks region with one of five patterns.
// Fully clipped to the ellipse so the secondary color never bleeds out.
function drawSilksTopDown(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  primary: string, secondary: string, pattern: SilkPattern,
) {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = primary
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2)
  ctx.fillStyle = secondary
  switch (pattern) {
    case 'solid':
      break
    case 'sash':
      ctx.beginPath()
      ctx.moveTo(cx - rx, cy + ry * 0.2)
      ctx.lineTo(cx - rx, cy + ry * 0.6)
      ctx.lineTo(cx + rx, cy - ry * 0.6)
      ctx.lineTo(cx + rx, cy - ry * 0.2)
      ctx.closePath(); ctx.fill()
      break
    case 'stripes':
      for (let i = -2; i <= 2; i += 2) {
        ctx.fillRect(cx - rx, cy + i * ry * 0.3, rx * 2, ry * 0.3)
      }
      break
    case 'quartered':
      ctx.fillRect(cx - rx, cy - ry, rx, ry)
      ctx.fillRect(cx, cy, rx, ry)
      break
    case 'diamond':
      ctx.beginPath()
      ctx.moveTo(cx, cy - ry * 0.7)
      ctx.lineTo(cx + rx * 0.7, cy)
      ctx.lineTo(cx, cy + ry * 0.7)
      ctx.lineTo(cx - rx * 0.7, cy)
      ctx.closePath(); ctx.fill()
      break
  }
  ctx.restore()
}

function leg(ctx: CanvasRenderingContext2D, lx: number, ly: number, sw: number, s: number) {
  ctx.save(); ctx.translate(lx, ly); ctx.rotate((sw * Math.PI) / 180)
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 6 * s); ctx.lineTo(1 * s, 6.5 * s); ctx.stroke()
  ctx.restore()
}

// ── Camera system ──────────────────────────────────────────────
// The track is built in viewport coordinates (buildGeo uses w, h).
// Cameras apply translate + scale to zoom into sections.
// For portrait: zoomed views frame a VERTICAL slice of the straight.

interface Cam { tx: number; ty: number; s: number }

function camStart(w: number, h: number, geo: TrackGeo, horses: HorseState[], phase: RacePhase, t: number): Cam {
  // Frame: vertical slice of the right straight, bottom half.
  // Horses run upward. Camera tracks the pack vertically.
  // The right straight x-center = cx + rx.  We want that centered horizontally.

  const avgT = horses.length > 0
    ? horses.reduce((a, b) => a + b.currentT, 0) / horses.length
    : 0
  // Focus point on the track
  const focusT = Math.min(avgT + 0.02, 0.28)
  const focusPt = trackPoint(focusT, geo, 0)

  // Zoom: scale so the track width band (~tw + padding) fills most of the screen width
  const zoom = phase === 'gate'
    ? w / (geo.tw * 2.5)
    : w / (geo.tw * 3.0) - t * 0.15

  return {
    tx: w / 2 - focusPt.x * zoom,
    ty: h / 2 - focusPt.y * zoom,
    s: zoom,
  }
}

function camWide(w: number, h: number, geo: TrackGeo): Cam {
  // Fit the entire oval into the viewport with padding.
  // Oval bounding box: width = 2*(rx + tw/2), height = 2*(ry + rx + tw/2)
  const bw = 2 * (geo.rx + geo.tw / 2) + 10
  const bh = 2 * (geo.ry + geo.rx + geo.tw / 2) + 10
  const s = Math.min(w / bw, h / bh)

  return {
    tx: w / 2 - geo.cx * s,
    ty: h / 2 - geo.cy * s,
    s,
  }
}

function camPack(w: number, h: number, geo: TrackGeo, horses: HorseState[]): Cam {
  // Track the field centroid at 2.5× wide zoom so overhead sprites read large.
  const avgT = horses.length > 0
    ? horses.reduce((a, b) => a + b.currentT, 0) / horses.length
    : 0
  const focusPt = trackPoint(avgT % 1, geo, 0)
  const bw = 2 * (geo.rx + geo.tw / 2) + 10
  const bh = 2 * (geo.ry + geo.rx + geo.tw / 2) + 10
  const s = Math.min(w / bw, h / bh) * 2.5
  return {
    tx: w / 2 - focusPt.x * s,
    ty: h / 2 - focusPt.y * s,
    s,
  }
}

function lerpCam(a: Cam, b: Cam, t: number): Cam {
  const e = easeInOutCubic(Math.max(0, Math.min(1, t)))
  return { tx: a.tx + (b.tx - a.tx) * e, ty: a.ty + (b.ty - a.ty) * e, s: a.s + (b.s - a.s) * e }
}

// ── PP chips ───────────────────────────────────────────────────
// Above each horse on top-down views: a small post-position-color
// rounded square with the PP number. Replaces name plates so the
// field reads like a real broadcast (you watch numbers, not names).

function drawCloths(ctx: CanvasRenderingContext2D, horses: HorseState[], geo: TrackGeo, laneW: number, invScale: number) {
  const fs = Math.max(8, Math.round(9 * invScale))
  ctx.save()
  ctx.font = `bold ${fs}px monospace`
  ctx.textAlign = 'center'

  for (const horse of horses) {
    const lo = -geo.tw / 2 + (horse.lane + 1) * laneW
    const pt = trackPoint(horse.currentT % 1, geo, lo)
    const pc = ppColor(horse.pp)
    const sz = fs + 6
    // Sprite is 28*hScale world units. Offset by the full sprite length
    // (2× half-length) so the chip leads clearly past the nose.
    const hScale = Math.max(0.5, Math.min(1.4, invScale / 0.7))
    const ahead = 28 * hScale
    const lx = pt.x + Math.cos(pt.angle) * ahead
    const ly = pt.y + Math.sin(pt.angle) * ahead

    // Chip
    ctx.fillStyle = pc.bg
    ctx.beginPath(); ctx.roundRect(lx - sz / 2, ly - sz / 2, sz, sz, 2); ctx.fill()
    if (horse.isPlayer) {
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = Math.max(1, 1.5 * invScale)
      ctx.beginPath(); ctx.roundRect(lx - sz / 2, ly - sz / 2, sz, sz, 2); ctx.stroke()
    }
    ctx.fillStyle = pc.fg
    ctx.fillText(String(horse.pp), lx, ly + fs / 2 - 1)
  }
  ctx.restore()
}

// ── Backdrop (screen space, drawn before camera transform) ─────
// Dusk sky gradient + deterministic star field + grandstand
// silhouette for wide/rail modes. Screen-space so it doesn't zoom
// with the track — gives a parallax-ish sense of depth.

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, mode: CameraMode, now = 0) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#0d1a33')
  sky.addColorStop(0.5, '#2a3a5e')
  sky.addColorStop(0.72, '#c4704a')
  sky.addColorStop(0.82, '#6a3a24')
  sky.addColorStop(0.86, '#1c1917')
  sky.addColorStop(1, '#0f0d0b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // Deterministic star field (offsets keep them fixed during play)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  for (let i = 0; i < 50; i++) {
    const sx = ((i * 73) % Math.max(1, Math.floor(w)))
    const sy = ((i * 131) % Math.max(1, Math.floor(h * 0.4)))
    const sz = (i % 3) * 0.3 + 0.5
    ctx.fillRect(sx, sy, sz, sz)
  }

  if (mode === 'rail' && grandstandImg) {
    // Draw grandstand image covering sky + grandstand zone (above track band).
    // Slow horizontal parallax: image is wider than viewport, scroll at 30% of race time.
    const destH = h * 0.82
    const imgAspect = grandstandImg.naturalWidth / grandstandImg.naturalHeight
    const imgDrawW = Math.max(w, destH * imgAspect)
    const maxScroll = imgDrawW - w
    const scrollX = (now * 0.012) % (maxScroll + 1)
    ctx.drawImage(grandstandImg, -scrollX, 0, imgDrawW, destH)
  } else if (mode === 'wide' || mode === 'rail') {
    drawGrandstand(ctx, w, h)
  }
}

function drawGrandstand(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const horizon = h * 0.72
  const roofY = h * 0.62

  // Roof peaks silhouette
  ctx.fillStyle = 'rgba(15,12,10,0.88)'
  ctx.beginPath()
  ctx.moveTo(0, horizon)
  const peaks = 6
  const segW = w / peaks
  for (let i = 0; i < peaks; i++) {
    const x0 = i * segW
    const x1 = x0 + segW
    const mid = (x0 + x1) / 2
    ctx.lineTo(x0, horizon)
    ctx.lineTo(mid - segW * 0.18, roofY + 4)
    ctx.lineTo(mid + segW * 0.18, roofY + 4)
    ctx.lineTo(x1, horizon)
  }
  ctx.lineTo(w, h * 0.80)
  ctx.lineTo(0, h * 0.80)
  ctx.closePath()
  ctx.fill()

  // Crowd band (dark with speckled highlights)
  const crowdTop = horizon
  const crowdBot = h * 0.80
  ctx.fillStyle = 'rgba(160,130,100,0.45)'
  for (let i = 0; i < 180; i++) {
    const nx = (i * 149) % Math.max(1, Math.floor(w))
    const ny = crowdTop + ((i * 83) % Math.max(1, Math.floor(crowdBot - crowdTop)))
    ctx.fillRect(nx, ny, 1, 1)
  }
}

// Fraction of the rail-cam phase at which the leader's nose hits the
// finish wire. Lifted to module scope so the camera shake at the wire
// crossing can be triggered from outside drawSideView.
const WIRE_HIT_AT = 0.55
// Duration of the wire-crossing freeze. Pauses the entire race when
// the leader hits the wire so the player can read the result, then the
// rail-cam resumes and trailing horses cross in order. Used for both
// photo finishes (with PHOTO overlay) and decisive finishes (with the
// OFFICIAL winner flourish).
const FREEZE_MS = 3500

// Hard ceiling on the rail-cam's lengths-behind. With the engine's
// PERF_PER_LENGTH=2.5 scaling, ~95% of CLM finishes have leader-to-last
// spreads under 23 lengths; 20 catches the vast majority at honest
// proportions and only blowouts get visually clipped at the back of
// the field (their finish-position placard still tells the truth).
const RAILCAM_MAX_LB = 20

// Length math now lives in @/engine/race (perfGapToLengths). Both the
// summary's margin labels and the rail-cam's pixel positions consult
// the same conversion, so a horse rendered N lengths behind reads as
// the cumulative-margin label sum the result card shows above it.

// Wall-clock target per visible length the leader covers post-freeze.
// Drives the dynamic post-wire window so the back of the field files
// through at broadcast pace and the camera always waits until the last
// horse has crossed the wire (plus a short tail) before transitioning.
const POST_WIRE_MS_PER_LENGTH = 400
// Floor and ceiling so a tight 1-length finish still feels deliberate
// and a wide spread doesn't feel interminable.
const POST_WIRE_MIN_MS = 1500
const POST_WIRE_MAX_MS = 5000

// Winner-spotlight flourish drawn over a non-photo (decisive) finish.
// Quieter than the photo overlay — a golden ring expanding from the
// wire and an "OFFICIAL — #N" chyron stamp upper-center. Fades out
// over its lifetime so the rest of the rail-cam plays through.
function drawWinnerFlourish(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  ageMs: number, durationMs: number,
  winnerPP: number,
  wireX: number,
) {
  const t = Math.max(0, Math.min(1, ageMs / durationMs))
  // Hold full opacity until 75% of duration, then fast fade out.
  const fade = t < 0.75 ? 1.0 : 1.0 - (t - 0.75) / 0.25

  // Expanding golden ring centered on the wire mid-track.
  ctx.save()
  const ringR = 30 + t * Math.max(w, h) * 0.45
  const ringAlpha = 0.7 * fade
  ctx.strokeStyle = `rgba(251,191,36,${ringAlpha})`
  ctx.lineWidth = 4 * fade + 1
  ctx.beginPath()
  ctx.arc(wireX, h * 0.85, ringR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // Inner soft glow pulse
  ctx.save()
  const glow = ctx.createRadialGradient(wireX, h * 0.85, 0, wireX, h * 0.85, h * 0.5 * (0.4 + t * 0.6))
  glow.addColorStop(0, `rgba(251,191,36,${0.35 * fade})`)
  glow.addColorStop(1, 'rgba(251,191,36,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
  ctx.restore()

  // OFFICIAL — #N stamp upper center. Scaled to the canvas so the
  // winner moment reads from across the room on mobile and feels as
  // weighty as the PHOTO stamp on a photo finish. Drop-shadow stack
  // sells the broadcast lower-third look.
  const pc = ppColor(winnerPP)
  const titleSize = Math.max(36, Math.min(72, w * 0.11))
  const chipW = Math.max(72, Math.min(140, w * 0.22))
  const chipH = chipW * 0.78
  const ppSize = chipH * 0.78
  const tagSize = Math.max(13, titleSize * 0.32)
  const blockH = titleSize + chipH + tagSize + titleSize * 0.45 + tagSize + 8
  const pillW = Math.max(chipW + 40, w * 0.38)
  ctx.save()
  ctx.globalAlpha = fade
  ctx.translate(w / 2, h * 0.22)
  ctx.textAlign = 'center'
  // Dark pill behind the whole block so it reads over any background.
  ctx.fillStyle = 'rgba(0,0,0,0.72)'
  ctx.beginPath(); ctx.roundRect(-pillW / 2, -titleSize - 10, pillW, blockH + 20, 14); ctx.fill()
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 3
  ctx.fillStyle = '#fbbf24'
  ctx.font = `900 ${titleSize}px sans-serif`
  ctx.fillText('OFFICIAL', 0, 0)
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  // Cloth chip — full saddle-cloth color block with the winning PP.
  const chipY = titleSize * 0.45
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 2
  ctx.fillStyle = pc.bg
  ctx.beginPath(); ctx.roundRect(-chipW / 2, chipY, chipW, chipH, 8); ctx.fill()
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.fillStyle = pc.fg
  ctx.font = `900 ${ppSize}px monospace`
  ctx.textBaseline = 'middle'
  ctx.fillText(String(winnerPP), 0, chipY + chipH / 2)
  ctx.textBaseline = 'alphabetic'
  // "WINNER" tag under the cloth chip
  ctx.font = `bold ${tagSize}px sans-serif`
  ctx.fillStyle = '#fbbf24'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = 10
  ctx.fillText('WINNER', 0, chipY + chipH + tagSize + 2)
  ctx.restore()
}

// Film-grain + "PHOTO" stamp drawn on top of the frozen rail-cam
// during a photo finish. now is used to tick the grain noise so the
// overlay shimmers like real broadcast film grain.
function drawPhotoFinishOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
  ctx.save()
  // Grain noise
  ctx.globalAlpha = 0.18
  for (let i = 0; i < 220; i++) {
    const seed = (i * 9301 + Math.floor(now / 33)) | 0
    const gx = (Math.abs(seed * 31) % Math.floor(w))
    const gy = (Math.abs(seed * 71) % Math.floor(h))
    ctx.fillStyle = i % 2 === 0 ? '#fff' : '#000'
    ctx.fillRect(gx, gy, 1, 1)
  }
  ctx.globalAlpha = 1

  // Vignette darken
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.7)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)

  // PHOTO stamp — angled, glowing
  ctx.save()
  ctx.translate(w / 2, h * 0.18)
  ctx.rotate(-0.06)
  ctx.shadowColor = 'rgba(220,38,38,0.8)'
  ctx.shadowBlur = 16
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#dc2626'
  ctx.lineWidth = 2
  ctx.font = 'bold 38px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('PHOTO', 0, 0)
  ctx.shadowBlur = 0
  ctx.strokeText('PHOTO', 0, 0)
  ctx.font = 'bold 11px sans-serif'
  ctx.fillStyle = '#fbbf24'
  ctx.fillText('FINISH', 0, 16)
  ctx.restore()

  // Top + bottom black bars (broadcast-letterbox vibe)
  ctx.fillStyle = 'rgba(0,0,0,0.85)'
  ctx.fillRect(0, 0, w, h * 0.05)
  ctx.fillRect(0, h * 0.95, w, h * 0.05)
  ctx.restore()
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// Format race time as M:SS.t (typical race-call chyron format: "1:11.3").
function formatRaceTime(seconds: number): string {
  if (seconds <= 0) return '0:00.0'
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

// Pick the running call line for a given phase. Uses PP numbers, not
// names — fans at the rail track the field by saddle cloth, not ID.
function phaseCall(phase: RacePhase, leaderPP: number, secondPP: number, lengths: number): string {
  const gap = lengths < 0.3 ? 'a head' : lengths < 0.7 ? 'a neck' : lengths < 1.5 ? 'a length' : `${lengths.toFixed(1)} lengths`
  switch (phase) {
    case 'tote':    return 'Loading the gate…'
    case 'gate':    return "And they're off!"
    case 'early':   return leaderPP ? `#${leaderPP} clears to the lead — ${gap} on #${secondPP}` : 'Off and running'
    case 'mid':     return leaderPP ? `Down the back — #${leaderPP} sets the pace` : 'Down the back stretch'
    case 'stretch': return leaderPP ? `Top of the stretch! #${leaderPP} still in front by ${gap}` : 'Into the stretch'
    case 'finish':  return leaderPP ? `It's #${leaderPP} at the wire!` : 'They hit the wire!'
  }
}

// ── Rail-cam side view ─────────────────────────────────────────
// Cinematic broadcast-style view for the finish phase. Horses drawn
// in profile, mapped left-to-right by gap to the leader. Screen-space
// only — no camera transform applies here.

function drawSideView(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  horses: HorseState[],
  surface: string,
  now: number,
  result: RaceResult | null,
  phaseT: number,
  scrollNow: number,
) {
  ensureGrandstandLoaded()
  drawBackdrop(ctx, w, h, 'rail', scrollNow)

  // Bigger track band — gives more foreground for cinematic effect.
  const trackTop = h * 0.78
  const trackBot = h * 0.99
  const trackH = trackBot - trackTop

  // Base track surface with vertical gradient: darker at the far rail,
  // lighter (sunlit) at the near rail. Reads as depth.
  const grad = ctx.createLinearGradient(0, trackTop, 0, trackBot)
  if (surface === 'T') {
    grad.addColorStop(0, '#2a5536'); grad.addColorStop(1, '#4d7e59')
  } else if (surface === 'S') {
    grad.addColorStop(0, '#363636'); grad.addColorStop(1, '#5a5a5a')
  } else {
    grad.addColorStop(0, '#886546'); grad.addColorStop(1, '#c0946e')
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, trackTop, w, trackH)

  // Track shadow under far rail — inky strip suggests the crowd wall behind.
  const railShadow = ctx.createLinearGradient(0, trackTop, 0, trackTop + 14)
  railShadow.addColorStop(0, 'rgba(0,0,0,0.45)')
  railShadow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = railShadow
  ctx.fillRect(0, trackTop, w, 14)

  // Scrolling backdrop — phase progress drives stripes/posts so the
  // world rushes past in time with the leader's pre-computed L→R sweep.
  const stripePeriod = 64
  const scroll = ((phaseT * w * 2.4) % stripePeriod + stripePeriod) % stripePeriod
  ctx.fillStyle = 'rgba(0,0,0,0.09)'
  for (let i = -1; i * stripePeriod < w + stripePeriod; i++) {
    const sx = i * stripePeriod - scroll
    ctx.fillRect(sx, trackTop + 8, stripePeriod * 0.45, trackH - 10)
  }

  // Rails
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillRect(0, trackTop - 0.5, w, 1.5)           // far rail (inside)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillRect(0, trackBot - 2, w, 2)                // near rail (outside)

  // Near-rail posts scroll by at double speed — parallax sense of rush.
  const postPeriod = 110
  const postScroll = ((phaseT * w * 4.8) % postPeriod + postPeriod) % postPeriod
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  for (let i = -1; i * postPeriod < w + postPeriod; i++) {
    const sx = i * postPeriod - postScroll
    ctx.fillRect(sx, trackBot - 11, 2, 10)
  }

  // ── Finish wire rig ──────────────────────────────────────────
  const wireX = w * 0.78

  // Checkered ground strip at the wire
  for (let i = 0; i < trackH; i += 6) {
    ctx.fillStyle = Math.floor(i / 6) % 2 === 0 ? '#fff' : '#111'
    ctx.fillRect(wireX - 4, trackTop + i, 8, 6)
  }

  // Left support pole (near-side, tall)
  ctx.fillStyle = '#1a1512'
  ctx.fillRect(wireX - 3, h * 0.30, 4, trackBot - h * 0.30)
  // Pole cap
  ctx.fillStyle = '#dc2626'
  ctx.fillRect(wireX - 5, h * 0.30, 8, 4)

  // Overhead wire across the track
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(wireX - 60, h * 0.33)
  ctx.lineTo(wireX + 30, h * 0.33)
  ctx.stroke()

  // Checkered pennant hanging from wire — gently sways
  const sway = Math.sin(now / 400) * 2
  const penX = wireX - 28 + sway
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#fff' : '#111'
      ctx.fillRect(penX + col * 7, h * 0.33 + row * 6, 7, 6)
    }
  }

  // "FINISH" nameplate above the wire — glowing amber
  ctx.save()
  ctx.shadowColor = 'rgba(251,191,36,0.9)'
  ctx.shadowBlur = 10
  ctx.fillStyle = '#fde68a'
  ctx.font = 'bold 11px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('FINISH', wireX - 15, h * 0.28)
  ctx.restore()

  // Spotlight cone washing down from the wire onto the track
  const spot = ctx.createRadialGradient(wireX, h * 0.33, 5, wireX, trackBot, h * 0.25)
  spot.addColorStop(0, 'rgba(255,240,200,0.22)')
  spot.addColorStop(1, 'rgba(255,240,200,0)')
  ctx.fillStyle = spot
  ctx.fillRect(wireX - h * 0.18, h * 0.33, h * 0.36, trackBot - h * 0.33)

  // ── Horses ───────────────────────────────────────────────────
  // Photo-finish layout. The engine has already decided the order —
  // each horse's lengths-behind-leader come from its performance gap
  // (≈ 1 perf point per length). The leader scrolls from off-screen
  // left, hits the wire mid-phase, and exits right; trailers ride
  // pxPerLength behind so their wire-crossing order matches the
  // official result.
  const lanes = horses.length
  const laneSpan = trackH - 22
  const laneStep = laneSpan / Math.max(1, lanes - 1)
  // Push-in: scale ramps up gently as phaseT crosses 0.4 (well before
  // wire) so by the time leaders hit the line the field reads tighter
  // and bigger — broadcast operators do this to amplify drama.
  const pushIn = phaseT < 0.4 ? 1 : 1 + Math.min(0.18, (phaseT - 0.4) * 0.6)
  const baseScale = Math.min(2.8, Math.max(1.6, w / 320)) * pushIn
  type RailHorse = HorseState & { lengthsBehind: number; finishPos: number }
  let railHorses: RailHorse[]
  if (result && result.finishOrder.length > 0) {
    const leaderPerf = result.finishOrder[0]!.performance
    railHorses = horses.map(ho => {
      const fp = result.finishOrder.find(f => f.horseId === ho.id)
      // Same conversion the summary's margin labels use, so the on-screen
      // distance behind the leader matches the labels the result card
      // shows above each horse.
      const raw = fp ? perfGapToLengths(leaderPerf - fp.performance) : 0
      return { ...ho, lengthsBehind: Math.min(RAILCAM_MAX_LB, raw), finishPos: fp?.position ?? 99 }
    })
  } else {
    const leaderT = Math.max(...horses.map(h => h.currentT), 0)
    railHorses = horses.map(ho => ({
      ...ho,
      lengthsBehind: Math.min(RAILCAM_MAX_LB, (leaderT - ho.currentT) * 60),
      finishPos: 0,
    }))
  }

  // Per-length pixel spacing. Sized to the actual field spread, not the
  // worst-case cap, so a typical 4–6 length finish renders with full
  // breathing room (~50–60 px/length) and only blowouts shrink to fit.
  // Lower bound keeps a 1L gap visually larger than a head/neck so the
  // summary's margin labels read truthfully on the rail-cam.
  const maxLB = Math.max(0, ...railHorses.map(r => r.lengthsBehind))
  // Available rail before the wire (we want the back of the field to sit
  // near the left edge when the leader is hitting the wire).
  const railSpan = wireX - 30
  const idealPxPerLength = railSpan / Math.max(1, maxLB + 1)
  const pxPerLengthMin = Math.max(36, w * 0.07) * (baseScale / 1.6)
  const pxPerLengthMax = Math.max(64, w * 0.12) * (baseScale / 1.6)
  const pxPerLength = Math.min(pxPerLengthMax, Math.max(pxPerLengthMin, idealPxPerLength))

  // Leader X timeline. Leader's nose hits the wire at WIRE_HIT_AT.
  // Leader continues past the wire until phaseT=1 so trailers also
  // cross before the rail-cam unmounts.
  const leaderStartX = -baseScale * 50
  const leaderEndX = wireX + (maxLB + 2) * pxPerLength
  const v = (wireX - leaderStartX) / WIRE_HIT_AT
  // After the wire-hit, ease the velocity slightly so the trailing
  // horses don't blur past too quickly. Linear is fine for cinema.
  const leaderX = phaseT <= WIRE_HIT_AT
    ? leaderStartX + v * phaseT
    : wireX + (leaderEndX - wireX) * ((phaseT - WIRE_HIT_AT) / (1 - WIRE_HIT_AT))

  // Draw outermost lanes first so the rail (lane 0) overlaps on top —
  // matches a broadcast camera looking across the field from the rail.
  const sorted = [...railHorses].sort((a, b) => b.lane - a.lane)
  for (const ho of sorted) {
    const x = leaderX - ho.lengthsBehind * pxPerLength
    const y = trackBot - 14 - ho.lane * laneStep
    const s = baseScale * (1 - ho.lane * 0.035)

    // Skip horses still well off-screen left to save fillrate.
    if (x < -baseScale * 60) continue

    // Ground shadow — soft, behind horse
    ctx.save()
    ctx.globalAlpha = 0.4
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(x + 1 * s, y + 6 * s, 16 * s, 3 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Speed streaks trailing behind — 3 short lines modulated by gallop.
    ctx.save()
    ctx.strokeStyle = surface === 'T' ? 'rgba(220,240,220,0.6)' : 'rgba(245,230,200,0.6)'
    for (let i = 0; i < 3; i++) {
      const yo = (i - 1) * 3 * s
      const wob = Math.abs(Math.sin(ho.gallop + i * 1.3))
      const len = (16 + wob * 10) * s
      ctx.globalAlpha = 0.32 - i * 0.08
      ctx.lineWidth = (1.4 - i * 0.25) * s
      ctx.beginPath()
      ctx.moveTo(x - 17 * s, y - 1 * s + yo)
      ctx.lineTo(x - 17 * s - len, y - 1 * s + yo)
      ctx.stroke()
    }
    ctx.restore()

    // Sprite path: pixel-art horse + jockey, with the silk + cap chroma
    // zones recolored to this horse's silks. Falls back to the vector
    // drawHorseProfile until images decode (first race might briefly
    // render vector before sprites pop in).
    const tinted = getTintedFrames(ho.silkPrimary, ho.silkSecondary)
    if (tinted) {
      const frame = tinted[strideFrameIndex(ho.gallop, tinted.length)]!
      const drawW = 80 * s
      const drawH = drawW * (frame.height / frame.width)
      // Anchor: horse feet at y, body roughly centered on x. The source
      // sprite has feet near the bottom-mid; tune offsets to match the
      // ground/shadow position drawHorseProfile used.
      const dx = x - drawW * 0.52
      const dy = y - drawH * 0.93
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(frame, dx, dy, drawW, drawH)
      ctx.imageSmoothingEnabled = true

      // Saddle-cloth chip pinned over the saddle area so the PP number
      // remains legible mid-race even though the silk + cap recolor
      // already identifies the horse.
      const pc = ppColor(ho.pp)
      const chipW = 14 * s, chipH = 11 * s
      const cx = dx + drawW + 2 * s, cy = dy + drawH * 0.38
      ctx.fillStyle = pc.bg
      ctx.fillRect(cx, cy, chipW, chipH)
      ctx.fillStyle = pc.fg
      ctx.font = `bold ${Math.max(9, 8 * s)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(ho.pp), cx + chipW / 2, cy + chipH / 2)
      ctx.textBaseline = 'alphabetic'

      // Soft amber halo under the player's horse so they can find it
      // mid-pack — drawHorseProfile had its own marker; preserve that.
      if (ho.isPlayer) {
        ctx.save()
        ctx.globalAlpha = 0.55
        const ring = ctx.createRadialGradient(x, y + 4 * s, 1, x, y + 4 * s, 22 * s)
        ring.addColorStop(0, 'rgba(251,191,36,0.7)')
        ring.addColorStop(1, 'rgba(251,191,36,0)')
        ctx.fillStyle = ring
        ctx.fillRect(x - 24 * s, y - 8 * s, 48 * s, 18 * s)
        ctx.restore()
      }
    } else {
      drawHorseProfile(ctx, x, y, ho.silkPrimary, ho.silkSecondary, ho.silkPattern, ho.isPlayer, ho.gallop, ho.pp, s)
    }

    // Dust puff from rear hooves on dirt/synthetic surfaces. Phase-driven
    // so the puff trails behind the horse as it scrolls past — sells the
    // weight of the pack and keeps the foreground alive.
    if (surface !== 'T') {
      const puffPhase = (ho.gallop + ho.lane * 0.7) % (Math.PI * 2)
      if (Math.sin(puffPhase) > 0.7) {
        ctx.save()
        const puffColor = surface === 'S' ? '180,180,180' : '200,170,135'
        for (let p = 0; p < 3; p++) {
          const px = x - (10 + p * 6) * s
          const py = y + (5 - p * 0.8) * s
          const pr = (2 + p * 0.7) * s
          ctx.globalAlpha = 0.35 - p * 0.08
          ctx.fillStyle = `rgb(${puffColor})`
          ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill()
        }
        ctx.restore()
      }
    }

    // Finish-position placard above each horse once it has crossed
    // (or is at) the wire. Reinforces the official order visually.
    if (ho.finishPos > 0 && x >= wireX - 4 * s) {
      const label = ordinal(ho.finishPos)
      ctx.save()
      ctx.font = `bold ${Math.max(10, 11 * s)}px sans-serif`
      ctx.textAlign = 'center'
      const tw = ctx.measureText(label).width + 8
      const py = y - 22 * s
      ctx.fillStyle = ho.finishPos === 1 ? 'rgba(251,191,36,0.95)' : 'rgba(0,0,0,0.7)'
      ctx.beginPath(); ctx.roundRect(x - tw / 2, py - 8, tw, 14, 3); ctx.fill()
      ctx.fillStyle = ho.finishPos === 1 ? '#1c1917' : '#fff'
      ctx.fillText(label, x, py + 3)
      ctx.restore()
    }
  }

  // Foreground dust haze — subtle warm tint rising from the track near
  // the camera. Sells the weight of the pack thundering past.
  const haze = ctx.createLinearGradient(0, trackBot - 28, 0, trackBot)
  const hazeColor = surface === 'T' ? '160,190,150' : surface === 'S' ? '150,150,150' : '200,170,140'
  haze.addColorStop(0, `rgba(${hazeColor},0)`)
  haze.addColorStop(1, `rgba(${hazeColor},0.22)`)
  ctx.fillStyle = haze
  ctx.fillRect(0, trackBot - 28, w, 28)

  // Subtle vignette top + sides
  const vig = ctx.createRadialGradient(w / 2, h * 0.6, h * 0.4, w / 2, h * 0.6, h * 0.9)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)
}

function drawHorseProfile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  silkPrimary: string, silkSecondary: string, pattern: SilkPattern,
  isPlayer: boolean,
  gallop: number, pp: number, s: number,
) {
  ctx.save()
  ctx.translate(x, y)

  // Body bob: vertical rise/fall of the chest. Head nod runs ahead of
  // body bob so the head pumps down on each stride landing — a cue real
  // horseplayers read instinctively.
  const bob = Math.sin(gallop) * 1.6 * s
  const headNod = Math.sin(gallop + Math.PI * 0.25) * 2.2 * s
  // Jockey crouch: rocks the rider forward on stride extension and back
  // on collection, sells the pumping motion of a real race ride.
  const crouchX = Math.sin(gallop + Math.PI * 0.5) * 1.3 * s
  const crouchY = Math.cos(gallop + Math.PI * 0.5) * 0.6 * s

  // Tail (behind)
  ctx.strokeStyle = '#2a1a10'
  ctx.lineWidth = 2 * s
  const tailSw = Math.sin(gallop * 0.7) * 3 * s
  ctx.beginPath()
  ctx.moveTo(-14 * s, bob - 1 * s)
  ctx.quadraticCurveTo(-22 * s, -2 * s + tailSw + bob, -25 * s, 3 * s + tailSw + bob)
  ctx.stroke()

  // Rear legs
  ctx.strokeStyle = '#3a2518'
  ctx.lineWidth = 2 * s
  profileLeg(ctx, -10 * s, 4 * s + bob, Math.sin(gallop + Math.PI) * 14, s)
  profileLeg(ctx, -7 * s, 4 * s + bob, Math.sin(gallop + Math.PI * 0.5) * 14, s)

  // Body
  ctx.fillStyle = '#5c3d2e'
  ctx.beginPath()
  ctx.ellipse(0, bob, 14 * s, 6 * s, 0, 0, Math.PI * 2)
  ctx.fill()

  // Saddle cloth — PP-color rectangle on the rump, behind the jockey.
  // Reads as the iconic broadcast identifier of the horse.
  const pc = ppColor(pp)
  ctx.save()
  ctx.fillStyle = pc.bg
  ctx.beginPath()
  // Drape the cloth slightly off the rear of the saddle area.
  ctx.roundRect(-7 * s, -2 * s + bob, 9 * s, 4.5 * s, 1)
  ctx.fill()
  ctx.fillStyle = pc.fg
  ctx.font = `bold ${Math.max(7, 8 * s)}px monospace`
  ctx.textAlign = 'center'
  ctx.fillText(String(pp), -2.5 * s, 1.6 * s + bob)
  ctx.restore()

  // Front legs
  profileLeg(ctx, 8 * s, 4 * s + bob, Math.sin(gallop) * 14, s)
  profileLeg(ctx, 11 * s, 4 * s + bob, Math.sin(gallop + Math.PI * 1.5) * 14, s)

  // Neck
  ctx.save()
  ctx.translate(12 * s, -3 * s + bob + headNod * 0.3)
  ctx.rotate(-0.5)
  ctx.fillStyle = '#5c3d2e'
  ctx.beginPath(); ctx.ellipse(0, 0, 7 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Head — pumps with headNod
  ctx.fillStyle = '#5c3d2e'
  ctx.beginPath()
  ctx.ellipse(18 * s, -7 * s + bob + headNod, 4.2 * s, 2.6 * s, -0.4, 0, Math.PI * 2)
  ctx.fill()
  // Ear
  ctx.beginPath()
  ctx.moveTo(17 * s, -9 * s + bob + headNod)
  ctx.lineTo(18 * s, -11 * s + bob + headNod)
  ctx.lineTo(19 * s, -9 * s + bob + headNod)
  ctx.closePath()
  ctx.fill()
  // Eye
  ctx.fillStyle = '#111'
  ctx.beginPath(); ctx.arc(20 * s, -7.2 * s + bob + headNod, 0.8 * s, 0, Math.PI * 2); ctx.fill()

  // Jockey silks with pattern. Crouch translation rocks the upper body.
  drawSilksProfile(ctx, 2 * s + crouchX, -5 * s + bob + crouchY, 4.8 * s, 3.6 * s, silkPrimary, silkSecondary, pattern)
  // Jockey head + helmet
  ctx.fillStyle = '#f5deb3'
  ctx.beginPath(); ctx.arc(5 * s + crouchX, -9 * s + bob + crouchY, 2.3 * s, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = silkPrimary
  ctx.beginPath(); ctx.arc(5 * s + crouchX, -9.5 * s + bob + crouchY, 2.5 * s, Math.PI, 0); ctx.fill()
  // Goggles
  ctx.fillStyle = '#222'
  ctx.fillRect(4.5 * s + crouchX, -8.5 * s + crouchY + bob, 1.8 * s, 0.6 * s)

  // Player ring
  if (isPlayer) {
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 2.5 * s
    ctx.beginPath()
    ctx.ellipse(0, bob, 20 * s, 12 * s, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()
}

function drawSilksProfile(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  primary: string, secondary: string, pattern: SilkPattern,
) {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, -0.25, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = primary
  ctx.fillRect(cx - rx * 1.5, cy - ry * 1.5, rx * 3, ry * 3)
  ctx.fillStyle = secondary
  switch (pattern) {
    case 'solid':
      break
    case 'sash':
      ctx.beginPath()
      ctx.moveTo(cx - rx * 1.5, cy + ry * 0.2)
      ctx.lineTo(cx - rx * 1.5, cy + ry * 0.7)
      ctx.lineTo(cx + rx * 1.5, cy - ry * 0.7)
      ctx.lineTo(cx + rx * 1.5, cy - ry * 0.2)
      ctx.closePath(); ctx.fill()
      break
    case 'stripes':
      for (let i = -2; i <= 2; i += 2) {
        ctx.fillRect(cx - rx * 1.5, cy + i * ry * 0.32, rx * 3, ry * 0.32)
      }
      break
    case 'quartered':
      ctx.fillRect(cx - rx * 1.5, cy - ry * 1.5, rx * 1.5, ry * 1.5)
      ctx.fillRect(cx, cy, rx * 1.5, ry * 1.5)
      break
    case 'diamond':
      ctx.beginPath()
      ctx.moveTo(cx, cy - ry * 0.7)
      ctx.lineTo(cx + rx * 0.7, cy)
      ctx.lineTo(cx, cy + ry * 0.7)
      ctx.lineTo(cx - rx * 0.7, cy)
      ctx.closePath(); ctx.fill()
      break
  }
  ctx.restore()
}

function profileLeg(ctx: CanvasRenderingContext2D, lx: number, ly: number, deg: number, s: number) {
  ctx.save()
  ctx.translate(lx, ly)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.beginPath()
  ctx.moveTo(0, 0); ctx.lineTo(0, 10 * s)
  ctx.stroke()
  ctx.restore()
}

// ── Component ──────────────────────────────────────────────────

export function RaceView({ race, market, playerHorseId, result, onRaceComplete }: RaceViewProps) {
  const [phase, setPhase] = useState<RacePhase>('tote')
  const [announceLines, setAnnounceLines] = useState<string[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const horsesRef = useRef<HorseState[]>([])
  const phaseStartRef = useRef(performance.now())
  const lastFrameRef = useRef(performance.now())
  const prevCamRef = useRef<Cam | null>(null)
  const camTransRef = useRef(1)
  const particlesRef = useRef<Particle[]>([])
  // Photo-finish freeze frame: when result.photoFinish is true and the
  // leader's nose first hits the wire (phaseT crosses WIRE_HIT_AT during
  // finish phase), we freeze rendering for FREEZE_MS, overlay film grain
  // + a "PHOTO" stamp, then push phaseStartRef forward by FREEZE_MS so
  // the rest of the rail-cam plays out smoothly afterward.
  const freezeStartRef = useRef<number | null>(null)
  const freezeAdjustedRef = useRef(false)
  // Dynamic post-wire trail wall-time, computed once at finish-phase
  // start from the actual maxLB so the camera waits exactly long enough
  // for the back of the field to cross the wire, no more, no less.
  const postTrailMsRef = useRef(2000)
  // Race-time stopwatch — set once on gate-break and read by the chyron
  // until results take over. Independent of phaseStartRef which resets
  // each phase.
  const gateStartRef = useRef<number | null>(null)

  // Live chyron state — updates a few times per second from horsesRef.
  // Keeps the chyron broadcast-feeling without re-rendering on every
  // animation frame.
  const [chyron, setChyron] = useState<{ time: number; leader: number; gap: string; call: string }>({
    time: 0, leader: 0, gap: '', call: 'Loading the gate…',
  })

  // Respect prefers-reduced-motion: skip the animated run entirely and
  // advance straight to results after a brief beat. Keeps the game
  // playable for vestibular / motion-sensitive users without rebuilding
  // the canvas pipeline in a static variant.
  const reduceMotion = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!reduceMotion) return
    const t = setTimeout(onRaceComplete, 900)
    return () => clearTimeout(t)
  }, [reduceMotion, onRaceComplete])

  const active = race.entries.filter(e => !e.scratched)

  // Kick off sprite image loads ASAP so they're decoded before the
  // rail-cam phase. If they aren't ready, drawSideView falls back to
  // the vector-drawn horse profile.
  useEffect(() => { ensureSpritesLoaded() }, [])

  // Init
  useEffect(() => {
    horsesRef.current = active.map((e, i) => {
      const sk = silksFor(race.id, i)
      return {
        id: e.horse.id, name: e.horse.name, pp: e.postPosition,
        targetT: 0, currentT: 0, lane: i,
        isPlayer: e.horse.id === playerHorseId,
        silkPrimary: sk.primary,
        silkSecondary: sk.secondary,
        silkPattern: sk.pattern,
        style: e.horse.runningStyle,
        gallop: Math.random() * Math.PI * 2,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Latch race-stopwatch start when the gate breaks.
  useEffect(() => {
    if (phase === 'gate' && gateStartRef.current === null) {
      gateStartRef.current = performance.now()
    }
  }, [phase])

  // Phase transitions. The finish phase gets two wall-clock extensions:
  // FREEZE_MS for the wire-crossing pause, and a dynamic post-wire
  // trail (computed from the actual maxLB) so the camera holds until
  // the back of the field has crossed at broadcast pace.
  useEffect(() => {
    if (phase === 'finish') {
      // Compute the visual maxLB the rail-cam will use and size the
      // post-wire window so the leader covers (maxLB + 2) lengths at
      // POST_WIRE_MS_PER_LENGTH each. Subtract the post-wire portion
      // PHASE_DURATION.finish already provides; the remainder is the
      // extra trail we add on top.
      let maxLB = 0
      if (result && result.finishOrder.length > 0) {
        const leaderPerf = result.finishOrder[0]!.performance
        for (const fp of result.finishOrder) {
          const lb = Math.min(RAILCAM_MAX_LB, perfGapToLengths(leaderPerf - fp.performance))
          if (lb > maxLB) maxLB = lb
        }
      }
      const targetWall = (maxLB + 2) * POST_WIRE_MS_PER_LENGTH
      const basePostWall = (1 - WIRE_HIT_AT) * PHASE_DURATION.finish
      const trail = Math.max(POST_WIRE_MIN_MS, Math.min(POST_WIRE_MAX_MS, targetWall - basePostWall))
      postTrailMsRef.current = trail
      const t = setTimeout(onRaceComplete, PHASE_DURATION.finish + FREEZE_MS + trail)
      return () => clearTimeout(t)
    }
    const i = PHASES.indexOf(phase)
    if (i < PHASES.length - 1) {
      const t = setTimeout(() => {
        const prev = phase, next = PHASES[i + 1]!
        if (cameraForPhase(prev) !== cameraForPhase(next)) camTransRef.current = 0
        setPhase(next)
        phaseStartRef.current = performance.now()
      }, PHASE_DURATION[phase])
      return () => clearTimeout(t)
    }
  }, [phase, onRaceComplete])

  // Announcer
  useEffect(() => {
    const sp = active.filter(e => e.horse.runningStyle === 'E')
    const cl = active.filter(e => e.horse.runningStyle === 'S')
    const fav = active.find(e => e.horse.id === market.favoriteId)
    const sf = race.conditions.surface === 'D' ? 'dirt' : race.conditions.surface === 'T' ? 'turf' : 'synthetic'
    switch (phase) {
      case 'tote': setAnnounceLines([`Race ${race.raceNumber} at ${race.trackCode}. ${active.length} going ${race.conditions.distanceFurlongs}f on the ${sf}.`]); break
      case 'gate': setAnnounceLines(["They're in the gate...", "AND THEY'RE OFF!"]); break
      case 'early': setAnnounceLines([`${(sp[0] ?? active[0])?.horse.name} goes to the lead!`, `${fav?.horse.name ?? 'The favorite'} settling in...`]); break
      case 'mid': setAnnounceLines(['Around the far turn...', `${(cl[0] ?? active[active.length - 1])?.horse.name} picking it up!`]); break
      case 'stretch': setAnnounceLines(["Into the stretch!", "Here they come..."]); break
      case 'finish': setAnnounceLines(["They hit the wire!"]); break
    }
  }, [phase, race, active, market.favoriteId])

  // Chyron tick — re-derives current leader/gap/call a few times per
  // second from horsesRef. Stays decoupled from the canvas frame loop
  // so we don't trigger a React re-render on every paint.
  useEffect(() => {
    const tick = () => {
      const horses = horsesRef.current
      if (horses.length === 0) {
        setChyron(c => ({ ...c, call: phaseCall(phase, 0, 0, 0) }))
        return
      }
      // Sort by visual progress so leader/second reflect what's on screen
      // mid-race; once result is in we use the engine's order for finish.
      const sorted = phase === 'finish' && result
        ? result.finishOrder
            .map(fp => horses.find(h => h.id === fp.horseId))
            .filter((h): h is HorseState => !!h)
        : [...horses].sort((a, b) => b.currentT - a.currentT)
      const leader = sorted[0]
      const second = sorted[1]
      // Lengths gap. During the race we estimate from currentT delta
      // (60 lengths ≈ a full lap chunk); during finish we trust the
      // engine's perf gap.
      let lengths = 0
      if (leader && second) {
        if (phase === 'finish' && result) {
          const lp = result.finishOrder.find(f => f.horseId === leader.id)?.performance ?? 0
          const sp = result.finishOrder.find(f => f.horseId === second.id)?.performance ?? 0
          lengths = Math.max(0, lp - sp)
        } else {
          lengths = Math.max(0, (leader.currentT - second.currentT) * 60)
        }
      }
      const elapsed = gateStartRef.current === null ? 0 : Math.max(0, (performance.now() - gateStartRef.current) / 1000)
      setChyron({
        time: elapsed,
        leader: leader?.pp ?? 0,
        gap: lengths > 0.05 ? `+${lengths.toFixed(1)}L` : '',
        call: phaseCall(phase, leader?.pp ?? 0, second?.pp ?? 0, lengths),
      })
    }
    tick()
    const id = setInterval(tick, 280)
    return () => clearInterval(id)
  }, [phase, result])

  // Canvas resize — use ResizeObserver on the wrapper div so we get
  // actual layout dimensions even on mobile Safari.
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    const c = canvasRef.current
    if (!wrapper || !c) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rw = wrapper.clientWidth
      const rh = wrapper.clientHeight
      if (rw === 0 || rh === 0) return
      c.width = rw * dpr
      c.height = rh * dpr
      c.style.width = rw + 'px'
      c.style.height = rh + 'px'
      const ctx = c.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(wrapper)
    resize()
    return () => ro.disconnect()
  }, [])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return

    const loop = (now: number) => {
      const ctx = canvas.getContext('2d'); if (!ctx) return
      const dt = Math.min((now - lastFrameRef.current) / 1000, 0.1)
      lastFrameRef.current = now

      const r = canvas.getBoundingClientRect()
      const w = r.width, h = r.height

      // Build geometry from current viewport size
      const geo = buildGeo(w, h)

      // Phase timing — LINEAR for position (smooth speed), eased only for camera
      let elapsed = now - phaseStartRef.current
      let rawT = Math.min(elapsed / PHASE_DURATION[phase], 1)

      // Wire-crossing freeze. When the leader hits the wire on any
      // finish — photo or decisive — latch freezeStart and hold rawT at
      // WIRE_HIT_AT for FREEZE_MS so nothing on screen advances. The
      // overlay layer renders PHOTO or OFFICIAL during this window.
      // After the freeze ends we push phaseStartRef forward so the
      // rail-cam resumes from where it paused rather than jumping
      // ahead — trailing horses then cross the wire in order.
      let frozen = false
      if (phase === 'finish' && result) {
        if (freezeStartRef.current === null && rawT >= WIRE_HIT_AT) {
          freezeStartRef.current = now
        }
        if (freezeStartRef.current !== null) {
          const since = now - freezeStartRef.current
          if (since < FREEZE_MS) {
            rawT = WIRE_HIT_AT
            elapsed = WIRE_HIT_AT * PHASE_DURATION[phase]
            frozen = true
          } else if (!freezeAdjustedRef.current) {
            phaseStartRef.current += FREEZE_MS
            freezeAdjustedRef.current = true
            elapsed = now - phaseStartRef.current
            rawT = Math.min(elapsed / PHASE_DURATION[phase], 1)
          }
        }
      }
      // Stretch the post-wire portion of the finish phase. Without this
      // the trailers' wire-crossing arc fits into ~1.3s and they blur
      // past the camera. The trail length is dynamic — sized at finish-
      // phase start so the back of the field files through at a fixed
      // ms-per-length pace regardless of how spread out they are.
      if (phase === 'finish' && !frozen && rawT > WIRE_HIT_AT) {
        const wirePhaseWall = WIRE_HIT_AT * PHASE_DURATION.finish
        const wallSinceWire = elapsed - wirePhaseWall
        const stretchedWall = (1 - WIRE_HIT_AT) * PHASE_DURATION.finish + postTrailMsRef.current
        const post = Math.min(1, wallSinceWire / stretchedWall)
        rawT = WIRE_HIT_AT + (1 - WIRE_HIT_AT) * post
      }
      const t = rawT
      const et = easeInOutCubic(t)
      const moving = phase !== 'tote' && phase !== 'finish'

      // Update horses
      const horses = horsesRef.current
      // Blend the engine's actual finishing-perf gap into each horse's
      // target progress so the overhead pack ordering converges toward
      // the real outcome by stretch. Without this the top-down camera
      // ordered by running-style profile only — a closer (S) sat at the
      // back of the pack until the rail cam took over, even when the
      // engine had them winning. Style offset still drives the early
      // narrative (E in front, S off the pace); perfOffset takes over
      // through the stretch.
      // Perf-blend ramps faster than before so the overhead pack ordering
      // tracks the engine's actual outcome through the back stretch and
      // far turn — the running-style profile only dominates out of the
      // gate. Real broadcasts already show clear separation by the half.
      const phaseBlend: Record<RacePhase, number> = {
        tote: 0, gate: 0, early: 0.35, mid: 0.80, stretch: 1.0, finish: 1.0,
      }
      const blend = phaseBlend[phase]
      const leaderPerf = result?.finishOrder[0]?.performance ?? 0

      // Style offset fades inversely with the perf blend. Early in the
      // race the running-style profile drives ordering (E in front, S
      // off the pace) since perf hasn't expressed yet; by the stretch,
      // perf takes over completely and the visual ordering converges to
      // the engine's truth. Without this fade, a closer-style runner's
      // late style bonus could visually beat the engine's actual winner
      // at the wire — the overhead would lie about the race outcome.
      const styleScale = 1 - blend

      for (const ho of horses) {
        let perfOffset = 0
        if (result && blend > 0) {
          const fp = result.finishOrder.find(f => f.horseId === ho.id)
          if (fp) {
            const lb = Math.min(15, Math.max(0, leaderPerf - fp.performance))
            perfOffset = -lb * 0.005
          }
        }

        ho.targetT = Math.min(1,
          baseProgress(phase, t)
          + styleOffset(ho.style, phase, t, ho.lane) * styleScale
          + perfOffset * blend
        )
        ho.targetT = Math.max(ho.targetT, ho.currentT) // never backward

        // Tight, frame-rate-independent lerp toward target.
        // factor = 1 - exp(-k*dt) gives true exponential smoothing.
        const k = 12
        ho.currentT += (ho.targetT - ho.currentT) * (1 - Math.exp(-k * dt))

        // Keep gallop animating through the rail-cam finish — the horses are
        // still mid-stride as they cross the wire — but freeze it during
        // the wire-crossing pause so the broadcast moment reads as a
        // genuine still frame.
        if ((moving || phase === 'finish') && !frozen) ho.gallop += (5 + ho.lane * 0.3) * dt * Math.PI * 2
      }

      const mode = cameraForPhase(phase)
      const laneW = geo.tw / (horses.length + 1)

      // Spawn hoof-kick particles for moving horses (top-down views only —
      // rail cam is a separate projection in screen space).
      if (moving && mode !== 'rail') {
        for (const ho of horses) {
          if (Math.random() < 0.55) {
            const lo = -geo.tw / 2 + (ho.lane + 1) * laneW
            const pt = trackPoint(ho.currentT % 1, geo, lo)
            spawnHoofKick(particlesRef.current, pt.x, pt.y, pt.angle, race.conditions.surface)
          }
        }
      }
      updateParticles(particlesRef.current, dt)

      // ── Draw ──
      ctx.save()
      ctx.clearRect(0, 0, w, h)

      if (mode === 'rail') {
        // Wire shake: a flash of camera kick within ~140ms after the
        // leader crosses the wire. Suppressed during freeze (the camera
        // should be rock-still while the photo-finish is held).
        const sinceHit = t - WIRE_HIT_AT
        const shaking = !frozen && sinceHit > 0 && sinceHit < 0.05
        ctx.save()
        if (shaking) {
          const decay = 1 - sinceHit / 0.05
          const sx = (Math.random() - 0.5) * 4 * decay
          const sy = (Math.random() - 0.5) * 4 * decay
          ctx.translate(sx, sy)
        }
        const scrollNow = frozen && freezeStartRef.current !== null ? freezeStartRef.current : now
        drawSideView(ctx, w, h, horses, race.conditions.surface, now, result, t, scrollNow)
        ctx.restore()

        // During the wire-crossing freeze, paint the appropriate overlay
        // on top of the held frame. Photo finishes get the film-grain
        // PHOTO stamp; decisive finishes get the OFFICIAL flourish in
        // the winner's cloth color. The flourish age is anchored to the
        // freeze start so its fade aligns with the freeze window.
        if (frozen && result && freezeStartRef.current !== null) {
          if (result.photoFinish) {
            drawPhotoFinishOverlay(ctx, w, h, now)
          } else if (result.finishOrder[0]) {
            const age = now - freezeStartRef.current
            const winnerId = result.finishOrder[0].horseId
            const winnerPP = horses.find(ho => ho.id === winnerId)?.pp ?? 0
            const wireX = w * 0.78
            drawWinnerFlourish(ctx, w, h, age, FREEZE_MS, winnerPP, wireX)
          }
        }
      } else {
        let target: Cam
        switch (mode) {
          case 'start': target = camPack(w, h, geo, horses); break
          case 'wide': target = camPack(w, h, geo, horses); break
        }
        camTransRef.current = Math.min(1, camTransRef.current + dt * 1.2)
        const cam = prevCamRef.current && camTransRef.current < 1
          ? lerpCam(prevCamRef.current, target, camTransRef.current)
          : target
        prevCamRef.current = cam

        drawBackdrop(ctx, w, h, mode, now)

        ctx.translate(cam.tx, cam.ty)
        ctx.scale(cam.s, cam.s)

        drawTrack(ctx, geo, race.conditions.surface)
        drawParticles(ctx, particlesRef.current)

        const sorted = [...horses].sort((a, b) => a.currentT - b.currentT)
        const hScale = Math.max(0.5, Math.min(1.4, 1.0 / cam.s * 1.0))

        ensureOverheadLoaded()
        for (const ho of sorted) {
          const lo = -geo.tw / 2 + (ho.lane + 1) * laneW
          const pt = trackPoint(ho.currentT % 1, geo, lo)
          const overheadFrame = getOverheadFrame(ho.gallop)
          if (overheadFrame) {
            const size = 28 * hScale
            ctx.save()
            ctx.translate(pt.x, pt.y)
            ctx.rotate(pt.angle)
            ctx.drawImage(overheadFrame, -size / 2, -size / 2, size, size)
            ctx.restore()
          } else {
            drawHorse(ctx, pt.x, pt.y, pt.angle + Math.PI / 2, ho.silkPrimary, ho.silkSecondary, ho.silkPattern, ho.isPlayer, ho.gallop, ho.pp, moving, hScale)
          }
        }

        drawCloths(ctx, sorted, geo, laneW, Math.max(0.4, 0.7 / cam.s))
      }
      ctx.restore()

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [phase, race.conditions.surface])

  if (reduceMotion) {
    return (
      <div className="h-dvh bg-stone-900 flex flex-col items-center justify-center text-stone-100 px-6" role="status" aria-live="polite">
        <p className="text-xs font-mono text-amber-400 uppercase tracking-widest">Race {race.raceNumber} — {race.trackCode}</p>
        <p className="mt-4 text-lg font-bold">Running the race…</p>
        <p className="mt-2 text-sm text-stone-400 text-center">Animation disabled per your reduced-motion setting. Results will appear shortly.</p>
      </div>
    )
  }

  return (
    <div className="h-dvh bg-stone-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-stone-800 px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-xs font-mono text-stone-400">Race {race.raceNumber} — {race.trackCode}</span>
        <AnimatePresence mode="wait">
          <motion.span key={phase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-xs font-bold uppercase tracking-widest text-amber-400">
            {phaseLabel(phase)}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Canvas — takes ALL remaining portrait space.
          aria-live region below surfaces the same race beats to
          assistive tech since the canvas itself is unreadable. */}
      <div ref={wrapperRef} className="flex-1 min-h-0 relative">
        <canvas ref={canvasRef} className="absolute inset-0" aria-hidden />

        {/* Race-call chyron — broadcast-style top bar with race time,
            current leader by saddle cloth, and a phase-appropriate call.
            Sits over the canvas so it tracks the cinema visually. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 px-3 py-2 bg-gradient-to-b from-black/85 via-black/55 to-transparent text-white flex items-center gap-3 font-mono text-[11px]" aria-hidden>
          <span className="tabular-nums text-amber-300">{formatRaceTime(chyron.time)}</span>
          {chyron.leader > 0 && (
            <span
              className="rounded-sm px-1.5 py-0.5 font-bold text-[10px]"
              style={{
                backgroundColor: ppColor(chyron.leader).bg,
                color: ppColor(chyron.leader).fg,
              }}
            >
              {chyron.leader}
            </span>
          )}
          {chyron.gap && (
            <span className="text-stone-300 tabular-nums">{chyron.gap}</span>
          )}
          <span className="ml-auto truncate max-w-[60%] text-right text-stone-100">{chyron.call}</span>
        </div>

        <div role="status" aria-live="polite" className="sr-only">
          {phaseLabel(phase)}: {announceLines[announceLines.length - 1] ?? ''}
        </div>
      </div>

      {/* Announcer */}
      <div className="px-4 pb-3 pt-1 shrink-0">
        <Announcer lines={announceLines} speed={25} />
      </div>
    </div>
  )
}

