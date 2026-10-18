// OWNER: A10 (art-audio). Shared white particle textures + common VFX (levelup, job_advance, respawn,
// hit_generic, pickup_sparkle). All textures are white so they can be tinted.
//
// Extra textures (also white): fx_pillar (32×128 light beam, bottom-anchored), fx_circle (128 magic circle),
// fx_rune_0..5 (24px runes).
import Phaser from 'phaser';
import type { VfxOptions } from '../core/types';
import { DEPTH } from '../core/constants';
import { registerVfx } from '../core/vfx';
import { makeCanvas } from './char/color';

type Ctx = CanvasRenderingContext2D;

// ───────────────────────────── textures ─────────────────────────────

function addTex(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void) {
  if (scene.textures.exists(key)) return;
  const c = makeCanvas(w, h);
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return;
  try { paint(ctx); scene.textures.addCanvas(key, c); } catch (e) { console.warn(`[particles] ${key} failed`, e); }
}

function radial(ctx: Ctx, x: number, y: number, r: number, stops: [number, number][]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [t, a] of stops) g.addColorStop(t, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

const RUNES: ((ctx: Ctx) => void)[] = [
  ctx => { ctx.arc(12, 12, 7, 0, Math.PI * 2); ctx.moveTo(12, 2); ctx.lineTo(12, 22); },
  ctx => { ctx.moveTo(12, 3); ctx.lineTo(21, 19); ctx.lineTo(3, 19); ctx.closePath(); ctx.moveTo(12, 12.5); ctx.arc(12, 13.5, 1, 0, Math.PI * 2); },
  ctx => { ctx.moveTo(7, 3); ctx.lineTo(7, 21); ctx.moveTo(7, 4); ctx.lineTo(16, 8); ctx.lineTo(7, 12); ctx.lineTo(17, 21); },
  ctx => { ctx.moveTo(12, 2); ctx.lineTo(21, 12); ctx.lineTo(12, 22); ctx.lineTo(3, 12); ctx.closePath(); ctx.moveTo(12, 7); ctx.lineTo(12, 17); ctx.moveTo(7, 12); ctx.lineTo(17, 12); },
  ctx => { ctx.moveTo(12, 21); ctx.lineTo(12, 3); ctx.moveTo(5, 10); ctx.lineTo(12, 3); ctx.lineTo(19, 10); ctx.moveTo(7, 15); ctx.lineTo(17, 15); ctx.moveTo(8, 19); ctx.lineTo(16, 19); },
  ctx => { ctx.arc(11, 12, 8, Math.PI * 0.35, Math.PI * 1.65); ctx.moveTo(17, 8); ctx.lineTo(17, 16); ctx.moveTo(13, 12); ctx.lineTo(21, 12); },
];

/** Generates shared white particle textures: px_dot, px_soft, px_spark, px_star, px_ring, px_smoke, px_shard, px_flare. */
export function generateParticleTextures(scene: Phaser.Scene): void {
  addTex(scene, 'px_dot', 8, 8, ctx => radial(ctx, 4, 4, 4, [[0, 1], [0.55, 1], [1, 0]]));
  addTex(scene, 'px_soft', 32, 32, ctx => radial(ctx, 16, 16, 16, [[0, 1], [0.25, 0.75], [0.6, 0.25], [1, 0]]));
  addTex(scene, 'px_spark', 16, 4, ctx => {
    const g = ctx.createLinearGradient(0, 0, 16, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.65, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0.6)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(10, -0.2, 16, 2); ctx.quadraticCurveTo(10, 4.2, 0, 2); ctx.fill();
  });
  addTex(scene, 'px_star', 16, 16, ctx => {
    radial(ctx, 8, 8, 6, [[0, 0.9], [1, 0]]);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2, r = i % 2 ? 1.6 : 8;
      const x = 8 + Math.cos(a) * r, y = 8 + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  });
  addTex(scene, 'px_ring', 32, 32, ctx => {
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(16, 16, 12.5, 0, Math.PI * 2); ctx.stroke();
  });
  addTex(scene, 'px_smoke', 32, 32, ctx => {
    const blobs: [number, number, number][] = [[16, 17, 11], [10, 14, 7], [22, 13, 7.5], [13, 21, 7], [21, 21, 7], [16, 10, 6]];
    for (const [x, y, r] of blobs) radial(ctx, x, y, r, [[0, 0.55], [0.6, 0.35], [1, 0]]);
  });
  addTex(scene, 'px_shard', 12, 20, ctx => {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(12, 9); ctx.lineTo(6, 20); ctx.lineTo(0, 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(200,200,200,0.9)';
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(12, 9); ctx.lineTo(6, 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(3.5, 6, 1.2, 6);
  });
  addTex(scene, 'px_flare', 64, 64, ctx => radial(ctx, 32, 32, 32, [[0, 1], [0.12, 0.85], [0.3, 0.4], [0.6, 0.1], [1, 0]]));
  // extras for the common VFX (and anyone else who wants them)
  addTex(scene, 'fx_pillar', 32, 128, ctx => {
    const g = ctx.createLinearGradient(0, 0, 32, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 128);
    ctx.globalCompositeOperation = 'destination-in';
    const v = ctx.createLinearGradient(0, 0, 0, 128);
    v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.35, 'rgba(255,255,255,0.8)'); v.addColorStop(0.92, 'rgba(255,255,255,1)'); v.addColorStop(1, 'rgba(255,255,255,0.4)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, 32, 128);
  });
  addTex(scene, 'fx_circle', 128, 128, ctx => {
    ctx.translate(64, 64);
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 59, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, r0 = 52, r1 = i % 3 === 0 ? 57 : 55;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
    }
    for (const rot of [0, Math.PI]) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = rot - Math.PI / 2 + (i * Math.PI * 2) / 3;
        if (i) ctx.lineTo(Math.cos(a) * 48, Math.sin(a) * 48); else ctx.moveTo(Math.cos(a) * 48, Math.sin(a) * 48);
      }
      ctx.closePath(); ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 36, Math.sin(a) * 36, 3, 0, Math.PI * 2); ctx.stroke();
    }
  });
  RUNES.forEach((draw, i) => addTex(scene, `fx_rune_${i}`, 24, 24, ctx => {
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 3;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); draw(ctx); ctx.stroke();
  }));
}

// ───────────────────────────── VFX helpers ─────────────────────────────

const ADD = Phaser.BlendModes.ADD;

function img(scene: Phaser.Scene, key: string, x: number, y: number, tint = 0xffffff, depth: number = DEPTH.VFX): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key)) return null;
  return scene.add.image(x, y, key).setTint(tint).setBlendMode(ADD).setDepth(depth);
}

/** Tween then destroy. */
function fx(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject | null, cfg: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>) {
  if (!obj) return;
  scene.tweens.add({ ...cfg, targets: obj, onComplete: () => obj.destroy() });
}

type EmitCfg = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

/** One-shot particle burst that cleans itself up. */
function burst(scene: Phaser.Scene, x: number, y: number, key: string, n: number, life: number, cfg: EmitCfg, depth: number = DEPTH.VFX) {
  if (!scene.textures.exists(key) || n <= 0) return;
  const e = scene.add.particles(x, y, key, { blendMode: 'ADD', lifespan: life, ...cfg, emitting: false });
  e.setDepth(depth);
  e.explode(n);
  scene.time.delayedCall(life + 150, () => e.destroy());
}

/** Continuous emitter that runs for `forMs`, then stops and self-destroys. */
function stream(scene: Phaser.Scene, x: number, y: number, key: string, forMs: number, life: number, cfg: EmitCfg, depth: number = DEPTH.VFX) {
  if (!scene.textures.exists(key)) return;
  const e = scene.add.particles(x, y, key, { blendMode: 'ADD', lifespan: life, ...cfg, emitting: true });
  e.setDepth(depth);
  scene.time.delayedCall(forMs, () => e.stop());
  scene.time.delayedCall(forMs + life + 150, () => e.destroy());
}

function ring(scene: Phaser.Scene, x: number, y: number, tint: number, from: number, to: number, dur: number, squash = 1, delay = 0, depth: number = DEPTH.VFX) {
  const r = img(scene, 'px_ring', x, y, tint, depth);
  if (!r) return;
  r.setScale(from, from * squash).setAlpha(delay ? 0 : 1);
  fx(scene, r, { scaleX: to, scaleY: to * squash, alpha: { from: 1, to: 0 }, duration: dur, delay, ease: 'Cubic.easeOut' });
}

function hsv(h: number, s = 0.65, v = 1): number {
  return Phaser.Display.Color.HSVToRGB(((h % 1) + 1) % 1, s, v).color;
}

// ───────────────────────────── common VFX ─────────────────────────────

/** Maple-style golden pillar of light + rising stars + ring (~1.5s). x,y = feet. */
function levelup(scene: Phaser.Scene, o: VfxOptions) {
  const { x, y } = o;
  const gold = 0xffd84a;
  const pillar = img(scene, 'fx_pillar', x, y + 4, gold);
  const core = img(scene, 'fx_pillar', x, y + 4, 0xffffff);
  for (const [p, sx] of [[pillar, 1.9], [core, 0.6]] as const) {
    if (!p) continue;
    p.setOrigin(0.5, 1).setScale(0.2, 0).setAlpha(1);
    scene.tweens.add({ targets: p, scaleX: sx, scaleY: 1.7, duration: 220, ease: 'Back.easeOut' });
    fx(scene, p, { scaleX: sx * 0.15, alpha: 0, delay: 950, duration: 550, ease: 'Quad.easeIn' });
  }
  ring(scene, x, y, gold, 0.4, 3.4, 700, 0.32);
  ring(scene, x, y, 0xffffff, 0.3, 2.6, 650, 0.32, 260);
  const flare = img(scene, 'px_flare', x, y - 34, 0xfff1b0, DEPTH.VFX_TOP);
  if (flare) { flare.setScale(0.2).setAlpha(0.9); fx(scene, flare, { scale: 2.4, alpha: 0, duration: 520, ease: 'Quad.easeOut' }); }
  stream(scene, x, y - 6, 'px_star', 1000, 1200, {
    x: { min: -26, max: 26 }, speedY: { min: -70, max: -190 }, speedX: { min: -14, max: 14 },
    scale: { start: 0.95, end: 0 }, rotate: { start: 0, end: 300 }, lifespan: { min: 700, max: 1200 },
    frequency: 35, quantity: 2, tint: [0xffe066, 0xffffff, 0xfff3b0, 0xffc93a],
  }, DEPTH.VFX_TOP);
  burst(scene, x, y - 4, 'px_dot', 22, 900, {
    speed: { min: 60, max: 170 }, angle: { min: 200, max: 340 }, gravityY: 220,
    scale: { start: 0.9, end: 0 }, tint: [0xffe066, 0xffffff],
  });
  const top = img(scene, 'px_star', x, y - 180, 0xffffff, DEPTH.VFX_TOP);
  if (top) { top.setScale(0).setAlpha(1); fx(scene, top, { scale: 3.2, angle: 90, alpha: 0, delay: 180, duration: 650, ease: 'Quad.easeOut' }); }
}

/** Bigger, colorful: rainbow pillar, rotating magic circle and spiraling runes (~2.4s). */
function jobAdvance(scene: Phaser.Scene, o: VfxOptions) {
  const { x, y } = o;
  const T = 2200;
  const colors = [0xff6a3d, 0xffd84a, 0x6aff9a, 0x5ac8ff, 0xb57aff, 0xff7ad9];
  // magic circle on the floor
  const circ = img(scene, 'fx_circle', x, y, 0xffffff, DEPTH.PLAYER - 1);
  if (circ) {
    circ.setScale(0, 0).setAlpha(0.95);
    scene.tweens.add({ targets: circ, scaleX: 1.05, scaleY: 0.34, duration: 350, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: circ, rotation: Math.PI * 2, duration: T + 300 });
    fx(scene, circ, { alpha: 0, delay: T - 300, duration: 600 });
  }
  // rainbow pillar
  const pillar = img(scene, 'fx_pillar', x, y + 4, colors[0]);
  const core = img(scene, 'fx_pillar', x, y + 4, 0xffffff);
  for (const [p, sx] of [[pillar, 2.6], [core, 0.8]] as const) {
    if (!p) continue;
    p.setOrigin(0.5, 1).setScale(0.2, 0);
    scene.tweens.add({ targets: p, scaleX: sx, scaleY: 2.1, duration: 300, delay: 120, ease: 'Back.easeOut' });
    fx(scene, p, { scaleX: sx * 0.1, alpha: 0, delay: T - 450, duration: 600, ease: 'Quad.easeIn' });
  }
  // spiraling runes (pass behind / in front of the player)
  const N = 10;
  const runes: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < N; i++) {
    const r = img(scene, `fx_rune_${i % 6}`, x, y, colors[i % colors.length]);
    if (r) runes.push(r.setAlpha(0));
  }
  const counter = { t: 0 };
  scene.tweens.add({
    targets: counter, t: 1, duration: T, ease: 'Sine.easeInOut',
    onUpdate: () => {
      const t = counter.t;
      if (pillar && pillar.active) pillar.setTint(hsv(t * 1.6));
      runes.forEach((r, i) => {
        if (!r.active) return;
        const a = t * Math.PI * 5 + (i / N) * Math.PI * 2;
        const rad = 46 * (1 - t * 0.45);
        const s = Math.sin(a);
        r.setPosition(x + Math.cos(a) * rad, y - 12 - t * 130 - (i % 2) * 14 + s * 6);
        r.setScale(0.75 + 0.35 * (s + 1) / 2);
        r.setAlpha(Math.min(1, t * 6, (1 - t) * 5) * (0.55 + 0.45 * (s + 1) / 2));
        r.setDepth(s > 0 ? DEPTH.VFX_TOP : DEPTH.PLAYER - 1);
        r.setRotation(a * 0.3);
      });
    },
    onComplete: () => runes.forEach(r => r.destroy()),
  });
  ring(scene, x, y, 0xffffff, 0.4, 4.2, 800, 0.32);
  colors.forEach((c, i) => ring(scene, x, y - 40, c, 0.3, 3 + i * 0.25, 700, 1, 1700 + i * 50, DEPTH.VFX_TOP));
  stream(scene, x, y - 6, 'px_star', T - 400, 1300, {
    x: { min: -34, max: 34 }, speedY: { min: -80, max: -220 }, speedX: { min: -20, max: 20 },
    scale: { start: 1, end: 0 }, rotate: { start: 0, end: 360 }, lifespan: { min: 800, max: 1300 },
    frequency: 30, quantity: 2, tint: colors,
  }, DEPTH.VFX_TOP);
  // finale flash
  scene.time.delayedCall(1750, () => {
    const f = img(scene, 'px_flare', x, y - 50, 0xffffff, DEPTH.VFX_TOP);
    if (f) { f.setScale(0.3).setAlpha(1); fx(scene, f, { scale: 4.5, alpha: 0, duration: 600, ease: 'Quad.easeOut' }); }
    burst(scene, x, y - 50, 'px_star', 36, 1000, {
      speed: { min: 120, max: 320 }, angle: { min: 0, max: 360 }, scale: { start: 1.1, end: 0 },
      rotate: { start: 0, end: 360 }, tint: colors, gravityY: 120,
    }, DEPTH.VFX_TOP);
  });
}

/** Soft descending light + sparkles + ring at the feet (~1.2s). */
function respawn(scene: Phaser.Scene, o: VfxOptions) {
  const { x, y } = o;
  const col = 0xbfe8ff;
  const p = img(scene, 'fx_pillar', x, y + 4, col);
  if (p) {
    p.setOrigin(0.5, 1).setScale(1.3, 1.6).setAlpha(0);
    scene.tweens.add({ targets: p, alpha: 0.9, duration: 200 });
    fx(scene, p, { alpha: 0, scaleX: 0.2, delay: 500, duration: 600 });
  }
  stream(scene, x, y - 170, 'px_star', 600, 900, {
    x: { min: -22, max: 22 }, speedY: { min: 140, max: 220 }, scale: { start: 0.7, end: 0.1 },
    lifespan: { min: 600, max: 850 }, frequency: 40, quantity: 1, tint: [0xffffff, col, 0xd8c8ff],
  }, DEPTH.VFX_TOP);
  ring(scene, x, y, col, 0.3, 2.8, 600, 0.32, 350);
  const f = img(scene, 'px_flare', x, y - 32, 0xffffff, DEPTH.VFX_TOP);
  if (f) { f.setScale(0.2).setAlpha(0); fx(scene, f, { scale: 1.8, alpha: { from: 0.9, to: 0 }, delay: 450, duration: 500 }); }
}

/** Small white impact: flash, star pop and radial sparks (~250ms). x,y = hit point. */
function hitGeneric(scene: Phaser.Scene, o: VfxOptions) {
  const s = o.scale ?? 1;
  const { x, y } = o;
  const f = img(scene, 'px_flare', x, y, 0xffffff, DEPTH.VFX_TOP);
  if (f) { f.setScale(0.5 * s).setAlpha(0.85); fx(scene, f, { scale: 0.9 * s, alpha: 0, duration: 160 }); }
  const st = img(scene, 'px_star', x, y, 0xfff6d0, DEPTH.VFX_TOP);
  if (st) { st.setScale(0.3 * s).setAngle(Math.random() * 45); fx(scene, st, { scale: 1.8 * s, angle: st.angle + 45, alpha: 0, duration: 220, ease: 'Quad.easeOut' }); }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const sp = img(scene, 'px_spark', x, y, i % 2 ? 0xffffff : 0xffe9a8, DEPTH.VFX_TOP);
    if (!sp) break;
    const d = (18 + Math.random() * 16) * s;
    sp.setRotation(a).setScale(0.8 * s, 0.9 * s);
    fx(scene, sp, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scaleX: 0.1, alpha: 0, duration: 200 + Math.random() * 80, ease: 'Quad.easeOut' });
  }
  ring(scene, x, y, 0xffffff, 0.2 * s, 1.3 * s, 200);
}

/** Twinkly pickup sparkle (~500ms). */
function pickupSparkle(scene: Phaser.Scene, o: VfxOptions) {
  const { x, y } = o;
  const st = img(scene, 'px_star', x, y, 0xfff3b0, DEPTH.VFX_TOP);
  if (st) { st.setScale(0.2); fx(scene, st, { scale: 1.4, angle: 90, alpha: 0, duration: 420, ease: 'Back.easeOut' }); }
  burst(scene, x, y, 'px_star', 6, 600, {
    speedX: { min: -40, max: 40 }, speedY: { min: -110, max: -40 }, gravityY: 60,
    scale: { start: 0.55, end: 0 }, rotate: { start: 0, end: 180 }, tint: [0xffffff, 0xffe066, 0xbfe8ff],
  }, DEPTH.VFX_TOP);
  ring(scene, x, y, 0xffe9a8, 0.2, 1.1, 300);
}

function safe(fn: (scene: Phaser.Scene, o: VfxOptions) => void) {
  return (scene: Phaser.Scene, o: VfxOptions) => {
    try { fn(scene, o); } catch (e) { console.warn('[vfx] common effect failed', e); }
  };
}

/** Registers common VFX keys: levelup, job_advance, respawn, hit_generic, pickup_sparkle. */
export function registerCommonVfx(): void {
  registerVfx('levelup', safe(levelup));
  registerVfx('job_advance', safe(jobAdvance));
  registerVfx('respawn', safe(respawn));
  registerVfx('hit_generic', safe(hitGeneric));
  registerVfx('pickup_sparkle', safe(pickupSparkle));
}
