// Format odds the way real US tote boards display them.
// Below 1-1: shown as fractions (1/5, 2/5, 1/2, 3/5, 4/5)
// 1-1 to 9-1: shown as X-1 with halves where appropriate (5/2, 7/2, 9/2)
// 10+: rounded to whole X-1

const FRACTIONS: [number, string][] = [
  [0.20, '1/5'],
  [0.40, '2/5'],
  [0.50, '1/2'],
  [0.60, '3/5'],
  [0.80, '4/5'],
]

const HALF_LABELS: Record<number, string> = {
  1.5: '3/2',
  2.5: '5/2',
  3.5: '7/2',
  4.5: '9/2',
}

export function formatOdds(odds: number): string {
  if (odds < 1) {
    // Find the closest fraction bucket
    let closest = FRACTIONS[0]!
    let minDiff = Math.abs(odds - closest[0])
    for (const f of FRACTIONS) {
      const diff = Math.abs(odds - f[0])
      if (diff < minDiff) { minDiff = diff; closest = f }
    }
    return closest[1]
  }
  if (HALF_LABELS[odds]) return `${HALF_LABELS[odds]}-1`
  if (odds >= 10) return `${Math.round(odds)}-1`
  return `${Math.round(odds)}-1`
}
