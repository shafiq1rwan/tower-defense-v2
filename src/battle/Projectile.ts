import Phaser from 'phaser';
import { DEPTH, GROUND_Y, type Side } from '../core/constants';
import { audio } from '../core/audio';
import type { Combatant, World } from './types';

const ARROW_SPEED = 620;
const BOMB_MIN_FLIGHT = 460;

export interface ProjectileOpts {
  kind: 'arrow' | 'bomb';
  side: Side;
  from: { x: number; y: number };
  target: Combatant;
  damage: number;
  aoe?: number;
}

/** Fire-and-forget shot. It commits to the point where the target stood when
 *  it was loosed, which is what makes archers feel like archers: fast movers
 *  can outrun an arrow. */
export class Projectile {
  alive = true;

  private sprite: Phaser.GameObjects.Sprite;
  private x: number;
  private y: number;
  private vx: number;
  private vy: number;
  private gravity = 0;
  private readonly kind: 'arrow' | 'bomb';
  private readonly side: Side;
  private readonly damage: number;
  private readonly aoe: number;
  private readonly impactX: number;
  private readonly impactY: number;
  private readonly intended: Combatant;
  private world: World;

  constructor(world: World, o: ProjectileOpts) {
    this.world = world;
    this.kind = o.kind;
    this.side = o.side;
    this.damage = o.damage;
    this.aoe = o.aoe ?? 0;
    this.intended = o.target;

    this.x = o.from.x;
    this.y = o.from.y;
    this.impactX = o.target.x;
    this.impactY = o.target.isBase ? GROUND_Y - 30 : o.target.y - 30;

    const dx = this.impactX - this.x;
    const dy = this.impactY - this.y;

    if (o.kind === 'arrow') {
      const dist = Math.max(1, Math.hypot(dx, dy));
      this.vx = (dx / dist) * ARROW_SPEED;
      this.vy = (dy / dist) * ARROW_SPEED;
      this.sprite = world.scene.add
        .sprite(this.x, this.y, 'arrow', 0)
        .setDepth(DEPTH.projectiles)
        .setScale(0.85)
        .setRotation(Math.atan2(this.vy, this.vx));
    } else {
      // Solve a lob: pick a flight time, then the gravity that lands it there.
      const flight = Math.max(BOMB_MIN_FLIGHT, Math.abs(dx) * 1.5) / 1000;
      this.vx = dx / flight;
      this.gravity = 1500;
      this.vy = dy / flight - 0.5 * this.gravity * flight;
      this.sprite = world.scene.add
        .sprite(this.x, this.y, 'dynamite', 0)
        .setDepth(DEPTH.projectiles)
        .setScale(1)
        .play('fx-dynamite');
    }
  }

  step(dt: number) {
    if (!this.alive) return;
    const s = dt / 1000;

    this.vy += this.gravity * s;
    this.x += this.vx * s;
    this.y += this.vy * s;

    this.sprite.setPosition(this.x, this.y);
    if (this.kind === 'arrow') {
      this.sprite.setRotation(Math.atan2(this.vy, this.vx));
    } else {
      this.sprite.rotation += (this.vx > 0 ? 9 : -9) * s;
    }

    const past = this.side === 'player' ? this.x >= this.impactX : this.x <= this.impactX;
    if (past || this.y >= this.impactY) this.impact();

    // Safety net: never let a stray shot live forever.
    if (this.x < -80 || this.x > this.world.scene.scale.width + 80 || this.y > GROUND_Y + 60) this.impact();
  }

  private impact() {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();

    if (this.kind === 'bomb') {
      audio.play('bomb', Phaser.Math.FloatBetween(0.9, 1.15));
      this.world.effects.explode(this.impactX, this.impactY + 16, 0.9);
      this.world.effects.shake(120, 0.0035);
      this.splash();
      return;
    }

    audio.play('arrow', Phaser.Math.FloatBetween(0.9, 1.15));
    this.world.effects.spark(this.impactX, this.impactY, 0xffe9a8, 5);

    if (this.aoe > 0) {
      this.splash();
      return;
    }

    // The original mark if it's still standing, otherwise whoever took its place.
    if (this.intended.alive) {
      this.intended.takeDamage(this.damage, this.x);
      return;
    }
    const stand = this.nearestFoe(50);
    stand?.takeDamage(this.damage, this.x);
  }

  private splash() {
    const radius = this.aoe > 0 ? this.aoe : 40;
    for (const u of this.world.units) {
      if (!u.alive || u.side === this.side) continue;
      if (Math.abs(u.x - this.impactX) <= radius) u.takeDamage(this.damage, this.impactX);
    }
    const base = this.world.baseOf(this.side === 'player' ? 'enemy' : 'player');
    if (base.alive && Math.abs(base.x - this.impactX) <= radius) base.takeDamage(this.damage, this.impactX);
  }

  private nearestFoe(maxDist: number): Combatant | null {
    let best: Combatant | null = null;
    let bestD = maxDist;
    for (const u of this.world.units) {
      if (!u.alive || u.side === this.side) continue;
      const d = Math.abs(u.x - this.impactX);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    const base = this.world.baseOf(this.side === 'player' ? 'enemy' : 'player');
    if (base.alive && Math.abs(base.x - this.impactX) < bestD) best = base;
    return best;
  }

  destroy() {
    this.alive = false;
    this.sprite.destroy();
  }
}
