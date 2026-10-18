// OWNER: A1 (player). STUB — replace with real implementation.
import Phaser from 'phaser';
import type { GameServices, IMapInstance, IPlayer, JobId } from '../core/types';
export class Player implements IPlayer {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  facing: 1 | -1 = 1;
  state: IPlayer['state'] = 'idle';
  constructor(private scene: Phaser.Scene, private services: GameServices, x: number, y: number, job: JobId) {
    this.sprite = scene.physics.add.sprite(x, y, '__DEFAULT');
  }
  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  isGrounded() { return true; }
  isBusy() { return false; }
  isInvulnerable() { return false; }
  getAimDir() { return { x: 0 as const, y: 0 as const }; }
  getBounds() { return this.sprite.getBounds(); }
  bindMap(map: IMapInstance) {}
  placeAt(x: number, y: number) { this.sprite.setPosition(x, y); }
  playCast(lockMs: number) {}
  onHit(fromX: number) {}
  blink(dx: number, dy: number) {}
  setJob(job: JobId) {}
  onDeath() {}
  revive() {}
  setControlEnabled(enabled: boolean) {}
  update(time: number, delta: number) {}
  destroy() { this.sprite.destroy(); }
}
