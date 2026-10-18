// OWNER: A3 (fire-tree). Small helper kit shared by the fire VFX.
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import { FT } from './textures';

export const ADD = Phaser.BlendModes.ADD;
export const NORMAL = Phaser.BlendModes.NORMAL;

/** Fire palette. */
export const C = {
  white: 0xfff4d0, yellow: 0xffd84a, gold: 0xffb830, orange: 0xff7a1a, red: 0xe63a12, deep: 0x9a1a0a, smoke: 0x2a140c,
};
export const FIRE_TINTS = [C.yellow, C.orange, C.red];
export const HOT_TINTS = [C.white, C.yellow, C.gold];

export type EmCfg = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
export type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** Texture key if it exists, else Phaser's built-in white square (never throws). */
export function tk(scene: Phaser.Scene, key: string): string {
  return scene.textures.exists(key) ? key : '__WHITE';
}

export interface ImgOpts {
  tint?: number; scale?: number; sx?: number; sy?: number; alpha?: number;
  depth?: number; add?: boolean; origin?: [number, number]; rot?: number;
}

export function img(scene: Phaser.Scene, key: string, x: number, y: number, o: ImgOpts = {}): Phaser.GameObjects.Image {
  const im = scene.add.image(x, y, tk(scene, key));
  if (o.origin) im.setOrigin(o.origin[0], o.origin[1]);
  if (o.tint !== undefined) im.setTint(o.tint);
  im.setScale(o.sx ?? o.scale ?? 1, o.sy ?? o.scale ?? 1);
  im.setAlpha(o.alpha ?? 1);
  if (o.rot) im.setRotation(o.rot);
  if (o.depth !== undefined) im.setDepth(o.depth);
  if (o.add !== false) im.setBlendMode(ADD);
  return im;
}

/** Tween `props` on `obj` then destroy it. */
export function tweenOut(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject, props: Record<string, number>, dur: number, ease = 'Cubic.easeOut', delay = 0): void {
  scene.tweens.add({
    targets: obj, ...props, duration: dur, ease, delay,
    onComplete: () => { if (obj.scene) obj.destroy(); },
  });
}

/** Looping tween that dies with its owner. */
export function loop(scene: Phaser.Scene, owner: Phaser.GameObjects.GameObject, cfg: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
  const tw = scene.tweens.add({ ...cfg, repeat: -1 });
  owner.once(Phaser.GameObjects.Events.DESTROY, () => tw.stop());
  return tw;
}

export function shake(scene: Phaser.Scene, ms: number, intensity: number): void {
  try { scene.cameras.main.shake(ms, intensity, false); } catch { /* ignore */ }
}

/** Expanding flat-ish shockwave ring. */
export function shock(scene: Phaser.Scene, x: number, y: number, tint: number, width: number, dur: number, flat = 1, alpha = 0.9, delay = 0, depth: number = DEPTH.VFX): void {
  const r = img(scene, FT.ring, x, y, { tint, alpha: 0, depth });
  const s = width / 128;
  r.setScale(s * 0.15, s * 0.15 * flat);
  scene.tweens.add({
    targets: r, scaleX: s, scaleY: s * flat, duration: dur, ease: 'Cubic.easeOut', delay,
    onStart: () => r.setAlpha(alpha),
  });
  scene.tweens.add({ targets: r, alpha: 0, duration: dur * 0.6, delay: delay + dur * 0.4, onComplete: () => { if (r.scene) r.destroy(); } });
}

/** Quick additive glow flash. `size` is the final diameter in px. */
export function flash(scene: Phaser.Scene, x: number, y: number, tint: number, size: number, dur: number, alpha = 1, depth: number = DEPTH.VFX_TOP, tex: string = FT.glow): void {
  const g = img(scene, tex, x, y, { tint, alpha, depth });
  const base = tex === FT.glow ? 128 : 64;
  g.setScale((size / base) * 0.35);
  scene.tweens.add({
    targets: g, scale: size / base, alpha: 0, duration: dur, ease: 'Cubic.easeOut',
    onComplete: () => { if (g.scene) g.destroy(); },
  });
}

/** 4-point star flare that spins and fades. */
export function flare(scene: Phaser.Scene, x: number, y: number, tint: number, size: number, dur: number, depth: number = DEPTH.VFX_TOP): void {
  const s = img(scene, FT.star, x, y, { tint, depth, alpha: 1 });
  s.setScale((size / 64) * 0.2).setRotation(Math.random() * 0.6);
  scene.tweens.add({
    targets: s, scale: size / 64, rotation: s.rotation + 0.9, alpha: 0, duration: dur, ease: 'Cubic.easeOut',
    onComplete: () => { if (s.scene) s.destroy(); },
  });
}

/** Rotate particle sprite to its velocity (for streak textures). */
export const ALIGN: Phaser.Types.GameObjects.Particles.EmitterOpCustomUpdateConfig = {
  onUpdate: (p) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)),
};

/** One-shot particle burst; emitter cleans itself up after `lifeMs`. */
export function burst(scene: Phaser.Scene, x: number, y: number, key: string, count: number, lifeMs: number, cfg: EmCfg, depth: number = DEPTH.VFX): Emitter {
  const em = scene.add.particles(x, y, tk(scene, key), { emitting: false, blendMode: ADD, ...cfg });
  em.setDepth(depth);
  em.explode(count);
  scene.time.delayedCall(lifeMs + 120, () => { if (em.scene) em.destroy(); });
  return em;
}

/** Timed particle stream (stops after `forMs`, destroyed after the last particle dies). */
export function stream(scene: Phaser.Scene, x: number, y: number, key: string, forMs: number, lifeMs: number, cfg: EmCfg, depth: number = DEPTH.VFX): Emitter {
  const em = scene.add.particles(x, y, tk(scene, key), { blendMode: ADD, ...cfg });
  em.setDepth(depth);
  scene.time.delayedCall(forMs, () => { if (em.scene) em.stop(); });
  scene.time.delayedCall(forMs + lifeMs + 120, () => { if (em.scene) em.destroy(); });
  return em;
}

/**
 * World-space particle emitter that follows a persistent (engine-moved) object, so particles
 * leave a trail. Cleans itself up when the target is destroyed.
 */
export function attachTrail(scene: Phaser.Scene, target: Phaser.GameObjects.Container, key: string, lifeMs: number, cfg: EmCfg, depth: number = DEPTH.VFX): Emitter {
  const em = scene.add.particles(target.x, target.y, tk(scene, key), { blendMode: ADD, ...cfg });
  em.setDepth(depth);
  const sync = () => { if (target.scene && em.scene) em.setPosition(target.x, target.y); };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  target.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
    if (em.scene) em.stop();
    scene.time.delayedCall(lifeMs + 120, () => { if (em.scene) em.destroy(); });
  });
  return em;
}

/** Flame tongue that grows from its base, holds, and fades (one-shot). `base` = bottom point. */
export function tongue(scene: Phaser.Scene, x: number, baseY: number, tint: number, w: number, h: number, delay: number, dur: number, depth: number = DEPTH.VFX): void {
  const f = img(scene, FT.flame, x, baseY, { tint, origin: [0.5, 1], depth, alpha: 0 });
  f.setScale(w / 48, 0.1);
  scene.tweens.add({
    targets: f, scaleY: h / 96, scaleX: (w / 48) * (0.8 + Math.random() * 0.4), alpha: 0.95, duration: dur * 0.35, delay, ease: 'Cubic.easeOut',
    onComplete: () => {
      if (!f.scene) return;
      scene.tweens.add({
        targets: f, alpha: 0, scaleX: (w / 48) * 0.4, scaleY: (h / 96) * 1.15, duration: dur * 0.65, ease: 'Quad.easeIn',
        onComplete: () => { if (f.scene) f.destroy(); },
      });
    },
  });
}

type ZoneSrc = Phaser.Types.GameObjects.Particles.EmitZoneData extends infer T
  ? T extends { source: infer S } ? S : never : never;

/** Typed emit-zone helper. */
export function zone(source: ZoneSrc, type: 'random' | 'edge' = 'random', quantity = 1): Phaser.Types.GameObjects.Particles.EmitZoneData {
  return { type, source, quantity } as Phaser.Types.GameObjects.Particles.EmitZoneData;
}
