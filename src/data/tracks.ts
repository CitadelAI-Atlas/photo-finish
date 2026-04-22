import type { Track } from '@/engine/types'

// Takeout rates are the slice each jurisdiction skims off the top of
// every pool. They're publicly disclosed and vary by circuit — a
// teaching point the game surfaces: "the same $2 bet pays less at
// Gulfstream than at Keeneland." Values below are representative
// 2024 rates from NYRA / 1/ST / Keeneland / CHRB.
export const TRACKS: Track[] = [
  {
    code: 'AQU', name: 'Aqueduct', city: 'New York', surfaces: ['D', 'T'],
    takeout: { win: 0.16, place: 0.16, show: 0.16, exacta: 0.20, quinella: 0.20, dailyDouble: 0.175 },
  },
  {
    code: 'GP', name: 'Gulfstream Park', city: 'Miami', surfaces: ['D', 'T'],
    takeout: { win: 0.17, place: 0.17, show: 0.17, exacta: 0.21, quinella: 0.21, dailyDouble: 0.21 },
  },
  {
    code: 'KEE', name: 'Keeneland', city: 'Lexington', surfaces: ['D', 'T', 'A'],
    takeout: { win: 0.16, place: 0.16, show: 0.16, exacta: 0.19, quinella: 0.19, dailyDouble: 0.19 },
  },
  {
    code: 'SA', name: 'Santa Anita', city: 'Los Angeles', surfaces: ['D', 'T'],
    takeout: { win: 0.1543, place: 0.1543, show: 0.1543, exacta: 0.2268, quinella: 0.2268, dailyDouble: 0.2268 },
  },
]
