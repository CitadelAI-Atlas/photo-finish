export interface TooltipDef {
  id: string
  trigger: string       // context key that triggers this tooltip
  title: string
  body: string
}

export const TOOLTIPS: TooltipDef[] = [
  {
    id: 'furlongs',
    trigger: 'distance',
    title: 'Furlongs',
    body: '1 furlong = ⅛ mile. A 6-furlong race is ¾ of a mile — a sprint.',
  },
  {
    id: 'favorite',
    trigger: 'favorite',
    title: 'The Favorite',
    body: "The crowd's top pick — shortest odds on the board. Wins about 1 in 3 races.",
  },
  {
    id: 'odds',
    trigger: 'odds',
    title: 'Reading the Odds',
    body: '"4-1" means you win $4 for every $1 bet, plus your stake back. A $2 bet at 4-1 pays $10.',
  },
  {
    id: 'morning_line',
    trigger: 'morning_line',
    title: 'Morning Line',
    body: "The track handicapper's best guess at the odds, set before betting opens. Not gospel — just an opinion.",
  },
  {
    id: 'place_bet',
    trigger: 'place',
    title: 'Place Bet',
    body: 'Pays if your horse finishes 1st or 2nd. Safer than Win, smaller return.',
  },
  {
    id: 'show_bet',
    trigger: 'show',
    title: 'Show Bet',
    body: 'Pays if your horse finishes 1st, 2nd, or 3rd. The safest straight bet.',
  },
  {
    id: 'quinella',
    trigger: 'quinella',
    title: 'Quinella',
    body: 'Pick the top two finishers in either order. Easier than Exacta, pays less.',
  },
  {
    id: 'exacta',
    trigger: 'exacta',
    title: 'Exacta',
    body: 'Pick 1st and 2nd in exact order. Hard to hit, but it pays.',
  },
  {
    id: 'claiming',
    trigger: 'claiming',
    title: 'Claiming Race',
    body: 'Any horse here can be bought for the claiming price. Keeps the competition honest.',
  },
  {
    id: 'maiden',
    trigger: 'maiden',
    title: 'Maiden',
    body: "A horse that hasn't won a race yet. Everyone starts here.",
  },
  {
    id: 'allowance',
    trigger: 'allowance',
    title: 'Allowance Race',
    body: 'Better quality than claiming. Horses compete under conditions set by the track.',
  },
  {
    id: 'stakes',
    trigger: 'stakes',
    title: 'Stakes Race',
    body: 'The big leagues. The best horses, biggest purses, most prestige.',
  },
  {
    id: 'running_style_e',
    trigger: 'early_speed',
    title: 'Early Speed',
    body: 'This horse likes to lead from the front. Great when the pace is slow, risky when it\'s fast.',
  },
  {
    id: 'running_style_s',
    trigger: 'closer',
    title: 'Closer',
    body: 'Sits at the back and makes one big run. Loves a hot pace that tires the leaders.',
  },
  {
    id: 'running_style_p',
    trigger: 'presser',
    title: 'Presser',
    body: 'Stalks just behind the leaders, then pounces in the stretch. The versatile style.',
  },
  {
    id: 'surface_dirt',
    trigger: 'dirt',
    title: 'Dirt Track',
    body: 'The main track — compacted dirt. Most US races are run here.',
  },
  {
    id: 'surface_turf',
    trigger: 'turf',
    title: 'Turf',
    body: 'Grass course. Some horses love it, some hate it. A surface switch is always a gamble.',
  },
  {
    id: 'scratched',
    trigger: 'scratch',
    title: 'Scratched',
    body: 'This horse has been withdrawn before the race. Bad foot, bad draw, bad weather — it happens.',
  },
  {
    id: 'photo_finish',
    trigger: 'photo_finish',
    title: 'Photo Finish!',
    body: 'Too close to call with the naked eye. The camera decides.',
  },
  {
    id: 'longshot',
    trigger: 'longshot',
    title: 'Longshot',
    body: 'A horse at 20-1 wins about 1 in 20 races. Today might be that race.',
  },
  {
    id: 'tote_board',
    trigger: 'tote',
    title: 'The Tote Board',
    body: 'Odds are set by the crowd, not the track. More money on a horse = shorter odds. The board is the market.',
  },
  {
    id: 'daily_double',
    trigger: 'daily_double',
    title: 'Daily Double',
    body: 'Pick the winner of two consecutive races. Both must win or you lose it all.',
  },
]
