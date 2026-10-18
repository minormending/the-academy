// OWNER: A7 (world). Mistvale town art: houses, shops, guild halls, mage tower, fountain, lanterns, signboards.
import Phaser from 'phaser';
import { DECOR_INFO } from './decor';
import { type Ctx, circle, css, darken, ellipse, glow, hGrad, lighten, makeTex, poly, rng, rr, roundRect, star4, vGrad } from './util';

function tt(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void) {
  DECOR_INFO[key] = { w, h };
  makeTex(scene, key, w, h, draw);
}

export function generateTownTextures(scene: Phaser.Scene) {
  tt(scene, 't_house_potion', 300, 290, (c, w, h) => paintHouse(c, w, h, { wall: 0xf3e3c4, timber: 0x7a4e2e, roof: 0x5b8fd6, seed: 1, chimney: true, awning: 0x7dd6a0, window: 0xfff0a8, round: true }));
  tt(scene, 't_house_smith', 320, 270, (c, w, h) => paintHouse(c, w, h, { wall: 0xc9b8a2, timber: 0x4a3324, roof: 0x9a4a32, seed: 2, chimney: true, awning: 0x6a6a7a, window: 0xffb060, stoneBase: true, forge: true }));
  tt(scene, 't_cottage', 250, 240, (c, w, h) => paintHouse(c, w, h, { wall: 0xfbefd8, timber: 0x8a5a36, roof: 0xd86a4a, seed: 3, chimney: false, window: 0xfff0a8, flowers: true }));
  tt(scene, 't_cottage_b', 230, 230, (c, w, h) => paintHouse(c, w, h, { wall: 0xe8f0e0, timber: 0x6a5040, roof: 0x7a6ac8, seed: 4, chimney: true, window: 0xfff0a8, flowers: true }));
  tt(scene, 't_hall_fire', 270, 310, (c, w, h) => paintHall(c, w, h, 0xe0563a, 0xffb040, 'flame'));
  tt(scene, 't_hall_ice', 270, 310, (c, w, h) => paintHall(c, w, h, 0x4a9ad8, 0xc8f4ff, 'snow'));
  tt(scene, 't_hall_storm', 270, 310, (c, w, h) => paintHall(c, w, h, 0x7a5ad0, 0xffe066, 'bolt'));
  tt(scene, 't_tower', 240, 600, paintTower);
  tt(scene, 't_fountain', 230, 130, paintFountain);
  tt(scene, 't_lantern', 48, 170, paintLanternPost);
  tt(scene, 't_bench', 96, 40, paintBench);
  tt(scene, 't_crates', 90, 64, paintCrates);
  tt(scene, 't_barrel', 44, 54, paintBarrel);
  tt(scene, 't_well', 110, 130, paintWell);
  tt(scene, 't_bunting', 320, 70, paintBunting);
  tt(scene, 't_gate', 260, 300, paintGate);
  const signs: [string, string, string, number][] = [
    ['t_sign_potion', 'POTIONS', 'potion', 0x5bb06a], ['t_sign_smith', 'SMITHY', 'anvil', 0x7a7a8a],
    ['t_sign_fire', 'FIRE', 'flame', 0xd8503a], ['t_sign_ice', 'ICE', 'snow', 0x4a8ad0],
    ['t_sign_storm', 'STORM', 'bolt', 0x7a5ad0], ['t_sign_elder', 'ARCHMAGE', 'star', 0x5a4aa0],
  ];
  for (const [key, label, glyph, col] of signs) tt(scene, key, 84, 120, (c, w, h) => paintShopSign(c, w, h, label, glyph, col));
}

// ───────────────────────────── glyphs ─────────────────────────────

function glyph(ctx: Ctx, kind: string, x: number, y: number, s: number, col: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const dark = css(darken(col, 0.5));
  switch (kind) {
    case 'potion':
      roundRect(ctx, -3, -12, 6, 6, 1); ctx.fillStyle = css(0xc89660); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 2, 9, 0, Math.PI * 2); ctx.fillStyle = css(0xe8435a); ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = css(0xdfe8ff); ctx.fillRect(-3, -7, 6, 4);
      circle(ctx, -3, -1, 2.2, css(0xffffff, 0.8));
      break;
    case 'anvil':
      poly(ctx, [[-12, -4], [8, -4], [12, -8], [12, -2], [6, 2], [4, 8], [8, 11], [-8, 11], [-4, 8], [-6, 2], [-12, -1]], css(0x4a4a58), dark, 1.2);
      ctx.fillStyle = css(0xa0a0b0); ctx.fillRect(-11, -4, 20, 2);
      ctx.strokeStyle = css(0x8a5a34); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(4, -16); ctx.lineTo(12, -8); ctx.stroke();
      ctx.fillStyle = css(0x6a6a7a); ctx.fillRect(-2, -20, 10, 6);
      break;
    case 'flame':
      poly(ctx, [[-9, 10], [-10, -2], [-5, 2], [-4, -12], [2, -4], [4, -14], [10, 0], [9, 10]], css(0xff6a2a), dark, 1.2);
      poly(ctx, [[-4, 10], [-4, 2], [0, 4], [2, -4], [5, 3], [4, 10]], css(0xffe066));
      break;
    case 'snow':
      ctx.strokeStyle = css(0xe8f8ff); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * -11, Math.sin(a) * -11); ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); ctx.stroke();
      }
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3, x2 = Math.cos(a) * 7, y2 = Math.sin(a) * 7;
        ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 + Math.cos(a + 0.8) * 4, y2 + Math.sin(a + 0.8) * 4);
        ctx.moveTo(x2, y2); ctx.lineTo(x2 + Math.cos(a - 0.8) * 4, y2 + Math.sin(a - 0.8) * 4); ctx.stroke();
      }
      break;
    case 'bolt':
      poly(ctx, [[3, -14], [-8, 2], [-1, 2], [-4, 14], [8, -3], [1, -3]], css(0xffe066), dark, 1.2);
      break;
    case 'star':
      star4(ctx, 0, 0, 13, css(0xffe8a0)); star4(ctx, 0, 0, 7, css(0xffffff));
      circle(ctx, 9, -9, 1.6, css(0xffffff)); circle(ctx, -10, 8, 1.3, css(0xffffff));
      break;
  }
  ctx.restore();
}

// ───────────────────────────── buildings ─────────────────────────────

interface HouseOpts {
  wall: number; timber: number; roof: number; seed: number; chimney?: boolean; awning?: number; window: number;
  round?: boolean; stoneBase?: boolean; forge?: boolean; flowers?: boolean;
}

function windowAt(ctx: Ctx, x: number, y: number, w: number, h: number, frame: number, light: number, arched = false) {
  glow(ctx, x + w / 2, y + h / 2, Math.max(w, h) * 0.9, light, 0.35);
  ctx.beginPath();
  if (arched) { ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); }
  else { ctx.rect(x, y, w, h); }
  ctx.fillStyle = css(darken(frame, 0.2)); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = vGrad(ctx, y, y + h, [[0, lighten(light, 0.5)], [1, light]]); ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = css(frame); ctx.fillRect(x + w / 2 - 1.5, y, 3, h); ctx.fillRect(x, y + h * 0.55, w, 3);
  ctx.fillStyle = css(0xffffff, 0.45); ctx.fillRect(x + 5, y + 5, 3, h * 0.3);
  ctx.restore();
  ctx.fillStyle = css(darken(frame, 0.2)); ctx.fillRect(x - 3, y + h, w + 6, 4);
}

function paintHouse(ctx: Ctx, w: number, h: number, o: HouseOpts) {
  const r = rng(o.seed);
  const roofH = h * 0.42, wallTop = roofH - 6, base = h;
  const wx0 = w * 0.1, wx1 = w * 0.9;
  // chimney (behind roof)
  if (o.chimney) {
    const cx = w * 0.72;
    ctx.fillStyle = css(0x8a6a5a); ctx.fillRect(cx, roofH * 0.15, 24, roofH * 0.6);
    ctx.fillStyle = css(0x6a4a3a); ctx.fillRect(cx - 3, roofH * 0.12, 30, 8);
    for (let i = 0; i < 3; i++) circle(ctx, cx + 12 + i * 6, roofH * 0.05 - i * 10, 7 + i * 3, css(0xe8e8f0, 0.35 - i * 0.08));
  }
  // walls
  ctx.fillStyle = vGrad(ctx, wallTop, base, [[0, lighten(o.wall, 0.1)], [1, darken(o.wall, 0.12)]]);
  ctx.fillRect(wx0, wallTop, wx1 - wx0, base - wallTop);
  ctx.strokeStyle = css(darken(o.wall, 0.5)); ctx.lineWidth = 2.5; ctx.strokeRect(wx0, wallTop, wx1 - wx0, base - wallTop);
  if (o.stoneBase) {
    for (let row = 0; row < 3; row++) for (let x = wx0; x < wx1; x += 22) {
      const off = row % 2 ? 11 : 0;
      roundRect(ctx, x + off - 10, base - 18 - row * 14 + 1, 20, 12, 3);
      ctx.fillStyle = css(row % 2 ? 0x9a9088 : 0x8a8078); ctx.fill();
    }
  }
  // timber frame
  ctx.fillStyle = css(o.timber);
  ctx.fillRect(wx0, wallTop, wx1 - wx0, 7);
  ctx.fillRect(wx0, base - 8, wx1 - wx0, 8);
  for (const x of [wx0, w * 0.5 - 3, wx1 - 7]) ctx.fillRect(x, wallTop, 7, base - wallTop);
  ctx.strokeStyle = css(o.timber); ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(wx0 + 7, wallTop + 8); ctx.lineTo(w * 0.5 - 3, wallTop + (base - wallTop) * 0.38); ctx.moveTo(wx1 - 7, wallTop + 8); ctx.lineTo(w * 0.5 + 3, wallTop + (base - wallTop) * 0.38); ctx.stroke();
  // roof
  const overhang = w * 0.05;
  poly(ctx, [[-0 + overhang * 0.2, roofH + 4], [w * 0.5, 4], [w - overhang * 0.2, roofH + 4]],
    vGrad(ctx, 0, roofH, [[0, lighten(o.roof, 0.18)], [1, darken(o.roof, 0.2)]]), css(darken(o.roof, 0.5)), 3);
  // shingles
  ctx.save(); ctx.beginPath(); ctx.moveTo(overhang * 0.2, roofH + 4); ctx.lineTo(w * 0.5, 4); ctx.lineTo(w - overhang * 0.2, roofH + 4); ctx.closePath(); ctx.clip();
  for (let y = 14; y < roofH + 4; y += 12) for (let x = (y / 12) % 2 ? 0 : 10; x < w; x += 20) {
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI); ctx.strokeStyle = css(darken(o.roof, 0.3), 0.7); ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.fillStyle = css(0xffffff, 0.15); ctx.beginPath(); ctx.moveTo(w * 0.5, 4); ctx.lineTo(w * 0.32, roofH * 0.5); ctx.lineTo(w * 0.5, roofH * 0.5); ctx.fill();
  ctx.restore();
  // gable window
  if (o.round) {
    circle(ctx, w * 0.5, roofH * 0.62, 15, css(darken(o.timber, 0.1)));
    circle(ctx, w * 0.5, roofH * 0.62, 11, css(o.window)); ctx.fillStyle = css(o.timber); ctx.fillRect(w * 0.5 - 1.5, roofH * 0.62 - 11, 3, 22); ctx.fillRect(w * 0.5 - 11, roofH * 0.62 - 1.5, 22, 3);
  } else {
    windowAt(ctx, w * 0.5 - 12, roofH * 0.45, 24, 26, o.timber, o.window, true);
  }
  // door
  const dw = w * 0.17, dh = (base - wallTop) * 0.55, dx = w * 0.5 - dw / 2 + (o.forge ? -w * 0.18 : 0);
  ctx.beginPath(); ctx.moveTo(dx, base - 8); ctx.lineTo(dx, base - dh + dw / 2); ctx.arc(dx + dw / 2, base - dh + dw / 2, dw / 2, Math.PI, 0); ctx.lineTo(dx + dw, base - 8); ctx.closePath();
  ctx.fillStyle = css(darken(o.timber, 0.35)); ctx.fill();
  ctx.fillStyle = vGrad(ctx, base - dh, base, [[0, lighten(o.timber, 0.25)], [1, o.timber]]);
  ctx.beginPath(); ctx.moveTo(dx + 4, base - 8); ctx.lineTo(dx + 4, base - dh + dw / 2); ctx.arc(dx + dw / 2, base - dh + dw / 2, dw / 2 - 4, Math.PI, 0); ctx.lineTo(dx + dw - 4, base - 8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = css(darken(o.timber, 0.4)); ctx.lineWidth = 1.5;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(dx + (dw * i) / 3, base - dh + 8); ctx.lineTo(dx + (dw * i) / 3, base - 8); ctx.stroke(); }
  circle(ctx, dx + dw - 9, base - dh * 0.45, 2.5, css(0xffd27a));
  // windows
  const wy = wallTop + (base - wallTop) * 0.32;
  if (o.forge) {
    // forge opening with glow
    const fx = w * 0.56, fw = w * 0.26, fh = (base - wallTop) * 0.42;
    glow(ctx, fx + fw / 2, base - fh / 2 - 10, fw, 0xff7a1a, 0.6);
    ctx.fillStyle = css(0x2a1a14); roundRect(ctx, fx, base - fh - 10, fw, fh, 8); ctx.fill();
    ctx.fillStyle = vGrad(ctx, base - fh, base - 10, [[0, 0xff5a10], [1, 0xffd060]]); roundRect(ctx, fx + 6, base - fh * 0.6 - 10, fw - 12, fh * 0.6, 4); ctx.fill();
    ctx.fillStyle = css(0x4a4a58); ctx.fillRect(fx - 4, base - fh - 14, fw + 8, 6);
  } else {
    windowAt(ctx, w * 0.2, wy, 30, 34, o.timber, o.window);
    windowAt(ctx, w * 0.8 - 30, wy, 30, 34, o.timber, o.window);
  }
  // awning
  if (o.awning !== undefined) {
    const ay = wallTop + (base - wallTop) * 0.22, ax0 = o.forge ? w * 0.52 : w * 0.14, ax1 = o.forge ? w * 0.86 : w * 0.86;
    for (let x = ax0, i = 0; x < ax1; x += 20, i++) {
      poly(ctx, [[x, ay], [x + 20, ay], [x + 22, ay + 18], [x + 10, ay + 24], [x - 2, ay + 18]], css(i % 2 ? 0xffffff : o.awning), css(darken(o.awning, 0.5)), 1.2);
    }
  }
  if (o.flowers) {
    for (const x of [w * 0.2, w * 0.8 - 30]) {
      ctx.fillStyle = css(0x8a5a36); ctx.fillRect(x - 4, wy + 38, 38, 10);
      for (let i = 0; i < 6; i++) circle(ctx, x + 2 + i * 6, wy + 36, 3.5, css([0xff7aa8, 0xffe066, 0xffffff][i % 3]));
    }
  }
  // grass at foot
  for (let i = 0; i < 40; i++) {
    const x = rr(r, wx0 - 8, wx1 + 8), hh = rr(r, 3, 9);
    poly(ctx, [[x - 2.5, base], [x + rr(r, -2, 2), base - hh], [x + 2.5, base]], css(i % 2 ? 0x5bb83c : 0x8ad85a));
  }
}

function paintHall(ctx: Ctx, w: number, h: number, color: number, emblem: number, kind: string) {
  const stone = 0xe6dccb, base = h;
  const wallTop = h * 0.38;
  // side turrets
  for (const tx of [w * 0.04, w * 0.78]) {
    const tw = w * 0.18;
    ctx.fillStyle = hGrad(ctx, tx, tx + tw, [[0, lighten(stone, 0.1)], [1, darken(stone, 0.18)]]); ctx.fillRect(tx, wallTop - 30, tw, base - wallTop + 30);
    ctx.strokeStyle = css(darken(stone, 0.5)); ctx.lineWidth = 2; ctx.strokeRect(tx, wallTop - 30, tw, base - wallTop + 30);
    poly(ctx, [[tx - 6, wallTop - 28], [tx + tw / 2, wallTop - 95], [tx + tw + 6, wallTop - 28]], vGrad(ctx, wallTop - 95, wallTop - 28, [[0, lighten(color, 0.2)], [1, darken(color, 0.25)]]), css(darken(color, 0.5)), 2.5);
    circle(ctx, tx + tw / 2, wallTop - 98, 4, css(emblem));
    windowAt(ctx, tx + tw / 2 - 8, wallTop + 10, 16, 26, darken(color, 0.3), 0xfff0a8, true);
  }
  // main body
  const bx0 = w * 0.18, bx1 = w * 0.82;
  ctx.fillStyle = vGrad(ctx, wallTop, base, [[0, lighten(stone, 0.12)], [1, darken(stone, 0.1)]]); ctx.fillRect(bx0, wallTop, bx1 - bx0, base - wallTop);
  ctx.strokeStyle = css(darken(stone, 0.5)); ctx.lineWidth = 2.5; ctx.strokeRect(bx0, wallTop, bx1 - bx0, base - wallTop);
  ctx.strokeStyle = css(darken(stone, 0.18)); ctx.lineWidth = 1;
  for (let y = wallTop + 16; y < base; y += 16) { ctx.beginPath(); ctx.moveTo(bx0, y); ctx.lineTo(bx1, y); ctx.stroke(); }
  // roof
  poly(ctx, [[bx0 - 14, wallTop + 4], [w / 2, wallTop - h * 0.28], [bx1 + 14, wallTop + 4]], vGrad(ctx, wallTop - h * 0.28, wallTop, [[0, lighten(color, 0.2)], [1, darken(color, 0.25)]]), css(darken(color, 0.5)), 3);
  ctx.fillStyle = css(emblem); ctx.fillRect(bx0 - 14, wallTop, bx1 - bx0 + 28, 5);
  // emblem medallion
  const my = wallTop - h * 0.1;
  circle(ctx, w / 2, my, 20, css(darken(color, 0.4))); circle(ctx, w / 2, my, 17, css(color));
  glyph(ctx, kind, w / 2, my, 0.95, color);
  // banners
  for (const bx of [bx0 + 14, bx1 - 34]) {
    poly(ctx, [[bx, wallTop + 10], [bx + 20, wallTop + 10], [bx + 20, wallTop + 70], [bx + 10, wallTop + 60], [bx, wallTop + 70]], css(color), css(darken(color, 0.5)), 1.5);
    ctx.fillStyle = css(emblem); ctx.fillRect(bx + 3, wallTop + 16, 14, 2);
  }
  // great door
  const dw = 52, dh = 84, dx = w / 2 - dw / 2;
  ctx.beginPath(); ctx.moveTo(dx - 6, base); ctx.lineTo(dx - 6, base - dh + dw / 2); ctx.arc(w / 2, base - dh + dw / 2, dw / 2 + 6, Math.PI, 0); ctx.lineTo(dx + dw + 6, base); ctx.closePath();
  ctx.fillStyle = css(darken(stone, 0.3)); ctx.fill();
  ctx.beginPath(); ctx.moveTo(dx, base); ctx.lineTo(dx, base - dh + dw / 2); ctx.arc(w / 2, base - dh + dw / 2, dw / 2, Math.PI, 0); ctx.lineTo(dx + dw, base); ctx.closePath();
  ctx.fillStyle = vGrad(ctx, base - dh, base, [[0, darken(color, 0.15)], [1, darken(color, 0.45)]]); ctx.fill();
  ctx.fillStyle = css(darken(color, 0.6)); ctx.fillRect(w / 2 - 1.5, base - dh + 4, 3, dh - 4);
  circle(ctx, w / 2 - 7, base - dh * 0.45, 2.5, css(emblem)); circle(ctx, w / 2 + 7, base - dh * 0.45, 2.5, css(emblem));
  glow(ctx, w / 2, base - dh - 12, 22, emblem, 0.45);
  // steps
  ctx.fillStyle = css(darken(stone, 0.15)); ctx.fillRect(dx - 16, base - 8, dw + 32, 8);
  ctx.fillStyle = css(lighten(stone, 0.1)); ctx.fillRect(dx - 16, base - 8, dw + 32, 2);
}

function paintTower(ctx: Ctx, w: number, h: number) {
  const r = rng(77);
  const stone = 0xbfb6d8, roof = 0x4a3a9a, gold = 0xffcf4a;
  const cx = w / 2, base = h;
  const tw0 = w * 0.3, tw1 = w * 0.26; // half-widths at base / top
  const top = h * 0.3;
  // body (slight taper)
  poly(ctx, [[cx - tw0, base], [cx - tw1, top], [cx + tw1, top], [cx + tw0, base]], hGrad(ctx, cx - tw0, cx + tw0, [[0, lighten(stone, 0.2)], [0.4, stone], [1, darken(stone, 0.3)]]), css(darken(stone, 0.55)), 3);
  // stone courses
  ctx.save(); ctx.beginPath(); ctx.moveTo(cx - tw0, base); ctx.lineTo(cx - tw1, top); ctx.lineTo(cx + tw1, top); ctx.lineTo(cx + tw0, base); ctx.closePath(); ctx.clip();
  for (let y = top + 18, row = 0; y < base; y += 18, row++) {
    ctx.fillStyle = css(darken(stone, 0.25), 0.5); ctx.fillRect(0, y, w, 1.5);
    for (let x = (row % 2) * 16; x < w; x += 32) ctx.fillRect(x, y - 18, 1.5, 18);
  }
  // spiral of glowing runes
  for (let i = 0; i < 14; i++) {
    const y = base - 30 - i * ((base - top - 40) / 14), x = cx + Math.sin(i * 0.9) * tw1 * 0.7;
    glow(ctx, x, y, 8, 0x9fd8ff, 0.6); circle(ctx, x, y, 1.8, css(0xe8f8ff));
  }
  ctx.restore();
  // balcony ring
  for (const y of [h * 0.7, h * (260 / 600)]) {
    roundRect(ctx, cx - tw0 - 12, y, (tw0 + 12) * 2, 12, 4); ctx.fillStyle = css(darken(stone, 0.2)); ctx.fill();
    ctx.fillStyle = css(gold); ctx.fillRect(cx - tw0 - 10, y + 2, (tw0 + 10) * 2, 3);
  }
  // windows
  for (const [y, s] of [[h * 0.33, 0.9], [h * 0.53, 1], [h * 0.76, 1]] as const) windowAt(ctx, cx - 12 * s, y, 24 * s, 36 * s, 0x3a2e6a, 0xfff0a8, true);
  // door
  const dw = 44, dh = 70;
  ctx.beginPath(); ctx.moveTo(cx - dw / 2, base); ctx.lineTo(cx - dw / 2, base - dh + dw / 2); ctx.arc(cx, base - dh + dw / 2, dw / 2, Math.PI, 0); ctx.lineTo(cx + dw / 2, base); ctx.closePath();
  ctx.fillStyle = css(0x3a2e6a); ctx.fill(); ctx.strokeStyle = css(gold); ctx.lineWidth = 3; ctx.stroke();
  star4(ctx, cx, base - dh * 0.55, 8, css(gold));
  // conical roof
  const roofBase = top + 4;
  poly(ctx, [[cx - tw1 - 26, roofBase], [cx + 8, 18], [cx + tw1 + 26, roofBase]], vGrad(ctx, 18, roofBase, [[0, lighten(roof, 0.25)], [1, darken(roof, 0.25)]]), css(darken(roof, 0.55)), 3);
  ctx.save(); ctx.beginPath(); ctx.moveTo(cx - tw1 - 26, roofBase); ctx.lineTo(cx + 8, 18); ctx.lineTo(cx + tw1 + 26, roofBase); ctx.closePath(); ctx.clip();
  for (let i = 0; i < 18; i++) star4(ctx, rr(r, cx - tw1 - 20, cx + tw1 + 20), rr(r, 40, roofBase - 6), rr(r, 2, 4), css(gold, 0.85));
  ctx.restore();
  ctx.fillStyle = css(gold); ctx.fillRect(cx - tw1 - 26, roofBase - 4, (tw1 + 26) * 2, 6);
  // orb finial
  glow(ctx, cx + 8, 12, 22, 0x9fd8ff, 0.8); circle(ctx, cx + 8, 12, 7, css(0xe8f8ff));
  ctx.fillStyle = css(gold); ctx.fillRect(cx + 6, 18, 4, 10);
}

function paintFountain(ctx: Ctx, w: number, h: number) {
  const cx = w / 2, base = h;
  // basin
  ellipse(ctx, cx, base - 18, w * 0.47, 16, css(0x8a8090));
  ctx.fillStyle = vGrad(ctx, base - 40, base, [[0, 0xd8d0e0], [1, 0x9a90a8]]);
  ctx.fillRect(cx - w * 0.47, base - 40, w * 0.94, 24);
  ellipse(ctx, cx, base - 40, w * 0.47, 14, css(0xe8e0f0));
  ellipse(ctx, cx, base - 40, w * 0.42, 10, css(0x6fc8f0));
  ellipse(ctx, cx - 20, base - 42, 20, 3, css(0xd8f4ff, 0.8));
  // pillar + upper bowl
  ctx.fillStyle = hGrad(ctx, cx - 10, cx + 10, [[0, 0xe8e0f0], [1, 0x9a90a8]]); ctx.fillRect(cx - 9, base - 92, 18, 54);
  ellipse(ctx, cx, base - 92, 34, 9, css(0xd8d0e0)); ellipse(ctx, cx, base - 94, 28, 6, css(0x6fc8f0));
  // water arcs
  ctx.strokeStyle = css(0xbfeaff, 0.85); ctx.lineWidth = 3;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 26, base - 92); ctx.quadraticCurveTo(cx + s * 52, base - 96, cx + s * 62, base - 44); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(cx, base - 100); ctx.lineTo(cx, base - 126); ctx.stroke();
  circle(ctx, cx, base - 126, 4, css(0xe8f8ff));
  ctx.fillStyle = css(0xffcf4a); ctx.fillRect(cx - w * 0.47, base - 30, w * 0.94, 3);
}

function paintLanternPost(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  ctx.fillStyle = css(0x3a3048); ctx.fillRect(cx - 3, 40, 6, h - 50);
  roundRect(ctx, cx - 10, h - 14, 20, 14, 3); ctx.fill();
  ctx.strokeStyle = css(0x3a3048); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, 44); ctx.quadraticCurveTo(cx + 18, 36, cx + 18, 26); ctx.stroke();
  glow(ctx, cx + 4, 26, 24, 0xffc860, 0.55);
  poly(ctx, [[cx - 8, 14], [cx + 16, 14], [cx + 13, 40], [cx - 5, 40]], css(0x3a3048));
  poly(ctx, [[cx - 5, 17], [cx + 13, 17], [cx + 11, 37], [cx - 3, 37]], vGrad(ctx, 17, 37, [[0, 0xfff6d0], [1, 0xffb040]]));
  poly(ctx, [[cx - 10, 15], [cx + 4, 4], [cx + 18, 15]], css(0x3a3048));
}
function paintBench(ctx: Ctx, w: number, h: number) {
  const wood = 0xb07a45;
  ctx.fillStyle = css(0x3a3048); ctx.fillRect(8, 18, 5, h - 18); ctx.fillRect(w - 13, 18, 5, h - 18);
  for (const y of [4, 18]) { roundRect(ctx, 2, y, w - 4, 8, 3); ctx.fillStyle = css(wood); ctx.fill(); ctx.strokeStyle = css(darken(wood, 0.5)); ctx.lineWidth = 1.5; ctx.stroke(); }
}
function paintCrates(ctx: Ctx, w: number, h: number) {
  const crate = (x: number, y: number, s: number) => {
    ctx.fillStyle = css(0xc08a50); ctx.fillRect(x, y, s, s); ctx.strokeStyle = css(0x5a3a20); ctx.lineWidth = 2.5; ctx.strokeRect(x, y, s, s);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y); ctx.lineTo(x, y + s); ctx.stroke();
    ctx.fillStyle = css(0xffffff, 0.2); ctx.fillRect(x + 2, y + 2, s - 4, 3);
  };
  crate(4, h - 38, 38); crate(44, h - 34, 34); crate(22, h - 64, 28);
}
function paintBarrel(ctx: Ctx, w: number, h: number) {
  roundRect(ctx, 4, 2, w - 8, h - 4, 10); ctx.fillStyle = hGrad(ctx, 4, w - 4, [[0, 0xc08a50], [0.5, 0xa06a38], [1, 0x6a4424]]); ctx.fill();
  ctx.strokeStyle = css(0x3a2414); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = css(0x5a5a68); ctx.fillRect(4, 10, w - 8, 4); ctx.fillRect(4, h - 14, w - 8, 4);
}
function paintWell(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  ctx.fillStyle = css(0x6a4a2a); ctx.fillRect(12, 30, 7, h - 60); ctx.fillRect(w - 19, 30, 7, h - 60);
  poly(ctx, [[2, 34], [cx, 4], [w - 2, 34]], css(0xb05a3a), css(0x5a2a1a), 2.5);
  ctx.fillStyle = css(0x5a3a20); ctx.fillRect(14, 50, w - 28, 4);
  ctx.strokeStyle = css(0xd8b37a); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, 54); ctx.lineTo(cx, 76); ctx.stroke();
  ctx.fillStyle = css(0x8a6a4a); ctx.fillRect(cx - 6, 76, 12, 10);
  for (let row = 0; row < 3; row++) for (let x = 6; x < w - 6; x += 20) {
    roundRect(ctx, x + (row % 2) * 10 - 4, h - 14 - row * 13, 20, 12, 3); ctx.fillStyle = css(row % 2 ? 0xa098a8 : 0x8f879a); ctx.fill();
    ctx.strokeStyle = css(0x5a5068); ctx.lineWidth = 1; ctx.stroke();
  }
}
function paintBunting(ctx: Ctx, w: number, h: number) {
  ctx.strokeStyle = css(0x6a4a3a); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(w / 2, 40, w, 6); ctx.stroke();
  const cols = [0xff6a6a, 0xffd860, 0x6ad0ff, 0x8ae070, 0xd890ff];
  for (let i = 1; i < 14; i++) {
    const t = i / 14, x = t * w, y = 6 + (1 - (2 * t - 1) ** 2) * 17;
    poly(ctx, [[x - 8, y], [x + 8, y], [x, y + 20]], css(cols[i % cols.length]), css(0x4a3a3a, 0.6), 1);
  }
}
function paintGate(ctx: Ctx, w: number, h: number) {
  const stone = 0xd8cfc0;
  for (const x of [10, w - 46]) {
    ctx.fillStyle = hGrad(ctx, x, x + 36, [[0, lighten(stone, 0.1)], [1, darken(stone, 0.25)]]); ctx.fillRect(x, 70, 36, h - 70);
    ctx.strokeStyle = css(darken(stone, 0.5)); ctx.lineWidth = 2; ctx.strokeRect(x, 70, 36, h - 70);
    roundRect(ctx, x - 6, 60, 48, 14, 3); ctx.fillStyle = css(darken(stone, 0.1)); ctx.fill();
    glow(ctx, x + 18, 46, 18, 0xffc860, 0.6); circle(ctx, x + 18, 46, 6, css(0xfff0b0));
  }
  ctx.strokeStyle = css(0x6a4a2a); ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(28, 92); ctx.quadraticCurveTo(w / 2, 20, w - 28, 92); ctx.stroke();
  ctx.strokeStyle = css(0xa0703e); ctx.lineWidth = 7; ctx.stroke();
  // vines on the arch
  for (let i = 0; i < 14; i++) {
    const t = i / 13, x = 28 + t * (w - 56), y = 92 - (1 - (2 * t - 1) ** 2) * 36;
    ellipse(ctx, x, y + 6, 7, 4, css(i % 2 ? 0x5bb83c : 0x7ad050));
    if (i % 3 === 0) circle(ctx, x + 3, y + 10, 3, css(0xff8fb5));
  }
}

function paintShopSign(ctx: Ctx, w: number, h: number, label: string, kind: string, color: number) {
  const cx = w / 2;
  // post + arm
  ctx.fillStyle = css(0x4a3324); ctx.fillRect(cx - 4, 20, 8, h - 20);
  ctx.fillRect(cx - 34, 16, 68, 6);
  roundRect(ctx, cx - 12, h - 10, 24, 10, 3); ctx.fill();
  // chains
  ctx.strokeStyle = css(0x8a8a98); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx - 26, 22); ctx.lineTo(cx - 26, 30); ctx.moveTo(cx + 26, 22); ctx.lineTo(cx + 26, 30); ctx.stroke();
  // board
  roundRect(ctx, cx - 36, 30, 72, 58, 8); ctx.fillStyle = css(darken(color, 0.5)); ctx.fill();
  roundRect(ctx, cx - 33, 33, 66, 52, 6); ctx.fillStyle = vGrad(ctx, 33, 85, [[0, lighten(color, 0.25)], [1, darken(color, 0.15)]]); ctx.fill();
  roundRect(ctx, cx - 28, 37, 56, 32, 5); ctx.fillStyle = css(0xfff6e0, 0.92); ctx.fill();
  glyph(ctx, kind, cx, 53, 0.95, color);
  ctx.fillStyle = css(0xfff6e0); ctx.font = `bold ${label.length > 6 ? 9 : 11}px "Trebuchet MS", Verdana, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, 77);
}

