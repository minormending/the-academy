/** VFX registry. Owned by the lead — do not edit. Tree modules register their effects here. */
import Phaser from 'phaser';
import type { VfxFn, VfxOptions } from './types';
import { DEPTH } from './constants';

const registry = new Map<string, VfxFn>();
const warned = new Set<string>();

export function registerVfx(key: string, fn: VfxFn): void {
  if (registry.has(key)) console.warn(`[vfx] duplicate key ${key} (overwriting)`);
  registry.set(key, fn);
}

export function hasVfx(key: string): boolean { return registry.has(key); }

/** Play a VFX. Missing keys fall back to a generic puff so nothing crashes. */
export function playVfx(scene: Phaser.Scene, key: string | undefined, o: VfxOptions): Phaser.GameObjects.GameObject | void {
  if (!key) return;
  const fn = registry.get(key);
  if (fn) return fn(scene, o);
  if (!warned.has(key)) { warned.add(key); console.warn(`[vfx] missing key "${key}"`); }
  const c = scene.add.circle(o.x, o.y, 10, 0xffffff, 0.8).setDepth(DEPTH.VFX);
  scene.tweens.add({ targets: c, scale: 2.5, alpha: 0, duration: 250, onComplete: () => c.destroy() });
}
