// OWNER: A3 (fire-tree). Year 5 "Fellowship" fire VFX (Solar Spear, Pyroclasm, Daybreak, Pyre Brazier, Cremation,
// Pyre Covenant, Comet Stride). Built by recolouring/combining the existing fire sheets (white-gold = "sun" family,
// bright orange = "eruption" family, grey ash = "cremation"); procedural fallback when a sheet is missing.
// Registered through fireVfx.ts's lazyRegister so first play builds the textures.
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import { pxFx, pxLoop } from '../../art/particles';
import type { VfxFn } from '../../core/types';
import { FT } from './textures';
import { fpx, fpxLoop } from './sheets';
import type { FireKit } from './vfx9';
import { C, FIRE_TINTS, HOT_TINTS, NORMAL, attachTrail, burst, flare, flash, img, loop, shake, shock, stream, tongue, zone } from './fx';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const sideAngle = (f: 1 | -1, spread: number) => (f > 0 ? { min: -spread, max: spread } : { min: 180 - spread, max: 180 + spread });
const live = (scene: Phaser.Scene) => !!scene.sys && scene.sys.isActive();
const SUN_TINT = 0xfff0a0;
const ASH = 0x6a5a52;

/** Tint a sprite if it exists (sheets can be missing). */
const tint = <T extends Phaser.GameObjects.Sprite | null>(s: T, c: number): T => { if (s) s.setTint(c); return s; };

export function registerFireYear5Vfx(reg: (key: string, fn: VfxFn) => void, k: FireKit): void {
  // ───────────────────────── Solar Spear ─────────────────────────

  const spearCast: VfxFn = (scene, o) => {
    k.castFx(scene, o, 1.5);
    flare(scene, o.x + o.facing * 8, o.y, C.white, 90, 360);
    k.implode(scene, o.x, o.y, 70, 60, 8, 240);
  };

  const spearArea: VfxFn = (scene, o) => {
    const w = o.w ?? 110, h = o.h ?? 210;
    const { x, y } = o;
    const gy = o.groundY ?? k.groundBelow(x, y, y + h / 2);
    // telegraph: a narrow gold ring on the ground, a thin line of light from above
    shock(scene, x, gy - 2, C.yellow, w * 1.1, 300, 0.3, 0.8);
    const line = img(scene, FT.beam, x, gy - 460, { tint: C.white, origin: [0, 0.5], rot: Math.PI / 2, alpha: 0.5, depth: DEPTH.VFX_TOP });
    line.setScale(0.04, 0.12);
    scene.tweens.add({ targets: line, scaleX: 470 / 128, duration: 220, ease: 'Cubic.easeIn' });
    scene.tweens.add({ targets: line, alpha: 0, duration: 200, delay: 260, onComplete: () => { if (line.scene) line.destroy(); } });
    scene.time.delayedCall(240, () => {
      if (!live(scene)) return;
      // the spear: dark-bolt sheet recoloured fire, doubled and tinted white-gold, stacked into a column
      const a = tint(fpx(scene, 'bolt', x, gy + 6, { scale: 2, oy: 1, dur: 520, depth: DEPTH.VFX_TOP }), SUN_TINT);
      const b = fpx(scene, 'bolt', x, gy - 110, { scale: 2, oy: 1, dur: 520, delay: 40, add: true, alpha: 0.8, depth: DEPTH.VFX_TOP });
      if (!a && !b) {
        const col = img(scene, FT.beam, x, gy - 420, { tint: C.white, origin: [0, 0.5], rot: Math.PI / 2, depth: DEPTH.VFX_TOP });
        col.setScale(0.1, 0.5);
        scene.tweens.add({ targets: col, scaleX: 420 / 128, alpha: 0, duration: 320, onComplete: () => { if (col.scene) col.destroy(); } });
      }
      fpx(scene, 'star', x, y, { scale: 2, add: true, dur: 380, depth: DEPTH.VFX_TOP });
      pxFx(scene, 'ex2', x, y, { scale: 2, delay: 60, depth: DEPTH.VFX_TOP });
      pxFx(scene, 'cm_flamelash', x, y, { scale: 2, delay: 120, dur: 380, depth: DEPTH.VFX_TOP });
      flash(scene, x, y, C.white, 150, 260, 1);
      shock(scene, x, gy - 2, C.white, w * 1.8, 380, 0.3);
      k.sparks(scene, x, y, 10, 360, 300);
      k.embers(scene, x, gy - 10, 6, 160);
      k.scorchMark(scene, x, gy, w * 1.1, 600);
      shake(scene, 140, 0.005);
    });
  };

  // ───────────────────────── Pyroclasm ─────────────────────────

  const pyroCast: VfxFn = (scene, o) => {
    k.castFx(scene, o, 1.3);
    const gx = o.x - o.facing * 18, gy = o.y + 34;
    shock(scene, gx, gy, C.red, 260, 520, 0.25, 0.9);
    // the ground rumbles and glows through its cracks before it erupts
    k.scorchMark(scene, gx, gy, 520, 600);
    stream(scene, gx, gy, FT.ember, 480, 700, {
      speedY: { min: -120, max: -40 }, speedX: { min: -30, max: 30 }, lifespan: { min: 400, max: 700 }, scale: { start: 0.9, end: 0.2 },
      alpha: { start: 1, end: 0 }, tint: [C.red, C.orange, C.yellow], frequency: 14, quantity: 1,
      emitZone: zone(new Phaser.Geom.Rectangle(-240, -4, 480, 6)),
    });
    shake(scene, 480, 0.003);
  };

  const pyroArea: VfxFn = (scene, o) => {
    const w = o.w ?? 660, h = o.h ?? 300;
    const { x, y } = o;
    const gy = o.groundY ?? y + h / 2;
    scene.time.delayedCall(470, () => {
      if (!live(scene)) return;
      const n = 9;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        const cx = x + t * w * 0.92;
        const d = Math.abs(t) * 260;               // erupts from the middle outward
        const big = i % 2 === 0;
        const col = pxFx(scene, 'cm_fire', cx, gy + 6, { scale: big ? 4 : 2, oy: 1, delay: d, dur: 640, flipX: i % 2 === 1, depth: DEPTH.VFX_TOP });
        pxFx(scene, 'ex3', cx, gy + 4, { scale: 2, oy: 1, delay: d, dur: 500, flipX: i % 2 === 1, depth: DEPTH.VFX });
        if (!col) tongue(scene, cx, gy, FIRE_TINTS[i % 3], 44, h * 0.9, d, 560, DEPTH.VFX_TOP);
        scene.time.delayedCall(d, () => {
          if (!live(scene)) return;
          burst(scene, cx, gy - 6, FT.rock, 3, 800, {
            speed: { min: 200, max: 420 }, angle: { min: 235, max: 305 }, gravityY: 860, lifespan: { min: 500, max: 850 },
            scale: { start: 0.45, end: 0.2 }, alpha: { start: 1, end: 0 }, rotate: { min: 0, max: 360 }, blendMode: NORMAL,
          });
          k.sparks(scene, cx, gy - 40, 3, 320, 360);
        });
      }
      flash(scene, x, gy - 40, C.white, w * 0.5, 220, 0.8);
      shock(scene, x, gy - 2, C.white, w * 0.8, 420, 0.25);
      shock(scene, x, gy - 2, C.orange, w * 1.15, 560, 0.25, 0.9, 80);
      k.smokePuff(scene, x, gy - 20, 4, 1.4);
      k.scorchMark(scene, x, gy, w * 0.9, 900);
      shake(scene, 320, 0.009);
    });
  };

  // ───────────────────────── Daybreak ─────────────────────────

  const daybreakCast: VfxFn = (scene, o) => {
    const { x, y } = o;
    const sx = x, sy = y - 150;
    k.castFx(scene, o, 1.6);
    k.implode(scene, sx, sy, 160, 120, 22, 700);
    // a second sun swells over the caster: recoloured corona + nebula, growing for the whole cast
    const sun = scene.add.container(sx, sy).setDepth(DEPTH.VFX_TOP).setScale(0.2).setAlpha(0);
    const corona = tint(fpxLoop(scene, sun, 'corona', 0, 0, { scale: 2, add: true }), SUN_TINT);
    const core = pxLoop(scene, sun, 'cm_sunburn', 0, 0, { scale: 4, randomStart: true });
    if (!corona && !core) {
      sun.add(img(scene, FT.glow, 0, 0, { tint: C.orange, scale: 1.2, alpha: 0.9 }));
      sun.add(img(scene, FT.soft, 0, 0, { tint: C.white, scale: 0.9 }));
    }
    scene.tweens.add({ targets: sun, scale: 1.6, alpha: 1, duration: 1000, ease: 'Cubic.easeIn' });
    loop(scene, sun, { targets: sun, angle: 360, duration: 4000 });
    scene.time.delayedCall(1100, () => { if (sun.scene) sun.destroy(); });
    const ring = img(scene, FT.ring, x, y + 34, { tint: C.yellow, alpha: 0.8, scale: 1.8, depth: DEPTH.VFX });
    scene.tweens.add({ targets: ring, scale: 0.2, alpha: 0, duration: 900, ease: 'Cubic.easeIn', onComplete: () => { if (ring.scene) ring.destroy(); } });
    stream(scene, x, y + 34, FT.ember, 900, 900, {
      speedY: { min: -260, max: -140 }, speedX: { min: -20, max: 20 }, lifespan: { min: 500, max: 900 }, scale: { start: 1, end: 0.3 },
      alpha: { start: 1, end: 0 }, tint: HOT_TINTS, frequency: 22, quantity: 1,
      emitZone: zone(new Phaser.Geom.Ellipse(0, 0, 90, 14)),
    });
    shake(scene, 900, 0.002);
  };

  const daybreakArea: VfxFn = (scene, o) => {
    const w = o.w ?? 960, h = o.h ?? 440;
    const { x, y } = o;
    const gy = o.groundY ?? y + h / 2;
    scene.time.delayedCall(1050, () => {
      if (!live(scene)) return;
      try { scene.cameras.main.flash(260, 255, 244, 208); } catch { /* ignore */ }
      fpx(scene, 'nova', x, y - 80, { scale: 4, add: true, dur: 700, depth: DEPTH.VFX_TOP });
      pxFx(scene, 'cm_ring', x, y - 60, { v: 'fire', scale: 4, add: true, depth: DEPTH.VFX_TOP });
      pxFx(scene, 'ex4', x, y - 40, { scale: 4, depth: DEPTH.VFX_TOP });
      shock(scene, x, gy - 2, C.white, w * 0.7, 520, 0.25);
      shock(scene, x, gy - 2, C.yellow, w * 1.1, 760, 0.25, 0.9, 80);
      shock(scene, x, gy - 2, C.orange, w * 1.5, 980, 0.25, 0.8, 160);
      // six waves, as the six damage lines: blasts sweep outward from the caster, left and right
      for (let wave = 0; wave < 6; wave++) {
        const t = (wave + 1) / 6;
        for (const dir of [-1, 1]) {
          const cx = x + dir * t * w * 0.46 + rnd(-24, 24);
          pxFx(scene, wave % 2 ? 'ex6' : 'ex2', cx, y + rnd(-h * 0.25, h * 0.15), { scale: 2, delay: wave * 110, depth: DEPTH.VFX_TOP });
          pxFx(scene, 'cm_fire', cx, gy + 6, { scale: wave % 2 ? 2 : 4, oy: 1, delay: wave * 110, dur: 560, flipX: dir < 0, depth: DEPTH.VFX });
          scene.time.delayedCall(wave * 110, () => { if (live(scene)) { flash(scene, cx, gy - 40, C.white, 120, 200, 0.7); k.sparks(scene, cx, gy - 50, 4, 340, 300); } });
        }
        scene.time.delayedCall(wave * 110, () => shake(scene, 120, 0.007));
      }
      k.embers(scene, x, y, 18, 320);
      k.smokePuff(scene, x, gy - 30, 5, 1.6);
      k.scorchMark(scene, x, gy, w * 0.8, 1200);
      shake(scene, 700, 0.011);
    });
  };

  // ───────────────────────── Pyre Brazier ─────────────────────────

  const brazierBody: VfxFn = (scene, o) => {
    const c = scene.add.container(o.x, o.y).setDepth(DEPTH.SUMMON);
    // erupts into place
    pxFx(scene, 'ex3', o.x, o.y + 4, { scale: 2, oy: 1, dur: 480, depth: DEPTH.VFX });
    shock(scene, o.x, o.y - 2, C.orange, 150, 360, 0.3);
    const glow = img(scene, FT.glow, 0, -34, { tint: C.orange, sx: 0.8, sy: 0.55, alpha: 0.5 });
    c.add(glow);
    // pixel pedestal + bowl (2px units, dark iron with gold rim)
    const g = scene.add.graphics();
    g.fillStyle(0x2a0804, 1); g.fillRect(-10, -4, 20, 4); g.fillRect(-4, -22, 8, 18); g.fillRect(-16, -30, 32, 8);
    g.fillStyle(0x5c1208, 1); g.fillRect(-8, -4, 16, 2); g.fillRect(-2, -20, 4, 16); g.fillRect(-14, -28, 28, 6);
    g.fillStyle(C.gold, 1); g.fillRect(-16, -30, 32, 2); g.fillRect(-16, -30, 2, 4); g.fillRect(14, -30, 2, 4);
    c.add(g);
    const flames = [
      fpxLoop(scene, c, 'brand', 0, -34, { scale: 4 }),
      pxLoop(scene, c, 'cm_fire', 0, -28, { scale: 2, oy: 1, randomStart: true }),
      pxLoop(scene, c, 'sf_flame', -10, -28, { scale: 2, oy: 1, randomStart: true }),
      pxLoop(scene, c, 'sf_flame', 10, -28, { scale: 2, oy: 1, randomStart: true, flipX: true }),
    ];
    if (!flames.some(Boolean)) {
      for (let i = 0; i < 3; i++) c.add(img(scene, FT.flame, -10 + i * 10, -28, { tint: FIRE_TINTS[i], origin: [0.5, 1], sx: 0.4, sy: 0.7 }));
    }
    loop(scene, c, { targets: glow, alpha: 0.2, duration: 400, yoyo: true, ease: 'Stepped', easeParams: [3] });
    attachTrail(scene, c, FT.ember, 900, {
      speedY: { min: -70, max: -30 }, speedX: { min: -14, max: 14 }, lifespan: { min: 600, max: 900 }, scale: { start: 0.9, end: 0.2 },
      alpha: { start: 1, end: 0 }, tint: FIRE_TINTS, frequency: 90, quantity: 1,
      emitZone: zone(new Phaser.Geom.Rectangle(-12, -40, 24, 8)),
    });
    return c;
  };

  const brazierPulse: VfxFn = (scene, o) => {
    const w = o.w ?? 270, h = o.h ?? 170;
    const gy = o.groundY ?? o.y + h / 2;
    shock(scene, o.x, gy - 2, C.orange, w * 1.0, 380, 0.25, 0.85);
    flash(scene, o.x, gy - 40, C.yellow, 80, 200, 0.6);
    for (let i = 0; i < 3; i++) {
      const fx = o.x + rnd(-w * 0.4, w * 0.4);
      if (!pxFx(scene, 'cm_brightfire', fx, gy + 4, { scale: 2, oy: 1, delay: i * 50, dur: 460, flipX: fx < o.x })) tongue(scene, fx, gy, FIRE_TINTS[i], 22, 60, i * 50, 400);
    }
    k.sparks(scene, o.x, gy - 40, 4, 220, 260);
  };

  // ───────────────────────── Cremation ─────────────────────────

  const cremationArea: VfxFn = (scene, o) => {
    const w = o.w ?? 160, h = o.h ?? 170;
    const { x, y } = o;
    const gy = o.groundY ?? k.groundBelow(x, y, y + h / 2);
    // embers are sucked in first (the burn being cashed)…
    k.implode(scene, x, y, w * 1.2, h * 0.8, 14, 220);
    scene.time.delayedCall(220, () => {
      if (!live(scene)) return;
      // …then a white fire-whirl takes the body and leaves ash
      tint(fpx(scene, 'whirl', x, gy + 4, { scale: 4, oy: 1, dur: 520, depth: DEPTH.VFX_TOP }), C.white);
      pxFx(scene, 'cm_firespin', x, y, { scale: 2, dur: 520, depth: DEPTH.VFX_TOP });
      pxFx(scene, 'ex6', x, y, { scale: 2, delay: 40, depth: DEPTH.VFX_TOP });
      pxFx(scene, 'cm_flamelash', x, y, { scale: 2, delay: 90, dur: 380, depth: DEPTH.VFX_TOP });
      flash(scene, x, y, C.white, w * 1.3, 260, 0.9);
      shock(scene, x, gy - 2, C.white, w * 1.4, 400, 0.3);
      burst(scene, x, y, FT.smoke, 10, 1100, {
        speed: { min: 30, max: 110 }, angle: { min: 230, max: 310 }, gravityY: 70, blendMode: NORMAL,
        lifespan: { min: 700, max: 1100 }, scale: { start: 0.25, end: 0.7 }, alpha: { start: 0.7, end: 0 }, tint: ASH,
      }, DEPTH.VFX_TOP);
      burst(scene, x, y, FT.ember, 12, 1000, {
        speed: { min: 40, max: 160 }, angle: { min: 0, max: 360 }, gravityY: 90, lifespan: { min: 600, max: 1000 },
        scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, tint: [C.white, ASH, C.orange],
      });
      k.scorchMark(scene, x, gy, w * 1.1, 800);
      shake(scene, 110, 0.004);
    });
  };

  // ───────────────────────── Pyre Covenant ─────────────────────────

  const covenantCast: VfxFn = (scene, o) => {
    const { x, y } = o;
    for (let i = 0; i < 3; i++) {
      const r = pxFx(scene, 'cm_ring', x, y - 20 - i * 30, { v: 'fire', scale: 2, add: true, delay: i * 100, depth: DEPTH.VFX_TOP });
      if (!r) {
        const rr = img(scene, FT.ring, x, y - 4, { tint: C.white, alpha: 0.9, scale: 0.2, depth: DEPTH.VFX_TOP });
        scene.tweens.add({ targets: rr, scale: 0.6, y: y - 4 - i * 26, alpha: 0, duration: 520, delay: i * 100, onComplete: () => { if (rr.scene) rr.destroy(); } });
      } else r.setTint(SUN_TINT);
    }
    tint(fpx(scene, 'star', x, y - 76, { scale: 2, add: true, dur: 700, depth: DEPTH.VFX_TOP }), SUN_TINT);
    tint(pxFx(scene, 'cm_firespin', x, y - 36, { scale: 2, dur: 640, delay: 120, depth: DEPTH.VFX_TOP }), SUN_TINT);
    flash(scene, x, y - 40, C.white, 140, 380, 0.8);
    burst(scene, x, y - 6, FT.ember, 18, 1200, {
      speed: { min: 40, max: 140 }, angle: { min: 245, max: 295 }, gravityY: -80, lifespan: { min: 700, max: 1200 },
      scale: { start: 1, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: HOT_TINTS, emitZone: zone(new Phaser.Geom.Circle(0, 0, 24)),
    });
    shake(scene, 120, 0.002);
  };

  const covenantAura: VfxFn = (scene, o) => {
    const c = scene.add.container(o.x, o.y).setDepth(DEPTH.PLAYER - 1);
    // a faint recoloured corona behind the body, and a crown of small flames orbiting above the head
    const back = tint(fpxLoop(scene, c, 'corona', 0, -36, { scale: 2, alpha: 0.32, add: true }), SUN_TINT);
    if (!back) c.add(img(scene, FT.glow, 0, -36, { tint: C.yellow, scale: 0.7, alpha: 0.3 }));
    const flames: Phaser.GameObjects.Components.Transform[] = [];
    for (let i = 0; i < 4; i++) {
      const f = pxFx(scene, 'sf_flame_s', 0, 0, { scale: 2, oy: 1, loop: true, randomStart: true })
        ?? img(scene, FT.flame, 0, 0, { tint: C.yellow, origin: [0.5, 1], scale: 0.3 });
      (f as unknown as Phaser.GameObjects.Sprite).setTint?.(SUN_TINT);
      flames.push(f);
      c.add(f);
    }
    const tw = scene.tweens.addCounter({
      from: 0, to: Math.PI * 2, duration: 2400, repeat: -1,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        flames.forEach((f, i) => {
          const a = v + (i / flames.length) * Math.PI * 2;
          f.x = Math.round(Math.cos(a) * 20); f.y = Math.round(-74 + Math.sin(a) * 5);
          (f as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(Math.sin(a) > 0 ? 1 : 0.5);
        });
      },
    });
    c.once(Phaser.GameObjects.Events.DESTROY, () => tw.stop());
    attachTrail(scene, c, FT.ember, 1000, {
      speedY: { min: -70, max: -30 }, speedX: { min: -14, max: 14 }, lifespan: { min: 700, max: 1000 }, scale: { start: 0.9, end: 0.4 },
      alpha: { start: 1, end: 0 }, tint: HOT_TINTS, frequency: 140, quantity: 1,
      emitZone: zone(new Phaser.Geom.Ellipse(0, -30, 40, 56)),
    });
    return c;
  };

  // ───────────────────────── Comet Stride ─────────────────────────

  const cometOut: VfxFn = (scene, o) => {
    const { x, y, facing: f } = o;
    const x1 = o.targetX ?? x + f * 300, y1 = o.targetY ?? y;
    if (!pxFx(scene, 'sf_boom', x, y - 30, { scale: 2, dur: 240, add: true, depth: DEPTH.VFX_TOP })) flash(scene, x, y - 30, C.orange, 70, 200, 0.9);
    // the comet itself races ahead of the caster, trailing sparks
    const c = scene.add.container(x, y - 30).setDepth(DEPTH.VFX_TOP);
    if (!pxLoop(scene, c, 'sf_fireball', 0, 0, { scale: 2 })) c.add(img(scene, FT.soft, 0, 0, { tint: C.yellow, scale: 0.45 }));
    c.setRotation(f > 0 ? 0 : Math.PI);
    attachTrail(scene, c, FT.ember, 400, {
      speed: { min: 5, max: 40 }, lifespan: { min: 220, max: 420 }, scale: { start: 1, end: 0.3 }, alpha: { start: 1, end: 0 },
      frequency: 16, quantity: 1, tint: HOT_TINTS.concat(FIRE_TINTS),
    });
    scene.tweens.add({ targets: c, x: x1, y: y1 - 30, duration: 130, ease: 'Quad.easeIn', onComplete: () => { if (c.scene) c.destroy(); } });
    k.smokePuff(scene, x, y - 20, 2, 0.9);
  };

  const cometIn: VfxFn = (scene, o) => {
    const { x, y, facing: f } = o;
    const ox = o.targetX ?? x - f * 300;
    const len = Math.abs(x - ox);
    if (!pxFx(scene, 'ex1', x, y - 24, { scale: 2, dur: 260, depth: DEPTH.VFX_TOP })) flash(scene, x, y - 24, C.yellow, 70, 200, 0.9);
    flash(scene, x, y - 30, C.white, 80, 200, 0.8);
    shock(scene, x, y - 2, C.orange, 110, 320, 0.3);
    k.scorchMark(scene, (x + ox) / 2, y, len, 1900);
    const n = Math.max(2, Math.min(6, Math.round(len / 60)));
    for (let i = 0; i < n; i++) {
      const fx = ox + (x - ox) * ((i + 0.5) / n);
      if (!pxFx(scene, 'sf_flame_s', fx, y + 2, { scale: 2, oy: 1, delay: i * 30, fps: 10, depth: DEPTH.VFX })) tongue(scene, fx, y, FIRE_TINTS[i % 3], 18, 40, i * 30, 500);
    }
    k.sparks(scene, x, y - 24, 5, 240, 280);
  };

  const cometArea: VfxFn = (scene, o) => {
    const w = o.w ?? 300;
    const gy = o.groundY ?? o.y + 34;
    const n = Math.max(2, Math.min(7, Math.round(w / 55)));
    for (let i = 0; i < n; i++) {
      const fx = o.x - w / 2 + (w * (i + 0.5)) / n;
      if (!pxFx(scene, 'cm_brightfire', fx, gy + 4, { scale: 2, oy: 1, delay: i * 25, dur: 520, flipX: i % 2 === 1 })) tongue(scene, fx, gy, FIRE_TINTS[i % 3], 24, 70, i * 25, 440);
    }
    shock(scene, o.x, gy - 2, C.orange, w * 0.9, 380, 0.2, 0.8);
  };

  const cometEmber: VfxFn = (scene, o) => {
    const w = o.w ?? 300;
    const gy = o.groundY ?? o.y + 34;
    for (let i = 0; i < 3; i++) {
      const fx = o.x + rnd(-w * 0.45, w * 0.45);
      if (!pxFx(scene, 'sf_flame_s', fx, gy + 2, { scale: 2, oy: 1, delay: i * 40, fps: 12 })) tongue(scene, fx, gy, FIRE_TINTS[i], 16, 44, i * 40, 360);
    }
    burst(scene, o.x, gy - 4, FT.ember, 5, 600, {
      speed: { min: 20, max: 60 }, angle: { min: 240, max: 300 }, gravityY: -30, lifespan: { min: 300, max: 600 },
      scale: { start: 0.8, end: 0.2 }, alpha: { start: 1, end: 0 }, tint: FIRE_TINTS,
      emitZone: zone(new Phaser.Geom.Rectangle(-w * 0.45, 0, w * 0.9, 4)),
    });
  };

  void sideAngle;
  reg('fire_solar_spear_cast', spearCast);
  reg('fire_solar_spear_area', spearArea);
  reg('fire_pyroclasm_cast', pyroCast);
  reg('fire_pyroclasm_area', pyroArea);
  reg('fire_daybreak_cast', daybreakCast);
  reg('fire_daybreak_area', daybreakArea);
  reg('fire_brazier', brazierBody);
  reg('fire_brazier_pulse', brazierPulse);
  reg('fire_cremation_area', cremationArea);
  reg('fire_covenant_cast', covenantCast);
  reg('fire_covenant_aura', covenantAura);
  reg('fire_comet_out', cometOut);
  reg('fire_comet_in', cometIn);
  reg('fire_comet_area', cometArea);
  reg('fire_comet_ember', cometEmber);
}
