// OWNER: A6 (monsters). STUB — replace with real implementation.
import Phaser from 'phaser';
import type { GameServices, IMapInstance, IMonster, IMonsterManager } from '../core/types';
export class MonsterManager implements IMonsterManager {
  constructor(private scene: Phaser.Scene, private services: GameServices) {}
  all(): IMonster[] { return []; }
  inRect(rect: Phaser.Geom.Rectangle): IMonster[] { return []; }
  nearest(x: number, y: number, maxDist: number, facing?: 1 | -1, maxDy?: number): IMonster | null { return null; }
  bindMap(map: IMapInstance) {}
  spawn(monsterId: string, x: number, y: number): IMonster | null { return null; }
  update(time: number, delta: number) {}
  clear() {}
}
