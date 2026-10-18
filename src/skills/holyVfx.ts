// OWNER: Holy tree agent. Holy textures + all `holy_*` VFX: gold / white-light palette swaps of the shared CC0 pixel
// sheets plus the holy-only sheets (Cethiel wings, Cabbit/AntumDeluge angel, twiswist wing), over pixel particles.
// Every effect keeps a procedural fallback for when a sheet failed to load.
import Phaser from 'phaser';
import { registerVfx } from '../core/vfx';
import { DEPTH } from '../core/constants';
import type { VfxFn, VfxOptions } from '../core/types';
import { HT, generateHolyProceduralTextures } from './holy/textures';
import { buildHolySheets, hfx, hloop } from './holy/sheets';
import {
  C, GOLD_TINTS, LIGHT_TINTS, HEAL_TINTS, rnd, img, tweenOut, loop, counter, shake, flash, shock, burst, stream,
  attachTrail, zone, motes, sparks,
} from './holy/fx';

export function generateHolyTextures(scene: Phaser.Scene): void {
  generateHolyProceduralTextures(scene);
  buildHolySheets(scene);
}

const sideAngle = (f: 1 | -1, spread: number) => (f > 0 ? { min: -spread, max: spread } : { min: 180 - spread, max: 180 + spread });
const sizeOf = (o: VfxOptions, dw: number, dh: number) => ({ w: o.w ?? dw, h: o.h ?? dh });

function projContainer(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  c.setRotation(o.angle ?? (o.facing < 0 ? Math.PI : 0));
  return c;
}

/** Wrap a VFX so a bad frame never throws into the engine. */
function safe(fn: VfxFn): VfxFn {
  return (scene, o) => {
    try { return fn(scene, o); } catch (e) { console.warn('[holy vfx]', e); return undefined; }
  };
}

// ───────────────────────────── shared sub-effects ─────────────────────────────

/** Radiant hit on a target center. */
function hitFx(scene: Phaser.Scene, x: number, y: number, s = 1): void {
  const sp = s >= 1.3
    ? hfx(scene, 'h_sun', x, y, { scale: 2, dur: 380, depth: DEPTH.VFX_TOP })
    : hfx(scene, 'h_burst', x, y, { scale: 2, dur: 320, depth: DEPTH.VFX_TOP });
  hfx(scene, 'h_sparkle', x + rnd(-6, 6), y + rnd(-6, 6), { scale: 2, add: true, depth: DEPTH.VFX_TOP });
  flash(scene, x, y, C.gold, 56 * s, 180, sp ? 0.55 : 0.95);
  if (!sp) flash(scene, x, y, C.white, 28 * s, 120, 1);
  sparks(scene, x, y, Math.round(5 * s), 150 * s);
}

/** Cast flare at the staff. */
function castFx(scene: Phaser.Scene, o: VfxOptions, s = 1): void {
  const { x, y, facing: f } = o;
  const sp = hfx(scene, s >= 1.5 ? 'h_ringpop' : 'h_star', x + f * 4, y, { scale: s >= 1.5 ? 4 : 2, dur: 300, add: true, depth: DEPTH.VFX_TOP });
  flash(scene, x, y, C.gold, (sp ? 44 : 70) * s, 220, sp ? 0.6 : 0.9);
  const cr = img(scene, HT.cross, x + f * 2, y, { tint: C.white, depth: DEPTH.VFX_TOP, scale: 1 });
  tweenOut(scene, cr, { y: y - 14, alpha: 0 }, 360, 'Quad.easeOut', 60);
  burst(scene, x, y, HT.mote, Math.round(6 * s), 520, {
    speed: { min: 50, max: 170 * s }, angle: sideAngle(f, 40), lifespan: { min: 280, max: 520 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS,
  }, DEPTH.VFX_TOP);
  if (s >= 1.5) {
    const gx = x - f * 18, gy = y + 34;
    shock(scene, gx, gy, 150 * s, 0.3);
  }
}

/** Light shaft growing up from the ground (`gy` = ground), then fading. */
function lightShaft(scene: Phaser.Scene, x: number, gy: number, w: number, h: number, tint: number, delay: number, life: number, depth: number = DEPTH.VFX): void {
  const sh = img(scene, HT.shaft, x, gy, { tint, origin: [0.5, 1], alpha: 0, depth });
  const sx = Math.max(1, Math.round(w / 16 / 0.5) * 0.5);
  sh.setScale(sx * 0.3, h / 128);
  scene.tweens.add({ targets: sh, scaleX: sx, alpha: 0.95, duration: 120, delay, ease: 'Quad.easeOut' });
  tweenOut(scene, sh, { scaleX: sx * 0.2, alpha: 0 }, life, 'Quad.easeIn', delay + 160);
}

/** Pixel wing pair (twiswist wing), roots at (0,0) of `parent`; returns the two sprites (right, left). */
function wingPair(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, id: 'h_wing' | 'h_wing_w', frame: number, spread: number, y: number, alpha = 1): Phaser.GameObjects.Sprite[] {
  const out: Phaser.GameObjects.Sprite[] = [];
  for (const side of [1, -1] as const) {
    const w = hfx(scene, id, side * spread, y, { scale: 2, frame, ox: 0.1, oy: 0.85, flipX: side < 0, alpha });
    if (!w) continue;
    if (side < 0) w.setOrigin(0.9, 0.85);
    parent.add(w);
    out.push(w);
  }
  return out;
}

// ───────────────────────────── Tier 2 ─────────────────────────────

const arrowProj: VfxFn = (scene, o) => {
  const c = projContainer(scene, o);
  const glow = img(scene, HT.glow, -2, 0, { tint: C.gold, scale: 0.55, alpha: 0.75 });
  c.add(glow);
  const arrow = hloop(scene, c, 'h_arrow', 0, 0, { scale: 2 });
  if (!arrow) {
    const shaft = img(scene, HT.beam, -8, 0, { tint: C.gold, sx: 0.28, sy: 0.25 });
    const head = img(scene, HT.cross, 8, 0, { tint: C.white, rot: Math.PI / 2 });
    c.add([shaft, head]);
  } else {
    const tip = img(scene, 'px_star', 14, 0, { tint: C.white, scale: 1 });
    c.add(tip);
    loop(scene, c, { targets: tip, alpha: 0.4, duration: 90, yoyo: true, ease: 'Stepped' });
  }
  loop(scene, c, { targets: glow, alpha: 0.45, duration: 120, yoyo: true, ease: 'Stepped' });
  attachTrail(scene, c, HT.mote, 520, {
    speed: { min: 4, max: 30 }, lifespan: { min: 300, max: 520 }, scale: { start: 2, end: 1 },
    alpha: { start: 1, end: 0 }, frequency: 28, quantity: 1, tint: GOLD_TINTS,
    emitZone: zone(new Phaser.Geom.Circle(0, 0, 5)),
  });
  attachTrail(scene, c, 'px_star', 420, {
    speed: { min: 0, max: 12 }, lifespan: { min: 260, max: 420 }, scale: { start: 1, end: 0.5 },
    alpha: { start: 1, end: 0 }, frequency: 70, quantity: 1, tint: [C.white, C.pale],
  }, DEPTH.VFX_TOP);
  return c;
};

/** Heal: golden burst on the caster, rising green-gold crosses (the heal number is shown by the skill). */
const healSelf: VfxFn = (scene, o) => {
  const { x, y } = o;
  const cy = y - 36;
  if (!hfx(scene, 'h_heal', x, cy, { scale: 4, add: true, dur: 520, depth: DEPTH.VFX_TOP })) {
    flash(scene, x, cy, C.green, 120, 420, 0.8);
  }
  flash(scene, x, cy, C.white, 60, 240, 0.7);
  lightShaft(scene, x, y + 2, 40, 150, C.pale, 0, 520, DEPTH.VFX);
  for (let i = 0; i < 4; i++) {
    const cr = img(scene, HT.cross, x + rnd(-22, 22), y - rnd(10, 40), { tint: i % 2 ? C.green : C.white, alpha: 0, depth: DEPTH.VFX_TOP, scale: 1 });
    scene.tweens.add({ targets: cr, alpha: 1, duration: 100, delay: i * 90 });
    tweenOut(scene, cr, { y: cr.y - 46, alpha: 0 }, 700, 'Quad.easeOut', 100 + i * 90);
  }
  stream(scene, x, y - 4, HT.mote, 500, 1000, {
    x: { min: -20, max: 20 }, speedY: { min: -120, max: -50 }, speedX: { min: -10, max: 10 },
    lifespan: { min: 600, max: 1000 }, scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 },
    frequency: 40, quantity: 1, tint: HEAL_TINTS,
  }, DEPTH.VFX_TOP);
};

/** Heal: holy wave rolling out along the ground around the caster. */
const healArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 300, 150);
  const gy = o.groundY ?? o.y + h * 0.5 - 6;
  shock(scene, o.x, gy, w * 1.05, 0.28);
  shock(scene, o.x, gy, w * 0.6, 0.28, 90);
  let n = 0;
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6 - 0.5;
    if (hfx(scene, 'h_flame', o.x + t * w * 0.9, gy + 4, { scale: 2, oy: 1, delay: Math.abs(t) * 260, dur: 480, add: true, depth: DEPTH.VFX })) n++;
  }
  if (!n) for (let i = 0; i < 5; i++) lightShaft(scene, o.x + ((i + 0.5) / 5 - 0.5) * w * 0.9, gy, 18, 70, C.gold, i * 40, 360);
  motes(scene, o.x, gy - 6, 12, w * 0.9);
};

const blessCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  const wings = hfx(scene, 'h_wings', x, y - 46, { scale: 2, add: true, dur: 520, alpha: 0.9, depth: DEPTH.PLAYER - 1 });
  if (!wings) flash(scene, x, y - 40, C.gold, 120, 420, 0.7);
  hfx(scene, 'h_heal', x, y - 36, { scale: 2, add: true, dur: 420, delay: 120, depth: DEPTH.VFX_TOP });
  const halo = img(scene, HT.halo, x, y - 96, { tint: C.gold, alpha: 0, depth: DEPTH.VFX_TOP, scale: 2 });
  scene.tweens.add({ targets: halo, y: y - 80, alpha: 1, duration: 260, ease: 'Back.easeOut' });
  tweenOut(scene, halo, { alpha: 0 }, 300, 'Quad.easeIn', 500);
  shock(scene, x, y - 2, 120, 0.3);
  motes(scene, x, y - 10, 12, 50);
};

const blessAura: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  const halo = img(scene, HT.halo, 0, -82, { tint: C.gold, scale: 1, alpha: 0.95, depth: DEPTH.VFX });
  const glow = img(scene, HT.glow, 0, -82, { tint: C.pale, sx: 0.5, sy: 0.2, alpha: 0.35 });
  c.add([glow, halo]);
  loop(scene, c, { targets: [halo, glow], y: -84, duration: 600, yoyo: true, ease: 'Stepped', easeParams: [2] });
  attachTrail(scene, c, HT.mote, 900, {
    speedY: { min: -40, max: -15 }, speedX: { min: -8, max: 8 }, lifespan: { min: 600, max: 900 },
    scale: { start: 2, end: 1 }, alpha: { start: 0.9, end: 0 }, tint: GOLD_TINTS, frequency: 260, quantity: 1,
    emitZone: zone(new Phaser.Geom.Ellipse(0, -40, 40, 60)),
  });
  return c;
};

// ───────────────────────────── Tier 3 ─────────────────────────────

/** Shining Ray: rays converge from the sky onto the target, then a radiant multi-burst. */
const shiningArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 220, 170);
  const { x, y } = o;
  const N = 7;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i - (N - 1) / 2) * 0.22;           // fan above the target
    const dist = rnd(150, 210);
    const sx = x + Math.cos(a) * dist, sy = y + Math.sin(a) * dist;
    const r = img(scene, HT.ray, sx, sy, { tint: i % 2 ? C.white : C.gold, origin: [0.5, 1], alpha: 0, depth: DEPTH.VFX_TOP });
    r.setRotation(a - Math.PI / 2 + Math.PI).setScale(1, 1.5);
    scene.tweens.add({ targets: r, alpha: 1, duration: 60, delay: i * 18 });
    tweenOut(scene, r, { x, y, alpha: 0.2 }, 200, 'Quad.easeIn', i * 18);
  }
  scene.time.delayedCall(200, () => {
    const big = hfx(scene, 'h_sun', x, y, { scale: 2, dur: 520, depth: DEPTH.VFX_TOP });
    if (!big) flash(scene, x, y, C.white, Math.max(w, h) * 0.9, 360, 1);
    hfx(scene, 'h_nebula', x, y, { scale: 2, dur: 520, alpha: 0.75, depth: DEPTH.VFX });
    for (let i = 0; i < 3; i++) {
      hfx(scene, 'h_burst', x + rnd(-0.32, 0.32) * w, y + rnd(-0.3, 0.3) * h, { scale: 2, delay: 90 + i * 110, depth: DEPTH.VFX_TOP });
    }
    shock(scene, x, o.groundY ?? y + h * 0.35, w * 1.1, 0.3);
    sparks(scene, x, y, 12, 260);
    shake(scene, 90, 0.0025);
  });
};

const lanceCast: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  castFx(scene, o, 1.2);
  const sig = img(scene, HT.sigil, x - f * 2, y, { tint: C.gold, alpha: 0.9, depth: DEPTH.VFX_TOP, scale: 0.5 });
  sig.setScale(0.5 * f, 1);
  tweenOut(scene, sig, { scaleY: 0.2, alpha: 0 }, 300, 'Quad.easeIn', 80);
};

/** A beam of light from (x,y) to (targetX,targetY): layered stepped bands + crosses rolling down its length. */
function lightBeam(scene: Phaser.Scene, o: VfxOptions, th: number, tints: [number, number, number], crosses = true): void {
  const sx = o.x, sy = o.y;
  const tx = o.targetX ?? o.x + o.facing * 500, ty = o.targetY ?? o.y;
  const len = Math.max(40, Phaser.Math.Distance.Between(sx, sy, tx, ty));
  const ang = Math.atan2(ty - sy, tx - sx);
  const snap = (v: number) => Math.max(4, Math.round(v / 4) * 4);
  const mk = (tint: number, thick: number, alpha: number, depth: number, life: number, delay: number) => {
    const b = img(scene, HT.beam, sx, sy, { tint, origin: [0, 0.5], rot: ang, alpha: 0, depth });
    b.setScale(0.05, snap(thick) / 32);
    scene.tweens.add({ targets: b, scaleX: len / 128, alpha, duration: 90, delay, ease: 'Cubic.easeOut' });
    tweenOut(scene, b, { alpha: 0, scaleY: (snap(thick) / 32) * 0.3 }, life, 'Stepped', delay + 200);
  };
  mk(tints[0], th * 1.25, 0.5, DEPTH.VFX - 1, 320, 0);
  mk(tints[1], th * 0.75, 0.9, DEPTH.VFX, 300, 0);
  mk(tints[2], th * 0.3, 1, DEPTH.VFX_TOP, 260, 20);
  if (crosses) {
    const n = Math.min(7, Math.max(3, Math.round(len / 80)));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const px = sx + (tx - sx) * t, py = sy + (ty - sy) * t;
      if (!hfx(scene, 'h_burst', px, py + rnd(-th * 0.15, th * 0.15), { scale: 2, delay: 40 + i * 35, depth: DEPTH.VFX_TOP })) {
        const cr = img(scene, HT.cross, px, py, { tint: C.white, depth: DEPTH.VFX_TOP, scale: 2 });
        tweenOut(scene, cr, { alpha: 0, scale: 3 }, 300, 'Quad.easeOut', i * 35);
      }
    }
  }
  burst(scene, 0, 0, HT.mote, 16, 800, {
    speed: { min: 20, max: 90 }, angle: { min: 0, max: 360 }, gravityY: -40, lifespan: { min: 400, max: 800 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS,
    emitZone: zone(new Phaser.Geom.Line(sx, sy, tx, ty)),
  });
  flash(scene, sx, sy, C.white, 70, 200, 0.85);
  hfx(scene, 'h_sparkle', tx, ty, { scale: 4, add: true, depth: DEPTH.VFX_TOP });
}

const lanceBeam: VfxFn = (scene, o) => {
  lightBeam(scene, o, o.h ?? 70, [C.deep, C.gold, C.white]);
  shake(scene, 90, 0.002);
};

const symbolCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  const sig = img(scene, HT.sigil, x, y - 2, { tint: C.gold, alpha: 0, depth: DEPTH.PLAYER - 1 });
  sig.setScale(0.5, 0.17);
  scene.tweens.add({ targets: sig, scaleX: 3, scaleY: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
  tweenOut(scene, sig, { alpha: 0 }, 400, 'Quad.easeIn', 500);
  if (!hfx(scene, 'h_spin', x, y - 40, { scale: 2, dur: 640, add: true, depth: DEPTH.VFX_TOP })) flash(scene, x, y - 40, C.gold, 140, 460, 0.8);
  hfx(scene, 'h_wings', x, y - 50, { scale: 2, add: true, dur: 500, alpha: 0.85, delay: 80, depth: DEPTH.PLAYER - 1 });
  lightShaft(scene, x, y + 2, 60, 220, C.pale, 0, 600);
  motes(scene, x, y - 4, 18, 70);
};

const symbolAura: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.PLAYER - 1);
  // flattened ground sigil turning slowly (rotate the inner image; the flatten lives on its parent)
  const flat = scene.add.container(0, -2).setScale(1, 0.32);
  const sig = img(scene, HT.sigil, 0, 0, { tint: C.gold, alpha: 0.55, scale: 1.5 });
  flat.add(sig);
  c.add(flat);
  loop(scene, c, { targets: sig, angle: 360, duration: 6000, ease: 'Linear' });
  loop(scene, c, { targets: sig, alpha: 0.3, duration: 900, yoyo: true, ease: 'Stepped', easeParams: [3] });
  attachTrail(scene, c, HT.mote, 1100, {
    speedY: { min: -70, max: -30 }, speedX: { min: -6, max: 6 }, lifespan: { min: 700, max: 1100 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS, frequency: 180, quantity: 1,
    emitZone: zone(new Phaser.Geom.Ellipse(0, -2, 80, 14)),
  });
  return c;
};

/** Guardian Spirit: a glowing orb of light with little flapping wings and a halo. Faces +x. */
const guardianBody: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.SUMMON);
  const body = scene.add.container(0, 0);
  const glow = img(scene, HT.glow, 0, 0, { tint: C.gold, scale: 0.9, alpha: 0.5 });
  body.add(glow);
  const wings = wingPair(scene, body, 'h_wing_w', 1, 6, 2, 0.95);
  wings.forEach((w, i) => loop(scene, c, { targets: w, angle: { from: i === 0 ? 18 : -18, to: i === 0 ? -14 : 14 }, duration: 220, yoyo: true, ease: 'Stepped', easeParams: [3] }));
  const orb = hloop(scene, body, 'h_orbb', 0, 0, { scale: 2 }) ?? hloop(scene, body, 'h_heal', 0, 0, { scale: 2, fps: 6 });
  if (!orb) body.add(img(scene, HT.glow, 0, 0, { tint: C.white, scale: 0.35 }));
  const halo = img(scene, HT.halo, 0, -18, { tint: C.gold, scale: 1 });
  body.add(halo);
  c.add(body);
  loop(scene, c, { targets: body, y: -4, duration: 520, yoyo: true, ease: 'Stepped', easeParams: [2] });
  loop(scene, c, { targets: glow, alpha: 0.25, duration: 300, yoyo: true, ease: 'Stepped', easeParams: [2] });
  attachTrail(scene, c, HT.mote, 800, {
    speed: { min: 5, max: 25 }, lifespan: { min: 500, max: 800 }, scale: { start: 2, end: 1 },
    alpha: { start: 1, end: 0 }, tint: GOLD_TINTS, frequency: 120, quantity: 1, gravityY: 30,
    emitZone: zone(new Phaser.Geom.Circle(0, 0, 10)),
  });
  return c;
};

const guardianCast: VfxFn = (scene, o) => {
  if (!hfx(scene, 'h_star', o.x, o.y, { scale: 2, add: true, dur: 260, depth: DEPTH.VFX_TOP })) flash(scene, o.x, o.y, C.gold, 40, 180, 0.9);
  flash(scene, o.x, o.y, C.white, 24, 120, 0.8);
};

const guardianBolt: VfxFn = (scene, o) => {
  const c = projContainer(scene, o);
  c.add(img(scene, HT.glow, 0, 0, { tint: C.gold, scale: 0.45, alpha: 0.7 }));
  if (!hloop(scene, c, 'h_bolt', 0, 0, { scale: 2 })) c.add(img(scene, HT.beam, -6, 0, { tint: C.pale, sx: 0.2, sy: 0.4 }));
  attachTrail(scene, c, HT.mote, 420, {
    speed: { min: 4, max: 24 }, lifespan: { min: 240, max: 420 }, scale: { start: 2, end: 1 },
    alpha: { start: 1, end: 0 }, frequency: 40, quantity: 1, tint: GOLD_TINTS,
  });
  return c;
};

// ───────────────────────────── Tier 4 ─────────────────────────────

const angelRayCast: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  castFx(scene, o, 1.5);
  hfx(scene, 'h_wings', x - f * 18, y - 6, { scale: 2, add: true, dur: 420, alpha: 0.8, depth: DEPTH.PLAYER - 1 });
  const sig = img(scene, HT.sigil, x + f * 4, y, { tint: C.white, alpha: 0.9, depth: DEPTH.VFX_TOP, scale: 0.8 });
  sig.setScale(0.3, 0.8);
  tweenOut(scene, sig, { scaleX: 0.05, alpha: 0 }, 260, 'Cubic.easeIn', 60);
};

const angelRayProj: VfxFn = (scene, o) => {
  const c = projContainer(scene, o);
  const glow = img(scene, HT.glow, 0, 0, { tint: C.gold, sx: 1.6, sy: 0.6, alpha: 0.55 });
  c.add(glow);
  const spear = hloop(scene, c, 'h_spear', -40, 0, { scale: 2 });
  if (!spear) {
    c.add(img(scene, HT.beam, -40, 0, { tint: C.gold, sx: 0.8, sy: 0.9 }));
    c.add(img(scene, HT.beam, -30, 0, { tint: C.white, sx: 0.6, sy: 0.35 }));
  }
  // two little wings riding on the spear head (children only — never the root's scaleY)
  const head = scene.add.container(-6, 0);
  wingPair(scene, head, 'h_wing', 1, 0, 0, 0.9).forEach((w, i) => {
    w.setRotation(i === 0 ? -0.9 : 0.9 + Math.PI).setFlipY(i !== 0);
  });
  c.add(head);
  loop(scene, c, { targets: glow, alpha: 0.3, duration: 100, yoyo: true, ease: 'Stepped' });
  attachTrail(scene, c, HT.mote, 600, {
    speed: { min: 10, max: 50 }, lifespan: { min: 360, max: 600 }, scale: { start: 2, end: 1 },
    alpha: { start: 1, end: 0 }, frequency: 22, quantity: 1, tint: GOLD_TINTS,
    emitZone: zone(new Phaser.Geom.Rectangle(-50, -8, 50, 16)),
  });
  attachTrail(scene, c, 'px_star', 500, {
    speed: { min: 0, max: 20 }, lifespan: { min: 300, max: 500 }, scale: { start: 1.5, end: 0.5 },
    alpha: { start: 1, end: 0 }, frequency: 55, quantity: 1, tint: [C.white, C.cyan],
  }, DEPTH.VFX_TOP);
  return c;
};

const genesisCast: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  const gx = x - f * 18, gy = y + 34;
  castFx(scene, o, 1.8);
  // heaven sigil above, unfolding wings behind the caster, a column of light
  const sig = img(scene, HT.sigil, gx, gy - 120, { tint: C.gold, alpha: 0, depth: DEPTH.VFX_TOP, scale: 0.5 });
  scene.tweens.add({ targets: sig, scale: 3, alpha: 1, angle: 90, duration: 500, ease: 'Cubic.easeOut' });
  tweenOut(scene, sig, { alpha: 0, scale: 3.5 }, 300, 'Quad.easeIn', 520);
  hfx(scene, 'h_spin', gx, gy - 120, { scale: 4, add: true, dur: 700, delay: 100, depth: DEPTH.VFX_TOP });
  if (!hfx(scene, 'h_wings', gx, gy - 52, { scale: 2, add: true, dur: 640, depth: DEPTH.PLAYER - 1 })) flash(scene, gx, gy - 50, C.gold, 200, 600, 0.6);
  lightShaft(scene, gx, gy + 2, 70, 300, C.pale, 0, 700);
  shock(scene, gx, gy, 260, 0.28);
  shock(scene, gx, gy, 180, 0.28, 120);
  stream(scene, gx, gy - 130, 'px_star', 600, 900, {
    x: { min: -80, max: 80 }, speedY: { min: 60, max: 160 }, lifespan: { min: 600, max: 900 },
    scale: { start: 1.5, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: [C.white, C.pale, C.gold], frequency: 40, quantity: 1,
  }, DEPTH.VFX_TOP);
  shake(scene, 200, 0.003);
};

/** Falling pillar body: a short blinding streak pointing +x (engine rotates it to point down). */
const genesisProj: VfxFn = (scene, o) => {
  const c = projContainer(scene, o);
  const tail = img(scene, HT.beam, 0, 0, { tint: C.gold, origin: [1, 0.5], sx: 1.6, sy: 1.6, alpha: 0.75 });
  const core = img(scene, HT.beam, 0, 0, { tint: C.white, origin: [1, 0.5], sx: 1.1, sy: 0.7 });
  const head = img(scene, HT.glow, 0, 0, { tint: C.white, scale: 0.8 });
  c.add([tail, core, head]);
  loop(scene, c, { targets: tail, alpha: 0.45, duration: 70, yoyo: true, ease: 'Stepped' });
  attachTrail(scene, c, HT.mote, 400, {
    speed: { min: 10, max: 60 }, lifespan: { min: 220, max: 400 }, scale: { start: 2, end: 1 },
    alpha: { start: 1, end: 0 }, frequency: 20, quantity: 1, tint: GOLD_TINTS,
    emitZone: zone(new Phaser.Geom.Circle(0, 0, 10)),
  });
  return c;
};

/** Genesis impact: a pillar of light erupts from the ground point (x,y = ground). */
const genesisImpact: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 150, 260);
  const { x, y } = o;
  const col = hfx(scene, 'h_pillar', x, y + 6, { scale: 4, oy: 1, dur: 620, depth: DEPTH.VFX_TOP });
  if (col) {
    hfx(scene, 'h_pillar_l', x - w * 0.28, y + 4, { scale: 2, oy: 1, dur: 560, delay: 50, add: true, depth: DEPTH.VFX });
    hfx(scene, 'h_pillar_l', x + w * 0.28, y + 4, { scale: 2, oy: 1, dur: 560, delay: 90, add: true, depth: DEPTH.VFX });
  }
  lightShaft(scene, x, y + 2, w * 0.55, h * 1.15, C.pale, 0, 520, DEPTH.VFX);
  lightShaft(scene, x, y + 2, w * 0.22, h * 1.2, C.white, 20, 460, DEPTH.VFX_TOP);
  if (!hfx(scene, 'h_burst', x, y - 18, { scale: 4, dur: 380, depth: DEPTH.VFX_TOP })) flash(scene, x, y - 30, C.white, w, 260, 1);
  shock(scene, x, y - 2, w * 1.3, 0.25);
  burst(scene, x, y - 6, 'px_star', 8, 800, {
    speed: { min: 140, max: 300 }, angle: { min: 220, max: 320 }, gravityY: 420, lifespan: { min: 450, max: 800 },
    scale: { start: 1.5, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS,
  }, DEPTH.VFX_TOP);
  stream(scene, x, y - 4, HT.mote, 300, 900, {
    x: { min: -w * 0.3, max: w * 0.3 }, speedY: { min: -220, max: -90 }, lifespan: { min: 500, max: 900 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS, frequency: 25, quantity: 1,
  });
  shake(scene, 100, 0.004);
};

/** Seraph: the winged angel (Cabbit / AntumDeluge), golden wing aura behind, halo glow. Faces +x. Origin = body center. */
const seraphBody: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.SUMMON);
  const body = scene.add.container(0, 0);
  const glow = img(scene, HT.glow, -6, 0, { tint: C.pale, sx: 2.2, sy: 2.6, alpha: 0.35 });
  body.add(glow);
  const aura = hfx(scene, 'h_wings', -10, -18, { scale: 2, frame: 3, add: true, alpha: 0.7 });
  if (aura) body.add(aura);
  const angel = hloop(scene, body, 'h_angel', 0, 0, { scale: 2 });
  if (!angel) {
    wingPair(scene, body, 'h_wing_w', 0, 0, -20, 1).forEach(w => w.setScale(4));
    body.add(img(scene, HT.shaft, 0, 60, { tint: C.white, origin: [0.5, 1], sx: 1.5, sy: 0.9, alpha: 0.9 }));
    body.add(img(scene, HT.halo, 0, -60, { tint: C.gold, scale: 2 }));
  }
  c.add(body);
  loop(scene, c, { targets: body, y: -6, duration: 800, yoyo: true, ease: 'Stepped', easeParams: [3] });
  loop(scene, c, { targets: glow, alpha: 0.18, duration: 700, yoyo: true, ease: 'Stepped', easeParams: [3] });
  if (aura) loop(scene, c, { targets: aura, alpha: 0.4, duration: 900, yoyo: true, ease: 'Stepped', easeParams: [3] });
  attachTrail(scene, c, HT.mote, 1100, {
    speedY: { min: 10, max: 50 }, speedX: { min: -12, max: 12 }, lifespan: { min: 700, max: 1100 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS, frequency: 90, quantity: 1,
    emitZone: zone(new Phaser.Geom.Rectangle(-30, 30, 50, 30)),
  });
  // descent flash when it appears
  flash(scene, o.x, o.y, C.white, 180, 420, 0.9);
  lightShaft(scene, o.x, o.y + 70, 70, 260, C.pale, 0, 500);
  return c;
};

const seraphCast: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  if (!hfx(scene, 'h_ringpop', x + f * 6, y + 24, { scale: 4, add: true, dur: 320, depth: DEPTH.VFX_TOP })) flash(scene, x, y, C.gold, 80, 240, 0.9);
  flash(scene, x + f * 6, y + 24, C.white, 50, 180, 0.9);
};

const seraphBeam: VfxFn = (scene, o) => {
  lightBeam(scene, o, (o.h ?? 100) * 0.7, [C.sky, C.pale, C.white]);
};

const aegisCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  if (!hfx(scene, 'h_ward', x, y - 34, { scale: 4, add: true, dur: 600, depth: DEPTH.VFX_TOP })) flash(scene, x, y - 34, C.gold, 160, 520, 0.8);
  hfx(scene, 'h_wings', x, y - 50, { scale: 2, add: true, dur: 560, depth: DEPTH.PLAYER - 1 });
  hfx(scene, 'h_nebula', x, y - 36, { scale: 2, dur: 520, alpha: 0.6, delay: 120, depth: DEPTH.VFX });
  lightShaft(scene, x, y + 2, 80, 240, C.pale, 0, 640);
  shock(scene, x, y - 2, 200, 0.3);
  motes(scene, x, y - 10, 20, 80);
  shake(scene, 120, 0.002);
};

const aegisAura: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  // small golden wings behind the shoulders, a golden ward bubble in front
  const back = scene.add.container(-2, -50).setDepth(DEPTH.PLAYER - 1);
  const wings = wingPair(scene, back, 'h_wing', 0, 4, 0, 0.7);
  wings.forEach((w, i) => loop(scene, c, { targets: w, angle: { from: i === 0 ? -6 : 6, to: i === 0 ? 8 : -8 }, duration: 700, yoyo: true, ease: 'Stepped', easeParams: [3] }));
  c.add(back);
  const ward = hloop(scene, c, 'h_ward', 0, -34, { scale: 2, alpha: 0.5, add: true, fps: 10 });
  if (!ward) {
    const r = img(scene, 'px_ring', 0, -34, { tint: C.gold, scale: 2.4, alpha: 0.6 });
    c.add(r);
    loop(scene, c, { targets: r, alpha: 0.3, duration: 600, yoyo: true, ease: 'Stepped', easeParams: [3] });
  }
  attachTrail(scene, c, HT.mote, 900, {
    speedY: { min: -50, max: -20 }, speedX: { min: -10, max: 10 }, lifespan: { min: 600, max: 900 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: LIGHT_TINTS, frequency: 160, quantity: 1,
    emitZone: zone(new Phaser.Geom.Circle(0, -34, 34), 'edge', 24),
  });
  return c;
};

// ───────────────────────────── Year 2 additions ─────────────────────────────

const PRISM_TINTS = [C.white, C.cyan, C.pale];

/** Prism Shards: a spinning diamond of light pointing +x, each shot a different prism hue. */
const prismProj: VfxFn = (scene, o) => {
  const c = projContainer(scene, o);
  const tint = PRISM_TINTS[Math.floor(Math.random() * PRISM_TINTS.length)];
  c.add(img(scene, HT.glow, 0, 0, { tint, scale: 0.4, alpha: 0.6 }));
  const gem = img(scene, 'px_shard', 0, 0, { tint, scale: 2, rot: Math.PI / 2, add: false });
  const shine = img(scene, 'px_shard', 0, 0, { tint: C.white, sx: 1, sy: 1.2, rot: Math.PI / 2, alpha: 0.8 });
  c.add([gem, shine]);
  loop(scene, c, { targets: shine, alpha: 0.2, duration: 80, yoyo: true, ease: 'Stepped' });
  attachTrail(scene, c, HT.mote, 360, {
    speed: { min: 0, max: 18 }, lifespan: { min: 200, max: 360 }, scale: { start: 2, end: 1 },
    alpha: { start: 1, end: 0 }, frequency: 30, quantity: 1, tint: [tint, C.white],
  });
  return c;
};

/** Smite: a giant cross of light slams down on the area, ground burst + shockwave. */
const smiteArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 160, 120);
  const gy = o.groundY ?? o.y + h * 0.5;
  const x = o.x;
  const cross = img(scene, HT.cross, x, gy - 160, { tint: C.gold, scale: 5, alpha: 0, depth: DEPTH.VFX_TOP });
  cross.setOrigin(0.5, 1);
  scene.tweens.add({ targets: cross, alpha: 1, duration: 40 });
  scene.tweens.add({
    targets: cross, y: gy + 2, duration: 150, ease: 'Quad.easeIn',
    onComplete: () => {
      tweenOut(scene, cross, { alpha: 0 }, 260, 'Stepped', 60);
      if (!hfx(scene, 'h_burst', x, gy - 56, { scale: 4, dur: 340, depth: DEPTH.VFX_TOP })) flash(scene, x, gy - 24, C.white, w, 240, 1);
      for (const s of [-1, 1]) hfx(scene, 'h_flame', x + s * w * 0.3, gy + 4, { scale: 2, oy: 1, dur: 420, add: true, flipX: s < 0 });
      shock(scene, x, gy - 2, w * 1.4, 0.28);
      burst(scene, x, gy - 6, 'px_star', 10, 700, {
        speed: { min: 120, max: 260 }, angle: { min: 200, max: 340 }, gravityY: 500, lifespan: { min: 400, max: 700 },
        scale: { start: 1.5, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS,
      }, DEPTH.VFX_TOP);
      shake(scene, 90, 0.003);
    },
  });
  const ghost = img(scene, HT.cross, x, gy - 160, { tint: C.white, scale: 5, alpha: 0.35, depth: DEPTH.VFX });
  ghost.setOrigin(0.5, 1);
  tweenOut(scene, ghost, { y: gy - 40, alpha: 0 }, 200, 'Quad.easeIn');
};

/** Holy Step out: the body dissolves into feathers of light. */
const stepOut: VfxFn = (scene, o) => {
  const { x, y } = o;
  lightShaft(scene, x, y + 2, 40, 120, C.pale, 0, 300);
  if (!hfx(scene, 'h_wings', x, y - 46, { scale: 2, add: true, dur: 300, alpha: 0.8, depth: DEPTH.VFX })) flash(scene, x, y - 36, C.gold, 80, 260, 0.8);
  burst(scene, x, y - 34, HT.mote, 14, 700, {
    speed: { min: 40, max: 130 }, angle: { min: 0, max: 360 }, gravityY: -60, lifespan: { min: 400, max: 700 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS,
  }, DEPTH.VFX_TOP);
};

/** Holy Step in: a beam of light lands, a small heal bloom. */
const stepIn: VfxFn = (scene, o) => {
  const { x, y } = o;
  lightShaft(scene, x, y + 2, 34, 200, C.white, 0, 360, DEPTH.VFX_TOP);
  hfx(scene, 'h_heal', x, y - 34, { scale: 2, add: true, dur: 360, depth: DEPTH.VFX_TOP });
  shock(scene, x, y - 2, 90, 0.3);
  motes(scene, x, y - 4, 8, 34, HEAL_TINTS);
};

// ───────────────────────────── Year 3 additions ─────────────────────────────

/** Consecration: persistent hallowed ground (engine-free — the cast owns it). x,y = feet center. */
const consecrationField: VfxFn = (scene, o) => {
  const w = o.w ?? 280;
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.PLAYER - 1);
  const pool = img(scene, HT.glow, 0, -4, { tint: C.gold, sx: w / 64, sy: 0.5, alpha: 0.35 });
  const flat = scene.add.container(0, -2).setScale(1, 0.26);
  const k = Math.max(2, Math.round(w / 64));
  const sig = img(scene, HT.sigil, 0, 0, { tint: C.pale, scale: k, alpha: 0.75 });
  const inner = img(scene, HT.sigil, 0, 0, { tint: C.gold, scale: k * 0.5, alpha: 0.9 });
  flat.add([sig, inner]);
  c.add([pool, flat]);
  loop(scene, c, { targets: sig, angle: 360, duration: 7000, ease: 'Linear' });
  loop(scene, c, { targets: inner, angle: -360, duration: 4000, ease: 'Linear' });
  loop(scene, c, { targets: pool, alpha: 0.18, duration: 400, yoyo: true, ease: 'Stepped', easeParams: [2] });
  for (const s of [-1, 1]) {
    const f = hloop(scene, c, 'h_flame', s * (w / 2 - 8), 4, { scale: 2, oy: 1, add: true, randomStart: true, flipX: s < 0 });
    if (!f) c.add(img(scene, HT.shaft, s * (w / 2 - 8), 2, { tint: C.gold, origin: [0.5, 1], sx: 1, sy: 0.6, alpha: 0.8 }));
  }
  attachTrail(scene, c, HT.mote, 1100, {
    speedY: { min: -90, max: -35 }, speedX: { min: -6, max: 6 }, lifespan: { min: 700, max: 1100 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: [C.white, C.gold, C.green], frequency: 50, quantity: 1,
    emitZone: zone(new Phaser.Geom.Rectangle(-w / 2, -8, w, 10)),
  }, DEPTH.VFX);
  shock(scene, o.x, o.y - 2, w * 1.1, 0.26);
  return c;
};

/** Consecration tick: crosses flare up across the field. */
const consecrationPulse: VfxFn = (scene, o) => {
  const w = o.w ?? 280;
  for (let i = 0; i < 3; i++) {
    const x = o.x + rnd(-0.42, 0.42) * w;
    const cr = img(scene, HT.cross, x, o.y - 6, { tint: i % 2 ? C.white : C.gold, alpha: 0, depth: DEPTH.VFX, scale: 2 });
    cr.setOrigin(0.5, 1);
    scene.tweens.add({ targets: cr, alpha: 1, duration: 60, delay: i * 70 });
    tweenOut(scene, cr, { y: o.y - 40, alpha: 0 }, 420, 'Quad.easeOut', 60 + i * 70);
  }
  shock(scene, o.x, o.y - 2, w * 0.9, 0.24);
};

/** Prayer of Mana: cool white-cyan light pours over the caster. */
const prayerFx: VfxFn = (scene, o) => {
  const { x, y } = o;
  if (!hfx(scene, 'h_wings_l', x, y - 50, { scale: 2, add: true, dur: 600, depth: DEPTH.PLAYER - 1 })) flash(scene, x, y - 40, C.cyan, 140, 500, 0.8);
  hfx(scene, 'h_ward_l', x, y - 34, { scale: 2, add: true, dur: 600, depth: DEPTH.VFX_TOP });
  lightShaft(scene, x, y + 2, 50, 260, C.cyan, 0, 700);
  stream(scene, x, y - 220, HT.mote, 600, 900, {
    x: { min: -26, max: 26 }, speedY: { min: 120, max: 200 }, lifespan: { min: 700, max: 900 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: LIGHT_TINTS, frequency: 30, quantity: 1,
  }, DEPTH.VFX_TOP);
};

// ───────────────────────────── Year 4 additions ─────────────────────────────

/** Halo Nova: a blazing halo ring explodes outward along the ground from the caster. */
const novaArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 380, 200);
  const x = o.x, gy = o.groundY ?? o.y + h * 0.5 - 20;
  const cy = gy - 36;
  if (!hfx(scene, 'h_sun', x, cy, { scale: 2, dur: 420, depth: DEPTH.VFX_TOP })) flash(scene, x, cy, C.white, 160, 300, 1);
  // the halo itself: a flat ring sprite racing outward
  const halo = img(scene, HT.halo, x, cy, { tint: C.gold, scale: 1, depth: DEPTH.VFX_TOP });
  scene.tweens.add({ targets: halo, scaleX: w / 32, scaleY: (w / 32) * 0.45, duration: 380, ease: 'Cubic.easeOut' });
  tweenOut(scene, halo, { alpha: 0 }, 260, 'Stepped', 260);
  const halo2 = img(scene, HT.halo, x, gy - 4, { tint: C.white, scale: 1, depth: DEPTH.VFX });
  scene.tweens.add({ targets: halo2, scaleX: w / 32 * 1.1, scaleY: (w / 32) * 0.2, duration: 420, ease: 'Cubic.easeOut' });
  tweenOut(scene, halo2, { alpha: 0 }, 260, 'Stepped', 300);
  shock(scene, x, gy - 2, w * 1.1, 0.25);
  shock(scene, x, cy, w * 0.7, 0.6, 80);
  burst(scene, x, cy, 'px_star', 20, 700, {
    speed: { min: w * 0.6, max: w * 1.1 }, angle: { min: 0, max: 360 }, lifespan: { min: 400, max: 700 },
    scale: { start: 2, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS,
  }, DEPTH.VFX_TOP);
  for (let i = 0; i < 6; i++) {
    const s = i % 2 ? 1 : -1, t = 0.18 + (Math.floor(i / 2) * 0.16);
    hfx(scene, 'h_flame', x + s * t * w, gy + 4, { scale: 2, oy: 1, add: true, dur: 420, delay: 60 + Math.floor(i / 2) * 60, flipX: s < 0 });
  }
  shake(scene, 140, 0.004);
};

/** Screen-space overlay flash (camera-fixed, self-destroys). */
function screenFlash(scene: Phaser.Scene, tint: number, alpha: number, dur: number, delay = 0): void {
  const cam = scene.cameras.main;
  const r = scene.add.rectangle(0, 0, cam.width, cam.height, tint, 1).setOrigin(0, 0).setScrollFactor(0)
    .setDepth(DEPTH.VFX_TOP + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  scene.tweens.add({ targets: r, alpha, duration: 60, delay });
  tweenOut(scene, r, { alpha: 0 }, dur, 'Quad.easeIn', delay + 80);
}

const judgmentCast: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  const gx = x - f * 18, gy = y + 34;
  castFx(scene, o, 1.8);
  const sig = img(scene, HT.sigil, gx, gy - 130, { tint: C.white, alpha: 0, depth: DEPTH.VFX_TOP, scale: 0.5 });
  scene.tweens.add({ targets: sig, scale: 3, alpha: 0.75, angle: -180, duration: 700, ease: 'Cubic.easeOut' });
  tweenOut(scene, sig, { alpha: 0, scale: 3.6 }, 260, 'Quad.easeIn', 720);
  hfx(scene, 'h_spin', gx, gy - 130, { scale: 4, add: true, dur: 800, depth: DEPTH.VFX_TOP });
  if (!hfx(scene, 'h_wings', gx, gy - 52, { scale: 2, add: true, dur: 700, depth: DEPTH.PLAYER - 1 })) flash(scene, gx, gy - 50, C.gold, 220, 700, 0.6);
  lightShaft(scene, gx, gy + 2, 90, 340, C.white, 0, 900);
  shake(scene, 300, 0.002);
};

/** Judgment: sigils gather in the sky across the screen, then every column of light falls at once (damage at +900ms). */
const judgmentArea: VfxFn = (scene, o) => {
  const cam = scene.cameras.main;
  const view = cam.worldView;
  const w = Math.min(o.w ?? 1400, Math.max(400, view.width));
  const gy = o.groundY ?? o.y + 34;
  const cx = o.x;
  const N = 9;
  const xs = Array.from({ length: N }, (_, i) => cx - w / 2 + (w * (i + 0.5)) / N + rnd(-20, 20));
  const top = Math.max(view.y + 40, gy - 320);
  // gathering: small sigils over each column + thin guide rays
  xs.forEach((x, i) => {
    const sg = img(scene, HT.sigil, x, top, { tint: C.gold, alpha: 0, depth: DEPTH.VFX_TOP, scale: 0.5 });
    scene.tweens.add({ targets: sg, alpha: 0.9, scale: 1, angle: 90, duration: 400, delay: i * 50, ease: 'Back.easeOut' });
    tweenOut(scene, sg, { alpha: 0, scale: 1.6 }, 260, 'Quad.easeIn', 880);
    const guide = img(scene, HT.ray, x, gy, { tint: C.pale, origin: [0.5, 1], alpha: 0, depth: DEPTH.VFX });
    guide.setScale(0.5, (gy - top) / 64);
    scene.tweens.add({ targets: guide, alpha: 0.45, duration: 300, delay: 200 + i * 40 });
    tweenOut(scene, guide, { alpha: 0 }, 120, 'Linear', 880);
  });
  // the verdict
  scene.time.delayedCall(880, () => {
    screenFlash(scene, 0xfff3c0, 0.4, 420);
    xs.forEach((x, i) => {
      const d = (i % 3) * 40;
      lightShaft(scene, x, gy + 2, 60, gy - top + 40, i % 2 ? C.pale : C.white, d, 560, DEPTH.VFX_TOP);
      hfx(scene, 'h_pillar', x, gy + 6, { scale: 2, oy: 1, dur: 560, delay: d, depth: DEPTH.VFX });
      hfx(scene, 'h_burst', x, gy - 20, { scale: 2, delay: d + 60, depth: DEPTH.VFX_TOP });
    });
    for (let k = 1; k <= 3; k++) {
      scene.time.delayedCall(k * 170, () => {
        screenFlash(scene, 0xffe9a0, 0.22, 200);
        shock(scene, cx + rnd(-0.3, 0.3) * w, gy - 2, 260, 0.25);
      });
    }
    burst(scene, cx, gy - 6, HT.mote, 40, 1200, {
      speedY: { min: -260, max: -80 }, speedX: { min: -40, max: 40 }, lifespan: { min: 700, max: 1200 },
      scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS,
      emitZone: zone(new Phaser.Geom.Rectangle(-w / 2, -10, w, 10)),
    }, DEPTH.VFX_TOP);
    shake(scene, 420, 0.007);
  });
};

/** Salvation: a radiant answered prayer — wings, heal bloom and a rain of green-gold light. */
const salvationFx: VfxFn = (scene, o) => {
  const { x, y } = o;
  if (!hfx(scene, 'h_heal', x, y - 40, { scale: 4, add: true, dur: 700, depth: DEPTH.VFX_TOP })) flash(scene, x, y - 40, C.green, 180, 600, 0.9);
  hfx(scene, 'h_wings', x, y - 52, { scale: 2, add: true, dur: 700, depth: DEPTH.PLAYER - 1 });
  hfx(scene, 'h_nebula', x, y - 40, { scale: 2, dur: 640, alpha: 0.7, delay: 100, depth: DEPTH.VFX });
  lightShaft(scene, x, y + 2, 90, 320, C.white, 0, 900, DEPTH.VFX_TOP);
  shock(scene, x, y - 2, 220, 0.28);
  for (let i = 0; i < 6; i++) {
    const cr = img(scene, HT.cross, x + rnd(-30, 30), y - rnd(10, 60), { tint: i % 2 ? C.green : C.white, alpha: 0, depth: DEPTH.VFX_TOP, scale: 2 });
    scene.tweens.add({ targets: cr, alpha: 1, duration: 100, delay: i * 70 });
    tweenOut(scene, cr, { y: cr.y - 60, alpha: 0 }, 800, 'Quad.easeOut', 100 + i * 70);
  }
  stream(scene, x, y - 240, HT.mote, 700, 900, {
    x: { min: -40, max: 40 }, speedY: { min: 140, max: 240 }, lifespan: { min: 700, max: 900 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: HEAL_TINTS, frequency: 25, quantity: 1,
  }, DEPTH.VFX_TOP);
};

// ───────────────────────────── registry ─────────────────────────────

export function registerHolyVfx(): void {
  const reg = (key: string, fn: VfxFn) => registerVfx(key, safe(fn));
  reg('holy_cast', (scene, o) => { castFx(scene, o, o.scale ?? 1); });
  reg('holy_cast_big', (scene, o) => { castFx(scene, o, 1.6 * (o.scale ?? 1)); });
  reg('holy_hit', (scene, o) => { hitFx(scene, o.x, o.y, o.scale ?? 1); });
  reg('holy_hit_big', (scene, o) => { hitFx(scene, o.x, o.y, 1.5 * (o.scale ?? 1)); });

  reg('holy_arrow_proj', arrowProj);
  reg('holy_heal_self', healSelf);
  reg('holy_heal_area', healArea);
  reg('holy_bless_cast', blessCast);
  reg('holy_bless_aura', blessAura);

  reg('holy_shining_area', shiningArea);
  reg('holy_lance_cast', lanceCast);
  reg('holy_lance_beam', lanceBeam);
  reg('holy_symbol_cast', symbolCast);
  reg('holy_symbol_aura', symbolAura);
  reg('holy_guardian', guardianBody);
  reg('holy_guardian_cast', guardianCast);
  reg('holy_guardian_bolt', guardianBolt);

  reg('holy_angelray_cast', angelRayCast);
  reg('holy_angelray_proj', angelRayProj);
  reg('holy_genesis_cast', genesisCast);
  reg('holy_genesis_proj', genesisProj);
  reg('holy_genesis_impact', genesisImpact);
  reg('holy_seraph', seraphBody);
  reg('holy_seraph_cast', seraphCast);
  reg('holy_seraph_beam', seraphBeam);
  reg('holy_aegis_cast', aegisCast);
  reg('holy_aegis_aura', aegisAura);

  reg('holy_prism_proj', prismProj);
  reg('holy_smite_area', smiteArea);
  reg('holy_step_out', stepOut);
  reg('holy_step_in', stepIn);
  reg('holy_consecration_field', consecrationField);
  reg('holy_consecration_pulse', consecrationPulse);
  reg('holy_prayer', prayerFx);
  reg('holy_nova_area', novaArea);
  reg('holy_judgment_cast', judgmentCast);
  reg('holy_judgment_area', judgmentArea);
  reg('holy_salvation', salvationFx);
}
