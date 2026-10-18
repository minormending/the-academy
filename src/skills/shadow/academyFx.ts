// Academy spell silhouettes share the existing shadow palette and locally recoloured CC0 sheets.
import Phaser from 'phaser';
import type { VfxOptions } from '../../core/types';
import { DEPTH } from '../../core/constants';
import { C, ST } from './textures';
import { fade, image, loop, motes, root, sheet } from './fx';

/** Short chain segments follow the actual engine jump endpoints, including vertical jumps. */
export function graveLink(scene: Phaser.Scene, o: VfxOptions, shackles = false): void {
  const dx = (o.targetX ?? o.x + o.facing * 160) - o.x, dy = (o.targetY ?? o.y) - o.y;
  const n = Math.min(14, Math.max(1, Math.ceil(Math.hypot(dx, dy) / 30)));
  const angle = Math.atan2(dy, dx);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const link = image(scene, shackles ? ST.shackle : ST.bone, o.x + dx * t, o.y + dy * t).setRotation(angle);
    if (!shackles) link.setTint(C.lilac);
    fade(scene, link, shackles ? 360 : 260, { y: link.y + (shackles ? 2 : -4) });
  }
}

export function shackleHit(scene: Phaser.Scene, o: VfxOptions): void {
  for (const side of [-1, 1]) {
    const shackle = image(scene, ST.shackle, o.x + side * 22, o.y);
    fade(scene, shackle, 500, { x: o.x + side * 10 });
  }
}

export function dreadPulse(scene: Phaser.Scene, o: VfxOptions): void {
  const rx = (o.w ?? 300) / 2, ry = (o.h ?? 160) / 2;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const shard = image(scene, i % 2 ? ST.bone : ST.skull, o.x, o.y).setRotation(a);
    fade(scene, shard, 430, { x: o.x + Math.cos(a) * rx, y: o.y + Math.sin(a) * ry });
  }
  const flash = sheet(scene, 'cm_shield', o.x, o.y, { dur: 400 }) ?? image(scene, ST.ring, o.x, o.y);
  fade(scene, flash, 420);
}

/** Grave Skin's defensive plates briefly appear when its owner casts Dread Pulse. */
export function graveSkin(scene: Phaser.Scene, o: VfxOptions): void {
  for (const [x, y] of [[-20, -24], [0, -42], [20, -24]]) {
    const plate = image(scene, ST.scale, o.x + x, o.y + y);
    fade(scene, plate, 650, { y: plate.y - 4 });
  }
}

export function step(scene: Phaser.Scene, o: VfxOptions, arriving = false): void {
  // Feet-origin silhouettes dissolve along the actual travel direction (works vertically too).
  const dx = (o.targetX ?? o.x + o.facing * 50) - o.x, dy = (o.targetY ?? o.y) - o.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  for (let i = 0; i < 3; i++) {
    const t = i * 12;
    const im = image(scene, ST.wraith, o.x + dx / length * t, o.y - 34 + dy / length * t)
      .setFlipX(o.facing < 0).setAlpha(1 - i * 0.25);
    fade(scene, im, arriving ? 320 : 430, { y: im.y - 6 });
  }
  const glyph = image(scene, arriving ? ST.skull : ST.ring, o.x, o.y - (arriving ? 36 : 2));
  fade(scene, glyph, 450);
}

export function wardCast(scene: Phaser.Scene, o: VfxOptions): void {
  for (let i = 0; i < 4; i++) {
    const bone = image(scene, ST.bone, o.x + (i - 1.5) * 26, o.y - 8).setRotation(Math.PI / 2);
    fade(scene, bone, 650, { y: o.y - 60 + (i % 2) * 12 });
  }
  const seal = sheet(scene, 'cm_shield', o.x, o.y - 32, { dur: 600 }) ?? image(scene, ST.ring, o.x, o.y - 32);
  fade(scene, seal, 620);
}

export function wardAura(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o);
  for (const [x, y, angle] of [[-25, -30, Math.PI / 2], [25, -30, Math.PI / 2], [0, -60, 0], [0, -4, 0]]) {
    const bone = image(scene, ST.bone, x, y).setRotation(angle).setAlpha(0.8);
    c.add(bone);
    loop(scene, c, { targets: bone, y: y - 4, alpha: 0.5, duration: 900, yoyo: true, ease: 'Stepped', easeParams: [2] });
  }
  return c;
}

export function wraith(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o).setDepth(DEPTH.SUMMON);
  const body = image(scene, ST.wraith, 0, 0);
  const halo = sheet(scene, 'sf_ring', 0, 10, { loop: true, alpha: 0.5 }) ?? image(scene, ST.ring, 0, 10);
  c.add([halo, body]);
  loop(scene, c, { targets: body, y: -6, duration: 950, yoyo: true, ease: 'Stepped', easeParams: [3] });
  return c;
}

/** Head is on +x; only child opacity loops. Engine owns rotation and the root's scale signs. */
export function wraithWisp(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o);
  const tail = sheet(scene, 'ss_fireball', -34, 0, { loop: true, alpha: 0.6 }) ?? image(scene, ST.bolt, -24, 0);
  const head = image(scene, ST.skull, 0, 0).setTint(C.green);
  c.add([tail, head]);
  loop(scene, c, { targets: head, alpha: 0.6, duration: 300, yoyo: true });
  return c;
}

export function wraithHit(scene: Phaser.Scene, o: VfxOptions): void {
  const veil = sheet(scene, 'cm_midnight', o.x, o.y, { dur: 400 }) ?? image(scene, ST.cloud, o.x, o.y);
  fade(scene, veil, 420);
  const soul = image(scene, ST.wraith, o.x, o.y).setAlpha(0.8);
  fade(scene, soul, 470, { y: o.y - 28 });
}

export function lanceCast(scene: Phaser.Scene, o: VfxOptions): void {
  for (const side of [-1, 1]) {
    const bone = image(scene, ST.bone, o.x, o.y + side * 22);
    fade(scene, bone, 300, { y: o.y, x: o.x + o.facing * 28 });
  }
}

export function lance(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o);
  const spine = sheet(scene, 'ss_icespear', -46, 0, { loop: true }) ?? image(scene, ST.bolt, -24, 0);
  c.add(spine);
  for (const x of [-38, -20, -2]) c.add(image(scene, ST.bone, x, 0).setRotation(Math.PI / 2));
  return c;
}

export function lanceHit(scene: Phaser.Scene, o: VfxOptions): void {
  for (let i = 0; i < 4; i++) {
    const bone = image(scene, ST.bone, o.x, o.y).setRotation(i * Math.PI / 2);
    fade(scene, bone, 350, { x: o.x + (i % 2 ? -1 : 1) * 30, y: o.y + (i < 2 ? -1 : 1) * 24 });
  }
  const flash = sheet(scene, 'g9_darkbolt', o.x, o.y, { dur: 380 }) ?? image(scene, ST.slash, o.x, o.y);
  fade(scene, flash, 400);
}

export function dragon(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o).setDepth(DEPTH.SUMMON);
  const body = image(scene, ST.dragon, 0, 0);
  c.add(body);
  loop(scene, c, { targets: body, y: -6, duration: 1200, yoyo: true, ease: 'Stepped', easeParams: [3] });
  // This opening is a short, independent one-shot; the dragon body stays engine-owned.
  const opening = sheet(scene, 'cm_vortex', o.x, o.y, { dur: 800 }) ?? image(scene, ST.ring, o.x, o.y);
  fade(scene, opening, 820);
  motes(scene, o.x, o.y, 6, true);
  return c;
}

export function dragonCharge(scene: Phaser.Scene, o: VfxOptions): void {
  const skull = image(scene, ST.skull, o.x, o.y + 24);
  fade(scene, skull, 300, { x: o.x + o.facing * 60 });
}

export function dragonBreath(scene: Phaser.Scene, o: VfxOptions): void {
  const dx = (o.targetX ?? o.x + o.facing * 580) - o.x;
  const n = Math.min(8, Math.max(1, Math.ceil(Math.abs(dx) / 100)));
  for (let i = 0; i < n; i++) {
    const x = o.x + dx * (i + 0.5) / n;
    const cloud = sheet(scene, 'cm_nebula', x, o.y, { dur: 650, flipX: o.facing < 0 }) ?? image(scene, ST.cloud, x, o.y);
    fade(scene, cloud, 680);
    const bone = image(scene, ST.bone, x, o.y);
    fade(scene, bone, 450, { x: x + o.facing * 40 });
  }
}

export function dragonHit(scene: Phaser.Scene, o: VfxOptions): void {
  const bite = image(scene, ST.skull, o.x, o.y - 16);
  fade(scene, bite, 500, { y: o.y - 30 });
  for (const side of [-1, 1]) {
    const tooth = image(scene, ST.bone, o.x + side * 18, o.y).setRotation(side * Math.PI / 4);
    fade(scene, tooth, 400, { x: o.x + side * 32, y: o.y + 20 });
  }
}

export function reservoir(scene: Phaser.Scene, o: VfxOptions): void {
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const soul = image(scene, ST.skull, o.x + Math.cos(a) * 60, o.y - 36 + Math.sin(a) * 36).setTint(C.green);
    fade(scene, soul, 650, { x: o.x, y: o.y - 32 });
  }
  const recovery = sheet(scene, 'sf_heal', o.x, o.y - 32, { dur: 700 }) ?? image(scene, ST.scale, o.x, o.y - 32);
  fade(scene, recovery, 720);
  motes(scene, o.x, o.y - 16, 5, true);
}
