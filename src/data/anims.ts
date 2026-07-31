import Phaser from 'phaser';
import { ENEMY_TROOPS, PLAYER_TROOPS, RIGS, type TroopDef } from './troops';

export const animKey = (tex: string, state: 'idle' | 'walk' | 'attack') => `${tex}-${state}`;

/** Builds the three clips every troop needs from its sheet's row layout. */
function registerTroopAnims(scene: Phaser.Scene, def: TroopDef) {
  const rig = RIGS[def.rig];
  const make = (state: 'idle' | 'walk' | 'attack', range: [number, number], fps: number, repeat: number) => {
    const key = animKey(def.tex, state);
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(def.tex, { start: range[0], end: range[1] }),
      frameRate: fps,
      repeat,
    });
  };

  make('idle', rig.idle, rig.idleFps, -1);
  make('walk', rig.walk, rig.walkFps, -1);
  make('attack', rig.attack, rig.attackFps, 0);
}

export function registerAnims(scene: Phaser.Scene) {
  const all: TroopDef[] = [...PLAYER_TROOPS, ...Object.values(ENEMY_TROOPS)];
  all.forEach((def) => registerTroopAnims(scene, def));

  const create = (key: string, tex: string, start: number, end: number, frameRate: number, repeat = 0) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(tex, { start, end }),
      frameRate,
      repeat,
    });
  };

  // Frame 0 of the skull sheet is empty; 1..13 is the pop-up-and-settle beat.
  create('fx-dead', 'dead', 1, 13, 11);
  create('fx-explosion', 'explosion', 0, 8, 20);
  create('fx-fire', 'fire', 0, 6, 12, -1);
  create('fx-gold', 'gold_spawn', 0, 6, 15);
  create('fx-dynamite', 'dynamite', 0, 5, 12, -1);
  create('scenery-sheep', 'sheep', 0, 7, 8, -1);
}
