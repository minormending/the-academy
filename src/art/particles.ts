// OWNER: PX4 (pixel VFX; formerly A10). Shared white particle textures, the pixel sprite-sheet VFX kit and
// the common VFX (levelup, job_advance, respawn, hit_generic, pickup_sparkle).
//
// 16-bit pivot:
//  • `px_*` / `fx_*` textures are hard-edged low-res shapes painted on a 2px/4px grid with stepped alpha
//    (still white, so they tint). Keys and sizes are unchanged.
//  • `PX_SHEETS` lists the animated pixel sprite sheets loaded from public/assets/vfx (see manifests/vfx.ts and
//    CREDITS.md). `generateParticleTextures` slices them into frames, builds per-element palette-swapped variants
//    (`pxs_<id>[_<variant>]`) and one Phaser anim per sheet/variant (`pxa_<id>[_<variant>]`).
//  • `pxFx()` plays a sheet as a one-shot (self-destroys on ANIMATION_COMPLETE) or looping sprite; it returns null
//    when the source image failed to load, so every caller keeps its procedural fallback.
//  • `pixelizeCanvas()` turns any smooth canvas texture into chunky stepped-alpha pixels; the tree texture
//    generators run every procedural texture through it.
import Phaser from 'phaser';
import type { VfxOptions } from '../core/types';
import { DEPTH, PIXEL_SCALE } from '../core/constants';
import { registerVfx } from '../core/vfx';
import { timed } from './perf';

type Ctx = CanvasRenderingContext2D;

// ───────────────────────────── pixel helpers ─────────────────────────────

function newCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export interface PixelizeOpts {
  /** Alpha quantisation steps (default 4 → 0.25/0.5/0.75/1). */
  steps?: number;
  /** Blocks whose mean alpha is below this become fully transparent (default 0.08). */
  cutoff?: number;
  /** Posterise each colour channel to this many levels (0 = keep the block's mean colour). */
  posterize?: number;
  /** Treat any block above cutoff as fully opaque (hard silhouettes for runes/circles). */
  hard?: boolean;
}

/**
 * Re-paint a canvas as `cell`×`cell` blocks with stepped alpha (and optionally posterised colour).
 * This is what makes the remaining procedural textures read as chunky 16-bit pixels.
 */
export function pixelizeCanvas(c: HTMLCanvasElement | null | undefined, cell: number, o: PixelizeOpts = {}): void {
  if (!c || cell < 1) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const w = c.width, h = c.height;
  let img: ImageData;
  try { img = ctx.getImageData(0, 0, w, h); } catch { return; }
  const d = img.data;
  const steps = o.steps ?? 4, cutoff = o.cutoff ?? 0.08, post = o.posterize ?? 0;
  for (let by = 0; by < h; by += cell) {
    for (let bx = 0; bx < w; bx += cell) {
      let sa = 0, sr = 0, sg = 0, sb = 0, n = 0;
      const ex = Math.min(w, bx + cell), ey = Math.min(h, by + cell);
      for (let y = by; y < ey; y++) {
        for (let x = bx; x < ex; x++) {
          const i = (y * w + x) * 4, a = d[i + 3];
          sa += a; sr += d[i] * a; sg += d[i + 1] * a; sb += d[i + 2] * a; n++;
        }
      }
      let a = sa / (n * 255);
      let r = 0, g = 0, b = 0;
      if (a < cutoff) a = 0;
      else {
        a = o.hard ? 1 : Math.max(1 / steps, Math.round(a * steps) / steps);
        r = sr / sa; g = sg / sa; b = sb / sa;
        if (post > 1) {
          const q = 255 / (post - 1);
          r = Math.round(r / q) * q; g = Math.round(g / q) * q; b = Math.round(b / q) * q;
        }
      }
      const A = Math.round(a * 255);
      for (let y = by; y < ey; y++) {
        for (let x = bx; x < ex; x++) {
          const i = (y * w + x) * 4;
          d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = A;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Default pixel cell for a procedural texture of this size (small → 2px, medium → 4px, big → 8px). */
export function autoCell(w: number, h: number): number {
  const m = Math.min(w, h);
  return m <= 24 ? 2 : m <= 100 ? 4 : 8;
}

/** Pixelize a Phaser CanvasTexture in place and re-upload it. */
export function pixelizeTexture(tex: Phaser.Textures.CanvasTexture | null | undefined, cell?: number, o: PixelizeOpts = {}): void {
  if (!tex) return;
  try {
    pixelizeCanvas(tex.getSourceImage() as HTMLCanvasElement, cell ?? autoCell(tex.width, tex.height), o);
    tex.refresh();
  } catch { /* keep the smooth texture */ }
}

/** Paint a white texture from a grid function: fn(gx, gy) → alpha 0..1 (or [alpha, grey 0..255]). */
function gridTex(scene: Phaser.Scene, key: string, w: number, h: number, cell: number,
  fn: (gx: number, gy: number, gw: number, gh: number) => number | [number, number]): void {
  if (scene.textures.exists(key)) return;
  const c = newCanvas(w, h);
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return;
  const gw = Math.floor(w / cell), gh = Math.floor(h / cell);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const v = fn(gx, gy, gw, gh);
      const [a, grey] = Array.isArray(v) ? v : [v, 255];
      if (a <= 0) continue;
      ctx.fillStyle = `rgba(${grey},${grey},${grey},${Math.min(1, a)})`;
      ctx.fillRect(gx * cell, gy * cell, cell, cell);
    }
  }
  try { scene.textures.addCanvas(key, c); } catch (e) { console.warn(`[particles] ${key} failed`, e); }
}

/** Smooth-draw then pixelize (for shapes that are easier to stroke than to grid). */
function addTex(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void, cell = 2, o: PixelizeOpts = {}) {
  if (scene.textures.exists(key)) return;
  const c = newCanvas(w, h);
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return;
  try { paint(ctx); pixelizeCanvas(c, cell, o); scene.textures.addCanvas(key, c); } catch (e) { console.warn(`[particles] ${key} failed`, e); }
}

/** Stepped falloff: 1 inside r0, then the given alpha bands. */
const band = (dist: number, edges: [number, number][]): number => {
  for (const [r, a] of edges) if (dist <= r) return a;
  return 0;
};

// ───────────────────────────── palettes / recolour ─────────────────────────────

/** Stepped element palettes (dark → light). Used to palette-swap pixel sheets by luminance. */
export const RAMPS = {
  fire: [0x4a0c06, 0x8f1a0a, 0xd93512, 0xff7a1a, 0xffb830, 0xffe27a, 0xfff6d8],
  ice: [0x0c2456, 0x1c55a8, 0x3a9ae6, 0x7fd6ff, 0xc2f0ff, 0xffffff],
  ltn: [0x220c58, 0x4f22c4, 0x9b5cff, 0xd6b4ff, 0xffe94d, 0xfffbe8],
  arcane: [0x1e0f5c, 0x4a1fc4, 0x8f55ff, 0x5ee0ff, 0xb8f6ff, 0xffffff],
  gold: [0x6a3a00, 0xb57a0c, 0xffc933, 0xffe066, 0xfff3b0, 0xffffff],
  white: [0x5c5c5c, 0x9a9a9a, 0xcfcfcf, 0xf0f0f0, 0xffffff],
} as const;
export type RampName = keyof typeof RAMPS;

/**
 * Palette-swap by luminance rank: every distinct brightness level of the source is mapped to the ramp entry at
 * its percentile, so mostly-white sources (nebula, rings, slashes) still spread over the element's colours
 * instead of collapsing to the ramp's white end. Alpha is preserved.
 */
function recolorCanvas(src: CanvasImageSource, w: number, h: number, ramp: readonly number[]): HTMLCanvasElement | null {
  const c = newCanvas(w, h);
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return null;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const lum = (i: number) => Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  const hist = new Array<number>(256).fill(0);
  let total = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 8) { hist[lum(i)]++; total++; }
  if (!total) return c;
  const map = new Array<number>(256).fill(ramp[0]);
  let below = 0;
  for (let l = 0; l < 256; l++) {
    if (!hist[l]) continue;
    const rank = (below + hist[l] / 2) / total;
    map[l] = ramp[Math.min(ramp.length - 1, Math.floor(rank * ramp.length))];
    below += hist[l];
  }
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const col = map[lum(i)];
    d[i] = (col >> 16) & 255; d[i + 1] = (col >> 8) & 255; d[i + 2] = col & 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ───────────────────────────── sprite-sheet registry ─────────────────────────────

type Rect = [number, number, number, number];
interface SheetDef {
  /** Manifest key suffix (texture `src_vfx_<src>`). */
  src: string;
  /** Strip layout (frames left→right) … */
  fw?: number; fh?: number; n?: number;
  /** … or explicit frame rectangles (Emcee Flesher sheet). */
  rects?: Rect[];
  fps: number;
  /** Palette-swapped variants to pre-build. */
  v?: RampName[];
}

const tiles = (...cr: [number, number][]): Rect[] => cr.map(([c, r]) => [c * 16, r * 16, 16, 16]);

/** Every pixel sheet the VFX use. Ids are referenced by pxFx(scene, id, …). */
export const PX_SHEETS: Record<string, SheetDef> = {
  // CodeManu — Free Pixel Effects Pack (CC0); 100px frames trimmed to content
  cm_flamelash: { src: 'cm_flamelash', fw: 46, fh: 44, n: 15, fps: 30 },
  cm_firespin: { src: 'cm_firespin', fw: 42, fh: 40, n: 16, fps: 22 },
  cm_shield: { src: 'cm_shield', fw: 36, fh: 36, n: 16, fps: 16, v: ['arcane', 'ice', 'ltn'] },
  cm_brightfire: { src: 'cm_brightfire', fw: 18, fh: 34, n: 12, fps: 16 },
  cm_ring: { src: 'cm_ring', fw: 38, fh: 38, n: 10, fps: 30, v: ['gold', 'ice', 'fire', 'ltn', 'arcane'] },
  cm_fire: { src: 'cm_fire', fw: 28, fh: 54, n: 12, fps: 18 },
  cm_nebula: { src: 'cm_nebula', fw: 78, fh: 80, n: 14, fps: 24, v: ['ice', 'arcane', 'gold'] },
  cm_vortex: { src: 'cm_vortex', fw: 76, fh: 76, n: 14, fps: 24, v: ['ltn'] },
  cm_sunburn: { src: 'cm_sunburn', fw: 64, fh: 56, n: 12, fps: 18 },
  cm_midnight: { src: 'cm_midnight', fw: 58, fh: 58, n: 14, fps: 22, v: ['arcane'] },
  cm_freezing: { src: 'cm_freezing', fw: 82, fh: 80, n: 18, fps: 16 },
  // ansimuz — Gothicvania Magic Pack 9 / Animated Explosions (CC0)
  g9_lightning: { src: 'g9_lightning', fw: 56, fh: 126, n: 10, fps: 20, v: ['ltn'] },
  g9_darkbolt: { src: 'g9_darkbolt', fw: 88, fh: 84, n: 8, fps: 16 },
  g9_firebomb: { src: 'g9_firebomb', fw: 58, fh: 48, n: 7, fps: 16, v: ['ice'] },
  g9_spark: { src: 'g9_spark', fw: 30, fh: 30, n: 7, fps: 16, v: ['ltn', 'arcane'] },
  ex1: { src: 'ex1', fw: 30, fh: 30, n: 7, fps: 24 },
  ex2: { src: 'ex2', fw: 62, fh: 64, n: 8, fps: 16 },
  ex3: { src: 'ex3', fw: 126, fh: 80, n: 10, fps: 18 },
  ex4: { src: 'ex4', fw: 126, fh: 124, n: 12, fps: 18 },
  ex6: { src: 'ex6', fw: 46, fh: 42, n: 8, fps: 18 },
  // StarsteelGaming — Spell Effects (CC0)
  ss_fireball: { src: 'ss_fireball', fw: 62, fh: 26, n: 9, fps: 14 },
  ss_icespear: { src: 'ss_icespear', fw: 64, fh: 30, n: 6, fps: 12 },
  ss_thunder: { src: 'ss_thunder', fw: 40, fh: 32, n: 8, fps: 14 },
  // creatures
  phoenix: { src: 'phoenix', fw: 32, fh: 32, n: 6, fps: 10, v: ['ltn'] },
  komodo: { src: 'komodo', fw: 32, fh: 16, n: 8, fps: 8, v: ['fire'] },
  icegolem: { src: 'icegolem', fw: 36, fh: 46, n: 4, fps: 5 },
  icecrystal: { src: 'icecrystal', fw: 32, fh: 32, n: 5, fps: 8, v: ['ice'] },
  // kurohina — spark (CC0), white
  spark: { src: 'spark', fw: 18, fh: 20, n: 9, fps: 30 },
  // Emcee Flesher — 16x16 Simple Fantasy RPG FX (CC0)
  sf_fireball: { src: 'simplefx', rects: tiles([5, 1], [6, 1], [5, 2], [6, 2]), fps: 12, v: ['arcane'] },
  sf_bigfireball: { src: 'simplefx', rects: tiles([13, 1]), fps: 1 },
  sf_flame: { src: 'simplefx', rects: tiles([11, 1], [12, 1]), fps: 8 },
  sf_flame_s: { src: 'simplefx', rects: tiles([9, 1], [10, 1]), fps: 8 },
  sf_boom: { src: 'simplefx', rects: tiles([14, 1], [15, 1], [0, 5]), fps: 14 },
  sf_orb_b: { src: 'simplefx', rects: tiles([7, 2], [8, 2]), fps: 8 },
  sf_snow: { src: 'simplefx', rects: tiles([7, 2], [8, 2], [9, 2], [10, 2]), fps: 14 },
  sf_ring: { src: 'simplefx', rects: tiles([7, 3], [8, 3], [9, 3], [10, 3], [11, 3]), fps: 16, v: ['arcane'] },
  sf_heal: { src: 'simplefx', rects: tiles([0, 0], [1, 0], [2, 0], [3, 0], [4, 0]), fps: 14, v: ['gold', 'arcane'] },
  sf_shatter: { src: 'simplefx', rects: tiles([1, 5], [2, 5], [3, 5], [4, 5]), fps: 12 },
  sf_tornado: { src: 'simplefx', rects: tiles([1, 1], [2, 1], [3, 1], [4, 1]), fps: 10 },
  sf_star_y: { src: 'simplefx', rects: tiles([12, 0], [13, 0]), fps: 10 },
  sf_star_b: { src: 'simplefx', rects: tiles([14, 4], [15, 4]), fps: 10 },
  sf_shards: { src: 'simplefx', rects: tiles([7, 4], [8, 4], [9, 4], [10, 4], [11, 4]), fps: 14 },
  sf_slash: { src: 'simplefx', rects: [0, 1, 2, 3, 4, 5, 6].map((i): Rect => [i * 32, 100, 32, 32]), fps: 28, v: ['arcane'] },
};

const texKey = (id: string, v?: string) => (v ? `pxs_${id}_${v}` : `pxs_${id}`);
const animKey = (id: string, v?: string) => (v ? `pxa_${id}_${v}` : `pxa_${id}`);

/**
 * Builds one (id, variant) texture + anim from its loaded source. Sheets are built lazily on first use
 * (`ensureSheet`, called by pxHas / pxFx) so boot doesn't pay for ~70 sheet + palette-swap canvases.
 */
function buildSheet(scene: Phaser.Scene, id: string, d: SheetDef, only?: RampName | null): void {
  const srcKey = `src_vfx_${d.src}`;
  if (!scene.textures.exists(srcKey)) return;
  const srcTex = scene.textures.get(srcKey);
  const src = srcTex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  if (!src || !src.width) return;
  const rects: Rect[] = d.rects ?? Array.from({ length: d.n ?? 1 }, (_, i): Rect => [i * (d.fw ?? 16), 0, d.fw ?? 16, d.fh ?? 16]);
  const variants: (RampName | undefined)[] = only === undefined ? [undefined, ...(d.v ?? [])] : [only ?? undefined];
  for (const v of variants) {
    const tk = texKey(id, v), ak = animKey(id, v);
    if (scene.textures.exists(tk)) continue;
    let canvas: HTMLCanvasElement | null;
    if (v) canvas = recolorCanvas(src, src.width, src.height, RAMPS[v]);
    else {
      canvas = newCanvas(src.width, src.height);
      canvas?.getContext('2d')?.drawImage(src, 0, 0);
    }
    if (!canvas) continue;
    const t = scene.textures.addCanvas(tk, canvas);
    if (!t) continue;
    rects.forEach(([x, y, w, h], i) => t.add(i, 0, x, y, w, h));
    if (!scene.anims.exists(ak)) {
      scene.anims.create({ key: ak, frames: rects.map((_, i) => ({ key: tk, frame: i })), frameRate: d.fps, repeat: 0 });
    }
  }
}

/** Lazily builds the sheet (and the requested palette variant) if it isn't registered yet. */
function ensureSheet(scene: Phaser.Scene, id: string, v?: RampName): void {
  if (scene.textures.exists(texKey(id, v))) return;
  const d = PX_SHEETS[id];
  if (!d || (v && !d.v?.includes(v))) return;
  try { buildSheet(scene, id, d, v ?? null); } catch (e) { console.warn(`[particles] sheet ${id} failed`, e); }
}

/** True if the sheet (and variant) is available. */
export function pxHas(scene: Phaser.Scene, id: string, v?: RampName): boolean {
  ensureSheet(scene, id, v);
  return scene.textures.exists(texKey(id, v)) && scene.anims.exists(animKey(id, v));
}

/** Frame count of a sheet (0 if unknown). */
export function pxFrames(id: string): number {
  const d = PX_SHEETS[id];
  return d ? (d.rects?.length ?? d.n ?? 1) : 0;
}

/** Native frame size of a sheet. */
export function pxSize(id: string): { w: number; h: number } {
  const d = PX_SHEETS[id];
  if (!d) return { w: 16, h: 16 };
  if (d.rects) return { w: d.rects[0][2], h: d.rects[0][3] };
  return { w: d.fw ?? 16, h: d.fh ?? 16 };
}

/** Integer pixel scale (multiple of PIXEL_SCALE, ≥ PIXEL_SCALE) that makes `framePx` roughly `targetPx`. */
export function pxEven(targetPx: number, framePx: number, max = 6): number {
  const k = Math.round(targetPx / Math.max(1, framePx) / PIXEL_SCALE) * PIXEL_SCALE;
  return Phaser.Math.Clamp(k, PIXEL_SCALE, max);
}

export interface PxOpts {
  /** Integer scale (default PIXEL_SCALE). */
  scale?: number;
  depth?: number;
  /** Additive blend (default false — pixel sheets carry their own dark outlines). */
  add?: boolean;
  rot?: number;
  flipX?: boolean;
  flipY?: boolean;
  ox?: number;
  oy?: number;
  alpha?: number;
  tint?: number;
  /** Palette variant. */
  v?: RampName;
  /** Override frame rate, or fit the whole animation into `dur` ms. */
  fps?: number;
  dur?: number;
  delay?: number;
  /** Loop forever (persistent visuals; the caller/engine destroys it). */
  loop?: boolean;
  /** Start a loop on a random frame. */
  randomStart?: boolean;
  /** Fade alpha to 0 over the animation (one-shots). */
  fade?: boolean;
}

/**
 * Play a pixel sheet. One-shots self-destroy on ANIMATION_COMPLETE; loops persist.
 * Returns null when the sheet is missing so callers can fall back to procedural art.
 */
export function pxFx(scene: Phaser.Scene, id: string, x: number, y: number, o: PxOpts = {}): Phaser.GameObjects.Sprite | null {
  const v = o.v && pxHas(scene, id, o.v) ? o.v : undefined;
  const tk = texKey(id, v), ak = animKey(id, v);
  ensureSheet(scene, id, v);
  if (!scene.textures.exists(tk) || !scene.anims.exists(ak)) return null;
  const n = pxFrames(id);
  const s = scene.add.sprite(x, y, tk, 0);
  s.setScale(o.scale ?? PIXEL_SCALE).setDepth(o.depth ?? DEPTH.VFX).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
  if (o.rot) s.setRotation(o.rot);
  if (o.flipX) s.setFlipX(true);
  if (o.flipY) s.setFlipY(true);
  if (o.alpha !== undefined) s.setAlpha(o.alpha);
  if (o.tint !== undefined) s.setTint(o.tint);
  if (o.add) s.setBlendMode(Phaser.BlendModes.ADD);
  const cfg: Phaser.Types.Animations.PlayAnimationConfig = { key: ak };
  if (o.fps) cfg.frameRate = o.fps;
  if (o.dur) cfg.frameRate = Math.max(1, (n * 1000) / o.dur);
  if (o.loop) {
    cfg.repeat = -1;
    if (o.randomStart && n > 1) cfg.startFrame = Math.floor(Math.random() * n);
  } else {
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { if (s.scene) s.destroy(); });
    if (o.fade) {
      const total = o.dur ?? (n * 1000) / (o.fps ?? PX_SHEETS[id]?.fps ?? 12);
      scene.tweens.add({ targets: s, alpha: 0, duration: total, delay: o.delay ?? 0, ease: 'Quad.easeIn' });
    }
  }
  if (o.delay && o.delay > 0) {
    s.setVisible(false);
    scene.time.delayedCall(o.delay, () => { if (s.active) { s.setVisible(true); s.play(cfg); } });
  } else s.play(cfg);
  return s;
}

/** Looping pixel sheet attached to a container (persistent visuals). Returns null if missing. */
export function pxLoop(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, id: string, x: number, y: number, o: PxOpts = {}): Phaser.GameObjects.Sprite | null {
  const s = pxFx(scene, id, x, y, { ...o, loop: true });
  if (s) parent.add(s);
  return s;
}

// ───────────────────────────── textures ─────────────────────────────

const RUNES: ((ctx: Ctx) => void)[] = [
  ctx => { ctx.arc(12, 12, 7, 0, Math.PI * 2); ctx.moveTo(12, 2); ctx.lineTo(12, 22); },
  ctx => { ctx.moveTo(12, 3); ctx.lineTo(21, 19); ctx.lineTo(3, 19); ctx.closePath(); ctx.moveTo(12, 12.5); ctx.arc(12, 13.5, 1, 0, Math.PI * 2); },
  ctx => { ctx.moveTo(7, 3); ctx.lineTo(7, 21); ctx.moveTo(7, 4); ctx.lineTo(16, 8); ctx.lineTo(7, 12); ctx.lineTo(17, 21); },
  ctx => { ctx.moveTo(12, 2); ctx.lineTo(21, 12); ctx.lineTo(12, 22); ctx.lineTo(3, 12); ctx.closePath(); ctx.moveTo(12, 7); ctx.lineTo(12, 17); ctx.moveTo(7, 12); ctx.lineTo(17, 12); },
  ctx => { ctx.moveTo(12, 21); ctx.lineTo(12, 3); ctx.moveTo(5, 10); ctx.lineTo(12, 3); ctx.lineTo(19, 10); ctx.moveTo(7, 15); ctx.lineTo(17, 15); ctx.moveTo(8, 19); ctx.lineTo(16, 19); },
  ctx => { ctx.arc(11, 12, 8, Math.PI * 0.35, Math.PI * 1.65); ctx.moveTo(17, 8); ctx.lineTo(17, 16); ctx.moveTo(13, 12); ctx.lineTo(21, 12); },
];

/** Generates the shared hard-edged white pixel textures and builds every pixel sheet + anim. */
export function generateParticleTextures(scene: Phaser.Scene): void {
  timed('particles', () => generateParticleTexturesImpl(scene));
}
function generateParticleTexturesImpl(scene: Phaser.Scene): void {
  // 8px: 4×4 grid of 2px pixels, rounded square with a bright core
  gridTex(scene, 'px_dot', 8, 8, 2, (x, y) => ((x === 0 || x === 3) && (y === 0 || y === 3) ? 0 : 1));
  // 32px stepped disc on a 4px grid
  gridTex(scene, 'px_soft', 32, 32, 4, (x, y) => band(Math.hypot(x - 3.5, y - 3.5), [[1.2, 1], [2.2, 0.66], [3.2, 0.36], [4.1, 0.14]]));
  // 16×4 streak, 2px pixels: tail fades in steps, head is solid
  gridTex(scene, 'px_spark', 16, 4, 2, (x) => [0.2, 0.32, 0.45, 0.6, 0.75, 0.9, 1, 1][x] ?? 1);
  // 16px 4-point star on a 2px grid
  gridTex(scene, 'px_star', 16, 16, 2, (x, y) => {
    const dx = Math.abs(x - 3.5), dy = Math.abs(y - 3.5);
    if (dx < 1 && dy < 1) return 1;
    if (dx < 1 || dy < 1) return Math.max(dx, dy) < 3 ? 1 : 0.6;
    if (dx < 2 && dy < 2) return 0.5;
    return 0;
  });
  // 32px ring: 2px-thick pixel circle
  gridTex(scene, 'px_ring', 32, 32, 2, (x, y) => {
    const r = Math.hypot(x - 7.5, y - 7.5);
    return r >= 5.6 && r <= 6.9 ? 1 : r > 6.9 && r <= 7.6 ? 0.35 : 0;
  });
  // 32px chunky smoke puff on a 4px grid with two alpha steps
  gridTex(scene, 'px_smoke', 32, 32, 4, (x, y) => {
    const blobs: [number, number, number][] = [[3.8, 4.2, 2.6], [2.4, 3.4, 1.8], [5.4, 3.2, 1.9], [3.2, 5.4, 1.8], [5.2, 5.2, 1.7], [3.9, 2.4, 1.5]];
    let best = 0;
    for (const [bx, by, r] of blobs) {
      const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by) / r;
      best = Math.max(best, d < 0.6 ? 0.55 : d < 1 ? 0.32 : 0);
    }
    return best;
  });
  // 12×20 diamond shard, 2px pixels, lit left face / grey right face
  gridTex(scene, 'px_shard', 12, 20, 2, (x, y) => {
    const half = y <= 4 ? (y + 1) * 0.6 : (10 - y) * 0.6;
    const dx = x - 2.5;
    if (Math.abs(dx) > half) return 0;
    if (x === 1 && y >= 3 && y <= 5) return [1, 255];
    return dx < 0 ? [0.95, 255] : [0.9, 200];
  });
  // 64px stepped glow with a pixel cross (4px grid)
  gridTex(scene, 'px_flare', 64, 64, 4, (x, y) => {
    const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
    const base = band(Math.hypot(dx, dy), [[1.2, 1], [2.3, 0.72], [3.6, 0.42], [5.2, 0.2], [7.6, 0.08]]);
    const cross = (dx < 0.6 && dy < 7) || (dy < 0.6 && dx < 7) ? 0.55 : 0;
    return Math.max(base, cross);
  });
  // 32×128 bottom-anchored light beam: stepped horizontal bands, stepped vertical fade (4px grid)
  gridTex(scene, 'fx_pillar', 32, 128, 4, (x, y, gw, gh) => {
    const h = [0.12, 0.3, 0.55, 1, 1, 0.55, 0.3, 0.12][x] ?? 0;
    const t = y / (gh - 1);
    const v = t < 0.15 ? 0.2 : t < 0.35 ? 0.5 : t < 0.6 ? 0.8 : 1;
    return h * v;
  });
  addTex(scene, 'fx_circle', 128, 128, ctx => {
    ctx.translate(64, 64);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, r0 = 51, r1 = i % 3 === 0 ? 57 : 55;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
    }
    for (const rot of [0, Math.PI]) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = rot - Math.PI / 2 + (i * Math.PI * 2) / 3;
        if (i) ctx.lineTo(Math.cos(a) * 48, Math.sin(a) * 48); else ctx.moveTo(Math.cos(a) * 48, Math.sin(a) * 48);
      }
      ctx.closePath(); ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 36, Math.sin(a) * 36, 4, 0, Math.PI * 2); ctx.stroke();
    }
  }, 2, { hard: true, cutoff: 0.3 });
  RUNES.forEach((draw, i) => addTex(scene, `fx_rune_${i}`, 24, 24, ctx => {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.6; ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
    ctx.beginPath(); draw(ctx); ctx.stroke();
  }, 2, { hard: true, cutoff: 0.3 }));

  // Pixel sprite sheets (+ palette variants + anims) are built lazily on first use: see ensureSheet().
}

// ───────────────────────────── VFX helpers ─────────────────────────────

const ADD = Phaser.BlendModes.ADD;

function img(scene: Phaser.Scene, key: string, x: number, y: number, tint = 0xffffff, depth: number = DEPTH.VFX): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key)) return null;
  return scene.add.image(x, y, key).setTint(tint).setBlendMode(ADD).setDepth(depth);
}

/** Tween then destroy. */
function fx(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject | null, cfg: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>) {
  if (!obj) return;
  scene.tweens.add({ ...cfg, targets: obj, onComplete: () => obj.destroy() });
}

type EmitCfg = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

/** One-shot particle burst that cleans itself up. */
function burst(scene: Phaser.Scene, x: number, y: number, key: string, n: number, life: number, cfg: EmitCfg, depth: number = DEPTH.VFX) {
  if (!scene.textures.exists(key) || n <= 0) return;
  const e = scene.add.particles(x, y, key, { blendMode: 'ADD', lifespan: life, ...cfg, emitting: false });
  e.setDepth(depth);
  e.explode(n);
  scene.time.delayedCall(life + 150, () => e.destroy());
}

/** Continuous emitter that runs for `forMs`, then stops and self-destroys. */
function stream(scene: Phaser.Scene, x: number, y: number, key: string, forMs: number, life: number, cfg: EmitCfg, depth: number = DEPTH.VFX) {
  if (!scene.textures.exists(key)) return;
  const e = scene.add.particles(x, y, key, { blendMode: 'ADD', lifespan: life, ...cfg, emitting: true });
  e.setDepth(depth);
  scene.time.delayedCall(forMs, () => e.stop());
  scene.time.delayedCall(forMs + life + 150, () => e.destroy());
}

/** Expanding ring: the pixel ring sheet when available, else the px_ring texture. */
function ring(scene: Phaser.Scene, x: number, y: number, tint: number, from: number, to: number, dur: number, squash = 1, delay = 0, depth: number = DEPTH.VFX) {
  const r = img(scene, 'px_ring', x, y, tint, depth);
  if (!r) return;
  r.setScale(from, from * squash).setAlpha(delay ? 0 : 1);
  fx(scene, r, { scaleX: to, scaleY: to * squash, alpha: { from: 1, to: 0 }, duration: dur, delay, ease: 'Cubic.easeOut' });
}

function hsv(h: number, s = 0.65, v = 1): number {
  return Phaser.Display.Color.HSVToRGB(((h % 1) + 1) % 1, s, v).color;
}

// ───────────────────────────── common VFX ─────────────────────────────

/** Maple-style golden pillar of pixel light + gold burst + pixel stars (~1.5s). x,y = feet. */
function levelup(scene: Phaser.Scene, o: VfxOptions) {
  const { x, y } = o;
  const gold = 0xffd84a;
  const pillar = img(scene, 'fx_pillar', x, y + 4, gold);
  const core = img(scene, 'fx_pillar', x, y + 4, 0xffffff);
  for (const [p, sx] of [[pillar, 2], [core, 0.5]] as const) {
    if (!p) continue;
    p.setOrigin(0.5, 1).setScale(0.25, 0).setAlpha(1);
    scene.tweens.add({ targets: p, scaleX: sx, scaleY: 1.75, duration: 220, ease: 'Back.easeOut' });
    fx(scene, p, { scaleX: sx * 0.25, alpha: 0, delay: 950, duration: 550, ease: 'Quad.easeIn' });
  }
  const burstSprite = pxFx(scene, 'sf_heal', x, y - 36, { v: 'gold', scale: 4, add: true, dur: 520, alpha: 0.85, depth: DEPTH.VFX_TOP });
  pxFx(scene, 'cm_ring', x, y - 36, { v: 'gold', scale: 4, add: true, depth: DEPTH.VFX_TOP });
  pxFx(scene, 'cm_ring', x, y - 36, { v: 'gold', scale: 2, add: true, delay: 260, depth: DEPTH.VFX_TOP });
  if (!burstSprite) {
    ring(scene, x, y, gold, 0.4, 3.4, 700, 0.32);
    const flare = img(scene, 'px_flare', x, y - 34, 0xfff1b0, DEPTH.VFX_TOP);
    if (flare) { flare.setScale(0.25).setAlpha(0.9); fx(scene, flare, { scale: 2.5, alpha: 0, duration: 520, ease: 'Quad.easeOut' }); }
  }
  stream(scene, x, y - 6, 'px_star', 900, 1100, {
    x: { min: -26, max: 26 }, speedY: { min: -70, max: -190 }, speedX: { min: -14, max: 14 },
    scale: { start: 2, end: 0.5 }, lifespan: { min: 700, max: 1100 },
    frequency: 55, quantity: 1, tint: [0xffe066, 0xffffff, 0xfff3b0, 0xffc93a],
  }, DEPTH.VFX_TOP);
  burst(scene, x, y - 4, 'px_dot', 16, 900, {
    speed: { min: 60, max: 170 }, angle: { min: 200, max: 340 }, gravityY: 220,
    scale: { start: 1, end: 0.5 }, tint: [0xffe066, 0xffffff],
  });
  if (!pxFx(scene, 'sf_star_y', x, y - 180, { scale: 4, add: true, fps: 8, delay: 180, depth: DEPTH.VFX_TOP })) {
    const top = img(scene, 'px_star', x, y - 180, 0xffffff, DEPTH.VFX_TOP);
    if (top) { top.setScale(0).setAlpha(1); fx(scene, top, { scale: 4, alpha: 0, delay: 180, duration: 650, ease: 'Quad.easeOut' }); }
  }
}

/** Bigger, colourful: rainbow pixel pillar, magic circle, spiralling runes, nebula finale (~2.4s). */
function jobAdvance(scene: Phaser.Scene, o: VfxOptions) {
  const { x, y } = o;
  const T = 2200;
  const colors = [0xff6a3d, 0xffd84a, 0x6aff9a, 0x5ac8ff, 0xb57aff, 0xff7ad9];
  // magic circle on the floor
  const circ = img(scene, 'fx_circle', x, y, 0xffffff, DEPTH.PLAYER - 1);
  if (circ) {
    circ.setScale(0, 0).setAlpha(0.95);
    scene.tweens.add({ targets: circ, scaleX: 1, scaleY: 0.34, duration: 350, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: circ, rotation: Math.PI * 2, duration: T + 300 });
    fx(scene, circ, { alpha: 0, delay: T - 300, duration: 600 });
  }
  // rainbow pillar
  const pillar = img(scene, 'fx_pillar', x, y + 4, colors[0]);
  const core = img(scene, 'fx_pillar', x, y + 4, 0xffffff);
  for (const [p, sx] of [[pillar, 2.5], [core, 0.75]] as const) {
    if (!p) continue;
    p.setOrigin(0.5, 1).setScale(0.25, 0);
    scene.tweens.add({ targets: p, scaleX: sx, scaleY: 2, duration: 300, delay: 120, ease: 'Back.easeOut' });
    fx(scene, p, { scaleX: sx * 0.25, alpha: 0, delay: T - 450, duration: 600, ease: 'Quad.easeIn' });
  }
  // spiralling runes (pass behind / in front of the player)
  const N = 10;
  const runes: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < N; i++) {
    const r = img(scene, `fx_rune_${i % 6}`, x, y, colors[i % colors.length]);
    if (r) runes.push(r.setAlpha(0));
  }
  const counter = { t: 0 };
  scene.tweens.add({
    targets: counter, t: 1, duration: T, ease: 'Sine.easeInOut',
    onUpdate: () => {
      const t = counter.t;
      if (pillar && pillar.active) pillar.setTint(hsv(Math.floor(t * 12) / 7.5));
      runes.forEach((r, i) => {
        if (!r.active) return;
        const a = t * Math.PI * 5 + (i / N) * Math.PI * 2;
        const rad = 46 * (1 - t * 0.45);
        const s = Math.sin(a);
        r.setPosition(Math.round(x + Math.cos(a) * rad), Math.round(y - 12 - t * 130 - (i % 2) * 14 + s * 6));
        r.setScale(s > 0 ? 1 : 0.75);
        r.setAlpha(Math.min(1, t * 6, (1 - t) * 5) * (s > 0 ? 1 : 0.6));
        r.setDepth(s > 0 ? DEPTH.VFX_TOP : DEPTH.PLAYER - 1);
      });
    },
    onComplete: () => runes.forEach(r => r.destroy()),
  });
  if (!pxFx(scene, 'cm_ring', x, y - 36, { v: 'gold', scale: 4, add: true, depth: DEPTH.VFX_TOP })) ring(scene, x, y, 0xffffff, 0.4, 4.2, 800, 0.32);
  colors.forEach((c, i) => {
    if (!pxFx(scene, 'cm_ring', x, y - 40, { tint: c, scale: 2 + 2 * (i % 2), add: true, delay: 1700 + i * 60, depth: DEPTH.VFX_TOP })) {
      ring(scene, x, y - 40, c, 0.3, 3 + i * 0.25, 700, 1, 1700 + i * 50, DEPTH.VFX_TOP);
    }
  });
  stream(scene, x, y - 6, 'px_star', T - 400, 1300, {
    x: { min: -34, max: 34 }, speedY: { min: -80, max: -220 }, speedX: { min: -20, max: 20 },
    scale: { start: 2, end: 0.5 }, lifespan: { min: 800, max: 1300 },
    frequency: 45, quantity: 1, tint: colors,
  }, DEPTH.VFX_TOP);
  // finale burst
  scene.time.delayedCall(1750, () => {
    if (!pxFx(scene, 'cm_nebula', x, y - 50, { v: 'gold', scale: 2, add: true, dur: 600, depth: DEPTH.VFX_TOP })) {
      const f = img(scene, 'px_flare', x, y - 50, 0xffffff, DEPTH.VFX_TOP);
      if (f) { f.setScale(0.3).setAlpha(1); fx(scene, f, { scale: 4.5, alpha: 0, duration: 600, ease: 'Quad.easeOut' }); }
    }
    burst(scene, x, y - 50, 'px_star', 24, 1000, {
      speed: { min: 120, max: 320 }, angle: { min: 0, max: 360 }, scale: { start: 2, end: 0.5 },
      tint: colors, gravityY: 120,
    }, DEPTH.VFX_TOP);
  });
}

/** Descending pixel light + blue twinkles + ring at the feet (~1.2s). */
function respawn(scene: Phaser.Scene, o: VfxOptions) {
  const { x, y } = o;
  const col = 0xbfe8ff;
  const p = img(scene, 'fx_pillar', x, y + 4, col);
  if (p) {
    p.setOrigin(0.5, 1).setScale(1.25, 1.5).setAlpha(0);
    scene.tweens.add({ targets: p, alpha: 0.9, duration: 200 });
    fx(scene, p, { alpha: 0, scaleX: 0.25, delay: 500, duration: 600 });
  }
  stream(scene, x, y - 170, 'px_star', 600, 900, {
    x: { min: -22, max: 22 }, speedY: { min: 140, max: 220 }, scale: { start: 1.5, end: 0.5 },
    lifespan: { min: 600, max: 850 }, frequency: 60, quantity: 1, tint: [0xffffff, col, 0xd8c8ff],
  }, DEPTH.VFX_TOP);
  for (let i = 0; i < 3; i++) pxFx(scene, 'sf_star_b', x + (i - 1) * 22, y - 30 - (i % 2) * 24, { scale: 2, add: true, fps: 8, delay: 300 + i * 110, depth: DEPTH.VFX_TOP });
  if (!pxFx(scene, 'cm_ring', x, y - 32, { v: 'ice', scale: 2, add: true, delay: 350, depth: DEPTH.VFX_TOP })) ring(scene, x, y, col, 0.3, 2.8, 600, 0.32, 350);
}

/** Small white impact: pixel spark pop + chunky flash (~250ms). x,y = hit point. */
function hitGeneric(scene: Phaser.Scene, o: VfxOptions) {
  const s = o.scale ?? 1;
  const { x, y } = o;
  const k = s >= 1.5 ? 4 : PIXEL_SCALE;
  const f = img(scene, 'px_flare', x, y, 0xffffff, DEPTH.VFX_TOP);
  if (f) { f.setScale(0.5 * s).setAlpha(0.7); fx(scene, f, { alpha: 0, duration: 120 }); }
  if (pxFx(scene, 'spark', x, y, { scale: k, add: true, depth: DEPTH.VFX_TOP })) return;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const sp = img(scene, 'px_spark', x, y, i % 2 ? 0xffffff : 0xffe9a8, DEPTH.VFX_TOP);
    if (!sp) break;
    const d = (18 + Math.random() * 16) * s;
    sp.setRotation(a).setScale(s);
    fx(scene, sp, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 200 + Math.random() * 80, ease: 'Quad.easeOut' });
  }
  ring(scene, x, y, 0xffffff, 0.25 * s, 1.25 * s, 200);
}

/** Twinkly pickup sparkle (~500ms). */
function pickupSparkle(scene: Phaser.Scene, o: VfxOptions) {
  const { x, y } = o;
  if (!pxFx(scene, 'sf_star_y', x, y, { scale: 2, add: true, fps: 10 })) {
    const st = img(scene, 'px_star', x, y, 0xfff3b0, DEPTH.VFX_TOP);
    if (st) { st.setScale(1); fx(scene, st, { scale: 2, alpha: 0, duration: 420, ease: 'Back.easeOut' }); }
  }
  burst(scene, x, y, 'px_star', 5, 600, {
    speedX: { min: -40, max: 40 }, speedY: { min: -110, max: -40 }, gravityY: 60,
    scale: { start: 1, end: 0.5 }, tint: [0xffffff, 0xffe066, 0xbfe8ff],
  }, DEPTH.VFX_TOP);
}

function safe(fn: (scene: Phaser.Scene, o: VfxOptions) => void) {
  return (scene: Phaser.Scene, o: VfxOptions) => {
    try { fn(scene, o); } catch (e) { console.warn('[vfx] common effect failed', e); }
  };
}

/** Registers common VFX keys: levelup, job_advance, respawn, hit_generic, pickup_sparkle. */
export function registerCommonVfx(): void {
  registerVfx('levelup', safe(levelup));
  registerVfx('job_advance', safe(jobAdvance));
  registerVfx('respawn', safe(respawn));
  registerVfx('hit_generic', safe(hitGeneric));
  registerVfx('pickup_sparkle', safe(pickupSparkle));
}
