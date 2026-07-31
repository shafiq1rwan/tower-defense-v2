import Phaser from 'phaser';
import { CASTLE_BASELINE, DEPTH, GROUND_Y, type Side } from '../core/constants';
import { audio } from '../core/audio';
import type { Combatant, World } from './types';

/** The castle art varies wildly in size, so each texture gets a scale that
 *  lands it at roughly the same on-screen height. */
const CASTLE_SCALE: Record<string, number> = {
  goblin_house: 1.2,
};
const DEFAULT_SCALE = 0.92;

/** How far past the screen edge a wide castle is allowed to bleed. */
const MAX_BLEED = 46;
/** Inset from the castle's outer edge to the face attackers stop at. */
const WALL_INSET = 16;

/** A castle: the thing each side is trying to knock down.
 *  `x` is the *wall face* attackers stop at, not the sprite centre. */
export class Base implements Combatant {
  readonly side: Side;
  readonly x: number;
  readonly y: number;
  readonly isBase = true;
  readonly maxHp: number;
  readonly sprite: Phaser.GameObjects.Image;

  hp: number;
  alive = true;

  private world: World;
  private readonly homeX: number;
  private flashTimer = 0;

  constructor(world: World, side: Side, texture: string, hp: number) {
    this.world = world;
    this.side = side;
    this.maxHp = hp;
    this.hp = hp;

    const scale = CASTLE_SCALE[texture] ?? DEFAULT_SCALE;
    this.sprite = world.scene.add
      .image(0, CASTLE_BASELINE, texture)
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setDepth(DEPTH.base);

    // Anchor to the screen edge: broad castles bleed off it, narrow huts sit flush.
    const halfW = this.sprite.displayWidth / 2;
    const bleed = Phaser.Math.Clamp(halfW - 70, 0, MAX_BLEED);
    const screenW = world.scene.scale.width;

    this.homeX = side === 'player' ? halfW - bleed : screenW - halfW + bleed;
    this.sprite.x = this.homeX;

    const reach = halfW - WALL_INSET;
    this.x = side === 'player' ? this.homeX + reach : this.homeX - reach;
    this.y = GROUND_Y - 46;
  }

  get hpFraction() {
    return Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
  }

  takeDamage(amount: number, _fromX?: number) {
    if (!this.alive) return;
    this.hp -= amount;

    this.sprite.setTintFill(0xffffff);
    this.flashTimer = 70;

    audio.play('baseHit', Phaser.Math.FloatBetween(0.9, 1.1));
    this.world.effects.spark(this.x, this.y + 10, 0xffc07a, 8);
    this.world.effects.dust(this.x, GROUND_Y, 5);
    this.recoil(7);

    if (this.hp <= 0) this.destroyBase();
  }

  /** A short kick that sells an impact without moving the collision face.
   *  Always anchored to homeX so overlapping recoils can never leave the
   *  sprite drifted off its footing. */
  recoil(amount: number) {
    const scene = this.world.scene;
    scene.tweens.killTweensOf(this.sprite);
    this.sprite.x = this.homeX;
    scene.tweens.add({
      targets: this.sprite,
      x: this.homeX + (this.side === 'player' ? -amount : amount),
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.sprite.x = this.homeX;
      },
    });
  }

  step(dt: number) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.sprite.clearTint();
    }
  }

  private destroyBase() {
    this.hp = 0;
    this.alive = false;
    this.sprite.clearTint();

    // A staggered burst of explosions across the footprint, then the ruin.
    const w = this.sprite.displayWidth;
    for (let i = 0; i < 7; i++) {
      this.world.scene.time.delayedCall(i * 110, () => {
        this.world.effects.explode(
          this.homeX + Phaser.Math.Between(-w * 0.34, w * 0.34),
          GROUND_Y - Phaser.Math.Between(0, 110),
          Phaser.Math.FloatBetween(0.8, 1.3),
        );
        this.world.effects.shake(160, 0.008);
        audio.play('bomb', Phaser.Math.FloatBetween(0.8, 1.2));
      });
    }

    this.world.scene.time.delayedCall(420, () => {
      if (this.world.scene.textures.exists('castle_destroyed')) {
        this.sprite.setTexture('castle_destroyed').setScale(DEFAULT_SCALE);
        this.sprite.x = this.homeX;
      } else {
        this.sprite.setAlpha(0.25);
      }
    });
  }
}
