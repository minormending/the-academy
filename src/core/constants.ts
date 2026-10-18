/** Shared constants. Owned by the lead — do not edit. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const GRAVITY = 1500;

export const SCENES = { BOOT: 'Boot', TITLE: 'Title', GAME: 'Game' } as const;

export const DEPTH = {
  SKY: -1000, PARALLAX_FAR: -900, PARALLAX_MID: -800, PARALLAX_NEAR: -700,
  TERRAIN: 0, DECOR: 5, ROPE: 6, PORTAL: 7, NPC: 8, DROP: 9,
  MONSTER: 10, PLAYER: 20, SUMMON: 22, VFX: 30, VFX_TOP: 35, DAMAGE_TEXT: 50, NAMETAG: 45,
} as const;

/** Player sprite frame size (px). Feet at the bottom-center of the frame. */
export const PLAYER_FRAME = { w: 64, h: 80 } as const;
/** Player physics hitbox (px), bottom-aligned & horizontally centered in the frame. */
export const PLAYER_HITBOX = { w: 26, h: 58 } as const;

export const MAX_LEVEL = 50;
export const JOB_LEVELS = { 1: 1, 2: 10, 3: 25, 4: 40 } as const;

/** Hotbar key bindings (index = slot). Phaser KeyCodes names. */
export const HOTBAR_KEYS = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F', 'G', 'ONE', 'TWO'] as const;
export const HOTBAR_LABELS = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F', 'G', '1', '2'] as const;

/** Window toggle keys handled by the UI (A8). */
export const UI_KEYS = { skills: 'K', inventory: 'I', stats: 'P', quests: 'J', minimap: 'M', menu: 'ESC' } as const;

/** Gameplay keys (A1 player + GameScene). */
export const CONTROL_KEYS = { jump: ['SPACE', 'ALT'], pickup: 'Z', interact: 'UP' } as const;

export const SAVE_KEY = 'arcana-story-save-v1';
export const START_MAP = 'mistvale';
export const TOWN_MAP = 'mistvale';

/** Pixel-art pivot: every source pixel is drawn as PIXEL_SCALE×PIXEL_SCALE screen pixels (integer scaling only). */
export const PIXEL_SCALE = 2;
