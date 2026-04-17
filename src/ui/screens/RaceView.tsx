import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Race, MarketSnapshot } from '@/engine/types'
import { Announcer } from '@/ui/components/Announcer'

interface RaceViewProps {
  race: Race
  market: MarketSnapshot
  mtpSnapshots: MarketSnapshot[]
  playerHorseId: string | null
  onRaceComplete: () => void
}

type RacePhase = 'tote' | 'gate' | 'early' | 'mid' | 'stretch' | 'finish'

const PHASE_DURATION: Record<RacePhase, number> = {
  tote: 3500,
  gate: 2200,
  early: 3800,
  mid: 3800,
  stretch: 4500,
  finish: 2800,
}

const PHASES: RacePhase[] = ['tote', 'gate', 'early', 'mid', 'stretch', 'finish']

type CameraMode = 'start' | 'wide' | 'finish' | 'rail'
function cameraForPhase(p: RacePhase): CameraMode {
  if (p === 'tote' || p === 'gate' || p === 'early') return 'start'
  if (p === 'mid') return 'wide'
  if (p === 'stretch') return 'finish'
  return 'rail'
}

const SILK_COLORS = [
  '#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#9333ea',
  '#0891b2', '#e11d48', '#ea580c', '#4f46e5', '#059669',
  '#d97706', '#7c3aed',
]

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
  isPlayer: boolean; color: string; style: string; gallop: number
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
  color: string, isPlayer: boolean,
  gallop: number, pp: number, moving: boolean, s: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  const bob = moving ? Math.sin(gallop) * 1.5 * s : 0

  // Body
  ctx.fillStyle = '#5c3d2e'
  ctx.beginPath(); ctx.ellipse(0, bob, 8 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill()
  // Neck + head
  ctx.beginPath(); ctx.ellipse(8 * s, -2 * s + bob, 4 * s, 2.5 * s, -0.5, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(12 * s, -3.5 * s + bob, 3 * s, 2 * s, -0.3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(13 * s, -5.5 * s + bob, 1 * s, 1.5 * s, -0.2, 0, Math.PI * 2); ctx.fill()

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

  // Jockey silks
  ctx.fillStyle = color
  ctx.beginPath(); ctx.ellipse(1 * s, -3 * s + bob, 3.5 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#f5deb3'
  ctx.beginPath(); ctx.arc(3 * s, -5.5 * s + bob, 2 * s, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(3 * s, -6 * s + bob, 2 * s, Math.PI, 0); ctx.fill()

  // PP number
  ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(6, 7 * s)}px monospace`
  ctx.textAlign = 'center'; ctx.fillText(String(pp), 1 * s, -1.5 * s + bob)

  // Player ring
  if (isPlayer) {
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2 * s
    ctx.beginPath(); ctx.ellipse(0, bob, 14 * s, 10 * s, 0, 0, Math.PI * 2); ctx.stroke()
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

function camFinish(w: number, h: number, geo: TrackGeo, horses: HorseState[]): Cam {
  // Frame: top of the right straight near the finish line.
  // Track the leaders approaching the wire.
  const maxT = horses.length > 0 ? Math.max(...horses.map(h => h.currentT)) : 0.9
  const focusT = Math.max(0.88, Math.min(maxT + 0.01, 0.998))
  const focusPt = trackPoint(focusT, geo, 0)

  // Tighter zoom than start — drama!
  const zoom = w / (geo.tw * 2.2)

  return {
    tx: w / 2 - focusPt.x * zoom,
    ty: h / 2 - focusPt.y * zoom,
    s: zoom,
  }
}

function lerpCam(a: Cam, b: Cam, t: number): Cam {
  const e = easeInOutCubic(Math.max(0, Math.min(1, t)))
  return { tx: a.tx + (b.tx - a.tx) * e, ty: a.ty + (b.ty - a.ty) * e, s: a.s + (b.s - a.s) * e }
}

// ── Name labels ────────────────────────────────────────────────

function drawLabels(ctx: CanvasRenderingContext2D, horses: HorseState[], geo: TrackGeo, laneW: number, invScale: number) {
  const fs = Math.max(7, Math.round(8 * invScale))
  ctx.save()
  ctx.font = `bold ${fs}px sans-serif`
  ctx.textAlign = 'center'

  for (const horse of horses) {
    const lo = -geo.tw / 2 + (horse.lane + 1) * laneW
    const pt = trackPoint(horse.currentT % 1, geo, lo)
    const name = horse.name.length > 10 ? horse.name.slice(0, 9) + '\u2026' : horse.name
    const tw = ctx.measureText(name).width + 6
    const ly = pt.y - 16 * invScale

    ctx.fillStyle = horse.isPlayer ? 'rgba(251,191,36,0.9)' : 'rgba(0,0,0,0.6)'
    ctx.beginPath(); ctx.roundRect(pt.x - tw / 2, ly - fs / 2 - 1, tw, fs + 3, 3); ctx.fill()
    ctx.fillStyle = horse.isPlayer ? '#1c1917' : '#fff'
    ctx.fillText(name, pt.x, ly + fs / 2 - 1)
  }
  ctx.restore()
}

// ── Particles (hoof kicks) ─────────────────────────────────────
// World-space dirt/turf spray behind each running horse. Purely
// cosmetic; seeded from Math.random (unlike engine RNG) because the
// canvas layer is non-deterministic anyway (refresh rate, resize).

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  size: number
  color: string
}

function surfaceParticleColor(surface: string): string {
  if (surface === 'T') return '#4a6b3d'
  if (surface === 'S') return '#6b6b6b'
  return '#8a6b4a'
}

function spawnHoofKick(
  particles: Particle[],
  x: number, y: number, angle: number,
  surface: string,
) {
  // angle points forward along the rail; spray goes backward + upward.
  const back = angle + Math.PI
  const spread = 0.7
  for (let i = 0; i < 2; i++) {
    const theta = back + (Math.random() - 0.5) * spread
    const speed = 30 + Math.random() * 50
    const life = 0.35 + Math.random() * 0.3
    particles.push({
      x: x + Math.cos(back) * 4,
      y: y + Math.sin(back) * 4,
      vx: Math.cos(theta) * speed,
      vy: Math.sin(theta) * speed - 15 - Math.random() * 25,
      life,
      maxLife: life,
      size: 1 + Math.random() * 1.3,
      color: surfaceParticleColor(surface),
    })
  }
}

function updateParticles(particles: Particle[], dt: number) {
  const gravity = 90
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!
    p.vy += gravity * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.life -= dt
    if (p.life <= 0) particles.splice(i, 1)
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const a = Math.max(0, Math.min(1, p.life / p.maxLife))
    ctx.globalAlpha = a * 0.85
    ctx.fillStyle = p.color
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
}

// ── Backdrop (screen space, drawn before camera transform) ─────
// Dusk sky gradient + deterministic star field + grandstand
// silhouette for wide/rail modes. Screen-space so it doesn't zoom
// with the track — gives a parallax-ish sense of depth.

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, mode: CameraMode) {
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

  if (mode === 'wide' || mode === 'rail') {
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

// ── Rail-cam side view ─────────────────────────────────────────
// Cinematic broadcast-style view for the finish phase. Horses drawn
// in profile, mapped left-to-right by gap to the leader. Screen-space
// only — no camera transform applies here.

function drawSideView(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  horses: HorseState[],
  surface: string,
) {
  drawBackdrop(ctx, w, h, 'rail')

  const trackTop = h * 0.82
  const trackBot = h * 0.98
  ctx.fillStyle = surface === 'T' ? '#3d6b4a' : surface === 'S' ? '#4a4a4a' : '#b08968'
  ctx.fillRect(0, trackTop, w, trackBot - trackTop)

  // Outside rail (bottom of screen, closest to camera)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillRect(0, trackBot - 2, w, 2)
  // Inside rail (top of track band, far side)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(0, trackTop, w, 1.5)

  // Finish wire + checkered pole at ~0.82w
  const wireX = w * 0.82
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(wireX, h * 0.60)
  ctx.lineTo(wireX, trackBot)
  ctx.stroke()
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#fff' : '#000'
    ctx.fillRect(wireX - 3, h * 0.60 + i * 4, 6, 4)
  }

  // Horses: map (leaderT - currentT) to horizontal offset from wire.
  // Inner lane (lane 0) = closest to camera = largest + lowest in frame.
  const lanes = horses.length
  const laneSpan = (trackBot - trackTop) - 22
  const laneStep = laneSpan / Math.max(1, lanes - 1)
  const leaderT = horses.length > 0 ? Math.max(...horses.map(h => h.currentT)) : 0
  const tToPx = Math.max(2400, w * 8)
  const baseScale = Math.min(2.4, Math.max(1.2, w / 380))

  // Outer lanes first so inner lanes overlap on top.
  const sorted = [...horses].sort((a, b) => b.lane - a.lane)
  for (const ho of sorted) {
    const gap = leaderT - ho.currentT
    const x = wireX - gap * tToPx
    const y = trackBot - 15 - ho.lane * laneStep
    const s = baseScale * (1 - ho.lane * 0.04)
    drawHorseProfile(ctx, x, y, ho.color, ho.isPlayer, ho.gallop, ho.pp, s)
  }
}

function drawHorseProfile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  color: string, isPlayer: boolean,
  gallop: number, pp: number, s: number,
) {
  ctx.save()
  ctx.translate(x, y)

  const bob = Math.sin(gallop) * 1.3 * s

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

  // Front legs
  profileLeg(ctx, 8 * s, 4 * s + bob, Math.sin(gallop) * 14, s)
  profileLeg(ctx, 11 * s, 4 * s + bob, Math.sin(gallop + Math.PI * 1.5) * 14, s)

  // Neck
  ctx.save()
  ctx.translate(12 * s, -3 * s + bob)
  ctx.rotate(-0.5)
  ctx.fillStyle = '#5c3d2e'
  ctx.beginPath(); ctx.ellipse(0, 0, 7 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Head
  ctx.fillStyle = '#5c3d2e'
  ctx.beginPath()
  ctx.ellipse(18 * s, -7 * s + bob, 4.2 * s, 2.6 * s, -0.4, 0, Math.PI * 2)
  ctx.fill()
  // Ear
  ctx.beginPath()
  ctx.moveTo(17 * s, -9 * s + bob)
  ctx.lineTo(18 * s, -11 * s + bob)
  ctx.lineTo(19 * s, -9 * s + bob)
  ctx.closePath()
  ctx.fill()
  // Eye
  ctx.fillStyle = '#111'
  ctx.beginPath(); ctx.arc(20 * s, -7.2 * s + bob, 0.8 * s, 0, Math.PI * 2); ctx.fill()

  // Jockey silks
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(2 * s, -5 * s + bob, 4.8 * s, 3.6 * s, -0.25, 0, Math.PI * 2)
  ctx.fill()
  // Jockey head
  ctx.fillStyle = '#f5deb3'
  ctx.beginPath(); ctx.arc(5 * s, -9 * s + bob, 2.3 * s, 0, Math.PI * 2); ctx.fill()
  // Helmet
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(5 * s, -9.5 * s + bob, 2.5 * s, Math.PI, 0); ctx.fill()

  // PP number on silks
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.max(8, 9 * s)}px monospace`
  ctx.textAlign = 'center'
  ctx.fillText(String(pp), 2 * s, -3.5 * s + bob)

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

export function RaceView({ race, market, playerHorseId, onRaceComplete }: RaceViewProps) {
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

  const active = race.entries.filter(e => !e.scratched)

  // Init
  useEffect(() => {
    horsesRef.current = active.map((e, i) => ({
      id: e.horse.id, name: e.horse.name, pp: e.postPosition,
      targetT: 0, currentT: 0, lane: i,
      isPlayer: e.horse.id === playerHorseId,
      color: SILK_COLORS[i % SILK_COLORS.length]!,
      style: e.horse.runningStyle,
      gallop: Math.random() * Math.PI * 2,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Phase transitions
  useEffect(() => {
    if (phase === 'finish') {
      const t = setTimeout(onRaceComplete, PHASE_DURATION.finish)
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
      const elapsed = now - phaseStartRef.current
      const t = Math.min(elapsed / PHASE_DURATION[phase], 1)
      const et = easeInOutCubic(t)
      const moving = phase !== 'tote' && phase !== 'finish'

      // Update horses
      const horses = horsesRef.current
      for (const ho of horses) {
        // Position is computed from LINEAR t so speed is constant within each phase
        // and continuous across phase boundaries (baseProgress + styleOffset are designed this way).
        ho.targetT = Math.min(1, baseProgress(phase, t) + styleOffset(ho.style, phase, t, ho.lane))
        ho.targetT = Math.max(ho.targetT, ho.currentT) // never backward

        // Tight, frame-rate-independent lerp toward target.
        // factor = 1 - exp(-k*dt) gives true exponential smoothing.
        const k = 12
        ho.currentT += (ho.targetT - ho.currentT) * (1 - Math.exp(-k * dt))

        if (moving) ho.gallop += (8 + ho.lane * 0.5) * dt * Math.PI * 2
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
        drawSideView(ctx, w, h, horses, race.conditions.surface)
      } else {
        let target: Cam
        switch (mode) {
          case 'start': target = camStart(w, h, geo, horses, phase, et); break
          case 'wide': target = camWide(w, h, geo); break
          case 'finish': target = camFinish(w, h, geo, horses); break
        }
        camTransRef.current = Math.min(1, camTransRef.current + dt * 1.2)
        const cam = prevCamRef.current && camTransRef.current < 1
          ? lerpCam(prevCamRef.current, target, camTransRef.current)
          : target
        prevCamRef.current = cam

        drawBackdrop(ctx, w, h, mode)

        ctx.translate(cam.tx, cam.ty)
        ctx.scale(cam.s, cam.s)

        drawTrack(ctx, geo, race.conditions.surface)
        drawParticles(ctx, particlesRef.current)

        const sorted = [...horses].sort((a, b) => a.currentT - b.currentT)
        const hScale = Math.max(0.5, Math.min(1.4, 1.0 / cam.s * 1.0))

        for (const ho of sorted) {
          const lo = -geo.tw / 2 + (ho.lane + 1) * laneW
          const pt = trackPoint(ho.currentT % 1, geo, lo)
          drawHorse(ctx, pt.x, pt.y, pt.angle + Math.PI / 2, ho.color, ho.isPlayer, ho.gallop, ho.pp, moving, hScale)
        }

        drawLabels(ctx, sorted, geo, laneW, Math.max(0.4, 0.7 / cam.s))
      }
      ctx.restore()

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [phase, race.conditions.surface])

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

      {/* Canvas — takes ALL remaining portrait space */}
      <div ref={wrapperRef} className="flex-1 min-h-0 relative">
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>

      {/* Announcer */}
      <div className="px-4 pb-3 pt-1 shrink-0">
        <Announcer lines={announceLines} speed={25} />
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────

function phaseLabel(p: RacePhase): string {
  switch (p) {
    case 'tote': return 'Post Parade'
    case 'gate': return 'At the Gate'
    case 'early': return 'First Call'
    case 'mid': return 'Far Turn'
    case 'stretch': return 'Top of Stretch'
    case 'finish': return 'Official!'
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Each phase covers a fraction of the track such that average speed is similar.
// Phase durations: gate=2.2s early=3.8s mid=3.8s stretch=4.5s finish=2.8s
// Cumulative: gate→0.05, early→0.30, mid→0.55, stretch→0.85, finish→1.0
function baseProgress(phase: RacePhase, t: number): number {
  switch (phase) {
    case 'tote': return 0
    case 'gate': return t * 0.05            // 0.023/s — short burst out of gate
    case 'early': return 0.05 + t * 0.25    // 0.066/s
    case 'mid': return 0.30 + t * 0.25      // 0.066/s
    case 'stretch': return 0.55 + t * 0.30  // 0.067/s
    case 'finish': return 0.85 + t * 0.15   // 0.054/s — slight slowdown at wire
  }
}

// Style offsets as continuous [start, end] pairs per phase.
// Each phase's start value equals the previous phase's end value.
// E = front-runner: leads early, fades late
// S = closer: trails early, surges late
// P = presser: sits mid-pack, steady move
const STYLE_OFFSETS: Record<string, Record<RacePhase, [number, number]>> = {
  E: {
    tote:    [0, 0],
    gate:    [0, 0.02],
    early:   [0.02, 0.06],
    mid:     [0.06, 0.05],
    stretch: [0.05, 0.01],
    finish:  [0.01, 0.01],
  },
  S: {
    tote:    [0, 0],
    gate:    [0, -0.01],
    early:   [-0.01, -0.04],
    mid:     [-0.04, -0.02],
    stretch: [-0.02, 0.04],
    finish:  [0.04, 0.04],
  },
  P: {
    tote:    [0, 0],
    gate:    [0, 0.005],
    early:   [0.005, 0.01],
    mid:     [0.01, 0.02],
    stretch: [0.02, 0.03],
    finish:  [0.03, 0.03],
  },
}

function styleOffset(style: string, phase: RacePhase, t: number, lane: number): number {
  const sp = lane * 0.004
  const offsets = STYLE_OFFSETS[style] ?? STYLE_OFFSETS.P!
  const [start, end] = offsets[phase]!
  return start + (end - start) * t + sp
}
