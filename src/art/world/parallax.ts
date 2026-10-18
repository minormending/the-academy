// OWNER: A7 (world). Sky gradients + tileable parallax layers (1024×512, transparent above silhouettes).
import Phaser from 'phaser';
import type { MapTheme } from '../../core/types';
import { PALETTES, TERRAIN, THEMES, TK, type ThemePalette } from './palettes';
import {
  type Ctx, canopy, circle, css, darken, ellipse, glow, hashStr, lighten, makeTex, mix, periodicNoise, poly, rng, rr,
  star4, vGrad, wrapX, wrapXY,
} from './util';

const LW = TERRAIN.layerW, LH = TERRAIN.layerH;

export function generateParallaxTextures(scene: Phaser.Scene) {
  for (const t of THEMES) {
    const p = PALETTES[t];
    makeTex(scene, TK.sky(t), 8, 512, (ctx, w, h) => {
      ctx.fillStyle = vGrad(ctx, 0, h, [[0, p.skyTop], [0.55, p.skyMid], [1, p.skyBottom]]);
      ctx.fillRect(0, 0, w, h);
    });
    makeTex(scene, TK.far(t), LW, LH, (ctx) => paintFar(ctx, t, p));
    makeTex(scene, TK.mid(t), LW, LH, (ctx) => paintMid(ctx, t, p));
    makeTex(scene, TK.near(t), LW, LH, (ctx) => paintNear(ctx, t, p));
    makeTex(scene, TK.clouds(t), LW, 256, (ctx) => paintClouds(ctx, t, p));
  }
  makeTex(scene, 'w_stars', 512, 512, paintStars);
  makeTex(scene, 'w_sun', 256, 256, (ctx) => {
    glow(ctx, 128, 128, 128, 0xfff3c4, 0.9);
    circle(ctx, 128, 128, 34, css(0xfffbe8));
    glow(ctx, 128, 128, 44, 0xffffff, 0.8);
  });
  makeTex(scene, 'w_moon', 192, 192, (ctx) => {
    glow(ctx, 96, 96, 96, 0xc7b8ff, 0.6);
    circle(ctx, 96, 96, 30, css(0xf1ecff));
    circle(ctx, 86, 88, 6, css(0xd8cff5)); circle(ctx, 106, 104, 4, css(0xd8cff5)); circle(ctx, 100, 82, 3, css(0xd8cff5));
  });
}

// ───────────────────────────── helpers ─────────────────────────────

/** Filled silhouette whose top edge is f(x) (tileable), from y=f(x) down to the texture bottom. */
function ridge(ctx: Ctx, f: (x: number) => number, fill: string | CanvasGradient) {
  ctx.beginPath(); ctx.moveTo(0, LH);
  for (let x = 0; x <= LW; x += 4) ctx.lineTo(x, f(x));
  ctx.lineTo(LW, LH); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
/** Mist band at the bottom of a layer to fake atmospheric depth. */
function mist(ctx: Ctx, y0: number, color: number, a: number) {
  ctx.fillStyle = vGrad(ctx, y0, LH, [[0, color, 0], [1, color, a]]);
  ctx.fillRect(0, y0, LW, LH - y0);
}
function mountains(ctx: Ctx, r: () => number, base: number, amp: number, color: number, snow?: number) {
  const n = periodicNoise(r, LW, [{ k: 2, a: 0.5 }, { k: 3, a: 0.35 }, { k: 7, a: 0.18 }, { k: 13, a: 0.07 }]);
  const f = (x: number) => base - amp * (0.5 + 0.5 * Math.abs(n(x))) - amp * 0.4 * Math.max(0, n(x));
  ridge(ctx, f, vGrad(ctx, base - amp * 1.6, LH, [[0, lighten(color, 0.08)], [1, darken(color, 0.1)]]));
  if (snow !== undefined) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, LH);
    for (let x = 0; x <= LW; x += 4) ctx.lineTo(x, f(x));
    ctx.lineTo(LW, LH); ctx.closePath(); ctx.clip();
    const top = Math.min(...Array.from({ length: 64 }, (_, i) => f(i * 16)));
    ctx.beginPath(); ctx.moveTo(0, top + amp * 0.45);
    for (let x = 0; x <= LW; x += 8) ctx.lineTo(x, top + amp * 0.42 + Math.sin(x * 0.09) * 6 + Math.sin(x * 0.031) * 8);
    ctx.lineTo(LW, 0); ctx.lineTo(0, 0); ctx.closePath();
    ctx.fillStyle = css(snow, 0.9); ctx.fill();
    ctx.restore();
  }
  // light side shading
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  for (let x = 0; x < LW; x += 4) {
    const d = f(x + 4) - f(x);
    if (d > 0.6) { ctx.fillStyle = css(0xffffff, 0.06); ctx.fillRect(x, f(x), 4, LH); }
  }
  ctx.restore();
}
function treeRow(ctx: Ctx, r: () => number, baseY: number, spacing: number, size: number, color: number, kind: 'round' | 'pine' | 'dead' | 'shroom') {
  for (let x = 0; x < LW; x += spacing * rr(r, 0.7, 1.2)) {
    const s = size * rr(r, 0.75, 1.25);
    wrapX(LW, x, s * 1.2, X => {
      if (kind === 'round') {
        ctx.fillStyle = css(darken(color, 0.2)); ctx.fillRect(X - s * 0.08, baseY - s * 0.9, s * 0.16, s * 0.9);
        const rr2 = rng(Math.floor(x * 13));
        for (let i = 0; i < 5; i++) circle(ctx, X + rr(rr2, -s * 0.4, s * 0.4), baseY - s * rr(rr2, 0.9, 1.4), s * rr(rr2, 0.35, 0.5), css(color));
      } else if (kind === 'pine') {
        for (let i = 0; i < 3; i++) {
          const y = baseY - s * (0.35 + i * 0.42), ww = s * (0.55 - i * 0.12);
          poly(ctx, [[X - ww, y + s * 0.2], [X, y - s * 0.5], [X + ww, y + s * 0.2]], css(color));
        }
        ctx.fillStyle = css(color); ctx.fillRect(X - s * 0.06, baseY - s * 0.3, s * 0.12, s * 0.3);
      } else if (kind === 'dead') {
        ctx.strokeStyle = css(color); ctx.lineCap = 'round';
        ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.moveTo(X, baseY); ctx.lineTo(X + s * 0.05, baseY - s * 1.3); ctx.stroke();
        ctx.lineWidth = s * 0.05;
        for (let i = 0; i < 4; i++) {
          const y = baseY - s * (0.6 + i * 0.18), dir = i % 2 ? 1 : -1;
          ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(X + dir * s * 0.4, y - s * 0.25); ctx.stroke();
        }
      } else {
        ctx.fillStyle = css(darken(color, 0.1)); ctx.fillRect(X - s * 0.09, baseY - s * 1.1, s * 0.18, s * 1.1);
        ctx.beginPath(); ctx.ellipse(X, baseY - s * 1.1, s * 0.55, s * 0.32, 0, Math.PI, 0); ctx.closePath();
        ctx.fillStyle = css(color); ctx.fill();
      }
    });
  }
  ctx.fillStyle = css(color); ctx.fillRect(0, baseY - 2, LW, LH - baseY + 2);
}

// ───────────────────────────── far ─────────────────────────────

function paintFar(ctx: Ctx, t: MapTheme, p: ThemePalette) {
  const r = rng(hashStr(t + 'far'));
  switch (t) {
    case 'town': case 'forest':
      mountains(ctx, r, 330, 150, p.far, 0xf4f8ff);
      mist(ctx, 240, p.haze, 0.75);
      break;
    case 'mushroom': {
      // distant towering mushrooms in violet haze, glowing caps
      for (let i = 0; i < 7; i++) {
        const x = (i / 7) * LW + rr(r, -30, 30), s = rr(r, 120, 200);
        wrapX(LW, x, s, X => {
          ctx.fillStyle = css(darken(p.far, 0.05)); ctx.fillRect(X - s * 0.08, LH - s * 1.9, s * 0.16, s * 1.9);
          ctx.beginPath(); ctx.ellipse(X, LH - s * 1.9, s * 0.62, s * 0.36, 0, Math.PI, 0); ctx.closePath();
          ctx.fillStyle = css(p.far); ctx.fill();
          for (let k = 0; k < 5; k++) glow(ctx, X + rr(r, -s * 0.45, s * 0.45), LH - s * 1.9 - rr(r, 4, s * 0.25), 8, p.accent, 0.35);
        });
      }
      mountains(ctx, r, 420, 60, darken(p.far, 0.1));
      mist(ctx, 260, p.haze, 0.35);
      break;
    }
    case 'snow':
      // glaciers: sharp pale peaks with blue faces
      mountains(ctx, r, 300, 190, p.far, 0xffffff);
      ctx.save(); ctx.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 14; i++) {
        const x = rr(r, 0, LW);
        poly(ctx, [[x, 150], [x + 30, 160], [x + 12, 420]], css(0x8fb7e0, 0.35));
      }
      ctx.restore();
      mist(ctx, 220, p.haze, 0.8);
      break;
    case 'volcano': {
      // a great volcano with glowing crater and smoke plumes
      mountains(ctx, r, 420, 70, p.far);
      const cx = LW * 0.35;
      poly(ctx, [[cx - 330, LH], [cx - 70, 170], [cx - 30, 160], [cx + 30, 165], [cx + 70, 175], [cx + 350, LH]], vGrad(ctx, 160, LH, [[0, lighten(p.far, 0.1)], [1, darken(p.far, 0.2)]]));
      glow(ctx, cx, 168, 90, 0xff6a10, 0.75);
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = css(0xff7a1a, 0.7); ctx.lineWidth = rr(r, 2, 4); ctx.beginPath();
        let x = cx + rr(r, -40, 40), y = 172; ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += rr(r, -26, 26); y += rr(r, 30, 50); ctx.lineTo(x, y); }
        ctx.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const sx = cx + Math.sin(i * 0.8) * 20 + i * 18, sy = 150 - i * 18, sr = 26 + i * 7;
        circle(ctx, sx, sy, sr, css(mix(0x3a2420, 0x7a5a50, i / 9), 0.55 - i * 0.04));
      }
      mist(ctx, 300, p.haze, 0.3);
      break;
    }
    case 'storm':
      // jagged storm cliffs
      {
        const n = periodicNoise(r, LW, [{ k: 3, a: 0.5 }, { k: 8, a: 0.3 }, { k: 21, a: 0.15 }]);
        ridge(ctx, x => 260 - 120 * Math.abs(n(x)) - (Math.floor(x / 37) % 3 === 0 ? 40 : 0) * Math.max(0, n(x * 1.0)), vGrad(ctx, 100, LH, [[0, lighten(p.far, 0.1)], [1, p.far]]));
        mist(ctx, 220, p.haze, 0.45);
      }
      break;
    case 'sanctum':
      // floating ruins: inverted-cone islands with pillars
      for (let i = 0; i < 5; i++) {
        const x = (i / 5) * LW + rr(r, -40, 40), y = rr(r, 140, 300), s = rr(r, 60, 110);
        wrapX(LW, x, s * 1.4, X => floatingIsland(ctx, X, y, s, p.far, p.haze, r));
      }
      mist(ctx, 360, p.haze, 0.25);
      break;
  }
}

function floatingIsland(ctx: Ctx, x: number, y: number, s: number, color: number, glowC: number, r: () => number) {
  poly(ctx, [[x - s, y], [x + s, y], [x + s * 0.4, y + s * 0.6], [x + s * 0.1, y + s * 1.1], [x - s * 0.3, y + s * 0.7]], css(color));
  ctx.fillStyle = css(lighten(color, 0.12)); ctx.fillRect(x - s, y - 4, s * 2, 6);
  const cols = Math.round(rr(r, 2, 4));
  for (let i = 0; i < cols; i++) {
    const px = x - s * 0.7 + (i / Math.max(1, cols - 1)) * s * 1.4, ph = s * rr(r, 0.5, 1.1);
    ctx.fillStyle = css(lighten(color, 0.06)); ctx.fillRect(px - 5, y - ph, 10, ph);
    ctx.fillRect(px - 8, y - ph - 4, 16, 5);
  }
  if (r() < 0.6) { ctx.fillStyle = css(lighten(color, 0.06)); ctx.fillRect(x - s * 0.7 - 8, y - s * 1.1 - 6, s * 1.4 + 16, 6); }
  glow(ctx, x + s * 0.1, y + s * 1.1, 14, glowC, 0.4);
}

// ───────────────────────────── mid ─────────────────────────────

function paintMid(ctx: Ctx, t: MapTheme, p: ThemePalette) {
  const r = rng(hashStr(t + 'mid'));
  switch (t) {
    case 'town': {
      const n = periodicNoise(r, LW, [{ k: 2, a: 0.6 }, { k: 5, a: 0.3 }]);
      ridge(ctx, x => 330 + n(x) * 40, vGrad(ctx, 280, LH, [[0, p.mid], [1, darken(p.mid, 0.15)]]));
      // distant rooftops & a windmill on the hills
      for (let i = 0; i < 6; i++) {
        const x = rr(r, 0, LW), y = 330 + n(x) * 40 + 6;
        wrapX(LW, x, 30, X => {
          ctx.fillStyle = css(mix(p.mid, 0xe8d8c0, 0.45)); ctx.fillRect(X - 14, y - 18, 28, 18);
          poly(ctx, [[X - 18, y - 18], [X, y - 34], [X + 18, y - 18]], css(mix(p.mid, 0xb0503a, 0.45)));
        });
      }
      treeRow(ctx, r, 420, 46, 34, darken(p.mid, 0.08), 'round');
      mist(ctx, 360, p.haze, 0.35);
      break;
    }
    case 'forest': {
      const n = periodicNoise(r, LW, [{ k: 2, a: 0.6 }, { k: 4, a: 0.3 }]);
      ridge(ctx, x => 300 + n(x) * 45, vGrad(ctx, 250, LH, [[0, lighten(p.mid, 0.1)], [1, p.mid]]));
      treeRow(ctx, r, 360, 38, 50, p.mid, 'round');
      mist(ctx, 320, p.haze, 0.35);
      break;
    }
    case 'mushroom':
      for (let i = 0; i < 10; i++) {
        const x = (i / 10) * LW + rr(r, -20, 20), s = rr(r, 70, 120);
        wrapX(LW, x, s, X => {
          ctx.fillStyle = css(lighten(p.mid, 0.1)); ctx.fillRect(X - s * 0.08, LH - s * 2.3, s * 0.16, s * 2.3);
          ctx.beginPath(); ctx.ellipse(X, LH - s * 2.3, s * 0.7, s * 0.42, 0, Math.PI, 0); ctx.closePath();
          ctx.fillStyle = css(mix(p.mid, 0xb04070, 0.35)); ctx.fill();
          for (let k = 0; k < 4; k++) circle(ctx, X + rr(r, -s * 0.5, s * 0.5), LH - s * 2.3 - rr(r, 4, s * 0.3), rr(r, 3, 7), css(0xffd6ea, 0.45));
        });
      }
      ridge(ctx, x => 430 + Math.sin(x * 0.012) * 18, css(p.mid));
      mist(ctx, 300, p.haze, 0.3);
      break;
    case 'snow':
      mountains(ctx, r, 360, 90, p.mid, 0xf4faff);
      treeRow(ctx, r, 430, 30, 44, darken(p.mid, 0.12), 'pine');
      mist(ctx, 350, p.haze, 0.5);
      break;
    case 'volcano': {
      // rock spires with lava rivers at their feet
      for (let i = 0; i < 12; i++) {
        const x = rr(r, 0, LW), hgt = rr(r, 120, 260), wd = rr(r, 26, 50);
        wrapX(LW, x, wd, X => poly(ctx, [[X - wd, LH], [X - wd * 0.3, LH - hgt], [X + wd * 0.2, LH - hgt - 14], [X + wd, LH]], css(p.mid)));
      }
      ridge(ctx, x => 420 + Math.sin(x * 0.02) * 12, css(p.mid));
      ctx.fillStyle = vGrad(ctx, 440, 470, [[0, 0xff7a1a, 0], [0.5, 0xff9a30, 0.85], [1, 0xff5a10, 0]]);
      ctx.fillRect(0, 440, LW, 30);
      mist(ctx, 360, p.haze, 0.25);
      break;
    }
    case 'storm': {
      const n = periodicNoise(r, LW, [{ k: 4, a: 0.6 }, { k: 11, a: 0.25 }]);
      ridge(ctx, x => 320 - Math.abs(n(x)) * 110, vGrad(ctx, 200, LH, [[0, lighten(p.mid, 0.08)], [1, p.mid]]));
      treeRow(ctx, r, 400, 60, 50, darken(p.mid, 0.08), 'dead');
      mist(ctx, 300, p.haze, 0.3);
      break;
    }
    case 'sanctum':
      for (let i = 0; i < 4; i++) {
        const x = (i / 4) * LW + rr(r, -30, 30), y = rr(r, 220, 330), s = rr(r, 80, 130);
        wrapX(LW, x, s * 1.4, X => floatingIsland(ctx, X, y, s, p.mid, p.accent, r));
      }
      // distant colonnade
      ridge(ctx, () => 450, css(p.mid));
      for (let x = 20; x < LW; x += 64) {
        ctx.fillStyle = css(lighten(p.mid, 0.08)); ctx.fillRect(x - 7, 380, 14, 70); ctx.fillRect(x - 11, 374, 22, 7);
      }
      ctx.fillStyle = css(lighten(p.mid, 0.08)); ctx.fillRect(0, 368, LW, 8);
      mist(ctx, 380, p.haze, 0.25);
      break;
  }
}

// ───────────────────────────── near ─────────────────────────────

function paintNear(ctx: Ctx, t: MapTheme, p: ThemePalette) {
  const r = rng(hashStr(t + 'near'));
  switch (t) {
    case 'town': case 'forest': {
      const base = t === 'forest' ? 380 : 420;
      for (let x = 0; x < LW; x += rr(r, 60, 110)) {
        const s = rr(r, 40, 70);
        wrapX(LW, x, s * 1.3, X => {
          ctx.fillStyle = css(darken(p.near, 0.25)); ctx.fillRect(X - s * 0.1, base - s * 1.3, s * 0.2, s * 1.3 + 40);
          const rr2 = rng(Math.floor(x * 7 + 3));
          canopy(ctx, X, base - s * 1.5, s * 0.9, s * 0.75, p.near, rr2, { blobs: 8, outline: darken(p.near, 0.35), spec: 0.12 });
        });
      }
      ctx.fillStyle = css(darken(p.near, 0.1)); ctx.fillRect(0, base, LW, LH - base);
      for (let x = 0; x < LW; x += 18) circle(ctx, x, base + 2, 14 + Math.sin(x) * 4, css(darken(p.near, 0.1)));
      break;
    }
    case 'mushroom':
      for (let i = 0; i < 14; i++) {
        const x = rr(r, 0, LW), s = rr(r, 40, 80);
        const cap = r() < 0.5 ? 0x6a3a8a : 0x2f5f7a;
        wrapX(LW, x, s, X => {
          ctx.fillStyle = css(mix(p.near, 0xd8c8b0, 0.2)); ctx.fillRect(X - s * 0.1, 470 - s * 1.6, s * 0.2, s * 1.6 + 50);
          ctx.beginPath(); ctx.ellipse(X, 470 - s * 1.6, s * 0.65, s * 0.4, 0, Math.PI, 0); ctx.closePath();
          ctx.fillStyle = css(mix(p.near, cap, 0.6)); ctx.fill();
          glow(ctx, X, 470 - s * 1.6 - s * 0.15, s * 0.5, p.accent, 0.12);
        });
      }
      ctx.fillStyle = css(p.near); ctx.fillRect(0, 460, LW, 52);
      break;
    case 'snow':
      treeRow(ctx, r, 450, 44, 80, p.near, 'pine');
      // snow on the pine row
      for (let x = 0; x < LW; x += 6) circle(ctx, x, 452 + Math.sin(x * 0.07) * 3, 6, css(0xeaf4ff));
      break;
    case 'volcano':
      // basalt columns
      for (let x = 0; x < LW; x += rr(r, 28, 46)) {
        const hgt = rr(r, 80, 200), wd = rr(r, 20, 34);
        wrapX(LW, x, wd, X => {
          ctx.fillStyle = css(p.near); ctx.fillRect(X - wd / 2, LH - hgt, wd, hgt);
          poly(ctx, [[X - wd / 2, LH - hgt], [X, LH - hgt - 8], [X + wd / 2, LH - hgt]], css(lighten(p.near, 0.1)));
          ctx.fillStyle = css(0xff6a10, 0.25); ctx.fillRect(X + wd / 2 - 3, LH - hgt, 3, hgt);
        });
      }
      break;
    case 'storm': {
      const n = periodicNoise(r, LW, [{ k: 5, a: 0.6 }, { k: 13, a: 0.3 }]);
      ridge(ctx, x => 400 - Math.abs(n(x)) * 90, css(p.near));
      treeRow(ctx, r, 470, 90, 60, p.near, 'pine');
      break;
    }
    case 'sanctum':
      // broken colonnade in the foreground haze
      ctx.fillStyle = css(p.near); ctx.fillRect(0, 470, LW, 42);
      for (let x = 30; x < LW; x += 120) {
        const hgt = rr(r, 90, 220), broken = r() < 0.5;
        ctx.fillStyle = css(p.near); ctx.fillRect(x - 14, 470 - hgt, 28, hgt);
        if (broken) poly(ctx, [[x - 14, 470 - hgt], [x - 4, 470 - hgt - 14], [x + 6, 470 - hgt - 4], [x + 14, 470 - hgt - 10], [x + 14, 470 - hgt]], css(p.near));
        else ctx.fillRect(x - 20, 470 - hgt - 10, 40, 12);
        ctx.fillStyle = css(p.accent, 0.25); ctx.fillRect(x - 14, 470 - hgt * 0.6, 28, 3);
      }
      break;
  }
}

// ───────────────────────────── clouds / stars ─────────────────────────────

function paintClouds(ctx: Ctx, t: MapTheme, p: ThemePalette) {
  const r = rng(hashStr(t + 'clouds'));
  const n = t === 'storm' ? 9 : t === 'sanctum' || t === 'mushroom' ? 5 : 6;
  for (let i = 0; i < n; i++) {
    const x = (i / n) * LW + rr(r, -40, 40), y = rr(r, 50, 190), s = rr(r, 40, 80) * (t === 'storm' ? 1.4 : 1);
    wrapX(LW, x, s * 2.2, X => {
      if (t === 'sanctum' || t === 'mushroom') {
        ellipse(ctx, X, y, s * 2.4, s * 0.35, css(p.cloud, 0.18));
        ellipse(ctx, X + s * 0.5, y + 6, s * 1.6, s * 0.22, css(lighten(p.cloud, 0.3), 0.14));
        return;
      }
      const a = t === 'volcano' ? 0.5 : t === 'storm' ? 0.85 : 0.92;
      const shadow = t === 'storm' ? darken(p.cloud, 0.3) : mix(p.cloud, p.skyMid, 0.5);
      for (let k = 0; k < 7; k++) {
        const ox = (k - 3) * s * 0.42, oy = -Math.cos((k - 3) * 0.5) * s * 0.35;
        circle(ctx, X + ox, y + oy + 6, s * rr(r, 0.38, 0.55), css(shadow, a));
      }
      for (let k = 0; k < 7; k++) {
        const ox = (k - 3) * s * 0.42, oy = -Math.cos((k - 3) * 0.5) * s * 0.35;
        circle(ctx, X + ox, y + oy, s * rr(r, 0.34, 0.5), css(p.cloud, a));
      }
      ellipse(ctx, X, y + s * 0.18, s * 1.6, s * 0.2, css(p.cloud, a));
    });
  }
}

function paintStars(ctx: Ctx, w: number, h: number) {
  const r = rng(777);
  for (let i = 0; i < 220; i++) {
    const x = r() * w, y = r() * h, b = r();
    circle(ctx, x, y, b < 0.9 ? 0.8 : 1.4, css(b < 0.5 ? 0xffffff : b < 0.8 ? 0xd8c8ff : 0xffe8b0, rr(r, 0.4, 1)));
  }
  for (let i = 0; i < 10; i++) {
    const x = r() * w, y = r() * h;
    glow(ctx, x, y, 8, 0xd8c8ff, 0.5); star4(ctx, x, y, 5, css(0xffffff));
  }
  // nebula wisps
  for (let i = 0; i < 4; i++) {
    const x = r() * w, y = r() * h;
    ctx.save(); ctx.globalAlpha = 0.12;
    const rot = rr(r, -0.5, 0.5);
    wrapXY(w, h, x, y, 150, (X, Y) => { ellipse(ctx, X, Y, 140, 40, css(i % 2 ? 0xb07cff : 0x5fd0ff), rot); });
    ctx.restore();
  }
}
