// OWNER: A7 (world). Runtime presentation config per map theme: parallax, ambient, decor scatter, glows.
import type { MapTheme } from '../core/types';
import type { WorldLook } from '../art/manifests/world';

export type AmbientKind = 'fireflies' | 'leaves' | 'petals' | 'spores' | 'snow' | 'embers' | 'ash' | 'rain' | 'lightning' | 'motes'
  // branch-zone looks
  | 'glints' | 'icedust' | 'dust' | 'pages';

export interface LayerCfg {
  key: 'far' | 'mid' | 'near';
  /** Horizontal parallax factor (fraction of camera scroll). */
  fx: number;
  /** Vertical drift factor: how far the layer sinks as the camera climbs. */
  fy: number;
  /** Screen y of the texture's top row when the camera is at the bottom of the map. */
  screenTop: number;
  alpha?: number;
}

export interface ThemeRuntime {
  layers: LayerCfg[];
  clouds?: { speed: number; fx: number; screenTop: number; alpha: number; front?: boolean };
  stars?: number;               // alpha of the star field (0 = none)
  celestial?: { key: 'w_sun' | 'w_moon'; x: number; y: number; alpha: number; tint?: number };
  ambient: AmbientKind[];
  scatter: {
    back: string[];             // big background pieces on solid ground
    between: string[];          // medium filler on solid ground (behind terrain)
    front: string[];            // small foreground bits on every surface
    onPlatforms: string[];      // small bits standing on one-way platforms
    hanging: string[];          // dangling under one-way platforms
    backSpacing: [number, number];
    frontSpacing: [number, number];
  };
  backTint: number;
  tints?: Record<string, number>;
  ladderKey: string;
  /** Show the sun/moon sprite over the pixel parallax (false when the sky strip already paints one). */
  pixelCelestial?: boolean;
}

export const THEME_RUNTIME: Record<MapTheme, ThemeRuntime> = {
  town: {
    layers: [
      { key: 'far', fx: 0.06, fy: 0.05, screenTop: 130 },
      { key: 'mid', fx: 0.16, fy: 0.12, screenTop: 110 },
      { key: 'near', fx: 0.3, fy: 0.22, screenTop: 190 },
    ],
    clouds: { speed: 0.006, fx: 0.04, screenTop: 10, alpha: 0.95 },
    celestial: { key: 'w_sun', x: 0.78, y: 110, alpha: 0.9 },
    ambient: ['petals', 'fireflies'],
    scatter: {
      back: ['d_tree_blossom', 'd_oak', 'd_tree_round'], between: ['d_bush_flower', 'd_bush'],
      front: ['d_flowers', 'd_tuft', 'd_flowers'], onPlatforms: ['d_flowers', 'd_tuft'], hanging: [],
      backSpacing: [260, 420], frontSpacing: [80, 170],
    },
    backTint: 0xffffff, ladderKey: 'w_ladder',
  },
  forest: {
    layers: [
      { key: 'far', fx: 0.06, fy: 0.05, screenTop: 120 },
      { key: 'mid', fx: 0.16, fy: 0.12, screenTop: 120 },
      { key: 'near', fx: 0.3, fy: 0.22, screenTop: 210 },
    ],
    clouds: { speed: 0.005, fx: 0.04, screenTop: 0, alpha: 0.9 },
    celestial: { key: 'w_sun', x: 0.22, y: 90, alpha: 0.8 },
    ambient: ['fireflies', 'leaves'],
    scatter: {
      back: ['d_oak', 'd_oak_dark', 'd_tree_round', 'd_oak'], between: ['d_bush', 'd_bush_berry', 'd_rock_big', 'd_stump', 'd_log'],
      front: ['d_tuft', 'd_flowers', 'd_mush_small', 'd_rock', 'd_tuft'], onPlatforms: ['d_bush', 'd_tuft', 'd_flowers', 'd_mush_small'], hanging: [],
      backSpacing: [200, 360], frontSpacing: [70, 150],
    },
    backTint: 0xe8f2e8, ladderKey: 'w_ladder',
  },
  mushroom: {
    layers: [
      { key: 'far', fx: 0.05, fy: 0.05, screenTop: 40 },
      { key: 'mid', fx: 0.14, fy: 0.12, screenTop: 60 },
      { key: 'near', fx: 0.28, fy: 0.22, screenTop: 210 },
    ],
    clouds: { speed: 0.004, fx: 0.03, screenTop: 140, alpha: 0.8 },
    stars: 0.45,
    celestial: { key: 'w_moon', x: 0.7, y: 100, alpha: 0.7, tint: 0xd8fff6 },
    ambient: ['spores', 'fireflies'],
    scatter: {
      back: ['d_shroom_red', 'd_shroom_blue', 'd_shroom_purple', 'd_shroom_red'], between: ['d_shroom_cluster', 'd_rock_big', 'd_glow_shroom'],
      front: ['d_tuft_moss', 'd_glow_shroom', 'd_shroom_cluster', 'd_mush_small'], onPlatforms: ['d_glow_shroom', 'd_tuft_moss', 'd_shroom_cluster'], hanging: ['d_vine'],
      backSpacing: [200, 340], frontSpacing: [70, 150],
    },
    backTint: 0xd8d0f0, tints: { d_rock: 0xb8a0d0, d_rock_big: 0xa890c8 }, ladderKey: 'w_ladder',
  },
  snow: {
    layers: [
      { key: 'far', fx: 0.05, fy: 0.05, screenTop: 90 },
      { key: 'mid', fx: 0.15, fy: 0.12, screenTop: 90 },
      { key: 'near', fx: 0.3, fy: 0.22, screenTop: 200 },
    ],
    clouds: { speed: 0.004, fx: 0.04, screenTop: 0, alpha: 0.85 },
    celestial: { key: 'w_sun', x: 0.3, y: 120, alpha: 0.55 },
    ambient: ['snow'],
    scatter: {
      back: ['d_pine_snow', 'd_pine_small', 'd_pine_snow'], between: ['d_snow_rock', 'd_ice_crystal', 'd_snowman'],
      front: ['d_snow_rock', 'd_ice_crystal'], onPlatforms: ['d_snow_rock', 'd_ice_crystal', 'd_pine_small'], hanging: ['d_icicles'],
      backSpacing: [180, 320], frontSpacing: [110, 220],
    },
    backTint: 0xe6eef8, ladderKey: 'w_ladder',
  },
  volcano: {
    layers: [
      { key: 'far', fx: 0.05, fy: 0.05, screenTop: 60 },
      { key: 'mid', fx: 0.15, fy: 0.12, screenTop: 110 },
      { key: 'near', fx: 0.3, fy: 0.22, screenTop: 210 },
    ],
    clouds: { speed: 0.003, fx: 0.03, screenTop: 0, alpha: 0.7 },
    pixelCelestial: false,
    ambient: ['embers', 'ash'],
    scatter: {
      back: ['d_lava_spire', 'd_burnt_tree', 'd_lava_spire'], between: ['d_obsidian', 'd_rock_big', 'd_brazier'],
      front: ['d_rock', 'd_obsidian'], onPlatforms: ['d_rock', 'd_obsidian'], hanging: [],
      backSpacing: [220, 380], frontSpacing: [110, 220],
    },
    backTint: 0xffd8c8, tints: { d_rock: 0x7a6262, d_rock_big: 0x6a5555 }, ladderKey: 'w_ladder',
  },
  storm: {
    layers: [
      { key: 'far', fx: 0.05, fy: 0.05, screenTop: 110 },
      { key: 'mid', fx: 0.15, fy: 0.12, screenTop: 120 },
      { key: 'near', fx: 0.3, fy: 0.22, screenTop: 210 },
    ],
    clouds: { speed: 0.02, fx: 0.06, screenTop: -20, alpha: 0.95, front: true },
    ambient: ['rain', 'lightning'],
    scatter: {
      back: ['d_dead_tree', 'd_wind_pine', 'd_broken_pillar', 'd_wind_pine'], between: ['d_runestone', 'd_rock_big', 'd_banner_storm'],
      front: ['d_tuft_storm', 'd_rock', 'd_tuft_storm'], onPlatforms: ['d_tuft_storm', 'd_rock'], hanging: [],
      backSpacing: [200, 360], frontSpacing: [80, 170],
    },
    backTint: 0xc8d0e0, tints: { d_rock: 0x9aa2b4, d_rock_big: 0x8a92a4 }, ladderKey: 'w_ladder',
  },
  sanctum: {
    layers: [
      { key: 'far', fx: 0.04, fy: 0.04, screenTop: 30 },
      { key: 'mid', fx: 0.12, fy: 0.1, screenTop: 60 },
      { key: 'near', fx: 0.26, fy: 0.2, screenTop: 210 },
    ],
    clouds: { speed: 0.003, fx: 0.03, screenTop: 60, alpha: 0.9 },
    stars: 1,
    celestial: { key: 'w_moon', x: 0.8, y: 110, alpha: 0.9 },
    ambient: ['motes'],
    scatter: {
      back: [], between: [], front: [], onPlatforms: [], hanging: [],
      backSpacing: [400, 600], frontSpacing: [200, 300],
    },
    backTint: 0xffffff, ladderKey: 'w_ladder_gold',
  },
};

/**
 * Presentation for the branch-zone looks (MAP_EXTRAS[id].look). Replaces the base theme's runtime for that map;
 * terrain + parallax come from the look's own pixel kit (manifests/world.ts PIXEL_BG_LOOK).
 */
export const LOOK_RUNTIME: Record<WorldLook, ThemeRuntime> = {
  // Moonlit Marsh: the forest kit at night — bog pools, reeds, dark willows, mist and a lot of fireflies.
  marsh: {
    layers: THEME_RUNTIME.forest.layers,
    stars: 0.85,
    celestial: { key: 'w_moon', x: 0.74, y: 96, alpha: 0.9, tint: 0xe8fff4 },
    ambient: ['fireflies', 'fireflies'],
    scatter: {
      back: ['d_oak_dark', 'd_dead_tree', 'd_oak_dark'], between: ['d_reeds', 'd_stump', 'd_rock_big', 'd_log'],
      front: ['d_reeds', 'd_tuft_moss', 'd_bog_pool', 'd_glow_shroom', 'd_reeds', 'd_mush_small'], onPlatforms: ['d_reeds', 'd_tuft_moss', 'd_reeds'], hanging: ['d_vine'],
      backSpacing: [170, 300], frontSpacing: [60, 130],
    },
    backTint: 0x6a7c98,
    tints: {
      d_oak_dark: 0x8a9ab8, d_dead_tree: 0x7a8aa8, d_stump: 0x8a90a8, d_log: 0x8a90a8, d_rock_big: 0x8890a8,
      d_tuft_moss: 0xa0c8c0, d_mush_small: 0xb0b8d0, d_vine: 0x88a8a8, d_signpost: 0x9aa0b8, d_lamp: 0xb8ffd8,
    },
    ladderKey: 'w_ladder',
  },
  // Glacier Grotto: the snow kit inside an ice cave — ice spires, icicles under every ledge, crystal glow, no sky.
  grotto: {
    layers: THEME_RUNTIME.snow.layers,
    pixelCelestial: false,
    ambient: ['glints', 'icedust'],
    scatter: {
      back: ['d_ice_spire', 'd_ice_spire', 'd_crystal_float'], between: ['d_ice_crystal', 'd_snow_rock', 'd_ice_spire'],
      front: ['d_ice_crystal', 'd_snow_rock', 'd_ice_crystal'], onPlatforms: ['d_ice_crystal', 'd_snow_rock'], hanging: ['d_icicles', 'd_icicles'],
      backSpacing: [180, 320], frontSpacing: [90, 190],
    },
    backTint: 0x8ab4d8,
    tints: { d_crystal_float: 0x9fe6ff, d_snow_rock: 0x9cc0e4, d_ice_crystal: 0xd8f6ff, d_lamp: 0xcfe6ff },
    ladderKey: 'w_ladder',
  },
  // The Restricted Stacks: the sanctum as a candle-lit library — shelf walls, book piles, floating tomes, dust and pages.
  library: {
    layers: THEME_RUNTIME.sanctum.layers,
    pixelCelestial: false,
    ambient: ['dust', 'pages', 'motes'],
    scatter: {
      back: ['d_bookshelf', 'd_bookshelf', 'd_pillar', 'd_bookshelf'], between: ['d_book_pile', 'd_candles', 'd_brazier_arcane'],
      front: ['d_book_pile', 'd_candles', 'd_book_pile'], onPlatforms: ['d_book_pile', 'd_candles', 'd_book_pile'], hanging: [],
      backSpacing: [150, 260], frontSpacing: [110, 220],
    },
    backTint: 0xb8a8b8,
    tints: { d_pillar: 0xc8a8a0 },
    ladderKey: 'w_ladder',
  },
};

/** Light sources attached to decor (offsets in texture px from the bottom-center origin). */
export const DECOR_GLOWS: Record<string, { dy: number; dx?: number; r: number; color: number; alpha: number; pulse?: number }> = {
  d_lamp: { dy: -134, r: 70, color: 0xffd27a, alpha: 0.55, pulse: 0.08 },
  t_lantern: { dy: -144, dx: 4, r: 72, color: 0xffc860, alpha: 0.6, pulse: 0.1 },
  t_gate: { dy: -254, dx: -102, r: 50, color: 0xffc860, alpha: 0.5, pulse: 0.1 },
  d_brazier: { dy: -66, r: 70, color: 0xff8a20, alpha: 0.6, pulse: 0.25 },
  d_brazier_arcane: { dy: -76, r: 80, color: 0x8fd8ff, alpha: 0.6, pulse: 0.25 },
  d_glow_shroom: { dy: -30, r: 46, color: 0x7dfff0, alpha: 0.45, pulse: 0.2 },
  d_ice_crystal: { dy: -60, r: 60, color: 0x9fe6ff, alpha: 0.25, pulse: 0.15 },
  d_obsidian: { dy: -40, r: 56, color: 0xff6a10, alpha: 0.35, pulse: 0.2 },
  d_runestone: { dy: -68, r: 56, color: 0x9fd8ff, alpha: 0.4, pulse: 0.3 },
  d_crystal_float: { dy: -50, r: 64, color: 0xc08aff, alpha: 0.5, pulse: 0.2 },
  d_lava_spire: { dy: -10, r: 80, color: 0xff5a10, alpha: 0.35, pulse: 0.15 },
  t_hall_fire: { dy: -100, r: 60, color: 0xffb040, alpha: 0.35, pulse: 0.1 },
  t_hall_ice: { dy: -100, r: 60, color: 0xc8f4ff, alpha: 0.35, pulse: 0.1 },
  t_hall_storm: { dy: -100, r: 60, color: 0xffe066, alpha: 0.35, pulse: 0.1 },
  t_hall_holy: { dy: -100, r: 64, color: 0xfff0b0, alpha: 0.4, pulse: 0.1 },
  t_hall_shadow: { dy: -100, r: 60, color: 0x7ee88c, alpha: 0.32, pulse: 0.2 },
  t_tower: { dy: -588, dx: 8, r: 70, color: 0x9fd8ff, alpha: 0.6, pulse: 0.2 },
  d_candles: { dy: -30, r: 50, color: 0xffb860, alpha: 0.55, pulse: 0.3 },
  d_ice_spire: { dy: -60, r: 64, color: 0x8fe0ff, alpha: 0.3, pulse: 0.15 },
  d_book_float: { dy: -10, r: 40, color: 0xd8b0ff, alpha: 0.4, pulse: 0.25 },
  d_bog_pool: { dy: -6, r: 44, color: 0x9fd8c8, alpha: 0.12, pulse: 0.3 },
};
/** Decor that gently bobs (floating things). */
export const DECOR_BOB: Record<string, number> = { d_crystal_float: 7, d_book_float: 6 };

/**
 * Glow anchor for the pixel versions of glowing decor (their sprites differ in size from the procedural ones).
 * dy(h) gets the displayed sprite height; null = no glow for the pixel version.
 */
export const PIXEL_GLOW_DY: Record<string, { dy: (h: number) => number; dx?: number } | null> = {
  d_lamp: { dy: h => -(h - 22) },
  t_lantern: { dy: h => -(h - 22) },
  t_gate: null,
  d_brazier: { dy: h => -(h - 12) },
  d_brazier_arcane: { dy: h => -(h - 12) },
  d_glow_shroom: { dy: h => -h * 0.55 },
  d_ice_crystal: { dy: h => -h * 0.5 },
  d_obsidian: { dy: h => -h * 0.45 },
  d_runestone: { dy: h => -h * 0.5 },
  d_crystal_float: { dy: h => -h * 0.5 },
  d_lava_spire: { dy: () => -10 },
  t_hall_fire: { dy: h => -h * 0.38, dx: -40 },
  t_hall_ice: { dy: h => -h * 0.38, dx: -40 },
  t_hall_storm: { dy: h => -h * 0.38, dx: -40 },
  t_hall_holy: { dy: () => -80, dx: -46 },
  t_hall_shadow: { dy: () => -80, dx: -46 },
  t_tower: { dy: h => -(h - 12) },
  d_candles: { dy: h => -(h - 6) },
  d_ice_spire: { dy: h => -h * 0.45 },
  d_book_float: { dy: h => -h * 0.5 },
  d_bog_pool: { dy: h => -h * 0.5 },
};
