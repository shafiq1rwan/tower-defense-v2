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

/** Convenience: a Graphics-backed panel as its own game object. */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  o: PanelOpts = {},
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawPanel(g, x - w / 2, y - h / 2, w, h, o);
  return g;
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export interface ButtonOpts {
  width?: number;
  height?: number;
  fill?: number;
  edge?: number;
  sheen?: number;
  fontSize?: number;
  textColor?: string;
  icon?: string;
  sound?: Parameters<typeof audio.play>[0];
}

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private iconImg?: Phaser.GameObjects.Image;
  private enabled = true;
  private readonly opts: Required<Pick<ButtonOpts, 'width' | 'height' | 'fill' | 'edge'>> & ButtonOpts;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, opts: ButtonOpts = {}) {
    super(scene, x, y);
    // Spread first: callers routinely pass `fill: undefined` from an optional
    // variable, and that must fall through to the default rather than win.
    const o = {
      ...opts,
      width: opts.width ?? 240,
      height: opts.height ?? 68,
      fill: opts.fill ?? COLORS.wood,
      edge: opts.edge ?? COLORS.woodDark,
    };
    this.opts = o;

    this.bg = scene.add.graphics();
    this.add(this.bg);
    this.redraw(false);

    if (o.icon) {
      this.iconImg = scene.add.image(-o.width / 2 + 34, 0, o.icon).setScale(0.42);
      this.add(this.iconImg);
    }

    this.label = scene.add
      .text(o.icon ? 12 : 0, -2, text, styles.heading(o.fontSize ?? 26, o.textColor ?? CSS.parchment))
      .setOrigin(0.5);
    fitText(this.label, o.width - (o.icon ? 80 : 34));
    this.add(this.label);

    this.setSize(o.width, o.height);
    this.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, o.width, o.height),
      Phaser.Geom.Rectangle.Contains,
    );
    (this.input as Phaser.Types.Input.InteractiveObject).cursor = 'pointer';

    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.redraw(true);
      this.setScale(0.96);
    });
    this.on('pointerout', () => {
      this.redraw(false);
      this.setScale(1);
    });
    this.on('pointerup', () => {
      if (!this.enabled) {
        audio.play('deny');
        return;
      }
      this.redraw(false);
      scene.tweens.add({ targets: this, scale: 1, duration: 120, ease: 'Back.easeOut' });
      audio.play(o.sound ?? 'click');
      onClick();
    });

    scene.add.existing(this);
  }

  private redraw(pressed: boolean) {
    const { width: w, height: h, fill, edge } = this.opts;
    this.bg.clear();
    const dim = this.enabled ? 1 : 0.45;
    drawPanel(this.bg, -w / 2, -h / 2 + (pressed ? 3 : 0), w, h, {
      radius: 14,
      fill: Phaser.Display.Color.ValueToColor(fill).darken(pressed ? 12 : 0).color,
      edge,
      sheen: this.opts.sheen,
      alpha: dim,
    });
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.label.setAlpha(on ? 1 : 0.5);
    this.iconImg?.setAlpha(on ? 1 : 0.5);
    this.redraw(false);
    return this;
  }

  setLabel(text: string) {
    this.label.setText(text);
    fitText(this.label, this.opts.width - (this.opts.icon ? 80 : 34));
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
