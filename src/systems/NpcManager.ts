// OWNER: A9 (progression). STUB — replace with real implementation.
import Phaser from 'phaser';
import type { GameServices, IMapInstance, INpcManager } from '../core/types';
export class NpcManager implements INpcManager {
  constructor(private scene: Phaser.Scene, private services: GameServices) {}
  bindMap(map: IMapInstance) {}
  nearestInteractable(): string | null { return null; }
  interact(npcId: string) {}
  update(time: number, delta: number) {}
  clear() {}
}
