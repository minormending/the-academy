// OWNER: A7 (world). Canvas painting helpers shared by the world art modules.
import Phaser from 'phaser';

export type Ctx = CanvasRenderingContext2D;

/**
 * Paints a canvas texture once. Skips if the key already exists (idempotent, so the map
 * loader can lazily re-run generation). Never throws.
 */
export function makeTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void): boolean {
  try {
    if (scene.textures.exists(key)) return true;
    const W = Math.max(1, Math.ceil(w)), H = Math.max(1, Math.ceil(h));
    const tex = scene.textures.createCanvas(key, W, H);
    if (!tex) return false;
    const ctx = tex.getContext();
    ctx.save();
    try { draw(ctx, W, H); } catch (e) { console.warn(`[worldArt] painting ${key} failed`, e); }
    ctx.restore();
    tex.refresh();
    return true;
  } catch (e) {
    console.warn(`[worldArt] texture ${key} failed`, e);
    return false;
  }
}

// ───────────────────────────── color ─────────────────────────────

export function rgbOf(c: number): [number, number, number] { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
export function css(c: number, a = 1): string {
  const [r, g, b] = rgbOf(c);
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${Math.max(0, a).toFixed(3)})`;
}
export function mix(a: number, b: number, t: number): number {
  const A = rgbOf(a), B = rgbOf(b);
  const r = Math.round(A[0] + (B[0] - A[0]) * t), g = Math.round(A[1] + (B[1] - A[1]) * t), bl = Math.round(A[2] + (B[2] - A[2]) * t);
  return (r << 16) | (g << 8) | bl;
}
export const lighten = (c: number, t: number) => mix(c, 0xffffff, t);
export const darken = (c: number, t: number) => mix(c, 0x000000, t);

// ───────────────────────────── random ─────────────────────────────

/** mulberry32 seeded PRNG → [0,1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const rr = (r: () => number, a: number, b: number) => a + (b - a) * r();
export const ri = (r: () => number, a: number, b: number) => Math.floor(a + (b - a + 1) * r());
export function pick<T>(r: () => number, arr: readonly T[]): T { return arr[Math.floor(r() * arr.length) % arr.length]; }

// ───────────────────────────── wrapping (tileable textures) ─────────────────────────────

/** Calls fn at x, and at x±w when the shape (half-size m) crosses an edge. */
export function wrapX(w: number, x: number, m: number, fn: (x: number) => void) {
  fn(x);
  if (x - m < 0) fn(x + w);
  if (x + m > w) fn(x - w);
}
export function wrapXY(w: number, h: number, x: number, y: number, m: number, fn: (x: number, y: number) => void) {
  const xs = [x]; if (x - m < 0) xs.push(x + w); if (x + m > w) xs.push(x - w);
  const ys = [y]; if (y - m < 0) ys.push(y + h); if (y + m > h) ys.push(y - h);
  for (const X of xs) for (const Y of ys) fn(X, Y);
}

/** Periodic (tileable over width w) smooth noise from a few integer-frequency sines. */
export function periodicNoise(r: () => number, w: number, terms: { k: number; a: number }[]): (x: number) => number {
  const t = terms.map(tt => ({ ...tt, p: r() * Math.PI * 2 }));
  return (x: number) => {
    let v = 0;
    for (const q of t) v += q.a * Math.sin((x / w) * Math.PI * 2 * q.k + q.p);
    return v;
  };
}

// ───────────────────────────── shapes ─────────────────────────────

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); ctx.fill();
}
export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); ctx.fill();
}
export function glow(ctx: Ctx, x: number, y: number, r: number, color: number, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, css(color, a)); g.addColorStop(0.4, css(color, a * 0.45)); g.addColorStop(1, css(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y); ctx.lineTo(x + w - q, y); ctx.quadraticCurveTo(x + w, y, x + w, y + q);
  ctx.lineTo(x + w, y + h - q); ctx.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
  ctx.lineTo(x + q, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - q);
  ctx.lineTo(x, y + q); ctx.quadraticCurveTo(x, y, x + q, y); ctx.closePath();
}
export function vGrad(ctx: Ctx, y0: number, y1: number, stops: [number, number, number?][]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [t, c, a] of stops) g.addColorStop(t, css(c, a ?? 1));
  return g;
}
export function hGrad(ctx: Ctx, x0: number, x1: number, stops: [number, number, number?][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [t, c, a] of stops) g.addColorStop(t, css(c, a ?? 1));
  return g;
}

/** Outlined blob: shadow/outline pass then fill — the soft cartoon "Maple" look. */
export function outlinedCircle(ctx: Ctx, x: number, y: number, r: number, fill: string, outline: string, ow = 2) {
  circle(ctx, x, y, r + ow, outline);
  circle(ctx, x, y, r, fill);
}

/** Leafy canopy: clustered circles with dark rim, mid body and top-left highlights. */
export function canopy(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, base: number, r: () => number, opts: { blobs?: number; outline?: number; spec?: number } = {}) {
  const n = opts.blobs ?? 11;
  const outline = opts.outline ?? darken(base, 0.55);
  const pts: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rr(r, -0.2, 0.2);
    const d = rr(r, 0.45, 0.8);
    pts.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: Math.min(rx, ry) * rr(r, 0.42, 0.6) });
  }
  pts.push({ x: cx, y: cy, r: Math.min(rx, ry) * 0.75 });
  for (const p of pts) circle(ctx, p.x, p.y, p.r + 3, css(outline));
  for (const p of pts) circle(ctx, p.x, p.y + 2, p.r, css(darken(base, 0.18)));
  for (const p of pts) circle(ctx, p.x - p.r * 0.12, p.y - p.r * 0.14, p.r * 0.84, css(base));
  for (const p of pts) if (p.y < cy + ry * 0.2) circle(ctx, p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.42, css(lighten(base, 0.22)));
  const spec = opts.spec ?? 0.4;
  for (const p of pts) if (p.y < cy && r() < 0.7) circle(ctx, p.x - p.r * 0.38, p.y - p.r * 0.45, p.r * 0.16, css(lighten(base, spec)));
}

/** Simple outlined polygon fill. */
export function poly(ctx: Ctx, pts: [number, number][], fill: string | CanvasGradient, stroke?: string, lw = 2) {
  if (pts.length < 2) return;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}

/** 4-point twinkle star. */
export function star4(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
}
