/** Phase 9 custom casts. All world effects have one owner per scene/skill. */
import Phaser from 'phaser';
import { bus } from '../../core/events';
import { playVfx } from '../../core/vfx';
import type { SkillContext, VfxOptions } from '../../core/types';

interface WorldEffect { x: number; y: number; stop: () => void }
const effects = new WeakMap<Phaser.Scene, Map<string, WorldEffect>>();

function living(ctx: SkillContext): boolean {
  return !ctx.services.progression.isDead() && ctx.services.player.state !== 'dead';
}

/** Own the visual, update callback and every subscription; stop is idempotent. */
function worldEffect(ctx: SkillContext, key: string, o: VfxOptions, duration: number,
  tick?: (go: Phaser.GameObjects.GameObject | void, stop: () => void) => void,
  onStop?: () => void): WorldEffect {
  let owned = effects.get(ctx.scene);
  if (!owned) { owned = new Map(); effects.set(ctx.scene, owned); }
  owned.get(ctx.skill.id)?.stop();
  const map = ctx.services.game.currentMap();
  const go = playVfx(ctx.scene, key, o);
  let stopped = false, remaining = duration;
  const update = (_time: number, delta: number) => {
    if (stopped) return;
    remaining -= Math.max(0, Math.min(100, delta));
    if (!living(ctx) || ctx.services.game.currentMap() !== map || remaining <= 0) { stop(); return; }
    tick?.(go, stop);
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    offMap(); offDeath();
    onStop?.();
    ctx.scene.events.off(Phaser.Scenes.Events.UPDATE, update);
    ctx.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stop);
    if (owned.get(ctx.skill.id) === effect) owned.delete(ctx.skill.id);
    go?.destroy();
  };
  const effect: WorldEffect = { x: o.x, y: o.y, stop };
  const offMap = bus.on('map:changed', stop);
  const offDeath = bus.on('player:died', stop);
  ctx.scene.events.on(Phaser.Scenes.Events.UPDATE, update);
  ctx.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  go?.once(Phaser.GameObjects.Events.DESTROY, stop);
  owned.set(ctx.skill.id, effect);
  return effect;
}

export function castRimeSnare(ctx: SkillContext, lv: number): void {
  if (!living(ctx) || !ctx.skill.summon) return;
  const p = ctx.services.player, spec = ctx.skill.summon;
  const map = ctx.services.game.currentMap();
  const x = Phaser.Math.Clamp(p.x + spec.offset.x * p.facing, 20, Math.max(20, (map?.widthPx ?? p.x + 400) - 20));
  const floor = map?.platformAt(x, p.y, 100);
  const feet = floor?.y ?? p.y;
  const y = feet - 34, area = spec.attack.area!;
  const trigger = new Phaser.Geom.Rectangle(x - area.w / 2, y - area.h / 2, area.w, area.h);
  let armedIn = 300, last = ctx.scene.time.now;
  worldEffect(ctx, spec.vfx, { x, y, facing: 1, groundY: feet, lv }, spec.durationMs(lv), (_go, stop) => {
    const now = ctx.scene.time.now;
    armedIn -= Math.max(0, now - last); last = now;
    if (armedIn > 0) return;
    if (!ctx.services.monsters.inRect(trigger).some(m => m.alive)) return;
    stop(); // Consume before damage: callbacks cannot retrigger this mine.
    ctx.runAttack(spec.attack, { x, y, facing: 1 });
  });
}

export function castRimeBrand(ctx: SkillContext, lv: number): void {
  if (!living(ctx)) return;
  const { player: p, monsters, combat } = ctx.services;
  const target = monsters.nearest(p.x + 18 * p.facing, p.y - 34, 460, p.facing, 140);
  // Recasting also clears a previous mark when the new cast has no target.
  effects.get(ctx.scene)?.get(ctx.skill.id)?.stop();
  playVfx(ctx.scene, 'ice_rime_brand_cast', { x: p.x, y: p.y - 34, facing: p.facing, lv });
  if (!target) return;
  let hits = 0, offHit = () => {};
  const effect = worldEffect(ctx, 'ice_rime_brand_mark', {
    x: target.x, y: target.y - target.def.size.h - 18, facing: 1, lv,
  }, 8000, (go, stop) => {
    if (!target.alive) { stop(); return; }
    if (go instanceof Phaser.GameObjects.Container) go.setPosition(target.x, target.y - target.def.size.h - 18);
  }, () => offHit());
  offHit = bus.on('monster:damaged', event => {
    if (event.monster !== target || event.element !== 'ice' || event.amount <= 0) return;
    if (!living(ctx) || !target.alive) { effect.stop(); return; }
    if (++hits < 3) return;
    effect.stop();
    combat.tryApplyStatus(target, {
      kind: 'freeze', chance: () => 1, durationMs: () => Math.round(1500 + 1100 * (lv - 1) / 9), potency: () => 0,
    }, lv, 'ice', 0);
    playVfx(ctx.scene, 'ice_rime_brand_bloom', { x: target.x, y: target.y - target.def.size.h / 2, facing: 1, lv });
  });
}

export function castFractureRoute(ctx: SkillContext, lv: number): void {
  if (!living(ctx) || !ctx.skill.attack || !ctx.skill.movement) return;
  const p = ctx.services.player, x = p.x, y = p.y, facing = p.facing;
  p.blink(-facing * ctx.skill.movement.distance(lv), 0);
  const distance = Math.abs(p.x - x);
  if (distance < 2) return;
  // Use the actual clamped blink path, not the requested distance (walls/map edges matter).
  ctx.runAttack({ ...ctx.skill.attack, area: { w: distance + 28, h: Math.abs(p.y - y) + 80 } }, {
    x: (x + p.x) / 2, y: (y + p.y) / 2 - 34, facing,
  });
}

export function castColdExchange(ctx: SkillContext, lv: number): void {
  if (!living(ctx)) return;
  const { player: p, progression, combat, monsters } = ctx.services;
  const rect = new Phaser.Geom.Rectangle(p.x - 260, p.y - 174, 520, 240);
  const targets = monsters.inRect(rect).filter(m => m.alive && m.hasStatus('freeze'))
    .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x)).slice(0, 3);
  for (const m of targets) {
    m.removeStatus('freeze');
    playVfx(ctx.scene, 'ice_cold_exchange_drain', {
      x: m.x, y: m.y - m.def.size.h / 2, targetX: p.x, targetY: p.y - 34, facing: p.facing, lv,
    });
  }
  if (!living(ctx)) return;
  const before = progression.state.mp;
  progression.heal(0, Math.round(progression.derived().maxMp * (0.03 + 0.02 * (lv - 1) / 9) * targets.length));
  const gained = progression.state.mp - before;
  if (gained > 0) combat.showNumber(p.x, p.y - 76, gained, 'mp');
  playVfx(ctx.scene, 'ice_cold_exchange_cast', { x: p.x, y: p.y, facing: p.facing, lv });
}

export function castRimeRecall(ctx: SkillContext, lv: number): void {
  if (!living(ctx) || !ctx.skill.attack) return;
  const p = ctx.services.player;
  const anchor = effects.get(ctx.scene)?.get(ctx.skill.id);
  if (anchor) {
    const { x, y } = anchor;
    anchor.stop();
    ctx.runAttack(ctx.skill.attack, { x: p.x, y: p.y - 34, facing: p.facing });
    p.blink(x - p.x, y - p.y);
    playVfx(ctx.scene, 'ice_rime_recall_arrive', { x: p.x, y: p.y, facing: p.facing, lv });
  } else {
    worldEffect(ctx, 'ice_rime_recall_anchor', { x: p.x, y: p.y, facing: 1, lv }, 6000 + 4000 * (lv - 1) / 9);
    playVfx(ctx.scene, 'ice_rime_recall_arrive', { x: p.x, y: p.y, facing: p.facing, lv });
  }
}

export function castDiamondReckoning(ctx: SkillContext): void {
  if (!living(ctx) || !ctx.skill.attack) return;
  const { player: p, skills } = ctx.services;
  // Prefer the short barrier; never strip both defenses for one cast.
  const active = skills.getActiveBuffs();
  const armor = ['ice_diamond_barrier', 'ice_frost_armor'].find(id => active.some(b => b.skillId === id));
  if (armor) skills.cancelBuff(armor);
  const attack = ctx.skill.attack;
  ctx.runAttack({ ...attack, damagePct: lv => attack.damagePct(lv) * (armor ? 2 : 1) }, {
    x: p.x + 18 * p.facing, y: p.y - 34, facing: p.facing,
  });
}
