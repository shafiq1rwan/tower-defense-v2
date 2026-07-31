/**
 * Generates the PWA icon set from the in-game castle sprite.
 *
 *   npm run icons
 *
 * Regenerate whenever the source art or the brand colours change; the outputs
 * are committed so a plain `npm ci && npm run build` needs no image tooling.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'public/assets/buildings/castle_blue.png');
const OUT = join(root, 'public/icons');
mkdirSync(OUT, { recursive: true });

const backdrop = (size, radius) => Buffer.from(`
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#4b83b8"/>
      <stop offset="55%" stop-color="#2c4360"/>
      <stop offset="100%" stop-color="#1b2432"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="72%" r="58%">
      <stop offset="0%"   stop-color="#ffc53d" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffc53d" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#sky)"/>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#glow)"/>
  <rect x="0" y="${size * 0.78}" width="${size}" height="${size * 0.22}" fill="#3f6a34"/>
</svg>`);

/** Trimmed castle, scaled to `fraction` of the icon and sat on the grass line. */
async function castleLayer(size, fraction) {
  const target = Math.round(size * fraction);
  const art = await sharp(SRC)
    .trim()
    .resize({ width: target, height: target, fit: 'inside', kernel: 'nearest' })
    .toBuffer();
  const meta = await sharp(art).metadata();
  return {
    input: art,
    left: Math.round((size - meta.width) / 2),
    top: Math.round(size * 0.84 - meta.height),
  };
}

async function build(size, { radius, fraction, name }) {
  const layer = await castleLayer(size, fraction);
  await sharp(backdrop(size, radius))
    .composite([layer])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, name));
  console.log('wrote', name, `${size}x${size}`);
}

// `any` icons fill the tile; the maskable one keeps everything inside the
// 80% safe circle Android crops to.
await build(192, { radius: 34, fraction: 0.7, name: 'icon-192.png' });
await build(512, { radius: 92, fraction: 0.7, name: 'icon-512.png' });
await build(512, { radius: 0, fraction: 0.52, name: 'maskable-512.png' });
