/** Design-space layout. Everything is authored against a 720px-tall stage; the
 *  width flexes with the device aspect ratio (see `computeGameSize`). */
export const STAGE_H = 720;
export const MIN_STAGE_W = 1024;
export const MAX_STAGE_W = 1760;

/** Vertical anchors, in design pixels. */
export const HORIZON_Y = 300; // where sky meets grass
export const GROUND_Y = 484; // the line troops' feet walk along
export const VILLAGE_Y = 368; // feet line for the distant buildings
export const HUD_TOP = 540; // top edge of the deploy bar
export const TOPBAR_H = 62;

/** Troops render at 1.25x their source art so a crowd reads clearly at 720p. */
export const UNIT_SCALE = 1.25;

/** Castle placement. The wall face each side defends is derived from the
 *  sprite's own width (see Base), so only the framing constants live here. */
export const CASTLE_BASELINE = GROUND_Y + 34; // where a castle's footings sit
export const SPAWN_OFFSET = 52; // wall face -> where troops appear
export const LANE_PAD = 44; // how far past its own wall a troop can be shoved

/** Fixed-step simulation. Battles run deterministically at 60 Hz regardless of
 *  render rate, which keeps balance identical on a 144 Hz monitor and a phone. */
export const SIM_STEP_MS = 1000 / 60;
export const MAX_STEPS_PER_FRAME = 5;

export const COLORS = {
  ink: 0x2a1f2d,
  inkSoft: 0x4a3a3f,
  parchment: 0xf6e7c8,
  parchmentDim: 0xcbb492,
  gold: 0xffc53d,
  goldLight: 0xffe9a8,
  goldDeep: 0xc57a17,
  wood: 0x7d4b2a,
  woodDark: 0x452817,
  woodLight: 0xa9713f,
  blue: 0x4f86d6,
  blueDeep: 0x2d4f8c,
  red: 0xd0442c,
  redDeep: 0x8a2617,
  green: 0x74b83c,
  greenDeep: 0x437a1f,
  skyTop: 0x6fc4ef,
  skyLow: 0xc9ecfa,
  grass: 0x7cb043,
  night: 0x1b2432,
  white: 0xffffff,
} as const;

export const CSS = {
  ink: '#2a1f2d',
  parchment: '#f6e7c8',
  gold: '#ffc53d',
  goldLight: '#ffe9a8',
  goldDeep: '#c57a17',
  wood: '#7d4b2a',
  woodDark: '#452817',
  blue: '#4f86d6',
  red: '#d0442c',
  green: '#74b83c',
  white: '#ffffff',
  danger: '#ff7a5c',
} as const;

export const FONT_DISPLAY = '"Luckiest Guy", system-ui, sans-serif';
export const FONT_UI = '"Baloo 2", system-ui, sans-serif';

export const DEPTH = {
  sky: 0,
  hills: 10, // above the horizon, so the ground may cover their feet
  ground: 20,
  midScenery: 30, // village + bushes standing *on* the ground, behind troops
  base: 50,
  corpse: 55,
  units: 100, // + per-unit lane offset
  nearScenery: 260, // foreground clutter, drawn over the crowd
  projectiles: 400,
  fx: 500,
  floatText: 600,
  hud: 1000,
  overlay: 2000,
} as const;

/** Two sides of the lane. Player pushes right, enemy pushes left. */
export type Side = 'player' | 'enemy';
export const facingOf = (side: Side) => (side === 'player' ? 1 : -1);
export const opposite = (side: Side): Side => (side === 'player' ? 'enemy' : 'player');
