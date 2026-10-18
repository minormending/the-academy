// OWNER: A1 (player). MapleStory-feel player controller.
import Phaser from 'phaser';
import { DEPTH, PLAYER_HITBOX } from '../core/constants';
import type { GameServices, IMapInstance, IPlayer, JobId, RopeDef } from '../core/types';
import { playerAnimKey, playerTextureKey, type PlayerAnim } from '../art/characters';
import { ensureFallbackTexture } from './player/fallbackTexture';
import { NameTag } from './player/NameTag';
import { PT } from './player/tuning';

type PState = IPlayer['state'];

interface PlayerKeys {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  space: Phaser.Input.Keyboard.Key;
  alt: Phaser.Input.Keyboard.Key;
}

interface FrameInput {
  dir: -1 | 0 | 1;
  left: boolean; right: boolean; up: boolean; down: boolean;
  jumpHeld: boolean;
}

/** Anim fallbacks when A10 has not provided a given anim. */
const ANIM_FALLBACK: Record<PlayerAnim, PlayerAnim[]> = {
  idle: [],
  walk: ['idle'],
  jump: ['fall', 'idle'],
  fall: ['jump', 'idle'],
  climb: ['idle'],
  prone: ['idle'],
  cast: ['idle'],
  hit: ['idle'],
  dead: ['prone', 'idle'],
};

type BodyLike = { x: number; y: number; width: number; height: number };

function bodyOf(o: unknown): BodyLike | null {
  if (!o || typeof o !== 'object') return null;
  if (o instanceof Phaser.Physics.Arcade.Body || o instanceof Phaser.Physics.Arcade.StaticBody) return o;
  const b = (o as { body?: unknown }).body;
  if (b && typeof b === 'object' && 'width' in (b as object)) return b as BodyLike;
  return null;
}

function approach(v: number, target: number, step: number) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

export class Player implements IPlayer {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  facing: 1 | -1 = 1;
  state: PState = 'idle';

  private job: JobId;
  private map: IMapInstance | null = null;
  private colliders: Phaser.Physics.Arcade.Collider[] = [];
  private keys: PlayerKeys | null = null;
  private nameTag: NameTag;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private usingFallback = false;
  /** Offset from sprite position to feet (body center-x, body bottom). */
  private feetOff = { x: 0, y: 0 };

  // stats (read lazily each update)
  private speed: number = PT.defaultSpeed;
  private jumpVel: number = PT.defaultJump;

  // control / state flags
  private controlEnabled = true;
  private dead = false;
  private prone = false;
  private rope: RopeDef | null = null;
  private castLockUntil = 0;
  private castSerial = 0;
  private hitLockUntil = 0;
  private invulnUntil = 0;
  private tintUntil = 0;
  private flashUntil = 0;
  private dropUntil = 0;
  private regrabAt = 0;
  private ropeGrabbedAt = 0;

  // jump timing
  private lastGroundedAt = -Infinity;
  private jumpBufferedAt = -Infinity;
  private lastJumpAt = -Infinity;
  private prevJumpDown = false;
  /** Presses latched from key 'down' events so sub-frame taps (down+up between two updates) are never lost. */
  private jumpLatched = false;
  private tapDirLatched: -1 | 0 | 1 = 0;

  // contact bookkeeping (set from collider callbacks)
  private lastOneWayFootAt = -Infinity;
  private lastSolidFootAt = -Infinity;
  private embeddedFrames = 0;

  // airtime tracking
  private wasGrounded = false;
  private airPeakY = 0;
  private airCapVx = 0;
  private lastAirVy = 0;
  private lastFeetY = 0;

  // anim bookkeeping
  private curAnimKey = '';
  private curAnimSerial = -1;

  private warnedUpdate = false;
  private onJumpKeyDown = () => { this.jumpLatched = true; };
  private onLeftKeyDown = () => { this.tapDirLatched = -1; };
  private onRightKeyDown = () => { this.tapDirLatched = 1; };
  private onWindowKey = (e: KeyboardEvent) => { if (e.key === 'Alt' && this.controlEnabled) e.preventDefault(); };

  constructor(private scene: Phaser.Scene, private services: GameServices, x: number, y: number, job: JobId) {
    this.job = job;
    const key = this.resolveTextureKey();
    this.sprite = scene.physics.add.sprite(x, y, key);
    this.sprite.setDepth(DEPTH.PLAYER);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setMaxVelocity(PT.maxVx, PT.maxVy);
    this.applyBodySize();
    this.placeFeet(x, y);
    this.lastFeetY = y;

    this.nameTag = new NameTag(scene);
    this.nameTag.follow(x, y);

    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = {
        left: kb.addKey(K.LEFT), right: kb.addKey(K.RIGHT), up: kb.addKey(K.UP), down: kb.addKey(K.DOWN),
        space: kb.addKey(K.SPACE), alt: kb.addKey(K.ALT),
      };
      this.keys.space.on('down', this.onJumpKeyDown);
      this.keys.alt.on('down', this.onJumpKeyDown);
      this.keys.left.on('down', this.onLeftKeyDown);
      this.keys.right.on('down', this.onRightKeyDown);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onWindowKey);
      window.addEventListener('keyup', this.onWindowKey);
    }
  }

  // ─────────────────────────── IPlayer: queries ───────────────────────────

  private get body(): Phaser.Physics.Arcade.Body { return this.sprite.body as Phaser.Physics.Arcade.Body; }

  get x() { const b = this.body; return b ? b.x + b.width / 2 : this.sprite.x; }
  get y() { const b = this.body; return b ? b.y + b.height : this.sprite.y; }

  isGrounded() {
    const b = this.body;
    if (!b || this.rope) return false;
    if (b.velocity.y < -1) return false;
    return b.blocked.down || b.touching.down;
  }

  isBusy() {
    const now = this.now();
    return this.dead || !!this.rope || now < this.castLockUntil || now < this.hitLockUntil;
  }

  isInvulnerable() { return this.dead || this.now() < this.invulnUntil; }

  isClimbing() { return !!this.rope; }
  isProne() { return this.prone; }

  getAimDir(): { x: -1 | 0 | 1; y: -1 | 0 | 1 } {
    const k = this.keys;
    if (!k || !this.controlEnabled || this.dead) return { x: 0, y: 0 };
    const x = (k.right.isDown ? 1 : 0) - (k.left.isDown ? 1 : 0);
    const y = (k.down.isDown ? 1 : 0) - (k.up.isDown ? 1 : 0);
    return { x: x as -1 | 0 | 1, y: y as -1 | 0 | 1 };
  }

  getBounds() {
    const b = this.body;
    if (!b) return this.sprite.getBounds();
    return new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
  }

  // ─────────────────────────── IPlayer: commands ───────────────────────────

  bindMap(map: IMapInstance) {
    this.destroyColliders();
    this.map = map;
    this.releaseRope();
    this.prone = false;
    this.dropUntil = 0;
    this.lastOneWayFootAt = -Infinity;
    this.lastSolidFootAt = -Infinity;
    const phys = this.scene.physics;
    try {
      if (map.solids) {
        this.colliders.push(phys.add.collider(this.sprite, map.solids, this.onSolidCollide, undefined, this));
      }
      if (map.platforms) {
        this.colliders.push(phys.add.collider(this.sprite, map.platforms, this.onPlatformCollide, this.platformProcess, this));
      }
    } catch (e) {
      console.warn('[player] failed to create colliders', e);
    }
  }

  placeAt(x: number, y: number) {
    this.releaseRope();
    this.prone = false;
    this.dropUntil = 0;
    this.body?.setVelocity(0, 0);
    this.placeFeet(x, y);
    this.lastFeetY = y;
    this.airPeakY = y;
    this.wasGrounded = false;
    this.nameTag.follow(x, y);
  }

  playCast(lockMs: number) {
    if (this.dead || this.rope) return;
    const now = this.now();
    this.castLockUntil = Math.max(this.castLockUntil, now + Math.max(0, lockMs || 0));
    this.castSerial++;
    this.prone = false;
    if (this.isGrounded()) this.body?.setVelocityX(0);
    this.state = 'cast';
  }

  onHit(fromX: number) {
    if (this.dead) return;
    const now = this.now();
    if (now < this.invulnUntil) return;
    const dir = this.x >= fromX ? 1 : -1;
    this.releaseRope();
    this.prone = false;
    this.castLockUntil = 0;
    this.dropUntil = 0;
    this.lastGroundedAt = -Infinity;
    this.jumpBufferedAt = -Infinity;
    this.body?.setVelocity(dir * PT.hitKnockVx, PT.hitKnockVy);
    this.hitLockUntil = now + PT.hitLockMs;
    this.invulnUntil = now + PT.iFramesMs;
    this.tintUntil = now + PT.hitTintMs;
    this.state = 'hit';
  }

  blink(dx: number, dy: number) {
    if (this.dead) return;
    const ox = this.x, oy = this.y;
    const bounds = this.worldSize();
    const m = PT.blinkMargin;
    const tx = Phaser.Math.Clamp(ox + (dx || 0), m, Math.max(m, bounds.w - m));
    const ty = Phaser.Math.Clamp(oy + (dy || 0), PLAYER_HITBOX.h + m, Math.max(PLAYER_HITBOX.h + m, bounds.h - m));

    // Walk from origin toward target; stop at the last spot that does not overlap a solid.
    let fx = ox, fy = oy;
    const dist = Math.hypot(tx - ox, ty - oy);
    if (this.overlapsSolid(ox, oy)) {
      // Origin already embedded (shouldn't happen): step back from target toward origin instead.
      const steps = Math.max(1, Math.ceil(dist / PT.blinkStep));
      for (let i = 0; i <= steps; i++) {
        const t = 1 - i / steps;
        const cx = ox + (tx - ox) * t, cy = oy + (ty - oy) * t;
        if (!this.overlapsSolid(cx, cy)) { fx = cx; fy = cy; break; }
      }
    } else if (dist > 0) {
      const steps = Math.max(1, Math.ceil(dist / PT.blinkStep));
      // Horizontal blinks may climb over low ledges (hills / steps) instead of stopping at their face.
      const horizontal = Math.abs(ty - oy) < 1;
      let lift = 0;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const cx = ox + (tx - ox) * t;
        let cy = oy + (ty - oy) * t - lift;
        if (this.overlapsSolid(cx, cy)) {
          if (!horizontal) break;
          let up = 0;
          while (up < PT.blinkStepUp && this.overlapsSolid(cx, cy - up)) up += 3;
          if (this.overlapsSolid(cx, cy - up)) break;
          lift += up; cy -= up;
        }
        fx = cx; fy = cy;
      }
    }

    const vx = this.body?.velocity.x ?? 0;
    this.releaseRope();
    this.prone = false;
    this.dropUntil = 0;
    this.lastGroundedAt = -Infinity;
    this.placeFeet(fx, fy);
    this.body?.setVelocity(vx, 0);
    this.lastFeetY = fy;
    this.airPeakY = fy;
    this.flashUntil = this.now() + PT.blinkFlashMs;
    this.nameTag.follow(fx, fy);
  }

  setJob(job: JobId) {
    this.job = job;
    const key = this.resolveTextureKey();
    if (this.sprite.texture.key !== key) {
      this.sprite.anims.stop();
      this.sprite.setTexture(key);
      this.applyBodySize();
    }
    this.curAnimKey = '';   // force replay of the current anim on the new sheet
  }

  onDeath() {
    this.dead = true;
    this.releaseRope();
    this.prone = false;
    this.castLockUntil = 0;
    this.hitLockUntil = 0;
    this.dropUntil = 0;
    this.body?.setVelocityX(0);
    this.state = 'dead';
  }

  revive() {
    this.dead = false;
    this.prone = false;
    this.castLockUntil = 0;
    this.hitLockUntil = 0;
    this.invulnUntil = this.now() + PT.reviveIFramesMs;
    this.body?.setVelocity(0, 0);
    this.sprite.setAlpha(1);
    this.state = 'idle';
  }

  setControlEnabled(enabled: boolean) {
    this.controlEnabled = enabled;
    if (!enabled) {
      this.prone = false;
      this.jumpBufferedAt = -Infinity;
      if (this.body) {
        this.body.setVelocityX(0);
        if (this.rope) this.body.setVelocityY(0);
      }
    }
  }

  // ─────────────────────────── Frame update ───────────────────────────

  update(time: number, delta: number) {
    try {
      this.step(delta);
    } catch (e) {
      if (!this.warnedUpdate) { this.warnedUpdate = true; console.error('[player] update error', e); }
    }
  }

  private step(delta: number) {
    const body = this.body;
    if (!body || !this.sprite.active) return;
    const now = this.now();
    const dt = Math.min(Math.max(delta, 0), 50) / 1000;

    this.maybeUpgradeTexture();
    this.readStats();
    const inp = this.readInput(now);

    const grounded = this.isGrounded();
    if (grounded) this.lastGroundedAt = now;

    // Air / landing bookkeeping
    if (!this.rope) {
      if (grounded && !this.wasGrounded) this.onLand();
      if (!grounded && this.wasGrounded) {
        this.airPeakY = this.y;
        this.airCapVx = Math.max(Math.abs(body.velocity.x), this.speed * PT.airSteerFrac);
      }
      if (!grounded) {
        this.airPeakY = Math.min(this.airPeakY, this.y);
        this.lastAirVy = body.velocity.y;
      }
    }

    if (this.dead) {
      if (grounded) body.setVelocityX(0);
      else body.setVelocityX(approach(body.velocity.x, 0, 400 * dt));
    } else if (this.rope) {
      this.updateClimb(inp, now);
    } else {
      this.updateNormal(inp, now, dt, grounded);
    }

    this.sweepPlatforms();
    this.checkFallOut();

    this.state = this.computeState(now);
    this.updateVisuals(now);

    this.wasGrounded = this.isGrounded() || (grounded && body.velocity.y >= 0);
    if (this.rope) this.wasGrounded = false;
    this.lastFeetY = this.y;
  }

  private updateNormal(inp: FrameInput, now: number, dt: number, grounded: boolean) {
    const body = this.body;
    const casting = now < this.castLockUntil;
    const hit = now < this.hitLockUntil;
    const canAct = !casting && !hit;
    const dir = inp.dir;

    // Ropes / ladders
    if (canAct && now >= this.regrabAt && this.map) {
      if (inp.up && !inp.down) {
        const rope = this.findRopeAround();
        if (rope) { this.grabRope(rope, this.y); return; }
      } else if (inp.down && grounded) {
        const rope = this.findRopeBelow();
        if (rope) { this.grabRope(rope, rope.top + 4); return; }
      }
    }

    // Prone
    this.prone = canAct && grounded && inp.down;

    // Jump / drop-through
    if (canAct) {
      const buffered = now - this.jumpBufferedAt <= PT.jumpBufferMs;
      const autoHop = inp.jumpHeld && grounded && now - this.lastJumpAt > PT.autoJumpGapMs;
      if (buffered || autoHop) {
        if (inp.down && grounded) {
          this.jumpBufferedAt = -Infinity;
          if (this.standingOnOneWay(now)) { this.dropThrough(now); return; }
        } else if (!inp.down && (grounded || now - this.lastGroundedAt <= PT.coyoteMs) && now - this.lastJumpAt > PT.autoJumpGapMs) {
          this.doJump(now, dir);
          return;
        }
      }
    }

    // Horizontal motion
    if (hit) {
      if (grounded) body.setVelocityX(approach(body.velocity.x, 0, PT.hitGroundDecel * dt));
    } else if (casting) {
      if (grounded) body.setVelocityX(0);
    } else if (grounded) {
      if (dir !== 0) this.facing = dir;
      body.setVelocityX(this.prone ? 0 : dir * this.speed);
    } else if (dir !== 0) {
      this.facing = dir;
      const cap = Math.max(this.airCapVx, this.speed * PT.airSteerFrac);
      body.setVelocityX(approach(body.velocity.x, dir * cap, PT.airAccel * dt));
    }
  }

  private doJump(now: number, dir: -1 | 0 | 1) {
    const body = this.body;
    this.prone = false;
    if (dir !== 0) this.facing = dir;
    const vx = dir * this.speed;
    body.setVelocity(vx, -this.jumpVel);
    this.airCapVx = Math.max(Math.abs(vx), this.speed * PT.airSteerFrac);
    this.airPeakY = this.y;
    this.lastJumpAt = now;
    this.jumpBufferedAt = -Infinity;
    this.lastGroundedAt = -Infinity;
    this.wasGrounded = false;
    this.sfx('jump');
  }

  private dropThrough(now: number) {
    this.prone = false;
    this.dropUntil = now + PT.dropThroughMs;
    this.lastJumpAt = now;
    this.lastGroundedAt = -Infinity;
    this.body.setVelocity(0, PT.dropThroughVy);
    this.airCapVx = this.speed * PT.airSteerFrac;
    this.airPeakY = this.y;
  }

  private updateClimb(inp: FrameInput, now: number) {
    const rope = this.rope!;
    const body = this.body;
    body.setAllowGravity(false);
    // keep snapped to the rope
    if (Math.abs(this.x - rope.x) > 0.5) this.placeFeet(rope.x, this.y);
    body.setVelocityX(0);

    const buffered = now - this.jumpBufferedAt <= PT.jumpBufferMs;
    if (buffered && inp.dir !== 0) {
      // hop off sideways
      this.jumpBufferedAt = -Infinity;
      this.releaseRope();
      this.facing = inp.dir;
      const vx = inp.dir * this.speed * PT.ropeHopVxFrac;
      body.setVelocity(vx, -this.jumpVel * PT.ropeHopVyFrac);
      this.airCapVx = Math.max(Math.abs(vx), this.speed * PT.airSteerFrac);
      this.airPeakY = this.y;
      this.lastJumpAt = now;
      this.regrabAt = now + PT.ropeRegrabMs;
      this.sfx('jump');
      return;
    }

    let vy = 0;
    if (inp.up && !inp.down) vy = -PT.climbSpeed;
    else if (inp.down && !inp.up) vy = PT.climbSpeed;
    body.setVelocityY(vy);

    const feet = this.y;
    if (vy < 0 && feet <= rope.top) {
      // step onto the platform above
      this.releaseRope();
      this.body.setVelocity(0, 0);
      this.placeFeet(rope.x, rope.top);
      this.lastFeetY = rope.top;
      this.regrabAt = now + PT.ropeRegrabMs;
      this.lastGroundedAt = now;
      return;
    }
    const settled = now - this.ropeGrabbedAt > 80; // contact flags from before the grab may be stale
    if (vy > 0 && (feet >= rope.bottom || (settled && (body.blocked.down || body.touching.down)))) {
      this.releaseRope();
      this.regrabAt = now + PT.ropeRegrabMs;
      this.airPeakY = feet;
    }
  }

  private grabRope(rope: RopeDef, feetY: number) {
    const body = this.body;
    this.rope = rope;
    this.ropeGrabbedAt = this.now();
    this.prone = false;
    this.dropUntil = 0;
    this.jumpBufferedAt = -Infinity;
    body.setAllowGravity(false);
    body.setVelocity(0, 0);
    const fy = Phaser.Math.Clamp(feetY, rope.top + 2, rope.bottom);
    this.placeFeet(rope.x, fy);
    this.lastFeetY = fy;
  }

  private releaseRope() {
    if (!this.rope) return;
    this.rope = null;
    const b = this.body;
    if (b) b.setAllowGravity(true);
    if (this.sprite.anims.isPaused) this.sprite.anims.resume();
  }

  // ─────────────────────────── Rope lookup ───────────────────────────

  private validRope(r: RopeDef | null | undefined): r is RopeDef {
    return !!r && typeof r.x === 'number' && typeof r.top === 'number' && typeof r.bottom === 'number' && r.bottom > r.top;
  }

  private ropeAt(x: number, y: number): RopeDef | null {
    const map = this.map;
    if (!map) return null;
    let r: RopeDef | null = null;
    try { r = map.getRopeAt(x, y, PT.ropeTolX); } catch { r = null; }
    if (this.validRope(r) && Math.abs(r.x - x) <= PT.ropeTolX + 2 && y >= r.top - 2 && y <= r.bottom + 2) return r;
    // Fallback: scan the map data directly (robust to getRopeAt semantics).
    const ropes = map.def?.ropes ?? [];
    for (const rr of ropes) {
      if (this.validRope(rr) && Math.abs(rr.x - x) <= PT.ropeTolX && y >= rr.top && y <= rr.bottom) return rr;
    }
    return null;
  }

  /** Up: rope overlapping the body (not one whose top is at/below the feet). */
  private findRopeAround(): RopeDef | null {
    const x = this.x, feet = this.y;
    for (const off of [12, 30, 50]) {
      const r = this.ropeAt(x, feet - off);
      if (r && r.top < feet - 8) return r;
    }
    return null;
  }

  /** Down while standing: rope whose top is right at the feet. */
  private findRopeBelow(): RopeDef | null {
    const x = this.x, feet = this.y;
    const r = this.ropeAt(x, feet + 8);
    if (r && Math.abs(r.top - feet) <= PT.ropeTopGrabTol) return r;
    return null;
  }

  // ─────────────────────────── Collisions ───────────────────────────

  private platformProcess = (_a: unknown, b: unknown): boolean => {
    if (this.rope || this.now() < this.dropUntil) return false;
    const body = this.body;
    if (!body || body.velocity.y < 0) return false;
    const pb = bodyOf(b);
    if (!pb) return true;
    const prevBottom = Math.min(body.prev.y, body.prevFrame.y) + body.height;
    const slack = PT.oneWaySlack + Math.max(0, body.velocity.y) / 60;
    return prevBottom <= pb.y + slack;
  };

  private onPlatformCollide = (_a: unknown, b: unknown) => {
    const pb = bodyOf(b);
    if (pb && Math.abs(this.y - pb.y) <= 3) this.lastOneWayFootAt = this.now();
  };

  private onSolidCollide = (_a: unknown, b: unknown) => {
    const pb = bodyOf(b);
    if (pb && Math.abs(this.y - pb.y) <= 3 && this.x > pb.x && this.x < pb.x + pb.width) this.lastSolidFootAt = this.now();
  };

  private standingOnOneWay(now: number): boolean {
    const recentOneWay = now - this.lastOneWayFootAt < 80;
    const recentSolid = now - this.lastSolidFootAt < 80;
    if (recentOneWay) return !recentSolid;
    if (recentSolid) return false;
    try {
      const p = this.map?.platformAt(this.x, this.y, 4);
      return !!p && p.oneWay;
    } catch { return false; }
  }

  /** Safety net against tunneling through thin platforms at high fall speeds. */
  private sweepPlatforms() {
    const body = this.body;
    const map = this.map;
    if (!map || this.rope) return;
    if (this.now() < this.dropUntil || body.velocity.y <= 0 || this.isGrounded()) return;
    const feet = this.y, prev = this.lastFeetY, x = this.x, hw = body.width / 2;
    const plats = map.def?.platforms ?? [];
    let best: number | null = null;
    for (const p of plats) {
      if (!p || typeof p.y !== 'number') continue;
      if (prev <= p.y + 1 && feet > p.y + 1 && feet - p.y < 48 && x + hw > p.x1 && x - hw < p.x2) {
        if (best === null || p.y < best) best = p.y;
      }
    }
    if (best !== null) {
      this.placeFeet(x, best);
      body.setVelocityY(0);
    }
  }

  private overlapsSolid(fx: number, fy: number): boolean {
    const group = this.map?.solids;
    if (!group) return false;
    const w = PLAYER_HITBOX.w, h = PLAYER_HITBOX.h;
    const l = fx - w / 2 + 1, r = fx + w / 2 - 1, t = fy - h + 1, btm = fy - 1;
    let children: Phaser.GameObjects.GameObject[] = [];
    try { children = group.getChildren(); } catch { return false; }
    for (const c of children) {
      const b = bodyOf(c);
      if (!b || !(c as { active?: boolean }).active) continue;
      if (l < b.x + b.width && r > b.x && t < b.y + b.height && btm > b.y) return true;
    }
    return false;
  }

  /** Highest top edge among the solids overlapping the player's column at (fx, fy). */
  private solidTopAbove(fx: number, fy: number): number | null {
    const group = this.map?.solids;
    if (!group) return null;
    const w = PLAYER_HITBOX.w, h = PLAYER_HITBOX.h;
    const l = fx - w / 2 + 1, r = fx + w / 2 - 1, t = fy - h + 1, btm = fy - 1;
    let best: number | null = null;
    for (const c of group.getChildren()) {
      const b = bodyOf(c);
      if (!b || !(c as { active?: boolean }).active) continue;
      if (l < b.x + b.width && r > b.x && t < b.y + b.height && btm > b.y) {
        if (best === null || b.y < best) best = b.y;
      }
    }
    return best;
  }

  private destroyColliders() {
    for (const c of this.colliders) { try { c.destroy(); } catch { /* ignore */ } }
    this.colliders = [];
  }

  private checkFallOut() {
    const map = this.map;
    if (!map) return;
    // Embedded in a solid (Arcade will not separate deep overlaps): pop onto its top, else respawn.
    if (!this.rope && this.overlapsSolid(this.x, this.y)) {
      if (++this.embeddedFrames >= 3) {
        this.embeddedFrames = 0;
        const top = this.solidTopAbove(this.x, this.y);
        if (top !== null && !this.overlapsSolid(this.x, top)) {
          this.body.setVelocity(0, 0);
          this.placeFeet(this.x, top);
          this.lastFeetY = top;
          return;
        }
        this.placeAt(map.getDefaultSpawn().x, map.getDefaultSpawn().y);
        return;
      }
    } else {
      this.embeddedFrames = 0;
    }
    if (this.y > map.heightPx + PT.fallOutMargin) {
      try {
        const s = map.getDefaultSpawn();
        this.placeAt(s.x, s.y);
      } catch {
        this.placeAt(map.widthPx / 2, 0 + PLAYER_HITBOX.h + 10);
      }
    }
  }

  // ─────────────────────────── Landing / juice ───────────────────────────

  private onLand() {
    const fall = this.y - this.airPeakY;
    const hard = fall >= PT.hardLandFall || this.lastAirVy >= PT.hardLandVy;
    if (hard) {
      this.sfx('land');
      this.puffDust();
    }
    this.airPeakY = this.y;
    this.lastAirVy = 0;
  }

  private puffDust() {
    try {
      if (!this.scene.textures.exists('px_smoke')) return;
      if (!this.dust) {
        this.dust = this.scene.add.particles(0, 0, 'px_smoke', {
          lifespan: 420,
          speed: { min: 25, max: 85 },
          angle: { min: 195, max: 345 },
          scale: { start: 0.3, end: 0.8 },
          alpha: { start: 0.5, end: 0 },
          gravityY: -30,
          tint: 0xe2dccd,
          emitting: false,
        });
        this.dust.setDepth(DEPTH.PLAYER - 1);
      }
      this.dust.explode(7, this.x, this.y - 2);
    } catch { /* juice is optional */ }
  }

  private sfx(key: 'jump' | 'land') {
    try { this.services.audio?.play(key); } catch { /* ignore */ }
  }

  // ─────────────────────────── State / visuals ───────────────────────────

  private computeState(now: number): PState {
    if (this.dead) return 'dead';
    if (this.rope) return 'climb';
    if (now < this.hitLockUntil) return 'hit';
    if (now < this.castLockUntil) return 'cast';
    const body = this.body;
    if (this.isGrounded()) {
      if (this.prone) return 'prone';
      return Math.abs(body.velocity.x) > 1 ? 'walk' : 'idle';
    }
    return body.velocity.y < 0 ? 'jump' : 'fall';
  }

  private updateVisuals(now: number) {
    const s = this.sprite;
    s.setFlipX(this.facing === -1);
    this.playStateAnim();

    if (this.state === 'climb') {
      const moving = Math.abs(this.body.velocity.y) > 1;
      if (!moving && s.anims.isPlaying) s.anims.pause();
      else if (moving && s.anims.isPaused) s.anims.resume();
    } else if (s.anims.isPaused) {
      s.anims.resume();
    }

    // alpha: i-frame blink + blink flash
    let a = 1;
    if (!this.dead && now < this.invulnUntil) a = Math.floor(now / 70) % 2 === 0 ? 0.35 : 0.9;
    if (now < this.flashUntil) {
      const t = 1 - (this.flashUntil - now) / PT.blinkFlashMs;
      a = Math.min(a, 0.25 + 0.75 * t);
    }
    s.setAlpha(a);
    if (now < this.tintUntil) s.setTint(0xff9a9a); else if (s.isTinted) s.clearTint();

    // name tag
    try {
      const name = this.services.progression?.state?.name;
      if (typeof name === 'string') this.nameTag.setName(name);
    } catch { /* ignore */ }
    this.nameTag.follow(this.x, this.y);
  }

  private playStateAnim() {
    const s = this.sprite;
    if (this.usingFallback) return;
    const anims = this.scene.anims;
    const chain: PlayerAnim[] = [this.state, ...ANIM_FALLBACK[this.state]];
    let key = '';
    for (const a of chain) {
      const k = playerAnimKey(this.job, a);
      if (anims.exists(k)) { key = k; break; }
    }
    if (!key) {
      if (s.anims.isPlaying) s.anims.stop();
      this.curAnimKey = '';
      return;
    }
    const restartCast = this.state === 'cast' && this.curAnimSerial !== this.castSerial;
    if (key !== this.curAnimKey || restartCast) {
      s.anims.play(key, false);
      this.curAnimKey = key;
      if (this.state === 'cast') this.curAnimSerial = this.castSerial;
    }
  }

  // ─────────────────────────── Texture / body ───────────────────────────

  private resolveTextureKey(): string {
    const real = playerTextureKey(this.job);
    if (this.scene.textures.exists(real)) { this.usingFallback = false; return real; }
    this.usingFallback = true;
    return ensureFallbackTexture(this.scene, this.job);
  }

  private maybeUpgradeTexture() {
    if (!this.usingFallback) return;
    if (!this.scene.textures.exists(playerTextureKey(this.job))) return;
    const feetX = this.x, feetY = this.y;
    const key = this.resolveTextureKey();
    this.sprite.setTexture(key);
    this.applyBodySize();
    this.placeFeet(feetX, feetY);
    this.curAnimKey = '';
  }

  /** Bottom-aligned, horizontally centered hitbox; feet at (frameH - feetInset). */
  private applyBodySize() {
    const s = this.sprite;
    const body = this.body;
    if (!body) return;
    const fw = s.frame?.realWidth || s.width || 64;
    const fh = s.frame?.realHeight || s.height || 80;
    const w = PLAYER_HITBOX.w, h = PLAYER_HITBOX.h;
    const offX = (fw - w) / 2;
    const offY = Math.max(0, fh - PT.feetInsetFromBottom - h);
    body.setSize(w, h, false);
    body.setOffset(offX, offY);
    this.feetOff.x = offX + w / 2 - s.displayOriginX;
    this.feetOff.y = offY + h - s.displayOriginY;
  }

  /** Move so the feet are at (x, y) and sync the body immediately (no velocity change). */
  private placeFeet(x: number, y: number) {
    const s = this.sprite;
    s.setPosition(x - this.feetOff.x, y - this.feetOff.y);
    const b = this.body;
    if (!b) return;
    b.updateFromGameObject();
    b.prev.set(b.x, b.y);
    b.prevFrame.set(b.x, b.y);
  }

  // ─────────────────────────── Input / stats ───────────────────────────

  private readInput(now: number): FrameInput {
    const k = this.keys;
    const raw = {
      left: !!k?.left.isDown, right: !!k?.right.isDown, up: !!k?.up.isDown, down: !!k?.down.isDown,
      jump: !!k && (k.space.isDown || k.alt.isDown),
    };
    const pressed = (raw.jump && !this.prevJumpDown) || this.jumpLatched;
    this.prevJumpDown = raw.jump;
    this.jumpLatched = false;
    const tap = this.tapDirLatched;
    this.tapDirLatched = 0;

    let blocked = false;
    try { blocked = !!this.services.game?.isInputBlocked?.(); } catch { blocked = false; }
    const active = this.controlEnabled && !this.dead && !blocked;
    if (!active) return { dir: 0, left: false, right: false, up: false, down: false, jumpHeld: false };

    if (pressed) this.jumpBufferedAt = now;
    let dir = ((raw.right ? 1 : 0) - (raw.left ? 1 : 0)) as -1 | 0 | 1;
    // A tap released before this frame still counts for one frame (turn around / nudge).
    if (dir === 0 && tap !== 0 && !raw.left && !raw.right) dir = tap;
    return { dir, left: raw.left, right: raw.right, up: raw.up, down: raw.down, jumpHeld: raw.jump };
  }

  private readStats() {
    try {
      const d = this.services.progression?.derived();
      if (d) {
        if (Number.isFinite(d.speed) && d.speed > 0) this.speed = d.speed;
        if (Number.isFinite(d.jump) && d.jump > 0) this.jumpVel = d.jump;
      }
    } catch { /* keep last known */ }
  }

  private worldSize() {
    if (this.map) return { w: this.map.widthPx, h: this.map.heightPx };
    const b = this.scene.physics.world.bounds;
    return { w: b.width, h: b.height };
  }

  private now() { return this.scene.time.now; }

  // ─────────────────────────── Teardown ───────────────────────────

  destroy() {
    this.destroyColliders();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onWindowKey);
      window.removeEventListener('keyup', this.onWindowKey);
    }
    const kb = this.scene.input?.keyboard;
    if (this.keys) {
      this.keys.space.off('down', this.onJumpKeyDown);
      this.keys.alt.off('down', this.onJumpKeyDown);
      this.keys.left.off('down', this.onLeftKeyDown);
      this.keys.right.off('down', this.onRightKeyDown);
    }
    if (kb && this.keys) {
      // UP is shared with GameScene (portal/NPC interact), so leave it registered.
      for (const key of [this.keys.left, this.keys.right, this.keys.down, this.keys.space, this.keys.alt]) {
        try { kb.removeKey(key, false); } catch { /* ignore */ }
      }
    }
    this.keys = null;
    try { this.dust?.destroy(); } catch { /* ignore */ }
    this.dust = null;
    this.nameTag.destroy();
    this.sprite.destroy();
    this.map = null;
  }
}
