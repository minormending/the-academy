// OWNER: A3 (fire-tree) / PX4 (pixel VFX). Fire textures + all `fire_*` VFX: 16-bit pixel sprite sheets (pxFx) over pixelized particles; procedural fallback when a sheet failed to load.
import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import { maybeServices } from '../core/services';
import { pxFx, pxLoop } from '../art/particles';
import { defineSchool, lazyRegister, scheduleIdle } from '../art/lazy';
import type { VfxFn, VfxOptions } from '../core/types';
import { generateFireTextures as genTextures, FT } from './fire/textures';
import { generateFireSheets, fpx, fpxLoop } from './fire/sheets';
import { registerFirePhase9Vfx } from './fire/vfx9';
import {
  ADD, NORMAL, C, FIRE_TINTS, HOT_TINTS, ALIGN, img, tk, loop, shake, shock, flash, flare,
  burst, stream, attachTrail, tongue, zone,
} from './fire/fx';

function buildFire(scene: Phaser.Scene): void {
  genTextures(scene);
  generateFireSheets(scene);
}

/** Boot hook: textures/sheets are built on first fire VFX (or in the background while on the Title screen). */
export function generateFireTextures(scene: Phaser.Scene): void { scheduleIdle(scene, 'fire', buildFire); }

defineSchool('fire', buildFire);
const registerVfx = lazyRegister('fire', buildFire);

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
  // pixel impact: small blast for normal hits, flame lash for big ones
  const sp = s >= 1.3
    ? pxFx(scene, 'cm_flamelash', x, y, { scale: 2, dur: 420, depth: DEPTH.VFX_TOP })
    : pxFx(scene, 'ex1', x, y, { scale: 2, dur: 300, depth: DEPTH.VFX_TOP });
  sparks(scene, x, y, Math.round(5 * s), 170 * s, 260);
  if (sp) { flash(scene, x, y, C.orange, 40 * s, 140, 0.6); return; }
  flash(scene, x, y, C.orange, 64 * s, 190, 0.95);
  flash(scene, x, y, C.white, 30 * s, 120, 1);
  flare(scene, x, y, C.yellow, 46 * s, 220);
  tongue(scene, x, y + 16 * s, C.orange, 24 * s, 52 * s, 0, 360);
}

/** Cast flare at the staff. */
function castFx(scene: Phaser.Scene, o: VfxOptions, s = 1): void {
  const { x, y, facing: f } = o;
  const sp = pxFx(scene, s >= 1.5 ? 'ex6' : 'sf_boom', x + f * 4, y, { scale: 2, dur: s >= 1.5 ? 380 : 260, add: true, depth: DEPTH.VFX_TOP });
  if (!sp) {
    flash(scene, x, y, C.orange, 78 * s, 260, 0.9);
    flash(scene, x + f * 6 * s, y, C.white, 36 * s, 170, 1);
    flare(scene, x, y, C.yellow, 64 * s, 280);
  } else flash(scene, x, y, C.orange, 44 * s, 200, 0.6);
  burst(scene, x, y, FT.ember, Math.round(7 * s), 560, {
    speed: { min: 60, max: 210 * s }, angle: sideAngle(f, 38), lifespan: { min: 300, max: 540 },
    scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS,
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
  // pixel fireball blast + a few satellite pops
  const main = pxFx(scene, 'ex2', x, y, { scale: power >= 1.8 ? 4 : 2, depth: DEPTH.VFX });
  if (main) {
    const extra = Math.round(1 + power);
    for (let i = 0; i < extra; i++) {
      pxFx(scene, 'ex6', x + rnd(-0.38, 0.38) * w, y + rnd(-0.3, 0.25) * h, { scale: 2, delay: 40 + i * 70, depth: DEPTH.VFX_TOP });
    }
    flash(scene, x, y, C.white, size * 0.6, 160, 0.7);
  } else {
    flash(scene, x, y, C.white, size * 1.0, 240, 1);
    flash(scene, x, y, C.orange, size * 1.7, 440, 0.85, DEPTH.VFX, FT.soft);
    const n = Math.round(3 + power * 3);
    const tints = [C.orange, C.yellow, C.red];
    for (let i = 0; i < n; i++) {
      tongue(scene, x + rnd(-0.4, 0.4) * w, y + h * 0.42, tints[i % 3], w * 0.2, h * rnd(0.6, 1.1), i * 28, 440);
    }
  }
  shock(scene, x, y + h * 0.3, C.orange, w * 1.2, 400, 0.5);
  sparks(scene, x, y, Math.round(10 * power), 400);
  embers(scene, x, y, Math.round(6 * power), 190);
  smokePuff(scene, x, y + h * 0.2, Math.round(2 * power));
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
  const ball = pxLoop(scene, c, 'sf_fireball', 0, 0, { scale: 2 });
  if (!ball) {
    const glow = img(scene, FT.glow, 0, 0, { tint: C.orange, scale: 0.5 * s, alpha: 0.8 });
    const tail = img(scene, FT.comet, 0, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 0.95 * s, sy: 0.75 * s, alpha: 0.9 });
    const inner = img(scene, FT.comet, 0, 0, { tint: C.yellow, origin: [0.875, 0.5], sx: 0.6 * s, sy: 0.45 * s });
    const core = img(scene, FT.soft, 2 * s, 0, { tint: C.white, scale: 0.22 * s });
    c.add([glow, tail, inner, core]);
    flick(scene, c, tail, 1.25, 80);
  }
  attachTrail(scene, c, FT.ember, 560, {
    speed: { min: 5, max: 40 }, lifespan: { min: 350, max: 560 }, scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 }, frequency: 30, quantity: 1, tint: FIRE_TINTS, gravityY: -40,
    emitZone: zone(ring(5)),
  });
  return c;
};

const burstArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 190, 110);
  const f = o.facing;
  const sx = o.x - f * w * 0.5;            // caster side
  const by = o.y + h * 0.36;               // flame base
  let sprites = 0;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const fx = sx + f * (w * 0.12 + t * w * 0.82);
    const big = i >= 2 && i <= 4;
    if (pxFx(scene, 'cm_brightfire', fx, by + 4, { scale: 2, oy: 1, flipX: f < 0, delay: i * 35, dur: 460, depth: big ? DEPTH.VFX_TOP : DEPTH.VFX })) sprites++;
  }
  if (pxFx(scene, 'cm_flamelash', o.x + f * w * 0.3, o.y, { scale: 2, flipX: f < 0, delay: 120, dur: 420, depth: DEPTH.VFX_TOP })) sprites++;
  if (!sprites) {
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      tongue(scene, sx + f * (w * 0.1 + t * w * 0.85), by + rnd(-4, 4), [C.orange, C.yellow, C.red][i % 3],
        w * 0.16, h * (0.75 + 0.45 * Math.sin(t * Math.PI)) * rnd(0.9, 1.15), i * 26, 420);
    }
  }
  burst(scene, sx, o.y + h * 0.1, FT.flame, 14, 360, {
    speed: { min: 260, max: 460 }, angle: sideAngle(f, 15), lifespan: { min: 220, max: 360 },
    scale: { start: 0.35, end: 0.75 }, alpha: { start: 0.9, end: 0 }, tint: FIRE_TINTS,
    rotate: { onUpdate: (p) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) + 90 },
  });
  sparks(scene, o.x + f * w * 0.2, o.y, 8, 300, 200);
  smokePuff(scene, o.x, by - 10, 2, 0.7);
  shake(scene, 80, 0.002);
};

const kindleCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  shock(scene, x, y - 4, C.orange, 130, 460, 0.32);
  const spin = pxFx(scene, 'cm_firespin', x, y - 36, { scale: 2, dur: 640, depth: DEPTH.VFX_TOP });
  if (!spin) {
    flash(scene, x, y - 30, C.orange, 120, 420, 0.7);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      tongue(scene, x + Math.cos(a) * 34, y - 2 + Math.sin(a) * 9, i % 2 ? C.yellow : C.orange, 14, rnd(46, 72), i * 18, 520);
    }
  }
  for (let i = 0; i < 3; i++) pxFx(scene, 'sf_flame', x + (i - 1) * 22, y - 8, { scale: 2, oy: 1, delay: i * 60, fps: 10, depth: DEPTH.VFX_TOP });
  burst(scene, x, y - 10, FT.ember, 16, 1000, {
    speed: { min: 30, max: 110 }, angle: { min: 250, max: 290 }, gravityY: -70, lifespan: { min: 600, max: 1000 },
    scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, emitZone: zone(ring(22)),
  });
};

const kindleAura: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  const orbit = scene.add.container(0, -30);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const wx = Math.round(Math.cos(a) * 24), wy = Math.round(Math.sin(a) * 24);
    const fl = pxFx(scene, 'sf_flame_s', wx, wy, { scale: 2, loop: true, randomStart: true });
    if (fl) orbit.add(fl);
    else orbit.add(img(scene, FT.flame, wx, wy + 4, { tint: C.orange, origin: [0.5, 1], scale: 0.28, rot: a + Math.PI / 2 }));
  }
  c.add(orbit);
  // orbit the flames upright (rotate the positions, not the sprites)
  const flames = orbit.list as unknown as Phaser.GameObjects.Components.Transform[];
  const tw = scene.tweens.addCounter({
    from: 0, to: Math.PI * 2, duration: 2400, repeat: -1,
    onUpdate: (t) => {
      const v = t.getValue() ?? 0;
      flames.forEach((fl, i) => {
        const a = v + (i / flames.length) * Math.PI * 2;
        fl.x = Math.round(Math.cos(a) * 26); fl.y = Math.round(Math.sin(a) * 8);
      });
    },
  });
  c.once(Phaser.GameObjects.Events.DESTROY, () => tw.stop());
  attachTrail(scene, c, FT.ember, 900, {
    speedY: { min: -60, max: -25 }, speedX: { min: -15, max: 15 }, lifespan: { min: 600, max: 900 }, scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 160, quantity: 1,
    emitZone: zone(new Phaser.Geom.Ellipse(0, -10, 40, 30)),
  });
  return c;
};

// ───────────────────────────── Tier 3 ─────────────────────────────

const orbProj: VfxFn = (scene, o) => {
  const s = o.scale ?? 1;
  const c = projContainer(scene, o);
  const ball = pxLoop(scene, c, 'ss_fireball', -30, 0, { scale: 2 });
  if (!ball) {
    const halo = img(scene, FT.glow, 0, 0, { tint: C.orange, scale: 0.95 * s, alpha: 0.75 });
    const tail = img(scene, FT.comet, 0, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 1.2 * s, sy: 1.0 * s, alpha: 0.75 });
    const body = img(scene, FT.soft, 0, 0, { tint: C.gold, scale: 0.62 * s });
    const core = img(scene, FT.soft, 0, 0, { tint: C.white, scale: 0.32 * s });
    c.add([halo, tail, body, core]);
    flick(scene, c, tail, 1.2, 90);
  }
  attachTrail(scene, c, FT.ember, 700, {
    speed: { min: 10, max: 60 }, lifespan: { min: 380, max: 700 }, scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 }, frequency: 26, quantity: 1, tint: FIRE_TINTS, gravityY: -30,
    emitZone: zone(ring(7)),
  });
  attachTrail(scene, c, FT.smoke, 560, {
    speed: { min: 0, max: 20 }, lifespan: 500, scale: { start: 0.3, end: 0.8 }, alpha: { start: 0.3, end: 0 },
    frequency: 60, quantity: 1, tint: C.smoke, blendMode: NORMAL,
  }, DEPTH.VFX - 1);
  return c;
};

const explosionArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 200, 150);
  explosion(scene, o.x, o.y, w, h, 1.3);
};

/**
 * Ground surface under (x, y): aoe_target areas are centred on the target's body, not its feet, so
 * ground-anchored effects look up the walkable surface just below instead of guessing from the area height.
 */
function groundBelow(x: number, y: number, fallback: number, maxDown = 180): number {
  try {
    const map = maybeServices()?.game.currentMap();
    // Nearest surface at/below y (scan down in 4px steps; platformAt only matches within ±tolerance).
    if (map) for (let dy = 0; dy <= maxDown; dy += 4) { const p = map.platformAt(x, y + dy, 2); if (p) return p.y; }
  } catch { /* no map */ }
  return fallback;
}

const pillarArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 170, 260);
  const x = o.x, gy = o.groundY ?? groundBelow(o.x, o.y, o.y + h / 2);
  shock(scene, x, gy - 2, C.orange, w * 1.3, 420, 0.3);
  shock(scene, x, gy - 2, C.yellow, w * 0.8, 320, 0.3, 0.8, 70);
  // pixel flame columns: a tall 4× core flanked by 2× columns, plus a ground blast
  const k = h >= 220 ? 4 : 2;
  const core = pxFx(scene, 'cm_fire', x, gy + 6, { scale: k, oy: 1, dur: 760, depth: DEPTH.VFX_TOP });
  if (core) {
    pxFx(scene, 'cm_fire', x - w * 0.3, gy + 4, { scale: 2, oy: 1, dur: 700, delay: 60, depth: DEPTH.VFX });
    pxFx(scene, 'cm_fire', x + w * 0.3, gy + 4, { scale: 2, oy: 1, dur: 700, delay: 110, depth: DEPTH.VFX });
    pxFx(scene, 'ex3', x, gy + 4, { scale: 2, oy: 1, dur: 520, depth: DEPTH.VFX });
  } else {
    const col = img(scene, FT.beam, x, gy, { tint: C.yellow, origin: [0, 0.5], rot: -Math.PI / 2, alpha: 0.9, depth: DEPTH.VFX });
    const len = (h * 1.05) / 128;
    col.setScale(0.05, (w * 0.7) / 64);
    scene.tweens.add({ targets: col, scaleX: len, duration: 170, ease: 'Cubic.easeOut' });
    scene.tweens.add({
      targets: col, scaleY: (w * 0.3) / 64, alpha: 0, duration: 460, delay: 230, ease: 'Quad.easeIn',
      onComplete: () => { if (col.scene) col.destroy(); },
    });
    const dxs = [-0.24, 0, 0.24, -0.12, 0.12];
    dxs.forEach((d, i) => tongue(scene, x + d * w, gy, [C.orange, C.red, C.orange, C.yellow, C.yellow][i], w * (i < 3 ? 0.42 : 0.3), h * (i === 1 ? 1.15 : rnd(0.8, 1)), i * 20, 700));
  }
  stream(scene, x, gy, FT.ember, 450, 700, {
    speedY: { min: -170, max: -90 }, speedX: { min: -30, max: 30 }, lifespan: { min: 450, max: 700 },
    scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 24, quantity: 1,
    emitZone: zone(new Phaser.Geom.Rectangle(-w * 0.25, -h * 0.5, w * 0.5, h * 0.5)),
  });
  sparks(scene, x, gy - 20, 10, 320, 240);
  smokePuff(scene, x, gy - h * 0.7, 3, 1);
  shake(scene, 130, 0.004);
};

const combustCast: VfxFn = (scene, o) => {
  castFx(scene, o, 1.6);
  pxFx(scene, 'cm_vortex', o.x, o.y, { scale: 2, dur: 300, add: true, depth: DEPTH.VFX_TOP });
};

const combustHit: VfxFn = (scene, o) => {
  hitFx(scene, o.x, o.y, 1.5);
  flash(scene, o.x, o.y, C.red, 120, 280, 0.8);
};

const combustArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 260, 180);
  const { x, y } = o;
  // 1. implosion: a red pixel vortex collapses while sparks rush inward
  const vx = pxFx(scene, 'cm_vortex', x, y, { scale: 2, dur: 260, add: true, depth: DEPTH.VFX_TOP });
  if (!vx) {
    const r = img(scene, FT.ring, x, y, { tint: C.white, alpha: 0.9, scale: (w / 128) * 1.3, sy: ((w / 128) * 1.3) * (h / w) * 1.2 });
    scene.tweens.add({ targets: r, scale: 0.12, alpha: 1, duration: 170, ease: 'Cubic.easeIn', onComplete: () => { if (r.scene) r.destroy(); } });
  }
  const em = scene.add.particles(x, y, tk(scene, FT.spark), {
    emitting: false, blendMode: ADD, moveToX: x, moveToY: y, lifespan: 170, scale: { start: 1, end: 0.5 },
    alpha: { start: 0.2, end: 1 }, tint: HOT_TINTS, rotate: ALIGN,
    emitZone: zone(new Phaser.Geom.Ellipse(0, 0, w * 1.2, h * 1.2), 'edge', 16),
  });
  em.setDepth(DEPTH.VFX);
  em.explode(16);
  scene.time.delayedCall(320, () => { if (em.scene) em.destroy(); });
  // 2. the big pixel mushroom blast + chain of detonations
  scene.time.delayedCall(170, () => {
    if (!pxFx(scene, 'ex4', x, y + h * 0.5, { scale: 2, oy: 1, depth: DEPTH.VFX_TOP })) {
      flash(scene, x, y, C.white, Math.max(w, h) * 1.6, 220, 1);
    }
    explosion(scene, x, y, w, h, 1.6);
    shock(scene, x, y + h * 0.35, C.red, w * 1.6, 560, 0.45, 0.8, 40);
  });
  for (let i = 0; i < 3; i++) {
    scene.time.delayedCall(250 + i * 75, () => {
      explosion(scene, x + rnd(-0.32, 0.32) * w, y + rnd(-0.25, 0.2) * h, w * 0.5, h * 0.5, 0.7, false);
    });
  }
  scene.time.delayedCall(170, () => shake(scene, 220, 0.008));
};

const salamanderBody: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.SUMMON);
  const body = scene.add.container(0, 0);
  // pixel fire lizard (teasloth's komodo, palette-swapped to the fire ramp); source faces left → flipX
  const liz = pxFx(scene, 'komodo', 0, 4, { v: 'fire', scale: 2, loop: true, flipX: true });
  if (liz) {
    body.add(liz);
    const tuft = pxFx(scene, 'sf_flame_s', -4, 2, { scale: 2, oy: 1, loop: true, randomStart: true, alpha: 0.9 });
    if (tuft) body.add(tuft);
  } else {
    const g = scene.add.graphics();
    g.fillStyle(0xa82612, 1); g.fillTriangle(-16, -7, -16, 8, -58, -12);
    g.fillStyle(0x8a1d0e, 1);
    for (const lx of [-14, 12]) { g.fillEllipse(lx - 3, 11, 11, 8); g.fillEllipse(lx + 7, 10, 11, 7); }
    g.fillStyle(0xc2321a, 1); g.fillEllipse(0, 0, 52, 25);
    g.fillStyle(0xd9431e, 1); g.fillEllipse(28, -3, 25, 18);
    g.fillStyle(0xfff0a0, 1); g.fillCircle(31, -7, 3.3);
    body.add(g);
  }
  c.add(body);
  loop(scene, c, { targets: body, y: -2, duration: 700, yoyo: true, ease: 'Stepped', easeParams: [2] });
  attachTrail(scene, c, FT.ember, 900, {
    speedY: { min: -50, max: -20 }, speedX: { min: -12, max: 12 }, lifespan: { min: 500, max: 900 }, scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 140, quantity: 1,
    emitZone: zone(new Phaser.Geom.Rectangle(-24, -16, 48, 10)),
  });
  return c;
};

const spitProj: VfxFn = (scene, o) => {
  const c = projContainer(scene, o);
  if (!pxLoop(scene, c, 'sf_fireball', 0, 0, { scale: 2 })) {
    const glow = img(scene, FT.glow, 0, 0, { tint: C.orange, scale: 0.42, alpha: 0.8 });
    const tail = img(scene, FT.comet, 0, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 0.5, sy: 0.55 });
    const core = img(scene, FT.soft, 0, 0, { tint: C.yellow, scale: 0.26 });
    c.add([glow, tail, core]);
  }
  attachTrail(scene, c, FT.ember, 500, {
    speed: { min: 5, max: 35 }, lifespan: { min: 280, max: 500 }, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 },
    frequency: 40, quantity: 1, tint: FIRE_TINTS, gravityY: -30, emitZone: zone(ring(4)),
  });
  return c;
};

const spitCast: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  if (!pxFx(scene, 'sf_boom', x + f * 4, y, { scale: 2, dur: 220, add: true, depth: DEPTH.VFX_TOP })) {
    flash(scene, x, y, C.orange, 44, 180, 0.9);
    flash(scene, x + f * 4, y, C.white, 20, 120, 1);
  }
  burst(scene, x, y, FT.ember, 4, 420, {
    speed: { min: 40, max: 140 }, angle: sideAngle(f, 28), lifespan: { min: 220, max: 400 },
    scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS,
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
  // chunky pixel beam (beam texture is pixelized; thickness snapped to the 4px grid)
  const snap = (v: number) => Math.max(4, Math.round(v / 4) * 4);
  const mk = (tint: number, thick: number, alpha: number, depth: number, life: number, delay: number) => {
    const b = img(scene, FT.beam, sx, sy, { tint, origin: [0, 0.5], rot: ang, alpha, depth });
    b.setScale(len / 128, snap(thick) / 64);
    b.setAlpha(0);
    scene.tweens.add({ targets: b, alpha, duration: 50, delay });
    scene.tweens.add({
      targets: b, alpha: 0, duration: life, delay: delay + 160, ease: 'Stepped', easeParams: [4],
      onComplete: () => { if (b.scene) b.destroy(); },
    });
  };
  mk(C.red, th * 1.3, 0.6, DEPTH.VFX - 1, 360, 0);
  mk(C.orange, th * 0.85, 0.9, DEPTH.VFX, 340, 0);
  mk(C.white, th * 0.32, 1, DEPTH.VFX_TOP, 300, 10);
  // rolling pixel blasts along the beam
  const n = Math.min(8, Math.max(3, Math.round(len / 70)));
  let sprites = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    if (pxFx(scene, i % 2 ? 'ex6' : 'ex1', sx + (tx - sx) * t + rnd(-6, 6), sy + (ty - sy) * t + rnd(-th * 0.2, th * 0.2), { scale: 2, delay: i * 40, depth: DEPTH.VFX_TOP })) sprites++;
  }
  if (!sprites) {
    const em = scene.add.particles(0, 0, tk(scene, FT.flame), {
      emitting: false, blendMode: ADD, speedY: { min: -60, max: -20 }, speedX: 0, lifespan: { min: 280, max: 520 },
      scale: { start: 0.42, end: 0.08 }, alpha: { start: 0.8, end: 0 }, tint: FIRE_TINTS,
      emitZone: zone(new Phaser.Geom.Line(sx, sy, tx, ty)),
    });
    em.setDepth(DEPTH.VFX);
    em.explode(Math.min(40, Math.round(len / 12)));
    scene.time.delayedCall(900, () => { if (em.scene) em.destroy(); });
  }
  const em2 = scene.add.particles(0, 0, tk(scene, FT.ember), {
    emitting: false, blendMode: ADD, speed: { min: 30, max: 130 }, angle: { min: 0, max: 360 }, gravityY: -40,
    lifespan: { min: 400, max: 800 }, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS,
    emitZone: zone(new Phaser.Geom.Line(sx, sy, tx, ty)),
  });
  em2.setDepth(DEPTH.VFX);
  em2.explode(18);
  scene.time.delayedCall(900, () => { if (em2.scene) em2.destroy(); });
  pxFx(scene, 'cm_flamelash', tx, ty, { scale: 2, dur: 380, depth: DEPTH.VFX_TOP });
  flash(scene, sx, sy, C.white, 70, 200, 0.8);
  sparks(scene, tx, ty, 8, 320, 260);
  shake(scene, 110, 0.003);
};

const meteorCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  const gx = x - o.facing * 18, gy = y + 34;
  castFx(scene, o, 1.8);
  shock(scene, gx, gy, C.red, 260, 600, 0.3, 0.9);
  shock(scene, gx, gy, C.orange, 190, 500, 0.3, 0.9, 90);
  // fiery sigil above the caster
  if (!pxFx(scene, 'cm_firespin', gx, gy - 84, { scale: 2, dur: 700, depth: DEPTH.VFX_TOP })) {
    const sg = img(scene, FT.star, gx, gy - 84, { tint: C.orange, alpha: 0.9, depth: DEPTH.VFX_TOP });
    sg.setScale(0.2);
    scene.tweens.add({ targets: sg, scale: 1.9, rotation: 1.6, duration: 600, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: sg, alpha: 0, duration: 260, delay: 420, onComplete: () => { if (sg.scene) sg.destroy(); } });
  }
  pxFx(scene, 'cm_ring', gx, gy - 84, { v: 'fire', scale: 4, add: true, delay: 200, depth: DEPTH.VFX_TOP });
  burst(scene, gx, gy, FT.ember, 20, 1100, {
    speed: { min: 40, max: 160 }, angle: { min: 245, max: 295 }, gravityY: -90, lifespan: { min: 600, max: 1100 },
    scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, emitZone: zone(ring(30)),
  });
  shake(scene, 160, 0.003);
};

const meteorProj: VfxFn = (scene, o) => {
  const s = (o.scale ?? 1) * rnd(0.9, 1.2);
  const c = projContainer(scene, o);
  // rolling pixel fireball (rotationally symmetric, so the engine's heading rotation reads fine)
  const ball = pxLoop(scene, c, 'cm_sunburn', 0, 0, { scale: 2, randomStart: true });
  if (ball) {
    const rock = img(scene, FT.rock, 4, 0, { add: false, scale: 1 });
    c.add(rock);
    loop(scene, c, { targets: rock, angle: 360, duration: 650, ease: 'Stepped', easeParams: [8] });
  } else {
    const halo = img(scene, FT.glow, 0, 0, { tint: 0xff4a10, scale: 1.5 * s, alpha: 0.7 });
    const tail = img(scene, FT.comet, 0, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 2.3 * s, sy: 1.5 * s, alpha: 0.75 });
    const rock = img(scene, FT.rock, 0, 0, { add: false, scale: 0.95 * s });
    c.add([halo, tail, rock]);
    loop(scene, c, { targets: rock, rotation: Math.PI * 2, duration: 650, ease: 'Linear' });
  }
  attachTrail(scene, c, FT.ember, 720, {
    speed: { min: 20, max: 70 }, lifespan: { min: 350, max: 720 }, scale: { start: 1.5, end: 0.5 }, alpha: { start: 1, end: 0 },
    frequency: 24, quantity: 1, tint: FIRE_TINTS, gravityY: -20, emitZone: zone(ring(14 * s)),
  });
  attachTrail(scene, c, FT.smoke, 720, {
    speed: { min: 0, max: 25 }, lifespan: 700, scale: { start: 0.5 * s, end: 1.2 * s }, alpha: { start: 0.35, end: 0 },
    frequency: 60, quantity: 1, tint: C.smoke, blendMode: NORMAL,
  }, DEPTH.VFX - 1);
  return c;
};

const meteorImpact: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 190, 120);
  const { x, y } = o;                       // ground point
  const cy = y - h * 0.35;
  shock(scene, x, y - 2, C.orange, w * 1.25, 420, 0.32);
  // pixel mushroom blast rising from the ground
  const boom = pxFx(scene, 'ex4', x, y + 6, { scale: 2, oy: 1, depth: DEPTH.VFX });
  // scorch mark
  const sc = img(scene, FT.scorch, x, y - 1, { tint: 0x120603, add: false, alpha: 0, depth: DEPTH.VFX - 2 });
  sc.setScale(Math.max(1, Math.round((w * 1.15) / 128)), 1);
  scene.tweens.add({ targets: sc, alpha: 0.75, duration: 90 });
  scene.tweens.add({ targets: sc, alpha: 0, duration: 1500, delay: 700, onComplete: () => { if (sc.scene) sc.destroy(); } });
  if (!boom) {
    flash(scene, x, cy, C.white, w * 0.9, 220, 1);
    flash(scene, x, cy, C.orange, w * 1.5, 420, 0.85, DEPTH.VFX, FT.soft);
    for (let i = 0; i < 5; i++) {
      tongue(scene, x + rnd(-0.38, 0.38) * w, y, [C.orange, C.yellow, C.red][i % 3], w * 0.17, h * rnd(0.7, 1.25), i * 22, 620);
    }
  } else {
    pxFx(scene, 'cm_brightfire', x - w * 0.3, y + 4, { scale: 2, oy: 1, delay: 120, dur: 700 });
    pxFx(scene, 'cm_brightfire', x + w * 0.28, y + 4, { scale: 2, oy: 1, delay: 180, dur: 700, flipX: true });
  }
  sparks(scene, x, cy, 10, 360, 360);
  burst(scene, x, y - 8, FT.rock, 4, 800, {
    speed: { min: 180, max: 400 }, angle: { min: 215, max: 325 }, gravityY: 800, lifespan: { min: 500, max: 800 },
    scale: { start: 0.5, end: 0.25 }, alpha: { start: 1, end: 0 }, rotate: { min: 0, max: 360 }, blendMode: NORMAL,
  });
  smokePuff(scene, x, y - 20, 2, 1.1);
  shake(scene, 110, 0.005);
};

const phoenixBody: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.SUMMON);
  const body = scene.add.container(0, 0);
  // pixel phoenix (Chasersgaming), faces +x
  const bird = pxFx(scene, 'phoenix', 0, 0, { scale: 2, loop: true });
  if (bird) body.add(bird);
  else {
    const torso = img(scene, FT.comet, 18, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 0.6, sy: 0.95 });
    const wingF = img(scene, FT.wing, 5, -5, { tint: C.orange, origin: [40 / 120, 0.92], scale: 0.9, alpha: 0.92 });
    body.add([torso, wingF]);
    loop(scene, c, { targets: wingF, rotation: { from: -0.55, to: 1.35 }, duration: 270, yoyo: true, ease: 'Sine.easeInOut' });
  }
  c.add(body);
  loop(scene, c, { targets: body, y: 4, duration: 540, yoyo: true, ease: 'Stepped', easeParams: [2] });
  attachTrail(scene, c, FT.ember, 900, {
    speed: { min: 10, max: 55 }, lifespan: { min: 450, max: 900 }, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 },
    frequency: 60, quantity: 1, tint: FIRE_TINTS, gravityY: 30, emitZone: zone(new Phaser.Geom.Ellipse(-12, 0, 44, 22)),
  });
  return c;
};

const phoenixBolt: VfxFn = (scene, o) => {
  const c = projContainer(scene, o);
  if (!pxLoop(scene, c, 'sf_bigfireball', 0, 0, { scale: 2 })) {
    const glow = img(scene, FT.glow, 0, 0, { tint: C.orange, scale: 0.8, alpha: 0.8 });
    const tail = img(scene, FT.comet, 0, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 1.15, sy: 1.0, alpha: 0.9 });
    c.add([glow, tail]);
  }
  attachTrail(scene, c, FT.ember, 650, {
    speed: { min: 8, max: 50 }, lifespan: { min: 350, max: 650 }, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 },
    frequency: 30, quantity: 1, tint: FIRE_TINTS, gravityY: -30, emitZone: zone(ring(6)),
  });
  return c;
};

const ascensionCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  for (let i = 0; i < 3; i++) {
    if (!pxFx(scene, 'cm_ring', x, y - 20 - i * 30, { v: 'fire', scale: 2, add: true, delay: i * 90, depth: DEPTH.VFX_TOP })) {
      const r = img(scene, FT.ring, x, y - 4, { tint: i % 2 ? C.yellow : C.orange, alpha: 0.9, scale: 0.2, depth: DEPTH.VFX_TOP });
      scene.tweens.add({ targets: r, scale: 0.6, y: y - 4 - i * 26, alpha: 0, duration: 520, delay: i * 90, onComplete: () => { if (r.scene) r.destroy(); } });
    }
  }
  if (!pxFx(scene, 'cm_fire', x, y + 6, { scale: 4, oy: 1, dur: 700, depth: DEPTH.VFX })) {
    flash(scene, x, y - 40, C.white, 150, 380, 0.9);
  }
  pxFx(scene, 'cm_firespin', x, y - 36, { scale: 2, dur: 640, delay: 120, depth: DEPTH.VFX_TOP });
  burst(scene, x, y - 6, FT.ember, 22, 1200, {
    speed: { min: 40, max: 150 }, angle: { min: 245, max: 295 }, gravityY: -80, lifespan: { min: 700, max: 1200 },
    scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, emitZone: zone(ring(26)),
  });
  shake(scene, 140, 0.002);
};

const ascensionAura: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.PLAYER - 1);
  // a slow ring of pixel fire behind the caster (CodeManu fire-spin); pixelized wings only as fallback
  const halo = pxLoop(scene, c, 'cm_firespin', 0, -36, { scale: 2, alpha: 0.5, fps: 14 });
  if (!halo) {
    const wr = img(scene, FT.wing, 4, -38, { tint: C.orange, origin: [40 / 120, 0.92], scale: 0.75, alpha: 0.6, rot: 0.75 });
    const wl = img(scene, FT.wing, -4, -38, { tint: C.orange, origin: [40 / 120, 0.92], scale: 0.75, alpha: 0.6, rot: -0.75 });
    wl.setScale(-0.75, 0.75);
    c.add([wr, wl]);
  }
  // pixel flames orbiting the feet on a flattened ellipse
  const flames: Phaser.GameObjects.Components.Transform[] = [];
  for (let i = 0; i < 5; i++) {
    const f = pxFx(scene, 'sf_flame_s', 0, 0, { scale: 2, oy: 1, loop: true, randomStart: true })
      ?? img(scene, FT.flame, 0, 0, { tint: i % 2 ? C.yellow : C.orange, origin: [0.5, 1], scale: 0.36 });
    flames.push(f);
    c.add(f);
  }
  const tw = scene.tweens.addCounter({
    from: 0, to: Math.PI * 2, duration: 1800, repeat: -1,
    onUpdate: (t) => {
      const v = t.getValue() ?? 0;
      flames.forEach((f, i) => {
        const a = v + (i / flames.length) * Math.PI * 2;
        f.x = Math.round(Math.cos(a) * 30); f.y = Math.round(Math.sin(a) * 8 - 2);
        (f as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(Math.sin(a) > 0 ? 1 : 0.55);
      });
    },
  });
  c.once(Phaser.GameObjects.Events.DESTROY, () => tw.stop());
  attachTrail(scene, c, FT.ember, 1000, {
    speedY: { min: -80, max: -35 }, speedX: { min: -18, max: 18 }, lifespan: { min: 700, max: 1000 }, scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 110, quantity: 1,
    emitZone: zone(new Phaser.Geom.Ellipse(0, -30, 46, 60)),
  });
  return c;
};

// ───────────────────────────── Phase 4: Year 2 additions ─────────────────────────────

/** Implosion: hot sparks rush from an ellipse edge into (x, y). */
function implode(scene: Phaser.Scene, x: number, y: number, rw: number, rh: number, n: number, life = 220): void {
  const em = scene.add.particles(x, y, tk(scene, FT.spark), {
    emitting: false, blendMode: ADD, moveToX: x, moveToY: y, lifespan: life, scale: { start: 1, end: 0.5 },
    alpha: { start: 0.25, end: 1 }, tint: HOT_TINTS, rotate: ALIGN,
    emitZone: zone(new Phaser.Geom.Ellipse(0, 0, rw, rh), 'edge', n),
  });
  em.setDepth(DEPTH.VFX_TOP);
  em.explode(n);
  scene.time.delayedCall(life + 150, () => { if (em.scene) em.destroy(); });
}

/** Flat scorch mark that fades out (ground effects). */
function scorchMark(scene: Phaser.Scene, x: number, gy: number, w: number, hold = 600): void {
  const sc = img(scene, FT.scorch, x, gy - 1, { tint: 0x120603, add: false, alpha: 0, depth: DEPTH.VFX - 2 });
  sc.setScale(Math.max(1, Math.round(w / 128)), 1);
  scene.tweens.add({ targets: sc, alpha: 0.7, duration: 80 });
  scene.tweens.add({ targets: sc, alpha: 0, duration: 1200, delay: hold, onComplete: () => { if (sc.scene) sc.destroy(); } });
}

const bombProj: VfxFn = (scene, o) => {
  const c = projContainer(scene, o);
  const bomb = fpxLoop(scene, c, 'bomb', 0, 0, { scale: 2 });
  if (bomb) {
    // tumble the bomb itself (child), never the root's scale
    loop(scene, c, { targets: bomb, angle: 360, duration: 520, ease: 'Stepped', easeParams: [8] });
  } else {
    const glow = img(scene, FT.glow, 0, 0, { tint: C.red, scale: 0.4, alpha: 0.8 });
    const core = img(scene, FT.rock, 0, 0, { add: false, scale: 0.5 });
    c.add([glow, core]);
    loop(scene, c, { targets: core, rotation: Math.PI * 2, duration: 520, ease: 'Linear' });
  }
  attachTrail(scene, c, FT.ember, 520, {
    speed: { min: 5, max: 30 }, lifespan: { min: 300, max: 520 }, scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 }, frequency: 40, quantity: 1, tint: FIRE_TINTS, gravityY: -30, emitZone: zone(ring(4)),
  });
  attachTrail(scene, c, FT.smoke, 500, {
    speed: { min: 0, max: 15 }, lifespan: 460, scale: { start: 0.2, end: 0.55 }, alpha: { start: 0.3, end: 0 },
    frequency: 70, quantity: 1, tint: C.smoke, blendMode: NORMAL,
  }, DEPTH.VFX - 1);
  return c;
};

const bombArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 170, 120);
  const { x, y } = o;
  // Gothicvania fire-bomb dome: grows from a point into a mushroom of flame anchored at the impact
  const dome = pxFx(scene, 'g9_firebomb', x, y + 18, { scale: 2, oy: 0.85, depth: DEPTH.VFX_TOP });
  if (dome) {
    pxFx(scene, 'ex1', x - w * 0.3, y + 6, { scale: 2, delay: 70, depth: DEPTH.VFX_TOP });
    pxFx(scene, 'ex1', x + w * 0.3, y + 2, { scale: 2, delay: 120, depth: DEPTH.VFX_TOP });
    flash(scene, x, y, C.orange, w * 0.7, 180, 0.6);
  } else {
    explosion(scene, x, y, w, h, 0.9, false);
  }
  shock(scene, x, y + h * 0.3, C.orange, w * 1.1, 360, 0.4);
  sparks(scene, x, y, 9, 300, 380);
  embers(scene, x, y, 6, 150);
  smokePuff(scene, x, y + 4, 2, 0.8);
  const gy = groundBelow(x, y, NaN, 70);
  if (Number.isFinite(gy)) scorchMark(scene, x, gy, w, 400);
  shake(scene, 90, 0.0025);
};

const dashOut: VfxFn = (scene, o) => {
  const { x, y } = o;
  const dir = Math.sign((o.targetX ?? x + o.facing) - x) || o.facing;
  if (!fpx(scene, 'whirl', x, y + 2, { scale: 4, oy: 1, dur: 360, depth: DEPTH.VFX_TOP })) {
    flash(scene, x, y - 30, C.orange, 90, 240, 0.9);
  }
  pxFx(scene, 'sf_boom', x, y - 28, { scale: 2, dur: 240, add: true, depth: DEPTH.VFX_TOP });
  smokePuff(scene, x, y - 16, 3, 0.9);
  burst(scene, x, y - 28, FT.ember, 12, 700, {
    speed: { min: 60, max: 220 }, angle: dir > 0 ? { min: 150, max: 210 } : { min: -30, max: 30 },
    lifespan: { min: 380, max: 700 }, scale: { start: 1.1, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS,
    emitZone: zone(new Phaser.Geom.Rectangle(-10, -26, 20, 52)),
  });
};

const dashTrail: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 230, 90);
  const f = o.facing;
  let sprites = 0;
  if (w >= h) {
    const gy = o.y + 34;                      // engine centres the area 34px above the feet line
    const n = Math.max(3, Math.round(w / 26));
    const x0 = o.x - f * (w / 2 - 14);
    for (let i = 0; i < n; i++) {
      const fx = x0 + f * ((w - 28) * (i / (n - 1)));
      if (pxFx(scene, 'cm_brightfire', fx, gy + 4, { scale: 2, oy: 1, flipX: i % 2 === 1, delay: i * 16, dur: 560, depth: i % 2 ? DEPTH.VFX : DEPTH.VFX_TOP })) sprites++;
    }
    if (!sprites) for (let i = 0; i < n; i++) tongue(scene, x0 + f * ((w - 28) * (i / (n - 1))), gy, FIRE_TINTS[i % 3], 18, rnd(36, 56), i * 16, 520);
    const sc = img(scene, FT.scorch, o.x, gy - 1, { tint: 0x120603, add: false, alpha: 0, depth: DEPTH.VFX - 2 });
    sc.setScale(Math.max(1, Math.round(w / 128)), 1);
    scene.tweens.add({ targets: sc, alpha: 0.65, duration: 80 });
    scene.tweens.add({ targets: sc, alpha: 0, duration: 900, delay: 500, onComplete: () => { if (sc.scene) sc.destroy(); } });
    stream(scene, o.x, gy - 6, FT.ember, 360, 700, {
      speedY: { min: -110, max: -40 }, speedX: { min: -20, max: 20 }, lifespan: { min: 400, max: 700 },
      scale: { start: 1, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 22, quantity: 1,
      emitZone: zone(new Phaser.Geom.Rectangle(-w / 2, -6, w, 8)),
    });
  } else {
    const n = Math.max(3, Math.round(h / 30));
    const y0 = o.y - h / 2 + 16;
    for (let i = 0; i < n; i++) {
      const fy = y0 + (h - 32) * (i / (n - 1));
      if (pxFx(scene, 'sf_flame', o.x + (i % 2 ? 6 : -6), fy, { scale: 2, delay: i * 20, fps: 10, depth: DEPTH.VFX_TOP })) sprites++;
    }
    if (!sprites) flash(scene, o.x, o.y, C.orange, h, 300, 0.8);
    stream(scene, o.x, o.y, FT.ember, 300, 600, {
      speed: { min: 10, max: 50 }, lifespan: { min: 300, max: 600 }, scale: { start: 1, end: 0.4 },
      alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 24, quantity: 1,
      emitZone: zone(new Phaser.Geom.Rectangle(-8, -h / 2, 16, h)),
    });
  }
};

const dashIn: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  if (!pxFx(scene, 'cm_flamelash', x + f * 6, y - 30, { scale: 2, flipX: f < 0, dur: 360, depth: DEPTH.VFX_TOP })) {
    flash(scene, x, y - 30, C.yellow, 80, 220, 0.9);
  }
  flash(scene, x, y - 30, C.orange, 60, 180, 0.6);
  shock(scene, x, y - 2, C.orange, 110, 320, 0.3);
  burst(scene, x, y - 4, FT.ember, 8, 600, {
    speed: { min: 40, max: 150 }, angle: { min: 200, max: 340 }, gravityY: 120, lifespan: { min: 300, max: 600 },
    scale: { start: 1, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS,
  });
};

const overheatCast: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  shock(scene, x, y - 2, C.red, 150, 420, 0.3);
  flash(scene, x, y - 32, C.red, 130, 320, 0.8);
  if (!pxFx(scene, 'cm_flamelash', x, y - 34, { scale: 2, flipX: f < 0, dur: 420, depth: DEPTH.VFX_TOP })) {
    flash(scene, x, y - 32, C.white, 60, 200, 1);
  }
  for (let i = 0; i < 4; i++) fpx(scene, 'mote', x + rnd(-22, 22), y - rnd(14, 60), { scale: 2, delay: i * 70, depth: DEPTH.VFX_TOP });
  // steam venting off the overheated body
  burst(scene, x, y - 40, FT.smoke, 5, 1000, {
    speed: { min: 20, max: 60 }, angle: { min: 240, max: 300 }, gravityY: -40, blendMode: NORMAL,
    lifespan: { min: 700, max: 1000 }, scale: { start: 0.3, end: 0.9 }, alpha: { start: 0.35, end: 0 }, tint: 0x7a5a50,
  }, DEPTH.VFX - 1);
  burst(scene, x, y - 30, FT.spark, 14, 700, {
    speed: { min: 120, max: 300 }, angle: { min: 0, max: 360 }, lifespan: { min: 300, max: 600 }, gravityY: 200,
    scale: { start: 1, end: 0.3 }, alpha: { start: 1, end: 0 }, tint: [C.red, C.orange, C.white], rotate: ALIGN,
  });
  shake(scene, 90, 0.002);
};

const overheatAura: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  // pulsing red heat under the feet
  const glow = img(scene, FT.glow, 0, -4, { tint: C.red, sx: 0.7, sy: 0.18, alpha: 0.45 });
  c.add(glow);
  loop(scene, c, { targets: glow, alpha: 0.15, duration: 380, yoyo: true, ease: 'Stepped', easeParams: [3] });
  // heat-shimmer motes hovering around the body
  const spots: [number, number][] = [[-20, -58], [18, -40], [-14, -22]];
  spots.forEach(([mx, my], i) => {
    const m = fpx(scene, 'mote', mx, my, { scale: 2, loop: true, randomStart: true, alpha: 0.85 });
    if (!m) return;
    c.add(m);
    loop(scene, c, { targets: m, y: my - 6, duration: 600 + i * 120, yoyo: true, ease: 'Stepped', easeParams: [3] });
  });
  attachTrail(scene, c, FT.spark, 600, {
    speedY: { min: -150, max: -80 }, speedX: { min: -10, max: 10 }, lifespan: { min: 300, max: 600 },
    scale: { start: 0.8, end: 0.3 }, alpha: { start: 0.9, end: 0 }, tint: [C.red, C.orange], frequency: 110, quantity: 1,
    rotate: ALIGN, emitZone: zone(new Phaser.Geom.Rectangle(-14, -56, 28, 50)),
  });
  return c;
};

// ───────────────────────────── Phase 4: Year 3 additions ─────────────────────────────

const volleyCast: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  if (!pxFx(scene, 'sf_boom', x + f * 4, y, { scale: 2, dur: 220, add: true, depth: DEPTH.VFX_TOP })) flash(scene, x, y, C.orange, 60, 200, 0.9);
  burst(scene, x, y, FT.spark, 10, 420, {
    speed: { min: 160, max: 320 }, angle: sideAngle(f, 22), lifespan: { min: 180, max: 340 },
    scale: { start: 1, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: HOT_TINTS, rotate: ALIGN,
  });
};

const volleyProj: VfxFn = (scene, o) => {
  const c = projContainer(scene, o);
  if (!fpxLoop(scene, c, 'dart', 0, 0, { scale: 2 })) {
    const tail = img(scene, FT.comet, 0, 0, { tint: C.orange, origin: [0.875, 0.5], sx: 0.45, sy: 0.4 });
    const core = img(scene, FT.soft, 0, 0, { tint: C.yellow, scale: 0.2 });
    c.add([tail, core]);
  }
  attachTrail(scene, c, FT.ember, 360, {
    speed: { min: 5, max: 25 }, lifespan: { min: 200, max: 360 }, scale: { start: 0.8, end: 0.3 },
    alpha: { start: 1, end: 0 }, frequency: 45, quantity: 1, tint: FIRE_TINTS,
  });
  return c;
};

const wallBody: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.SUMMON);
  const gy = 4; // feet line (container origin) + the sheets' transparent bottom rows
  // eruption as it rises (one-shot, scene level)
  pxFx(scene, 'ex3', o.x, o.y + 4, { scale: 2, oy: 1, dur: 480, depth: DEPTH.VFX });
  shock(scene, o.x, o.y - 2, C.orange, 200, 380, 0.3);
  const base = img(scene, FT.scorch, 0, -1, { tint: C.red, sx: 1, sy: 1, alpha: 0.55 });
  c.add(base);
  let cols = 0;
  const xs = [-44, 0, 44];
  xs.forEach((cx, i) => {
    const col = pxFx(scene, 'cm_fire', cx, gy, { scale: 2, oy: 1, loop: true, randomStart: true, flipX: i === 1 });
    if (!col) return;
    cols++;
    col.setAlpha(0);
    c.add(col);
    scene.tweens.add({ targets: col, alpha: 1, duration: 160, delay: i * 60 });
  });
  [-22, 22].forEach((cx) => {
    const f = pxFx(scene, 'sf_flame', cx, gy, { scale: 2, oy: 1, loop: true, randomStart: true });
    if (f) c.add(f);
  });
  if (!cols) {
    for (let i = 0; i < 5; i++) {
      const fl = img(scene, FT.flame, -48 + i * 24, 0, { tint: FIRE_TINTS[i % 3], origin: [0.5, 1], sx: 0.6, sy: 1.1 });
      c.add(fl);
      flick(scene, c, fl, 1.15, 120 + i * 20);
    }
  }
  loop(scene, c, { targets: base, alpha: 0.3, duration: 300, yoyo: true, ease: 'Stepped', easeParams: [3] });
  attachTrail(scene, c, FT.ember, 900, {
    speedY: { min: -150, max: -70 }, speedX: { min: -20, max: 20 }, lifespan: { min: 500, max: 900 },
    scale: { start: 1, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 45, quantity: 1,
    emitZone: zone(new Phaser.Geom.Rectangle(-60, -100, 120, 90)),
  });
  attachTrail(scene, c, FT.smoke, 1000, {
    speedY: { min: -60, max: -30 }, speedX: { min: -10, max: 10 }, lifespan: { min: 700, max: 1000 },
    scale: { start: 0.4, end: 1.1 }, alpha: { start: 0.25, end: 0 }, tint: C.smoke, frequency: 220, quantity: 1, blendMode: NORMAL,
    emitZone: zone(new Phaser.Geom.Rectangle(-50, -120, 100, 20)),
  }, DEPTH.VFX - 1);
  return c;
};

const wallPulse: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 140, 150);
  const gy = o.y + h / 2 - 15;              // area offsetY -60 → bottom ≈ feet
  flash(scene, o.x, gy - 50, C.orange, w * 0.9, 220, 0.45);
  pxFx(scene, 'cm_brightfire', o.x + rnd(-w * 0.3, w * 0.3), gy + 4, { scale: 2, oy: 1, dur: 420, depth: DEPTH.VFX_TOP });
};

const wardCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  if (!fpx(scene, 'ward', x, y - 32, { scale: 4, add: true, dur: 500, depth: DEPTH.VFX_TOP })) {
    shock(scene, x, y - 32, C.orange, 120, 420, 1);
  }
  shock(scene, x, y - 2, C.yellow, 140, 420, 0.3);
  flash(scene, x, y - 32, C.gold, 100, 300, 0.6);
  burst(scene, x, y - 32, FT.ember, 16, 900, {
    speed: { min: 50, max: 120 }, angle: { min: 0, max: 360 }, gravityY: -40, lifespan: { min: 500, max: 900 },
    scale: { start: 1, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, emitZone: zone(ring(30), 'edge', 16),
  });
};

const wardAura: VfxFn = (scene, o) => {
  // behind the caster so the ring frames the body instead of covering it
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.PLAYER - 1);
  const r = fpxLoop(scene, c, 'ward', 0, -30, { scale: 2, alpha: 0.75, fps: 10 });
  if (!r) {
    const rr = img(scene, FT.ring, 0, -30, { tint: C.orange, scale: 0.6, alpha: 0.4 });
    c.add(rr);
    loop(scene, c, { targets: rr, alpha: 0.2, duration: 600, yoyo: true });
  }
  attachTrail(scene, c, FT.ember, 900, {
    speed: { min: 5, max: 20 }, lifespan: { min: 600, max: 900 }, scale: { start: 0.9, end: 0.3 },
    alpha: { start: 0.9, end: 0 }, tint: [C.gold, C.orange], frequency: 180, quantity: 1, gravityY: -30,
    emitZone: zone(new Phaser.Geom.Ellipse(0, -30, 70, 70), 'edge', 24),
  });
  return c;
};

// ───────────────────────────── Phase 4: Year 4 additions ─────────────────────────────

const supernovaCast: VfxFn = (scene, o) => {
  const f = o.facing;
  const x = o.x - f * 18, y = o.y;          // gather the star over the caster's body, not the staff tip
  const star = fpx(scene, 'nova', x, y - 10, { scale: 2, add: true, dur: 620, depth: DEPTH.VFX_TOP });
  if (!star) flash(scene, x, y, C.white, 140, 620, 0.9);
  const r = img(scene, FT.ring, x, y, { tint: C.orange, alpha: 0.9, scale: 3.2, depth: DEPTH.VFX_TOP });
  scene.tweens.add({ targets: r, scale: 0.1, duration: 560, ease: 'Cubic.easeIn', onComplete: () => { if (r.scene) r.destroy(); } });
  implode(scene, x, y, 360, 220, 18, 300);
  scene.time.delayedCall(220, () => implode(scene, x, y, 260, 160, 14, 260));
  flare(scene, x, y, C.white, 140, 620);
  shake(scene, 600, 0.0015);
};

const supernovaArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 600, 280);
  const x = o.x, y = o.y;
  const gy = o.groundY ?? y + 54;
  scene.time.delayedCall(600, () => {
    if (!scene.sys || !scene.sys.isActive()) return;
    try { scene.cameras.main.flash(160, 255, 220, 160); } catch { /* ignore */ }
    const big = pxFx(scene, 'ex4', x, gy + 8, { scale: 4, oy: 1, depth: DEPTH.VFX_TOP });
    if (!big) flash(scene, x, y, C.white, w * 0.8, 320, 1);
    fpx(scene, 'nova', x, y - 10, { scale: 4, add: true, dur: 520, depth: DEPTH.VFX_TOP });
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      pxFx(scene, 'ex2', x + side * w * rnd(0.22, 0.45), y + rnd(-0.25, 0.25) * h, { scale: 2, delay: 60 + i * 70, depth: DEPTH.VFX_TOP });
    }
    shock(scene, x, gy - 2, C.white, w * 1.1, 520, 0.3);
    shock(scene, x, gy - 2, C.orange, w * 1.4, 700, 0.3, 0.9, 80);
    shock(scene, x, y, C.red, w * 0.9, 600, 0.55, 0.7, 40);
    sparks(scene, x, y, 22, 560, 300);
    embers(scene, x, y, 16, 260);
    smokePuff(scene, x, gy - 30, 4, 1.6);
    scorchMark(scene, x, gy, w, 900);
    shake(scene, 320, 0.011);
  });
};

const immolateCast: VfxFn = (scene, o) => {
  castFx(scene, o, 1.3);
  flash(scene, o.x, o.y, C.red, 90, 260, 0.8);
};

const immolateSelf: VfxFn = (scene, o) => {
  const { x, y } = o;
  // the caster is briefly engulfed: the price of the spell
  if (!pxFx(scene, 'cm_fire', x, y + 6, { scale: 2, oy: 1, dur: 520, depth: DEPTH.VFX_TOP })) {
    tongue(scene, x, y, C.red, 40, 80, 0, 480, DEPTH.VFX_TOP);
  }
  flash(scene, x, y - 30, C.red, 110, 280, 0.7);
  burst(scene, x, y - 30, FT.ember, 10, 800, {
    speed: { min: 40, max: 120 }, angle: { min: 240, max: 300 }, gravityY: -60, lifespan: { min: 500, max: 800 },
    scale: { start: 1, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: [C.red, C.deep, C.orange],
    emitZone: zone(new Phaser.Geom.Rectangle(-14, -26, 28, 52)),
  });
};

const immolateArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 150, 170);
  const x = o.x, y = o.y;
  const gy = o.groundY ?? y + h * 0.3;
  // brand sigil snaps onto the target, then three eruptions (synced to the 3 hit lines)
  const rune = img(scene, 'fx_rune_3', x, y - 6, { tint: C.orange, alpha: 0, depth: DEPTH.VFX_TOP });
  rune.setScale(2);
  scene.tweens.add({ targets: rune, alpha: 1, duration: 90 });
  scene.tweens.add({ targets: rune, alpha: 0, duration: 260, delay: 420, ease: 'Stepped', easeParams: [3], onComplete: () => { if (rune.scene) rune.destroy(); } });
  const circ = img(scene, 'fx_circle', x, gy - 2, { tint: C.red, alpha: 0.85, depth: DEPTH.VFX - 1 });
  circ.setScale(1, 0.25);
  scene.tweens.add({ targets: circ, alpha: 0, duration: 400, delay: 420, onComplete: () => { if (circ.scene) circ.destroy(); } });
  for (let i = 0; i < 3; i++) {
    scene.time.delayedCall(250 + i * 110, () => {
      if (!scene.sys || !scene.sys.isActive()) return;
      if (!pxFx(scene, 'cm_flamelash', x + rnd(-10, 10), y - 4, { scale: 2, flipX: i % 2 === 1, dur: 360, depth: DEPTH.VFX_TOP })) {
        tongue(scene, x, gy, FIRE_TINTS[i], w * 0.4, h * 0.9, 0, 360);
      }
      if (i === 0) pxFx(scene, 'ex3', x, gy + 4, { scale: 2, oy: 1, dur: 500, depth: DEPTH.VFX });
      flash(scene, x, y, i === 2 ? C.white : C.orange, w * 0.8, 180, 0.7);
      sparks(scene, x, y, 6, 260, 260);
    });
  }
  scene.time.delayedCall(250, () => shake(scene, 140, 0.004));
};

const cauterizeSelf: VfxFn = (scene, o) => {
  const { x, y } = o;
  if (!fpx(scene, 'heal', x, y - 34, { scale: 4, add: true, dur: 480, depth: DEPTH.VFX_TOP })) {
    flash(scene, x, y - 34, C.gold, 120, 420, 0.9);
  }
  pxFx(scene, 'cm_firespin', x, y - 34, { scale: 2, dur: 560, depth: DEPTH.VFX_TOP });
  stream(scene, x, y - 4, FT.ember, 420, 900, {
    speedY: { min: -120, max: -60 }, speedX: { min: -12, max: 12 }, lifespan: { min: 600, max: 900 },
    scale: { start: 1, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: [C.gold, C.yellow, C.white], frequency: 30, quantity: 1,
    emitZone: zone(new Phaser.Geom.Rectangle(-16, -6, 32, 8)),
  });
};

const cauterizeArea: VfxFn = (scene, o) => {
  const { w } = sizeOf(o, 240, 130);
  const x = o.x;
  const gy = o.groundY ?? o.y + 34;
  shock(scene, x, gy - 2, C.orange, w * 1.1, 420, 0.3);
  for (const d of [-0.42, -0.22, 0.22, 0.42]) {
    pxFx(scene, 'cm_brightfire', x + d * w, gy + 4, { scale: 2, oy: 1, flipX: d < 0, delay: Math.abs(d) > 0.3 ? 80 : 20, dur: 520, depth: DEPTH.VFX });
  }
  sparks(scene, x, gy - 30, 8, 260, 220);
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

  // Phase 4 — Year 2
  registerVfx('fire_bomb_proj', bombProj);
  registerVfx('fire_bomb_area', bombArea);
  registerVfx('fire_dash_out', dashOut);
  registerVfx('fire_dash_trail', dashTrail);
  registerVfx('fire_dash_in', dashIn);
  registerVfx('fire_overheat_cast', overheatCast);
  registerVfx('fire_overheat_aura', overheatAura);
  // Phase 4 — Year 3
  registerVfx('fire_volley_cast', volleyCast);
  registerVfx('fire_volley_proj', volleyProj);
  registerVfx('fire_wall', wallBody);
  registerVfx('fire_wall_pulse', wallPulse);
  registerVfx('fire_ward_cast', wardCast);
  registerVfx('fire_ward_aura', wardAura);
  // Phase 4 — Year 4
  registerVfx('fire_supernova_cast', supernovaCast);
  registerVfx('fire_supernova_area', supernovaArea);
  registerVfx('fire_immolate_cast', immolateCast);
  registerVfx('fire_immolate_self', immolateSelf);
  registerVfx('fire_immolate_area', immolateArea);
  registerVfx('fire_cauterize', cauterizeSelf);
  registerVfx('fire_cauterize_area', cauterizeArea);
  // Phase 9 — eight more spells (src/skills/fire/vfx9.ts)
  registerFirePhase9Vfx(registerVfx, { sparks, embers, smokePuff, hitFx, castFx, explosion, groundBelow, implode, scorchMark });
}

