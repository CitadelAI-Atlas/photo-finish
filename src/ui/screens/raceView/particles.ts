// Hoof-kick particles. Self-contained — no component refs, just an
// array that the render loop updates and draws each frame. Keeping
// these here shrinks RaceView.tsx and makes the effect easy to tune
// (gravity, spread, lifetime) without scrolling past all the layout.

export interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  size: number
  color: string
}

// Turf sprays green divots, synthetic kicks grey dust, dirt is the
// default sandy brown.
export function surfaceParticleColor(surface: string): string {
  if (surface === 'T') return '#4a6b3d'
  if (surface === 'S') return '#6b6b6b'
  return '#8a6b4a'
}

export function spawnHoofKick(
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

export function updateParticles(particles: Particle[], dt: number) {
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

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const a = Math.max(0, Math.min(1, p.life / p.maxLife))
    ctx.globalAlpha = a * 0.85
    ctx.fillStyle = p.color
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
}
