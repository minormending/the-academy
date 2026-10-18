// OWNER: A7 (world). Classic swirling portal visual + "▲" hint when the player is close.
import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import type { PortalDef } from '../core/types';

const HINT_DX = 48, HINT_DY = 90;

export class PortalVisual {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private swirlA?: Phaser.GameObjects.Image;
  private swirlB?: Phaser.GameObjects.Image;
  private core?: Phaser.GameObjects.Image;
  private halo?: Phaser.GameObjects.Image;
  private hint?: Phaser.GameObjects.Image;
  private sparkles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private hintA = 0;
  private phase = Math.random() * 10;

  constructor(private scene: Phaser.Scene, readonly def: PortalDef) {
    if (def.hidden) return;
    const has = (k: string) => scene.textures.exists(k);
    const { x, y } = def;
    const cy = y - 62;
    if (has('w_portal_base')) this.track(scene.add.image(x, y - 2, 'w_portal_base').setDepth(DEPTH.PORTAL - 0.2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9));
    if (has('w_glow')) {
      this.halo = this.track(scene.add.image(x, cy, 'w_glow').setDepth(DEPTH.PORTAL - 0.1).setTint(0x4aa8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(1.0, 1.45).setAlpha(0.65));
    }
    // Container squashes the circular swirl into an upright oval while the children spin.
    const c = scene.add.container(x, cy).setDepth(DEPTH.PORTAL).setScale(0.62, 1);
    this.track(c);
    if (has('w_portal_swirl')) {
      this.swirlA = scene.add.image(0, 0, 'w_portal_swirl').setBlendMode(Phaser.BlendModes.ADD).setScale(0.95);
      this.swirlB = scene.add.image(0, 0, 'w_portal_swirl').setBlendMode(Phaser.BlendModes.ADD).setScale(0.72).setTint(0xb8f0ff).setAlpha(0.85).setFlipX(true);
      c.add([this.swirlA, this.swirlB]);
    }
    if (has('w_portal_core')) { this.core = scene.add.image(0, 0, 'w_portal_core').setBlendMode(Phaser.BlendModes.ADD).setScale(0.55); c.add(this.core); }
    if (has('w_portal_ring')) c.add(scene.add.image(0, 0, 'w_portal_ring').setBlendMode(Phaser.BlendModes.ADD).setScale(0.98).setAlpha(0.7));
    if (has('w_spark')) {
      const zone = new Phaser.Geom.Rectangle(x - 26, y - 110, 52, 100);
      this.sparkles = scene.add.particles(0, 0, 'w_spark', {
        emitZone: { type: 'random', source: zone as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
        lifespan: 1300, frequency: 110, quantity: 1, speedY: { min: -60, max: -25 }, speedX: { min: -6, max: 6 },
        scale: { start: 0.55, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xbfefff, 0xffffff, 0x8fd0ff], blendMode: 'ADD',
      });
      this.sparkles.setDepth(DEPTH.PORTAL + 0.1);
      this.track(this.sparkles);
    }
    if (has('w_hint_arrow')) this.hint = this.track(scene.add.image(x, y - 150, 'w_hint_arrow').setDepth(DEPTH.PORTAL + 0.2).setAlpha(0));
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T { this.objs.push(o); return o; }

  update(time: number, delta: number, player: { x: number; y: number } | null) {
    if (this.def.hidden) return;
    const t = time / 1000 + this.phase;
    const dt = delta / 1000;
    if (this.swirlA) this.swirlA.rotation += dt * 2.4;
    if (this.swirlB) this.swirlB.rotation -= dt * 3.6;
    if (this.core) this.core.setScale(0.55 + Math.sin(t * 3) * 0.05);
    if (this.halo) this.halo.setAlpha(0.55 + Math.sin(t * 2) * 0.12);
    if (this.hint) {
      const near = !!player && Math.abs(player.x - this.def.x) <= HINT_DX && Math.abs(player.y - this.def.y) <= HINT_DY;
      this.hintA += ((near ? 1 : 0) - this.hintA) * Math.min(1, dt * 10);
      this.hint.setAlpha(this.hintA);
      this.hint.y = this.def.y - 150 + Math.sin(t * 5) * 4;
    }
  }

  destroy() {
    for (const o of this.objs) { try { o.destroy(); } catch { /* ignore */ } }
    this.objs = [];
  }
}
