import Phaser from 'phaser';
import { bus } from '../../core/events';
import type { SkillContext } from '../../core/types';

const active = new WeakMap<Phaser.Scene, Map<string, () => void>>();

/** One custom field per skill/scene, with ownership of every timer, listener and persistent visual. */
export function spellLifetime(ctx: SkillContext, durationMs: number) {
  const { scene, services, skill } = ctx;
  let entries = active.get(scene);
  if (!entries) { entries = new Map(); active.set(scene, entries); }
  entries.get(skill.id)?.();
  const map = services.game.currentMap();
  const timers = new Set<Phaser.Time.TimerEvent>();
  const visuals = new Set<Phaser.GameObjects.GameObject>();
  let ended = false;
  const stop = () => {
    if (ended) return;
    ended = true;
    for (const timer of timers) timer.remove(false);
    for (const visual of visuals) if (visual.scene) visual.destroy();
    timers.clear(); visuals.clear();
    bus.off('map:changed', stop);
    bus.off('player:died', stop);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stop);
    scene.events.off(Phaser.Scenes.Events.DESTROY, stop);
    if (entries.get(skill.id) === stop) entries.delete(skill.id);
  };
  const alive = () => {
    if (ended) return false;
    if (services.progression.isDead() || services.player.state === 'dead' ||
        services.game.currentMap() !== map) { stop(); return false; }
    return true;
  };
  const after = (ms: number, fn: () => void) => {
    if (ended) return;
    const timer = scene.time.delayedCall(ms, () => {
      timers.delete(timer);
      if (!alive()) return;
      try { fn(); } catch (error) { stop(); console.warn(`[shadow] ${skill.id}`, error); }
    });
    timers.add(timer);
  };
  entries.set(skill.id, stop);
  bus.on('map:changed', stop);
  bus.on('player:died', stop);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  scene.events.once(Phaser.Scenes.Events.DESTROY, stop);
  after(durationMs, stop);
  return {
    alive, after, stop,
    own(visual: Phaser.GameObjects.GameObject | void) {
      if (!visual) return;
      if (ended) visual.destroy(); else visuals.add(visual);
    },
  };
}
