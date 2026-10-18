// OWNER: A2 (skill-engine). Tier-1 Apprentice skills (arcane: violet / cyan) + their textures and VFX.
import Phaser from 'phaser';
import type { SkillDef, VfxOptions } from '../core/types';
import { registerVfx } from '../core/vfx';
import { DEPTH, PIXEL_SCALE } from '../core/constants';
import { pixelizeTexture, pxFx, pxLoop } from '../art/particles';

// ───────────────────────────── palette ─────────────────────────────

const VIOLET = 0x9b5cff;
const VIOLET_LT = 0xc9a6ff;
const VIOLET_DK = 0x5a22d6;
const CYAN = 0x5ee8ff;
const CYAN_LT = 0xb8f6ff;
const WHITE = 0xffffff;
const ARCANE_TINTS = [VIOLET, VIOLET_LT, CYAN, CYAN_LT, WHITE];

// ───────────────────────────── skills ─────────────────────────────

const lerp = (a: number, b: number, lv: number, max: number) => a + ((b - a) * (lv - 1)) / Math.max(1, max - 1);

export const APPRENTICE_SKILLS: SkillDef[] = [
  {
    id: 'app_arcane_bolt',
    name: 'Arcane Bolt',
    description: 'Hurl a bolt of raw arcane force at the first enemy in front of you.',
    element: 'neutral',
    job: 'apprentice',
    kind: 'attack',
    maxLevel: 10,
    icon: { glyph: 'missile', color: VIOLET_LT, color2: CYAN, bg: 0x22104a },
    mpCost: lv => Math.round(lerp(6, 12, lv, 10)),
    castTimeMs: 420,
    sfx: 'cast_arcane',
    attack: {
      pattern: 'projectile',
      damagePct: lv => Math.round(lerp(125, 170, lv, 10)),
      hits: () => 1,
      maxTargets: () => 1,
      range: 520,
      projectile: { speed: 780, radius: 10 },
      vfx: { cast: 'app_bolt_cast', projectile: 'app_bolt', hit: 'app_bolt_hit' },
    },
  },
  {
    id: 'app_arcane_claw',
    name: 'Arcane Claw',
    description: 'Rake the space in front of you with spectral talons, striking twice.',
    element: 'neutral',
    job: 'apprentice',
    kind: 'attack',
    maxLevel: 10,
    icon: { glyph: 'claw', color: CYAN, color2: VIOLET_LT, bg: 0x162048 },
    requires: [{ skillId: 'app_arcane_bolt', level: 3 }],
    mpCost: lv => Math.round(lerp(8, 13, lv, 10)),
    castTimeMs: 400,
    sfx: 'whoosh',
    attack: {
      pattern: 'melee_arc',
      damagePct: lv => Math.round(lerp(62, 92, lv, 10)),
      hits: () => 2,
      maxTargets: lv => (lv >= 6 ? 3 : 2),
      range: 140,
      area: { w: 150, h: 110, offsetX: 70 },
      delayMs: 70,
      hitIntervalMs: 110,
      vfx: { area: 'app_claw', hit: 'app_claw_hit' },
    },
  },
  {
    id: 'app_mana_shield',
    name: 'Mana Shield',
    description: 'Wrap yourself in a barrier of mana: part of the damage you take is paid with MP instead.',
    element: 'neutral',
    job: 'apprentice',
    kind: 'buff',
    maxLevel: 10,
    icon: { glyph: 'shield', color: CYAN, color2: VIOLET, bg: 0x101e3e },
    mpCost: lv => Math.round(lerp(10, 14, lv, 10)),
    castTimeMs: 500,
    sfx: 'buff',
    buff: {
      durationMs: lv => Math.round(lerp(60, 180, lv, 10)) * 1000,
      modifiers: lv => [{ stat: 'mpShield', add: +lerp(0.2, 0.5, lv, 10).toFixed(3) }],
      vfx: 'app_shield_cast',
      auraVfx: 'app_shield_aura',
    },
  },
  {
    id: 'app_mana_font',
    name: 'Mana Font',
    description: 'Passive. Deepens your mana pool and quickens its recovery.',
    element: 'neutral',
    job: 'apprentice',
    kind: 'passive',
    maxLevel: 10,
    icon: { glyph: 'mana', color: 0x6fb6ff, color2: VIOLET_LT, bg: 0x0f1a3a },
    mpCost: () => 0,
    passive: lv => [
      { stat: 'maxMp', mul: +(0.02 * lv).toFixed(3) },
      { stat: 'mpRegen', add: 1 + lv },
    ],
  },
  {
    id: 'app_blink',
    name: 'Blink',
    description: 'Fold space and reappear a short distance away. Hold an arrow key to choose the direction.',
    element: 'neutral',
    job: 'apprentice',
    kind: 'movement',
    maxLevel: 5,
    icon: { glyph: 'teleport', color: VIOLET_LT, color2: CYAN_LT, bg: 0x1c0f40 },
    requires: [{ skillId: 'app_arcane_bolt', level: 5 }],
    mpCost: lv => 8 + lv,
    cooldownMs: lv => 1100 - 30 * lv,
    castTimeMs: 150,
    sfx: 'blink',
    movement: {
      kind: 'blink',
      distance: lv => 120 + 20 * (lv - 1),
      vfxOut: 'app_blink_out',
      vfxIn: 'app_blink_in',
    },
  },
  {
    id: 'app_arcane_nova',
    name: 'Arcane Nova',
    description: 'Release a pulse of arcane energy that strikes every nearby enemy.',
    element: 'neutral',
    job: 'apprentice',
    kind: 'attack',
    maxLevel: 10,
    icon: { glyph: 'arcane_star', color: VIOLET_LT, color2: CYAN, bg: 0x200c44 },
    requires: [{ skillId: 'app_arcane_claw', level: 3 }],
    mpCost: lv => Math.round(lerp(9, 14, lv, 10)),
    cooldownMs: () => 1200,
    castTimeMs: 520,
    sfx: 'cast_arcane',
    attack: {
      pattern: 'aoe_self',
      damagePct: lv => Math.round(lerp(72, 100, lv, 10)),
      hits: () => 1,
      maxTargets: lv => 4 + Math.floor(lv / 3),
      range: 120,
      area: { w: 240, h: 150, offsetY: 4 },
      knockback: 40,
      delayMs: 140,
      vfx: { cast: 'app_nova_cast', area: 'app_nova', hit: 'app_nova_hit' },
    },
  },
];

// ───────────────────────────── textures ─────────────────────────────

/** Textures we always generate (own fallbacks for the shared px_* set + bespoke shapes). */
const T = {
  glow: 'app_glow', dot: 'app_dot', star: 'app_star', ring: 'app_ring', spark: 'app_spark',
  bolt: 'app_bolt', rune: 'app_rune', claw: 'app_claw', bubble: 'app_bubble', hex: 'app_hex', streak: 'app_streak',
} as const;

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  try { draw(t.getContext(), w, h); } catch (e) { console.error(`[apprentice] texture ${key}`, e); }
  // 16-bit pivot: chunky stepped-alpha pixels (runes/claws get hard silhouettes).
  pixelizeTexture(t, key === T.rune ? 2 : undefined,
    key === T.rune ? { hard: true, cutoff: 0.3 } : key === T.claw ? { hard: true, cutoff: 0.3 } : key === T.bolt ? { posterize: 6 } : {});
}

function radial(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, points: number, outer: number, inner: number, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points;
    const r = i % 2 === 0 ? outer : inner;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function generateApprenticeTextures(scene: Phaser.Scene): void {
  canvasTex(scene, T.glow, 64, 64, (c) => radial(c, 32, 32, 32, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.65)'], [0.6, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]));
  canvasTex(scene, T.dot, 12, 12, (c) => radial(c, 6, 6, 6, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]));

  canvasTex(scene, T.star, 32, 32, (c) => {
    radial(c, 16, 16, 10, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
    c.fillStyle = '#ffffff';
    c.beginPath();
    // 4-point star with concave sides
    c.moveTo(16, 0); c.quadraticCurveTo(17.5, 14.5, 32, 16); c.quadraticCurveTo(17.5, 17.5, 16, 32);
    c.quadraticCurveTo(14.5, 17.5, 0, 16); c.quadraticCurveTo(14.5, 14.5, 16, 0);
    c.fill();
  });

  canvasTex(scene, T.ring, 64, 64, (c) => {
    for (let i = 0; i < 4; i++) {
      c.strokeStyle = `rgba(255,255,255,${[0.12, 0.25, 0.5, 1][i]})`;
      c.lineWidth = [9, 6, 4, 2][i];
      c.beginPath(); c.arc(32, 32, 26, 0, Math.PI * 2); c.stroke();
    }
  });

  canvasTex(scene, T.spark, 24, 6, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill();
  });

  canvasTex(scene, T.streak, 16, 96, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill();
  });

  // Bolt: colored teardrop pointing right; glowing white-cyan head, violet comet tail.
  canvasTex(scene, T.bolt, 72, 32, (c, w, h) => {
    const cy = h / 2;
    const tail = c.createLinearGradient(0, 0, w - 14, 0);
    tail.addColorStop(0, 'rgba(110,50,230,0)');
    tail.addColorStop(0.55, 'rgba(150,90,255,0.55)');
    tail.addColorStop(1, 'rgba(190,150,255,0.95)');
    c.fillStyle = tail;
    c.beginPath();
    c.moveTo(2, cy);
    c.quadraticCurveTo(w * 0.45, cy - 11, w - 16, cy - 9);
    c.arc(w - 16, cy, 9, -Math.PI / 2, Math.PI / 2);
    c.quadraticCurveTo(w * 0.45, cy + 11, 2, cy);
    c.fill();
    radial(c, w - 16, cy, 15, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(200,250,255,0.95)'], [0.6, 'rgba(110,220,255,0.55)'], [1, 'rgba(120,70,255,0)']]);
    // inner filament
    c.strokeStyle = 'rgba(230,250,255,0.85)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(w * 0.35, cy); c.lineTo(w - 16, cy); c.stroke();
  });

  // Rune circle (white, tint at use).
  canvasTex(scene, T.rune, 160, 160, (c, w) => {
    const cx = w / 2, cy = w / 2;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 74, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, 66, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 44, 0, Math.PI * 2); c.stroke();
    // ticks + runic marks between the outer rings
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r0 = 66, r1 = i % 2 === 0 ? 74 : 70;
      c.lineWidth = i % 2 === 0 ? 2 : 1;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const rx = cx + Math.cos(a) * 55, ry = cy + Math.sin(a) * 55;
      c.save(); c.translate(rx, ry); c.rotate(a + Math.PI / 2);
      c.lineWidth = 1.8;
      c.beginPath();
      // little glyph: a "y" / fork shape variant per index
      c.moveTo(-4, -5); c.lineTo(0, 0); c.lineTo(4, -5);
      c.moveTo(0, 0); c.lineTo(0, 6);
      if (i % 2) { c.moveTo(-3, 3); c.lineTo(3, 3); }
      c.stroke();
      c.restore();
    }
    // hexagram
    c.lineWidth = 1.6;
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + k * Math.PI / 3 + (i * 2 * Math.PI) / 3;
        const x = cx + Math.cos(a) * 44, y = cy + Math.sin(a) * 44;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath(); c.stroke();
    }
    radial(c, cx, cy, 20, [[0, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
  });

  // Claw: three tapered crescent slashes sweeping from upper-back to lower-front (facing right).
  canvasTex(scene, T.claw, 160, 128, (c, w, h) => {
    for (let i = 0; i < 3; i++) {
      const ox = 18 + i * 22, oy = 10 + i * 10;
      const g = c.createLinearGradient(ox, oy, ox + 110, oy + 90);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.8, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(ox, oy);
      c.quadraticCurveTo(ox + 100, oy + 6, ox + 108, oy + 88);
      c.quadraticCurveTo(ox + 86, oy + 22, ox, oy);
      c.fill();
    }
    void w; void h;
  });

  // Shield bubble: soft rim + highlight.
  canvasTex(scene, T.bubble, 128, 128, (c) => {
    radial(c, 64, 64, 62, [[0, 'rgba(255,255,255,0.03)'], [0.62, 'rgba(255,255,255,0.10)'], [0.86, 'rgba(255,255,255,0.45)'], [0.95, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
    c.save();
    c.globalAlpha = 0.55;
    radial(c, 44, 40, 18, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
    c.restore();
  });

  canvasTex(scene, T.hex, 24, 24, (c) => {
    c.strokeStyle = '#ffffff'; c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      const x = 12 + Math.cos(a) * 9, y = 12 + Math.sin(a) * 9;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fill();
  });
  void starPath;
}

// ───────────────────────────── VFX helpers ─────────────────────────────

/** Prefer the shared px_* texture (A10) and fall back to ours. */
function tex(scene: Phaser.Scene, shared: string, own: string): string {
  return scene.textures.exists(shared) ? shared : own;
}

type EmitterCfg = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

/** One-shot particle burst at (x,y); self-destroys. */
function burst(scene: Phaser.Scene, key: string, x: number, y: number, n: number, cfg: EmitterCfg, depth: number = DEPTH.VFX) {
  if (!scene.textures.exists(key)) return;
  const life = typeof cfg.lifespan === 'number' ? cfg.lifespan : (cfg.lifespan as { max?: number })?.max ?? 800;
  const em = scene.add.particles(0, 0, key, { blendMode: 'ADD', emitting: false, ...cfg });
  em.setDepth(depth);
  em.explode(n, x, y);
  scene.time.delayedCall(life + 100, () => em.destroy());
}

/** Additive image that animates then destroys itself. */
function flash(scene: Phaser.Scene, key: string, x: number, y: number, o: {
  tint?: number; from?: number; to?: number; alpha?: number; dur?: number; rot?: number; spin?: number;
  sx?: number; sy?: number; depth?: number; ease?: string; delay?: number; flipX?: boolean;
}) {
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(x, y, key).setBlendMode(Phaser.BlendModes.ADD).setDepth(o.depth ?? DEPTH.VFX);
  const from = o.from ?? 0.5, to = o.to ?? 1.5;
  const sx = o.sx ?? 1, sy = o.sy ?? 1;
  img.setScale(from * sx, from * sy).setAlpha(o.alpha ?? 1).setRotation(o.rot ?? 0).setTint(o.tint ?? WHITE).setFlipX(!!o.flipX);
  if (o.delay) img.setVisible(false);
  scene.tweens.add({
    targets: img,
    scaleX: to * sx, scaleY: to * sy, alpha: 0,
    rotation: (o.rot ?? 0) + (o.spin ?? 0),
    duration: o.dur ?? 300,
    delay: o.delay ?? 0,
    ease: o.ease ?? 'Cubic.easeOut',
    onStart: () => img.setVisible(true),
    onComplete: () => img.destroy(),
  });
  return img;
}

/** Attach cleanup to a persistent container: kills its tweens and runs extra disposers. */
function onDispose(scene: Phaser.Scene, go: Phaser.GameObjects.Container, fn?: () => void) {
  // Snapshot the children now: Container.preDestroy empties `list` before DESTROY is emitted,
  // so reading go.list inside the handler would miss every child's (infinite) tweens.
  const kids = [...go.list];
  go.once(Phaser.GameObjects.Events.DESTROY, () => {
    try { scene.tweens.killTweensOf(kids); scene.tweens.killTweensOf(go); } catch { /* ignore */ }
    try { fn?.(); } catch { /* ignore */ }
  });
}

// ───────────────────────────── VFX ─────────────────────────────

function vfxBoltCast(scene: Phaser.Scene, o: VfxOptions) {
  flash(scene, T.rune, o.x, o.y, { tint: VIOLET_LT, from: 0.25, to: 0.25, dur: 260, alpha: 0.9 });
  if (!pxFx(scene, 'g9_spark', o.x, o.y, { v: 'arcane', scale: PIXEL_SCALE, add: true, dur: 260, depth: DEPTH.VFX_TOP })) {
    flash(scene, tex(scene, 'px_flare', T.glow), o.x, o.y, { tint: VIOLET, from: 0.4, to: 1.4, dur: 220, alpha: 0.8 });
  }
  burst(scene, tex(scene, 'px_dot', T.dot), o.x, o.y, 5, {
    speed: { min: 40, max: 140 }, angle: { min: 0, max: 360 }, lifespan: 320,
    scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: [VIOLET_LT, CYAN_LT, WHITE],
  });
}

function vfxBolt(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.GameObject {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.VFX);
  // 16-bit arcane bolt: Emcee Flesher's pixel fireball palette-swapped to indigo/cyan
  const px = pxLoop(scene, c, 'sf_fireball', 0, 0, { v: 'arcane', scale: PIXEL_SCALE, add: true });
  if (!px) {
    const glow = scene.add.image(-6, 0, tex(scene, 'px_flare', T.glow)).setTint(VIOLET).setBlendMode(Phaser.BlendModes.ADD).setScale(1, 0.75).setAlpha(0.75);
    const body = scene.add.image(-14, 0, T.bolt).setBlendMode(Phaser.BlendModes.ADD);
    c.add([glow, body]);
  }
  c.setRotation(o.angle ?? (o.facing < 0 ? Math.PI : 0));

  // Pixel sparkle trail that lingers after the bolt is gone.
  const trailKey = tex(scene, 'px_dot', T.dot);
  const trail = scene.add.particles(0, 0, trailKey, {
    follow: c, frequency: 30, quantity: 1, lifespan: { min: 220, max: 420 },
    speed: { min: 5, max: 30 }, angle: { min: 0, max: 360 },
    scale: { start: 1, end: 0.5 }, alpha: { start: 0.9, end: 0 },
    tint: [VIOLET, VIOLET_LT, CYAN], blendMode: 'ADD',
  });
  trail.setDepth(DEPTH.VFX - 1);
  onDispose(scene, c, () => {
    trail.stop();
    scene.time.delayedCall(450, () => trail.destroy());
  });
  return c;
}

function vfxBoltHit(scene: Phaser.Scene, o: VfxOptions) {
  const s = Math.max(0.7, Math.min(1.6, (o.h ?? 40) / 45));
  if (!pxFx(scene, 'sf_ring', o.x, o.y, { v: 'arcane', scale: s >= 1.3 ? 4 : PIXEL_SCALE, add: true, dur: 300, depth: DEPTH.VFX_TOP })) {
    flash(scene, tex(scene, 'px_flare', T.glow), o.x, o.y, { tint: VIOLET_LT, from: 0.3 * s, to: 1.6 * s, dur: 240 });
    flash(scene, tex(scene, 'px_ring', T.ring), o.x, o.y, { tint: CYAN, from: 0.2 * s, to: 1.5 * s, dur: 280, alpha: 0.9 });
  }
  burst(scene, tex(scene, 'px_spark', T.spark), o.x, o.y, 6, {
    speed: { min: 120, max: 300 }, angle: { min: 0, max: 360 }, rotate: { onUpdate: (p: Phaser.GameObjects.Particles.Particle) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) },
    lifespan: { min: 180, max: 320 }, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: ARCANE_TINTS,
  });
}

function vfxClaw(scene: Phaser.Scene, o: VfxOptions) {
  const w = o.w ?? 150, h = o.h ?? 110;
  const sx = w / 150, sy = h / 110;
  const flip = o.facing < 0;
  // Two pixel swipes (Emcee Flesher slash, arcane palette), one per hit line; the second is mirrored vertically.
  const k = w >= 140 ? 4 : PIXEL_SCALE;
  const a = pxFx(scene, 'sf_slash', o.x, o.y - 6, { v: 'arcane', scale: k, flipX: flip, dur: 240, add: true, depth: DEPTH.VFX_TOP });
  if (a) {
    pxFx(scene, 'sf_slash', o.x + 8 * o.facing, o.y + 10, { v: 'arcane', scale: k, flipX: flip, flipY: true, dur: 240, delay: 110, add: true, depth: DEPTH.VFX_TOP });
  } else {
    flash(scene, T.claw, o.x, o.y, { tint: VIOLET_LT, from: 0.75, to: 1.1, sx, sy, dur: 260, flipX: flip, rot: -0.25 * o.facing, spin: 0.25 * o.facing });
    flash(scene, T.claw, o.x + 8 * o.facing, o.y + 4, { tint: CYAN, from: 0.7, to: 1.05, sx, sy: -sy, dur: 260, delay: 110, flipX: flip, rot: 0.2 * o.facing, spin: -0.25 * o.facing });
  }
  burst(scene, tex(scene, 'px_spark', T.spark), o.x, o.y, 8, {
    x: { min: -w * 0.35, max: w * 0.35 }, y: { min: -h * 0.3, max: h * 0.3 },
    speedX: { min: 60 * o.facing, max: 260 * o.facing }, speedY: { min: -60, max: 120 },
    rotate: o.facing > 0 ? 25 : 155,
    lifespan: { min: 160, max: 320 }, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: ARCANE_TINTS,
  });
}

function vfxClawHit(scene: Phaser.Scene, o: VfxOptions) {
  const s = Math.max(0.7, Math.min(1.5, (o.h ?? 40) / 45));
  if (!pxFx(scene, 'spark', o.x, o.y, { scale: s >= 1.3 ? 4 : PIXEL_SCALE, tint: CYAN_LT, add: true, depth: DEPTH.VFX_TOP })) {
    flash(scene, tex(scene, 'px_spark', T.spark), o.x, o.y, { tint: CYAN_LT, from: 1.5 * s, to: 3.2 * s, sy: 1.4, rot: 0.7, dur: 200 });
    flash(scene, tex(scene, 'px_spark', T.spark), o.x, o.y, { tint: VIOLET_LT, from: 1.5 * s, to: 3.2 * s, sy: 1.4, rot: -0.7, dur: 200, delay: 60 });
  }
  burst(scene, tex(scene, 'px_dot', T.dot), o.x, o.y, 5, {
    speed: { min: 50, max: 160 }, angle: { min: 0, max: 360 }, lifespan: 300,
    scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: [CYAN, VIOLET_LT, WHITE],
  });
}

function vfxShieldCast(scene: Phaser.Scene, o: VfxOptions) {
  const cy = o.y - 34;
  flash(scene, T.rune, o.x, o.y - 2, { tint: CYAN, from: 0.5, to: 0.75, sy: 0.5, dur: 600, alpha: 0.95 });
  if (!pxFx(scene, 'cm_shield', o.x, cy, { v: 'arcane', scale: PIXEL_SCALE, add: true, dur: 520, depth: DEPTH.VFX_TOP })) {
    flash(scene, T.bubble, o.x, cy, { tint: CYAN_LT, from: 1.4, to: 0.62, dur: 380, ease: 'Back.easeOut', alpha: 0.9 });
  }
  // The heal-burst frames are filled pale discs; at full alpha (additive, over the ward) they blank out the caster.
  pxFx(scene, 'sf_heal', o.x, cy, { v: 'arcane', scale: 4, add: true, dur: 320, alpha: 0.35 });
  burst(scene, tex(scene, 'px_star', T.star), o.x, o.y, 10, {
    x: { min: -26, max: 26 }, speedY: { min: -160, max: -60 }, speedX: { min: -20, max: 20 },
    lifespan: { min: 450, max: 800 }, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 },
    tint: [CYAN, CYAN_LT, VIOLET_LT],
  });
}

function vfxShieldAura(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.GameObject {
  const c = scene.add.container(o.x, o.y).setDepth(DEPTH.PLAYER + 1);
  const cy = -34;
  // pixel ward (CodeManu protection circle, arcane palette) instead of the smooth bubble
  const ward = pxLoop(scene, c, 'cm_shield', 0, cy, { v: 'arcane', scale: PIXEL_SCALE, add: true, alpha: 0.5, fps: 10 });
  if (!ward) {
    const bubble = scene.add.image(0, cy, T.bubble).setTint(CYAN).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.4).setScale(0.6, 0.66);
    c.add(bubble);
    scene.tweens.add({ targets: bubble, alpha: 0.22, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // Orbiting hex motes on a tilted ellipse (behind/in front via alpha), snapped to whole pixels.
  const moteKey = T.hex;
  const motes = [0, 1, 2].map(() => scene.add.image(0, cy, moteKey).setTint(CYAN_LT).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5));
  c.add(motes);
  let t = Math.random() * 10;
  const onUpdate = (_time: number, delta: number) => {
    if (!c.scene) return;
    t += delta / 1000;
    motes.forEach((m, i) => {
      const a = t * 2.1 + (i * Math.PI * 2) / 3;
      const depthF = Math.sin(a); // -1 back .. 1 front
      m.setPosition(Math.round(Math.cos(a) * 30), Math.round(cy + depthF * 9 - 6 * Math.cos(a * 0.5)));
      m.setAlpha(depthF > 0 ? 0.9 : 0.4);
    });
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);

  // Occasional rising motes.
  const rise = scene.add.particles(0, 0, tex(scene, 'px_dot', T.dot), {
    follow: c, followOffset: { x: 0, y: -10 }, frequency: 260, quantity: 1,
    x: { min: -22, max: 22 }, speedY: { min: -60, max: -25 }, lifespan: { min: 500, max: 900 },
    scale: { start: 1, end: 0.5 }, alpha: { start: 0.8, end: 0 }, tint: [CYAN, CYAN_LT, VIOLET_LT], blendMode: 'ADD',
  });
  rise.setDepth(DEPTH.PLAYER + 1);
  onDispose(scene, c, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    rise.stop();
    scene.time.delayedCall(950, () => rise.destroy());
  });
  return c;
}

function vfxBlinkOut(scene: Phaser.Scene, o: VfxOptions) {
  const cy = o.y - 32;
  if (!pxFx(scene, 'cm_midnight', o.x, cy, { v: 'arcane', scale: PIXEL_SCALE, add: true, dur: 320, depth: DEPTH.VFX_TOP })) {
    flash(scene, T.streak, o.x, cy, { tint: VIOLET_LT, from: 1, to: 1, sx: 1.6, sy: 1.1, dur: 260, ease: 'Quad.easeIn' });
    flash(scene, tex(scene, 'px_flare', T.glow), o.x, cy, { tint: VIOLET, from: 1.4, to: 0.2, sy: 1.5, dur: 240 });
  }
  flash(scene, tex(scene, 'px_ring', T.ring), o.x, o.y - 2, { tint: CYAN, from: 1, to: 2, sy: 0.5, dur: 320, alpha: 0.9 });
  // Dissolve: motes drift toward the destination.
  const dx = (o.targetX ?? o.x) - o.x, dy = (o.targetY ?? o.y) - o.y;
  const ang = Phaser.Math.RadToDeg(Math.atan2(dy, dx || o.facing));
  burst(scene, tex(scene, 'px_dot', T.dot), o.x, cy, 14, {
    x: { min: -12, max: 12 }, y: { min: -28, max: 28 },
    speed: { min: 80, max: 260 }, angle: { min: ang - 25, max: ang + 25 },
    lifespan: { min: 200, max: 420 }, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: ARCANE_TINTS,
  });
}

function vfxBlinkIn(scene: Phaser.Scene, o: VfxOptions) {
  const cy = o.y - 32;
  if (!pxFx(scene, 'sf_ring', o.x, cy, { v: 'arcane', scale: 4, add: true, dur: 300, depth: DEPTH.VFX_TOP })) {
    flash(scene, tex(scene, 'px_ring', T.ring), o.x, cy, { tint: VIOLET_LT, from: 2.2, to: 0.3, dur: 220, ease: 'Quad.easeIn' });
    flash(scene, tex(scene, 'px_flare', T.glow), o.x, cy, { tint: VIOLET, from: 0.4, to: 2, dur: 300, alpha: 0.85 });
  }
  burst(scene, tex(scene, 'px_star', T.star), o.x, cy, 8, {
    x: { min: -20, max: 20 }, y: { min: -30, max: 30 }, speed: { min: 10, max: 60 }, angle: { min: 0, max: 360 },
    lifespan: { min: 300, max: 600 }, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: [VIOLET_LT, CYAN_LT, WHITE],
  });
}

function vfxNovaCast(scene: Phaser.Scene, o: VfxOptions) {
  // Gathering: motes pulled inward toward the caster before the pulse.
  const em = scene.textures.exists(tex(scene, 'px_dot', T.dot)) ? scene.add.particles(0, 0, tex(scene, 'px_dot', T.dot), {
    emitting: false, lifespan: 160, scale: { start: 0.2, end: 1 }, alpha: { start: 0, end: 1 },
    tint: [VIOLET_LT, CYAN], blendMode: 'ADD',
    emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 70), quantity: 18 } as never,
    moveToX: 0, moveToY: 0,
  }) : null;
  if (em) {
    em.setPosition(o.x, o.y).setDepth(DEPTH.VFX);
    em.explode(18);
    scene.time.delayedCall(300, () => em.destroy());
  }
  flash(scene, T.rune, o.x, o.y, { tint: VIOLET_LT, from: 0.55, to: 0.25, dur: 160, alpha: 0.8, spin: -1 });
}

function vfxNova(scene: Phaser.Scene, o: VfxOptions) {
  const w = o.w ?? 240, h = o.h ?? 150;
  const r = w / 2;
  const delay = 120;
  // Ground rune spreading under the caster (pixelized rune, integer steps).
  flash(scene, T.rune, o.x, o.y + h * 0.2, { tint: VIOLET, from: 0.5, to: Math.max(1, Math.round((w / 160) * 2)) / 2, sy: 0.5, dur: 620, alpha: 0.95, delay: delay - 40, ease: 'Stepped' });
  // Pixel arcane burst + ring (CodeManu nebula / weapon-hit ring, arcane palette).
  const neb = pxFx(scene, 'cm_nebula', o.x, o.y, { v: 'arcane', scale: PIXEL_SCALE, add: true, delay, dur: 520, depth: DEPTH.VFX_TOP });
  if (neb) {
    pxFx(scene, 'cm_ring', o.x, o.y, { v: 'arcane', scale: w >= 200 ? 6 : 4, add: true, delay: delay + 40, depth: DEPTH.VFX_TOP });
  } else {
    flash(scene, tex(scene, 'px_ring', T.ring), o.x, o.y, { tint: CYAN, from: 0.3, to: r / 26, sy: h / w, dur: 380, delay });
    flash(scene, tex(scene, 'px_flare', T.glow), o.x, o.y, { tint: VIOLET, from: 0.6, to: r / 18, sy: h / w, dur: 360, delay, alpha: 0.6 });
  }
  scene.time.delayedCall(delay, () => {
    burst(scene, tex(scene, 'px_star', T.star), o.x, o.y, 12, {
      speed: { min: r * 1.2, max: r * 2.4 }, angle: { min: 0, max: 360 },
      lifespan: { min: 300, max: 520 }, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 },
      tint: ARCANE_TINTS,
    });
    burst(scene, tex(scene, 'px_dot', T.dot), o.x, o.y, 14, {
      speed: { min: r * 0.6, max: r * 1.8 }, angle: { min: 0, max: 360 },
      lifespan: { min: 300, max: 700 }, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: [VIOLET, CYAN, CYAN_LT],
    });
    try { scene.cameras.main.shake(90, 0.0025); } catch { /* ignore */ }
  });
}

function vfxNovaHit(scene: Phaser.Scene, o: VfxOptions) {
  const s = Math.max(0.7, Math.min(1.5, (o.h ?? 40) / 45));
  if (!pxFx(scene, 'spark', o.x, o.y, { scale: s >= 1.3 ? 4 : PIXEL_SCALE, tint: VIOLET_LT, add: true, depth: DEPTH.VFX_TOP })) {
    flash(scene, tex(scene, 'px_flare', T.glow), o.x, o.y, { tint: CYAN, from: 0.3 * s, to: 1.4 * s, dur: 220 });
  }
  burst(scene, tex(scene, 'px_dot', T.dot), o.x, o.y, 5, {
    speed: { min: 40, max: 140 }, angle: { min: 0, max: 360 }, lifespan: 320,
    scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: [CYAN_LT, VIOLET_LT],
  });
}

export function registerApprenticeVfx(): void {
  registerVfx('app_bolt_cast', vfxBoltCast);
  registerVfx('app_bolt', vfxBolt);
  registerVfx('app_bolt_hit', vfxBoltHit);
  registerVfx('app_claw', vfxClaw);
  registerVfx('app_claw_hit', vfxClawHit);
  registerVfx('app_shield_cast', vfxShieldCast);
  registerVfx('app_shield_aura', vfxShieldAura);
  registerVfx('app_blink_out', vfxBlinkOut);
  registerVfx('app_blink_in', vfxBlinkIn);
  registerVfx('app_nova_cast', vfxNovaCast);
  registerVfx('app_nova', vfxNova);
  registerVfx('app_nova_hit', vfxNovaHit);
}
