// OWNER: A5 (lightning-tree). Reusable lightning drawing helpers: jagged bolts, flashes, rings, sparks.
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';

export const TAU = Math.PI * 2;
export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Electric palette: white-hot core, yellow mid, violet glow. */
export const C = {
  white: 0xffffff,
  core: 0xfffbe8,
  yellow: 0xffe94d,
  gold: 0xffc933,
  violet: 0xa66bff,
  deepViolet: 0x5b2bd6,
  cyan: 0x9fe8ff,
  gloom: 0x070720,
};

export interface Pt { x: number; y: number; }

// ───────────────────────────── bolts ─────────────────────────────

/** Jagged polyline between two points (random perpendicular displacement per vertex). */
export function jagged(x1: number, y1: number, x2: number, y2: number, jitter: number, seg?: number): Pt[] {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const n = Math.max(2, seg ?? Math.round(len / 22));
  const nx = -dy / len, ny = dx / len;
  const pts: Pt[] = [{ x: x1, y: y1 }];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const off = (Math.random() * 2 - 1) * jitter;
    pts.push({ x: x1 + dx * t + nx * off, y: y1 + dy * t + ny * off });
  }
  pts.push({ x: x2, y: y2 });
  return pts;
}

function strokePts(g: Phaser.GameObjects.Graphics, pts: Pt[], width: number, color: number, alpha: number): void {
  if (pts.length < 2) return;
  g.lineStyle(Math.max(0.6, width), color, alpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.strokePath();
}

export interface BoltStyle {
  /** Thickness multiplier (1 = ~3px yellow band + 1.6px white core). */
  w?: number;
  jitter?: number;
  seg?: number;
  forks?: number;
  glow?: number;
  mid?: number;
}

/** Draw a layered bolt (wide soft glow → colored band → white core) along the given points. */
export function drawBolt(g: Phaser.GameObjects.Graphics, pts: Pt[], w = 1, glow = C.violet, mid = C.yellow): void {
  strokePts(g, pts, 12 * w, glow, 0.14);
  strokePts(g, pts, 6.5 * w, glow, 0.32);
  strokePts(g, pts, 3.4 * w, mid, 0.85);
  strokePts(g, pts, 1.6 * w, C.white, 1);
}

/** Draw one jittered bolt + branching forks on `g` (call repeatedly for flicker). */
export function drawBoltFrame(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, s: BoltStyle = {}): Pt[] {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const jit = s.jitter ?? Math.min(28, 3 + len * 0.1);
  const w = s.w ?? 1;
  const pts = jagged(x1, y1, x2, y2, jit, s.seg);
  drawBolt(g, pts, w, s.glow ?? C.violet, s.mid ?? C.yellow);
  const nf = s.forks ?? 0;
  if (nf > 0 && pts.length >= 3) {
    for (let i = 0; i < nf; i++) {
      const idx = 1 + Math.floor(Math.random() * (pts.length - 2));
      const p = pts[idx];
      const a = pts[idx - 1], b = pts[idx + 1];
      const base = Math.atan2(b.y - a.y, b.x - a.x);
      const ang = base + (Math.random() < 0.5 ? -1 : 1) * rnd(0.35, 0.95);
      const flen = Math.min(len * 0.45, rnd(26, 80)) * Math.max(0.7, w * 0.8);
      const fp = jagged(p.x, p.y, p.x + Math.cos(ang) * flen, p.y + Math.sin(ang) * flen, flen * 0.16, 3);
      drawBolt(g, fp, w * 0.55, s.glow ?? C.violet, s.mid ?? C.yellow);
    }
  }
  return pts;
}

export interface SpawnBoltOpts extends BoltStyle {
  frames?: number;
  frameMs?: number;
  fadeMs?: number;
  depth?: number;
}

/**
 * One-shot bolt: re-jitters over a few frames then fades. Self-destroys.
 */
export function spawnBolt(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number, s: SpawnBoltOpts = {}): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(s.depth ?? DEPTH.VFX).setBlendMode(Phaser.BlendModes.ADD);
  const frames = Math.max(1, s.frames ?? 4);
  const fm = s.frameMs ?? 45;
  drawBoltFrame(g, x1, y1, x2, y2, s);
  let ev: Phaser.Time.TimerEvent | undefined;
  if (frames > 1) {
    ev = scene.time.addEvent({
      delay: fm,
      repeat: frames - 2,
      callback: () => {
        if (!g.active) return;
        g.clear();
        drawBoltFrame(g, x1, y1, x2, y2, s);
      },
    });
  }
  scene.tweens.add({
    targets: g,
    alpha: 0,
    duration: frames * fm + (s.fadeMs ?? 90),
    ease: 'Cubic.easeIn',
    onComplete: () => { ev?.remove(false); g.destroy(); },
  });
  return g;
}

/** Several short bolts radiating from a point. */
export function radialBolts(scene: Phaser.Scene, x: number, y: number, n: number, rMin: number, rMax: number, s: SpawnBoltOpts = {}, baseAngle?: number, spread = TAU): void {
  for (let i = 0; i < n; i++) {
    const ang = (baseAngle ?? 0) + (baseAngle === undefined ? Math.random() * TAU : rnd(-spread / 2, spread / 2));
    const r = rnd(rMin, rMax);
    spawnBolt(scene, x, y, x + Math.cos(ang) * r, y + Math.sin(ang) * r, { frames: 3, frameMs: 40, fadeMs: 80, ...s });
  }
}

// ───────────────────────────── flashes, rings, columns ─────────────────────────────

/** Expanding soft flash. `size` = starting diameter in px. */
export function flash(scene: Phaser.Scene, x: number, y: number, size: number, color = C.yellow, ms = 200, grow = 1.7): void {
  const img = scene.add.image(x, y, 'ltn_glow').setDepth(DEPTH.VFX_TOP).setBlendMode(Phaser.BlendModes.ADD).setTint(color);
  const s0 = size / 64;
  img.setScale(s0 * 0.6).setAlpha(0.95);
  scene.tweens.add({ targets: img, scale: s0 * grow, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
}

/** Expanding electric ring. `diameter` = final diameter; `squash` flattens to an ellipse (ground rings). */
export function ring(scene: Phaser.Scene, x: number, y: number, diameter: number, color = C.violet, ms = 260, squash = 1, delay = 0, startFrac = 0.2): void {
  const img = scene.add.image(x, y, 'ltn_ring').setDepth(DEPTH.VFX).setBlendMode(Phaser.BlendModes.ADD).setTint(color).setAlpha(0);
  const sc = diameter / 84;
  img.setScale(sc * startFrac, sc * startFrac * squash);
  scene.tweens.add({
    targets: img, scaleX: sc, scaleY: sc * squash, duration: ms, delay, ease: 'Cubic.easeOut',
    onStart: () => img.setAlpha(1),
  });
  scene.tweens.add({ targets: img, alpha: 0, duration: ms * 0.6, delay: delay + ms * 0.4, onComplete: () => img.destroy() });
}

/** Vertical glow column rooted at (x, baseY). */
export function column(scene: Phaser.Scene, x: number, baseY: number, height: number, width: number, color = C.yellow, ms = 300): void {
  const img = scene.add.image(x, baseY, 'ltn_glow').setOrigin(0.5, 1).setDepth(DEPTH.VFX).setBlendMode(Phaser.BlendModes.ADD).setTint(color);
  img.setScale(width / 64, height / 64).setAlpha(0.9);
  scene.tweens.add({ targets: img, scaleX: (width / 64) * 0.25, alpha: 0, duration: ms, ease: 'Quad.easeIn', onComplete: () => img.destroy() });
}

/** Small things flying inward to a point (charge-up). */
export function converge(scene: Phaser.Scene, x: number, y: number, n: number, radius: number, ms: number, color = C.yellow, startScale = 0.28): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(-0.3, 0.3);
    const r = radius * rnd(0.8, 1.15);
    const img = scene.add.image(x + Math.cos(a) * r, y + Math.sin(a) * r, 'ltn_glow').setDepth(DEPTH.VFX_TOP).setBlendMode(Phaser.BlendModes.ADD).setTint(color).setScale(startScale);
    scene.tweens.add({
      targets: img, x, y, scale: 0.05, alpha: 0.2, duration: ms * rnd(0.8, 1), ease: 'Quad.easeIn',
      onComplete: () => img.destroy(),
    });
  }
}

let lastScreenFlash = -1e9;
/** Brief full-screen overlay flash (scroll factor 0). Throttled so rain storms don't strobe. */
export function screenFlash(scene: Phaser.Scene, alpha = 0.3, ms = 110, color = C.white): void {
  const now = scene.time.now;
  if (now < lastScreenFlash) lastScreenFlash = -1e9;
  if (now - lastScreenFlash < 260) return;
  lastScreenFlash = now;
  const cam = scene.cameras.main;
  const r = scene.add.rectangle(0, 0, cam.width, cam.height, color, alpha)
    .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.DAMAGE_TEXT - 1).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: r, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
}

// ───────────────────────────── particles ─────────────────────────────

type EKind = 'spark' | 'glow' | 'star';
const emitterCache = new WeakMap<Phaser.Scene, Partial<Record<EKind, Phaser.GameObjects.Particles.ParticleEmitter>>>();

function emitterFor(scene: Phaser.Scene, kind: EKind): Phaser.GameObjects.Particles.ParticleEmitter {
  let m = emitterCache.get(scene);
  if (!m) { m = {}; emitterCache.set(scene, m); }
  const cached = m[kind];
  if (cached && cached.active) return cached;
  let e: Phaser.GameObjects.Particles.ParticleEmitter;
  if (kind === 'spark') {
    e = scene.add.particles(0, 0, 'ltn_spark', {
      emitting: false,
      lifespan: { min: 220, max: 540 },
      speed: { min: 90, max: 380 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.15, end: 0.15 },
      alpha: { start: 1, end: 0 },
      gravityY: 240,
      tint: [0xffffff, 0xfff3a0, 0xffe94d, 0xc9a2ff],
      rotate: { onUpdate: (p: Phaser.GameObjects.Particles.Particle) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) },
      blendMode: 'ADD',
    });
  } else if (kind === 'glow') {
    e = scene.add.particles(0, 0, 'ltn_glow', {
      emitting: false,
      lifespan: { min: 280, max: 620 },
      speed: { min: 10, max: 90 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.38, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xffe94d, 0xa66bff, 0xffffff],
      blendMode: 'ADD',
    });
  } else {
    e = scene.add.particles(0, 0, 'ltn_star', {
      emitting: false,
      lifespan: { min: 260, max: 480 },
      speed: { min: 30, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.65, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 90 },
      tint: [0xffffff, 0xffe94d, 0xc9a2ff],
      blendMode: 'ADD',
    });
  }
  e.setDepth(DEPTH.VFX_TOP);
  m[kind] = e;
  return e;
}

/** Burst of crackling spark streaks. */
export function sparks(scene: Phaser.Scene, x: number, y: number, n: number): void {
  emitterFor(scene, 'spark').explode(n, x, y);
}
/** Burst of soft glowing motes. */
export function motes(scene: Phaser.Scene, x: number, y: number, n: number): void {
  emitterFor(scene, 'glow').explode(n, x, y);
}
/** Burst of small 4-point stars. */
export function stars(scene: Phaser.Scene, x: number, y: number, n: number): void {
  emitterFor(scene, 'star').explode(n, x, y);
}

/** Run `fn` every `delay` ms while `owner` is alive; auto-removed when owner is destroyed. */
export function whileAlive(scene: Phaser.Scene, owner: Phaser.GameObjects.GameObject, delay: number, fn: () => void): void {
  const ev = scene.time.addEvent({
    delay,
    loop: true,
    callback: () => { if (owner.active) fn(); },
  });
  owner.once('destroy', () => ev.remove(false));
}
