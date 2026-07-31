/** Progressive-web-app plumbing: service worker, install prompt, and the
 *  "please rotate your phone" guard. All of it is plain DOM so it works before
 *  Phaser has booted and keeps working over the letterboxed canvas. */

import { registerSW } from 'virtual:pwa-register';

/* ---------------------------- service worker ---------------------------- */

export const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // autoUpdate handles the swap; reload on the next natural idle moment.
    void updateSW(true);
  },
});

/* ----------------------------- install prompt --------------------------- */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  listeners.forEach((fn) => fn(true));
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  listeners.forEach((fn) => fn(false));
});

export const canInstall = () => deferred !== null;

export function onInstallAvailability(fn: (available: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const evt = deferred;
  deferred = null;
  listeners.forEach((fn) => fn(false));
  await evt.prompt();
  const { outcome } = await evt.userChoice;
  return outcome === 'accepted';
}

/** True when the game is running as an installed app rather than a browser tab. */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

/* ---------------------------- immersive mode ---------------------------- */

/** On touch devices, ask for real fullscreen (and a landscape lock) on the
 *  first tap — the same behaviour as a native game. Browsers only allow this
 *  from a user gesture, hence the pointer listener. iPhones have no
 *  Fullscreen API at all; there the installed PWA is the fullscreen path,
 *  which the manifest already handles. */
export function installImmersiveMode() {
  if (!window.matchMedia('(pointer: coarse)').matches) return;

  const tryEnter = () => {
    if (isStandalone() || document.fullscreenElement) return;
    const el = document.documentElement;
    if (!el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => {
        type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };
        (screen.orientation as LockableOrientation)?.lock?.('landscape').catch(() => {});
      })
      .catch(() => {
        /* denied or unsupported — the game still runs in the tab */
      });
  };

  window.addEventListener('pointerup', tryEnter, { passive: true });
}

/* --------------------------- orientation guard -------------------------- */

/** The battlefield is inherently wide, so on handhelds we ask for landscape
 *  rather than trying to reflow a lane game into a portrait column. */
export function installOrientationGuard() {
  const el = document.createElement('div');
  el.id = 'rotate';
  el.innerHTML = `
    <div class="phone"><span class="scr"></span></div>
    <strong>Rotate your device</strong>
    <span>Tiny Siege is played in landscape.</span>`;

  const css = document.createElement('style');
  css.textContent = `
    #rotate{position:fixed;inset:0;z-index:50;display:none;flex-direction:column;
      align-items:center;justify-content:center;gap:20px;background:#141c28;
      color:#f6e7c8;font-family:'Baloo 2',system-ui,sans-serif;text-align:center;padding:24px}
    #rotate.on{display:flex}
    #rotate strong{font-size:24px;font-weight:800;color:#ffc53d}
    #rotate span{font-size:16px;opacity:.75}
    #rotate .phone{width:64px;height:106px;border:5px solid #f6e7c8;border-radius:12px;
      position:relative;animation:tilt 1.9s ease-in-out infinite}
    #rotate .phone .scr{position:absolute;inset:8px;border-radius:4px;background:#2c3a50}
    @keyframes tilt{0%,38%{transform:rotate(0)}62%,100%{transform:rotate(-90deg)}}`;

  document.head.appendChild(css);
  document.body.appendChild(el);

  const isHandheld = () =>
    window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 620;

  const update = () => {
    const portrait = window.innerHeight > window.innerWidth;
    el.classList.toggle('on', portrait && isHandheld());
  };

  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', () => setTimeout(update, 120));
}

/* ------------------------------- splash --------------------------------- */

const splashEl = document.getElementById('splash');
const splashBar = splashEl?.querySelector<HTMLElement>('.bar i') ?? null;

export const splash = {
  /** Switches the indeterminate sweep to a real 0..1 progress fill. */
  progress(p: number) {
    if (!splashBar) return;
    splashBar.style.animation = 'none';
    splashBar.style.transform = 'none';
    splashBar.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
  },
  done() {
    if (!splashEl) return;
    splashEl.classList.add('hidden');
    setTimeout(() => splashEl.remove(), 600);
  },
};
