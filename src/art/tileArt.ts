// OWNER: A7 (world). Generates every world texture: terrain, parallax backdrops, decor, town, portal/ambient FX.
import Phaser from 'phaser';
import { generateTerrainTextures } from './world/terrain';
import { generateParallaxTextures } from './world/parallax';
import { generateDecorTextures } from './world/decor';
import { generateTownTextures } from './world/town';
import { generateFxTextures } from './world/fx';
import { generatePixelWorldTextures } from './world/pixel';

/** Marker texture: present once generation has run (MapLoader lazily calls this if missing). */
export const WORLD_TEX_READY = 'w__ready';

export function generateTileTextures(scene: Phaser.Scene): void {
  const steps: [string, (s: Phaser.Scene) => void][] = [
    // 16-bit pixel art from the loaded source packs first; the procedural painters below skip existing keys
    // and so only fill in whatever failed to load.
    ['pixel', generatePixelWorldTextures],
    ['terrain', generateTerrainTextures],
    ['parallax', generateParallaxTextures],
    ['decor', generateDecorTextures],
    ['town', generateTownTextures],
    ['fx', generateFxTextures],
  ];
  for (const [name, fn] of steps) {
    try { fn(scene); } catch (e) { console.error(`[tileArt] ${name} failed`, e); }
  }
  try {
    if (!scene.textures.exists(WORLD_TEX_READY)) scene.textures.createCanvas(WORLD_TEX_READY, 1, 1);
  } catch { /* ignore */ }
}
