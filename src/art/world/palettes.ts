// OWNER: A7 (world). Per-theme palettes + the texture key scheme used by MapLoader.
import type { MapTheme } from '../../core/types';

export const THEMES: MapTheme[] = ['town', 'forest', 'mushroom', 'snow', 'volcano', 'storm', 'sanctum'];

export interface ThemePalette {
  skyTop: number; skyMid: number; skyBottom: number;
  far: number; mid: number; near: number; haze: number;
  soil: number; soilDark: number; soilLight: number; pebble: number;
  lip: number; lipLight: number; lipDark: number;
  body: number; bodyDark: number; bodyLight: number;   // one-way platform body
  wall: number; wallDark: number; wallLight: number;
  accent: number;                                       // glow color (lava, gold, spores, runes…)
  cloud: number;
}

export const PALETTES: Record<MapTheme, ThemePalette> = {
  town: {
    skyTop: 0x5fa8ee, skyMid: 0x9fd2f7, skyBottom: 0xffe2c0,
    far: 0x8db3d9, mid: 0x6fae7a, near: 0x4d8f58, haze: 0xdfeefa,
    soil: 0x9a6a43, soilDark: 0x6b4429, soilLight: 0xb98a5e, pebble: 0xc9b9a3,
    lip: 0x6cc64a, lipLight: 0xa6e86b, lipDark: 0x3f8f2f,
    body: 0xb07a45, bodyDark: 0x7a4e2a, bodyLight: 0xd29a5c,
    wall: 0xb9a68e, wallDark: 0x7f6d5a, wallLight: 0xddd0bd,
    accent: 0xffd27a, cloud: 0xffffff,
  },
  forest: {
    skyTop: 0x4d9be0, skyMid: 0x8fd0ef, skyBottom: 0xd9f4e4,
    far: 0x7aa8c9, mid: 0x4f9567, near: 0x2f6c43, haze: 0xd5efe6,
    soil: 0x7c5233, soilDark: 0x553521, soilLight: 0x9b6d46, pebble: 0xb3a28a,
    lip: 0x5bb83c, lipLight: 0x9be060, lipDark: 0x2f7d27,
    body: 0x80562f, bodyDark: 0x573820, bodyLight: 0xa3713f,
    wall: 0x8c7b67, wallDark: 0x5c4e40, wallLight: 0xb4a48f,
    accent: 0xfff2a0, cloud: 0xffffff,
  },
  mushroom: {
    skyTop: 0x1c1640, skyMid: 0x3a2a6e, skyBottom: 0x2f7b84,
    far: 0x3d3478, mid: 0x4a3c7c, near: 0x2c2350, haze: 0x6fd6c7,
    soil: 0x4f3a52, soilDark: 0x33243a, soilLight: 0x6d5470, pebble: 0x8f7a98,
    lip: 0x3fa889, lipLight: 0x7ee0b6, lipDark: 0x23705d,
    body: 0xc9473f, bodyDark: 0x8a2a2a, bodyLight: 0xf07e6a,
    wall: 0x5f4a66, wallDark: 0x3b2c43, wallLight: 0x83709a,
    accent: 0x7dfff0, cloud: 0x8fd9e8,
  },
  snow: {
    skyTop: 0x6fa8de, skyMid: 0xb7daf4, skyBottom: 0xeef7ff,
    far: 0xb4cfe8, mid: 0x8fb3d4, near: 0x5e86ad, haze: 0xf2f8ff,
    soil: 0x5a7598, soilDark: 0x3c5170, soilLight: 0x7d9abd, pebble: 0xb7cbe0,
    lip: 0xf4f9ff, lipLight: 0xffffff, lipDark: 0xb6cde6,
    body: 0x6e8db2, bodyDark: 0x47617f, bodyLight: 0x95b3d4,
    wall: 0x6a86a8, wallDark: 0x435a78, wallLight: 0x9ab5d3,
    accent: 0xbff0ff, cloud: 0xffffff,
  },
  volcano: {
    skyTop: 0x1a0d12, skyMid: 0x4a1a14, skyBottom: 0xb2441c,
    far: 0x3d1915, mid: 0x2c1414, near: 0x1c0d0d, haze: 0xff7a2e,
    soil: 0x3a2f2f, soilDark: 0x231c1d, soilLight: 0x544545, pebble: 0x6e5d5a,
    lip: 0x4a3c3a, lipLight: 0x6e5a55, lipDark: 0x2a2120,
    body: 0x3e3333, bodyDark: 0x241d1d, bodyLight: 0x5c4c4a,
    wall: 0x433737, wallDark: 0x2a2222, wallLight: 0x5f5050,
    accent: 0xff7a1a, cloud: 0x5a4040,
  },
  storm: {
    skyTop: 0x1d2333, skyMid: 0x3a4459, skyBottom: 0x6d7690,
    far: 0x4b5469, mid: 0x3a4255, near: 0x262c3a, haze: 0x9aa4bd,
    soil: 0x4a505c, soilDark: 0x30343d, soilLight: 0x666d7b, pebble: 0x8a90a0,
    lip: 0x5f8a5a, lipLight: 0x8ab47d, lipDark: 0x3c5c3b,
    body: 0x5a6070, bodyDark: 0x3a3e4a, bodyLight: 0x7d8494,
    wall: 0x575d6b, wallDark: 0x373b46, wallLight: 0x7a8090,
    accent: 0x9fd8ff, cloud: 0x4a5266,
  },
  sanctum: {
    skyTop: 0x070418, skyMid: 0x1d0f45, skyBottom: 0x47206e,
    far: 0x2a1a52, mid: 0x231544, near: 0x170d31, haze: 0xb07cff,
    soil: 0xd8d2e6, soilDark: 0xa79fbf, soilLight: 0xf2eef9, pebble: 0xc9b6ff,
    lip: 0xeae6f4, lipLight: 0xffffff, lipDark: 0xb7aecb,
    body: 0xdcd6ea, bodyDark: 0xa49cbc, bodyLight: 0xf7f4fc,
    wall: 0xcfc7df, wallDark: 0x968db0, wallLight: 0xf0ecf8,
    accent: 0xffcf4a, cloud: 0x7a4fd0,
  },
};

/** Texture keys for a theme's (or a WorldLook's) terrain + backdrop. */
export const TK = {
  soil: (t: string) => `w_${t}_soil`,
  lip: (t: string) => `w_${t}_lip`,
  plat: (t: string) => `w_${t}_plat`,
  platL: (t: string) => `w_${t}_platL`,
  platR: (t: string) => `w_${t}_platR`,
  wall: (t: string) => `w_${t}_wall`,
  sky: (t: string) => `w_${t}_sky`,
  far: (t: string) => `w_${t}_far`,
  mid: (t: string) => `w_${t}_mid`,
  near: (t: string) => `w_${t}_near`,
  clouds: (t: string) => `w_${t}_clouds`,
} as const;

/** Geometry of the terrain textures (shared by painter and loader). */
export const TERRAIN = {
  lipH: 64, lipSurface: 20,      // lip texture: 128×64, walking surface at row 20
  platH: 32, platSurface: 8,     // one-way platform: 64×32 (mid) and 32×32 caps, surface at row 8
  capW: 32, capOverhang: 6,
  soilTile: 128, wallTile: 64,
  layerW: 1024, layerH: 512,
} as const;
