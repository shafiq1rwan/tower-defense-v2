import Phaser from 'phaser';
import { DEPTH, GROUND_Y, HORIZON_Y, STAGE_H, VILLAGE_Y } from '../core/constants';

type Biome = 'green' | 'sand';

/** Tilemap_Flat.png is a 10x4 grid of 64px tiles: a grass autotile block in
 *  columns 0-3 and a sand one starting at column 5. We only need the top edge
 *  and the interior fill. */
const TILES: Record<Biome, { top: number; body: number }> = {
  green: { top: 1, body: 11 },
  sand: { top: 6, body: 16 },
};

const SKY: Record<Biome, [string, string, string]> = {
  green: ['#5fb8e8', '#9fd9f2', '#dff1f7'],
  sand: ['#4f9ad4', '#e0b98a', '#f6dcae'],
};

const HILLS: Record<Biome, [number, number]> = {
  green: [0x3f6a3a, 0x55884a],
  sand: [0x8a6f45, 0xa98d5c],
};

/** Static, single-screen backdrop. No camera scrolling — the whole lane is
 *  always visible — so "depth" comes from scale, tint and layering instead. */
export class Battlefield {
  private clouds: Phaser.GameObjects.Image[] = [];
  private width: number;

  constructor(
    private scene: Phaser.Scene,
    private biome: Biome,
  ) {
    this.width = scene.scale.width;
    this.drawSky();
    this.drawHills();
    this.drawGround();
    this.drawVillage();
    this.scatterDeco();
  }

  /* ------------------------------------------------------------------ */

  private drawSky() {
    const key = `sky-${this.biome}`;
    if (!this.scene.textures.exists(key)) {
      const tex = this.scene.textures.createCanvas(key, 8, STAGE_H);
      if (tex) {
        const ctx = tex.getContext();
        const g = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 40);
        const [a, b, c] = SKY[this.biome];
        g.addColorStop(0, a);
        g.addColorStop(0.62, b);
        g.addColorStop(1, c);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 8, STAGE_H);
        tex.refresh();
      }
    }
    this.scene.add
      .image(0, 0, key)
      .setOrigin(0, 0)
      .setDisplaySize(this.width, STAGE_H)
      .setDepth(DEPTH.sky);

    this.makeCloudTexture();
    for (let i = 0; i < 7; i++) {
      const cloud = this.scene.add
        .image(Phaser.Math.Between(0, this.width), Phaser.Math.Between(46, 210), 'fx-cloud')
        .setDepth(DEPTH.sky + 1)
        .setAlpha(Phaser.Math.FloatBetween(0.45, 0.85))
        .setScale(Phaser.Math.FloatBetween(0.55, 1.3));
      cloud.setData('speed', Phaser.Math.FloatBetween(3, 9));
      this.clouds.push(cloud);
    }
  }

  private makeCloudTexture() {
    if (this.scene.textures.exists('fx-cloud')) return;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    const puffs: Array<[number, number, number]> = [
      [60, 46, 30],
      [104, 40, 24],
      [30, 50, 22],
      [140, 50, 18],
      [86, 58, 26],
    ];
    puffs.forEach(([x, y, r]) => g.fillCircle(x, y, r));
    g.fillRect(28, 50, 116, 22);
    g.generateTexture('fx-cloud', 180, 80);
    g.destroy();
  }

  private drawHills() {
    const [far, near] = HILLS[this.biome];
    const g = this.scene.add.graphics().setDepth(DEPTH.hills);

    const band = (colour: number, baseY: number, minR: number, maxR: number, step: number) => {
      g.fillStyle(colour, 1);
      for (let x = -60; x < this.width + 120; x += step) {
        g.fillCircle(x, baseY, Phaser.Math.Between(minR, maxR));
      }
      g.fillRect(-60, baseY, this.width + 180, HORIZON_Y + 30 - baseY);
    };

    band(far, HORIZON_Y - 38, 40, 78, 76);
    band(near, HORIZON_Y - 10, 30, 58, 62);
  }

  private drawGround() {
    const { top, body } = TILES[this.biome];

    this.scene.add
      .tileSprite(0, HORIZON_Y, this.width, 64, 'tiles', top)
      .setOrigin(0, 0)
      .setDepth(DEPTH.ground);

    this.scene.add
      .tileSprite(0, HORIZON_Y + 64, this.width, STAGE_H - HORIZON_Y - 64, 'tiles', body)
      .setOrigin(0, 0)
      .setDepth(DEPTH.ground);

    // Aerial perspective: darken the far ground so the lane reads as the
    // focal plane rather than one flat sheet of green.
    const shadeKey = 'ground-shade';
    if (!this.scene.textures.exists(shadeKey)) {
      const tex = this.scene.textures.createCanvas(shadeKey, 8, 256);
      if (tex) {
        const ctx = tex.getContext();
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, 'rgba(22,36,20,0.5)');
        grad.addColorStop(0.5, 'rgba(22,36,20,0.16)');
        grad.addColorStop(1, 'rgba(22,36,20,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 8, 256);
        tex.refresh();
      }
    }
    this.scene.add
      .image(0, HORIZON_Y, shadeKey)
      .setOrigin(0, 0)
      .setDisplaySize(this.width, 170)
      .setDepth(DEPTH.ground + 1);

    // A trodden path where the fighting happens.
    const path = this.scene.add.graphics().setDepth(DEPTH.ground + 2);
    path.fillStyle(0x000000, 0.1);
    path.fillEllipse(this.width / 2, GROUND_Y + 14, this.width * 1.05, 130);
    path.fillStyle(0x000000, 0.08);
    path.fillEllipse(this.width / 2, GROUND_Y + 8, this.width * 0.9, 84);
  }

  /** Distant buildings behind the lane, small and desaturated for depth. */
  private drawVillage() {
    const put = (tex: string, x: number, scale: number, tint = 0xcbd8c4, frame?: number) => {
      if (!this.scene.textures.exists(tex)) return;
      this.scene.add
        .image(x, VILLAGE_Y, tex, frame)
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setTint(tint)
        .setDepth(DEPTH.midScenery);
    };

    // Kept clear of the castles at each edge so the skyline doesn't collide.
    put('tower_blue', 336, 0.46);
    put('house_blue', 424, 0.48);
    put('tree', this.width * 0.4, 0.4, 0xbfcfb6, 0);
    put('tree', this.width * 0.52, 0.34, 0xb4c6ac, 0);
    put('tree', this.width * 0.66, 0.38, 0xbfcfb6, 0);
    put('house_red', this.width - 340, 0.48, 0xd4c8be);
    put('goblin_house', this.width - 440, 0.42, 0xd4c8be);

    // A couple of sheep, because an empty field looks unfinished.
    for (const x of [this.width * 0.37, this.width * 0.56]) {
      this.scene.add
        .sprite(x + Phaser.Math.Between(-30, 30), VILLAGE_Y + 22, 'sheep')
        .setOrigin(0.5, 1)
        .setScale(0.4)
        .setTint(0xdae2d4)
        .setDepth(DEPTH.midScenery + 1)
        .play({ key: 'scenery-sheep', startFrame: Phaser.Math.Between(0, 7) });
    }
  }

  /** Bushes and rocks: a scattered band behind the troops, a few in front. */
  private scatterDeco() {
    const pick = () => `deco_${String(Phaser.Math.Between(1, 15)).padStart(2, '0')}`;

    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(10, this.width - 10);
      const y = Phaser.Math.Between(HORIZON_Y + 84, GROUND_Y - 74);
      this.scene.add
        .image(x, y, pick())
        // Smaller and paler the further up the field they sit.
        .setScale(Phaser.Math.FloatBetween(0.5, 0.85))
        .setTint(0xd2ddca)
        .setDepth(DEPTH.midScenery + 2);
    }

    for (let i = 0; i < 8; i++) {
      const x = Phaser.Math.Between(0, this.width);
      const y = Phaser.Math.Between(GROUND_Y + 30, GROUND_Y + 62);
      this.scene.add
        .image(x, y, pick())
        .setScale(Phaser.Math.FloatBetween(1, 1.35))
        .setDepth(DEPTH.nearScenery);
    }
  }

  /* ------------------------------------------------------------------ */

  update(dtMs: number) {
    for (const c of this.clouds) {
      c.x += (c.getData('speed') as number) * (dtMs / 1000);
      if (c.x - c.displayWidth / 2 > this.width) c.x = -c.displayWidth / 2;
    }
  }
}
