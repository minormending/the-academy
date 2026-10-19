// OWNER: world art (PX3). 16-bit pixel-art world textures built from the loaded source PNGs
// (see src/art/manifests/world.ts + public/assets/world/CREDITS.md).
//
// Every source pixel becomes PIXEL_SCALE×PIXEL_SCALE screen pixels (nearest neighbour), baked into the
// EXISTING texture keys (w_<theme>_lip, d_oak, t_tower, w_glow …). This runs before the procedural
// painters; those skip keys that already exist, so anything whose source failed to load falls back to
// the procedural art automatically.
import Phaser from 'phaser';
import { PIXEL_SCALE } from '../../core/constants';
import type { MapTheme } from '../../core/types';
import { sourceImage } from '../assets';
import {
  PIXEL_DECOR_KEYS, PIXEL_FX_KEYS, PIXEL_LOOKS, PIXEL_THEMES, PIXEL_TOWN_KEYS, kitSrcKey, pixSrcKey, type WorldLook,
} from '../manifests/world';
import { TK } from './palettes';

const S = PIXEL_SCALE;

/** Keys that were produced from pixel sources (the map loader keeps these at integer scale). */
export const PIXEL_KEYS = new Set<string>();
/** Themes (and WorldLooks) whose terrain kit was built from pixel sources. */
export const PIXEL_TERRAIN_THEMES = new Set<MapTheme | WorldLook>();

/** Screen-space geometry of the pixel terrain kit (source rows × PIXEL_SCALE). */
export const PIX_TERRAIN = {
  lipH: 24 * S, lipSurface: 8 * S,       // lip strip: 128×24 src, grass top row at src row 8
  platH: 28 * S, platSurface: 4 * S,     // one-way platform: 64×28 mid, 16×28 caps, walking surface at src row 4
  capW: 16 * S, capOverhang: 3 * S,      // caps start 3 src px left of the platform edge (rounded end)
  soilTile: 128 * S, wallTile: 64 * S,
} as const;

/** Kit atlas layout (source px). */
const KIT = {
  lip: [0, 0, 128, 24], soil: [0, 24, 128, 128],
  plat: [0, 152, 64, 28], platL: [64, 152, 16, 28], platR: [80, 152, 16, 28],
  ladder: [96, 152, 16, 16], rope: [112, 152, 8, 16], knot: [112, 168, 12, 10],
  wall: [0, 180, 64, 64],
} as const;

/** Per-theme ladder key (palette-swapped); the loader prefers it over the shared one. */
export const ladderKeyFor = (t: MapTheme | WorldLook) => `w_ladder_${t}`;

/** Integer-upscale (nearest) a region of a source image into a new canvas texture. */
function bake(scene: Phaser.Scene, key: string, img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, k = S): boolean {
  try {
    if (scene.textures.exists(key)) return true;
    const tex = scene.textures.createCanvas(key, sw * k, sh * k);
    if (!tex) return false;
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw * k, sh * k);
    tex.refresh();
    PIXEL_KEYS.add(key);
    return true;
  } catch (e) {
    console.warn(`[pixelWorld] bake ${key} failed`, e);
    return false;
  }
}

function bakeWhole(scene: Phaser.Scene, key: string, srcKey: string): boolean {
  const img = sourceImage(scene, srcKey);
  if (!img || !img.width) return false;
  return bake(scene, key, img, 0, 0, img.width, img.height);
}

function buildTerrain(scene: Phaser.Scene, t: MapTheme | WorldLook) {
  const img = sourceImage(scene, kitSrcKey(t));
  if (!img || img.width < 128) return;
  const r = (k: keyof typeof KIT) => KIT[k];
  const b = (key: string, k: keyof typeof KIT) => { const [x, y, w, h] = r(k); return bake(scene, key, img, x, y, w, h); };
  const ok = b(TK.lip(t), 'lip') && b(TK.soil(t), 'soil') && b(TK.plat(t), 'plat') && b(TK.platL(t), 'platL') && b(TK.platR(t), 'platR');
  b(TK.wall(t), 'wall');
  b(ladderKeyFor(t), 'ladder');
  if (t === 'town') { b('w_ladder', 'ladder'); b('w_rope', 'rope'); b('w_rope_knot', 'knot'); }
  if (t === 'sanctum') b('w_ladder_gold', 'ladder');
  if (ok) PIXEL_TERRAIN_THEMES.add(t);
}

function buildPortalAnim(scene: Phaser.Scene) {
  const key = 'w_portal_px';
  if (!bakeWhole(scene, key, pixSrcKey(key))) return;
  const tex = scene.textures.get(key);
  const fw = 36 * S, fh = 60 * S, n = Math.floor(tex.getSourceImage().width / fw);
  for (let i = 0; i < n; i++) tex.add(i, 0, i * fw, 0, fw, fh);
  if (!scene.anims.exists('w_portal_spin')) {
    scene.anims.create({ key: 'w_portal_spin', frames: Array.from({ length: n }, (_, i) => ({ key, frame: i })), frameRate: 12, repeat: -1 });
  }
}

/** Builds every pixel-art world texture whose source loaded. Never throws. */
export function generatePixelWorldTextures(scene: Phaser.Scene) {
  for (const t of [...PIXEL_THEMES, ...PIXEL_LOOKS]) {
    try { buildTerrain(scene, t); } catch (e) { console.warn('[pixelWorld] terrain', t, e); }
  }
  for (const k of [...PIXEL_DECOR_KEYS, ...PIXEL_TOWN_KEYS]) {
    try { bakeWhole(scene, k, pixSrcKey(k)); } catch (e) { console.warn('[pixelWorld] decor', k, e); }
  }
  for (const k of PIXEL_FX_KEYS) {
    if (k === 'w_portal_px') continue;
    try { bakeWhole(scene, k, pixSrcKey(k)); } catch (e) { console.warn('[pixelWorld] fx', k, e); }
  }
  try { buildPortalAnim(scene); } catch (e) { console.warn('[pixelWorld] portal', e); }
}
