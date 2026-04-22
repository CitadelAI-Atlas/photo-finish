import type { Jockey } from '@/engine/types'

export const JOCKEYS: Jockey[] = [
  // A-tier (elite) — 4 jockeys
  { id: 'j01', name: 'Irad Ortiz Jr', tier: 'A' },
  { id: 'j02', name: 'Flavien Prat', tier: 'A' },
  { id: 'j03', name: 'Luis Saez', tier: 'A' },
  { id: 'j04', name: 'Joel Rosario', tier: 'A' },

  // B-tier (solid) — 8 jockeys
  { id: 'j05', name: 'John Velazquez', tier: 'B' },
  { id: 'j06', name: 'Tyler Gaffalione', tier: 'B' },
  { id: 'j07', name: 'Jose Ortiz', tier: 'B' },
  { id: 'j08', name: 'Javier Castellano', tier: 'B' },
  { id: 'j09', name: 'Ricardo Santana Jr', tier: 'B' },
  { id: 'j10', name: 'Manny Franco', tier: 'B' },
  { id: 'j11', name: 'Dylan Davis', tier: 'B' },
  { id: 'j12', name: 'Junior Alvarado', tier: 'B' },

  // C-tier (journeyman) — 8 jockeys
  { id: 'j13', name: 'Eric Cancel', tier: 'C' },
  { id: 'j14', name: 'Kendrick Carmouche', tier: 'C' },
  { id: 'j15', name: 'Jose Lezcano', tier: 'C' },
  { id: 'j16', name: 'Benjamin Hernandez', tier: 'C' },
  { id: 'j17', name: 'Reylu Gutierrez', tier: 'C' },
  { id: 'j18', name: 'Trevor McCarthy', tier: 'C' },
  { id: 'j19', name: 'Jorge Vargas Jr', tier: 'C' },
  { id: 'j20', name: 'Silvestre Gonzalez', tier: 'C' },
]

// What the handicapper/crowd THINKS a jockey is worth — used only for
// perceived PSR when computing the morning line. This is the "public
// estimate" of jockey value and is allowed to be slightly generous, the
// way popular jockeys are overbet in real life.
export const JOCKEY_PERCEIVED_BONUS: Record<string, number> = {
  A: 5,
  B: 2,
  C: 0,
}

// What the jockey is ACTUALLY worth during the race, applied on top of
// performance. Intentionally smaller than perceived — the gap between
// these two values is the "overlay" on under-jockeyed horses.
export const JOCKEY_ACTUAL_BONUS: Record<string, number> = {
  A: 3,
  B: 1,
  C: 0,
}
