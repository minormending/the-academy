// OWNER: A5 (lightning-tree) / PX4 (pixel VFX). Lightning VFX: 16-bit pixel sheets (pxFx, palette-swapped violet/yellow)
// plus jagged bolts rasterised on a 2px grid. All keys prefixed `ltn_`. Procedural fallback when a sheet is missing.
import Phaser from 'phaser';
import { defineSchool, lazyRegister, scheduleIdle } from '../art/lazy';
import { pxFx } from '../art/particles';
import { DEPTH } from '../core/constants';
import type { VfxFn, VfxOptions } from '../core/types';
import { generateTextures } from './lightning/textures';
import { STORM } from './lightning/shared';
import {
  C, TAU, rnd, pick, drawBolt, drawBoltFrame, spawnBolt, radialBolts, flash, ring, column, converge,
  screenFlash, sparks, motes, stars, whileAlive, loopWhileAlive,
} from './lightning/fx';
import type { BoltStyle } from './lightning/fx';
import {
  needleCast, needleProj, repulsionArea, wardCast, wardAura, liveWireSigil,
  capacitorArc, reversalCast, relayOut, relayIn, relayArrival, judgmentCage,
  railCharge, railBeam, conductorSigil,
} from './lightning/academyVfx';

/** Boot hook: textures are built on first lightning VFX (or in the background while on the Title screen). */
export function generateLightningTextures(scene: Phaser.Scene): void { scheduleIdle(scene, 'lightning', generateTextures); }

defineSchool('lightning', generateTextures);
const registerVfx = lazyRegister('lightning', generateTextures);

const ADD = Phaser.BlendModes.ADD;
const scaleOf = (o: VfxOptions): number => o.scale ?? 1;
const fwd = (o: VfxOptions): number => (o.facing === 1 ? 0 : Math.PI);

// ───────────────────────────── casts ─────────────────────────────

interface CastCfg {
  size: number;          // flash diameter
  ringD: number;         // ring diameter
  bolts: number;
  boltLen: [number, number];
  sparks: number;
  color?: number;
  glow?: number;
  mid?: number;
  forward?: boolean;     // bias bolts along facing
}

function castFx(cfg: CastCfg): VfxFn {
  return (scene, o) => {
    const k = scaleOf(o);
    // pixel electric orb pop at the staff (ansimuz spark, palette-swapped violet/yellow)
    if (!pxFx(scene, 'g9_spark', o.x, o.y, { v: 'ltn', scale: cfg.size >= 90 ? 4 : 2, add: true, dur: 300, depth: DEPTH.VFX_TOP })) {
      flash(scene, o.x, o.y, cfg.size * k, cfg.color ?? C.yellow, 210);
      ring(scene, o.x, o.y, cfg.ringD * k, cfg.glow ?? C.violet, 270);
    }
    radialBolts(
      scene, o.x, o.y, cfg.bolts, cfg.boltLen[0] * k, cfg.boltLen[1] * k,
      { w: 0.8, glow: cfg.glow, mid: cfg.mid, jitter: 6 },
      cfg.forward ? fwd(o) : undefined, cfg.forward ? 1.6 : TAU,
    );
    sparks(scene, o.x, o.y, Math.ceil(cfg.sparks * 0.6));
  };
}

const castBolt = castFx({ size: 60, ringD: 70, bolts: 3, boltLen: [26, 50], sparks: 6, forward: true });
const castArc = castFx({ size: 96, ringD: 120, bolts: 6, boltLen: [36, 74], sparks: 14, glow: C.violet, mid: C.white });

const castLance: VfxFn = (scene, o) => {
  castFx({ size: 64, ringD: 80, bolts: 4, boltLen: [30, 60], sparks: 8, forward: true })(scene, o);
  const img = scene.add.image(o.x + o.facing * 30, o.y, 'ltn_flare').setDepth(DEPTH.VFX_TOP).setBlendMode(ADD).setTint(C.yellow);
  img.setScale(0.5, 1.3).setAlpha(1);
  scene.tweens.add({ targets: img, scaleX: 2.6, scaleY: 0.3, alpha: 0, duration: 240, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
};

const castSpear: VfxFn = (scene, o) => {
  castFx({ size: 64, ringD: 80, bolts: 2, boltLen: [24, 44], sparks: 8 })(scene, o);
  spawnBolt(scene, o.x, o.y, o.x + rnd(-8, 8), o.y - 240, { w: 0.9, frames: 3, frameMs: 45, jitter: 12, forks: 1 });
  column(scene, o.x, o.y, 200, 30, C.yellow, 260);
};

const castBall: VfxFn = (scene, o) => {
  converge(scene, o.x, o.y, 7, 54, 280, C.yellow);
  scene.time.delayedCall(240, () => {
    if (!pxFx(scene, 'ss_thunder', o.x, o.y, { scale: 2, add: true, dur: 320, depth: DEPTH.VFX_TOP })) flash(scene, o.x, o.y, 70, C.white, 180);
    stars(scene, o.x, o.y, 2);
  });
};

const overloadCast: VfxFn = (scene, o) => {
  // Body center is behind the cast point (cast point = player.x + 18*facing, y - 34).
  const cx = o.x - o.facing * 18, cy = o.y;
  for (let i = 0; i < 3; i++) {
    const img = scene.add.image(cx, cy, 'ltn_ring').setDepth(DEPTH.VFX).setBlendMode(ADD).setTint(i === 1 ? C.yellow : C.violet).setAlpha(0);
    img.setScale(3.4);
    scene.tweens.add({
      targets: img, scale: 0.7, alpha: { from: 0.2, to: 1 }, duration: 320, delay: i * 90, ease: 'Cubic.easeIn',
      onComplete: () => img.destroy(),
    });
  }
  converge(scene, cx, cy, 10, 90, 330, C.violet, 0.3);
  radialBolts(scene, cx, cy, 4, 24, 46, { w: 0.7, jitter: 5, glow: C.violet, mid: C.white });
};

const stormCast: VfxFn = (scene, o) => {
  const k = scaleOf(o);
  flash(scene, o.x, o.y, 150 * k, C.white, 320);
  ring(scene, o.x, o.y, 420 * k, C.violet, 520);
  ring(scene, o.x, o.y, 260 * k, C.yellow, 420, 1, 80);
  radialBolts(scene, o.x, o.y, 8, 50 * k, 120 * k, { w: 1, jitter: 10, forks: 1, glow: C.violet, mid: C.white });
  sparks(scene, o.x, o.y, 22);
  screenFlash(scene, 0.45, 220);
  // Bolts leaping up toward where the clouds gather.
  const cam = scene.cameras.main;
  const topY = Math.max(cam.worldView.top + 40, o.y - 420);
  for (let i = 0; i < 3; i++) {
    spawnBolt(scene, o.x, o.y, o.x + o.facing * rnd(60, 280), topY + rnd(0, 60), { w: 1.2, frames: 5, frameMs: 55, jitter: 18, forks: 3, glow: C.violet });
  }
  stormClouds(scene, o);
};

const birdScreech: VfxFn = (scene, o) => {
  flash(scene, o.x, o.y, 54, C.white, 160);
  ring(scene, o.x, o.y, 64, C.cyan, 240);
  sparks(scene, o.x, o.y, 4);
};

const totemPulse: VfxFn = (scene, o) => {
  // Summon position is the totem base; the crystal floats ~72px above it.
  const y = o.y - 72;
  if (!pxFx(scene, 'g9_spark', o.x, y, { v: 'ltn', scale: 2, add: true, dur: 280, depth: DEPTH.VFX_TOP })) {
    flash(scene, o.x, y, 60, C.yellow, 180);
    ring(scene, o.x, y, 80, C.violet, 240);
  }
  radialBolts(scene, o.x, y, 3, 20, 40, { w: 0.6, jitter: 4 });
  sparks(scene, o.x, y, 3);
};

// ───────────────────────────── chain / beam / hit ─────────────────────────────

interface ChainCfg extends BoltStyle {
  frames: number;
  frameMs?: number;
  flashSize: number;
  twin?: boolean;       // second thinner bolt
  ringD?: number;
  sparks: number;
  tint?: number;
}

function chainFx(cfg: ChainCfg): VfxFn {
  return (scene, o) => {
    const tx = o.targetX ?? o.x + o.facing * 120;
    const ty = o.targetY ?? o.y;
    const style: BoltStyle = { w: cfg.w, forks: cfg.forks, glow: cfg.glow, mid: cfg.mid, jitter: cfg.jitter, seg: cfg.seg };
    spawnBolt(scene, o.x, o.y, tx, ty, { ...style, frames: cfg.frames, frameMs: cfg.frameMs ?? 45 });
    if (cfg.twin) {
      spawnBolt(scene, o.x, o.y, tx, ty, { ...style, w: (cfg.w ?? 1) * 0.5, forks: 0, frames: cfg.frames, frameMs: cfg.frameMs ?? 45 });
    }
    const big = cfg.flashSize >= 70;
    if (!pxFx(scene, big ? 'g9_spark' : 'spark', tx, ty, { v: big ? 'ltn' : undefined, tint: big ? undefined : cfg.tint ?? C.yellow, scale: 2, add: true, depth: DEPTH.VFX_TOP })) {
      flash(scene, tx, ty, cfg.flashSize, cfg.tint ?? C.yellow, 190);
      if (cfg.ringD) ring(scene, tx, ty, cfg.ringD, cfg.glow ?? C.violet, 240);
    }
    sparks(scene, tx, ty, Math.ceil(cfg.sparks * 0.6));
  };
}

const chainSeg = chainFx({ w: 1, forks: 2, frames: 4, flashSize: 54, sparks: 5 });
const chainArc = chainFx({ w: 1.5, forks: 4, frames: 5, flashSize: 84, ringD: 90, sparks: 9, glow: C.violet, mid: C.white, twin: true, tint: C.white });
const chainTotem = chainFx({ w: 0.9, forks: 2, frames: 4, flashSize: 50, sparks: 4 });
const chainBird = chainFx({ w: 1.6, forks: 3, frames: 5, flashSize: 78, ringD: 80, sparks: 8, glow: C.cyan, mid: C.white, twin: true, tint: C.cyan });

const beamLance: VfxFn = (scene, o) => {
  const tx = o.targetX ?? o.x + o.facing * 420;
  const ty = o.targetY ?? o.y;
  const w = Phaser.Math.Clamp((o.h ?? 56) / 44, 0.9, 2.2);
  const len = Math.hypot(tx - o.x, ty - o.y);
  spawnBolt(scene, o.x, o.y, tx, ty, { w: w * 1.25, jitter: 9, seg: Math.round(len / 18), forks: 4, frames: 6, frameMs: 40, fadeMs: 110 });
  spawnBolt(scene, o.x, o.y, tx, ty, { w: w * 0.55, jitter: 14, seg: Math.round(len / 26), forks: 0, frames: 6, frameMs: 40, glow: C.white, mid: C.white });
  spawnBolt(scene, o.x, o.y, tx, ty, { w: w * 0.45, jitter: 20, seg: Math.round(len / 30), forks: 0, frames: 4, frameMs: 55, glow: C.violet });
  if (!pxFx(scene, 'ss_thunder', tx, ty, { scale: 2, add: true, dur: 360, depth: DEPTH.VFX_TOP })) flash(scene, tx, ty, 70, C.yellow, 220);
  pxFx(scene, 'g9_spark', o.x, o.y, { v: 'ltn', scale: 2, add: true, dur: 260, depth: DEPTH.VFX_TOP });
  // Crackles along the lance.
  const n = Math.max(2, Math.floor(len / 110));
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    sparks(scene, o.x + (tx - o.x) * t, o.y + (ty - o.y) * t, 2);
  }
  sparks(scene, tx, ty, 6);
};

const hitZap: VfxFn = (scene, o) => {
  const k = scaleOf(o);
  if (!pxFx(scene, 'spark', o.x, o.y, { scale: k >= 1.4 ? 4 : 2, add: true, tint: C.yellow, depth: DEPTH.VFX_TOP })) {
    flash(scene, o.x, o.y, 46 * k, C.yellow, 160);
    stars(scene, o.x, o.y, 1);
  }
  radialBolts(scene, o.x, o.y, 2, 16 * k, 34 * k, { w: 0.55, jitter: 4 });
  sparks(scene, o.x, o.y, 4);
};

const hitShock: VfxFn = (scene, o) => {
  const k = scaleOf(o);
  const spread = Math.max(24, (o.h ?? 56) * 0.5);
  if (!pxFx(scene, 'g9_spark', o.x, o.y, { v: 'ltn', scale: 2, add: true, dur: 300, depth: DEPTH.VFX_TOP })) {
    flash(scene, o.x, o.y, 64 * k, C.violet, 200);
    flash(scene, o.x, o.y, 36 * k, C.white, 130);
    ring(scene, o.x, o.y, 58 * k, C.yellow, 220);
  }
  radialBolts(scene, o.x, o.y, 3, spread * 0.6, spread * 1.1, { w: 0.65, jitter: 5, glow: C.violet, mid: C.white });
  sparks(scene, o.x, o.y, 5);
};

// ───────────────────────────── movement ─────────────────────────────

const stepOut: VfxFn = (scene, o) => {
  const cy = o.y - 34;
  if (!pxFx(scene, 'g9_lightning', o.x, o.y + 4, { v: 'ltn', scale: 2, oy: 1, add: true, dur: 380, depth: DEPTH.VFX_TOP })) {
    column(scene, o.x, o.y + 4, 120, 56, C.yellow, 280);
    flash(scene, o.x, cy, 90, C.white, 200);
  }
  ring(scene, o.x, o.y, 90, C.violet, 280, 0.3);
  radialBolts(scene, o.x, cy, 4, 30, 70, { w: 0.8, jitter: 6, glow: C.violet });
  sparks(scene, o.x, cy, 8);
};

const stepIn: VfxFn = (scene, o) => {
  const cy = o.y - 34;
  if (!pxFx(scene, 'g9_lightning', o.x, o.y + 4, { v: 'ltn', scale: 2, oy: 1, add: true, dur: 420, depth: DEPTH.VFX_TOP })) {
    column(scene, o.x, o.y + 4, 160, 66, C.white, 320);
    flash(scene, o.x, cy, 110, C.yellow, 240);
    spawnBolt(scene, o.x + rnd(-10, 10), o.y - 170, o.x, o.y, { w: 0.9, frames: 3, frameMs: 40, jitter: 12, forks: 1 });
  }
  ring(scene, o.x, o.y, 130, C.yellow, 320, 0.3);
  ring(scene, o.x, o.y, 80, C.violet, 260, 0.3, 70);
  radialBolts(scene, o.x, cy, 3, 28, 60, { w: 0.7, jitter: 6 });
  sparks(scene, o.x, cy, 10);
};

// ───────────────────────────── area strikes ─────────────────────────────

const spearStrike: VfxFn = (scene, o) => {
  const w = o.w ?? 200;
  const groundY = o.y + (o.h ?? 0) * 0.2;
  const topY = o.y - 560;
  // Jagged pixel bolts from the sky + the giant pixel lightning strike (ansimuz, palette-swapped).
  spawnBolt(scene, o.x, topY, o.x, groundY, { w: 2.2, jitter: 26, seg: 26, forks: 5, frames: 6, frameMs: 50, fadeMs: 140 });
  const strike = pxFx(scene, 'g9_lightning', o.x, groundY + 6, { v: 'ltn', scale: 4, oy: 1, add: true, dur: 560, depth: DEPTH.VFX_TOP });
  if (strike) {
    pxFx(scene, 'g9_darkbolt', o.x, groundY + 8, { scale: 2, oy: 1, add: true, delay: 80, dur: 480 });
  } else {
    spawnBolt(scene, o.x, topY, o.x, groundY, { w: 1, jitter: 34, seg: 18, forks: 0, frames: 4, frameMs: 60, glow: C.white });
    column(scene, o.x, groundY, 460, 90, C.yellow, 360);
    flash(scene, o.x, groundY, 150, C.white, 260);
  }
  ring(scene, o.x, groundY, w, C.yellow, 320, 0.3);
  ring(scene, o.x, groundY, w * 0.65, C.violet, 280, 0.3, 60);
  // Ground cracks of electricity.
  for (let i = 0; i < 4; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    spawnBolt(scene, o.x, groundY, o.x + dir * rnd(w * 0.25, w * 0.5), groundY + rnd(-6, 6), { w: 0.7, jitter: 7, frames: 4, frameMs: 45, forks: 1 });
  }
  sparks(scene, o.x, groundY, 16);
  screenFlash(scene, 0.35, 130);
  scene.cameras.main.shake(110, 0.0028);
};

const ballBurst: VfxFn = (scene, o) => {
  if (!pxFx(scene, 'ss_thunder', o.x, o.y, { scale: 4, add: true, dur: 420, depth: DEPTH.VFX_TOP })) {
    flash(scene, o.x, o.y, 100, C.white, 240);
    ring(scene, o.x, o.y, 80, C.yellow, 220, 1, 40);
  }
  ring(scene, o.x, o.y, Math.max(120, o.w ?? 140), C.violet, 300);
  radialBolts(scene, o.x, o.y, 5, 40, 85, { w: 0.9, jitter: 8, forks: 1 });
  sparks(scene, o.x, o.y, 12);
};

const overloadArea: VfxFn = (scene, o) => {
  const w = o.w ?? 460, h = o.h ?? 220;
  const rx = w / 2, ry = h / 2;
  // Electrified pixel vortex (CodeManu, palette-swapped violet/yellow).
  if (!pxFx(scene, 'cm_vortex', o.x, o.y, { v: 'ltn', scale: 4, add: true, dur: 520, depth: DEPTH.VFX - 1 })) {
    const dome = scene.add.image(o.x, o.y, 'ltn_glow').setDepth(DEPTH.VFX - 1).setBlendMode(ADD).setTint(C.violet);
    dome.setScale(w / 64, h / 64 * 1.1).setAlpha(0.7);
    scene.tweens.add({ targets: dome, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => dome.destroy() });
    flash(scene, o.x, o.y, 140, C.white, 260);
  }
  ring(scene, o.x, o.y, w, C.violet, 380, h / w);
  screenFlash(scene, 0.32, 140);
  // Four waves of bolts (matches the 4 hit lines).
  for (let wave = 0; wave < 4; wave++) {
    scene.time.delayedCall(wave * 90, () => {
      const n = wave === 0 ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rnd(-0.3, 0.3) + wave * 0.4;
        const ex = o.x + Math.cos(a) * rx * rnd(0.7, 1.05);
        const ey = o.y + Math.sin(a) * ry * rnd(0.7, 1.05);
        spawnBolt(scene, o.x, o.y, ex, ey, { w: wave === 0 ? 1.2 : 0.9, jitter: 14, forks: 1, frames: 3, frameMs: 40, fadeMs: 90, glow: i % 2 ? C.violet : C.deepViolet, mid: i % 3 === 0 ? C.white : C.yellow });
      }
      sparks(scene, o.x, o.y, 6);
      if (wave > 0) pxFx(scene, 'g9_spark', o.x + rnd(-rx, rx) * 0.5, o.y + rnd(-ry, ry) * 0.5, { v: 'ltn', scale: 2, add: true, dur: 260 });
    });
  }
};

// ───────────────────────────── Thunderstorm ─────────────────────────────

function stormClouds(scene: Phaser.Scene, o: VfxOptions): void {
  const lv = o.lv ?? 1;
  const total = STORM.count(lv) * STORM.intervalMs + 1000;
  const cam = scene.cameras.main;
  const cx = o.x + o.facing * STORM.offsetX;
  const cy = Phaser.Math.Clamp(o.y - 400, cam.worldView.top + 70, o.y - 220);

  // Gloom over the world (below the player so the mage stays lit).
  const gloom = scene.add.rectangle(0, 0, cam.width, cam.height, C.gloom, 0.3)
    .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.PLAYER - 1).setAlpha(0);
  scene.tweens.add({ targets: gloom, alpha: 0.3, duration: 380 });

  const clouds: Phaser.GameObjects.Image[] = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const x = cx + (i - (count - 1) / 2) * (STORM.spreadX / (count - 1)) + rnd(-18, 18);
    const y = cy + rnd(-16, 16);
    const c = scene.add.image(x, y, 'ltn_cloud').setDepth(DEPTH.VFX_TOP - 1).setScale(2).setAlpha(0);
    if (i % 2) c.setFlipX(true);
    clouds.push(c);
    scene.tweens.add({ targets: c, alpha: 0.96, duration: 420, delay: i * 50 });
    loopWhileAlive(scene, c, { targets: c, x: x + Math.round(rnd(-12, 12)) * 2, duration: rnd(1200, 1900), yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [6] });
  }

  const i2color = (): number => (Math.random() < 0.5 ? C.violet : C.yellow);
  let alive = true;
  const flicker = (): void => {
    if (!alive) return;
    const live = clouds.filter((c) => c.active);
    if (live.length) {
      const c = pick(live);
      flash(scene, c.x + rnd(-40, 40), c.y + 6, rnd(110, 190), i2color(), 150, 1.4);
      const bx = c.x + rnd(-50, 50);
      spawnBolt(scene, bx, c.y + 14, bx + rnd(-40, 40), c.y + rnd(60, 130), { w: 0.6, jitter: 10, forks: 1, frames: 3, frameMs: 40, fadeMs: 70 });
    }
    scene.time.delayedCall(rnd(120, 280), flicker);
  };
  scene.time.delayedCall(450, flicker);

  scene.time.delayedCall(Math.max(600, total - 550), () => {
    alive = false;
    for (const c of clouds) {
      if (!c.active) continue;
      scene.tweens.add({ targets: c, alpha: 0, y: c.y - 14, duration: 540, onComplete: () => { scene.tweens.killTweensOf(c); c.destroy(); } });
    }
    if (gloom.active) scene.tweens.add({ targets: gloom, alpha: 0, duration: 620, onComplete: () => gloom.destroy() });
  });
}

/** Falling lightning body. Drawn pointing +x with the tail trailing toward -x; engine rotates it to point down. */
const stormProj: VfxFn = (scene) => {
  const g = scene.add.graphics().setBlendMode(ADD);
  const head = pxFx(scene, 'g9_spark', 0, 0, { v: 'ltn', scale: 2, add: true, loop: true, randomStart: true })
    ?? scene.add.image(0, 0, 'ltn_glow').setBlendMode(ADD).setTint(C.white).setScale(1);
  const c = scene.add.container(0, 0, [g, head]).setDepth(DEPTH.VFX);
  const redraw = (): void => {
    g.clear();
    drawBoltFrame(g, -210, 0, 0, 0, { w: 1.25, jitter: 10, seg: 11, forks: 1 });
  };
  redraw();
  whileAlive(scene, c, 60, redraw);
  return c;
};

const stormStrike: VfxFn = (scene, o) => {
  const w = o.w ?? 150;
  // pixel lightning strike rooted at the ground point
  if (!pxFx(scene, 'g9_lightning', o.x, o.y + 4, { v: 'ltn', scale: 2, oy: 1, add: true, dur: 460, depth: DEPTH.VFX_TOP })) {
    flash(scene, o.x, o.y, 90, C.white, 200);
    column(scene, o.x, o.y + 2, 150, 34, C.yellow, 240);
    spawnBolt(scene, o.x + rnd(-4, 4), o.y - 150, o.x, o.y, { w: 1.1, jitter: 14, forks: 2, frames: 3, frameMs: 45, fadeMs: 90 });
  }
  ring(scene, o.x, o.y, w * 0.9, C.violet, 260, 0.3);
  radialBolts(scene, o.x, o.y, 2, 22, 46, { w: 0.6, jitter: 5 }, -Math.PI / 2, Math.PI * 0.9);
  sparks(scene, o.x, o.y, 4);
  if (Math.random() < 0.3) screenFlash(scene, 0.14, 70);
};

// ───────────────────────────── persistent: ball lightning ─────────────────────────────

const ballProj: VfxFn = (scene) => {
  const arcs = scene.add.graphics().setBlendMode(ADD);
  const orb = pxFx(scene, 'ss_thunder', 0, 0, { scale: 2, add: true, loop: true, randomStart: true });
  const c = scene.add.container(0, 0, orb ? [orb, arcs] : [arcs]).setDepth(DEPTH.VFX);
  if (!orb) {
    const outer = scene.add.image(0, 0, 'ltn_glow').setBlendMode(ADD).setTint(C.violet).setScale(2).setAlpha(0.75);
    const core = scene.add.image(0, 0, 'ltn_glow').setBlendMode(ADD).setTint(C.white).setScale(0.75);
    c.addAt([outer, core], 0);
  }
  const redraw = (): void => {
    arcs.clear();
    // Arcs orbiting the orb surface.
    for (let i = 0; i < 2; i++) {
      const a0 = Math.random() * TAU;
      const span = rnd(1.0, 1.9);
      const r = rnd(20, 28);
      const pts: { x: number; y: number }[] = [];
      const n = 6;
      for (let k = 0; k <= n; k++) {
        const a = a0 + (span * k) / n;
        const rr = r + (k === 0 || k === n ? 0 : rnd(-5, 5));
        pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
      }
      drawBolt(arcs, pts, 0.55, i === 0 ? C.yellow : C.violet, C.white);
    }
  };
  redraw();
  whileAlive(scene, c, 70, redraw);
  // Crackling wake.
  whileAlive(scene, c, 80, () => {
    sparks(scene, c.x + rnd(-8, 8), c.y + rnd(-8, 8), 1);
  });
  return c;
};

// ───────────────────────────── persistent: totem ─────────────────────────────

/** Stationary totem. Origin = base on the ground; body extends upward (negative y). */
const totemBody: VfxFn = (scene) => {
  const parts: Phaser.GameObjects.GameObject[] = [];
  let top: Phaser.GameObjects.Container;
  if (scene.textures.exists('ltn_totem_px')) {
    // pixel-art stone (generated on a 2px grid) + a pixel electric orb as the crystal
    parts.push(scene.add.image(0, 2, 'ltn_totem_px').setOrigin(0.5, 1));
    const orb = pxFx(scene, 'g9_spark', 0, 0, { v: 'ltn', scale: 2, add: true, loop: true, fps: 10 });
    top = scene.add.container(0, -74, orb ? [orb] : [scene.add.image(0, 0, 'ltn_glow').setBlendMode(ADD).setTint(C.yellow)]);
  } else {
    const stone = scene.add.graphics();
    stone.fillStyle(0x2a2748, 1);
    stone.fillPoints([{ x: -22, y: 0 }, { x: 22, y: 0 }, { x: 16, y: -54 }, { x: -16, y: -54 }] as Phaser.Types.Math.Vector2Like[], true);
    parts.push(stone);
    const crystal = scene.add.graphics();
    crystal.fillStyle(0xfff3a0, 0.95);
    crystal.fillPoints([{ x: 0, y: -18 }, { x: 10, y: 0 }, { x: 0, y: 18 }, { x: -10, y: 0 }] as Phaser.Types.Math.Vector2Like[], true);
    top = scene.add.container(0, -74, [crystal]);
  }
  const arcs = scene.add.graphics().setBlendMode(ADD);
  const c = scene.add.container(0, 0, [...parts, arcs, top]).setDepth(DEPTH.SUMMON);

  loopWhileAlive(scene, c, { targets: top, y: -78, duration: 900, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [2] });

  whileAlive(scene, c, 140, () => {
    arcs.clear();
    const cy = top.y;
    if (Math.random() < 0.55) {
      drawBoltFrame(arcs, 0, cy, rnd(-30, 30), -2, { w: 0.5, jitter: 6, seg: 5 });
    }
    const a = Math.random() * TAU;
    drawBoltFrame(arcs, Math.cos(a) * 10, cy + Math.sin(a) * 10, Math.cos(a) * rnd(26, 42), cy + Math.sin(a) * rnd(26, 42), { w: 0.5, jitter: 4, seg: 3 });
  });
  whileAlive(scene, c, 420, () => sparks(scene, c.x + rnd(-10, 10), c.y - 72 + rnd(-8, 8), 1));

  // Arrival strike once the engine has positioned the body.
  scene.time.delayedCall(30, () => {
    if (!c.active) return;
    if (!pxFx(scene, 'g9_lightning', c.x, c.y + 4, { v: 'ltn', scale: 2, oy: 1, add: true, dur: 420, depth: DEPTH.VFX_TOP })) {
      flash(scene, c.x, c.y - 30, 120, C.yellow, 280);
    }
    ring(scene, c.x, c.y, 120, C.violet, 320, 0.3);
    sparks(scene, c.x, c.y - 10, 8);
  });
  return c;
};

// ───────────────────────────── persistent: thunderbird ─────────────────────────────

function drawWing(g: Phaser.GameObjects.Graphics, back: boolean): void {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = Phaser.Math.DegToRad(-92 - i * 12);
    const len = 54 - i * 4.2;
    const tip = { x: Math.cos(a) * len, y: Math.sin(a) * len };
    const l = { x: Math.cos(a + 0.2) * len * 0.5, y: Math.sin(a + 0.2) * len * 0.5 };
    const r = { x: Math.cos(a - 0.2) * len * 0.5, y: Math.sin(a - 0.2) * len * 0.5 };
    g.fillStyle(back ? 0x7d5cf0 : 0xfff6c8, back ? 0.7 : 0.9);
    g.fillPoints([{ x: 0, y: 0 }, l, tip, r] as Phaser.Types.Math.Vector2Like[], true);
    g.lineStyle(1.2, back ? C.violet : C.white, 0.9);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(tip.x, tip.y); g.strokePath();
  }
}

/** Thunderbird made of light. Faces +x; hovers (origin = body center). */
const thunderbird: VfxFn = (scene) => {
  const arcs = scene.add.graphics().setBlendMode(ADD);
  // pixel bird: Chasersgaming's phoenix palette-swapped to the storm ramp (faces +x)
  const bird = pxFx(scene, 'phoenix', 0, 0, { v: 'ltn', scale: 2, loop: true });
  const kids: Phaser.GameObjects.GameObject[] = [];
  if (bird) kids.push(bird);
  else {
    const body = scene.add.graphics().setBlendMode(ADD);
    body.fillStyle(0xdff6ff, 0.95);
    body.fillEllipse(0, 0, 40, 18);
    body.fillStyle(0xfff6c8, 1);
    body.fillCircle(21, -5, 8);
    const wingFront = scene.add.graphics().setBlendMode(ADD);
    drawWing(wingFront, false);
    wingFront.setPosition(4, -6);
    kids.push(body, wingFront);
  }
  kids.push(arcs);
  const inner = scene.add.container(0, 0, kids);
  const c = scene.add.container(0, 0, [inner]).setDepth(DEPTH.SUMMON);

  // Hover bob (children only; the engine owns the root container's position).
  loopWhileAlive(scene, c, { targets: inner, y: 6, duration: 620, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });

  whileAlive(scene, c, 110, () => {
    arcs.clear();
    for (let i = 0; i < 2; i++) {
      const sx = rnd(-18, 22), sy = rnd(-6, 6);
      const a = rnd(0, TAU);
      const l = rnd(16, 30);
      drawBoltFrame(arcs, sx, sy, sx + Math.cos(a) * l, sy + Math.sin(a) * l, { w: 0.45, jitter: 4, seg: 3, glow: C.cyan, mid: C.white });
    }
    // Lightning crawling down the tail.
    drawBoltFrame(arcs, -14, 0, -44, rnd(-6, 10), { w: 0.5, jitter: 5, seg: 4, glow: C.violet });
  });
  // Spark trail behind the bird (the bird flips by scaleX, so trail by facing sign).
  whileAlive(scene, c, 110, () => {
    const dir = c.scaleX < 0 ? 1 : -1;
    sparks(scene, c.x + dir * 30 + rnd(-6, 6), c.y + rnd(-6, 8), 1);
  });

  scene.time.delayedCall(30, () => {
    if (!c.active) return;
    if (!pxFx(scene, 'g9_spark', c.x, c.y, { v: 'ltn', scale: 4, add: true, dur: 320, depth: DEPTH.VFX_TOP })) {
      flash(scene, c.x, c.y, 150, C.white, 300);
    }
    ring(scene, c.x, c.y, 150, C.cyan, 340);
    radialBolts(scene, c.x, c.y, 5, 40, 90, { w: 0.9, jitter: 8, glow: C.cyan, mid: C.white });
    sparks(scene, c.x, c.y, 12);
  });
  return c;
};

// ───────────────────────────── buff: Tempest Surge ─────────────────────────────

const surgeCast: VfxFn = (scene, o) => {
  const cy = o.y - 36;
  if (!pxFx(scene, 'g9_lightning', o.x, o.y + 4, { v: 'ltn', scale: 2, oy: 1, add: true, dur: 520, depth: DEPTH.VFX_TOP })) {
    column(scene, o.x, o.y + 4, 190, 90, C.yellow, 520);
    flash(scene, o.x, cy, 130, C.white, 320);
  }
  pxFx(scene, 'cm_ring', o.x, cy, { v: 'ltn', scale: 4, add: true, delay: 120, depth: DEPTH.VFX_TOP });
  ring(scene, o.x, o.y, 150, C.yellow, 420, 0.3);
  for (let i = 0; i < 4; i++) {
    const bx = o.x + (i - 1.5) * 16;
    spawnBolt(scene, bx + rnd(-8, 8), o.y - 170, bx, o.y, { w: 0.7, jitter: 10, frames: 4, frameMs: 50, fadeMs: 110, forks: 1, glow: i % 2 ? C.violet : C.cyan });
  }
  sparks(scene, o.x, cy, 12);
  screenFlash(scene, 0.25, 140);
};

/** Persistent aura at the player's feet (origin = feet). */
const surgeAura: VfxFn = (scene) => {
  const arcs = scene.add.graphics().setBlendMode(ADD);
  const ward = pxFx(scene, 'cm_shield', 0, -36, { v: 'ltn', scale: 2, add: true, loop: true, alpha: 0.5, fps: 12 });
  const kids: Phaser.GameObjects.GameObject[] = ward ? [ward, arcs] : [arcs];
  if (!ward) {
    const glow = scene.add.image(0, -36, 'ltn_glow').setBlendMode(ADD).setTint(C.violet).setScale(2, 3).setAlpha(0.25);
    kids.unshift(glow);
  }
  const c = scene.add.container(0, 0, kids).setDepth(DEPTH.VFX);

  whileAlive(scene, c, 120, () => {
    arcs.clear();
    // Arcs crawling over the body ellipse.
    for (let i = 0; i < 2; i++) {
      const a0 = Math.random() * TAU;
      const span = rnd(1.0, 2.0);
      const pts: { x: number; y: number }[] = [];
      const n = 6;
      for (let k = 0; k <= n; k++) {
        const a = a0 + (span * k) / n;
        const j = k === 0 || k === n ? 0 : rnd(-4, 4);
        pts.push({ x: Math.cos(a) * (26 + j), y: -36 + Math.sin(a) * (38 + j) });
      }
      drawBolt(arcs, pts, 0.5, i ? C.violet : C.yellow, C.white);
    }
  });
  whileAlive(scene, c, 240, () => {
    sparks(scene, c.x + rnd(-18, 18), c.y - rnd(4, 70), 1);
  });
  return c;
};

// ───────────────────────────── registration ─────────────────────────────

export function registerLightningVfx(): void {
  // Academy expansion (passive sigils accent studied attack casts while learned).
  registerVfx('ltn_needle_cast', needleCast);
  registerVfx('ltn_needle_proj', needleProj);
  registerVfx('ltn_repulsion_area', repulsionArea);
  registerVfx('ltn_ward_cast', wardCast);
  registerVfx('ltn_ward_aura', wardAura);
  registerVfx('ltn_live_wire_sigil', liveWireSigil);
  registerVfx('ltn_capacitor_arc', capacitorArc);
  registerVfx('ltn_reversal_cast', reversalCast);
  registerVfx('ltn_relay_out', relayOut);
  registerVfx('ltn_relay_in', relayIn);
  registerVfx('ltn_relay_arrival', relayArrival);
  registerVfx('ltn_judgment_cage', judgmentCage);
  registerVfx('ltn_rail_charge', railCharge);
  registerVfx('ltn_rail_beam', railBeam);
  registerVfx('ltn_conductor_sigil', conductorSigil);
  // casts
  registerVfx('ltn_cast_bolt', castBolt);
  registerVfx('ltn_cast_lance', castLance);
  registerVfx('ltn_cast_spear', castSpear);
  registerVfx('ltn_cast_ball', castBall);
  registerVfx('ltn_overload_cast', overloadCast);
  registerVfx('ltn_cast_arc', castArc);
  registerVfx('ltn_storm_cast', stormCast);
  registerVfx('ltn_bird_screech', birdScreech);
  registerVfx('ltn_totem_pulse', totemPulse);
  // chain / beam / hit
  registerVfx('ltn_chain_seg', chainSeg);
  registerVfx('ltn_chain_arc', chainArc);
  registerVfx('ltn_chain_totem', chainTotem);
  registerVfx('ltn_chain_bird', chainBird);
  registerVfx('ltn_beam_lance', beamLance);
  registerVfx('ltn_hit_zap', hitZap);
  registerVfx('ltn_hit_shock', hitShock);
  // movement
  registerVfx('ltn_step_out', stepOut);
  registerVfx('ltn_step_in', stepIn);
  // areas
  registerVfx('ltn_spear_strike', spearStrike);
  registerVfx('ltn_ball_burst', ballBurst);
  registerVfx('ltn_overload_area', overloadArea);
  registerVfx('ltn_storm_strike', stormStrike);
  // persistent
  registerVfx('ltn_ball_proj', ballProj);
  registerVfx('ltn_storm_proj', stormProj);
  registerVfx('ltn_totem', totemBody);
  registerVfx('ltn_thunderbird', thunderbird);
  registerVfx('ltn_surge_cast', surgeCast);
  registerVfx('ltn_surge_aura', surgeAura);
}
