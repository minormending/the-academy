// OWNER: A10 (art-audio); pixel-art layer by PX5 (pixel UI). Icon painter for every IconGlyph.
//
// 16-bit pivot: icons now come from the CC0 "496 pixel art icons for medieval/fantasy RPG" sheet
// (Henrique Lazarini / 7Soul1, packed into public/assets/ui/icons/rpg_icons_7soul1.png). The sheet is
// loaded as an HTMLImageElement at import time (iconDataUrl is synchronous and used before Phaser loads
// anything); until it arrives — or if it fails — the procedural painter below is used. On load the caches
// are cleared, onPixelIconsReady() listeners run and 'player:changed' is emitted so the UI refreshes.
//
// Procedural fallback: each glyph is painted in a 32×32 design space, then a uniform dark outline is produced by dilating
// the glyph's silhouette, giving a crisp "sticker" look at any size. Skill icons (spec.bg set) sit on a
// rounded beveled tile; item icons have no tile but get a soft drop shadow.
import Phaser from 'phaser';
import type { IconGlyph, IconSpec } from '../core/types';
import { css, makeCanvas, mix, rgb, shade } from './char/color';
import { assetUrl } from './assets';
import { Registry } from '../core/registry';
import { bus } from '../core/events';

type Ctx = CanvasRenderingContext2D;
type Painter = (ctx: Ctx, c: number, c2: number) => void;

// ───────────────────────────── helpers ─────────────────────────────

function lg(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: number[], alpha = 1): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), css(c, alpha)));
  return g;
}

function rg(ctx: Ctx, x: number, y: number, r: number, stops: number[], fx = x, fy = y, alpha = 1): CanvasGradient {
  const g = ctx.createRadialGradient(fx, fy, 0, x, y, r);
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), css(c, alpha)));
  return g;
}

/** Diagonal "lit from top-left" body gradient. */
function body(ctx: Ctx, c: number, x0 = 4, y0 = 4, x1 = 28, y1 = 28): CanvasGradient {
  return lg(ctx, x0, y0, x1, y1, [shade(c, 0.4), c, shade(c, -0.3)]);
}

function fill(ctx: Ctx, f: string | CanvasGradient) { ctx.fillStyle = f; ctx.fill(); }
function stroke(ctx: Ctx, s: string | CanvasGradient, w: number, cap: CanvasLineCap = 'round') {
  ctx.strokeStyle = s; ctx.lineWidth = w; ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.stroke();
}
function circle(ctx: Ctx, x: number, y: number, r: number) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
function poly(ctx: Ctx, pts: number[]) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}
function starPath(ctx: Ctx, x: number, y: number, n: number, ro: number, ri: number, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, r = i % 2 ? ri : ro;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}
const W = (a: number) => `rgba(255,255,255,${a})`;
const D = (a: number) => `rgba(20,12,40,${a})`;

/** Small white sheen streak. */
function sheen(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w = 1.6, a = 0.7) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); stroke(ctx, W(a), w);
}

function flameShape(ctx: Ctx, cx: number, by: number, s: number) {
  // teardrop flame with a curled tip, bottom-center at (cx, by), height ≈ 28*s
  const X = (v: number) => cx + (v - 16) * s, Y = (v: number) => by + (v - 30) * s;
  ctx.beginPath();
  ctx.moveTo(X(16), Y(2));
  ctx.bezierCurveTo(X(21), Y(8), X(27), Y(12), X(25.5), Y(21));
  ctx.bezierCurveTo(X(24.5), Y(27), X(20.5), Y(30), X(16), Y(30));
  ctx.bezierCurveTo(X(10), Y(30), X(6), Y(26), X(6.5), Y(20));
  ctx.bezierCurveTo(X(7), Y(15), X(11), Y(13.5), X(11.5), Y(8.5));
  ctx.bezierCurveTo(X(13.5), Y(10.5), X(14.2), Y(12.5), X(14.6), Y(14.5));
  ctx.bezierCurveTo(X(16.5), Y(10), X(17.2), Y(6), X(16), Y(2));
  ctx.closePath();
}

function flame(ctx: Ctx, c: number, c2: number, cx = 16, by = 30, s = 1) {
  flameShape(ctx, cx, by, s);
  fill(ctx, lg(ctx, 0, by - 28 * s, 0, by, [c2, c, shade(c, -0.25)]));
  flameShape(ctx, cx + 0.5 * s, by - 1 * s, 0.55 * s);
  fill(ctx, lg(ctx, 0, by - 16 * s, 0, by, [0xffffff, c2]));
  ell(ctx, cx, by - 5 * s, 2.4 * s, 3.2 * s); fill(ctx, W(0.85));
}

function cloud(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x - 11 * s, y + 4 * s);
  ctx.arc(x - 8 * s, y + 0.5 * s, 4.5 * s, Math.PI * 0.6, Math.PI * 1.5);
  ctx.arc(x - 2 * s, y - 3.5 * s, 6 * s, Math.PI * 1.05, Math.PI * 1.85);
  ctx.arc(x + 6 * s, y - 1 * s, 5 * s, Math.PI * 1.3, Math.PI * 0.1 + Math.PI * 2);
  ctx.arc(x + 9 * s, y + 2.5 * s, 3.5 * s, Math.PI * 1.6, Math.PI * 0.5 + Math.PI * 2);
  ctx.closePath();
}

function boltPath(ctx: Ctx, s = 1, ox = 0, oy = 0) {
  const p = [19, 2, 7.5, 17.5, 14.5, 17.5, 10.5, 30, 25, 12, 17.5, 12, 22.5, 2];
  poly(ctx, p.map((v, i) => (i % 2 ? oy + 16 + (v - 16) * s : ox + 16 + (v - 16) * s)));
}

function snowflakeAt(ctx: Ctx, x: number, y: number, r: number, col: string, w: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
    ctx.moveTo(x, y); ctx.lineTo(x + ca * r, y + sa * r);
    const bx = x + ca * r * 0.58, by = y + sa * r * 0.58, br = r * 0.34;
    for (const d of [-0.75, 0.75]) {
      ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + d) * br, by + Math.sin(a + d) * br);
    }
  }
  stroke(ctx, col, w);
}

function sparkle(ctx: Ctx, x: number, y: number, r: number, col = '#ffffff') {
  starPath(ctx, x, y, 4, r, r * 0.25); fill(ctx, col);
}

// ───────────────────────────── glyph painters ─────────────────────────────

const P: Record<IconGlyph, Painter> = {
  // ── holy (procedural fallbacks; the pixel sheet wins once it loads) ──
  halo: (ctx, c, c2) => {
    // tilted golden ring over a soft glow, with a sparkle
    circle(ctx, 16, 17, 13); fill(ctx, rg(ctx, 16, 17, 13, [c2, c], 16, 17, 0.35));
    ell(ctx, 16, 13, 12, 5, -0.12); stroke(ctx, css(shade(c, -0.35)), 5.2);
    ell(ctx, 16, 13, 12, 5, -0.12); stroke(ctx, lg(ctx, 4, 8, 28, 18, [shade(c, 0.5), c, shade(c, -0.15)]), 3.2);
    ctx.beginPath(); ctx.ellipse(16, 13, 12, 5, -0.12, Math.PI * 1.05, Math.PI * 1.55); stroke(ctx, W(0.85), 1.3);
    sparkle(ctx, 16, 24, 5, css(c2)); sparkle(ctx, 25, 23, 2.6);
  },
  holy_cross: (ctx, c, c2) => {
    circle(ctx, 16, 16, 14); fill(ctx, rg(ctx, 16, 16, 14, [c2, c], 16, 16, 0.3));
    const bar = (x: number, y: number, w: number, hh: number) => { ctx.beginPath(); ctx.rect(x, y, w, hh); };
    bar(13, 3, 6, 26); fill(ctx, lg(ctx, 13, 0, 19, 0, [shade(c, 0.45), c, shade(c, -0.2)]));
    bar(5, 9.5, 22, 6); fill(ctx, lg(ctx, 0, 9.5, 0, 15.5, [shade(c, 0.45), c, shade(c, -0.2)]));
    circle(ctx, 16, 12.5, 3.3); fill(ctx, rg(ctx, 16, 12.5, 3.3, [0xffffff, c2]));
    sheen(ctx, 14.6, 4.5, 14.6, 9, 1.2, 0.8);
  },
  sunburst: (ctx, c, c2) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, l = i % 2 ? 11 : 15;
      ctx.beginPath(); ctx.moveTo(16 + Math.cos(a - 0.16) * 6, 16 + Math.sin(a - 0.16) * 6);
      ctx.lineTo(16 + Math.cos(a) * l, 16 + Math.sin(a) * l); ctx.lineTo(16 + Math.cos(a + 0.16) * 6, 16 + Math.sin(a + 0.16) * 6); ctx.closePath();
      fill(ctx, css(i % 2 ? c2 : c));
    }
    circle(ctx, 16, 16, 7.5); fill(ctx, rg(ctx, 16, 16, 7.5, [0xffffff, c2, c], 14, 13.5));
    circle(ctx, 13.8, 13.6, 2); fill(ctx, W(0.85));
  },
  wings: (ctx, c, c2) => {
    for (const sgn of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const y0 = 9 + k * 5, len = 13 - k * 2.5;
        ctx.beginPath(); ctx.moveTo(16 + sgn * 2, y0 + 2);
        ctx.quadraticCurveTo(16 + sgn * (len * 0.6), y0 - 5 + k, 16 + sgn * (len + 1), y0 - 3 + k * 1.5);
        ctx.quadraticCurveTo(16 + sgn * len * 0.7, y0 + 4, 16 + sgn * 2, y0 + 6);
        ctx.closePath(); fill(ctx, lg(ctx, 16, y0, 16 + sgn * len, y0, [k === 0 ? 0xffffff : c2, c]));
      }
    }
    ell(ctx, 16, 17, 2.4, 6); fill(ctx, body(ctx, c2, 13, 11, 19, 23));
    ell(ctx, 16, 6, 4.5, 1.7); stroke(ctx, css(c2), 1.4);
  },
  // ── shadow ──
  skull: (ctx, c, c2) => {
    ctx.beginPath(); ctx.arc(16, 13, 11, Math.PI * 0.95, Math.PI * 0.05);
    ctx.lineTo(26, 19); ctx.quadraticCurveTo(23, 21, 22, 23); ctx.lineTo(22, 28); ctx.lineTo(10, 28); ctx.lineTo(10, 23); ctx.quadraticCurveTo(9, 21, 6, 19); ctx.closePath();
    fill(ctx, rg(ctx, 16, 13, 15, [0xffffff, c, shade(c, -0.35)], 12, 8));
    for (const x of [11.2, 20.8]) { ell(ctx, x, 16, 3.6, 3.9); fill(ctx, D(0.95)); circle(ctx, x, 16.5, 1.3); fill(ctx, css(c2)); }
    poly(ctx, [16, 19.5, 14.3, 23, 17.7, 23]); fill(ctx, D(0.9));
    for (const x of [12.5, 15.2, 17.9]) { ctx.beginPath(); ctx.rect(x, 25, 1.4, 3); fill(ctx, D(0.7)); }
    sheen(ctx, 9, 8, 12, 5, 1.6, 0.6);
  },
  scythe: (ctx, c, c2) => {
    // haft
    ctx.beginPath(); ctx.moveTo(8, 30); ctx.lineTo(19, 4); stroke(ctx, css(shade(c2, -0.4)), 4.2);
    ctx.beginPath(); ctx.moveTo(8, 30); ctx.lineTo(19, 4); stroke(ctx, lg(ctx, 8, 30, 19, 4, [shade(c2, -0.1), c2]), 2.4);
    // crescent blade
    ctx.beginPath(); ctx.moveTo(18, 5); ctx.quadraticCurveTo(28, 6, 30, 17); ctx.quadraticCurveTo(26, 10, 17.5, 9.5); ctx.closePath();
    fill(ctx, lg(ctx, 17, 5, 30, 17, [0xffffff, c, shade(c, -0.3)]));
    ctx.beginPath(); ctx.moveTo(19, 6); ctx.quadraticCurveTo(26.5, 7.5, 29, 15); stroke(ctx, W(0.8), 1);
    circle(ctx, 18.6, 6.6, 2); fill(ctx, css(c2));
    for (const [x, y, r] of [[5, 8, 1.6], [26, 25, 1.3], [12, 18, 1]]) { circle(ctx, x, y, r); fill(ctx, css(c, 0.7)); }
  },
  ghost: (ctx, c, c2) => {
    ctx.beginPath(); ctx.moveTo(6, 28); ctx.lineTo(6, 14); ctx.arc(16, 14, 10, Math.PI, 0); ctx.lineTo(26, 28);
    for (let i = 0; i < 4; i++) { const x = 26 - i * 5; ctx.quadraticCurveTo(x - 1.2, 24, x - 2.5, 27); ctx.quadraticCurveTo(x - 3.8, 30, x - 5, 26.5); }
    ctx.closePath(); fill(ctx, rg(ctx, 16, 14, 16, [0xffffff, c, shade(c, -0.3)], 12, 9));
    for (const x of [12, 20]) { ell(ctx, x, 15, 2.2, 3.2); fill(ctx, D(0.95)); circle(ctx, x - 0.6, 14, 0.8); fill(ctx, css(c2)); }
    ell(ctx, 16, 21.5, 2.2, 1.6); fill(ctx, D(0.8));
    sheen(ctx, 9, 13, 11, 8, 1.4, 0.6);
  },
  poison: (ctx, c, c2) => {
    // dripping drop + bubbles
    ctx.beginPath(); ctx.moveTo(16, 3); ctx.bezierCurveTo(19, 9, 25, 14, 25, 20); ctx.arc(16, 20, 9, 0, Math.PI); ctx.bezierCurveTo(7, 14, 13, 9, 16, 3); ctx.closePath();
    fill(ctx, rg(ctx, 16, 20, 11, [c2, c, shade(c, -0.4)], 13, 16));
    // skull mark
    circle(ctx, 16, 20, 3.6); fill(ctx, D(0.55));
    for (const x of [14.6, 17.4]) { circle(ctx, x, 19.6, 0.9); fill(ctx, css(c2)); }
    ctx.beginPath(); ctx.rect(14.8, 23, 2.4, 1.6); fill(ctx, D(0.55));
    sheen(ctx, 11.5, 15, 13.5, 11, 1.6, 0.7);
    for (const [x, y, r] of [[25, 6, 2.2], [28, 11, 1.4], [7, 7, 1.6]]) { circle(ctx, x, y, r); fill(ctx, rg(ctx, x, y, r, [0xffffff, c2, c])); }
  },
  // ── pet / beast ──
  paw: (ctx, c, c2) => {
    ell(ctx, 16, 21, 7.5, 6.5); fill(ctx, rg(ctx, 16, 21, 8, [c2, c, shade(c, -0.3)], 14, 18));
    for (const [x, y, rx, ry, rot] of [[7, 13, 2.8, 3.6, -0.4], [12.5, 8, 3, 3.9, -0.15], [19.5, 8, 3, 3.9, 0.15], [25, 13, 2.8, 3.6, 0.4]]) {
      ell(ctx, x, y, rx, ry, rot); fill(ctx, rg(ctx, x, y, ry, [c2, c, shade(c, -0.3)], x - 1, y - 1));
    }
    sheen(ctx, 12, 18.5, 14.5, 17, 1.4, 0.6);
  },
  // ── fire ──
  flame: (ctx, c, c2) => flame(ctx, c, c2),
  fireball: (ctx, c, c2) => {
    for (let i = 0; i < 3; i++) {
      const a = [0.95, 0.8, 0.65][i], o = [0, 4, -4][i];
      ctx.beginPath();
      ctx.moveTo(14 + o * 0.5, 13 - o * 0.5);
      ctx.quadraticCurveTo(7 + o, 9 - o, 2 + o * 0.3, 2 - o * 0.3 + i);
      ctx.quadraticCurveTo(11 - o * 0.3, 5 + o * 0.6, 21 - o * 0.4, 10 + o * 0.4);
      ctx.closePath();
      fill(ctx, lg(ctx, 2, 2, 18, 16, [c2, c], a));
    }
    circle(ctx, 19, 19, 9.5); fill(ctx, rg(ctx, 19, 19, 9.5, [0xffffff, c2, c, shade(c, -0.3)], 16.5, 16.5));
    circle(ctx, 16.5, 16, 2.4); fill(ctx, W(0.8));
  },
  meteor: (ctx, c, c2) => {
    ctx.beginPath(); ctx.moveTo(15, 10); ctx.quadraticCurveTo(6, 3, 1, 1); ctx.quadraticCurveTo(4, 9, 10, 16); ctx.closePath();
    fill(ctx, lg(ctx, 1, 1, 14, 14, [shade(c, 0.6), c], 0.9));
    ctx.beginPath(); ctx.moveTo(19, 9); ctx.quadraticCurveTo(14, 2, 9, 1); ctx.quadraticCurveTo(12, 6, 13, 12); ctx.closePath();
    fill(ctx, css(c, 0.7));
    circle(ctx, 20, 20, 9.5); fill(ctx, rg(ctx, 20, 20, 9.5, [shade(c2, 0.2), c2, shade(c2, -0.45)], 17, 16));
    for (const [x, y, r] of [[22, 17, 2.2], [17, 23, 1.6], [24.5, 24, 1.3]]) { circle(ctx, x, y, r); fill(ctx, D(0.35)); }
    ctx.beginPath(); ctx.arc(20, 20, 9, Math.PI * 0.9, Math.PI * 1.6); stroke(ctx, css(shade(c, 0.4)), 2.2);
  },
  phoenix: (ctx, c, c2) => {
    // tail flames
    for (const dx of [-5, 0, 5]) {
      ctx.beginPath(); ctx.moveTo(16, 20); ctx.quadraticCurveTo(16 + dx * 1.2, 26, 16 + dx * 1.6, 31); ctx.quadraticCurveTo(16 + dx * 0.4, 26, 16 + dx * 0.2, 20);
      ctx.closePath(); fill(ctx, lg(ctx, 0, 20, 0, 31, [c, c2]));
    }
    // wings
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.quadraticCurveTo(16 + sgn * 6, 6, 16 + sgn * 15, 3);
      ctx.lineTo(16 + sgn * 12, 8); ctx.lineTo(16 + sgn * 15, 9.5); ctx.lineTo(16 + sgn * 11, 13); ctx.lineTo(16 + sgn * 13, 15.5);
      ctx.quadraticCurveTo(16 + sgn * 7, 18, 16, 19);
      ctx.closePath();
      fill(ctx, lg(ctx, 16, 16, 16 + sgn * 15, 4, [c, c2]));
    }
    ell(ctx, 16, 16, 3.6, 6); fill(ctx, body(ctx, c, 12, 10, 20, 22));
    circle(ctx, 16, 9, 3.2); fill(ctx, body(ctx, c, 13, 6, 19, 12));
    ctx.beginPath(); ctx.moveTo(15, 6.5); ctx.quadraticCurveTo(14, 2, 17, 1); ctx.quadraticCurveTo(16, 4, 17.5, 6.5); ctx.closePath(); fill(ctx, css(c2));
    poly(ctx, [18.8, 9, 21.5, 10, 18.8, 10.8]); fill(ctx, '#ffd23a');
    circle(ctx, 17.2, 8.4, 0.8); fill(ctx, '#2a1f3d');
  },
  ember: (ctx, c, c2) => {
    flame(ctx, c, c2, 15, 29, 0.62);
    for (const [x, y, r] of [[23, 9, 2.6], [8, 11, 2], [25, 18, 1.6], [12, 4, 1.4]]) {
      circle(ctx, x, y, r * 1.8); fill(ctx, rg(ctx, x, y, r * 1.8, [c2, c], x, y, 0.35));
      circle(ctx, x, y, r); fill(ctx, rg(ctx, x, y, r, [0xffffff, c2, c]));
    }
  },
  explosion: (ctx, c, c2) => {
    starPath(ctx, 16, 16, 12, 15, 8.5, -Math.PI / 2 + 0.1); fill(ctx, rg(ctx, 16, 16, 15, [c2, c, shade(c, -0.25)]));
    starPath(ctx, 16, 16, 9, 10, 5.5, -Math.PI / 2 + 0.4); fill(ctx, rg(ctx, 16, 16, 10, [0xffffff, c2]));
    circle(ctx, 16, 16, 3.2); fill(ctx, W(0.95));
    for (const [x, y] of [[4, 6], [27, 8], [26, 27], [5, 26]]) { circle(ctx, x, y, 1.4); fill(ctx, css(c2)); }
  },
  // ── ice ──
  snowflake: (ctx, c, c2) => {
    snowflakeAt(ctx, 16, 16, 13.5, css(shade(c, -0.15)), 3.4);
    snowflakeAt(ctx, 16, 16, 13, css(c2), 1.6);
    starPath(ctx, 16, 16, 6, 4.2, 2.6, 0); fill(ctx, rg(ctx, 16, 16, 4.2, [0xffffff, c2]));
  },
  icicle: (ctx, c, c2) => {
    const spikes: [number, number, number, number][] = [[16, 3, 30, 5.5], [8, 5, 22, 4], [24, 5, 23, 4]];
    for (const [x, y0, y1, w] of spikes) {
      ctx.beginPath(); ctx.moveTo(x - w, y0); ctx.lineTo(x + w, y0); ctx.lineTo(x + 0.5, y1); ctx.closePath();
      fill(ctx, lg(ctx, x - w, 0, x + w, 0, [c2, c, shade(c, -0.3)]));
      sheen(ctx, x - w * 0.45, y0 + 2, x - 0.3, y1 - (y1 - y0) * 0.35, 1.1, 0.75);
    }
    ctx.beginPath(); ctx.roundRect(2, 2, 28, 4, 2); fill(ctx, lg(ctx, 0, 2, 0, 6, [0xffffff, c2]));
  },
  ice_shard: (ctx, c, c2) => {
    poly(ctx, [24, 10, 28, 17, 25, 27, 21, 18]); fill(ctx, body(ctx, c, 21, 10, 28, 27));
    poly(ctx, [14, 2, 22, 13, 16, 30, 8, 15]); fill(ctx, lg(ctx, 8, 2, 22, 30, [shade(c2, 0.4), c, shade(c, -0.35)]));
    poly(ctx, [14, 2, 16, 30, 8, 15]); fill(ctx, W(0.28));
    sheen(ctx, 12.5, 7, 10.5, 14, 1.2, 0.85);
    poly(ctx, [6, 21, 9, 25, 6.5, 30, 3.5, 25]); fill(ctx, body(ctx, c2, 3, 21, 9, 30));
  },
  frost_nova: (ctx, c, c2) => {
    circle(ctx, 16, 16, 14); fill(ctx, rg(ctx, 16, 16, 14, [c2, c], 16, 16, 0.25));
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
      poly(ctx, [16 + ca * 15, 16 + sa * 15, 16 + ca * 8 + px * 2.6, 16 + sa * 8 + py * 2.6, 16 + ca * 6, 16 + sa * 6, 16 + ca * 8 - px * 2.6, 16 + sa * 8 - py * 2.6]);
      fill(ctx, lg(ctx, 16 + ca * 6, 16 + sa * 6, 16 + ca * 15, 16 + sa * 15, [c2, c]));
    }
    circle(ctx, 16, 16, 5); fill(ctx, rg(ctx, 16, 16, 5, [0xffffff, c2, c]));
    ctx.beginPath(); ctx.arc(16, 16, 10.5, 0, Math.PI * 2); stroke(ctx, css(c2, 0.7), 1);
  },
  blizzard: (ctx, c, c2) => {
    for (const [r, a0, a1, w] of [[12, 0.9, 2.4, 3], [8, 1.6, 3.4, 2.6], [4.5, 2.2, 4.2, 2.2]]) {
      ctx.beginPath(); ctx.arc(16, 16, r, Math.PI * a0, Math.PI * a1); stroke(ctx, css(c), w);
      ctx.beginPath(); ctx.arc(16, 16, r, Math.PI * a0, Math.PI * a1); stroke(ctx, W(0.5), w * 0.35);
    }
    for (const [x, y, r] of [[26, 7, 3.4], [6, 25, 3], [25, 25, 2.4], [7, 7, 2]]) snowflakeAt(ctx, x, y, r, css(c2), 1.2);
  },
  glacier: (ctx, c, c2) => {
    poly(ctx, [2, 28, 9, 11, 13, 16, 20, 4, 30, 28]); fill(ctx, lg(ctx, 2, 4, 30, 28, [shade(c2, 0.3), c, shade(c, -0.35)]));
    poly(ctx, [20, 4, 17, 13, 20, 28, 30, 28]); fill(ctx, D(0.18));
    poly(ctx, [9, 11, 7, 18, 11, 15, 13, 16]); fill(ctx, W(0.7));
    poly(ctx, [20, 4, 16.5, 11, 19, 10, 21.5, 12, 23, 9.5]); fill(ctx, W(0.8));
    ctx.beginPath(); ctx.roundRect(1, 26, 30, 4, 2); fill(ctx, lg(ctx, 0, 26, 0, 30, [c2, shade(c, -0.2)]));
  },
  // ── lightning ──
  bolt: (ctx, c, c2) => {
    boltPath(ctx, 1); fill(ctx, lg(ctx, 10, 2, 22, 30, [shade(c2, 0.5), c2, c]));
    boltPath(ctx, 0.5, 1.2, -1); fill(ctx, W(0.55));
  },
  chain: (ctx, c, c2) => {
    const pts = [[5, 25], [16, 8], [27, 22]];
    const zig = (a: number[], b: number[]) => {
      ctx.beginPath(); ctx.moveTo(a[0], a[1]);
      for (let i = 1; i < 5; i++) {
        const t = i / 5, o = (i % 2 ? 2.6 : -2.6);
        const nx = -(b[1] - a[1]), ny = b[0] - a[0], L = Math.hypot(nx, ny) || 1;
        ctx.lineTo(a[0] + (b[0] - a[0]) * t + (nx / L) * o, a[1] + (b[1] - a[1]) * t + (ny / L) * o);
      }
      ctx.lineTo(b[0], b[1]);
    };
    zig(pts[0], pts[1]); stroke(ctx, css(c), 3.2); zig(pts[1], pts[2]); stroke(ctx, css(c), 3.2);
    zig(pts[0], pts[1]); stroke(ctx, css(shade(c2, 0.5)), 1.2); zig(pts[1], pts[2]); stroke(ctx, css(shade(c2, 0.5)), 1.2);
    for (const [x, y] of pts) { circle(ctx, x, y, 3.8); fill(ctx, rg(ctx, x, y, 3.8, [0xffffff, c2, c])); }
  },
  storm: (ctx, c, c2) => {
    for (const x of [7, 12, 22, 26]) { ctx.beginPath(); ctx.moveTo(x, 19); ctx.lineTo(x - 2.5, 27); stroke(ctx, css(shade(c, 0.35), 0.9), 1.4); }
    ctx.save(); ctx.translate(2, 6); ctx.scale(0.62, 0.78); boltPath(ctx, 1); fill(ctx, lg(ctx, 10, 2, 22, 30, [0xffffff, c2])); ctx.restore();
    cloud(ctx, 16, 11, 1.15); fill(ctx, lg(ctx, 0, 2, 0, 17, [shade(c, 0.35), c, shade(c, -0.35)]));
    ctx.beginPath(); ctx.arc(13.5, 7.5, 5, Math.PI * 1.15, Math.PI * 1.6); stroke(ctx, W(0.6), 1.3);
  },
  thunder_cloud: (ctx, c, c2) => {
    ctx.save(); ctx.translate(3, 10); ctx.scale(0.75, 0.72); boltPath(ctx, 1); fill(ctx, lg(ctx, 10, 2, 22, 30, [0xffffff, c2, shade(c2, -0.2)])); ctx.restore();
    cloud(ctx, 16, 12, 1.3); fill(ctx, lg(ctx, 0, 2, 0, 18, [shade(c, 0.25), c, shade(c, -0.4)]));
    ctx.beginPath(); ctx.arc(13, 8, 5.5, Math.PI * 1.15, Math.PI * 1.6); stroke(ctx, W(0.45), 1.3);
  },
  spark: (ctx, c, c2) => {
    starPath(ctx, 15, 16, 4, 14, 3.2); fill(ctx, rg(ctx, 15, 16, 14, [0xffffff, c2, c]));
    sparkle(ctx, 25, 7, 4.5, css(shade(c2, 0.4)));
    sparkle(ctx, 25.5, 25, 3, css(c2));
    circle(ctx, 6, 7, 1.4); fill(ctx, css(c2));
  },
  orb: (ctx, c, c2) => {
    circle(ctx, 16, 16, 14); fill(ctx, rg(ctx, 16, 16, 14, [c2, c], 16, 16, 0.3));
    circle(ctx, 16, 16, 10.5); fill(ctx, rg(ctx, 16, 16, 10.5, [shade(c2, 0.6), c, shade(c, -0.35)], 12.5, 12));
    ctx.beginPath(); ctx.ellipse(16, 16, 13, 4.5, -0.4, Math.PI * 0.95, Math.PI * 2.05); stroke(ctx, css(c2, 0.9), 1.4);
    ell(ctx, 12.5, 11.5, 3.2, 2.2, -0.6); fill(ctx, W(0.8));
  },
  // ── arcane / utility ──
  arcane_star: (ctx, c, c2) => {
    circle(ctx, 16, 16, 14); fill(ctx, rg(ctx, 16, 16, 14, [c2, c], 16, 16, 0.35));
    starPath(ctx, 16, 17, 5, 13.5, 6); fill(ctx, body(ctx, c));
    starPath(ctx, 16, 17, 5, 6.5, 3); fill(ctx, rg(ctx, 16, 16, 7, [0xffffff, c2]));
    sparkle(ctx, 26, 6, 3);
  },
  missile: (ctx, c, c2) => {
    for (const [o, a] of [[0, 0.9], [3.5, 0.55], [-3.5, 0.55]]) {
      ctx.beginPath(); ctx.moveTo(18 + o * 0.7, 14 + o * 0.7); ctx.lineTo(3 + o, 29 + o * 0.2); stroke(ctx, css(c2, a), 2.2);
    }
    poly(ctx, [29, 3, 23, 19, 18.5, 14, 13, 9]); fill(ctx, body(ctx, c, 13, 3, 29, 19));
    poly(ctx, [29, 3, 18.5, 14, 13, 9]); fill(ctx, W(0.35));
    circle(ctx, 18.5, 13.5, 4.2); fill(ctx, rg(ctx, 18.5, 13.5, 4.2, [0xffffff, c2, c]));
  },
  claw: (ctx, c, c2) => {
    for (let i = 0; i < 3; i++) {
      const o = (i - 1) * 7;
      ctx.beginPath();
      ctx.moveTo(8 + o, 3);
      ctx.quadraticCurveTo(22 + o, 10, 21 + o * 0.6, 29);
      ctx.quadraticCurveTo(18 + o, 13, 8 + o, 3);
      ctx.closePath();
      fill(ctx, lg(ctx, 8 + o, 3, 21 + o, 29, [shade(c2, 0.5), c, shade(c, -0.2)]));
    }
  },
  shield: (ctx, c, c2) => {
    const sh = (inset: number) => {
      ctx.beginPath();
      ctx.moveTo(16, 3 + inset);
      ctx.quadraticCurveTo(22, 6 + inset, 27 - inset, 5.5 + inset);
      ctx.quadraticCurveTo(28 - inset, 21, 16, 30 - inset * 1.4);
      ctx.quadraticCurveTo(4 + inset, 21, 5 + inset, 5.5 + inset);
      ctx.quadraticCurveTo(10, 6 + inset, 16, 3 + inset);
      ctx.closePath();
    };
    sh(0); fill(ctx, body(ctx, c2));
    sh(2.6); fill(ctx, body(ctx, c));
    starPath(ctx, 16, 16, 4, 6.5, 2); fill(ctx, rg(ctx, 16, 16, 6.5, [0xffffff, c2]));
    ctx.beginPath(); ctx.moveTo(9, 9); ctx.quadraticCurveTo(9, 17, 12, 21); stroke(ctx, W(0.45), 1.4);
  },
  teleport: (ctx, c, c2) => {
    ell(ctx, 16, 17, 10, 13.5); fill(ctx, rg(ctx, 16, 17, 13.5, [0xffffff, c2, c, shade(c, -0.3)]));
    for (const [rx, ry, a] of [[10, 13.5, 1], [7, 10, 0.8], [4, 6.5, 0.7]]) {
      ctx.beginPath(); ctx.ellipse(16, 17, rx, ry, 0, Math.PI * 0.2, Math.PI * 1.55); stroke(ctx, css(shade(c, -0.35), a), 1.5);
    }
    sparkle(ctx, 26, 6, 3.6); sparkle(ctx, 6, 9, 2.4, css(c2));
    ctx.beginPath(); ctx.moveTo(2, 29); ctx.lineTo(30, 29); stroke(ctx, css(c2, 0.8), 1.6);
  },
  book: (ctx, c, c2) => {
    ctx.beginPath(); ctx.roundRect(9, 5, 17, 24, 2); fill(ctx, '#f4ead2');
    ctx.beginPath(); ctx.moveTo(25, 8); ctx.lineTo(25, 26); stroke(ctx, D(0.25), 0.8);
    ctx.beginPath(); ctx.roundRect(5, 3, 18, 25, 2.5); fill(ctx, body(ctx, c, 5, 3, 23, 28));
    ctx.beginPath(); ctx.roundRect(5, 3, 4, 25, [2.5, 0, 0, 2.5]); fill(ctx, css(shade(c, -0.3)));
    for (const y of [6, 25]) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(21, y); stroke(ctx, css(c2), 1.2); }
    poly(ctx, [15.5, 10, 19.5, 15.5, 15.5, 21, 11.5, 15.5]); fill(ctx, rg(ctx, 15.5, 15.5, 5.5, [0xffffff, c2, shade(c2, -0.3)], 14, 13));
    ctx.beginPath(); ctx.roundRect(22, 13, 5, 5, 1); fill(ctx, css(c2));
  },
  eye: (ctx, c, c2) => {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, r0 = 12.5, r1 = 15;
      ctx.beginPath(); ctx.moveTo(16 + Math.cos(a) * r0, 16 + Math.sin(a) * r0 * 0.8); ctx.lineTo(16 + Math.cos(a) * r1, 16 + Math.sin(a) * r1 * 0.8);
      stroke(ctx, css(c2), 1.6);
    }
    ctx.beginPath(); ctx.moveTo(3, 16); ctx.quadraticCurveTo(16, 3, 29, 16); ctx.quadraticCurveTo(16, 29, 3, 16); ctx.closePath();
    fill(ctx, lg(ctx, 0, 8, 0, 24, [0xffffff, 0xdfe6f5]));
    circle(ctx, 16, 16, 6.5); fill(ctx, rg(ctx, 16, 16, 6.5, [shade(c, 0.4), c, shade(c, -0.4)]));
    circle(ctx, 16, 16, 2.8); fill(ctx, '#140c22');
    circle(ctx, 14, 13.8, 1.6); fill(ctx, W(0.95));
  },
  wind: (ctx, c, c2) => {
    const gust = (y: number, x0: number, x1: number, curl: number, w: number) => {
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y);
      ctx.arc(x1, y - curl, curl, Math.PI / 2, -Math.PI * 0.9, true);
      stroke(ctx, css(c), w);
      ctx.beginPath(); ctx.moveTo(x0 + 1, y); ctx.lineTo(x1, y); stroke(ctx, css(shade(c2, 0.4)), w * 0.35);
    };
    gust(12, 3, 21, 4, 2.8);
    gust(19, 6, 26, 3.4, 2.6);
    gust(26, 2, 15, 2.8, 2.4);
  },
  heart: (ctx, c, c2) => {
    const hp = (s: number) => {
      ctx.beginPath();
      ctx.moveTo(16, 28 * s + 16 * (1 - s));
      ctx.bezierCurveTo(16 - 14 * s, 18 * s + 16 * (1 - s), 16 - 14 * s, 4 * s + 16 * (1 - s), 16 - 6.5 * s, 5 * s + 16 * (1 - s));
      ctx.bezierCurveTo(16 - 2.5 * s, 5 * s + 16 * (1 - s), 16, 8 * s + 16 * (1 - s), 16, 10 * s + 16 * (1 - s));
      ctx.bezierCurveTo(16, 8 * s + 16 * (1 - s), 16 + 2.5 * s, 5 * s + 16 * (1 - s), 16 + 6.5 * s, 5 * s + 16 * (1 - s));
      ctx.bezierCurveTo(16 + 14 * s, 4 * s + 16 * (1 - s), 16 + 14 * s, 18 * s + 16 * (1 - s), 16, 28 * s + 16 * (1 - s));
      ctx.closePath();
    };
    hp(1); fill(ctx, rg(ctx, 16, 16, 15, [shade(c, 0.35), c, shade(c, -0.3)], 11, 10));
    ell(ctx, 10.5, 10.5, 2.8, 1.8, -0.7); fill(ctx, W(0.8));
    circle(ctx, 14, 9, 0.9); fill(ctx, W(0.7));
    if (c2 !== c) { sparkle(ctx, 24, 9, 2.6, css(shade(c2, 0.5))); }
  },
  mana: (ctx, c, c2) => {
    ctx.beginPath(); ctx.moveTo(16, 2);
    ctx.bezierCurveTo(19, 9, 26, 14, 26, 20); ctx.bezierCurveTo(26, 26, 21.5, 30, 16, 30);
    ctx.bezierCurveTo(10.5, 30, 6, 26, 6, 20); ctx.bezierCurveTo(6, 14, 13, 9, 16, 2); ctx.closePath();
    fill(ctx, rg(ctx, 16, 20, 13, [shade(c, 0.45), c, shade(c, -0.35)], 13, 17));
    sparkle(ctx, 16, 21, 5, css(shade(c2, 0.6)));
    ctx.beginPath(); ctx.moveTo(11, 15); ctx.quadraticCurveTo(9, 19, 10, 23); stroke(ctx, W(0.6), 1.6);
  },
  // ── equipment / items ──
  potion: (ctx, c, c2) => {
    // glass
    ctx.beginPath(); ctx.moveTo(13, 6); ctx.lineTo(19, 6); ctx.lineTo(19, 12);
    ctx.arc(16, 20.5, 10, -Math.PI * 0.32, Math.PI * 1.32); ctx.lineTo(13, 6); ctx.closePath();
    fill(ctx, 'rgba(225,240,255,0.55)');
    // liquid
    ctx.save(); ctx.beginPath(); ctx.arc(16, 20.5, 9, 0, Math.PI * 2); ctx.clip();
    ctx.beginPath(); ctx.moveTo(5, 17); ctx.quadraticCurveTo(10, 15, 16, 17); ctx.quadraticCurveTo(22, 19, 27, 16); ctx.lineTo(27, 31); ctx.lineTo(5, 31); ctx.closePath();
    fill(ctx, rg(ctx, 16, 23, 10, [shade(c, 0.35), c, shade(c, -0.35)], 13, 20));
    ctx.beginPath(); ctx.moveTo(5, 17); ctx.quadraticCurveTo(10, 15, 16, 17); ctx.quadraticCurveTo(22, 19, 27, 16); stroke(ctx, css(shade(c, 0.55)), 1.2);
    for (const [x, y, r] of [[19, 24, 1.3], [13, 26, 0.9], [21, 20, 0.7]]) { circle(ctx, x, y, r); fill(ctx, W(0.7)); }
    ctx.restore();
    // cork + rim
    ctx.beginPath(); ctx.roundRect(12, 2.5, 8, 4.5, 1.2); fill(ctx, lg(ctx, 0, 2, 0, 7, [0xd4a06a, 0x8a5a34]));
    ctx.beginPath(); ctx.roundRect(11.5, 6, 9, 2, 1); fill(ctx, css(c2 === c ? 0xdfe6f5 : c2));
    // glass shine
    ctx.beginPath(); ctx.arc(16, 20.5, 7, Math.PI * 1.05, Math.PI * 1.45); stroke(ctx, W(0.85), 1.8);
    circle(ctx, 22, 25, 1); fill(ctx, W(0.6));
  },
  wand: (ctx, c, c2) => {
    ctx.beginPath(); ctx.moveTo(6, 27); ctx.lineTo(20, 13); stroke(ctx, css(0x8a5a34), 3.6);
    ctx.beginPath(); ctx.moveTo(6.5, 26.5); ctx.lineTo(20, 13); stroke(ctx, css(0xc48a54), 1.2);
    ctx.beginPath(); ctx.moveTo(5, 28); ctx.lineTo(10, 23); stroke(ctx, css(c2), 4.2);
    starPath(ctx, 23, 10, 5, 7.5, 3.2, -Math.PI / 2 + 0.3); fill(ctx, rg(ctx, 23, 10, 7.5, [0xffffff, shade(c, 0.3), c]));
    sparkle(ctx, 28, 21, 2.6, css(shade(c, 0.5))); sparkle(ctx, 13, 5, 2, css(shade(c, 0.5)));
  },
  staff: (ctx, c, c2) => {
    ctx.beginPath(); ctx.moveTo(5, 30); ctx.lineTo(21, 10); stroke(ctx, css(0x7a4a2a), 3.6);
    ctx.beginPath(); ctx.moveTo(5.6, 29.4); ctx.lineTo(21, 10); stroke(ctx, css(0xb57a48), 1.1);
    ctx.beginPath(); ctx.moveTo(10, 23.5); ctx.lineTo(12.5, 20.5); stroke(ctx, css(c2), 4);
    ctx.beginPath(); ctx.moveTo(21, 11); ctx.quadraticCurveTo(17, 4, 22, 1.5); ctx.moveTo(21, 11); ctx.quadraticCurveTo(29, 10, 30, 4);
    stroke(ctx, css(c2), 2.2);
    circle(ctx, 24.5, 6.5, 4.6); fill(ctx, rg(ctx, 24.5, 6.5, 4.6, [0xffffff, shade(c, 0.3), c, shade(c, -0.3)], 23, 5));
  },
  hat: (ctx, c, c2) => {
    ell(ctx, 16, 24, 14, 5); fill(ctx, lg(ctx, 0, 19, 0, 29, [shade(c, 0.15), shade(c, -0.3)]));
    ctx.beginPath(); ctx.moveTo(7, 23); ctx.quadraticCurveTo(11, 13, 13, 8); ctx.quadraticCurveTo(13, 3, 21, 2);
    ctx.quadraticCurveTo(17, 6, 18.5, 9); ctx.quadraticCurveTo(22, 15, 25, 23); ctx.quadraticCurveTo(16, 26, 7, 23); ctx.closePath();
    fill(ctx, lg(ctx, 7, 0, 25, 0, [shade(c, -0.25), c, shade(c, 0.3)]));
    ctx.save(); ctx.beginPath(); ctx.moveTo(7, 23); ctx.quadraticCurveTo(11, 13, 13, 8); ctx.lineTo(19, 8); ctx.quadraticCurveTo(22, 15, 25, 23); ctx.closePath(); ctx.clip();
    ctx.fillStyle = css(c2); ctx.fillRect(0, 18, 32, 3.6); ctx.restore();
    sparkle(ctx, 17, 19.8, 2.4, css(shade(c2, 0.5)));
    sparkle(ctx, 21, 2.2, 2.4, css(c2));
  },
  robe: (ctx, c, c2) => {
    ctx.beginPath();
    ctx.moveTo(12, 4); ctx.lineTo(20, 4); ctx.lineTo(27, 9); ctx.lineTo(30, 19); ctx.lineTo(25.5, 20); ctx.lineTo(23, 14);
    ctx.lineTo(25, 29); ctx.quadraticCurveTo(16, 31, 7, 29); ctx.lineTo(9, 14); ctx.lineTo(6.5, 20); ctx.lineTo(2, 19); ctx.lineTo(5, 9); ctx.closePath();
    fill(ctx, body(ctx, c));
    ctx.save(); ctx.clip();
    ctx.fillStyle = css(c2); ctx.fillRect(0, 26, 32, 6); ctx.fillRect(0, 17, 32, 2.2);
    ctx.beginPath(); ctx.moveTo(16, 5); ctx.lineTo(16, 31); stroke(ctx, css(c2), 1.8);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(12, 4); ctx.quadraticCurveTo(16, 9, 20, 4); fill(ctx, css(shade(c, -0.45)));
    ctx.beginPath(); ctx.moveTo(10, 16); ctx.lineTo(9.5, 25); stroke(ctx, W(0.3), 1.2);
  },
  shoes: (ctx, c, c2) => {
    ctx.beginPath();
    ctx.moveTo(8, 5); ctx.lineTo(17, 5); ctx.lineTo(17.5, 17); ctx.quadraticCurveTo(26, 17, 29, 22); ctx.quadraticCurveTo(31, 25, 27, 26);
    ctx.lineTo(7, 26); ctx.quadraticCurveTo(6, 15, 8, 5); ctx.closePath();
    fill(ctx, body(ctx, c));
    ctx.beginPath(); ctx.roundRect(6, 25, 23, 4, 2); fill(ctx, css(shade(c, -0.5)));
    ctx.beginPath(); ctx.roundRect(7, 3.5, 11, 4, 1.5); fill(ctx, css(c2));
    ctx.beginPath(); ctx.moveTo(29, 22); ctx.quadraticCurveTo(31, 18, 28.5, 17); stroke(ctx, css(c), 2);
    sheen(ctx, 10, 9, 10, 20, 1.4, 0.4);
  },
  gloves: (ctx, c, c2) => {
    ctx.beginPath();
    ctx.moveTo(9, 29); ctx.lineTo(9, 18); ctx.lineTo(5, 13); ctx.quadraticCurveTo(4, 10.5, 6.5, 11); ctx.lineTo(10, 14);
    ctx.lineTo(10, 5.5); ctx.quadraticCurveTo(11.5, 3.5, 13, 5.5); ctx.lineTo(13.5, 12);
    ctx.lineTo(15, 3.5); ctx.quadraticCurveTo(16.5, 2, 18, 3.8); ctx.lineTo(17.5, 12);
    ctx.lineTo(20, 5); ctx.quadraticCurveTo(21.8, 4, 22.6, 6); ctx.lineTo(21, 13.5);
    ctx.lineTo(24, 9.5); ctx.quadraticCurveTo(26, 9, 26, 11); ctx.lineTo(23, 20); ctx.lineTo(22, 29); ctx.closePath();
    fill(ctx, body(ctx, c));
    ctx.beginPath(); ctx.roundRect(8, 24, 15, 6, 1.5); fill(ctx, lg(ctx, 0, 24, 0, 30, [shade(c2, 0.3), c2]));
    ctx.beginPath(); ctx.moveTo(13.5, 12); ctx.lineTo(13.5, 16); ctx.moveTo(17.5, 12); ctx.lineTo(17.5, 16); stroke(ctx, D(0.3), 0.8);
    sparkle(ctx, 16, 20, 2.2, css(c2));
  },
  ring: (ctx, c, c2) => {
    ctx.beginPath(); ctx.ellipse(16, 20, 10, 9, 0, 0, Math.PI * 2); stroke(ctx, css(shade(c2, -0.35)), 4.4);
    ctx.beginPath(); ctx.ellipse(16, 20, 10, 9, 0, 0, Math.PI * 2); stroke(ctx, lg(ctx, 6, 11, 26, 29, [shade(c2, 0.5), c2, shade(c2, -0.2)]), 2.8);
    ctx.beginPath(); ctx.ellipse(16, 20, 10, 9, 0, Math.PI * 1.1, Math.PI * 1.35); stroke(ctx, W(0.8), 1);
    poly(ctx, [11, 8, 13.5, 4, 18.5, 4, 21, 8, 16, 14]); fill(ctx, lg(ctx, 11, 4, 21, 14, [shade(c, 0.5), c, shade(c, -0.35)]));
    poly(ctx, [11, 8, 21, 8, 16, 14]); fill(ctx, D(0.15));
    poly(ctx, [13.5, 4, 15.5, 4, 13.5, 7.5]); fill(ctx, W(0.8));
  },
  amulet: (ctx, c, c2) => {
    ctx.beginPath(); ctx.moveTo(5, 3); ctx.quadraticCurveTo(7, 15, 16, 17); ctx.quadraticCurveTo(25, 15, 27, 3);
    ctx.setLineDash([2.2, 1.2]); stroke(ctx, css(c2), 1.8); ctx.setLineDash([]);
    circle(ctx, 16, 22, 7.5); fill(ctx, lg(ctx, 9, 15, 23, 29, [shade(c2, 0.5), c2, shade(c2, -0.35)]));
    poly(ctx, [16, 16.5, 21, 22, 16, 27.5, 11, 22]); fill(ctx, rg(ctx, 16, 22, 6, [0xffffff, shade(c, 0.3), c, shade(c, -0.3)], 14.5, 20));
    sparkle(ctx, 14.6, 20.4, 1.8);
  },
  coin: (ctx, c, c2) => {
    ell(ctx, 16, 18, 12.5, 12.5); fill(ctx, css(shade(c, -0.4)));
    circle(ctx, 16, 16, 12.5); fill(ctx, rg(ctx, 16, 16, 12.5, [shade(c, 0.55), c, shade(c, -0.2)], 12, 11));
    circle(ctx, 16, 16, 9); stroke(ctx, css(shade(c, -0.3)), 1.2);
    starPath(ctx, 16, 16.4, 5, 6, 2.6); fill(ctx, lg(ctx, 10, 10, 22, 22, [shade(c, -0.15), shade(c, -0.4)]));
    ctx.beginPath(); ctx.arc(16, 16, 10.5, Math.PI * 1.1, Math.PI * 1.45); stroke(ctx, W(0.85), 1.6);
    void c2;
  },
  gem: (ctx, c, c2) => {
    const top = [9, 6, 23, 6, 29, 13], btm = 16;
    poly(ctx, [9, 6, 23, 6, 29, 13, btm, 29, 3, 13]); fill(ctx, body(ctx, c));
    poly(ctx, [9, 6, 23, 6, 21, 13, 11, 13]); fill(ctx, css(shade(c, 0.45)));
    poly(ctx, [3, 13, 11, 13, 16, 29]); fill(ctx, css(shade(c, 0.15)));
    poly(ctx, [21, 13, 29, 13, 16, 29]); fill(ctx, css(shade(c, -0.35)));
    poly(ctx, [11, 13, 21, 13, 16, 29]); fill(ctx, css(c));
    poly(ctx, [9, 6, 3, 13, 11, 13]); fill(ctx, css(shade(c, 0.25)));
    poly(ctx, [23, 6, 29, 13, 21, 13]); fill(ctx, css(shade(c, -0.1)));
    sparkle(ctx, 12, 8.5, 3.2); void top; void c2;
  },
  scroll: (ctx, c, c2) => {
    ctx.beginPath(); ctx.rect(7, 7, 18, 18); fill(ctx, lg(ctx, 7, 0, 25, 0, [shade(c, -0.1), c, shade(c, -0.15)]));
    for (const y of [11, 14.5, 18, 21.5]) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(y === 21.5 ? 17 : 22, y); stroke(ctx, D(0.3), 1); }
    for (const y of [6, 26]) {
      ctx.beginPath(); ctx.roundRect(4.5, y - 2.8, 23, 5.6, 2.8); fill(ctx, lg(ctx, 0, y - 2.8, 0, y + 2.8, [shade(c, 0.3), c, shade(c, -0.35)]));
      ell(ctx, 4.5, y, 1.6, 2.8); fill(ctx, css(shade(c, -0.4))); ell(ctx, 27.5, y, 1.6, 2.8); fill(ctx, css(shade(c, -0.25)));
    }
    ctx.beginPath(); ctx.roundRect(14, 22, 4, 9, 1); fill(ctx, css(c2));
    circle(ctx, 16, 25.5, 2.8); fill(ctx, rg(ctx, 16, 25.5, 2.8, [shade(c2, 0.4), c2, shade(c2, -0.3)]));
  },
  shell: (ctx, c, c2) => {
    ctx.beginPath(); ctx.moveTo(4, 28); ctx.quadraticCurveTo(2, 22, 6, 20); ctx.lineTo(10, 26); ctx.closePath(); fill(ctx, css(c2));
    circle(ctx, 17, 16, 12); fill(ctx, rg(ctx, 17, 16, 12, [shade(c, 0.45), c, shade(c, -0.35)], 14, 11));
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.02) {
      const a = t * Math.PI * 4.2 + 0.6, r = 11 * (1 - t * 0.9);
      const x = 17 + Math.cos(a) * r, y = 16 + Math.sin(a) * r;
      if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    stroke(ctx, css(shade(c, -0.45)), 1.6);
    ctx.beginPath(); ctx.arc(17, 16, 9.5, Math.PI * 1.15, Math.PI * 1.5); stroke(ctx, W(0.6), 1.4);
  },
  jelly: (ctx, c, c2) => {
    ctx.beginPath(); ctx.moveTo(4, 26);
    ctx.quadraticCurveTo(3, 9, 16, 7); ctx.quadraticCurveTo(29, 9, 28, 26); ctx.quadraticCurveTo(16, 30, 4, 26); ctx.closePath();
    fill(ctx, rg(ctx, 16, 18, 14, [shade(c, 0.5), c, shade(c, -0.3)], 12, 13, 0.92));
    ell(ctx, 11, 13, 3.5, 2.2, -0.5); fill(ctx, W(0.85));
    circle(ctx, 16, 10.5, 1.1); fill(ctx, W(0.7));
    for (const [x, y, r] of [[20, 20, 1.6], [13, 22, 1]]) { circle(ctx, x, y, r); fill(ctx, css(shade(c2, 0.3), 0.7)); }
  },
  mushroom: (ctx, c, c2) => {
    ctx.beginPath(); ctx.moveTo(11.5, 17); ctx.lineTo(20.5, 17); ctx.quadraticCurveTo(22, 26, 20, 29); ctx.lineTo(12, 29); ctx.quadraticCurveTo(10, 26, 11.5, 17); ctx.closePath();
    fill(ctx, lg(ctx, 11, 0, 21, 0, [0xfff3dc, 0xe0c8a0]));
    ctx.beginPath(); ctx.moveTo(2.5, 18); ctx.quadraticCurveTo(3, 4, 16, 3.5); ctx.quadraticCurveTo(29, 4, 29.5, 18); ctx.quadraticCurveTo(16, 21.5, 2.5, 18); ctx.closePath();
    fill(ctx, rg(ctx, 16, 12, 15, [shade(c, 0.35), c, shade(c, -0.3)], 11, 7));
    const spot = c2 === c ? 0xffffff : c2;
    for (const [x, y, r] of [[10, 10, 2.6], [19, 7.5, 2.1], [23.5, 13, 2.2], [14.5, 15, 1.6]]) { ell(ctx, x, y, r, r * 0.85); fill(ctx, css(spot)); }
    ctx.beginPath(); ctx.moveTo(5, 16); ctx.quadraticCurveTo(5, 8, 10, 5.5); stroke(ctx, W(0.5), 1.3);
  },
  feather: (ctx, c, c2) => {
    ctx.beginPath(); ctx.moveTo(26, 3);
    ctx.quadraticCurveTo(29, 13, 17, 22); ctx.lineTo(18, 19.5); ctx.lineTo(14, 22.5); ctx.lineTo(15.5, 19); ctx.lineTo(9, 23);
    ctx.quadraticCurveTo(12, 8, 26, 3); ctx.closePath();
    fill(ctx, lg(ctx, 26, 3, 9, 23, [shade(c, 0.45), c, shade(c, -0.25)]));
    ctx.beginPath(); ctx.moveTo(26, 3); ctx.quadraticCurveTo(17, 13, 4, 29); stroke(ctx, css(c2 === c ? shade(c, 0.6) : c2), 1.4);
    for (const t of [0.3, 0.5, 0.7]) {
      const x = 26 - 22 * t, y = 3 + 26 * t;
      ctx.beginPath(); ctx.moveTo(x + 1, y - 1); ctx.lineTo(x + 5, y - 2); stroke(ctx, D(0.25), 0.8);
    }
  },
  fur: (ctx, c, c2) => {
    ctx.beginPath(); ctx.moveTo(4, 26);
    const bumps = [[3, 16], [7, 8], [13, 5], [19, 4], [25, 8], [29, 16], [28, 26]];
    let px = 4, py = 26;
    for (const [x, y] of bumps) { ctx.quadraticCurveTo((px + x) / 2 - 2, (py + y) / 2 - 3, x, y); px = x; py = y; }
    ctx.quadraticCurveTo(16, 31, 4, 26); ctx.closePath();
    fill(ctx, rg(ctx, 16, 17, 15, [shade(c, 0.4), c, shade(c, -0.3)], 13, 12));
    for (const [x0, y0, x1, y1] of [[10, 12, 12, 20], [16, 9, 16, 19], [21, 11, 20, 21], [13, 18, 14, 25], [19, 18, 18, 25]]) {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 - 1.5, (y0 + y1) / 2, x1, y1); stroke(ctx, css(shade(c, -0.3), 0.8), 1);
    }
    ctx.beginPath(); ctx.moveTo(8, 12); ctx.quadraticCurveTo(11, 7, 16, 6.5); stroke(ctx, css(c2 === c ? 0xffffff : c2, 0.6), 1.4);
  },
  bone: (ctx, c) => {
    ctx.save(); ctx.translate(16, 16); ctx.rotate(-Math.PI / 4);
    ctx.beginPath(); ctx.roundRect(-9, -2.8, 18, 5.6, 1.5); fill(ctx, lg(ctx, 0, -3, 0, 3, [shade(c, 0.3), c, shade(c, -0.25)]));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      circle(ctx, sx * 10, sy * 3.2, 4); fill(ctx, rg(ctx, sx * 10, sy * 3.2, 4, [shade(c, 0.4), c, shade(c, -0.25)], sx * 10 - 1, sy * 3.2 - 1));
    }
    ctx.beginPath(); ctx.moveTo(-7, -1.2); ctx.lineTo(7, -1.2); stroke(ctx, W(0.55), 1);
    ctx.restore();
  },
  crystal: (ctx, c, c2) => {
    const prism = (x: number, y0: number, y1: number, w: number, col: number) => {
      poly(ctx, [x, y0, x + w, y0 + w * 0.9, x + w, y1, x, y1 + w * 0.5, x - w, y1, x - w, y0 + w * 0.9]);
      fill(ctx, lg(ctx, x - w, 0, x + w, 0, [shade(col, 0.45), col, shade(col, -0.35)]));
      poly(ctx, [x, y0, x, y1 + w * 0.5, x - w, y1, x - w, y0 + w * 0.9]); fill(ctx, W(0.22));
      ctx.beginPath(); ctx.moveTo(x - w * 0.55, y0 + w * 1.4); ctx.lineTo(x - w * 0.55, y1 - 1); stroke(ctx, W(0.7), 1);
    };
    prism(8.5, 12, 26, 4, shade(c, -0.1));
    prism(23.5, 10, 26, 4, c2 === c ? shade(c, 0.15) : c2);
    prism(16, 3, 27, 5.5, c);
    ctx.beginPath(); ctx.roundRect(3, 26, 26, 4, 2); fill(ctx, css(0x6b6070));
  },
  scale: (ctx, c, c2) => {
    const sc = (x: number, y: number, s: number, col: number) => {
      ctx.beginPath(); ctx.moveTo(x - 8 * s, y - 4 * s);
      ctx.quadraticCurveTo(x - 8 * s, y + 6 * s, x, y + 11 * s); ctx.quadraticCurveTo(x + 8 * s, y + 6 * s, x + 8 * s, y - 4 * s);
      ctx.quadraticCurveTo(x, y - 8 * s, x - 8 * s, y - 4 * s); ctx.closePath();
      fill(ctx, lg(ctx, x - 8 * s, y - 6 * s, x + 8 * s, y + 10 * s, [shade(col, 0.4), col, shade(col, -0.35)]));
      ctx.beginPath(); ctx.moveTo(x, y - 5 * s); ctx.lineTo(x, y + 9 * s); stroke(ctx, css(shade(col, -0.3), 0.8), 1);
      ctx.beginPath(); ctx.moveTo(x - 5.5 * s, y - 2 * s); ctx.quadraticCurveTo(x - 5.5 * s, y + 4 * s, x - 2 * s, y + 7 * s); stroke(ctx, W(0.5), 1.1);
    };
    const col2 = c2 === c ? shade(c, -0.15) : c2;
    sc(9, 9, 0.7, col2); sc(23, 9, 0.7, col2);
    sc(16, 15, 1.05, c);
  },
};

// ───────────────────────────── rendering + caches ─────────────────────────────

const DEFAULT_C2: Partial<Record<IconGlyph, number>> = {
  flame: 0xffe066, fireball: 0xffe066, meteor: 0x6b4a3a, phoenix: 0xffd23a, ember: 0xffe066, explosion: 0xfff0a0,
  snowflake: 0xeaf8ff, icicle: 0xf4fbff, ice_shard: 0xeaf8ff, frost_nova: 0xeaf8ff, blizzard: 0xffffff, glacier: 0xf4fbff,
  bolt: 0xfff7b0, chain: 0xfff7b0, storm: 0xffe866, thunder_cloud: 0xffe866, spark: 0xfff7b0, orb: 0xffffff,
  arcane_star: 0xffffff, missile: 0xffffff, claw: 0xffffff, shield: 0xe8d36a, teleport: 0xffffff, book: 0xe8d36a,
  halo: 0xfff6c8, holy_cross: 0xfff6c8, sunburst: 0xfff6c8, wings: 0xffffff, skull: 0x8af08a, scythe: 0x8a6a4a, ghost: 0x7ee8a0,
  poison: 0xc8ff8a, paw: 0xffd8c8,
  eye: 0xffe066, wind: 0xffffff, potion: 0xdfe6f5, wand: 0xe8d36a, staff: 0xe8d36a, hat: 0xe8d36a, robe: 0xe8d36a,
  shoes: 0xe8d36a, gloves: 0xe8d36a, ring: 0xf0c94a, amulet: 0xf0c94a, scroll: 0xc03a3a, shell: 0xb9a07a, mushroom: 0xffffff,
};

function hex(n: number | undefined) { return n == null ? '-' : (n >>> 0).toString(16); }
function specKey(spec: IconSpec, size: number) { return `${spec.glyph}_${hex(spec.color)}_${hex(spec.color2)}_${hex(spec.bg)}_${size}`; }

const canvasCache = new Map<string, HTMLCanvasElement | null>();
const urlCache = new Map<string, string>();

function renderGlyphCanvas(spec: IconSpec, S: number, inTile: boolean): HTMLCanvasElement | null {
  const g = makeCanvas(S, S);
  const ctx = g?.getContext('2d');
  if (!g || !ctx) return null;
  const k = S / 32;
  ctx.scale(k, k);
  if (inTile) { ctx.translate(16, 16); ctx.scale(0.84, 0.84); ctx.translate(-16, -16); }
  const painter = P[spec.glyph] ?? P.orb;
  const c = spec.color ?? 0x9be7ff;
  const c2 = spec.color2 ?? DEFAULT_C2[spec.glyph] ?? shade(c, 0.5);
  try { painter(ctx, c, c2); } catch (e) { console.warn('[icons] painter failed', spec.glyph, e); }
  return g;
}

/** Dilated silhouette of `src` filled with `color`. */
function silhouette(src: HTMLCanvasElement, S: number, r: number, color: string): HTMLCanvasElement | null {
  const o = makeCanvas(S, S);
  const ctx = o?.getContext('2d');
  if (!o || !ctx) return null;
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.drawImage(src, Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
  return o;
}

function drawTile(ctx: Ctx, S: number, bg: number, glyphColor: number) {
  const k = S / 32;
  ctx.save(); ctx.scale(k, k);
  ctx.beginPath(); ctx.roundRect(1, 1, 30, 30, 6);
  ctx.fillStyle = lg(ctx, 0, 1, 0, 31, [shade(bg, 0.28), bg, shade(bg, -0.38)]); ctx.fill();
  ctx.lineWidth = 1.3; ctx.strokeStyle = css(mix(shade(bg, -0.65), 0x100820, 0.4)); ctx.stroke();
  // glyph-colored inner glow
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
  g.addColorStop(0, css(glyphColor, 0.35)); g.addColorStop(1, css(glyphColor, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(2, 2, 28, 28, 5); ctx.fill();
  // bevel
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(3, 25); ctx.lineTo(3, 7); ctx.quadraticCurveTo(3, 3, 7, 3); ctx.lineTo(25, 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(29, 7); ctx.lineTo(29, 25); ctx.quadraticCurveTo(29, 29, 25, 29); ctx.lineTo(7, 29);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
  // top gloss
  ctx.beginPath(); ctx.roundRect(3, 3, 26, 11, [4, 4, 8, 8]);
  const gl = ctx.createLinearGradient(0, 3, 0, 14);
  gl.addColorStop(0, 'rgba(255,255,255,0.22)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fill();
  ctx.restore();
}

/** Renders (and caches) the icon canvas. */
export function iconCanvas(spec: IconSpec, size = 32): HTMLCanvasElement | null {
  const S = Math.max(8, Math.round(size));
  const key = specKey(spec, S);
  if (canvasCache.has(key)) return canvasCache.get(key) ?? null;
  const out = makeCanvas(S, S);
  const ctx = out?.getContext('2d');
  if (!out || !ctx) { canvasCache.set(key, null); return null; }
  const tile = spec.bg != null;
  try {
    if (renderPixelIcon(ctx, spec, S)) { canvasCache.set(key, out); return out; }
  } catch (e) { console.warn('[icons] pixel icon failed', spec, e); }
  try {
    const glyph = renderGlyphCanvas(spec, S, tile);
    if (glyph) {
      const r = Math.max(0.9, S / 32 * (tile ? 0.95 : 1.1));
      const ol = css(mix(shade(spec.color ?? 0x888888, -0.7), 0x140c26, 0.5));
      const sil = silhouette(glyph, S, r, ol);
      if (tile) drawTile(ctx, S, spec.bg!, spec.color ?? 0xffffff);
      else if (sil) { ctx.globalAlpha = 0.28; ctx.drawImage(sil, 0, Math.max(1, S / 32 * 1.4)); ctx.globalAlpha = 1; }
      if (sil) ctx.drawImage(sil, 0, 0);
      ctx.drawImage(glyph, 0, 0);
    }
  } catch (e) { console.warn('[icons] render failed', spec, e); }
  canvasCache.set(key, out);
  return out;
}

/** Pure-canvas icon painter (no Phaser needed) — cached data URL for DOM UI. */
export function iconDataUrl(spec: IconSpec, size = 32): string {
  if (!spec) return '';
  const key = specKey(spec, Math.max(8, Math.round(size)));
  const hit = urlCache.get(key);
  if (hit) return hit;
  const c = iconCanvas(spec, size);
  if (!c) return '';
  let url = '';
  try { url = c.toDataURL('image/png'); } catch { url = ''; }
  urlCache.set(key, url);
  return url;
}

/** Same icon registered as a Phaser texture (cached); returns texture key. */
export function iconTexture(scene: Phaser.Scene, spec: IconSpec, size = 32): string {
  if (!spec) return '__DEFAULT';
  const key = `icon_v${iconVersion}_${specKey(spec, Math.max(8, Math.round(size)))}`;
  try {
    if (scene.textures.exists(key)) return key;
    const c = iconCanvas(spec, size);
    if (!c) return '__DEFAULT';
    // Copy so the cached canvas stays independent of the GPU texture lifecycle.
    const copy = makeCanvas(c.width, c.height);
    copy?.getContext('2d')?.drawImage(c, 0, 0);
    if (!copy || !scene.textures.addCanvas(key, copy)) return '__DEFAULT';
    return key;
  } catch (e) {
    console.warn('[icons] iconTexture failed', e);
    return '__DEFAULT';
  }
}

/** Every glyph the painter supports (for debug galleries). */
export const ICON_GLYPHS = Object.keys(P) as IconGlyph[];

// ───────────────────────────── 16-bit pixel icons (sheet) ─────────────────────────────

const SHEET_PATH = 'ui/icons/rpg_icons_7soul1.png';
const SHEET_COLS = 12;
const CELL = 34;   // sheet cell; the icon art sits in the centred 32×32
const SHEET_NAMES = ['S_Fire01', 'S_Fire02', 'S_Fire03', 'S_Fire04', 'S_Fire05', 'S_Fire06', 'S_Fire07', 'S_Fire08', 'S_Light01', 'S_Light02', 'S_Light03', 'S_Light04', 'S_Holy01', 'S_Holy05', 'S_Holy08', 'S_Holy09', 'S_Ice01', 'S_Ice02', 'S_Ice03', 'S_Ice04', 'S_Ice05', 'S_Ice06', 'S_Ice07', 'S_Ice08', 'S_Ice09', 'S_Magic01', 'S_Magic02', 'S_Magic03', 'S_Magic04', 'S_Magic05', 'S_Magic06', 'S_Magic10', 'S_Thunder01', 'S_Thunder02', 'S_Thunder03', 'S_Thunder04', 'S_Thunder05', 'S_Thunder06', 'S_Thunder07', 'S_Wind01', 'S_Wind03', 'S_Wind04', 'S_Wind05', 'S_Wind06', 'S_Wind07', 'S_Water01', 'S_Water02', 'S_Water04', 'S_Water05', 'S_Water06', 'S_Water07', 'S_Shadow02', 'S_Shadow08', 'S_Shadow09', 'S_Shadow11', 'S_Shadow14', 'S_Shadow15', 'S_Physic01', 'S_Buff01', 'S_Buff09', 'S_Buff14', 'P_Red01', 'P_Red07', 'P_Blue01', 'P_Blue05', 'P_Pink01', 'P_Pink06', 'P_Orange01', 'P_Yellow01', 'P_White01', 'P_Green01', 'W_Staff01', 'W_Staff02', 'W_Staff03', 'W_Staff04', 'W_Staff05', 'W_Staff06', 'W_Staff07', 'W_Staff08', 'W_Book01', 'W_Book06', 'W_Book07', 'W_Fist001', 'W_Fist002', 'W_Fist004', 'C_Hat01', 'C_Hat02', 'A_Clothing01', 'A_Clothing02', 'A_Armour01', 'A_Shoes01', 'A_Shoes02', 'A_Shoes03', 'A_Shoes04', 'A_Shoes06', 'A_Shoes07', 'Ac_Ring01', 'Ac_Ring02', 'Ac_Necklace01', 'Ac_Necklace03', 'Ac_Necklace04', 'Ac_Necklace07', 'Ac_Medal01', 'I_GoldCoin', 'I_SilverCoin', 'I_BronzeCoin', 'I_Ruby', 'I_Sapphire', 'I_Diamond', 'I_Jade', 'I_Amethist', 'I_Opal', 'I_Agate', 'I_Scroll', 'I_Scroll02', 'I_SnailShell', 'I_SolidShell', 'I_C_Mushroom', 'I_Feather01', 'I_Feather02', 'I_WolfFur', 'I_FoxTail', 'I_Bone', 'I_Fang', 'I_Crystal01', 'I_Crystal02', 'I_Crystal03', 'I_FishTail', 'I_Eye', 'I_Book', 'I_Chest01', 'I_Map', 'I_Key01', 'I_Clock', 'I_Mirror'] as const;
export type PixelIconName = typeof SHEET_NAMES[number];

/** A sheet icon; `tint` = palette-swap it to spec.color (by luminance) instead of drawing it as-is. */
interface Cand { n: PixelIconName; tint?: boolean }
const A = (...n: PixelIconName[]): Cand[] => n.map(x => ({ n: x }));
const T = (n: PixelIconName): Cand => ({ n, tint: true });

/**
 * Glyph → candidate sheet icons. Specs sharing a glyph get distinct candidates (assigned in Registry order,
 * skills and items separately) and an untinted candidate is used only if its colour is close to spec.color;
 * otherwise a tinted (palette-swapped) candidate is used.
 */
const PIXEL_ICONS: Record<IconGlyph, Cand[]> = {
  halo: [...A('S_Holy01', 'S_Holy09'), T('S_Holy05')],
  holy_cross: [...A('S_Holy05', 'S_Holy08'), T('S_Holy01')],
  sunburst: [...A('S_Holy08', 'S_Light01', 'S_Light03'), T('S_Light02')],
  wings: [...A('I_Feather02', 'S_Holy09'), T('I_Feather01')],
  skull: [...A('S_Shadow08', 'I_Bone'), T('S_Shadow09')],
  scythe: [...A('S_Shadow14', 'S_Shadow15'), T('S_Shadow02')],
  ghost: [...A('S_Shadow11', 'S_Shadow09'), T('S_Shadow02')],
  poison: [...A('P_Green01', 'S_Shadow02'), T('S_Water05')],
  paw: [...A('I_FoxTail', 'I_WolfFur'), T('I_Fang')],
  flame: A('S_Fire03', 'S_Fire02', 'S_Fire04'),
  fireball: [...A('S_Fire01', 'S_Fire05'), T('S_Magic03')],
  meteor: A('S_Fire05', 'S_Fire06'),
  phoenix: [...A('S_Fire07'), T('S_Holy05'), T('S_Holy08'), ...A('S_Fire01')],
  ember: [T('S_Light01'), ...A('S_Fire08', 'S_Buff09'), T('S_Light02')],
  explosion: [T('S_Physic01'), T('S_Light02'), ...A('S_Fire06')],
  snowflake: [...A('S_Ice02'), T('S_Light01')],
  icicle: A('S_Ice03', 'S_Ice09', 'S_Ice05'),
  ice_shard: A('S_Ice04', 'S_Ice03'),
  frost_nova: [...A('S_Magic02', 'S_Water02'), T('S_Ice05')],
  blizzard: [...A('S_Water05', 'S_Ice07'), T('S_Wind05')],
  glacier: A('S_Ice01', 'S_Water04', 'S_Ice08'),
  bolt: A('S_Thunder01', 'S_Thunder04', 'S_Thunder05'),
  chain: A('S_Thunder06', 'S_Thunder05', 'S_Thunder04'),
  storm: [...A('S_Thunder07'), T('S_Water05'), T('S_Wind01')],
  thunder_cloud: [T('S_Water01'), T('S_Wind04')],
  spark: [...A('S_Light01', 'S_Thunder03'), T('S_Light01')],
  orb: [...A('S_Ice06', 'S_Thunder02', 'S_Water07'), T('S_Magic04'), T('S_Shadow02')],
  arcane_star: [T('S_Light01'), T('S_Fire08'), T('S_Holy08')],
  missile: [T('S_Magic03'), T('S_Light04')],
  claw: [T('S_Shadow09'), T('S_Shadow08')],
  shield: [...A('S_Holy09'), T('S_Water07'), T('S_Holy09')],
  teleport: [T('S_Shadow11'), T('S_Magic05'), T('S_Magic06')],
  book: [T('S_Shadow15'), ...A('W_Book06', 'W_Book07', 'W_Book01', 'I_Book')],
  eye: [T('S_Shadow14'), ...A('I_Eye')],
  wind: [...A('S_Water06', 'S_Wind07', 'S_Wind03', 'S_Wind06'), T('S_Wind03')],
  heart: [...A('S_Holy01'), T('S_Holy01')],
  mana: [T('S_Magic04'), T('S_Light03'), T('S_Water07')],
  potion: A('P_Red01', 'P_Blue01', 'P_Pink06', 'P_Orange01', 'P_Yellow01', 'P_White01', 'P_Green01', 'P_Red07', 'P_Blue05', 'P_Pink01'),
  wand: [...A('W_Staff01', 'W_Staff08', 'S_Light04')],
  staff: A('W_Staff02', 'W_Staff03', 'W_Staff04', 'W_Staff05', 'W_Staff06', 'W_Staff07', 'W_Staff08', 'W_Staff01'),
  hat: [...A('C_Hat01', 'C_Hat02'), T('C_Hat01'), T('C_Hat02')],
  robe: [...A('A_Clothing01', 'A_Clothing02'), T('A_Armour01'), T('A_Clothing02')],
  shoes: A('A_Shoes01', 'A_Shoes02', 'A_Shoes03', 'A_Shoes04', 'A_Shoes06', 'A_Shoes07'),
  gloves: [...A('W_Fist002', 'W_Fist001', 'W_Fist004'), T('W_Fist001')],
  ring: A('Ac_Ring02', 'Ac_Ring01'),
  amulet: A('Ac_Necklace03', 'Ac_Necklace01', 'Ac_Necklace07', 'Ac_Necklace04', 'Ac_Medal01'),
  coin: A('I_GoldCoin', 'I_SilverCoin', 'I_BronzeCoin'),
  gem: [...A('I_Ruby', 'I_Sapphire', 'I_Diamond', 'I_Jade', 'I_Amethist', 'I_Opal'), T('I_Diamond')],
  scroll: A('I_Scroll', 'I_Scroll02'),
  shell: [...A('I_SnailShell', 'I_SolidShell'), T('I_SnailShell')],
  jelly: [T('I_Agate'), ...A('I_Agate')],
  mushroom: [...A('I_C_Mushroom'), T('I_C_Mushroom')],
  feather: [...A('I_Feather01', 'I_Feather02'), T('I_Feather01'), T('I_Feather02')],
  fur: [...A('I_WolfFur', 'I_FoxTail'), T('I_WolfFur')],
  bone: [...A('I_Bone', 'I_Fang'), T('I_Bone')],
  crystal: [...A('I_Crystal01', 'I_Amethist', 'I_Crystal03'), T('I_Crystal03')],
  scale: [T('I_SolidShell'), ...A('I_FishTail'), T('I_FishTail')],
};

let sheet: HTMLImageElement | null = null;
let sheetFailed = false;
let iconVersion = 0;
const readyCbs: (() => void)[] = [];
const sigCache = new Map<PixelIconName, number>();
const assigned = new Map<string, Cand>();
let assignedDone = false;

/** True once the pixel icon sheet has loaded (icons are pixel art from then on). */
export function pixelIconsReady(): boolean { return !!sheet; }
/**
 * Runs `cb` when the pixel icon sheet finishes loading (immediately if already loaded).
 * Returns an unsubscribe fn (call it from the subscriber's destroy so retired UI is not retained).
 * Pending subscribers are dropped if the sheet fails to load (they would never fire).
 */
export function onPixelIconsReady(cb: () => void): () => void {
  if (sheet) { try { cb(); } catch (e) { console.warn('[icons] ready cb failed', e); } return () => { /* already ran */ }; }
  if (sheetFailed) return () => { /* never fires */ };
  readyCbs.push(cb);
  return () => { const i = readyCbs.indexOf(cb); if (i >= 0) readyCbs.splice(i, 1); };
}

function loadSheet() {
  if (typeof Image === 'undefined') return;
  try {
    const img = new Image();
    img.onload = () => {
      sheet = img;
      iconVersion++;
      canvasCache.clear(); urlCache.clear(); sigCache.clear(); assigned.clear(); assignedDone = false;
      for (const cb of readyCbs.splice(0)) { try { cb(); } catch (e) { console.warn('[icons] ready cb failed', e); } }
      try { bus.emit('player:changed', {}); } catch { /* no game yet */ }
    };
    img.onerror = () => {
      sheetFailed = true;
      readyCbs.length = 0;
      console.warn('[icons] pixel icon sheet failed to load; using procedural icons');
    };
    img.src = assetUrl(SHEET_PATH);
  } catch (e) { console.warn('[icons] pixel icon sheet unavailable', e); }
}
loadSheet();

function cellXY(n: PixelIconName): [number, number] {
  const i = SHEET_NAMES.indexOf(n);
  return [(i % SHEET_COLS) * CELL + 1, Math.floor(i / SHEET_COLS) * CELL + 1];
}

function iconPixels(n: PixelIconName): ImageData | null {
  if (!sheet) return null;
  const c = makeCanvas(32, 32);
  const x = c?.getContext('2d', { willReadFrequently: true });
  if (!c || !x) return null;
  const [sx, sy] = cellXY(n);
  x.drawImage(sheet, sx, sy, 32, 32, 0, 0, 32, 32);
  return x.getImageData(0, 0, 32, 32);
}

/** Saturation-weighted average colour of a sheet icon (its "identity" colour). */
function signature(n: PixelIconName): number {
  const hit = sigCache.get(n);
  if (hit !== undefined) return hit;
  const d = iconPixels(n)?.data;
  let r = 0, g = 0, b = 0, w = 0, pr = 0, pg = 0, pb = 0, pn = 0;
  if (d) for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const R = d[i], G = d[i + 1], B = d[i + 2];
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    if (mx < 40) continue; // outline
    const sat = mx ? (mx - mn) / mx : 0, vivid = sat * (mx / 255), wt = vivid * vivid * vivid; // bright + saturated dominates
    r += R * wt; g += G * wt; b += B * wt; w += wt; pr += R; pg += G; pb += B; pn++;
  }
  const sig = w > pn * 0.04 ? ((r / w) << 16) | ((g / w) << 8) | (b / w) : pn ? ((pr / pn) << 16) | ((pg / pn) << 8) | (pb / pn) : 0x808080;
  sigCache.set(n, sig);
  return sig;
}

/** "Redmean" perceptual RGB distance (0..~765). */
function cdist(a: number, b: number): number {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  const rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

const MATCH = 200; // an untinted candidate within this distance of spec.color is "the right colour"

/** Near-white specs (e.g. white-hot lightning) carry their hue in color2. */
function isWhite(n: number | undefined) { return n != null && luma(n) > 0.85; }

function pickCand(spec: IconSpec, cands: Cand[], used: Set<PixelIconName>): Cand {
  const col = spec.color ?? 0x888888;
  const ordered = spec.bg != null;          // skill tiles: candidate lists are hand-ordered, take the first that fits
  const white = ordered && isWhite(col);    // white-hot skills fit any untinted icon: first free one in list order
  const dist = (c: Cand) => (white ? 0 : cdist(signature(c.n), col));
  const untinted = cands.filter(c => !c.tint), tinted = cands.filter(c => c.tint);
  // 1. an unused untinted icon of the right colour
  let best: Cand | null = null, bd = Infinity;
  for (const c of untinted) {
    if (used.has(c.n)) continue;
    const d = dist(c);
    if (d < MATCH && d < bd) { best = c; bd = d; if (ordered) break; }
  }
  if (best) return best;
  // 2. an unused tinted icon (recoloured to spec.color)
  const freeT = tinted.find(c => !used.has(c.n));
  if (freeT) return freeT;
  // 3. the closest unused untinted icon, then 4. the closest/first of anything
  for (const pass of [true, false]) {
    for (const c of untinted) {
      if (pass && used.has(c.n)) continue;
      const d = dist(c);
      if (d < bd) { best = c; bd = d; }
    }
    if (best) return best;
  }
  return tinted[0] ?? cands[0];
}

function colorKey(spec: IconSpec) { return `${spec.glyph}_${hex(spec.color)}_${hex(spec.color2)}_${spec.bg != null ? 't' : 'i'}`; }

/** Deterministic, collision-avoiding glyph→icon assignment over every skill and item in the Registry. */
function ensureAssignments() {
  if (assignedDone || !sheet) return;
  assignedDone = true;
  const used = new Map<string, Set<PixelIconName>>();
  const specs: IconSpec[] = [];
  try { for (const s of Registry.skills()) if (s?.icon) specs.push(s.icon); } catch { /* registry unavailable */ }
  try { for (const it of Registry.items()) if (it?.icon) specs.push(it.icon); } catch { /* registry unavailable */ }
  for (const spec of specs) {
    const cands = PIXEL_ICONS[spec.glyph];
    if (!cands?.length) continue;
    const k = colorKey(spec);
    if (assigned.has(k)) continue;
    const uk = `${spec.glyph}_${spec.bg != null ? 't' : 'i'}`;
    let u = used.get(uk);
    if (!u) { u = new Set(); used.set(uk, u); }
    const c = pickCand(spec, cands, u);
    u.add(c.n);
    assigned.set(k, c);
  }
}

function chooseCand(spec: IconSpec): Cand | null {
  const cands = PIXEL_ICONS[spec.glyph];
  if (!cands?.length) return null;
  ensureAssignments();
  return assigned.get(colorKey(spec)) ?? pickCand(spec, cands, new Set());
}

/** Palette-swap a sheet icon to spec.color by luminance (outline pixels are kept). */
function recolor(img: ImageData, color: number, color2: number | undefined) {
  const hi = color2 != null && Math.abs(luma(color2) - luma(color)) > 0.12 && luma(color2) > luma(color) ? mix(color, color2, 0.6) : shade(color, 0.6);
  const stops = [shade(color, -0.78), shade(color, -0.5), shade(color, -0.2), color, mix(color, hi, 0.55), hi, shade(hi, 0.7)];
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const L = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    if (L < 0.12) continue;
    const t = Math.min(0.999, (L - 0.12) / 0.88) * stops.length;
    const [r, g, b] = rgb(stops[Math.floor(t)]);
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
}
function luma(n: number) { const [r, g, b] = rgb(n); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

/** Banded 16-bit tile behind skill icons: bg colour in 3 bands, 1-unit dark outline + bevel drawn on top later. */
function pixelTileBack(ctx: Ctx, S: number, u: number, bg: number) {
  const bands = [shade(bg, 0.16), shade(bg, 0.06), bg, shade(bg, -0.18)];
  const bh = Math.ceil(S / bands.length / u) * u;
  bands.forEach((c, i) => { ctx.fillStyle = css(c); ctx.fillRect(0, i * bh, S, bh); });
  // sparse dither between bands
  ctx.fillStyle = css(shade(bg, 0.16));
  for (let y = bh; y < bh + u * 2; y += u) for (let x = ((y / u) % 2) * u; x < S; x += u * 2) ctx.fillRect(x, y, u, u);
}
function pixelTileFrame(ctx: Ctx, S: number, u: number, bg: number) {
  const dark = '#140c1c';
  ctx.fillStyle = css(shade(bg, 0.5));
  ctx.fillRect(u, u, S - 2 * u, u); ctx.fillRect(u, u, u, S - 2 * u);
  ctx.fillStyle = css(shade(bg, -0.55));
  ctx.fillRect(u, S - 2 * u, S - 2 * u, u); ctx.fillRect(S - 2 * u, u, u, S - 2 * u);
  ctx.fillStyle = dark;
  ctx.fillRect(u, 0, S - 2 * u, u); ctx.fillRect(u, S - u, S - 2 * u, u);
  ctx.fillRect(0, u, u, S - 2 * u); ctx.fillRect(S - u, u, u, S - 2 * u);
  ctx.clearRect(0, 0, u, u); ctx.clearRect(S - u, 0, u, u); ctx.clearRect(0, S - u, u, u); ctx.clearRect(S - u, S - u, u, u);
}

/** Draws the sheet icon for `spec` into ctx (S×S) at an integer scale. Returns false if unavailable. */
function renderPixelIcon(ctx: Ctx, spec: IconSpec, S: number): boolean {
  if (!sheet) return false;
  const cand = chooseCand(spec);
  if (!cand) return false;
  const px = iconPixels(cand.n);
  if (!px) return false;
  if (cand.tint) {
    const col = spec.color ?? 0x888888;
    if (isWhite(col) && spec.color2 != null && !isWhite(spec.color2)) recolor(px, spec.color2, col);
    else recolor(px, col, spec.color2);
  }
  const g = makeCanvas(32, 32);
  const gx = g?.getContext('2d');
  if (!g || !gx) return false;
  gx.putImageData(px, 0, 0);
  const k = Math.max(1, Math.floor((S + 4) / 32));
  const d = 32 * k, off = Math.floor((S - d) / 2);
  ctx.imageSmoothingEnabled = false;
  const tile = spec.bg != null;
  if (tile) pixelTileBack(ctx, S, k, spec.bg!);
  else {
    // hard pixel drop shadow (1 source px down-right)
    const sh = makeCanvas(32, 32); const sx = sh?.getContext('2d');
    if (sh && sx) {
      sx.drawImage(g, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = 'rgba(10,6,24,0.45)'; sx.fillRect(0, 0, 32, 32);
      ctx.drawImage(sh, 0, 0, 32, 32, off + k, off + k, d, d);
    }
  }
  ctx.drawImage(g, 0, 0, 32, 32, off, off, d, d);
  if (tile) pixelTileFrame(ctx, S, k, spec.bg!);
  return true;
}

/** Draws a named sheet icon (e.g. 'I_Chest01') as a data URL at an integer scale — for UI chrome (quick menu). */
export function pixelIconUrl(name: PixelIconName, size = 32): string {
  const key = `named_${name}_${size}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  if (!sheet) return '';
  const c = makeCanvas(size, size); const x = c?.getContext('2d');
  if (!c || !x) return '';
  x.imageSmoothingEnabled = false;
  const k = Math.max(1, Math.floor((size + 4) / 32)), d = 32 * k, off = Math.floor((size - d) / 2);
  const [sx, sy] = cellXY(name);
  x.drawImage(sheet, sx, sy, 32, 32, off, off, d, d);
  let url = '';
  try { url = c.toDataURL('image/png'); } catch { url = ''; }
  urlCache.set(key, url);
  return url;
}
