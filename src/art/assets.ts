/**
 * External art asset pipeline. Owned by the lead — do not edit.
 *
 * Each art domain lists its files in its own manifest (src/art/manifests/<domain>.ts).
 * BootScene.preload() loads every entry; generators then slice / palette-swap /
 * integer-scale them into the EXISTING texture keys + frame layouts, so gameplay
 * code never changes. Files live in public/assets/<domain>/ and are referenced
 * with assetUrl('<domain>/<file>.png').
 */
import Phaser from 'phaser';
import { CHARACTER_ASSETS } from './manifests/characters';
import { MONSTER_ASSETS } from './manifests/monsters';
import { WORLD_ASSETS } from './manifests/world';
import { VFX_ASSETS } from './manifests/vfx';
import { UI_ASSETS } from './manifests/ui';

export interface AssetEntry {
  /** Phaser texture key; prefix with the domain, e.g. 'src_char_wizard_idle'. Use the `src_` prefix for raw source sheets. */
  key: string;
  /** Path relative to public/assets, e.g. 'characters/wizard/idle.png'. */
  path: string;
  type: 'image' | 'spritesheet';
  frameWidth?: number;
  frameHeight?: number;
}

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`;
}

export const ALL_ASSETS: AssetEntry[] = [
  ...CHARACTER_ASSETS, ...MONSTER_ASSETS, ...WORLD_ASSETS, ...VFX_ASSETS, ...UI_ASSETS,
];

export function queueArtAssets(load: Phaser.Loader.LoaderPlugin): void {
  for (const a of ALL_ASSETS) {
    const url = assetUrl(a.path);
    if (a.type === 'spritesheet') load.spritesheet(a.key, url, { frameWidth: a.frameWidth!, frameHeight: a.frameHeight! });
    else load.image(a.key, url);
  }
}

/** Raw source image of a loaded asset (for canvas slicing), or null if it failed to load. */
export function sourceImage(scene: Phaser.Scene, key: string): HTMLImageElement | HTMLCanvasElement | null {
  if (!scene.textures.exists(key)) return null;
  const img = scene.textures.get(key).getSourceImage();
  return (img as HTMLImageElement | HTMLCanvasElement) ?? null;
}
