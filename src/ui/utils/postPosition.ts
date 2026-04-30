// Track-standard saddle-cloth colors. Real US thoroughbred racing
// assigns these by post position so the betting public can identify a
// horse from the rail by the cloth alone, not by name. Numbers >12
// reuse the cycle (real tracks use white-on-color plates for 13+; we
// approximate). Shared between the race-view canvas and the bet-selection
// UI so the same chip identifies a horse end-to-end.

export const PP_COLORS: { bg: string; fg: string }[] = [
  { bg: '#dc2626', fg: '#fff' },  // 1 red
  { bg: '#f5f5f4', fg: '#111' },  // 2 white
  { bg: '#1d4ed8', fg: '#fff' },  // 3 blue
  { bg: '#facc15', fg: '#111' },  // 4 yellow
  { bg: '#15803d', fg: '#fff' },  // 5 green
  { bg: '#111111', fg: '#fff' },  // 6 black
  { bg: '#ea580c', fg: '#fff' },  // 7 orange
  { bg: '#ec4899', fg: '#111' },  // 8 pink
  { bg: '#0891b2', fg: '#fff' },  // 9 turquoise
  { bg: '#7c3aed', fg: '#fff' },  // 10 purple
  { bg: '#78716c', fg: '#fff' },  // 11 gray
  { bg: '#84cc16', fg: '#111' },  // 12 lime
]

export function ppColor(pp: number): { bg: string; fg: string } {
  return PP_COLORS[(pp - 1) % PP_COLORS.length]!
}
