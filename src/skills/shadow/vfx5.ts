// Year 5 (Night Archon) VFX: no new textures — recolours the existing shadow glyphs and CC0 sheets with a gilded
// accent. Everything is created through the School's lazy path (the callers sit behind lazyRegister('shadow')).
import Phaser from 'phaser';
import type { VfxFn, VfxOptions } from '../../core/types';
import { DEPTH } from '../../core/constants';
import { C, ST } from './textures';
import { fade, image, loop, motes, root, sheet } from './fx';

const GOLD = 0xe6c15a, BLOOD = 0xc76c85;
/** Cheap camera punch; shakes are skipped if the camera is unavailable (e.g. torn-down scene). */
const punch = (scene: Phaser.Scene, ms: number, force: number) => { try { scene.cameras.main.shake(ms, force); } catch { /* ignore */ } };
const dist = (o: VfxOptions, fallback: number) => {
  const dx = (o.targetX ?? o.x + o.facing * fallback) - o.x, dy = (o.targetY ?? o.y) - o.y;
  return { dx, dy, len: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
};

export function cascadeArea(scene: Phaser.Scene, o: VfxOptions): void {
  const w = o.w ?? 340, h = o.h ?? 210;
  const dark = sheet(scene, 'cm_midnight', o.x, o.y, { scale: 4, dur: 520, alpha: 0.8 }) ?? image(scene, ST.cloud, o.x, o.y, 4);
  dark.setTint(C.violet); fade(scene, dark, 540);
  // Three crushing rings, one per hit line (damage lands at 300/560/820ms).
  for (let i = 0; i < 3; i++) {
    const ring = image(scene, ST.ring, o.x, o.y - h / 2 + 20, 5).setTint(i === 1 ? GOLD : C.lilac).setAlpha(0.9);
    scene.tweens.add({ targets: ring, y: o.y, alpha: 0, scaleX: w / 32, scaleY: 3, duration: 460, delay: i * 260,
      onComplete: () => { if (ring.scene) ring.destroy(); } });
    ring.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf(ring));
  }
  motes(scene, o.x, o.y, 6, true);
  punch(scene, 140, 0.002);
}

export function cascadeHit(scene: Phaser.Scene, o: VfxOptions): void {
  const moon = image(scene, ST.skull, o.x, o.y - 10).setTint(GOLD);
  fade(scene, moon, 380, { y: o.y - 28, scaleX: 3, scaleY: 3 });
}

export function requiemCast(scene: Phaser.Scene, o: VfxOptions): void {
  for (const side of [-1, 1]) {
    const bone = image(scene, ST.bone, o.x, o.y + side * 26).setTint(GOLD);
    fade(scene, bone, 320, { y: o.y, x: o.x + o.facing * 34 });
  }
  const flash = sheet(scene, 'g9_spark', o.x + o.facing * 10, o.y, { dur: 320 });
  if (flash) { flash.setTint(GOLD); flash.setBlendMode(Phaser.BlendModes.ADD); }
}

export function requiemProj(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o);
  const spine = sheet(scene, 'ss_icespear', -48, 0, { loop: true, scale: 3 }) ?? image(scene, ST.bolt, -26, 0, 3);
  spine.setTint(GOLD); c.add(spine);
  for (const x of [-44, -26, -8]) c.add(image(scene, ST.bone, x, 0, 3).setRotation(Math.PI / 2).setTint(C.pale));
  const tail = image(scene, ST.mote, -64, 0).setTint(C.violet);
  c.add(tail); loop(scene, c, { targets: tail, alpha: 0.2, duration: 160, yoyo: true });
  return c;
}

export function requiemHit(scene: Phaser.Scene, o: VfxOptions): void {
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const bone = image(scene, ST.bone, o.x, o.y).setRotation(a).setTint(i % 2 ? C.pale : GOLD);
    fade(scene, bone, 420, { x: o.x + Math.cos(a) * 38, y: o.y + Math.sin(a) * 30 });
  }
  const burst = sheet(scene, 'g9_darkbolt', o.x, o.y, { scale: 3, dur: 420 });
  if (burst) { burst.setTint(GOLD); burst.setBlendMode(Phaser.BlendModes.ADD); }
  const ring = image(scene, ST.ring, o.x, o.y, 1).setTint(GOLD);
  fade(scene, ring, 300, { scaleX: 4, scaleY: 4 });
  motes(scene, o.x, o.y, 5);
  punch(scene, 90, 0.0022);
}

export function fellowshipCast(scene: Phaser.Scene, o: VfxOptions): void {
  const gate = sheet(scene, 'cm_vortex', o.x, o.y - 110, { scale: 6, dur: 1100, alpha: 0.9 })
    ?? image(scene, ST.ring, o.x, o.y - 110, 6);
  gate.setTint(GOLD); fade(scene, gate, 1120);
  // The fellowship: five spectral figures rise around the caster and fade as the rain begins.
  for (let i = -2; i <= 2; i++) {
    const ghost = image(scene, ST.wraith, o.x + i * 46, o.y - 6).setTint(i === 0 ? GOLD : C.lilac).setAlpha(0.85);
    fade(scene, ghost, 950, { y: o.y - 64 - (2 - Math.abs(i)) * 8 });
  }
  motes(scene, o.x, o.y - 20, 6, true);
  punch(scene, 260, 0.0018);
}

export function fellowshipProj(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o);
  // Shaft trails to -x; the engine turns +x down for rain. Root transform is never tweened.
  c.add(image(scene, ST.scythe, -44, 0, 3).setTint(GOLD));
  const tail = sheet(scene, 'sf_ring', -28, 0, { loop: true, alpha: 0.7 }) ?? image(scene, ST.mote, -28, 0);
  tail.setTint(C.lilac); c.add(tail);
  loop(scene, c, { targets: tail, alpha: 0.3, duration: 170, yoyo: true });
  return c;
}

export function fellowshipImpact(scene: Phaser.Scene, o: VfxOptions): void {
  const y = o.y - Math.min(o.h ?? 170, 170) / 2;
  const boom = sheet(scene, 'cm_midnight', o.x, y, { scale: 4, dur: 520 }) ?? image(scene, ST.cloud, o.x, y, 4);
  boom.setTint(GOLD); boom.setBlendMode(Phaser.BlendModes.ADD); fade(scene, boom, 540);
  const smoke = sheet(scene, 'cm_nebula', o.x, y, { dur: 560, alpha: 0.6 }) ?? image(scene, ST.slash, o.x, y);
  smoke.setTint(C.violet); fade(scene, smoke, 580);
  const ring = image(scene, ST.ring, o.x, o.y - 4, 3).setTint(GOLD);
  fade(scene, ring, 420, { scaleX: 6, scaleY: 2 });
  motes(scene, o.x, o.y - 12, 6, true);
}

export function warden(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o).setDepth(DEPTH.SUMMON);
  const halo = sheet(scene, 'cm_shield', 0, 8, { loop: true, scale: 3, alpha: 0.4, fps: 10 }) ?? image(scene, ST.ring, 0, 20, 3);
  halo.setTint(GOLD); c.add(halo);
  // A big gilded skeleton, drawn at 3x so it reads as larger than the 2x Raise Skeleton.
  const body = image(scene, ST.skeleton, 0, -8, 3).setTint(0xf2dc9a);
  c.add(body);
  c.add(image(scene, ST.skull, 0, -62, 2).setTint(GOLD));
  for (const x of [-34, 34]) c.add(image(scene, ST.bone, x, 16, 3).setRotation(Math.PI / 2).setTint(C.violet));
  loop(scene, c, { targets: body, y: -11, duration: 900, yoyo: true, ease: 'Stepped', easeParams: [2] });
  return c;
}

export function wardenPulse(scene: Phaser.Scene, o: VfxOptions): void {
  const rx = (o.w ?? 360) / 2;
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const bone = image(scene, ST.bone, o.x, o.y + 28).setRotation(Math.PI / 2).setTint(i === 1 ? GOLD : C.lilac);
    fade(scene, bone, 420 + i * 40, { x: o.x + side * rx * (0.4 + i * 0.3), y: o.y - 8 - i * 6 });
  }
  const wave = sheet(scene, 'cm_shield', o.x, o.y, { scale: 4, dur: 480, alpha: 0.6 }) ?? image(scene, ST.ring, o.x, o.y, 4);
  wave.setTint(C.violet); fade(scene, wave, 500);
  const shock = image(scene, ST.ring, o.x, o.y + 24, 2).setTint(GOLD);
  fade(scene, shock, 360, { scaleX: rx / 16, scaleY: 3 });
  punch(scene, 70, 0.0015);
}

export function reckonCast(scene: Phaser.Scene, o: VfxOptions): void {
  const scythe = image(scene, ST.scythe, o.x - 40, o.y + 10, 3).setTint(GOLD).setRotation(-0.9);
  fade(scene, scythe, 420, { x: o.x + 40, rotation: 0.9, y: o.y - 14 });
}

function sweep(scene: Phaser.Scene, o: VfxOptions, tint: number, glyph: string, count: number): void {
  const rx = (o.w ?? 340) / 2;
  const slash = sheet(scene, 'sf_slash', o.x, o.y, { scale: 5, dur: 420, flipX: o.facing < 0 });
  if (slash) { slash.setTint(tint); slash.setBlendMode(Phaser.BlendModes.ADD); }
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : -1 + 2 * i / (count - 1);
    const mark = image(scene, glyph, o.x + t * rx * 0.8, o.y + 4).setTint(tint);
    fade(scene, mark, 480, { y: o.y - 34, x: o.x + t * rx * 0.4 });
  }
}
export function reckonPoison(scene: Phaser.Scene, o: VfxOptions): void { sweep(scene, o, C.green, ST.mote, 7); }
export function reckonCurse(scene: Phaser.Scene, o: VfxOptions): void { sweep(scene, o, C.lilac, ST.shackle, 5); }

export function ledger(scene: Phaser.Scene, o: VfxOptions): void {
  const book = image(scene, ST.skull, o.x, o.y - 36, 2).setTint(BLOOD);
  fade(scene, book, 600, { y: o.y - 70 });
  for (const side of [-1, 1]) {
    const drop = image(scene, ST.mote, o.x, o.y - 30).setTint(BLOOD);
    fade(scene, drop, 480, { x: o.x + side * 60, y: o.y - 50 });
  }
}

export function ledgerArea(scene: Phaser.Scene, o: VfxOptions): void {
  const rx = (o.w ?? 340) / 2;
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    // Souls stream in from the foes to the caster: the drain half of the trade.
    const soul = image(scene, ST.mote, o.x + side * rx * (0.5 + i * 0.25), o.y - 10 + i * 8).setTint(i % 2 ? GOLD : BLOOD);
    fade(scene, soul, 520, { x: o.x, y: o.y - 34 });
  }
  const ring = sheet(scene, 'cm_nebula', o.x, o.y, { scale: 4, dur: 480, alpha: 0.55 }) ?? image(scene, ST.ring, o.x, o.y, 4);
  ring.setTint(BLOOD); fade(scene, ring, 500);
}

export function riftOut(scene: Phaser.Scene, o: VfxOptions): void {
  const veil = sheet(scene, 'cm_midnight', o.x, o.y, { dur: 380 }) ?? image(scene, ST.cloud, o.x, o.y);
  veil.setTint(GOLD); fade(scene, veil, 400);
}

export function riftPath(scene: Phaser.Scene, o: VfxOptions): void {
  const { dx, dy, len, angle } = dist(o, 300);
  const n = Math.min(14, Math.max(1, Math.ceil(len / 44)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const shard = image(scene, i % 2 ? ST.bone : ST.shackle, o.x + dx * t, o.y + dy * t).setRotation(angle).setTint(i % 2 ? GOLD : C.lilac);
    fade(scene, shard, 360 + i * 22, { y: shard.y - 10 });
  }
}

export function riftOpen(scene: Phaser.Scene, o: VfxOptions): Phaser.GameObjects.Container {
  const c = root(scene, o), floor = (o.groundY ?? o.y + 34) - o.y;
  const rift = sheet(scene, 'cm_vortex', 0, floor - 36, { loop: true, scale: 3, alpha: 0.85, fps: 14 }) ?? image(scene, ST.ring, 0, floor - 36, 3);
  rift.setTint(C.violet); c.add(rift);
  const core = image(scene, ST.mote, 0, floor - 36, 3).setTint(GOLD);
  c.add(core); loop(scene, c, { targets: core, alpha: 0.25, duration: 220, yoyo: true });
  return c;
}

export function riftBurst(scene: Phaser.Scene, o: VfxOptions): void {
  const floor = o.groundY ?? o.y + 34;
  for (let i = -2; i <= 2; i++) {
    const spike = image(scene, ST.bone, o.x + i * 44, floor).setRotation(Math.PI / 2).setTint(i % 2 ? GOLD : C.green);
    fade(scene, spike, 380, { y: o.y - 22 - (2 - Math.abs(i)) * 10 });
  }
  const cloud = sheet(scene, 'cm_nebula', o.x, o.y, { dur: 460, alpha: 0.7 }) ?? image(scene, ST.cloud, o.x, o.y);
  cloud.setTint(C.green); fade(scene, cloud, 480);
  motes(scene, o.x, o.y, 5, true);
  const ring = image(scene, ST.ring, o.x, floor, 2).setTint(C.green);
  fade(scene, ring, 380, { scaleX: 9, scaleY: 2 });
  punch(scene, 110, 0.0024);
}

/** Called once from shadowVfx.ts with the School's lazy `registerVfx`, so textures exist before any of these play. */
export function registerShadowYear5Vfx(reg: (key: string, fn: VfxFn) => void): void {
  reg('shd_cascade_area', cascadeArea);
  reg('shd_cascade_hit', cascadeHit);
  reg('shd_requiem_cast', requiemCast);
  reg('shd_requiem_proj', requiemProj);
  reg('shd_requiem_hit', requiemHit);
  reg('shd_fellowship_cast', fellowshipCast);
  reg('shd_fellowship_proj', fellowshipProj);
  reg('shd_fellowship_impact', fellowshipImpact);
  reg('shd_warden', warden);
  reg('shd_warden_pulse', wardenPulse);
  reg('shd_reckon_cast', reckonCast);
  reg('shd_reckon_poison', reckonPoison);
  reg('shd_reckon_curse', reckonCurse);
  reg('shd_ledger', ledger);
  reg('shd_ledger_area', ledgerArea);
  reg('shd_rift_out', riftOut);
  reg('shd_rift_path', riftPath);
  reg('shd_rift_open', riftOpen);
  reg('shd_rift_burst', riftBurst);
}
