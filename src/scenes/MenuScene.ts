import Phaser from 'phaser';

import { CSS, DEPTH, GROUND_Y, STAGE_H, UNIT_SCALE } from '../core/constants';
import { Button, fadeToScene, styles } from '../core/ui';
import { audio } from '../core/audio';
import { save } from '../core/save';
import { canInstall, onInstallAvailability, promptInstall } from '../core/pwa';
import { Battlefield } from '../battle/Battlefield';
import { animKey } from '../data/anims';

/** A still diorama of the battle, used as living wallpaper behind the title. */
const CAST: Array<[tex: string, xFrac: number, state: 'idle' | 'attack', flip: boolean, scale: number]> = [
  ['warrior_blue', 0.3, 'attack', false, 1.05],
  ['pawn_blue', 0.22, 'idle', false, 1],
  ['archer_blue', 0.15, 'idle', false, 1],
  ['torch_red', 0.42, 'attack', true, 1],
  ['pawn_red', 0.52, 'idle', true, 0.95],
  ['warrior_red', 0.6, 'idle', true, 1.05],
];

export class MenuScene extends Phaser.Scene {
  private battlefield!: Battlefield;
  private installBtn?: Button;
  private unsubscribe?: () => void;

  constructor() {
    super('Menu');
  }

  create() {
    const W = this.scale.width;

    this.battlefield = new Battlefield(this, 'green');
    this.buildCast();

    // Dim the scene behind the title so the type stays legible.
    this.add
      .graphics()
      .fillStyle(0x140f1c, 0.34)
      .fillRect(0, 0, W, STAGE_H)
      .setDepth(DEPTH.hud - 1);

    const title = this.add
      .text(W / 2, 128, 'TINY SIEGE', styles.title(Math.min(88, W * 0.085)))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.tweens.add({
      targets: title,
      y: 136,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(W / 2, 192, 'Hold the lane. Break their castle.', styles.body(21, '#f0dfbe'))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    /* ------------------------------ buttons ------------------------------ */
    const cx = W / 2;
    new Button(this, cx, 272, 'Play', () => fadeToScene(this, 'StageSelect'), {
      width: 300,
      height: 78,
      fontSize: 32,
      sound: 'select',
    }).setDepth(DEPTH.hud);

    new Button(this, cx, 356, 'Barracks', () => fadeToScene(this, 'Barracks'), {
      width: 300,
      height: 66,
      fontSize: 26,
    }).setDepth(DEPTH.hud);

    this.installBtn = new Button(this, cx, 430, 'Install Game', () => void promptInstall(), {
      width: 300,
      height: 58,
      fontSize: 22,
    });
    this.installBtn.setDepth(DEPTH.hud).setVisible(canInstall());
    this.unsubscribe = onInstallAvailability((available) => this.installBtn?.setVisible(available));

    this.buildSoundToggle();

    /* ------------------------------ footer ------------------------------- */
    this.add
      .text(
        W / 2,
        STAGE_H - 26,
        'Art: “Tiny Swords” by Pixel Frog (CC0) · Fonts: Luckiest Guy & Baloo 2 (OFL) · Built with Phaser',
        styles.body(13, '#d9c9a8'),
      )
      .setOrigin(0.5)
      .setAlpha(0.75)
      .setDepth(DEPTH.hud);

    if (save.data.gold > 0 || save.data.cleared > 0) {
      this.add
        .text(20, STAGE_H - 26, `Gold: ${save.data.gold.toLocaleString('en-US')}`, styles.body(16, CSS.goldLight))
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.hud);
    }

    this.cameras.main.fadeIn(320, 0, 0, 0);
    this.input.once('pointerdown', () => audio.unlock());
    this.time.delayedCall(60, () => audio.startMusic('menu'));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
  }

  private buildCast() {
    for (const [tex, xFrac, state, flip, scale] of CAST) {
      const s = this.add
        .sprite(this.scale.width * xFrac, GROUND_Y + Phaser.Math.Between(-10, 14), tex)
        .setOrigin(0.5, 0.63)
        .setScale(scale * UNIT_SCALE)
        .setFlipX(flip)
        .setDepth(DEPTH.units);

      if (state !== 'attack') {
        s.play(animKey(tex, 'idle'));
        continue;
      }

      // Attack clips don't loop and would otherwise freeze on the follow-through
      // frame, so drop back to idle and swing again a beat later.
      const swing = () => s.play(animKey(tex, 'attack'), true);
      s.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        s.play(animKey(tex, 'idle'));
        this.time.delayedCall(Phaser.Math.Between(450, 900), swing);
      });
      this.time.delayedCall(Phaser.Math.Between(200, 700), swing);
    }
  }

  private buildSoundToggle() {
    const icon = () => (save.data.settings.music || save.data.settings.sfx ? 'ui_icon_sound' : 'ui_icon_sound_off');
    const btn = new Button(
      this,
      this.scale.width - 52,
      46,
      '',
      () => {
        const next = !(save.data.settings.sfx || save.data.settings.music);
        audio.setSfxEnabled(next);
        audio.setMusicEnabled(next);
        if (next) audio.startMusic('menu');
        else audio.stopMusic();
        btn.setIcon(icon());
      },
      { width: 58, height: 58, icon: icon() },
    );
    btn.setDepth(DEPTH.hud);
  }

  override update(_time: number, delta: number) {
    this.battlefield.update(delta);
  }
}
