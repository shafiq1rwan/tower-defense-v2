import Phaser from 'phaser';

import { COLORS, CSS, DEPTH, FONT_DISPLAY, STAGE_H } from '../core/constants';
import { Button, drawPanel, fadeToScene, formatGold, formatTime, styles } from '../core/ui';
import { audio } from '../core/audio';
import { save } from '../core/save';
import { STAGES } from '../data/stages';

export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect');
  }

  create() {
    const W = this.scale.width;

    this.cameras.main.setBackgroundColor('#20303f');
    this.drawBackdrop(W);
    this.buildHeader(W);
    this.buildGrid(W);

    this.cameras.main.fadeIn(260, 0, 0, 0);
    audio.startMusic('menu');
  }

  private drawBackdrop(W: number) {
    this.add.graphics().fillStyle(0x22323f, 1).fillRect(0, 0, W, STAGE_H).setDepth(DEPTH.sky);
  }

  private buildHeader(W: number) {
    const g = this.add.graphics().setDepth(DEPTH.hud);
    drawPanel(g, -20, -30, W + 40, 92, { radius: 18, fill: 0x2f2330, edge: 0x1a1119, sheen: 0x453447 });

    this.add.text(W / 2, 20, 'Choose a Battle', styles.heading(32, CSS.gold)).setOrigin(0.5, 0).setDepth(DEPTH.hud + 1);

    new Button(this, 84, 34, '← Back', () => fadeToScene(this, 'Menu'), {
      width: 128,
      height: 46,
      fontSize: 18,
      fill: 0x4a2c19,
      edge: 0x2b1810,
    }).setDepth(DEPTH.hud + 1);

    // Purse.
    this.add.image(W - 226, 34, 'ui_gold').setScale(0.26).setDepth(DEPTH.hud + 1);
    this.add
      .text(W - 200, 33, formatGold(save.data.gold), {
        fontFamily: FONT_DISPLAY,
        fontSize: '25px',
        color: CSS.goldLight,
        stroke: '#2b1810',
        strokeThickness: 5,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud + 1);

    new Button(this, W - 84, 34, 'Barracks', () => fadeToScene(this, 'Barracks'), {
      width: 132,
      height: 46,
      fontSize: 18,
      fill: 0x4a2c19,
      edge: 0x2b1810,
    }).setDepth(DEPTH.hud + 1);
  }

  private buildGrid(W: number) {
    const cols = W >= 1240 ? 4 : 3;
    const rows = Math.ceil(STAGES.length / cols);
    const marginX = 42;
    const gap = 18;
    const cardW = (W - marginX * 2 - gap * (cols - 1)) / cols;

    // Fill the space between the header and the bottom edge, then centre it.
    const top = 106;
    const available = STAGE_H - 24 - top;
    const cardH = Phaser.Math.Clamp((available - gap * (rows - 1)) / rows, 140, 220);
    const gridH = cardH * rows + gap * (rows - 1);
    const startY = top + (available - gridH) / 2 + cardH / 2;

    STAGES.forEach((_stage, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = marginX + cardW / 2 + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      // One stage ahead of your progress is always playable; beyond that is locked.
      this.buildCard(x, y, cardW, cardH, i, i > save.data.cleared);
    });
  }

  private buildCard(x: number, y: number, w: number, h: number, index: number, locked: boolean) {
    const stage = STAGES[index];
    const cleared = index < save.data.cleared;
    const best = save.data.best[index];

    const card = this.add.container(x, y).setDepth(DEPTH.hud);

    const bg = this.add.graphics();
    drawPanel(bg, -w / 2, -h / 2, w, h, {
      radius: 16,
      fill: locked ? 0x3c3340 : cleared ? 0x3f6a34 : COLORS.wood,
      edge: locked ? 0x241d28 : cleared ? 0x24421d : COLORS.woodDark,
      sheen: locked ? 0x4d4353 : cleared ? 0x559043 : COLORS.woodLight,
    });
    card.add(bg);

    // Stage number badge.
    const badge = this.add.graphics();
    badge.fillStyle(0x2a1f2d, 0.9).fillCircle(-w / 2 + 30, -h / 2 + 28, 20);
    card.add(badge);
    card.add(
      this.add
        .text(-w / 2 + 30, -h / 2 + 27, String(index + 1), {
          fontFamily: FONT_DISPLAY,
          fontSize: '21px',
          color: CSS.goldLight,
        })
        .setOrigin(0.5),
    );

    const name = this.add
      .text(-w / 2 + 60, -h / 2 + 18, stage.name, styles.heading(19, locked ? '#9c93a3' : CSS.parchment))
      .setOrigin(0, 0);
    if (name.width > w - 74) name.setFontSize(16);
    card.add(name);

    card.add(
      this.add
        .text(-w / 2 + 18, -h / 2 + 58, locked ? 'Locked' : stage.subtitle, styles.body(14, locked ? '#8f8797' : '#e9d9ba'))
        .setOrigin(0, 0)
        .setWordWrapWidth(w - 36),
    );

    if (locked) {
      card.add(
        this.add.text(0, h / 2 - 34, '🔒', { fontSize: '30px' }).setOrigin(0.5).setAlpha(0.8),
      );
      card.add(
        this.add
          .text(0, h / 2 - 68, `Clear stage ${index}`, styles.body(13, '#9c93a3'))
          .setOrigin(0.5),
      );
      return;
    }

    // Reward + best time footer.
    card.add(this.add.image(-w / 2 + 26, h / 2 - 26, 'ui_gold').setScale(0.19));
    card.add(
      this.add
        .text(-w / 2 + 44, h / 2 - 27, formatGold(stage.reward), styles.body(16, CSS.goldLight))
        .setOrigin(0, 0.5),
    );
    if (best !== undefined) {
      card.add(
        this.add
          .text(w / 2 - 16, h / 2 - 27, `Best ${formatTime(best)}`, styles.body(14, '#cfe6bd'))
          .setOrigin(1, 0.5),
      );
    }
    if (cleared) {
      card.add(this.add.text(w / 2 - 22, -h / 2 + 26, '★', { fontSize: '26px', color: CSS.gold }).setOrigin(0.5));
    }

    card.setSize(w, h);
    card.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    (card.input as Phaser.Types.Input.InteractiveObject).cursor = 'pointer';
    card.on('pointerover', () => this.tweens.add({ targets: card, scale: 1.03, duration: 120 }));
    card.on('pointerout', () => this.tweens.add({ targets: card, scale: 1, duration: 120 }));
    card.on('pointerdown', () => {
      audio.unlock();
      card.setScale(0.97);
    });
    card.on('pointerup', () => {
      audio.play('select');
      audio.stopMusic();
      fadeToScene(this, 'Battle', { stageIndex: index });
    });
  }
}
