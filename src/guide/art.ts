// Pictures for the handbook, made by the game's own painters from the game's own PNGs — without Phaser.
//
// - Icons: `iconDataUrl` (src/art/icons.ts) paints from the 7Soul1 sheet once it has loaded.
// - Students, professors and graduates: `jobPreviewDataUrl` / `characterDataUrl` / `portraitDataUrl`
//   (src/art/characters.ts) once we hand the Pointy Hat / Purple Mage sheets to `registerPixelSheetData`.
// - Monsters: `paintPixelMonsterSheet` (src/art/monsterArt.ts) reads its source sheets through a tiny stand-in for
//   Phaser's texture manager backed by images we load ourselves; `paintMonsterSheet` is the procedural fallback,
//   exactly as `ensureMonsterTexture` does in the game.

import type Phaser from 'phaser';
import type { BadgeDef, IconSpec, JobId } from '../core/types';
import { assetUrl } from '../art/assets';
import { badgeDataUrl } from '../art/badges';
import { iconDataUrl, onPixelIconsReady } from '../art/icons';
import { characterDataUrl, jobPreviewDataUrl, portraitDataUrl } from '../art/characters';
import { registerPixelSheetData, type BaseId } from '../art/char/pixel';
import { CHARACTER_ASSETS } from '../art/manifests/characters';
import { MONSTER_ASSETS } from '../art/manifests/monsters';
import { paintMonsterSheet, paintPixelMonsterSheet, type MonsterSheet } from '../art/monsterArt';
import { Registry } from '../core/registry';
import { h } from './dom';

/** Load an image from public/ (base-aware). Resolves null on failure. */
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

const worldCache = new Map<string, Promise<HTMLImageElement | null>>();
/** A world PNG (path relative to public/assets), cached. */
export function assetImage(path: string): Promise<HTMLImageElement | null> {
  let p = worldCache.get(path);
  if (!p) { p = loadImage(assetUrl(path)); worldCache.set(path, p); }
  return p;
}

/** URL of a file under public/guide/ (screenshots). */
export const guideAsset = (path: string) => `${import.meta.env.BASE_URL}guide/${path}`;

const monsterSources = new Map<string, HTMLImageElement>();

async function loadCharacterSheets() {
  await Promise.all(CHARACTER_ASSETS.map(async a => {
    const m = /^src_char_(witch|sage)_(\w+)$/.exec(a.key);
    if (!m) return;
    const img = await loadImage(assetUrl(a.path));
    if (!img) return;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    registerPixelSheetData(m[1] as BaseId, m[2], ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
  }));
}

async function loadMonsterSheets() {
  await Promise.all(MONSTER_ASSETS.map(async a => {
    const img = await loadImage(assetUrl(a.path));
    if (img) monsterSources.set(a.key, img);
  }));
}

function iconsReady(timeoutMs = 5000): Promise<void> {
  return new Promise(res => {
    const t = setTimeout(res, timeoutMs);
    onPixelIconsReady(() => { clearTimeout(t); res(); });
  });
}

/** Everything the painters need, loaded in parallel. Fonts too, so pixel headings don't flash. */
export async function initArt(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  await Promise.all([
    iconsReady(),
    loadCharacterSheets(),
    loadMonsterSheets(),
    fonts ? Promise.all([fonts.load('16px "Kenney Pixel"'), fonts.load('16px "Kenney Mini"')]).catch(() => undefined) : undefined,
  ]);
}

// ─────────────────────────── icons ───────────────────────────

export function iconImg(spec: IconSpec | undefined, size = 32, alt = ''): HTMLElement {
  const url = spec ? iconDataUrl(spec, 32) : '';
  if (!url) return h('span.icon.px-missing', { style: `width:${size}px;height:${size}px`, 'aria-hidden': 'true' });
  return h('img.icon.px', { src: url, width: size, height: size, alt, loading: 'lazy', decoding: 'async' });
}

/** A class badge, drawn by the game's own badge painter. */
export function badgeImg(badge: BadgeDef, size = 32): HTMLElement {
  const url = badgeDataUrl(badge, size);
  if (!url) return h('span.icon.px-missing', { style: `width:${size}px;height:${size}px`, 'aria-hidden': 'true' });
  return h('img.icon.px.badge-img', { src: url, width: size, height: size, alt: badge.name, title: badge.name });
}

// ─────────────────────────── characters ───────────────────────────

export function jobImg(job: JobId, scale = 2, alt = ''): HTMLElement {
  const url = jobPreviewDataUrl(job, scale);
  return url ? h('img.px.char', { src: url, alt: alt || Registry.job(job)?.name || job, width: 80 * scale, height: 80 * scale })
    : h('span.px-missing.char', { style: `width:${80 * scale}px;height:${80 * scale}px` });
}

export function npcImg(npcId: string, scale = 2): HTMLElement {
  const n = Registry.npc(npcId);
  const url = n ? characterDataUrl(n.look, 'idle', 0, scale, npcId) : '';
  return url ? h('img.px.char', { src: url, alt: n?.name ?? npcId, width: 80 * scale, height: 80 * scale })
    : h('span.px-missing.char', { style: `width:${80 * scale}px;height:${80 * scale}px` });
}

export function portraitImg(npcId: string, size = 64): HTMLElement {
  const n = Registry.npc(npcId);
  const url = n ? portraitDataUrl(n.look, size, npcId) : '';
  return url ? h('img.px.portrait', { src: url, alt: n?.name ?? npcId, width: size, height: size })
    : h('span.px-missing.portrait', { style: `width:${size}px;height:${size}px` });
}

/** A raw portrait canvas source (for map pictures). */
export function npcCanvasUrl(npcId: string, scale = 1): string {
  const n = Registry.npc(npcId);
  return n ? characterDataUrl(n.look, 'idle', 0, scale, npcId) : '';
}

// ─────────────────────────── monsters ───────────────────────────

/** Phaser's texture manager, as far as the pixel monster painter uses it (`sourceImage`). */
const textureShim = {
  textures: {
    exists: (k: string) => monsterSources.has(k),
    get: (k: string) => ({ getSourceImage: () => monsterSources.get(k) }),
  },
} as unknown as Phaser.Scene;

const sheetCache = new Map<string, MonsterSheet | null>();
function sheetOf(id: string): MonsterSheet | null {
  if (sheetCache.has(id)) return sheetCache.get(id)!;
  let sheet: MonsterSheet | null = null;
  try { sheet = paintPixelMonsterSheet(textureShim, id); } catch (e) { console.warn(`[guide] pixel sheet for ${id} failed`, e); }
  if (!sheet) { try { sheet = paintMonsterSheet(id); } catch { sheet = null; } }
  sheetCache.set(id, sheet);
  return sheet;
}

/** Opaque bounds of a canvas region. */
function trimBox(c: CanvasRenderingContext2D, x: number, y: number, w: number, hgt: number) {
  const d = c.getImageData(x, y, w, hgt).data;
  let x0 = w, y0 = hgt, x1 = -1, y1 = -1;
  for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) {
    if (d[(j * w + i) * 4 + 3] > 16) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  }
  return x1 < 0 ? null : { x: x + x0, y: y + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const frameCache = new Map<string, HTMLCanvasElement | null>();
/** One frame of a monster (default: its first idle frame), trimmed to the art. Integer-scaled as in the game. */
export function monsterFrame(id: string, anim: 'idle' | 'move' | 'attack' = 'idle', i = 0): HTMLCanvasElement | null {
  const key = `${id}|${anim}|${i}`;
  if (frameCache.has(key)) return frameCache.get(key)!;
  const sheet = sheetOf(id);
  const f = sheet?.frames.find(x => x.name === `${anim}_${i}`) ?? sheet?.frames.find(x => x.name === 'idle_0') ?? sheet?.frames[0];
  let out: HTMLCanvasElement | null = null;
  if (sheet && f) {
    const sctx = sheet.canvas.getContext('2d', { willReadFrequently: true });
    const box = sctx ? trimBox(sctx, f.x, f.y, f.w, f.h) : null;
    if (box) {
      out = document.createElement('canvas');
      out.width = box.w; out.height = box.h;
      out.getContext('2d')!.drawImage(sheet.canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    }
  }
  frameCache.set(key, out);
  return out;
}

const urlCache = new Map<string, string>();
export function monsterUrl(id: string, anim: 'idle' | 'move' | 'attack' = 'idle'): string {
  const key = `${id}|${anim}`;
  if (urlCache.has(key)) return urlCache.get(key)!;
  const c = monsterFrame(id, anim);
  const url = c ? c.toDataURL('image/png') : '';
  urlCache.set(key, url);
  return url;
}

/** A monster sprite. `fit` caps the box (CSS px) while keeping integer-looking pixels where possible. */
export function monsterImg(id: string, fit = 96, anim: 'idle' | 'move' | 'attack' = 'idle'): HTMLElement {
  const c = monsterFrame(id, anim);
  const url = monsterUrl(id, anim);
  const name = Registry.monster(id)?.name ?? id;
  if (!c || !url) return h('span.px-missing.mon', { style: `width:${fit}px;height:${fit}px`, 'aria-hidden': 'true' });
  const k = Math.min(1, fit / Math.max(c.width, c.height));
  // Shrink by whole halves where we can so the pixels stay even.
  const s = k >= 1 ? 1 : k >= 0.5 ? 0.5 : k;
  return h('img.px.mon', { src: url, alt: name, width: Math.round(c.width * s), height: Math.round(c.height * s), loading: 'lazy', decoding: 'async' });
}
