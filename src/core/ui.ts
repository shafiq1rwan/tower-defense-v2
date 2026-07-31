import Phaser from 'phaser';
import { COLORS, CSS, FONT_DISPLAY, FONT_UI } from './constants';
import { audio } from './audio';

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

type Style = Phaser.Types.GameObjects.Text.TextStyle;

export const styles = {
  title: (size = 74): Style => ({
    fontFamily: FONT_DISPLAY,
    fontSize: `${size}px`,
    color: CSS.gold,
    stroke: CSS.woodDark,
    strokeThickness: 10,
    shadow: { offsetX: 0, offsetY: 6, color: '#00000066', blur: 10, fill: true },
  }),
  heading: (size = 34, color: string = CSS.parchment): Style => ({
    fontFamily: FONT_DISPLAY,
    fontSize: `${size}px`,
    color,
    stroke: CSS.woodDark,
    strokeThickness: 6,
  }),
  /** Display type for the light UI-kit surfaces (boards, ribbons, buttons).
   *  No stroke: dark ink on parchment outlines itself into a blob. */
  plate: (size = 24, color: string = CSS.boardInk): Style => ({
    fontFamily: FONT_DISPLAY,
    fontSize: `${size}px`,
    color,
  }),
  body: (size = 20, color: string = CSS.parchment): Style => ({
    fontFamily: FONT_UI,
    fontSize: `${size}px`,
    fontStyle: '600',
    color,
  }),
  strong: (size = 22, color: string = CSS.white): Style => ({
    fontFamily: FONT_UI,
    fontSize: `${size}px`,
    fontStyle: '800',
    color,
    stroke: CSS.woodDark,
    strokeThickness: 4,
  }),
  number: (size = 26, color: string = CSS.goldLight): Style => ({
    fontFamily: FONT_DISPLAY,
    fontSize: `${size}px`,
    color,
    stroke: CSS.woodDark,
    strokeThickness: 5,
  }),
};

/** Shrinks a text object until it fits `maxWidth`. */
export function fitText(text: Phaser.GameObjects.Text, maxWidth: number, minSize = 10) {
  let size = Number.parseInt(String(text.style.fontSize), 10);
  while (text.width > maxWidth && size > minSize) {
    size -= 1;
    text.setFontSize(size);
  }
  return text;
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */

export interface PanelOpts {
  radius?: number;
  fill?: number;
  edge?: number;
  /** Lighter band across the top third, for a carved-wood feel. */
  sheen?: number;
  alpha?: number;
  edgeWidth?: number;
}

/** Draws the game's standard chunky panel into an existing Graphics object.
 *  Coordinates are the panel's top-left. */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  o: PanelOpts = {},
) {
  const r = o.radius ?? 16;
  const fill = o.fill ?? COLORS.wood;
  const edge = o.edge ?? COLORS.woodDark;
  const alpha = o.alpha ?? 1;
  const ew = o.edgeWidth ?? 5;

  // Drop shadow.
  g.fillStyle(0x000000, 0.28 * alpha);
  g.fillRoundedRect(x + 3, y + 6, w, h, r);

  // Body.
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, w, h, r);

  // Sheen along the top edge. Capped so tall panels get a highlight rather
  // than a stripe across the middle of their content.
  if (o.sheen !== 0) {
    g.fillStyle(o.sheen ?? COLORS.woodLight, 0.34 * alpha);
    const sheenH = Phaser.Math.Clamp(h * 0.38, 6, 62);
    g.fillRoundedRect(x + ew, y + ew, w - ew * 2, sheenH, { tl: r, tr: r, bl: 4, br: 4 });
  }

  // Edge.
  g.lineStyle(ew, edge, alpha);
  g.strokeRoundedRect(x, y, w, h, r);
}

/* ------------------------------------------------------------------ */
/* Tiny Swords UI kit                                                  */
/* ------------------------------------------------------------------ */

/** A carved parchment board (the pack's `Carved_9Slides`), nine-sliced to any
 *  size. The base surface for cards, dialogs and the deploy bar. */
export function board(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
): Phaser.GameObjects.NineSlice {
  return scene.add.nineslice(x, y, 'ui_carved_9s', undefined, w, h, 30, 30, 30, 30);
}

/** A title ribbon (the pack's `Ribbon_*_3Slides`), stretched horizontally.
 *  64px tall; the banner field sits in the upper ~44px, tails hang below. */
export function ribbon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  color: 'yellow' | 'blue' | 'red' = 'yellow',
): Phaser.GameObjects.NineSlice {
  return scene.add.nineslice(x, y, `ui_ribbon_${color}`, undefined, Math.max(160, w), 64, 56, 56);
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export type ButtonVariant = 'blue' | 'red';

const BUTTON_TEX: Record<ButtonVariant, { up: string; down: string }> = {
  blue: { up: 'ui_button_blue_9s', down: 'ui_button_blue_9s_pressed' },
  red: { up: 'ui_button_red_9s', down: 'ui_button_red_9s_pressed' },
};
const BUTTON_DISABLED_TEX = 'ui_button_disable_9s';

const buttonInk = (variant: ButtonVariant) => (variant === 'blue' ? CSS.buttonInk : '#ffe9c8');

export interface ButtonOpts {
  width?: number;
  height?: number;
  variant?: ButtonVariant;
  fontSize?: number;
  textColor?: string;
  /** Texture key of a pack icon, centred when there is no text. */
  icon?: string;
  sound?: Parameters<typeof audio.play>[0];
}

/** A pack-art button: `Button_*_9Slides` with the real pressed texture on tap
 *  and the grey `Button_Disable` art when disabled. */
export class Button extends Phaser.GameObjects.Container {
  private slice: Phaser.GameObjects.NineSlice;
  private label: Phaser.GameObjects.Text;
  private iconImg?: Phaser.GameObjects.Image;
  private enabled = true;
  private readonly variant: ButtonVariant;
  // btnW/btnH, not w/h: Phaser's Transform component already owns `w`.
  private readonly btnW: number;
  private readonly btnH: number;
  private readonly hasIcon: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, opts: ButtonOpts = {}) {
    super(scene, x, y);
    const w = (this.btnW = opts.width ?? 240);
    const h = (this.btnH = opts.height ?? 68);
    this.variant = opts.variant ?? 'blue';
    this.hasIcon = Boolean(opts.icon);

    // Corner insets shrink on short buttons so the slices never overlap.
    const ix = Math.max(10, Math.min(28, Math.floor(w / 2) - 2));
    const iy = Math.max(10, Math.min(28, Math.floor(h / 2) - 2));
    this.slice = scene.add.nineslice(0, 0, BUTTON_TEX[this.variant].up, undefined, w, h, ix, ix, iy, iy);
    this.add(this.slice);

    if (opts.icon) {
      const size = Math.min(w, h) * (text ? 0.5 : 0.62);
      this.iconImg = scene.add.image(text ? -w / 2 + h * 0.52 : 0, -1, opts.icon);
      this.iconImg.setDisplaySize(size, size);
      this.add(this.iconImg);
    }

    const ink = opts.textColor ?? buttonInk(this.variant);
    this.label = scene.add
      .text(opts.icon && text ? 14 : 0, -2, text, {
        fontFamily: FONT_DISPLAY,
        fontSize: `${opts.fontSize ?? 26}px`,
        color: ink,
        // Only the light-on-red combination needs an outline to read.
        ...(this.variant === 'red' ? { stroke: '#5e1c10', strokeThickness: 4 } : {}),
      })
      .setOrigin(0.5);
    fitText(this.label, w - (opts.icon ? h + 30 : 30));
    this.add(this.label);

    this.setSize(w, h);
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    (this.input as Phaser.Types.Input.InteractiveObject).cursor = 'pointer';

    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.setPressed(true);
    });
    this.on('pointerout', () => this.setPressed(false));
    this.on('pointerup', () => {
      if (!this.enabled) {
        audio.play('deny');
        return;
      }
      this.setPressed(false);
      scene.tweens.add({ targets: this, scale: 1, duration: 120, ease: 'Back.easeOut' });
      audio.play(opts.sound ?? 'click');
      onClick();
    });

    scene.add.existing(this);
  }

  private setPressed(down: boolean) {
    if (!this.enabled) return;
    this.slice.setTexture(BUTTON_TEX[this.variant][down ? 'down' : 'up']);
    const dy = down ? 3 : 0;
    this.label.y = -2 + dy;
    if (this.iconImg) this.iconImg.y = -1 + dy;
    this.setScale(down ? 0.97 : 1);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.slice.setTexture(on ? BUTTON_TEX[this.variant].up : BUTTON_DISABLED_TEX);
    this.label.setColor(on ? buttonInk(this.variant) : '#77716a');
    this.iconImg?.setAlpha(on ? 1 : 0.5);
    return this;
  }

  setLabel(text: string) {
    this.label.setText(text);
    fitText(this.label, this.btnW - (this.hasIcon ? this.btnH + 30 : 30));
    return this;
  }

  setIcon(key: string) {
    this.iconImg?.setTexture(key);
    const size = Math.min(this.btnW, this.btnH) * 0.62;
    this.iconImg?.setDisplaySize(size, size);
    return this;
  }
}

/* ------------------------------------------------------------------ */
/* Bars                                                                */
/* ------------------------------------------------------------------ */

export interface BarOpts {
  fill?: number;
  back?: number;
  edge?: number;
  radius?: number;
  /** Trailing "recent damage" ghost, drawn behind the fill. */
  ghost?: boolean;
}

/** A rounded progress bar that eases its fill and shows a damage ghost. */
export class Bar extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  // Not `w`/`h`: Phaser's Transform component already owns `w` on every
  // Game Object, and shadowing it breaks the class contract.
  private barW: number;
  private barH: number;
  private o: BarOpts;
  private value = 1;
  private shown = 1;
  private ghostValue = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, o: BarOpts = {}) {
    super(scene, x, y);
    this.barW = w;
    this.barH = h;
    this.o = o;
    this.g = scene.add.graphics();
    this.add(this.g);
    this.draw();
    scene.add.existing(this);
  }

  setValue(frac: number, instant = false) {
    this.value = Phaser.Math.Clamp(frac, 0, 1);
    if (instant) {
      this.shown = this.value;
      this.ghostValue = this.value;
    }
    this.draw();
  }

  /** Call each frame; eases the visible fill toward the target. */
  step(dtMs: number) {
    const k = 1 - Math.pow(0.001, dtMs / 1000);
    const before = this.shown;
    this.shown = Phaser.Math.Linear(this.shown, this.value, k);
    if (this.ghostValue > this.shown) {
      this.ghostValue = Phaser.Math.Linear(this.ghostValue, this.value, k * 0.35);
    } else {
      this.ghostValue = this.shown;
    }
    if (Math.abs(before - this.shown) > 0.0005 || this.ghostValue > this.shown + 0.0005) this.draw();
  }

  private draw() {
    const w = this.barW;
    const h = this.barH;
    const r = this.o.radius ?? h / 2;
    const g = this.g;
    g.clear();

    g.fillStyle(this.o.back ?? 0x1d1520, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);

    if (this.o.ghost !== false && this.ghostValue > 0.001) {
      g.fillStyle(0xffe9a8, 0.55);
      g.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, Math.max(1, (w - 4) * this.ghostValue), h - 4, r);
    }

    if (this.shown > 0.001) {
      g.fillStyle(this.o.fill ?? COLORS.green, 1);
      g.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, Math.max(1, (w - 4) * this.shown), h - 4, r);
      // Glossy top edge.
      g.fillStyle(0xffffff, 0.22);
      g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, Math.max(1, (w - 8) * this.shown), (h - 8) * 0.42, r);
    }

    g.lineStyle(3, this.o.edge ?? COLORS.woodDark, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/** Fades the camera in from black; pairs with `fadeToScene`. */
export function fadeIn(scene: Phaser.Scene, ms = 260) {
  scene.cameras.main.fadeIn(ms, 0, 0, 0);
}

export function fadeToScene(scene: Phaser.Scene, key: string, data?: object, ms = 240) {
  const cam = scene.cameras.main;
  // A second click while already fading out would queue a second scene.start.
  if (cam.fadeEffect.isRunning) return;
  cam.fadeOut(ms, 0, 0, 0);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
}

export const formatGold = (n: number) => Math.floor(n).toLocaleString('en-US');

export const formatTime = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
