// OWNER: A7 (world). Ambient weather/atmosphere: particle emitters that follow the camera view,
// plus storm lightning flashes. Emitters sit at world (0,0); only their emit zones move, so
// already-emitted particles stay put in world space.
import Phaser from 'phaser';
import { DEPTH } from '../core/constants';
import { maybeServices } from '../core/services';
import type { AmbientKind } from './themes';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type ZoneMode = 'view' | 'top' | 'bottom';

interface Live { emitter: Emitter; rect: Phaser.Geom.Rectangle; mode: ZoneMode; prewarmMs: number; }

const fadeInOut = (max: number) => ({
  onEmit: () => 0,
  onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(Math.min(1, t) * Math.PI) * max,
});

export class Ambient {
  private live: Live[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];
  private frames = 0;
  // lightning
  private lightning = false;
  private nextStrike = 0;
  private strikeT = -1;
  private skyFlash?: Phaser.GameObjects.Rectangle;
  private overlayFlash?: Phaser.GameObjects.Rectangle;
  private bolt?: Phaser.GameObjects.Graphics;
  private thunderAt = -1;

  constructor(private scene: Phaser.Scene, kinds: AmbientKind[]) {
    for (const k of kinds) {
      try { this.add(k); } catch (e) { console.warn('[ambient] failed', k, e); }
    }
  }

  private emitter(key: string, mode: ZoneMode, depth: number, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, prewarmMs: number) {
    if (!this.scene.textures.exists(key)) return;
    const rect = new Phaser.Geom.Rectangle(0, 0, 10, 10);
    const e = this.scene.add.particles(0, 0, key, {
      ...cfg,
      emitZone: { type: 'random', source: rect as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
    });
    e.setDepth(depth);
    this.live.push({ emitter: e, rect, mode, prewarmMs });
  }

  private add(kind: AmbientKind) {
    const D_BACK = DEPTH.DECOR + 1, D_FRONT = DEPTH.VFX - 2;
    switch (kind) {
      case 'fireflies':
        this.emitter('w_mote', 'view', D_BACK, {
          lifespan: { min: 4000, max: 7000 }, frequency: 260, quantity: 1, maxAliveParticles: 28,
          speedX: { min: -14, max: 14 }, speedY: { min: -18, max: 8 }, scale: { min: 0.35, max: 0.75 },
          alpha: fadeInOut(0.9), tint: [0xfff39a, 0xd8ff8a, 0xfff8d0], blendMode: 'ADD',
        }, 5000);
        break;
      case 'leaves':
        this.emitter('w_leaf', 'top', D_FRONT, {
          lifespan: 12000, frequency: 520, quantity: 1, maxAliveParticles: 22,
          speedX: { min: -50, max: -10 }, speedY: { min: 35, max: 70 }, scale: { min: 0.7, max: 1.2 },
          rotate: { onEmit: () => Math.random() * 360, onUpdate: (_p, _k, t) => t * 900 },
          alpha: { min: 0.75, max: 1 }, tint: [0x7cc84a, 0x5bb83c, 0xe0b040, 0xd8803a],
        }, 9000);
        break;
      case 'petals':
        this.emitter('w_petal', 'top', D_FRONT, {
          lifespan: 13000, frequency: 600, quantity: 1, maxAliveParticles: 18,
          speedX: { min: -40, max: 10 }, speedY: { min: 30, max: 60 }, scale: { min: 0.7, max: 1.1 },
          rotate: { onEmit: () => Math.random() * 360, onUpdate: (_p, _k, t) => t * 700 },
          alpha: { min: 0.7, max: 0.95 }, tint: [0xffc8dc, 0xffffff, 0xffb0cc],
        }, 10000);
        break;
      case 'spores':
        this.emitter('w_mote', 'view', D_BACK, {
          lifespan: { min: 5000, max: 9000 }, frequency: 160, quantity: 1, maxAliveParticles: 45,
          speedX: { min: -10, max: 10 }, speedY: { min: -30, max: -8 }, scale: { min: 0.25, max: 0.6 },
          alpha: fadeInOut(0.85), tint: [0x7dfff0, 0xff9ad8, 0xb8a0ff, 0xd8fff6], blendMode: 'ADD',
        }, 6000);
        break;
      case 'snow':
        // far, small flakes + near, big flakes
        this.emitter('w_snowflake', 'top', DEPTH.PARALLAX_NEAR + 5, {
          lifespan: 18000, frequency: 55, quantity: 1, maxAliveParticles: 170,
          speedX: { min: -20, max: 10 }, speedY: { min: 30, max: 55 }, scale: { min: 0.25, max: 0.45 },
          alpha: { min: 0.5, max: 0.8 },
        }, 14000);
        this.emitter('w_snowflake', 'top', D_FRONT, {
          lifespan: 12000, frequency: 110, quantity: 1, maxAliveParticles: 90,
          speedX: { min: -35, max: 15 }, speedY: { min: 60, max: 100 }, scale: { min: 0.6, max: 1.1 },
          alpha: { min: 0.7, max: 1 },
        }, 9000);
        break;
      case 'embers':
        this.emitter('w_ember', 'bottom', D_FRONT, {
          lifespan: { min: 5000, max: 8000 }, frequency: 120, quantity: 1, maxAliveParticles: 60,
          speedX: { min: -25, max: 25 }, speedY: { min: -120, max: -45 }, scale: { min: 0.4, max: 1 },
          alpha: fadeInOut(1), tint: [0xff8a20, 0xffc040, 0xff5a10, 0xfff0a0], blendMode: 'ADD',
        }, 6000);
        break;
      case 'ash':
        this.emitter('w_dot', 'top', D_BACK, {
          lifespan: 14000, frequency: 200, quantity: 1, maxAliveParticles: 50,
          speedX: { min: -20, max: 20 }, speedY: { min: 20, max: 45 }, scale: { min: 0.4, max: 0.9 },
          alpha: { min: 0.25, max: 0.5 }, tint: [0x8a7a78, 0x5a4a48],
        }, 12000);
        break;
      case 'rain':
        this.emitter('w_raindrop', 'top', D_FRONT, {
          lifespan: 950, frequency: 12, quantity: 2, maxAliveParticles: 220,
          speedX: { min: -150, max: -110 }, speedY: { min: 950, max: 1150 }, rotate: 7,
          scale: { min: 0.7, max: 1.1 }, alpha: { min: 0.25, max: 0.45 }, tint: 0xc8d8ff,
        }, 900);
        break;
      case 'motes':
        this.emitter('w_spark', 'view', D_BACK, {
          lifespan: { min: 4000, max: 7000 }, frequency: 140, quantity: 1, maxAliveParticles: 45,
          speedX: { min: -8, max: 8 }, speedY: { min: -40, max: -12 }, scale: { min: 0.5, max: 1.2 },
          rotate: { min: 0, max: 90 },
          alpha: fadeInOut(0.95), tint: [0xc08aff, 0xffcf4a, 0x8fd8ff, 0xffffff], blendMode: 'ADD',
        }, 5000);
        break;
      case 'lightning':
        this.setupLightning();
        break;
    }
  }

  private setupLightning() {
    const cam = this.scene.cameras.main;
    this.lightning = true;
    this.skyFlash = this.scene.add.rectangle(0, 0, cam.width, cam.height, 0xdde4ff, 1).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.PARALLAX_FAR - 5).setAlpha(0);
    this.overlayFlash = this.scene.add.rectangle(0, 0, cam.width, cam.height, 0xeef2ff, 1).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.VFX_TOP - 1).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.bolt = this.scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.PARALLAX_FAR - 4);
    this.objects.push(this.skyFlash, this.overlayFlash, this.bolt);
    this.nextStrike = 4000 + Math.random() * 5000;
  }

  private drawBolt() {
    const g = this.bolt; if (!g) return;
    const cam = this.scene.cameras.main;
    g.clear();
    let x = cam.width * (0.1 + Math.random() * 0.8), y = -10;
    const pts: [number, number][] = [[x, y]];
    const endY = cam.height * (0.35 + Math.random() * 0.25);
    while (y < endY) { x += (Math.random() - 0.5) * 60; y += 20 + Math.random() * 30; pts.push([x, y]); }
    for (const [w, c, a] of [[9, 0x8fa8ff, 0.25], [4, 0xc8d8ff, 0.7], [1.6, 0xffffff, 1]] as const) {
      g.lineStyle(w, c, a); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) g.lineTo(p[0], p[1]);
      g.strokePath();
    }
    // a fork
    const fi = Math.floor(pts.length / 2);
    if (pts[fi]) {
      g.lineStyle(1.5, 0xe8eeff, 0.8); g.beginPath(); g.moveTo(pts[fi][0], pts[fi][1]);
      let fx = pts[fi][0], fy = pts[fi][1];
      for (let i = 0; i < 4; i++) { fx += 15 + Math.random() * 20; fy += 15 + Math.random() * 20; g.lineTo(fx, fy); }
      g.strokePath();
    }
  }

  private updateLightning(delta: number) {
    if (!this.lightning) return;
    this.nextStrike -= delta;
    if (this.strikeT < 0 && this.nextStrike <= 0) {
      this.strikeT = 0;
      this.nextStrike = 6000 + Math.random() * 9000;
      this.drawBolt();
      this.thunderAt = 250 + Math.random() * 500;
    }
    if (this.thunderAt >= 0) {
      this.thunderAt -= delta;
      if (this.thunderAt < 0) {
        try { maybeServices()?.audio.play('thunder', { volume: 0.18 }); } catch { /* audio optional */ }
      }
    }
    if (this.strikeT >= 0) {
      this.strikeT += delta;
      const t = this.strikeT;
      // double flash: 0–90ms, 160–260ms, then fade until 600ms
      let a = 0;
      if (t < 90) a = 1 - t / 90 * 0.4;
      else if (t < 160) a = 0.25;
      else if (t < 260) a = 0.8;
      else a = Math.max(0, 0.8 * (1 - (t - 260) / 340));
      this.skyFlash?.setAlpha(a * 0.55);
      this.overlayFlash?.setAlpha(a * 0.12);
      this.bolt?.setAlpha(t < 300 ? 1 : Math.max(0, 1 - (t - 300) / 200));
      if (t > 600) { this.strikeT = -1; this.skyFlash?.setAlpha(0); this.overlayFlash?.setAlpha(0); this.bolt?.clear(); }
    }
  }

  update(_time: number, delta: number) {
    const cam = this.scene.cameras.main;
    const vx = cam.scrollX, vy = cam.scrollY, vw = cam.width, vh = cam.height;
    this.frames++;
    for (const l of this.live) {
      if (l.mode === 'view') l.rect.setTo(vx - 80, vy - 60, vw + 160, vh + 120);
      else if (l.mode === 'top') l.rect.setTo(vx - 260, vy - 40, vw + 420, 24);
      else l.rect.setTo(vx - 100, vy + vh + 10, vw + 200, 30);
      // Pre-warm once the camera has settled on the new map (a couple of frames in).
      if (this.frames === 3 && l.prewarmMs > 0) {
        try {
          if (l.mode === 'top') {
            // simulate falling particles already filling the view
            l.rect.setTo(vx - 260, vy - 40, vw + 420, vh + 40);
            l.emitter.fastForward(Math.min(l.prewarmMs, 7000), 100);
            l.rect.setTo(vx - 260, vy - 40, vw + 420, 24);
          } else {
            l.emitter.fastForward(l.prewarmMs, 50);
          }
        } catch { /* ignore */ }
      }
    }
    this.updateLightning(delta);
  }

  destroy() {
    for (const l of this.live) { try { l.emitter.destroy(); } catch { /* ignore */ } }
    for (const o of this.objects) { try { o.destroy(); } catch { /* ignore */ } }
    this.live = []; this.objects = [];
  }
}
