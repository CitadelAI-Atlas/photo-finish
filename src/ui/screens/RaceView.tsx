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

type CameraMode = 'start' | 'wide' | 'finish'
function cameraForPhase(p: RacePhase): CameraMode {
  if (p === 'tote' || p === 'gate' || p === 'early') return 'start'
  if (p === 'mid') return 'wide'
  return 'finish'
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

      // Phase timing
      const elapsed = now - phaseStartRef.current
      const t = Math.min(elapsed / PHASE_DURATION[phase], 1)
      const et = easeInOutCubic(t)
      const moving = phase !== 'tote' && phase !== 'finish'

      // Update horses
      const horses = horsesRef.current
      for (const ho of horses) {
        ho.targetT = Math.min(1, baseProgress(phase, et) + styleOffset(ho.style, phase, et, ho.lane))
        // Never allow backward movement
        ho.targetT = Math.max(ho.targetT, ho.currentT)
        ho.currentT += (ho.targetT - ho.currentT) * Math.min(1, 3.5 * dt)
        if (moving) ho.gallop += (8 + ho.lane * 0.5) * dt * Math.PI * 2
      }

      // Camera
      const mode = cameraForPhase(phase)
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

      // ── Draw ──
      ctx.save()
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#1c1917'; ctx.fillRect(0, 0, w, h)

      // Apply camera
      ctx.translate(cam.tx, cam.ty)
      ctx.scale(cam.s, cam.s)

      drawTrack(ctx, geo, race.conditions.surface)

      // Horses back-to-front
      const sorted = [...horses].sort((a, b) => a.currentT - b.currentT)
      const laneW = geo.tw / (horses.length + 1)
      const hScale = Math.max(0.5, Math.min(1.4, 1.0 / cam.s * 1.0))

      for (const ho of sorted) {
        const lo = -geo.tw / 2 + (ho.lane + 1) * laneW
        const pt = trackPoint(ho.currentT % 1, geo, lo)
        drawHorse(ctx, pt.x, pt.y, pt.angle + Math.PI / 2, ho.color, ho.isPlayer, ho.gallop, ho.pp, moving, hScale)
      }

      drawLabels(ctx, sorted, geo, laneW, Math.max(0.4, 0.7 / cam.s))
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

function baseProgress(phase: RacePhase, t: number): number {
  switch (phase) {
    case 'tote': return 0
    case 'gate': return t * 0.03
    case 'early': return 0.03 + t * 0.22
    case 'mid': return 0.25 + t * 0.35
    case 'stretch': return 0.60 + t * 0.37
    case 'finish': return 0.97 + t * 0.03
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
