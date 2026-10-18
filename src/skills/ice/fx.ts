/** Small helpers shared by the ice VFX. Keep everything self-cleaning. */
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import type { VfxOptions } from '../../core/types';

export type EmitterCfg = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

export const ADD = Phaser.BlendModes.ADD;
export const NORMAL = Phaser.BlendModes.NORMAL;

export const C = {
  white: 0xffffff,
  pale: 0xe2f8ff,
  cyan: 0x8fe3ff,
  sky: 0x66c4ff,
  blue: 0x3d8fe8,
  deep: 0x2a62c8,
} as const;

/** Distance from an area's centre to the floor under typical targets (monster/player half height). */
export const GROUND_DY = 28;

/** Texture key if present, otherwise Phaser's built-in white pixel (never throws). */
export function T(scene: Phaser.Scene, key: string): string {
  return scene.textures.exists(key) ? key : '__WHITE';
}

export interface ImgOpts {
  depth?: number;
  add?: boolean;
  tint?: number;
  alpha?: number;
  scale?: number;
  sx?: number;
  sy?: number;
  rot?: number;
  ox?: number;
  oy?: number;
  /** don't add to the display list (to be put in a container) */
  free?: boolean;
}

export function img(scene: Phaser.Scene, x: number, y: number, key: string, o: ImgOpts = {}): Phaser.GameObjects.Image {
  const im = scene.make.image({ x, y, key: T(scene, key) }, !o.free);
  if (o.add) im.setBlendMode(ADD);
  if (o.tint !== undefined) im.setTint(o.tint);
  if (o.alpha !== undefined) im.setAlpha(o.alpha);
  const s = o.scale ?? 1;
  im.setScale(o.sx ?? s, o.sy ?? s);
  if (o.rot !== undefined) im.setRotation(o.rot);
  if (o.ox !== undefined || o.oy !== undefined) im.setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
  im.setDepth(o.depth ?? DEPTH.VFX);
  return im;
}

/** Tween any display object and destroy it when finished. */
export function tweenOut(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.GameObject,
  props: Record<string, unknown>,
  duration: number,
  ease = 'Cubic.Out',
  delay = 0,
): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: obj,
    ...props,
    duration,
    delay,
    ease,
    onComplete: () => obj.destroy(),
  });
}

/** One-shot particle burst. Emitter destroys itself after `lifeMs`. */
export function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  cfg: EmitterCfg,
  count: number,
  lifeMs: number,
  depth: number = DEPTH.VFX,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const e = scene.add.particles(x, y, T(scene, key), { ...cfg, emitting: false });
  e.setDepth(depth);
  e.explode(count);
  scene.time.delayedCall(lifeMs + 120, () => { if (e.scene) e.destroy(); });
  return e;
}

/** Run cleanup callbacks when `host` is destroyed (the engine owns persistent visuals' lifetime). */
export function bindLife(host: Phaser.GameObjects.GameObject, ...cleanups: Array<() => void>): void {
  host.once(Phaser.GameObjects.Events.DESTROY, () => {
    for (const f of cleanups) {
      try { f(); } catch { /* already gone */ }
    }
  });
}

/** Particle trail that follows a persistent visual and is destroyed with it. */
export function followEmitter(
  scene: Phaser.Scene,
  host: Phaser.GameObjects.Container,
  key: string,
  cfg: EmitterCfg,
  offX = 0,
  offY = 0,
  depth: number = DEPTH.VFX,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const e = scene.add.particles(host.x, host.y, T(scene, key), cfg);
  e.setDepth(depth);
  e.startFollow(host, offX, offY);
  bindLife(host, () => e.destroy());
  return e;
}

/** Looping 0..2π counter bound to a host's lifetime. */
export function spin(
  scene: Phaser.Scene,
  host: Phaser.GameObjects.Container,
  periodMs: number,
  onTick: (t: number) => void,
): void {
  const tw = scene.tweens.addCounter({
    from: 0,
    to: Math.PI * 2,
    duration: periodMs,
    repeat: -1,
    onUpdate: (t) => {
      if (!host.active) return;
      onTick(t.getValue() ?? 0);
    },
  });
  bindLife(host, () => tw.stop());
}

/** Yoyo tween on a child, bound to the host. */
export function breathe(
  scene: Phaser.Scene,
  host: Phaser.GameObjects.Container,
  target: Phaser.GameObjects.GameObject,
  props: Record<string, unknown>,
  duration: number,
  ease = 'Sine.InOut',
): void {
  const tw = scene.tweens.add({ targets: target, ...props, duration, yoyo: true, repeat: -1, ease });
  bindLife(host, () => tw.stop());
}

/** Degrees of the +x/-x facing. */
export const faceDeg = (o: VfxOptions): number => (o.facing === 1 ? 0 : 180);

export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

/** Soft flash glow that grows and fades. */
export function flash(scene: Phaser.Scene, x: number, y: number, size: number, tint: number = C.cyan, dur = 260, sy?: number, depth: number = DEPTH.VFX_TOP): void {
  const g = img(scene, x, y, 'ice_glow', { add: true, tint, alpha: 0.95, scale: size * 0.4, sy: sy !== undefined ? size * 0.4 * sy : undefined, depth });
  tweenOut(scene, g, { scaleX: size, scaleY: sy !== undefined ? size * sy : size, alpha: 0 }, dur, 'Quad.Out');
}

/** Expanding ring (optionally squashed into a ground ellipse). */
export function ring(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  tint: number = C.pale, dur = 480, delay = 0, depth: number = DEPTH.VFX,
): void {
  const r = img(scene, x, y, 'ice_ring', { add: true, tint, alpha: 0, sx: 0.12, sy: 0.12 * (h / w), depth });
  scene.tweens.add({
    targets: r,
    scaleX: w / 116,
    scaleY: h / 116,
    duration: dur,
    delay,
    ease: 'Cubic.Out',
    onStart: () => r.setAlpha(0.95),
    onUpdate: (tw) => r.setAlpha(0.95 * (1 - Math.max(0, (tw.progress - 0.3) / 0.7))),
    onComplete: () => r.destroy(),
  });
}
