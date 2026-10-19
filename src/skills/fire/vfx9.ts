// OWNER: A3 (fire-tree). Phase 9 fire VFX (Cinder Mine, Flamethrower, Kindling Brand, Flashover, Backdraft, Vent Heat,
// Last Ember, Wandering Sun). Pixel sheets first (fire sheets in ./sheets.ts + the shared CC0 kit, always integer ×2/×4),
// procedural fallback when a sheet is missing. Registered through fireVfx.ts's lazyRegister so first play builds textures.
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import { pxFx, pxLoop } from '../../art/particles';
import type { VfxFn, VfxOptions } from '../../core/types';
import { FT } from './textures';
import { fpx, fpxLoop } from './sheets';
import { ALIGN, C, FIRE_TINTS, HOT_TINTS, NORMAL, attachTrail, burst, flare, flash, img, loop, shake, shock, stream, tongue, zone } from './fx';

/** Shared fire sub-effects owned by fireVfx.ts, passed in to avoid an import cycle. */
export interface FireKit {
  sparks(scene: Phaser.Scene, x: number, y: number, n: number, speed: number, grav?: number): void;
  embers(scene: Phaser.Scene, x: number, y: number, n: number, speed: number, up?: number): void;
  smokePuff(scene: Phaser.Scene, x: number, y: number, n: number, size?: number): void;
  hitFx(scene: Phaser.Scene, x: number, y: number, s?: number): void;
  castFx(scene: Phaser.Scene, o: VfxOptions, s?: number): void;
  explosion(scene: Phaser.Scene, x: number, y: number, w: number, h: number, power?: number, shk?: boolean): void;
  groundBelow(x: number, y: number, fallback: number, maxDown?: number): number;
  implode(scene: Phaser.Scene, x: number, y: number, rw: number, rh: number, n: number, life?: number): void;
  scorchMark(scene: Phaser.Scene, x: number, gy: number, w: number, hold?: number): void;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const sideAngle = (f: 1 | -1, spread: number) => (f > 0 ? { min: -spread, max: spread } : { min: 180 - spread, max: 180 + spread });
const live = (scene: Phaser.Scene) => !!scene.sys && scene.sys.isActive();

export function registerFirePhase9Vfx(reg: (key: string, fn: VfxFn) => void, k: FireKit): void {
  // ───────────────────────── Cinder Mine ─────────────────────────

  const mineCast: VfxFn = (scene, o) => {
    k.castFx(scene, o, 0.8);
    const tx = o.targetX ?? o.x + o.facing * 20, ty = o.targetY ?? o.y + 34;
    const m = fpx(scene, 'mine', o.x, o.y, { scale: 2, oy: 1, loop: true, depth: DEPTH.VFX });
    if (!m) return;
    m.anims.pause(m.anims.currentAnim?.frames[2]);
    const x0 = o.x, y0 = o.y;
    scene.tweens.addCounter({
      from: 0, to: 1, duration: 200, ease: 'Linear',
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        if (m.scene) m.setPosition(Math.round(x0 + (tx - x0) * v), Math.round(y0 + (ty - y0) * v - Math.sin(v * Math.PI) * 26));
      },
      onComplete: () => { if (m.scene) m.destroy(); },
    });
  };

  const mineBody: VfxFn = (scene, o) => {
    const c = scene.add.container(o.x, o.y).setDepth(DEPTH.MONSTER - 1);
    const glow = img(scene, FT.glow, 0, -3, { tint: C.red, sx: 0.42, sy: 0.12, alpha: 0.5 });
    c.add(glow);
    const m = fpxLoop(scene, c, 'mine', 0, 1, { scale: 2, oy: 1 });
    if (m) {
      // dull and still until armed, then the core blinks
      m.anims.pause(m.anims.currentAnim?.frames[2]);
      scene.time.delayedCall(500, () => { if (m.scene) m.anims.resume(); });
    } else {
      const g = scene.add.graphics();
      g.fillStyle(0x2a0804, 1); g.fillRect(-14, -8, 28, 8);
      g.fillStyle(C.orange, 1); g.fillRect(-4, -8, 8, 4);
      c.add(g);
    }
    loop(scene, c, { targets: glow, alpha: 0.15, duration: 420, yoyo: true, ease: 'Stepped', easeParams: [3] });
    attachTrail(scene, c, FT.ember, 700, {
      speedY: { min: -50, max: -20 }, speedX: { min: -8, max: 8 }, lifespan: { min: 400, max: 700 }, scale: { start: 0.8, end: 0.3 },
      alpha: { start: 0.9, end: 0 }, tint: FIRE_TINTS, frequency: 260, quantity: 1,
      emitZone: zone(new Phaser.Geom.Rectangle(-8, -12, 16, 4)),
    });
    return c;
  };

  const mineArm: VfxFn = (scene, o) => {
    shock(scene, o.x, o.y - 2, C.orange, 90, 300, 0.3, 0.9);
    flash(scene, o.x, o.y - 8, C.yellow, 40, 160, 0.8);
    burst(scene, o.x, o.y - 10, FT.spark, 5, 400, {
      speed: { min: 80, max: 160 }, angle: { min: 240, max: 300 }, lifespan: { min: 180, max: 300 }, gravityY: 300,
      scale: { start: 0.8, end: 0.3 }, alpha: { start: 1, end: 0 }, tint: HOT_TINTS, rotate: ALIGN,
    });
  };

  const mineBlast: VfxFn = (scene, o) => {
    const w = o.w ?? 190, h = o.h ?? 130;
    const x = o.x, gy = o.groundY ?? o.y + h / 2;
    flash(scene, x, gy - 30, C.white, 90, 160, 1);
    const ground = pxFx(scene, 'ex3', x, gy + 4, { scale: 2, oy: 1, dur: 520, depth: DEPTH.VFX });
    const col = pxFx(scene, 'cm_fire', x, gy + 6, { scale: 2, oy: 1, dur: 560, depth: DEPTH.VFX_TOP });
    if (ground || col) {
      pxFx(scene, 'g9_firebomb', x, gy + 4, { scale: 2, oy: 0.85, delay: 40, depth: DEPTH.VFX_TOP });
      pxFx(scene, 'cm_brightfire', x - w * 0.32, gy + 4, { scale: 2, oy: 1, delay: 60, dur: 520 });
      pxFx(scene, 'cm_brightfire', x + w * 0.32, gy + 4, { scale: 2, oy: 1, delay: 90, dur: 520, flipX: true });
    } else {
      k.explosion(scene, x, gy - h * 0.4, w, h, 0.9, false);
    }
    shock(scene, x, gy - 2, C.orange, w * 1.2, 380, 0.3);
    burst(scene, x, gy - 6, FT.rock, 5, 800, {
      speed: { min: 160, max: 360 }, angle: { min: 225, max: 315 }, gravityY: 820, lifespan: { min: 450, max: 800 },
      scale: { start: 0.4, end: 0.2 }, alpha: { start: 1, end: 0 }, rotate: { min: 0, max: 360 }, blendMode: NORMAL,
    });
    k.sparks(scene, x, gy - 30, 9, 320, 380);
    k.smokePuff(scene, x, gy - 14, 2, 0.9);
    k.scorchMark(scene, x, gy, w * 0.8, 500);
    shake(scene, 110, 0.004);
  };

  const mineFizzle: VfxFn = (scene, o) => {
    k.smokePuff(scene, o.x, o.y - 8, 2, 0.6);
    burst(scene, o.x, o.y - 6, FT.ember, 4, 600, {
      speed: { min: 10, max: 40 }, angle: { min: 240, max: 300 }, gravityY: -20, lifespan: { min: 300, max: 600 },
      scale: { start: 0.7, end: 0.2 }, alpha: { start: 0.8, end: 0 }, tint: [C.red, C.deep],
    });
  };

  // ───────────────────────── Flamethrower ─────────────────────────

  const flamethrowerCast: VfxFn = (scene, o) => {
    k.castFx(scene, o, 1);
    flash(scene, o.x + o.facing * 6, o.y, C.yellow, 50, 900, 0.5);
  };

  const flamethrower: VfxFn = (scene, o) => {
    const w = o.w ?? 210, h = o.h ?? 90;
    const f = o.facing;
    const nx = o.x - f * (w / 2 - 6);               // nozzle (staff tip)
    let sprites = 0;
    for (let i = 0; i < 3; i++) {
      const y0 = o.y + rnd(-6, 6);
      const s = fpx(scene, 'jet', nx + f * 8, y0, { scale: 2, flipX: f < 0, dur: 300, delay: i * 45, depth: i === 1 ? DEPTH.VFX_TOP : DEPTH.VFX });
      if (!s) continue;
      sprites++;
      scene.tweens.add({ targets: s, x: nx + f * w * rnd(0.72, 0.92), y: y0 - rnd(4, 16), duration: 280, delay: i * 45, ease: 'Quad.easeOut' });
    }
    if (!sprites) {
      for (let i = 0; i < 4; i++) tongue(scene, nx + f * (w * (0.2 + i * 0.22)), o.y + h * 0.3, FIRE_TINTS[i % 3], 22, h * 0.8, i * 20, 260);
    }
    burst(scene, nx, o.y, FT.flame, 5, 320, {
      speed: { min: 300, max: 470 }, angle: sideAngle(f, 9), lifespan: { min: 200, max: 320 },
      scale: { start: 0.25, end: 0.6 }, alpha: { start: 0.85, end: 0 }, tint: FIRE_TINTS,
      rotate: { onUpdate: (p) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) + 90 },
    });
    burst(scene, nx, o.y, FT.ember, 3, 500, {
      speed: { min: 120, max: 260 }, angle: sideAngle(f, 16), lifespan: { min: 300, max: 500 }, gravityY: -60,
      scale: { start: 0.9, end: 0.3 }, alpha: { start: 1, end: 0 }, tint: HOT_TINTS,
    });
    flash(scene, nx, o.y, C.orange, 36, 120, 0.7);
  };

  const jetHit: VfxFn = (scene, o) => {
    if (!pxFx(scene, 'ex1', o.x + rnd(-6, 6), o.y + rnd(-6, 6), { scale: 2, dur: 240, depth: DEPTH.VFX_TOP })) flash(scene, o.x, o.y, C.orange, 40, 140, 0.8);
    k.sparks(scene, o.x, o.y, 2, 140, 260);
  };

  // ───────────────────────── Kindling Brand ─────────────────────────

  const brandArea: VfxFn = (scene, o) => {
    const { x, y } = o;
    const lash = pxFx(scene, 'cm_flamelash', x, y, { scale: 2, flipX: o.facing < 0, delay: 80, dur: 360, depth: DEPTH.VFX_TOP });
    if (!fpx(scene, 'pop', x, y, { scale: 2, add: true, delay: 100, dur: 300, depth: DEPTH.VFX_TOP }) && !lash) {
      flash(scene, x, y, C.orange, 90, 240, 0.9);
    }
    const r = img(scene, FT.ring, x, y, { tint: C.yellow, alpha: 0.8, scale: 1.0, depth: DEPTH.VFX_TOP });
    scene.tweens.add({ targets: r, scale: 0.15, alpha: 1, duration: 140, ease: 'Cubic.easeIn', onComplete: () => { if (r.scene) r.destroy(); } });
    k.sparks(scene, x, y, 4, 200, 240);
  };

  const brandMark: VfxFn = (scene, o) => {
    const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX_TOP);
    const glow = img(scene, FT.glow, 0, 0, { tint: C.orange, scale: 0.28, alpha: 0.45 });
    c.add(glow);
    if (!fpxLoop(scene, c, 'brand', 0, 0, { scale: 2 })) {
      c.add(img(scene, FT.star, 0, 0, { tint: C.orange, scale: 0.4 }));
    }
    loop(scene, c, { targets: glow, alpha: 0.15, duration: 360, yoyo: true, ease: 'Stepped', easeParams: [3] });
    // appear with a short pixel drop
    c.setAlpha(0);
    c.y -= 8;
    scene.tweens.add({ targets: c, alpha: 1, duration: 120, ease: 'Stepped', easeParams: [3] });
    attachTrail(scene, c, FT.ember, 600, {
      speedY: { min: 20, max: 50 }, speedX: { min: -10, max: 10 }, lifespan: { min: 300, max: 600 }, scale: { start: 0.7, end: 0.2 },
      alpha: { start: 0.9, end: 0 }, tint: FIRE_TINTS, frequency: 220, quantity: 1,
    });
    return c;
  };

  const brandBurst: VfxFn = (scene, o) => {
    const w = o.w ?? 180, h = o.h ?? 140;
    const { x, y } = o;
    const gy = o.groundY ?? y + h / 2;
    const ring = fpx(scene, 'pop', x, y, { scale: 4, add: true, dur: 360, depth: DEPTH.VFX_TOP });
    const ex = pxFx(scene, 'ex2', x, y, { scale: 2, depth: DEPTH.VFX_TOP });
    if (!ring && !ex) k.explosion(scene, x, y, w, h, 0.8, false);
    for (const d of [-0.38, -0.14, 0.14, 0.38]) {
      pxFx(scene, 'cm_brightfire', x + d * w, gy + 4, { scale: 2, oy: 1, flipX: d < 0, delay: 40 + Math.abs(d) * 160, dur: 480 });
    }
    shock(scene, x, gy - 2, C.orange, w * 1.2, 360, 0.3);
    k.sparks(scene, x, y, 8, 300, 300);
    k.embers(scene, x, y, 6, 140);
    shake(scene, 90, 0.003);
  };

  // ───────────────────────── Flashover ─────────────────────────

  const flashoverCast: VfxFn = (scene, o) => {
    k.castFx(scene, o, 1.2);
    flare(scene, o.x + o.facing * 6, o.y, C.yellow, 70, 260);
  };

  const flashoverStrike: VfxFn = (scene, o) => {
    const { x, y } = o;
    if (!pxFx(scene, 'cm_flamelash', x, y, { scale: 2, flipX: o.facing < 0, delay: 100, dur: 380, depth: DEPTH.VFX_TOP })) {
      tongue(scene, x, y + 40, C.orange, 40, 100, 100, 380);
    }
    pxFx(scene, 'ex1', x, y, { scale: 2, delay: 120, depth: DEPTH.VFX_TOP });
    flash(scene, x, y, C.orange, 80, 220, 0.7);
  };

  /** A fireball that hops along an arc from (x, y) to (targetX, targetY), igniting where it lands. */
  const flashoverLeap: VfxFn = (scene, o) => {
    const x0 = o.x, y0 = o.y;
    const x1 = o.targetX ?? x0 + o.facing * 120, y1 = o.targetY ?? y0;
    const lift = Math.min(70, 20 + Math.abs(x1 - x0) * 0.25);
    const c = scene.add.container(x0, y0).setDepth(DEPTH.VFX_TOP);
    if (!pxLoop(scene, c, 'sf_fireball', 0, 0, { scale: 2 })) c.add(img(scene, FT.soft, 0, 0, { tint: C.orange, scale: 0.4 }));
    attachTrail(scene, c, FT.ember, 400, {
      speed: { min: 5, max: 30 }, lifespan: { min: 220, max: 400 }, scale: { start: 0.9, end: 0.3 },
      alpha: { start: 1, end: 0 }, frequency: 25, quantity: 1, tint: FIRE_TINTS,
    });
    const at = (v: number) => ({ x: x0 + (x1 - x0) * v, y: y0 + (y1 - y0) * v - Math.sin(v * Math.PI) * lift });
    scene.tweens.addCounter({
      from: 0, to: 1, duration: 200, ease: 'Linear',
      onUpdate: (t) => {
        if (!c.scene) return;
        const v = t.getValue() ?? 0;
        const p = at(v), q = at(Math.min(1, v + 0.05));
        c.setPosition(Math.round(p.x), Math.round(p.y));
        c.setRotation(Math.atan2(q.y - p.y, q.x - p.x));
      },
      onComplete: () => {
        if (c.scene) c.destroy();
        if (!live(scene)) return;
        if (!fpx(scene, 'pop', x1, y1, { scale: 2, add: true, dur: 280, depth: DEPTH.VFX_TOP })) flash(scene, x1, y1, C.yellow, 60, 200, 0.9);
        k.sparks(scene, x1, y1, 3, 180, 240);
      },
    });
  };

  const flashoverSpread: VfxFn = (scene, o) => {
    const w = o.w ?? 320, h = o.h ?? 180;
    const { x, y } = o;
    const gy = o.groundY ?? y + h / 2;
    if (!pxFx(scene, 'cm_ring', x, y, { v: 'fire', scale: 4, add: true, delay: 120, depth: DEPTH.VFX_TOP })) {
      shock(scene, x, y, C.yellow, w * 0.8, 360, 0.6, 0.9, 120);
    }
    fpx(scene, 'pop', x, y, { scale: 4, add: true, delay: 140, dur: 320, depth: DEPTH.VFX_TOP });
    shock(scene, x, gy - 2, C.orange, w * 1.15, 460, 0.3, 0.9, 140);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const fx = x - w * 0.45 + (w * 0.9 * i) / (n - 1);
      if (!pxFx(scene, 'cm_brightfire', fx, gy + 4, { scale: 2, oy: 1, flipX: i % 2 === 1, delay: 160 + Math.abs(i - (n - 1) / 2) * 40, dur: 520 })) {
        tongue(scene, fx, gy, FIRE_TINTS[i % 3], 24, 60, 160 + i * 20, 440);
      }
    }
    k.sparks(scene, x, y, 10, 360, 260);
    scene.time.delayedCall(160, () => shake(scene, 120, 0.004));
  };

  // ───────────────────────── Backdraft ─────────────────────────

  const backdraftArea: VfxFn = (scene, o) => {
    const w = o.w ?? 200, h = o.h ?? 120;
    const f = o.facing;
    const gy = o.groundY ?? o.y + 34;
    const sx = o.x - f * w * 0.5;
    flash(scene, sx, o.y, C.white, 90, 160, 1);
    let sprites = 0;
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.5) / 4;
      if (pxFx(scene, i % 2 ? 'ex6' : 'ex2', sx + f * w * t, o.y + rnd(-h * 0.15, h * 0.1), { scale: 2, delay: i * 40, depth: DEPTH.VFX_TOP })) sprites++;
    }
    pxFx(scene, 'cm_flamelash', o.x + f * w * 0.36, o.y, { scale: 2, flipX: f < 0, delay: 110, dur: 380, depth: DEPTH.VFX_TOP });
    pxFx(scene, 'ex3', o.x, gy + 4, { scale: 2, oy: 1, dur: 480, flipX: f < 0, depth: DEPTH.VFX });
    if (!sprites) k.explosion(scene, o.x, o.y, w, h, 1, false);
    burst(scene, sx, o.y, FT.flame, 10, 360, {
      speed: { min: 320, max: 520 }, angle: sideAngle(f, 18), lifespan: { min: 220, max: 360 },
      scale: { start: 0.35, end: 0.8 }, alpha: { start: 0.9, end: 0 }, tint: FIRE_TINTS,
      rotate: { onUpdate: (p) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) + 90 },
    });
    shock(scene, o.x, gy - 2, C.orange, w * 1.3, 380, 0.3);
    k.sparks(scene, o.x + f * w * 0.2, o.y, 10, 380, 260);
    shake(scene, 140, 0.006);
  };

  const backdraftOut: VfxFn = (scene, o) => {
    const { x, y, facing: f } = o;
    if (!pxFx(scene, 'sf_boom', x + f * 10, y - 30, { scale: 2, dur: 240, add: true, depth: DEPTH.VFX_TOP })) flash(scene, x, y - 30, C.orange, 70, 200, 0.9);
    k.smokePuff(scene, x, y - 20, 3, 1);
    burst(scene, x, y - 30, FT.ember, 10, 600, {
      speed: { min: 80, max: 220 }, angle: sideAngle((-f) as 1 | -1, 30), lifespan: { min: 300, max: 600 },
      scale: { start: 1, end: 0.3 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS,
    });
  };

  const backdraftIn: VfxFn = (scene, o) => {
    const { x, y, facing: f } = o;
    const ox = o.targetX ?? x + f * 150;
    const len = Math.abs(ox - x);
    // skid: a scorched streak and dragged flames between the take-off point and the landing
    if (len > 20) {
      k.scorchMark(scene, (x + ox) / 2, y, len, 350);
      for (let i = 0; i < 3; i++) {
        pxFx(scene, 'sf_flame_s', x + (ox - x) * (0.2 + i * 0.3), y + 2, { scale: 2, oy: 1, delay: i * 40, fps: 10, depth: DEPTH.VFX });
      }
    }
    burst(scene, x, y - 4, FT.smoke, 4, 800, {
      speed: { min: 30, max: 90 }, angle: sideAngle(f, 25), gravityY: -30, blendMode: NORMAL,
      lifespan: { min: 500, max: 800 }, scale: { start: 0.3, end: 0.8 }, alpha: { start: 0.35, end: 0 }, tint: C.smoke,
    }, DEPTH.VFX - 1);
    shock(scene, x, y - 2, C.orange, 80, 260, 0.3);
  };

  // ───────────────────────── Vent Heat ─────────────────────────

  const ventSelf: VfxFn = (scene, o) => {
    const { x, y } = o;
    const pw = Phaser.Math.Clamp(o.scale ?? 1, 0.5, 2.5);
    const big = pw >= 1.3;
    if (!fpx(scene, 'whirl', x, y + 4, { scale: big ? 4 : 2, oy: 1, dur: 520, depth: DEPTH.VFX_TOP })) {
      tongue(scene, x, y, C.orange, 40 * pw, 90 * pw, 0, 500, DEPTH.VFX_TOP);
    }
    flash(scene, x, y - 34, big ? C.white : C.orange, 70 * pw, 260, 0.8);
    // steam columns venting off the body (more and taller with a hotter buff)
    burst(scene, x, y - 30, FT.smoke, Math.round(4 + 4 * pw), 1100, {
      speed: { min: 50, max: 90 + 60 * pw }, angle: { min: 250, max: 290 }, gravityY: -60, blendMode: NORMAL,
      lifespan: { min: 700, max: 1100 }, scale: { start: 0.3, end: 1.0 }, alpha: { start: 0.4, end: 0 }, tint: 0x8a6458,
      emitZone: zone(new Phaser.Geom.Rectangle(-16, -24, 32, 40)),
    }, DEPTH.VFX - 1);
    for (let i = 0; i < Math.round(2 + pw * 2); i++) fpx(scene, 'mote', x + rnd(-26, 26), y - rnd(14, 70), { scale: 2, delay: i * 50, depth: DEPTH.VFX_TOP });
    if (pw >= 1.8) try { scene.cameras.main.flash(90, 255, 200, 140); } catch { /* ignore */ }
  };

  const ventArea: VfxFn = (scene, o) => {
    const w = o.w ?? 360, h = o.h ?? 200;
    const { x, y } = o;
    const gy = o.groundY ?? y + h / 2;
    scene.time.delayedCall(200, () => {
      if (!live(scene)) return;
      const ring = pxFx(scene, 'cm_ring', x, gy - 40, { v: 'fire', scale: 4, add: true, depth: DEPTH.VFX_TOP });
      const l = pxFx(scene, 'ex3', x - w * 0.26, gy + 4, { scale: 2, oy: 1, dur: 520, depth: DEPTH.VFX });
      pxFx(scene, 'ex3', x + w * 0.26, gy + 4, { scale: 2, oy: 1, dur: 520, flipX: true, depth: DEPTH.VFX });
      pxFx(scene, 'ex2', x, gy - 40, { scale: 2, depth: DEPTH.VFX_TOP });
      if (!ring && !l) k.explosion(scene, x, y, w, h, 1.4, false);
      shock(scene, x, gy - 2, C.white, w * 0.9, 380, 0.3);
      shock(scene, x, gy - 2, C.orange, w * 1.25, 520, 0.3, 0.9, 60);
      k.sparks(scene, x, gy - 40, 14, 460, 300);
      k.embers(scene, x, gy - 40, 10, 200);
      k.scorchMark(scene, x, gy, w * 0.8, 600);
      shake(scene, 200, 0.007);
    });
  };

  // ───────────────────────── Last Ember ─────────────────────────

  const lastEmberCharge: VfxFn = (scene, o) => {
    const { x, y } = o;
    const m = Phaser.Math.Clamp(o.scale ?? 1, 1, 2.5);
    if (!fpx(scene, 'star', x, y - 4, { scale: 2, add: m >= 1.8, dur: 460, depth: DEPTH.VFX_TOP })) flash(scene, x, y, C.orange, 60 * m, 400, 0.9);
    k.implode(scene, x, y, 90 + 40 * m, 70 + 30 * m, Math.round(6 + 8 * (m - 1)), 260);
    flash(scene, x, y, m >= 2 ? C.white : C.red, 40 * m, 420, 0.7);
    if (m >= 2) flare(scene, x, y, C.white, 90, 420);
  };

  const lastEmberArea: VfxFn = (scene, o) => {
    const w = o.w ?? 130, h = o.h ?? 170;
    const { x, y } = o;
    const gy = o.groundY ?? k.groundBelow(x, y, y + h / 2);
    const bolt = fpx(scene, 'bolt', x, gy + 6, { scale: 2, oy: 1, dur: 620, depth: DEPTH.VFX_TOP });
    if (!bolt) {
      const col = img(scene, FT.beam, x, gy - 420, { tint: C.yellow, origin: [0, 0.5], rot: Math.PI / 2, alpha: 0.95, depth: DEPTH.VFX_TOP });
      col.setScale(0.05, 0.4);
      scene.tweens.add({ targets: col, scaleX: 420 / 128, duration: 260, ease: 'Cubic.easeIn' });
      scene.tweens.add({ targets: col, alpha: 0, duration: 260, delay: 300, onComplete: () => { if (col.scene) col.destroy(); } });
    }
    scene.time.delayedCall(290, () => {
      if (!live(scene)) return;
      pxFx(scene, 'ex2', x, y, { scale: 2, depth: DEPTH.VFX_TOP });
      flash(scene, x, y, C.white, w * 1.2, 220, 1);
      shock(scene, x, gy - 2, C.orange, w * 1.6, 420, 0.3);
      k.sparks(scene, x, y, 10, 380, 320);
      k.scorchMark(scene, x, gy, w, 600);
      shake(scene, 160, 0.006);
    });
  };

  // ───────────────────────── Wandering Sun ─────────────────────────

  const sunBody: VfxFn = (scene, o) => {
    const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
    const body = scene.add.container(0, 0);
    const corona = fpxLoop(scene, body, 'corona', 0, 0, { scale: 2, alpha: 0.6 });
    const core = pxLoop(scene, body, 'cm_sunburn', 0, 0, { scale: 2, randomStart: true });
    if (!core && !corona) {
      body.add(img(scene, FT.glow, 0, 0, { tint: C.orange, scale: 0.9, alpha: 0.8 }));
      body.add(img(scene, FT.soft, 0, 0, { tint: C.white, scale: 0.7 }));
    }
    c.add(body);
    c.setAlpha(0);
    scene.tweens.add({ targets: c, alpha: 1, duration: 200, ease: 'Stepped', easeParams: [4] });
    loop(scene, c, { targets: body, y: -4, duration: 520, yoyo: true, ease: 'Stepped', easeParams: [2] });
    attachTrail(scene, c, FT.ember, 900, {
      speed: { min: 10, max: 50 }, lifespan: { min: 500, max: 900 }, scale: { start: 1.1, end: 0.3 }, alpha: { start: 1, end: 0 },
      tint: FIRE_TINTS, gravityY: 120, frequency: 40, quantity: 1, emitZone: zone(new Phaser.Geom.Circle(0, 0, 34)),
    });
    return c;
  };

  const sunPulse: VfxFn = (scene, o) => {
    const { x, y } = o;
    flash(scene, x, y, C.orange, 120, 220, 0.35, DEPTH.VFX - 1);
    const gy = o.groundY;
    if (gy !== undefined && Math.abs(gy - y) < 220) {
      pxFx(scene, 'cm_brightfire', x + rnd(-50, 50), gy + 4, { scale: 2, oy: 1, dur: 460, flipX: Math.random() < 0.5 });
    }
    k.sparks(scene, x, y, 2, 160, 200);
  };

  const sunCollapse: VfxFn = (scene, o) => {
    const w = o.w ?? 300, h = o.h ?? 240;
    const { x, y } = o;
    const gy = o.groundY ?? y + h / 2;
    k.implode(scene, x, y, w * 0.9, h * 0.7, 16, 200);
    const r = img(scene, FT.ring, x, y, { tint: C.yellow, alpha: 0.9, scale: 2.2, depth: DEPTH.VFX_TOP });
    scene.tweens.add({ targets: r, scale: 0.1, duration: 190, ease: 'Cubic.easeIn', onComplete: () => { if (r.scene) r.destroy(); } });
    scene.time.delayedCall(190, () => {
      if (!live(scene)) return;
      const big = pxFx(scene, 'ex4', x, gy + 8, { scale: 2, oy: 1, depth: DEPTH.VFX_TOP });
      fpx(scene, 'nova', x, y, { scale: 2, add: true, dur: 460, depth: DEPTH.VFX_TOP });
      if (!big) k.explosion(scene, x, y, w, h, 1.6, false);
      for (let i = 0; i < 3; i++) pxFx(scene, 'ex6', x + rnd(-0.35, 0.35) * w, y + rnd(-0.3, 0.2) * h, { scale: 2, delay: 50 + i * 60, depth: DEPTH.VFX_TOP });
      shock(scene, x, gy - 2, C.white, w * 1.0, 420, 0.3);
      shock(scene, x, gy - 2, C.orange, w * 1.4, 600, 0.3, 0.9, 60);
      k.sparks(scene, x, y, 16, 460, 300);
      k.embers(scene, x, y, 10, 220);
      k.smokePuff(scene, x, gy - 30, 3, 1.3);
      k.scorchMark(scene, x, gy, w, 800);
      stream(scene, x, gy, FT.ember, 300, 700, {
        speedY: { min: -170, max: -80 }, speedX: { min: -40, max: 40 }, lifespan: { min: 400, max: 700 },
        scale: { start: 1, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 30, quantity: 1,
        emitZone: zone(new Phaser.Geom.Rectangle(-w * 0.3, -10, w * 0.6, 10)),
      });
      shake(scene, 240, 0.009);
    });
  };

  reg('fire_mine_cast', mineCast);
  reg('fire_mine', mineBody);
  reg('fire_mine_arm', mineArm);
  reg('fire_mine_blast', mineBlast);
  reg('fire_mine_fizzle', mineFizzle);
  reg('fire_flamethrower_cast', flamethrowerCast);
  reg('fire_flamethrower', flamethrower);
  reg('fire_jet_hit', jetHit);
  reg('fire_brand_area', brandArea);
  reg('fire_brand_mark', brandMark);
  reg('fire_brand_burst', brandBurst);
  reg('fire_flashover_cast', flashoverCast);
  reg('fire_flashover_strike', flashoverStrike);
  reg('fire_flashover_leap', flashoverLeap);
  reg('fire_flashover_spread', flashoverSpread);
  reg('fire_backdraft_area', backdraftArea);
  reg('fire_backdraft_out', backdraftOut);
  reg('fire_backdraft_in', backdraftIn);
  reg('fire_vent_self', ventSelf);
  reg('fire_vent_area', ventArea);
  reg('fire_last_ember_charge', lastEmberCharge);
  reg('fire_last_ember_area', lastEmberArea);
  reg('fire_sun', sunBody);
  reg('fire_sun_pulse', sunPulse);
  reg('fire_sun_collapse', sunCollapse);
}
