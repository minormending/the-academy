// Asset manifest for the world art domain (owned by the world art agent, PX3).
// Sources: Luis Zuno (@ansimuz) CC0 packs — see public/assets/world/CREDITS.md. The PNGs are 1× source pixels
// (sliced / palette-swapped offline from the packs); src/art/world/pixel.ts integer-scales them into the
// existing w_/d_/t_ texture keys. A file that fails to load simply leaves the procedural texture in place.
import type { AssetEntry } from '../assets';
import type { MapTheme } from '../../core/types';

export const PIXEL_THEMES: MapTheme[] = ['town', 'forest', 'mushroom', 'snow', 'volcano', 'storm', 'sanctum'];

/**
 * Per-map "looks": a variant of a base theme with its own terrain kit + parallax stack (branch zones).
 * A map opts in via MAP_EXTRAS[id].look; anything that fails to load falls back to the base theme's art.
 *  marsh   — forest at night (Moonlit Marsh) · grotto — snow inside an ice cave (Glacier Grotto)
 *  library — sanctum as a magical library (The Restricted Stacks)
 */
export type WorldLook = 'marsh' | 'grotto' | 'library';
export const PIXEL_LOOKS: WorldLook[] = ['marsh', 'grotto', 'library'];

export const PIXEL_DECOR_KEYS = [
  'd_oak', 'd_oak_dark', 'd_tree_round', 'd_tree_blossom', 'd_bush', 'd_bush_berry', 'd_bush_flower', 'd_flowers', 'd_tuft',
  'd_tuft_moss', 'd_tuft_storm', 'd_rock', 'd_rock_big', 'd_stump', 'd_log', 'd_fence', 'd_signpost', 'd_lamp', 'd_mush_small',
  'd_shroom_red', 'd_shroom_blue', 'd_shroom_purple', 'd_shroom_cluster', 'd_glow_shroom', 'd_vine',
  'd_pine_snow', 'd_pine_small', 'd_ice_crystal', 'd_snow_rock', 'd_icicles', 'd_snowman',
  'd_lava_spire', 'd_obsidian', 'd_brazier', 'd_burnt_tree',
  'd_dead_tree', 'd_wind_pine', 'd_runestone', 'd_broken_pillar', 'd_banner_storm',
  'd_pillar', 'd_pillar_broken', 'd_banner_arcane', 'd_arcane_circle', 'd_brazier_arcane', 'd_crystal_float',
  // branch zones (hand-pixelled to the packs' palettes): marsh reeds + bog pool, ice spire, library props
  'd_reeds', 'd_bog_pool', 'd_ice_spire', 'd_bookshelf', 'd_candles', 'd_book_float', 'd_book_pile',
] as const;

export const PIXEL_TOWN_KEYS = [
  't_house_potion', 't_house_smith', 't_cottage', 't_cottage_b', 't_hall_fire', 't_hall_ice', 't_hall_storm', 't_tower',
  't_fountain', 't_lantern', 't_bench', 't_crates', 't_barrel', 't_well', 't_bunting', 't_gate',
  't_sign_potion', 't_sign_smith', 't_sign_fire', 't_sign_ice', 't_sign_storm', 't_sign_elder',
  // The Academy: Holy + Shadow school halls, signs and banners (recoloured from the same packs).
  't_hall_holy', 't_hall_shadow', 't_sign_holy', 't_sign_shadow', 't_banner_holy', 't_banner_shadow',
] as const;

export const PIXEL_FX_KEYS = [
  'w_glow', 'w_dot', 'w_mote', 'w_ember', 'w_spark', 'w_leaf', 'w_petal', 'w_snowflake', 'w_raindrop', 'w_smoke',
  'w_hint_arrow', 'w_sun', 'w_moon', 'w_stars', 'w_waterfall', 'w_lavafall', 'w_lavapool', 'w_portal_px', 'w_portal_pad',
] as const;

export interface PixelBgLayer {
  name: string;
  /** Source size (1× pixels). */
  w: number; h: number;
  /** Integer display scale. */
  k: number;
  /** Screen y of the layer's bottom edge with the camera at the map bottom, or 'top' = pinned to the screen top (sky). */
  y: number | 'top';
  fx: number; fy: number;
  alpha?: number;
  /** Horizontal auto-scroll (px/ms). */
  drift?: number;
  /** Fill colours above / below the strip so tall cameras never see a gap. */
  top?: number; bottom?: number;
}

/** Parallax stacks per theme, back to front. Files: world/bg/<theme>_<name>.png */
export const PIXEL_BG: Record<MapTheme, PixelBgLayer[]> = {
  town: [
    { name: 'sky', w: 160, h: 208, k: 3, y: 'top', fx: 0.02, fy: 0.02, drift: 0.004, top: 0x0a89ff, bottom: 0x98dcff },
    { name: 'far', w: 160, h: 208, k: 3, y: 640, fx: 0.06, fy: 0.05, bottom: 0x024aca },
    { name: 'mid', w: 384, h: 288, k: 2, y: 840, fx: 0.14, fy: 0.1, bottom: 0x7f9cc8 },
    { name: 'near', w: 160, h: 208, k: 2, y: 690, fx: 0.26, fy: 0.2, bottom: 0x005280 },
  ],
  forest: [
    { name: 'sky', w: 384, h: 224, k: 3, y: 'top', fx: 0.02, fy: 0.02, top: 0x82b6ff, bottom: 0x8bb0e7 },
    { name: 'far', w: 160, h: 224, k: 2, y: 620, fx: 0.07, fy: 0.06, bottom: 0x6285ad },
    { name: 'mid', w: 160, h: 208, k: 2, y: 700, fx: 0.16, fy: 0.12, bottom: 0x005280 },
  ],
  mushroom: [
    { name: 'sky', w: 240, h: 176, k: 4, y: 'top', fx: 0.03, fy: 0.03, top: 0x1a1438, bottom: 0x1a1438 },
    { name: 'mid', w: 272, h: 176, k: 4, y: 760, fx: 0.14, fy: 0.12, top: 0x1a1238, bottom: 0x1a1238 },
  ],
  snow: [
    { name: 'sky', w: 160, h: 208, k: 3, y: 'top', fx: 0.02, fy: 0.02, drift: 0.004, top: 0x7fa9d8, bottom: 0xdcebf8 },
    { name: 'far', w: 256, h: 272, k: 2, y: 720, fx: 0.05, fy: 0.05, bottom: 0x5e7ea8 },
    { name: 'mid', w: 160, h: 208, k: 3, y: 700, fx: 0.12, fy: 0.1, bottom: 0x6a8fbc },
    { name: 'near', w: 160, h: 224, k: 2, y: 770, fx: 0.28, fy: 0.22, bottom: 0x2c4658 },
  ],
  volcano: [
    { name: 'sky', w: 272, h: 160, k: 4, y: 'top', fx: 0.02, fy: 0.02, top: 0x2e1014, bottom: 0x1a0a0e },
    { name: 'far', w: 512, h: 240, k: 2, y: 650, fx: 0.06, fy: 0.05, bottom: 0x1c0a0c },
    { name: 'mid', w: 512, h: 240, k: 2, y: 740, fx: 0.16, fy: 0.12, bottom: 0x120607 },
  ],
  storm: [
    { name: 'sky', w: 112, h: 304, k: 3, y: 'top', fx: 0.02, fy: 0.02, top: 0x1d2333, bottom: 0x646f8a },
    { name: 'far', w: 544, h: 160, k: 3, y: 610, fx: 0.05, fy: 0.05, bottom: 0x20263a },
    { name: 'clouds', w: 544, h: 236, k: 2, y: 560, fx: 0.04, fy: 0.03, alpha: 0.9, drift: 0.02, bottom: 0x2a3044 },
    { name: 'mid', w: 616, h: 110, k: 2, y: 700, fx: 0.14, fy: 0.12, bottom: 0x36404e },
    { name: 'near', w: 544, h: 160, k: 3, y: 790, fx: 0.3, fy: 0.22, bottom: 0x10141c },
  ],
  sanctum: [
    { name: 'sky', w: 64, h: 272, k: 3, y: 'top', fx: 0.02, fy: 0.02, top: 0x0e0822, bottom: 0x0e0822 },
    { name: 'far', w: 256, h: 272, k: 2, y: 660, fx: 0.05, fy: 0.05, bottom: 0x0e0822 },
    { name: 'mid', w: 352, h: 240, k: 2, y: 780, fx: 0.14, fy: 0.12, bottom: 0x0c061c },
  ],
};

/** Parallax stacks per look (files: world/bg/<look>_<name>.png). 'top' layers after the first are pinned overlays (cave roof). */
export const PIXEL_BG_LOOK: Record<WorldLook, PixelBgLayer[]> = {
  marsh: [
    { name: 'sky', w: 384, h: 224, k: 3, y: 'top', fx: 0.02, fy: 0.02, top: 0x0a0f23, bottom: 0x080c1e },
    { name: 'far', w: 160, h: 224, k: 2, y: 630, fx: 0.07, fy: 0.06, bottom: 0x0a121e },
    { name: 'mid', w: 160, h: 208, k: 2, y: 700, fx: 0.16, fy: 0.12, bottom: 0x040a0e },
    { name: 'mist', w: 256, h: 40, k: 2, y: 612, fx: 0.24, fy: 0.18, alpha: 0.85, drift: 0.008 },
  ],
  grotto: [
    { name: 'sky', w: 64, h: 272, k: 3, y: 'top', fx: 0.02, fy: 0.02, top: 0x040816, bottom: 0x0c1e38 },
    { name: 'far', w: 272, h: 176, k: 3, y: 700, fx: 0.06, fy: 0.05, top: 0x040a18, bottom: 0x040a18 },
    { name: 'ceiling', w: 256, h: 90, k: 2, y: 'top', fx: 0.1, fy: 0.02, top: 0x0a1628 },
    { name: 'mid', w: 320, h: 130, k: 2, y: 730, fx: 0.15, fy: 0.12, bottom: 0x0f213c },
  ],
  library: [
    { name: 'sky', w: 64, h: 272, k: 3, y: 'top', fx: 0.02, fy: 0.02, top: 0x0a060e, bottom: 0x22141e },
    { name: 'far', w: 256, h: 200, k: 2, y: 660, fx: 0.06, fy: 0.05, bottom: 0x100909 },
    { name: 'mid', w: 320, h: 150, k: 2, y: 740, fx: 0.15, fy: 0.12, bottom: 0x2b1a15 },
  ],
};

export const kitSrcKey = (t: MapTheme | WorldLook) => `src_w_kit_${t}`;
export const bgSrcKey = (t: MapTheme | WorldLook, name: string) => `src_w_bg_${t}_${name}`;
export const pixSrcKey = (key: string) => `src_${key}`;

export const WORLD_ASSETS: AssetEntry[] = [
  ...PIXEL_THEMES.map((t): AssetEntry => ({ key: kitSrcKey(t), path: `world/terrain/${t}.png`, type: 'image' })),
  ...PIXEL_THEMES.flatMap(t => PIXEL_BG[t].map((l): AssetEntry => ({ key: bgSrcKey(t, l.name), path: `world/bg/${t}_${l.name}.png`, type: 'image' }))),
  ...PIXEL_LOOKS.map((t): AssetEntry => ({ key: kitSrcKey(t), path: `world/terrain/${t}.png`, type: 'image' })),
  ...PIXEL_LOOKS.flatMap(t => PIXEL_BG_LOOK[t].map((l): AssetEntry => ({ key: bgSrcKey(t, l.name), path: `world/bg/${t}_${l.name}.png`, type: 'image' }))),
  ...PIXEL_DECOR_KEYS.map((k): AssetEntry => ({ key: pixSrcKey(k), path: `world/decor/${k}.png`, type: 'image' })),
  ...PIXEL_TOWN_KEYS.map((k): AssetEntry => ({ key: pixSrcKey(k), path: `world/town/${k}.png`, type: 'image' })),
  ...PIXEL_FX_KEYS.map((k): AssetEntry => ({ key: pixSrcKey(k), path: `world/fx/${k}.png`, type: 'image' })),
];
