// OWNER: A3 (fire-tree). Lifetime for persistent onCast fire effects (mines, brands, channels, the wandering sun).
// Every effect steps on the scene's UPDATE event and ends on map change, player death or scene shutdown; it never
// steps while the player is dead or after the map it was cast on has been replaced.
import Phaser from 'phaser';
import { bus } from '../../core/events';
import type { GameServices, IMonster, SkillContext } from '../../core/types';

/**
 * Run `step(dtMs)` every frame until it returns false (natural end) or the effect is aborted.
 * `cleanup(aborted)` runs exactly once. Returns an abort function.
 */
export function persistent(ctx: SkillContext, step: (dt: number) => boolean, cleanup: (aborted: boolean) => void): () => void {
  const scene = ctx.scene;
  const s = ctx.services;
  const map = s.game.currentMap();
  let done = false;
  const offs: (() => void)[] = [];
  const finish = (aborted: boolean) => {
    if (done) return;
    done = true;
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
    offs.forEach(f => { try { f(); } catch { /* bus already cleared */ } });
    try { cleanup(aborted); } catch (e) { console.warn('[fire] effect cleanup failed', e); }
  };
  const abort = () => finish(true);
  const onUpdate = (_t: number, delta: number) => {
    if (done) return;
    if (!playerAlive(s) || s.game.currentMap() !== map) { abort(); return; }
    let more = false;
    try { more = step(Math.min(100, Math.max(0, delta))); } catch (e) { console.error('[fire] persistent effect', e); abort(); return; }
    if (!more) finish(false);
  };
  offs.push(bus.on('map:changed', abort), bus.on('player:died', abort));
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);
  return abort;
}

export function playerAlive(s: GameServices): boolean {
  try { return !s.progression.isDead() && s.player.state !== 'dead'; } catch { return false; }
}

/** Walkable surface at/below (x, y) on the current map, or `y` when none is found. */
export function groundAt(s: GameServices, x: number, y: number, maxDown = 420): number {
  try {
    const map = s.game.currentMap();
    if (map) for (let dy = 0; dy <= maxDown; dy += 4) { const p = map.platformAt(x, y + dy, 2); if (p) return p.y; }
  } catch { /* no map */ }
  return y;
}

/** Monster body centre (bounds when available). */
export function centerOf(m: IMonster): { x: number; y: number; h: number } {
  try { const b = m.getBounds(); return { x: b.centerX, y: b.centerY, h: b.height }; } catch { return { x: m.x, y: m.y - 30, h: 60 }; }
}

/** Destroy a GameObject with a short fade (safe if already gone). */
export function fadeOut(scene: Phaser.Scene, go: Phaser.GameObjects.GameObject | null | undefined, ms = 200): void {
  if (!go || !go.scene) return;
  try {
    scene.tweens.add({ targets: go, alpha: 0, duration: ms, onComplete: () => { if (go.scene) go.destroy(); } });
  } catch { go.destroy(); }
}
