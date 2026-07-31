import Phaser from 'phaser';
import { registerAnims } from '../data/anims';
import { splash } from '../core/pwa';

/** Troop sheets are all 192px grids; the loader only needs the file stem. */
const TROOP_SHEETS = [
  'pawn_blue',
  'pawn_red',
  'warrior_blue',
  'warrior_red',
  'archer_blue',
  'archer_red',
  'torch_blue',
  'torch_red',
  'tnt_blue',
  'tnt_red',
];

const BUILDINGS = [
  'castle_blue',
  'castle_red',
  'castle_purple',
  'castle_destroyed',
  'goblin_house',
  'tower_blue',
  'house_blue',
  'house_red',
];

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    this.load.setPath(`${import.meta.env.BASE_URL}assets`);

    this.load.on('progress', (p: number) => splash.progress(p));

    TROOP_SHEETS.forEach((key) =>
      this.load.spritesheet(key, `units/${key}.png`, { frameWidth: 192, frameHeight: 192 }),
    );

    this.load.spritesheet('dead', 'units/dead.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('arrow', 'units/arrow.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('dynamite', 'units/dynamite.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('explosion', 'fx/explosions.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('fire', 'fx/fire.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('tiles', 'terrain/tilemap_flat.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('sheep', 'terrain/sheep.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('gold_spawn', 'ui/gold_spawn.png', { frameWidth: 128, frameHeight: 128 });

    BUILDINGS.forEach((key) => this.load.image(key, `buildings/${key}.png`));

    // The tree ships as an animation strip, not a single image.
    this.load.spritesheet('tree', 'terrain/tree.png', { frameWidth: 192, frameHeight: 192 });

    for (let i = 1; i <= 15; i++) {
      const n = String(i).padStart(2, '0');
      this.load.image(`deco_${n}`, `terrain/deco_${n}.png`);
    }

    this.load.image('ui_gold', 'ui/gold_idle.png');

    // The pack's UI kit: nine-slice buttons/boards, ribbons and icons.
    for (const key of [
      'ui_button_blue_9s',
      'ui_button_blue_9s_pressed',
      'ui_button_red_9s',
      'ui_button_red_9s_pressed',
      'ui_button_disable_9s',
      'ui_carved_9s',
      'ui_ribbon_yellow',
      'ui_ribbon_blue',
      'ui_ribbon_red',
      'ui_icon_close',
      'ui_icon_sound',
      'ui_icon_sound_off',
      'ui_icon_lock',
    ]) {
      this.load.image(key, `ui/${key.replace('ui_', '')}.png`);
    }
  }

  create() {
    registerAnims(this);
    splash.progress(1);
    splash.done();
    this.scene.start('Menu');
  }
}
