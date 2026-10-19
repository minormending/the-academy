// OWNER: A6 (monsters). Monster art → Phaser textures + anims.
// 16-bit pivot: each monster is sliced from a freely licensed pixel sheet (src/art/manifests/monsters.ts,
// credits in public/assets/monsters/CREDITS.md), palette-swapped and integer-scaled by PIXEL_SCALE.
// The original procedural Canvas painter below stays as the fallback when a source sheet failed to load.
// Texture key `monster_${id}`; frames `${anim}_${i}`; anims `monster_${id}_${anim}`.
// Every frame has the monster's feet at bottom-center, MONSTER_FOOT_PAD px above the frame bottom.
// Art is drawn facing RIGHT (+x); entities flip with setFlipX.
import type Phaser from 'phaser';
import { MONSTERS } from '../data/monsters';
import { RAID_BOSSES } from '../data/raidBosses';
import { PIXEL_SCALE } from '../core/constants';
import { sourceImage } from './assets';
import { timed } from './perf';
import { MSRC } from './manifests/monsters';

export type MonsterAnim = 'idle' | 'move' | 'hit' | 'die' | 'attack';
export const MONSTER_FOOT_PAD = 2;
export const monsterTextureKey = (id: string) => `monster_${id}`;
export const monsterAnimKey = (id: string, anim: MonsterAnim) => `monster_${id}_${anim}`;

/** Extra textures used by monsters/drops (generated alongside monsters). */
export const MFX = {
  ember: 'monster_fx_ember',
  spark: 'monster_fx_spark',
  star: 'monster_fx_star',
  crystal: 'monster_fx_crystal',
  shard: 'monster_fx_shard',
  snow: 'monster_fx_snow',
  puff: 'monster_fx_puff',
  orb: 'monster_fx_orb',
  aura: 'monster_fx_aura',
  glow: 'monster_fx_glow',
  fallback: 'monster_fallback',
} as const;

/** Field boss attack textures (white/grey ramps tint per boss; generated with the pixel FX). */
export const BFX = {
  icicle: 'boss_fx_icicle',
  glob: 'boss_fx_glob',
  puddle: 'boss_fx_puddle',
  cloud: 'boss_fx_cloud',
  wave: 'boss_fx_wave',
  rock: 'boss_fx_rock',
} as const;

export const DROP_TEX = {
  bronze: 'drop_coin_bronze',
  silver: 'drop_coin_silver',
  gold: 'drop_coin_gold',
  bag: 'drop_bag',
  fallback: 'drop_fallback',
} as const;
export const dropCoinAnimKey = (tier: 'bronze' | 'silver' | 'gold') => `drop_coin_${tier}_spin`;

// ───────────────────────────── color + path helpers ─────────────────────────────

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function css(c: number, a = 1): string {
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
}
function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
const lt = (c: number, t: number) => mix(c, 0xffffff, t);
const dk = (c: number, t: number) => mix(c, 0x000000, t);

/** Soft 3D-ish radial fill with highlight to the upper left. */
function radial(c: Ctx, x: number, y: number, r: number, base: number, hi = 0.45, lo = 0.28): CanvasGradient {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.08, x, y, r * 1.1);
  g.addColorStop(0, css(lt(base, hi)));
  g.addColorStop(0.5, css(base));
  g.addColorStop(1, css(dk(base, lo)));
  return g;
}
function vgrad(c: Ctx, y0: number, y1: number, top: number, bottom: number, a = 1): CanvasGradient {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, css(top, a));
  g.addColorStop(1, css(bottom, a));
  return g;
}
/** Fill current path + soft darker outline. */
function paint(c: Ctx, fill: string | CanvasGradient, outline: number, lw = 2) {
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = lw;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = css(outline, 0.9);
  c.stroke();
}
function ell(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}
function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
/** Bumpy (fluffy / rocky) blob path. */
function blob(c: Ctx, x: number, y: number, rx: number, ry: number, bumps: number, amp: number, phase = 0) {
  c.beginPath();
  const steps = 72;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU;
    const k = 1 + amp * Math.abs(Math.sin(a * bumps / 2 + phase));
    const px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
}
function shine(c: Ctx, x: number, y: number, rx: number, ry: number, a = 0.75, rot = -0.5) {
  ell(c, x, y, rx, ry, rot);
  c.fillStyle = `rgba(255,255,255,${a})`;
  c.fill();
}
function blush(c: Ctx, x: number, y: number, r = 3.2, col = 0xff7fa0, a = 0.45) {
  ell(c, x, y, r * 1.3, r * 0.75);
  c.fillStyle = css(col, a);
  c.fill();
}
function glow(c: Ctx, col: number, blur: number) {
  c.shadowColor = css(col, 0.95);
  c.shadowBlur = blur;
}
function noGlow(c: Ctx) {
  c.shadowBlur = 0;
  c.shadowColor = 'transparent';
}
function line(c: Ctx, pts: [number, number][], col: number, lw: number, a = 1) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = css(col, a);
  c.stroke();
}
function tri(c: Ctx, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  c.beginPath();
  c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(cx, cy); c.closePath();
}
/** Little flame (teardrop) pointing up from (x,y). */
function flame(c: Ctx, x: number, y: number, h: number, w: number, sway: number, outer = 0xff7a1a, inner = 0xffe27a) {
  const draw = (hh: number, ww: number, col: number, a: number) => {
    c.beginPath();
    c.moveTo(x - ww, y);
    c.quadraticCurveTo(x - ww * 1.1, y - hh * 0.55, x + sway, y - hh);
    c.quadraticCurveTo(x + ww * 1.1, y - hh * 0.55, x + ww, y);
    c.quadraticCurveTo(x, y + ww * 0.8, x - ww, y);
    c.closePath();
    c.fillStyle = css(col, a);
    c.fill();
  };
  glow(c, outer, 6);
  draw(h, w, outer, 0.95);
  noGlow(c);
  draw(h * 0.6, w * 0.55, inner, 0.95);
}
function zigzag(c: Ctx, x: number, y: number, len: number, ang: number, col: number, lw = 2) {
  const pts: [number, number][] = [];
  const segs = 4;
  for (let i = 0; i <= segs; i++) {
    const d = (i / segs) * len;
    const off = i % 2 === 0 ? 0 : (i % 4 === 1 ? 3 : -3);
    pts.push([x + Math.cos(ang) * d - Math.sin(ang) * off, y + Math.sin(ang) * d + Math.cos(ang) * off]);
  }
  glow(c, col, 5);
  line(c, pts, col, lw);
  noGlow(c);
}

// ───────────────────────────── faces ─────────────────────────────

type EyeMode = 'open' | 'closed' | 'hurt' | 'x';

interface EyeOpts { col?: number; glowCol?: number; angry?: boolean; noShine?: boolean; }

function eye(c: Ctx, x: number, y: number, r: number, mode: EyeMode, side: -1 | 1, o: EyeOpts = {}) {
  const col = o.col ?? 0x2b1d2e;
  if (mode === 'open') {
    if (o.glowCol !== undefined) glow(c, o.glowCol, r * 2.5);
    ell(c, x, y, r * 0.78, r);
    c.fillStyle = css(col);
    c.fill();
    noGlow(c);
    if (!o.noShine) {
      ell(c, x - r * 0.25, y - r * 0.38, r * 0.34, r * 0.34);
      c.fillStyle = 'rgba(255,255,255,0.95)';
      c.fill();
      ell(c, x + r * 0.22, y + r * 0.38, r * 0.15, r * 0.15);
      c.fill();
    }
    if (o.angry) line(c, [[x - r * 1.1 * side, y - r * 1.5], [x + r * 0.9 * side, y - r * 0.95]], dk(col, 0), Math.max(1.6, r * 0.5));
  } else if (mode === 'closed') {
    c.beginPath();
    c.moveTo(x - r * 0.85, y);
    c.quadraticCurveTo(x, y + r * 0.7, x + r * 0.85, y);
    c.lineWidth = Math.max(1.6, r * 0.45);
    c.lineCap = 'round';
    c.strokeStyle = css(col);
    c.stroke();
  } else if (mode === 'hurt') {
    // ">" for the left eye, "<" for the right eye
    const s = side === -1 ? 1 : -1;
    line(c, [[x - r * 0.8 * s, y - r * 0.8], [x + r * 0.7 * s, y], [x - r * 0.8 * s, y + r * 0.8]], col, Math.max(1.6, r * 0.45));
  } else {
    line(c, [[x - r * 0.7, y - r * 0.7], [x + r * 0.7, y + r * 0.7]], col, Math.max(1.6, r * 0.45));
    line(c, [[x + r * 0.7, y - r * 0.7], [x - r * 0.7, y + r * 0.7]], col, Math.max(1.6, r * 0.45));
  }
}
function eyes(c: Ctx, p: Pose, x1: number, x2: number, y: number, r: number, o: EyeOpts = {}) {
  eye(c, x1, y, r, p.eyes, -1, o);
  eye(c, x2, y, r, p.eyes, 1, o);
}
function mouth(c: Ctx, p: Pose, x: number, y: number, w: number, kind: 'smile' | 'grin' | 'frown' | 'fang' | 'cat', col = 0x5a2a2a) {
  if (p.eyes === 'hurt' || p.eyes === 'x') {
    ell(c, x, y + 1, w * 0.35, w * 0.4);
    c.fillStyle = css(col);
    c.fill();
    return;
  }
  c.lineWidth = 1.6;
  c.lineCap = 'round';
  c.strokeStyle = css(col);
  c.beginPath();
  if (kind === 'smile') {
    c.moveTo(x - w / 2, y);
    c.quadraticCurveTo(x, y + w * 0.5, x + w / 2, y);
    c.stroke();
  } else if (kind === 'cat') {
    c.moveTo(x - w / 2, y);
    c.quadraticCurveTo(x - w / 4, y + w * 0.4, x, y);
    c.quadraticCurveTo(x + w / 4, y + w * 0.4, x + w / 2, y);
    c.stroke();
  } else if (kind === 'frown') {
    c.moveTo(x - w / 2, y + w * 0.25);
    c.quadraticCurveTo(x, y - w * 0.2, x + w / 2, y + w * 0.25);
    c.stroke();
  } else {
    // grin / fang: open mouth
    c.moveTo(x - w / 2, y);
    c.quadraticCurveTo(x, y + w * 0.75, x + w / 2, y);
    c.closePath();
    c.fillStyle = css(col);
    c.fill();
    c.stroke();
    c.fillStyle = '#ffffff';
    tri(c, x - w * 0.3, y + 0.3, x - w * 0.12, y + 0.3, x - w * 0.22, y + w * 0.32);
    c.fill();
    if (kind === 'grin') {
      tri(c, x + w * 0.3, y + 0.3, x + w * 0.12, y + 0.3, x + w * 0.22, y + w * 0.32);
      c.fill();
    }
  }
}

// ───────────────────────────── poses ─────────────────────────────

export interface Pose {
  anim: MonsterAnim;
  i: number;
  n: number;
  t: number;      // 0..1 through the cycle
  bob: number;    // px up
  sq: number;     // squash (>1 wider/shorter)
  step: number;   // -1..1 leg phase
  wing: number;   // -1..1 wing phase
  eyes: EyeMode;
  atk: number;    // 0..1 attack wind-up
  k: number;      // die progress 0..1
}

interface ArtDef {
  w: number;
  h: number;
  draw: (c: Ctx, p: Pose) => void;
  flyer?: boolean;      // flapping/hovering idle
  attack?: boolean;     // has an attack anim
  die?: 'squash' | 'fade';
  poseMod?: (p: Pose) => void;
}

interface AnimSpec { name: MonsterAnim; frames: number; rate: number; repeat: number; }
const ANIMS: AnimSpec[] = [
  { name: 'idle', frames: 8, rate: 8, repeat: -1 },
  { name: 'move', frames: 6, rate: 10, repeat: -1 },
  { name: 'hit', frames: 2, rate: 10, repeat: 0 },
  { name: 'die', frames: 6, rate: 12, repeat: 0 },
  { name: 'attack', frames: 8, rate: 12, repeat: 0 },
];

function makePose(anim: MonsterAnim, i: number, n: number, flyer: boolean): Pose {
  const t = i / n;
  const s = Math.sin(t * TAU);
  const p: Pose = { anim, i, n, t, bob: 0, sq: 1, step: 0, wing: s, eyes: 'open', atk: 0, k: 0 };
  switch (anim) {
    case 'idle':
      p.bob = flyer ? s * 2.5 : 0;
      p.sq = flyer ? 1 : 1 + s * 0.035;
      p.eyes = i === n - 1 ? 'closed' : 'open';
      p.wing = Math.sin(t * TAU * 2);
      break;
    case 'move':
      p.step = s;
      p.bob = flyer ? s * 2 : Math.abs(s) * 2;
      p.sq = 1 + Math.cos(t * TAU * 2) * 0.03;
      p.wing = Math.sin(t * TAU * 2);
      break;
    case 'hit':
      p.eyes = 'hurt';
      p.sq = i === 0 ? 0.9 : 0.95;
      p.wing = 0.6;
      break;
    case 'die':
      p.eyes = 'x';
      p.k = (i + 1) / n;
      p.wing = -0.5;
      break;
    case 'attack':
      p.atk = Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5) * (t > 0.8 ? 1 - (t - 0.8) * 3 : 1);
      p.bob = s * 2;
      p.wing = Math.sin(t * TAU * 2);
      break;
  }
  return p;
}

// ───────────────────────────── monster art ─────────────────────────────

const OUT = 0x3a2630;

function drawSnail(c: Ctx, p: Pose) {
  const body = 0xf4cf86;
  const stretch = p.anim === 'move' ? 1 + p.step * 0.07 : 1;
  c.save();
  c.scale(stretch, 1);
  // slug body
  c.beginPath();
  c.moveTo(-24, -1);
  c.quadraticCurveTo(-26, -9, -14, -10);
  c.lineTo(9, -10);
  c.quadraticCurveTo(12, -25, 19, -25);
  c.quadraticCurveTo(27, -25, 26, -12);
  c.quadraticCurveTo(26, -1, 17, 0);
  c.closePath();
  paint(c, vgrad(c, -25, 0, lt(body, 0.35), dk(body, 0.12)), dk(body, 0.5));
  // foot fringe
  line(c, [[-20, -2], [16, -2]], dk(body, 0.2), 1.4, 0.6);
  c.restore();
  // eye stalks
  const sway = p.anim === 'move' ? p.step * 1.5 : Math.sin(p.t * TAU) * 1;
  const stalks: [number, number, number, number][] = [[17 * stretch, -22, 14 * stretch + sway, -35], [22 * stretch, -22, 25 * stretch + sway, -34]];
  stalks.forEach(([x0, y0, x1, y1], k) => {
    line(c, [[x0, y0], [x1, y1]], dk(body, 0.5), 4.4);
    line(c, [[x0, y0], [x1, y1]], body, 2.4);
    ell(c, x1, y1, 3.6, 3.6);
    paint(c, radial(c, x1, y1, 3.6, 0xfff3d6), dk(body, 0.5), 1.4);
    eye(c, x1 + 0.6, y1 + 0.2, 2.2, p.eyes, k === 0 ? -1 : 1);
  });
  blush(c, 19 * stretch, -13, 2.6);
  mouth(c, p, 23 * stretch, -14, 4, 'smile');
  // shell
  const sx = -5, sy = -18, sr = 14 + (p.anim === 'idle' ? Math.sin(p.t * TAU) * 0.4 : 0);
  ell(c, sx, sy, sr, sr);
  paint(c, radial(c, sx, sy, sr, 0xc98a4b), 0x6e4523);
  c.beginPath();
  for (let a = 0; a < Math.PI * 3.3; a += 0.12) {
    const r = sr - 2.5 - a * 1.05;
    const px = sx + 1 + Math.cos(a + 2.2) * r, py = sy + 1 + Math.sin(a + 2.2) * r;
    if (a === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.lineWidth = 2;
  c.strokeStyle = css(0x7a4b23, 0.85);
  c.stroke();
  // moss
  const moss = 0x86c44f;
  [[-12, -30, 6, 3.4], [-2, -31.5, 5.5, 3], [6, -27, 3.5, 2.6]].forEach(([x, y, rx, ry]) => {
    ell(c, x, y, rx, ry);
    paint(c, radial(c, x, y, rx, moss), dk(moss, 0.4), 1.4);
  });
  line(c, [[-4, -33], [-5, -38]], 0x5f9a35, 1.6);
  ell(c, -7, -38.5, 2.6, 1.4, -0.4);
  c.fillStyle = css(0x9ee06a);
  c.fill();
  shine(c, -12, -22, 3.6, 2.2, 0.6);
}

function drawSlime(c: Ctx, p: Pose) {
  const base = 0x6fdcc8;
  c.beginPath();
  c.moveTo(-21, -1);
  c.bezierCurveTo(-24, -15, -14, -30, 0, -30);
  c.bezierCurveTo(14, -30, 24, -15, 21, -1);
  c.quadraticCurveTo(0, 2, -21, -1);
  c.closePath();
  c.globalAlpha = 0.95;
  paint(c, radial(c, -2, -14, 26, base, 0.55, 0.22), dk(base, 0.45));
  c.globalAlpha = 1;
  // puff curl
  c.beginPath();
  c.moveTo(-3, -29);
  c.quadraticCurveTo(-6, -39, 2, -39);
  c.quadraticCurveTo(8, -38, 5, -33);
  c.quadraticCurveTo(3, -31, 3, -29);
  paint(c, radial(c, 1, -35, 6, lt(base, 0.15)), dk(base, 0.45), 1.6);
  // inner bubbles
  [[10, -8, 2], [13, -14, 1.3], [-12, -6, 1.4]].forEach(([x, y, r]) => {
    ell(c, x, y, r, r);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fill();
  });
  shine(c, -10, -21, 5.5, 3.2, 0.85);
  shine(c, -15, -13, 1.6, 1.6, 0.8);
  eyes(c, p, -6, 6, -14, 3.4);
  blush(c, -12, -9, 2.8);
  blush(c, 12, -9, 2.8);
  mouth(c, p, 0, -9, 5, 'cat', 0x24564c);
}
function slimePose(p: Pose) {
  if (p.anim === 'move') {
    const seq = [1.2, 0.84, 0.9, 0.96, 0.92, 1.12];
    p.sq = seq[p.i % seq.length];
    p.bob = 0;
  } else if (p.anim === 'idle') {
    p.sq = 1 + Math.sin(p.t * TAU) * 0.06;
  }
}

function drawCapShroom(c: Ctx, p: Pose) {
  const stem = 0xf6e3c0, cap = 0xf0883a;
  // feet
  [-1, 1].forEach(s => {
    const off = p.anim === 'move' ? p.step * 3 * s : 0;
    ell(c, s * 7 + off, -2.5, 5.5, 3);
    paint(c, radial(c, s * 7 + off, -2.5, 5.5, 0xd9b48a), 0x7a5634, 1.4);
  });
  // stem body
  c.beginPath();
  c.moveTo(-12, -28);
  c.quadraticCurveTo(-15, -12, -13, -4);
  c.quadraticCurveTo(0, 0, 13, -4);
  c.quadraticCurveTo(15, -12, 12, -28);
  c.closePath();
  paint(c, radial(c, -2, -16, 16, stem, 0.4, 0.15), 0x8a6a48);
  eyes(c, p, -5, 5, -17, 3.1);
  blush(c, -9, -12, 2.4);
  blush(c, 9, -12, 2.4);
  mouth(c, p, 0, -12, 4.5, 'smile');
  // cap (lags a touch when walking)
  const cy = p.anim === 'move' ? -p.step * 0.8 : 0;
  c.save();
  c.translate(0, cy);
  c.beginPath();
  c.moveTo(-27, -27);
  c.bezierCurveTo(-28, -50, -12, -58, 0, -58);
  c.bezierCurveTo(12, -58, 28, -50, 27, -27);
  c.quadraticCurveTo(0, -20, -27, -27);
  c.closePath();
  paint(c, radial(c, -4, -42, 28, cap), 0x8a3f15);
  [[-12, -45, 5, 4], [6, -51, 4, 3], [15, -37, 4.2, 3.2], [-2, -35, 3.2, 2.5], [-21, -33, 2.6, 2.2]].forEach(([x, y, rx, ry]) => {
    ell(c, x, y, rx, ry);
    c.fillStyle = css(0xfff1d6, 0.95);
    c.fill();
  });
  shine(c, -14, -50, 5, 2.6, 0.55);
  c.restore();
}

function drawThornShroom(c: Ctx, p: Pose) {
  const stem = 0xdde6b4, cap = 0x8b58c9;
  [-1, 1].forEach(s => {
    const off = p.anim === 'move' ? p.step * 3 * s : 0;
    ell(c, s * 8 + off, -2.5, 6, 3.2);
    paint(c, radial(c, s * 8 + off, -2.5, 6, 0x9fb07a), 0x4f5a34, 1.4);
  });
  c.beginPath();
  c.moveTo(-14, -32);
  c.quadraticCurveTo(-17, -14, -15, -4);
  c.quadraticCurveTo(0, 0, 15, -4);
  c.quadraticCurveTo(17, -14, 14, -32);
  c.closePath();
  paint(c, radial(c, -2, -18, 18, stem, 0.4, 0.18), 0x5f6a3e);
  eyes(c, p, -6, 6, -19, 3.2, { angry: true });
  mouth(c, p, 0, -11, 5, 'fang', 0x4a2340);
  const cy = p.anim === 'move' ? -p.step * 0.8 : 0;
  c.save();
  c.translate(0, cy);
  // thorns (behind cap edge)
  const thornCol = 0xeadbff;
  for (let k = 0; k < 7; k++) {
    const a = Math.PI + 0.25 + (k / 6) * (Math.PI - 0.5);
    const bx = Math.cos(a) * 28, by = -31 + Math.sin(a) * 33;
    const nx = Math.cos(a), ny = Math.sin(a);
    tri(c, bx - ny * 4, by + nx * 4, bx + ny * 4, by - nx * 4, bx + nx * 10, by + ny * 10);
    paint(c, vgrad(c, by - 10, by + 4, 0xffffff, thornCol), 0x5a3a7a, 1.4);
  }
  c.beginPath();
  c.moveTo(-30, -30);
  c.bezierCurveTo(-31, -55, -14, -64, 0, -64);
  c.bezierCurveTo(14, -64, 31, -55, 30, -30);
  c.quadraticCurveTo(0, -22, -30, -30);
  c.closePath();
  paint(c, radial(c, -4, -46, 30, cap), 0x3e2366);
  [[-13, -48, 4.5, 3.4], [7, -55, 4, 3], [16, -40, 4, 3], [-3, -38, 3, 2.4]].forEach(([x, y, rx, ry]) => {
    ell(c, x, y, rx, ry);
    c.fillStyle = css(0xc7a2f2, 0.95);
    c.fill();
  });
  // underside rim
  c.beginPath();
  c.moveTo(-28, -30);
  c.quadraticCurveTo(0, -23, 28, -30);
  c.lineWidth = 2;
  c.strokeStyle = css(0x5c3891, 0.8);
  c.stroke();
  shine(c, -15, -55, 5, 2.6, 0.5);
  c.restore();
}

function drawStump(c: Ctx, p: Pose) {
  const bark = 0x8a5a33, ring = 0xe2bb7f;
  // root feet
  [-1, 1].forEach(s => {
    const off = p.anim === 'move' ? p.step * 3.5 * s : 0;
    c.beginPath();
    c.moveTo(s * 10 + off, -8);
    c.quadraticCurveTo(s * 22 + off, -6, s * 25 + off, -1);
    c.quadraticCurveTo(s * 16 + off, 0, s * 6 + off, -1);
    c.closePath();
    paint(c, vgrad(c, -8, 0, lt(bark, 0.1), dk(bark, 0.2)), dk(bark, 0.5), 1.6);
  });
  // twig arms
  [-1, 1].forEach(s => {
    const sw = (p.anim === 'move' ? p.step * s : Math.sin(p.t * TAU) * 0.4) * 3;
    line(c, [[s * 17, -30], [s * 27, -37 + sw], [s * 31, -45 + sw]], dk(bark, 0.45), 5.5);
    line(c, [[s * 17, -30], [s * 27, -37 + sw], [s * 31, -45 + sw]], lt(bark, 0.05), 3);
    line(c, [[s * 27, -37 + sw], [s * 34, -36 + sw]], lt(bark, 0.05), 2.4);
    ell(c, s * 33, -48 + sw, 3.6, 2.2, s * 0.6);
    paint(c, css(0x7cc65a), 0x3f7a2a, 1.2);
  });
  // trunk
  c.beginPath();
  c.moveTo(-21, -2);
  c.quadraticCurveTo(-19, -26, -18, -48);
  c.lineTo(18, -48);
  c.quadraticCurveTo(19, -26, 21, -2);
  c.quadraticCurveTo(0, 2, -21, -2);
  c.closePath();
  const g = c.createLinearGradient(-21, 0, 21, 0);
  g.addColorStop(0, css(dk(bark, 0.25)));
  g.addColorStop(0.35, css(lt(bark, 0.15)));
  g.addColorStop(1, css(dk(bark, 0.3)));
  paint(c, g, 0x4a2c14);
  [[-12, -44, -14, -8], [-3, -42, -4, -30], [10, -44, 12, -10], [4, -14, 3, -4]].forEach(([x0, y0, x1, y1]) => {
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo((x0 + x1) / 2 + 2, (y0 + y1) / 2, x1, y1);
    c.lineWidth = 1.6;
    c.strokeStyle = css(dk(bark, 0.4), 0.7);
    c.stroke();
  });
  // top rings
  ell(c, 0, -48, 18.5, 6);
  paint(c, radial(c, 0, -48, 18, ring, 0.3, 0.1), 0x6a4422, 1.8);
  [12, 7.5, 3].forEach(r => {
    ell(c, 0.5, -48, r, r * 0.33);
    c.lineWidth = 1.1;
    c.strokeStyle = css(0xb48850, 0.9);
    c.stroke();
  });
  // moss + sprout
  ell(c, -11, -50, 7, 2.6, -0.1);
  paint(c, css(0x7fbf4a), 0x4f8a2e, 1.2);
  const sw = Math.sin(p.t * TAU) * 1.5;
  line(c, [[5, -50], [6 + sw, -63]], 0x4f8a2e, 2);
  ell(c, 2 + sw, -63, 4.5, 2.4, 0.5);
  paint(c, css(0x8fd86a), 0x3f7a2a, 1.2);
  ell(c, 10 + sw, -65, 4.5, 2.4, -0.5);
  paint(c, css(0x8fd86a), 0x3f7a2a, 1.2);
  // hollow face
  [-7.5, 7.5].forEach(x => {
    ell(c, x, -31, 4.6, 5.4);
    c.fillStyle = css(0x2a170a);
    c.fill();
  });
  if (p.eyes === 'open') {
    [-7.5, 7.5].forEach(x => {
      glow(c, 0xd8ff7a, 6);
      ell(c, x + 0.6, -30.5, 1.8, 2.4);
      c.fillStyle = css(0xe8ff9a);
      c.fill();
      noGlow(c);
    });
  } else {
    eyes(c, p, -7.5, 7.5, -31, 3, { col: 0xe8ff9a });
  }
  c.beginPath();
  c.moveTo(-6, -21);
  c.quadraticCurveTo(0, p.eyes === 'open' ? -16 : -14, 6, -21);
  c.quadraticCurveTo(0, -19, -6, -21);
  c.fillStyle = css(0x2a170a);
  c.fill();
}

function drawBat(c: Ctx, p: Pose) {
  const fur = 0x93a8ec, wing = 0x5b6cc6;
  const by = -17;
  // wings
  [-1, 1].forEach(s => {
    const w = p.wing;
    const ax = s * 10, ay = by - 3;
    const tx = s * 34, ty = by - 13 - w * 12;
    c.beginPath();
    c.moveTo(ax, ay - 3);
    c.quadraticCurveTo(s * 22, ty - 4, tx, ty);
    c.quadraticCurveTo(s * 31, ty + 9, s * 27, by + 2 - w * 6);
    c.quadraticCurveTo(s * 23, by - 2 - w * 4, s * 19, by + 4 - w * 4);
    c.quadraticCurveTo(s * 15, by + 1 - w * 2, ax, ay + 7);
    c.closePath();
    paint(c, vgrad(c, ty, by + 6, lt(wing, 0.2), dk(wing, 0.25)), dk(wing, 0.5), 1.8);
    line(c, [[ax, ay], [tx, ty]], dk(wing, 0.35), 1.2, 0.7);
  });
  // ears
  [-1, 1].forEach(s => {
    tri(c, s * 4, by - 10, s * 12, by - 9, s * 10, by - 21);
    paint(c, radial(c, s * 9, by - 13, 7, fur), dk(fur, 0.5), 1.6);
    tri(c, s * 6, by - 11, s * 10.5, by - 10.5, s * 9.5, by - 17);
    c.fillStyle = css(0xffb8d2, 0.8);
    c.fill();
  });
  // fluffy body
  blob(c, 0, by, 13, 12.5, 14, 0.07);
  paint(c, radial(c, 0, by, 13, fur), dk(fur, 0.5));
  ell(c, 0, by + 4, 7.5, 6.5);
  c.fillStyle = css(0xe9f1ff, 0.9);
  c.fill();
  // feet
  [-1, 1].forEach(s => {
    line(c, [[s * 4, by + 11], [s * 5, by + 15]], dk(fur, 0.5), 2);
  });
  eyes(c, p, -5, 5, by - 2, 3.3);
  blush(c, -9, by + 2, 2.3);
  blush(c, 9, by + 2, 2.3);
  mouth(c, p, 0, by + 3, 4.5, 'cat', 0x2a2a5a);
  if (p.eyes !== 'x' && p.eyes !== 'hurt') {
    c.fillStyle = '#ffffff';
    tri(c, -2, by + 4.2, -0.6, by + 4.2, -1.3, by + 6.6);
    c.fill();
    tri(c, 2, by + 4.2, 0.6, by + 4.2, 1.3, by + 6.6);
    c.fill();
  }
  // frost sparkle
  const sp = (p.i % 4) / 4;
  c.globalAlpha = 0.5 + 0.5 * Math.sin(sp * TAU);
  line(c, [[-11, by - 22], [-11, by - 16]], 0xffffff, 1.2);
  line(c, [[-14, by - 19], [-8, by - 19]], 0xffffff, 1.2);
  c.globalAlpha = 1;
}

function drawYeti(c: Ctx, p: Pose) {
  const fur = 0xf2f6fd, shade = 0xb7c9e6, face = 0xa9cdee;
  // feet
  [-1, 1].forEach(s => {
    const off = p.anim === 'move' ? p.step * 4 * s : 0;
    ell(c, s * 13 + off, -4, 10, 5);
    paint(c, radial(c, s * 13 + off, -4, 10, 0x8fa7cc), 0x4b5d80, 1.6);
  });
  // back arm
  const armSw = p.anim === 'move' ? p.step * 4 : Math.sin(p.t * TAU) * 1.2;
  const arm = (s: number, sw: number) => {
    blob(c, s * 27, -30 + sw * 0.5, 8.5, 17, 8, 0.1, 0.4);
    paint(c, radial(c, s * 27, -30, 14, fur, 0.2, 0.25), 0x6d82a8);
    ell(c, s * 28, -15 + sw, 6.5, 5);
    paint(c, radial(c, s * 28, -15 + sw, 6, 0x9ab4da), 0x4b5d80, 1.4);
  };
  arm(-1, -armSw);
  // horns
  [-1, 1].forEach(s => {
    c.beginPath();
    c.moveTo(s * 12, -62);
    c.quadraticCurveTo(s * 22, -70, s * 20, -80);
    c.quadraticCurveTo(s * 17, -72, s * 7, -66);
    c.closePath();
    paint(c, vgrad(c, -80, -62, 0xffffff, 0xb7c5da), 0x6d7a92, 1.6);
  });
  // body
  blob(c, 0, -36, 25, 32, 16, 0.06);
  const g = c.createRadialGradient(-8, -52, 4, 0, -34, 40);
  g.addColorStop(0, css(0xffffff));
  g.addColorStop(0.55, css(fur));
  g.addColorStop(1, css(shade));
  paint(c, g, 0x6d82a8);
  // fur tufts
  [[-14, -18], [10, -12], [-4, -26], [14, -28]].forEach(([x, y]) => {
    line(c, [[x - 3, y - 2], [x, y + 2], [x + 3, y - 2]], 0xa8bcdc, 1.3, 0.8);
  });
  arm(1, armSw);
  // face patch
  blob(c, 3, -48, 14.5, 11.5, 10, 0.05);
  paint(c, radial(c, 3, -48, 14, face, 0.35, 0.15), 0x5d7ba6, 1.6);
  eyes(c, p, -3, 9, -50, 3.2);
  blush(c, -8, -44, 2.6);
  blush(c, 14, -44, 2.6);
  mouth(c, p, 3, -43, 6, 'grin', 0x34446a);
  shine(c, -12, -58, 5, 3, 0.7);
}

function drawIceWisp(c: Ctx, p: Pose) {
  const core = 0x8ff0ff;
  const sway = Math.sin(p.t * TAU) * 4;
  const cy = -20;
  // shards orbiting (back half)
  const shard = (k: number, front: boolean) => {
    const a = p.t * TAU + (k * TAU) / 3;
    if ((Math.sin(a) > 0) !== front) return;
    const x = Math.cos(a) * 21, y = cy - 4 + Math.sin(a) * 6;
    c.beginPath();
    c.moveTo(x, y - 6); c.lineTo(x + 3, y); c.lineTo(x, y + 6); c.lineTo(x - 3, y); c.closePath();
    paint(c, vgrad(c, y - 6, y + 6, 0xffffff, 0x7fd8ff), 0x3a7fbf, 1.2);
  };
  for (let k = 0; k < 3; k++) shard(k, false);
  // flame-like body
  glow(c, 0x7fe8ff, 14);
  c.beginPath();
  c.moveTo(-14, cy);
  c.bezierCurveTo(-15, cy - 14, -6 + sway * 0.4, cy - 22, sway, cy - 34);
  c.bezierCurveTo(6 + sway * 0.4, cy - 22, 15, cy - 14, 14, cy);
  c.arc(0, cy, 14, 0, Math.PI, false);
  c.closePath();
  const g = c.createRadialGradient(0, cy - 2, 2, 0, cy - 6, 26);
  g.addColorStop(0, css(0xffffff, 0.98));
  g.addColorStop(0.45, css(core, 0.95));
  g.addColorStop(1, css(0x3a8fd6, 0.9));
  c.fillStyle = g;
  c.fill();
  noGlow(c);
  c.lineWidth = 1.8;
  c.strokeStyle = css(0x2f78b8, 0.8);
  c.stroke();
  // little tail flames
  [-7, 0, 7].forEach((x, k) => {
    const h = 5 + Math.sin(p.t * TAU + k) * 2;
    c.beginPath();
    c.moveTo(x - 3, cy + 11);
    c.quadraticCurveTo(x, cy + 13 + h, x + 3, cy + 11);
    c.fillStyle = css(0xbff6ff, 0.8);
    c.fill();
  });
  ell(c, 0, cy + 1, 8, 7);
  c.fillStyle = 'rgba(255,255,255,0.45)';
  c.fill();
  eyes(c, p, -5, 5, cy - 2, 2.9, { col: 0x173a6a });
  blush(c, -9, cy + 3, 2.2, 0x9fc8ff, 0.6);
  blush(c, 9, cy + 3, 2.2, 0x9fc8ff, 0.6);
  mouth(c, p, 0, cy + 3, 3.5, 'smile', 0x173a6a);
  for (let k = 0; k < 3; k++) shard(k, true);
}
function wispPose(p: Pose) {
  if (p.anim === 'idle' || p.anim === 'move') p.bob = Math.sin(p.t * TAU) * 3;
}

function drawImp(c: Ctx, p: Pose) {
  const skin = 0xe8553c, belly = 0xffa071, wing = 0x8a2230;
  // tail
  const ts = Math.sin(p.t * TAU) * 2;
  c.beginPath();
  c.moveTo(-6, -8);
  c.quadraticCurveTo(-18, -6, -20, -18 + ts);
  c.lineWidth = 4.5;
  c.strokeStyle = css(dk(skin, 0.45));
  c.stroke();
  c.lineWidth = 2.6;
  c.strokeStyle = css(skin);
  c.stroke();
  flame(c, -20, -17 + ts, 9, 3.5, Math.sin(p.t * TAU * 2) * 1.5);
  // wings
  [-1, 1].forEach(s => {
    const w = p.wing * 4;
    c.beginPath();
    c.moveTo(s * 6, -24);
    c.lineTo(s * 19, -34 - w);
    c.lineTo(s * 17, -26 - w * 0.5);
    c.lineTo(s * 21, -24 - w * 0.4);
    c.lineTo(s * 9, -16);
    c.closePath();
    paint(c, vgrad(c, -34, -16, lt(wing, 0.15), dk(wing, 0.2)), dk(wing, 0.5), 1.4);
  });
  // legs
  [-1, 1].forEach(s => {
    const off = p.anim === 'move' ? p.step * 2 * s : 0;
    ell(c, s * 5 + off, -3, 4, 3);
    paint(c, css(dk(skin, 0.1)), dk(skin, 0.5), 1.4);
  });
  // body
  ell(c, 0, -13, 10, 10);
  paint(c, radial(c, 0, -13, 10, skin), dk(skin, 0.5));
  ell(c, 0, -11, 6, 6);
  c.fillStyle = css(belly, 0.95);
  c.fill();
  // horns
  [-1, 1].forEach(s => {
    c.beginPath();
    c.moveTo(s * 5, -44);
    c.quadraticCurveTo(s * 10, -52, s * 13, -55);
    c.quadraticCurveTo(s * 12, -48, s * 10, -42);
    c.closePath();
    paint(c, vgrad(c, -55, -42, 0xfff3d6, 0xe6c08a), 0x7a5634, 1.4);
  });
  // head
  ell(c, 0, -32, 14, 12.5);
  paint(c, radial(c, 0, -32, 14, skin), dk(skin, 0.5));
  // ears
  [-1, 1].forEach(s => {
    tri(c, s * 12, -35, s * 12, -29, s * 21, -36);
    paint(c, css(skin), dk(skin, 0.5), 1.4);
  });
  flame(c, 0, -43, 8 + Math.sin(p.t * TAU * 2) * 1.5, 3.5, Math.sin(p.t * TAU) * 1.5);
  eyes(c, p, -5, 5, -33, 3.2, { col: 0x3a0f0a });
  blush(c, -9, -28, 2.4, 0xffd27a, 0.5);
  blush(c, 9, -28, 2.4, 0xffd27a, 0.5);
  mouth(c, p, 0, -27, 6, 'grin', 0x5a1410);
  shine(c, -6, -40, 3.5, 2, 0.55);
}
function impPose(p: Pose) {
  if (p.anim === 'move') {
    const seq = [1.12, 0.9, 0.94, 1, 0.95, 1.08];
    p.sq = seq[p.i % seq.length];
    p.bob = 0;
  }
}

function drawSalamander(c: Ctx, p: Pose) {
  const skin = 0xc23a2c, belly = 0xffa23a;
  const st = p.anim === 'move' ? p.step : 0;
  // tail
  const tw = Math.sin(p.t * TAU) * 3;
  c.beginPath();
  c.moveTo(-20, -18);
  c.quadraticCurveTo(-38, -16 + tw, -45, -6 + tw);
  c.quadraticCurveTo(-47, -14 + tw, -42, -18 + tw);
  c.quadraticCurveTo(-34, -6, -18, -8);
  c.closePath();
  paint(c, vgrad(c, -20, -6, lt(skin, 0.1), dk(skin, 0.25)), dk(skin, 0.55));
  // far legs
  const leg = (x: number, ph: number, far: boolean) => {
    const off = ph * 4;
    c.beginPath();
    c.moveTo(x - 3, -10);
    c.lineTo(x + off - 4, -1);
    c.lineTo(x + off + 5, -1);
    c.lineTo(x + 4, -10);
    c.closePath();
    paint(c, css(far ? dk(skin, 0.3) : skin), dk(skin, 0.55), 1.4);
  };
  leg(-10, -st, true);
  leg(16, st, true);
  // body
  ell(c, 0, -15, 25, 10);
  paint(c, vgrad(c, -25, -5, lt(skin, 0.15), dk(skin, 0.2)), dk(skin, 0.55));
  c.beginPath();
  c.ellipse(1, -11, 20, 5, 0, 0, Math.PI);
  c.fillStyle = css(belly, 0.95);
  c.fill();
  // glowing spots
  [[-12, -20, 2.6], [-2, -22, 3], [9, -20, 2.4], [-18, -16, 2]].forEach(([x, y, r]) => {
    glow(c, 0xffb43a, 6);
    ell(c, x, y, r, r * 0.8);
    c.fillStyle = css(0xffd060);
    c.fill();
    noGlow(c);
  });
  // back flames
  [-10, 0, 10].forEach((x, k) => {
    flame(c, x, -23, 6 + Math.sin(p.t * TAU * 2 + k * 1.7) * 2.5, 3, Math.sin(p.t * TAU + k) * 1.2);
  });
  leg(-14, st, false);
  leg(12, -st, false);
  // head
  ell(c, 27, -18, 12, 9.5, -0.1);
  paint(c, radial(c, 27, -18, 12, skin), dk(skin, 0.55));
  ell(c, 30, -13, 7, 3.5);
  c.fillStyle = css(belly, 0.9);
  c.fill();
  eye(c, 29, -21, 3.4, p.eyes, 1, { col: 0x2a0a06 });
  blush(c, 24, -14, 2.4, 0xffd27a, 0.6);
  mouth(c, p, 35, -15, 5, 'smile', 0x5a1410);
  shine(c, 22, -24, 3.5, 1.8, 0.5);
}

function drawMagmaGolem(c: Ctx, p: Pose) {
  const rock = 0x4b3b3a, lava = 0xff7a1a;
  const st = p.anim === 'move' ? p.step : 0;
  const pulse = 0.6 + 0.4 * Math.sin(p.t * TAU);
  // legs
  [-1, 1].forEach(s => {
    const off = st * 3 * s;
    rrect(c, s * 13 - 9 + off, -18, 18, 18, 5);
    paint(c, vgrad(c, -18, 0, lt(rock, 0.1), dk(rock, 0.3)), 0x1e1414);
  });
  const fist = (s: number) => {
    const fy = -26 - st * 3 * s;
    blob(c, s * 37, fy, 12, 11, 6, 0.08, 0.5);
    paint(c, radial(c, s * 37, fy, 12, rock), 0x1e1414);
    glow(c, lava, 6);
    line(c, [[s * 31, fy - 4], [s * 36, fy], [s * 41, fy - 3]], lava, 1.8, pulse);
    noGlow(c);
    // drip
    ell(c, s * 37, fy + 12 + (p.i % 3), 1.8, 2.6);
    c.fillStyle = css(0xffb14a, 0.9);
    c.fill();
  };
  fist(-1);
  // shoulders + arms
  [-1, 1].forEach(s => {
    line(c, [[s * 26, -54], [s * 36, -34 - st * 3 * s]], 0x1e1414, 13);
    line(c, [[s * 26, -54], [s * 36, -34 - st * 3 * s]], dk(rock, 0.05), 9);
  });
  // torso
  blob(c, 0, -46, 29, 26, 7, 0.06, 0.3);
  paint(c, radial(c, 0, -46, 30, rock, 0.3, 0.35), 0x1e1414);
  // cracks
  glow(c, lava, 8);
  line(c, [[-20, -58], [-12, -50], [-16, -40], [-8, -32]], lava, 2.2, pulse);
  line(c, [[18, -60], [12, -52], [20, -44]], lava, 2.2, pulse);
  line(c, [[4, -30], [10, -24]], lava, 2, pulse);
  // core
  ell(c, 0, -46, 7.5 + pulse, 7.5 + pulse);
  c.fillStyle = css(0xffc04d);
  c.fill();
  noGlow(c);
  ell(c, -1.5, -48, 3, 3);
  c.fillStyle = css(0xfff3c4);
  c.fill();
  // shoulder boulders
  [-1, 1].forEach(s => {
    blob(c, s * 26, -60, 13, 11, 6, 0.08, s);
    paint(c, radial(c, s * 26, -60, 13, rock, 0.35, 0.3), 0x1e1414);
    flame(c, s * 27, -69, 7 + Math.sin(p.t * TAU * 2 + s) * 2, 3, Math.sin(p.t * TAU) * 1.2);
  });
  // head
  blob(c, 0, -74, 13, 11, 6, 0.06, 1.2);
  paint(c, radial(c, 0, -74, 13, lt(rock, 0.05), 0.35, 0.3), 0x1e1414);
  if (p.eyes === 'open' || p.eyes === 'closed') {
    glow(c, 0xffd04a, 8);
    [-5, 5].forEach(x => {
      ell(c, x, -75, 2.6, p.eyes === 'closed' ? 0.8 : 2.2);
      c.fillStyle = css(0xfff07a);
      c.fill();
    });
    noGlow(c);
  } else {
    eyes(c, p, -5, 5, -75, 2.6, { col: 0xfff07a });
  }
  fist(1);
}

function drawHarpy(c: Ctx, p: Pose) {
  const feath = 0x5d78d8, belly = 0xfff1b8, crest = 0xffe25a;
  const by = -24;
  // tail feathers
  [-5, 0, 5].forEach(x => {
    ell(c, x, by + 16, 3, 7, x * 0.06);
    paint(c, css(dk(feath, 0.15)), dk(feath, 0.5), 1.2);
  });
  // wings
  [-1, 1].forEach(s => {
    const w = p.wing;
    c.save();
    c.translate(s * 13, by - 2);
    c.rotate(s * (-0.35 - w * 0.55));
    for (let k = 0; k < 3; k++) {
      ell(c, s * (12 + k * 5), 2 + k * 3, 13 - k * 2, 5.5, s * (0.15 + k * 0.25));
      paint(c, vgrad(c, -6, 14, lt(feath, 0.25 - k * 0.08), dk(feath, 0.15 + k * 0.05)), dk(feath, 0.5), 1.4);
    }
    c.restore();
  });
  // legs
  [-1, 1].forEach(s => {
    line(c, [[s * 5, by + 12], [s * 5, by + 20]], 0xd9a526, 2.4);
    line(c, [[s * 5, by + 20], [s * 8, by + 22]], 0xd9a526, 1.8);
    line(c, [[s * 5, by + 20], [s * 2, by + 22]], 0xd9a526, 1.8);
  });
  // body
  blob(c, 0, by, 15, 15.5, 12, 0.05);
  paint(c, radial(c, 0, by, 16, feath), dk(feath, 0.5));
  ell(c, 0, by + 5, 9, 8.5);
  c.fillStyle = css(belly, 0.95);
  c.fill();
  // lightning crest
  c.beginPath();
  c.moveTo(-3, by - 14);
  c.lineTo(-7, by - 25);
  c.lineTo(-2, by - 21);
  c.lineTo(1, by - 31);
  c.lineTo(3, by - 21);
  c.lineTo(8, by - 26);
  c.lineTo(5, by - 14);
  c.closePath();
  glow(c, crest, 6);
  paint(c, vgrad(c, by - 31, by - 14, 0xffffff, crest), 0xa8801a, 1.4);
  noGlow(c);
  eyes(c, p, -5.5, 5.5, by - 4, 3.3);
  blush(c, -10, by + 1, 2.3);
  blush(c, 10, by + 1, 2.3);
  // beak
  tri(c, -3, by + 1, 3, by + 1, 0, by + 5.5);
  paint(c, css(0xffc93a), 0x8a5a10, 1.2);
  shine(c, -8, by - 9, 4, 2.2, 0.55);
}

function drawCragGolem(c: Ctx, p: Pose) {
  const stone = 0x7d8899, rune = 0xffe066;
  const st = p.anim === 'move' ? p.step : 0;
  const pulse = 0.55 + 0.45 * Math.sin(p.t * TAU);
  [-1, 1].forEach(s => {
    const off = st * 3 * s;
    rrect(c, s * 14 - 10 + off, -20, 20, 20, 4);
    paint(c, vgrad(c, -20, 0, lt(stone, 0.1), dk(stone, 0.3)), 0x2f3542);
  });
  const arm = (s: number) => {
    const sw = -st * 3 * s;
    rrect(c, s * 34 - 8, -60 + sw, 16, 26, 5);
    paint(c, vgrad(c, -60, -34, lt(stone, 0.1), dk(stone, 0.2)), 0x2f3542);
    blob(c, s * 36, -26 + sw, 13, 12, 5, 0.1, s);
    paint(c, radial(c, s * 36, -26 + sw, 13, stone, 0.35, 0.3), 0x2f3542);
  };
  arm(-1);
  // torso (trapezoid block)
  c.beginPath();
  c.moveTo(-30, -70);
  c.lineTo(30, -70);
  c.quadraticCurveTo(34, -70, 33, -64);
  c.lineTo(24, -22);
  c.quadraticCurveTo(22, -16, 16, -16);
  c.lineTo(-16, -16);
  c.quadraticCurveTo(-22, -16, -24, -22);
  c.lineTo(-33, -64);
  c.quadraticCurveTo(-34, -70, -30, -70);
  c.closePath();
  paint(c, radial(c, -4, -48, 34, stone, 0.3, 0.3), 0x2f3542);
  // moss cap
  c.beginPath();
  c.moveTo(-31, -69);
  c.quadraticCurveTo(-20, -76, 0, -73);
  c.quadraticCurveTo(20, -77, 31, -69);
  c.quadraticCurveTo(22, -64, 12, -67);
  c.quadraticCurveTo(0, -62, -12, -67);
  c.quadraticCurveTo(-22, -63, -31, -69);
  c.closePath();
  paint(c, vgrad(c, -77, -62, 0x9fd27a, 0x5f9a45), 0x3a6a2a, 1.4);
  // cracks
  line(c, [[-18, -56], [-12, -48], [-16, -38]], dk(stone, 0.45), 1.6, 0.8);
  line(c, [[16, -30], [10, -24]], dk(stone, 0.45), 1.6, 0.8);
  // rune
  zigzag(c, -4, -54, 22, Math.PI / 2 - 0.25, rune, 2.4 * pulse + 0.8);
  ell(c, 0, -43, 4, 4);
  glow(c, rune, 8);
  c.fillStyle = css(rune, 0.6 + 0.4 * pulse);
  c.fill();
  noGlow(c);
  // head
  rrect(c, -13, -90, 26, 20, 6);
  paint(c, radial(c, -2, -82, 15, lt(stone, 0.05), 0.35, 0.3), 0x2f3542);
  if (p.eyes === 'open' || p.eyes === 'closed') {
    glow(c, rune, 8);
    [-5.5, 5.5].forEach(x => {
      rrect(c, x - 3, -83 + (p.eyes === 'closed' ? 1.5 : 0), 6, p.eyes === 'closed' ? 1.5 : 4, 1);
      c.fillStyle = css(0xfff6b0);
      c.fill();
    });
    noGlow(c);
  } else {
    eyes(c, p, -5.5, 5.5, -81, 2.6, { col: 0xfff6b0 });
  }
  arm(1);
  // floating pebbles
  [0, 1].forEach(k => {
    const a = p.t * TAU + k * Math.PI;
    const x = (k ? 1 : -1) * (46 + Math.cos(a) * 2), y = -76 + Math.sin(a) * 4;
    blob(c, x, y, 4, 3.4, 4, 0.12, k);
    paint(c, radial(c, x, y, 4, stone), 0x2f3542, 1.2);
  });
}

function drawDrake(c: Ctx, p: Pose) {
  const scale = 0x34407a, belly = 0xffd84a, horn = 0xfff4c8, mem = 0x5a6fd0;
  const w = p.wing;
  // far wing
  const wingPath = (ox: number, oy: number, s: number, far: boolean) => {
    const tipY = oy - 26 - w * 18, tipX = ox - 18 * s;
    c.beginPath();
    c.moveTo(ox, oy);
    c.quadraticCurveTo(ox - 6, tipY + 4, tipX, tipY);
    c.quadraticCurveTo(tipX - 6, oy - 4 - w * 6, ox - 30, oy + 4 - w * 6);
    c.quadraticCurveTo(ox - 22, oy - 2 - w * 4, ox - 16, oy + 6 - w * 3);
    c.quadraticCurveTo(ox - 10, oy, ox + 8, oy + 6);
    c.closePath();
    paint(c, vgrad(c, tipY, oy + 6, lt(far ? dk(mem, 0.25) : mem, 0.15), dk(mem, far ? 0.4 : 0.2)), 0x1c2450, 1.6);
    line(c, [[ox, oy], [tipX, tipY]], 0x1c2450, 1.4, 0.7);
  };
  wingPath(4, -36, 1, true);
  // tail
  const ts = Math.sin(p.t * TAU) * 3;
  c.beginPath();
  c.moveTo(-18, -32);
  c.quadraticCurveTo(-36, -34 + ts, -48, -24 + ts);
  c.quadraticCurveTo(-36, -24, -18, -20);
  c.closePath();
  paint(c, vgrad(c, -34, -20, lt(scale, 0.15), dk(scale, 0.2)), 0x161c40);
  // bolt tail-tip
  c.beginPath();
  c.moveTo(-46, -25 + ts);
  c.lineTo(-56, -32 + ts);
  c.lineTo(-52, -26 + ts);
  c.lineTo(-58, -20 + ts);
  c.lineTo(-48, -21 + ts);
  c.closePath();
  glow(c, belly, 6);
  paint(c, css(belly), 0x8a6a10, 1.2);
  noGlow(c);
  // legs tucked
  [-8, 10].forEach(x => {
    ell(c, x, -14, 5, 4);
    paint(c, css(dk(scale, 0.1)), 0x161c40, 1.4);
    line(c, [[x - 2, -10], [x - 3, -7]], horn, 1.4);
    line(c, [[x + 2, -10], [x + 2, -7]], horn, 1.4);
  });
  // body
  ell(c, 0, -26, 23, 13.5);
  paint(c, radial(c, -2, -28, 24, scale, 0.35, 0.3), 0x161c40);
  c.beginPath();
  c.ellipse(2, -22, 18, 7, 0, 0.1, Math.PI - 0.1);
  c.fillStyle = css(belly, 0.95);
  c.fill();
  [-8, -1, 6, 13].forEach(x => line(c, [[x, -20], [x + 1, -16]], 0xc9a22a, 1.1, 0.7));
  // spines
  [-12, -4, 4].forEach(x => {
    tri(c, x - 3, -38, x + 3, -38.5, x - 1, -44);
    paint(c, css(belly), 0x8a6a10, 1);
  });
  // neck + head
  c.beginPath();
  c.moveTo(14, -34);
  c.quadraticCurveTo(22, -40, 26, -44);
  c.lineTo(30, -36);
  c.quadraticCurveTo(24, -28, 18, -24);
  c.closePath();
  paint(c, css(scale), 0x161c40);
  // horns
  [[22, -52, 14, -60], [27, -53, 22, -63]].forEach(([x0, y0, x1, y1]) => {
    c.beginPath();
    c.moveTo(x0 - 2, y0 + 3);
    c.quadraticCurveTo(x1 + 2, y1 + 4, x1, y1);
    c.quadraticCurveTo(x1 + 5, y1 + 6, x0 + 3, y0 + 3);
    c.closePath();
    paint(c, vgrad(c, y1, y0, 0xffffff, horn), 0x8a7a50, 1.2);
  });
  ell(c, 30, -45, 12, 9.5, 0.1);
  paint(c, radial(c, 28, -47, 12, scale, 0.4, 0.25), 0x161c40);
  ell(c, 39, -42, 6.5, 4.8, 0.2);
  paint(c, radial(c, 39, -42, 6, lt(scale, 0.12)), 0x161c40, 1.4);
  ell(c, 42, -43, 0.9, 0.9);
  c.fillStyle = css(0x0e1230);
  c.fill();
  eye(c, 29, -47, 3.6, p.eyes, 1, { col: 0x0e1230 });
  blush(c, 33, -40, 2.3, 0xffd27a, 0.55);
  mouth(c, p, 39, -38.5, 4, 'smile', 0xffe68a);
  wingPath(-2, -34, 1, false);
  // crackle sparks
  if (p.i % 2 === 0) {
    zigzag(c, -28 + (p.i * 7) % 20, -50, 8, 0.6, belly, 1.4);
    zigzag(c, 20, -12 + (p.i % 3), 7, 2.4, belly, 1.2);
  }
}

function drawVoidWisp(c: Ctx, p: Pose) {
  const body = 0x2e1648, rim = 0xc65bff;
  const cy = -24;
  // tendrils
  for (let k = 0; k < 3; k++) {
    const x = (k - 1) * 7;
    const ph = p.t * TAU + k * 1.3;
    c.beginPath();
    c.moveTo(x - 3, cy + 8);
    c.bezierCurveTo(x - 4 + Math.sin(ph) * 3, cy + 16, x + 3 + Math.sin(ph + 1) * 3, cy + 18, x + Math.sin(ph + 2) * 4, cy + 24);
    c.lineWidth = 3.2;
    c.lineCap = 'round';
    c.strokeStyle = css(lt(body, 0.15), 0.9);
    c.stroke();
  }
  // body
  glow(c, rim, 14);
  const sway = Math.sin(p.t * TAU) * 3;
  c.beginPath();
  c.moveTo(-14, cy + 2);
  c.bezierCurveTo(-16, cy - 12, -7, cy - 20, sway, cy - 30);
  c.bezierCurveTo(7, cy - 20, 16, cy - 12, 14, cy + 2);
  c.quadraticCurveTo(14, cy + 13, 0, cy + 13);
  c.quadraticCurveTo(-14, cy + 13, -14, cy + 2);
  c.closePath();
  const g = c.createRadialGradient(-3, cy - 4, 2, 0, cy, 22);
  g.addColorStop(0, css(0x6a2fa0));
  g.addColorStop(0.6, css(body));
  g.addColorStop(1, css(0x120820));
  c.fillStyle = g;
  c.fill();
  noGlow(c);
  c.lineWidth = 2;
  c.strokeStyle = css(rim, 0.9);
  c.stroke();
  // eyes: glowing, no shine
  if (p.eyes === 'open') {
    glow(c, 0xff7cf0, 8);
    [-5, 5].forEach(x => {
      ell(c, x, cy - 1, 2.8, 3.6);
      c.fillStyle = css(0xffb8f6);
      c.fill();
    });
    noGlow(c);
    ell(c, -5, cy - 2, 1, 1.2);
    c.fillStyle = '#ffffff';
    c.fill();
    ell(c, 5, cy - 2, 1, 1.2);
    c.fill();
  } else {
    eyes(c, p, -5, 5, cy - 1, 2.8, { col: 0xffb8f6 });
  }
  mouth(c, p, 0, cy + 5, 4, 'cat', 0xc65bff);
  // orbiting motes
  for (let k = 0; k < 4; k++) {
    const a = p.t * TAU * (k % 2 ? -1 : 1) + k * 1.6;
    const x = Math.cos(a) * 20, y = cy + Math.sin(a) * 8;
    ell(c, x, y, 1.8, 1.8);
    c.fillStyle = css(k % 2 ? 0xe0a0ff : 0x8a3ad0, 0.9);
    c.fill();
  }
}

function drawLich(c: Ctx, p: Pose) {
  const robe = 0x3a2258, robeDk = 0x1a0d2c, gold = 0xe2b54c, bone = 0xe8e0cf, eyeCol = 0xff4fd8;
  const orbCol = 0xa040ff;
  const t = p.t;
  const atk = p.atk;
  const orbs = (front: boolean) => {
    for (let k = 0; k < 3; k++) {
      const a = t * TAU + (k * TAU) / 3;
      const s = Math.sin(a);
      if ((s > 0) !== front) continue;
      const pull = atk * 0.5;
      const x = Math.cos(a) * 64 * (1 - pull) + 46 * pull, y = -104 + s * 16 - 40 * pull;
      const r = 8 + s * 1.5;
      glow(c, orbCol, 14);
      ell(c, x, y, r, r);
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      g.addColorStop(0, css(0xffd6ff));
      g.addColorStop(0.4, css(orbCol));
      g.addColorStop(1, css(0x2a0a4a));
      c.fillStyle = g;
      c.fill();
      noGlow(c);
    }
  };
  // ghostly mist at the base
  for (let k = 0; k < 5; k++) {
    const x = (k - 2) * 18 + Math.sin(t * TAU + k) * 4;
    ell(c, x, -8, 16, 6);
    c.fillStyle = css(0x8a5ad8, 0.18);
    c.fill();
  }
  orbs(false);
  // collar spikes behind head
  for (let k = -2; k <= 2; k++) {
    const x = k * 9;
    tri(c, x - 6, -140, x + 6, -140, x * 1.5, -178 + Math.abs(k) * 6);
    paint(c, vgrad(c, -178, -140, 0x5a3480, robeDk), 0x0e0618, 1.6);
  }
  // staff (left side, behind sleeve)
  const sx = -48;
  line(c, [[sx, -168], [sx + 2, -10]], 0x1e1206, 6);
  line(c, [[sx, -168], [sx + 2, -10]], 0x6a4a2a, 3.5);
  // staff head: claw + gem
  [-1, 1].forEach(s => {
    c.beginPath();
    c.moveTo(sx, -166);
    c.quadraticCurveTo(sx + s * 12, -174, sx + s * 8, -188);
    c.quadraticCurveTo(sx + s * 6, -178, sx, -172);
    c.closePath();
    paint(c, css(gold), 0x6a4a10, 1.4);
  });
  glow(c, 0x7ff6ff, 16);
  ell(c, sx, -180, 6.5, 6.5);
  c.fillStyle = css(0xb8faff);
  c.fill();
  noGlow(c);
  // robe body (tattered hem sways)
  const sway = Math.sin(t * TAU) * 4;
  c.beginPath();
  c.moveTo(-28, -134);
  c.quadraticCurveTo(-46, -80, -54 + sway * 0.5, -18);
  const hem = 9;
  for (let k = 0; k <= hem; k++) {
    const x = -54 + (108 * k) / hem + sway * (0.5 - Math.abs(k / hem - 0.5));
    const y = k % 2 === 0 ? -16 + Math.sin(t * TAU + k) * 2 : -4 + Math.sin(t * TAU + k) * 3;
    c.lineTo(x, y);
  }
  c.quadraticCurveTo(46, -80, 28, -134);
  c.closePath();
  const rg = c.createLinearGradient(-54, 0, 54, 0);
  rg.addColorStop(0, css(robeDk));
  rg.addColorStop(0.4, css(lt(robe, 0.08)));
  rg.addColorStop(0.65, css(robe));
  rg.addColorStop(1, css(robeDk));
  paint(c, rg, 0x0e0618, 2.4);
  // front trim band + runes
  c.beginPath();
  c.moveTo(-8, -132);
  c.lineTo(8, -132);
  c.lineTo(14, -14);
  c.lineTo(-14, -14);
  c.closePath();
  paint(c, vgrad(c, -132, -14, 0x24123a, 0x150a24), 0x0e0618, 1.2);
  line(c, [[-8, -132], [-14, -14]], gold, 2.2);
  line(c, [[8, -132], [14, -14]], gold, 2.2);
  glow(c, eyeCol, 6);
  for (let k = 0; k < 4; k++) {
    const y = -116 + k * 24;
    const ra = 0.5 + 0.5 * Math.sin(t * TAU + k);
    c.globalAlpha = 0.55 + 0.45 * ra;
    ell(c, 0, y, 3.5, 3.5);
    c.lineWidth = 1.4;
    c.strokeStyle = css(0xff9cf0);
    c.stroke();
    line(c, [[0, y - 6], [0, y + 6]], 0xff9cf0, 1.2);
    c.globalAlpha = 1;
  }
  noGlow(c);
  // belt
  rrect(c, -27, -96, 54, 7, 3);
  paint(c, vgrad(c, -96, -89, lt(gold, 0.2), dk(gold, 0.25)), 0x5a3a08, 1.2);
  ell(c, 0, -92.5, 5, 5);
  glow(c, eyeCol, 8);
  paint(c, radial(c, 0, -92.5, 5, 0xd04ab8), 0x5a3a08, 1.2);
  noGlow(c);
  // left sleeve gripping staff
  c.beginPath();
  c.moveTo(-26, -132);
  c.quadraticCurveTo(-48, -124, -50, -100);
  c.lineTo(-38, -96);
  c.quadraticCurveTo(-34, -112, -20, -118);
  c.closePath();
  paint(c, vgrad(c, -132, -96, lt(robe, 0.1), robeDk), 0x0e0618, 2);
  ell(c, -46, -104, 5.5, 4.5);
  paint(c, css(bone), 0x6a6050, 1.2);
  // right arm (raises during attack)
  const hx = 40 + atk * 10, hy = -98 - atk * 44;
  c.beginPath();
  c.moveTo(24, -132);
  c.quadraticCurveTo(44, -126, hx + 4, hy + 8);
  c.lineTo(hx - 8, hy + 12);
  c.quadraticCurveTo(28, -112, 20, -118);
  c.closePath();
  paint(c, vgrad(c, -132, hy, lt(robe, 0.1), robeDk), 0x0e0618, 2);
  // skeletal fingers
  [-0.6, 0, 0.6].forEach(a => {
    const ang = -Math.PI / 2 + a + (1 - atk) * 0.9;
    line(c, [[hx - 2, hy + 4], [hx - 2 + Math.cos(ang) * 9, hy + 4 + Math.sin(ang) * 9]], bone, 2.2);
  });
  ell(c, hx - 2, hy + 6, 4.5, 4);
  paint(c, css(bone), 0x6a6050, 1.2);
  if (atk > 0.05) {
    glow(c, orbCol, 20);
    ell(c, hx, hy - 8, 6 + atk * 10, 6 + atk * 10);
    const g = c.createRadialGradient(hx, hy - 8, 1, hx, hy - 8, 6 + atk * 10);
    g.addColorStop(0, css(0xffe0ff, 0.95));
    g.addColorStop(0.5, css(orbCol, 0.8));
    g.addColorStop(1, css(0x3a0a6a, 0.0));
    c.fillStyle = g;
    c.fill();
    noGlow(c);
  }
  // pauldrons
  [-1, 1].forEach(s => {
    c.beginPath();
    c.moveTo(s * 12, -140);
    c.quadraticCurveTo(s * 40, -146, s * 42, -128);
    c.lineTo(s * 48, -136);
    c.lineTo(s * 40, -120);
    c.quadraticCurveTo(s * 26, -122, s * 14, -126);
    c.closePath();
    paint(c, vgrad(c, -146, -120, 0x4a2c6c, robeDk), 0x0e0618, 2);
    line(c, [[s * 14, -138], [s * 40, -142], [s * 42, -128]], gold, 1.8, 0.9);
  });
  // hood
  c.beginPath();
  c.moveTo(-22, -128);
  c.quadraticCurveTo(-28, -160, -10, -170);
  c.quadraticCurveTo(0, -174, 10, -170);
  c.quadraticCurveTo(28, -160, 22, -128);
  c.quadraticCurveTo(0, -134, -22, -128);
  c.closePath();
  paint(c, radial(c, -4, -154, 26, 0x40265e, 0.25, 0.4), 0x0e0618, 2);
  // hood shadow
  ell(c, 0, -146, 15, 17);
  c.fillStyle = css(0x0a0412, 0.95);
  c.fill();
  // skull face
  c.beginPath();
  c.moveTo(-11, -152);
  c.quadraticCurveTo(-12, -164, 0, -165);
  c.quadraticCurveTo(12, -164, 11, -152);
  c.quadraticCurveTo(10, -142, 6, -138);
  c.lineTo(-6, -138);
  c.quadraticCurveTo(-10, -142, -11, -152);
  c.closePath();
  paint(c, radial(c, -3, -156, 14, bone, 0.3, 0.3), 0x5a5040, 1.4);
  // sockets + glowing eyes
  [-5, 5].forEach(x => {
    ell(c, x, -152, 3.8, 3.4);
    c.fillStyle = css(0x120818);
    c.fill();
  });
  const eyeR = p.eyes === 'hurt' ? 1.4 : p.eyes === 'x' ? 0.6 : 2.2 + atk * 0.8;
  if (p.eyes !== 'closed') {
    glow(c, eyeCol, 10);
    [-5, 5].forEach(x => {
      ell(c, x, -152, eyeR, eyeR);
      c.fillStyle = css(0xffb0f2);
      c.fill();
    });
    noGlow(c);
  }
  // nose + teeth
  tri(c, -1.5, -146, 1.5, -146, 0, -148.5);
  c.fillStyle = css(0x2a1a20);
  c.fill();
  for (let k = -2; k <= 2; k++) line(c, [[k * 2.2, -142], [k * 2.2, -139]], 0x5a5040, 1);
  // crown
  c.beginPath();
  c.moveTo(-16, -166);
  c.lineTo(-18, -182);
  c.lineTo(-10, -173);
  c.lineTo(-6, -188);
  c.lineTo(0, -175);
  c.lineTo(6, -188);
  c.lineTo(10, -173);
  c.lineTo(18, -182);
  c.lineTo(16, -166);
  c.quadraticCurveTo(0, -170, -16, -166);
  c.closePath();
  paint(c, vgrad(c, -188, -166, 0xfff0b0, dk(gold, 0.15)), 0x5a3a08, 1.6);
  [[-6, -177, 0xc040ff], [0, -171, 0xff3a6a], [6, -177, 0xc040ff]].forEach(([x, y, col]) => {
    glow(c, col, 6);
    ell(c, x, y, 2.2, 2.6);
    c.fillStyle = css(col);
    c.fill();
    noGlow(c);
  });
  orbs(true);
}
function lichPose(p: Pose) {
  if (p.anim === 'idle' || p.anim === 'move') {
    p.bob = 3 + Math.sin(p.t * TAU) * 3;
    p.sq = 1;
  }
  if (p.anim === 'attack') p.bob = 3 + Math.sin(p.t * TAU) * 1.5;
  if (p.anim === 'hit') p.sq = 0.97;
}

function drawFallback(c: Ctx, p: Pose) {
  const col = 0xb08ad8;
  blob(c, 0, -16, 16, 15, 10, 0.05);
  paint(c, radial(c, 0, -16, 16, col), dk(col, 0.5));
  eyes(c, p, -5, 5, -18, 3);
  mouth(c, p, 0, -11, 5, 'smile');
}

const ART: Record<string, ArtDef> = {
  moss_snail: { w: 60, h: 46, draw: drawSnail },
  puff_slime: { w: 60, h: 56, draw: drawSlime, poseMod: slimePose },
  cap_shroom: { w: 64, h: 72, draw: drawCapShroom },
  thorn_shroom: { w: 74, h: 82, draw: drawThornShroom },
  stump_golem: { w: 78, h: 76, draw: drawStump },
  frost_bat: { w: 76, h: 50, draw: drawBat, flyer: true, die: 'fade' },
  snow_yeti: { w: 86, h: 94, draw: drawYeti },
  ice_wisp: { w: 60, h: 64, draw: drawIceWisp, flyer: true, die: 'fade', poseMod: wispPose },
  ember_imp: { w: 60, h: 62, draw: drawImp, poseMod: impPose },
  lava_salamander: { w: 104, h: 52, draw: drawSalamander },
  magma_golem: { w: 106, h: 104, draw: drawMagmaGolem },
  storm_harpy: { w: 92, h: 66, draw: drawHarpy, flyer: true, die: 'fade' },
  crag_golem: { w: 112, h: 110, draw: drawCragGolem },
  thunder_drake: { w: 126, h: 94, draw: drawDrake, flyer: true, die: 'fade' },
  void_wisp: { w: 60, h: 64, draw: drawVoidWisp, flyer: true, die: 'fade', poseMod: wispPose },
  lich_archon: { w: 160, h: 200, draw: drawLich, attack: true, die: 'fade', poseMod: lichPose },
};

// ───────────────────────────── sheet painting ─────────────────────────────

export interface SheetFrame { name: string; x: number; y: number; w: number; h: number; }
export interface SheetAnim { name: MonsterAnim; frames: string[]; rate: number; repeat: number; }
export interface MonsterSheet { canvas: HTMLCanvasElement; frames: SheetFrame[]; anims: SheetAnim[]; w: number; h: number; }

function poof(c: Ctx, k: number, w: number, h: number) {
  const a = Math.max(0, Math.min(1, (k - 0.35) / 0.65));
  if (a <= 0) return;
  const cy = -h * 0.35;
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * TAU + 0.3;
    const d = w * 0.18 + a * w * 0.25;
    const r = (4 + (i % 3) * 2) * (1.2 - a * 0.5);
    ell(c, Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.6, r, r);
    c.fillStyle = `rgba(255,255,255,${0.75 * (1 - a * 0.7)})`;
    c.fill();
  }
}

/** Pure canvas painter (no Phaser needed) — also handy for previewing art. */
export function paintMonsterSheet(id: string): MonsterSheet {
  const art = ART[id] ?? { w: 48, h: 44, draw: drawFallback };
  const anims = ANIMS.filter(a => a.name !== 'attack' || art.attack);
  const W = art.w, H = art.h, PAD = 2;
  const cols = Math.max(...anims.map(a => a.frames));
  const canvas = document.createElement('canvas');
  canvas.width = cols * (W + PAD) + PAD;
  canvas.height = anims.length * (H + PAD) + PAD;
  const c = canvas.getContext('2d')!;
  const frames: SheetFrame[] = [];
  const outAnims: SheetAnim[] = [];
  anims.forEach((a, row) => {
    const names: string[] = [];
    for (let i = 0; i < a.frames; i++) {
      const fx = PAD + i * (W + PAD), fy = PAD + row * (H + PAD);
      const name = `${a.name}_${i}`;
      const p = makePose(a.name, i, a.frames, !!art.flyer);
      art.poseMod?.(p);
      c.save();
      c.beginPath();
      c.rect(fx, fy, W, H);
      c.clip();
      c.translate(fx + W / 2, fy + H - MONSTER_FOOT_PAD);
      c.save();
      if (a.name === 'die') {
        const k = p.k;
        if ((art.die ?? 'squash') === 'squash') {
          c.globalAlpha = 1 - Math.max(0, k - 0.45) * 1.5;
          c.scale(1 + 0.28 * k, 1 - 0.5 * k);
        } else {
          c.globalAlpha = 1 - Math.max(0, k - 0.3) * 1.25;
          c.translate(0, -H * 0.4);
          c.rotate(k * 0.35);
          c.scale(1 - 0.2 * k, 1 - 0.2 * k);
          c.translate(0, H * 0.4 + k * 4);
        }
      } else if (a.name === 'hit') {
        c.translate(-2, 0);
        c.rotate(-0.06);
      }
      c.translate(0, -p.bob);
      c.scale(p.sq, 1 / p.sq);
      try { art.draw(c, p); } catch (e) { console.warn(`[monsterArt] ${id} ${name}`, e); }
      c.restore();
      if (a.name === 'die') poof(c, p.k, W, H);
      c.restore();
      frames.push({ name, x: fx, y: fy, w: W, h: H });
      names.push(name);
    }
    outAnims.push({ name: a.name, frames: names, rate: a.rate, repeat: a.repeat });
  });
  return { canvas, frames, anims: outAnims, w: W, h: H };
}

function registerSheet(scene: Phaser.Scene, key: string, sheet: { canvas: HTMLCanvasElement; frames: SheetFrame[] }): boolean {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, sheet.canvas);
  if (!tex) return false;
  for (const f of sheet.frames) tex.add(f.name, 0, f.x, f.y, f.w, f.h);
  return true;
}

function addAnim(scene: Phaser.Scene, animKey: string, texKey: string, frames: string[], rate: number, repeat: number) {
  if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
  scene.anims.create({ key: animKey, frames: frames.map(f => ({ key: texKey, frame: f })), frameRate: rate, repeat });
}

// ───────────────────────────── FX + drop textures ─────────────────────────────

function canvasOf(w: number, h: number, fn: (c: Ctx) => void): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  fn(c);
  return cv;
}
/** While true, the procedural FX painters keep any texture the pixel pipeline already produced. */
let keepExisting = false;
function addSimple(scene: Phaser.Scene, key: string, cv: HTMLCanvasElement) {
  if (scene.textures.exists(key)) { if (keepExisting) return; scene.textures.remove(key); }
  scene.textures.addCanvas(key, cv);
}
function softDot(c: Ctx, x: number, y: number, r: number, inner: string, outer: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, inner);
  g.addColorStop(1, outer);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}
function star4(c: Ctx, x: number, y: number, r: number, ri: number) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : ri;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
}
function star5(c: Ctx, x: number, y: number, r: number, ri: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : ri;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
}

const COIN_COLORS = {
  bronze: { base: 0xd08a4a, hi: 0xffd2a0, dk: 0x7a4a1a },
  silver: { base: 0xc8d2de, hi: 0xffffff, dk: 0x6a7686 },
  gold: { base: 0xffc93a, hi: 0xfff2b0, dk: 0x9a6a08 },
};

/** Procedural (smooth) FX + drop textures — the fallback layer; pixel versions overwrite these keys. */
function generateProceduralFxTextures(scene: Phaser.Scene) {
  addSimple(scene, MFX.ember, canvasOf(10, 10, c => softDot(c, 5, 5, 5, 'rgba(255,230,140,1)', 'rgba(255,90,20,0)')));
  addSimple(scene, MFX.glow, canvasOf(32, 32, c => softDot(c, 16, 16, 16, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)')));
  addSimple(scene, MFX.spark, canvasOf(16, 16, c => {
    glow(c, 0xfff27a, 4);
    star4(c, 8, 8, 7, 1.6);
    c.fillStyle = css(0xfffbd0);
    c.fill();
  }));
  addSimple(scene, MFX.star, canvasOf(16, 16, c => {
    star5(c, 8, 8.5, 7, 3);
    c.fillStyle = css(0xffe45a);
    c.fill();
    c.lineWidth = 1.2;
    c.strokeStyle = css(0xb8860b);
    c.stroke();
    ell(c, 6.5, 6.5, 1.5, 1.2);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fill();
  }));
  addSimple(scene, MFX.snow, canvasOf(8, 8, c => {
    line(c, [[4, 0.5], [4, 7.5]], 0xffffff, 1.2);
    line(c, [[0.5, 4], [7.5, 4]], 0xffffff, 1.2);
    line(c, [[1.5, 1.5], [6.5, 6.5]], 0xdff4ff, 1);
    line(c, [[6.5, 1.5], [1.5, 6.5]], 0xdff4ff, 1);
  }));
  addSimple(scene, MFX.puff, canvasOf(32, 32, c => softDot(c, 16, 16, 15, 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)')));
  addSimple(scene, MFX.shard, canvasOf(10, 16, c => {
    c.beginPath();
    c.moveTo(5, 0.5); c.lineTo(9.5, 8); c.lineTo(5, 15.5); c.lineTo(0.5, 8); c.closePath();
    paint(c, vgrad(c, 0, 16, 0xffffff, 0x9fdcff, 0.95), 0x5aa8e0, 1);
  }));
  // Ice shell (scaled to each monster): faceted translucent crystal block, feet at bottom.
  addSimple(scene, MFX.crystal, canvasOf(64, 72, c => {
    c.beginPath();
    c.moveTo(6, 70); c.lineTo(2, 38); c.lineTo(12, 10); c.lineTo(26, 2); c.lineTo(40, 8);
    c.lineTo(54, 4); c.lineTo(62, 30); c.lineTo(58, 70); c.closePath();
    const g = c.createLinearGradient(0, 0, 64, 72);
    g.addColorStop(0, 'rgba(240,252,255,0.75)');
    g.addColorStop(0.5, 'rgba(160,220,255,0.45)');
    g.addColorStop(1, 'rgba(110,180,240,0.6)');
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(230,248,255,0.95)';
    c.stroke();
    line(c, [[12, 10], [22, 40], [6, 70]], 0xffffff, 1.2, 0.6);
    line(c, [[40, 8], [36, 38], [58, 70]], 0xffffff, 1.2, 0.5);
    line(c, [[22, 40], [36, 38]], 0xffffff, 1.2, 0.5);
    shine(c, 18, 22, 4, 10, 0.55, 0.35);
  }));
  // Boss orb projectile.
  addSimple(scene, MFX.orb, canvasOf(32, 32, c => {
    softDot(c, 16, 16, 16, 'rgba(200,90,255,0.55)', 'rgba(120,20,200,0)');
    const g = c.createRadialGradient(13, 13, 1, 16, 16, 9);
    g.addColorStop(0, css(0xffe0ff));
    g.addColorStop(0.45, css(0xa040ff));
    g.addColorStop(1, css(0x2a0a4a));
    c.fillStyle = g;
    c.beginPath();
    c.arc(16, 16, 9, 0, TAU);
    c.fill();
  }));
  addSimple(scene, MFX.aura, canvasOf(128, 128, c => softDot(c, 64, 64, 64, 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)')));
  // Coins: 4 spin frames each (20×20).
  (['bronze', 'silver', 'gold'] as const).forEach(tier => {
    if (keepExisting && scene.textures.exists(DROP_TEX[tier])) return;
    const col = COIN_COLORS[tier];
    const S = 20, N = 4;
    const cv = canvasOf(S * N, S, c => {
      for (let i = 0; i < N; i++) {
        const sx = Math.max(0.18, Math.abs(Math.cos((i / N) * Math.PI)));
        const cx = i * S + S / 2, cy = S / 2;
        ell(c, cx, cy, 8 * sx, 8);
        paint(c, radial(c, cx, cy, 8, col.base, 0.5, 0.2), col.dk, 1.6);
        if (sx > 0.5) {
          ell(c, cx, cy, 4.6 * sx, 4.6);
          c.lineWidth = 1.2;
          c.strokeStyle = css(col.dk, 0.7);
          c.stroke();
          ell(c, cx - 2.5 * sx, cy - 3, 1.6 * sx, 1.2);
          c.fillStyle = css(col.hi, 0.95);
          c.fill();
        } else {
          line(c, [[cx, cy - 6], [cx, cy + 6]], col.hi, 1, 0.8);
        }
      }
    });
    const key = DROP_TEX[tier];
    const frames: SheetFrame[] = [];
    for (let i = 0; i < N; i++) frames.push({ name: `f${i}`, x: i * S, y: 0, w: S, h: S });
    if (registerSheet(scene, key, { canvas: cv, frames })) {
      addAnim(scene, dropCoinAnimKey(tier), key, frames.map(f => f.name), 8, -1);
    }
  });
  addSimple(scene, DROP_TEX.bag, canvasOf(28, 28, c => {
    c.beginPath();
    c.moveTo(9, 9);
    c.quadraticCurveTo(2, 14, 4, 21);
    c.quadraticCurveTo(6, 27, 14, 27);
    c.quadraticCurveTo(22, 27, 24, 21);
    c.quadraticCurveTo(26, 14, 19, 9);
    c.closePath();
    paint(c, radial(c, 14, 19, 11, 0xc89a5a), 0x5a3a14, 1.6);
    c.beginPath();
    c.moveTo(9, 9); c.lineTo(7, 3); c.lineTo(14, 6); c.lineTo(21, 3); c.lineTo(19, 9); c.closePath();
    paint(c, css(0xb08048), 0x5a3a14, 1.4);
    line(c, [[8, 9.5], [20, 9.5]], 0xffc93a, 2);
    ell(c, 14, 19, 5, 5);
    paint(c, radial(c, 14, 19, 5, 0xffc93a), 0x9a6a08, 1.2);
    shine(c, 9, 15, 2.5, 1.6, 0.5);
  }));
}


/** Generic fallback monster (used only when a monster's own sheet is missing). Built on first need. */
export function ensureFallbackMonster(scene: Phaser.Scene): void {
  if (scene.textures.exists(MFX.fallback)) return;
  const fb = paintMonsterSheet('__fallback__');
  if (registerSheet(scene, MFX.fallback, fb)) {
    for (const a of fb.anims) addAnim(scene, `${MFX.fallback}_${a.name}`, MFX.fallback, a.frames, a.rate, a.repeat);
  }
}

/** "?" token for items without an icon (DropManager). Built on first need. */
export function ensureDropFallback(scene: Phaser.Scene): void {
  if (scene.textures.exists(DROP_TEX.fallback)) return;
  addSimple(scene, DROP_TEX.fallback, canvasOf(28, 28, c => {
    ell(c, 14, 14, 11, 11);
    paint(c, radial(c, 14, 14, 11, 0xa08ad8), 0x4a3a7a, 1.6);
    c.fillStyle = '#ffffff';
    c.font = 'bold 14px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('?', 14, 15);
  }));
}


// ═════════════════════════════ 16-bit pixel pipeline ═════════════════════════════

type Rgb = [number, number, number];
/** In-place recolor of a sheet's RGBA pixels (palette swap). */
type Recolor = (d: Uint8ClampedArray) => void;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): Rgb {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
const lum = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
/** Hue-range test (degrees, wraps through 0). */
function inHue(h: number, lo: number, hi: number): boolean {
  return lo <= hi ? h >= lo && h <= hi : h >= lo || h <= hi;
}
interface PixFilter { hue?: [number, number]; minSat?: number; maxSat?: number; minLum?: number; maxLum?: number }
function passes(f: PixFilter | undefined, r: number, g: number, b: number): boolean {
  if (!f) return true;
  const [h, s] = rgbToHsl(r, g, b);
  const l = lum(r, g, b);
  if (f.hue && !inHue(h, f.hue[0], f.hue[1])) return false;
  if (f.minSat !== undefined && s < f.minSat) return false;
  if (f.maxSat !== undefined && s > f.maxSat) return false;
  if (f.minLum !== undefined && l < f.minLum) return false;
  if (f.maxLum !== undefined && l > f.maxLum) return false;
  return true;
}
/**
 * Gradient map: each (filtered) pixel's luminance is normalised over the sheet and mapped onto a colour ramp.
 * Source palettes are small, so the result stays a small palette (no new shades are invented per pixel).
 */
function gradientMap(stops: number[], filter?: PixFilter): Recolor {
  return d => {
    let lo = 1, hi = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8 || !passes(filter, d[i], d[i + 1], d[i + 2])) continue;
      const l = lum(d[i], d[i + 1], d[i + 2]);
      if (l < lo) lo = l;
      if (l > hi) hi = l;
    }
    const span = Math.max(0.05, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8 || !passes(filter, d[i], d[i + 1], d[i + 2])) continue;
      const t = Math.min(1, Math.max(0, (lum(d[i], d[i + 1], d[i + 2]) - lo) / span)) * (stops.length - 1);
      const k = Math.min(stops.length - 2, Math.floor(t)), f = t - k;
      const c = mix(stops[k], stops[k + 1], f);
      d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255;
    }
  };
}
function hueShift(deg: number, satMul = 1, lightMul = 1, filter?: PixFilter): Recolor {
  return d => {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8 || !passes(filter, d[i], d[i + 1], d[i + 2])) continue;
      const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      const [r, g, b] = hslToRgb(h + deg, Math.min(1, s * satMul), Math.min(1, l * lightMul));
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  };
}
/**
 * Like gradientMap, but with fixed luminance bounds instead of the sheet's own range — for big shared sheets
 * (the icon atlas) where the sheet-wide range says nothing about the few cells we cut.
 */
function rampMap(stops: number[], lo: number, hi: number, filter?: PixFilter): Recolor {
  return d => {
    const span = Math.max(0.05, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8 || !passes(filter, d[i], d[i + 1], d[i + 2])) continue;
      const t = Math.min(1, Math.max(0, (lum(d[i], d[i + 1], d[i + 2]) - lo) / span)) * (stops.length - 1);
      const k = Math.min(stops.length - 2, Math.floor(t)), f = t - k;
      const c = mix(stops[k], stops[k + 1], f);
      d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255;
    }
  };
}
/**
 * Ghostly translucency for a uniform-grid sheet `sheetW` px wide with `cellH`-tall rows: every opaque pixel gets
 * alpha `a`, and the bottom `fadeRows` rows of each cell fade out in hard 1px bands (no smooth gradient).
 */
function ghostly(sheetW: number, cellH: number, a: number, fadeRows: number): Recolor {
  return d => {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const y = Math.floor(i / 4 / sheetW) % cellH;
      const tail = y - (cellH - fadeRows);
      const k = tail < 0 ? 1 : Math.max(0, 1 - (tail + 1) / (fadeRows + 1));
      d[i + 3] = Math.round(Math.min(d[i + 3], a) * k);
    }
  };
}
const chain = (...fns: Recolor[]): Recolor => d => fns.forEach(f => f(d));

/** Element / biome ramps (dark → light). */
const RAMP = {
  ice: [0x0c1838, 0x1f4f8f, 0x3f93d6, 0x8fd8f6, 0xe4fbff],
  snowFur: [0x3a4a6e, 0x7d97c0, 0xbcd2ec, 0xf2f8ff],
  void: [0x0a0412, 0x2c0a52, 0x7a1ec8, 0xe85cff, 0x9ff4ff],
  lava: [0x5a1008, 0xc8300e, 0xff6a1e, 0xffb43c, 0xfff4a8],
  magma: [0x120808, 0x241414, 0x3a1e1a, 0x5a2a1e, 0xa83a14, 0xff8a1e, 0xffe070],
  crag: [0x1c1a22, 0x45414c, 0x736c6a, 0xa79d8c, 0xe2d9c2],
  storm: [0x140c2c, 0x352a80, 0x6656d6, 0xb4a6ff, 0xfff2a0],
  thunder: [0x14143a, 0x2e3aa8, 0x4f74f0, 0x96b4ff, 0xe4ecff],
  arcaneFire: [0x2a0a5a, 0x7a24d0, 0xc86cff, 0xffc8ff, 0xffffff],
};

interface FrameRef { key: string; x: number; y: number; w: number; h: number; ax: number; ay: number; dy?: number }
/** Frames of a uniform grid sheet: `cols` per row, anchor (ax = body centre x, ay = feet y) inside each cell. */
const grid = (key: string, fw: number, fh: number, cols: number, ax: number, ay: number) =>
  (...idx: number[]): FrameRef[] => idx.map(i => ({ key, x: (i % cols) * fw, y: Math.floor(i / cols) * fh, w: fw, h: fh, ax, ay }));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

interface PixelAnim { frames: FrameRef[]; rate: number; repeat?: number }
/**
 * Hard-edged pixel overlay (crown, horns, glow) drawn at 1× onto every frame before scaling, so it shares the
 * sprite's pixel grid. Anchored per frame: 'peak' = centre of the topmost opaque row (sits on top of the head),
 * 'front' = topmost pixel of the rightmost opaque column (the snout, art faces right), 'anchor' = the frame's own
 * feet anchor (ax, ay) — for features fixed on the body when the silhouette's edges flicker (flames, sparks).
 * Bottom-centre of the overlay goes to anchor + (dx, dy).
 */
interface Overlay { rows: string[]; pal: Record<string, number>; at: 'peak' | 'front' | 'anchor'; dx?: number; dy?: number; skip?: MonsterAnim[] }
interface PixelSpec {
  /** Integer scale (defaults to PIXEL_SCALE). */
  scale?: number;
  /** Source art faces LEFT (we flip it so every texture faces right). */
  flip?: boolean;
  recolor?: Recolor;
  /** Add a 1px outline of this colour (for sources drawn without one). */
  outline?: number;
  idle: PixelAnim;
  move: PixelAnim;
  /** Base frame for the hit flash (default idle[0]). */
  hit?: FrameRef;
  /** Source death frames; otherwise a fade + pixel poof is derived. */
  die?: PixelAnim;
  attack?: PixelAnim;
  overlays?: Overlay[];
}

function buildPixelSpecs(): Record<string, PixelSpec> {
  const snail = grid(MSRC.snail, 32, 32, 7, 16, 28);
  const slime = grid(MSRC.slime, 24, 24, 3, 12, 20);
  const shWalk = grid(MSRC.shroomWalk, 41, 30, 10, 20, 30);
  const shIdle = grid(MSRC.shroomIdle, 63, 37, 4, 19, 37);
  const shGas = grid(MSRC.shroomBreath, 63, 37, 10, 19, 37);
  const stump = grid(MSRC.stump, 32, 48, 4, 16, 48);
  const batFly = grid(MSRC.batFly, 64, 64, 4, 32, 44);
  const batHit = grid(MSRC.batHit, 64, 64, 4, 32, 44);
  const batDie = grid(MSRC.batDeath, 64, 64, 4, 32, 44);
  // Death frames 8–10 fall to source row 47 (below the fly anchor 44) and were clipped by the cell's foot pad;
  // anchor just those at 48 so they stay in the cell, while 0–7 keep 44 (no 8px jump when the death anim starts).
  const batDieLow = grid(MSRC.batDeath, 64, 64, 4, 32, 48);
  const wartaur = grid(MSRC.wartaur, 80, 80, 4, 48, 80);
  const sparky = grid(MSRC.sparky, 16, 16, 5, 8, 16);
  const imp = grid(MSRC.imp, 32, 32, 10, 16, 32);
  const lzIdle = grid(MSRC.lizardIdle, 64, 32, 4, 15, 32);
  const lzWalk = grid(MSRC.lizardWalk, 64, 32, 6, 15, 32);
  const lzHurt = grid(MSRC.lizardHurt, 64, 32, 3, 15, 32);
  const golem = grid(MSRC.golem, 64, 72, 6, 41, 72);
  const bird = grid(MSRC.bird, 32, 32, 7, 15, 30);
  const dragon = grid(MSRC.dragon, 144, 64, 6, 96, 64);
  const wizard = grid(MSRC.wizard, 81, 66, 15, 39, 66);

  // Cross-domain sources (already preloaded by the vfx / ui manifests; read-only here, palette-swapped copies).
  // Only the flickering top 26 rows of the fire: a round wisp head, its tail faded out by ghostly().
  const flame = grid(XSRC.brightfire, 18, 26, 12, 9, 25);
  const inkBody = grid(XSRC.icegolem, 36, 46, 4, 18, 46);
  const icon = grid(XSRC.icons, 34, 34, 12, 17, 30);
  const wizBob = (dys: number[]) => wizard(...range(0, dys.length - 1)).map((f, i) => ({ ...f, dy: dys[i] }));
  const bob = (fs: FrameRef[], dys: number[]) => fs.map((f, i) => ({ ...f, dy: dys[i % dys.length] }));
  const OPEN_BOOK = 10 * 12 + 9, SPELL_BOOK = 4 * 12 + 8;

  const thornCap = hueShift(36, 1.05, 1.05, { hue: [320, 25], minSat: 0.25 });
  const golemIdle = { frames: golem(0, 0, 2, 2), rate: 2 };
  const golemMove = { frames: golem(...range(6, 11)), rate: 7 };
  return {
    // ── whisperwood ──
    moss_snail: { idle: { frames: snail(14, 15, 16, 15), rate: 3 }, move: { frames: snail(14, 15, 16, 15), rate: 7 },
      recolor: hueShift(38, 0.85, 0.95, { hue: [10, 45], minSat: 0.15 }) },
    puff_slime: { idle: { frames: slime(0, 1, 2, 1), rate: 6 }, move: { frames: slime(3, 4, 5, 4), rate: 9 }, hit: slime(6)[0] },
    cap_shroom: { idle: { frames: shIdle(0, 1, 2, 3), rate: 6 }, move: { frames: shWalk(...range(0, 9)), rate: 12 } },
    // ── shroom_hollow ──
    thorn_shroom: { recolor: thornCap, idle: { frames: shGas(...range(0, 9)), rate: 8 },
      move: { frames: shWalk(...range(0, 9)), rate: 13 }, hit: shIdle(2)[0] },
    stump_golem: { recolor: gradientMap([0x2e180a, 0x5c3618, 0x8c5e30, 0xc89a5c, 0xf2dca4], { hue: [0, 42], minSat: 0.12 }), idle: { frames: stump(8, 10), rate: 2 }, move: { frames: stump(8, 9, 10, 11), rate: 6 } },
    // ── frostfang_cliffs ──
    frost_bat: { recolor: gradientMap(RAMP.ice), idle: { frames: batFly(0, 1, 2, 3), rate: 9 }, move: { frames: batFly(0, 1, 2, 3), rate: 12 },
      hit: batHit(1)[0], die: { frames: [...batDie(...range(0, 7)), ...batDieLow(8, 9, 10)], rate: 15 } },
    snow_yeti: { flip: true, recolor: gradientMap(RAMP.snowFur, { hue: [8, 48], minSat: 0.15 }),
      idle: { frames: wartaur(0, 2), rate: 2 }, move: { frames: wartaur(0, 1, 2, 3), rate: 7 } },
    ice_wisp: { recolor: gradientMap(RAMP.ice), idle: { frames: sparky(0, 1, 2, 3), rate: 10 }, move: { frames: sparky(0, 1, 2, 3), rate: 13 } },
    // ── cinder_caverns ──
    ember_imp: { recolor: hueShift(18, 1.15, 1.3), outline: 0x2a0806, idle: { frames: imp(...range(0, 9)), rate: 10 }, move: { frames: imp(...range(20, 29)), rate: 15 },
      hit: imp(10)[0], die: { frames: imp(...range(40, 49)), rate: 15 } },
    lava_salamander: { recolor: gradientMap(RAMP.lava), outline: 0x1e0604, idle: { frames: lzIdle(0, 1, 2, 3), rate: 5 },
      move: { frames: lzWalk(...range(0, 5)), rate: 12 }, hit: lzHurt(1)[0] },
    magma_golem: { flip: true, recolor: gradientMap(RAMP.magma), idle: golemIdle, move: golemMove },
    // ── stormspire_peak ──
    storm_harpy: { recolor: gradientMap(RAMP.storm), idle: { frames: bird(...range(0, 6)), rate: 11 }, move: { frames: bird(...range(0, 6)), rate: 14 } },
    crag_golem: { flip: true, recolor: gradientMap(RAMP.crag), idle: golemIdle, move: golemMove },
    thunder_drake: { flip: true, recolor: chain(gradientMap([0x8a6a14, 0xd8a820, 0xfff27a, 0xfffbd8], { hue: [28, 58], minSat: 0.45, minLum: 0.4 }), gradientMap(RAMP.thunder, { hue: [62, 36] })),
      idle: { frames: dragon(...range(0, 5)), rate: 8 }, move: { frames: dragon(...range(0, 5)), rate: 11 } },
    // ── moonlit_marsh ──
    // Bog Toad: the side-view slime in bog greens, with bulging toad eyes stamped on top.
    bog_toad: { recolor: gradientMap([0x10180a, 0x2a4214, 0x4e7024, 0x86a83e, 0xc8dc7a]),
      idle: { frames: slime(3, 4, 5, 4), rate: 5 }, move: { frames: slime(3, 4, 5, 4), rate: 10 },
      overlays: [
        { at: 'peak', dx: 3, dy: 3, rows: [
          '.ooo...ooo.',
          'oGGGo.oGGGo',
          'oGYWo.oGYWo',
          'oYkko.oYkko',
          '.ooo...ooo.',
        ], pal: { o: 0x10180a, G: 0xa8cc54, Y: 0xf0d84a, W: 0xfffbe0, k: 0x10180a } },
        { at: 'anchor', dx: 6, dy: -4, rows: ['kkkkkkk.', '.....kk'], pal: { k: 0x10180a } },
      ] },
    // Will-o'-Wisp: the flickering top of CodeManu's bright fire in pale marsh-ghost greens (outlined so it reads on
    // dark water), its tail fading into mist, two coal eyes.
    will_o_wisp: { recolor: chain(gradientMap([0x1f9a64, 0x46e098, 0x9cf8c8, 0xe0fff0, 0xffffff]), ghostly(216, 26, 240, 9)), outline: 0x0a3a2a,
      idle: { frames: flame(...range(0, 11)), rate: 11 }, move: { frames: flame(...range(0, 11)), rate: 15 },
      overlays: [{ at: 'anchor', dx: 0, dy: -7, rows: ['kk.kk', 'kk.kk'], pal: { k: 0x0a3a2a } }] },
    // ── glacier_grotto ──
    // Crystal Crab: a hermit in a geode — the snail's shell turned to grotto crystal, body to frost-lilac,
    // with crystal spurs on the shell and a pincer stamped at the front.
    crystal_crab: { recolor: chain(
        gradientMap([0x0c2a48, 0x2a6aa8, 0x5ab8e8, 0xb0ecff, 0xffffff], { hue: [10, 45], minSat: 0.15 }),
        gradientMap([0x1a1030, 0x3a2a6a, 0x6a5aa8, 0xa898e0, 0xe8e0ff], { hue: [60, 160], minSat: 0.2 })),
      idle: { frames: snail(14, 15, 16, 15), rate: 3 }, move: { frames: snail(14, 15, 16, 15), rate: 8 },
      overlays: [
        { at: 'peak', dx: -2, dy: 3, rows: [
          '...k.......',
          '..kWk...k..',
          '..kWck.kWk.',
          '.kWcCk.kcCk',
          'kkcCCkkkcCk',
        ], pal: { k: 0x0c1838, W: 0xffffff, c: 0x8fd8f6, C: 0x3f93d6 } },
        // raised pincer in front of the head
        { at: 'anchor', dx: 16, dy: -2, rows: [
          '..k.k..',
          '.kWkPk.',
          'kWk.kPk',
          'kPk.kPk',
          'kPPkPPk',
          'kPPPPPk',
          '.kPPPk.',
          '..kPk..',
          '.kPk...',
          '.kPk...',
        ], pal: { k: 0x1a1030, P: 0xb4a6ec, W: 0xffffff } },
      ] },
    // Frost Shade: the Gothicvania cultist as a frozen ghost — ice ramp, translucent, robe hem fading into mist.
    frost_shade: { flip: true,
      recolor: chain(gradientMap([0x1a3468, 0x3f7cc4, 0x86c4ee, 0xcdeefc, 0xffffff]), ghostly(1215, 66, 210, 9)),
      idle: { frames: wizBob([0, 1, 2, 2, 1]), rate: 6 }, move: { frames: wizBob([0, 1, 2, 2, 1]), rate: 8 },
      overlays: [{ at: 'peak', dx: 1, dy: 8, rows: ['W.W'], pal: { W: 0xf4ffff } }] },
    // ── restricted_stacks ──
    // Animated Tome: the icon atlas's open book and spell book, in old parchment and violet ink, snapping as it flies.
    animated_tome: { recolor: chain(
        rampMap([0x2a0a5a, 0x6a2ac8, 0xb46cff, 0xf0c8ff], 0.35, 0.9, { hue: [235, 320], minSat: 0.12 }),
        rampMap([0x4a3018, 0x9a7444, 0xd8bc84, 0xf4e8c4], 0.3, 1, { maxSat: 0.42, minLum: 0.28 })),
      idle: { frames: bob(icon(OPEN_BOOK, OPEN_BOOK, OPEN_BOOK, OPEN_BOOK), [0, 1, 2, 1]), rate: 5 },
      move: { frames: bob(icon(OPEN_BOOK, SPELL_BOOK, OPEN_BOOK, SPELL_BOOK), [0, 2, 1, 3]), rate: 8 },
      hit: icon(SPELL_BOOK)[0],
      overlays: [{ at: 'anchor', dx: 1, dy: -11, rows: [
        'k.......k',
        '.kk...kk.',
        '.kRk.kRk.',
        '..k...k..',
      ], pal: { k: 0x1a0a2a, R: 0xe8203a } }] },
    // Ink Golem: tautomer's shard golem flooded with ink — near-black indigo with a wet violet sheen, candle eyes.
    ink_golem: { recolor: gradientMap([0x06050e, 0x161334, 0x2c2668, 0x4f46b0, 0x9a8ef0, 0xe8e4ff]), outline: 0x05040a,
      idle: { frames: inkBody(0, 1, 2, 3), rate: 4 }, move: { frames: inkBody(0, 1, 2, 3), rate: 8 },
      overlays: [{ at: 'peak', dx: 1, dy: 14, rows: ['YY..YY', 'yy..yy'], pal: { Y: 0xfff4b0, y: 0xffc840 } }] },
    // ── arcane_sanctum ──
    void_wisp: { recolor: gradientMap(RAMP.void), idle: { frames: sparky(0, 1, 2, 3), rate: 9 }, move: { frames: sparky(0, 1, 2, 3), rate: 12 } },
    lich_archon: { scale: 4, flip: true, recolor: gradientMap(RAMP.arcaneFire, { hue: [10, 70], minSat: 0.45, minLum: 0.3 }),
      idle: { frames: wizard(...range(0, 4)), rate: 7 }, move: { frames: wizard(...range(0, 4)), rate: 9 },
      attack: { frames: wizard(...range(5, 14)), rate: 15 } },
    // ── field bosses (palette swaps of the zone's own sheets at ×3/×4 + 1× pixel overlays) ──
    mossback_matriarch: { scale: 4,
      recolor: chain(gradientMap([0x1a2418, 0x34482a, 0x5a7440, 0x8ca460, 0xd0e0a0], { hue: [10, 45], minSat: 0.15 }),
        hueShift(38, 0.95, 0.85, { hue: [60, 160], minSat: 0.2 })),
      idle: { frames: snail(14, 15, 16, 15), rate: 3 }, move: { frames: snail(14, 15, 16, 15), rate: 6 },
      // Shell-spin: side → front → other side → back, a turntable spin of the source's four views.
      attack: { frames: snail(14, 0, 7, 21), rate: 14, repeat: -1 },
      overlays: [{ at: 'peak', dy: 2, rows: [
        '.p...y...p.',
        'pwp.yoy.pwp',
        'gpgGgygGgpg',
        '.GgG.G.GgG.',
      ], pal: { p: 0xff7ab8, w: 0xffe0f0, y: 0xffe060, o: 0xff9a30, g: 0x6ab04a, G: 0x2e5a26 } }] },
    shroom_monarch: { scale: 4,
      recolor: gradientMap([0x3a0618, 0x8a1030, 0xd02848, 0xff7088, 0xffd0dc], { hue: [320, 25], minSat: 0.25 }),
      idle: { frames: shIdle(0, 1, 2, 3), rate: 5 }, move: { frames: shWalk(...range(0, 9)), rate: 10 },
      attack: { frames: shGas(...range(0, 9)), rate: 12 }, hit: shIdle(2)[0],
      overlays: [{ at: 'peak', dy: 3, rows: CROWN_ROWS, pal: CROWN_PAL }] },
    frostfang_alpha: { scale: 3, flip: true,
      recolor: gradientMap([0x0e1a38, 0x284a86, 0x5a8ad0, 0xa8d4f4, 0xf4fcff], { hue: [8, 48], minSat: 0.15 }),
      idle: { frames: wartaur(0, 2), rate: 2 }, move: { frames: wartaur(0, 1, 2, 3), rate: 6 },
      attack: { frames: wartaur(4, 4, 5, 6, 7, 7), rate: 8 },
      overlays: [{ at: 'peak', dy: 2, rows: [
        '....W....',
        '.W.cWc.W.',
        'cWccWccWc',
        'kbbbbbbbk',
      ], pal: { W: 0xffffff, c: 0x9fe6ff, b: 0x3a8ad0, k: 0x0c2048 } }] },
    magmaw: { scale: 3, flip: true,
      recolor: gradientMap([0x140606, 0x2a1210, 0x4a1e14, 0x8a2a10, 0xe0501a, 0xffa030, 0xfff0a0]),
      idle: golemIdle, move: golemMove, attack: { frames: golem(12, 13, 14, 14, 15, 16, 17, 17), rate: 8 },
      overlays: [{ at: 'peak', dy: 2, rows: [
        '...y...',
        '..yWy..',
        '.oyWyo.',
        '.oYWYo.',
        'roYYYor',
        '.rooor.',
      ], pal: { y: 0xffe070, W: 0xffffff, o: 0xff8a1e, Y: 0xfff4b0, r: 0xc8300e }, skip: ['attack'] }] },
    tempest_wyrm: { scale: 3, flip: true,
      // Wing membranes → electric yellow; scales → storm violet (brighter than the Thunder Drake so it reads at night).
      recolor: chain(gradientMap([0x7a5a10, 0xd8b020, 0xfff27a, 0xffffff], { hue: [22, 58], minSat: 0.3, minLum: 0.22 }),
        gradientMap([0x1c1240, 0x3a2a8a, 0x6656d6, 0xa898ff, 0xece4ff], { hue: [58, 22] })),
      idle: { frames: dragon(...range(0, 5)), rate: 8 }, move: { frames: dragon(...range(0, 5)), rate: 13 },
      overlays: [{ at: 'front', dx: -13, dy: 3, rows: [
        'Y....Y....',
        '.Y....Y...',
        '.YW...YW..',
        '..YW...YW.',
        '...YW...YW',
      ], pal: { Y: 0xfff27a, W: 0xffffff } }] },
    // ── raid boss (archon_spire) ──
    // The Unwritten: the Lich Archon's wizard at ×4 bleached to a blank parchment ghost with ink-black shadows,
    // a blank open book hovering over its head and ink dripping from the hem.
    the_unwritten: { scale: 4, flip: true, outline: 0x1a1430,
      recolor: gradientMap([0x1a1430, 0x4a4060, 0xb8ae98, 0xe8dcc0, 0xfffaf0]),
      idle: { frames: wizard(...range(0, 4)), rate: 6 }, move: { frames: wizard(...range(0, 4)), rate: 8 },
      attack: { frames: wizard(...range(5, 14)), rate: 14 },
      overlays: [
        { at: 'peak', dy: -3, rows: [
          '.kkkkk.kkkkk.',
          'kWWWWWkWWWWWk',
          'kWpWpWkWpWWWk',
          'kWWWWWkWWWpWk',
          'kWpWWWkWWWWWk',
          'kWWWWWkWWWWWk',
          '.kkkkkkkkkkk.',
          '......k......',
        ], pal: { k: 0x1a1430, W: 0xfffaf0, p: 0xd8ccb0 }, skip: ['die'] },
        { at: 'anchor', dx: 0, dy: 0, rows: [
          'k..k...k..k',
          'k......k...',
          '...k.......',
        ], pal: { k: 0x1a1430 }, skip: ['die'] },
      ] },
    // Unwritten Page: the animated tome bleached to blank paper, with ink-slit eyes.
    unwritten_page: { recolor: rampMap([0x4a4060, 0xb8ae98, 0xe8dcc0, 0xfffaf0], 0.2, 1),
      outline: 0x1a1430,
      idle: { frames: bob(icon(OPEN_BOOK, OPEN_BOOK, OPEN_BOOK, OPEN_BOOK), [0, 1, 2, 1]), rate: 6 },
      move: { frames: bob(icon(OPEN_BOOK, SPELL_BOOK, OPEN_BOOK, SPELL_BOOK), [0, 2, 1, 3]), rate: 10 },
      hit: icon(SPELL_BOOK)[0],
      overlays: [{ at: 'anchor', dx: 1, dy: -11, rows: ['kk...kk', '.k...k.'], pal: { k: 0x1a1430 } }] },
  };
}

const CROWN_ROWS = [
  '.k...k...k.',
  'kYk.kWk.kYk',
  'kYYkYYYkYYk',
  'kYYYYYYYYYk',
  'kyRyyByyRyk',
  '.kkkkkkkkk.',
];
const CROWN_PAL: Record<string, number> = { k: 0x5a3008, Y: 0xffd447, W: 0xffffff, y: 0xc8901a, R: 0xe8203a, B: 0x3a7aff };

/** Stamp a spec's overlays onto a cut frame (1×, before scaling). Pads the canvas so overlays may stick out. */
function withOverlays(k: Cut, overlays: Overlay[]): Cut {
  const PAD = 12;
  const src = k.cv;
  const d = src.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, src.width, src.height).data;
  const solid = (x: number, y: number) => d[(y * src.width + x) * 4 + 3] > 20;
  const cv = document.createElement('canvas');
  cv.width = src.width + PAD * 2;
  cv.height = src.height + PAD * 2;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.imageSmoothingEnabled = false;
  c.drawImage(src, PAD, PAD);
  for (const ov of overlays) {
    let ax = -1, ay = -1;
    if (ov.at === 'anchor') {
      ax = k.ax; ay = k.ay;
    } else if (ov.at === 'peak') {
      for (let y = 0; y < src.height && ay < 0; y++) {
        let sx = 0, n = 0;
        for (let x = 0; x < src.width; x++) if (solid(x, y)) { sx += x; n++; }
        if (n) { ay = y; ax = Math.round(sx / n); }
      }
    } else {
      for (let x = src.width - 1; x >= 0 && ax < 0; x--) {
        for (let y = 0; y < src.height; y++) if (solid(x, y)) { ax = x; ay = y; break; }
      }
    }
    if (ax < 0) continue;
    const w = Math.max(...ov.rows.map(r => r.length)), h = ov.rows.length;
    const ox = PAD + ax + (ov.dx ?? 0) - Math.floor(w / 2), oy = PAD + ay + (ov.dy ?? 0) - h;
    ov.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const col = ov.pal[ch];
      if (col === undefined) return;
      c.fillStyle = css(col);
      c.fillRect(ox + x, oy + y, 1, 1);
    }));
  }
  return { ...k, cv, ax: k.ax + PAD, ay: k.ay + PAD, box: alphaBox(cv) };
}
let PIXEL_SPECS: Record<string, PixelSpec> | null = null;

/** Source sheets owned by other art domains (loaded by their manifests), reused here as palette-swap bases. */
const XSRC = {
  brightfire: 'src_vfx_cm_brightfire',
  icegolem: 'src_vfx_icegolem',
  icons: 'src_ui_icons_7soul1',
} as const;

/** Source image → (recoloured) canvas, cached per sheet + recolor. */
function srcCanvas(scene: Phaser.Scene, key: string, recolor: Recolor | undefined, cache: Map<string, HTMLCanvasElement | null>, tag: string): HTMLCanvasElement | null {
  const ck = `${key}|${recolor ? tag : ''}`;
  if (cache.has(ck)) return cache.get(ck)!;
  let out: HTMLCanvasElement | null = null;
  const img = sourceImage(scene, key);
  const iw = img ? (img as HTMLImageElement).naturalWidth || img.width : 0;
  const ih = img ? (img as HTMLImageElement).naturalHeight || img.height : 0;
  if (img && iw > 0 && ih > 0) {
    out = document.createElement('canvas');
    out.width = iw;
    out.height = ih;
    const c = out.getContext('2d', { willReadFrequently: true })!;
    c.imageSmoothingEnabled = false;
    c.drawImage(img, 0, 0);
    if (recolor) {
      const data = c.getImageData(0, 0, iw, ih);
      recolor(data.data);
      c.putImageData(data, 0, 0);
    }
  }
  cache.set(ck, out);
  return out;
}

/** Opaque bounding box of a canvas (alpha > 20), or null if empty. */
function alphaBox(cv: HTMLCanvasElement): { x0: number; y0: number; x1: number; y1: number } | null {
  const d = cv.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, cv.width, cv.height).data;
  let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      if (d[(y * cv.width + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/** One source frame cut out at 1×, flipped to face right; anchor converted accordingly. */
interface Cut { cv: HTMLCanvasElement; ax: number; ay: number; dy: number; box: { x0: number; y0: number; x1: number; y1: number } | null; alpha: number; light: number; poof: number }
function cutFrame(src: HTMLCanvasElement, f: FrameRef, flip: boolean, outline?: number): Cut {
  const o = outline === undefined ? 0 : 1; // 1px border so an added outline has room
  const cv = document.createElement('canvas');
  cv.width = f.w + 2 * o;
  cv.height = f.h + 2 * o;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.imageSmoothingEnabled = false;
  c.save();
  if (flip) { c.translate(cv.width, 0); c.scale(-1, 1); }
  c.drawImage(src, f.x, f.y, f.w, f.h, o, o, f.w, f.h);
  c.restore();
  if (outline !== undefined) {
    // 1px dark outline around the silhouette (4-neighbour), like the hand-outlined packs.
    const img = c.getImageData(0, 0, cv.width, cv.height), d = img.data, W = cv.width, H = cv.height;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 100;
    const add: number[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) add.push((y * W + x) * 4);
      }
    }
    for (const i of add) { d[i] = (outline >> 16) & 255; d[i + 1] = (outline >> 8) & 255; d[i + 2] = outline & 255; d[i + 3] = 255; }
    c.putImageData(img, 0, 0);
  }
  return { cv, ax: (flip ? f.w - f.ax : f.ax) + o, ay: f.ay + o, dy: f.dy ?? 0, box: alphaBox(cv), alpha: 1, light: 0, poof: -1 };
}

/** Per-texture visual extents (screen px) so overlays can sit on the art rather than the hitbox. */
export interface MonsterVisual { contentH: number; contentW: number }
const VISUALS = new Map<string, MonsterVisual>();
export function monsterVisual(textureKey: string): MonsterVisual | null { return VISUALS.get(textureKey) ?? null; }

const POOF_FRAMES = 6, POOF_W = 40, POOF_H = 41;
const DIE_ALPHA = [1, 0.7, 0.4, 0.15, 0, 0];

/** Builds a pixel-art monster sheet from its source pack, or null if a source sheet is missing. */
export function paintPixelMonsterSheet(scene: Phaser.Scene, id: string): (MonsterSheet & { visual: MonsterVisual }) | null {
  PIXEL_SPECS ??= { ...buildPixelSpecs(), ...buildEndgameSpecs() };
  const spec = PIXEL_SPECS[id];
  if (!spec) return null;
  const S = spec.scale ?? PIXEL_SCALE;
  const flip = !!spec.flip;
  const cache = new Map<string, HTMLCanvasElement | null>();
  const cut = (f: FrameRef, anim: MonsterAnim = 'idle'): Cut | null => {
    const src = srcCanvas(scene, f.key, spec.recolor, cache, id);
    if (!src) return null;
    const k = cutFrame(src, f, flip, spec.outline);
    const ovs = spec.overlays?.filter(o => !o.skip?.includes(anim));
    return ovs?.length ? withOverlays(k, ovs) : k;
  };
  const cutAll = (fs: FrameRef[], anim: MonsterAnim = 'idle'): Cut[] | null => {
    const out: Cut[] = [];
    for (const f of fs) { const k = cut(f, anim); if (!k) return null; out.push(k); }
    return out;
  };

  const rows: { name: MonsterAnim; cuts: Cut[]; rate: number; repeat: number }[] = [];
  const idle = cutAll(spec.idle.frames), move = cutAll(spec.move.frames);
  if (!idle || !move || !idle.length || !move.length) return null;
  rows.push({ name: 'idle', cuts: idle, rate: spec.idle.rate, repeat: -1 });
  rows.push({ name: 'move', cuts: move, rate: spec.move.rate, repeat: -1 });
  const hitBase = spec.hit ? cut(spec.hit) : idle[0];
  if (!hitBase) return null;
  rows.push({ name: 'hit', cuts: [{ ...hitBase, light: 0.45 }, { ...hitBase }], rate: 10, repeat: 0 });
  const poofSrc = srcCanvas(scene, MSRC.poof, undefined, cache, '');
  if (spec.die) {
    const d = cutAll(spec.die.frames);
    if (!d) return null;
    rows.push({ name: 'die', cuts: d, rate: spec.die.rate, repeat: 0 });
  } else {
    // Fade the hurt pose out under the Sunny Land poof (its frame 0 is a dark impact blot, so start at 1).
    rows.push({ name: 'die', cuts: DIE_ALPHA.map((a, i) => ({ ...hitBase, alpha: a, light: i === 0 ? 0.35 : 0, poof: poofSrc && i > 0 ? Math.min(POOF_FRAMES - 1, i) : -1 })), rate: 10, repeat: 0 });
  }
  if (spec.attack) {
    const a = cutAll(spec.attack.frames, 'attack');
    if (a) rows.push({ name: 'attack', cuts: a, rate: spec.attack.rate, repeat: spec.attack.repeat ?? 0 });
  }

  // Body centre (for the poof) relative to the feet, from the hit base frame.
  const hb = hitBase.box;
  const bodyUp = hb ? Math.round(((hitBase.ay - hb.y0) * S) / 2) : 16;
  // Frame size: symmetric around the anchor, feet at H - FOOT_PAD.
  let halfW = 8, up = 8, idleUp = 0, idleHalf = 0;
  for (const r of rows) {
    for (const k of r.cuts) {
      if (k.box) {
        const l = (k.ax - k.box.x0) * S, rr = (k.box.x1 - k.ax) * S, u = (k.ay - k.dy - k.box.y0) * S;
        halfW = Math.max(halfW, l, rr);
        up = Math.max(up, u);
        if (r.name === 'idle') { idleUp = Math.max(idleUp, u); idleHalf = Math.max(idleHalf, l, rr); }
      }
      if (k.poof >= 0) {
        halfW = Math.max(halfW, (POOF_W / 2) * S);
        up = Math.max(up, bodyUp + (POOF_H / 2) * S);
      }
    }
  }
  const W = Math.ceil(halfW) * 2 + 2;
  const H = Math.ceil(up) + MONSTER_FOOT_PAD + 2;
  const PAD = 2;
  const cols = Math.max(...rows.map(r => r.cuts.length));
  const canvas = document.createElement('canvas');
  canvas.width = cols * (W + PAD) + PAD;
  canvas.height = rows.length * (H + PAD) + PAD;
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const frames: SheetFrame[] = [];
  const anims: SheetAnim[] = [];
  rows.forEach((r, row) => {
    const names: string[] = [];
    r.cuts.forEach((k, i) => {
      const fx = PAD + i * (W + PAD), fy = PAD + row * (H + PAD);
      const name = `${r.name}_${i}`;
      const feetY = fy + H - MONSTER_FOOT_PAD;
      const ox = fx + W / 2 - k.ax * S, oy = feetY - (k.ay - k.dy) * S;
      let art = k.cv;
      if (k.light > 0) {
        art = document.createElement('canvas');
        art.width = k.cv.width;
        art.height = k.cv.height;
        const lc = art.getContext('2d')!;
        lc.drawImage(k.cv, 0, 0);
        lc.globalCompositeOperation = 'source-atop';
        lc.fillStyle = `rgba(255,255,255,${k.light})`;
        lc.fillRect(0, 0, art.width, art.height);
      }
      if (k.alpha > 0) {
        c.globalAlpha = k.alpha;
        c.drawImage(art, 0, 0, art.width, art.height, ox, oy, art.width * S, art.height * S);
        c.globalAlpha = 1;
      }
      if (k.poof >= 0 && poofSrc) {
        const pw = POOF_W * S, ph = POOF_H * S;
        // Clip to the cell: on short sprites the poof reaches below the feet and would bleed into the next row.
        c.save();
        c.beginPath();
        c.rect(fx, fy, W, H);
        c.clip();
        c.drawImage(poofSrc, k.poof * POOF_W, 0, POOF_W, POOF_H, fx + W / 2 - pw / 2, feetY - bodyUp - Math.floor(ph / 2), pw, ph);
        c.restore();
      }
      frames.push({ name, x: fx, y: fy, w: W, h: H });
      names.push(name);
    });
    anims.push({ name: r.name, frames: names, rate: r.rate, repeat: r.repeat });
  });
  return { canvas, frames, anims, w: W, h: H, visual: { contentH: Math.round(idleUp), contentW: Math.round(idleHalf * 2) } };
}

// ───────────────────────────── pixel FX + drops ─────────────────────────────

/** Paint at 1× on a tiny canvas, then integer-upscale (nearest) — keeps FX on the same pixel grid as the sprites. */
function pixCanvas(w: number, h: number, scale: number, fn: (c: Ctx, px: (x: number, y: number, col: number, a?: number) => void) => void): HTMLCanvasElement {
  const lo = document.createElement('canvas');
  lo.width = w;
  lo.height = h;
  const lc = lo.getContext('2d')!;
  fn(lc, (x, y, col, a = 1) => { lc.fillStyle = css(col, a); lc.fillRect(x, y, 1, 1); });
  const cv = document.createElement('canvas');
  cv.width = w * scale;
  cv.height = h * scale;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.drawImage(lo, 0, 0, w * scale, h * scale);
  return cv;
}
/** Draw a character map: each char looks up a colour (or [colour, alpha]); '.' / ' ' = transparent. */
function pixMap(px: (x: number, y: number, col: number, a?: number) => void, rows: string[], pal: Record<string, number | [number, number]>, ox = 0, oy = 0) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const p = pal[ch];
    if (p === undefined) return;
    if (Array.isArray(p)) px(ox + x, oy + y, p[0], p[1]); else px(ox + x, oy + y, p);
  }));
}
/** Stepped (posterised) radial blob: rings of colour/alpha from the centre out. */
function pixRadial(px: (x: number, y: number, col: number, a?: number) => void, size: number, rings: [number, number, number][]) {
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / (size / 2);
      const ring = rings.find(r => d <= r[0]);
      if (ring) px(x, y, ring[1], ring[2]);
    }
  }
}

function generatePixelFxTextures(scene: Phaser.Scene) {
  const S = PIXEL_SCALE;
  addSimple(scene, MFX.ember, pixCanvas(5, 5, S, (_c, px) => pixMap(px, [
    '.oo..', 'oyyo.', 'oywyo', '.oyo.', '..o..',
  ], { o: [0xff5a14, 0.85], y: 0xffc23a, w: 0xfff4c0 })));
  addSimple(scene, MFX.glow, pixCanvas(16, 16, S, (_c, px) => pixRadial(px, 16, [
    [0.3, 0xffffff, 0.9], [0.55, 0xffffff, 0.55], [0.8, 0xffffff, 0.28], [1, 0xffffff, 0.1],
  ])));
  addSimple(scene, MFX.spark, pixCanvas(8, 8, S, (_c, px) => pixMap(px, [
    '...y....', '...y....', '..yWy...', 'yyWWWyy.', '..yWy...', '...y....', '...y....', '........',
  ], { y: 0xfff27a, W: 0xffffff })));
  addSimple(scene, MFX.star, pixCanvas(8, 8, S, (_c, px) => pixMap(px, [
    '...o....', '...yo...', 'ooyWyoo.', '.oyyyo..', '..yyy...', '.yo.oy..', '.o...o..', '........',
  ], { o: 0xb8760b, y: 0xffd83a, W: 0xffffff })));
  addSimple(scene, MFX.snow, pixCanvas(3, 3, S, (_c, px) => pixMap(px, ['.b.', 'bWb', '.b.'], { b: 0xbfe6ff, W: 0xffffff })));
  addSimple(scene, MFX.puff, pixCanvas(16, 16, S, (_c, px) => pixRadial(px, 16, [
    [0.45, 0xffffff, 0.85], [0.75, 0xffffff, 0.6], [0.95, 0xffffff, 0.3],
  ])));
  addSimple(scene, MFX.shard, pixCanvas(5, 8, S, (_c, px) => pixMap(px, [
    '..o..', '.oWo.', '.oWb.', 'oWbbo', 'obbbo', '.obb.', '.ob..', '..o..',
  ], { o: 0x3a86c8, W: 0xffffff, b: 0xa8dcff })));
  // Ice shell (scaled to each monster by Monster.ts): faceted crystal block, 32×36 → ×2.
  addSimple(scene, MFX.crystal, pixCanvas(32, 36, S, (_c, px) => {
    const poly: [number, number][] = [[3, 35], [1, 19], [6, 5], [13, 1], [20, 4], [27, 2], [31, 15], [29, 35]];
    const inside = (x: number, y: number) => {
      let r = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
      }
      return r;
    };
    for (let y = 0; y < 36; y++) {
      for (let x = 0; x < 32; x++) {
        if (!inside(x + 0.5, y + 0.5)) continue;
        const edge = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5);
        if (edge) { px(x, y, 0xe8f8ff, 0.95); continue; }
        // facets: three bands split by two diagonal crease lines
        const f = x + y * 0.35 < 14 ? 0 : x - y * 0.3 > 17 ? 2 : 1;
        const col = [0xd8f4ff, 0x9fd8fa, 0x6ab4ec][f];
        px(x, y, col, [0.62, 0.45, 0.58][f]);
      }
    }
    for (let i = 0; i < 9; i++) px(7 + Math.floor(i / 3), 9 + i, 0xffffff, 0.75); // glint
    for (let i = 0; i < 4; i++) px(21 + i, 6 + i, 0xffffff, 0.6);
  }));
  // Boss orb projectile.
  addSimple(scene, MFX.orb, pixCanvas(16, 16, S, (_c, px) => pixRadial(px, 16, [
    [0.18, 0xffe8ff, 1], [0.36, 0xd27aff, 1], [0.56, 0x8a2ee0, 1], [0.66, 0x3a0a6a, 1], [0.84, 0xa040ff, 0.45], [1, 0x7820c8, 0.18],
  ])));
  addSimple(scene, MFX.aura, pixCanvas(32, 32, 4, (_c, px) => pixRadial(px, 32, [
    [0.25, 0xffffff, 0.5], [0.5, 0xffffff, 0.34], [0.75, 0xffffff, 0.18], [1, 0xffffff, 0.06],
  ])));

  // ── field boss attack textures (original pixel maps) ──
  addSimple(scene, BFX.icicle, pixCanvas(7, 12, S, (_c, px) => pixMap(px, [
    'kbcWcbk', 'kbcWcbk', '.kcWck.', '.kcWck.', '.kcWbk.', '.kcWbk.', '..cWb..', '..kWk..', '..kWk..', '..kck..', '...k...', '...k...',
  ], { k: 0x1c4a86, b: 0x5aa8e8, c: 0xa8e0ff, W: 0xffffff })));
  addSimple(scene, BFX.glob, pixCanvas(6, 6, S, (_c, px) => pixMap(px, [
    '.kkkk.', 'kgGWgk', 'kGGGgk', 'kGGGgk', 'kgggdk', '.kkkk.',
  ], { k: 0x1e4a14, g: 0x7ad04a, G: 0xa8f070, W: 0xf0ffd0, d: 0x4a9a2a })));
  // Puddle / cloud / wave / rock are grey ramps so each boss tints them (slime green, spores, frost, embers…).
  addSimple(scene, BFX.puddle, pixCanvas(28, 6, S, (_c, px) => pixMap(px, [
    '.....aaaaaaaaaaaaaaaaaa.....',
    '..aaabbbbbbbbbbbbbbbbbbaaa..',
    '.abbbbccbbbbbbcccbbbbbbbbba.',
    'abbbbcWWcbbbbbbbbbbbccbbbbba',
    '.abbbbbbbbbbbbbbbbbbbbbbbba.',
    '...aaaaaaaaaaaaaaaaaaaaaa...',
  ], { a: [0x9a9a9a, 0.9], b: [0xc8c8c8, 0.85], c: [0xeeeeee, 0.9], W: 0xffffff })));
  addSimple(scene, BFX.cloud, pixCanvas(18, 12, S, (_c, px) => pixMap(px, [
    '......aaaa........',
    '....aabbbbaa.aa...',
    '...abbccccbbabba..',
    '..abccWWccbbbcba..',
    '.aabccccccccbccba.',
    'abbbccccccccccbbba',
    'abcccccWccccccccba',
    'abbccccccccccccbba',
    '.abbbccccccccbbba.',
    '..aabbbbbbbbbbaa..',
    '....aaaaaaaaaa....',
    '..................',
  ], { a: [0x8a8a8a, 0.55], b: [0xb8b8b8, 0.7], c: [0xdedede, 0.75], W: [0xffffff, 0.85] })));
  addSimple(scene, BFX.wave, pixCanvas(8, 14, S, (_c, px) => pixMap(px, [
    '....a...', '...ab...', '...abc..', '..abcc..', '..abcW..', '.abbcWc.', '.abcWWc.',
    'abbcWWcc', 'abccWWWc', 'abccWWWc', 'abbcccWc', 'aabbcccc', '.aabbbcc', '..aaaabb',
  ], { a: [0x8a8a8a, 0.6], b: [0xb8b8b8, 0.8], c: [0xe0e0e0, 0.9], W: 0xffffff })));
  addSimple(scene, BFX.rock, pixCanvas(5, 5, S, (_c, px) => pixMap(px, [
    '.aab.', 'abbcb', 'abccb', 'aabbb', '.aaa.',
  ], { a: 0x6a6a6a, b: 0xa8a8a8, c: 0xe8e8e8 })));

  // Coins: zaphgames 16×16 spin sheet (rows gold / silver / bronze) → 12×12 crops ×2, 8 frames each.
  const coinSrc = sourceImage(scene, MSRC.coins);
  if (coinSrc && ((coinSrc as HTMLImageElement).naturalWidth || coinSrc.width) >= 128) {
    (['gold', 'silver', 'bronze'] as const).forEach((tier, row) => {
      const N = 8, C = 12, F = C * S;
      const cv = document.createElement('canvas');
      cv.width = F * N;
      cv.height = F;
      const c = cv.getContext('2d')!;
      c.imageSmoothingEnabled = false;
      for (let i = 0; i < N; i++) c.drawImage(coinSrc, i * 16 + 2, row * 16 + 2, C, C, i * F, 0, F, F);
      if (tier === 'bronze') { // source "bronze" row is a dark chocolate; warm it to copper so it reads on dirt
        const data = c.getImageData(0, 0, cv.width, cv.height);
        gradientMap([0x5a2a10, 0xa85a26, 0xe0954e, 0xffcf96], { minSat: 0.15 })(data.data);
        c.putImageData(data, 0, 0);
      }
      const frames: SheetFrame[] = range(0, N - 1).map(i => ({ name: `f${i}`, x: i * F, y: 0, w: F, h: F }));
      const key = DROP_TEX[tier];
      if (registerSheet(scene, key, { canvas: cv, frames })) addAnim(scene, dropCoinAnimKey(tier), key, frames.map(f => f.name), 10, -1);
    });
  }
  // Meso bag: original 14×14 pixel art (tied sack + gold coin emblem) ×2 = 28×28.
  addSimple(scene, DROP_TEX.bag, pixCanvas(14, 14, S, (_c, px) => pixMap(px, [
    '...k.....k....',
    '...kbk.kbk....',
    '....kbbbk.....',
    '....kyyyk.....',
    '...kbbbbbk....',
    '..kbBBBBBbk...',
    '.kbBBkkkBBbk..',
    '.kbBkGGGkBbk..',
    'kbBBkGYGkBBbk.',
    'kbBBkGGGkBBbk.',
    'kbBBBkkkBBBbk.',
    '.kbBBBBBBBbk..',
    '..kkbbbbbkk...',
    '....kkkkk.....',
  ], { k: 0x3a2410, b: 0x8a5a26, B: 0xc8904a, y: 0xffc93a, G: 0xe8a820, Y: 0xfff2a0 })));
}

/** Every FX / drop key the pixel pipeline is expected to produce (so we know whether the procedural layer is needed). */
function pixelFxComplete(scene: Phaser.Scene): boolean {
  const keys: string[] = [
    ...Object.entries(MFX).filter(([k]) => k !== 'fallback').map(([, v]) => v),
    ...Object.values(BFX), DROP_TEX.bronze, DROP_TEX.silver, DROP_TEX.gold, DROP_TEX.bag,
  ];
  return keys.every(k => scene.textures.exists(k));
}

/**
 * Boot hook: shared FX + drop textures only. Per-monster sheets are built on demand by `ensureMonsterTexture`
 * (Monster ctor / MonsterManager.bindMap), so a map pays only for the monsters it actually spawns.
 * The smooth procedural FX are just the fallback layer: they run only for keys the pixel pipeline didn't produce.
 */
export function generateMonsterTextures(scene: Phaser.Scene): void {
  timed('monsters', () => {
    try { timed('monsters:pixelFx', () => generatePixelFxTextures(scene)); } catch (e) { console.error('[monsterArt] pixel fx textures failed', e); }
    if (!pixelFxComplete(scene)) {
      keepExisting = true;
      try { timed('monsters:procFx', () => generateProceduralFxTextures(scene)); } catch (e) { console.error('[monsterArt] fx textures failed', e); } finally { keepExisting = false; }
    }
  });
}

let monsterIds: Set<string> | null = null;

/**
 * Builds `monster_<id>` + its anims if missing (pixel sheet, else the procedural painter). Idempotent; never throws.
 * Returns true when the texture exists afterwards.
 */
export function ensureMonsterTexture(scene: Phaser.Scene, id: string): boolean {
  const key = monsterTextureKey(id);
  if (scene.textures.exists(key)) return true;
  monsterIds ??= new Set<string>([...MONSTERS.map(m => m.id), ...RAID_BOSSES.map(m => m.id), ...Object.keys(ART)]);
  if (!monsterIds.has(id)) return false;   // unknown ids use the shared fallback sheet
  try {
    let sheet: MonsterSheet | null = null;
    try {
      const px = paintPixelMonsterSheet(scene, id);
      if (px) { sheet = px; VISUALS.set(key, px.visual); }
    } catch (e) {
      console.warn(`[monsterArt] pixel sheet for ${id} failed, using procedural`, e);
    }
    if (!sheet) { sheet = paintMonsterSheet(id); VISUALS.delete(key); }
    if (!registerSheet(scene, key, sheet)) return false;
    for (const a of sheet.anims) addAnim(scene, monsterAnimKey(id, a.name), key, a.frames, a.rate, a.repeat);
    return true;
  } catch (e) {
    console.error(`[monsterArt] ${id} failed`, e);
    return false;
  }
}

// ───────────────────────────── Year 5 endgame monsters (lv 51–67) ─────────────────────────────
// Palette swaps of existing sheets, same grids/anchors as the originals so feet stay on the ground.
function buildEndgameSpecs(): Record<string, PixelSpec> {
  const batFly = grid(MSRC.batFly, 64, 64, 4, 32, 44);
  const batHit = grid(MSRC.batHit, 64, 64, 4, 32, 44);
  const batDie = grid(MSRC.batDeath, 64, 64, 4, 32, 44);
  const batDieLow = grid(MSRC.batDeath, 64, 64, 4, 32, 48);
  const golem = grid(MSRC.golem, 64, 72, 6, 41, 72);
  const lzIdle = grid(MSRC.lizardIdle, 64, 32, 4, 15, 32);
  const lzWalk = grid(MSRC.lizardWalk, 64, 32, 6, 15, 32);
  const lzHurt = grid(MSRC.lizardHurt, 64, 32, 3, 15, 32);
  const slime = grid(MSRC.slime, 24, 24, 3, 12, 20);
  const wartaur = grid(MSRC.wartaur, 80, 80, 4, 48, 80);
  const flame = grid(XSRC.brightfire, 18, 26, 12, 9, 25);
  const icon = grid(XSRC.icons, 34, 34, 12, 17, 30);
  const bob = (fs: FrameRef[], dys: number[]) => fs.map((f, i) => ({ ...f, dy: dys[i % dys.length] }));
  const OPEN_BOOK = 10 * 12 + 9, SPELL_BOOK = 4 * 12 + 8;

  const astral = [0x0a0c2e, 0x1c2a78, 0x3a5ad0, 0x8aa8ff, 0xfff0b0];
  const rift = [0x0a0418, 0x3a0a4a, 0x8a1a8a, 0xe04ab8, 0x7ff8e8];

  return {
    // ── observatory ──
    // Star Moth: the bat in midnight-indigo with gold-dust highlights, a tiny star on its brow.
    star_moth: { recolor: gradientMap(astral), idle: { frames: batFly(0, 1, 2, 3), rate: 8 }, move: { frames: batFly(0, 1, 2, 3), rate: 11 },
      hit: batHit(1)[0], die: { frames: [...batDie(...range(0, 7)), ...batDieLow(8, 9, 10)], rate: 15 },
      overlays: [{ at: 'peak', dy: 2, rows: ['..Y..', '.YWY.', '..Y..'], pal: { Y: 0xffd447, W: 0xffffff }, skip: ['die'] }] },
    // Astral Sentinel: the golem cast in star-iron — deep blue plate, gold seams, a single star eye.
    astral_sentinel: { flip: true, recolor: gradientMap([0x060818, 0x141c48, 0x2a3c8c, 0x5a7ad8, 0xc8b060, 0xfff4c8]),
      idle: { frames: golem(0, 0, 2, 2), rate: 2 }, move: { frames: golem(...range(6, 11)), rate: 7 },
      overlays: [{ at: 'peak', dy: 9, rows: ['.k.', 'kWk', '.k.'], pal: { k: 0xffd447, W: 0xffffff } }] },
    // ── rift ──
    // Rift Stalker: the salamander turned rift-born — void purple hide with teal tear-light along the crest.
    rift_stalker: { recolor: gradientMap(rift), outline: 0x06020c, idle: { frames: lzIdle(0, 1, 2, 3), rate: 5 },
      move: { frames: lzWalk(...range(0, 5)), rate: 13 }, hit: lzHurt(1)[0] },
    // Null Wisp: the bright-fire head drained of colour — grey-white with a black core, fading tail, hollow eyes.
    null_wisp: { recolor: chain(gradientMap([0x0a0a10, 0x3a3a48, 0x8a8a9a, 0xd8d8e4, 0xffffff]), ghostly(216, 26, 220, 9)), outline: 0x050508,
      idle: { frames: flame(...range(0, 11)), rate: 10 }, move: { frames: flame(...range(0, 11)), rate: 14 },
      overlays: [{ at: 'anchor', dx: 0, dy: -7, rows: ['kk.kk', 'kk.kk'], pal: { k: 0x7ff8e8 } }] },
    // Shard Horror: the slime as a lump of rift crystal, magenta-teal, with jagged shards bristling on top.
    shard_horror: { scale: 4, recolor: gradientMap([0x14061e, 0x4a1260, 0xa02aa8, 0xe878d8, 0xb8fff4]),
      idle: { frames: slime(0, 1, 2, 1), rate: 6 }, move: { frames: slime(3, 4, 5, 4), rate: 10 }, hit: slime(6)[0],
      overlays: [{ at: 'peak', dy: 2, rows: [
        '.k....k...',
        'kWk..kTk.k',
        'kTk.kWTkkW',
        'kTTkkTTkTk',
      ], pal: { k: 0x14061e, W: 0xffffff, T: 0x7ff8e8 }, skip: ['die'] }] },
    // ── spire ──
    // Archon Knight: the wartaur in gilded ivory plate with a crimson plume.
    archon_knight: { flip: true, recolor: gradientMap([0x1a1208, 0x4a3414, 0x9a7a30, 0xe0c870, 0xfffbe8]),
      idle: { frames: wartaur(0, 2), rate: 2 }, move: { frames: wartaur(0, 1, 2, 3), rate: 7 },
      overlays: [{ at: 'peak', dy: 2, rows: [
        '..rr.',
        '.rRRr',
        'rRRr.',
        '.kk..',
      ], pal: { r: 0x8a1020, R: 0xe8203a, k: 0x5a3008 } }] },
    // Unwritten Page: the tome bleached blank — white vellum, faint gold edges, glowing gold eyes.
    unwritten_page: { recolor: chain(
        rampMap([0x8a7030, 0xd8b850, 0xfff0a0, 0xffffff], 0.35, 0.9, { hue: [235, 320], minSat: 0.12 }),
        rampMap([0x7a7468, 0xc8c2b4, 0xf0ece0, 0xffffff], 0.3, 1, { maxSat: 0.42, minLum: 0.28 })),
      outline: 0x2a2418,
      idle: { frames: bob(icon(OPEN_BOOK, OPEN_BOOK, OPEN_BOOK, OPEN_BOOK), [0, 1, 2, 1]), rate: 5 },
      move: { frames: bob(icon(OPEN_BOOK, SPELL_BOOK, OPEN_BOOK, SPELL_BOOK), [0, 2, 1, 3]), rate: 9 },
      hit: icon(SPELL_BOOK)[0],
      overlays: [{ at: 'anchor', dx: 1, dy: -11, rows: [
        '.kk...kk.',
        '.kYk.kYk.',
        '..k...k..',
      ], pal: { k: 0x5a3008, Y: 0xffd447 } }] },
  };
}
