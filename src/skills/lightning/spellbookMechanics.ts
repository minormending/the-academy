// Only Phase 9 spells use these custom casts; all damage still runs through the shared AttackSpec engine.
import Phaser from 'phaser';
import { bus } from '../../core/events';
import type { SkillContext } from '../../core/types';
import { playVfx } from '../../core/vfx';
import { lerpLv } from './shared';

type Origin = { x: number; y: number; facing: 1 | -1 };
const active = new WeakMap<Phaser.Scene, Map<string, () => void>>();
const dead = (ctx: SkillContext): boolean => ctx.services.progression.isDead() || ctx.services.player.state === 'dead';
const origin = (ctx: SkillContext): Origin => {
  const p = ctx.services.player;
  return { x: p.x + 18 * p.facing, y: p.y - 34, facing: p.facing };
};

/** One instance per skill and scene. Every exit removes timers, listeners and the owned visual. */
function lifetime(ctx: SkillContext, duration: number, visual?: Phaser.GameObjects.GameObject | void) {
  const { scene } = ctx;
  let instances = active.get(scene);
  if (!instances) { instances = new Map(); active.set(scene, instances); }
  instances.get(ctx.skill.id)?.();
  let stopped = false;
  const expiresAt = scene.time.now + duration;
  const timers: Phaser.Time.TimerEvent[] = [];
  const disposers: (() => void)[] = [];
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    for (const timer of timers) timer.remove(false);
    for (const dispose of disposers) dispose();
    scene.events.off(Phaser.Scenes.Events.UPDATE, check);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stop);
    if (instances!.get(ctx.skill.id) === stop) instances!.delete(ctx.skill.id);
    visual?.destroy();
  };
  const check = (): void => { if (dead(ctx) || scene.time.now >= expiresAt) stop(); };
  const alive = (): boolean => { check(); return !stopped; };
  const every = (delay: number, fn: () => void): void => {
    if (stopped) return;
    timers.push(scene.time.addEvent({ delay, loop: true, callback: () => { if (alive()) fn(); } }));
  };
  disposers.push(bus.on('map:changed', stop), bus.on('player:died', stop));
  scene.events.on(Phaser.Scenes.Events.UPDATE, check);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  visual?.once(Phaser.GameObjects.Events.DESTROY, stop);
  instances.set(ctx.skill.id, stop);
  timers.push(scene.time.delayedCall(duration, stop));
  return { stop, alive, every, disposers };
}

/** Exact rectangle wake-up, unlike the engine's broad summon acquisition circle. */
export function plantField(ctx: SkillContext, lv: number, casterMustStay: boolean): void {
  if (dead(ctx) || !ctx.skill.summon) return;
  const p = ctx.services.player, spec = ctx.skill.summon, a = spec.attack.area!;
  const map = ctx.services.game.currentMap();
  const x = Phaser.Math.Clamp(p.x + spec.offset.x * p.facing, 0, map?.widthPx ?? Number.MAX_SAFE_INTEGER);
  const at: Origin = { x, y: p.y + spec.offset.y, facing: p.facing };
  const rect = new Phaser.Geom.Rectangle(at.x - a.w / 2, at.y - a.h / 2, a.w, a.h);
  const visual = playVfx(ctx.scene, spec.vfx, { ...at, groundY: p.y, w: a.w, h: a.h, lv });
  const scope = lifetime(ctx, spec.durationMs(lv), visual);
  const pulse = (): void => {
    if (!scope.alive()) return;
    const inside = !casterMustStay || rect.contains(p.x, p.y - 34);
    // Dim the lattice when leaving it, so the proximity rule is visible.
    if (visual && 'setAlpha' in visual) (visual as Phaser.GameObjects.Container).setAlpha(inside ? 1 : 0.3);
    if (inside && ctx.services.monsters.inRect(rect).some(m => m.alive)) ctx.runAttack(spec.attack, at);
  };
  // Pulses at t=0 and then each interval, never on/after the expiry boundary.
  pulse();
  scope.every(spec.attackIntervalMs, pulse);
}

export function bloodDynamo(ctx: SkillContext, lv: number): void {
  if (dead(ctx)) return;
  const { progression, combat, player } = ctx.services;
  const d = progression.derived();
  const fullCost = Math.max(1, Math.round(d.maxHp * 0.12));
  const fullReturn = Math.max(1, Math.round(d.maxMp * lerpLv(0.1, 0.18, lv, 10)));
  const hp = Math.min(fullCost, Math.max(0, progression.state.hp - 1),
    Math.ceil(Math.max(0, d.maxMp - progression.state.mp) * fullCost / fullReturn));
  const mp = Math.floor(fullReturn * hp / fullCost);
  if (hp > 0 && mp > 0) {
    progression.loseHp(hp);
    if (dead(ctx)) return;
    const before = progression.state.mp;
    progression.heal(0, mp);
    combat.showNumber(player.x, player.y - 60, hp, 'player');
    const gained = progression.state.mp - before;
    if (gained > 0) combat.showNumber(player.x, player.y - 82, gained, 'mp');
  }
  playVfx(ctx.scene, 'ltn_dynamo_exchange', { x: player.x, y: player.y, facing: player.facing, lv });
}

export function arcSkate(ctx: SkillContext, lv: number): void {
  if (dead(ctx) || !ctx.skill.movement || !ctx.skill.attack) return;
  const p = ctx.services.player, move = ctx.skill.movement;
  const from = { x: p.x, y: p.y - 34, facing: p.facing };
  const facing = p.getAimDir().x || p.facing;
  playVfx(ctx.scene, move.vfxOut, { x: p.x, y: p.y, facing, lv });
  p.blink(move.distance(lv) * facing, 0);
  const distance = Math.abs(p.x - from.x);
  // Collision-clamped travel determines both damage reach and the drawn trail.
  if (distance > 0) ctx.runAttack({ ...ctx.skill.attack, range: distance }, { ...from, facing: p.x >= from.x ? 1 : -1 });
  playVfx(ctx.scene, move.vfxIn, { x: p.x, y: p.y, facing, lv });
}

export function channelArcs(ctx: SkillContext, lv: number): void {
  if (dead(ctx) || !ctx.skill.attack) return;
  const at = origin(ctx), p = ctx.services.player;
  const startX = p.x, startY = p.y;
  const visual = playVfx(ctx.scene, 'ltn_channel_focus', { ...at, lv });
  if (visual && 'setScale' in visual) (visual as Phaser.GameObjects.Container).setScale(at.facing, 1);
  const scope = lifetime(ctx, 1000, visual);
  const stationary = (): boolean => Math.hypot(p.x - startX, p.y - startY) <= 24;
  const checkStance = (): void => { if (!stationary()) scope.stop(); };
  ctx.scene.events.on(Phaser.Scenes.Events.UPDATE, checkStance);
  scope.disposers.push(() => ctx.scene.events.off(Phaser.Scenes.Events.UPDATE, checkStance));
  let pulses = 0;
  const pulse = (): void => {
    if (!scope.alive()) return;
    if (!stationary()) { scope.stop(); return; }
    if (pulses++ < 5) ctx.runAttack(ctx.skill.attack!, at);
  };
  pulse();
  scope.every(200, pulse);
}

export function tempestReprisal(ctx: SkillContext, lv: number): void {
  if (dead(ctx) || !ctx.skill.attack) return;
  const p = ctx.services.player;
  const visual = playVfx(ctx.scene, ctx.skill.buff?.auraVfx, { x: p.x, y: p.y, facing: p.facing, lv });
  const scope = lifetime(ctx, ctx.skill.buff!.durationMs(lv), visual);
  const follow = (): void => {
    if (!scope.alive()) return;
    if (visual && 'setPosition' in visual) {
      (visual as Phaser.GameObjects.Container).setPosition(p.x, p.y).setScale(p.facing, 1);
    }
  };
  ctx.scene.events.on(Phaser.Scenes.Events.UPDATE, follow);
  scope.disposers.push(() => ctx.scene.events.off(Phaser.Scenes.Events.UPDATE, follow));
  follow();
  let charges = 3, readyAt = -Infinity;
  scope.disposers.push(bus.on('player:damaged', ({ amount }) => {
    if (!scope.alive() || amount <= 0 || ctx.scene.time.now < readyAt) return;
    // Combat emits player:damaged before subtracting HP; lethal damage must not trigger a final retaliation.
    if (amount >= ctx.services.progression.state.hp) { scope.stop(); return; }
    readyAt = ctx.scene.time.now + 700;
    // Use the body center rather than the staff tip for an even counterattack on both sides.
    ctx.runAttack(ctx.skill.attack!, { x: p.x, y: p.y - 34, facing: p.facing });
    if (--charges === 0) scope.stop();
  }));
}
