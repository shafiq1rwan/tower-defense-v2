import Phaser from 'phaser';

import { CSS, DEPTH, FONT_DISPLAY, FONT_UI, HUD_TOP, STAGE_H, TOPBAR_H } from '../core/constants';
import { Bar, Button, board, displayLift, drawPanel, formatTime, ribbon, styles } from '../core/ui';
import { audio } from '../core/audio';
import { save } from '../core/save';
import { STAGES } from '../data/stages';
import { animKey } from '../data/anims';
import type { PlayerTroopDef } from '../data/troops';
import type { BattleScene, Outcome } from './BattleScene';

/* ------------------------------------------------------------------ */
/* Troop card                                                          */
/* ------------------------------------------------------------------ */

class TroopCard extends Phaser.GameObjects.Container {
  private slice: Phaser.GameObjects.NineSlice;
  private cdMask: Phaser.GameObjects.Graphics;
  private portrait: Phaser.GameObjects.Sprite;
  private costText: Phaser.GameObjects.Text;
  private cdText: Phaser.GameObjects.Text;
  private lastReady: boolean | null = null;
  private lastAfford: boolean | null = null;
  private lastCd = -1;

  // `w` would shadow Phaser's Transform component property, so the card's own
  // dimensions get their own names.
  private readonly cardW: number;
  private readonly cardH: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    readonly def: PlayerTroopDef,
    index: number,
    onDeploy: () => void,
  ) {
    super(scene, x, y);
    this.cardW = w;
    this.cardH = h;

    // The card IS a pack button: teal when ready, grey art when not.
    this.slice = scene.add.nineslice(0, 0, 'ui_button_blue_9s', undefined, w, h, 26, 26, 26, 26);
    this.add(this.slice);

    this.portrait = scene.add
      .sprite(0, -h * 0.12, def.tex)
      // Characters sit slightly up-left of centre inside their 192px cell.
      .setOrigin(0.47, 0.45)
      .setScale(Math.min(w / 150, 0.92))
      .play(animKey(def.tex, 'idle'));
    this.add(this.portrait);

    // Cost pill.
    const pillY = h / 2 - 22;
    const pill = scene.add.graphics();
    pill.fillStyle(0x2a2f38, 0.85);
    pill.fillRoundedRect(-w / 2 + 10, pillY - 15, w - 20, 30, 10);
    this.add(pill);

    const coin = scene.add.image(-w / 2 + 28, pillY, 'ui_gold').setScale(0.19);
    this.add(coin);

    this.costText = scene.add
      .text(6, pillY + displayLift(21), String(def.cost), {
        fontFamily: FONT_DISPLAY,
        fontSize: '21px',
        color: CSS.goldLight,
        stroke: '#22262e',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.add(this.costText);

    // Name strip.
    const name = scene.add
      .text(0, -h / 2 + 18, def.name, {
        fontFamily: FONT_UI,
        fontSize: '16px',
        fontStyle: '800',
        color: CSS.buttonInk,
      })
      .setOrigin(0.5);
    if (name.width > w - 16) name.setFontSize(14);
    this.add(name);

    // Cooldown wipe + countdown.
    this.cdMask = scene.add.graphics();
    this.add(this.cdMask);
    this.cdText = scene.add
      .text(0, -h * 0.1, '', {
        fontFamily: FONT_DISPLAY,
        fontSize: '30px',
        color: CSS.white,
        stroke: '#2a1f2d',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.add(this.cdText);

    // Keyboard hint, only meaningful with a physical keyboard attached.
    if (!scene.sys.game.device.input.touch || scene.sys.game.device.os.desktop) {
      const hint = scene.add
        .text(w / 2 - 14, -h / 2 + 16, String(index + 1), {
          fontFamily: FONT_DISPLAY,
          fontSize: '14px',
          color: CSS.buttonInk,
        })
        .setOrigin(0.5)
        .setAlpha(0.65);
      this.add(hint);
    }

    this.setSize(w, h);
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    (this.input as Phaser.Types.Input.InteractiveObject).cursor = 'pointer';

    this.on('pointerdown', () => {
      audio.unlock();
      if (this.lastReady) this.slice.setTexture('ui_button_blue_9s_pressed');
      this.setScale(0.95);
    });
    this.on('pointerout', () => {
      this.applyTexture();
      this.setScale(1);
    });
    this.on('pointerup', () => {
      this.applyTexture();
      this.scene.tweens.add({ targets: this, scale: 1, duration: 130, ease: 'Back.easeOut' });
      onDeploy();
    });

    scene.add.existing(this);
  }

  /** Plays when a deploy actually goes through. */
  flash() {
    this.scene.tweens.add({
      targets: this.portrait,
      scaleX: this.portrait.scaleX * 1.18,
      scaleY: this.portrait.scaleY * 1.18,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private applyTexture() {
    this.slice.setTexture(this.lastReady ? 'ui_button_blue_9s' : 'ui_button_disable_9s');
  }

  /** `affordable` drives the price colour; `ready` (affordable *and* off
   *  cooldown) drives the card's overall lit/unlit state. Keeping them apart
   *  stops a recharging card from reading as "you're broke". */
  refresh(affordable: boolean, cdFraction: number, cdMs: number) {
    const ready = affordable && cdMs <= 0;

    if (ready !== this.lastReady) {
      this.lastReady = ready;
      this.applyTexture();
      this.portrait.setAlpha(ready ? 1 : 0.6);
    }
    if (affordable !== this.lastAfford) {
      this.lastAfford = affordable;
      this.costText.setColor(affordable ? CSS.goldLight : CSS.danger);
    }

    if (Math.abs(cdFraction - this.lastCd) > 0.005 || (cdFraction === 0 && this.lastCd !== 0)) {
      this.lastCd = cdFraction;
      const w = this.cardW;
      const h = this.cardH;
      this.cdMask.clear();
      if (cdFraction > 0) {
        this.cdMask.fillStyle(0x10141c, 0.55);
        this.cdMask.fillRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, (h - 10) * cdFraction, 12);
      }
    }

    const secs = cdMs / 1000;
    if (secs > 0.05) {
      this.cdText.setVisible(true).setText(secs >= 1 ? String(Math.ceil(secs)) : secs.toFixed(1));
    } else if (this.cdText.visible) {
      this.cdText.setVisible(false);
    }
  }
}

/* ------------------------------------------------------------------ */
/* HUD scene                                                           */
/* ------------------------------------------------------------------ */

export class HudScene extends Phaser.Scene {
  private battle!: BattleScene;
  private cards: TroopCard[] = [];

  private goldText!: Phaser.GameObjects.Text;
  private goldBar!: Bar;
  private playerBar!: Bar;
  private enemyBar!: Bar;
  private timerText!: Phaser.GameObjects.Text;
  private cannonBtn!: Phaser.GameObjects.Container;
  private cannonSlice!: Phaser.GameObjects.NineSlice;
  private cannonFill!: Phaser.GameObjects.Graphics;
  private cannonLabel!: Phaser.GameObjects.Text;
  private cannonReady = false;
  private speedBtn!: Button;
  private pauseLayer?: Phaser.GameObjects.Container;

  constructor() {
    super('Hud');
  }

  create() {
    this.battle = this.scene.get('Battle') as BattleScene;
    this.cards = [];

    this.buildTopBar();
    this.buildBottomBar();

    this.battle.events.on('announce', (text: string) => this.announce(text, CSS.gold));
    this.battle.events.on('boss', (name: string) => this.announce(name, '#ff8a6a', true));
    this.battle.events.on('outcome', (o: Outcome) => this.onOutcome(o));
    this.battle.events.on('paused', (on: boolean) => this.renderPause(on));
    // Speed and pause are also bound to keys, so the buttons follow the state
    // rather than owning it.
    this.battle.events.on('speed', (n: number) => this.speedBtn.setLabel(`${n}x`));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.battle.events.off('announce');
      this.battle.events.off('boss');
      this.battle.events.off('outcome');
      this.battle.events.off('paused');
      this.battle.events.off('speed');
    });
  }

  /* --------------------------- construction -------------------------- */

  private buildTopBar() {
    const W = this.scale.width;
    const g = this.add.graphics().setDepth(DEPTH.hud);
    drawPanel(g, -20, -30, W + 40, TOPBAR_H + 30, {
      radius: 18,
      fill: 0x2f2330,
      edge: 0x1a1119,
      sheen: 0x453447,
    });

    const barW = Math.min(300, W * 0.24);

    this.add
      .text(20, 12, 'YOUR CASTLE', styles.body(13, '#bfe4ff'))
      .setDepth(DEPTH.hud + 1);
    this.playerBar = new Bar(this, 20 + barW / 2, 40, barW, 17, { fill: 0x63c23c });
    this.playerBar.setDepth(DEPTH.hud + 1);

    this.add
      .text(W - 20, 12, 'GOBLIN CASTLE', styles.body(13, '#ffc7b5'))
      .setOrigin(1, 0)
      .setDepth(DEPTH.hud + 1);
    this.enemyBar = new Bar(this, W - 20 - barW / 2, 40, barW, 17, { fill: 0xe0553a });
    this.enemyBar.setDepth(DEPTH.hud + 1);

    // Stage name on a gold ribbon; the battle clock rides on the same banner.
    const stage = STAGES[this.battle.stageIndex];
    const nameProbe = this.add.text(0, 0, stage.name, styles.heading(22)).setVisible(false);
    const ribbonW = Math.min(W * 0.34, Math.max(260, nameProbe.width + 130));
    nameProbe.destroy();

    ribbon(this, W / 2, 36, ribbonW).setDepth(DEPTH.hud + 1);
    this.add
      .text(W / 2, 21, stage.name, styles.plate(22, CSS.ribbonInk))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.hud + 2);
    this.timerText = this.add
      .text(W / 2, 45, '0:00', styles.body(15, '#7a5c1d'))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.hud + 2);
  }

  private buildBottomBar() {
    const W = this.scale.width;
    const H = STAGE_H - HUD_TOP;

    // The deploy bar is one carved board; its torn edges bleed off-screen.
    board(this, W / 2, HUD_TOP + H / 2 + 16, W + 70, H + 60).setDepth(DEPTH.hud);

    /* -- wallet ------------------------------------------------------- */
    const walletW = Math.min(232, W * 0.19);
    const walletX = 16 + walletW / 2;

    const wg = this.add.graphics().setDepth(DEPTH.hud + 1);
    drawPanel(wg, 16, HUD_TOP + 20, walletW, 92, {
      radius: 14,
      fill: 0x4a2c19,
      edge: 0x2b1810,
      sheen: 0x633d22,
    });

    this.add
      .image(walletX - walletW / 2 + 34, HUD_TOP + 52, 'ui_gold')
      .setScale(0.3)
      .setDepth(DEPTH.hud + 2);

    this.goldText = this.add
      .text(walletX + 14, HUD_TOP + 52 + displayLift(32), '0', {
        fontFamily: FONT_DISPLAY,
        fontSize: '32px',
        color: CSS.goldLight,
        stroke: '#2b1810',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 2);

    this.goldBar = new Bar(this, walletX, HUD_TOP + 88, walletW - 26, 13, {
      fill: 0xffc53d,
      ghost: false,
    });
    this.goldBar.setDepth(DEPTH.hud + 2);

    /* -- right-hand controls ------------------------------------------ */
    const cannonW = Math.min(150, W * 0.13);
    const rightEdge = W - 16;

    this.cannonBtn = this.buildCannon(rightEdge - cannonW / 2, HUD_TOP + 62, cannonW, 86);

    this.speedBtn = new Button(
      this,
      rightEdge - cannonW - 12 - 42,
      HUD_TOP + 40,
      `${this.battle.speed}x`,
      () => this.battle.setSpeed(this.battle.speed === 1 ? 2 : 1),
      { width: 80, height: 52, fontSize: 20 },
    );
    this.speedBtn.setDepth(DEPTH.hud + 2);

    new Button(
      this,
      rightEdge - cannonW - 12 - 42,
      HUD_TOP + 98,
      'II',
      () => this.battle.setPaused(true),
      { width: 80, height: 52, fontSize: 20 },
    ).setDepth(DEPTH.hud + 2);

    /* -- troop cards --------------------------------------------------- */
    const roster = this.battle.roster;
    const leftEdge = 16 + walletW + 16;
    const rightLimit = rightEdge - cannonW - 12 - 88;
    const available = rightLimit - leftEdge;
    const gap = 10;
    const cardW = Phaser.Math.Clamp(
      (available - gap * (roster.length - 1)) / Math.max(1, roster.length),
      74,
      126,
    );
    const cardH = 132;
    const totalW = cardW * roster.length + gap * (roster.length - 1);
    const startX = leftEdge + (available - totalW) / 2 + cardW / 2;

    roster.forEach((def, i) => {
      const card = new TroopCard(
        this,
        startX + i * (cardW + gap),
        HUD_TOP + 22 + cardH / 2,
        cardW,
        cardH,
        def,
        i,
        () => {
          if (this.battle.tryDeploy(def.key)) card.flash();
        },
      );
      card.setDepth(DEPTH.hud + 2);
      this.cards.push(card);
    });
  }

  private buildCannon(x: number, y: number, w: number, h: number) {
    const c = this.add.container(x, y).setDepth(DEPTH.hud + 2);

    this.cannonSlice = this.add.nineslice(0, 0, 'ui_button_disable_9s', undefined, w, h, 26, 26, 26, 26);
    c.add(this.cannonSlice);

    this.cannonFill = this.add.graphics();
    c.add(this.cannonFill);

    this.cannonLabel = this.add
      .text(0, -Math.round(h * 0.055) + displayLift(19), 'CANNON', {
        fontFamily: FONT_DISPLAY,
        fontSize: '19px',
        color: '#77716a',
      })
      .setOrigin(0.5);
    c.add(this.cannonLabel);

    c.setSize(w, h);
    c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    (c.input as Phaser.Types.Input.InteractiveObject).cursor = 'pointer';
    c.on('pointerdown', () => {
      audio.unlock();
      if (this.cannonReady) this.cannonSlice.setTexture('ui_button_red_9s_pressed');
      c.setScale(0.95);
    });
    c.on('pointerout', () => {
      this.paintCannon();
      c.setScale(1);
    });
    c.on('pointerup', () => {
      this.paintCannon();
      this.tweens.add({ targets: c, scale: 1, duration: 130, ease: 'Back.easeOut' });
      this.battle.fireCannon();
    });

    return c;
  }

  private paintCannon() {
    this.cannonSlice.setTexture(this.cannonReady ? 'ui_button_red_9s' : 'ui_button_disable_9s');
    if (this.cannonReady) {
      this.cannonLabel.setColor('#ffe9c8').setStroke('#5e1c10', 4);
    } else {
      this.cannonLabel.setColor('#77716a').setStroke('#00000000', 0);
    }
  }

  /* ------------------------------ runtime ---------------------------- */

  override update(_time: number, delta: number) {
    const b = this.battle;
    if (!b || !b.scene.isActive()) return;

    this.goldText.setText(String(Math.floor(b.gold)));
    this.goldBar.setValue(b.gold / b.goldCap);
    this.goldBar.step(delta);

    this.playerBar.setValue(b.playerBase.hpFraction);
    this.enemyBar.setValue(b.enemyBase.hpFraction);
    this.playerBar.step(delta);
    this.enemyBar.step(delta);

    this.timerText.setText(formatTime(b.elapsed));

    for (const card of this.cards) {
      const left = b.cooldowns[card.def.key] ?? 0;
      card.refresh(b.gold >= card.def.cost, b.cooldownFraction(card.def.key), left);
    }

    this.updateCannon(b);
  }

  private updateCannon(b: BattleScene) {
    const frac = Phaser.Math.Clamp(b.cannon / b.cannonMax, 0, 1);
    const w = this.cannonBtn.width;
    const h = this.cannonBtn.height;

    this.cannonFill.clear();
    if (frac < 1) {
      this.cannonFill.fillStyle(0x10141c, 0.5);
      this.cannonFill.fillRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, (h - 10) * (1 - frac), 12);
    }

    if (b.cannonReady !== this.cannonReady) {
      this.cannonReady = b.cannonReady;
      this.paintCannon();
      if (this.cannonReady) {
        this.tweens.add({
          targets: this.cannonBtn,
          scale: 1.07,
          duration: 420,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
        });
        this.announce('CANNON READY', CSS.gold);
      }
    }
  }

  /* --------------------------- announcements ------------------------- */

  private announce(text: string, color: string, big = false) {
    const W = this.scale.width;
    const y = 190;

    const label = this.add
      .text(W / 2, y, text, {
        fontFamily: FONT_DISPLAY,
        fontSize: big ? '52px' : '34px',
        color,
        stroke: '#2a1119',
        strokeThickness: big ? 10 : 7,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay)
      .setAlpha(0)
      .setScale(0.7);

    this.tweens.chain({
      targets: label,
      tweens: [
        { alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' },
        { alpha: 1, duration: big ? 1200 : 800 },
        { alpha: 0, y: y - 34, duration: 320, ease: 'Quad.easeIn' },
      ],
      onComplete: () => label.destroy(),
    });
  }

  /* ------------------------------- pause ----------------------------- */

  private renderPause(on: boolean) {
    if (!on) {
      this.pauseLayer?.destroy();
      this.pauseLayer = undefined;
      return;
    }

    const W = this.scale.width;
    const layer = this.add.container(0, 0).setDepth(DEPTH.overlay);

    const dim = this.add.graphics();
    dim.fillStyle(0x0d0a12, 0.72).fillRect(0, 0, W, STAGE_H);
    layer.add(dim);

    const panelW = 400;
    const panelH = 330;
    layer.add(board(this, W / 2, STAGE_H / 2 + 10, panelW, panelH));

    layer.add(ribbon(this, W / 2, STAGE_H / 2 + 10 - panelH / 2, 250));
    layer.add(
      this.add
        .text(W / 2, STAGE_H / 2 + 10 - panelH / 2 - 8, 'Paused', styles.plate(26, CSS.ribbonInk))
        .setOrigin(0.5),
    );

    const mk = (dy: number, label: string, fn: () => void, variant: 'blue' | 'red' = 'blue') =>
      layer.add(
        new Button(this, W / 2, STAGE_H / 2 + dy, label, fn, {
          width: 290,
          height: 60,
          fontSize: 24,
          variant,
        }),
      );

    mk(-52, 'Resume', () => this.battle.setPaused(false));
    mk(18, 'Restart', () => {
      this.battle.setPaused(false);
      audio.stopMusic();
      this.scene.stop();
      this.battle.scene.restart({ stageIndex: this.battle.stageIndex });
    });
    mk(88, 'Quit to Map', () => this.battle.quitToMap(), 'red');

    const sound = this.add
      .text(W / 2, STAGE_H / 2 + 138, soundLabel(), styles.body(17, CSS.boardMuted))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    sound.on('pointerup', () => {
      const next = !(save.data.settings.sfx && save.data.settings.music);
      audio.setSfxEnabled(next);
      audio.setMusicEnabled(next);
      if (next) audio.startMusic('battle');
      else audio.stopMusic();
      sound.setText(soundLabel());
    });
    layer.add(sound);

    this.pauseLayer = layer;
  }

  private onOutcome(outcome: Outcome) {
    if (outcome === 'none') return;
    const W = this.scale.width;
    const won = outcome === 'win';

    this.announce(won ? 'CASTLE DOWN!' : 'YOUR CASTLE HAS FALLEN', won ? CSS.gold : '#ff7a5c', true);

    const veil = this.add.graphics().setDepth(DEPTH.overlay - 1);
    veil.fillStyle(won ? 0xffe9a8 : 0x2a0f14, 0);
    veil.fillRect(0, 0, W, STAGE_H);
    this.tweens.add({ targets: veil, alpha: won ? 0.18 : 0.4, duration: 900 });
  }
}

const soundLabel = () => (save.data.settings.sfx || save.data.settings.music ? 'Sound: On' : 'Sound: Off');
