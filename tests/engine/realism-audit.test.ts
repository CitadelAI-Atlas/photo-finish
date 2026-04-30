import { describe, it } from 'vitest'
import { executeRace, perfGapToLengths } from '@/engine/race'
import { buildMarketSnapshot } from '@/engine/market'
import { generateField, generateRaceConditions } from '@/engine/field'
import { Rng } from '@/engine/rng'

describe('realism audit', () => {
  it('measures distributions', { timeout: 60000 }, () => {
    const N = 5000
    let favWins = 0, secondFavWins = 0, longshotWins = 0, bigLongshotWins = 0, photoFinishes = 0
    const winningMargins: number[] = []
    const fieldSpreads: number[] = []
    const odds1st: number[] = []
    const oddsByPos: number[][] = [[], [], [], [], [], []]

    for (let i = 0; i < N; i++) {
      const seed = i + 1
      const rng = new Rng(seed)
      const conditions = generateRaceConditions(rng, 'CLM')
      const entries = generateField(rng, conditions, 8)
      const race = { id: `r${seed}`, raceNumber: 1, trackCode: 'AQU', conditions, entries }
      const market = buildMarketSnapshot(new Rng(seed + 10000), race)
      const result = executeRace(new Rng(seed + 20000), race)

      const winnerId = result.finishOrder[0]!.horseId
      if (winnerId === market.favoriteId) favWins++
      const sortedOdds = [...market.oddsByHorse.entries()].sort((a, b) => a[1].odds - b[1].odds)
      if (winnerId === sortedOdds[1]?.[0]) secondFavWins++
      const wOdds = market.oddsByHorse.get(winnerId)?.odds ?? 0
      if (wOdds >= 10) longshotWins++
      if (wOdds >= 30) bigLongshotWins++
      if (result.photoFinish) photoFinishes++
      if (result.finishOrder.length >= 2) {
        winningMargins.push(perfGapToLengths(result.finishOrder[0]!.performance - result.finishOrder[1]!.performance))
        const last = result.finishOrder[result.finishOrder.length - 1]!.performance
        fieldSpreads.push(perfGapToLengths(result.finishOrder[0]!.performance - last))
      }
      for (let p = 0; p < Math.min(6, result.finishOrder.length); p++) {
        oddsByPos[p]!.push(market.oddsByHorse.get(result.finishOrder[p]!.horseId)?.odds ?? 0)
      }
      odds1st.push(wOdds)
    }

    const pct = (n: number) => `${(n / N * 100).toFixed(1)}%`
    const pctile = (arr: number[], p: number) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(p * s.length)] ?? 0 }
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    const std = (arr: number[]) => { const m = mean(arr); return Math.sqrt(mean(arr.map(x => (x - m) ** 2))) }

    console.log('\n══════ REALISM AUDIT — 5000 simulated 8-horse claiming races ══════\n')
    console.log('WINNER ODDS:')
    console.log(`  Favorite:           ${pct(favWins)}  (real: ~33%)`)
    console.log(`  2nd favorite:       ${pct(secondFavWins)}  (real: ~20%)`)
    console.log(`  10-1+ longshot:     ${pct(longshotWins)}  (real: ~12%)`)
    console.log(`  30-1+ bomb:         ${pct(bigLongshotWins)}  (real: ~3%)`)
    console.log()
    console.log('FINISH STATE:')
    console.log(`  Photo finishes:     ${pct(photoFinishes)}  (real: ~10-15%)`)
    console.log()
    console.log('WINNING MARGIN (1st over 2nd):')
    console.log(`  Mean:    ${mean(winningMargins).toFixed(2)}L  σ ${std(winningMargins).toFixed(2)}  (real: mean ~3.5L)`)
    console.log(`  Median:  ${pctile(winningMargins, 0.5).toFixed(2)}L  (real: ~2L)`)
    console.log(`  p95:     ${pctile(winningMargins, 0.95).toFixed(2)}L  (real: ~10L)`)
    console.log()
    console.log('FIELD SPREAD (1st to last):')
    console.log(`  Mean:    ${mean(fieldSpreads).toFixed(1)}L  (real CLM: ~12-15L)`)
    console.log(`  p95:     ${pctile(fieldSpreads, 0.95).toFixed(1)}L  (real: ~25L)`)
    console.log()
    console.log('AVG WINNING ODDS:')
    console.log(`  Mean: ${mean(odds1st).toFixed(1)}-1  (real: ~5-7-1)`)
    console.log()
    console.log('AVG ODDS BY FINISH POSITION:')
    for (let p = 0; p < 6; p++) {
      console.log(`  ${p+1}${['st','nd','rd','th','th','th'][p]}: ${mean(oddsByPos[p]!).toFixed(1)}-1`)
    }
  })
})
