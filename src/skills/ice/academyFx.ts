/** Academy additions: hand-pixelled silhouettes at 1x, displayed at exactly 2x.
 * CC0 sheet accents are optional; the hard-edged art always provides a fallback.
 * No projectile root scaling, no unowned loops, and no full-screen particle emitters.
 */
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import { pxFx } from '../../art/particles';
import type { VfxFn, VfxOptions } from '../../core/types';
import { bindLife } from './fx';

const DARK = 0x163b68, BLUE = 0x437db8, CYAN = 0x80d2ec, PALE = 0xd2f2fa, WHITE = 0xf7fcff;
type Group = Phaser.GameObjects.Container;
type Pixels = Phaser.GameObjects.Graphics;

function group(scene: Phaser.Scene, o: VfxOptions): Group {
  return scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
}

function pixels(scene: Phaser.Scene, owner: Group, x = 0, y = 0): Pixels {
  const g = scene.add.graphics({ x, y }).setScale(2);
  owner.add(g);
  return g;
}

/** All drawing uses whole source pixels; only translation/alpha animate. */
function rect(g: Pixels, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha).fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function diamond(g: Pixels, x: number, y: number, r: number, color = CYAN): void {
  for (let row = -r; row <= r; row++) {
    const half = r - Math.abs(row);
    rect(g, x - half, y + row, half * 2 + 1, 1, DARK);
    if (half > 0) rect(g, x - half + 1, y + row, half * 2 - 1, 1, color);
    if (row > -r + 1 && row < r - 1) rect(g, x, y + row, 1, 1, WHITE);
  }
}

function snow(g: Pixels, x: number, y: number, r: number): void {
  rect(g, x - r, y, r * 2 + 1, 1, PALE);
  rect(g, x, y - r, 1, r * 2 + 1, PALE);
  for (let i = -r + 1; i < r; i++) {
    rect(g, x + i, y + i, 1, 1, CYAN);
    rect(g, x - i, y + i, 1, 1, CYAN);
  }
  rect(g, x, y, 1, 1, WHITE);
}

function tween(scene: Phaser.Scene, owner: Group, target: Phaser.GameObjects.GameObject,
  cfg: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>): void {
  const tw = scene.tweens.add({ ...cfg, targets: target });
  bindLife(owner, () => tw.stop());
}

function finish(scene: Phaser.Scene, owner: Group, hold = 180, fade = 220): void {
  tween(scene, owner, owner, { alpha: 0, delay: hold, duration: fade, onComplete: () => owner.destroy() });
}

/** Sheet sprites are children, so early destruction takes their animations with them. */
function sheet(scene: Phaser.Scene, owner: Group, id: string, x: number, y: number,
  opts: { loop?: boolean; scale?: number; ice?: boolean; duration?: number } = {}): void {
  const s = pxFx(scene, id, x, y, {
    scale: opts.scale ?? 2, v: opts.ice ? 'ice' : undefined, loop: opts.loop,
    dur: opts.duration, alpha: 0.75,
  });
  if (s) owner.add(s);
}

export const rimeRayBeam: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  const length = Math.round(Math.abs((o.targetX ?? o.x + o.facing * 460) - o.x) / 2);
  c.setScale(o.facing, 1);
  rect(g, 0, -7, length, 14, DARK, 0.65);
  rect(g, 0, -4, length, 2, BLUE);
  rect(g, 0, 3, length, 2, BLUE);
  rect(g, 0, -1, length, 2, WHITE);
  for (let x = 12; x < length; x += 26) {
    diamond(g, x, 0, 5);
    rect(g, x - 7, -9, 12, 1, CYAN);
    rect(g, x + 2, 8, 12, 1, CYAN);
  }
  sheet(scene, c, 'sf_shards', length * 2, 0, { duration: 280 });
  finish(scene, c, 120, 220);
};

export const crystalWallArea: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  const w = Math.round((o.w ?? 240) / 2), base = 14; // cast/area center -> feet is about 28px
  rect(g, -w / 2, base - 3, w, 6, DARK);
  rect(g, -w / 2, base - 2, w, 2, CYAN);
  for (let i = 0; i < 7; i++) {
    const x = Math.round(-w / 2 + 9 + i * (w - 18) / 6), top = base - (i % 2 ? 50 : 62);
    rect(g, x - 7, top + 11, 15, base - top - 9, DARK);
    rect(g, x - 5, top + 12, 11, base - top - 12, BLUE);
    rect(g, x - 4, top + 12, 4, base - top - 14, CYAN);
    diamond(g, x, top + 8, 8, PALE);
    rect(g, x - 3, top + 13, 1, base - top - 20, WHITE);
    rect(g, x + 1, base - 19, 4, 1, PALE);
  }
  // The two-second ridge marks the freeze zone; it is not a physics wall.
  sheet(scene, c, 'sf_snow', 0, 0, { scale: 4, duration: 400 });
  finish(scene, c, 1700, 300);
};

export const frostStepOut: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  for (let i = 0; i < 3; i++) {
    diamond(g, -o.facing * i * 9, -15 - i * 5, 9 - i * 2, i ? BLUE : PALE);
    rect(g, -o.facing * i * 9 - 6, -3 - i * 2, 12, 1, CYAN);
  }
  sheet(scene, c, 'sf_snow', 0, -30, { duration: 260 });
  tween(scene, c, g, { x: -o.facing * 22, y: -12, duration: 280, ease: 'Stepped', easeParams: [7] });
  finish(scene, c, 40, 260);
};

export const frostStepIn: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  rect(g, -13, -2, 26, 3, DARK);
  rect(g, -11, -3, 22, 1, WHITE);
  snow(g, 0, -17, 12);
  for (const x of [-16, 16]) diamond(g, x, -8, 4);
  sheet(scene, c, 'cm_ring', 0, -28, { ice: true, duration: 320 });
  finish(scene, c, 100, 260);
};

export const rimeGuardSigil: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c, -o.facing * 32, -44);
  for (let row = 0; row < 13; row++) {
    const half = row < 7 ? 7 : 13 - row;
    rect(g, -half, row - 9, half * 2 + 1, 1, DARK);
    if (half > 1) rect(g, -half + 1, row - 9, half * 2 - 1, 1, row % 3 ? BLUE : CYAN);
  }
  snow(g, 0, -4, 4);
  finish(scene, c, 220, 240);
};

export const crystalMemorySigil: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c, o.facing * 30, -76);
  // An open tablet and three stored crystals distinguish it from the guard badge.
  rect(g, -9, -2, 19, 11, DARK);
  rect(g, -8, -1, 7, 8, PALE); rect(g, 1, -1, 8, 8, CYAN);
  for (let i = 0; i < 3; i++) {
    rect(g, -6, 1 + i * 2, 4, 1, BLUE); rect(g, 3, 1 + i * 2, 4, 1, BLUE);
    diamond(g, (i - 1) * 7, -8, 3, WHITE);
  }
  tween(scene, c, g, { y: -88, duration: 450, ease: 'Stepped', easeParams: [6] });
  finish(scene, c, 240, 250);
};

export const crystalNeedleBeam: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  const n = Math.round(Math.abs((o.targetX ?? o.x + o.facing * 620) - o.x) / 2);
  c.setScale(o.facing, 1);
  rect(g, 0, -3, n, 7, DARK);
  rect(g, 0, -1, n, 3, CYAN);
  rect(g, 0, 0, n, 1, WHITE);
  for (const x of [9, 17, n - 18]) {
    diamond(g, x, 0, 10, PALE);
    rect(g, x - 4, -15, 1, 6, CYAN); rect(g, x + 4, 10, 1, 6, CYAN);
  }
  // Two discrete flashes match the two damage lines without stretching the root.
  tween(scene, c, g, { alpha: 0.3, duration: 90, yoyo: true });
  finish(scene, c, 220, 160);
};

export const crystalNeedleHit: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  for (let i = -1; i <= 1; i++) diamond(g, i * 8, -i * 9, 7, i ? CYAN : WHITE);
  rect(g, -18, -1, 36, 2, WHITE);
  sheet(scene, c, 'sf_shatter', 0, 0, { duration: 300 });
  finish(scene, c, 100, 220);
};

export const restorativeThaw: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  // A melting crystal cup; rising square droplets read as recovery rather than an attack.
  rect(g, -12, -5, 25, 5, DARK); rect(g, -10, -6, 21, 2, CYAN);
  diamond(g, 0, -17, 12, PALE);
  rect(g, -6, -19, 13, 3, WHITE); rect(g, -1, -24, 3, 13, WHITE);
  for (let i = 0; i < 6; i++) {
    const drop = pixels(scene, c, (i % 2 ? 1 : -1) * (16 + i * 5), -12 - i * 4);
    diamond(drop, 0, 0, 2, i % 2 ? PALE : CYAN);
    tween(scene, c, drop, { y: drop.y - 48, alpha: 0, delay: i * 60, duration: 650, ease: 'Stepped', easeParams: [12] });
  }
  sheet(scene, c, 'cm_ring', 0, -32, { ice: true, duration: 650 });
  finish(scene, c, 650, 250);
};

export const hoarfrostLink: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  const dx = ((o.targetX ?? o.x + o.facing * 220) - o.x) / 2;
  const dy = ((o.targetY ?? o.y) - o.y) / 2;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(dx * i / n), y = Math.round(dy * i / n);
    diamond(g, x, y, i % 2 ? 3 : 4, i % 2 ? PALE : BLUE);
  }
  finish(scene, c, 120, 230);
};

export const hoarfrostHit: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  snow(g, 0, 0, 13);
  for (const x of [-12, 12]) diamond(g, x, -9, 4, PALE);
  sheet(scene, c, 'sf_snow', 0, 0, { duration: 320 });
  finish(scene, c, 120, 240);
};

export const absoluteZeroCast: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  snow(g, 0, 0, 20);
  for (let i = 0; i < 4; i++) diamond(g, (i % 2 ? 1 : -1) * (24 + i * 3), i < 2 ? -18 : 18, 6);
  sheet(scene, c, 'cm_shield', 0, 0, { ice: true, duration: 600 });
  finish(scene, c, 420, 200);
};

export const absoluteZeroArea: VfxFn = (scene, o) => {
  const c = group(scene, o), base = pixels(scene, c);
  const hw = Math.round((o.w ?? 760) / 4), hh = Math.round((o.h ?? 360) / 4);
  // Stepped dome outline remains fixed while six crystal teeth converge at the 600ms hit.
  for (let x = -hw; x <= hw; x += 4) {
    const edge = Math.round(hh * (1 - Math.abs(x / hw)));
    rect(base, x, -edge, 4, 2, BLUE); rect(base, x, edge, 4, 2, CYAN);
  }
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const tooth = pixels(scene, c, Math.round(Math.cos(a) * hw * 2), Math.round(Math.sin(a) * hh * 2));
    diamond(tooth, 0, 0, 16, i % 2 ? CYAN : PALE);
    tween(scene, c, tooth, { x: 0, y: 0, delay: 100, duration: 500, ease: 'Stepped', easeParams: [20] });
  }
  const core = pixels(scene, c);
  core.setAlpha(0);
  snow(core, 0, 0, 42);
  for (let i = 0; i < 8; i++) diamond(core, (i - 3.5) * 12, (i % 2 ? 1 : -1) * 20, 7, WHITE);
  tween(scene, c, core, { alpha: 1, delay: 560, duration: 40 });
  sheet(scene, c, 'cm_nebula', 0, 0, { ice: true, scale: 4, duration: 850 });
  finish(scene, c, 650, 400);
};

export const absoluteZeroHit: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  for (let i = -2; i <= 2; i++) {
    diamond(g, i * 8, i % 2 ? -10 : 10, 9, PALE);
    rect(g, i * 8, -18, 1, 36, WHITE);
  }
  sheet(scene, c, 'sf_shatter', 0, 0, { scale: 4, duration: 420 });
  finish(scene, c, 180, 280);
};

function barrierPlate(g: Pixels, x: number, y: number): void {
  diamond(g, x, y, 8, BLUE);
  diamond(g, x, y, 5, PALE);
}

export const diamondBarrierCast: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    barrierPlate(g, Math.round(Math.cos(a) * 20), -19 + Math.round(Math.sin(a) * 19));
  }
  sheet(scene, c, 'cm_ring', 0, -38, { ice: true, duration: 480 });
  finish(scene, c, 180, 300);
};

export const diamondBarrierAura: VfxFn = (scene, o) => {
  const c = group(scene, o), g = pixels(scene, c);
  // Rigid overlapping plates, visually distinct from Frost Armor's orbiting shards.
  for (let i = -1; i <= 1; i++) {
    barrierPlate(g, -19, -19 + i * 12); barrierPlate(g, 19, -19 + i * 12);
  }
  rect(g, -13, -41, 26, 1, CYAN); rect(g, -13, 3, 26, 1, CYAN);
  sheet(scene, c, 'cm_shield', 0, -38, { ice: true, loop: true });
  tween(scene, c, g, { alpha: 0.6, duration: 1100, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [4] });
  return c;
};
