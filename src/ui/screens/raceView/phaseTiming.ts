// Phase-timing curves that drive horse progress along the oval and
// per-style "where does this runner sit relative to the pack" offsets.
// Extracted from RaceView so the component file can focus on canvas
// wiring; the numbers here are pure tuning and deserve their own
// surface area when we iterate on race pacing.

export type RacePhase = 'tote' | 'gate' | 'early' | 'mid' | 'stretch' | 'finish'

export const PHASES: RacePhase[] = ['tote', 'gate', 'early', 'mid', 'stretch', 'finish']

export const PHASE_DURATION: Record<RacePhase, number> = {
  tote: 3500,
  gate: 2200,
  early: 3800,
  mid: 3800,
  stretch: 4500,
  finish: 2800,
}

export function phaseLabel(p: RacePhase): string {
  switch (p) {
    case 'tote': return 'Post Parade'
    case 'gate': return 'At the Gate'
    case 'early': return 'First Call'
    case 'mid': return 'Far Turn'
    case 'stretch': return 'Top of Stretch'
    case 'finish': return 'Official!'
  }
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Each phase covers a fraction of the track such that average speed is similar.
// Phase durations: gate=2.2s early=3.8s mid=3.8s stretch=4.5s finish=2.8s
// Cumulative: gate→0.05, early→0.30, mid→0.55, stretch→0.85, finish→1.0
export function baseProgress(phase: RacePhase, t: number): number {
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
// Each phase's start value equals the previous phase's end value so the
// runner's relative position moves smoothly without jumps at boundaries.
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

export function styleOffset(style: string, phase: RacePhase, t: number, lane: number): number {
  const sp = lane * 0.004
  const offsets = STYLE_OFFSETS[style] ?? STYLE_OFFSETS.P!
  const [start, end] = offsets[phase]!
  return start + (end - start) * t + sp
}
