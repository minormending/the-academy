// Year 5 (Storm Archon) VFX. Keys prefixed `ltn5_`. Built from the shared jagged-bolt helpers (fx.ts) and the CC0
// sheets via pxFx; the lazy School registration in lightningVfx.ts guarantees the `ltn_glow` / `ltn_ring` textures exist.
// Persistent visuals (pylons, aura) always face +x and are owned/destroyed by the engine or plantField.
import Phaser from 'phaser';
import { pxFx } from '../../art/particles';
import { DEPTH } from '../../core/constants';
import type { VfxFn } from '../../core/types';
import {
  C, TAU, rnd, spawnBolt, drawBoltFrame, flash, ring, column, converge, screenFlash, sparks, motes, stars,
  whileAlive, loopWhileAlive,
} from './fx';

type Register = (key: string, fn: VfxFn) => void;

// ───────────────────────────── Voltage Cascade (chain) ─────────────────────────────

const cascadeCast: VfxFn = (scene, o) => {
  converge(scene, o.x, o.y, 8, 40, 260, C.yellow);
  flash(scene, o.x, o.y, 44, C.white, 200);
  spawnBolt(scene, o.x, o.y, o.x + o.facing * 60, o.y - 6, { w: 1.1, jitter: 8, forks: 1, glow: C.violet, mid: C.yellow });
};

/** Once per jump: a thick main arc with side forks and a ring at the landing point. */
const cascadeArc: VfxFn = (scene, o) => {
  const tx = o.targetX ?? o.x + o.facing * 180, ty = o.targetY ?? o.y;
  spawnBolt(scene, o.x, o.y, tx, ty, { w: 1.5, jitter: 20, forks: 3, frames: 4, frameMs: 40, glow: C.violet, mid: C.yellow });
  spawnBolt(scene, o.x, o.y + 4, tx, ty - 4, { w: 0.8, jitter: 14, forks: 1, frames: 3, glow: C.deepViolet, mid: C.white });
  ring(scene, tx, ty, 70, C.yellow, 220);
  flash(scene, tx, ty, 36, C.white, 140);
  pxFx(scene, 'g9_spark', tx, ty, { v: 'ltn', scale: 2, add: true, dur: 240 });
  sparks(scene, tx, ty, 5);
};

const hitSurge: VfxFn = (scene, o) => {
  stars(scene, o.x, o.y, 4);
  flash(scene, o.x, o.y, 30, C.white, 150);
};

// ───────────────────────────── Zenith Lance (single target) ─────────────────────────────

const lanceCast: VfxFn = (scene, o) => {
  converge(scene, o.x, o.y - 6, 10, 56, 320, C.white, 0.3);
  flash(scene, o.x, o.y, 54, C.yellow, 260);
  const sky = scene.cameras.main.worldView.top - 20;
  // A faint warning mark: the lance telegraphs from the heavens before the strike lands.
  spawnBolt(scene, o.x + o.facing * 140, sky, o.x + o.facing * 140, o.y - 40, { w: 0.5, jitter: 6, frames: 3, fadeMs: 160, glow: C.violet, mid: C.violet });
};

const lanceStrike: VfxFn = (scene, o) => {
  const base = o.groundY ?? o.y + (o.h ?? 240) / 2;
  const top = Math.min(o.y - (o.h ?? 240) / 2, scene.cameras.main.worldView.top - 20);
  for (let i = 0; i < 3; i++) {
    scene.time.delayedCall(i * 70, () => {
      spawnBolt(scene, o.x + rnd(-4, 4), top, o.x, base, { w: 2.2 - i * 0.3, jitter: 14, forks: 2, frames: 3, frameMs: 35, glow: i % 2 ? C.violet : C.deepViolet, mid: i === 1 ? C.white : C.yellow });
      column(scene, o.x, base, 260, 56, C.yellow, 220);
      ring(scene, o.x, base, 120, C.violet, 240, 0.35);
      sparks(scene, o.x, base - 10, 5);
    });
  }
  pxFx(scene, 'g9_lightning', o.x, base, { v: 'ltn', scale: 2, oy: 1, add: true, dur: 420 });
  flash(scene, o.x, base - 20, 110, C.white, 160);
  scene.cameras.main.shake(140, 0.004);
  screenFlash(scene, 0.2, 100);
};

// ───────────────────────────── Fellowship of Storms (ultimate) ─────────────────────────────

const fellowshipCast: VfxFn = (scene, o) => {
  const sky = scene.cameras.main.worldView.top;
  converge(scene, o.x, o.y, 18, 120, 700, C.yellow, 0.34);
  converge(scene, o.x, o.y, 10, 80, 600, C.violet, 0.3);
  ring(scene, o.x, o.y + 34, 240, C.violet, 700, 0.35);
  ring(scene, o.x, o.y + 34, 160, C.yellow, 560, 0.35, 120);
  column(scene, o.x, o.y + 34, Math.max(220, o.y - sky), 70, C.white, 800);
  stars(scene, o.x, o.y - 20, 8);
};

const fellowshipArea: VfxFn = (scene, o) => {
  const w = o.w ?? 1000, h = o.h ?? 460;
  const base = o.groundY ?? o.y + h / 2;
  const sky = Math.min(o.y - h / 2, scene.cameras.main.worldView.top - 20);
  screenFlash(scene, 0.45, 220, C.white);
  scene.cameras.main.shake(260, 0.006);
  // Ten staggered sky-to-ground strikes spread across the field, nearest to the caster first.
  for (let i = 0; i < 10; i++) {
    const x = o.x + ((i + 0.5) / 10 - 0.5) * w + rnd(-18, 18);
    scene.time.delayedCall(i * 60, () => {
      spawnBolt(scene, x + rnd(-30, 30), sky, x, base, { w: 1.6, jitter: 20, forks: 2, frames: 3, frameMs: 40, glow: i % 2 ? C.violet : C.deepViolet, mid: i % 3 === 0 ? C.white : C.yellow });
      column(scene, x, base, 200, 44, C.yellow, 220);
      ring(scene, x, base, 90, C.violet, 220, 0.35);
      sparks(scene, x, base - 6, 3);
      if (i % 3 === 0) pxFx(scene, 'g9_lightning', x, base, { v: 'ltn', scale: 2, oy: 1, add: true, dur: 360 });
    });
  }
  // Ground shock-front sweeping out of the caster.
  ring(scene, o.x, base, w, C.yellow, 520, 0.18);
  ring(scene, o.x, base, w * 0.7, C.white, 420, 0.18, 80);
  scene.time.delayedCall(300, () => { motes(scene, o.x, base - 30, 14); stars(scene, o.x, base - 40, 10); });
};

// ───────────────────────────── Pylon Array (field) ─────────────────────────────

const PYLON_X = [-1, -0.35, 0.35, 1];

function pylonLayout(o: { w?: number }): { xs: number[] } {
  const w = o.w ?? 520;
  return { xs: PYLON_X.map(k => Math.round(k * w * 0.46)) };
}

const pylonBody: VfxFn = (scene, o) => {
  const { xs } = pylonLayout(o);
  const base = (o.groundY ?? o.y + 34) - o.y;
  const g = scene.add.graphics();
  const arcs = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const root = scene.add.container(Math.round(o.x), Math.round(o.y), [g, arcs]).setDepth(DEPTH.VFX);
  // Chunky stepped pylons: dark mast, yellow bands, white-hot tip. Drawn once.
  for (const x of xs) {
    g.fillStyle(C.gloom, 1).fillRect(x - 6, base - 70, 12, 70);
    g.fillStyle(C.deepViolet, 1).fillRect(x - 4, base - 70, 8, 70);
    g.fillStyle(C.yellow, 1);
    for (let y = base - 62; y < base - 6; y += 14) g.fillRect(x - 4, y, 8, 2);
    g.fillStyle(C.violet, 1).fillRect(x - 10, base - 4, 20, 4);
    g.fillStyle(C.white, 1).fillRect(x - 3, base - 78, 6, 8);
  }
  const redraw = (): void => {
    arcs.clear();
    for (let i = 1; i < xs.length; i++) {
      drawBoltFrame(arcs, xs[i - 1], base - 74, xs[i], base - 74, { w: 0.7, jitter: 10, seg: 5 });
    }
  };
  redraw();
  whileAlive(scene, root, 110, redraw);
  loopWhileAlive(scene, root, { targets: g, alpha: 0.75, duration: 420, yoyo: true, repeat: -1 });
  return root;
};

const pylonPulse: VfxFn = (scene, o) => {
  const { xs } = pylonLayout(o);
  const base = (o.groundY ?? o.y + (o.h ?? 240) / 2);
  const tipY = base - 74;
  for (const x of xs) {
    spawnBolt(scene, o.x + x, tipY, o.x + x * 0.4, o.y, { w: 0.9, jitter: 12, frames: 3, glow: C.violet, mid: C.yellow });
  }
  for (let i = 1; i < xs.length; i++) {
    spawnBolt(scene, o.x + xs[i - 1], tipY, o.x + xs[i], tipY, { w: 1.1, jitter: 10, forks: 1, frames: 3, mid: C.white });
  }
  ring(scene, o.x, base, o.w ?? 520, C.yellow, 260, 0.25);
  flash(scene, o.x, o.y, 56, C.white, 150);
  sparks(scene, o.x, o.y, 4);
};

// ───────────────────────────── Reckoning Peal (combo payoff) ─────────────────────────────

const pealCast: VfxFn = (scene, o) => {
  // Shock motes are drawn in, then 'cashed out' by the strike.
  converge(scene, o.x + o.facing * 30, o.y - 4, 8, 50, 260, C.cyan, 0.26);
  flash(scene, o.x, o.y, 40, C.violet, 180);
};

const pealStrike: VfxFn = (scene, o) => {
  const base = o.groundY ?? o.y + (o.h ?? 240) / 2;
  const top = Math.min(o.y - (o.h ?? 240) / 2, scene.cameras.main.worldView.top - 20);
  for (let i = 0; i < 4; i++) {
    scene.time.delayedCall(i * 65, () => {
      const dx = (i - 1.5) * 22;
      spawnBolt(scene, o.x + dx, top, o.x + dx * 0.4, base, { w: 1.3, jitter: 16, forks: 1, frames: 3, frameMs: 35, glow: C.violet, mid: i % 2 ? C.white : C.yellow });
      ring(scene, o.x + dx * 0.4, base, 84 + i * 14, i % 2 ? C.white : C.yellow, 200, 0.3);
      sparks(scene, o.x + dx * 0.4, base - 8, 4);
    });
  }
  // Pink-white burst marks that shock was consumed.
  flash(scene, o.x, o.y, 90, 0xff9fe8, 260);
  pxFx(scene, 'g9_spark', o.x, o.y, { v: 'ltn', scale: 3, add: true, dur: 300 });
  ring(scene, o.x, base, 150, 0xff9fe8, 260, 0.3);
  scene.cameras.main.shake(120, 0.003);
  screenFlash(scene, 0.15, 90, 0xffd6f6);
};

// ───────────────────────────── Archon's Conduit (buff) ─────────────────────────────

const conduitCast: VfxFn = (scene, o) => {
  ring(scene, o.x, o.y - 6, 170, C.yellow, 420, 0.35);
  ring(scene, o.x, o.y - 6, 110, C.white, 320, 0.35, 80);
  column(scene, o.x, o.y, 240, 60, C.yellow, 480);
  converge(scene, o.x, o.y - 36, 10, 70, 360, C.violet);
  stars(scene, o.x, o.y - 40, 6);
};

/** Feet-anchored halo: two counter-rotating orbit sparks plus a crown of arcs. Never covers the body. */
const conduitAura: VfxFn = (scene, o) => {
  const g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const root = scene.add.container(Math.round(o.x), Math.round(o.y), [g]).setDepth(DEPTH.VFX);
  let t = 0;
  const paint = (): void => {
    g.clear();
    t += 0.35;
    // Crown above the head.
    g.fillStyle(C.yellow, 1);
    for (let i = -2; i <= 2; i++) g.fillRect(i * 8 - 1, -88 + Math.abs(i) * 2, 2, 8 - Math.abs(i));
    g.fillStyle(C.white, 1).fillRect(-2, -92, 4, 6);
    // Orbiting charge nodes around the torso (flattened ellipse).
    for (let k = 0; k < 4; k++) {
      const a = t + (k / 4) * TAU;
      const x = Math.round(Math.cos(a) * 13) * 2, y = -34 + Math.round(Math.sin(a) * 9);
      g.fillStyle(k % 2 ? C.violet : C.yellow, 1).fillRect(x - 3, y - 3, 6, 6);
      g.fillStyle(C.white, 1).fillRect(x - 1, y - 1, 2, 2);
    }
    if (Math.random() < 0.5) {
      const s = Math.random() < 0.5 ? -1 : 1;
      drawBoltFrame(g, s * 14, -64, s * rnd(26, 38), rnd(-36, -8), { w: 0.6, jitter: 4, seg: 3 });
    }
  };
  paint();
  whileAlive(scene, root, 90, paint);
  return root;
};

// ───────────────────────────── Ride the Lightning (movement) ─────────────────────────────

const rideOut: VfxFn = (scene, o) => {
  // Where you were: a vertical strike scar plus a scatter of sparks.
  const top = o.y - 120;
  spawnBolt(scene, o.x, top, o.x, o.y, { w: 1.3, jitter: 12, forks: 1, frames: 3, glow: C.violet, mid: C.yellow });
  ring(scene, o.x, o.y, 90, C.violet, 240, 0.35);
  sparks(scene, o.x, o.y - 30, 7);
};

const rideIn: VfxFn = (scene, o) => {
  flash(scene, o.x, o.y - 30, 70, C.white, 220);
  column(scene, o.x, o.y, 140, 54, C.yellow, 280);
  ring(scene, o.x, o.y, 120, C.yellow, 260, 0.35);
  stars(scene, o.x, o.y - 34, 6);
  pxFx(scene, 'cm_ring', o.x, o.y - 30, { v: 'ltn', scale: 2, add: true, dur: 300 });
};

/** Beam area: x,y = start, targetX/targetY = end. Three parallel jagged cuts, white-hot centre. */
const rideTrail: VfxFn = (scene, o) => {
  const tx = o.targetX ?? o.x + o.facing * 360, ty = o.targetY ?? o.y;
  for (const [dy, w, mid] of [[-18, 0.9, C.violet], [0, 1.6, C.white], [18, 0.9, C.yellow]] as const) {
    spawnBolt(scene, o.x, o.y + dy, tx, ty + dy, { w, jitter: 12, forks: dy === 0 ? 3 : 1, frames: 4, frameMs: 45, glow: dy === 0 ? C.deepViolet : C.violet, mid });
  }
  const n = Math.max(2, Math.floor(Math.abs(tx - o.x) / 110));
  for (let i = 1; i <= n; i++) {
    const x = o.x + ((tx - o.x) * i) / (n + 1);
    flash(scene, x, o.y, 34, C.yellow, 180);
  }
  sparks(scene, tx, ty, 5);
  scene.cameras.main.shake(70, 0.002);
};

export function registerLightningYear5Vfx(registerVfx: Register): void {
  registerVfx('ltn5_cascade_cast', cascadeCast);
  registerVfx('ltn5_cascade_arc', cascadeArc);
  registerVfx('ltn5_hit_surge', hitSurge);
  registerVfx('ltn5_lance_cast', lanceCast);
  registerVfx('ltn5_lance_strike', lanceStrike);
  registerVfx('ltn5_fellowship_cast', fellowshipCast);
  registerVfx('ltn5_fellowship_area', fellowshipArea);
  registerVfx('ltn5_pylon_body', pylonBody);
  registerVfx('ltn5_pylon_pulse', pylonPulse);
  registerVfx('ltn5_peal_cast', pealCast);
  registerVfx('ltn5_peal_strike', pealStrike);
  registerVfx('ltn5_conduit_cast', conduitCast);
  registerVfx('ltn5_conduit_aura', conduitAura);
  registerVfx('ltn5_ride_out', rideOut);
  registerVfx('ltn5_ride_in', rideIn);
  registerVfx('ltn5_ride_trail', rideTrail);
}
