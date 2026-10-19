// OWNER: Holy tree agent. Year 5 (Light Archon) VFX: recolours of the existing holy sheets / pixel helpers in new
// compositions (sunfall comet, rolling nova rings, the Fellowship's circling lights, lantern post, mercy bloom).
// Registered through holyVfx's lazy `registerVfx` (see `registerHolyY5Vfx`), so textures build on first use.
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import type { VfxFn, VfxOptions } from '../../core/types';
import { HT } from './textures';
import { hfx, hloop } from './sheets';
import {
  C, GOLD_TINTS, HEAL_TINTS, rnd, img, tweenOut, loop, shake, flash, shock, burst, stream,
  attachTrail, zone, motes, sparks,
} from './fx';

const sizeOf = (o: VfxOptions, dw: number, dh: number) => ({ w: o.w ?? dw, h: o.h ?? dh });

/** Light shaft growing up from the ground (`gy` = ground), then fading. */
function shaft(scene: Phaser.Scene, x: number, gy: number, w: number, h: number, tint: number, delay: number, life: number, depth: number = DEPTH.VFX): void {
  const sh = img(scene, HT.shaft, x, gy, { tint, origin: [0.5, 1], alpha: 0, depth });
  const sx = Math.max(1, Math.round(w / 16 / 0.5) * 0.5);
  sh.setScale(sx * 0.3, h / 128);
  scene.tweens.add({ targets: sh, scaleX: sx, alpha: 0.95, duration: 120, delay, ease: 'Quad.easeOut' });
  tweenOut(scene, sh, { scaleX: sx * 0.2, alpha: 0 }, life, 'Quad.easeIn', delay + 160);
}

function screenFlash(scene: Phaser.Scene, tint: number, alpha: number, dur: number, delay = 0): void {
  const cam = scene.cameras.main;
  const r = scene.add.rectangle(0, 0, cam.width, cam.height, tint, 1).setOrigin(0, 0).setScrollFactor(0)
    .setDepth(DEPTH.VFX_TOP + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  scene.tweens.add({ targets: r, alpha, duration: 60, delay });
  tweenOut(scene, r, { alpha: 0 }, dur, 'Quad.easeIn', delay + 80);
}

/** Flat ring sprite racing outward (the "halo" texture), centred at (x,y). */
function haloRing(scene: Phaser.Scene, x: number, y: number, w: number, flat: number, tint: number, delay: number, dur = 380): void {
  const r = img(scene, HT.halo, x, y, { tint, scale: 1, alpha: 0, depth: DEPTH.VFX_TOP });
  scene.tweens.add({ targets: r, alpha: 1, duration: 40, delay });
  scene.tweens.add({ targets: r, scaleX: w / 32, scaleY: (w / 32) * flat, duration: dur, delay, ease: 'Cubic.easeOut' });
  tweenOut(scene, r, { alpha: 0 }, 240, 'Stepped', delay + dur - 60);
}

// ───────────────────────────── Sunfall ─────────────────────────────

/** A shard of the sun drops on the target (x,y = area centre; ground from groundY or y + h/2). */
const sunfallArea: VfxFn = (scene, o) => {
  const { h } = sizeOf(o, 130, 300);
  const gy = o.groundY ?? o.y + h * 0.5 - 10;
  const x = o.x;
  const top = gy - 300;
  const sig = img(scene, HT.sigil, x, top, { tint: C.white, alpha: 0, depth: DEPTH.VFX_TOP, scale: 0.5 });
  sig.setScale(1, 0.45);
  scene.tweens.add({ targets: sig, alpha: 0.95, scaleX: 2.2, scaleY: 0.9, angle: 120, duration: 260, ease: 'Back.easeOut' });
  tweenOut(scene, sig, { alpha: 0 }, 220, 'Stepped', 300);
  // the comet: a bright orb with a long tail falling down the column
  const tail = img(scene, HT.ray, x, top, { tint: C.gold, origin: [0.5, 1], alpha: 0, depth: DEPTH.VFX, sx: 1.6, sy: 2 });
  const orb = hfx(scene, 'h_sun', x, top, { scale: 2, frame: 0, add: true, depth: DEPTH.VFX_TOP })
    ?? img(scene, HT.glow, x, top, { tint: C.white, scale: 0.9, depth: DEPTH.VFX_TOP });
  scene.tweens.add({ targets: tail, alpha: 0.9, duration: 80, delay: 160 });
  scene.tweens.add({
    targets: [tail, orb], y: gy - 10, duration: 220, delay: 200, ease: 'Quad.easeIn',
    onComplete: () => {
      if (tail.scene) tail.destroy();
      if (orb.scene) orb.destroy();
      if (!hfx(scene, 'h_sun', x, gy - 36, { scale: 4, dur: 460, depth: DEPTH.VFX_TOP })) flash(scene, x, gy - 36, C.white, 180, 320, 1);
      hfx(scene, 'h_pillar', x, gy + 6, { scale: 3, oy: 1, dur: 520, depth: DEPTH.VFX });
      shaft(scene, x, gy + 2, 70, 320, C.pale, 0, 480, DEPTH.VFX);
      shaft(scene, x, gy + 2, 26, 340, C.white, 20, 420, DEPTH.VFX_TOP);
      shock(scene, x, gy - 2, 230, 0.26);
      shock(scene, x, gy - 2, 150, 0.26, 100);
      burst(scene, x, gy - 10, 'px_star', 12, 800, {
        speed: { min: 140, max: 320 }, angle: { min: 200, max: 340 }, gravityY: 420, lifespan: { min: 450, max: 800 },
        scale: { start: 1.6, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS,
      }, DEPTH.VFX_TOP);
      shake(scene, 150, 0.005);
    },
  });
};

// ───────────────────────────── Empyrean Nova ─────────────────────────────

/** Two rolling rings of heavenly fire (the cast plays twice via the engine's multi-hit; the visual is one big wave). */
const empyreanArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 480, 240);
  const x = o.x, gy = o.groundY ?? o.y + h * 0.5 - 20;
  const cy = gy - 40;
  if (!hfx(scene, 'h_nebula', x, cy, { scale: 4, dur: 520, alpha: 0.8, depth: DEPTH.VFX_TOP })) flash(scene, x, cy, C.white, 220, 360, 1);
  if (!hfx(scene, 'h_sun', x, cy, { scale: 3, dur: 420, depth: DEPTH.VFX_TOP })) flash(scene, x, cy, C.gold, 160, 300, 1);
  haloRing(scene, x, cy, w, 0.45, C.gold, 0);
  haloRing(scene, x, gy - 4, w * 1.1, 0.2, C.white, 40, 420);
  haloRing(scene, x, cy, w * 1.25, 0.5, C.cyan, 200, 420);
  shock(scene, x, gy - 2, w * 1.2, 0.25);
  shock(scene, x, cy, w * 0.8, 0.6, 120, DEPTH.VFX, C.cyan);
  for (let i = 0; i < 8; i++) {
    const s = i % 2 ? 1 : -1, t = 0.1 + Math.floor(i / 2) * 0.12;
    hfx(scene, 'h_flame', x + s * t * w, gy + 4, { scale: 3, oy: 1, add: true, dur: 460, delay: 40 + Math.floor(i / 2) * 55, flipX: s < 0 });
  }
  burst(scene, x, cy, 'px_star', 24, 800, {
    speed: { min: w * 0.6, max: w * 1.2 }, angle: { min: 0, max: 360 }, lifespan: { min: 400, max: 800 },
    scale: { start: 2, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: [...GOLD_TINTS, C.cyan],
  }, DEPTH.VFX_TOP);
  shake(scene, 180, 0.005);
};

// ───────────────────────────── Fellowship of Light ─────────────────────────────

const fellowshipCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  const gy = y;
  screenFlash(scene, 0xfff3c0, 0.3, 360);
  hfx(scene, 'h_wings', x, y - 50, { scale: 3, add: true, dur: 640, depth: DEPTH.PLAYER - 1 });
  hfx(scene, 'h_ringpop', x, y - 40, { scale: 6, add: true, dur: 420, depth: DEPTH.VFX_TOP });
  const sig = img(scene, HT.sigil, x, gy - 150, { tint: C.white, alpha: 0, depth: DEPTH.VFX_TOP, scale: 0.5 });
  scene.tweens.add({ targets: sig, scale: 3.4, alpha: 0.85, angle: 180, duration: 760, ease: 'Cubic.easeOut' });
  tweenOut(scene, sig, { alpha: 0, scale: 4 }, 240, 'Quad.easeIn', 780);
  shaft(scene, x, gy + 2, 80, 300, C.pale, 0, 700);
  shock(scene, x, gy - 2, 240, 0.3);
  motes(scene, x, gy - 10, 22, 90, HEAL_TINTS);
};

/** The whole screen is scoured: columns of dawn across the view, then a golden bloom on the ground. */
const fellowshipArea: VfxFn = (scene, o) => {
  const view = scene.cameras.main.worldView;
  const w = Math.min(o.w ?? 1400, Math.max(400, view.width));
  const gy = o.groundY ?? o.y + 34;
  const N = 10;
  const top = Math.max(view.y + 30, gy - 340);
  for (let i = 0; i < 4; i++) {
    scene.time.delayedCall(i * 150, () => {
      screenFlash(scene, i % 2 ? 0xffe9a0 : 0xffffff, 0.24, 220);
      for (let k = 0; k < N; k++) {
        const x = o.x - w / 2 + (w * (k + 0.5)) / N + rnd(-26, 26);
        if ((k + i) % 2) continue;
        const d = (k % 3) * 30;
        shaft(scene, x, gy + 2, 56, gy - top + 40, k % 2 ? C.pale : C.white, d, 420, DEPTH.VFX_TOP);
        hfx(scene, 'h_pillar', x, gy + 6, { scale: 2, oy: 1, dur: 460, delay: d, depth: DEPTH.VFX });
        hfx(scene, 'h_burst', x, gy - 20, { scale: 2, delay: d + 50, depth: DEPTH.VFX_TOP });
      }
      shock(scene, o.x + rnd(-0.3, 0.3) * w, gy - 2, 260, 0.25);
      shake(scene, 200, 0.006);
    });
  }
  burst(scene, o.x, gy - 6, HT.mote, 46, 1300, {
    speedY: { min: -280, max: -80 }, speedX: { min: -40, max: 40 }, lifespan: { min: 700, max: 1300 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS,
    emitZone: zone(new Phaser.Geom.Rectangle(-w / 2, -10, w, 10)),
  }, DEPTH.VFX_TOP);
};

/** Persistent: five small wing-lights circle the caster while the fellowship fights for them. At feet. */
const fellowshipAura: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  const halo = img(scene, HT.halo, 0, -92, { tint: C.gold, scale: 2.4, alpha: 0.9 });
  const glow = img(scene, HT.glow, 0, -36, { tint: C.pale, sx: 1.5, sy: 1.8, alpha: 0.18 });
  c.add([glow, halo]);
  loop(scene, c, { targets: [glow, halo], alpha: 0.35, duration: 520, yoyo: true, ease: 'Stepped', easeParams: [3] });
  const N = 5;
  const orbs: { g: Phaser.GameObjects.Container; a0: number }[] = [];
  for (let i = 0; i < N; i++) {
    const g = scene.add.container(0, 0);
    const core = hloop(scene, g, 'h_orb', 0, 0, { scale: 2, add: true })
      ?? (() => { const im = img(scene, HT.glow, 0, 0, { tint: i % 2 ? C.white : C.gold, scale: 0.35 }); g.add(im); return im; })();
    const wing = hloop(scene, g, 'h_wing', 0, -2, { scale: 1, alpha: 0.7, ox: 0.5, oy: 0.5, frame: 1 });
    void core; void wing;
    c.add(g);
    orbs.push({ g, a0: (i / N) * Math.PI * 2 });
  }
  const tw = scene.tweens.addCounter({
    from: 0, to: Math.PI * 2, duration: 2400, repeat: -1,
    onUpdate: (t) => {
      const v = t.getValue() ?? 0;
      orbs.forEach(({ g, a0 }) => {
        const a = a0 + v;
        g.setPosition(Math.cos(a) * 54, -40 + Math.sin(a) * 14 - 8 * Math.sin(a * 2));
        g.setDepth(Math.sin(a) > 0 ? 1 : -1);
      });
    },
  });
  c.once(Phaser.GameObjects.Events.DESTROY, () => tw.stop());
  attachTrail(scene, c, HT.mote, 900, {
    speedY: { min: -60, max: -20 }, lifespan: { min: 600, max: 900 }, scale: { start: 2, end: 1 },
    alpha: { start: 1, end: 0 }, tint: [...HEAL_TINTS, C.gold], frequency: 90, quantity: 1,
    emitZone: zone(new Phaser.Geom.Ellipse(0, -36, 110, 80), 'edge', 24),
  });
  return c;
};

// ───────────────────────────── Lantern of Vigil ─────────────────────────────

/** Persistent summon body: a tall iron-and-gold post topped by a blazing flame (x,y = feet). */
const lanternBody: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.PLAYER - 1);
  const pool = img(scene, HT.glow, 0, -4, { tint: C.gold, sx: 2.6, sy: 0.4, alpha: 0.4 });
  const flat = scene.add.container(0, -3).setScale(1, 0.32);
  const ring = img(scene, HT.sigil, 0, 0, { tint: C.gold, scale: 2.2, alpha: 0.85 });
  flat.add(ring);
  const post = img(scene, HT.ray, 0, 0, { tint: C.deep, origin: [0.5, 1], sx: 1, sy: 1.1, add: false });
  const cap = img(scene, HT.halo, 0, -72, { tint: C.pale, scale: 1.2, alpha: 0.9 });
  const lamp = img(scene, HT.glow, 0, -82, { tint: C.white, scale: 0.5 });
  c.add([pool, flat, post, cap, lamp]);
  const flame = hloop(scene, c, 'h_flame', 0, -76, { scale: 3, add: true, oy: 0.8 });
  loop(scene, c, { targets: lamp, scale: 0.75, alpha: 0.7, duration: 420, yoyo: true, ease: 'Stepped', easeParams: [3] });
  loop(scene, c, { targets: [pool, ring], alpha: 0.4, duration: 520, yoyo: true, ease: 'Stepped', easeParams: [2] });
  loop(scene, c, { targets: ring, angle: 360, duration: 6000 });
  void flame;
  attachTrail(scene, c, HT.mote, 1000, {
    speedY: { min: -70, max: -30 }, speedX: { min: -12, max: 12 }, lifespan: { min: 700, max: 1000 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS, frequency: 150, quantity: 1,
    emitZone: zone(new Phaser.Geom.Circle(0, -80, 8)),
  });
  shaft(scene, o.x, o.y + 2, 60, 220, C.pale, 0, 520);
  shock(scene, o.x, o.y - 2, 150, 0.3);
  return c;
};

/** Lantern pulse: the flame flares and a wave of light races along the ground (area centre; feet = y + h/2). */
const lanternPulse: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 320, 120);
  const x = o.x, gy = o.groundY ?? o.y + h / 2 - 5;
  haloRing(scene, x, gy - 6, w, 0.22, C.pale, 0, 340);
  haloRing(scene, x, gy - 50, w * 0.7, 0.5, C.white, 40, 320);
  flash(scene, x, gy - 80, C.white, 90, 220, 0.9);
  shaft(scene, x, gy + 2, 50, h + 80, C.pale, 0, 360, DEPTH.VFX_TOP);
  shock(scene, x, gy - 2, w, 0.25);
  if (!hfx(scene, 'h_ringpop', x, gy - 70, { scale: 4, add: true, dur: 280, depth: DEPTH.VFX_TOP })) flash(scene, x, gy - 70, C.gold, 80, 220, 0.9);
  sparks(scene, x, gy - 40, 7, 190);
};

// ───────────────────────────── Reckoning ─────────────────────────────

/** A pair of crossed blades of light slam into the ground (x,y = area centre on the foes). */
const reckoningArea: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 200, 220);
  const x = o.x, gy = o.groundY ?? o.y + h * 0.5 - 20;
  for (let k = 0; k < 2; k++) {
    const d = k * 150;
    const dx = k ? 18 : -18;
    const sw = img(scene, HT.sword, x + dx, gy - 210, { tint: k ? C.white : C.pale, scale: 3, alpha: 0, origin: [0.5, 1], depth: DEPTH.VFX_TOP });
    const ghost = img(scene, HT.sword, x + dx, gy - 210, { tint: C.gold, scale: 3, alpha: 0, origin: [0.5, 1], depth: DEPTH.VFX });
    scene.tweens.add({ targets: [sw, ghost], alpha: 1, duration: 40, delay: d });
    tweenOut(scene, ghost, { y: gy - 80, alpha: 0 }, 160, 'Quad.easeIn', d + 30);
    scene.tweens.add({
      targets: sw, y: gy + 14, duration: 150, delay: d + 30, ease: 'Quad.easeIn',
      onComplete: () => {
        tweenOut(scene, sw, { alpha: 0 }, 260, 'Stepped', 200);
        if (!hfx(scene, 'h_slash', x + dx, gy - 50, { scale: 5, add: true, dur: 240, rot: Math.PI / 2, depth: DEPTH.VFX_TOP })) flash(scene, x + dx, gy - 50, C.white, 110, 220, 1);
        shock(scene, x + dx, gy - 2, w * 0.9, 0.26);
        sparks(scene, x + dx, gy - 30, 8, 240);
        shake(scene, 90, 0.003);
      },
    });
  }
  scene.time.delayedCall(330, () => {
    hfx(scene, 'h_sun', x, gy - 40, { scale: 3, dur: 380, depth: DEPTH.VFX });
    shaft(scene, x, gy + 2, w * 0.5, h + 60, C.pale, 0, 400);
  });
};

// ───────────────────────────── Covenant of Mercy ─────────────────────────────

const covenantCast: VfxFn = (scene, o) => {
  const { x, y } = o;
  const cy = y - 38;
  if (!hfx(scene, 'h_heal', x, cy, { scale: 6, add: true, dur: 620, depth: DEPTH.VFX_TOP })) flash(scene, x, cy, C.green, 190, 520, 0.9);
  hfx(scene, 'h_wings', x, y - 50, { scale: 2, add: true, dur: 560, depth: DEPTH.PLAYER - 1 });
  flash(scene, x, cy, C.white, 90, 300, 0.8);
  shaft(scene, x, y + 2, 60, 220, C.green, 0, 640);
  shaft(scene, x, y + 2, 24, 240, C.white, 20, 560, DEPTH.VFX_TOP);
  shock(scene, x, y - 2, 200, 0.3, 0, DEPTH.VFX, C.green);
  for (let i = 0; i < 6; i++) {
    const cr = img(scene, HT.cross, x + rnd(-30, 30), y - rnd(8, 44), { tint: i % 2 ? C.green : C.white, alpha: 0, depth: DEPTH.VFX_TOP, scale: 1.5 });
    scene.tweens.add({ targets: cr, alpha: 1, duration: 100, delay: i * 80 });
    tweenOut(scene, cr, { y: cr.y - 60, alpha: 0 }, 800, 'Quad.easeOut', 100 + i * 80);
  }
  stream(scene, x, y - 4, HT.mote, 600, 1100, {
    x: { min: -26, max: 26 }, speedY: { min: -140, max: -50 }, lifespan: { min: 600, max: 1100 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, frequency: 34, quantity: 1, tint: HEAL_TINTS,
  }, DEPTH.VFX_TOP);
};

/** Mercy's burst: a green-gold wave rolls out from the caster over the ground. */
const covenantBurst: VfxFn = (scene, o) => {
  const { w, h } = sizeOf(o, 300, 160);
  const x = o.x, gy = o.groundY ?? o.y + h * 0.5 - 10;
  haloRing(scene, x, gy - 30, w, 0.4, C.green, 0, 360);
  haloRing(scene, x, gy - 4, w * 1.1, 0.2, C.white, 60, 380);
  shock(scene, x, gy - 2, w, 0.25, 0, DEPTH.VFX, C.green);
  for (let i = 0; i < 4; i++) {
    const s = i % 2 ? 1 : -1, t = 0.15 + Math.floor(i / 2) * 0.2;
    hfx(scene, 'h_flame', x + s * t * w, gy + 4, { scale: 2, oy: 1, add: true, dur: 380, delay: 40 + Math.floor(i / 2) * 60, flipX: s < 0, tint: C.green });
  }
  motes(scene, x, gy - 10, 12, w * 0.7, HEAL_TINTS);
};

/** Persistent regeneration aura: a green-gold ward with rising crosses. At feet. */
const covenantAura: VfxFn = (scene, o) => {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  const glow = img(scene, HT.glow, 0, -36, { tint: C.green, sx: 1.3, sy: 1.6, alpha: 0.22 });
  c.add(glow);
  const ward = hloop(scene, c, 'h_ward', 0, -34, { scale: 2, alpha: 0.45, add: true, fps: 8, tint: C.green });
  if (!ward) {
    const r = img(scene, 'px_ring', 0, -34, { tint: C.green, scale: 2.4, alpha: 0.5 });
    c.add(r);
  }
  const cr = img(scene, HT.cross, 0, -96, { tint: C.white, scale: 1.5, alpha: 0.9 });
  c.add(cr);
  loop(scene, c, { targets: cr, y: -104, duration: 450, yoyo: true, ease: 'Stepped', easeParams: [3] });
  loop(scene, c, { targets: glow, alpha: 0.1, duration: 500, yoyo: true, ease: 'Stepped', easeParams: [3] });
  attachTrail(scene, c, HT.mote, 900, {
    speedY: { min: -60, max: -25 }, speedX: { min: -8, max: 8 }, lifespan: { min: 600, max: 900 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: HEAL_TINTS, frequency: 110, quantity: 1,
    emitZone: zone(new Phaser.Geom.Rectangle(-26, -6, 52, 6)),
  });
  return c;
};

// ───────────────────────────── Celestial Stride ─────────────────────────────

const strideOut: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  shaft(scene, x, y + 2, 40, 140, C.pale, 0, 280);
  if (!hfx(scene, 'h_wings', x - f * 6, y - 46, { scale: 3, add: true, dur: 300, alpha: 0.85, flipX: f < 0, depth: DEPTH.VFX })) flash(scene, x, y - 36, C.gold, 80, 220, 0.8);
  burst(scene, x, y - 30, HT.mote, 14, 640, {
    speed: { min: 50, max: 170 }, angle: f > 0 ? { min: 140, max: 220 } : { min: -40, max: 40 }, lifespan: { min: 300, max: 640 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: [...GOLD_TINTS, C.cyan],
  }, DEPTH.VFX_TOP);
};

/** Path of light (beam call: x,y = start, targetX/targetY = end; falls back to facing × range). */
const strideTrail: VfxFn = (scene, o) => {
  const sx = o.x, tx = o.targetX ?? o.x + o.facing * (o.w ?? 260), y = o.y;
  const len = Math.max(32, Math.abs(tx - sx)), dir = tx >= sx ? 1 : -1;
  const th = (o.h ?? 100) * 0.4;
  const core = img(scene, HT.beam, sx, y, { tint: C.white, origin: dir > 0 ? [0, 0.5] : [1, 0.5], sx: (len / 128) * dir, sy: (th / 32) * 0.5, alpha: 0.95, depth: DEPTH.VFX_TOP });
  const glow = img(scene, HT.beam, sx, y, { tint: C.gold, origin: dir > 0 ? [0, 0.5] : [1, 0.5], sx: (len / 128) * dir, sy: th / 32, alpha: 0.6, depth: DEPTH.VFX });
  const hi = img(scene, HT.beam, sx, y, { tint: C.cyan, origin: dir > 0 ? [0, 0.5] : [1, 0.5], sx: (len / 128) * dir, sy: (th / 32) * 1.5, alpha: 0.25, depth: DEPTH.VFX });
  scene.tweens.add({ targets: [core, glow, hi], scaleY: 0, duration: 340, ease: 'Quad.easeIn' });
  tweenOut(scene, core, { alpha: 0 }, 120, 'Linear', 240);
  tweenOut(scene, glow, { alpha: 0 }, 120, 'Linear', 240);
  tweenOut(scene, hi, { alpha: 0 }, 120, 'Linear', 240);
  const n = Math.max(3, Math.min(7, Math.round(len / 55)));
  for (let i = 0; i < n; i++) {
    const px = sx + dir * len * ((i + 0.5) / n);
    const d = i * 28;
    hfx(scene, 'h_lash', px, y + 4, { scale: 2, add: true, flipX: dir < 0, dur: 360, delay: d, depth: DEPTH.VFX });
    hfx(scene, 'h_star', px, y - 18, { scale: 2, add: true, dur: 300, delay: d + 40, depth: DEPTH.VFX_TOP });
  }
  stream(scene, sx + dir * len / 2, y, HT.mote, 160, 600, {
    speedY: { min: -60, max: -10 }, lifespan: { min: 360, max: 600 }, scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 },
    tint: GOLD_TINTS, frequency: 10, quantity: 1, emitZone: zone(new Phaser.Geom.Rectangle(-len / 2, -th * 0.6, len, th * 1.2)),
  }, DEPTH.VFX_TOP);
};

const strideIn: VfxFn = (scene, o) => {
  const { x, y, facing: f } = o;
  shaft(scene, x, y + 2, 44, 200, C.white, 0, 340, DEPTH.VFX_TOP);
  hfx(scene, 'h_heal', x, y - 34, { scale: 3, add: true, dur: 380, depth: DEPTH.VFX_TOP });
  haloRing(scene, x, y - 30, 240, 0.4, C.gold, 0, 320);
  shock(scene, x, y - 2, 200, 0.28);
  burst(scene, x, y - 4, 'px_star', 8, 560, {
    speed: { min: 80, max: 200 }, angle: f > 0 ? { min: 190, max: 250 } : { min: -70, max: -10 }, gravityY: 300,
    lifespan: { min: 260, max: 560 }, scale: { start: 1.5, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: GOLD_TINTS,
  }, DEPTH.VFX_TOP);
  motes(scene, x, y - 4, 8, 40, HEAL_TINTS);
};

// ───────────────────────────── registry ─────────────────────────────

/** Called once from holyVfx's `registerHolyVfx` with its lazy, crash-safe registrar. */
export function registerHolyY5Vfx(reg: (key: string, fn: VfxFn) => void): void {
  reg('holy_sunfall_area', sunfallArea);
  reg('holy_empyrean_area', empyreanArea);
  reg('holy_fellowship_cast', fellowshipCast);
  reg('holy_fellowship_area', fellowshipArea);
  reg('holy_fellowship_aura', fellowshipAura);
  reg('holy_lantern', lanternBody);
  reg('holy_lantern_pulse', lanternPulse);
  reg('holy_reckoning_area', reckoningArea);
  reg('holy_covenant_cast', covenantCast);
  reg('holy_covenant_burst', covenantBurst);
  reg('holy_covenant_aura', covenantAura);
  reg('holy_stride_out', strideOut);
  reg('holy_stride_trail', strideTrail);
  reg('holy_stride_in', strideIn);
}
