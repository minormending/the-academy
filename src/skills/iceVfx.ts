// OWNER: A4 (ice-tree) / PX4 (pixel VFX). Ice VFX: 16-bit pixel sheets (pxFx) for bodies/impacts over pixelized
// shards, frost mist, snow and crystals; procedural fallback when a sheet failed to load.
// Conventions: one-shots self-destroy and return void; projectile / aura / summon visuals return a
// Container drawn facing +x at rotation 0 (the engine moves, rotates and destroys them).
import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import { registerVfx } from '../core/vfx';
import { pxFx } from '../art/particles';
import type { VfxFn, VfxOptions } from '../core/types';
import { generateIceTextures as genTextures } from './ice/textures';
import {
  ADD, C, GROUND_DY, bindLife, breathe, burst, faceDeg, flash, followEmitter, img, ring, rnd, spin, T, tweenOut,
} from './ice/fx';

export function generateIceTextures(scene: Phaser.Scene): void {
  genTextures(scene);
}

const TAU = Math.PI * 2;
const sc = (o: VfxOptions): number => o.scale ?? 1;

// ───────────────────────────── shared pieces ─────────────────────────────

/** Spray of ice shards that fall under gravity. */
function shardBurst(scene: Phaser.Scene, x: number, y: number, n: number, speed: [number, number], s = 1, up = false): void {
  burst(scene, x, y, 'ice_shard', {
    lifespan: { min: 450, max: 800 },
    speed: { min: speed[0], max: speed[1] },
    angle: up ? { min: -150, max: -30 } : { min: 0, max: 360 },
    gravityY: 620,
    scale: { start: 0.7 * s, end: 0.25 * s },
    alpha: { start: 1, end: 0 },
    rotate: { min: 0, max: 360 },
  }, n, 850);
}

/** Glittering additive sparkles. */
function sparkBurst(scene: Phaser.Scene, x: number, y: number, n: number, speed: [number, number], s = 1, life = 560): void {
  burst(scene, x, y, 'ice_star', {
    lifespan: { min: life * 0.6, max: life },
    speed: { min: speed[0], max: speed[1] },
    angle: { min: 0, max: 360 },
    gravityY: 60,
    scale: { start: 0.75 * s, end: 0 },
    alpha: { start: 1, end: 0 },
    blendMode: ADD,
    rotate: { min: 0, max: 90 },
  }, n, life);
}

/** Drifting snowflakes. */
function flakeBurst(scene: Phaser.Scene, x: number, y: number, n: number, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {}, life = 900): void {
  // NB: Phaser treats the mere presence of `speed`/`speedX` keys as meaningful, so never pass both.
  const radial = cfg.speedX === undefined && cfg.speedY === undefined && cfg.speed === undefined
    ? { speed: { min: 40, max: 160 }, angle: { min: 0, max: 360 } }
    : {};
  burst(scene, x, y, 'ice_flake', {
    lifespan: { min: life * 0.6, max: life },
    gravityY: 120,
    scale: { start: 0.55, end: 0.2 },
    alpha: { start: 1, end: 0 },
    rotate: { min: 0, max: 360 },
    ...radial,
    ...cfg,
  }, n, life);
}

/** Cold fog puffs. */
function mistBurst(scene: Phaser.Scene, x: number, y: number, n: number, spread: number, s = 1, life = 800): void {
  burst(scene, x, y, 'ice_mist', {
    x: { min: -spread, max: spread },
    lifespan: { min: life * 0.7, max: life },
    speedX: { min: -30, max: 30 },
    speedY: { min: -30, max: -6 },
    scale: { start: 0.7 * s, end: 1.7 * s },
    alpha: { start: 0.55, end: 0 },
    rotate: { min: 0, max: 180 },
  }, n, life);
}

/** A crystal that pops out of the ground (origin at base), holds, then breaks away. */
function crystalPop(
  scene: Phaser.Scene, x: number, baseY: number, sx: number, sy: number, rot: number,
  delay: number, hold: number, tint?: number,
): void {
  const c = img(scene, x, baseY + 4, 'ice_crystal', { sx, sy: 0.01, rot, ox: 0.5, oy: 1, tint, depth: DEPTH.VFX });
  scene.tweens.add({ targets: c, scaleY: sy, duration: 170, delay, ease: 'Back.Out' });
  scene.tweens.add({
    targets: c,
    alpha: 0,
    scaleX: sx * 1.1,
    y: baseY + 8,
    duration: 280,
    delay: delay + 170 + hold,
    ease: 'Quad.In',
    onStart: () => { shardBurst(scene, x, baseY - 30 * sy, 3, [60, 160], 0.7); },
    onComplete: () => c.destroy(),
  });
}

// ───────────────────────────── casts ─────────────────────────────

const iceCast: VfxFn = (scene, o) => {
  const s = sc(o), a = faceDeg(o);
  if (!pxFx(scene, 'sf_snow', o.x + o.facing * 4, o.y, { scale: 2, dur: 300, add: true, depth: DEPTH.VFX_TOP })) {
    flash(scene, o.x, o.y, 1.5 * s, C.cyan, 240);
    ring(scene, o.x, o.y, 90 * s, 90 * s, C.pale, 300);
  }
  burst(scene, o.x, o.y, 'ice_star', {
    lifespan: { min: 220, max: 420 },
    speed: { min: 90, max: 240 },
    angle: { min: a - 38, max: a + 38 },
    scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 },
    blendMode: ADD,
  }, 6, 450);
  burst(scene, o.x, o.y, 'ice_flake', {
    lifespan: { min: 400, max: 700 },
    speed: { min: 40, max: 130 },
    angle: { min: a - 60, max: a + 60 },
    gravityY: 130,
    scale: { start: 0.5, end: 0.5 },
    alpha: { start: 1, end: 0 },
  }, 4, 720);
};

const iceCastRune: VfxFn = (scene, o) => {
  iceCast(scene, o);
  const rx = o.x + o.facing * 14;
  const rune = img(scene, rx, o.y, 'ice_rune', { add: true, tint: C.cyan, alpha: 0, scale: 0.18, depth: DEPTH.VFX });
  scene.tweens.add({ targets: rune, scale: 0.5, rotation: 1.4 * o.facing, duration: 460, ease: 'Cubic.Out' });
  scene.tweens.add({ targets: rune, alpha: { from: 0, to: 0.95 }, duration: 160, yoyo: true, hold: 160, onComplete: () => rune.destroy() });
};

// ───────────────────────────── projectiles ─────────────────────────────

interface ProjOpts {
  tex: string;
  scale: number;
  glow: number;
  glowTint: number;
  rate: number;
  flakes?: boolean;
  noStars?: boolean;
  trailScale?: number;
  /** Pixel sprite body (falls back to the procedural glow/body when the sheet is missing). */
  px?: { id: string; x?: number; scale?: number; v?: 'ice'; head?: string };
}

function makeProjectile(scene: Phaser.Scene, o: VfxOptions, p: ProjOpts): Phaser.GameObjects.Container {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  // 16-bit pivot: an animated pixel sprite is the body; the smooth glow layers are only the fallback.
  let sprite = false;
  if (p.px) {
    const s = pxFx(scene, p.px.id, p.px.x ?? 0, 0, { scale: p.px.scale ?? 2, loop: true, v: p.px.v, randomStart: true });
    if (s) { c.add(s); sprite = true; }
    if (s && p.px.head) {
      const h = pxFx(scene, p.px.head, 0, 0, { scale: 2, loop: true, v: 'ice', add: true });
      if (h) c.add(h);
    }
  }
  if (!sprite) {
    const glow = img(scene, 0, 0, 'ice_glow', { free: true, add: true, tint: p.glowTint, alpha: 0.85, scale: p.glow });
    const body = img(scene, 0, 0, p.tex, { free: true, scale: p.scale });
    c.add([glow, body]);
    breathe(scene, c, glow, { scale: p.glow * 1.25, alpha: 0.55 }, 160);
  }

  const ts = p.trailScale ?? 1;
  followEmitter(scene, c, 'ice_dot', {
    lifespan: 380,
    frequency: p.rate * 1.5,
    speed: { min: 4, max: 28 },
    angle: { min: 0, max: 360 },
    scale: { start: ts, end: 0.5 },
    alpha: { start: 0.9, end: 0 },
    tint: [C.white, C.cyan, C.sky],
    blendMode: ADD,
  }, 0, 0, DEPTH.VFX - 1);
  if (!p.noStars) followEmitter(scene, c, 'ice_star', {
    lifespan: { min: 300, max: 560 },
    frequency: p.rate * 4,
    x: { min: -6, max: 6 },
    y: { min: -6, max: 6 },
    speed: { min: 10, max: 60 },
    angle: { min: 0, max: 360 },
    gravityY: 60,
    scale: { start: ts, end: 0.5 },
    alpha: { start: 1, end: 0 },
    blendMode: ADD,
  });
  if (p.flakes) {
    followEmitter(scene, c, 'ice_flake', {
      lifespan: { min: 500, max: 800 },
      frequency: 140,
      y: { min: -8, max: 8 },
      speed: { min: 5, max: 40 },
      angle: { min: 0, max: 360 },
      gravityY: 90,
      scale: { start: 0.5, end: 0.5 },
      alpha: { start: 1, end: 0 },
    });
  }
  return c;
}

const iceBolt: VfxFn = (scene, o) => makeProjectile(scene, o, { tex: 'ice_bolt', scale: 1, glow: 0.9, glowTint: C.cyan, rate: 22, flakes: true, px: { id: 'sf_orb_b' } });
const iceLanceProj: VfxFn = (scene, o) => makeProjectile(scene, o, { tex: 'ice_spear', scale: 0.9, glow: 1.1, glowTint: C.sky, rate: 16, flakes: true, px: { id: 'ss_icespear', x: -36 } });
const iceGlacialProj: VfxFn = (scene, o) => makeProjectile(scene, o, { tex: 'ice_spear', scale: 1.25, glow: 1.5, glowTint: C.blue, rate: 12, flakes: true, trailScale: 1.3, px: { id: 'ss_icespear', x: -44, head: 'icecrystal' } });
const iceElementalBolt: VfxFn = (scene, o) => makeProjectile(scene, o, { tex: 'ice_bolt', scale: 0.7, glow: 0.65, glowTint: C.pale, rate: 34, trailScale: 0.8, px: { id: 'sf_orb_b' } });
const iceBlizzardProj: VfxFn = (scene, o) => makeProjectile(scene, o, { tex: 'ice_spear', scale: 0.8, glow: 0.8, glowTint: C.sky, rate: 40, trailScale: 0.9, noStars: true, px: { id: 'ss_icespear', x: -36 } });

// ───────────────────────────── hits ─────────────────────────────

const iceHit: VfxFn = (scene, o) => {
  const s = sc(o);
  if (!pxFx(scene, 'sf_shatter', o.x, o.y, { scale: s >= 1.4 ? 4 : 2, dur: 360, depth: DEPTH.VFX_TOP })) {
    flash(scene, o.x, o.y, 1.1 * s, C.pale, 200);
    ring(scene, o.x, o.y, 60 * s, 60 * s, C.cyan, 260);
  }
  shardBurst(scene, o.x, o.y, 5, [90, 250], 0.8 * s, true);
  sparkBurst(scene, o.x, o.y, 3, [60, 180], 0.8 * s, 420);
};

const iceShatterHit: VfxFn = (scene, o) => {
  const s = sc(o);
  const block = img(scene, o.x, o.y, 'ice_block', { alpha: 0.92, scale: Math.max(1, Math.round(s)), depth: DEPTH.VFX });
  const crack = img(scene, o.x, o.y, 'ice_crack', { add: true, alpha: 1, scale: 0.5 * s, depth: DEPTH.VFX_TOP });
  scene.tweens.add({ targets: crack, scale: 1 * s, duration: 130, ease: 'Stepped', easeParams: [3] });
  scene.time.delayedCall(130, () => {
    if (!scene.sys.isActive()) { block.destroy(); crack.destroy(); return; }
    if (!pxFx(scene, 'sf_shatter', o.x, o.y, { scale: 4, dur: 420, depth: DEPTH.VFX_TOP })) {
      flash(scene, o.x, o.y, 2.6 * s, C.white, 260);
      ring(scene, o.x, o.y, 150 * s, 150 * s, C.pale, 340);
    } else pxFx(scene, 'cm_ring', o.x, o.y, { v: 'ice', scale: 2, add: true });
    shardBurst(scene, o.x, o.y, 10, [150, 400], 1.0 * s);
    sparkBurst(scene, o.x, o.y, 5, [100, 300], 1 * s, 560);
    tweenOut(scene, block, { alpha: 0 }, 160, 'Quad.Out');
    tweenOut(scene, crack, { alpha: 0 }, 220, 'Quad.Out');
  });
};

// ───────────────────────────── areas ─────────────────────────────

const iceNovaArea: VfxFn = (scene, o) => {
  const w = o.w ?? 420, h = o.h ?? 200, gy = o.y + GROUND_DY;
  const k = w >= 360 ? 4 : 2;
  const neb = pxFx(scene, 'cm_nebula', o.x, o.y, { v: 'ice', scale: k, add: true, dur: 600, depth: DEPTH.VFX_TOP });
  if (neb) pxFx(scene, 'cm_ring', o.x, o.y, { v: 'ice', scale: k, add: true, delay: 60 });
  else {
    flash(scene, o.x, o.y, w / 64, C.sky, 420, h / w);
    ring(scene, o.x, o.y + 10, w, h * 0.9, C.white, 520);
  }
  ring(scene, o.x, gy, w * 0.9, h * 0.3, C.cyan, 460, 90);
  // crystals rising along the floor
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const x = o.x + t * w * 0.9 + rnd(-8, 8);
    const d = Math.abs(t);
    crystalPop(scene, x, gy, 1, (h / 200) * (d < 0.3 ? 1 : 0.75), 0, d * 220, 360);
  }
  mistBurst(scene, o.x, gy - 6, 6, w * 0.42, 1, 900);
  flakeBurst(scene, o.x, o.y, 10, { speedX: { min: -w * 0.8, max: w * 0.8 }, speedY: { min: -140, max: -20 } }, 1000);
};

const iceSpikeArea: VfxFn = (scene, o) => {
  const w = o.w ?? 240, h = o.h ?? 240, gy = o.y + GROUND_DY;
  const k = h / 240;
  // pixel ice dome bursting from the ground (ansimuz fire-bomb, palette-swapped to ice)
  if (!pxFx(scene, 'g9_firebomb', o.x, gy + 4, { v: 'ice', scale: 4, oy: 1, add: true, depth: DEPTH.VFX - 1 })) {
    flash(scene, o.x, gy - 10, w / 64, C.cyan, 380, 0.5);
  }
  ring(scene, o.x, gy, w * 1.05, w * 0.3, C.white, 460);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;          // -0.5..0.5
    const d = Math.abs(t) * 2;            // 0 centre .. 1 edge
    const x = o.x + t * w * 0.82 + rnd(-6, 6);
    const height = (150 - d * 80 + rnd(-10, 12)) * k;
    crystalPop(scene, x, gy, 1, Math.max(1, Math.round(height / 80)), t * 0.55, 40 + d * 90, 380);
  }
  pxFx(scene, 'sf_shards', o.x - 20, gy - 40, { scale: 4, dur: 360, delay: 80, depth: DEPTH.VFX_TOP });
  shardBurst(scene, o.x, gy - 10, 10, [140, 380], 0.9, true);
  mistBurst(scene, o.x, gy - 6, 6, w * 0.4, 1.1, 900);
  sparkBurst(scene, o.x, gy - 40, 6, [60, 260], 1, 640);
};

const iceShatterArea: VfxFn = (scene, o) => {
  const w = o.w ?? 280, h = o.h ?? 220, gy = o.y + GROUND_DY;
  if (pxFx(scene, 'cm_nebula', o.x, o.y, { v: 'ice', scale: 2, add: true, dur: 520, depth: DEPTH.VFX_TOP })) {
    for (let i = 0; i < 4; i++) pxFx(scene, 'sf_shatter', o.x + rnd(-0.35, 0.35) * w, o.y + rnd(-0.3, 0.3) * h, { scale: 4, delay: 60 + i * 60, dur: 380, depth: DEPTH.VFX_TOP });
  } else {
    flash(scene, o.x, o.y, w / 64 * 1.1, C.white, 360, h / w);
    ring(scene, o.x, o.y, w, h, C.white, 440);
  }
  ring(scene, o.x, o.y, w * 0.7, h * 0.7, C.cyan, 380, 70);
  // cracked ground
  const crack = img(scene, o.x, gy, 'ice_crack', { add: true, alpha: 1, sx: 1, sy: 0.5, depth: DEPTH.VFX - 1 });
  scene.tweens.add({ targets: crack, scaleX: Math.max(1, Math.round(w / 96)), scaleY: 1, duration: 160, ease: 'Stepped', easeParams: [3] });
  tweenOut(scene, crack, { alpha: 0 }, 520, 'Quad.In', 220);
  shardBurst(scene, o.x, o.y, 14, [200, 520], 1.15);
  sparkBurst(scene, o.x, o.y, 8, [120, 380], 1.1, 640);
  mistBurst(scene, o.x, gy - 4, 5, w * 0.35, 1, 700);
  const cam = scene.cameras?.main;
  if (cam) cam.shake(120, 0.0035);
};

const iceBlizzardImpact: VfxFn = (scene, o) => {
  const w = o.w ?? 150;
  const x = o.x, y = o.y; // ground point
  if (!pxFx(scene, 'sf_shatter', x, y - 14, { scale: 2, dur: 320 })) {
    flash(scene, x, y - 8, 1.1, C.pale, 220, 0.6);
  }
  ring(scene, x, y, w * 0.7, w * 0.2, C.cyan, 320);
  for (let i = 0; i < 2; i++) {
    crystalPop(scene, x + (i - 0.5) * 20 + rnd(-4, 4), y, 0.5, 0.5, (i - 0.5) * 0.6, i * 25, 120);
  }
  shardBurst(scene, x, y - 10, 3, [90, 230], 0.65, true);
};

const iceOrbPulse: VfxFn = (scene, o) => {
  const w = o.w ?? 400, h = o.h ?? 280;
  if (pxFx(scene, 'cm_ring', o.x, o.y, { v: 'ice', scale: 4, add: true, depth: DEPTH.VFX_TOP })) {
    pxFx(scene, 'sf_snow', o.x, o.y, { scale: 4, add: true, dur: 360 });
  } else {
    flash(scene, o.x, o.y, 3, C.sky, 360);
    ring(scene, o.x, o.y, w, h, C.white, 600);
  }
  ring(scene, o.x, o.y, w * 0.6, h * 0.6, C.cyan, 480, 80);
  shardBurst(scene, o.x, o.y, 6, [120, 300], 0.8);
  flakeBurst(scene, o.x, o.y, 6, { speed: { min: 80, max: 240 } }, 900);
};

// ───────────────────────────── buffs ─────────────────────────────

const iceArmorCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  ring(scene, x, y, 150, 44, C.cyan, 520);
  const tor = pxFx(scene, 'sf_tornado', x, y + 2, { scale: 4, oy: 1, dur: 480, add: true, depth: DEPTH.VFX_TOP });
  if (!tor) {
    const pillar = img(scene, x, y - 34, 'ice_glow', { add: true, tint: C.pale, alpha: 0.8, sx: 1.1, sy: 2.6, depth: DEPTH.VFX });
    tweenOut(scene, pillar, { alpha: 0, scaleX: 0.6 }, 560, 'Quad.Out');
  }
  // the ice shell wraps around the mage
  const shell = img(scene, x, y - 30, 'ice_block', { alpha: 0.7, scale: 1, depth: DEPTH.VFX_TOP });
  tweenOut(scene, shell, { alpha: 0 }, 300, 'Quad.In', 300);
  burst(scene, x, y, 'ice_shard', {
    x: { min: -24, max: 24 },
    lifespan: { min: 500, max: 800 },
    speedY: { min: -230, max: -90 },
    speedX: { min: -30, max: 30 },
    gravityY: 120,
    scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 },
  }, 8, 850);
};

const iceArmorAura: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  // pixel ward bubble (CodeManu protection circle, palette-swapped to ice)
  const ward = pxFx(scene, 'cm_shield', 0, -32, { v: 'ice', scale: 2, loop: true, add: true, alpha: 0.55, fps: 10 });
  if (ward) c.add(ward);
  else {
    const shell = img(scene, 0, -32, 'ice_glow', { free: true, add: true, tint: C.cyan, alpha: 0.2, sx: 1.0, sy: 1.9 });
    c.add(shell);
    breathe(scene, c, shell, { alpha: 0.32, scaleY: 2.1 }, 1300);
  }
  const shards: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < 4; i++) shards.push(img(scene, 0, 0, 'ice_shard', { free: true, scale: 1 }));
  c.add(shards);
  spin(scene, c, 3400, (t) => {
    shards.forEach((s, i) => {
      const a = t + (i * TAU) / 4;
      const front = Math.sin(a);
      s.setPosition(Math.round(Math.cos(a) * 32), Math.round(-30 + front * 10));
      s.setAlpha(front > 0 ? 1 : 0.55);
    });
  });
  followEmitter(scene, c, 'ice_flake', {
    x: { min: -22, max: 22 },
    lifespan: { min: 800, max: 1300 },
    frequency: 260,
    speedY: { min: -60, max: -25 },
    speedX: { min: -10, max: 10 },
    scale: 0.5,
    alpha: { start: 0.95, end: 0 },
  }, 0, -4);
  return c;
};

const iceWinterCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  for (let i = 0; i < 2; i++) ring(scene, x, y, 240 + i * 60, 70 + i * 16, i === 1 ? C.cyan : C.pale, 640, i * 130);
  if (!pxFx(scene, 'cm_freezing', x, y - 40, { scale: 2, dur: 900, add: true, depth: DEPTH.VFX_TOP })) {
    flash(scene, x, y - 30, 3.4, C.white, 420, 1.1);
    const pillar = img(scene, x, y - 60, 'ice_glow', { add: true, tint: C.pale, alpha: 0.8, sx: 1.6, sy: 5, depth: DEPTH.VFX });
    tweenOut(scene, pillar, { alpha: 0, scaleX: 0.5 }, 780, 'Quad.Out');
  }
  pxFx(scene, 'sf_tornado', x, y + 2, { scale: 4, oy: 1, dur: 520, add: true, delay: 120 });
  const rune = img(scene, x, y - 2, 'ice_rune', { add: true, tint: C.cyan, alpha: 0, sx: 0.5, sy: 0.25, depth: DEPTH.VFX - 1 });
  scene.tweens.add({ targets: rune, scaleX: 1, scaleY: 0.5, duration: 900, ease: 'Stepped', easeParams: [3] });
  scene.tweens.add({ targets: rune, alpha: { from: 0, to: 0.9 }, duration: 220, yoyo: true, hold: 460, onComplete: () => rune.destroy() });
  burst(scene, x, y, 'ice_flake', {
    x: { min: -30, max: 30 },
    lifespan: { min: 800, max: 1300 },
    speedY: { min: -320, max: -110 },
    speedX: { min: -120, max: 120 },
    gravityY: 30,
    scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 },
  }, 16, 1300);
  sparkBurst(scene, x, y - 30, 8, [60, 280], 1.1, 800);
};

const iceWinterAura: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  // swirling pixel snowflakes around the mage (CodeManu "freezing")
  const swirl = pxFx(scene, 'cm_freezing', 0, -38, { scale: 2, loop: true, add: true, alpha: 0.5, fps: 10 });
  if (swirl) c.add(swirl);
  const flat = scene.add.container(0, -2).setScale(1, 0.5);
  const rune = img(scene, 0, 0, 'ice_rune', { free: true, add: true, tint: C.sky, alpha: 0.45, scale: 0.5 });
  flat.add(rune);
  c.addAt(flat, 0);
  const spinTw = scene.tweens.add({ targets: rune, rotation: -TAU, duration: 9000, repeat: -1, ease: 'Stepped', easeParams: [48] });
  bindLife(c, () => spinTw.stop());
  if (!swirl) {
    const flakes: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 6; i++) flakes.push(img(scene, 0, 0, 'ice_flake', { free: true, add: true, scale: 0.5, tint: C.white }));
    c.add(flakes);
    spin(scene, c, 5200, (t) => {
      flakes.forEach((f, i) => {
        const u = (t / TAU + i / flakes.length) % 1;
        const a = t * 2 + i * 1.7;
        f.setPosition(Math.round(Math.cos(a) * (22 + 14 * Math.sin(u * Math.PI))), Math.round(-u * 84));
        f.setAlpha(Math.sin(u * Math.PI));
      });
    });
  }
  followEmitter(scene, c, 'ice_star', {
    x: { min: -24, max: 24 },
    y: { min: -80, max: 0 },
    lifespan: 650,
    frequency: 220,
    scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 },
    blendMode: ADD,
  });
  return c;
};

// ───────────────────────────── blizzard ─────────────────────────────

const iceBlizzardCast: VfxFn = (scene, o) => {
  iceCastRune(scene, o);
  const gy = o.y + GROUND_DY;
  const cx = o.x + o.facing * 420;       // storm centre (matches skill range)
  const halfW = 340;                      // storm width ~ rain.spreadX + margin
  const top = gy - 470;
  const total = 4200;
  // caster: big rune + ground ring
  const rune = img(scene, o.x, gy - 2, 'ice_rune', { add: true, tint: C.sky, alpha: 0, sx: 0.5, sy: 0.16, depth: DEPTH.VFX - 1 });
  scene.tweens.add({ targets: rune, scaleX: 1.1, scaleY: 0.34, rotation: 2.4, duration: 900, ease: 'Cubic.Out' });
  scene.tweens.add({ targets: rune, alpha: { from: 0, to: 0.9 }, duration: 220, yoyo: true, hold: 480, onComplete: () => rune.destroy() });
  ring(scene, o.x, gy, 220, 60, C.cyan, 560);

  // storm clouds gathering overhead
  for (let i = 0; i < 8; i++) {
    const x = cx - halfW + (i / 7) * halfW * 2 + rnd(-30, 30);
    const cloud = img(scene, x - o.facing * 40, top + rnd(-10, 40), 'ice_mist', {
      tint: i % 2 ? 0xa6bde0 : 0xc4d8f2, alpha: 0, scale: rnd(3.2, 4.8), rot: rnd(0, TAU), depth: DEPTH.VFX,
    });
    scene.tweens.add({ targets: cloud, alpha: 0.5, duration: 450, delay: i * 40 });
    scene.tweens.add({ targets: cloud, x: x + o.facing * 70, rotation: cloud.rotation + 0.4, duration: total, ease: 'Sine.InOut' });
    scene.tweens.add({ targets: cloud, alpha: 0, duration: 700, delay: total - 600, onComplete: () => cloud.destroy() });
  }
  // dark-ish glow band so snow reads against bright backgrounds
  const band = img(scene, cx, top + 70, 'ice_glow', { add: true, tint: C.blue, alpha: 0, sx: (halfW * 2) / 64 * 1.1, sy: 2, depth: DEPTH.VFX - 1 });
  scene.tweens.add({ targets: band, alpha: 0.3, duration: 500 });
  scene.tweens.add({ targets: band, alpha: 0, duration: 800, delay: total - 700, onComplete: () => band.destroy() });

  // wind-driven snow
  const wx = o.facing;
  const zone = {
    getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => { p.x = cx - halfW - 40 + Math.random() * (halfW * 2 + 80); p.y = top + Math.random() * 90; },
  };
  const windMin = wx > 0 ? 130 : -290;
  const windMax = wx > 0 ? 290 : -130;
  const flakes = scene.add.particles(0, 0, T(scene, 'ice_flake'), {
    emitZone: { type: 'random', source: zone },
    lifespan: { min: 900, max: 1300 },
    speedY: { min: 300, max: 470 },
    speedX: { min: windMin, max: windMax },
    scale: { start: 0.7, end: 0.35 },
    alpha: { start: 1, end: 0.25 },
    rotate: { min: 0, max: 360 },
    frequency: 26,
    quantity: 2,
  }).setDepth(DEPTH.VFX_TOP);
  const sleet = scene.add.particles(0, 0, T(scene, 'ice_dot'), {
    emitZone: { type: 'random', source: zone },
    lifespan: { min: 700, max: 1000 },
    speedY: { min: 480, max: 700 },
    speedX: { min: windMin * 1.4, max: windMax * 1.4 },
    scale: { start: 0.55, end: 0.2 },
    alpha: { start: 0.9, end: 0 },
    tint: [C.white, C.cyan],
    blendMode: ADD,
    frequency: 22,
    quantity: 2,
  }).setDepth(DEPTH.VFX_TOP);
  const groundZone = {
    getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => { p.x = cx - halfW + Math.random() * halfW * 2; p.y = gy - Math.random() * 14; },
  };
  const fog = scene.add.particles(0, 0, T(scene, 'ice_mist'), {
    emitZone: { type: 'random', source: groundZone },
    lifespan: { min: 900, max: 1400 },
    speedX: { min: windMin * 0.4, max: windMax * 0.4 },
    speedY: { min: -14, max: -2 },
    scale: { start: 0.8, end: 1.8 },
    alpha: { start: 0.38, end: 0 },
    frequency: 120,
    quantity: 1,
  }).setDepth(DEPTH.VFX - 1);
  scene.time.delayedCall(total - 200, () => { flakes.stop(); sleet.stop(); fog.stop(); });
  scene.time.delayedCall(total + 1600, () => { flakes.destroy(); sleet.destroy(); fog.destroy(); });
};

// ───────────────────────────── summons ─────────────────────────────

const iceElemental: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.SUMMON);
  const rig = scene.add.container(0, 0);
  // pixel ice golem (tautomer); feet roughly at the old body's base
  const golem = pxFx(scene, 'icegolem', 0, 40, { scale: 2, oy: 1, loop: true });
  if (golem) {
    rig.add(golem);
  } else {
    const aura = img(scene, 0, -6, 'ice_glow', { free: true, add: true, tint: C.sky, alpha: 0.5, scale: 2.3 });
    const body = img(scene, 0, 0, 'ice_elem_body', { free: true });
    rig.add([aura, body]);
  }
  c.add(rig);
  // spawn-in
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 320, ease: 'Stepped', easeParams: [4] });
  if (!pxFx(scene, 'sf_snow', o.x, o.y, { scale: 4, add: true, dur: 400 })) ring(scene, o.x, o.y + 30, 120, 36, C.cyan, 500);
  sparkBurst(scene, o.x, o.y, 6, [60, 220], 1, 600);
  spin(scene, c, 2400, (t) => { rig.y = Math.round(Math.sin(t) * 2) * 2; });
  followEmitter(scene, c, 'ice_mist', {
    x: { min: -12, max: 12 },
    lifespan: 900,
    frequency: 200,
    speedY: { min: 6, max: 20 },
    speedX: { min: -12, max: 12 },
    scale: { start: 0.5, end: 1 },
    alpha: { start: 0.35, end: 0 },
    tint: 0xd8f0ff,
  }, 0, 36, DEPTH.SUMMON - 1);
  followEmitter(scene, c, 'ice_star', {
    x: { min: -22, max: 22 },
    y: { min: -34, max: 28 },
    lifespan: 700,
    frequency: 260,
    speed: { min: 6, max: 28 },
    angle: { min: 0, max: 360 },
    scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 },
    blendMode: ADD,
  }, 0, 0, DEPTH.SUMMON + 1);
  return c;
};

const iceOrb: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.SUMMON);
  // snow swirl + pixel ice crystal core (Ouren's Ice Elemental, palette-swapped)
  const swirl = pxFx(scene, 'cm_freezing', 0, 0, { scale: 2, loop: true, add: true, alpha: 0.6, fps: 12 });
  const core = pxFx(scene, 'icecrystal', 0, 0, { v: 'ice', scale: 2, loop: true });
  if (swirl) c.add(swirl);
  if (core) c.add(core);
  if (!core) {
    const aura = img(scene, 0, 0, 'ice_glow', { free: true, add: true, tint: C.blue, alpha: 0.45, scale: 3.2 });
    const orb = img(scene, 0, 0, 'ice_orb', { free: true, scale: 0.95 });
    c.add([aura, orb]);
    breathe(scene, c, aura, { scale: 3.7, alpha: 0.3 }, 1000);
  }
  const shards: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < 4; i++) shards.push(img(scene, 0, 0, 'ice_shard', { free: true, scale: 1 }));
  c.add(shards);
  // spawn pop
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 260, ease: 'Stepped', easeParams: [3] });
  if (!pxFx(scene, 'cm_ring', o.x, o.y, { v: 'ice', scale: 4, add: true })) ring(scene, o.x, o.y, 220, 80, C.cyan, 560);
  sparkBurst(scene, o.x, o.y, 6, [80, 260], 1, 640);
  spin(scene, c, 3600, (t) => {
    shards.forEach((s, i) => {
      const a = t + (i * TAU) / 4;
      const z = Math.sin(a);
      s.setPosition(Math.round(Math.cos(a) * 58), Math.round(z * 20 - 2));
      s.setAlpha(z > 0 ? 1 : 0.55);
    });
  });
  followEmitter(scene, c, 'ice_flake', {
    x: { min: -20, max: 20 },
    y: { min: -20, max: 20 },
    lifespan: { min: 1000, max: 1500 },
    frequency: 200,
    speed: { min: 20, max: 60 },
    angle: { min: 0, max: 360 },
    scale: 0.5,
    alpha: { start: 1, end: 0 },
  }, 0, 0, DEPTH.SUMMON + 1);
  return c;
};

// ───────────────────────────── registration ─────────────────────────────

export function registerIceVfx(): void {
  registerVfx('ice_cast', iceCast);
  registerVfx('ice_cast_rune', iceCastRune);
  registerVfx('ice_bolt', iceBolt);
  registerVfx('ice_hit', iceHit);
  registerVfx('ice_nova_area', iceNovaArea);
  registerVfx('ice_armor_cast', iceArmorCast);
  registerVfx('ice_armor_aura', iceArmorAura);
  registerVfx('ice_lance_proj', iceLanceProj);
  registerVfx('ice_glacial_proj', iceGlacialProj);
  registerVfx('ice_spike_area', iceSpikeArea);
  registerVfx('ice_shatter_hit', iceShatterHit);
  registerVfx('ice_shatter_area', iceShatterArea);
  registerVfx('ice_elemental', iceElemental);
  registerVfx('ice_elemental_bolt', iceElementalBolt);
  registerVfx('ice_blizzard_cast', iceBlizzardCast);
  registerVfx('ice_blizzard_proj', iceBlizzardProj);
  registerVfx('ice_blizzard_impact', iceBlizzardImpact);
  registerVfx('ice_orb', iceOrb);
  registerVfx('ice_orb_pulse', iceOrbPulse);
  registerVfx('ice_winter_cast', iceWinterCast);
  registerVfx('ice_winter_aura', iceWinterAura);
}
