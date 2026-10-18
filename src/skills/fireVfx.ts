// OWNER: A3 (fire-tree). Fire textures + all `fire_*` VFX. Everything is additive, layered glow + particles.
import Phaser from 'phaser';
import { registerVfx } from '../core/vfx';
import { DEPTH } from '../core/constants';
import type { VfxFn, VfxOptions } from '../core/types';
import { generateFireTextures as genTextures, FT } from './fire/textures';
import {
  ADD, NORMAL, C, FIRE_TINTS, HOT_TINTS, ALIGN, img, tk, loop, shake, shock, flash, flare,
  burst, stream, attachTrail, tongue, zone,
} from './fire/fx';

export function generateFireTextures(scene: Phaser.Scene): void { genTextures(scene); }

// ───────────────────────────── shared sub-effects ─────────────────────────────

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const sideAngle = (f: 1 | -1, spread: number) => (f > 0 ? { min: -spread, max: spread } : { min: 180 - spread, max: 180 + spread });

/** Spark streaks + embers radiating from a point (shared by explosions and hits). */
function sparks(scene: Phaser.Scene, x: number, y: number, n: number, speed: number, grav = 320): void {
  burst(scene, x, y, FT.spark, n, 800, {
    speed: { min: speed * 0.4, max: speed }, angle: { min: 0, max: 360 }, gravityY: grav,
    lifespan: { min: 420, max: 760 }, scale: { start: 1.1, end: 0.25 }, alpha: { start: 1, end: 0 },
    tint: HOT_TINTS.concat(FIRE_TINTS), rotate: ALIGN,
  });
}

function embers(scene: Phaser.Scene, x: number, y: number, n: number, speed: number, up = -50): void {
  burst(scene, x, y, FT.ember, n, 1200, {
    speed: { min: 20, max: speed }, angle: { min: 0, max: 360 }, gravityY: up,
    lifespan: { min: 600, max: 1200 }, scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS,
  });
}

function smokePuff(scene: Phaser.Scene, x: number, y: number, n: number, size = 1): void {
  burst(scene, x, y, FT.smoke, n, 900, {
    speed: { min: 15, max: 60 }, angle: { min: 200, max: 340 }, gravityY: -25, blendMode: NORMAL,
    lifespan: { min: 600, max: 900 }, scale: { start: 0.4 * size, end: 1.3 * size }, alpha: { start: 0.38, end: 0 }, tint: C.smoke,
  }, DEPTH.VFX - 1);
}

/** Hit flash on a target (center). */
function hitFx(scene: Phaser.Scene, x: number, y: number, s = 1): void {
  flash(scene, x, y, C.orange, 64 * s, 190, 0.95);
  flash(scene, x, y, C.white, 30 * s, 120, 1);
  flare(scene, x, y, C.yellow, 46 * s, 220);
  sparks(scene, x, y, Math.round(7 * s), 170 * s, 260);
  tongue(scene, x, y + 16 * s, C.orange, 24 * s, 52 * s, 0, 360);
}

/** Cast flare at the staff. */
function castFx(scene: Phaser.Scene, o: VfxOptions, s = 1): void {
  const { x, y, facing: f } = o;
  flash(scene, x, y, C.orange, 78 * s, 260, 0.9);
  flash(scene, x + f * 6 * s, y, C.white, 36 * s, 170, 1);
  flare(scene, x, y, C.yellow, 64 * s, 280);
  burst(scene, x, y, FT.ember, Math.round(9 * s), 560, {
    speed: { min: 60, max: 210 * s }, angle: sideAngle(f, 38), lifespan: { min: 300, max: 540 },
    scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS,
  });
  if (s >= 1.5) {
    const gx = x - f * 18, gy = y + 34;
    shock(scene, gx, gy, C.orange, 150 * s, 420, 0.3, 0.9);
    shock(scene, gx, gy, C.yellow, 100 * s, 340, 0.3, 0.7, 70);
  }
}

/** Big fiery explosion centred in a w×h area. */
function explosion(scene: Phaser.Scene, x: number, y: number, w: number, h: number, power = 1, shk = true): void {
  const size = Math.max(w, h);
  flash(scene, x, y, C.white, size * 1.0, 240, 1);
  flash(scene, x, y, C.orange, size * 1.7, 440, 0.85, DEPTH.VFX, FT.soft);
  shock(scene, x, y + h * 0.3, C.orange, w * 1.2, 400, 0.5);
  shock(scene, x, y + h * 0.3, C.yellow, w * 0.8, 300, 0.5, 0.7, 60);
  const n = Math.round(3 + power * 3);
  const tints = [C.orange, C.yellow, C.red];
  for (let i = 0; i < n; i++) {
    tongue(scene, x + rnd(-0.4, 0.4) * w, y + h * 0.42, tints[i % 3], w * 0.2, h * rnd(0.6, 1.1), i * 28, 440);
  }
  sparks(scene, x, y, Math.round(14 * power), 400);
  embers(scene, x, y, Math.round(9 * power), 190);
  smokePuff(scene, x, y + h * 0.2, Math.round(3 * power));
  if (shk) shake(scene, 80 + 30 * power, 0.0025 * power);
}

function sizeOf(o: VfxOptions, dw: number, dh: number): { w: number; h: number } {
  return { w: o.w ?? dw, h: o.h ?? dh };
}

function flick(scene: Phaser.Scene, owner: Phaser.GameObjects.GameObject, im: Phaser.GameObjects.Image, amt: number, dur: number, delay = 0): void {
  loop(scene, owner, { targets: im, scaleY: im.scaleY * amt, scaleX: im.scaleX * (1 + (amt - 1) * 0.5), duration: dur, delay, yoyo: true, ease: 'Sine.easeInOut' });
}

function projContainer(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  c.setRotation(o.angle ?? (o.facing < 0 ? Math.PI : 0));
  return c;
}

const ring = (r: number) => new Phaser.Geom.Circle(0, 0, r);

// ───────────────────────────── Tier 2 ─────────────────────────────

const arrowProj: VfxFn = (scene, o) => {
  const s = o.scale ?? 1;
  const c = projContainer(scene, o);
  const glow = img(scene, FT.glow, 0, 0, { tint: C.orange, scale: 0.5 * s, alpha: 0.8 });
  const tail = img(scene, FT.comet, 0, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 0.95 * s, sy: 0.75 * s, alpha: 0.9 });
  const inner = img(scene, FT.comet, 0, 0, { tint: C.yellow, origin: [0.875, 0.5], sx: 0.6 * s, sy: 0.45 * s });
  const core = img(scene, FT.soft, 2 * s, 0, { tint: C.white, scale: 0.22 * s });
  c.add([glow, tail, inner, core]);
  flick(scene, c, tail, 1.25, 80);
  flick(scene, c, inner, 1.2, 65, 20);
  loop(scene, c, { targets: glow, scale: glow.scale * 1.2, duration: 110, yoyo: true });
  attachTrail(scene, c, FT.ember, 560, {
    speed: { min: 5, max: 40 }, lifespan: { min: 350, max: 560 }, scale: { start: 0.9 * s, end: 0 },
    alpha: { start: 1, end: 0 }, frequency: 22, quantity: 1, tint: FIRE_TINTS, gravityY: -40,
    emitZone: zone(ring(5)),
  });
  attachTrail(scene, c, FT.soft, 300, {
    speed: 0, lifespan: 280, scale: { start: 0.38 * s, end: 0 }, alpha: { start: 0.4, end: 0 },
    frequency: 28, quantity: 1, tint: C.orange,
  }, DEPTH.VFX - 1);
  return c;
};

const burstArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 190, 110);
  const f = o.facing;
  const sx = o.x - f * w * 0.5;            // caster side
  const by = o.y + h * 0.36;               // flame base
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    tongue(scene, sx + f * (w * 0.1 + t * w * 0.85), by + rnd(-4, 4), [C.orange, C.yellow, C.red][i % 3],
      w * 0.16, h * (0.75 + 0.45 * Math.sin(t * Math.PI)) * rnd(0.9, 1.15), i * 26, 420);
  }
  burst(scene, sx, o.y + h * 0.1, FT.flame, 24, 360, {
    speed: { min: 260, max: 460 }, angle: sideAngle(f, 15), lifespan: { min: 220, max: 360 },
    scale: { start: 0.35, end: 1.0 }, alpha: { start: 0.9, end: 0 }, tint: FIRE_TINTS,
    rotate: { onUpdate: (p) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) + 90 },
  });
  const bloom = img(scene, FT.soft, o.x, o.y + h * 0.1, { tint: C.orange, alpha: 0.65, sx: (w / 64) * 1.1, sy: (h / 64) * 0.9, depth: DEPTH.VFX });
  scene.tweens.add({ targets: bloom, alpha: 0, duration: 380, onComplete: () => { if (bloom.scene) bloom.destroy(); } });
  flash(scene, sx + f * 12, o.y + h * 0.1, C.white, 70, 160, 1);
  sparks(scene, o.x + f * w * 0.2, o.y, 10, 300, 200);
  smokePuff(scene, o.x, by - 10, 2, 0.7);
  shake(scene, 80, 0.002);
};

const kindleCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  shock(scene, x, y - 4, C.orange, 130, 460, 0.32);
  shock(scene, x, y - 4, C.yellow, 80, 360, 0.32, 0.8, 80);
  flash(scene, x, y - 30, C.orange, 120, 420, 0.7);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    tongue(scene, x + Math.cos(a) * 34, y - 2 + Math.sin(a) * 9, i % 2 ? C.yellow : C.orange, 14, rnd(46, 72), i * 18, 520);
  }
  burst(scene, x, y - 10, FT.ember, 22, 1000, {
    speed: { min: 30, max: 110 }, angle: { min: 250, max: 290 }, gravityY: -70, lifespan: { min: 600, max: 1000 },
    scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, emitZone: zone(ring(22)),
  });
  flare(scene, x, y - 40, C.yellow, 70, 360);
};

const kindleAura: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  const gg = img(scene, FT.soft, 0, -4, { tint: C.orange, sx: 1.7, sy: 0.4, alpha: 0.5 });
  c.add(gg);
  loop(scene, c, { targets: gg, alpha: 0.28, duration: 520, yoyo: true, ease: 'Sine.easeInOut' });
  const orbit = scene.add.container(0, -30);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const wx = Math.cos(a) * 24, wy = Math.sin(a) * 24;
    orbit.add(img(scene, FT.soft, wx, wy, { tint: C.yellow, scale: 0.26, alpha: 0.85 }));
    orbit.add(img(scene, FT.flame, wx, wy + 4, { tint: C.orange, origin: [0.5, 1], scale: 0.28, rot: a + Math.PI / 2 }));
  }
  c.add(orbit);
  loop(scene, c, { targets: orbit, rotation: Math.PI * 2, duration: 2400, ease: 'Linear' });
  attachTrail(scene, c, FT.flame, 800, {
    speedY: { min: -90, max: -50 }, speedX: 0, lifespan: { min: 500, max: 800 }, scale: { start: 0.26, end: 0.05 },
    alpha: { start: 0.55, end: 0 }, tint: FIRE_TINTS, frequency: 110, quantity: 1,
    emitZone: zone(new Phaser.Geom.Ellipse(0, -6, 36, 10)),
  });
  attachTrail(scene, c, FT.ember, 900, {
    speedY: { min: -60, max: -25 }, speedX: { min: -15, max: 15 }, lifespan: { min: 600, max: 900 }, scale: { start: 0.7, end: 0 },
    alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 140, quantity: 1,
    emitZone: zone(new Phaser.Geom.Ellipse(0, -10, 40, 30)),
  });
  return c;
};

// ───────────────────────────── Tier 3 ─────────────────────────────

const orbProj: VfxFn = (scene, o) => {
  const s = o.scale ?? 1;
  const c = projContainer(scene, o);
  const halo = img(scene, FT.glow, 0, 0, { tint: C.orange, scale: 0.95 * s, alpha: 0.75 });
  const tail = img(scene, FT.comet, 0, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 1.2 * s, sy: 1.0 * s, alpha: 0.75 });
  const body = img(scene, FT.soft, 0, 0, { tint: C.gold, scale: 0.62 * s });
  const core = img(scene, FT.soft, 0, 0, { tint: C.white, scale: 0.32 * s });
  const spin = scene.add.container(0, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    spin.add(img(scene, FT.flame, Math.cos(a) * 11 * s, Math.sin(a) * 11 * s, {
      tint: i % 2 ? C.yellow : C.red, origin: [0.5, 1], scale: 0.42 * s, rot: a + Math.PI / 2,
    }));
  }
  c.add([halo, tail, spin, body, core]);
  loop(scene, c, { targets: spin, rotation: Math.PI * 2, duration: 520, ease: 'Linear' });
  loop(scene, c, { targets: halo, scale: halo.scale * 1.18, duration: 120, yoyo: true });
  flick(scene, c, tail, 1.2, 90);
  attachTrail(scene, c, FT.ember, 700, {
    speed: { min: 10, max: 60 }, lifespan: { min: 380, max: 700 }, scale: { start: 1.0 * s, end: 0 },
    alpha: { start: 1, end: 0 }, frequency: 18, quantity: 1, tint: FIRE_TINTS, gravityY: -30,
    emitZone: zone(ring(7)),
  });
  attachTrail(scene, c, FT.smoke, 560, {
    speed: { min: 0, max: 20 }, lifespan: 500, scale: { start: 0.3, end: 0.9 }, alpha: { start: 0.3, end: 0 },
    frequency: 48, quantity: 1, tint: C.smoke, blendMode: NORMAL,
  }, DEPTH.VFX - 1);
  return c;
};

const explosionArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 200, 150);
  explosion(scene, o.x, o.y, w, h, 1.3);
};

const pillarArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 170, 260);
  const x = o.x, gy = o.y + h / 2;
  shock(scene, x, gy - 2, C.orange, w * 1.3, 420, 0.3);
  shock(scene, x, gy - 2, C.yellow, w * 0.8, 320, 0.3, 0.8, 70);
  const pad = img(scene, FT.soft, x, gy - 4, { tint: C.orange, sx: (w / 64) * 1.2, sy: 0.4, alpha: 0.8, depth: DEPTH.VFX - 1 });
  scene.tweens.add({ targets: pad, alpha: 0, duration: 750, delay: 120, onComplete: () => { if (pad.scene) pad.destroy(); } });

  // column of light (beam texture standing upright, pivot at the ground)
  const col = img(scene, FT.beam, x, gy, { tint: C.yellow, origin: [0, 0.5], rot: -Math.PI / 2, alpha: 0.9, depth: DEPTH.VFX });
  const len = (h * 1.05) / 128;
  col.setScale(0.05, (w * 0.7) / 64);
  scene.tweens.add({ targets: col, scaleX: len, duration: 170, ease: 'Cubic.easeOut' });
  scene.tweens.add({
    targets: col, scaleY: (w * 0.3) / 64, alpha: 0, duration: 460, delay: 230, ease: 'Quad.easeIn',
    onComplete: () => { if (col.scene) col.destroy(); },
  });
  const core = img(scene, FT.beam, x, gy, { tint: C.white, origin: [0, 0.5], rot: -Math.PI / 2, alpha: 0.95, depth: DEPTH.VFX_TOP });
  core.setScale(0.05, (w * 0.28) / 64);
  scene.tweens.add({ targets: core, scaleX: len * 0.92, duration: 150, ease: 'Cubic.easeOut' });
  scene.tweens.add({
    targets: core, scaleY: 0.02, alpha: 0, duration: 380, delay: 200,
    onComplete: () => { if (core.scene) core.destroy(); },
  });

  const dxs = [-0.24, 0, 0.24, -0.12, 0.12];
  dxs.forEach((d, i) => tongue(scene, x + d * w, gy, [C.orange, C.red, C.orange, C.yellow, C.yellow][i], w * (i < 3 ? 0.42 : 0.3), h * (i === 1 ? 1.15 : rnd(0.8, 1)), i * 20, 700));
  stream(scene, x, gy, FT.ember, 450, 700, {
    speedY: { min: -170, max: -90 }, speedX: { min: -30, max: 30 }, lifespan: { min: 450, max: 700 },
    scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 14, quantity: 1,
    emitZone: zone(new Phaser.Geom.Rectangle(-w * 0.25, -h * 0.5, w * 0.5, h * 0.5)),
  });
  flash(scene, x, gy - h * 0.9, C.yellow, 130, 420, 0.8);
  flare(scene, x, gy - h * 0.9, C.white, 80, 400);
  sparks(scene, x, gy - 20, 12, 320, 240);
  smokePuff(scene, x, gy - h * 0.7, 3, 1);
  shake(scene, 130, 0.004);
};

const combustCast: VfxFn = (scene, o) => {
  castFx(scene, o, 1.6);
  flash(scene, o.x, o.y, C.white, 120, 200, 1);
};

const combustHit: VfxFn = (scene, o) => {
  hitFx(scene, o.x, o.y, 1.5);
  flash(scene, o.x, o.y, C.red, 120, 280, 0.8);
};

const combustArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 260, 180);
  const { x, y } = o;
  // 1. implosion: sparks rush inward while a ring collapses
  const r = img(scene, FT.ring, x, y, { tint: C.white, alpha: 0.9, scale: (w / 128) * 1.3, sy: ((w / 128) * 1.3) * (h / w) * 1.2 });
  scene.tweens.add({ targets: r, scale: 0.12, alpha: 1, duration: 170, ease: 'Cubic.easeIn', onComplete: () => { if (r.scene) r.destroy(); } });
  const em = scene.add.particles(x, y, tk(scene, FT.spark), {
    emitting: false, blendMode: ADD, moveToX: x, moveToY: y, lifespan: 170, scale: { start: 1, end: 0.4 },
    alpha: { start: 0.2, end: 1 }, tint: HOT_TINTS, rotate: ALIGN,
    emitZone: zone(new Phaser.Geom.Ellipse(0, 0, w * 1.2, h * 1.2), 'edge', 20),
  });
  em.setDepth(DEPTH.VFX);
  em.explode(20);
  scene.time.delayedCall(320, () => { if (em.scene) em.destroy(); });
  // 2. chain of detonations
  scene.time.delayedCall(170, () => {
    explosion(scene, x, y, w, h, 2.2);
    flash(scene, x, y, C.white, Math.max(w, h) * 1.6, 220, 1);
    shock(scene, x, y + h * 0.35, C.red, w * 1.6, 560, 0.45, 0.8, 40);
  });
  for (let i = 0; i < 3; i++) {
    scene.time.delayedCall(250 + i * 75, () => {
      explosion(scene, x + rnd(-0.32, 0.32) * w, y + rnd(-0.25, 0.2) * h, w * 0.5, h * 0.5, 0.8, false);
    });
  }
  scene.time.delayedCall(170, () => shake(scene, 220, 0.008));
};

const salamanderBody: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.SUMMON);
  const gg = img(scene, FT.soft, 0, 13, { tint: C.orange, sx: 1.7, sy: 0.38, alpha: 0.5 });
  c.add(gg);
  loop(scene, c, { targets: gg, alpha: 0.28, duration: 600, yoyo: true, ease: 'Sine.easeInOut' });
  const body = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(0xa82612, 1); g.fillTriangle(-16, -7, -16, 8, -58, -12);
  g.fillStyle(0x8a1d0e, 1);
  for (const lx of [-14, 12]) { g.fillEllipse(lx - 3, 11, 11, 8); g.fillEllipse(lx + 7, 10, 11, 7); }
  g.fillStyle(0xc2321a, 1); g.fillEllipse(0, 0, 52, 25);
  g.fillStyle(0xff9a3a, 1); g.fillEllipse(2, 6, 38, 9);
  g.fillStyle(0x7a1409, 1);
  for (const px of [-15, -5, 5]) g.fillTriangle(px - 3, -11, px + 5, -11, px + 1, -4);
  g.fillStyle(0xd9431e, 1); g.fillEllipse(28, -3, 25, 18);
  g.fillStyle(0xff9a3a, 1); g.fillEllipse(32, 2, 15, 6);
  g.fillStyle(0xfff0a0, 1); g.fillCircle(31, -7, 3.3);
  g.fillStyle(0x2a0a00, 1); g.fillCircle(32, -7, 1.4);
  body.add(g);
  const tuft = (x: number, y: number, sc: number, tint: number, dur: number, rot = 0) => {
    const f = img(scene, FT.flame, x, y, { tint, origin: [0.5, 1], scale: sc, rot });
    body.add(f);
    flick(scene, c, f, 1.35, dur, Math.floor(rnd(0, 120)));
  };
  [-14, -3, 8, 19].forEach((x, i) => tuft(x, -10, 0.34 + (i % 2) * 0.08, i % 2 ? C.yellow : C.orange, 150 + i * 30));
  tuft(-57, -12, 0.42, C.orange, 190, -1.1);
  const mouth = img(scene, FT.soft, 38, -1, { tint: C.yellow, scale: 0.4, alpha: 0.8 });
  body.add(mouth);
  loop(scene, c, { targets: mouth, scale: 0.55, alpha: 1, duration: 420, yoyo: true });
  c.add(body);
  loop(scene, c, { targets: body, scaleY: 1.05, y: -1.5, duration: 700, yoyo: true, ease: 'Sine.easeInOut' });
  attachTrail(scene, c, FT.ember, 900, {
    speedY: { min: -50, max: -20 }, speedX: { min: -12, max: 12 }, lifespan: { min: 500, max: 900 }, scale: { start: 0.7, end: 0 },
    alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 90, quantity: 1,
    emitZone: zone(new Phaser.Geom.Rectangle(-24, -16, 48, 10)),
  });
  return c;
};

const spitProj: VfxFn = (scene, o) => {
  const c = projContainer(scene, o);
  const glow = img(scene, FT.glow, 0, 0, { tint: C.orange, scale: 0.42, alpha: 0.8 });
  const tail = img(scene, FT.comet, 0, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 0.5, sy: 0.55 });
  const core = img(scene, FT.soft, 0, 0, { tint: C.yellow, scale: 0.26 });
  const hot = img(scene, FT.soft, 0, 0, { tint: C.white, scale: 0.13 });
  c.add([glow, tail, core, hot]);
  loop(scene, c, { targets: glow, scale: 0.55, duration: 100, yoyo: true });
  flick(scene, c, tail, 1.3, 80);
  attachTrail(scene, c, FT.ember, 500, {
    speed: { min: 5, max: 35 }, lifespan: { min: 280, max: 500 }, scale: { start: 0.75, end: 0 }, alpha: { start: 1, end: 0 },
    frequency: 26, quantity: 1, tint: FIRE_TINTS, gravityY: -30, emitZone: zone(ring(4)),
  });
  return c;
};

const spitCast: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  flash(scene, x, y, C.orange, 44, 180, 0.9);
  flash(scene, x + f * 4, y, C.white, 20, 120, 1);
  burst(scene, x, y, FT.ember, 6, 420, {
    speed: { min: 40, max: 140 }, angle: sideAngle(f, 28), lifespan: { min: 220, max: 400 },
    scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS,
  });
};

// ───────────────────────────── Tier 4 ─────────────────────────────

const lanceCast: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  castFx(scene, o, 1.4);
  const r = img(scene, FT.ring, x, y, { tint: C.yellow, alpha: 0.9, scale: 0.9, depth: DEPTH.VFX_TOP });
  scene.tweens.add({ targets: r, scale: 0.08, alpha: 1, duration: 180, ease: 'Cubic.easeIn', onComplete: () => { if (r.scene) r.destroy(); } });
  flare(scene, x + f * 8, y, C.white, 110, 320);
};

const lanceBeam: VfxFn = (scene, o) => {
  const sx = o.x, sy = o.y;
  const tx = o.targetX ?? o.x + o.facing * 520, ty = o.targetY ?? o.y;
  const len = Math.max(40, Phaser.Math.Distance.Between(sx, sy, tx, ty));
  const ang = Math.atan2(ty - sy, tx - sx);
  const th = o.h ?? 90;
  const mk = (tint: number, thick: number, alpha: number, depth: number, life: number, delay: number) => {
    const b = img(scene, FT.beam, sx, sy, { tint, origin: [0, 0.5], rot: ang, alpha, depth });
    b.setScale(len / 128, 0.05);
    scene.tweens.add({ targets: b, scaleY: thick / 64, duration: 70, ease: 'Cubic.easeOut', delay });
    scene.tweens.add({
      targets: b, scaleY: thick / 64 * 0.2, alpha: 0, duration: life, delay: delay + 140, ease: 'Quad.easeIn',
      onComplete: () => { if (b.scene) b.destroy(); },
    });
  };
  mk(C.red, th * 1.5, 0.55, DEPTH.VFX - 1, 360, 0);
  mk(C.orange, th, 0.9, DEPTH.VFX, 340, 0);
  mk(C.white, th * 0.38, 1, DEPTH.VFX_TOP, 300, 10);
  // rolling flames along the beam
  const em = scene.add.particles(0, 0, tk(scene, FT.flame), {
    emitting: false, blendMode: ADD, speedY: { min: -60, max: -20 }, speedX: 0, lifespan: { min: 280, max: 520 },
    scale: { start: 0.42, end: 0.08 }, alpha: { start: 0.8, end: 0 }, tint: FIRE_TINTS,
    emitZone: zone(new Phaser.Geom.Line(sx, sy, tx, ty)),
  });
  em.setDepth(DEPTH.VFX);
  em.explode(Math.min(40, Math.round(len / 12)));
  const em2 = scene.add.particles(0, 0, tk(scene, FT.ember), {
    emitting: false, blendMode: ADD, speed: { min: 30, max: 130 }, angle: { min: 0, max: 360 }, gravityY: -40,
    lifespan: { min: 400, max: 800 }, scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS,
    emitZone: zone(new Phaser.Geom.Line(sx, sy, tx, ty)),
  });
  em2.setDepth(DEPTH.VFX);
  em2.explode(26);
  scene.time.delayedCall(900, () => { if (em.scene) em.destroy(); if (em2.scene) em2.destroy(); });
  flash(scene, sx, sy, C.white, 90, 220, 1);
  flash(scene, tx, ty, C.orange, th * 1.4, 300, 0.85);
  flare(scene, tx, ty, C.yellow, th * 1.2, 320);
  sparks(scene, tx, ty, 10, 320, 260);
  shake(scene, 110, 0.003);
};

const meteorCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  const gx = x - o.facing * 18, gy = y + 34;
  castFx(scene, o, 1.8);
  shock(scene, gx, gy, C.red, 260, 600, 0.3, 0.9);
  shock(scene, gx, gy, C.orange, 190, 500, 0.3, 0.9, 90);
  shock(scene, gx, gy, C.yellow, 120, 420, 0.3, 0.8, 170);
  // sigil above the caster
  const sg = img(scene, FT.star, gx, gy - 84, { tint: C.orange, alpha: 0.9, depth: DEPTH.VFX_TOP });
  sg.setScale(0.2);
  scene.tweens.add({ targets: sg, scale: 1.9, rotation: 1.6, duration: 600, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: sg, alpha: 0, duration: 260, delay: 420, onComplete: () => { if (sg.scene) sg.destroy(); } });
  const rg = img(scene, FT.ring, gx, gy - 84, { tint: C.red, alpha: 0.9, depth: DEPTH.VFX_TOP });
  rg.setScale(0.2);
  scene.tweens.add({ targets: rg, scale: 1.6, alpha: 0, duration: 680, ease: 'Cubic.easeOut', onComplete: () => { if (rg.scene) rg.destroy(); } });
  burst(scene, gx, gy, FT.ember, 30, 1100, {
    speed: { min: 40, max: 160 }, angle: { min: 245, max: 295 }, gravityY: -90, lifespan: { min: 600, max: 1100 },
    scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, emitZone: zone(ring(30)),
  });
  shake(scene, 160, 0.003);
};

const meteorProj: VfxFn = (scene, o) => {
  const s = (o.scale ?? 1) * rnd(0.9, 1.2);
  const c = projContainer(scene, o);
  const halo = img(scene, FT.glow, 0, 0, { tint: 0xff4a10, scale: 1.5 * s, alpha: 0.7 });
  const tail = img(scene, FT.comet, 0, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 2.3 * s, sy: 1.5 * s, alpha: 0.75 });
  const tail2 = img(scene, FT.comet, 0, 0, { tint: C.yellow, origin: [0.875, 0.5], sx: 1.5 * s, sy: 0.9 * s, alpha: 0.9 });
  const rock = img(scene, FT.rock, 0, 0, { add: false, scale: 0.95 * s });
  const core = img(scene, FT.glow, 4 * s, 0, { tint: C.yellow, scale: 0.4 * s, alpha: 0.75 });
  c.add([halo, tail, tail2, rock, core]);
  loop(scene, c, { targets: rock, rotation: Math.PI * 2, duration: 650, ease: 'Linear' });
  loop(scene, c, { targets: halo, scale: halo.scale * 1.15, duration: 130, yoyo: true });
  flick(scene, c, tail, 1.15, 100);
  attachTrail(scene, c, FT.ember, 720, {
    speed: { min: 20, max: 70 }, lifespan: { min: 350, max: 720 }, scale: { start: 1.1 * s, end: 0 }, alpha: { start: 1, end: 0 },
    frequency: 16, quantity: 1, tint: FIRE_TINTS, gravityY: -20, emitZone: zone(ring(10 * s)),
  });
  attachTrail(scene, c, FT.smoke, 720, {
    speed: { min: 0, max: 25 }, lifespan: 700, scale: { start: 0.5 * s, end: 1.4 * s }, alpha: { start: 0.35, end: 0 },
    frequency: 50, quantity: 1, tint: C.smoke, blendMode: NORMAL,
  }, DEPTH.VFX - 1);
  return c;
};

const meteorImpact: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 190, 120);
  const { x, y } = o;                       // ground point
  const cy = y - h * 0.35;
  flash(scene, x, cy, C.white, w * 0.9, 220, 1);
  flash(scene, x, cy, C.orange, w * 1.5, 420, 0.85, DEPTH.VFX, FT.soft);
  shock(scene, x, y - 2, C.orange, w * 1.25, 420, 0.32);
  shock(scene, x, y - 2, C.yellow, w * 0.8, 300, 0.32, 0.8, 50);
  // scorch mark
  const sc = img(scene, FT.scorch, x, y - 1, { tint: 0x120603, add: false, alpha: 0, depth: DEPTH.VFX - 2 });
  sc.setScale((w * 1.15) / 128, 1);
  scene.tweens.add({ targets: sc, alpha: 0.75, duration: 90 });
  scene.tweens.add({ targets: sc, alpha: 0, duration: 1500, delay: 700, onComplete: () => { if (sc.scene) sc.destroy(); } });
  // lingering ground fire
  const gl = img(scene, FT.soft, x, y - 5, { tint: C.orange, sx: (w / 64) * 0.9, sy: 0.35, alpha: 0.7, depth: DEPTH.VFX - 1 });
  scene.tweens.add({ targets: gl, alpha: 0, duration: 1100, delay: 100, onComplete: () => { if (gl.scene) gl.destroy(); } });
  for (let i = 0; i < 5; i++) {
    tongue(scene, x + rnd(-0.38, 0.38) * w, y, [C.orange, C.yellow, C.red][i % 3], w * 0.17, h * rnd(0.7, 1.25), i * 22, 620);
  }
  // rising fire cloud
  const cloud = img(scene, FT.soft, x, y - 20, { tint: C.gold, alpha: 0.85, scale: 0.7, depth: DEPTH.VFX });
  scene.tweens.add({ targets: cloud, y: y - h * 0.9, scale: (w / 64) * 0.9, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => { if (cloud.scene) cloud.destroy(); } });
  sparks(scene, x, cy, 14, 360, 360);
  embers(scene, x, cy, 8, 160, -40);
  burst(scene, x, y - 8, FT.rock, 6, 800, {
    speed: { min: 180, max: 400 }, angle: { min: 215, max: 325 }, gravityY: 800, lifespan: { min: 500, max: 800 },
    scale: { start: 0.38, end: 0.18 }, alpha: { start: 1, end: 0 }, rotate: { min: 0, max: 360 }, blendMode: NORMAL,
  });
  smokePuff(scene, x, y - 20, 3, 1.1);
  shake(scene, 110, 0.005);
};

const phoenixBody: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.SUMMON);
  const glow = img(scene, FT.glow, 4, 0, { tint: C.orange, scale: 1.9, alpha: 0.5 });
  c.add(glow);
  loop(scene, c, { targets: glow, scale: 2.2, alpha: 0.38, duration: 380, yoyo: true, ease: 'Sine.easeInOut' });
  const body = scene.add.container(0, 0);
  // tail plumes (point back = -x)
  const plume = (x: number, y: number, rot: number, sx: number, sy: number, tint: number, dur: number) => {
    const f = img(scene, FT.flame, x, y, { tint, origin: [0.5, 1], sx, sy, rot: -Math.PI / 2 + rot });
    body.add(f);
    flick(scene, c, f, 1.3, dur, Math.floor(rnd(0, 100)));
  };
  plume(-20, 3, 0.35, 0.5, 0.95, C.red, 210);
  plume(-20, 0, 0, 0.6, 1.25, C.orange, 260);
  plume(-20, -3, -0.35, 0.5, 0.95, C.yellow, 230);
  // wings (back, then torso, then front)
  const wingB = img(scene, FT.wing, 1, -5, { tint: C.red, origin: [40 / 120, 0.92], scale: 0.78, alpha: 0.65 });
  body.add(wingB);
  const torso = img(scene, FT.comet, 18, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 0.6, sy: 0.95 });
  const torso2 = img(scene, FT.comet, 19, 0, { tint: C.yellow, origin: [0.875, 0.5], sx: 0.42, sy: 0.6 });
  const head = img(scene, FT.soft, 21, -4, { tint: C.white, scale: 0.34 });
  body.add([torso, torso2, head]);
  const g = scene.add.graphics();
  g.fillStyle(0xffe27a, 1); g.fillTriangle(28, -6, 42, -2, 28, 0);
  g.fillStyle(0x2a0a00, 1); g.fillCircle(24, -6, 1.7);
  body.add(g);
  const crest = img(scene, FT.flame, 17, -8, { tint: C.yellow, origin: [0.5, 1], scale: 0.24, rot: -0.5 });
  body.add(crest);
  flick(scene, c, crest, 1.4, 150);
  const wingF = img(scene, FT.wing, 5, -5, { tint: C.orange, origin: [40 / 120, 0.92], scale: 0.9, alpha: 0.92 });
  body.add(wingF);
  c.add(body);
  loop(scene, c, { targets: wingF, rotation: { from: -0.55, to: 1.35 }, duration: 270, yoyo: true, ease: 'Sine.easeInOut' });
  loop(scene, c, { targets: wingB, rotation: { from: -0.4, to: 1.2 }, duration: 270, delay: 40, yoyo: true, ease: 'Sine.easeInOut' });
  loop(scene, c, { targets: body, y: 5, duration: 540, yoyo: true, ease: 'Sine.easeInOut' });
  attachTrail(scene, c, FT.ember, 900, {
    speed: { min: 10, max: 55 }, lifespan: { min: 450, max: 900 }, scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 },
    frequency: 38, quantity: 1, tint: FIRE_TINTS, gravityY: 30, emitZone: zone(new Phaser.Geom.Ellipse(-12, 0, 44, 22)),
  });
  attachTrail(scene, c, FT.flame, 600, {
    speed: { min: 0, max: 20 }, lifespan: 520, scale: { start: 0.34, end: 0.05 }, alpha: { start: 0.55, end: 0 },
    frequency: 70, quantity: 1, tint: [C.orange, C.red],
    emitZone: zone(new Phaser.Geom.Ellipse(-14, 0, 34, 16)),
  }, DEPTH.VFX - 1);
  return c;
};

const phoenixBolt: VfxFn = (scene, o) => {
  const c = projContainer(scene, o);
  const glow = img(scene, FT.glow, 0, 0, { tint: C.orange, scale: 0.8, alpha: 0.8 });
  const tail = img(scene, FT.comet, 0, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 1.15, sy: 1.0, alpha: 0.9 });
  const inner = img(scene, FT.comet, 0, 0, { tint: C.yellow, origin: [0.875, 0.5], sx: 0.8, sy: 0.6 });
  const core = img(scene, FT.soft, 2, 0, { tint: C.white, scale: 0.34 });
  const wl = img(scene, FT.wing, -2, 0, { tint: C.orange, origin: [40 / 120, 0.92], scale: 0.4, alpha: 0.9 });
  const wr = img(scene, FT.wing, -2, 0, { tint: C.red, origin: [40 / 120, 0.92], scale: 0.36, alpha: 0.6 });
  c.add([glow, tail, inner, wr, wl, core]);
  loop(scene, c, { targets: wl, rotation: { from: -0.6, to: 1.0 }, duration: 150, yoyo: true });
  loop(scene, c, { targets: wr, rotation: { from: -0.45, to: 0.85 }, duration: 150, delay: 25, yoyo: true });
  flick(scene, c, tail, 1.2, 90);
  attachTrail(scene, c, FT.ember, 650, {
    speed: { min: 8, max: 50 }, lifespan: { min: 350, max: 650 }, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 },
    frequency: 20, quantity: 1, tint: FIRE_TINTS, gravityY: -30, emitZone: zone(ring(6)),
  });
  return c;
};

const ascensionCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  for (let i = 0; i < 4; i++) {
    const r = img(scene, FT.ring, x, y - 4, { tint: i % 2 ? C.yellow : C.orange, alpha: 0.9, scale: 0.2, depth: DEPTH.VFX_TOP });
    r.setScale(0.2, 0.08);
    scene.tweens.add({ targets: r, scaleX: 1.15, scaleY: 0.4, y: y - 4 - i * 26, duration: 520, delay: i * 90, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: r, alpha: 0, duration: 260, delay: i * 90 + 300, onComplete: () => { if (r.scene) r.destroy(); } });
  }
  const col = img(scene, FT.beam, x, y, { tint: C.gold, origin: [0, 0.5], rot: -Math.PI / 2, alpha: 0.85, depth: DEPTH.VFX });
  col.setScale(0.05, 1.1);
  scene.tweens.add({ targets: col, scaleX: 190 / 128, duration: 180, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: col, scaleY: 0.1, alpha: 0, duration: 520, delay: 200, onComplete: () => { if (col.scene) col.destroy(); } });
  flash(scene, x, y - 40, C.white, 150, 380, 0.9);
  flare(scene, x, y - 50, C.yellow, 110, 480);
  burst(scene, x, y - 6, FT.ember, 32, 1200, {
    speed: { min: 40, max: 150 }, angle: { min: 245, max: 295 }, gravityY: -80, lifespan: { min: 700, max: 1200 },
    scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, emitZone: zone(ring(26)),
  });
  shake(scene, 140, 0.002);
};

const ascensionAura: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.PLAYER - 1);
  const gg = img(scene, FT.soft, 0, -4, { tint: C.gold, sx: 2.0, sy: 0.45, alpha: 0.55 });
  c.add(gg);
  loop(scene, c, { targets: gg, alpha: 0.3, duration: 460, yoyo: true, ease: 'Sine.easeInOut' });
  // fiery wings behind the caster
  const wr = img(scene, FT.wing, 4, -38, { tint: C.orange, origin: [40 / 120, 0.92], scale: 0.72, alpha: 0.5, rot: 0.75 });
  const wl = img(scene, FT.wing, -4, -38, { tint: C.orange, origin: [40 / 120, 0.92], scale: 0.72, alpha: 0.5, rot: -0.75 });
  wl.setScale(-0.72, 0.72);
  c.add([wr, wl]);
  loop(scene, c, { targets: wr, rotation: { from: 0.55, to: 0.95 }, duration: 640, yoyo: true, ease: 'Sine.easeInOut' });
  loop(scene, c, { targets: wl, rotation: { from: -0.55, to: -0.95 }, duration: 640, yoyo: true, ease: 'Sine.easeInOut' });
  // halo
  const halo = img(scene, FT.ring, 0, -86, { tint: C.yellow, sx: 0.3, sy: 0.1, alpha: 0.9 });
  const haloGlow = img(scene, FT.soft, 0, -86, { tint: C.orange, sx: 0.8, sy: 0.25, alpha: 0.5 });
  c.add([haloGlow, halo]);
  loop(scene, c, { targets: halo, scaleX: 0.36, scaleY: 0.12, alpha: 0.6, duration: 500, yoyo: true, ease: 'Sine.easeInOut' });
  // orbiting flames on a flattened ellipse around the feet
  const flames: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < 6; i++) {
    const f = img(scene, FT.flame, 0, 0, { tint: i % 2 ? C.yellow : C.orange, origin: [0.5, 1], scale: 0.36 });
    flames.push(f);
    c.add(f);
  }
  const tw = scene.tweens.addCounter({
    from: 0, to: Math.PI * 2, duration: 1800, repeat: -1,
    onUpdate: (t) => {
      const v = t.getValue() ?? 0;
      flames.forEach((f, i) => {
        const a = v + (i / flames.length) * Math.PI * 2;
        f.setPosition(Math.cos(a) * 30, Math.sin(a) * 8 - 2);
        f.setScale(0.36 + Math.sin(a) * 0.04, 0.36 + 0.06 * Math.sin(a + v * 3));
        f.setAlpha(Math.sin(a) > 0 ? 1 : 0.55);
      });
    },
  });
  c.once(Phaser.GameObjects.Events.DESTROY, () => tw.stop());
  attachTrail(scene, c, FT.ember, 1000, {
    speedY: { min: -80, max: -35 }, speedX: { min: -18, max: 18 }, lifespan: { min: 700, max: 1000 }, scale: { start: 0.8, end: 0 },
    alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 80, quantity: 1,
    emitZone: zone(new Phaser.Geom.Ellipse(0, -30, 46, 60)),
  });
  return c;
};

// ───────────────────────────── registry ─────────────────────────────

export function registerFireVfx(): void {
  registerVfx('fire_cast', (scene, o) => { castFx(scene, o, o.scale ?? 1); });
  registerVfx('fire_cast_big', (scene, o) => { castFx(scene, o, 1.6 * (o.scale ?? 1)); });
  registerVfx('fire_hit', (scene, o) => { hitFx(scene, o.x, o.y, o.scale ?? 1); });
  registerVfx('fire_hit_big', (scene, o) => { hitFx(scene, o.x, o.y, 1.5 * (o.scale ?? 1)); });

  registerVfx('fire_arrow_proj', arrowProj);
  registerVfx('fire_burst_area', burstArea);
  registerVfx('fire_kindle_cast', kindleCast);
  registerVfx('fire_kindle_aura', kindleAura);

  registerVfx('fire_orb_proj', orbProj);
  registerVfx('fire_explosion', explosionArea);
  registerVfx('fire_pillar_area', pillarArea);
  registerVfx('fire_combust_cast', combustCast);
  registerVfx('fire_combust_hit', combustHit);
  registerVfx('fire_combust_area', combustArea);
  registerVfx('fire_salamander', salamanderBody);
  registerVfx('fire_spit_proj', spitProj);
  registerVfx('fire_spit_cast', spitCast);

  registerVfx('fire_lance_cast', lanceCast);
  registerVfx('fire_lance_beam', lanceBeam);
  registerVfx('fire_meteor_cast', meteorCast);
  registerVfx('fire_meteor_proj', meteorProj);
  registerVfx('fire_meteor_impact', meteorImpact);
  registerVfx('fire_phoenix', phoenixBody);
  registerVfx('fire_phoenix_bolt', phoenixBolt);
  registerVfx('fire_ascension_cast', ascensionCast);
  registerVfx('fire_ascension_aura', ascensionAura);
}

