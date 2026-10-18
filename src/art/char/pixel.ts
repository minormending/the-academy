// OWNER: PX1 (pixel characters). 16-bit pixel-art character pipeline.
//
// Source art (CC0, loaded by BootScene from manifests/characters.ts):
//   'witch' — Foozle "Pointy Hat Mage": idle/walk/jump/attack/climb/hurt/death sheets (player + most NPCs)
//   'sage'  — Foozle "Purple Mage": idle sheet (old sage NPCs)
// Each source frame is re-anchored into a fixed SRC_W×SRC_H cell (body centered, feet on the
// FOOT_ROW), every pixel is classified (robe / hat brim / hat tip / hair / skin / trim / gem / keep)
// and then palette-swapped per CharacterLook with lightness-preserving ramps. Tier decorations
// (hat band, circlet gem, crown, aura) are stamped on top. CHAR_SCALE integer-upscales the result.
import Phaser from 'phaser';
import type { CharacterLook } from '../../core/types';
import { sourceImage } from '../assets';
import { makeCanvas, mix, shade } from './color';
import type { PlayerAnimName } from './poses';

/**
 * Screen pixels per source pixel. The Foozle mages are drawn ~60 px tall at native resolution,
 * which is already the target on-screen height (56–72 px), so they are shown 1:1.
 * (PIXEL_SCALE = 2 would make the player ~120 px tall — twice the hitbox.)
 */
export const CHAR_SCALE = 1;
/** Source cell size (source px). Final frame = SRC × CHAR_SCALE. */
export const SRC_W = 80, SRC_H = 80;
export const PX_FW = SRC_W * CHAR_SCALE, PX_FH = SRC_H * CHAR_SCALE;
/** Last opaque source row (feet): final frame keeps feet at frameHeight − 2. */
const FOOT_ROW = SRC_H - 1 - Math.ceil(2 / CHAR_SCALE);

export type BaseId = 'witch' | 'sage';
type Anchor = 'sheet' | 'feetEach' | 'body';

interface FrameRef { sheet: string; i: number; anchor?: Anchor }
export interface PixAnim { anim: PlayerAnimName; frames: FrameRef[]; frameRate?: number; duration?: number; repeat: number }

const W = (sheet: string, idx: number[], anchor?: Anchor): FrameRef[] => idx.map(i => ({ sheet, i, anchor }));

/** Player animations built from the witch sheets. */
export const PIXEL_PLAYER_ANIMS: PixAnim[] = [
  { anim: 'idle', frames: W('idle', [0, 1, 2, 3, 4, 5, 6, 7]), frameRate: 8, repeat: -1 },
  { anim: 'walk', frames: W('walk', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), frameRate: 14, repeat: -1 },
  { anim: 'jump', frames: W('jump', [1, 2], 'body'), frameRate: 10, repeat: 0 },
  { anim: 'fall', frames: W('jump', [3, 4], 'body'), frameRate: 8, repeat: 0 },
  { anim: 'climb', frames: W('climb', [0, 1, 2, 1]), frameRate: 7, repeat: -1 },
  { anim: 'prone', frames: W('death', [3], 'feetEach'), frameRate: 1, repeat: 0 },
  { anim: 'cast', frames: W('attack', [0, 1, 3, 4, 5, 7]), duration: 380, repeat: 0 },
  { anim: 'hit', frames: W('hurt', [3, 0, 1, 2]), frameRate: 12, repeat: 0 },
  { anim: 'dead', frames: W('death', [0, 1, 2, 3], 'feetEach'), frameRate: 8, repeat: 0 },
];

export const PIXEL_FRAME_LAYOUT: Record<PlayerAnimName, number[]> = (() => {
  const out = {} as Record<PlayerAnimName, number[]>;
  let i = 0;
  for (const a of PIXEL_PLAYER_ANIMS) out[a.anim] = a.frames.map(() => i++);
  return out;
})();

export const PIXEL_NPC_IDLE: Record<BaseId, { frames: FrameRef[]; frameRate: number }> = {
  witch: { frames: W('idle', [0, 1, 2, 3, 4, 5, 6, 7]), frameRate: 6 },
  sage: { frames: W('idle', [0, 1, 2, 3, 4, 5]), frameRate: 6 },
};

// ───────────────────────────── sources ─────────────────────────────

const SHEET_FRAMES: Record<BaseId, Record<string, number>> = {
  witch: { idle: 8, walk: 10, jump: 7, attack: 8, climb: 3, hurt: 5, death: 11 },
  sage: { idle: 6 },
};

/** Colors used to find the body's center (torso) in every frame. */
const ANCHOR_COLORS: Record<BaseId, number[]> = {
  witch: [0x322b28, 0x221c1a],
  sage: [0x3b1443, 0x622461, 0x93388f],
};

interface Sheet { data: Uint8ClampedArray; w: number; h: number; fw: number; n: number }
const sheets = new Map<string, Sheet>();
const sheetKey = (base: BaseId, sheet: string) => `${base}.${sheet}`;

/** Reads the loaded source images (call once a scene with the loaded textures exists). */
export function registerPixelSources(scene: Phaser.Scene): void {
  for (const base of Object.keys(SHEET_FRAMES) as BaseId[]) {
    for (const sheet of Object.keys(SHEET_FRAMES[base])) {
      const k = sheetKey(base, sheet);
      if (sheets.has(k)) continue;
      try {
        const img = sourceImage(scene, `src_char_${base}_${sheet}`);
        if (!img || !img.width || !img.height) continue;
        const c = makeCanvas(img.width, img.height);
        const ctx = c?.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
        if (!c || !ctx) continue;
        ctx.drawImage(img as CanvasImageSource, 0, 0);
        registerPixelSheetData(base, sheet, ctx.getImageData(0, 0, img.width, img.height).data, img.width, img.height);
      } catch (e) { console.warn(`[characters] source ${k} unreadable`, e); }
    }
  }
}

/** Registers raw RGBA for one source sheet (used by registerPixelSources; also handy for offline previews). */
export function registerPixelSheetData(base: BaseId, sheet: string, data: Uint8ClampedArray, w: number, h: number): void {
  const n = SHEET_FRAMES[base]?.[sheet];
  if (!n) return;
  sheets.set(sheetKey(base, sheet), { data, w, h, fw: Math.floor(w / n), n });
}

/** True when every sheet of a base loaded. */
export function hasPixelBase(base: BaseId): boolean {
  return Object.keys(SHEET_FRAMES[base]).every(s => sheets.has(sheetKey(base, s)));
}

// ───────────────────────────── anchoring ─────────────────────────────

const rgbAt = (d: Uint8ClampedArray, o: number) => (d[o] << 16) | (d[o + 1] << 8) | d[o + 2];

interface FrameStats { ax: number | null; atop: number | null; bottom: number }
interface SheetStats { frames: FrameStats[]; ax: number; bottom: number }
const statsCache = new Map<string, SheetStats>();

function sheetStats(base: BaseId, name: string): SheetStats | null {
  const k = sheetKey(base, name);
  const hit = statsCache.get(k);
  if (hit) return hit;
  const s = sheets.get(k);
  if (!s) return null;
  const anchorSet = new Set(ANCHOR_COLORS[base]);
  const frames: FrameStats[] = [];
  for (let f = 0; f < s.n; f++) {
    const xs: number[] = [];
    let atop: number | null = null, bottom = -1;
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.fw; x++) {
        const o = (y * s.w + f * s.fw + x) * 4;
        if (s.data[o + 3] < 8) continue;
        bottom = y;
        if (anchorSet.has(rgbAt(s.data, o))) { xs.push(x); if (atop === null) atop = y; }
      }
    }
    xs.sort((a, b) => a - b);
    frames.push({ ax: xs.length ? xs[xs.length >> 1] : null, atop, bottom });
  }
  // Sheet anchor: most common per-frame torso x (stable through occlusions).
  const counts = new Map<number, number>();
  for (const fr of frames) if (fr.ax !== null) counts.set(fr.ax, (counts.get(fr.ax) ?? 0) + 1);
  let ax = s.fw >> 1, best = 0;
  for (const [x, c] of counts) if (c > best || (c === best && x < ax)) { ax = x; best = c; }
  const st: SheetStats = { frames, ax, bottom: Math.max(...frames.map(f => f.bottom)) };
  statsCache.set(k, st);
  return st;
}

// ───────────────────────────── classification ─────────────────────────────

const enum C { Empty = 0, Keep, Robe, Brim, Tip, Hair, Skin, Trim, Gem }

type Group = 'red' | 'blue' | 'hair' | 'skin' | 'trim' | 'gem' | 'white';
const GROUPS: Record<BaseId, Record<Group, number[]>> = {
  witch: {
    red: [0x3b1725, 0x73172d, 0xb4202a, 0xdf3e23],
    blue: [0x143464, 0x285cc4, 0x249fde],
    hair: [0x422433, 0x5b3138, 0x8e5252],
    skin: [0xdba463, 0xbb7547, 0xf4d29c, 0xba756a],
    trim: [0xdae0ea, 0xb3b9d1, 0x8b93af],
    gem: [0xfffc40, 0xffd541, 0xf9a31b, 0xfa6a0a],
    white: [],
  },
  sage: {
    red: [0x3b1443, 0x622461, 0x93388f],
    blue: [],
    hair: [],
    skin: [0xf6ca9f, 0xe69c69, 0xbf6f4a],
    trim: [],
    gem: [0x0cf1ff, 0x00cdf9, 0x0098dc],
    white: [0xffffff, 0xc7cfdd, 0x92a1b9],
  },
};
/** Ramp base (the "mid" source tone) of each group. */
const GROUP_BASE: Record<BaseId, Partial<Record<Group, number>>> = {
  witch: { red: 0xb4202a, blue: 0x285cc4, hair: 0x5b3138, skin: 0xdba463, trim: 0xb3b9d1, gem: 0xf9a31b },
  sage: { red: 0x622461, skin: 0xf6ca9f, gem: 0x00cdf9, white: 0xc7cfdd },
};
const groupOf = new Map<BaseId, Map<number, Group>>();
for (const b of Object.keys(GROUPS) as BaseId[]) {
  const m = new Map<number, Group>();
  for (const [g, cols] of Object.entries(GROUPS[b]) as [Group, number[]][]) for (const c of cols) m.set(c, g);
  groupOf.set(b, m);
}

interface BaseFrame { base: BaseId; data: Uint8ClampedArray; cls: Uint8Array }
const frameCache = new Map<string, BaseFrame | null>();

/** Source frame re-anchored into the SRC cell + per-pixel class map. */
function baseFrame(base: BaseId, ref: FrameRef): BaseFrame | null {
  const ck = `${base}.${ref.sheet}.${ref.i}.${ref.anchor ?? 'sheet'}`;
  if (frameCache.has(ck)) return frameCache.get(ck)!;
  const s = sheets.get(sheetKey(base, ref.sheet));
  const st = sheetStats(base, ref.sheet);
  if (!s || !st || ref.i >= s.n) { frameCache.set(ck, null); return null; }
  const fs = st.frames[ref.i];
  let bottom = st.bottom;
  if (ref.anchor === 'feetEach') bottom = fs.bottom;
  else if (ref.anchor === 'body') {
    const ref0 = sheetStats(base, 'idle');
    const r0 = ref0?.frames[0];
    if (ref0 && r0 && r0.atop !== null && fs.atop !== null) bottom = fs.atop + (ref0.bottom - r0.atop);
    else bottom = fs.bottom;
  }
  const dx = (SRC_W >> 1) - st.ax, dy = FOOT_ROW - bottom;
  const data = new Uint8ClampedArray(SRC_W * SRC_H * 4);
  for (let y = 0; y < s.h; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= SRC_H) continue;
    for (let x = 0; x < s.fw; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= SRC_W) continue;
      const so = (y * s.w + ref.i * s.fw + x) * 4, to = (ty * SRC_W + tx) * 4;
      if (s.data[so + 3] < 8) continue;
      data[to] = s.data[so]; data[to + 1] = s.data[so + 1]; data[to + 2] = s.data[so + 2]; data[to + 3] = 255;
    }
  }
  const bf: BaseFrame = { base, data, cls: classify(base, data) };
  frameCache.set(ck, bf);
  return bf;
}

function classify(base: BaseId, d: Uint8ClampedArray): Uint8Array {
  const N = SRC_W * SRC_H;
  const cls = new Uint8Array(N);
  const gm = groupOf.get(base)!;
  const grp: (Group | null)[] = new Array(N).fill(null);
  let top = SRC_H, bottom = -1, collarTop = -1, blueBottom = -1;
  for (let p = 0; p < N; p++) {
    if (d[p * 4 + 3] === 0) continue;
    const y = (p / SRC_W) | 0;
    top = Math.min(top, y); bottom = Math.max(bottom, y);
    const g = gm.get(rgbAt(d, p * 4)) ?? null;
    grp[p] = g;
    if (g === 'trim' && collarTop < 0) collarTop = y;
    if (g === 'blue') blueBottom = Math.max(blueBottom, y);
  }
  for (let p = 0; p < N; p++) {
    if (d[p * 4 + 3] === 0) continue;
    const y = (p / SRC_W) | 0;
    switch (grp[p]) {
      case 'red': cls[p] = C.Robe; break;
      case 'blue': cls[p] = C.Tip; break;
      case 'hair': cls[p] = y >= bottom - 6 ? C.Keep : C.Hair; break;   // boots share the hair ramp
      case 'skin': cls[p] = C.Skin; break;
      case 'trim': cls[p] = C.Trim; break;
      case 'gem': cls[p] = C.Gem; break;
      case 'white': cls[p] = y <= top + 7 ? C.Hair : C.Keep; break;      // sage: white tuft only, not the eyes
      default: cls[p] = C.Keep;
    }
  }
  // Red pixels mostly surrounded by skin are the mouth, not cloth.
  for (let p = 0; p < N; p++) {
    if (cls[p] !== C.Robe) continue;
    const px = p % SRC_W, py = (p / SRC_W) | 0;
    let skin = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const nx = px + ox, ny = py + oy;
      if ((ox || oy) && nx >= 0 && ny >= 0 && nx < SRC_W && ny < SRC_H && cls[ny * SRC_W + nx] === C.Skin) skin++;
    }
    if (skin >= 5) cls[p] = C.Keep;
  }
  // Hat brim = red pixels flood-filled from the tip, above the collar.
  if (blueBottom >= 0) {
    const cutY = collarTop >= 0 ? collarTop : blueBottom + 9;
    const stack: number[] = [];
    for (let p = 0; p < N; p++) if (cls[p] === C.Tip) stack.push(p);
    while (stack.length) {
      const p = stack.pop()!;
      const px = p % SRC_W, py = (p / SRC_W) | 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = px + ox, ny = py + oy;
        if (nx < 0 || ny < 0 || nx >= SRC_W || ny >= cutY) continue;
        const q = ny * SRC_W + nx;
        if (cls[q] === C.Robe) { cls[q] = C.Brim; stack.push(q); }
      }
    }
  }
  return cls;
}

// ───────────────────────────── palette ramps ─────────────────────────────

function toHsl(n: number): [number, number, number] {
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const dd = mx - mn;
  const s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
  let h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
  h /= 6;
  return [h, s, l];
}
function fromHsl(h: number, s: number, l: number): number {
  h = ((h % 1) + 1) % 1; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  if (s === 0) { const v = Math.round(l * 255); return (v << 16) | (v << 8) | v; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return (Math.round(f(h + 1 / 3) * 255) << 16) | (Math.round(f(h) * 255) << 8) | Math.round(f(h - 1 / 3) * 255);
}

/** Maps every color of a source ramp onto a target base color, keeping relative light/hue steps. */
function rampMap(srcCols: number[], srcBase: number, target: number, out: Map<number, number>, opts: { lift?: number; darkOutline?: boolean } = {}) {
  if (!srcCols.length) return;
  const [bh, bs, bl] = toHsl(srcBase);
  const [th, ts, tl0] = toHsl(target);
  const tl = tl0 + (opts.lift ?? 0);
  const dls = srcCols.map(c => toHsl(c)[2] - bl);
  let shift = 0;
  const hi = tl + Math.max(...dls), lo = tl + Math.min(...dls);
  if (hi > 0.96) shift = 0.96 - hi;
  if (lo + shift < 0.04) shift = 0.04 - lo;
  for (let i = 0; i < srcCols.length; i++) {
    const [h, s, l] = toHsl(srcCols[i]);
    let dh = h - bh; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
    if (s < 0.12 || bs < 0.12) dh = 0;                                  // greys carry no hue
    const sr = bs > 0.01 ? Math.max(0.6, Math.min(1.4, s / bs)) : 1;
    let nl = tl + dls[i] + shift;
    if (opts.darkOutline !== false && l < 0.2) nl = Math.min(nl, Math.max(0.12, l + 0.04));   // keep outlines dark
    out.set(srcCols[i], fromHsl(th + (ts < 0.08 ? 0 : dh * 0.5), ts * sr, nl));
  }
}

export interface PixelOpts {
  /** 1 = plain, 2 = hat band, 3 = + circlet gem, 4 = + crown. */
  deco: number;
  aura: boolean;
}

interface Palette {
  byClass: Map<number, number>[];          // class → (src rgb → dst rgb)
  metal: number; metalHi: number; metalLo: number; gem: number; gemHi: number; aura: number; outline: number;
}

const paletteCache = new Map<string, Palette>();

function paletteFor(base: BaseId, L: CharacterLook): Palette {
  const ck = `${base}|${JSON.stringify(L)}`;
  const hit = paletteCache.get(ck);
  if (hit) return hit;
  const G = GROUPS[base], B = GROUP_BASE[base];
  const crownish = L.hatStyle === 'circlet' || L.hatStyle === 'crown';
  // Circlet/crown looks use `hat` as the metal color; the witch hat itself is a deep robe/trim blend.
  const pale = luma(L.robe) > 0.75;
  const cloth = crownish ? shade(mix(L.robe, L.hatTrim, pale ? 0.6 : 0.35), pale ? -0.15 : -0.3) : L.hat;
  const metal = crownish ? L.hat : L.hatTrim;
  const by: Map<number, number>[] = [];
  const m = (c: C) => (by[c] = new Map<number, number>());
  if (base === 'witch') {
    rampMap(G.red, B.red!, L.robe, m(C.Robe));
    rampMap(G.red, B.red!, cloth, m(C.Brim));
    rampMap(G.blue, B.blue!, cloth, m(C.Tip), { lift: 0.06 });
    rampMap(G.hair, B.hair!, L.hair, m(C.Hair));
    rampMap(G.skin, B.skin!, mix(B.skin!, L.skin, 0.5), m(C.Skin));
    rampMap(G.trim, B.trim!, L.robeTrim, m(C.Trim));
    rampMap(G.gem, B.gem!, L.staffGem, m(C.Gem));
  } else {
    rampMap(G.red, B.red!, L.robe, m(C.Robe), { darkOutline: false });
    rampMap(G.white, B.white!, L.hair, m(C.Hair));
    rampMap(G.skin, B.skin!, mix(B.skin!, L.skin, 0.6), m(C.Skin));
    rampMap(G.gem, B.gem!, L.staffGem, m(C.Gem));
  }
  const pal: Palette = {
    byClass: by,
    metal, metalHi: shade(metal, 0.45), metalLo: shade(metal, -0.35),
    gem: L.staffGem, gemHi: shade(L.staffGem, 0.6),
    aura: L.hatTrim,
    outline: fromHslDark(L.robe),
  };
  paletteCache.set(ck, pal);
  return pal;
}

function luma(n: number): number {
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
function fromHslDark(n: number): number {
  const [h, s] = toHsl(n);
  return fromHsl(h, Math.min(0.6, s), 0.11);
}

// ───────────────────────────── rendering ─────────────────────────────

function put(d: Uint8ClampedArray, x: number, y: number, c: number, a = 255) {
  if (x < 0 || y < 0 || x >= SRC_W || y >= SRC_H) return;
  const o = (y * SRC_W + x) * 4;
  d[o] = (c >> 16) & 255; d[o + 1] = (c >> 8) & 255; d[o + 2] = c & 255; d[o + 3] = a;
}

/** Recolors + decorates one frame. Returns SRC_W×SRC_H RGBA, or null if the source is missing. */
export function renderPixelFrame(base: BaseId, ref: FrameRef, look: CharacterLook, opts: PixelOpts): Uint8ClampedArray | null {
  const bf = baseFrame(base, ref);
  if (!bf) return null;
  const pal = paletteFor(base, look);
  const N = SRC_W * SRC_H;
  const out = new Uint8ClampedArray(bf.data);
  for (let p = 0; p < N; p++) {
    const c = bf.cls[p];
    if (c <= C.Keep) continue;
    const mp = pal.byClass[c];
    const o = p * 4;
    const v = mp?.get(rgbAt(out, o));
    if (v !== undefined) { out[o] = (v >> 16) & 255; out[o + 1] = (v >> 8) & 255; out[o + 2] = v & 255; }
  }
  if (base === 'witch') decorateHat(out, bf.cls, pal, opts.deco);
  // 1px dark outline on both bodies (the Foozle witch ships without one); never below the feet row,
  // so feet stay exactly on the ground line.
  addOutline(out, pal.outline, 255, false, FOOT_ROW);
  if (opts.aura) addOutline(out, pal.aura, 150, true);
  return out;
}

/** Hat band (+ circlet gem / crown) along the tip–brim seam. */
function decorateHat(d: Uint8ClampedArray, cls: Uint8Array, pal: Palette, deco: number) {
  if (deco < 2) return;
  const band: [number, number][] = [];
  for (let y = 0; y < SRC_H - 1; y++) for (let x = 0; x < SRC_W; x++) {
    const p = y * SRC_W + x;
    if (cls[p] === C.Tip && cls[p + SRC_W] === C.Brim) band.push([x, y]);
  }
  if (!band.length) return;
  const thick = deco >= 3;
  for (const [x, y] of band) {
    put(d, x, y, pal.metal);
    if (thick && cls[(y - 1) * SRC_W + x] === C.Tip) put(d, x, y - 1, pal.metalHi);
  }
  band.sort((a, b) => a[0] - b[0]);
  const [lx] = band[0], [rx] = band[band.length - 1];
  const yAt = (x: number) => {
    let best = band[0];
    for (const b of band) if (Math.abs(b[0] - x) < Math.abs(best[0] - x)) best = b;
    return best[1];
  };
  const cx = Math.round((lx + rx) / 2);
  const gy = yAt(cx);
  if (deco >= 4) {
    // Crown: side spikes at the band ends + a tall center spike above the gem.
    for (const sx of [lx, rx]) {
      const by = yAt(sx);
      for (let k = 1; k <= 3; k++) put(d, sx, by - k, k === 3 ? pal.metalHi : pal.metal);
      put(d, sx + (sx === lx ? 1 : -1), by - 1, pal.metalLo);
    }
    for (let k = 3; k <= 6; k++) put(d, cx, gy - k, k === 6 ? pal.metalHi : pal.metal);
    put(d, cx - 1, gy - 3, pal.metalLo); put(d, cx + 1, gy - 3, pal.metalLo);
  }
  if (deco >= 3) {
    // Diamond gem set into the band, with a dark rim so it reads on any hat.
    const rim: [number, number][] = [[0, -3], [-1, -2], [1, -2], [-2, -1], [2, -1], [-1, 0], [1, 0], [0, 1]];
    if (deco < 4) for (const [ox, oy] of rim) put(d, cx + ox, gy + oy, pal.outline);
    else for (const [ox, oy] of rim) if (oy > -3) put(d, cx + ox, gy + oy, pal.outline);
    put(d, cx, gy - 2, pal.gemHi);
    put(d, cx - 1, gy - 1, pal.gem); put(d, cx, gy - 1, pal.gemHi); put(d, cx + 1, gy - 1, pal.gem);
    put(d, cx, gy, pal.gem);
  }
}

/** 1-px ring around the silhouette (outline or aura). */
function addOutline(d: Uint8ClampedArray, color: number, alpha: number, diag = false, maxY = SRC_H - 1) {
  const src = new Uint8Array(SRC_W * SRC_H);
  for (let p = 0; p < src.length; p++) src[p] = d[p * 4 + 3] > 0 ? 1 : 0;
  for (let y = 0; y <= Math.min(maxY, SRC_H - 1); y++) for (let x = 0; x < SRC_W; x++) {
    if (src[y * SRC_W + x]) continue;
    let near = false;
    for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!diag && ox !== 0 && oy !== 0) continue;
      const nx = x + ox, ny = y + oy;
      if (nx >= 0 && ny >= 0 && nx < SRC_W && ny < SRC_H && src[ny * SRC_W + nx]) { near = true; break; }
    }
    if (near) put(d, x, y, color, alpha);
  }
}

/** Draws rendered frames side by side into one canvas (integer-upscaled by CHAR_SCALE). */
export function bakePixelSheet(frames: (Uint8ClampedArray | null)[]): HTMLCanvasElement | null {
  const c = makeCanvas(PX_FW * frames.length, PX_FH);
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return null;
  const tmp = CHAR_SCALE === 1 ? null : makeCanvas(SRC_W, SRC_H);
  const tctx = tmp?.getContext('2d') ?? null;
  ctx.imageSmoothingEnabled = false;
  frames.forEach((f, i) => {
    if (!f) return;
    const id = new ImageData(new Uint8ClampedArray(f), SRC_W, SRC_H);
    if (!tmp || !tctx) { ctx.putImageData(id, i * PX_FW, 0); return; }
    tctx.clearRect(0, 0, SRC_W, SRC_H);
    tctx.putImageData(id, 0, 0);
    ctx.drawImage(tmp, i * PX_FW, 0, PX_FW, PX_FH);
  });
  return c;
}

/**
 * Head & shoulders crop of the idle frame, nearest-neighbor upscaled into a size×size canvas
 * (transparent background, facing right).
 */
export function pixelPortrait(base: BaseId, look: CharacterLook, opts: PixelOpts, size: number): HTMLCanvasElement | null {
  const f = renderPixelFrame(base, { sheet: 'idle', i: 0 }, look, opts);
  if (!f) return null;
  let top = SRC_H;
  for (let p = 0; p < SRC_W * SRC_H; p++) if (f[p * 4 + 3] > 0) { top = (p / SRC_W) | 0; break; }
  const CW = 40, CH = 40;
  const cx0 = (SRC_W >> 1) - (CW >> 1) + (base === 'witch' ? 1 : 0);
  const cy0 = Math.max(0, Math.min(SRC_H - CH, top - 1));
  const crop = makeCanvas(CW, CH);
  const cctx = crop?.getContext('2d');
  const out = makeCanvas(size, size);
  const octx = out?.getContext('2d');
  if (!crop || !cctx || !out || !octx) return null;
  const full = new ImageData(new Uint8ClampedArray(f), SRC_W, SRC_H);
  cctx.putImageData(full, -cx0, -cy0);
  const k = Math.max(1, Math.floor(size / CW));
  octx.imageSmoothingEnabled = false;
  octx.drawImage(crop, Math.floor((size - CW * k) / 2), size - CH * k, CW * k, CH * k);
  return out;
}
