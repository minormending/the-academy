// OWNER: A7 (world). Decor textures (origin bottom-center unless noted "hanging" = origin top-center).
import Phaser from 'phaser';
import {
  type Ctx, canopy, circle, css, darken, ellipse, glow, lighten, makeTex, mix, poly, rng, rr, roundRect, star4, vGrad, hGrad,
} from './util';

export interface DecorTexInfo { w: number; h: number; hanging?: boolean; }
/** Registry of decor texture sizes (the loader uses this for spacing/origins). */
export const DECOR_INFO: Record<string, DecorTexInfo> = {};

function dt(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void, hanging = false) {
  DECOR_INFO[key] = { w, h, hanging };
  makeTex(scene, key, w, h, draw);
}

export function generateDecorTextures(scene: Phaser.Scene) {
  // forest / town
  dt(scene, 'd_oak', 240, 310, (c, w, h) => paintTree(c, w, h, 0x4fae3e, 0x6b4527, 11));
  dt(scene, 'd_oak_dark', 240, 310, (c, w, h) => paintTree(c, w, h, 0x3a8a3c, 0x5a3a22, 12));
  dt(scene, 'd_tree_round', 180, 240, (c, w, h) => paintTree(c, w, h, 0x7ccf4a, 0xe8e0d0, 13, true));
  dt(scene, 'd_tree_blossom', 200, 260, (c, w, h) => paintTree(c, w, h, 0xffb3cf, 0x7a5032, 14));
  dt(scene, 'd_bush', 110, 62, (c, w, h) => paintBush(c, w, h, 0x56b33f, 0));
  dt(scene, 'd_bush_berry', 110, 62, (c, w, h) => paintBush(c, w, h, 0x4aa53c, 0xe8364f));
  dt(scene, 'd_bush_flower', 110, 62, (c, w, h) => paintBush(c, w, h, 0x5fbf48, 0xfff3a0));
  dt(scene, 'd_flowers', 72, 32, paintFlowers);
  dt(scene, 'd_tuft', 46, 24, (c, w, h) => paintTuft(c, w, h, 0x5bb83c, 0x9be060));
  dt(scene, 'd_tuft_moss', 46, 24, (c, w, h) => paintTuft(c, w, h, 0x3fa889, 0x7ee0b6));
  dt(scene, 'd_tuft_storm', 46, 24, (c, w, h) => paintTuft(c, w, h, 0x5f8a5a, 0x9ab486));
  dt(scene, 'd_rock', 72, 44, (c, w, h) => paintRock(c, w, h, 0x9a9590));
  dt(scene, 'd_rock_big', 120, 70, (c, w, h) => paintRock(c, w, h, 0x8f8a86));
  dt(scene, 'd_stump', 72, 52, paintStump);
  dt(scene, 'd_log', 130, 44, paintLog);
  dt(scene, 'd_fence', 128, 54, paintFence);
  dt(scene, 'd_signpost', 84, 96, paintSignpost);
  dt(scene, 'd_lamp', 44, 156, (c, w, h) => paintLamp(c, w, h, 0x2d2d3a, 0xffd27a));
  dt(scene, 'd_mush_small', 46, 42, (c, w, h) => paintSmallShroom(c, w, h, 0xe0443a));
  // mushroom
  dt(scene, 'd_shroom_red', 250, 310, (c, w, h) => paintGiantShroom(c, w, h, 0xd8443c, 0xfff2e6, 21));
  dt(scene, 'd_shroom_blue', 190, 250, (c, w, h) => paintGiantShroom(c, w, h, 0x3d7fd6, 0xc8f4ff, 22));
  dt(scene, 'd_shroom_purple', 160, 210, (c, w, h) => paintGiantShroom(c, w, h, 0x8a4fcf, 0xffd8f6, 23));
  dt(scene, 'd_shroom_cluster', 96, 64, paintShroomCluster);
  dt(scene, 'd_glow_shroom', 60, 60, paintGlowShroom);
  dt(scene, 'd_vine', 40, 150, paintVine, true);
  // snow
  dt(scene, 'd_pine_snow', 156, 280, (c, w, h) => paintPine(c, w, h, 0x2f6b5a, true, 31));
  dt(scene, 'd_pine_small', 100, 176, (c, w, h) => paintPine(c, w, h, 0x357560, true, 32));
  dt(scene, 'd_ice_crystal', 96, 124, (c, w, h) => paintCrystal(c, w, h, 0x9fe6ff, 33));
  dt(scene, 'd_snow_rock', 96, 54, paintSnowRock);
  dt(scene, 'd_icicles', 72, 44, paintIcicles, true);
  dt(scene, 'd_snowman', 72, 100, paintSnowman);
  // volcano
  dt(scene, 'd_lava_spire', 104, 216, paintLavaSpire);
  dt(scene, 'd_obsidian', 96, 96, (c, w, h) => paintCrystal(c, w, h, 0x2a1e2a, 41, 0xff6a10));
  dt(scene, 'd_brazier', 56, 84, (c, w, h) => paintBrazier(c, w, h, 0x4a3a34, 0xff8a20));
  dt(scene, 'd_burnt_tree', 150, 220, (c, w, h) => paintDeadTree(c, w, h, 0x2a1d1a, 42, 0xff5a10));
  // storm
  dt(scene, 'd_dead_tree', 176, 256, (c, w, h) => paintDeadTree(c, w, h, 0x3b3a44, 51));
  dt(scene, 'd_wind_pine', 146, 246, (c, w, h) => paintPine(c, w, h, 0x2f4a40, false, 52, 0.35));
  dt(scene, 'd_runestone', 66, 124, (c, w, h) => paintRunestone(c, w, h, 0x5a6070, 0x9fd8ff));
  dt(scene, 'd_broken_pillar', 84, 168, (c, w, h) => paintPillar(c, w, h, 0x8a90a0, 0x6f7a6a, true));
  dt(scene, 'd_banner_storm', 70, 196, (c, w, h) => paintBanner(c, w, h, 0x2d4a7a, 0x9fd8ff, 'bolt'));
  // sanctum
  dt(scene, 'd_pillar', 96, 330, (c, w, h) => paintPillar(c, w, h, 0xe6e0f0, 0xffcf4a, false));
  dt(scene, 'd_pillar_broken', 96, 210, (c, w, h) => paintPillar(c, w, h, 0xd8d0e6, 0xffcf4a, true));
  dt(scene, 'd_banner_arcane', 84, 250, (c, w, h) => paintBanner(c, w, h, 0x4a1f7a, 0xffcf4a, 'eye'));
  dt(scene, 'd_crystal_float', 56, 100, (c, w, h) => paintCrystal(c, w, h, 0xc08aff, 61));
  dt(scene, 'd_brazier_arcane', 60, 96, (c, w, h) => paintBrazier(c, w, h, 0xcfc7df, 0x8fd8ff, 0xffcf4a));
  dt(scene, 'd_arcane_circle', 320, 64, paintArcaneCircle);
  // animated tiles
  makeTex(scene, 'w_lavafall', 64, 128, paintLavafall);
  makeTex(scene, 'w_lavapool', 192, 48, paintLavaPool);
  makeTex(scene, 'w_waterfall', 64, 128, paintWaterfall);
}

// ───────────────────────────── trees & plants ─────────────────────────────

function paintTree(ctx: Ctx, w: number, h: number, leaf: number, bark: number, seed: number, birch = false) {
  const r = rng(seed);
  const cx = w / 2, base = h;
  const tw = w * 0.12;
  const barkDark = darken(bark, birch ? 0.45 : 0.4);
  // roots + trunk
  poly(ctx, [[cx - tw * 1.8, base], [cx - tw * 0.7, base - h * 0.12], [cx - tw * 0.6, base - h * 0.55], [cx + tw * 0.6, base - h * 0.55], [cx + tw * 0.75, base - h * 0.12], [cx + tw * 1.9, base]],
    hGrad(ctx, cx - tw * 2, cx + tw * 2, [[0, lighten(bark, 0.15)], [0.5, bark], [1, barkDark]]), css(darken(barkDark, 0.3)), 2);
  // branches
  ctx.strokeStyle = css(bark); ctx.lineCap = 'round';
  for (const [dx, dy, lw] of [[-0.25, -0.62, 7], [0.27, -0.6, 6], [0.05, -0.7, 6]] as const) {
    ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(cx, base - h * 0.5); ctx.quadraticCurveTo(cx + dx * w * 0.4, base - h * 0.58, cx + dx * w, base + dy * h); ctx.stroke();
  }
  // bark detail
  ctx.strokeStyle = css(barkDark, 0.8); ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const y = base - rr(r, h * 0.08, h * 0.5), x = cx + rr(r, -tw * 0.4, tw * 0.4);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (birch ? 6 : 1), y + (birch ? 0 : 10)); ctx.stroke();
  }
  // canopy
  canopy(ctx, cx, h * 0.33, w * 0.42, h * 0.27, leaf, r, { blobs: 12 });
  // a few fruits / blossoms
  if (leaf === 0xffb3cf) for (let i = 0; i < 18; i++) circle(ctx, cx + rr(r, -w * 0.38, w * 0.38), h * 0.33 + rr(r, -h * 0.2, h * 0.2), 2.2, css(0xffffff, 0.9));
  else if (r() < 0.7) for (let i = 0; i < 5; i++) outlinedFruit(ctx, cx + rr(r, -w * 0.3, w * 0.3), h * 0.38 + rr(r, -h * 0.12, h * 0.15));
}
function outlinedFruit(ctx: Ctx, x: number, y: number) {
  circle(ctx, x, y, 5, css(0x7a1a1a)); circle(ctx, x, y, 4, css(0xe8434f)); circle(ctx, x - 1.3, y - 1.4, 1.3, css(0xffd0d0));
}
function paintBush(ctx: Ctx, w: number, h: number, leaf: number, berry: number) {
  const r = rng(leaf + berry);
  canopy(ctx, w / 2, h * 0.58, w * 0.42, h * 0.38, leaf, r, { blobs: 9 });
  ctx.fillStyle = css(darken(leaf, 0.5), 0.5); ctx.fillRect(w * 0.12, h - 4, w * 0.76, 4);
  if (berry) for (let i = 0; i < 7; i++) {
    const x = w / 2 + rr(r, -w * 0.32, w * 0.32), y = h * 0.55 + rr(r, -h * 0.25, h * 0.25);
    circle(ctx, x, y, 3.4, css(darken(berry, 0.4))); circle(ctx, x, y, 2.6, css(berry)); circle(ctx, x - 0.8, y - 0.8, 0.9, css(0xffffff, 0.8));
  }
}
function paintFlowers(ctx: Ctx, w: number, h: number) {
  const r = rng(9);
  const cols = [0xff7aa8, 0xffe066, 0xffffff, 0x9cb8ff, 0xffa64d];
  for (let i = 0; i < 7; i++) {
    const x = rr(r, 8, w - 8), top = rr(r, 6, 16);
    ctx.strokeStyle = css(0x3f8f2f); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, h); ctx.quadraticCurveTo(x + 3, (h + top) / 2, x, top); ctx.stroke();
    ellipse(ctx, x + 4, (h + top) / 2 + 3, 4, 2, css(0x5bb83c), 0.5);
    const c = cols[i % cols.length];
    for (let k = 0; k < 5; k++) circle(ctx, x + Math.cos(k * 1.256) * 3.5, top + Math.sin(k * 1.256) * 3.5, 2.8, css(darken(c, 0.25)));
    for (let k = 0; k < 5; k++) circle(ctx, x + Math.cos(k * 1.256) * 3.2, top + Math.sin(k * 1.256) * 3.2, 2.3, css(c));
    circle(ctx, x, top, 2, css(0xffb020));
  }
}
function paintTuft(ctx: Ctx, w: number, h: number, base: number, light: number) {
  const r = rng(base);
  for (let i = 0; i < 16; i++) {
    const x = w / 2 + rr(r, -w * 0.38, w * 0.38), hh = rr(r, h * 0.4, h), lean = rr(r, -7, 7);
    poly(ctx, [[x - 3, h], [x + lean, h - hh], [x + 3, h]], css(i % 3 ? base : light), css(darken(base, 0.35)), 1);
  }
}
function paintRock(ctx: Ctx, w: number, h: number, c: number) {
  const pts: [number, number][] = [[w * 0.06, h], [w * 0.1, h * 0.55], [w * 0.3, h * 0.2], [w * 0.55, h * 0.08], [w * 0.8, h * 0.3], [w * 0.94, h * 0.7], [w * 0.96, h]];
  poly(ctx, pts, vGrad(ctx, 0, h, [[0, lighten(c, 0.25)], [1, darken(c, 0.25)]]), css(darken(c, 0.55)), 2.5);
  poly(ctx, [[w * 0.25, h * 0.32], [w * 0.52, h * 0.16], [w * 0.62, h * 0.4], [w * 0.36, h * 0.5]], css(lighten(c, 0.35), 0.6));
  ctx.strokeStyle = css(darken(c, 0.45)); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w * 0.62, h * 0.4); ctx.lineTo(w * 0.7, h * 0.8); ctx.stroke();
  ellipse(ctx, w * 0.3, h * 0.25, w * 0.12, h * 0.07, css(0x6fae4a, 0.7));
}
function paintStump(ctx: Ctx, w: number, h: number) {
  poly(ctx, [[4, h], [12, 14], [w - 12, 14], [w - 4, h]], hGrad(ctx, 0, w, [[0, 0x9a6a40], [0.6, 0x7a5030], [1, 0x553620]]), css(0x3a2414), 2);
  ellipse(ctx, w / 2, 14, w / 2 - 12, 8, css(0xe0b780)); ellipse(ctx, w / 2, 14, w / 2 - 12, 8, 'rgba(0,0,0,0)');
  ctx.strokeStyle = css(0xb48550); ctx.lineWidth = 1.2;
  for (const s of [0.65, 0.4, 0.18]) { ctx.beginPath(); ctx.ellipse(w / 2, 14, (w / 2 - 12) * s, 8 * s, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = css(0x3a2414); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(w / 2, 14, w / 2 - 12, 8, 0, 0, Math.PI * 2); ctx.stroke();
  ellipse(ctx, 16, h - 10, 6, 4, css(0x5bb83c));
}
function paintLog(ctx: Ctx, w: number, h: number) {
  roundRect(ctx, 6, 8, w - 22, h - 10, 14); ctx.fillStyle = vGrad(ctx, 8, h, [[0, 0x9a6a40], [1, 0x5a3820]]); ctx.fill();
  ctx.strokeStyle = css(0x3a2414); ctx.lineWidth = 2; ctx.stroke();
  ellipse(ctx, w - 16, h / 2 + 3, 10, (h - 10) / 2, css(0x3a2414)); ellipse(ctx, w - 16, h / 2 + 3, 8.5, (h - 14) / 2, css(0xe0b780));
  ctx.strokeStyle = css(0xb48550); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(w - 16, h / 2 + 3, 4.5, (h - 14) / 4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = css(0x4a2c18, 0.7); ctx.lineWidth = 1.5;
  for (let x = 20; x < w - 30; x += 18) { ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x + 10, 16); ctx.stroke(); }
  ellipse(ctx, 34, 10, 14, 4, css(0x5bb83c, 0.9));
}
function paintFence(ctx: Ctx, w: number, h: number) {
  const wood = 0xc89660, dark = 0x6a4428;
  for (const y of [h * 0.35, h * 0.65]) { ctx.fillStyle = css(dark); ctx.fillRect(0, y - 4, w, 9); ctx.fillStyle = css(wood); ctx.fillRect(0, y - 3, w, 6); }
  for (let x = 10; x < w; x += 36) {
    poly(ctx, [[x - 6, h], [x - 6, 8], [x, 2], [x + 6, 8], [x + 6, h]], vGrad(ctx, 0, h, [[0, lighten(wood, 0.15)], [1, darken(wood, 0.2)]]), css(dark), 2);
  }
}
function paintSignpost(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = css(0x5a3820); ctx.fillRect(w / 2 - 5, 18, 10, h - 18); ctx.fillStyle = css(0x8a5a34); ctx.fillRect(w / 2 - 3, 18, 4, h - 18);
  poly(ctx, [[6, 14], [w - 18, 14], [w - 4, 30], [w - 18, 46], [6, 46]], vGrad(ctx, 14, 46, [[0, 0xd8a868], [1, 0xa87444]]), css(0x4a2c18), 2.5);
  ctx.fillStyle = css(0x4a2c18, 0.8); for (let i = 0; i < 3; i++) ctx.fillRect(14, 22 + i * 7, 34 - i * 6, 2);
  circle(ctx, 12, 30, 2, css(0x3a2414));
  ellipse(ctx, w / 2, h - 2, 18, 4, css(0x3f8f2f));
}
function paintLamp(ctx: Ctx, w: number, h: number, iron: number, light: number) {
  const cx = w / 2;
  ctx.fillStyle = css(iron); ctx.fillRect(cx - 3, 30, 6, h - 40);
  roundRect(ctx, cx - 9, h - 14, 18, 14, 3); ctx.fill();
  ctx.fillRect(cx - 6, h - 40, 12, 4);
  // lantern
  glow(ctx, cx, 22, 22, light, 0.55);
  poly(ctx, [[cx - 12, 10], [cx + 12, 10], [cx + 9, 34], [cx - 9, 34]], css(iron));
  poly(ctx, [[cx - 9, 13], [cx + 9, 13], [cx + 7, 31], [cx - 7, 31]], vGrad(ctx, 13, 31, [[0, 0xfff6d0], [1, light]]));
  ctx.fillStyle = css(iron); ctx.fillRect(cx - 1, 13, 2, 18);
  poly(ctx, [[cx - 14, 11], [cx, 0], [cx + 14, 11]], css(iron));
  circle(ctx, cx, 2, 3, css(lighten(iron, 0.3)));
}
function paintSmallShroom(ctx: Ctx, w: number, h: number, cap: number) {
  for (const [dx, s] of [[-10, 0.7], [6, 1]] as const) {
    const x = w / 2 + dx, top = h - 30 * s;
    roundRect(ctx, x - 4 * s, top + 8 * s, 8 * s, h - top - 8 * s, 3); ctx.fillStyle = css(0xf2e6d0); ctx.fill(); ctx.strokeStyle = css(0x8a7050); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, top + 10 * s, 14 * s, 11 * s, 0, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = css(cap); ctx.fill(); ctx.strokeStyle = css(darken(cap, 0.5)); ctx.lineWidth = 1.5; ctx.stroke();
    circle(ctx, x - 5 * s, top + 4 * s, 2.5 * s, css(0xffffff)); circle(ctx, x + 4 * s, top + 2 * s, 2 * s, css(0xffffff));
  }
}
function paintGiantShroom(ctx: Ctx, w: number, h: number, cap: number, spot: number, seed: number) {
  const r = rng(seed);
  const cx = w / 2, capY = h * 0.34, capRx = w * 0.47, capRy = h * 0.26;
  // stem
  poly(ctx, [[cx - w * 0.16, h], [cx - w * 0.09, capY + 10], [cx + w * 0.09, capY + 10], [cx + w * 0.17, h]],
    hGrad(ctx, cx - w * 0.17, cx + w * 0.17, [[0, 0xfff4e0], [0.6, 0xe8d6b8], [1, 0xb8a080]]), css(0x7a6448), 2.5);
  // ring skirt
  ellipse(ctx, cx, capY + h * 0.14, w * 0.15, 8, css(0xf4e8d4)); ctx.strokeStyle = css(0x9a8460); ctx.lineWidth = 1.5; ctx.stroke();
  // gills
  ellipse(ctx, cx, capY + 6, capRx * 0.92, 14, css(0xe6c8a8));
  ctx.strokeStyle = css(0xb8987a); ctx.lineWidth = 1;
  for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(cx, capY + 8); ctx.lineTo(cx + i * capRx * 0.088, capY + 2 + Math.abs(i) * 0.6); ctx.stroke(); }
  // cap dome
  ctx.beginPath(); ctx.ellipse(cx, capY, capRx, capRy, 0, Math.PI, 0);
  ctx.quadraticCurveTo(cx + capRx, capY + 8, cx + capRx - 8, capY + 8); ctx.lineTo(cx - capRx + 8, capY + 8);
  ctx.quadraticCurveTo(cx - capRx, capY + 8, cx - capRx, capY); ctx.closePath();
  ctx.fillStyle = vGrad(ctx, capY - capRy, capY + 8, [[0, lighten(cap, 0.25)], [0.6, cap], [1, darken(cap, 0.3)]]); ctx.fill();
  ctx.strokeStyle = css(darken(cap, 0.55)); ctx.lineWidth = 3; ctx.stroke();
  // spots
  for (let i = 0; i < 9; i++) {
    const a = rr(r, Math.PI * 1.08, Math.PI * 1.92), d = rr(r, 0.25, 0.85);
    const x = cx + Math.cos(a) * capRx * d, y = capY + Math.sin(a) * capRy * d, s = rr(r, 6, 13);
    ellipse(ctx, x, y, s, s * 0.75, css(spot)); ellipse(ctx, x - s * 0.25, y - s * 0.25, s * 0.35, s * 0.25, css(0xffffff, 0.8));
  }
  ellipse(ctx, cx - capRx * 0.35, capY - capRy * 0.6, capRx * 0.25, capRy * 0.12, css(0xffffff, 0.35), -0.3);
}
function paintShroomCluster(ctx: Ctx, w: number, h: number) {
  const items: [number, number, number][] = [[18, 0.6, 0xffa64d], [40, 1, 0xd8443c], [64, 0.75, 0x8a4fcf], [82, 0.5, 0xffe066]];
  for (const [x, s, c] of items) {
    const top = h - 50 * s;
    roundRect(ctx, x - 4 * s, top + 12 * s, 8 * s, h - top - 12 * s, 3); ctx.fillStyle = css(0xf2e6d0); ctx.fill(); ctx.strokeStyle = css(0x8a7050); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, top + 14 * s, 16 * s, 14 * s, 0, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = css(c); ctx.fill(); ctx.strokeStyle = css(darken(c, 0.5)); ctx.lineWidth = 1.5; ctx.stroke();
    circle(ctx, x - 5 * s, top + 6 * s, 2.5 * s, css(0xffffff, 0.9));
  }
}
function paintGlowShroom(ctx: Ctx, w: number, h: number) {
  glow(ctx, w / 2, h * 0.45, w / 2, 0x7dfff0, 0.45);
  for (const [dx, s] of [[-9, 0.65], [8, 1], [-1, 0.45]] as const) {
    const x = w / 2 + dx, top = h - 34 * s;
    ctx.fillStyle = css(0xd9fff8); ctx.fillRect(x - 2 * s, top + 8 * s, 4 * s, h - top - 8 * s);
    ctx.beginPath(); ctx.ellipse(x, top + 9 * s, 12 * s, 9 * s, 0, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = vGrad(ctx, top, top + 9 * s, [[0, 0xe8fffb], [1, 0x3fd8c8]]); ctx.fill();
    circle(ctx, x - 3 * s, top + 4 * s, 1.6 * s, css(0xffffff));
  }
}
function paintVine(ctx: Ctx, w: number, h: number) {
  const r = rng(71);
  ctx.strokeStyle = css(0x2f6a3a); ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(w / 2, 0);
  for (let y = 0; y <= h - 10; y += 10) ctx.lineTo(w / 2 + Math.sin(y * 0.08) * 6, y);
  ctx.stroke();
  for (let y = 8; y < h - 10; y += 12) {
    const x = w / 2 + Math.sin(y * 0.08) * 6, s = y % 24 ? 1 : -1;
    ellipse(ctx, x + s * 7, y, 7, 3.5, css(r() < 0.5 ? 0x4aa868 : 0x5fc27a), s * 0.5);
  }
  glow(ctx, w / 2, h - 8, 9, 0x7dfff0, 0.7); circle(ctx, w / 2, h - 8, 3, css(0xe8fffb));
}

// ───────────────────────────── snow ─────────────────────────────

function paintPine(ctx: Ctx, w: number, h: number, green: number, snow: boolean, seed: number, wind = 0) {
  const r = rng(seed);
  const cx = w / 2;
  ctx.fillStyle = css(0x5a3a22); ctx.fillRect(cx - w * 0.05, h * 0.75, w * 0.1, h * 0.25);
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const y = h * 0.82 - i * h * 0.16, ww = w * (0.48 - i * 0.075), top = y - h * 0.24;
    const sk = wind * (i + 1) * 6;
    const pts: [number, number][] = [[cx - ww + sk * 0.3, y], [cx + sk, top], [cx + ww + sk * 1.2, y]];
    poly(ctx, [[pts[0][0], y], [cx - ww * 0.6, y + 6], [cx, y + 2], [cx + ww * 0.6, y + 7], [pts[2][0], y], pts[1]],
      vGrad(ctx, top, y, [[0, lighten(green, 0.18)], [1, darken(green, 0.25)]]), css(darken(green, 0.55)), 2);
    if (snow) {
      ctx.beginPath(); ctx.moveTo(cx + sk, top);
      ctx.lineTo(cx - ww * 0.55, y - h * 0.08); ctx.quadraticCurveTo(cx - ww * 0.2, y - h * 0.05, cx, y - h * 0.08);
      ctx.quadraticCurveTo(cx + ww * 0.25, y - h * 0.04, cx + ww * 0.6, y - h * 0.09); ctx.closePath();
      ctx.fillStyle = css(0xf6fbff); ctx.fill();
      ctx.fillStyle = css(0xc8dcf0); ctx.fillRect(cx - ww * 0.4, y - h * 0.08, ww * 0.8, 1.5);
    }
  }
  if (snow) { ellipse(ctx, cx, h - 3, w * 0.36, 5, css(0xf6fbff)); }
  void r;
}
function paintCrystal(ctx: Ctx, w: number, h: number, c: number, seed: number, glowC?: number) {
  const r = rng(seed);
  const g = glowC ?? lighten(c, 0.4);
  glow(ctx, w / 2, h * 0.5, w * 0.55, g, glowC ? 0.5 : 0.35);
  const shards: [number, number, number, number][] = [[-0.22, 0.6, 0.14, -0.35], [0.24, 0.55, 0.13, 0.3], [0, 0.95, 0.18, 0], [-0.08, 0.4, 0.1, -0.6], [0.12, 0.42, 0.1, 0.6]];
  for (const [dx, hh, ww, lean] of shards) {
    const bx = w / 2 + dx * w, by = h - 2, th = h * hh;
    const tx = bx + lean * th * 0.3, ty = by - th;
    const hw = ww * w;
    poly(ctx, [[bx - hw, by], [bx - hw, by - th * 0.7], [tx, ty], [bx + hw, by - th * 0.7], [bx + hw, by]],
      hGrad(ctx, bx - hw, bx + hw, [[0, lighten(c, 0.45)], [0.5, c], [1, darken(c, 0.35)]]), css(darken(c, 0.55)), 1.5);
    poly(ctx, [[bx - hw * 0.4, by - 4], [bx - hw * 0.4, by - th * 0.65], [tx, ty + 4]], css(0xffffff, glowC ? 0.15 : 0.45));
    if (glowC) { ctx.strokeStyle = css(glowC, 0.9); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + rr(r, -2, 2), by - th * 0.6); ctx.stroke(); }
  }
  star4(ctx, w * 0.55, h * 0.12, 5, css(0xffffff, 0.9));
}
function paintSnowRock(ctx: Ctx, w: number, h: number) {
  paintRock(ctx, w, h, 0x6a86a8);
  ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.55); ctx.lineTo(w * 0.3, h * 0.2); ctx.lineTo(w * 0.55, h * 0.08); ctx.lineTo(w * 0.8, h * 0.3); ctx.lineTo(w * 0.9, h * 0.55);
  ctx.quadraticCurveTo(w * 0.7, h * 0.45, w * 0.5, h * 0.52); ctx.quadraticCurveTo(w * 0.3, h * 0.42, w * 0.1, h * 0.55); ctx.closePath();
  ctx.fillStyle = css(0xf6fbff); ctx.fill(); ctx.strokeStyle = css(0xb6cde6); ctx.lineWidth = 1.5; ctx.stroke();
}
function paintIcicles(ctx: Ctx, w: number, h: number) {
  const r = rng(81);
  ctx.fillStyle = css(0xf6fbff); roundRect(ctx, 0, 0, w, 8, 4); ctx.fill();
  for (let x = 5; x < w - 3; x += rr(r, 7, 11)) {
    const len = rr(r, 12, h - 2);
    poly(ctx, [[x - 4, 5], [x + 4, 5], [x, len]], vGrad(ctx, 5, len, [[0, 0xffffff], [1, 0x9fd8ff, 0.8]]), css(0x8fb8dc), 1);
  }
}
function paintSnowman(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  for (const [y, rad] of [[h - 24, 24], [h - 58, 17], [h - 82, 13]] as const) {
    circle(ctx, cx, y, rad + 2, css(0x9cb8d8)); circle(ctx, cx, y, rad, css(0xf8fcff)); circle(ctx, cx - rad * 0.35, y - rad * 0.35, rad * 0.35, css(0xffffff));
  }
  circle(ctx, cx - 4, h - 85, 1.8, css(0x222)); circle(ctx, cx + 4, h - 85, 1.8, css(0x222));
  poly(ctx, [[cx, h - 81], [cx + 12, h - 79], [cx, h - 78]], css(0xff8a20));
  ctx.fillStyle = css(0xd8364a); ctx.fillRect(cx - 14, h - 72, 28, 5); ctx.fillRect(cx + 6, h - 70, 5, 14);
  for (const y of [h - 62, h - 54, h - 30]) circle(ctx, cx, y, 2, css(0x333));
  ctx.strokeStyle = css(0x5a3820); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(cx - 15, h - 60); ctx.lineTo(cx - 32, h - 72); ctx.moveTo(cx + 15, h - 60); ctx.lineTo(cx + 32, h - 74); ctx.stroke();
}

// ───────────────────────────── volcano ─────────────────────────────

function paintLavaSpire(ctx: Ctx, w: number, h: number) {
  const r = rng(91);
  poly(ctx, [[4, h], [w * 0.22, h * 0.5], [w * 0.4, h * 0.08], [w * 0.52, 0], [w * 0.66, h * 0.2], [w * 0.8, h * 0.55], [w - 4, h]],
    hGrad(ctx, 0, w, [[0, 0x5a4a48], [0.5, 0x3a2e2e], [1, 0x1e1616]]), css(0x120c0c), 2.5);
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = css(0xff7a1a, 0.9); ctx.lineWidth = 2; ctx.beginPath();
    let x = w * rr(r, 0.35, 0.65), y = h * rr(r, 0.15, 0.4); ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += rr(r, -8, 8); y += rr(r, 14, 30); ctx.lineTo(x, Math.min(h, y)); }
    ctx.stroke();
    glow(ctx, x, Math.min(h, y), 10, 0xff6a10, 0.5);
  }
  glow(ctx, w / 2, h, w * 0.5, 0xff5a10, 0.35);
}
function paintBrazier(ctx: Ctx, w: number, h: number, metal: number, flame: number, trim?: number) {
  const cx = w / 2;
  ctx.fillStyle = css(darken(metal, 0.3)); ctx.fillRect(cx - 4, 40, 8, h - 46);
  poly(ctx, [[cx - 16, h], [cx - 8, h - 10], [cx + 8, h - 10], [cx + 16, h]], css(metal), css(darken(metal, 0.5)), 2);
  poly(ctx, [[cx - 22, 30], [cx + 22, 30], [cx + 14, 46], [cx - 14, 46]], vGrad(ctx, 30, 46, [[0, lighten(metal, 0.2)], [1, darken(metal, 0.3)]]), css(darken(metal, 0.55)), 2);
  if (trim) { ctx.fillStyle = css(trim); ctx.fillRect(cx - 20, 32, 40, 3); }
  glow(ctx, cx, 20, 26, flame, 0.6);
  poly(ctx, [[cx - 14, 31], [cx - 10, 14], [cx - 4, 22], [cx, 2], [cx + 5, 20], [cx + 10, 10], [cx + 14, 31]], css(flame));
  poly(ctx, [[cx - 7, 31], [cx - 3, 18], [cx, 24], [cx + 3, 14], [cx + 7, 31]], css(lighten(flame, 0.6)));
}
function paintDeadTree(ctx: Ctx, w: number, h: number, bark: number, seed: number, ember?: number) {
  const r = rng(seed);
  const cx = w / 2;
  poly(ctx, [[cx - 20, h], [cx - 9, h - h * 0.15], [cx - 7, h * 0.3], [cx + 7, h * 0.3], [cx + 10, h - h * 0.15], [cx + 22, h]],
    hGrad(ctx, cx - 20, cx + 20, [[0, lighten(bark, 0.2)], [1, darken(bark, 0.35)]]), css(darken(bark, 0.5)), 2);
  ctx.lineCap = 'round';
  const branch = (x: number, y: number, a: number, len: number, lw: number, depth: number) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    ctx.strokeStyle = css(bark); ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    if (depth > 0) {
      branch(x2, y2, a - rr(r, 0.3, 0.7), len * 0.65, lw * 0.65, depth - 1);
      branch(x2, y2, a + rr(r, 0.3, 0.7), len * 0.6, lw * 0.6, depth - 1);
    } else if (ember && r() < 0.5) { glow(ctx, x2, y2, 6, ember, 0.8); }
  };
  branch(cx, h * 0.32, -Math.PI / 2, h * 0.18, 10, 3);
  branch(cx - 3, h * 0.5, -Math.PI * 0.85, h * 0.14, 6, 2);
  branch(cx + 3, h * 0.45, -Math.PI * 0.15, h * 0.15, 6, 2);
  if (ember) {
    ctx.strokeStyle = css(ember, 0.9); ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { const y = h * rr(r, 0.4, 0.9); ctx.beginPath(); ctx.moveTo(cx - 4, y); ctx.lineTo(cx + 2, y + 8); ctx.stroke(); }
  }
}
function paintLavafall(ctx: Ctx, w: number, h: number) {
  const r = rng(101);
  ctx.fillStyle = hGrad(ctx, 0, w, [[0, 0xff5a10, 0], [0.15, 0xff6a10], [0.5, 0xffb030], [0.85, 0xff6a10], [1, 0xff5a10, 0]]);
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) {
    const x = rr(r, w * 0.2, w * 0.8), y = rr(r, 0, h), len = rr(r, 14, 40);
    for (const oy of [0, h, -h]) { ctx.fillStyle = css(r() < 0.5 ? 0xfff0a0 : 0xff4a10, 0.7); ctx.fillRect(x, y + oy, rr(r, 2, 4), len); }
  }
}
function paintLavaPool(ctx: Ctx, w: number, h: number) {
  glow(ctx, w / 2, h / 2, w / 2, 0xff6a10, 0.6);
  ellipse(ctx, w / 2, h / 2 + 4, w * 0.42, h * 0.3, css(0xff7a1a));
  ellipse(ctx, w / 2, h / 2 + 2, w * 0.3, h * 0.18, css(0xffc040));
  ellipse(ctx, w / 2 - 20, h / 2, 10, 3, css(0xfff0a0));
}
function paintWaterfall(ctx: Ctx, w: number, h: number) {
  const r = rng(111);
  ctx.fillStyle = hGrad(ctx, 0, w, [[0, 0x9fe0ff, 0], [0.2, 0x8fd0f0, 0.75], [0.5, 0xd8f4ff, 0.9], [0.8, 0x8fd0f0, 0.75], [1, 0x9fe0ff, 0]]);
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) {
    const x = rr(r, w * 0.2, w * 0.8), y = rr(r, 0, h), len = rr(r, 14, 40);
    for (const oy of [0, h, -h]) { ctx.fillStyle = css(0xffffff, 0.6); ctx.fillRect(x, y + oy, 2, len); }
  }
}

// ───────────────────────────── storm / sanctum ─────────────────────────────

function paintRunestone(ctx: Ctx, w: number, h: number, stone: number, rune: number) {
  poly(ctx, [[6, h], [4, 30], [16, 6], [w - 14, 2], [w - 4, 24], [w - 6, h]], vGrad(ctx, 0, h, [[0, lighten(stone, 0.2)], [1, darken(stone, 0.3)]]), css(darken(stone, 0.6)), 2.5);
  glow(ctx, w / 2, h * 0.45, 26, rune, 0.5);
  ctx.strokeStyle = css(rune); ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(w / 2, 26); ctx.lineTo(w / 2, 80); ctx.moveTo(w / 2, 40); ctx.lineTo(w / 2 + 12, 30); ctx.moveTo(w / 2, 52); ctx.lineTo(w / 2 - 12, 62); ctx.moveTo(w / 2, 66); ctx.lineTo(w / 2 + 10, 74); ctx.stroke();
  ellipse(ctx, 18, h - 8, 12, 5, css(0x5f8a5a));
}
function paintPillar(ctx: Ctx, w: number, h: number, stone: number, trim: number, broken: boolean) {
  const cx = w / 2, sw = w * 0.32;
  const top = broken ? 18 : 30;
  ctx.fillStyle = hGrad(ctx, cx - sw, cx + sw, [[0, lighten(stone, 0.2)], [0.35, stone], [1, darken(stone, 0.3)]]);
  ctx.fillRect(cx - sw, top, sw * 2, h - top - 16);
  ctx.strokeStyle = css(darken(stone, 0.2)); ctx.lineWidth = 1.5;
  for (let x = cx - sw + 7; x < cx + sw - 3; x += 9) { ctx.beginPath(); ctx.moveTo(x, top + 4); ctx.lineTo(x, h - 18); ctx.stroke(); }
  // base
  roundRect(ctx, cx - w * 0.46, h - 18, w * 0.92, 18, 2); ctx.fillStyle = css(darken(stone, 0.1)); ctx.fill();
  ctx.fillStyle = css(trim); ctx.fillRect(cx - w * 0.42, h - 20, w * 0.84, 4);
  if (broken) {
    poly(ctx, [[cx - sw, top], [cx - sw * 0.4, top - 14], [cx, top - 4], [cx + sw * 0.5, top - 18], [cx + sw, top - 2], [cx + sw, top + 6], [cx - sw, top + 6]], css(stone), css(darken(stone, 0.4)), 1.5);
    ctx.strokeStyle = css(darken(stone, 0.45)); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 4, top); ctx.lineTo(cx + 4, top + 30); ctx.lineTo(cx - 2, top + 50); ctx.stroke();
  } else {
    roundRect(ctx, cx - w * 0.48, 4, w * 0.96, 16, 3); ctx.fillStyle = css(lighten(stone, 0.1)); ctx.fill();
    ctx.fillStyle = css(trim); ctx.fillRect(cx - w * 0.44, 20, w * 0.88, 5);
    ctx.fillRect(cx - w * 0.4, 0, w * 0.8, 4);
    for (const s of [-1, 1]) { circle(ctx, cx + s * w * 0.36, 14, 6, css(trim)); circle(ctx, cx + s * w * 0.36, 14, 3, css(darken(trim, 0.3))); }
  }
}
function paintBanner(ctx: Ctx, w: number, h: number, cloth: number, emblem: number, kind: 'bolt' | 'eye') {
  const cx = w / 2;
  ctx.fillStyle = css(0x3a3030); ctx.fillRect(cx - 3, 0, 6, h);
  circle(ctx, cx, 4, 6, css(0xd8b050));
  ctx.fillStyle = css(0xd8b050); ctx.fillRect(4, 14, w - 8, 5);
  const bh = h * 0.62;
  const pts: [number, number][] = [[8, 18], [w - 8, 18], [w - 8, 18 + bh]];
  if (kind === 'bolt') pts.push([w * 0.7, 18 + bh - 14], [w * 0.55, 18 + bh + 4], [w * 0.38, 18 + bh - 18], [8, 18 + bh - 6]);
  else pts.push([cx, 18 + bh + 22], [8, 18 + bh]);
  poly(ctx, pts, hGrad(ctx, 8, w - 8, [[0, lighten(cloth, 0.2)], [0.5, cloth], [1, darken(cloth, 0.35)]]), css(darken(cloth, 0.5)), 2);
  ctx.fillStyle = css(emblem); ctx.fillRect(10, 24, w - 20, 3); ctx.fillRect(10, 18 + bh - 26, w - 20, 3);
  const ey = 18 + bh * 0.48;
  glow(ctx, cx, ey, 22, emblem, 0.45);
  if (kind === 'bolt') poly(ctx, [[cx + 6, ey - 26], [cx - 10, ey + 2], [cx - 1, ey + 2], [cx - 7, ey + 26], [cx + 11, ey - 4], [cx + 2, ey - 4]], css(emblem));
  else {
    ellipse(ctx, cx, ey, 18, 10, css(emblem)); circle(ctx, cx, ey, 7, css(cloth)); circle(ctx, cx, ey, 3.5, css(lighten(emblem, 0.5)));
    star4(ctx, cx, ey - 28, 7, css(emblem)); star4(ctx, cx, ey + 30, 5, css(emblem));
  }
}
function paintArcaneCircle(ctx: Ctx, w: number, h: number) {
  const cx = w / 2, cy = h / 2;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, h / w * 1.0);
  const R = w / 2 - 4;
  ctx.strokeStyle = css(0xc9a0ff, 0.9); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = css(0xffcf4a, 0.85); ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) { const a = (i * 2 * Math.PI * 2) / 6 - Math.PI / 2; const x = Math.cos(a) * R * 0.76, y = Math.sin(a) * R * 0.76; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) { const a = (i * 2 * Math.PI * 2) / 6 + Math.PI / 2; const x = Math.cos(a) * R * 0.76, y = Math.sin(a) * R * 0.76; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; circle(ctx, Math.cos(a) * R * 0.89, Math.sin(a) * R * 0.89, 5, css(0xe8d8ff, 0.9)); }
  ctx.restore();
}

