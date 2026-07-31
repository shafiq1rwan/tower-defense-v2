/** Troop definitions.
 *
 *  Frame ranges below were read straight off the Tiny Swords sheets: every
 *  troop sheet is a grid of 192px cells, laid out as
 *  `row 0 = idle, row 1 = run, row 2+ = directional attacks`. We only ever need
 *  the right-facing attack row — enemy sprites are the same art flipped.
 */

export interface Rig {
  /** Size of one square cell in the sheet. */
  frame: number;
  /** Height of the character *inside* the cell, in source pixels. Health bars
   *  and damage numbers anchor off this rather than the mostly-empty frame. */
  bodyH: number;
  idle: [number, number];
  walk: [number, number];
  attack: [number, number];
  /** Index *within* the attack range at which damage/projectile is released. */
  hit: number;
  idleFps: number;
  walkFps: number;
  attackFps: number;
}

export const RIGS: Record<string, Rig> = {
  // 6 x 8 grid
  warrior: { frame: 192, bodyH: 82, idle: [0, 5], walk: [6, 11], attack: [12, 17], hit: 3, idleFps: 8, walkFps: 11, attackFps: 13 },
  // 6 x 6 grid — attack row 3 is the flat, side-on axe swing
  pawn: { frame: 192, bodyH: 60, idle: [0, 5], walk: [6, 11], attack: [18, 23], hit: 3, idleFps: 8, walkFps: 12, attackFps: 14 },
  // 8 x 7 grid — row 4 is the level shot; the string is loosed on frame 5
  archer: { frame: 192, bodyH: 70, idle: [0, 5], walk: [8, 13], attack: [32, 39], hit: 5, idleFps: 8, walkFps: 11, attackFps: 12 },
  // 7 x 5 grid
  torch: { frame: 192, bodyH: 78, idle: [0, 6], walk: [7, 12], attack: [14, 19], hit: 3, idleFps: 9, walkFps: 12, attackFps: 13 },
  // 7 x 3 grid
  tnt: { frame: 192, bodyH: 70, idle: [0, 5], walk: [7, 12], attack: [14, 20], hit: 4, idleFps: 8, walkFps: 11, attackFps: 11 },
};

export interface TroopDef {
  key: string;
  name: string;
  blurb: string;
  /** Texture key loaded in PreloadScene. */
  tex: string;
  rig: keyof typeof RIGS;
  hp: number;
  attack: number;
  /** Gap between unit centres at which it stops and swings. */
  range: number;
  /** Milliseconds between swings. */
  interval: number;
  /** Design pixels per second. */
  speed: number;
  /** Splash radius; omit for single-target. */
  aoe?: number;
  projectile?: 'arrow' | 'bomb';
  /** How many times it gets shoved backwards across its health bar. */
  knockbacks: number;
  scale: number;
}

export interface PlayerTroopDef extends TroopDef {
  cost: number;
  /** Recharge time before this troop can be deployed again, in ms. */
  cooldown: number;
  /** Drives upgrade pricing. */
  tier: number;
}

export interface EnemyTroopDef extends TroopDef {
  /** Gold paid out when it dies. */
  bounty: number;
  /** Shown on the boss banner; omit for rank-and-file. */
  boss?: boolean;
}

export const PLAYER_TROOPS: PlayerTroopDef[] = [
  {
    key: 'squire',
    name: 'Squire',
    blurb: 'Cheap and quick. Throw them at anything to buy time.',
    tex: 'pawn_blue',
    rig: 'pawn',
    cost: 55,
    cooldown: 2000,
    hp: 130,
    attack: 20,
    range: 62,
    interval: 900,
    speed: 66,
    knockbacks: 1,
    scale: 1,
    tier: 1,
  },
  {
    key: 'torchman',
    name: 'Torchman',
    blurb: 'Sprints down the lane and burns whatever it reaches first.',
    tex: 'torch_blue',
    rig: 'torch',
    cost: 105,
    cooldown: 3800,
    hp: 215,
    attack: 36,
    range: 66,
    interval: 1000,
    speed: 84,
    knockbacks: 2,
    scale: 1,
    tier: 2,
  },
  {
    key: 'knight',
    name: 'Knight',
    blurb: 'Slow, armoured, and very hard to shift. Your wall.',
    tex: 'warrior_blue',
    rig: 'warrior',
    cost: 200,
    cooldown: 6500,
    hp: 740,
    attack: 66,
    range: 70,
    interval: 1250,
    speed: 46,
    knockbacks: 3,
    scale: 1.04,
    tier: 3,
  },
  {
    key: 'archer',
    name: 'Archer',
    blurb: 'Shoots clean over the front line. Fragile if reached.',
    tex: 'archer_blue',
    rig: 'archer',
    cost: 245,
    cooldown: 8000,
    hp: 210,
    attack: 84,
    range: 310,
    interval: 1700,
    speed: 42,
    projectile: 'arrow',
    knockbacks: 1,
    scale: 1,
    tier: 3,
  },
  {
    key: 'bombardier',
    name: 'Bombardier',
    blurb: 'Lobs dynamite that splashes across a whole cluster.',
    tex: 'tnt_blue',
    rig: 'tnt',
    cost: 430,
    cooldown: 13000,
    hp: 300,
    attack: 165,
    range: 265,
    interval: 2500,
    speed: 36,
    aoe: 120,
    projectile: 'bomb',
    knockbacks: 1,
    scale: 1,
    tier: 4,
  },
];

export const ENEMY_TROOPS: Record<string, EnemyTroopDef> = {
  imp: {
    key: 'imp',
    name: 'Imp',
    blurb: '',
    tex: 'pawn_red',
    rig: 'pawn',
    hp: 110,
    attack: 16,
    range: 60,
    interval: 850,
    speed: 72,
    knockbacks: 1,
    scale: 0.95,
    bounty: 24,
  },
  torcher: {
    key: 'torcher',
    name: 'Torch Goblin',
    blurb: '',
    tex: 'torch_red',
    rig: 'torch',
    hp: 235,
    attack: 32,
    range: 64,
    interval: 1000,
    speed: 62,
    knockbacks: 2,
    scale: 1,
    bounty: 42,
  },
  sniper: {
    key: 'sniper',
    name: 'Crossbowman',
    blurb: '',
    tex: 'archer_red',
    rig: 'archer',
    hp: 200,
    attack: 60,
    range: 300,
    interval: 1800,
    speed: 38,
    projectile: 'arrow',
    knockbacks: 1,
    scale: 1,
    bounty: 82,
  },
  sapper: {
    key: 'sapper',
    name: 'Sapper',
    blurb: '',
    tex: 'tnt_red',
    rig: 'tnt',
    hp: 285,
    attack: 105,
    range: 250,
    interval: 2600,
    speed: 34,
    aoe: 110,
    projectile: 'bomb',
    knockbacks: 1,
    scale: 1,
    bounty: 112,
  },
  bruteguard: {
    key: 'bruteguard',
    name: 'Brute Guard',
    blurb: '',
    tex: 'warrior_red',
    rig: 'warrior',
    hp: 920,
    attack: 78,
    range: 70,
    interval: 1300,
    speed: 40,
    knockbacks: 3,
    scale: 1.04,
    bounty: 96,
  },
  warlord: {
    key: 'warlord',
    name: 'The Warlord',
    blurb: '',
    tex: 'warrior_red',
    rig: 'warrior',
    hp: 6400,
    attack: 240,
    range: 92,
    interval: 1600,
    speed: 26,
    aoe: 90,
    knockbacks: 4,
    scale: 1.62,
    bounty: 720,
    boss: true,
  },
  emberking: {
    key: 'emberking',
    name: 'The Ember King',
    blurb: '',
    tex: 'torch_red',
    rig: 'torch',
    hp: 12800,
    attack: 300,
    range: 104,
    interval: 1400,
    speed: 30,
    aoe: 110,
    knockbacks: 5,
    scale: 1.85,
    bounty: 1600,
    boss: true,
  },
};

export const troopByKey = (key: string): PlayerTroopDef =>
  PLAYER_TROOPS.find((t) => t.key === key) ?? PLAYER_TROOPS[0];
