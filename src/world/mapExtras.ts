// OWNER: A7 (world). Hand-placed set dressing per map (on top of the seeded scatter), plus spawn overrides.
import type { WorldLook } from '../art/manifests/world';

export type DecorLayer = 'far' | 'back' | 'mid' | 'front';

export interface DecorPlace {
  key: string;
  x: number;
  /** Surface y the piece stands on (default: the solid ground under x). Hanging pieces: their top. */
  y?: number;
  layer?: DecorLayer;          // default 'back'
  scale?: number;
  flip?: boolean;
  alpha?: number;
  tint?: number;
  /** Reserve this x-span from the random scatter (buildings etc.). Default: the sprite width for 'back' pieces. */
  clear?: boolean;
}

/** Animated vertical strips (lava falls / waterfalls) behind the terrain. */
export interface FallPlace { kind: 'lava' | 'water'; x: number; top: number; bottom: number; w?: number; }

export interface MapExtras {
  decor: DecorPlace[];
  falls?: FallPlace[];
  /** Extra x-spans kept clear of scatter. */
  clearZones?: [number, number][];
  /** Default spawn (feet) when no portal is given. */
  spawn?: { x: number; y: number };
  /** Multiplier for scatter density (1 = default). */
  density?: number;
  /** Branch-zone look over the map's base theme (own terrain kit, parallax, ambient + scatter; see themes.ts LOOK_RUNTIME). */
  look?: WorldLook;
}

const TG = 980; // Academy campus (map id `mistvale`) ground

export const MAP_EXTRAS: Record<string, MapExtras> = {
  mistvale: {
    spawn: { x: 1200, y: TG },
    density: 0.6,
    clearZones: [[3360, 3800]],
    decor: [
      { key: 'd_tree_blossom', x: 90, scale: 1.05 },
      { key: 't_well', x: 200, clear: true },
      { key: 't_house_smith', x: 400, clear: true },
      { key: 't_sign_smith', x: 520, layer: 'mid' },
      { key: 't_crates', x: 600, layer: 'mid' },
      { key: 't_lantern', x: 650, layer: 'mid' },
      { key: 't_house_potion', x: 820, clear: true },
      { key: 't_sign_potion', x: 930, layer: 'mid' },
      { key: 't_barrel', x: 710, layer: 'mid' },
      { key: 't_cottage_b', x: 1085, clear: true },
      { key: 't_bunting', x: 1260, y: TG - 150, layer: 'back' },
      { key: 't_fountain', x: 1260, layer: 'back', clear: true },
      { key: 't_bench', x: 1120, layer: 'mid' },
      { key: 'd_tree_round', x: 1360, scale: 0.9 },
      { key: 't_tower', x: 1510, clear: true },
      { key: 't_sign_elder', x: 1680, layer: 'mid' },
      { key: 't_lantern', x: 1770, layer: 'mid' },
      // the five School halls, each with its hanging sign
      { key: 't_hall_fire', x: 1990, clear: true },
      { key: 't_sign_fire', x: 1895, layer: 'mid' },
      { key: 't_hall_ice', x: 2290, clear: true },
      { key: 't_sign_ice', x: 2195, layer: 'mid' },
      { key: 't_hall_storm', x: 2590, clear: true },
      { key: 't_sign_storm', x: 2495, layer: 'mid' },
      { key: 't_lantern', x: 2745, layer: 'mid' },
      { key: 't_hall_holy', x: 2900, clear: true },
      { key: 't_sign_holy', x: 2805, layer: 'mid' },
      { key: 't_banner_holy', x: 3042, clear: true },
      { key: 't_banner_shadow', x: 3098, clear: true },
      { key: 't_hall_shadow', x: 3240, clear: true },
      { key: 't_sign_shadow', x: 3145, layer: 'mid' },
      { key: 'd_pillar', x: 3420, clear: true },
      { key: 'd_lamp', x: 3510, layer: 'mid', tint: 0xb8ffc4 },
      { key: 'd_oak', x: 3600, scale: 0.9 },
      { key: 't_gate', x: 3705, layer: 'back', clear: true },
      { key: 'd_signpost', x: 3630, layer: 'mid' },
      { key: 'd_fence', x: 3790, layer: 'mid' },
    ],
  },
  whisperwood: {
    decor: [
      { key: 'd_signpost', x: 150, layer: 'mid', flip: true },
      { key: 'd_lamp', x: 330, layer: 'mid' },
      { key: 'd_fence', x: 420, layer: 'mid' },
      { key: 'd_signpost', x: 3040, layer: 'mid' },
      { key: 'd_lamp', x: 2990, layer: 'mid' },
    ],
    falls: [{ kind: 'water', x: 2350, top: 590, bottom: 1180, w: 56 }],
  },
  shroom_hollow: {
    decor: [
      { key: 'd_glow_shroom', x: 150, layer: 'mid' },
      { key: 'd_shroom_red', x: 1180, scale: 1.2, clear: true },
      { key: 'd_shroom_blue', x: 3450, layer: 'back' },
    ],
  },
  frostfang_cliffs: {
    decor: [
      { key: 'd_snowman', x: 230, layer: 'mid' },
      { key: 'd_lamp', x: 150, layer: 'mid', tint: 0xcfe6ff },
      { key: 'd_ice_crystal', x: 1410, y: 1220, layer: 'back', scale: 1.3 },
      { key: 'd_lamp', x: 3650, layer: 'mid', tint: 0xcfe6ff },
    ],
    falls: [{ kind: 'water', x: 3400, top: 780, bottom: 1380, w: 40 }],
  },
  cinder_caverns: {
    decor: [
      { key: 'd_brazier', x: 170, layer: 'mid' },
      { key: 'd_brazier', x: 3850, layer: 'mid' },
      { key: 'd_lava_spire', x: 1420, y: 1310, layer: 'back', scale: 0.8 },
    ],
    falls: [
      { kind: 'lava', x: 560, top: 0, bottom: 1380, w: 52 },
      { kind: 'lava', x: 1700, top: 0, bottom: 1380, w: 40 },
      { kind: 'lava', x: 2560, top: 0, bottom: 1380, w: 60 },
      { kind: 'lava', x: 3480, top: 0, bottom: 1380, w: 44 },
    ],
  },
  stormspire_peak: {
    decor: [
      { key: 'd_runestone', x: 180, layer: 'mid' },
      { key: 'd_banner_storm', x: 1700, y: 1400, layer: 'back' },
      { key: 'd_banner_storm', x: 1900, y: 1400, layer: 'back', flip: true },
      { key: 'd_runestone', x: 3420, layer: 'mid' },
    ],
  },
  arcane_sanctum: {
    spawn: { x: 200, y: 980 },
    decor: [
      ...[160, 560, 960, 1640, 2040, 2440].map((x, i) => ({ key: i % 3 === 1 ? 'd_pillar_broken' : 'd_pillar', x, layer: 'back' as const })),
      ...[360, 760, 1840, 2240].map(x => ({ key: 'd_banner_arcane', x, layer: 'back' as const })),
      { key: 'd_arcane_circle', x: 1300, y: 1012, layer: 'front', alpha: 0.7 },
      { key: 'd_brazier_arcane', x: 150, layer: 'mid' },
      { key: 'd_brazier_arcane', x: 1000, layer: 'mid' },
      { key: 'd_brazier_arcane', x: 1600, layer: 'mid' },
      { key: 'd_brazier_arcane', x: 2450, layer: 'mid' },
      { key: 'd_crystal_float', x: 820, y: 760, layer: 'back' },
      { key: 'd_crystal_float', x: 1300, y: 470, layer: 'back', scale: 1.1 },  // above the observatory portal on the dais
      { key: 'd_crystal_float', x: 1780, y: 760, layer: 'back' },
      { key: 'd_crystal_float', x: 420, y: 560, layer: 'back', scale: 0.8 },
      { key: 'd_crystal_float', x: 2180, y: 560, layer: 'back', scale: 0.8 },
    ],
  },
  // ── branch zones (each has its own look: terrain kit, parallax, ambient and scatter) ──
  // Moonlit Marsh: night bog — lantern-lit trailhead, bog pools with lily pads among the reeds, glowing fungus.
  moonlit_marsh: {
    look: 'marsh',
    density: 1.1,
    decor: [
      { key: 'd_signpost', x: 175, layer: 'mid', tint: 0x9aa0b8 },
      { key: 'd_lamp', x: 240, layer: 'mid' },
      ...[640, 1640, 2330, 3000].map(x => ({ key: 'd_bog_pool', x, layer: 'front' as const })),
      ...[590, 700, 1590, 1700, 2290, 2420, 2960].map((x, i) => ({ key: 'd_reeds', x, layer: 'mid' as const, flip: i % 2 === 1 })),
      { key: 'd_dead_tree', x: 1290, y: 1235, layer: 'back', tint: 0x7a8aa8 },
      { key: 'd_glow_shroom', x: 1220, y: 1235, layer: 'mid' },
      { key: 'd_glow_shroom', x: 2650, y: 1230, layer: 'mid' },
      { key: 'd_glow_shroom', x: 1500, y: 575, layer: 'mid' },
      { key: 'd_glow_shroom', x: 2700, y: 575, layer: 'mid' },
    ],
  },
  // Glacier Grotto: ice cave — a cold lamp at the cave mouth, big ice spires, floating crystals, a meltwater fall.
  glacier_grotto: {
    look: 'grotto',
    decor: [
      { key: 'd_lamp', x: 200, layer: 'mid', tint: 0xcfe6ff },
      { key: 'd_ice_spire', x: 850, y: 1300, layer: 'back' },
      { key: 'd_ice_spire', x: 2430, y: 1290, layer: 'back', flip: true },
      { key: 'd_ice_crystal', x: 760, y: 1300, layer: 'mid' },
      { key: 'd_ice_crystal', x: 2510, y: 1290, layer: 'mid' },
      { key: 'd_crystal_float', x: 1600, y: 420, layer: 'back' },
      { key: 'd_crystal_float', x: 650, y: 690, layer: 'back' },
      { key: 'd_crystal_float', x: 2650, y: 690, layer: 'back' },
      { key: 'd_crystal_float', x: 3250, y: 900, layer: 'back' },
    ],
    falls: [{ kind: 'water', x: 3330, top: 300, bottom: 1380, w: 40 }],
  },
  // The Restricted Stacks: forbidden library — arcane braziers at the door, a summoning circle on the reading dais,
  // banners at the dais corners and tomes floating between the shelf galleries.
  restricted_stacks: {
    look: 'library',
    decor: [
      { key: 'd_brazier_arcane', x: 210, layer: 'mid' },
      { key: 'd_pillar', x: 30, layer: 'back', tint: 0xc8a8a0 },
      { key: 'd_pillar', x: 2970, layer: 'back', tint: 0xc8a8a0 },
      { key: 'd_banner_arcane', x: 1320, y: 1290, layer: 'back' },
      { key: 'd_banner_arcane', x: 1680, y: 1290, layer: 'back' },
      { key: 'd_arcane_circle', x: 1500, y: 1322, layer: 'front', alpha: 0.6 },
      { key: 'd_candles', x: 1420, y: 1290, layer: 'mid' },
      { key: 'd_candles', x: 1580, y: 1290, layer: 'mid' },
      // drifting tomes in the background (dimmed so they never read as the animated_tome monsters)
      ...([[330, 1150], [2700, 1130], [560, 870], [1980, 860], [1500, 400], [2480, 650]] as const)
        .map(([x, y]) => ({ key: 'd_book_float', x, y, layer: 'far' as const, alpha: 0.6, tint: 0x9888b0 })),
    ],
  },
  // ── endgame chain ──
  // Astral Observatory: brass telescopes (gilded runestones) on the dais, an orrery circle, star charts on banners.
  astral_observatory: {
    look: 'astral',
    spawn: { x: 200, y: 1380 },
    clearZones: [[0, 220], [3000, 3200]],
    decor: [
      { key: 'd_brazier_arcane', x: 220, layer: 'mid', tint: 0xffe0a0 },
      { key: 'd_brazier_arcane', x: 2990, layer: 'mid', tint: 0xffe0a0 },
      { key: 'd_arcane_circle', x: 1600, y: 1322, layer: 'front', alpha: 0.7, tint: 0xffd890 },
      { key: 'd_runestone', x: 1480, y: 1290, layer: 'back', scale: 1.4, tint: 0xe0c070 },
      { key: 'd_runestone', x: 1720, y: 1290, layer: 'back', scale: 1.4, tint: 0xe0c070, flip: true },
      ...[1250, 1950].map(x => ({ key: 'd_banner_arcane', x, layer: 'back' as const, tint: 0x6a80d8 })),
      ...([[400, 900], [1600, 380], [2700, 880], [900, 560], [2400, 560]] as const)
        .map(([x, y]) => ({ key: 'd_crystal_float', x, y, layer: 'far' as const, alpha: 0.7, tint: 0x9fd0ff })),
    ],
  },
  // The Void Rift: violet shards hanging in nothing, broken pillars at the rift edges.
  void_rift: {
    look: 'rift',
    spawn: { x: 200, y: 1380 },
    clearZones: [[0, 220], [3200, 3400]],
    decor: [
      { key: 'd_runestone', x: 200, layer: 'mid', tint: 0xc890ff },
      { key: 'd_runestone', x: 3210, layer: 'mid', tint: 0xc890ff },
      { key: 'd_obsidian', x: 1020, y: 1300, layer: 'back', tint: 0xb070ff },
      { key: 'd_obsidian', x: 2430, y: 1295, layer: 'back', tint: 0xb070ff, flip: true },
      ...([[500, 650], [1150, 420], [1700, 330], [2300, 450], [2950, 600], [3200, 950], [150, 900]] as const)
        .map(([x, y], i) => ({ key: 'd_crystal_float', x, y, layer: (i % 2 ? 'far' : 'back') as DecorLayer, scale: 0.8 + (i % 3) * 0.25, tint: 0xd08aff })),
    ],
  },
  // The Archon Spire: gilded pillars and violet banners up the tower; the arena under a ring of braziers.
  archon_spire: {
    look: 'spire',
    spawn: { x: 200, y: 1880 },
    clearZones: [[0, 220], [2580, 2800]],
    decor: [
      ...[40, 2760].map(x => ({ key: 'd_pillar', x, layer: 'back' as const, tint: 0xf0d080 })),
      { key: 'd_brazier_arcane', x: 220, layer: 'mid', tint: 0xffe0a0 },
      { key: 'd_brazier_arcane', x: 2600, layer: 'mid', tint: 0xffe0a0 },
      ...[450, 1000, 1400, 1800, 2350].map(x => ({ key: 'd_brazier_arcane', x, y: 1015, layer: 'mid' as const, tint: 0xffe0a0 })),
      ...[700, 1200, 1600, 2100].map(x => ({ key: 'd_banner_arcane', x, y: 1015, layer: 'back' as const, tint: 0xb070e0 })),
      { key: 'd_arcane_circle', x: 1400, y: 1047, layer: 'front', alpha: 0.75, tint: 0xffd070 },
      { key: 'd_crystal_float', x: 1400, y: 760, layer: 'back', scale: 1.5, tint: 0xe0b0ff },
    ],
  },
  // Trial Hall: an intact, well-lit Academy hall (the same sanctum kit, no broken pillars).
  trial_hall: {
    spawn: { x: 160, y: 780 },
    density: 0.4,
    decor: [
      ...[60, 660, 1140, 1740].map(x => ({ key: 'd_pillar', x, layer: 'back' as const })),
      ...[260, 1540].map(x => ({ key: 'd_banner_arcane', x, layer: 'back' as const })),
      { key: 'd_arcane_circle', x: 900, y: 812, layer: 'front', alpha: 0.75 },
      { key: 'd_brazier_arcane', x: 230, layer: 'mid' },
      { key: 'd_brazier_arcane', x: 640, layer: 'mid' },
      { key: 'd_brazier_arcane', x: 1160, layer: 'mid' },
      { key: 'd_brazier_arcane', x: 1690, layer: 'mid' },
      { key: 'd_crystal_float', x: 900, y: 440, layer: 'back', scale: 1.2 },
      { key: 'd_crystal_float', x: 450, y: 520, layer: 'back', scale: 0.8 },
      { key: 'd_crystal_float', x: 1350, y: 520, layer: 'back', scale: 0.8 },
    ],
  },
};
