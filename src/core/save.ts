/** Player progress, persisted to localStorage. */

const KEY = 'tiny-siege:save:v1';

export type UpgradeId = 'income' | 'wallet' | 'castle' | 'cannon';

export interface SaveData {
  v: number;
  gold: number;
  /** Number of stages cleared, i.e. the index of the first locked stage. */
  cleared: number;
  best: Record<number, number>; // stage index -> fastest clear, ms
  upgrades: Record<UpgradeId, number>;
  troops: Record<string, number>; // troop key -> level (1-based)
  settings: { sfx: boolean; music: boolean; speed: 1 | 2 };
}

export const MAX_UPGRADE_LEVEL = 9; // levels are 0..9
export const MAX_TROOP_LEVEL = 10; // levels are 1..10

const fresh = (): SaveData => ({
  v: 1,
  gold: 0,
  cleared: 0,
  best: {},
  upgrades: { income: 0, wallet: 0, castle: 0, cannon: 0 },
  troops: {},
  settings: { sfx: true, music: true, speed: 1 },
});

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = fresh();
    return {
      ...base,
      ...parsed,
      best: { ...base.best, ...parsed.best },
      upgrades: { ...base.upgrades, ...parsed.upgrades },
      troops: { ...base.troops, ...parsed.troops },
      settings: { ...base.settings, ...parsed.settings },
    };
  } catch {
    // Private-mode Safari and friends: run from memory rather than crash.
    return fresh();
  }
}

class Save {
  data: SaveData = load();

  flush() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable — progress simply won't survive a reload */
    }
  }

  addGold(n: number) {
    this.data.gold = Math.max(0, Math.round(this.data.gold + n));
    this.flush();
  }

  spendGold(n: number): boolean {
    if (this.data.gold < n) return false;
    this.data.gold -= n;
    this.flush();
    return true;
  }

  upgradeLevel(id: UpgradeId) {
    return this.data.upgrades[id];
  }

  troopLevel(key: string) {
    return this.data.troops[key] ?? 1;
  }

  setTroopLevel(key: string, level: number) {
    this.data.troops[key] = level;
    this.flush();
  }

  recordClear(stage: number, elapsedMs: number, reward: number) {
    const prev = this.data.best[stage];
    if (prev === undefined || elapsedMs < prev) this.data.best[stage] = elapsedMs;
    if (stage >= this.data.cleared) this.data.cleared = stage + 1;
    this.addGold(reward);
  }

  reset() {
    this.data = fresh();
    this.flush();
  }
}

export const save = new Save();

/* ------------------------------------------------------------------ */
/* Upgrade curves                                                      */
/* ------------------------------------------------------------------ */

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  blurb: string;
  icon: string;
  /** Human-readable effect at a given level. */
  valueAt: (level: number) => string;
  costAt: (level: number) => number;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'income',
    name: 'Treasury',
    blurb: 'Gold earned each second during battle.',
    icon: 'ui-gold',
    valueAt: (l) => `${incomeRate(l)}/s`,
    costAt: (l) => Math.round(260 * Math.pow(1.55, l)),
  },
  {
    id: 'wallet',
    name: 'Coffers',
    blurb: 'How much gold you can hold at once.',
    icon: 'ui-gold',
    valueAt: (l) => `${walletCap(l)}`,
    costAt: (l) => Math.round(230 * Math.pow(1.5, l)),
  },
  {
    id: 'castle',
    name: 'Ramparts',
    blurb: 'Hit points of your own castle.',
    icon: 'ui-castle',
    valueAt: (l) => `${castleHp(l)}`,
    costAt: (l) => Math.round(300 * Math.pow(1.5, l)),
  },
  {
    id: 'cannon',
    name: 'Cannon',
    blurb: 'Damage and recharge speed of the castle cannon.',
    icon: 'ui-cannon',
    valueAt: (l) => `${cannonDamage(l)} dmg / ${(cannonCharge(l) / 1000).toFixed(0)}s`,
    costAt: (l) => Math.round(340 * Math.pow(1.55, l)),
  },
];

export const incomeRate = (level: number) => 26 + level * 7;
export const walletCap = (level: number) => 900 + level * 360;
export const castleHp = (level: number) => 2600 + level * 950;
export const cannonDamage = (level: number) => 320 + level * 190;
export const cannonCharge = (level: number) => 26000 - level * 1400;

/** Troop levels scale hp and attack together. */
export const troopMultiplier = (level: number) => 1 + (level - 1) * 0.17;
export const troopUpgradeCost = (tier: number, level: number) =>
  Math.round(110 * tier * Math.pow(1.44, level - 1));
