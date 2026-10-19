import Phaser from 'phaser';
import type { SkillContext } from '../../core/types';
import { bus } from '../../core/events';
import { playVfx } from '../../core/vfx';

const wards = new WeakMap<Phaser.Scene, () => void>();

/** Exact rectangle trigger; a recast replaces the old ward, including its listeners. */
export function castPracticeWard(ctx: SkillContext, lv: number): void {
  const { scene, services, skill } = ctx;
  const p = services.player, spec = skill.summon!;
  if (services.progression.isDead() || p.state === 'dead') return;
  wards.get(scene)?.();
  const x = p.x + spec.offset.x * p.facing, y = p.y + spec.offset.y;
  const a = spec.attack.area!;
  const rect = new Phaser.Geom.Rectangle(x - a.w / 2, y - a.h / 2, a.w, a.h);
  const visual = playVfx(scene, spec.vfx, { x, y, facing: 1, durationMs: spec.durationMs(lv), lv });
  const map = services.game.currentMap();
  let remaining = spec.durationMs(lv), untilPulse = 0, stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    scene.events.off(Phaser.Scenes.Events.UPDATE, update);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stop);
    offMap(); offDeath();
    visual?.destroy();
    if (wards.get(scene) === stop) wards.delete(scene);
  };
  const update = (_time: number, delta: number) => {
    if (stopped) return;
    if (services.progression.isDead() || p.state === 'dead' || services.game.currentMap() !== map) {
      stop(); return;
    }
    const dt = Math.min(100, Math.max(0, delta));
    remaining -= dt;
    if (remaining <= 0) { stop(); return; }
    untilPulse -= dt;
    if (untilPulse > 0) return;
    const inside = services.monsters.inRect(rect).some(m => m.alive && Phaser.Geom.Rectangle.Overlaps(rect, m.getBounds()));
    if (!inside) return;
    untilPulse = spec.attackIntervalMs;
    // One synchronous line, no delayed work that could outlive this field.
    ctx.runAttack(spec.attack, { x, y, facing: 1 });
  };
  const offMap = bus.on('map:changed', stop);
  const offDeath = bus.on('player:died', stop);
  wards.set(scene, stop);
  scene.events.on(Phaser.Scenes.Events.UPDATE, update);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
}
