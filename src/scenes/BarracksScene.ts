import Phaser from 'phaser';

import { COLORS, CSS, DEPTH, FONT_DISPLAY, STAGE_H } from '../core/constants';
import { Button, drawPanel, fadeToScene, formatGold, styles } from '../core/ui';
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

    this.add.text(W / 2, 18, 'Barracks', styles.heading(30, CSS.gold)).setOrigin(0.5, 0).setDepth(DEPTH.hud + 1);

    new Button(this, 84, 32, '← Back', () => fadeToScene(this, 'StageSelect'), {
      width: 128,
      height: 46,
      fontSize: 18,
      fill: 0x4a2c19,
      edge: 0x2b1810,
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
    const h = 152;
    const cy = 136 + h / 2;
    const rowW = w * cols + gap * (cols - 1);
    const left = (W - rowW) / 2;

    UPGRADES.forEach((def, i) => {
      const x = left + w / 2 + i * (w + gap);
      const card = this.add.container(x, cy).setDepth(DEPTH.hud);

      const bg = this.add.graphics();
      drawPanel(bg, -w / 2, -h / 2, w, h, {
        radius: 16,
        fill: 0x3d3350,
        edge: 0x221b2e,
        sheen: 0x50446a,
      });
      card.add(bg);

      card.add(this.add.text(0, -h / 2 + 14, def.name, styles.heading(21, CSS.parchment)).setOrigin(0.5, 0));

      const levelText = this.add.text(0, -h / 2 + 46, '', styles.body(15, '#c6b7d4')).setOrigin(0.5, 0);
      card.add(levelText);

      const valueText = this.add.text(0, -h / 2 + 70, '', styles.body(18, CSS.goldLight)).setOrigin(0.5, 0);
      card.add(valueText);

      // No button sound: buyUpgrade plays 'upgrade' on success / 'deny' on
      // failure, and the click chirp would double up with either.
      const btn = new Button(this, 0, h / 2 - 30, '', () => this.buyUpgrade(def.id), {
        width: w - 28,
        height: 44,
        fontSize: 17,
        fill: 0x2f7a34,
        edge: 0x1b4a1e,
        sheen: 0x46a04c,
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
    this.add.text(40, 306, 'TROOPS', styles.heading(20, '#cbb9d6')).setDepth(DEPTH.hud);

    const gap = 16;
    const cols = Math.max(owned.length, 1);
    // Capped so a two-troop roster doesn't stretch into two huge slabs.
    const w = Math.min(238, (W - 80 - gap * (cols - 1)) / cols);
    const h = 232;
    const cy = 342 + h / 2;
    const rowW = w * cols + gap * (cols - 1);
    const left = (W - rowW) / 2;

    owned.forEach((key, i) => {
      const def = troopByKey(key);
      const x = left + w / 2 + i * (w + gap);
      const card = this.add.container(x, cy).setDepth(DEPTH.hud);

      const bg = this.add.graphics();
      drawPanel(bg, -w / 2, -h / 2, w, h, {
        radius: 16,
        fill: COLORS.wood,
        edge: COLORS.woodDark,
        sheen: COLORS.woodLight,
      });
      card.add(bg);

      card.add(
        this.add
          .sprite(0, -h / 2 + 66, def.tex)
          .setOrigin(0.47, 0.45)
          .setScale(Math.min(w / 165, 1))
          .play(animKey(def.tex, 'idle')),
      );

      card.add(this.add.text(0, -h / 2 + 108, def.name, styles.heading(20, CSS.parchment)).setOrigin(0.5, 0));

      const levelText = this.add.text(0, -h / 2 + 136, '', styles.body(15, '#f0dfbe')).setOrigin(0.5, 0);
      card.add(levelText);

      const statText = this.add.text(0, -h / 2 + 158, '', styles.body(15, CSS.goldLight)).setOrigin(0.5, 0);
      card.add(statText);

      const btn = new Button(this, 0, h / 2 - 28, '', () => this.buyTroop(key), {
        width: w - 28,
        height: 42,
        fontSize: 16,
        fill: 0x2f7a34,
        edge: 0x1b4a1e,
        sheen: 0x46a04c,
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
