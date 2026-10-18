// OWNER: A10 (art-audio). Pure-canvas icon painter for every IconGlyph.
//
// Each glyph is painted in a 32×32 design space, then a uniform dark outline is produced by dilating
// the glyph's silhouette, giving a crisp "sticker" look at any size. Skill icons (spec.bg set) sit on a
// rounded beveled tile; item icons have no tile but get a soft drop shadow.
import Phaser from 'phaser';
import type { IconGlyph, IconSpec } from '../core/types';
import { css, makeCanvas, mix, shade } from './char/color';

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
  const key = `icon_${specKey(spec, Math.max(8, Math.round(size)))}`;
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
