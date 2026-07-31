import Phaser from 'phaser';

import { CSS, DEPTH, FONT_DISPLAY, STAGE_H } from '../core/constants';
import {
  Button,
  board,
  displayLift,
  drawPanel,
  fadeToScene,
  fitText,
  formatGold,
  formatTime,
  ribbon,
  styles,
} from '../core/ui';
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
    this.buildList(W);

    this.cameras.main.fadeIn(260, 0, 0, 0);
    audio.startMusic('menu');
  }

  private buildHeader(W: number) {
    const g = this.add.graphics().setDepth(DEPTH.hud);
    drawPanel(g, -20, -30, W + 40, 92, { radius: 18, fill: 0x2f2330, edge: 0x1a1119, sheen: 0x453447 });

    ribbon(this, W / 2, 40, 400).setDepth(DEPTH.hud + 1);
    this.add
      .text(W / 2, 30, 'Choose a Battle', styles.plate(28, CSS.ribbonInk))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 2);

    new Button(this, 84, 34, '← Back', () => fadeToScene(this, 'Menu'), {
      width: 130,
      height: 50,
      fontSize: 19,
    }).setDepth(DEPTH.hud + 1);

    // Purse — right-aligned so long balances grow away from the button.
    const purse = this.add
      .text(W - 170, 31, formatGold(save.data.gold), {
        fontFamily: FONT_DISPLAY,
        fontSize: '26px',
        color: CSS.goldLight,
        stroke: '#2b1810',
        strokeThickness: 5,
      })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud + 1);
    this.add
      .image(W - 170 - purse.width - 22, 33, 'ui_gold')
      .setScale(0.26)
      .setDepth(DEPTH.hud + 1);

    new Button(this, W - 84, 34, 'Barracks', () => fadeToScene(this, 'Barracks'), {
      width: 134,
      height: 50,
      fontSize: 19,
    }).setDepth(DEPTH.hud + 1);
  }

  /** One stage per row, top to bottom — the whole campaign at a glance. */
  private buildList(W: number) {
    const rowW = Math.min(1020, W - 90);
    const rowH = 66;
    const gap = 8;
    const top = 104;
    const total = STAGES.length * rowH + (STAGES.length - 1) * gap;
    const available = STAGE_H - 18 - top;
    const startY = top + Math.max(0, (available - total) / 2) + rowH / 2;

    STAGES.forEach((_stage, i) => {
      // One stage ahead of your progress is always playable; beyond that is locked.
      this.buildRow(W / 2, startY + i * (rowH + gap), rowW, rowH, i, i > save.data.cleared);
    });
  }

  private buildRow(x: number, y: number, w: number, h: number, index: number, locked: boolean) {
    const stage = STAGES[index];
    const cleared = index < save.data.cleared;
    const best = save.data.best[index];

    const row = this.add.container(x, y).setDepth(DEPTH.hud);

    const bg = board(this, 0, 0, w, h);
    if (locked) bg.setTint(0x8f8a83);
    row.add(bg);

    // Stage number badge.
    const badge = this.add.graphics();
    badge.fillStyle(0x43301f, locked ? 0.55 : 0.9).fillCircle(-w / 2 + 40, 0, 20);
    row.add(badge);
    row.add(
      this.add
        .text(-w / 2 + 40, displayLift(21), String(index + 1), {
          fontFamily: FONT_DISPLAY,
          fontSize: '21px',
          color: CSS.goldLight,
        })
        .setOrigin(0.5),
    );

    // Name, then subtitle continuing along the same line.
    const name = this.add
      .text(-w / 2 + 76, displayLift(22), stage.name, styles.plate(22, locked ? '#7c7268' : CSS.boardInk))
      .setOrigin(0, 0.5);
    fitText(name, 268);
    row.add(name);

    const subtitle = this.add
      .text(
        -w / 2 + 360,
        0,
        locked ? `Clear stage ${index} to unlock` : stage.subtitle,
        styles.body(16, locked ? '#7c7268' : CSS.boardMuted),
      )
      .setOrigin(0, 0.5);
    fitText(subtitle, w - 360 - 268);
    row.add(subtitle);

    if (locked) {
      const lock = this.add.image(w / 2 - 38, 0, 'ui_icon_lock');
      lock.setDisplaySize(32, 32).setAlpha(0.9);
      row.add(lock);
      return;
    }

    // Right cluster: reward, best time, cleared star.
    row.add(this.add.image(w / 2 - 244, 0, 'ui_gold').setScale(0.2));
    row.add(
      this.add
        .text(w / 2 - 224, -1, formatGold(stage.reward), styles.body(17, CSS.goldInk))
        .setOrigin(0, 0.5),
    );
    if (best !== undefined) {
      row.add(
        this.add
          .text(w / 2 - 70, 0, `Best ${formatTime(best)}`, styles.body(15, '#4c6b35'))
          .setOrigin(1, 0.5),
      );
    }
    if (cleared) {
      row.add(this.add.text(w / 2 - 38, -2, '★', { fontSize: '26px', color: '#c9861a' }).setOrigin(0.5));
    }

    row.setSize(w, h);
    row.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    (row.input as Phaser.Types.Input.InteractiveObject).cursor = 'pointer';
    row.on('pointerover', () => this.tweens.add({ targets: row, scale: 1.015, duration: 120 }));
    row.on('pointerout', () => this.tweens.add({ targets: row, scale: 1, duration: 120 }));
    row.on('pointerdown', () => {
      audio.unlock();
      row.setScale(0.985);
    });
    row.on('pointerup', () => {
      audio.play('select');
      audio.stopMusic();
      fadeToScene(this, 'Battle', { stageIndex: index });
    });
  }
}
