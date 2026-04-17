import type { Race, RaceResult, MarketSnapshot, RaceRecap } from './types'
import { JOCKEYS } from '@/data/jockeys'

// ── Pace Narrative ─────────────────────────────────────────────

function getHorseName(race: Race, horseId: string): string {
  return race.entries.find(e => e.horse.id === horseId)?.horse.name ?? 'Unknown'
}

function getRunningStyle(race: Race, horseId: string): string {
  return race.entries.find(e => e.horse.id === horseId)?.horse.runningStyle ?? 'P'
}

function getJockeyName(race: Race, horseId: string): string {
  const jockeyId = race.entries.find(e => e.horse.id === horseId)?.horse.jockeyId
  return JOCKEYS.find(j => j.id === jockeyId)?.name ?? 'the jockey'
}

function buildPaceNarrative(race: Race, result: RaceResult): string {
  const winner = result.finishOrder[0]!
  const winnerName = getHorseName(race, winner.horseId)
  const winnerStyle = getRunningStyle(race, winner.horseId)

  const speedHorses = race.entries
    .filter(e => !e.scratched && e.horse.runningStyle === 'E')
    .map(e => e.horse.name)

  switch (result.paceScenario) {
    case 'hot': {
      const duelers = speedHorses.slice(0, 2).join(' and ')
      if (winnerStyle === 'S') {
        return `Hot early pace — ${duelers} dueled for the lead and tired each other out. ${winnerName} closed from behind to steal it.`
      }
      return `Hot early pace — ${duelers} fought for the lead. ${winnerName} held on despite the fast fractions.`
    }
    case 'slow': {
      if (winnerStyle === 'E' || winnerStyle === 'P') {
        return `Slow pace — nobody wanted the lead. ${winnerName} took advantage of the soft fractions and never looked back.`
      }
      return `Slow pace favored the front-runners, but ${winnerName} still found enough late to get up.`
    }
    case 'honest':
      return `Honest pace — the race set up fairly. ${winnerName} was simply the best horse today.`
  }
}

// ── Player Horse Story ─────────────────────────────────────────

function buildPlayerHorseStory(
  race: Race,
  result: RaceResult,
  playerHorseId: string,
): string {
  const finish = result.finishOrder.find(f => f.horseId === playerHorseId)
  if (!finish) return ''

  const name = getHorseName(race, playerHorseId)
  const style = getRunningStyle(race, playerHorseId)
  const pos = finish.position
  const jockey = getJockeyName(race, playerHorseId)

  if (pos === 1) {
    if (finish.margin === '' || finish.deadHeat) {
      return `${name} crossed the wire first! ${jockey} rode a perfect race.`
    }
    return `${name} got it done, winning by ${result.finishOrder[1]?.margin ?? 'a margin'}. ${jockey} timed the move perfectly.`
  }

  if (pos === 2) {
    const winnerName = getHorseName(race, result.finishOrder[0]!.horseId)
    if (style === 'E') {
      return `${name} set the pace but couldn't hold off ${winnerName} in the stretch. Gallant effort.`
    }
    return `${name} ran a strong race but just couldn't catch ${winnerName}. Second by ${finish.margin}.`
  }

  if (pos === 3) {
    return `${name} finished third — in the money but not quite good enough. ${finish.margin} behind the runner-up.`
  }

  // 4th or worse
  if (style === 'E' && result.paceScenario === 'hot') {
    return `${name} was caught up in a speed duel and faded in the stretch. The hot pace was the story.`
  }
  if (style === 'S' && result.paceScenario === 'slow') {
    return `${name} never had the pace to close into. Slow fractions worked against the closers today.`
  }
  return `${name} finished ${ordinal(pos)}, beaten ${finish.margin}. Not their day.`
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])!
}

// ── Factor Tags ────────────────────────────────────────────────

function buildFactorTags(race: Race, result: RaceResult): Map<string, string[]> {
  const tags = new Map<string, string[]>()

  for (const fp of result.finishOrder) {
    const entry = race.entries.find(e => e.horse.id === fp.horseId)
    if (!entry) continue

    const horseTags: string[] = []
    const h = entry.horse

    // Running style tag
    if (h.runningStyle === 'E') horseTags.push('Led early')
    else if (h.runningStyle === 'S') horseTags.push('Closed late')
    else horseTags.push('Stalked')

    // Pace fit
    if (result.paceScenario === 'hot' && h.runningStyle === 'S') horseTags.push('Pace fit')
    if (result.paceScenario === 'slow' && (h.runningStyle === 'E' || h.runningStyle === 'P')) horseTags.push('Pace fit')

    // Surface / quirk
    if (h.quirk) horseTags.push(h.quirk.label)

    tags.set(fp.horseId, horseTags)
  }

  return tags
}

// ── Lesson Moments ─────────────────────────────────────────────

export function detectLessonMoment(
  race: Race,
  result: RaceResult,
  market: MarketSnapshot,
  playerHorseId: string,
  seenLessons: Set<string>,
): { lessonId: string; text: string } | null {
  const playerFinish = result.finishOrder.find(f => f.horseId === playerHorseId)
  if (!playerFinish) return null

  const playerStyle = getRunningStyle(race, playerHorseId)
  const winnerId = result.finishOrder[0]?.horseId ?? ''
  const winnerOdds = market.oddsByHorse.get(winnerId)?.odds ?? 0

  // Pace kills speed
  if (
    !seenLessons.has('pace_kills_speed') &&
    playerStyle === 'E' &&
    result.paceScenario === 'hot' &&
    playerFinish.position > 3
  ) {
    return {
      lessonId: 'pace_kills_speed',
      text: 'Pace kills speed. When multiple horses fight for the lead, they tire each other out — and the closers pounce.',
    }
  }

  // Favorite loses
  if (
    !seenLessons.has('favorites_lose') &&
    market.favoriteId === playerHorseId &&
    playerFinish.position > 1
  ) {
    return {
      lessonId: 'favorites_lose',
      text: "Favorites win ~33% of the time. That means they lose ~67% of the time. Upsets aren't flukes — they're the norm.",
    }
  }

  // Beat the crowd
  if (
    !seenLessons.has('beat_the_crowd') &&
    playerFinish.position === 1 &&
    playerHorseId !== market.favoriteId
  ) {
    return {
      lessonId: 'beat_the_crowd',
      text: "You just beat the crowd. They liked the favorite. You saw something they didn't.",
    }
  }

  // Longshot wins
  if (
    !seenLessons.has('longshot_wins') &&
    winnerOdds >= 10 &&
    winnerId !== playerHorseId
  ) {
    return {
      lessonId: 'longshot_wins',
      text: `A ${winnerOdds}-1 shot just won. Longshots hit more often than you'd think — about 1 in ${Math.round(1 / (1 / (winnerOdds + 1)))} races at these odds.`,
    }
  }

  // Slow pace helps speed
  if (
    !seenLessons.has('slow_pace_speed') &&
    result.paceScenario === 'slow' &&
    playerStyle === 'S' &&
    playerFinish.position > 3
  ) {
    return {
      lessonId: 'slow_pace_speed',
      text: "Slow pace hurts closers. When nobody pushes the pace, front-runners save energy and the closers have nothing to run down.",
    }
  }

  return null
}

// ── Build Full Recap ───────────────────────────────────────────

export function buildRecap(
  race: Race,
  result: RaceResult,
  market: MarketSnapshot,
  playerHorseId: string,
  seenLessons: Set<string>,
): RaceRecap {
  const paceNarrative = buildPaceNarrative(race, result)
  const playerHorseStory = buildPlayerHorseStory(race, result, playerHorseId)
  const factorTags = buildFactorTags(race, result)
  const lesson = detectLessonMoment(race, result, market, playerHorseId, seenLessons)

  return {
    paceNarrative,
    playerHorseStory,
    factorTags,
    lessonMoment: lesson?.text ?? null,
  }
}
