# Attribution

## Artwork

**Tiny Swords** by **Pixel Frog**
<https://pixelfrog-assets.itch.io/tiny-swords>

The file used is the one itch.io lists as **"TS_old version_CC0 Licensed"**
(*Tiny Swords (Update 010)*), released under
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) —
public domain, no attribution required. It is credited here anyway, because the
work deserves it.

> Note: newer *Tiny Swords* releases on that page (the current "Free Pack" and the
> paid "Enemy Pack") are **not** covered by that CC0 grant. If you swap in updated
> art, check the licence terms that ship with it first.

Files used, all from `Tiny Swords (Update 010)`:

| In this repo                | Source                                              |
| --------------------------- | --------------------------------------------------- |
| `public/assets/units/*`     | `Factions/Knights/Troops/*`, `Factions/Goblins/Troops/*` |
| `public/assets/buildings/*` | `Factions/Knights/Buildings/*`, `Factions/Goblins/Buildings/*` |
| `public/assets/terrain/*`   | `Terrain/Ground`, `Resources/Trees`, `Resources/Sheep`, `Deco` |
| `public/assets/fx/*`        | `Effects/Explosion`, `Effects/Fire`                 |
| `public/assets/ui/*`        | `UI/Buttons`, `UI/Banners`, `UI/Ribbons`, `UI/Icons`, `Resources/Resources` (gold) |
| `public/icons/*`            | Generated from `Castle_Blue.png` by `tools/make-icons.mjs` |

Sprites were copied and renamed only — no pixels were altered.

## Fonts

Both under the [SIL Open Font License 1.1](https://openfontlicense.org/), self-hosted
in `public/fonts/` so the game works offline:

- **Luckiest Guy** — Astigmatic (AOETI)
- **Baloo 2** — Ek Type

## Engine and tooling

- [**Phaser 3**](https://phaser.io) — MIT
- [**Vite**](https://vite.dev) — MIT
- [**vite-plugin-pwa**](https://vite-pwa-org.netlify.app) / **Workbox** — MIT
- [**sharp**](https://sharp.pixelplumbing.com) — Apache-2.0 (build-time only, for icons)

## Audio

No third-party audio. Every sound effect and both music loops are synthesised at
runtime with the Web Audio API — see `src/core/audio.ts`.

## Game design

*Tiny Siege* is an original implementation inspired by the lane-battle tower defense
genre popularised by *The Battle Cats* (PONOS). No assets, code, or content from that
game are used here.
