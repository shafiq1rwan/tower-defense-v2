/** Stage scripts: what the goblins send at you, and when. */

export interface Wave {
  /** Seconds after the battle starts. */
  at: number;
  type: string;
  count: number;
  /** Milliseconds between each spawn in the group. */
  gap: number;
}

/** Reinforcements released once the enemy castle drops below a health fraction. */
export interface Trigger {
  atHpFrac: number;
  type: string;
  count: number;
  gap: number;
  announce?: string;
}

export interface StageDef {
  name: string;
  subtitle: string;
  baseHp: number;
  reward: number;
  biome: 'green' | 'sand';
  castle: string;
  waves: Wave[];
  triggers?: Trigger[];
  /** Endless pressure once the script runs dry, so stalling never pays. */
  loop?: { after: number; every: number; types: string[] };
  /** Troop unlocked the first time this stage is cleared. */
  unlocks?: string;
}

const w = (at: number, type: string, count = 1, gap = 700): Wave => ({ at, type, count, gap });

export const STAGES: StageDef[] = [
  {
    name: 'Meadow Skirmish',
    subtitle: 'A raiding party is testing your gate.',
    baseHp: 1500,
    reward: 280,
    biome: 'green',
    castle: 'goblin_house',
    unlocks: 'knight',
    waves: [
      w(3, 'imp'),
      w(10, 'imp', 2, 900),
      w(20, 'torcher'),
      w(30, 'imp', 3, 700),
      w(42, 'torcher', 2, 1200),
      w(56, 'imp', 4, 600),
      w(70, 'torcher', 2, 900),
    ],
    triggers: [{ atHpFrac: 0.5, type: 'torcher', count: 3, gap: 800, announce: 'The camp stirs!' }],
    loop: { after: 85, every: 11000, types: ['imp', 'imp', 'torcher'] },
  },
  {
    name: 'The Long Field',
    subtitle: 'They brought crossbows this time.',
    baseHp: 2400,
    reward: 400,
    biome: 'green',
    castle: 'goblin_house',
    unlocks: 'archer',
    waves: [
      w(4, 'imp', 2, 800),
      w(14, 'torcher'),
      w(24, 'sniper'),
      w(34, 'imp', 4, 600),
      w(46, 'torcher', 2, 900),
      w(58, 'sniper', 2, 1400),
      w(72, 'torcher', 3, 800),
      w(88, 'imp', 5, 500),
    ],
    triggers: [{ atHpFrac: 0.45, type: 'sniper', count: 2, gap: 1200, announce: 'Crossbows to the wall!' }],
    loop: { after: 100, every: 10000, types: ['imp', 'torcher', 'sniper'] },
  },
  {
    name: "Sapper's Ridge",
    subtitle: 'Mind the dynamite.',
    baseHp: 3200,
    reward: 560,
    biome: 'green',
    castle: 'goblin_house',
    waves: [
      w(4, 'torcher', 2, 900),
      w(16, 'sapper'),
      w(28, 'imp', 4, 500),
      w(38, 'sniper', 2, 1100),
      w(52, 'sapper'),
      w(64, 'torcher', 3, 800),
      w(80, 'sapper', 2, 2000),
      w(96, 'imp', 6, 450),
    ],
    triggers: [{ atHpFrac: 0.4, type: 'sapper', count: 2, gap: 1600, announce: 'Sappers forward!' }],
    loop: { after: 110, every: 9500, types: ['torcher', 'sapper', 'imp', 'sniper'] },
  },
  {
    name: 'Broken Palisade',
    subtitle: 'Their guard captains have joined the line.',
    baseHp: 4400,
    reward: 760,
    biome: 'green',
    castle: 'castle_red',
    unlocks: 'bombardier',
    waves: [
      w(4, 'imp', 3, 600),
      w(15, 'bruteguard'),
      w(28, 'sniper', 2, 1100),
      w(40, 'torcher', 3, 700),
      w(54, 'bruteguard'),
      w(66, 'sapper', 2, 1800),
      w(82, 'bruteguard', 2, 2600),
      w(100, 'torcher', 4, 700),
    ],
    triggers: [{ atHpFrac: 0.5, type: 'bruteguard', count: 2, gap: 2400, announce: 'The guard rallies!' }],
    loop: { after: 115, every: 9000, types: ['torcher', 'bruteguard', 'sniper', 'imp'] },
  },
  {
    name: 'Dust Road',
    subtitle: 'No cover, no mercy.',
    baseHp: 5600,
    reward: 980,
    biome: 'sand',
    castle: 'castle_red',
    waves: [
      w(3, 'torcher', 3, 700),
      w(16, 'sapper', 2, 1600),
      w(30, 'bruteguard'),
      w(42, 'sniper', 3, 1000),
      w(56, 'bruteguard', 2, 2400),
      w(72, 'sapper', 2, 1800),
      w(88, 'imp', 8, 350),
      w(104, 'bruteguard', 2, 2200),
    ],
    triggers: [{ atHpFrac: 0.35, type: 'sapper', count: 3, gap: 1400, announce: 'Powder kegs incoming!' }],
    loop: { after: 120, every: 8500, types: ['bruteguard', 'sapper', 'torcher', 'sniper'] },
  },
  {
    name: 'Ironwood Gate',
    subtitle: 'The last camp before the throne.',
    baseHp: 7200,
    reward: 1300,
    biome: 'sand',
    castle: 'castle_red',
    waves: [
      w(3, 'bruteguard'),
      w(14, 'torcher', 4, 600),
      w(28, 'sniper', 3, 900),
      w(42, 'bruteguard', 2, 2200),
      w(58, 'sapper', 3, 1500),
      w(74, 'bruteguard', 2, 2000),
      w(92, 'torcher', 5, 550),
      w(110, 'sniper', 3, 900),
    ],
    triggers: [{ atHpFrac: 0.4, type: 'bruteguard', count: 3, gap: 1800, announce: 'Gate guard, sally out!' }],
    loop: { after: 125, every: 8000, types: ['bruteguard', 'torcher', 'sapper', 'sniper', 'imp'] },
  },
  {
    name: "Warlord's Camp",
    subtitle: 'Something very large is waiting.',
    baseHp: 8600,
    reward: 1900,
    biome: 'sand',
    castle: 'castle_purple',
    waves: [
      w(4, 'torcher', 3, 700),
      w(18, 'bruteguard', 2, 2000),
      w(34, 'sapper', 2, 1600),
      w(48, 'sniper', 3, 900),
      w(64, 'bruteguard', 2, 2000),
      w(84, 'torcher', 5, 550),
    ],
    triggers: [
      { atHpFrac: 0.6, type: 'warlord', count: 1, gap: 0, announce: 'THE WARLORD AWAKENS' },
      { atHpFrac: 0.25, type: 'bruteguard', count: 3, gap: 1500, announce: 'Guard, to the Warlord!' },
    ],
    loop: { after: 100, every: 8000, types: ['bruteguard', 'sapper', 'torcher', 'sniper'] },
  },
  {
    name: 'Ember Throne',
    subtitle: 'End it.',
    baseHp: 13000,
    reward: 3200,
    biome: 'sand',
    castle: 'castle_purple',
    waves: [
      w(3, 'bruteguard', 2, 1800),
      w(20, 'sapper', 3, 1400),
      w(36, 'sniper', 4, 800),
      w(52, 'bruteguard', 3, 1800),
      w(72, 'torcher', 6, 500),
      w(92, 'sapper', 3, 1400),
    ],
    triggers: [
      { atHpFrac: 0.7, type: 'warlord', count: 1, gap: 0, announce: 'THE WARLORD RETURNS' },
      { atHpFrac: 0.35, type: 'emberking', count: 1, gap: 0, announce: 'THE EMBER KING RISES' },
      { atHpFrac: 0.15, type: 'bruteguard', count: 4, gap: 1200, announce: 'Everything they have left!' },
    ],
    loop: { after: 110, every: 7500, types: ['bruteguard', 'torcher', 'sapper', 'sniper', 'imp'] },
  },
];

/** Troops the player owns from the very first battle. */
export const STARTING_TROOPS = ['squire', 'torchman'];

export function unlockedTroops(cleared: number): string[] {
  const owned = [...STARTING_TROOPS];
  STAGES.slice(0, cleared).forEach((s) => {
    if (s.unlocks && !owned.includes(s.unlocks)) owned.push(s.unlocks);
  });
  return owned;
}
