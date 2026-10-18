// OWNER: Holy tree agent. Small helper kit for the holy VFX (every tween/emitter cleans itself up or dies with its owner).
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import { HT } from './textures';
import { hfx } from './sheets';

export const ADD = Phaser.BlendModes.ADD;

/** Holy palette. */
export const C = {
  white: 0xffffff, cream: 0xfff6d8, pale: 0xfff0b0, gold: 0xffd95a, deep: 0xe8a826, amber: 0xc8841a,
  cyan: 0xbfeaff, sky: 0x8fd6ff, green: 0xb8ffa0,
};
export const GOLD_TINTS = [C.white, C.pale, C.gold];
export const LIGHT_TINTS = [C.white, C.cyan, C.pale];
export const HEAL_TINTS = [C.white, C.green, C.pale];

export type EmCfg = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
export type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);

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
  im.setDepth(o.depth ?? DEPTH.VFX);
  if (o.add !== false) im.setBlendMode(ADD);
  return im;
}

/** Tween `props` then destroy the object. */
export function tweenOut(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject, props: Record<string, unknown>, dur: number, ease = 'Cubic.easeOut', delay = 0): void {
  scene.tweens.add({
    targets: obj, ...props, duration: dur, ease, delay,
    // 'Stepped' alone (1 step) would jump straight to the end value; fade in 3 pixel-art steps instead.
    ...(ease === 'Stepped' ? { easeParams: [3] } : {}),
    onComplete: () => { if (obj.scene) obj.destroy(); },
  });
}

/** Looping tween that is stopped when its owner is destroyed. */
export function loop(scene: Phaser.Scene, owner: Phaser.GameObjects.GameObject, cfg: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
  const tw = scene.tweens.add({ ...cfg, repeat: -1 });
  owner.once(Phaser.GameObjects.Events.DESTROY, () => tw.stop());
  return tw;
}

/** Endless counter tween (0 → to) bound to the owner. */
export function counter(scene: Phaser.Scene, owner: Phaser.GameObjects.GameObject, to: number, dur: number, onUpdate: (v: number) => void): void {
  const tw = scene.tweens.addCounter({ from: 0, to, duration: dur, repeat: -1, onUpdate: (t) => onUpdate(t.getValue() ?? 0) });
  owner.once(Phaser.GameObjects.Events.DESTROY, () => tw.stop());
}

export function shake(scene: Phaser.Scene, ms: number, intensity: number): void {
  try { scene.cameras.main.shake(ms, intensity, false); } catch { /* ignore */ }
}

/** Quick additive pixel glow flash; `size` = final diameter. */
export function flash(scene: Phaser.Scene, x: number, y: number, tint: number, size: number, dur: number, alpha = 1, depth: number = DEPTH.VFX_TOP): void {
  const g = img(scene, HT.glow, x, y, { tint, alpha, depth });
  g.setScale((size / 64) * 0.35);
  tweenOut(scene, g, { scale: size / 64, alpha: 0 }, dur);
}

/** Expanding flat ring: the sun-palette ring sheet, else the shared px_ring. */
export function shock(scene: Phaser.Scene, x: number, y: number, width: number, flat = 1, delay = 0, depth: number = DEPTH.VFX, tint = C.gold): void {
  const k = Math.max(2, Math.round(width / 38 / 2) * 2);
  const s = hfx(scene, 'h_ring', x, y, { scale: k, add: true, delay, depth });
  if (s) { s.setScale(k, k * flat); return; }
  const r = img(scene, 'px_ring', x, y, { tint, alpha: 0, depth });
  const sc = width / 32;
  r.setScale(sc * 0.15, sc * 0.15 * flat);
  scene.tweens.add({ targets: r, scaleX: sc, scaleY: sc * flat, duration: 420, delay, ease: 'Cubic.easeOut', onStart: () => r.setAlpha(0.9) });
  tweenOut(scene, r, { alpha: 0 }, 260, 'Linear', delay + 200);
}

/** One-shot particle burst; emitter cleans itself up. */
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

/** World-space emitter that follows an engine-moved container (leaves a trail); dies with the target. */
export function attachTrail(scene: Phaser.Scene, target: Phaser.GameObjects.Container, key: string, lifeMs: number, cfg: EmCfg, depth: number = DEPTH.VFX, offX = 0, offY = 0): Emitter {
  const em = scene.add.particles(target.x, target.y, tk(scene, key), { blendMode: ADD, ...cfg });
  em.setDepth(depth);
  const sync = () => {
    if (!target.scene || !em.scene) return;
    const sx = Math.sign(target.scaleX) || 1;
    em.setPosition(target.x + offX * sx, target.y + offY);
  };
  sync();
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  target.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
    if (em.scene) em.stop();
    scene.time.delayedCall(lifeMs + 120, () => { if (em.scene) em.destroy(); });
  });
  return em;
}

type ZoneSrc = Phaser.Types.GameObjects.Particles.EmitZoneData extends infer T
  ? T extends { source: infer S } ? S : never : never;

export function zone(source: ZoneSrc, type: 'random' | 'edge' = 'random', quantity = 1): Phaser.Types.GameObjects.Particles.EmitZoneData {
  return { type, source, quantity } as Phaser.Types.GameObjects.Particles.EmitZoneData;
}

/** Rising golden motes + twinkling stars around a point. */
export function motes(scene: Phaser.Scene, x: number, y: number, n: number, spread: number, tints = GOLD_TINTS, depth: number = DEPTH.VFX_TOP): void {
  burst(scene, x, y, HT.mote, n, 1100, {
    speedY: { min: -120, max: -40 }, speedX: { min: -25, max: 25 }, lifespan: { min: 600, max: 1100 },
    scale: { start: 2, end: 1 }, alpha: { start: 1, end: 0 }, tint: tints,
    emitZone: zone(new Phaser.Geom.Rectangle(-spread / 2, -10, spread, 20)),
  }, depth);
}

/** Radiating star sparks (hits / bursts). */
export function sparks(scene: Phaser.Scene, x: number, y: number, n: number, speed: number, tints = GOLD_TINTS): void {
  burst(scene, x, y, 'px_star', n, 700, {
    speed: { min: speed * 0.35, max: speed }, angle: { min: 0, max: 360 }, gravityY: 90,
    lifespan: { min: 380, max: 700 }, scale: { start: 1.5, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: tints,
  }, DEPTH.VFX_TOP);
}
