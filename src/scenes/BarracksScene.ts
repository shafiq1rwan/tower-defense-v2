import Phaser from 'phaser';

import { CSS, DEPTH, FONT_DISPLAY, STAGE_H } from '../core/constants';
import { Button, board, drawPanel, fadeToScene, formatGold, ribbon, styles } from '../core/ui';
import { audio } from '../core/audio';
import {
  MAX_TROOP_LEVEL,
  MAX_UPGRADE_LEVEL,
  UPGRADES,
  save,
  troopMultiplier,
  troopUpgradeCost,
} from '../core/save';
import { unlockedTroops } from '../data/stages';
import { troopByKey } from '../data/troops';
import { animKey } from '../data/anims';

/** Between-battle spending: kingdom-wide upgrades and per-troop levels. */
export class BarracksScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private refreshers: Array<() => void> = [];

  constructor() {
    super('Barracks');
  }

  create() {
    const W = this.scale.width;
    this.refreshers = [];

    this.cameras.main.setBackgroundColor('#241d2c');
    this.add.graphics().fillStyle(0x241d2c, 1).fillRect(0, 0, W, STAGE_H).setDepth(DEPTH.sky);

    this.buildHeader(W);
    this.buildUpgrades(W);
    this.buildTroops(W);

    this.add
      .text(W / 2, STAGE_H - 22, 'Gold is earned by clearing stages and defeating goblins in battle.', styles.body(14, '#b3a8bd'))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    this.cameras.main.fadeIn(260, 0, 0, 0);
    audio.startMusic('menu');
  }

  private refreshAll() {
    this.goldText.setText(formatGold(save.data.gold));
    this.refreshers.forEach((fn) => fn());
  }

  private buildHeader(W: number) {
    const g = this.add.graphics().setDepth(DEPTH.hud);
    drawPanel(g, -20, -30, W + 40, 88, { radius: 18, fill: 0x2f2330, edge: 0x1a1119, sheen: 0x453447 });

    ribbon(this, W / 2, 38, 300).setDepth(DEPTH.hud + 1);
    this.add
      .text(W / 2, 30, 'Barracks', styles.plate(25, CSS.ribbonInk))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 2);

    new Button(this, 84, 32, '← Back', () => fadeToScene(this, 'StageSelect'), {
      width: 128,
      height: 48,
      fontSize: 18,
    }).setDepth(DEPTH.hud + 1);

    this.add.image(W - 150, 32, 'ui_gold').setScale(0.28).setDepth(DEPTH.hud + 1);
    this.goldText = this.add
      .text(W - 124, 31, formatGold(save.data.gold), {
        fontFamily: FONT_DISPLAY,
        fontSize: '27px',
        color: CSS.goldLight,
        stroke: '#2b1810',
        strokeThickness: 5,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud + 1);
  }

  /* --------------------------- kingdom upgrades --------------------------- */

  private buildUpgrades(W: number) {
    this.add.text(40, 100, 'KINGDOM', styles.heading(20, '#cbb9d6')).setDepth(DEPTH.hud);

    const gap = 16;
    const cols = UPGRADES.length;
    const w = Math.min(310, (W - 80 - gap * (cols - 1)) / cols);
    const h = 158;
    const cy = 136 + h / 2;
    const rowW = w * cols + gap * (cols - 1);
    const left = (W - rowW) / 2;

    UPGRADES.forEach((def, i) => {
      const x = left + w / 2 + i * (w + gap);
      const card = this.add.container(x, cy).setDepth(DEPTH.hud);

      card.add(board(this, 0, 0, w, h));

      card.add(this.add.text(0, -h / 2 + 16, def.name, styles.plate(21, CSS.boardInk)).setOrigin(0.5, 0));

      const levelText = this.add.text(0, -h / 2 + 48, '', styles.body(15, CSS.boardMuted)).setOrigin(0.5, 0);
      card.add(levelText);

      const valueText = this.add.text(0, -h / 2 + 72, '', styles.body(18, CSS.goldInk)).setOrigin(0.5, 0);
      card.add(valueText);

      const btn = new Button(this, 0, h / 2 - 33, '', () => this.buyUpgrade(def.id), {
        width: w - 32,
        height: 46,
        fontSize: 17,
        sound: 'click',
      });
      card.add(btn);

      const refresh = () => {
        const lvl = save.upgradeLevel(def.id);
        const maxed = lvl >= MAX_UPGRADE_LEVEL;
        levelText.setText(`Level ${lvl + 1} / ${MAX_UPGRADE_LEVEL + 1}`);
        valueText.setText(maxed ? def.valueAt(lvl) : `${def.valueAt(lvl)}  →  ${def.valueAt(lvl + 1)}`);
        if (maxed) {
          btn.setLabel('MAX').setEnabled(false);
        } else {
          const cost = def.costAt(lvl);
          btn.setLabel(`${formatGold(cost)} g`).setEnabled(save.data.gold >= cost);
        }
      };
      refresh();
      this.refreshers.push(refresh);
    });
  }

  private buyUpgrade(id: (typeof UPGRADES)[number]['id']) {
    const def = UPGRADES.find((u) => u.id === id)!;
    const lvl = save.upgradeLevel(id);
    if (lvl >= MAX_UPGRADE_LEVEL) return;
    const cost = def.costAt(lvl);
    if (!save.spendGold(cost)) {
      audio.play('deny');
      return;
    }
    save.data.upgrades[id] = lvl + 1;
    save.flush();
    audio.play('upgrade');
    this.refreshAll();
  }

  /* ------------------------------- troops -------------------------------- */

  private buildTroops(W: number) {
    const owned = unlockedTroops(save.data.cleared);
    this.add.text(40, 312, 'TROOPS', styles.heading(20, '#cbb9d6')).setDepth(DEPTH.hud);

    const gap = 16;
    const cols = Math.max(owned.length, 1);
    // Capped so a two-troop roster doesn't stretch into two huge slabs.
    const w = Math.min(238, (W - 80 - gap * (cols - 1)) / cols);
    const h = 238;
    const cy = 348 + h / 2;
    const rowW = w * cols + gap * (cols - 1);
    const left = (W - rowW) / 2;

    owned.forEach((key, i) => {
      const def = troopByKey(key);
      const x = left + w / 2 + i * (w + gap);
      const card = this.add.container(x, cy).setDepth(DEPTH.hud);

      card.add(board(this, 0, 0, w, h));

      card.add(
        this.add
          .sprite(0, -h / 2 + 70, def.tex)
          .setOrigin(0.47, 0.45)
          .setScale(Math.min(w / 165, 1))
          .play(animKey(def.tex, 'idle')),
      );

      card.add(this.add.text(0, -h / 2 + 112, def.name, styles.plate(20, CSS.boardInk)).setOrigin(0.5, 0));

      const levelText = this.add.text(0, -h / 2 + 140, '', styles.body(15, CSS.boardMuted)).setOrigin(0.5, 0);
      card.add(levelText);

      const statText = this.add.text(0, -h / 2 + 162, '', styles.body(15, CSS.goldInk)).setOrigin(0.5, 0);
      card.add(statText);

      const btn = new Button(this, 0, h / 2 - 31, '', () => this.buyTroop(key), {
        width: w - 32,
        height: 44,
        fontSize: 16,
        sound: 'click',
      });
      card.add(btn);

      const refresh = () => {
        const lvl = save.troopLevel(key);
        const mult = troopMultiplier(lvl);
        const maxed = lvl >= MAX_TROOP_LEVEL;
        levelText.setText(`Level ${lvl} / ${MAX_TROOP_LEVEL}`);
        statText.setText(`${Math.round(def.hp * mult)} hp · ${Math.round(def.attack * mult)} atk`);
        if (maxed) {
          btn.setLabel('MAX').setEnabled(false);
        } else {
          const cost = troopUpgradeCost(def.tier, lvl);
          btn.setLabel(`${formatGold(cost)} g`).setEnabled(save.data.gold >= cost);
        }
      };
      refresh();
      this.refreshers.push(refresh);
    });
  }

  private buyTroop(key: string) {
    const def = troopByKey(key);
    const lvl = save.troopLevel(key);
    if (lvl >= MAX_TROOP_LEVEL) return;
    const cost = troopUpgradeCost(def.tier, lvl);
    if (!save.spendGold(cost)) {
      audio.play('deny');
      return;
    }
    save.setTroopLevel(key, lvl + 1);
    audio.play('upgrade');
    this.refreshAll();
  }
}
