import Phaser from 'phaser';

import { CSS, DEPTH, FONT_DISPLAY, STAGE_H } from '../core/constants';
import { Button, board, drawPanel, fadeToScene, formatGold, formatTime, ribbon, styles } from '../core/ui';
import { audio } from '../core/audio';
import { save } from '../core/save';
import { STAGES } from '../data/stages';
import { troopByKey } from '../data/troops';
import { animKey } from '../data/anims';

export interface ResultData {
  stageIndex: number;
  won: boolean;
  reward: number;
  elapsed: number;
  unlocked?: string;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(data: ResultData) {
    const W = this.scale.width;
    const { won, reward, elapsed, stageIndex } = data;
    const stage = STAGES[stageIndex];
    // BattleScene only sets this on a first clear.
    const unlocked = data.unlocked;

    this.cameras.main.setBackgroundColor(won ? '#20321f' : '#31201f');
    this.add
      .graphics()
      .fillStyle(won ? 0x20321f : 0x31201f, 1)
      .fillRect(0, 0, W, STAGE_H)
      .setDepth(DEPTH.sky);

    // Celebration rays behind the panel.
    if (won) this.drawRays(W);

    const panelW = Math.min(620, W - 80);
    const panelH = unlocked ? 480 : 410;
    const cx = W / 2;
    const cy = STAGE_H / 2 + 16;

    board(this, cx, cy, panelW, panelH).setDepth(DEPTH.hud);

    const title = this.add
      .text(cx, cy - panelH / 2 - 46, won ? 'VICTORY!' : 'DEFEAT', styles.title(won ? 62 : 54))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 1)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });

    // Stage name rides a ribbon pinned to the board's top edge.
    ribbon(this, cx, cy - panelH / 2 + 6, Math.min(panelW - 120, 380)).setDepth(DEPTH.hud + 1);
    this.add
      .text(cx, cy - panelH / 2 - 2, stage.name, styles.plate(21, CSS.ribbonInk))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 2);

    this.add
      .text(
        cx,
        cy - panelH / 2 + 56,
        won ? 'The goblin castle is rubble.' : 'Your walls did not hold. Try again stronger.',
        styles.body(17, CSS.boardMuted),
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 1);

    /* ------------------------------ stats ------------------------------ */
    const rowY = cy - panelH / 2 + 104;
    this.statRow(cx, rowY, panelW, 'Time', formatTime(elapsed));
    this.statRow(cx, rowY + 44, panelW, 'Gold earned', `+${formatGold(reward)}`);
    this.statRow(cx, rowY + 88, panelW, 'Purse', formatGold(save.data.gold));

    const nextY = rowY + 138;

    if (unlocked) {
      const def = troopByKey(unlocked);
      const ug = this.add.graphics().setDepth(DEPTH.hud + 1);
      drawPanel(ug, cx - panelW / 2 + 34, nextY - 12, panelW - 68, 84, {
        radius: 14,
        fill: 0x2f7a34,
        edge: 0x1b4a1e,
        sheen: 0x46a04c,
      });

      const portrait = this.add
        .sprite(cx - panelW / 2 + 90, nextY + 30, def.tex)
        .setOrigin(0.47, 0.45)
        .setScale(0.62)
        .setDepth(DEPTH.hud + 2)
        .play(animKey(def.tex, 'idle'));
      this.tweens.add({
        targets: portrait,
        scale: 0.68,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.add
        .text(cx - panelW / 2 + 138, nextY + 8, 'NEW TROOP UNLOCKED', styles.body(14, '#d6f5cf'))
        .setDepth(DEPTH.hud + 2);
      this.add
        .text(cx - panelW / 2 + 138, nextY + 30, def.name, styles.heading(24, CSS.goldLight))
        .setDepth(DEPTH.hud + 2);
    }

    /* ----------------------------- buttons ----------------------------- */
    const btnY = cy + panelH / 2 - 58;
    const hasNext = won && stageIndex + 1 < STAGES.length;
    const labels: Array<[string, () => void]> = [
      ['Map', () => fadeToScene(this, 'StageSelect')],
      [won ? 'Replay' : 'Retry', () => fadeToScene(this, 'Battle', { stageIndex })],
    ];
    if (hasNext) {
      labels.push(['Next Battle', () => fadeToScene(this, 'Battle', { stageIndex: stageIndex + 1 })]);
    }

    const btnW = Math.min(190, (panelW - 60) / labels.length - 12);
    const totalW = btnW * labels.length + 12 * (labels.length - 1);
    labels.forEach(([label, fn], i) => {
      new Button(this, cx - totalW / 2 + btnW / 2 + i * (btnW + 12), btnY, label, fn, {
        width: btnW,
        height: 58,
        fontSize: 21,
        sound: 'select',
      }).setDepth(DEPTH.hud + 2);
    });

    this.cameras.main.fadeIn(320, 0, 0, 0);
    audio.startMusic('menu');
  }

  private statRow(cx: number, y: number, panelW: number, label: string, value: string) {
    const inset = panelW / 2 - 54;
    this.add
      .text(cx - inset, y, label, styles.body(18, CSS.boardMuted))
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud + 1);
    this.add
      .text(cx + inset, y, value, {
        fontFamily: FONT_DISPLAY,
        fontSize: '24px',
        color: CSS.goldInk,
      })
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud + 1);
  }

  /** Slowly turning god-rays behind the victory panel. Drawn around the
   *  Graphics' own origin so the rotation tween spins about the centre. */
  private drawRays(W: number) {
    const g = this.add.graphics({ x: W / 2, y: STAGE_H / 2 }).setDepth(DEPTH.sky + 1);
    g.fillStyle(0xffe9a8, 0.07);
    const spread = 0.12;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a - spread) * 1600, Math.sin(a - spread) * 1600);
      g.lineTo(Math.cos(a + spread) * 1600, Math.sin(a + spread) * 1600);
      g.closePath();
      g.fillPath();
    }
    this.tweens.add({ targets: g, angle: 360, duration: 90000, repeat: -1 });
  }
}
