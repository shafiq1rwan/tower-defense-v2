import Phaser from 'phaser';

/** Waits for the self-hosted display fonts before anything draws text, so no
 *  scene ever renders in a fallback face and then reflows. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async create() {
    const faces = ['400 40px "Luckiest Guy"', '600 24px "Baloo 2"', '800 24px "Baloo 2"'];
    try {
      await Promise.all(faces.map((f) => document.fonts.load(f)));
      await document.fonts.ready;
    } catch {
      // No FontFaceSet (or the files failed): system fonts will stand in.
    }
    this.scene.start('Preload');
  }
}
