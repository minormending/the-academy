// OWNER: A6 (monsters). The five practicum field bosses, built on FieldBoss. Every attack is telegraphed
// (0.6–1 s, red-orange warning shapes), every damage number goes through FieldBoss.dmg() (respects curse).
import Phaser from 'phaser';
import type { GameServices, IMapInstance, MonsterDef } from '../../core/types';
import { DEPTH } from '../../core/constants';
import { BFX, MFX } from '../../art/monsterArt';
import type { MonsterSpawnOptions } from '../Monster';
import { FieldBoss, rand, type BossAction } from './FieldBoss';

type Ctor = new (scene: Phaser.Scene, services: GameServices, def: MonsterDef, x: number, y: number, map: IMapInstance, opts?: MonsterSpawnOptions) => FieldBoss;

/** Tinted pixel image (white/grey FX ramps), integer-scaled. */
function fx(scene: Phaser.Scene, key: string, x: number, y: number, tint: number, scale = 2): Phaser.GameObjects.Image {
  const img = scene.textures.exists(key) ? scene.add.image(x, y, key) : scene.add.image(x, y, '__WHITE').setDisplaySize(12, 12);
  return img.setTint(tint).setScale(scale).setDepth(DEPTH.VFX);
}

// ───────────────────────────── Mossback Matriarch (lv 8, Whisperwood) ─────────────────────────────

class MossbackMatriarch extends FieldBoss {
  constructor(scene: Phaser.Scene, services: GameServices, def: MonsterDef, x: number, y: number, map: IMapInstance, opts: MonsterSpawnOptions = {}) {
    super(scene, services, def, x, y, map, opts, {
      bar: { border: 0xb8f07a, fill: 0x62c83a, enraged: 0xe8483a, nameColor: '#eaffd8', textColor: '#d8ffc0' },
      logColor: '#b8f07a', keepDist: 60, actionGap: [1500, 2500], addIds: ['moss_snail'], maxAdds: 4,
    });
    this.actions = [
      this.makeCharge({ id: 'shell_spin', windMs: 900, speed: 480, mult: 1.25, cooldownMs: 8000, anim: 'attack', recoverMs: 900,
        weight: dx => (dx > 120 ? 32 : 14) }),
      this.slimeSpit(),
      this.makeSummon({ id: 'call_brood', n: () => Phaser.Math.Between(2, 3), cooldownMs: 16000, tint: 0x9ae06a }),
    ];
  }

  /** Spits 2–3 slime globs at telegraphed spots; each leaves a slime puddle that hurts while you stand in it. */
  private slimeSpit(): BossAction {
    const TELE = 850, LAUNCH = 300;
    let targets: number[] = [];
    let launched = false;
    return {
      id: 'slime_spit', cooldownMs: 5000, weight: () => 30,
      start: () => {
        const p = this.playerPos();
        const px = p?.x ?? this.x;
        const n = Phaser.Math.Between(2, 3);
        targets = [px, px + rand(130, 200) * (Math.random() < 0.5 ? -1 : 1), px + rand(220, 320) * (px > this.x ? 1 : -1)]
          .slice(0, n).map(x => this.clampX(x, 50));
        launched = false;
        for (const tx of targets) {
          this.telegraph(this.groundRect(tx, 100, 26), TELE, r => this.splat(r.centerX, r.bottom));
        }
        this.playAnim('idle');
        this.sfx('jump', { detune: -900 });
      },
      tick: (_dt, t) => {
        this.stopX();
        if (!launched && t >= LAUNCH) {
          launched = true;
          const ox = this.x + this.dir * this.def.size.w * 0.45, oy = this.y - this.def.size.h * 0.55;
          const T = (TELE - LAUNCH) / 1000, g = 1400;
          for (const tx of targets) {
            const gy = this.groundAt(tx, this.arena.y - 40);
            this.addProjectile(fx(this.scene, BFX.glob, ox, oy, 0xffffff, 2), (tx - ox) / T, (gy - oy - 0.5 * g * T * T) / T, g, 0, undefined, 8);
          }
          this.sfx('whoosh', { detune: -800 });
        }
        return t >= TELE + 150;
      },
    };
  }

  private splat(x: number, gy: number) {
    const r = new Phaser.Geom.Rectangle(x - 50, gy - 26, 100, 26);
    this.hitIfOverlap(r, this.dmg(0.8), x);
    this.sfx('land', { detune: -600 });
    const img = fx(this.scene, BFX.puddle, x, gy - 10, 0x8ae04a, 2).setDepth(DEPTH.MONSTER - 1).setAlpha(0.95);
    this.puffAt(x, gy - 8, 0x8ae04a, 5, 30);
    const puddle = new Phaser.Geom.Rectangle(x - 50, gy - 18, 100, 18);
    this.addHazard(puddle, 5200, 500, this.dmg(0.15), [img], (h) => {
      img.setAlpha(h.life < 900 ? (h.life / 900) * 0.95 : 0.95);
      if (Math.random() < 0.04) this.puffAt(x + rand(-40, 40), gy - 6, 0xb8f07a, 1, 10);
    });
  }
}

// ───────────────────────────── Shroom Monarch (lv 14, Shroom Hollow) ─────────────────────────────

class ShroomMonarch extends FieldBoss {
  constructor(scene: Phaser.Scene, services: GameServices, def: MonsterDef, x: number, y: number, map: IMapInstance, opts: MonsterSpawnOptions = {}) {
    super(scene, services, def, x, y, map, opts, {
      bar: { border: 0xffd447, fill: 0xe0343a, enraged: 0xff7a1a, nameColor: '#fff2d0', textColor: '#ffe0b0' },
      logColor: '#ffb04a', keepDist: 80, actionGap: [1400, 2300], addIds: ['cap_shroom', 'thorn_shroom'], maxAdds: 3,
    });
    this.actions = [this.jumpSlam(), this.sporeClouds(),
      this.makeSummon({ id: 'royal_guard', n: () => Phaser.Math.Between(2, 3), cooldownMs: 17000, tint: 0xffb04a })];
  }

  /** Crouch → leap to the telegraphed spot → slam (zone damage) + two ground shockwaves rolling outward (jump them). */
  private jumpSlam(): BossAction {
    const TELE = 1000, JUMP = 420;
    let tx = 0, jumped = false, landed = false;
    return {
      id: 'royal_slam', cooldownMs: 5500, weight: dx => (dx > 140 ? 34 : 22),
      start: () => {
        const p = this.playerPos();
        tx = this.clampX(p?.x ?? this.x);
        jumped = landed = false;
        this.telegraph(this.groundRect(tx, 220, 110, this.arena.y), TELE, r => this.slam(r));
        this.playAnim('hit', true);
        this.scene.tweens.add({ targets: this.sprite, scaleY: 0.86, duration: 200, yoyo: true, hold: 120 });
      },
      tick: (_dt, t) => {
        if (!jumped) {
          this.stopX();
          if (t >= JUMP) {
            jumped = true;
            const T = (TELE - JUMP) / 1000;
            this.body.setVelocity((tx - this.x) / T, -0.5 * 1500 * T);
            this.noContact = true; // the telegraphed landing zone is the damage, not the body
            this.face(tx >= this.x ? 1 : -1);
            this.playAnim('move', true);
            this.sfx('jump', { detune: -700 });
          }
          return false;
        }
        if (!landed && t > JUMP + 120 && this.grounded()) { landed = true; this.body.setVelocityX(0); }
        if (t >= TELE + 300) this.noContact = false;
        if (this.x <= this.arena.x1 + this.def.size.w / 2 || this.x >= this.arena.x2 - this.def.size.w / 2) this.body.setVelocityX(0);
        return t >= TELE + 450 || (t > TELE + 1500);
      },
      cancel: () => this.body.setVelocityX(0),
    };
  }

  private slam(r: Phaser.Geom.Rectangle) {
    this.hitIfOverlap(r, this.dmg(1.4));
    this.shake(260, 0.009);
    this.sfx('explosion', { detune: -900 });
    const gy = r.bottom, cx = r.centerX;
    this.debris(cx, gy, 0xc8946a, 10);
    this.puffAt(cx, gy - 10, 0xffe0b0, 10, 90);
    for (const d of [-1, 1] as const) {
      const img = fx(this.scene, BFX.wave, cx + d * 60, gy - 14, 0xffc070, 2).setFlipX(d < 0);
      this.addProjectile(img, d * 380, 0, 0, this.dmg(1.0));
    }
  }

  /** Breathes spores: telegraphed spots bloom into lingering clouds that poison you while inside. */
  private sporeClouds(): BossAction {
    return {
      id: 'spore_cloud', cooldownMs: 7000, weight: () => 26,
      start: () => {
        const p = this.playerPos();
        const px = p?.x ?? this.x;
        this.playAnim('attack', true);
        this.sfx('curse', { detune: -400 });
        const spots = [px, px - rand(170, 230), px + rand(170, 230)].map(x => this.clampX(x, 60));
        spots.forEach((x, i) => this.telegraph(this.groundRect(x, 120, 110), 850 + i * 120, r => this.bloom(r)));
      },
      tick: (_dt, t) => { this.stopX(); return t >= 1100; },
    };
  }

  private bloom(r: Phaser.Geom.Rectangle) {
    this.hitIfOverlap(r, this.dmg(0.45));
    const imgs: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 3; i++) {
      imgs.push(fx(this.scene, BFX.cloud, r.x + 25 + i * 35, r.bottom - 30 - (i % 2) * 34, i % 2 ? 0x9ad05a : 0xc8a0ff, 2).setAlpha(0.9));
    }
    this.sfx('curse', { detune: 200, volume: 0.6 });
    const base = imgs.map(m => m.y);
    this.addHazard(r, 5000, 500, this.dmg(0.2), imgs, (h) => {
      const k = h.life < 800 ? h.life / 800 : 1;
      imgs.forEach((m, i) => m.setY(base[i] + Math.round(Math.sin((h.total - h.life) / 300 + i) * 3)).setAlpha(0.9 * k));
    });
  }
}

// ───────────────────────────── Frostfang Alpha (lv 24, Frostfang Cliffs) ─────────────────────────────

class FrostfangAlpha extends FieldBoss {
  private frenzyUntil = 0;

  constructor(scene: Phaser.Scene, services: GameServices, def: MonsterDef, x: number, y: number, map: IMapInstance, opts: MonsterSpawnOptions = {}) {
    super(scene, services, def, x, y, map, opts, {
      bar: { border: 0x9fe6ff, fill: 0x3aa8f0, enraged: 0xff5a8a, nameColor: '#eefaff', textColor: '#cfefff' },
      logColor: '#9fe6ff', keepDist: 70, actionGap: [1300, 2100], enrageAt: 0.3, enrageTint: 0xff7aa8,
    });
    this.actions = [
      this.roar(),
      this.groundPound(),
      this.makeCharge({ id: 'charge', windMs: 800, speed: 620, mult: 1.3, cooldownMs: 8500, anim: 'move', recoverMs: 750, hitH: 80,
        weight: dx => (dx > 160 ? 26 : 8) }),
    ];
  }

  protected tickWorld(now: number, delta: number) {
    super.tickWorld(now, delta);
    this.haste = now < this.frenzyUntil ? 1.4 : 1;
  }

  /** Rears back, then ROARS: screen shake, a short frenzy (faster), and icicles shaken loose across the arena. */
  private roar(): BossAction {
    let roared = false;
    return {
      id: 'roar', cooldownMs: 14000, weight: () => 18,
      start: () => {
        roared = false;
        this.playAnim('attack', true);
        this.sprite.anims.pause();
        this.sfx('boss_roar', { detune: 400, volume: 0.5 });
      },
      tick: (_dt, t) => {
        this.stopX();
        if (!roared && t >= 700) {
          roared = true;
          if (this.sprite.anims.isPaused) this.sprite.anims.resume();
          this.sfx('boss_roar', { detune: -250 });
          this.shake(550, 0.012);
          this.frenzyUntil = this.scene.time.now + 6000;
          this.log(`${this.def.name} lets out a thunderous roar!`);
          this.puffAt(this.x + this.dir * 40, this.y - this.def.size.h * 0.75, 0xdff6ff, 12, 90);
          for (let i = 0; i < 3; i++) this.icicle(rand(this.arena.x1 + 60, this.arena.x2 - 60), 760 + i * 160);
        }
        return t >= 1150;
      },
    };
  }

  /** Axe overhead → pound (front zone) → a line of telegraphed icicles falls from above, the first on you. */
  private groundPound(): BossAction {
    let pounded = false;
    return {
      id: 'ground_pound', cooldownMs: 6000, weight: () => 30,
      start: () => {
        pounded = false;
        this.playAnim('attack', true);
        const front = this.x + this.dir * (this.def.size.w / 2 + 50);
        this.telegraph(this.groundRect(front, 150, 110), 650, r => {
          this.hitIfOverlap(r, this.dmg(1.4), this.x);
          this.shake(240, 0.009);
          this.sfx('explosion', { detune: -1100 });
          this.debris(r.centerX, r.bottom, 0xdff6ff, 10, BFX.rock);
        });
      },
      tick: (_dt, t) => {
        this.stopX();
        if (!pounded && t >= 650) {
          pounded = true;
          const p = this.playerPos();
          const px = p?.x ?? this.x;
          const n = this.enraged ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const x = i === 0 ? px : px + (i % 2 ? 1 : -1) * (Math.ceil(i / 2) * rand(110, 150));
            this.icicle(this.clampX(x, 24), 700 + i * 110);
          }
        }
        return t >= 1050;
      },
    };
  }

  /** Column warning on the ground (`warnMs`), then the icicle drops for 250 ms and shatters. */
  private icicle(x: number, warnMs: number) {
    const gy = this.groundAt(x, this.arena.y - 40);
    let top = gy - 560;
    try { top = Math.max(top, this.scene.cameras.main.worldView.y - 20); } catch { /* ignore */ }
    const col = new Phaser.Geom.Rectangle(x - 22, top, 44, gy - top);
    this.telegraph(col, warnMs, () => {
      const img = fx(this.scene, BFX.icicle, x, top, 0xffffff, 2).setOrigin(0.5, 1);
      this.scene.tweens.add({
        targets: img, y: gy, duration: 250, ease: 'Quad.easeIn',
        onComplete: () => {
          img.destroy();
          if (!this.alive) return;
          this.hitIfOverlap(new Phaser.Geom.Rectangle(x - 24, gy - 70, 48, 70), this.dmg(1.3), x);
          this.sfx('shatter', { detune: -200, volume: 0.7 });
          if (this.scene.textures.exists(MFX.shard)) {
            for (let i = 0; i < 6; i++) {
              const s = this.scene.add.image(x, gy - 8, MFX.shard).setDepth(DEPTH.VFX);
              this.scene.tweens.add({ targets: s, x: x + rand(-50, 50), y: gy - rand(20, 60), alpha: 0, angle: rand(-180, 180),
                duration: rand(300, 480), onComplete: () => s.destroy() });
            }
          }
        },
      });
    }, 'column');
  }
}

// ───────────────────────────── Magmaw (lv 34, Cinder Caverns) ─────────────────────────────

class Magmaw extends FieldBoss {
  constructor(scene: Phaser.Scene, services: GameServices, def: MonsterDef, x: number, y: number, map: IMapInstance, opts: MonsterSpawnOptions = {}) {
    super(scene, services, def, x, y, map, opts, {
      bar: { border: 0xff8a1e, fill: 0xd84a14, enraged: 0xff1a3a, nameColor: '#fff0d8', textColor: '#ffd0a0' },
      logColor: '#ff7a2a', keepDist: 70, actionGap: [1600, 2500], enrageAt: 0.3, enrageTint: 0xff6a3a,
      addIds: ['ember_imp'], maxAdds: 3,
    });
    this.actions = [this.heavySwing(), this.geysers()];
  }

  protected onEnrage() {
    this.summonAdds(2);
    this.geyserVolley(this.playerPos()?.x ?? this.x, 3, 900);
  }

  /** Slow overhead smash: arms rise for ~0.9 s over a big telegraphed zone in front, then the slam. */
  private heavySwing(): BossAction {
    const TELE = 900;
    return {
      id: 'heavy_swing', cooldownMs: 3500, weight: dx => (dx < 320 ? 40 : 12),
      start: () => {
        this.playAnim('attack', true);
        const front = this.x + this.dir * (this.def.size.w / 2 + 70);
        const tele = this.enraged ? 750 : TELE;
        this.telegraph(this.groundRect(front, 230, 150), tele, r => {
          this.hitIfOverlap(r, this.dmg(1.55), this.x);
          this.shake(300, 0.011);
          this.sfx('explosion', { detune: -1200 });
          this.debris(r.centerX, r.bottom, 0xffa040, 12, BFX.rock);
          if (this.enraged) this.lavaPool(r.centerX, r.bottom, 2200);
        });
      },
      tick: (_dt, t) => { this.stopX(); return t >= TELE + 450; },
    };
  }

  private geysers(): BossAction {
    return {
      id: 'geysers', cooldownMs: 6500, weight: () => 30,
      start: () => {
        this.playAnim('attack', true);
        this.sfx('explosion', { detune: -1500, volume: 0.5 });
        this.shake(200, 0.004);
        this.geyserVolley(this.playerPos()?.x ?? this.x, this.enraged ? 5 : 3, this.enraged ? 800 : 1000);
      },
      tick: (_dt, t) => { this.stopX(); return t >= 1100; },
    };
  }

  private geyserVolley(px: number, n: number, warn: number) {
    for (let i = 0; i < n; i++) {
      const x = i === 0 ? px : px + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * rand(140, 200);
      const cx = this.clampX(x, 40);
      this.telegraph(this.groundRect(cx, 80, 30), warn + i * 140, r => this.erupt(r.centerX, r.bottom));
    }
  }

  private erupt(x: number, gy: number) {
    const col = new Phaser.Geom.Rectangle(x - 36, gy - 240, 72, 240);
    this.hitIfOverlap(col, this.dmg(1.3), x);
    this.sfx('explosion', { detune: -600, volume: 0.7 });
    const g = this.scene.add.graphics().setDepth(DEPTH.VFX);
    // hard-edged stepped column: dark rim → orange → yellow core
    g.fillStyle(0xa8240c, 0.95).fillRect(x - 36, gy - 240, 72, 240);
    g.fillStyle(0xff6a1e, 1).fillRect(x - 26, gy - 232, 52, 232);
    g.fillStyle(0xffd060, 1).fillRect(x - 14, gy - 220, 28, 220);
    g.fillStyle(0xfff4c0, 1).fillRect(x - 6, gy - 200, 12, 200);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 520, delay: 140, onComplete: () => g.destroy() });
    if (this.scene.textures.exists(MFX.ember)) {
      for (let i = 0; i < 10; i++) {
        const e = this.scene.add.image(x + rand(-30, 30), gy - rand(10, 200), MFX.ember).setDepth(DEPTH.VFX).setScale(2);
        this.scene.tweens.add({ targets: e, y: e.y - rand(60, 140), alpha: 0, duration: rand(400, 800), onComplete: () => e.destroy() });
      }
    }
    this.lavaPool(x, gy, 2400);
  }

  private lavaPool(x: number, gy: number, life: number) {
    const img = fx(this.scene, BFX.puddle, x, gy - 10, 0xff7a2a, 2).setDepth(DEPTH.MONSTER - 1);
    this.addHazard(new Phaser.Geom.Rectangle(x - 50, gy - 18, 100, 18), life, 500, this.dmg(0.15), [img], h => {
      img.setTint(Math.floor((h.total - h.life) / 180) % 2 ? 0xffa040 : 0xff6a1e);
    });
  }
}

// ───────────────────────────── Tempest Wyrm (lv 44, Stormspire Peak) ─────────────────────────────

class TempestWyrm extends FieldBoss {
  constructor(scene: Phaser.Scene, services: GameServices, def: MonsterDef, x: number, y: number, map: IMapInstance, opts: MonsterSpawnOptions = {}) {
    super(scene, services, def, x, y, map, opts, {
      bar: { border: 0xd8b4ff, fill: 0x7a5aff, enraged: 0xfff27a, nameColor: '#f4eeff', textColor: '#e6d8ff' },
      logColor: '#d8b4ff', keepDist: 170, actionGap: [1300, 2100], hover: 14,
    });
    this.actions = [
      this.makeCharge({ id: 'dive', windMs: 900, speed: 700, mult: 1.4, cooldownMs: 7000, anim: 'move', recoverMs: 600, hitH: 70,
        weight: dx => (dx > 150 ? 30 : 16),
        onStart: () => { this.scene.tweens.add({ targets: this.sprite, y: this.arena.y - 150, duration: 450, yoyo: true, hold: 0, ease: 'Sine.easeInOut' }); } }),
      this.lightning(false),
      this.lightning(true),
    ];
  }

  /** Lightning on telegraphed columns: around you, or a sweep marching across the arena. */
  private lightning(sweep: boolean): BossAction {
    return {
      id: sweep ? 'storm_sweep' : 'storm_call', cooldownMs: sweep ? 9000 : 5000, weight: () => (sweep ? 18 : 30),
      start: () => {
        this.sfx('thunder', { detune: -900, volume: 0.5 });
        this.puffAt(this.x, this.y - this.def.size.h, 0xb4a6ff, 8, 70);
        const p = this.playerPos();
        const px = p?.x ?? this.x;
        if (sweep) {
          const d: 1 | -1 = px >= this.x ? 1 : -1;
          let x = this.x + d * 120;
          for (let i = 0; i < 9; i++, x += d * 130) {
            if (x < this.arena.x1 + 20 || x > this.arena.x2 - 20) break;
            this.bolt(x, 800 + i * 170);
          }
        } else {
          const xs = [px, px - rand(150, 210), px + rand(150, 210), rand(this.arena.x1 + 40, this.arena.x2 - 40)];
          xs.forEach((x, i) => this.bolt(this.clampX(x, 24), 850 + i * 90));
        }
      },
      tick: (_dt, t) => { this.moveToward(this.x, 0); this.playAnim('idle'); return t >= 900; },
    };
  }

  private bolt(x: number, warn: number) {
    const gy = this.groundAt(x, this.arena.y - 40);
    let top = gy - 600;
    try { top = Math.max(top, this.scene.cameras.main.worldView.y - 20); } catch { /* ignore */ }
    this.telegraph(new Phaser.Geom.Rectangle(x - 22, top, 44, gy - top), warn, r => {
      this.hitIfOverlap(new Phaser.Geom.Rectangle(x - 24, r.y, 48, r.height), this.dmg(1.4), x);
      this.sfx('thunder', { volume: 0.7 });
      const g = this.scene.add.graphics().setDepth(DEPTH.VFX);
      // hard-edged zigzag bolt built from 6-px blocks
      let cx = x, y = r.y;
      while (y < gy) {
        const ny = Math.min(gy, y + 24);
        const nx = x + Math.round(rand(-3, 3)) * 6;
        g.fillStyle(0x7a5aff, 1).fillRect(Math.min(cx, nx) - 6, y, Math.abs(nx - cx) + 12, ny - y);
        g.fillStyle(0xfff27a, 1).fillRect(Math.min(cx, nx) - 2, y, Math.abs(nx - cx) + 4, ny - y);
        cx = nx; y = ny;
      }
      g.fillStyle(0xffffff, 0.9).fillRect(x - 30, gy - 8, 60, 8);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, delay: 80, onComplete: () => g.destroy() });
      if (this.scene.textures.exists(MFX.spark)) {
        for (let i = 0; i < 6; i++) {
          const s = this.scene.add.image(x, gy - 6, MFX.spark).setDepth(DEPTH.VFX).setScale(2);
          this.scene.tweens.add({ targets: s, x: x + rand(-60, 60), y: gy - rand(10, 50), alpha: 0, duration: rand(250, 420), onComplete: () => s.destroy() });
        }
      }
    }, 'column');
  }
}

/** Field boss id → its AI class (MonsterManager instantiates these). */
export const FIELD_BOSS_CLASSES: Record<string, Ctor> = {
  mossback_matriarch: MossbackMatriarch,
  shroom_monarch: ShroomMonarch,
  frostfang_alpha: FrostfangAlpha,
  magmaw: Magmaw,
  tempest_wyrm: TempestWyrm,
};
