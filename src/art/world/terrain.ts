// OWNER: A7 (world). Terrain textures: soil fill, surface lip, one-way platforms (+ caps), walls, ropes, ladders.
import Phaser from 'phaser';
import type { MapTheme } from '../../core/types';
import { PALETTES, TERRAIN, THEMES, TK, type ThemePalette } from './palettes';
import {
  type Ctx, circle, css, darken, ellipse, glow, hashStr, lighten, makeTex, mix, poly, rng, rr, ri,
  roundRect, vGrad, wrapX, wrapXY,
} from './util';

export function generateTerrainTextures(scene: Phaser.Scene) {
  for (const t of THEMES) {
    const p = PALETTES[t];
    makeTex(scene, TK.soil(t), TERRAIN.soilTile, TERRAIN.soilTile, (ctx, w, h) => paintSoil(ctx, w, h, t, p));
    makeTex(scene, TK.lip(t), 128, TERRAIN.lipH, (ctx, w, h) => paintLip(ctx, w, h, t, p));
    makeTex(scene, TK.plat(t), 64, TERRAIN.platH, (ctx, w, h) => paintPlatSlice(ctx, 0, w, h, t, p, rng(hashStr(t + 'plat')), true));
    makeTex(scene, TK.platL(t), TERRAIN.capW, TERRAIN.platH, (ctx, w, h) => paintCap(ctx, w, h, t, p, -1));
    makeTex(scene, TK.platR(t), TERRAIN.capW, TERRAIN.platH, (ctx, w, h) => paintCap(ctx, w, h, t, p, 1));
    makeTex(scene, TK.wall(t), TERRAIN.wallTile, TERRAIN.wallTile, (ctx, w, h) => paintWall(ctx, w, h, t, p));
  }
  makeTex(scene, 'w_rope', 16, 32, paintRope);
  makeTex(scene, 'w_rope_knot', 28, 22, paintRopeKnot);
  makeTex(scene, 'w_ladder', 32, 32, (ctx, w, h) => paintLadder(ctx, w, h, 0x9b6a3c));
  makeTex(scene, 'w_ladder_gold', 32, 32, (ctx, w, h) => paintLadder(ctx, w, h, 0xc9a24a));
  makeTex(scene, 'w_ladder_top', 40, 16, paintLadderTop);
}

// ───────────────────────────── soil ─────────────────────────────

function paintSoil(ctx: Ctx, w: number, h: number, t: MapTheme, p: ThemePalette) {
  const r = rng(hashStr(t + 'soil'));
  ctx.fillStyle = css(p.soil); ctx.fillRect(0, 0, w, h);

  if (t === 'sanctum') { paintMarbleBlocks(ctx, w, h, p, r); return; }

  // strata bands (periodic in y over h)
  for (let i = 0; i < 4; i++) {
    const y0 = (i / 4) * h + rr(r, 0, 12);
    ctx.fillStyle = css(i % 2 ? p.soilDark : p.soilLight, 0.16);
    ctx.beginPath(); ctx.moveTo(0, y0);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 + Math.sin((x / w) * Math.PI * 2 * (i + 1)) * 4);
    ctx.lineTo(w, y0 + 12); ctx.lineTo(0, y0 + 12); ctx.closePath(); ctx.fill();
  }
  // specks
  for (let i = 0; i < 160; i++) {
    const x = r() * w, y = r() * h;
    ctx.fillStyle = css(r() < 0.5 ? p.soilDark : p.soilLight, rr(r, 0.25, 0.6));
    ctx.fillRect(x, y, ri(r, 1, 2), ri(r, 1, 2));
  }
  if (t === 'volcano') {
    // hex-ish cracks with glowing lava
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      let x = r() * w, y = r() * h;
      const pts: [number, number][] = [[x, y]];
      for (let k = 0; k < 5; k++) { x += rr(r, -22, 22); y += rr(r, 6, 22); pts.push([x, y]); }
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        ctx.beginPath(); ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
        for (const q of pts) ctx.lineTo(q[0] + ox, q[1] + oy);
        ctx.strokeStyle = css(0xff5a10, 0.35); ctx.lineWidth = 6; ctx.stroke();
        ctx.strokeStyle = css(0xffa030, 0.95); ctx.lineWidth = 2.2; ctx.stroke();
        ctx.strokeStyle = css(0xfff0a0, 0.8); ctx.lineWidth = 0.8; ctx.stroke();
      }
    }
  }
  if (t === 'mushroom') {
    // mycelium threads + glowing spores
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const x = r() * w, y = r() * h;
      wrapXY(w, h, x, y, 30, (X, Y) => {
        ctx.strokeStyle = css(0xd9c8ff, 0.18); ctx.beginPath(); ctx.moveTo(X, Y);
        ctx.bezierCurveTo(X + 10, Y + 8, X + 18, Y - 6, X + 28, Y + 4); ctx.stroke();
      });
    }
    for (let i = 0; i < 14; i++) {
      const x = r() * w, y = r() * h;
      wrapXY(w, h, x, y, 6, (X, Y) => { glow(ctx, X, Y, 5, p.accent, 0.6); circle(ctx, X, Y, 1.2, css(0xe6fffb)); });
    }
  }
  if (t === 'snow') {
    // icy cracks + frost glints
    for (let i = 0; i < 8; i++) {
      const x = r() * w, y = r() * h, len = rr(r, 10, 26), a = rr(r, -1, 1);
      wrapXY(w, h, x, y, 30, (X, Y) => {
        ctx.strokeStyle = css(p.soilDark, 0.8); ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(a) * len, Y + Math.sin(a) * len); ctx.lineTo(X + Math.cos(a) * len + 6, Y + Math.sin(a) * len + 8); ctx.stroke();
      });
    }
    for (let i = 0; i < 10; i++) { const x = r() * w, y = r() * h; circle(ctx, x, y, 1.2, css(0xe8f7ff, 0.8)); }
  }
  if (t === 'storm') {
    // layered slate plates
    for (let i = 0; i < 12; i++) {
      const x = r() * w, y = r() * h, pw = rr(r, 26, 54), ph = rr(r, 7, 12);
      wrapXY(w, h, x, y, 60, (X, Y) => {
        poly(ctx, [[X, Y], [X + pw, Y - 3], [X + pw + 4, Y + ph], [X + 3, Y + ph + 2]], css(r() < 0.5 ? p.soilLight : p.soilDark, 0.5), css(p.soilDark, 0.6), 1);
      });
    }
    for (let i = 0; i < 20; i++) { const x = r() * w, y = r() * h; circle(ctx, x, y, rr(r, 1, 2.2), css(0x6f9a5f, 0.55)); }
  }
  // pebbles
  const nPeb = t === 'volcano' ? 8 : 14;
  for (let i = 0; i < nPeb; i++) {
    const x = r() * w, y = r() * h, rx = rr(r, 3, 8), ry = rx * rr(r, 0.55, 0.85);
    const c = mix(p.pebble, p.soil, rr(r, 0, 0.4));
    wrapXY(w, h, x, y, 10, (X, Y) => {
      ellipse(ctx, X, Y + 1.5, rx + 1.2, ry + 1.2, css(p.soilDark, 0.8));
      ellipse(ctx, X, Y, rx, ry, css(c));
      ellipse(ctx, X - rx * 0.3, Y - ry * 0.35, rx * 0.45, ry * 0.35, css(lighten(c, 0.35), 0.8));
    });
  }
  if (t === 'forest' || t === 'town') {
    // little roots
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = r() * w, y = r() * h;
      wrapXY(w, h, x, y, 24, (X, Y) => {
        ctx.strokeStyle = css(darken(p.soilDark, 0.15), 0.55); ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(X, Y); ctx.quadraticCurveTo(X + 8, Y + 10, X + 4, Y + 20); ctx.stroke();
      });
    }
  }
}

function paintMarbleBlocks(ctx: Ctx, w: number, h: number, p: ThemePalette, r: () => number) {
  const bw = 64, bh = 32;
  for (let row = 0; row < h / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < w / bw + 1; col++) {
      const x = col * bw + off, y = row * bh;
      const c = mix(p.soil, p.soilLight, rr(r, 0, 0.5));
      ctx.fillStyle = vGrad(ctx, y, y + bh, [[0, lighten(c, 0.15)], [1, darken(c, 0.06)]]);
      ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      // veins
      ctx.strokeStyle = css(p.soilDark, 0.35); ctx.lineWidth = 1; ctx.beginPath();
      let vx = x + rr(r, 4, bw - 4), vy = y + 2; ctx.moveTo(vx, vy);
      for (let k = 0; k < 4; k++) { vx += rr(r, -10, 10); vy += bh / 4.5; ctx.lineTo(vx, vy); }
      ctx.stroke();
      ctx.fillStyle = css(0xffffff, 0.5); ctx.fillRect(x + 2, y + 2, bw - 4, 1.5);
    }
  }
  // mortar lines + a few gold inlays
  ctx.fillStyle = css(p.soilDark, 0.9);
  for (let row = 0; row <= h / bh; row++) ctx.fillRect(0, row * bh - 1, w, 2);
  for (let row = 0; row < h / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = 0; col <= w / bw; col++) ctx.fillRect(col * bw + off - 1, row * bh, 2, bh);
  }
  for (let i = 0; i < 3; i++) {
    const x = ri(r, 0, 1) * bw + bw / 2 + (i % 2) * bw / 2, y = i * bh + bh / 2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = css(darken(p.accent, 0.35)); ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = css(p.accent); ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
  }
}

// ───────────────────────────── surface lip ─────────────────────────────

function paintLip(ctx: Ctx, w: number, h: number, t: MapTheme, p: ThemePalette) {
  const s = TERRAIN.lipSurface;
  const r = rng(hashStr(t + 'lip'));
  // shadow fading under the band
  ctx.fillStyle = vGrad(ctx, s + 8, h, [[0, p.soilDark, 0.75], [1, p.soilDark, 0]]);
  ctx.fillRect(0, s + 8, w, h - s - 8);

  if (t === 'sanctum') {
    // polished marble ledge with gold trim
    ctx.fillStyle = vGrad(ctx, s - 2, s + 18, [[0, p.lipLight], [0.5, p.lip], [1, p.lipDark]]);
    ctx.fillRect(0, s - 2, w, 20);
    ctx.fillStyle = css(darken(p.accent, 0.3)); ctx.fillRect(0, s + 18, w, 6);
    ctx.fillStyle = css(p.accent); ctx.fillRect(0, s + 19, w, 3);
    ctx.fillStyle = css(lighten(p.accent, 0.5)); ctx.fillRect(0, s + 19, w, 1);
    for (let x = 16; x < w; x += 32) {
      ctx.fillStyle = css(darken(p.accent, 0.3)); ctx.beginPath(); ctx.arc(x, s + 24, 5, 0, Math.PI); ctx.fill();
      ctx.fillStyle = css(p.accent); ctx.beginPath(); ctx.arc(x, s + 24, 3, 0, Math.PI); ctx.fill();
    }
    ctx.fillStyle = css(0xffffff, 0.8); ctx.fillRect(0, s - 2, w, 2);
    ctx.fillStyle = css(p.lipDark, 0.6); for (let x = 0; x < w; x += 64) ctx.fillRect(x, s, 1.5, 16);
    return;
  }

  const band = t === 'volcano' ? 12 : t === 'snow' ? 18 : 14;
  // scalloped drips under the band
  ctx.fillStyle = css(p.lipDark);
  ctx.beginPath(); ctx.moveTo(0, s);
  const nd = 8;
  for (let i = 0; i <= nd; i++) {
    const x = (i / nd) * w;
    const depth = band + (i % 2 ? 9 : 4) + (t === 'snow' ? 3 : 0);
    ctx.quadraticCurveTo(x - w / nd / 2, s + depth + 4, x, s + band);
  }
  ctx.lineTo(w, s); ctx.closePath(); ctx.fill();
  // band body
  ctx.fillStyle = vGrad(ctx, s - 2, s + band, [[0, p.lipLight], [0.35, p.lip], [1, p.lipDark]]);
  ctx.fillRect(0, s - 1, w, band);
  ctx.fillStyle = css(p.lip);
  for (let i = 0; i < nd; i++) {
    const x = (i + 0.5) * (w / nd);
    ellipse(ctx, x, s + band - 1, w / nd / 2 - 1, i % 2 ? 6 : 3.5, css(p.lip));
  }

  if (t === 'snow') {
    // rounded snow mounds on top + icicles below
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * w + rr(r, -3, 3), rad = rr(r, 7, 12);
      wrapX(w, x, rad, X => { ellipse(ctx, X, s + 1, rad, rad * 0.5, css(p.lipLight)); });
    }
    for (let i = 0; i < 7; i++) {
      const x = rr(r, 4, w - 4), len = rr(r, 8, 18), y0 = s + band + 2;
      poly(ctx, [[x - 3, y0], [x + 3, y0], [x, y0 + len]], css(0xdff4ff, 0.95), css(0x9cc5e6), 1);
      ctx.fillStyle = css(0xffffff, 0.9); ctx.fillRect(x - 1, y0 + 1, 1, len * 0.5);
    }
    ctx.fillStyle = css(0xffffff); ctx.fillRect(0, s - 1, w, 2);
    for (let i = 0; i < 10; i++) circle(ctx, rr(r, 0, w), rr(r, s, s + band - 4), 1, css(0xb9e8ff));
    return;
  }
  if (t === 'volcano') {
    // jagged basalt teeth on top, ember glow in the seams
    for (let i = 0; i < 12; i++) {
      const x = (i / 12) * w + rr(r, -2, 2), hh = rr(r, 3, 8), ww = rr(r, 5, 9);
      wrapX(w, x, ww, X => poly(ctx, [[X - ww, s + 1], [X - ww * 0.2, s - hh], [X + ww * 0.6, s - hh * 0.6], [X + ww, s + 1]], css(p.lipLight), css(p.lipDark), 1));
    }
    for (let i = 0; i < 5; i++) {
      const x = rr(r, 6, w - 6);
      ctx.strokeStyle = css(0xff8a20, 0.95); ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(x, s + 2); ctx.lineTo(x + rr(r, -4, 4), s + band * 0.6); ctx.lineTo(x + rr(r, -4, 4), s + band + 4); ctx.stroke();
      glow(ctx, x, s + band, 7, 0xff6a10, 0.5);
    }
    ctx.fillStyle = css(0xff9a40, 0.6); ctx.fillRect(0, s - 1, w, 1);
    return;
  }

  // grass blades (forest, town, storm, mushroom)
  const blade = t === 'storm' ? mix(p.lipLight, 0x99a080, 0.3) : p.lipLight;
  const tall = t === 'mushroom' ? 9 : t === 'storm' ? 10 : 13;
  for (let i = 0; i < 70; i++) {
    const x = r() * w, hh = rr(r, 4, tall), lean = rr(r, -4, 4);
    const c = r() < 0.5 ? p.lip : r() < 0.5 ? blade : p.lipDark;
    wrapX(w, x, 6, X => poly(ctx, [[X - 2.5, s + 2], [X + lean, s - hh], [X + 2.5, s + 2]], css(c)));
  }
  ctx.fillStyle = css(p.lipLight, 0.7); ctx.fillRect(0, s, w, 2);

  if (t === 'town' || t === 'forest') {
    // tiny flowers in the grass
    const cols = t === 'town' ? [0xffffff, 0xff8fb5, 0xffe066, 0xa7c7ff] : [0xffffff, 0xffe066, 0xff9bd0];
    for (let i = 0; i < 6; i++) {
      const x = rr(r, 6, w - 6), y = s - rr(r, 1, 5), c = cols[i % cols.length];
      for (let k = 0; k < 5; k++) circle(ctx, x + Math.cos(k * 1.26) * 2, y + Math.sin(k * 1.26) * 2, 1.6, css(c));
      circle(ctx, x, y, 1.2, css(0xffb020));
    }
  }
  if (t === 'mushroom') {
    // little glowing mushrooms poking through moss
    for (let i = 0; i < 5; i++) {
      const x = rr(r, 8, w - 8), hh = rr(r, 5, 9);
      ctx.fillStyle = css(0xe9dcc8); ctx.fillRect(x - 1, s - hh, 2, hh + 2);
      const cap = r() < 0.5 ? 0x7dfff0 : 0xff9ad8;
      glow(ctx, x, s - hh, 7, cap, 0.45);
      ctx.fillStyle = css(cap); ctx.beginPath(); ctx.ellipse(x, s - hh, 4, 2.8, 0, Math.PI, 0); ctx.fill();
    }
    for (let i = 0; i < 8; i++) circle(ctx, rr(r, 0, w), rr(r, s + 2, s + band), 1, css(0xcafff2, 0.8));
  }
  if (t === 'storm') {
    // wet rocks peeking through moss
    for (let i = 0; i < 4; i++) {
      const x = rr(r, 10, w - 10);
      ellipse(ctx, x, s + band - 2, rr(r, 5, 9), 4, css(p.soilLight));
      ellipse(ctx, x - 2, s + band - 4, 3, 1.5, css(0xb8c0d0, 0.7));
    }
  }
}

// ───────────────────────────── one-way platforms ─────────────────────────────

/** Paints the platform cross-section over [x0, x0+w). If wrap, features tile seamlessly. */
function paintPlatSlice(ctx: Ctx, x0: number, w: number, h: number, t: MapTheme, p: ThemePalette, r: () => number, wrap: boolean) {
  const s = TERRAIN.platSurface;
  const W = (x: number, m: number, fn: (x: number) => void) => (wrap ? wrapX(w, x - x0, m, X => fn(X + x0)) : fn(x));
  const bodyTop = s + 4, bodyBot = h - 7;

  if (t === 'mushroom') {
    // giant mushroom cap: domed top with spots, gills underneath
    ctx.fillStyle = css(0xf0dcc0); ctx.fillRect(x0, bodyBot - 4, w, 6);
    ctx.fillStyle = css(0xc9b08f);
    for (let x = x0; x < x0 + w; x += 4) ctx.fillRect(x, bodyBot - 2, 1.5, 6);
    ctx.fillStyle = vGrad(ctx, s - 2, bodyBot, [[0, p.bodyLight], [0.4, p.body], [1, p.bodyDark]]);
    ctx.fillRect(x0, s - 2, w, bodyBot - s + 2);
    ctx.fillStyle = css(darken(p.bodyDark, 0.2)); ctx.fillRect(x0, bodyBot - 1, w, 2);
    for (let i = 0; i < Math.max(1, Math.round(w / 22)); i++) {
      const x = x0 + rr(r, 4, w - 4), y = rr(r, s + 2, bodyBot - 5), rad = rr(r, 2.5, 4.5);
      W(x, rad + 1, X => { ellipse(ctx, X, y, rad, rad * 0.75, css(0xfff4ea)); ellipse(ctx, X - 0.8, y - 0.8, rad * 0.4, rad * 0.3, css(0xffffff)); });
    }
    ctx.fillStyle = css(lighten(p.bodyLight, 0.3), 0.8); ctx.fillRect(x0, s - 2, w, 2);
    // moss fringe on top
    for (let i = 0; i < w / 3; i++) {
      const x = x0 + r() * w, hh = rr(r, 1, 4);
      W(x, 3, X => poly(ctx, [[X - 1.5, s], [X, s - hh], [X + 1.5, s]], css(r() < 0.5 ? p.lip : p.lipLight)));
    }
    return;
  }
  if (t === 'town') {
    // wooden boardwalk planks with a grass trim + hanging rope
    ctx.fillStyle = vGrad(ctx, bodyTop - 2, bodyBot, [[0, p.bodyLight], [1, p.bodyDark]]);
    ctx.fillRect(x0, bodyTop - 2, w, bodyBot - bodyTop + 2);
    ctx.fillStyle = css(darken(p.bodyDark, 0.25));
    ctx.fillRect(x0, bodyTop + 6, w, 1.5);
    for (let x = x0 + 8; x < x0 + w; x += 16) { ctx.fillRect(x, bodyTop - 2, 1.5, bodyBot - bodyTop + 2); }
    for (let x = x0 + 4; x < x0 + w; x += 16) { circle(ctx, x, bodyTop + 2, 0.9, css(0x3a2a1a)); circle(ctx, x, bodyTop + 10, 0.9, css(0x3a2a1a)); }
    ctx.fillStyle = css(darken(p.bodyDark, 0.35)); ctx.fillRect(x0, bodyBot, w, 3);
    // rope swag
    ctx.strokeStyle = css(0xd8b37a); ctx.lineWidth = 1.5;
    for (let x = x0; x < x0 + w; x += 32) { ctx.beginPath(); ctx.moveTo(x, bodyBot + 1); ctx.quadraticCurveTo(x + 16, bodyBot + 7, x + 32, bodyBot + 1); ctx.stroke(); }
    paintGrassTop(ctx, x0, w, s, p, r, W, 9);
    return;
  }

  // earthy / rocky slab body
  const body = t === 'sanctum' ? p.body : p.body;
  ctx.fillStyle = vGrad(ctx, bodyTop - 4, bodyBot + 2, [[0, lighten(body, 0.08)], [1, p.bodyDark]]);
  ctx.beginPath(); ctx.moveTo(x0, bodyTop - 4);
  ctx.lineTo(x0 + w, bodyTop - 4); ctx.lineTo(x0 + w, bodyBot);
  for (let i = 0; i <= 8; i++) { const x = x0 + w - (i / 8) * w; ctx.lineTo(x, bodyBot + (i % 2 ? 3 : 0)); }
  ctx.closePath(); ctx.fill();

  if (t === 'sanctum') {
    ctx.fillStyle = css(p.bodyLight); ctx.fillRect(x0, s - 2, w, 6);
    ctx.fillStyle = css(darken(p.accent, 0.3)); ctx.fillRect(x0, s + 4, w, 4);
    ctx.fillStyle = css(p.accent); ctx.fillRect(x0, s + 5, w, 2);
    ctx.fillStyle = css(0xffffff, 0.9); ctx.fillRect(x0, s - 2, w, 1.5);
    ctx.fillStyle = css(p.bodyDark, 0.7); for (let x = x0; x < x0 + w; x += 32) ctx.fillRect(x, s + 8, 1.5, bodyBot - s - 8);
    for (let x = x0 + 16; x < x0 + w; x += 32) { glow(ctx, x, s + 14, 6, 0xb07cff, 0.7); circle(ctx, x, s + 14, 1.6, css(0xf0e0ff)); }
    return;
  }
  // stones in the body
  for (let i = 0; i < Math.max(1, Math.round(w / 16)); i++) {
    const x = x0 + rr(r, 3, w - 3), y = rr(r, bodyTop + 2, bodyBot - 3), rad = rr(r, 2, 4);
    W(x, rad + 1, X => { ellipse(ctx, X, y, rad, rad * 0.7, css(mix(p.pebble, p.body, 0.4))); ellipse(ctx, X - 0.6, y - 0.7, rad * 0.4, rad * 0.3, css(lighten(p.pebble, 0.3), 0.7)); });
  }
  if (t === 'volcano') {
    for (let i = 0; i < Math.max(1, Math.round(w / 24)); i++) {
      const x = x0 + rr(r, 3, w - 3);
      W(x, 6, X => {
        ctx.strokeStyle = css(0xff8a20, 0.95); ctx.lineWidth = 1.4; ctx.beginPath();
        ctx.moveTo(X, bodyTop); ctx.lineTo(X + 2, bodyTop + 6); ctx.lineTo(X - 1, bodyBot + 1); ctx.stroke();
        glow(ctx, X, bodyBot, 6, 0xff5a10, 0.6);
      });
    }
    // basalt top
    ctx.fillStyle = vGrad(ctx, s - 2, s + 6, [[0, p.lipLight], [1, p.lip]]); ctx.fillRect(x0, s - 2, w, 8);
    for (let i = 0; i < w / 8; i++) {
      const x = x0 + r() * w, hh = rr(r, 1, 4);
      W(x, 4, X => poly(ctx, [[X - 3, s], [X, s - hh], [X + 3, s]], css(p.lipLight)));
    }
    ctx.fillStyle = css(0xff9a40, 0.55); ctx.fillRect(x0, s - 2, w, 1);
    return;
  }
  if (t === 'snow') {
    // snow cap, icicles beneath
    ctx.fillStyle = css(p.lipDark); ctx.fillRect(x0, s - 1, w, 10);
    ctx.fillStyle = vGrad(ctx, s - 3, s + 8, [[0, 0xffffff], [1, p.lip]]); ctx.fillRect(x0, s - 2, w, 9);
    for (let i = 0; i < w / 10; i++) {
      const x = x0 + r() * w, rad = rr(r, 4, 7);
      W(x, rad, X => ellipse(ctx, X, s + 7, rad, 3, css(p.lip)));
    }
    for (let i = 0; i < Math.max(1, Math.round(w / 12)); i++) {
      const x = x0 + rr(r, 3, w - 3), len = rr(r, 3, 7);
      W(x, 3, X => poly(ctx, [[X - 2, bodyBot], [X + 2, bodyBot], [X, bodyBot + len]], css(0xdff4ff, 0.95)));
    }
    ctx.fillStyle = css(0xffffff); ctx.fillRect(x0, s - 2, w, 1.5);
    return;
  }
  // forest / storm: grass/moss top with dangling roots
  ctx.strokeStyle = css(darken(p.bodyDark, 0.2)); ctx.lineWidth = 1.2;
  for (let i = 0; i < Math.max(1, Math.round(w / 20)); i++) {
    const x = x0 + rr(r, 3, w - 3), len = rr(r, 2, 6);
    W(x, 3, X => { ctx.beginPath(); ctx.moveTo(X, bodyBot); ctx.quadraticCurveTo(X + 2, bodyBot + len * 0.6, X - 1, bodyBot + len); ctx.stroke(); });
  }
  paintGrassTop(ctx, x0, w, s, p, r, W, t === 'storm' ? 6 : 8);
}

function paintGrassTop(ctx: Ctx, x0: number, w: number, s: number, p: ThemePalette, r: () => number,
  W: (x: number, m: number, fn: (x: number) => void) => void, tall: number) {
  ctx.fillStyle = css(p.lipDark); ctx.fillRect(x0, s - 1, w, 7);
  for (let i = 0; i < w / 8; i++) {
    const x = x0 + (i + 0.5) * 8;
    ellipse(ctx, x, s + 6, 4.5, 2.5 + (i % 2) * 1.5, css(p.lipDark));
  }
  ctx.fillStyle = vGrad(ctx, s - 2, s + 6, [[0, p.lipLight], [1, p.lip]]); ctx.fillRect(x0, s - 2, w, 6);
  for (let i = 0; i < w / 2.5; i++) {
    const x = x0 + r() * w, hh = rr(r, 2, tall), lean = rr(r, -2.5, 2.5);
    const c = r() < 0.5 ? p.lip : p.lipLight;
    W(x, 4, X => poly(ctx, [[X - 1.8, s + 1], [X + lean, s - hh], [X + 1.8, s + 1]], css(c)));
  }
}

function paintCap(ctx: Ctx, w: number, h: number, t: MapTheme, p: ThemePalette, side: -1 | 1) {
  // Paint a full slice, then mask it with an organic rounded end.
  const r = rng(hashStr(t + 'cap' + side));
  ctx.save();
  ctx.beginPath();
  const s = TERRAIN.platSurface;
  if (side === 1) {
    ctx.moveTo(0, -4); ctx.lineTo(w - 10, -4);
    ctx.quadraticCurveTo(w, s, w - 2, s + 8);
    ctx.quadraticCurveTo(w - 6, h - 4, w - 16, h);
    ctx.lineTo(0, h); ctx.closePath();
  } else {
    ctx.moveTo(w, -4); ctx.lineTo(10, -4);
    ctx.quadraticCurveTo(0, s, 2, s + 8);
    ctx.quadraticCurveTo(6, h - 4, 16, h);
    ctx.lineTo(w, h); ctx.closePath();
  }
  ctx.clip();
  paintPlatSlice(ctx, 0, w, h, t, p, r, false);
  ctx.restore();
  // rim shading on the outer edge
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const g = side === 1 ? ctx.createLinearGradient(w - 12, 0, w, 0) : ctx.createLinearGradient(12, 0, 0, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, s + 4, w, h);
  ctx.restore();
}

// ───────────────────────────── walls ─────────────────────────────

function paintWall(ctx: Ctx, w: number, h: number, t: MapTheme, p: ThemePalette) {
  const r = rng(hashStr(t + 'wall'));
  ctx.fillStyle = css(p.wallDark); ctx.fillRect(0, 0, w, h);
  if (t === 'sanctum' || t === 'town') {
    // dressed stone bricks
    const bw = 32, bh = 16;
    for (let row = 0; row < h / bh; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col <= w / bw; col++) {
        const x = col * bw + off, y = row * bh;
        const c = mix(p.wall, p.wallLight, rr(r, 0, 0.35));
        roundRect(ctx, x + 1, y + 1, bw - 2, bh - 2, 2);
        ctx.fillStyle = vGrad(ctx, y, y + bh, [[0, lighten(c, 0.1)], [1, darken(c, 0.12)]]); ctx.fill();
        ctx.fillStyle = css(0xffffff, 0.25); ctx.fillRect(x + 2, y + 2, bw - 4, 1);
      }
    }
    if (t === 'sanctum') { ctx.fillStyle = css(p.accent, 0.8); ctx.fillRect(0, h / 2 - 1, w, 2); }
    return;
  }
  // irregular boulders / rock face
  const cells: { x: number; y: number; rx: number; ry: number; c: number }[] = [];
  for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
    cells.push({ x: gx * 16 + 8 + rr(r, -3, 3), y: gy * 16 + 8 + rr(r, -3, 3), rx: rr(r, 9, 12), ry: rr(r, 7, 10), c: mix(p.wall, p.wallLight, rr(r, 0, 0.4)) });
  }
  for (const c of cells) wrapXY(w, h, c.x, c.y, 14, (X, Y) => ellipse(ctx, X, Y + 1, c.rx + 1.5, c.ry + 1.5, css(darken(p.wallDark, 0.2))));
  for (const c of cells) wrapXY(w, h, c.x, c.y, 14, (X, Y) => {
    ellipse(ctx, X, Y, c.rx, c.ry, css(c.c));
    ellipse(ctx, X - c.rx * 0.25, Y - c.ry * 0.3, c.rx * 0.55, c.ry * 0.4, css(lighten(c.c, 0.15), 0.8));
  });
  if (t === 'volcano') {
    for (let i = 0; i < 3; i++) {
      const x = rr(r, 0, w), y = rr(r, 0, h);
      wrapXY(w, h, x, y, 20, (X, Y) => {
        ctx.strokeStyle = css(0xff8020, 0.9); ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(X, Y); ctx.lineTo(X + 6, Y + 8); ctx.lineTo(X + 2, Y + 16); ctx.stroke();
      });
    }
  }
  if (t === 'forest' || t === 'storm' || t === 'mushroom') {
    for (let i = 0; i < 10; i++) {
      const x = rr(r, 0, w), y = rr(r, 0, h);
      wrapXY(w, h, x, y, 4, (X, Y) => circle(ctx, X, Y, rr(r, 1.5, 3), css(t === 'mushroom' ? 0x55c9a0 : 0x5f9a4f, 0.7)));
    }
  }
  if (t === 'snow') {
    for (let i = 0; i < 6; i++) { const x = rr(r, 0, w), y = rr(r, 0, h); circle(ctx, x, y, 1.2, css(0xeaf7ff, 0.9)); }
  }
}

// ───────────────────────────── ropes & ladders ─────────────────────────────

function paintRope(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  ctx.fillStyle = css(0x6b4a2a); ctx.fillRect(cx - 4, 0, 8, h);
  ctx.fillStyle = css(0xc59a5e); ctx.fillRect(cx - 3, 0, 6, h);
  for (let y = -8; y < h + 8; y += 8) {
    ctx.fillStyle = css(0x8a6338);
    ctx.beginPath(); ctx.moveTo(cx - 3, y); ctx.lineTo(cx + 3, y + 5); ctx.lineTo(cx + 3, y + 8); ctx.lineTo(cx - 3, y + 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = css(0xe3c08a, 0.8); ctx.fillRect(cx - 2, y + 1, 1, 2);
  }
}
function paintRopeKnot(ctx: Ctx, w: number, h: number) {
  ellipse(ctx, w / 2, h / 2 + 2, 11, 7, css(0x5a3c20));
  ellipse(ctx, w / 2, h / 2, 10, 6.5, css(0xb88a50));
  ctx.strokeStyle = css(0x7a5530); ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * 5 - 3, h / 2 - 5); ctx.lineTo(w / 2 + i * 5 + 3, h / 2 + 5); ctx.stroke(); }
  ellipse(ctx, w / 2 - 3, h / 2 - 3, 4, 1.5, css(0xf0d29a, 0.8));
}
function paintLadder(ctx: Ctx, w: number, h: number, wood: number) {
  const dark = darken(wood, 0.45), light = lighten(wood, 0.25);
  // rung
  ctx.fillStyle = css(dark); ctx.fillRect(5, 11, w - 10, 7);
  ctx.fillStyle = css(wood); ctx.fillRect(5, 11, w - 10, 5);
  ctx.fillStyle = css(light); ctx.fillRect(5, 11, w - 10, 1.5);
  // rails
  for (const x of [3, w - 9]) {
    ctx.fillStyle = css(dark); ctx.fillRect(x, 0, 6, h);
    ctx.fillStyle = css(wood); ctx.fillRect(x + 0.5, 0, 4.5, h);
    ctx.fillStyle = css(light); ctx.fillRect(x + 1, 0, 1.2, h);
  }
  circle(ctx, 6, 14, 1.2, css(0x2a2a2a)); circle(ctx, w - 6, 14, 1.2, css(0x2a2a2a));
}
function paintLadderTop(ctx: Ctx, w: number, h: number) {
  roundRect(ctx, 2, 4, w - 4, h - 6, 3); ctx.fillStyle = css(0x5a3c20); ctx.fill();
  roundRect(ctx, 3, 4, w - 6, h - 8, 3); ctx.fillStyle = css(0x9b6a3c); ctx.fill();
  ctx.fillStyle = css(0xc89660); ctx.fillRect(5, 5, w - 10, 1.5);
}
