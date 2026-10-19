// Draws a whole map from its MapDef onto a canvas, at half world scale (one source pixel of the 2× pixel art =
// one canvas pixel), with the game's own PNGs: the theme's parallax layers (src/art/manifests/world.ts PIXEL_BG),
// the terrain kit (world/terrain/<theme>.png, same atlas layout as src/art/world/pixel.ts), the hand-placed set
// dressing from src/world/mapExtras.ts, ropes, ladders, portals, the NPCs and every spawn's monsters.

import type { MapDef } from '../core/types';
import { GAME_HEIGHT, PIXEL_SCALE } from '../core/constants';
import { PIXEL_BG } from '../art/manifests/world';
import { PALETTES } from '../art/world/palettes';
import { MAP_EXTRAS } from '../world/mapExtras';
import { Registry } from '../core/registry';
import { assetImage, monsterFrame, npcCanvasUrl, loadImage } from './art';

/** Canvas pixels per world pixel. */
export const MAP_SCALE = 0.5;
/** Source px → canvas px for the 2×-baked pixel art (= 1). */
const K = PIXEL_SCALE * MAP_SCALE;

/** Terrain kit atlas (source px) — mirrors KIT in src/art/world/pixel.ts. */
const KIT = {
  lip: [0, 0, 128, 24], soil: [0, 24, 128, 128],
  plat: [0, 152, 64, 28], platL: [64, 152, 16, 28], platR: [80, 152, 16, 28],
  ladder: [96, 152, 16, 16], rope: [112, 152, 8, 16], wall: [0, 180, 64, 64],
} as const;
const LIP_SURFACE = 8, PLAT_SURFACE = 4, CAP_OVERHANG = 3;

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function mapCanvasSize(def: MapDef) {
  return { w: Math.round(def.width * MAP_SCALE), h: Math.round(def.height * MAP_SCALE) };
}

/** Highest solid surface under x (as MapLoader.groundYAt). */
function groundYAt(def: MapDef, x: number): number {
  let y = Infinity;
  for (const p of def.platforms) if (!p.oneWay && x >= p.x1 && x <= p.x2 && p.y < y) y = p.y;
  for (const w of def.walls ?? []) if (x >= w.x && x <= w.x + w.w && w.y < y) y = w.y;
  return Number.isFinite(y) ? y : def.height - 120;
}

function sub(img: CanvasImageSource, [sx, sy, sw, shh]: readonly number[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sw; c.height = shh;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.drawImage(img, sx, sy, sw, shh, 0, 0, sw, shh);
  return c;
}

function tileRect(ctx: CanvasRenderingContext2D, tile: HTMLCanvasElement, x: number, y: number, w: number, hh: number, ox = x, oy = y) {
  const pat = ctx.createPattern(tile, 'repeat');
  if (!pat) return;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = pat;
  ctx.fillRect(x - ox, y - oy, w, hh);
  ctx.restore();
}

async function drawBackdrop(ctx: CanvasRenderingContext2D, def: MapDef) {
  const W = def.width * MAP_SCALE, H = def.height * MAP_SCALE;
  const pal = PALETTES[def.theme];
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, css(pal.skyTop)); g.addColorStop(0.55, css(pal.skyMid)); g.addColorStop(1, css(pal.skyBottom));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (const l of PIXEL_BG[def.theme] ?? []) {
    const img = await assetImage(`world/bg/${def.theme}_${l.name}.png`);
    if (!img) continue;
    const k = l.k * MAP_SCALE;
    const lw = l.w * k, lh = l.h * k;
    // With the camera at the bottom of the map, screen y = world y − (height − screen height).
    const bottom = l.y === 'top' ? lh : (def.height - GAME_HEIGHT + l.y) * MAP_SCALE;
    const top = bottom - lh;
    ctx.save();
    ctx.globalAlpha = l.alpha ?? 1;
    if (l.top !== undefined && top > 0) { ctx.fillStyle = css(l.top); ctx.fillRect(0, 0, W, top); }
    for (let x = 0; x < W; x += lw) ctx.drawImage(img, 0, 0, l.w, l.h, x, top, lw, lh);
    if (l.bottom !== undefined && bottom < H) { ctx.fillStyle = css(l.bottom); ctx.fillRect(0, bottom, W, H - bottom); }
    ctx.restore();
  }
}

/** Lava falls and waterfalls behind the terrain (MAP_EXTRAS falls, as MapLoader.buildFalls). */
async function drawFalls(ctx: CanvasRenderingContext2D, def: MapDef) {
  for (const f of MAP_EXTRAS[def.id]?.falls ?? []) {
    const img = await assetImage(`world/fx/${f.kind === 'lava' ? 'w_lavafall' : 'w_waterfall'}.png`);
    if (!img) continue;
    const w = img.naturalWidth * K, x = Math.round(f.x * MAP_SCALE - w / 2), y = f.top * MAP_SCALE;
    const hh = Math.max(8, (f.bottom - f.top) * MAP_SCALE);
    const tile = sub(img, [0, 0, img.naturalWidth, img.naturalHeight]);
    ctx.save();
    ctx.globalAlpha = f.kind === 'lava' ? 0.8 : 0.7;
    if (f.kind === 'lava') ctx.globalCompositeOperation = 'lighter';
    tileRect(ctx, tile, x, y, w, hh, x, y);
    ctx.restore();
  }
}

async function drawDecor(ctx: CanvasRenderingContext2D, def: MapDef, layers: string[]) {
  for (const d of MAP_EXTRAS[def.id]?.decor ?? []) {
    if (!layers.includes(d.layer ?? 'back')) continue;
    const dir = d.key.startsWith('t_') ? 'town' : 'decor';
    const img = await assetImage(`world/${dir}/${d.key}.png`);
    if (!img) continue;
    const hanging = d.key === 'd_vine' || d.key === 'd_icicles';
    const y = (d.y ?? groundYAt(def, d.x)) + (hanging ? 0 : (d.layer === 'front' ? 6 : 4));
    const w = img.naturalWidth * K, hh = img.naturalHeight * K;
    const x = Math.round(d.x * MAP_SCALE - w / 2), top = Math.round(y * MAP_SCALE - (hanging ? 0 : hh));
    ctx.save();
    if (d.alpha !== undefined) ctx.globalAlpha = d.alpha;
    if (d.flip) { ctx.translate(x * 2 + w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img, x, top, w, hh);
    ctx.restore();
  }
}

async function drawTerrain(ctx: CanvasRenderingContext2D, def: MapDef) {
  const kit = await assetImage(`world/terrain/${def.theme}.png`);
  const pal = PALETTES[def.theme];
  const S = MAP_SCALE;
  const lip = kit && sub(kit, KIT.lip), soil = kit && sub(kit, KIT.soil), wall = kit && sub(kit, KIT.wall);
  const plat = kit && sub(kit, KIT.plat), platL = kit && sub(kit, KIT.platL), platR = kit && sub(kit, KIT.platR);
  const H = def.height * S;
  // solid ground: soil down to the bottom, lip on top
  for (const p of def.platforms.filter(q => !q.oneWay)) {
    const x = p.x1 * S, w = (p.x2 - p.x1) * S, y = p.y * S;
    if (soil) tileRect(ctx, soil, x, y, w, H - y, 0, y); else { ctx.fillStyle = css(pal.soil); ctx.fillRect(x, y, w, H - y); }
    if (lip) tileRect(ctx, lip, x, y - LIP_SURFACE * K, w, KIT.lip[3] * K, 0, y - LIP_SURFACE * K);
    else { ctx.fillStyle = css(pal.lip); ctx.fillRect(x, y - 4, w, 8); }
  }
  // walls (raised ground): wall texture with a lip on top
  for (const wd of def.walls ?? []) {
    const x = wd.x * S, y = wd.y * S, w = wd.w * S, hh = wd.h * S;
    if (wall) tileRect(ctx, wall, x, y, w, hh, x, y); else { ctx.fillStyle = css(pal.wall); ctx.fillRect(x, y, w, hh); }
    if (lip) tileRect(ctx, lip, x, y - LIP_SURFACE * K, w, KIT.lip[3] * K, x, y - LIP_SURFACE * K);
  }
  // one-way platforms
  for (const p of def.platforms.filter(q => q.oneWay)) {
    const y = (p.y - PLAT_SURFACE * PIXEL_SCALE) * S;
    const x1 = p.x1 * S, x2 = p.x2 * S;
    if (plat && platL && platR) {
      const capW = KIT.platL[2] * K, ov = CAP_OVERHANG * K;
      tileRect(ctx, plat, x1 - ov + capW, y, Math.max(0, x2 - x1 + 2 * ov - 2 * capW), KIT.plat[3] * K, x1, y);
      ctx.drawImage(platL, x1 - ov, y, capW, KIT.platL[3] * K);
      ctx.drawImage(platR, x2 + ov - capW, y, capW, KIT.platR[3] * K);
    } else {
      ctx.fillStyle = css(pal.body); ctx.fillRect(x1, p.y * S, x2 - x1, 10);
      ctx.fillStyle = css(pal.lip); ctx.fillRect(x1, p.y * S - 3, x2 - x1, 4);
    }
  }
  // ropes and ladders
  const rope = kit && sub(kit, KIT.rope), ladder = kit && sub(kit, KIT.ladder);
  for (const r of def.ropes) {
    const t = r.kind === 'ladder' ? ladder : rope;
    const w = (r.kind === 'ladder' ? KIT.ladder[2] : KIT.rope[2]) * K;
    const x = r.x * S - w / 2, y = r.top * S, hh = (r.bottom - r.top) * S;
    if (t) tileRect(ctx, t, x, y, w, hh, x, y);
    else { ctx.fillStyle = '#c9a26b'; ctx.fillRect(r.x * S - 1, y, 3, hh); }
  }
}

async function drawPortals(ctx: CanvasRenderingContext2D, def: MapDef) {
  const img = await assetImage('world/fx/w_portal_px.png');
  for (const p of def.portals) {
    if (p.hidden) continue;
    const fw = 36, fh = Math.min(60, img?.naturalHeight ?? 60);
    const x = p.x * MAP_SCALE, y = p.y * MAP_SCALE;
    if (img) ctx.drawImage(img, 0, 0, fw, fh, Math.round(x - (fw * K) / 2), Math.round(y - fh * K), fw * K, fh * K);
    else {
      ctx.fillStyle = 'rgba(160,140,255,0.7)';
      ctx.beginPath(); ctx.ellipse(x, y - 30, 14, 30, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

async function drawNpcs(ctx: CanvasRenderingContext2D, def: MapDef) {
  for (const n of def.npcs) {
    const url = npcCanvasUrl(n.npcId, 1);
    const img = url ? await loadImage(url) : null;
    if (!img) continue;
    const w = img.naturalWidth * MAP_SCALE, hh = img.naturalHeight * MAP_SCALE;
    const x = n.x * MAP_SCALE, y = n.y * MAP_SCALE + 1;
    ctx.save();
    if ((n.facing ?? 1) < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - hh), w, hh);
    ctx.restore();
  }
}

function drawSpawns(ctx: CanvasRenderingContext2D, def: MapDef) {
  for (const s of def.spawns) {
    const m = Registry.monster(s.monsterId);
    const f = monsterFrame(s.monsterId);
    if (!f || !m) continue;
    const n = Math.max(1, s.count);
    const boss = !!m.boss;
    for (let i = 0; i < n; i++) {
      const wx = n === 1 ? (s.x1 + s.x2) / 2 : s.x1 + ((s.x2 - s.x1) * (i + 0.5)) / n;
      // Pixel sheets are baked at world scale; flyers hover a little above their spawn line.
      const lift = m.behavior === 'flyer' ? 30 : 0;
      const x = wx * MAP_SCALE, y = (s.y - lift) * MAP_SCALE;
      const w = f.width * MAP_SCALE, hh = f.height * MAP_SCALE;
      if (boss) {
        ctx.save();
        ctx.shadowColor = 'rgba(255,60,60,0.95)';
        ctx.shadowBlur = 10;
        ctx.drawImage(f, Math.round(x - w / 2), Math.round(y - hh), w, hh);
        ctx.restore();
      } else {
        ctx.save();
        if (i % 2) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
        ctx.drawImage(f, Math.round(x - w / 2), Math.round(y - hh), w, hh);
        ctx.restore();
      }
    }
  }
}

/** Paints the whole map onto `canvas` (sized by mapCanvasSize). */
export async function renderMap(def: MapDef, canvas: HTMLCanvasElement): Promise<void> {
  // Paint offscreen, then show the finished picture in one go.
  const off = document.createElement('canvas');
  off.width = canvas.width; off.height = canvas.height;
  const ctx = off.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  // Fetch every PNG this map needs in parallel; the draws below then hit the cache.
  await Promise.all([
    ...(PIXEL_BG[def.theme] ?? []).map(l => assetImage(`world/bg/${def.theme}_${l.name}.png`)),
    ...(MAP_EXTRAS[def.id]?.decor ?? []).map(d => assetImage(`world/${d.key.startsWith('t_') ? 'town' : 'decor'}/${d.key}.png`)),
    ...(MAP_EXTRAS[def.id]?.falls ?? []).map(f => assetImage(`world/fx/${f.kind === 'lava' ? 'w_lavafall' : 'w_waterfall'}.png`)),
    assetImage(`world/terrain/${def.theme}.png`), assetImage('world/fx/w_portal_px.png'),
  ]);
  await drawBackdrop(ctx, def);
  await drawFalls(ctx, def);
  await drawDecor(ctx, def, ['far', 'back']);
  await drawTerrain(ctx, def);
  await drawDecor(ctx, def, ['mid']);
  await drawPortals(ctx, def);
  await drawNpcs(ctx, def);
  drawSpawns(ctx, def);
  await drawDecor(ctx, def, ['front']);
  canvas.getContext('2d')?.drawImage(off, 0, 0);
}
