import Phaser from 'phaser';

import { MAX_STAGE_W, MIN_STAGE_W, STAGE_H } from './core/constants';
import { installImmersiveMode, installOrientationGuard } from './core/pwa';

import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { BarracksScene } from './scenes/BarracksScene';
import { BattleScene } from './scenes/BattleScene';
import { HudScene } from './scenes/HudScene';
import { ResultScene } from './scenes/ResultScene';

/** The stage is always 720 design-pixels tall; its width tracks the device's
 *  landscape aspect ratio so phones fill edge to edge instead of letterboxing,
 *  while ultra-wide desktops stop widening at MAX_STAGE_W. */
function stageWidth(): number {
  const long = Math.max(window.innerWidth, window.innerHeight);
  const short = Math.min(window.innerWidth, window.innerHeight);
  const aspect = short > 0 ? long / short : 16 / 9;
  return Math.round(Phaser.Math.Clamp(STAGE_H * aspect, MIN_STAGE_W, MAX_STAGE_W));
}

installOrientationGuard();
installImmersiveMode();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b2432',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  powerPreference: 'high-performance',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: stageWidth(),
    height: STAGE_H,
    // Phones report the on-screen keyboard / URL bar as resizes; a short delay
    // stops the canvas thrashing while the browser chrome animates.
    resizeInterval: 200,
  },
  dom: { createContainer: false },
  input: { activePointers: 3 },
  fps: { target: 60, min: 30 },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    StageSelectScene,
    BarracksScene,
    BattleScene,
    HudScene,
    ResultScene,
  ],
});
