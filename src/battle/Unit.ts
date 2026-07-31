import Phaser from 'phaser';
import { DEPTH, GROUND_Y, UNIT_SCALE, facingOf, type Side } from '../core/constants';
import { RIGS, type TroopDef } from '../data/troops';
import { animKey } from '../data/anims';
import { audio } from '../core/audio';
import type { Combatant, World } from './types';

type Phase = 'walk' | 'blocked' | 'attack' | 'knockback' | 'dead';

const KNOCKBACK_MS = 380;
const KNOCKBACK_SPEED = 210;
/** How close a troop gets to the friendly in front before queueing behind it. */
const QUEUE_GAP = 34;
const FLASH_MS = 90;

export class Unit implements Combatant {
  readonly side: Side;
  readonly def: TroopDef;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly maxHp: number;
  readonly power: number;
  readonly facing: number;
  readonly isBase = false;
  readonly isBoss: boolean;
  /** Vertical jitter so a crowd reads as a crowd, not a single sprite. */
  readonly laneOffset: number;
  /** On-screen height of the character, for anchoring bars and numbers. */
  readonly bodyH: number;

  x: number;
  y: number;
  hp: number;
  alive = true;
  phase: Phase = 'walk';

  private world: World;
  private readonly drawScale: number;
  private attackCd = 0;
  private swingTimer = -1;
  private readonly hitDelay: number;
  private kbLeft: number;
  private kbTimer = 0;
  private hop = 0;
  private flashTimer = 0;

  constructor(world: World, side: Side, def: TroopDef, x: number, multiplier: number, isBoss = false) {
    this.world = world;
    this.side = side;
    this.def = def;
    this.facing = facingOf(side);
    this.isBoss = isBoss;

    this.maxHp = Math.round(def.hp * multiplier);
    this.hp = this.maxHp;
    this.power = def.attack * multiplier;
    this.kbLeft = def.knockbacks;

    this.laneOffset = Phaser.Math.Between(-15, 15);
    this.x = x;
    this.y = GROUND_Y + this.laneOffset;

    const rig = RIGS[def.rig];
    this.hitDelay = (rig.hit / rig.attackFps) * 1000;
    this.drawScale = def.scale * UNIT_SCALE;
    this.bodyH = rig.bodyH * this.drawScale;

    this.sprite = world.scene.add
      .sprite(this.x, this.y, def.tex)
      // The 192px cells put the character's feet ~63% down the frame.
      .setOrigin(0.5, 0.63)
      .setScale(this.drawScale)
      .setFlipX(side === 'enemy')
      .setDepth(DEPTH.units + this.laneOffset + 20);

    this.play('walk');

    // Drop-in flourish.
    this.sprite.setScale(this.drawScale * 0.55).setAlpha(0);
    world.scene.tweens.add({
      targets: this.sprite,
      scale: this.drawScale,
      alpha: 1,
      duration: 240,
      ease: 'Back.easeOut',
    });
    world.effects.dust(this.x, this.y, 4);
  }

  private play(state: 'idle' | 'walk' | 'attack') {
    const key = animKey(this.def.tex, state);
    // Attacks always restart; looping clips only start if not already running.
    // Checking the sprite's real state (not our own bookkeeping) means a clip
    // that was interrupted or finished elsewhere can never leave us desynced.
    if (state !== 'attack' && this.sprite.anims.isPlaying && this.sprite.anims.currentAnim?.key === key) return;
    this.sprite.play(key, false);
  }

  /** Re-derives the animation from the phase every step. This is deliberately
   *  stateless: a missed transition (e.g. resuming from knockback straight
   *  into 'walk') self-heals on the next tick instead of leaving the unit
   *  gliding across the field frozen on its last frame. */
  private ensureAnim() {
    if (this.phase === 'knockback' || this.phase === 'dead') return;
    if (this.phase === 'walk') {
      this.play('walk');
      return;
    }
    // 'attack' or 'blocked': idle between swings, but never cut off a swing
    // that is still playing.
    const attackKey = animKey(this.def.tex, 'attack');
    if (this.sprite.anims.isPlaying && this.sprite.anims.currentAnim?.key === attackKey) return;
    this.play('idle');
  }

  /* ------------------------------------------------------------------ */

  /** One fixed simulation step. `dt` is in milliseconds. */
  simulate(dt: number, all: Unit[]) {
    if (!this.alive) return;

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.sprite.clearTint();
    }

    // A swing already in flight lands regardless of what happens next.
    if (this.swingTimer >= 0) {
      this.swingTimer -= dt;
      if (this.swingTimer <= 0) {
        this.swingTimer = -1;
        this.release();
      }
    }

    if (this.phase === 'knockback') {
      this.kbTimer -= dt;
      this.x -= (this.facing * KNOCKBACK_SPEED * dt) / 1000;
      this.x = Phaser.Math.Clamp(this.x, this.world.laneMin, this.world.laneMax);
      this.hop = Math.sin((1 - this.kbTimer / KNOCKBACK_MS) * Math.PI) * 26;
      if (this.kbTimer <= 0) {
        this.phase = 'walk';
        this.hop = 0;
        this.sprite.setAngle(0);
      } else {
        this.sprite.setAngle(this.facing * -14 * Math.sin((1 - this.kbTimer / KNOCKBACK_MS) * Math.PI));
      }
      this.sync();
      return;
    }

    this.attackCd -= dt;

    const { enemy, friendAhead } = this.scan(all);
    const target: Combatant | null = enemy ?? this.baseTarget();

    if (target) {
      this.phase = 'attack';
      if (this.attackCd <= 0 && this.swingTimer < 0) {
        this.attackCd = this.def.interval;
        this.swingTimer = this.hitDelay;
        this.play('attack');
        if (this.def.projectile === 'arrow') audio.play('bow', Phaser.Math.FloatBetween(0.9, 1.1));
      }
    } else if (friendAhead) {
      this.phase = 'blocked';
    } else {
      this.phase = 'walk';
      this.x += (this.facing * this.def.speed * dt) / 1000;
      this.x = Phaser.Math.Clamp(this.x, this.world.laneMin, this.world.laneMax);
    }

    this.ensureAnim();
    this.sync();
  }

  /** Single pass over the roster: nearest reachable enemy, nearest blocker. */
  private scan(all: Unit[]): { enemy: Unit | null; friendAhead: boolean } {
    let enemy: Unit | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    let friendAhead = false;

    for (const other of all) {
      if (other === this || !other.alive) continue;
      const gap = (other.x - this.x) * this.facing;

      if (other.side === this.side) {
        // Queue behind whoever is already engaged in front of us.
        if (gap > 0 && gap < QUEUE_GAP && (other.phase === 'attack' || other.phase === 'blocked')) {
          friendAhead = true;
        }
        continue;
      }

      // Slightly negative gaps still count so overlapping troops can trade blows.
      if (gap < -20 || gap > this.def.range) continue;
      if (gap < bestGap) {
        bestGap = gap;
        enemy = other;
      }
    }

    return { enemy, friendAhead };
  }

  private baseTarget(): Combatant | null {
    const base = this.world.baseOf(this.side === 'player' ? 'enemy' : 'player');
    if (!base.alive) return null;
    const gap = (base.x - this.x) * this.facing;
    return gap >= -20 && gap <= this.def.range ? base : null;
  }

  /** The moment in the swing where damage actually happens. */
  private release() {
    if (!this.alive) return;
    const { enemy } = this.scan(this.world.units);
    const target: Combatant | null = enemy ?? this.baseTarget();
    if (!target) return;

    if (this.def.projectile) {
      this.world.spawnProjectile({
        kind: this.def.projectile,
        side: this.side,
        from: { x: this.x + this.facing * 20, y: this.y - this.bodyH * 0.55 },
        target,
        damage: this.power,
        aoe: this.def.aoe,
      });
      return;
    }

    audio.play('slash', Phaser.Math.FloatBetween(0.85, 1.15));

    if (this.def.aoe) {
      const centre = this.x + this.facing * this.def.range * 0.6;
      this.splash(centre, this.def.aoe, this.power);
      this.world.effects.spark(centre, this.y - this.bodyH * 0.4, 0xffd479, 10);
    } else {
      target.takeDamage(this.power, this.x);
      this.world.effects.spark(
        target.isBase ? target.x : (this.x + target.x) / 2,
        this.y - this.bodyH * 0.45,
        this.side === 'player' ? 0xdff0ff : 0xffd2b0,
      );
    }
  }

  private splash(centreX: number, radius: number, damage: number) {
    for (const other of this.world.units) {
      if (!other.alive || other.side === this.side) continue;
      if (Math.abs(other.x - centreX) <= radius) other.takeDamage(damage, this.x);
    }
    const base = this.world.baseOf(this.side === 'player' ? 'enemy' : 'player');
    if (base.alive && Math.abs(base.x - centreX) <= radius) base.takeDamage(damage, this.x);
  }

  /* ------------------------------------------------------------------ */

  takeDamage(amount: number, _fromX: number) {
    if (!this.alive) return;
    this.hp -= amount;

    this.sprite.setTintFill(0xffffff);
    this.flashTimer = FLASH_MS;

    if (amount >= 45 || this.isBoss) {
      this.world.effects.damage(
        this.x,
        this.y - this.bodyH - 10,
        amount,
        this.side === 'player' ? '#ffd0c4' : '#ffffff',
        this.isBoss,
      );
    }

    if (this.hp <= 0) {
      this.die();
      return;
    }

    // Knockback thresholds are spread evenly across the health bar.
    const threshold = (this.maxHp * this.kbLeft) / (this.def.knockbacks + 1);
    if (this.kbLeft > 0 && this.hp <= threshold) {
      this.kbLeft--;
      this.knockback();
    }
  }

  /** Force a knockback regardless of health thresholds (cannon blast). */
  shove() {
    if (this.alive) this.knockback();
  }

  private knockback() {
    this.phase = 'knockback';
    this.kbTimer = KNOCKBACK_MS;
    this.swingTimer = -1;
    this.attackCd = Math.max(this.attackCd, 220);
    this.world.effects.dust(this.x, this.y, 6);
  }

  private die() {
    this.alive = false;
    this.phase = 'dead';
    this.world.effects.skull(this.x, this.y, this.drawScale);
    this.world.effects.dust(this.x, this.y, 7);
    audio.play('die', Phaser.Math.FloatBetween(0.85, 1.2));

    const s = this.sprite;
    s.clearTint();
    this.world.scene.tweens.add({
      targets: s,
      alpha: 0,
      scaleX: this.drawScale * 0.85,
      scaleY: this.drawScale * 0.7,
      y: s.y + 10,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => s.destroy(),
    });

    this.world.onDeath(this);
  }

  private sync() {
    this.sprite.x = this.x;
    this.sprite.y = this.y - this.hop;
    this.sprite.setDepth(DEPTH.units + this.laneOffset + 20);
  }

  destroy() {
    this.alive = false;
    this.sprite.destroy();
  }
}
