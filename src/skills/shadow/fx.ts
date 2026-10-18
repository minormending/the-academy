import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import { PX_SHEETS, type PxOpts } from '../../art/particles';
import type { VfxOptions } from '../../core/types';
import { C, ST, sheetAnimation, sheetTexture, type ShadowSheet } from './textures';

/** pxFx's lifetime convention with local shd_ keys; the shared helper hardcodes pxs_/pxa_. */
export function sheet(scene: Phaser.Scene, id: ShadowSheet, x: number, y: number, o: PxOpts = {}): Phaser.GameObjects.Sprite | null {
  const key = sheetTexture(id), animation = sheetAnimation(id);
  if (!scene.textures.exists(key) || !scene.anims.exists(animation)) return null;
  const def = PX_SHEETS[id], frames = def.rects?.length ?? def.n ?? 1;
  const s = scene.add.sprite(x, y, key, 0).setScale(o.scale ?? 2).setDepth(o.depth ?? DEPTH.VFX)
    .setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setAlpha(o.alpha ?? 1).setRotation(o.rot ?? 0);
  s.setFlip(o.flipX ?? false, o.flipY ?? false);
  if (o.add) s.setBlendMode(Phaser.BlendModes.ADD);
  const cfg: Phaser.Types.Animations.PlayAnimationConfig = {
    key: animation, repeat: o.loop ? -1 : 0,
    frameRate: o.dur ? frames * 1000 / Math.max(1, o.dur) : o.fps ?? def.fps,
    startFrame: o.randomStart ? Math.floor(Math.random() * frames) : 0,
  };
  if (!o.loop) s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
  s.play(cfg);
  return s;
}

export function image(scene: Phaser.Scene, key: string, x: number, y: number, scale = 2): Phaser.GameObjects.Image {
  // Even if boot hasn't run, Phaser's built-in square makes the fallback visible and safe.
  return scene.add.image(x, y, scene.textures.exists(key) ? key : '__WHITE').setScale(scale).setDepth(DEPTH.VFX);
}

export function root(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  return scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
}

export function loop(scene: Phaser.Scene, owner: Phaser.GameObjects.GameObject, cfg: Phaser.Types.Tweens.TweenBuilderConfig): void {
  const tween = scene.tweens.add({ ...cfg, repeat: -1 });
  owner.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
}

export function fade(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject, duration: number,
  props: Record<string, number> = {}, delay = 0): void {
  const tween = scene.tweens.add({ targets: obj, ...props, alpha: 0, duration, delay,
    onComplete: () => { if (obj.scene) obj.destroy(); } });
  obj.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
}

/** At most six motes, fixed 2× pixels; both the emitter and its cleanup timer have owners. */
export function motes(scene: Phaser.Scene, x: number, y: number, count = 5, up = false): void {
  if (!scene.textures.exists(ST.mote)) return;
  const e = scene.add.particles(x, y, ST.mote, {
    emitting: false, lifespan: 460, speed: { min: 20, max: 95 },
    angle: up ? { min: 220, max: 320 } : { min: 0, max: 360 },
    gravityY: up ? -20 : 40, scale: 2, alpha: { start: 1, end: 0 },
    tint: [C.green, C.lilac],
  }).setDepth(DEPTH.VFX_TOP);
  e.explode(Math.min(6, count));
  const timer = scene.time.delayedCall(520, () => { if (e.scene) e.destroy(); });
  e.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove(false));
}

function fallback(scene: Phaser.Scene, key: string, x: number, y: number, dur: number, scale = 2): void {
  const im = image(scene, key, x, y, scale);
  fade(scene, im, dur);
}

export function cast(scene: Phaser.Scene, o: VfxOptions): void {
  if (!sheet(scene, 'sf_ring', o.x, o.y, { dur: 270 })) fallback(scene, ST.ring, o.x, o.y, 270);
  motes(scene, o.x, o.y, 4, true);
}

export function hit(scene: Phaser.Scene, o: VfxOptions, cursed = false): void {
  if (!sheet(scene, cursed ? 'g9_darkbolt' : 'g9_spark', o.x, o.y, { dur: cursed ? 380 : 250 })) {
    fallback(scene, cursed ? ST.skull : ST.slash, o.x, o.y, 260);
  }
  if (cursed) {
    const skull = image(scene, ST.skull, o.x, o.y - 24);
    fade(scene, skull, 450, { y: o.y - 42 });
  }
  motes(scene, o.x, o.y, 3);
}

/** Persistent, authored facing +x; the engine alone rotates/mirrors this root. */
export function bolt(scene: Phaser.Scene, o: VfxOptions, big = false): Phaser.GameObjects.Container {
  const c = root(scene, o);
  // Source head is on +x (bright core near column 47/62); align it with the collision origin.
  const body = sheet(scene, 'ss_fireball', -32, 0, { loop: true });
  c.add(body ?? image(scene, ST.bolt, -24, 0));
  if (big) {
    const sigil = sheet(scene, 'sf_ring', 10, 0, { loop: true, alpha: 0.8 }) ?? image(scene, ST.skull, 10, 0);
    c.add(sigil);
    loop(scene, c, { targets: sigil, alpha: 0.45, duration: 450, yoyo: true });
  }
  return c;
}

export function hex(scene: Phaser.Scene, o: VfxOptions): void {
  if (!sheet(scene, 'cm_midnight', o.x, o.y, { dur: 560 })) fallback(scene, ST.cloud, o.x, o.y, 560, 4);
  const skull = image(scene, ST.skull, o.x, o.y - 30);
  fade(scene, skull, 650, { y: o.y - 50 });
  motes(scene, o.x, o.y, 6, true);
}

export function buffCast(scene: Phaser.Scene, o: VfxOptions, veil = false): void {
  const y = o.y - 34;
  if (!sheet(scene, veil ? 'cm_vortex' : 'cm_shield', o.x, y, { dur: 650 })) {
    fallback(scene, ST.ring, o.x, y, 650, 4);
  }
  motes(scene, o.x, o.y - 10, 6, true);
}

/** Persistent feet-origin aura; only children bob, leaving the engine's transform intact. */
export function aura(scene: Phaser.Scene, o: VfxOptions, veil = false): Phaser.GameObjects.Container {
  const c = root(scene, o);
  const ring = image(scene, ST.ring, 0, -2).setAlpha(0.7);
  c.add(ring);
  const ward = sheet(scene, veil ? 'cm_vortex' : 'cm_shield', 0, -34, { loop: true, alpha: veil ? 0.35 : 0.45, fps: 10 })
    ?? image(scene, ST.skull, 0, -42).setAlpha(0.6);
  c.add(ward);
  loop(scene, c, { targets: ward, alpha: veil ? 0.55 : 0.7, y: -38, duration: 1100, yoyo: true });
  loop(scene, c, { targets: ring, alpha: 0.35, duration: 800, yoyo: true });
  return c;
}

/** Beam segments keep native pixels; never stretch a sheet to the whole range. */
export function beam(scene: Phaser.Scene, o: VfxOptions, drain = false): void {
  const dx = (o.targetX ?? o.x + o.facing * 350) - o.x, dy = (o.targetY ?? o.y) - o.y;
  const length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
  const n = Math.max(1, Math.ceil(length / 90));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = o.x + dx * t, y = o.y + dy * t;
    const sp = sheet(scene, 'ss_icespear', x, y, { dur: drain ? 420 : 360, rot: angle, flipY: dx < 0 });
    if (!sp) {
      const im = image(scene, ST.bolt, x, y).setRotation(angle);
      fade(scene, im, 380);
    }
    if (drain) {
      // Visible soul fragments flow back toward the caster (positions, never changing pixel size).
      const soul = image(scene, ST.mote, x, y, 2);
      fade(scene, soul, 450, { x: o.x, y: o.y });
    }
  }
}

export function heal(scene: Phaser.Scene, o: VfxOptions): void {
  if (!sheet(scene, 'sf_heal', o.x, o.y - 32, { dur: 520 })) {
    const skull = image(scene, ST.skull, o.x, o.y - 32);
    fade(scene, skull, 520, { y: o.y - 58 });
  }
  motes(scene, o.x, o.y - 16, 5, true);
}

/** The visual lasts through all three lines: damage occurs at 240/740/1240ms. */
export function plague(scene: Phaser.Scene, o: VfxOptions): void {
  const w = o.w ?? 280;
  const c = root(scene, o);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * Math.min(90, w / 3);
    const sp = sheet(scene, 'cm_nebula', x, i % 2 ? -8 : 8, { loop: true, alpha: 0.65, fps: 12 })
      ?? image(scene, ST.cloud, x, 0).setAlpha(0.8);
    c.add(sp);
  }
  fade(scene, c, 350, {}, 1200);
  motes(scene, o.x, o.y, 6, true);
}

export function arc(scene: Phaser.Scene, o: VfxOptions, scythe = false): void {
  const n = scythe ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const x = o.x + o.facing * (i - (n - 1) / 2) * 90;
    const sp = sheet(scene, 'sf_slash', x, o.y, { scale: scythe ? 4 : 2, dur: 380, flipX: o.facing < 0 });
    if (!sp) {
      const slash = image(scene, ST.slash, x, o.y).setFlipX(o.facing < 0);
      fade(scene, slash, 380);
    }
  }
  if (scythe) {
    const blade = image(scene, ST.scythe, o.x - o.facing * 40, o.y + 16).setFlipX(o.facing < 0);
    blade.setRotation(-o.facing * 0.8);
    fade(scene, blade, 380, { x: o.x + o.facing * 80, rotation: o.facing * 0.6, y: o.y - 20 });
  }
}

export function summon(scene: Phaser.Scene, o: VfxOptions, lich = false): Phaser.GameObjects.Container {
  const c = root(scene, o).setDepth(DEPTH.SUMMON);
  if (lich) {
    const halo = sheet(scene, 'cm_vortex', 0, 0, { loop: true, alpha: 0.4, fps: 12 }) ?? image(scene, ST.ring, 0, 20);
    c.add(halo);
  }
  const body = image(scene, lich ? ST.lich : ST.skeleton, 0, lich ? 0 : -6);
  c.add(body);
  // Pixel-grid bobbing via stepped easing, no root transform/scale animation.
  loop(scene, c, { targets: body, y: body.y - (lich ? 4 : 2), duration: lich ? 950 : 700, yoyo: true, ease: 'Stepped', easeParams: [2] });
  return c;
}

export function tideCast(scene: Phaser.Scene, o: VfxOptions): void {
  cast(scene, o);
  // A short opening over the caster; the actual wide rain is engine-controlled by area.offsetX.
  if (!sheet(scene, 'cm_vortex', o.x, o.y - 90, { scale: 4, dur: 850 })) {
    fallback(scene, ST.ring, o.x, o.y - 90, 850, 4);
  }
}

export function tideProjectile(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o);
  // Shaft trails to -x; the engine turns +x down for rain. Root scaleY is never tweened.
  const blade = image(scene, ST.scythe, -38, 0);
  c.add(blade);
  const tail = sheet(scene, 'sf_ring', -24, 0, { loop: true, alpha: 0.65 }) ?? image(scene, ST.mote, -24, 0);
  c.add(tail);
  loop(scene, c, { targets: tail, alpha: 0.3, duration: 180, yoyo: true });
  return c;
}

export function tideImpact(scene: Phaser.Scene, o: VfxOptions): void {
  // Rain passes ground coordinates; anchor art above the ground to match its damage rectangle.
  const y = o.y - Math.min(o.h ?? 160, 160) / 2;
  if (!sheet(scene, 'cm_midnight', o.x, y, { dur: 480 })) fallback(scene, ST.cloud, o.x, y, 480, 4);
  if (!sheet(scene, 'cm_nebula', o.x, y, { dur: 540, alpha: 0.6 })) fallback(scene, ST.slash, o.x, y, 500);
  const ring = image(scene, ST.ring, o.x, o.y - 4);
  fade(scene, ring, 400);
  motes(scene, o.x, o.y - 12, 6, true);
}
