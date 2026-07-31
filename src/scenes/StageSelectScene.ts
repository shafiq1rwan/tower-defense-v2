import Phaser from 'phaser';

import { CSS, DEPTH, FONT_DISPLAY, STAGE_H } from '../core/constants';
import { Button, board, drawPanel, fadeToScene, formatGold, formatTime, ribbon, styles } from '../core/ui';
import { audio } from '../core/audio';
import { save } from '../core/save';
import { STAGES } from '../data/stages';

export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect');
  }

  create() {
    const W = this.scale.width;

    this.cameras.main.setBackgroundColor('#22323f');
    this.add.graphics().fillStyle(0x22323f, 1).fillRect(0, 0, W, STAGE_H).setDepth(DEPTH.sky);

    this.buildHeader(W);
    this.buildGrid(W);

    this.cameras.main.fadeIn(260, 0, 0, 0);
    audio.startMusic('menu');
  }

  private buildHeader(W: number) {
    const g = this.add.graphics().setDepth(DEPTH.hud);
    drawPanel(g, -20, -30, W + 40, 92, { radius: 18, fill: 0x2f2330, edge: 0x1a1119, sheen: 0x453447 });

    ribbon(this, W / 2, 40, 360).setDepth(DEPTH.hud + 1);
    this.add
      .text(W / 2, 32, 'Choose a Battle', styles.plate(26, CSS.ribbonInk))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 2);

    new Button(this, 84, 34, '← Back', () => fadeToScene(this, 'Menu'), {
      width: 128,
      height: 48,
      fontSize: 18,
    }).setDepth(DEPTH.hud + 1);

    // Purse — right-aligned so long balances grow away from the button.
    const purse = this.add
      .text(W - 170, 33, formatGold(save.data.gold), {
        fontFamily: FONT_DISPLAY,
        fontSize: '25px',
        color: CSS.goldLight,
        stroke: '#2b1810',
        strokeThickness: 5,
      })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud + 1);
    this.add
      .image(W - 170 - purse.width - 22, 34, 'ui_gold')
      .setScale(0.26)
      .setDepth(DEPTH.hud + 1);

    new Button(this, W - 84, 34, 'Barracks', () => fadeToScene(this, 'Barracks'), {
      width: 132,
      height: 48,
      fontSize: 18,
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

    const bg = board(this, 0, 0, w, h);
    if (locked) bg.setTint(0x8f8a83);
    card.add(bg);

    // Stage number badge.
    const badge = this.add.graphics();
    badge.fillStyle(0x43301f, locked ? 0.55 : 0.9).fillCircle(-w / 2 + 32, -h / 2 + 32, 19);
    card.add(badge);
    card.add(
      this.add
        .text(-w / 2 + 32, -h / 2 + 31, String(index + 1), {
          fontFamily: FONT_DISPLAY,
          fontSize: '20px',
          color: CSS.goldLight,
        })
        .setOrigin(0.5),
    );

    const name = this.add
      .text(-w / 2 + 60, -h / 2 + 22, stage.name, styles.plate(19, locked ? '#7c7268' : CSS.boardInk))
      .setOrigin(0, 0);
    if (name.width > w - 76) name.setFontSize(16);
    card.add(name);

    card.add(
      this.add
        .text(-w / 2 + 22, -h / 2 + 60, locked ? 'Locked' : stage.subtitle, styles.body(14, locked ? '#7c7268' : CSS.boardMuted))
        .setOrigin(0, 0)
        .setWordWrapWidth(w - 44),
    );

    if (locked) {
      const lock = this.add.image(0, h / 2 - 44, 'ui_icon_lock');
      lock.setDisplaySize(38, 38).setAlpha(0.9);
      card.add(lock);
      card.add(
        this.add
          .text(0, h / 2 - 74, `Clear stage ${index}`, styles.body(13, '#7c7268'))
          .setOrigin(0.5),
      );
      return;
    }

    // Reward + best time footer.
    card.add(this.add.image(-w / 2 + 32, h / 2 - 30, 'ui_gold').setScale(0.19));
    card.add(
      this.add
        .text(-w / 2 + 50, h / 2 - 31, formatGold(stage.reward), styles.body(16, CSS.goldInk))
        .setOrigin(0, 0.5),
    );
    if (best !== undefined) {
      card.add(
        this.add
          .text(w / 2 - 22, h / 2 - 31, `Best ${formatTime(best)}`, styles.body(14, '#4c6b35'))
          .setOrigin(1, 0.5),
      );
    }
    if (cleared) {
      card.add(this.add.text(w / 2 - 26, -h / 2 + 30, '★', { fontSize: '26px', color: '#c9861a' }).setOrigin(0.5));
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
