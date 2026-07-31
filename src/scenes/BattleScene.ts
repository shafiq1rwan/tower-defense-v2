import Phaser from 'phaser';

import {
  DEPTH,
  GROUND_Y,
  LANE_PAD,
  MAX_STEPS_PER_FRAME,
  SIM_STEP_MS,
  SPAWN_OFFSET,
  type Side,
} from '../core/constants';
import { audio } from '../core/audio';
import {
  cannonCharge,
  cannonDamage,
  castleHp,
  incomeRate,
  save,
  troopMultiplier,
  walletCap,
} from '../core/save';
import { STAGES, unlockedTroops, type StageDef } from '../data/stages';
import { ENEMY_TROOPS, troopByKey, type PlayerTroopDef } from '../data/troops';

import { Battlefield } from '../battle/Battlefield';
import { Base } from '../battle/Base';
import { Effects } from '../battle/Effects';
import { Projectile } from '../battle/Projectile';
import { Unit } from '../battle/Unit';
import type { World } from '../battle/types';

export interface BattleLaunchData {
  stageIndex: number;
}

interface PendingSpawn {
  at: number;
  type: string;
}

/** A cannonball in flight. Simulated in the fixed step alongside units, so it
 *  freezes under pause and scales with 2x speed like everything else. */
interface Cannonball {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  trailTimer: number;
  alive: boolean;
}

const CANNON_VOLLEY = 3;
const CANNON_STAGGER_MS = 190;
const CANNON_GRAVITY = 1400;
const CANNON_BLAST_RADIUS = 130;
/** Fraction of cannon damage dealt to the enemy castle by a ball landing on it. */
const CANNON_BASE_CHIP = 0.35;

export type Outcome = 'none' | 'win' | 'lose';

export class BattleScene extends Phaser.Scene {
  stageIndex = 0;
  stage!: StageDef;
  roster: PlayerTroopDef[] = [];

  units: Unit[] = [];
  projectiles: Projectile[] = [];
  playerBase!: Base;
  enemyBase!: Base;
  effects!: Effects;

  gold = 0;
  goldCap = 0;
  income = 0;
  cannon = 0;
  cannonMax = 0;
  cooldowns: Record<string, number> = {};

  elapsed = 0;
  outcome: Outcome = 'none';
  paused = false;
  speed: 1 | 2 = 1;

  private battlefield!: Battlefield;
  private world!: World;
  private bars!: Phaser.GameObjects.Graphics;
  private accumulator = 0;
  private pending: PendingSpawn[] = [];
  private firedTriggers = new Set<number>();
  private loopCycles = 0;
  private loopTimer = 0;
  private enemyScale = 1;
  private playerSpawnX = 0;
  private enemySpawnX = 0;
  private resolved = false;
  private cannonballs: Cannonball[] = [];
  private cannonQueue: Array<{ delay: number; targetX: number }> = [];

  constructor() {
    super('Battle');
  }

  create(data: BattleLaunchData) {
    this.stageIndex = data?.stageIndex ?? 0;
    this.stage = STAGES[this.stageIndex] ?? STAGES[0];

    // Reset per-battle state (scenes are reused across restarts).
    this.units = [];
    this.projectiles = [];
    this.cooldowns = {};
    this.pending = [];
    this.firedTriggers = new Set();
    this.loopCycles = 0;
    this.loopTimer = 0;
    this.elapsed = 0;
    this.accumulator = 0;
    this.outcome = 'none';
    this.resolved = false;
    this.paused = false;
    this.speed = save.data.settings.speed;
    this.cannonballs = [];
    this.cannonQueue = [];

    this.enemyScale = 1 + this.stageIndex * 0.05;

    this.battlefield = new Battlefield(this, this.stage.biome);
    this.effects = new Effects(this);
    this.bars = this.add.graphics().setDepth(DEPTH.fx - 1);

    // The lane bounds depend on where the castles land, and the castles need a
    // World to build themselves — so the lane is filled in straight after.
    this.world = {
      scene: this,
      effects: this.effects,
      units: this.units,
      baseOf: (side: Side) => (side === 'player' ? this.playerBase : this.enemyBase),
      spawnProjectile: (opts) => {
        this.projectiles.push(new Projectile(this.world, opts));
      },
      onDeath: (unit) => this.handleDeath(unit),
      laneMin: 0,
      laneMax: this.scale.width,
    };

    this.playerBase = new Base(this.world, 'player', 'castle_blue', castleHp(save.upgradeLevel('castle')));
    this.enemyBase = new Base(this.world, 'enemy', this.stage.castle, this.stage.baseHp);

    this.world.laneMin = this.playerBase.x - LANE_PAD;
    this.world.laneMax = this.enemyBase.x + LANE_PAD;
    this.playerSpawnX = this.playerBase.x + SPAWN_OFFSET;
    this.enemySpawnX = this.enemyBase.x - SPAWN_OFFSET;

    // Economy.
    this.income = incomeRate(save.upgradeLevel('income'));
    this.goldCap = walletCap(save.upgradeLevel('wallet'));
    this.gold = Math.min(this.goldCap, 180);
    this.cannonMax = cannonCharge(save.upgradeLevel('cannon'));
    this.cannon = this.cannonMax * 0.35;

    this.roster = unlockedTroops(save.data.cleared).map(troopByKey);

    this.buildSchedule();
    this.makeCannonballTexture();

    this.scene.launch('Hud', { stageIndex: this.stageIndex });
    this.scene.bringToTop('Hud');

    this.installKeys();
    this.cameras.main.fadeIn(300, 0, 0, 0);
    audio.startMusic('battle');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.effects?.destroy();
      this.projectiles.forEach((p) => p.destroy());
      this.units.forEach((u) => u.destroy());
      this.cannonballs.forEach((b) => b.sprite.destroy());
      this.cannonballs = [];
      this.cannonQueue = [];
      this.input.keyboard?.removeAllListeners();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Setup helpers                                                       */
  /* ------------------------------------------------------------------ */

  /** Flattens the stage's wave groups into a single time-ordered spawn list. */
  private buildSchedule() {
    for (const wave of this.stage.waves) {
      for (let i = 0; i < wave.count; i++) {
        this.pending.push({ at: wave.at * 1000 + i * wave.gap, type: wave.type });
      }
    }
    this.pending.sort((a, b) => a.at - b.at);
  }

  private makeCannonballTexture() {
    if (this.textures.exists('fx-cannonball')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // A chunky iron ball: dark body, rim shadow, specular glint up-left.
    g.fillStyle(0x14141c, 1).fillCircle(11, 11, 10);
    g.fillStyle(0x2e2e3a, 1).fillCircle(10, 10, 8.5);
    g.fillStyle(0x555564, 1).fillCircle(8, 8, 4);
    g.fillStyle(0x8b8b9c, 1).fillCircle(7, 7, 2);
    g.generateTexture('fx-cannonball', 22, 22);
    g.destroy();
  }

  private installKeys() {
    const kb = this.input.keyboard;
    if (!kb) return;

    kb.on('keydown', (e: KeyboardEvent) => {
      audio.unlock();
      const n = Number.parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= this.roster.length) {
        this.tryDeploy(this.roster[n - 1].key);
        return;
      }
      switch (e.key.toLowerCase()) {
        case ' ':
          this.fireCannon();
          break;
        case 'p':
        case 'escape':
          this.setPaused(!this.paused);
          break;
        case 'f':
          this.setSpeed(this.speed === 1 ? 2 : 1);
          break;
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Public controls (driven by the HUD)                                 */
  /* ------------------------------------------------------------------ */

  canAfford(key: string) {
    return this.gold >= troopByKey(key).cost;
  }

  cooldownFraction(key: string) {
    const def = troopByKey(key);
    const left = this.cooldowns[key] ?? 0;
    return left <= 0 ? 0 : left / def.cooldown;
  }

  tryDeploy(key: string): boolean {
    if (this.outcome !== 'none' || this.paused) return false;
    const def = troopByKey(key);

    if ((this.cooldowns[key] ?? 0) > 0 || this.gold < def.cost) {
      audio.play('deny');
      return false;
    }

    this.gold -= def.cost;
    this.cooldowns[key] = def.cooldown;

    const unit = new Unit(
      this.world,
      'player',
      def,
      this.playerSpawnX + Phaser.Math.Between(-10, 10),
      troopMultiplier(save.troopLevel(key)),
    );
    this.units.push(unit);
    audio.play('deploy');
    return true;
  }

  get cannonReady() {
    return this.cannon >= this.cannonMax;
  }

  /** Fires a volley of cannonballs from the castle roof: arcs, smoke trails,
   *  and an explosion + knockback where each one lands. Balls aim at where the
   *  goblins are thickest; spare shots go for the enemy castle itself. */
  fireCannon() {
    if (this.outcome !== 'none' || this.paused) return;
    if (!this.cannonReady) {
      audio.play('deny');
      return;
    }
    this.cannon = 0;

    this.pickCannonTargets(CANNON_VOLLEY).forEach((targetX, i) => {
      this.cannonQueue.push({ delay: i * CANNON_STAGGER_MS, targetX });
    });
    this.effects.flash(140);
  }

  /** Up to `count` aim points spread across the goblin line. Aim points closer
   *  than a blast radius to each other are merged, and the leftover shots are
   *  sent at the enemy castle instead of double-tapping the same target. */
  private pickCannonTargets(count: number): number[] {
    const xs = this.units
      .filter((u) => u.side === 'enemy' && u.alive)
      .map((u) => u.x)
      .sort((a, b) => a - b);

    const targets: number[] = [];
    if (xs.length > 0) {
      const slices = Math.min(count, xs.length);
      for (let i = 0; i < slices; i++) {
        // The median of each slice of the sorted line = one shot per cluster.
        const idx = Math.min(xs.length - 1, Math.floor(((i + 0.5) * xs.length) / slices));
        const x = xs[idx];
        if (targets.every((t) => Math.abs(t - x) > CANNON_BLAST_RADIUS * 0.8)) targets.push(x);
      }
    }
    while (targets.length < count) targets.push(this.enemyBase.x + 14);
    return targets;
  }

  private launchCannonball(targetX: number) {
    const castle = this.playerBase.sprite;
    const x0 = castle.x + castle.displayWidth * 0.16;
    const y0 = castle.y - castle.displayHeight * 0.86;

    // Solve the lob: pick a flight time from the distance, derive the launch
    // velocity that lands the ball on the target under CANNON_GRAVITY.
    const dx = targetX + Phaser.Math.Between(-12, 12) - x0;
    const flight = 0.55 + Math.abs(dx) / 1600; // seconds
    const vx = dx / flight;
    const vy = (GROUND_Y - 4 - y0) / flight - 0.5 * CANNON_GRAVITY * flight;

    const sprite = this.add
      .image(x0, y0, 'fx-cannonball')
      .setScale(1.5)
      .setDepth(DEPTH.projectiles + 1);

    this.cannonballs.push({ sprite, x: x0, y: y0, vx, vy, trailTimer: 0, alive: true });

    // Muzzle: bang, flash of powder, smoke, and a kick through the castle.
    audio.play('cannon', Phaser.Math.FloatBetween(0.92, 1.1));
    this.effects.spark(x0 + 14, y0, 0xffe9a8, 12);
    this.effects.smoke(x0 + 8, y0 - 4, 8);
    this.effects.shake(150, 0.005);
    this.playerBase.recoil(9);
  }

  /** Advances queued launches and balls in flight; runs inside the fixed step. */
  private stepCannon(dt: number) {
    if (this.cannonQueue.length) {
      for (const q of this.cannonQueue) q.delay -= dt;
      while (this.cannonQueue.length && this.cannonQueue[0].delay <= 0) {
        this.launchCannonball(this.cannonQueue.shift()!.targetX);
      }
    }

    const s = dt / 1000;
    for (const ball of this.cannonballs) {
      if (!ball.alive) continue;
      ball.vy += CANNON_GRAVITY * s;
      ball.x += ball.vx * s;
      ball.y += ball.vy * s;
      ball.sprite.setPosition(ball.x, ball.y);
      ball.sprite.rotation += 7 * s;

      ball.trailTimer -= dt;
      if (ball.trailTimer <= 0) {
        ball.trailTimer = 52;
        this.effects.smoke(ball.x, ball.y, 1);
      }

      if (ball.y >= GROUND_Y - 4 || ball.x > this.scale.width + 60) this.impactCannonball(ball);
    }

    for (let i = this.cannonballs.length - 1; i >= 0; i--) {
      if (!this.cannonballs[i].alive) this.cannonballs.splice(i, 1);
    }
  }

  private impactCannonball(ball: Cannonball) {
    ball.alive = false;
    ball.sprite.destroy();
    const bx = Phaser.Math.Clamp(ball.x, 0, this.scale.width);

    audio.play('bomb', Phaser.Math.FloatBetween(0.85, 1.05));
    this.effects.explode(bx, GROUND_Y - 22, 1.2);
    this.effects.smoke(bx, GROUND_Y - 30, 6);
    this.effects.dust(bx, GROUND_Y, 8);
    this.effects.shake(220, 0.007);

    const damage = cannonDamage(save.upgradeLevel('cannon'));
    for (const u of this.units) {
      if (u.side !== 'enemy' || !u.alive) continue;
      if (Math.abs(u.x - bx) > CANNON_BLAST_RADIUS) continue;
      u.takeDamage(damage, bx);
      u.shove();
    }
    if (this.enemyBase.alive && Math.abs(this.enemyBase.x - bx) <= CANNON_BLAST_RADIUS + 30) {
      this.enemyBase.takeDamage(damage * CANNON_BASE_CHIP, bx);
    }
  }

  setPaused(on: boolean) {
    if (this.outcome !== 'none') return;
    this.paused = on;
    this.events.emit('paused', on);
  }

  setSpeed(n: 1 | 2) {
    this.speed = n;
    save.data.settings.speed = n;
    save.flush();
    this.events.emit('speed', n);
  }

  quitToMap() {
    audio.stopMusic();
    this.scene.stop('Hud');
    this.scene.start('StageSelect');
  }

  /* ------------------------------------------------------------------ */
  /* Simulation                                                          */
  /* ------------------------------------------------------------------ */

  override update(_time: number, delta: number) {
    this.battlefield.update(delta);
    this.effects.update(delta);

    if (!this.paused) {
      this.accumulator += delta * this.speed;
      let steps = 0;
      while (this.accumulator >= SIM_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        this.step(SIM_STEP_MS);
        this.accumulator -= SIM_STEP_MS;
        steps++;
      }
      // Long stalls (tab restore) shouldn't fast-forward the whole battle.
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    }

    this.drawHealthBars();
  }

  private step(dt: number) {
    if (this.outcome === 'none') {
      this.elapsed += dt;
      this.gold = Math.min(this.goldCap, this.gold + (this.income * dt) / 1000);
      this.cannon = Math.min(this.cannonMax, this.cannon + dt);

      for (const key of Object.keys(this.cooldowns)) {
        if (this.cooldowns[key] > 0) this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
      }

      this.runSpawner(dt);
    }

    for (const u of this.units) u.simulate(dt, this.units);
    for (const p of this.projectiles) p.step(dt);
    this.stepCannon(dt);

    this.playerBase.step(dt);
    this.enemyBase.step(dt);

    // Prune in place: `this.units` is shared with World by reference.
    for (let i = this.units.length - 1; i >= 0; i--) {
      if (!this.units[i].alive) this.units.splice(i, 1);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i].alive) this.projectiles.splice(i, 1);
    }

    this.checkOutcome();
  }

  /* ------------------------------ waves ------------------------------ */

  private runSpawner(dt: number) {
    while (this.pending.length && this.pending[0].at <= this.elapsed) {
      const next = this.pending.shift()!;
      this.spawnEnemy(next.type);
    }

    // Reinforcements keyed to how badly the enemy castle is hurting.
    const frac = this.enemyBase.hpFraction;
    (this.stage.triggers ?? []).forEach((trig, i) => {
      if (this.firedTriggers.has(i) || frac > trig.atHpFrac) return;
      this.firedTriggers.add(i);
      for (let k = 0; k < trig.count; k++) {
        this.pending.push({ at: this.elapsed + k * trig.gap, type: trig.type });
      }
      this.pending.sort((a, b) => a.at - b.at);
      if (trig.announce) this.events.emit('announce', trig.announce);
    });

    // Endless trickle once the script is exhausted.
    const loop = this.stage.loop;
    if (!loop || this.elapsed < loop.after * 1000) return;
    this.loopTimer -= dt;
    if (this.loopTimer > 0) return;
    this.loopTimer = loop.every;
    this.loopCycles++;
    const batch = Math.min(4, 1 + Math.floor(this.loopCycles / 4));
    for (let i = 0; i < batch; i++) {
      this.pending.push({
        at: this.elapsed + i * 550,
        type: Phaser.Utils.Array.GetRandom(loop.types),
      });
    }
    this.pending.sort((a, b) => a.at - b.at);
  }

  private spawnEnemy(type: string) {
    const def = ENEMY_TROOPS[type];
    if (!def) return;
    const unit = new Unit(
      this.world,
      'enemy',
      def,
      this.enemySpawnX + Phaser.Math.Between(-14, 14),
      this.enemyScale,
      def.boss === true,
    );
    this.units.push(unit);

    if (def.boss) {
      this.effects.shake(500, 0.009);
      this.events.emit('boss', def.name);
    }
  }

  private handleDeath(unit: Unit) {
    if (unit.side !== 'enemy') return;
    const def = ENEMY_TROOPS[unit.def.key];
    const bounty = Math.round((def?.bounty ?? 20) * (1 + this.stageIndex * 0.04));
    this.gold = Math.min(this.goldCap, this.gold + bounty);
    this.effects.coins(unit.x, unit.y - 30, 5);
    this.effects.label(unit.x, unit.y - 58, `+${bounty}`, '#ffd479', 20);
    audio.play('coin', Phaser.Math.FloatBetween(0.95, 1.15));
  }

  /* ----------------------------- outcome ----------------------------- */

  private checkOutcome() {
    if (this.resolved) return;

    if (!this.enemyBase.alive) {
      this.resolved = true;
      this.outcome = 'win';
      this.finish();
    } else if (!this.playerBase.alive) {
      this.resolved = true;
      this.outcome = 'lose';
      this.finish();
    }
  }

  private finish() {
    const won = this.outcome === 'win';
    this.pending = [];
    this.events.emit('outcome', this.outcome);

    audio.stopMusic();
    this.time.delayedCall(400, () => audio.play(won ? 'win' : 'lose'));

    const reward = won ? this.stage.reward : Math.round(this.stage.reward * 0.15);
    // Capture this before recordClear moves the progress marker.
    const firstClear = won && this.stageIndex >= save.data.cleared;

    if (won) save.recordClear(this.stageIndex, this.elapsed, reward);
    else save.addGold(reward);

    this.time.delayedCall(2100, () => {
      this.scene.stop('Hud');
      this.scene.start('Result', {
        stageIndex: this.stageIndex,
        won,
        reward,
        elapsed: this.elapsed,
        unlocked: firstClear ? this.stage.unlocks : undefined,
      });
    });
  }

  /* ---------------------------- health bars -------------------------- */

  private drawHealthBars() {
    const g = this.bars;
    g.clear();

    for (const u of this.units) {
      if (!u.alive) continue;
      const hurt = u.hp < u.maxHp;
      if (!hurt && !u.isBoss) continue;

      const w = u.isBoss ? 96 : 48;
      const h = u.isBoss ? 9 : 6;
      const x = u.x - w / 2;
      // Anchored to the character's own height, not the mostly-empty sprite frame.
      const y = u.y - u.bodyH - (u.isBoss ? 16 : 9);
      const frac = Phaser.Math.Clamp(u.hp / u.maxHp, 0, 1);

      g.fillStyle(0x1d1520, 0.85);
      g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);
      g.fillStyle(u.side === 'player' ? 0x63c23c : 0xe0553a, 1);
      g.fillRoundedRect(x, y, Math.max(2, w * frac), h, 3);
    }
  }
}
