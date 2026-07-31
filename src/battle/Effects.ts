import Phaser from 'phaser';
import { COLORS, CSS, DEPTH, FONT_DISPLAY } from '../core/constants';

/** Small runtime-generated textures so particles need no art files. */
function ensureTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('fx-dot')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1).fillCircle(6, 6, 6);
    g.generateTexture('fx-dot', 12, 12);
    g.destroy();
  }
  if (!scene.textures.exists('fx-chip')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 8, 8);
    g.generateTexture('fx-chip', 8, 8);
    g.destroy();
  }
}

interface FloatText {
  text: Phaser.GameObjects.Text;
  life: number;
  ttl: number;
  vy: number;
  vx: number;
}

/** All the transient juice: damage numbers, sparks, dust, explosions, shake. */
export class Effects {
  private floats: FloatText[] = [];
  private pool: Phaser.GameObjects.Text[] = [];
  private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private coinEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private scene: Phaser.Scene) {
    ensureTextures(scene);

    this.dustEmitter = scene.add
      .particles(0, 0, 'fx-dot', {
        speed: { min: 18, max: 90 },
        angle: { min: 200, max: 340 },
        lifespan: { min: 260, max: 520 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.75, end: 0 },
        gravityY: 260,
        tint: [0xd9c9a5, 0xbca87f, 0xefe4c8],
        emitting: false,
      })
      .setDepth(DEPTH.fx);

    this.sparkEmitter = scene.add
      .particles(0, 0, 'fx-chip', {
        speed: { min: 60, max: 210 },
        lifespan: { min: 160, max: 340 },
        scale: { start: 0.9, end: 0 },
        rotate: { start: 0, end: 360 },
        gravityY: 420,
        emitting: false,
      })
      .setDepth(DEPTH.fx);

    this.coinEmitter = scene.add
      .particles(0, 0, 'fx-dot', {
        speed: { min: 40, max: 130 },
        angle: { min: 250, max: 290 },
        lifespan: 520,
        scale: { start: 0.5, end: 0 },
        gravityY: 340,
        tint: [COLORS.gold, COLORS.goldLight],
        emitting: false,
      })
      .setDepth(DEPTH.fx);

    // Gunpowder smoke: drifts up and lingers, used by the cannon.
    this.smokeEmitter = scene.add
      .particles(0, 0, 'fx-dot', {
        speed: { min: 8, max: 42 },
        angle: { min: 235, max: 305 },
        lifespan: { min: 420, max: 950 },
        scale: { start: 0.9, end: 0.15 },
        alpha: { start: 0.5, end: 0 },
        gravityY: -46,
        tint: [0x53535e, 0x74747f, 0x9b9ba6],
        emitting: false,
      })
      .setDepth(DEPTH.fx);
  }

  /* ------------------------------ numbers ----------------------------- */

  private take(): Phaser.GameObjects.Text {
    const t = this.pool.pop();
    if (t) return t.setVisible(true).setActive(true);
    return this.scene.add
      .text(0, 0, '', { fontFamily: FONT_DISPLAY, fontSize: '22px', color: CSS.white })
      .setOrigin(0.5)
      .setDepth(DEPTH.floatText);
  }

  damage(x: number, y: number, amount: number, color: string = CSS.white, big = false) {
    const t = this.take();
    t.setText(String(Math.max(1, Math.round(amount))))
      .setPosition(x + Phaser.Math.Between(-8, 8), y)
      .setColor(color)
      .setFontSize(big ? 34 : 22)
      .setStroke('#3a1f14', big ? 7 : 5)
      .setAlpha(1)
      .setScale(big ? 1.25 : 1);
    this.floats.push({ text: t, life: 0, ttl: big ? 900 : 620, vy: big ? -78 : -62, vx: Phaser.Math.Between(-14, 14) });
  }

  /** Non-numeric callout, e.g. "MISS" or a bounty. */
  label(x: number, y: number, str: string, color: string = CSS.gold, size = 24) {
    const t = this.take();
    t.setText(str)
      .setPosition(x, y)
      .setColor(color)
      .setFontSize(size)
      .setStroke('#3a1f14', 5)
      .setAlpha(1)
      .setScale(1);
    this.floats.push({ text: t, life: 0, ttl: 900, vy: -48, vx: 0 });
  }

  update(dtMs: number) {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life += dtMs;
      const k = f.life / f.ttl;
      f.text.y += (f.vy * dtMs) / 1000;
      f.text.x += (f.vx * dtMs) / 1000;
      f.vy += (240 * dtMs) / 1000; // gentle arc back down
      f.text.setAlpha(k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
      if (f.life >= f.ttl) {
        f.text.setVisible(false).setActive(false);
        this.pool.push(f.text);
        this.floats.splice(i, 1);
      }
    }
  }

  /* ------------------------------ bursts ------------------------------ */

  spark(x: number, y: number, tint: number = COLORS.goldLight, count = 6) {
    this.sparkEmitter.setParticleTint(tint);
    this.sparkEmitter.explode(count, x, y);
  }

  dust(x: number, y: number, count = 5) {
    this.dustEmitter.explode(count, x, y);
  }

  coins(x: number, y: number, count = 6) {
    this.coinEmitter.explode(count, x, y);
  }

  smoke(x: number, y: number, count = 4) {
    this.smokeEmitter.explode(count, x, y);
  }

  explode(x: number, y: number, scale = 1) {
    const s = this.scene.add
      .sprite(x, y, 'explosion')
      .setDepth(DEPTH.fx)
      .setScale(scale)
      .play('fx-explosion');
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
    this.dust(x, y + 8, 8);
  }

  /** The skull marker a defeated troop leaves behind. */
  skull(x: number, y: number, scale = 1) {
    const s = this.scene.add
      .sprite(x, y - 6, 'dead')
      .setDepth(DEPTH.corpse)
      .setScale(scale)
      .play('fx-dead');
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
  }

  shake(duration = 140, intensity = 0.004) {
    this.scene.cameras.main.shake(duration, intensity, true);
  }

  /** Quick white flash over the whole battlefield, for cannon fire etc. */
  flash(duration = 180, r = 255, g = 240, b = 190) {
    this.scene.cameras.main.flash(duration, r, g, b, true);
  }

  destroy() {
    this.floats.forEach((f) => f.text.destroy());
    this.pool.forEach((t) => t.destroy());
    this.floats = [];
    this.pool = [];
    this.dustEmitter.destroy();
    this.sparkEmitter.destroy();
    this.coinEmitter.destroy();
    this.smokeEmitter.destroy();
  }
}
