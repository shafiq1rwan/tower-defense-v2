# Tiny Siege

A lane-battle tower defense game in the spirit of *The Battle Cats*: gold trickles in,
you spend it deploying troops from your castle, they march right, the goblins march
left, and whoever's castle falls first loses.

Built with **Phaser 3** + **TypeScript** + **Vite**. Installable as a PWA, plays
offline, and runs on desktop and mobile from the same build.

---

## Play

```bash
npm install
npm run dev        # http://localhost:5173/tower-defense-sample/
```

> The dev server uses the same `base` path as production so every mode exercises
> the deployed URLs. The console prints the full address on start.

| Script            | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Dev server with HMR                           |
| `npm run build`   | Typecheck, then build to `dist/`              |
| `npm run preview` | Serve the production build locally            |
| `npm run typecheck` | `tsc --noEmit`                              |
| `npm run icons`   | Regenerate PWA icons from the castle sprite   |

## Controls

|                | Desktop                    | Touch                       |
| -------------- | -------------------------- | --------------------------- |
| Deploy a troop | `1` … `5`                  | Tap the troop card          |
| Castle cannon  | `Space`                    | Tap **CANNON**              |
| Speed 1x / 2x  | `F`                        | Tap **1x**                  |
| Pause          | `P` or `Esc`               | Tap **II**                  |

Phones are asked to rotate to landscape — the battlefield is inherently wide.

## How the game works

**Economy.** Gold accrues continuously up to a wallet cap, and every goblin you kill
pays a bounty. Both the rate and the cap are upgradable in the Barracks, which is the
core progression loop: clear stages → earn gold → field better troops → clear harder
stages.

**Combat** is one-dimensional. Every unit only cares about its position on the x axis:
it walks forward until an enemy (or the enemy castle) is within range, then swings on
a fixed interval. Damage lands partway through the attack animation rather than on the
first frame, so hits read as connecting. Troops queue up behind whoever is already
engaged instead of piling onto the same pixel.

**Knockback** is the genre's signature mechanic and is implemented here: each unit has
N knockbacks spread evenly across its health bar, and crossing a threshold shoves it
backwards, interrupting whatever it was doing. Cheap chaff can stall a brute by
repeatedly knocking it back.

**The cannon** is the panic button — a charged volley of cannonballs fired from your
castle roof. Each ball arcs across the field trailing smoke and explodes where it
lands, damaging and knocking back everything in the blast. Shots aim at the thickest
goblin clusters; spare shots go for the enemy castle.

The battle simulation runs on a **fixed 60 Hz timestep** decoupled from rendering, so a
144 Hz monitor and a throttled phone play identically, and 2x speed is a true
simulation-rate change rather than an animation trick.

## Project layout

```
src/
  main.ts              Phaser bootstrap; picks a stage size from the device aspect
  core/
    constants.ts       Layout anchors, palette, depth bands
    audio.ts           Procedural Web Audio: every SFX and both music loops
    save.ts            localStorage progress + the upgrade cost curves
    ui.ts              Panels, buttons, bars, text styles
    pwa.ts             Service worker, install prompt, orientation guard
  data/
    troops.ts          Troop stats and the sprite-sheet frame layouts
    stages.ts          Wave scripts, triggers, unlocks
    anims.ts           Animation registration
  battle/
    Battlefield.ts     Sky, hills, terrain, village, scatter
    Unit.ts            Troop entity: targeting, attacking, knockback, death
    Base.ts            Castles
    Projectile.ts      Arrows and lobbed dynamite
    Effects.ts         Damage numbers, sparks, dust, explosions, shake
  scenes/              Boot, Preload, Menu, StageSelect, Barracks, Battle, Hud, Result
tools/
  make-icons.mjs       Regenerates public/icons from the castle sprite
```

### Reading the sprite sheets

Every Tiny Swords troop sheet is a grid of 192px cells laid out as
`row 0 = idle, row 1 = run, row 2+ = directional attacks`. Only the right-facing
attack row is used; enemies are the same art with `flipX`. The exact frame ranges and
the character's height inside each (mostly empty) cell live in `RIGS` in
[`src/data/troops.ts`](src/data/troops.ts) — that table is what health bars, damage
numbers and projectile origins anchor against.

## Audio

There are no audio files. Every sound — sword hits, arrows, explosions, coins, the UI
clicks, and both music loops — is synthesised at runtime with the Web Audio API
(`src/core/audio.ts`). Music is a lookahead step sequencer running off the audio clock
over an eight-bar chord loop. That keeps the download small and the game fully
playable offline with zero extra caching.

## PWA

`vite-plugin-pwa` generates the manifest and a Workbox service worker that precaches
the entire build (~2.2 MB), so after the first visit the game launches and plays with
no network at all. On a supported browser an **Install Game** button appears on the
title screen.

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
   builds and publishes automatically.

The workflow passes `BASE_PATH=/<repo-name>/` so the bundle is built for a project
site. If you serve from a custom domain or a user/org site, set `BASE_PATH=/` in the
workflow (or change the default in [`vite.config.ts`](vite.config.ts)).

## Credits

See [ATTRIBUTION.md](ATTRIBUTION.md). Art is *Tiny Swords* by **Pixel Frog** (CC0),
fonts are *Luckiest Guy* and *Baloo 2* (SIL Open Font License).
