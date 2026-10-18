// Shadow owns its palette and derived sheets; never mutate PX_SHEETS or the shared ramps.
import Phaser from 'phaser';
import { PX_SHEETS, pixelizeCanvas } from '../../art/particles';

export const C = {
  ink: 0x120d1a, dark: 0x2e2440, violet: 0x6a3fc2, lilac: 0xb48cff,
  green: 0x9dce69, pale: 0xdde6ba,
} as const;
export const SHADOW_RAMP = [C.ink, C.dark, C.violet, C.lilac, C.green, C.pale] as const;
export const ST = {
  mote: 'shd_tex_mote', ring: 'shd_tex_ring', bolt: 'shd_tex_bolt', cloud: 'shd_tex_cloud',
  slash: 'shd_tex_slash', scythe: 'shd_tex_scythe', skull: 'shd_tex_skull',
  skeleton: 'shd_tex_skeleton', lich: 'shd_tex_lich',
  bone: 'shd_tex_bone', shackle: 'shd_tex_shackle', wraith: 'shd_tex_wraith',
  dragon: 'shd_tex_dragon', scale: 'shd_tex_scale',
} as const;

/** Source IDs from the existing CC0 manifest; every derived texture/animation is shd_-prefixed. */
export const SHEETS = [
  'sf_ring', 'sf_heal', 'sf_slash', 'g9_spark', 'g9_darkbolt', 'ss_fireball', 'ss_icespear',
  'cm_shield', 'cm_nebula', 'cm_vortex', 'cm_midnight',
] as const;
export type ShadowSheet = typeof SHEETS[number];
export const sheetTexture = (id: ShadowSheet) => `shd_sheet_${id}`;
export const sheetAnimation = (id: ShadowSheet) => `shd_anim_${id}`;

type Rect = [number, number, number, number];
type Paint = (ctx: CanvasRenderingContext2D) => void;
const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function canvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/** Same luminance-rank mapping as the kit (its recolorCanvas helper is private). */
function recolor(c: HTMLCanvasElement): void {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const im = ctx.getImageData(0, 0, c.width, c.height), d = im.data;
  const luminance = (i: number) => Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
  const histogram = new Array<number>(256).fill(0);
  let total = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 8) { histogram[luminance(i)]++; total++; }
  if (!total) return;
  const map = new Array<number>(256).fill(C.ink);
  let below = 0;
  histogram.forEach((n, l) => {
    if (!n) return;
    map[l] = SHADOW_RAMP[Math.min(SHADOW_RAMP.length - 1, Math.floor((below + n / 2) / total * SHADOW_RAMP.length))];
    below += n;
  });
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const col = map[luminance(i)];
    d[i] = col >> 16 & 255; d[i + 1] = col >> 8 & 255; d[i + 2] = col & 255;
  }
  ctx.putImageData(im, 0, 0);
}

function buildSheet(scene: Phaser.Scene, id: ShadowSheet): void {
  const def = PX_SHEETS[id];
  if (!def) return;
  const key = sheetTexture(id), anim = sheetAnimation(id);
  const rects: Rect[] = def.rects ?? Array.from({ length: def.n ?? 1 }, (_, i) =>
    [i * (def.fw ?? 16), 0, def.fw ?? 16, def.fh ?? 16]);
  if (!scene.textures.exists(key)) {
    const sourceKey = `src_vfx_${def.src}`;
    if (!scene.textures.exists(sourceKey)) return;
    const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    if (!source?.width || !source.height) return;
    // Reject incomplete source strips instead of producing invalid frame rectangles.
    if (rects.some(([x, y, w, h]) => x + w > source.width || y + h > source.height)) return;
    const c = canvas(source.width, source.height), ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(source, 0, 0);
    recolor(c); pixelizeCanvas(c, 1, { steps: 4 });
    const texture = scene.textures.addCanvas(key, c);
    if (!texture) return;
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    rects.forEach(([x, y, w, h], i) => texture.add(i, 0, x, y, w, h));
  }
  if (!scene.anims.exists(anim)) scene.anims.create({
    key: anim, frames: rects.map((_, frame) => ({ key, frame })), frameRate: def.fps, repeat: 0,
  });
}

/** All fallback art is painted at 1× on an integer grid, displayed at 2× nearest. */
function make(scene: Phaser.Scene, key: string, w: number, h: number, paint: Paint): void {
  if (scene.textures.exists(key)) return;
  const c = canvas(w, h), ctx = c?.getContext('2d');
  if (!c || !ctx) return;
  ctx.imageSmoothingEnabled = false;
  paint(ctx); pixelizeCanvas(c, 1, { hard: true });
  scene.textures.addCanvas(key, c)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function skull(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = css(C.ink); ctx.fillRect(x + 1, y, 10, 9); ctx.fillRect(x + 3, y + 8, 6, 4);
  ctx.fillStyle = css(C.pale); ctx.fillRect(x + 2, y + 1, 8, 7); ctx.fillRect(x + 4, y + 8, 4, 3);
  ctx.fillStyle = css(C.dark); ctx.fillRect(x + 3, y + 4, 2, 2); ctx.fillRect(x + 7, y + 4, 2, 2);
  ctx.fillStyle = css(C.green); ctx.fillRect(x + 4, y + 4, 1, 1); ctx.fillRect(x + 8, y + 4, 1, 1);
  ctx.fillStyle = css(C.ink); ctx.fillRect(x + 5, y + 7, 2, 1); ctx.fillRect(x + 5, y + 9, 1, 2);
}

export function generateShadowTextures(scene: Phaser.Scene): void {
  // Each source is independent; one missing/corrupt sheet does not prevent the others or fallbacks.
  for (const id of SHEETS) {
    try { buildSheet(scene, id); } catch { /* Every effect has hard-edged fallback art below. */ }
  }
  make(scene, ST.mote, 2, 2, ctx => { ctx.fillStyle = css(C.green); ctx.fillRect(0, 0, 2, 2); });
  make(scene, ST.ring, 32, 16, ctx => {
    ctx.strokeStyle = css(C.lilac); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(16, 8, 14, 6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = css(C.green);
    for (const [x, y] of [[15, 0], [15, 13], [0, 7], [29, 7]]) ctx.fillRect(x, y, 2, 2);
  });
  make(scene, ST.bolt, 32, 12, ctx => {
    ctx.fillStyle = css(C.ink); ctx.fillRect(1, 4, 26, 4); ctx.fillRect(21, 1, 8, 10); ctx.fillRect(29, 4, 3, 4);
    ctx.fillStyle = css(C.violet); ctx.fillRect(4, 5, 24, 2); ctx.fillRect(22, 2, 6, 8);
    ctx.fillStyle = css(C.lilac); ctx.fillRect(12, 5, 16, 2);
    ctx.fillStyle = css(C.green); ctx.fillRect(25, 3, 4, 6); ctx.fillRect(29, 5, 2, 2);
  });
  make(scene, ST.cloud, 48, 32, ctx => {
    for (const [x, y, w, h, color] of [
      [4, 12, 40, 14, C.ink], [8, 7, 30, 21, C.dark], [14, 4, 16, 25, C.dark],
      [8, 14, 32, 10, C.violet], [14, 9, 18, 12, C.violet], [18, 13, 10, 6, C.green],
    ]) { ctx.fillStyle = css(color); ctx.fillRect(x, y, w, h); }
  });
  make(scene, ST.slash, 64, 32, ctx => {
    ctx.fillStyle = css(C.violet);
    ctx.beginPath(); ctx.moveTo(1, 29); ctx.lineTo(16, 9); ctx.lineTo(40, 1); ctx.lineTo(63, 8);
    ctx.lineTo(43, 6); ctx.lineTo(20, 15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = css(C.green); ctx.fillRect(32, 3, 18, 2); ctx.fillRect(22, 6, 10, 2);
  });
  make(scene, ST.scythe, 56, 32, ctx => {
    // Long shaft and crescent blade: the blade/head is on +x at rotation zero.
    ctx.fillStyle = css(C.ink); ctx.fillRect(2, 14, 45, 5);
    ctx.beginPath(); ctx.moveTo(35, 2); ctx.lineTo(49, 3); ctx.lineTo(55, 10); ctx.lineTo(53, 22);
    ctx.lineTo(40, 30); ctx.lineTo(46, 19); ctx.lineTo(47, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = css(C.violet); ctx.fillRect(3, 15, 44, 3);
    ctx.fillStyle = css(C.lilac);
    ctx.beginPath(); ctx.moveTo(36, 3); ctx.lineTo(48, 4); ctx.lineTo(53, 11); ctx.lineTo(51, 21);
    ctx.lineTo(43, 27); ctx.lineTo(48, 18); ctx.lineTo(49, 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = css(C.green); ctx.fillRect(47, 5, 3, 3); ctx.fillRect(51, 11, 2, 7);
    ctx.fillStyle = css(C.pale); ctx.fillRect(15, 15, 3, 2); ctx.fillRect(24, 15, 3, 2); ctx.fillRect(33, 15, 3, 2);
  });
  make(scene, ST.skull, 12, 12, ctx => skull(ctx, 0, 0));
  make(scene, ST.bone, 16, 8, ctx => {
    ctx.fillStyle = css(C.ink); ctx.fillRect(1, 1, 4, 6); ctx.fillRect(4, 2, 8, 4); ctx.fillRect(11, 1, 4, 6);
    ctx.fillStyle = css(C.pale); ctx.fillRect(2, 2, 2, 4); ctx.fillRect(4, 3, 8, 2); ctx.fillRect(12, 2, 2, 4);
    ctx.fillStyle = css(C.green); ctx.fillRect(5, 3, 2, 1);
  });
  make(scene, ST.shackle, 16, 16, ctx => {
    ctx.fillStyle = css(C.ink); ctx.fillRect(2, 2, 12, 12);
    ctx.fillStyle = css(C.lilac); ctx.fillRect(3, 3, 10, 10);
    ctx.clearRect(5, 5, 6, 6);
    ctx.fillStyle = css(C.pale); ctx.fillRect(3, 3, 7, 1); ctx.fillRect(3, 4, 1, 5);
    ctx.fillStyle = css(C.green); ctx.fillRect(11, 11, 4, 3);
  });
  make(scene, ST.scale, 16, 20, ctx => {
    ctx.fillStyle = css(C.ink); ctx.fillRect(2, 1, 12, 13); ctx.fillRect(5, 14, 6, 5);
    ctx.fillStyle = css(C.pale); ctx.fillRect(3, 2, 10, 11); ctx.fillRect(6, 13, 4, 4);
    ctx.fillStyle = css(C.violet); ctx.fillRect(5, 4, 6, 7);
    ctx.fillStyle = css(C.green); ctx.fillRect(7, 5, 2, 5);
  });
  make(scene, ST.wraith, 30, 36, ctx => {
    ctx.fillStyle = css(C.ink);
    ctx.beginPath(); ctx.moveTo(9, 1); ctx.lineTo(21, 1); ctx.lineTo(26, 14); ctx.lineTo(29, 32);
    ctx.lineTo(21, 28); ctx.lineTo(18, 36); ctx.lineTo(12, 30); ctx.lineTo(5, 34); ctx.lineTo(1, 28); ctx.lineTo(5, 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = css(C.dark); ctx.fillRect(8, 10, 14, 17);
    ctx.fillStyle = css(C.violet); ctx.fillRect(7, 18, 4, 10); ctx.fillRect(20, 16, 4, 11); ctx.fillRect(13, 25, 4, 7);
    skull(ctx, 9, 4);
    ctx.fillStyle = css(C.green); ctx.fillRect(13, 19, 4, 2); ctx.fillRect(14, 22, 2, 2);
  });
  make(scene, ST.dragon, 100, 66, ctx => {
    // Right-facing skull, ribs, articulated tail and two torn bone wings at native 1×.
    ctx.fillStyle = css(C.ink);
    ctx.beginPath(); ctx.moveTo(37, 32); ctx.lineTo(12, 1); ctx.lineTo(40, 10); ctx.lineTo(53, 30);
    ctx.lineTo(62, 3); ctx.lineTo(81, 10); ctx.lineTo(64, 35); ctx.closePath(); ctx.fill();
    ctx.fillStyle = css(C.dark);
    ctx.beginPath(); ctx.moveTo(36, 29); ctx.lineTo(17, 5); ctx.lineTo(39, 13); ctx.lineTo(50, 31);
    ctx.lineTo(63, 7); ctx.lineTo(76, 12); ctx.lineTo(62, 33); ctx.closePath(); ctx.fill();
    ctx.fillStyle = css(C.ink); ctx.fillRect(29, 29, 43, 19); ctx.fillRect(67, 20, 17, 19); ctx.fillRect(78, 24, 20, 14);
    ctx.fillRect(84, 36, 12, 6); ctx.fillRect(6, 45, 26, 5); ctx.fillRect(1, 41, 10, 4);
    ctx.fillStyle = css(C.pale); ctx.fillRect(30, 31, 44, 3); ctx.fillRect(69, 22, 13, 15); ctx.fillRect(81, 26, 15, 10);
    ctx.fillRect(86, 38, 8, 2); ctx.fillRect(7, 46, 23, 2); ctx.fillRect(2, 42, 5, 2);
    for (let i = 0; i < 5; i++) {
      const x = 33 + i * 7;
      ctx.fillRect(x, 35, 2, 9); ctx.fillRect(x + 2, 43, 4, 2);
    }
    ctx.fillRect(36, 47, 3, 12); ctx.fillRect(34, 58, 9, 3); ctx.fillRect(61, 47, 3, 12); ctx.fillRect(60, 58, 9, 3);
    ctx.fillRect(26, 15, 2, 9); ctx.fillRect(31, 20, 2, 9); ctx.fillRect(64, 12, 2, 14);
    ctx.fillStyle = css(C.violet); ctx.fillRect(35, 33, 30, 2); ctx.fillRect(12, 47, 11, 1);
    ctx.fillStyle = css(C.ink); ctx.fillRect(76, 26, 6, 5); ctx.fillRect(91, 31, 3, 2);
    ctx.fillStyle = css(C.green); ctx.fillRect(78, 27, 3, 2);
    ctx.fillStyle = css(C.pale); ctx.fillRect(70, 16, 2, 6); ctx.fillRect(77, 15, 2, 7);
    for (const x of [85, 89, 93]) ctx.fillRect(x, 35, 1, 4);
  });
  make(scene, ST.skeleton, 32, 36, ctx => {
    skull(ctx, 9, 0);
    ctx.fillStyle = css(C.ink); ctx.fillRect(9, 12, 12, 13); ctx.fillRect(10, 24, 4, 11); ctx.fillRect(17, 24, 4, 11);
    ctx.fillRect(3, 13, 6, 13); ctx.fillRect(21, 13, 6, 10);
    ctx.fillStyle = css(C.pale); ctx.fillRect(14, 12, 2, 13);
    for (const y of [13, 17, 21]) ctx.fillRect(10, y, 10, 2);
    ctx.fillRect(11, 25, 2, 9); ctx.fillRect(18, 25, 2, 9);
    ctx.fillRect(4, 14, 2, 11); ctx.fillRect(22, 14, 2, 7); ctx.fillRect(24, 19, 6, 2);
    ctx.fillStyle = css(C.violet); ctx.fillRect(8, 33, 6, 3); ctx.fillRect(17, 33, 6, 3);
    ctx.fillStyle = css(C.ink); ctx.fillRect(28, 8, 4, 18);
    ctx.fillStyle = css(C.green); ctx.fillRect(29, 9, 2, 13);
  });
  make(scene, ST.lich, 48, 60, ctx => {
    ctx.fillStyle = css(C.ink);
    ctx.beginPath(); ctx.moveTo(17, 2); ctx.lineTo(32, 2); ctx.lineTo(37, 20); ctx.lineTo(43, 52);
    ctx.lineTo(35, 47); ctx.lineTo(31, 59); ctx.lineTo(24, 51); ctx.lineTo(16, 58);
    ctx.lineTo(12, 48); ctx.lineTo(5, 53); ctx.lineTo(12, 19); ctx.closePath(); ctx.fill();
    ctx.fillStyle = css(C.dark); ctx.fillRect(13, 20, 23, 24); ctx.fillRect(17, 5, 15, 19);
    ctx.fillStyle = css(C.violet); ctx.fillRect(14, 23, 5, 23); ctx.fillRect(30, 23, 5, 23);
    ctx.fillRect(18, 40, 4, 12); ctx.fillRect(27, 40, 4, 12);
    skull(ctx, 19, 11);
    ctx.fillStyle = css(C.green); ctx.fillRect(18, 4, 2, 6); ctx.fillRect(23, 1, 2, 7); ctx.fillRect(28, 4, 2, 6);
    ctx.fillRect(21, 25, 7, 2); ctx.fillRect(23, 28, 3, 3);
    ctx.fillStyle = css(C.pale); ctx.fillRect(34, 29, 6, 2);
    ctx.fillStyle = css(C.violet); ctx.fillRect(42, 16, 2, 36);
    ctx.fillStyle = css(C.green); ctx.fillRect(40, 12, 6, 6);
  });
}
