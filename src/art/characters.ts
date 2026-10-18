// OWNER: A10 (art-audio). Procedural chibi mage characters: player sheets per job, NPC sheets, portraits.
//
// Sheet layout (every frame 64×80, feet at y=78, horizontally centered, facing RIGHT):
//   0-3 idle · 4-7 walk · 8 jump · 9 fall · 10-11 climb (back view) · 12 prone · 13-15 cast · 16 hit · 17 dead (ghost)
// Frame names are the numeric indices above. Anim keys: `${playerTextureKey(job)}_${anim}`.
import Phaser from 'phaser';
import type { CharacterLook, JobId } from '../core/types';
import { PLAYER_FRAME } from '../core/constants';
import { Registry } from '../core/registry';
import { hashStr, makeCanvas, seeded, luminance } from './char/color';
import { DEFAULT_EXTRAS, drawCharacter, drawGhost, drawProne, pose, HEAD_X, HEAD_Y, type Extras, type HairStyle } from './char/rig';
import { FRAME_LAYOUT, NPC_IDLE, PLAYER_ANIMS, type FrameDef } from './char/poses';

export type PlayerAnim = 'idle' | 'walk' | 'jump' | 'fall' | 'climb' | 'prone' | 'cast' | 'hit' | 'dead';

export { FRAME_LAYOUT };

const FW = PLAYER_FRAME.w, FH = PLAYER_FRAME.h;
const FEET_Y = 78;

export const DEFAULT_LOOK: CharacterLook = {
  robe: 0x4a5bd4, robeTrim: 0xe8d36a, hat: 0x3a47a8, hatTrim: 0xe8d36a,
  hair: 0x5a3a22, skin: 0xffd9b8, staffGem: 0x9be7ff, hatStyle: 'pointed',
};

function safeLook(look: Partial<CharacterLook> | undefined | null): CharacterLook {
  const l = { ...DEFAULT_LOOK, ...(look ?? {}) } as CharacterLook;
  if (!['none', 'hood', 'pointed', 'circlet', 'crown'].includes(l.hatStyle)) l.hatStyle = 'pointed';
  return l;
}

function paintFrame(ctx: CanvasRenderingContext2D, look: CharacterLook, ex: Extras, f: FrameDef) {
  if (f.kind === 'prone') drawProne(ctx, look, ex, f.pose);
  else if (f.kind === 'ghost') drawGhost(ctx, look, ex, f.pose);
  else drawCharacter(ctx, look, ex, f.pose);
}

/** Paints frames side by side into one canvas. */
function bakeCanvas(look: CharacterLook, ex: Extras, frames: FrameDef[]): HTMLCanvasElement | null {
  const c = makeCanvas(FW * frames.length, FH);
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return null;
  frames.forEach((f, i) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(i * FW, 0, FW, FH); ctx.clip();
    ctx.translate(i * FW + FW / 2, FEET_Y);
    try { paintFrame(ctx, look, ex, f); } catch (e) { console.warn('[characters] frame paint failed', e); }
    ctx.restore();
  });
  return c;
}

/** Registers the canvas as a texture with numeric frames 0..n-1. */
function addSheet(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, n: number): boolean {
  const tex = scene.textures.addCanvas(key, canvas);
  if (!tex) return false;
  for (let i = 0; i < n; i++) tex.add(i, 0, i * FW, 0, FW, FH);
  return true;
}

function lookOfJob(job: JobId): CharacterLook {
  try { return safeLook(Registry.job(job)?.look); } catch { return DEFAULT_LOOK; }
}

// ───────────────────────────── player ─────────────────────────────

export function playerTextureKey(job: JobId): string { return `player_${job}`; }
export function playerAnimKey(job: JobId, anim: PlayerAnim): string { return `${playerTextureKey(job)}_${anim}`; }

function createPlayerAnims(scene: Phaser.Scene, job: JobId) {
  const key = playerTextureKey(job);
  for (const a of PLAYER_ANIMS) {
    const ak = `${key}_${a.anim}`;
    if (scene.anims.exists(ak)) continue;
    const cfg: Phaser.Types.Animations.Animation = {
      key: ak,
      frames: FRAME_LAYOUT[a.anim].map(frame => ({ key, frame })),
      repeat: a.repeat,
    };
    if (a.duration) cfg.duration = a.duration; else cfg.frameRate = a.frameRate ?? 8;
    scene.anims.create(cfg);
  }
}

/**
 * Generates (if missing) the sheet + all animations for one job, from `Registry.job(job).look`
 * (falls back to a default look). Safe to call any time; returns the texture key.
 */
export function ensurePlayerTexture(scene: Phaser.Scene, job: JobId): string {
  const key = playerTextureKey(job);
  try {
    if (!scene.textures.exists(key)) {
      const frames = PLAYER_ANIMS.flatMap(a => a.frames);
      const canvas = bakeCanvas(lookOfJob(job), DEFAULT_EXTRAS, frames);
      if (canvas) addSheet(scene, key, canvas, frames.length);
    }
    if (scene.textures.exists(key)) createPlayerAnims(scene, job);
  } catch (e) { console.warn(`[characters] player texture for ${job} failed`, e); }
  return key;
}

/** Generates a spritesheet + animations for every job's look. Anim key = `${playerTextureKey(job)}_${anim}`. */
export function generateCharacterTextures(scene: Phaser.Scene): void {
  let jobs: JobId[] = [];
  try { jobs = Registry.jobs().map(j => j.id); } catch (e) { console.warn('[characters] Registry.jobs failed', e); }
  if (!jobs.includes('apprentice')) jobs.unshift('apprentice');
  for (const j of jobs) ensurePlayerTexture(scene, j);
}

// ───────────────────────────── NPCs ─────────────────────────────

const HAIR_STYLES: HairStyle[] = ['tuft', 'bob', 'long', 'ponytail', 'spiky'];

/** Deterministic per-NPC variations (hair style, beard, glasses) seeded by id. */
export function npcExtras(npcId: string, look: CharacterLook): Extras {
  const r = seeded(hashStr(npcId));
  const elderly = /elder|sage|old|archmage|grand/i.test(npcId) || (luminance(look.hair) > 0.72);
  let hairStyle = HAIR_STYLES[Math.floor(r() * HAIR_STYLES.length)] ?? 'tuft';
  const beardRoll = r(), glassesRoll = r(), longRoll = r();
  const beard = elderly ? beardRoll < 0.85 : beardRoll < 0.22;
  if (elderly && r() < 0.35) hairStyle = 'bald';
  return {
    hairStyle,
    beard: beard ? look.hair : null,
    beardLong: beard && (elderly || longRoll < 0.4),
    glasses: glassesRoll < (elderly ? 0.45 : 0.18),
  };
}

/** Lazily generates an NPC sheet (idle anim `${key}_idle`) for a look; returns the texture key. */
export function npcTextureKey(scene: Phaser.Scene, npcId: string, look: CharacterLook): string {
  const key = `npc_${npcId}`;
  try {
    const L = safeLook(look);
    if (!scene.textures.exists(key)) {
      const canvas = bakeCanvas(L, npcExtras(npcId, L), NPC_IDLE);
      if (canvas) addSheet(scene, key, canvas, NPC_IDLE.length);
    }
    const ak = `${key}_idle`;
    if (scene.textures.exists(key) && !scene.anims.exists(ak)) {
      scene.anims.create({ key: ak, frames: NPC_IDLE.map((_, frame) => ({ key, frame })), frameRate: 3, repeat: -1 });
    }
  } catch (e) { console.warn(`[characters] npc texture ${npcId} failed`, e); }
  return key;
}

// ───────────────────────────── portraits / previews ─────────────────────────────

const portraitCache = new Map<string, string>();

/**
 * Data URL portrait (head & shoulders, transparent background, facing right) for dialog windows.
 * `seed` (optional, e.g. the npcId) applies the same beard/glasses/hair variations as the NPC sprite.
 */
export function portraitDataUrl(look: CharacterLook, size = 96, seed?: string): string {
  const L = safeLook(look);
  const S = Math.max(16, Math.round(size));
  const ck = `${JSON.stringify(L)}|${S}|${seed ?? ''}`;
  const hit = portraitCache.get(ck);
  if (hit) return hit;
  const c = makeCanvas(S, S);
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return '';
  try {
    const ex = seed ? npcExtras(seed, L) : DEFAULT_EXTRAS;
    const tall = L.hatStyle === 'pointed';
    const k = S / (tall ? 58 : L.hatStyle === 'crown' ? 50 : 44);
    const headX = S / 2 - k * 1.5;
    const headY = S - k * (tall ? 20 : 19);
    ctx.translate(headX - HEAD_X * k, headY - HEAD_Y * k);
    ctx.scale(k, k);
    drawCharacter(ctx, L, ex, pose({ hand: [12, -17], staffAngle: 0.15, gem: 0.9, showStaff: false, backHand: [-8, -14] }));
    const url = c.toDataURL('image/png');
    portraitCache.set(ck, url);
    return url;
  } catch (e) {
    console.warn('[characters] portrait failed', e);
    return '';
  }
}

const previewCache = new Map<string, string>();

/** Full-body single-frame preview (data URL, frame-sized × scale) — handy for UI character cards. */
export function characterDataUrl(look: CharacterLook, anim: PlayerAnim = 'idle', frame = 0, scale = 1, seed?: string): string {
  const L = safeLook(look);
  const ck = `${JSON.stringify(L)}|${anim}|${frame}|${scale}|${seed ?? ''}`;
  const hit = previewCache.get(ck);
  if (hit) return hit;
  const def = PLAYER_ANIMS.find(a => a.anim === anim) ?? PLAYER_ANIMS[0];
  const f = def.frames[Math.max(0, Math.min(def.frames.length - 1, frame))];
  const c = makeCanvas(FW * scale, FH * scale);
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return '';
  ctx.scale(scale, scale);
  ctx.translate(FW / 2, FEET_Y);
  try { paintFrame(ctx, L, seed ? npcExtras(seed, L) : DEFAULT_EXTRAS, f); } catch { return ''; }
  const url = c.toDataURL('image/png');
  previewCache.set(ck, url);
  return url;
}

/** Convenience: preview of a job's look. */
export function jobPreviewDataUrl(job: JobId, scale = 1): string {
  return characterDataUrl(lookOfJob(job), 'idle', 0, scale);
}
