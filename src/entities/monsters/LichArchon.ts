// OWNER: A6 (monsters). Lich Archon boss: telegraphed orb volleys, ground slams, teleports, summons, enrage.
import Phaser from 'phaser';
import type { GameServices, IMapInstance, MonsterDef } from '../../core/types';
import { bus } from '../../core/events';
import { DEPTH } from '../../core/constants';
import { MFX } from '../../art/monsterArt';
import { Monster, type MonsterSpawnOptions } from '../Monster';
import { platformUnder } from './ground';
import { BossBar, LICH_BAR_STYLE } from './bossBar';

type BossState = 'dormant' | 'idle' | 'volley' | 'slam' | 'teleport' | 'summon';

interface Orb { img: Phaser.GameObjects.Image; vx: number; vy: number; life: number; }
interface Zone { g: Phaser.GameObjects.Graphics; rect: Phaser.Geom.Rectangle; t: number; dur: number; }

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const ADD_ID = 'void_wisp';

export class LichArchon extends Monster {
  private state: BossState = 'dormant';
  private stateT = 0;
  private actCd = 1200;
  private summonCd = 9000;
  private volleysLeft = 0;
  private volleyAt = 0;
  private teleported = false;
  private summoned = false;
  private enraged = false;
  private orbs: Orb[] = [];
  private zones: Zone[] = [];
  private adds = new Set<number>();
  private charge: Phaser.GameObjects.Image | null = null;
  private aura: Phaser.GameObjects.Image | null = null;
  private bar: BossBar | null = null;
  private offKilled: (() => void) | null = null;

  constructor(scene: Phaser.Scene, services: GameServices, def: MonsterDef, x: number, y: number, map: IMapInstance, opts: MonsterSpawnOptions = {}) {
    super(scene, services, def, x, y, map, opts);
    this.offKilled = bus.on('monster:killed', ({ monster }) => { this.adds.delete(monster.uid); });
  }

  // Active attacks respect curse (outgoingDamageMult) just like contact damage does.
  private get orbDmg() { return Math.max(1, Math.round(this.def.touchDamage * 0.85 * this.outgoingDamageMult())); }
  private get slamDmg() { return Math.max(1, Math.round(this.def.touchDamage * 1.5 * this.outgoingDamageMult())); }

  // ─────────────────────────── hooks ───────────────────────────

  protected showOverheadBar() { return false; }

  protected baseTint(): number | null { return this.enraged ? 0xffb8d8 : null; }

  protected onDamaged() {
    if (this.state === 'dormant') this.engage();
    if (!this.enraged && this.hp > 0 && this.hp / this.maxHp < 0.3) this.enrage();
  }

  protected onBeforeDeath() {
    this.cleanupAttacks();
    this.redrawBar(true);
    try { bus.emit('ui:log', { text: 'The Lich Archon crumbles into dust!', color: '#e7c6ff' }); } catch { /* ignore */ }
    try { this.scene.cameras.main.shake(400, 0.008); this.scene.cameras.main.flash(300, 200, 150, 255); } catch { /* ignore */ }
    this.bar?.fadeOut(600);
    this.bar = null;
  }

  protected onDestroy() {
    this.offKilled?.();
    this.offKilled = null;
    this.cleanupAttacks();
    this.aura?.destroy();
    this.aura = null;
    this.bar?.destroy();
    this.bar = null;
  }

  protected tickWorld(now: number, delta: number) {
    this.tickOrbs(delta);
    this.tickZones(delta);
    if (this.aura) {
      this.aura.setPosition(this.x, this.y - this.def.size.h * 0.5);
      this.aura.setAlpha(0.35 + 0.15 * Math.sin(now / 180));
    }
    if (this.charge) this.charge.setPosition(this.x + (this.sprite.flipX ? -50 : 50), this.y - 150);
    this.redrawBar(false);
  }

  /** Boss ignores hitstun; runs its own state machine (paused while frozen/stunned by the base class). */
  protected runAI(now: number, delta: number, mult: number) {
    this.stateT += delta;
    const p = this.playerPos();
    if (this.state === 'dormant') {
      this.body.setVelocityX(0);
      this.playAnim('idle');
      if (p && Math.abs(p.x - this.x) < 640 && Math.abs(p.y - this.y) < 320) this.engage();
      return;
    }
    if (!p) { this.body.setVelocityX(0); this.playAnim('idle'); return; }
    const dx = p.x - this.x;
    if (this.state !== 'teleport') this.face(dx >= 0 ? 1 : -1);
    this.summonCd -= delta;

    switch (this.state) {
      case 'idle': {
        const plat = this.platform(now);
        const moving = Math.abs(dx) > 170 && !this.atEdge(plat, this.dir) && !this.blockedAhead(this.dir);
        this.body.setVelocityX(moving ? this.dir * this.def.speed * mult * (this.enraged ? 1.3 : 1) : 0);
        this.playAnim(moving ? 'move' : 'idle');
        this.actCd -= delta;
        if (this.actCd <= 0) this.chooseAction(Math.abs(dx));
        break;
      }
      case 'volley': {
        this.body.setVelocityX(0);
        if (this.stateT >= this.volleyAt) {
          this.fireVolley(p);
          this.volleysLeft--;
          if (this.volleysLeft > 0) { this.volleyAt = this.stateT + 480; this.playAnim('attack', true); }
          else { this.charge?.destroy(); this.charge = null; this.toIdle(); }
        } else if (this.charge) {
          const k = Phaser.Math.Clamp(this.stateT / this.volleyAt, 0, 1);
          this.charge.setScale(0.5 + k * 1.4).setAlpha(0.5 + k * 0.5);
        }
        break;
      }
      case 'slam': {
        this.body.setVelocityX(0);
        if (this.zones.length === 0 && this.stateT > 300) this.toIdle();
        break;
      }
      case 'teleport': {
        this.body.setVelocityX(0);
        if (!this.teleported && this.stateT >= 320) { this.teleported = true; this.doTeleport(p); }
        if (this.stateT >= 700) this.toIdle(600);
        break;
      }
      case 'summon': {
        this.body.setVelocityX(0);
        if (!this.summoned && this.stateT >= 750) { this.summoned = true; this.doSummon(); }
        if (this.stateT >= 1100) this.toIdle();
        break;
      }
    }
  }

  // ─────────────────────────── behaviour ───────────────────────────

  private playerPos(): { x: number; y: number } | null {
    try {
      const s = this.services;
      if (!s.player || s.progression?.isDead()) return null;
      return { x: s.player.x, y: s.player.y };
    } catch { return null; }
  }

  private engage() {
    if (this.state !== 'dormant') return;
    this.state = 'idle';
    this.stateT = 0;
    this.actCd = 1400;
    this.provoke(1e9);
    try { this.services.audio?.play('boss_roar'); } catch { /* ignore */ }
    try { this.scene.cameras.main.shake(350, 0.006); } catch { /* ignore */ }
    try { bus.emit('ui:log', { text: 'The Lich Archon has awakened!', color: '#e7c6ff' }); } catch { /* ignore */ }
    this.createBar();
  }

  private enrage() {
    this.enraged = true;
    try { this.services.audio?.play('boss_roar', { detune: -300 }); } catch { /* ignore */ }
    try { this.scene.cameras.main.shake(300, 0.007); } catch { /* ignore */ }
    try { bus.emit('ui:log', { text: 'The Lich Archon is enraged!', color: '#ff8ad8' }); } catch { /* ignore */ }
    if (this.scene.textures.exists(MFX.aura) && !this.aura) {
      this.aura = this.scene.add.image(this.x, this.y - this.def.size.h / 2, MFX.aura)
        .setDepth(this.sprite.depth - 0.2).setTint(0xff3a9a).setBlendMode(Phaser.BlendModes.ADD).setScale(2.2, 2.6);
    }
  }

  private toIdle(cd?: number) {
    this.state = 'idle';
    this.stateT = 0;
    this.actCd = cd ?? rand(1500, 2500) * (this.enraged ? 0.6 : 1);
  }

  private chooseAction(absDx: number) {
    const addsAlive = this.addsAlive();
    const opts: [BossState, number][] = [
      ['volley', 40],
      ['slam', absDx < 500 ? 35 : 15],
      ['teleport', absDx > 380 ? 30 : 10],
      ['summon', this.summonCd <= 0 && addsAlive < 2 ? 25 : 0],
    ];
    const total = opts.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    let pick: BossState = 'volley';
    for (const [s, w] of opts) { if ((r -= w) <= 0) { pick = s; break; } }
    this.state = pick;
    this.stateT = 0;
    if (pick === 'volley') this.startVolley();
    else if (pick === 'slam') this.startSlam();
    else if (pick === 'teleport') this.startTeleport();
    else this.startSummon();
  }

  private addsAlive(): number {
    try {
      const alive = new Set(this.services.monsters.all().map(m => m.uid));
      for (const uid of [...this.adds]) if (!alive.has(uid)) this.adds.delete(uid);
    } catch { /* ignore */ }
    return this.adds.size;
  }

  // ── orb volley ──
  private startVolley() {
    this.volleysLeft = this.enraged ? 2 : 1;
    this.volleyAt = this.enraged ? 480 : 680;
    this.playAnim('attack', true);
    if (this.scene.textures.exists(MFX.orb)) {
      this.charge?.destroy();
      this.charge = this.scene.add.image(this.x, this.y - 150, MFX.orb).setDepth(DEPTH.VFX).setScale(0.5)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    try { this.services.audio?.play('cast_arcane', { detune: -600 }); } catch { /* ignore */ }
  }

  private fireVolley(p: { x: number; y: number }) {
    const ox = this.x + (this.sprite.flipX ? -46 : 46), oy = this.y - 140;
    const n = this.enraged ? 7 : 5;
    const spread = this.enraged ? 0.95 : 0.7;
    const base = Math.atan2(p.y - 30 - oy, p.x - ox);
    const speed = this.enraged ? 330 : 270;
    for (let i = 0; i < n; i++) {
      const a = base + (i / (n - 1) - 0.5) * spread;
      const img = this.scene.textures.exists(MFX.orb)
        ? this.scene.add.image(ox, oy, MFX.orb).setBlendMode(Phaser.BlendModes.ADD)
        : this.scene.add.image(ox, oy, '__WHITE').setDisplaySize(14, 14).setTint(0xa040ff);
      img.setDepth(DEPTH.VFX);
      this.orbs.push({ img, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 3400 });
    }
    try { this.services.audio?.play('whoosh', { detune: -400 }); } catch { /* ignore */ }
  }

  private tickOrbs(delta: number) {
    if (!this.orbs.length) return;
    const dt = delta / 1000;
    let pb: Phaser.Geom.Rectangle | null = null;
    try { pb = this.services.player?.getBounds() ?? null; } catch { pb = null; }
    const dead = this.isPlayerDead();
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.life -= delta;
      o.img.x += o.vx * dt;
      o.img.y += o.vy * dt;
      o.img.rotation += dt * 6;
      const out = o.img.x < -50 || o.img.y < -50 || o.img.x > this.map.widthPx + 50 || o.img.y > this.map.heightPx + 50;
      let hit = false;
      if (pb && !dead) {
        const r = 10;
        hit = o.img.x + r > pb.x && o.img.x - r < pb.right && o.img.y + r > pb.y && o.img.y - r < pb.bottom;
      }
      if (hit) {
        try { this.services.combat.hitPlayer(this.orbDmg, o.img.x); } catch { /* ignore */ }
      }
      if (hit || out || o.life <= 0) {
        this.popOrb(o.img);
        this.orbs.splice(i, 1);
      }
    }
  }

  private popOrb(img: Phaser.GameObjects.Image) {
    this.scene.tweens.add({ targets: img, scale: img.scale * 2.2, alpha: 0, duration: 180, onComplete: () => img.destroy() });
  }

  // ── ground slam ──
  private startSlam() {
    this.playAnim('attack', true);
    const p = this.playerPos();
    if (!p) { this.toIdle(); return; }
    const dur = this.enraged ? 720 : 900;
    this.addZone(p.x, p.y, dur);
    if (this.enraged) this.addZone(p.x + (Math.random() < 0.5 ? -1 : 1) * rand(220, 320), p.y, dur + 150);
  }

  private addZone(x: number, nearY: number, dur: number) {
    const plat = platformUnder(this.map, x, nearY, 24);
    const groundY = plat ? plat.y : nearY;
    const w = 220, h = 92;
    let left = x - w / 2;
    if (plat) left = Phaser.Math.Clamp(left, plat.x1 - 20, plat.x2 - w + 20);
    left = Phaser.Math.Clamp(left, 0, Math.max(0, this.map.widthPx - w));
    const rect = new Phaser.Geom.Rectangle(left, groundY - h, w, h);
    const g = this.scene.add.graphics().setDepth(DEPTH.VFX - 1);
    this.zones.push({ g, rect, t: 0, dur });
  }

  private tickZones(delta: number) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += delta;
      const k = Phaser.Math.Clamp(z.t / z.dur, 0, 1);
      const pulse = 0.5 + 0.5 * Math.sin(z.t / 60);
      const r = z.rect;
      z.g.clear();
      z.g.fillStyle(0xff2030, 0.12 + 0.18 * k + 0.08 * pulse).fillRect(r.x, r.y, r.width, r.height);
      z.g.fillStyle(0xff2030, 0.35 + 0.3 * k).fillRect(r.x, r.bottom - 6, r.width, 6);
      z.g.fillStyle(0xffd0d8, 0.5 + 0.4 * pulse).fillRect(r.x, r.bottom - 6, r.width * k, 2);
      z.g.lineStyle(2, 0xff5060, 0.6 + 0.4 * pulse).strokeRect(r.x, r.y, r.width, r.height);
      if (z.t >= z.dur) {
        this.resolveZone(z);
        z.g.destroy();
        this.zones.splice(i, 1);
      }
    }
  }

  private resolveZone(z: Zone) {
    const r = z.rect;
    try {
      const pb = this.services.player?.getBounds();
      if (pb && !this.isPlayerDead() && Phaser.Geom.Intersects.RectangleToRectangle(pb, r)) {
        this.services.combat.hitPlayer(this.slamDmg, r.centerX);
      }
    } catch { /* ignore */ }
    try { this.services.audio?.play('explosion', { detune: -500 }); } catch { /* ignore */ }
    try { this.scene.cameras.main.shake(180, 0.006); } catch { /* ignore */ }
    // dark pillars burst
    const fx = this.scene.add.graphics().setDepth(DEPTH.VFX);
    fx.fillStyle(0x7a2aff, 0.55).fillRect(r.x, r.y - 40, r.width, r.height + 40);
    fx.fillStyle(0xffd0ff, 0.6).fillRect(r.x, r.bottom - 10, r.width, 10);
    this.scene.tweens.add({ targets: fx, alpha: 0, duration: 380, onComplete: () => fx.destroy() });
    if (this.scene.textures.exists(MFX.puff)) {
      for (let i = 0; i < 8; i++) {
        const px = r.x + Math.random() * r.width;
        const p = this.scene.add.image(px, r.bottom, MFX.puff).setTint(0x9a4aff).setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(DEPTH.VFX).setScale(rand(0.6, 1.1));
        this.scene.tweens.add({ targets: p, y: r.bottom - rand(40, 110), alpha: 0, scale: p.scale * 1.6, duration: rand(400, 650), onComplete: () => p.destroy() });
      }
    }
  }

  // ── teleport ──
  private startTeleport() {
    this.teleported = false;
    this.puff(this.x, this.y - 80);
    this.scene.tweens.add({ targets: this.sprite, alpha: 0.08, duration: 300 });
    try { this.services.audio?.play('blink', { detune: -500 }); } catch { /* ignore */ }
  }

  private doTeleport(p: { x: number; y: number }) {
    const plat = platformUnder(this.map, this.x, this.y, 12);
    const side = p.x > this.x ? 1 : -1; // land on the far side of the player
    let tx = p.x + side * rand(220, 320);
    const minX = Math.max(60, plat ? plat.x1 + 50 : 60), maxX = Math.min(this.map.widthPx - 60, plat ? plat.x2 - 50 : this.map.widthPx - 60);
    if (tx < minX || tx > maxX) tx = p.x - side * rand(220, 320);
    tx = Phaser.Math.Clamp(tx, minX, Math.max(minX, maxX));
    this.sprite.setPosition(tx, this.y);
    this.body.setVelocity(0, 0);
    this.puff(tx, this.y - 80);
    this.scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 320 });
  }

  private puff(x: number, y: number) {
    if (!this.scene.textures.exists(MFX.puff)) return;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = this.scene.add.image(x, y + rand(-50, 50), MFX.puff).setTint(0x6a2ab0).setDepth(DEPTH.VFX).setScale(rand(0.8, 1.4));
      this.scene.tweens.add({ targets: p, x: x + Math.cos(a) * rand(30, 60), alpha: 0, duration: rand(350, 600), onComplete: () => p.destroy() });
    }
  }

  // ── summon ──
  private startSummon() {
    this.summoned = false;
    this.summonCd = this.enraged ? 13000 : 18000;
    this.playAnim('attack', true);
    try { this.services.audio?.play('cast_arcane', { detune: -900 }); } catch { /* ignore */ }
    if (this.scene.textures.exists(MFX.aura)) {
      const ring = this.scene.add.image(this.x, this.y - 6, MFX.aura).setTint(0xa040ff).setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(this.sprite.depth - 0.3).setScale(0.4, 0.12);
      this.scene.tweens.add({ targets: ring, scaleX: 2.6, scaleY: 0.5, alpha: 0, duration: 800, onComplete: () => ring.destroy() });
    }
  }

  private doSummon() {
    const n = this.enraged ? 3 : Phaser.Math.Between(2, 3);
    for (let i = 0; i < n; i++) {
      const sx = Phaser.Math.Clamp(this.x + (i - (n - 1) / 2) * 90 + rand(-15, 15), 40, this.map.widthPx - 40);
      const sy = this.y - rand(70, 120);
      try {
        const m = this.services.monsters.spawn(ADD_ID, sx, sy);
        if (m) {
          this.adds.add(m.uid);
          if (m instanceof Monster) m.provoke(30000);
          this.puff(sx, sy - 20);
        }
      } catch { /* ignore */ }
    }
  }

  private cleanupAttacks() {
    this.orbs.forEach(o => o.img.destroy());
    this.orbs = [];
    this.zones.forEach(z => z.g.destroy());
    this.zones = [];
    this.charge?.destroy();
    this.charge = null;
  }

  private isPlayerDead(): boolean {
    try { return !!this.services.progression?.isDead(); } catch { return false; }
  }

  // ─────────────────────────── boss HP bar ───────────────────────────

  private createBar() {
    if (this.bar) return;
    this.bar = new BossBar(this.scene, `Lv.${this.def.level}  ${this.def.name}`, LICH_BAR_STYLE);
    this.redrawBar(true);
  }

  private redrawBar(force: boolean) {
    this.bar?.update(this.hp, this.maxHp, this.enraged, force);
  }
}
