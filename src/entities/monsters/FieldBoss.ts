// OWNER: A6 (monsters). FieldBoss: reusable base for the rare per-zone mini-bosses ("field bosses").
//
// Generalised from LichArchon: a roam → engaged state machine, weighted action picking with per-action
// cooldowns, telegraphed ground zones / columns / lanes (0.6–1 s readable warnings), lingering hazards
// (DoT puddles / clouds), lobbed projectiles, adds with a cap, the shared top-of-screen BossBar, optional
// enrage, and crowd-control fairness (freeze/stun capped + a short CC lockout so it can't be chain-locked).
// Every active attack's damage goes through `dmg()` → touchDamage × mult × outgoingDamageMult() (curse).
import Phaser from 'phaser';
import type { GameServices, IMapInstance, MonsterDef, PlatformDef, StatusInstance } from '../../core/types';
import { bus } from '../../core/events';
import { DEPTH } from '../../core/constants';
import { MFX } from '../../art/monsterArt';
import { Monster, type MonsterSpawnOptions } from '../Monster';
import { platformUnder, scanGround } from './ground';
import { BossBar, type BossBarStyle } from './bossBar';

export const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** One attack/ability. `start` runs once; `tick` runs every frame (not while frozen/stunned) until it returns true. */
export interface BossAction {
  id: string;
  /** Relative pick weight right now (0 = not available). */
  weight: (absDx: number) => number;
  /** Minimum time before this action may be picked again. */
  cooldownMs?: number;
  start: () => void;
  tick: (dt: number, t: number, mult: number) => boolean;
  /** Called when the action is aborted (death / disengage). */
  cancel?: () => void;
}

export interface FieldBossConfig {
  bar: BossBarStyle;
  /** Accent colour for logs (CSS). */
  logColor: string;
  /** Player within this many px (horizontally, same tier-ish) wakes the boss. */
  engageRange?: number;
  /** Idle approach distance: the boss walks until the player is within this. */
  keepDist?: number;
  /** Pause between actions [min, max] ms (×0.65 while enraged). */
  actionGap?: [number, number];
  /** HP fraction under which the boss enrages (undefined = never). */
  enrageAt?: number;
  enrageTint?: number;
  /** Flying boss: no gravity, hovers this many px above its arena floor. */
  hover?: number;
  addIds?: string[];
  maxAdds?: number;
}

interface Tele {
  g: Phaser.GameObjects.Graphics;
  rect: Phaser.Geom.Rectangle;
  t: number;
  dur: number;
  kind: 'ground' | 'column' | 'lane';
  color: number;
  dir: 1 | -1;
  onDone: (r: Phaser.Geom.Rectangle) => void;
}

interface Hazard {
  rect: Phaser.Geom.Rectangle;
  life: number;
  total: number;
  tickMs: number;
  acc: number;
  dmg: number;
  objs: Phaser.GameObjects.GameObject[];
  onTick?: (h: Hazard, dt: number) => void;
}

interface Proj {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  spin: number;
  /** Damage on direct hit (0 = none). */
  dmg: number;
  onLand?: (x: number, groundY: number) => void;
}

/** Warning palette: the same red-orange family for every boss so danger always reads the same. */
const WARN = 0xff3a2a;

export class FieldBoss extends Monster {
  protected cfg: Required<Pick<FieldBossConfig, 'engageRange' | 'keepDist' | 'actionGap' | 'maxAdds'>> & FieldBossConfig;
  protected mode: 'roam' | 'engaged' = 'roam';
  protected enraged = false;
  protected action: BossAction | null = null;
  protected actionT = 0;
  protected actCd = 1800;
  protected actions: BossAction[] = [];
  protected arena: { x1: number; x2: number; y: number };
  protected adds = new Set<number>();
  /** Movement speed multiplier (e.g. a roar frenzy). */
  protected haste = 1;
  /** While set, no contact damage: the current attack deals its own (telegraphed) damage instead. */
  protected noContact = false;
  private cooldowns = new Map<string, number>();
  private teles: Tele[] = [];
  private hazards: Hazard[] = [];
  private projs: Proj[] = [];
  private bar: BossBar | null = null;
  private aura: Phaser.GameObjects.Image | null = null;
  private farFor = 0;
  private roamTarget: number | null = null;
  private roamAt = 0;
  private ccLockoutUntil = 0;
  private offKilled: (() => void) | null = null;

  constructor(scene: Phaser.Scene, services: GameServices, def: MonsterDef, x: number, y: number, map: IMapInstance,
    opts: MonsterSpawnOptions, cfg: FieldBossConfig) {
    super(scene, services, def, x, y, map, opts);
    this.cfg = { engageRange: 340, keepDist: 90, actionGap: [1300, 2200], maxAdds: 3, ...cfg };
    this.arena = FieldBoss.arenaAround(map, x, opts.band?.y ?? y, opts.band);
    // Field bosses live on their arena floor: drop the one-way platform collider so jumps / dives / big bodies
    // never snag on the jump-through ledges above (solid ground + walls still collide).
    this.colliders = this.colliders.filter(c => {
      if ((c as unknown as { object2: unknown }).object2 === map.platforms) { c.destroy(); return false; }
      return true;
    });
    if (cfg.hover !== undefined) {
      this.body.setAllowGravity(false);
      this.sprite.y = this.arena.y - cfg.hover;
    }
    this.offKilled = bus.on('monster:killed', ({ monster }) => { this.adds.delete(monster.uid); });
  }

  /**
   * The free stretch of floor around (x, y): the surface under it, cut by walls standing on it and by a keep-out
   * strip around portals, so the boss (and its charges) never reach a map exit.
   */
  static arenaAround(map: IMapInstance, x: number, y: number, band?: { x1: number; x2: number; y: number }): { x1: number; x2: number; y: number } {
    const p: PlatformDef | null = platformUnder(map, x, y, 16) ?? scanGround(map, x, y - 8);
    const gy = p?.y ?? y;
    let x1 = p ? p.x1 : 0, x2 = p ? p.x2 : map.widthPx;
    const cut = (a: number, b: number) => {
      if (b <= x) x1 = Math.max(x1, b);
      else if (a >= x) x2 = Math.min(x2, a);
    };
    for (const w of map.def.walls ?? []) if (w.y < gy - 2 && w.y + w.h >= gy - 2) cut(w.x, w.x + w.w);
    for (const pt of map.def.portals ?? []) if (Math.abs(pt.y - gy) <= 16) cut(pt.x - 150, pt.x + 150);
    if (band) { x1 = Math.max(x1, Math.min(band.x1, band.x2) - 40); x2 = Math.min(x2, Math.max(band.x1, band.x2) + 40); }
    if (x2 - x1 < 200) { x1 = x - 100; x2 = x + 100; }
    return { x1, x2, y: gy };
  }

  // ─────────────────────────── subclass API ───────────────────────────

  /** Damage of an active attack: touch damage × mult, weakened by curse like contact damage. */
  protected dmg(mult: number): number {
    return Math.max(1, Math.round(this.def.touchDamage * mult * this.outgoingDamageMult()));
  }

  protected playerPos(): { x: number; y: number } | null {
    try {
      const s = this.services;
      if (!s.player || s.progression?.isDead()) return null;
      return { x: s.player.x, y: s.player.y };
    } catch { return null; }
  }

  protected playerBounds(): Phaser.Geom.Rectangle | null {
    try { return this.services.progression?.isDead() ? null : this.services.player?.getBounds() ?? null; } catch { return null; }
  }

  /** Hit the player (with knockback/i-frames) if their hitbox overlaps `r`. */
  protected hitIfOverlap(r: Phaser.Geom.Rectangle, dmg: number, fromX = r.centerX): boolean {
    const pb = this.playerBounds();
    if (!pb || !Phaser.Geom.Intersects.RectangleToRectangle(pb, r)) return false;
    try { this.services.combat.hitPlayer(dmg, fromX); } catch { /* ignore */ }
    return true;
  }

  protected sfx(key: Parameters<GameServices['audio']['play']>[0], opts?: { volume?: number; detune?: number }) {
    try { this.services.audio?.play(key, opts); } catch { /* ignore */ }
  }

  protected shake(ms: number, k: number) {
    try { this.scene.cameras.main.shake(ms, k); } catch { /* ignore */ }
  }

  protected log(text: string) {
    try { bus.emit('ui:log', { text, color: this.cfg.logColor }); } catch { /* ignore */ }
  }

  protected clampX(x: number, margin = this.def.size.w / 2 + 6): number {
    return Phaser.Math.Clamp(x, this.arena.x1 + margin, Math.max(this.arena.x1 + margin, this.arena.x2 - margin));
  }

  /** Ground y under x (the arena floor or a platform in between), for landing effects. */
  protected groundAt(x: number, fromY: number): number {
    const p = scanGround(this.map, x, fromY - 4);
    return p ? p.y : this.arena.y;
  }

  /**
   * Telegraph a rectangle, then call `onDone` (resolve damage there). `ground`: area on the floor, fills from the
   * centre out; `column`: tall strip (falling things / bolts), fills top-down; `lane`: horizontal charge path,
   * fills in `dir`.
   */
  protected telegraph(rect: Phaser.Geom.Rectangle, durMs: number, onDone: (r: Phaser.Geom.Rectangle) => void,
    kind: Tele['kind'] = 'ground', dir: 1 | -1 = 1, color = WARN) {
    if (this.destroyed) return;
    const g = this.scene.add.graphics().setDepth(DEPTH.VFX - 1);
    this.teles.push({ g, rect, t: 0, dur: Math.max(200, durMs), kind, color, dir, onDone });
  }

  /** A ground rectangle `w` wide (and `h` tall) standing on the floor under x. */
  protected groundRect(x: number, w: number, h: number, nearY = this.arena.y): Phaser.Geom.Rectangle {
    const gy = this.groundAt(x, nearY - 40);
    return new Phaser.Geom.Rectangle(Math.round(x - w / 2), gy - h, w, h);
  }

  /** Lingering damage area: `dmg` every `tickMs` while the player stands in it (no knockback — it's a DoT). */
  protected addHazard(rect: Phaser.Geom.Rectangle, lifeMs: number, tickMs: number, dmg: number,
    objs: Phaser.GameObjects.GameObject[] = [], onTick?: Hazard['onTick']) {
    // An attack can resolve after the boss was destroyed mid-callback (e.g. its hit killed the player in a Trial).
    if (this.destroyed) { objs.forEach(o => { try { o.destroy(); } catch { /* ignore */ } }); return; }
    this.hazards.push({ rect, life: lifeMs, total: lifeMs, tickMs, acc: tickMs * 0.6, dmg, objs, onTick });
  }

  /** Lobbed / thrown projectile; lands on the ground under it (calls onLand) or hits the player directly. */
  protected addProjectile(img: Phaser.GameObjects.Image, vx: number, vy: number, gravity: number, dmg: number,
    onLand?: (x: number, groundY: number) => void, spin = 0) {
    if (this.destroyed) { img.destroy(); return; }
    img.setDepth(DEPTH.VFX);
    this.projs.push({ img, vx, vy, gravity, life: 4000, spin, dmg, onLand });
  }

  /** Summon up to `n` adds (respecting maxAdds) around the boss inside the arena. */
  protected summonAdds(n: number) {
    const ids = this.cfg.addIds ?? [];
    if (!ids.length) return 0;
    const room = Math.max(0, this.cfg.maxAdds - this.addsAlive());
    let made = 0;
    for (let i = 0; i < Math.min(n, room); i++) {
      const sx = this.clampX(this.x + (i % 2 ? 1 : -1) * rand(90, 220), 30);
      const sy = this.groundAt(sx, this.y - 60) - 1;
      try {
        const m = this.services.monsters.spawn(ids[Math.floor(Math.random() * ids.length)], sx, sy);
        if (m) {
          this.adds.add(m.uid);
          if (m instanceof Monster) m.provoke(30000);
          this.puffAt(sx, sy - 16, 0xffffff, 6);
          made++;
        }
      } catch { /* ignore */ }
    }
    return made;
  }

  protected addsAlive(): number {
    try {
      const alive = new Set(this.services.monsters.all().map(m => m.uid));
      for (const uid of [...this.adds]) if (!alive.has(uid)) this.adds.delete(uid);
    } catch { /* ignore */ }
    return this.adds.size;
  }

  protected puffAt(x: number, y: number, tint: number, n = 8, spread = 40) {
    if (!this.scene.textures.exists(MFX.puff)) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = this.scene.add.image(x + rand(-spread / 3, spread / 3), y + rand(-10, 10), MFX.puff).setTint(tint)
        .setDepth(DEPTH.VFX).setScale(Math.round(rand(1, 2)));
      this.scene.tweens.add({
        targets: p, x: p.x + Math.cos(a) * rand(spread * 0.5, spread), y: p.y + Math.sin(a) * rand(10, 30) - 10,
        alpha: 0, duration: rand(350, 600), onComplete: () => p.destroy(),
      });
    }
  }

  /** Debris chips flying up from a ground point (for slams / impacts). */
  protected debris(x: number, groundY: number, tint: number, n = 8, tex = 'boss_fx_rock') {
    if (!this.scene.textures.exists(tex)) return;
    for (let i = 0; i < n; i++) {
      const img = this.scene.add.image(x + rand(-30, 30), groundY - 4, tex).setTint(tint).setDepth(DEPTH.VFX);
      this.scene.tweens.add({
        targets: img, x: img.x + rand(-80, 80), y: groundY - rand(40, 110), alpha: 0, angle: rand(-180, 180),
        duration: rand(380, 620), ease: 'Quad.easeOut', onComplete: () => img.destroy(),
      });
    }
  }

  /**
   * Telegraphed charge along the floor to the far end of the arena (lane warning → dash → short recovery).
   * The dash hits once for `mult`× touch damage. `anim` plays while winding up and dashing.
   */
  protected makeCharge(o: { id: string; windMs: number; speed: number; mult: number; weight: (absDx: number) => number;
    cooldownMs: number; anim: 'attack' | 'move'; recoverMs?: number; onStart?: () => void; onEnd?: () => void;
    /** Only the lowest `hitH` px of the body hurt while dashing (tall bosses: jumpable, and ledges are safe). */
    hitH?: number }): BossAction {
    const hitH = () => Math.min(this.def.size.h, o.hitH ?? this.def.size.h);
    let dir: 1 | -1 = 1, endX = 0, phase: 'wind' | 'go' | 'recover' = 'wind', goAt = 0, hit = false;
    const laneEnd = (d: 1 | -1) => (d > 0 ? this.arena.x2 - this.def.size.w / 2 - 4 : this.arena.x1 + this.def.size.w / 2 + 4);
    return {
      id: o.id, cooldownMs: o.cooldownMs,
      weight: dx => {
        const p = this.playerPos();
        if (!p) return 0;
        const d: 1 | -1 = p.x >= this.x ? 1 : -1;
        return Math.abs(laneEnd(d) - this.x) > 180 ? o.weight(dx) : 0;
      },
      start: () => {
        const p = this.playerPos();
        dir = p && p.x < this.x ? -1 : 1;
        endX = laneEnd(dir);
        phase = 'wind';
        hit = false;
        goAt = Infinity;
        this.face(dir);
        this.playAnim(o.anim, true);
        const x1 = Math.min(this.x, endX) - this.def.size.w / 2, x2 = Math.max(this.x, endX) + this.def.size.w / 2;
        const lane = new Phaser.Geom.Rectangle(x1, this.arena.y - hitH() - 8, x2 - x1, hitH() + 8);
        this.telegraph(lane, o.windMs, () => { goAt = 0; }, 'lane', dir);
        this.sfx('whoosh', { detune: -700 });
        o.onStart?.();
      },
      tick: (_dt, t, mult) => {
        if (phase === 'wind') {
          this.stopX();
          this.playAnim(o.anim);
          if (goAt === 0) { phase = 'go'; goAt = t; this.noContact = true; this.sfx('whoosh', { detune: -300 }); }
          return t > o.windMs + 1500; // safety
        }
        if (phase === 'go') {
          this.face(dir);
          this.playAnim(o.anim);
          if (this.cfg.hover !== undefined) this.moveToward(endX, o.speed * Math.max(0.5, mult), this.arena.y - this.cfg.hover);
          else this.body.setVelocityX(dir * o.speed * Math.max(0.5, mult));
          const bb = this.getBounds();
          const band = new Phaser.Geom.Rectangle(bb.x, bb.bottom - hitH(), bb.width, hitH());
          if (!hit && this.hitIfOverlap(band, this.dmg(o.mult), this.x - dir * 40)) hit = true;
          const arrived = dir > 0 ? this.x >= endX - 6 : this.x <= endX + 6;
          if (arrived || this.blockedAhead(dir) || t - goAt > 4000) {
            phase = 'recover';
            goAt = t;
            this.noContact = false;
            this.stopX();
            this.shake(160, 0.004);
            this.debris(this.x + dir * this.def.size.w / 2, this.arena.y, 0xc8b8a0, 6);
            o.onEnd?.();
          }
          return false;
        }
        this.stopX();
        this.playAnim('idle');
        return t - goAt >= (o.recoverMs ?? 650);
      },
      cancel: () => { this.stopX(); this.noContact = false; },
    };
  }

  /** Telegraphed summon: a short cast (puffs), then `n` adds. */
  protected makeSummon(o: { id: string; n: () => number; cooldownMs: number; tint: number; weight?: number }): BossAction {
    let done = false;
    return {
      id: o.id, cooldownMs: o.cooldownMs,
      weight: () => (this.addsAlive() < Math.max(1, this.cfg.maxAdds - 1) ? (o.weight ?? 18) : 0),
      start: () => {
        done = false;
        this.playAnim('attack', true);
        this.sfx('boss_roar', { detune: 500, volume: 0.6 });
        this.puffAt(this.x, this.y - this.def.size.h / 2, o.tint, 10, 60);
      },
      tick: (_dt, t) => {
        this.stopX();
        if (!done && t >= 700) { done = true; this.summonAdds(o.n()); }
        return t >= 1000;
      },
    };
  }

  /** Called once when enraged (subclasses add flavour). */
  protected onEnrage(): void {}
  /** Called when the boss first engages (after the bar appears). */
  protected onEngage(): void {}

  // ─────────────────────────── Monster hooks ───────────────────────────

  protected showOverheadBar() { return false; }

  canContact(): boolean { return !this.noContact && super.canContact(); }

  protected baseTint(): number | null { return this.enraged ? (this.cfg.enrageTint ?? 0xffb0a0) : null; }

  /** Freeze/stun: combat already halves boss durations; cap at 1.5 s and then 4 s of CC immunity (no chain-locks). */
  applyStatus(s: StatusInstance): void {
    if (s && (s.kind === 'freeze' || s.kind === 'stun')) {
      const now = this.scene.time.now;
      if (now < this.ccLockoutUntil || this.isLocked()) return;
      const dur = Math.min(1500, Math.max(0, s.durationMs));
      this.ccLockoutUntil = now + dur + 4000;
      super.applyStatus({ ...s, durationMs: dur });
      return;
    }
    super.applyStatus(s);
  }

  protected onDamaged() {
    if (this.mode === 'roam') this.engage();
    this.farFor = 0;
    if (!this.enraged && this.cfg.enrageAt !== undefined && this.hp > 0 && this.hp / this.maxHp < this.cfg.enrageAt) this.enrage();
  }

  protected onBeforeDeath() {
    this.cancelAction();
    this.cleanupAttacks();
    this.bar?.update(0, this.maxHp, this.enraged, true);
    this.bar?.fadeOut(600);
    this.bar = null;
    this.aura?.destroy();
    this.aura = null;
    this.log(`${this.def.name} has been defeated!`);
    this.shake(380, 0.007);
    try { this.scene.cameras.main.flash(260, 255, 240, 200); } catch { /* ignore */ }
  }

  protected onDestroy() {
    this.offKilled?.();
    this.offKilled = null;
    this.cancelAction();
    this.cleanupAttacks();
    this.aura?.destroy();
    this.aura = null;
    this.bar?.destroy();
    this.bar = null;
  }

  protected tickWorld(now: number, delta: number) {
    this.tickTeles(delta);
    this.tickHazards(delta);
    this.tickProjs(delta);
    if (this.aura) {
      this.aura.setPosition(this.x, this.y - this.def.size.h * 0.5);
      this.aura.setAlpha(0.3 + 0.15 * Math.sin(now / 170));
    }
    this.bar?.update(this.hp, this.maxHp, this.enraged);
  }

  protected runAI(now: number, delta: number, mult: number) {
    const p = this.playerPos();
    if (this.mode === 'roam') {
      this.roam(now, mult);
      if (p && Math.abs(p.x - this.x) < this.cfg.engageRange && Math.abs(p.y - this.y) < 300) this.engage();
      return;
    }
    // disengage if the player is gone or far away for a while
    const far = !p || Math.abs(p.x - this.x) > 1300 || Math.abs(p.y - this.y) > 650;
    this.farFor = far ? this.farFor + delta : 0;
    if (this.farFor > 7000 && !this.action) { this.disengage(); return; }

    if (this.action) {
      this.actionT += delta;
      let done = true;
      try { done = this.action.tick(delta, this.actionT, mult); } catch (e) { console.warn(`[boss] ${this.def.id} ${this.action.id}`, e); }
      if (done) this.endAction();
      return;
    }
    if (!p) { this.stopX(); this.playAnim('idle'); return; }
    const dx = p.x - this.x;
    this.face(dx >= 0 ? 1 : -1);
    this.approach(p, mult);
    this.actCd -= delta;
    if (this.actCd <= 0) this.pickAction(Math.abs(dx));
  }

  // ─────────────────────────── movement ───────────────────────────

  protected stopX() {
    this.body.setVelocityX(0);
    if (this.cfg.hover !== undefined) this.body.setVelocityY(0);
  }

  /** Walk (or fly) toward x inside the arena; returns true when there. */
  protected moveToward(tx: number, speed: number, hoverY?: number): boolean {
    const x = this.clampX(tx);
    const dx = x - this.x;
    const there = Math.abs(dx) < 8;
    const dir: 1 | -1 = dx >= 0 ? 1 : -1;
    if (this.cfg.hover !== undefined) {
      const ty = hoverY ?? this.arena.y - this.cfg.hover + Math.sin(this.scene.time.now / 400) * 8;
      this.body.setVelocity(there ? 0 : dir * speed, Phaser.Math.Clamp((ty - this.y) * 4, -speed * 1.5, speed * 1.5));
    } else {
      const blocked = this.blockedAhead(dir);
      this.body.setVelocityX(there || blocked ? 0 : dir * speed);
    }
    return there;
  }

  protected approach(p: { x: number; y: number }, mult: number) {
    const dx = p.x - this.x;
    const want = Math.abs(dx) > this.cfg.keepDist + this.def.size.w / 2;
    const speed = this.def.speed * mult * this.haste * (this.enraged ? 1.25 : 1);
    if (want) {
      this.moveToward(p.x - Math.sign(dx) * this.cfg.keepDist, speed);
      this.playAnim('move');
    } else {
      this.moveToward(this.x, 0);
      this.playAnim('idle');
    }
  }

  private roam(now: number, mult: number) {
    if (this.roamTarget === null || now >= this.roamAt) {
      this.roamTarget = Math.random() < 0.35 ? this.x : rand(this.arena.x1 + 60, this.arena.x2 - 60);
      this.roamAt = now + rand(2500, 5000);
    }
    const there = this.moveToward(this.roamTarget, this.def.speed * 0.55 * mult);
    if (!there) this.face(this.roamTarget >= this.x ? 1 : -1);
    this.playAnim(there ? 'idle' : 'move');
  }

  // ─────────────────────────── state machine ───────────────────────────

  engage() {
    if (this.mode === 'engaged') return;
    this.mode = 'engaged';
    this.farFor = 0;
    this.actCd = 1400;
    this.provoke(1e9);
    this.sfx('boss_roar', { detune: -150 });
    this.shake(260, 0.004);
    this.log(`${this.def.name} turns its attention to you!`);
    if (!this.bar) this.bar = new BossBar(this.scene, `Lv.${this.def.level}  ${this.def.name}`, this.cfg.bar);
    this.bar.update(this.hp, this.maxHp, this.enraged, true);
    this.onEngage();
  }

  private disengage() {
    this.mode = 'roam';
    this.cancelAction();
    this.aggroUntil = 0;
    this.bar?.fadeOut(0);
    this.bar = null;
    this.roamTarget = null;
  }

  protected enrage() {
    this.enraged = true;
    this.sfx('boss_roar', { detune: -350 });
    this.shake(320, 0.007);
    this.log(`${this.def.name} is enraged!`);
    if (this.scene.textures.exists(MFX.aura) && !this.aura) {
      this.aura = this.scene.add.image(this.x, this.y - this.def.size.h / 2, MFX.aura)
        .setDepth(this.sprite.depth - 0.2).setTint(this.cfg.enrageTint ?? 0xff5a2a).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(Math.max(2, Math.round(this.def.size.w / 48)), Math.max(2, Math.round(this.def.size.h / 40)));
    }
    this.onEnrage();
  }

  private pickAction(absDx: number) {
    const now = this.scene.time.now;
    const opts: [BossAction, number][] = [];
    for (const a of this.actions) {
      if ((this.cooldowns.get(a.id) ?? 0) > now) continue;
      let w = 0;
      try { w = a.weight(absDx); } catch { w = 0; }
      if (w > 0) opts.push([a, w]);
    }
    if (!opts.length) { this.actCd = 400; return; }
    const total = opts.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    let pick = opts[0][0];
    for (const [a, w] of opts) { if ((r -= w) <= 0) { pick = a; break; } }
    this.action = pick;
    this.actionT = 0;
    if (pick.cooldownMs) this.cooldowns.set(pick.id, now + pick.cooldownMs);
    this.stopX();
    try { pick.start(); } catch (e) { console.warn(`[boss] ${this.def.id} ${pick.id} start`, e); this.endAction(); }
  }

  private endAction() {
    this.noContact = false;
    this.action = null;
    this.actionT = 0;
    const [a, b] = this.cfg.actionGap;
    this.actCd = rand(a, b) * (this.enraged ? 0.65 : 1);
  }

  private cancelAction() {
    try { this.action?.cancel?.(); } catch { /* ignore */ }
    this.noContact = false;
    this.action = null;
  }

  // ─────────────────────────── telegraphs / hazards / projectiles ───────────────────────────

  private tickTeles(delta: number) {
    // Iterate a snapshot: a resolving telegraph can kill the player, and a Trial then despawns this boss
    // (cleanupAttacks() empties the lists) before the loop finishes.
    for (const z of this.teles.slice()) {
      if (this.destroyed) return;
      z.t += delta;
      const k = Phaser.Math.Clamp(z.t / z.dur, 0, 1);
      const pulse = 0.5 + 0.5 * Math.sin(z.t / 55);
      const r = z.rect, g = z.g;
      g.clear();
      g.fillStyle(z.color, 0.1 + 0.16 * k + 0.08 * pulse).fillRect(r.x, r.y, r.width, r.height);
      if (z.kind === 'ground') {
        g.fillStyle(z.color, 0.45 + 0.3 * k).fillRect(r.x, r.bottom - 6, r.width, 6);
        const w = r.width * k;
        g.fillStyle(0xfff0e0, 0.55 + 0.35 * pulse).fillRect(r.centerX - w / 2, r.bottom - 6, w, 2);
      } else if (z.kind === 'column') {
        g.fillStyle(z.color, 0.25 + 0.2 * k).fillRect(r.x, r.y, r.width, r.height * k);
        g.fillStyle(z.color, 0.6 + 0.3 * pulse).fillRect(r.x - 4, r.bottom - 6, r.width + 8, 6);
        g.fillStyle(0xfff0e0, 0.7).fillRect(r.centerX - 2, r.y, 4, r.height * k);
      } else {
        const w = r.width * k;
        g.fillStyle(z.color, 0.22).fillRect(z.dir > 0 ? r.x : r.right - w, r.y, w, r.height);
        // chevrons pointing along the lane
        g.fillStyle(0xfff0e0, 0.45 + 0.4 * pulse);
        const step = 48, cy = r.centerY;
        for (let x = r.x + 20; x < r.right - 10; x += step) {
          const cx = z.dir > 0 ? x : r.right - (x - r.x);
          for (let j = 0; j < 8; j++) {
            const off = (8 - j) * z.dir * -1;
            g.fillRect(cx + off - 1, cy - j * 2 - 2, 3, 2);
            g.fillRect(cx + off - 1, cy + j * 2, 3, 2);
          }
        }
      }
      g.lineStyle(2, z.color, 0.6 + 0.4 * pulse).strokeRect(r.x, r.y, r.width, r.height);
      if (z.t >= z.dur) {
        g.destroy();
        const i = this.teles.indexOf(z);
        if (i >= 0) this.teles.splice(i, 1);
        if (this._alive) { try { z.onDone(r); } catch (e) { console.warn('[boss] telegraph resolve', e); } }
      }
    }
  }

  private tickHazards(delta: number) {
    if (!this.hazards.length) return;
    const pb = this.playerBounds();
    let inv = false;
    try { inv = !!this.services.player?.isInvulnerable(); } catch { /* ignore */ }
    for (const h of this.hazards.slice()) {
      if (this.destroyed) return; // a DoT tick can kill the player and despawn this boss (see tickTeles)
      h.life -= delta;
      h.acc += delta;
      try { h.onTick?.(h, delta); } catch { /* ignore */ }
      if (h.acc >= h.tickMs) {
        h.acc -= h.tickMs;
        if (pb && !inv && Phaser.Geom.Intersects.RectangleToRectangle(pb, h.rect)) this.dot(h.dmg);
      }
      if (h.life <= 0) {
        for (const o of h.objs) {
          const go = o as Phaser.GameObjects.Image;
          if (!go.active) continue;
          this.scene.tweens.add({ targets: go, alpha: 0, duration: 300, onComplete: () => go.destroy() });
        }
        const i = this.hazards.indexOf(h);
        if (i >= 0) this.hazards.splice(i, 1);
      }
    }
  }

  /** Small DoT tick on the player: mitigated by def, no knockback / i-frames. */
  private dot(raw: number) {
    const s = this.services;
    try {
      if (!s.progression || s.progression.isDead()) return;
      const def = Math.max(0, s.progression.derived().def || 0);
      const amt = Math.max(1, Math.round(raw * (1 - def / (def + 120)))); // raw comes from dmg(): curse already applied
      s.combat.showNumber(s.player.x, s.player.y - 66, amt, 'player');
      s.progression.loseHp(amt);
    } catch { /* ignore */ }
  }

  private tickProjs(delta: number) {
    if (!this.projs.length) return;
    const dt = delta / 1000;
    const pb = this.playerBounds();
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const o = this.projs[i];
      o.life -= delta;
      o.vy += o.gravity * dt;
      o.img.x += o.vx * dt;
      o.img.y += o.vy * dt;
      o.img.rotation += o.spin * dt;
      let gone = o.life <= 0 || o.img.x < this.arena.x1 - 40 || o.img.x > this.arena.x2 + 40 || o.img.y > this.map.heightPx + 50;
      if (!gone && o.dmg > 0 && pb) {
        const r = 10;
        if (o.img.x + r > pb.x && o.img.x - r < pb.right && o.img.y + r > pb.y && o.img.y - r < pb.bottom) {
          try { this.services.combat.hitPlayer(o.dmg, o.img.x); } catch { /* ignore */ }
          o.dmg = 0;
          if (this.destroyed) return;
        }
      }
      if (!gone && o.vy > 0) {
        const gy = this.groundAt(o.img.x, o.img.y - o.vy * dt - 2);
        if (o.img.y >= gy) {
          gone = true;
          try { o.onLand?.(o.img.x, gy); } catch { /* ignore */ }
          if (this.destroyed) return;
        }
      }
      if (gone) {
        o.img.destroy();
        this.projs.splice(i, 1);
      }
    }
  }

  private cleanupAttacks() {
    this.teles.forEach(z => z.g.destroy());
    this.teles = [];
    this.hazards.forEach(h => h.objs.forEach(o => o.destroy()));
    this.hazards = [];
    this.projs.forEach(p => p.img.destroy());
    this.projs = [];
  }
}
