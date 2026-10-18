/** Global service locator (set by GameScene). Owned by the lead — do not edit. */
import type { GameServices } from './types';

let current: GameServices | null = null;
export function setServices(s: GameServices | null) { current = s; }
export function services(): GameServices {
  if (!current) throw new Error('services not initialised');
  return current;
}
export function maybeServices(): GameServices | null { return current; }
