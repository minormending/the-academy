// OWNER: A8 (ui). STUB — replace with real implementation.
import Phaser from 'phaser';
import type { GameServices, IUI } from '../core/types';
export class UIRoot implements IUI {
  constructor(private scene: Phaser.Scene, private services: GameServices) {}
  update(time: number, delta: number) {}
  destroy() {}
}
