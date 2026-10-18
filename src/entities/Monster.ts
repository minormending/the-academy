// OWNER: A6 (monsters). Monster entity: physics sprite, AI, statuses, hit reactions, death.
import Phaser from 'phaser';
import type { GameServices, IMapInstance, IMonster, MonsterDef, PlatformDef, StatusInstance, StatusKind } from '../core/types';
import { bus } from '../core/events';
import { DEPTH } from '../core/constants';
import { MFX, MONSTER_FOOT_PAD, monsterTextureKey, monsterVisual, type MonsterAnim, type MonsterVisual } from '../art/monsterArt';
import { platformUnder } from './monsters/ground';

export interface MonsterSpawnOptions {
  /** Drift band for flyers (y = spawn line / ground under the band). Defaults to x±180 around the spawn point. */
  band?: { x1: number; x2: number; y: number };
  /** Maple-style fade-in (no contact damage while fading). */
  fadeIn?: boolean;
  /** Start already aggressive (e.g. boss summons). */
  aggro?: boolean;
}

const TAU = Math.PI * 2;
/** Half-width (px) of the strip around a portal that wandering walkers/hoppers turn back from. */
const PORTAL_KEEP_OUT = 110;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
let NEXT_UID = 1;

export class Monster implements IMonster {
  readonly uid: number;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  readonly maxHp: number;
  /** Set once destroy() ran (sprite is gone). */
  destroyed = false;

  protected body: Phaser.Physics.Arcade.Body;
  protected _alive = true;
  protected readonly flyer: boolean;
  protected readonly animBase: string | null;
  protected statuses = new Map<StatusKind, StatusInstance>();
  protected burnAcc = 0;
  protected poisonAcc = 0;
  protected colliders: Phaser.Physics.Arcade.Collider[] = [];
  protected dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  protected wanderMoving = false;
  protected flyPaused = false;
  protected nextDecision = 0;
  protected nextHop = 0;
  protected hitUntil = 0;
  protected knockUntil = 0;
  protected flashUntil = 0;
  protected aggroUntil = 0;
  protected spawning = false;
  protected band: { x1: number; x2: number; y: number };
  protected homeY: number;
  protected phase = Math.random() * TAU;
  protected plat: PlatformDef | null = null;
  protected platCheckAt = 0;
  protected hpBar: Phaser.GameObjects.Graphics | null = null;
  protected hpBarDirty = false;
  protected shell: Phaser.GameObjects.Image | null = null;
  protected stars: Phaser.GameObjects.Image[] = [];
  protected fxAcc = 0;
  protected fxTick = 0;
  protected warned = false;
  protected deathFinished = false;
  protected deathTimer: Phaser.Time.TimerEvent | null = null;
  /** Visual extents of the pixel art (may exceed the hitbox); null for procedural art. */
  protected visual: MonsterVisual | null = null;

  constructor(
    protected scene: Phaser.Scene,
    protected services: GameServices,
    readonly def: MonsterDef,
    x: number,
    y: number,
    protected map: IMapInstance,
    opts: MonsterSpawnOptions = {},
  ) {
    this.uid = NEXT_UID++;
    this.maxHp = Math.max(1, def.hp);
    this.hp = this.maxHp;
    this.flyer = def.behavior === 'flyer';

    const key = monsterTextureKey(def.id);
    const texKey = scene.textures.exists(key) ? key : scene.textures.exists(MFX.fallback) ? MFX.fallback : '__DEFAULT';
    this.animBase = texKey === '__DEFAULT' ? null : texKey;
    this.visual = monsterVisual(texKey);
    const tex = scene.textures.get(texKey);
    const frame = tex.has('idle_0') ? 'idle_0' : undefined;

    this.sprite = scene.physics.add.sprite(x, y, texKey, frame);
    const fw = this.sprite.width, fh = this.sprite.height;
    this.sprite.setOrigin(0.5, fh > MONSTER_FOOT_PAD ? (fh - MONSTER_FOOT_PAD) / fh : 1);
    this.sprite.setDepth(DEPTH.MONSTER + (def.boss ? 0.5 : 0));
    this.sprite.setData('monster', this);

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const { w, h } = def.size;
    this.body.setSize(w, h, false);
    this.body.setOffset((fw - w) / 2, fh - MONSTER_FOOT_PAD - h);
    this.body.setCollideWorldBounds(true);
    if (this.flyer) this.body.setAllowGravity(false);
    this.sprite.setPosition(x, y);

    try {
      if (map.solids) this.colliders.push(scene.physics.add.collider(this.sprite, map.solids));
      if (map.platforms && !this.flyer) this.colliders.push(scene.physics.add.collider(this.sprite, map.platforms));
    } catch (e) {
      console.warn('[monster] collider setup failed', e);
    }

    this.band = opts.band ?? { x1: x - 180, x2: x + 180, y: y + 26 };
    if (this.band.x2 - this.band.x1 < 60) { this.band.x1 -= 40; this.band.x2 += 40; }
    this.homeY = this.flyer ? this.band.y - 26 - Math.random() * 30 : y;
    if (this.flyer) this.sprite.y = this.homeY;

    if (opts.aggro) this.aggroUntil = scene.time.now + 20000;
    if (opts.fadeIn) {
      this.spawning = true;
      this.sprite.setAlpha(0);
      scene.tweens.add({
        targets: this.sprite, alpha: 1, duration: 600, ease: 'Sine.easeOut',
        onComplete: () => { this.spawning = false; },
      });
    }
    this.sprite.setFlipX(this.dir < 0);
    this.nextDecision = scene.time.now + rand(300, 1500);
    this.nextHop = scene.time.now + rand(400, 1200);
    this.playAnim('idle');
  }

  // ─────────────────────────── IMonster ───────────────────────────

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get alive() { return this._alive && !this.destroyed; }

  getBounds(): Phaser.Geom.Rectangle {
    const { w, h } = this.def.size;
    return new Phaser.Geom.Rectangle(this.sprite.x - w / 2, this.sprite.y - h, w, h);
  }

  takeDamage(amount: number, opts: { crit?: boolean; knockbackX?: number; fromX?: number } = {}): void {
    if (!this.alive) return;
    const now = this.scene.time.now;
    const dmg = Math.max(0, Number.isFinite(amount) ? amount : 0);
    this.hp = Math.max(0, this.hp - dmg);
    if (this.def.aggressive || this.def.boss) this.aggroUntil = now + 12000;
    try { this.onDamaged(dmg, opts); } catch (e) { console.warn('[monster] onDamaged', e); }
    if (this.hp <= 0) { this.die(); return; }

    this.sprite.setTintFill(0xffffff);
    this.flashUntil = now + 70;
    this.hpBarDirty = true;

    if (!this.def.boss && !this.isLocked()) {
      const fromX = opts.fromX ?? this.playerX() ?? this.x - this.dir;
      const kdir: 1 | -1 = this.x >= fromX ? 1 : -1;
      if (now >= this.hitUntil - 120) {
        const dist = Math.max(8, Math.abs(opts.knockbackX ?? 0));
        this.body.setVelocityX(kdir * dist / 0.16);
        if (this.flyer) this.body.setVelocityY(0);
        this.knockUntil = now + 160;
      }
      this.hitUntil = now + 280;
      this.dir = kdir === 1 ? -1 : 1; // face the attacker
      this.sprite.setFlipX(this.dir < 0);
      this.playAnim('hit', true);
    }
  }

  applyStatus(s: StatusInstance): void {
    if (!this.alive || !s) return;
    if (this.def.immune?.includes(s.kind)) return;
    let dur = Math.max(0, s.durationMs);
    if (this.def.boss && (s.kind === 'freeze' || s.kind === 'stun')) dur = Math.min(dur, 2500);
    if (dur <= 0) return;
    const cur = this.statuses.get(s.kind);
    if (cur) {
      cur.durationMs = Math.max(cur.durationMs, dur);
      cur.potency = Math.max(cur.potency, s.potency);
      cur.element = s.element;
    } else {
      this.statuses.set(s.kind, { kind: s.kind, durationMs: dur, potency: s.potency, element: s.element });
      if (s.kind === 'burn') this.burnAcc = 0;
      if (s.kind === 'poison') this.poisonAcc = 0;
      this.onStatusStart(s.kind);
    }
    if (s.kind === 'freeze' || s.kind === 'stun') {
      this.body.setVelocityX(0);
      if (this.flyer) this.body.setVelocityY(0);
      this.hitUntil = 0;
    }
  }

  hasStatus(kind: StatusKind): boolean { return this.statuses.has(kind); }

  removeStatus(kind: StatusKind): void {
    if (!this.statuses.has(kind)) return;
    this.statuses.delete(kind);
    this.onStatusEnd(kind);
  }

  incomingDamageMult(): number {
    const sh = this.statuses.get('shock');
    const cu = this.statuses.get('curse');
    return (sh ? 1 + Math.max(0, sh.potency) : 1) * (cu ? 1 + Math.max(0, cu.potency) : 1);
  }

  /** Multiplier on damage this monster deals (curse weakens it). */
  outgoingDamageMult(): number {
    const cu = this.statuses.get('curse');
    return cu ? 1 - Math.min(0.6, Math.max(0, cu.potency)) : 1;
  }

  update(time: number, delta: number): void {
    if (this.destroyed) return;
    try {
      this.tick(time, Math.min(delta, 50));
    } catch (e) {
      if (!this.warned) { this.warned = true; console.warn(`[monster] ${this.def.id} update error`, e); }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this._alive = false;
    try { this.onDestroy(); } catch { /* ignore */ }
    for (const c of this.colliders) { try { c.destroy(); } catch { /* ignore */ } }
    this.colliders = [];
    this.clearStatusVisuals();
    this.statuses.clear();
    this.hpBar?.destroy();
    this.hpBar = null;
    this.deathTimer?.remove(false);
    try { this.scene.tweens.killTweensOf(this.sprite); } catch { /* ignore */ }
    this.sprite.destroy();
  }

  // ─────────────────────────── extra public API ───────────────────────────

  /** Monster may deal contact damage right now. */
  canContact(): boolean {
    return this.alive && !this.spawning && !this.isLocked() && this.sprite.alpha > 0.5;
  }
  /** Force aggro for `ms` (used for summons). */
  provoke(ms = 15000) { this.aggroUntil = Math.max(this.aggroUntil, this.scene.time.now + ms); }
  isLocked(): boolean { return this.statuses.has('freeze') || this.statuses.has('stun'); }

  // ─────────────────────────── hooks for subclasses ───────────────────────────

  protected onDamaged(_amount: number, _opts: { crit?: boolean; knockbackX?: number; fromX?: number }): void {}
  protected onBeforeDeath(): void {}
  protected onDestroy(): void {}
  /** Extra per-frame work while alive, even when frozen/stunned (e.g. boss projectiles). */
  protected tickWorld(_time: number, _delta: number): void {}
  /** Tint applied when no status tint is active (null = none). */
  protected baseTint(): number | null { return null; }
  protected showOverheadBar(): boolean { return true; }

  // ─────────────────────────── core loop ───────────────────────────

  protected tick(now: number, delta: number) {
    if (!this._alive) return;
    this.tickStatuses(delta);
    if (!this._alive) return;
    this.tickWorld(now, delta);
    if (!this._alive) return;

    if (this.isLocked()) {
      this.body.setVelocityX(0);
      if (this.flyer) this.body.setVelocityY(0);
      if (this.statuses.has('freeze')) { if (!this.sprite.anims.isPaused) this.sprite.anims.pause(); }
      else { if (this.sprite.anims.isPaused) this.sprite.anims.resume(); this.playAnim('idle'); }
    } else {
      if (this.sprite.anims.isPaused) this.sprite.anims.resume();
      if (now < this.hitUntil) {
        this.tickHitstun(now);
      } else {
        this.runAI(now, delta, this.speedMult());
      }
    }
    this.updateOverlays(now, delta);
  }

  protected tickHitstun(now: number) {
    if (now >= this.knockUntil) {
      this.body.setVelocityX(0);
    } else if (!this.flyer) {
      const plat = this.platform(now);
      const vx = this.body.velocity.x;
      if (plat && vx !== 0) {
        const half = this.def.size.w / 2;
        if ((vx > 0 && this.x + half * 0.5 >= plat.x2) || (vx < 0 && this.x - half * 0.5 <= plat.x1)) this.body.setVelocityX(0);
      }
    }
    if (this.flyer) this.body.setVelocityY(0);
    this.playAnim('hit');
  }

  protected speedMult(): number {
    const ch = this.statuses.get('chill');
    return ch ? Phaser.Math.Clamp(1 - ch.potency, 0.1, 1) : 1;
  }

  protected runAI(now: number, delta: number, mult: number) {
    switch (this.def.behavior) {
      case 'walker': this.aiWalker(now, mult); break;
      case 'hopper': this.aiHopper(now, mult); break;
      case 'flyer': this.aiFlyer(now, delta, mult); break;
      case 'boss': this.aiWalker(now, mult); break;
      default: this.aiStationary(); break;
    }
  }

  // ─────────────────────────── AI ───────────────────────────

  protected playerX(): number | null {
    try { return this.services.player?.x ?? null; } catch { return null; }
  }

  /** Player position if this monster is currently chasing it. */
  protected aggroTarget(maxDy = 150, maxDx = 700): { x: number; y: number } | null {
    if (this.scene.time.now >= this.aggroUntil) return null;
    const s = this.services;
    try {
      if (!s.player || s.progression?.isDead()) return null;
      const px = s.player.x, py = s.player.y;
      if (Math.abs(px - this.x) > maxDx || Math.abs(py - this.y) > maxDy) return null;
      return { x: px, y: py };
    } catch { return null; }
  }

  protected grounded(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  protected platform(now: number): PlatformDef | null {
    if (now >= this.platCheckAt) {
      this.platCheckAt = now + 200;
      if (this.grounded()) this.plat = platformUnder(this.map, this.x, this.y, 10);
    }
    return this.plat;
  }

  protected atEdge(plat: PlatformDef | null, dir: number, ahead = 4, avoidPortals = false): boolean {
    const half = this.def.size.w / 2;
    const lookX = this.x + dir * (half * 0.5 + ahead);
    if (lookX < half || lookX > this.map.widthPx - half) return true;
    // Wandering monsters keep clear of portals so they don't camp the map exits.
    if (avoidPortals && this.nearPortal(lookX + dir * half * 0.5, dir)) return true;
    if (!plat) return false;
    return dir > 0 ? lookX >= plat.x2 : lookX <= plat.x1;
  }

  /** True if heading `dir` takes x into the keep-out zone of a portal on the same floor (never traps one already inside). */
  protected nearPortal(x: number, dir: number): boolean {
    const portals = this.map.def?.portals;
    if (!portals) return false;
    for (const p of portals) {
      if (Math.abs(p.y - this.y) <= 12 && Math.abs(p.x - x) <= PORTAL_KEEP_OUT && Math.sign(p.x - this.x) === dir) return true;
    }
    return false;
  }

  protected blockedAhead(dir: number): boolean {
    return dir > 0 ? this.body.blocked.right : this.body.blocked.left;
  }

  protected face(dir: 1 | -1) {
    this.dir = dir;
    this.sprite.setFlipX(dir < 0);
  }

  protected aiWalker(now: number, mult: number) {
    if (!this.grounded()) { this.playAnim('idle'); return; }
    const plat = this.platform(now);
    const target = this.aggroTarget();
    let moving: boolean;
    if (target) {
      const dx = target.x - this.x;
      this.dir = dx >= 0 ? 1 : -1;
      moving = Math.abs(dx) > 10;
    } else {
      if (now >= this.nextDecision) {
        this.wanderMoving = Math.random() < 0.62;
        if (this.wanderMoving && Math.random() < 0.5) this.dir = this.dir === 1 ? -1 : 1;
        this.nextDecision = now + (this.wanderMoving ? rand(1200, 3600) : rand(700, 2200));
      }
      moving = this.wanderMoving;
    }
    if (moving && (this.atEdge(plat, this.dir, 4, !target) || this.blockedAhead(this.dir))) {
      if (target) moving = false;
      else this.dir = this.dir === 1 ? -1 : 1;
    }
    this.body.setVelocityX(moving ? this.dir * this.def.speed * mult : 0);
    this.sprite.setFlipX(this.dir < 0);
    this.playAnim(moving ? 'move' : 'idle');
  }

  protected aiHopper(now: number, mult: number) {
    if (!this.grounded()) { this.playAnim('move'); return; }
    this.body.setVelocityX(0);
    if (now < this.nextHop) { this.playAnim('idle'); return; }
    const plat = this.platform(now);
    const target = this.aggroTarget();
    if (target) this.dir = target.x >= this.x ? 1 : -1;
    else if (Math.random() < 0.3) this.dir = this.dir === 1 ? -1 : 1;
    const hopV = rand(320, 410);
    const air = (2 * hopV) / 1500;
    let vx = this.dir * this.def.speed * mult;
    const reach = Math.abs(vx) * air;
    if (this.atEdge(plat, this.dir, reach, !target) || this.blockedAhead(this.dir)) {
      if (target) vx = 0;
      else { this.dir = this.dir === 1 ? -1 : 1; vx = -vx; if (this.atEdge(plat, this.dir, reach, true)) vx = 0; }
    }
    this.body.setVelocity(vx, -hopV * (0.85 + 0.15 * mult));
    this.nextHop = now + (target ? rand(350, 700) : rand(800, 1700));
    this.sprite.setFlipX(this.dir < 0);
    this.playAnim('move', true);
  }

  protected aiFlyer(now: number, delta: number, mult: number) {
    this.phase += delta / 1000;
    const hover = Math.sin(this.phase * 2.2) * 14;
    const target = this.aggroTarget(380, 650);
    const speed = this.def.speed * mult;
    let vx: number;
    let ty: number;
    if (target) {
      const dx = target.x - this.x;
      this.dir = dx >= 0 ? 1 : -1;
      vx = Math.abs(dx) > 12 ? this.dir * speed * 1.1 : 0;
      ty = Phaser.Math.Clamp(target.y - 30 + hover * 0.5, this.band.y - 300, this.band.y - 12);
    } else {
      if (now >= this.nextDecision) {
        const r = Math.random();
        this.flyPaused = r < 0.25;
        if (r > 0.7) this.dir = this.dir === 1 ? -1 : 1;
        this.nextDecision = now + rand(1500, 3500);
      }
      if (this.x >= this.band.x2) this.dir = -1;
      else if (this.x <= this.band.x1) this.dir = 1;
      vx = this.flyPaused ? 0 : this.dir * speed * 0.6;
      ty = this.homeY + hover;
    }
    if (this.blockedAhead(this.dir)) { this.dir = this.dir === 1 ? -1 : 1; vx = -vx; }
    const vy = Phaser.Math.Clamp((ty - this.y) * 3, -speed, speed);
    this.body.setVelocity(vx, vy);
    this.sprite.setFlipX(this.dir < 0);
    this.playAnim(Math.abs(vx) > 1 ? 'move' : 'idle');
  }

  protected aiStationary() {
    this.body.setVelocityX(0);
    const t = this.aggroTarget();
    if (t) this.sprite.setFlipX(t.x < this.x);
    this.playAnim('idle');
  }

  // ─────────────────────────── statuses ───────────────────────────

  protected tickStatuses(delta: number) {
    if (this.statuses.size === 0) return;
    const expired: StatusKind[] = [];
    for (const [kind, st] of this.statuses) {
      st.durationMs -= delta;
      if (kind === 'burn') {
        this.burnAcc += delta;
        while (this.burnAcc >= 500 && this._alive) {
          this.burnAcc -= 500;
          const dmg = Math.max(1, Math.round(st.potency));
          try {
            this.services.combat.damageMonster(this, dmg, { kind: 'dot', element: st.element });
          } catch {
            this.takeDamage(dmg, {});
          }
        }
        if (!this._alive) return;
      }
      if (kind === 'poison') {
        this.poisonAcc += delta;
        while (this.poisonAcc >= 500 && this._alive) {
          this.poisonAcc -= 500;
          const dmg = Math.max(1, Math.round(st.potency));
          try {
            this.services.combat.damageMonster(this, dmg, { kind: 'dot', element: st.element });
          } catch {
            this.takeDamage(dmg, {});
          }
        }
        if (!this._alive) return;
      }
      if (st.durationMs <= 0) expired.push(kind);
    }
    for (const k of expired) this.removeStatus(k);
  }

  protected onStatusStart(kind: StatusKind) {
    if (kind === 'freeze') {
      if (this.scene.textures.exists(MFX.crystal) && !this.shell) {
        this.shell = this.scene.add.image(this.x, this.y + 2, MFX.crystal)
          .setOrigin(0.5, 1)
          .setDepth(this.sprite.depth + 0.2)
          .setAlpha(0)
          // Whole-number multiples of the 32×36 pixel shell so its pixels stay on the grid.
          .setDisplaySize(32 * Math.max(2, Math.round(Math.max(this.def.size.w * 1.4 + 8, (this.visual?.contentW ?? 0) + 8) / 32)),
            36 * Math.max(2, Math.round(Math.max(this.def.size.h * 1.18 + 6, (this.visual?.contentH ?? 0) + 6) / 36)));
        this.scene.tweens.add({ targets: this.shell, alpha: 0.82, duration: 120 });
      }
      this.sprite.anims.pause();
    } else if (kind === 'stun') {
      if (this.scene.textures.exists(MFX.star)) {
        for (let k = 0; k < 3; k++) {
          this.stars.push(this.scene.add.image(this.x, this.y, MFX.star).setDepth(DEPTH.NAMETAG - 1));
        }
      }
    }
  }

  protected onStatusEnd(kind: StatusKind) {
    if (kind === 'freeze') {
      if (this.shell) {
        this.shatterShell();
        this.shell.destroy();
        this.shell = null;
      }
      if (this.sprite.active && this.sprite.anims.isPaused) this.sprite.anims.resume();
    } else if (kind === 'stun') {
      this.stars.forEach(s => s.destroy());
      this.stars = [];
    }
  }

  protected shatterShell() {
    if (!this.scene.textures.exists(MFX.shard)) return;
    const cx = this.x, cy = this.y - this.def.size.h / 2;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + Math.random() * 0.5;
      const sh = this.scene.add.image(cx, cy, MFX.shard).setDepth(DEPTH.VFX).setRotation(a);
      this.scene.tweens.add({
        targets: sh, x: cx + Math.cos(a) * rand(22, 40), y: cy + Math.sin(a) * rand(18, 32) + 16,
        alpha: 0, angle: sh.angle + rand(-90, 90), duration: rand(320, 480), ease: 'Quad.easeOut',
        onComplete: () => sh.destroy(),
      });
    }
  }

  protected clearStatusVisuals() {
    this.shell?.destroy();
    this.shell = null;
    this.stars.forEach(s => s.destroy());
    this.stars = [];
  }

  protected spawnMote(tex: string, x: number, y: number, dy: number, life: number, tint?: number, scale = 1) {
    if (!this.scene.textures.exists(tex)) return;
    const m = this.scene.add.image(x, y, tex).setDepth(this.sprite.depth + 0.3).setScale(scale)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (tint !== undefined) m.setTint(tint);
    this.scene.tweens.add({
      targets: m, y: y + dy, x: x + rand(-4, 4), alpha: 0, scale: scale * 0.4, duration: life,
      onComplete: () => m.destroy(),
    });
  }

  // ─────────────────────────── visuals ───────────────────────────

  protected updateOverlays(now: number, delta: number) {
    const b = this.getBounds();
    // Overlays sit above the art, which can be taller than the hitbox.
    const top = Math.min(b.y, this.sprite.y - (this.visual?.contentH ?? 0));
    // status tint
    if (now >= this.flashUntil) {
      this.flashUntil = 0;
      const t = this.statusTint(now);
      if (t === null) this.sprite.clearTint(); else this.sprite.setTint(t);
    }
    // status particles
    if (this.statuses.size) {
      this.fxAcc += delta;
      while (this.fxAcc >= 90) {
        this.fxAcc -= 90;
        this.fxTick++;
        const rx = () => b.x + Math.random() * b.width;
        if (this.statuses.has('burn')) this.spawnMote(MFX.ember, rx(), b.y + b.height * rand(0.3, 0.9), -rand(18, 34), 520, undefined, rand(0.7, 1.2));
        if (this.statuses.has('shock') && this.fxTick % 2 === 0) this.spawnMote(MFX.spark, rx(), b.y + Math.random() * b.height, rand(-6, 6), 200, undefined, rand(0.6, 1));
        if (this.statuses.has('poison') && this.fxTick % 2 === 0) this.spawnMote(MFX.puff, rx(), b.y + b.height * rand(0.4, 0.9), -rand(10, 22), 600, 0x7dff5a, rand(0.6, 0.9));
        if (this.statuses.has('curse') && this.fxTick % 3 === 0) this.spawnMote(MFX.puff, rx(), b.y + b.height * rand(0.1, 0.5), -rand(6, 14), 800, 0x9a5cff, rand(0.7, 1));
        if (this.statuses.has('chill') && !this.statuses.has('freeze') && this.fxTick % 3 === 0) this.spawnMote(MFX.snow, rx(), b.y + Math.random() * b.height * 0.5, rand(14, 24), 700, undefined, 1);
      }
    }
    if (this.shell) this.shell.setPosition(this.x, this.y + 2);
    if (this.stars.length) {
      const a0 = now / 260;
      this.stars.forEach((s, k) => {
        const a = a0 + (k * TAU) / this.stars.length;
        s.setPosition(this.x + Math.cos(a) * Math.max(14, b.width * 0.45), top - 8 + Math.sin(a) * 4);
        s.setDepth(Math.sin(a) > 0 ? DEPTH.NAMETAG - 1 : this.sprite.depth - 0.1);
        s.setRotation(a * 2);
      });
    }
    // HP bar
    if (this.showOverheadBar() && (this.hpBarDirty || this.hpBar)) {
      if (!this.hpBar) this.hpBar = this.scene.add.graphics().setDepth(DEPTH.NAMETAG);
      if (this.hpBarDirty) { this.hpBarDirty = false; this.drawHpBar(); }
      this.hpBar.setPosition(Math.round(this.x), Math.round(top - 12));
    }
  }

  protected statusTint(now: number): number | null {
    if (this.statuses.has('freeze')) return 0xc4ecff;
    if (this.statuses.has('burn')) return Math.floor(now / 110) % 2 ? 0xffa070 : 0xffcfa8;
    if (this.statuses.has('shock')) return Math.floor(now / 80) % 3 === 0 ? 0xfff27a : 0xffffd8;
    if (this.statuses.has('poison')) return Math.floor(now / 140) % 2 ? 0xa8ff8c : 0xd4ffc4;
    if (this.statuses.has('curse')) return 0xc9a6ff;
    if (this.statuses.has('chill')) return 0x9cc8ff;
    if (this.statuses.has('stun')) return 0xf4ecd0;
    return this.baseTint();
  }

  protected drawHpBar() {
    const g = this.hpBar;
    if (!g) return;
    const w = Phaser.Math.Clamp(this.def.size.w, 36, 64), h = 5;
    const pct = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    g.clear();
    g.fillStyle(0x000000, 0.65).fillRoundedRect(-w / 2 - 2, -2, w + 4, h + 4, 3);
    g.fillStyle(0x3a1010, 1).fillRect(-w / 2, 0, w, h);
    const col = pct > 0.5 ? 0x62d84e : pct > 0.25 ? 0xf0c83a : 0xe8483a;
    g.fillStyle(col, 1).fillRect(-w / 2, 0, w * pct, h);
    g.fillStyle(0xffffff, 0.35).fillRect(-w / 2, 0, w * pct, 2);
  }

  playAnim(name: MonsterAnim, force = false) {
    if (!this.animBase || this.destroyed) return;
    const key = `${this.animBase}_${name}`;
    if (!this.scene.anims.exists(key)) return;
    const cur = this.sprite.anims.currentAnim;
    if (!force && cur && cur.key === key) return;
    this.sprite.anims.play(key, false);
  }

  // ─────────────────────────── death ───────────────────────────

  protected die() {
    if (!this._alive) return;
    this._alive = false;
    this.hp = 0;
    try { this.onBeforeDeath(); } catch (e) { console.warn('[monster] onBeforeDeath', e); }
    for (const k of [...this.statuses.keys()]) this.removeStatus(k);
    this.clearStatusVisuals();
    this.hpBar?.destroy();
    this.hpBar = null;
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.body.enable = false;
    this.sprite.clearTint();
    if (this.sprite.anims.isPaused) this.sprite.anims.resume();

    try { bus.emit('monster:killed', { monster: this }); } catch (e) { console.error('[monster] monster:killed handler failed', e); }
    try { this.services.audio?.play('monster_die'); } catch { /* ignore */ }

    const finish = () => {
      if (this.deathFinished || this.destroyed) return;
      this.deathFinished = true;
      this.scene.tweens.add({
        targets: this.sprite, alpha: 0, y: this.sprite.y - 10, duration: 260, ease: 'Quad.easeIn',
        onComplete: () => this.destroy(),
      });
    };
    const key = this.animBase ? `${this.animBase}_die` : '';
    if (key && this.scene.anims.exists(key)) {
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, finish);
      this.sprite.anims.play(key, false);
    }
    this.deathTimer = this.scene.time.delayedCall(key ? 900 : 50, finish);
  }
}
