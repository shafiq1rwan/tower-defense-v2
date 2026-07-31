import type Phaser from 'phaser';
import type { Side } from '../core/constants';
import type { Effects } from './Effects';
import type { Unit } from './Unit';
import type { Base } from './Base';

/** Anything that can be shot at. Positions are 1-D: the whole battle happens
 *  along the x axis, so `x` is all targeting ever needs. */
export interface Combatant {
  readonly side: Side;
  readonly x: number;
  readonly y: number;
  readonly alive: boolean;
  readonly isBase: boolean;
  takeDamage(amount: number, fromX: number): void;
}

/** The slice of the battle a Unit / Projectile is allowed to reach into. */
export interface World {
  scene: Phaser.Scene;
  effects: Effects;
  units: Unit[];
  baseOf(side: Side): Base;
  spawnProjectile(opts: {
    kind: 'arrow' | 'bomb';
    side: Side;
    from: { x: number; y: number };
    target: Combatant;
    damage: number;
    aoe?: number;
  }): void;
  /** Called once when a unit's hp reaches zero. */
  onDeath(unit: Unit): void;
  laneMin: number;
  laneMax: number;
}
