// OWNER: A6 (monsters). STUB — replace with real implementation.
import Phaser from 'phaser';
import type { GameServices, IDropManager, IMapInstance, MonsterDef } from '../core/types';
export class DropManager implements IDropManager {
  constructor(private scene: Phaser.Scene, private services: GameServices) {}
  dropFromMonster(def: MonsterDef, x: number, y: number) {}
  spawnItem(itemId: string, qty: number, x: number, y: number) {}
  spawnMesos(amount: number, x: number, y: number) {}
  bindMap(map: IMapInstance) {}
  tryPickup() { return false; }
  update(time: number, delta: number) {}
  clear() {}
}
