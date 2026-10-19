// OWNER: A2 (skill-engine). Executes AttackSpecs: all 7 patterns, projectiles, multi-hit lines, statuses.
import Phaser from 'phaser';
import { DEPTH } from '../../core/constants';
import { playVfx } from '../../core/vfx';
import type { AttackSpec, Element, GameServices, IMonster } from '../../core/types';
import {
  FRONT_MAX_DY, Origin, Scheduler, clamp, destroyGo, monsterCenter, num, rectC, safe, setPos, shuffle,
} from './util';

/** Per-cast bookkeeping (shared by every target / impact / projectile of one cast). */
interface CastInfo {
  spec: AttackSpec;
  lv: number;
  element: Element;
  skillId: string;
  /** Next stack index per monster uid so lines from several impacts stack instead of overlapping. */
  stacks: Map<number, number>;
}

interface Proj {
  info: CastInfo;
  go: Phaser.GameObjects.GameObject | null;
  x: number; y: number;
  vx: number; vy: number;
  gravity: number;
  radius: number;
  travelled: number;
  range: number;
  pierce: boolean;
  maxTargets: number;
  hitCount: number;
  hitSet: Set<number>;
  explode?: { w: number; h: number };
  /** rain faller: lands at groundY instead of colliding mid-air */
  faller?: { groundY: number };
  dead: boolean;
}

const DEFAULT_EXPLODE = { w: 100, h: 120 };

/**
 * Position + rotate a projectile visual (authored pointing +x). When heading left the rotation is ~π,
 * which would render asymmetric art upside-down, so mirror it vertically (scaleY sign) instead.
 */
function poseProj(go: Phaser.GameObjects.GameObject | null | undefined, x: number, y: number, angle: number): void {
  setPos(go, x, y, angle);
  if (!go) return;
  const t = go as unknown as { scaleY?: number; scene?: unknown };
  if (!t.scene || typeof t.scaleY !== 'number' || t.scaleY === 0) return;
  const want = Math.cos(angle) < -1e-3 ? -1 : 1;
  if (Math.sign(t.scaleY) !== want) t.scaleY = -t.scaleY;
}

export class AttackRunner {
  private projs: Proj[] = [];

  constructor(private scene: Phaser.Scene, private svc: () => GameServices, private sched: Scheduler) {}

  // ─────────────────────────── public ───────────────────────────

  run(spec: AttackSpec, origin: Origin, lv: number, element: Element, skillId: string): void {
    const info: CastInfo = { spec, lv, element, skillId, stacks: new Map() };
    const o: Origin = { ...origin, facing: origin.facing === -1 ? -1 : 1 };
    playVfx(this.scene, spec.vfx.cast, { x: o.x, y: o.y, facing: o.facing, lv });
    const delay = Math.max(0, num(spec.delayMs, 0));
    switch (spec.pattern) {
      case 'projectile': this.runProjectile(info, o, delay); break;
      case 'melee_arc': this.runMelee(info, o, delay); break;
      case 'aoe_self': this.runAoeSelf(info, o, delay); break;
      case 'aoe_target': this.runAoeTarget(info, o, delay); break;
      case 'beam': this.runBeam(info, o, delay); break;
      case 'chain': this.runChain(info, o, delay); break;
      case 'rain': this.runRain(info, o, delay); break;
      default: console.warn(`[skills] unknown pattern ${(spec as AttackSpec).pattern} (${skillId})`);
    }
  }

  update(delta: number): void {
    if (this.projs.length === 0) return;
    const dt = delta / 1000;
    for (const p of this.projs) {
      if (p.dead) continue;
      try { this.stepProj(p, dt); } catch (e) { console.error('[skills] projectile', e); this.kill(p, 0); }
    }
    this.projs = this.projs.filter(p => !p.dead);
  }

  clear(): void {
    for (const p of this.projs) { p.dead = true; destroyGo(p.go); }
    this.projs = [];
  }

  // ─────────────────────────── targeting ───────────────────────────

  private living(): IMonster[] {
    try { return this.svc().monsters.all().filter(m => m && m.alive); } catch { return []; }
  }

  /** Nearest living monster in the facing half-plane within `range` (edge distance) and |dy| ≤ maxDy. */
  frontNearest(o: Origin, range: number, maxDy = FRONT_MAX_DY): IMonster | null {
    let best: IMonster | null = null, bestD = Infinity;
    for (const m of this.living()) {
      const b = m.getBounds();
      const dx = (b.centerX - o.x) * o.facing;
      if (dx < -b.width / 2) continue;
      const dy = Math.abs(b.centerY - o.y);
      if (dy > maxDy) continue;
      if (Math.max(0, dx - b.width / 2) > range) continue;
      const d = Math.abs(dx) + dy * 0.6;
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  /** Nearest living monster in any direction (used by summons). */
  nearestAny(x: number, y: number, range: number, maxDy = 160): IMonster | null {
    let best: IMonster | null = null, bestD = Infinity;
    for (const m of this.living()) {
      const c = monsterCenter(m);
      const dy = Math.abs(c.y - y);
      if (dy > maxDy) continue;
      const d = Math.hypot(c.x - x, dy);
      if (d <= range && d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  private inRect(r: Phaser.Geom.Rectangle, fromX: number, fromY: number, max: number, exclude?: Set<number>): IMonster[] {
    const out: { m: IMonster; d: number }[] = [];
    for (const m of this.living()) {
      if (exclude?.has(m.uid)) continue;
      const b = m.getBounds();
      if (!Phaser.Geom.Rectangle.Overlaps(r, b)) continue;
      out.push({ m, d: Math.hypot(b.centerX - fromX, b.centerY - fromY) });
    }
    out.sort((a, b) => a.d - b.d);
    return out.slice(0, Math.max(0, max)).map(e => e.m);
  }

  private maxT(info: CastInfo): number { return Math.max(1, Math.round(num(info.spec.maxTargets(info.lv), 1))); }

  // ─────────────────────────── damage lines ───────────────────────────

  /**
   * Hits one target with all lines of the spec. `vfx.hit` once at the first line, `bonusVs` checked
   * (and consumed) at the first line, status applied after the first line using it as baseHit.
   */
  strike(info: CastInfo, m: IMonster, fromX: number, playHit = true): void {
    const spec = info.spec;
    const s = this.svc();
    const lines = Math.max(1, Math.round(num(spec.hits(info.lv), 1)));
    const interval = Math.max(0, num(spec.hitIntervalMs, 90));
    const base = info.stacks.get(m.uid) ?? 0;
    info.stacks.set(m.uid, base + lines);

    let pct = num(spec.damagePct(info.lv), 100);
    let consume = false;
    if (spec.bonusVs && m.hasStatus(spec.bonusVs.status)) {
      pct *= num(spec.bonusVs.mult, 1);
      consume = !!spec.bonusVs.consume;
    }
    if (playHit) {
      const c = monsterCenter(m);
      let h = 40;
      try { h = m.getBounds().height; } catch { /* ignore */ }
      playVfx(this.scene, spec.vfx.hit, { x: c.x, y: c.y, h, facing: m.x >= fromX ? 1 : -1, lv: info.lv, groundY: m.y });
    }
    for (let i = 0; i < lines; i++) {
      this.sched.after(i * interval, () => {
        if (!m.alive) return;
        const r = s.combat.rollSkillDamage(info.element, pct, m);
        s.combat.damageMonster(m, r.amount, {
          crit: r.crit, element: info.element, fromX,
          knockback: i === 0 ? spec.knockback : undefined,
          stackIndex: base + i,
        });
        if (i === 0) {
          if (consume && spec.bonusVs) safe(() => m.removeStatus(spec.bonusVs!.status));
          if (spec.status && m.alive) s.combat.tryApplyStatus(m, spec.status, info.lv, info.element, r.amount);
        }
      });
    }
  }

  /** Walkable surface y at/below (x, yHint), falling back to yHint. */
  private groundUnder(x: number, yHint: number): number {
    try {
      const p = this.svc().game.currentMap()?.platformAt(x, yHint, 160);
      if (p && p.y >= yHint - 160) return p.y;
    } catch { /* ignore */ }
    return yHint;
  }

  // ─────────────────────────── patterns ───────────────────────────

  private runMelee(info: CastInfo, o: Origin, delay: number) {
    const spec = info.spec;
    const a = spec.area ?? { w: Math.max(80, spec.range), h: 100 };
    const cx = o.x + o.facing * num(a.offsetX, a.w / 2);
    const cy = o.y + num(a.offsetY, 0);
    playVfx(this.scene, spec.vfx.area, { x: cx, y: cy, facing: o.facing, w: a.w, h: a.h, lv: info.lv, groundY: this.groundUnder(cx, o.y + 34) });
    this.sched.after(delay, () => {
      for (const m of this.inRect(rectC(cx, cy, a.w, a.h), o.x, o.y, this.maxT(info))) this.strike(info, m, o.x);
    });
  }

  private runAoeSelf(info: CastInfo, o: Origin, delay: number) {
    const spec = info.spec;
    const a = spec.area ?? { w: Math.max(160, spec.range * 2), h: 140 };
    // Centered on the caster's body, not the staff tip 18px ahead (novas must look centered on the mage).
    const cx = num(o.centerX, o.x) + o.facing * num(a.offsetX, 0);
    const cy = o.y + num(a.offsetY, 0);
    playVfx(this.scene, spec.vfx.area, { x: cx, y: cy, facing: o.facing, w: a.w, h: a.h, lv: info.lv, groundY: this.groundUnder(cx, o.y + 34) });
    this.sched.after(delay, () => {
      for (const m of this.inRect(rectC(cx, cy, a.w, a.h), cx, cy, this.maxT(info))) this.strike(info, m, cx);
    });
  }

  private runAoeTarget(info: CastInfo, o: Origin, delay: number) {
    const spec = info.spec;
    const a = spec.area ?? { w: 160, h: 140 };
    const t = this.frontNearest(o, spec.range);
    const tc = t ? monsterCenter(t) : { x: o.x + o.facing * spec.range, y: o.y };
    const cx = tc.x + o.facing * num(a.offsetX, 0);
    const cy = tc.y + num(a.offsetY, 0);
    playVfx(this.scene, spec.vfx.area, { x: cx, y: cy, facing: o.facing, w: a.w, h: a.h, targetX: cx, targetY: cy, lv: info.lv, groundY: t ? this.groundUnder(cx, t.y) : this.groundUnder(cx, o.y + 34) });
    this.sched.after(delay, () => {
      for (const m of this.inRect(rectC(cx, cy, a.w, a.h), cx, cy, this.maxT(info))) this.strike(info, m, o.x);
    });
  }

  private runBeam(info: CastInfo, o: Origin, delay: number) {
    const spec = info.spec;
    const h = num(spec.area?.h, 60);
    const cy = o.y + num(spec.area?.offsetY, 0);
    const endX = o.x + o.facing * spec.range;
    playVfx(this.scene, spec.vfx.area, { x: o.x, y: cy, targetX: endX, targetY: cy, w: spec.range, h, facing: o.facing, lv: info.lv });
    const r = new Phaser.Geom.Rectangle(Math.min(o.x, endX), cy - h / 2, spec.range, h);
    this.sched.after(delay, () => {
      for (const m of this.inRect(r, o.x, cy, this.maxT(info))) this.strike(info, m, o.x);
    });
  }

  private runChain(info: CastInfo, o: Origin, delay: number) {
    const spec = info.spec;
    const jumpRange = num(spec.chain?.jumpRange, 220);
    const jumpDelay = Math.max(0, num(spec.chain?.jumpDelayMs, 60));
    const max = this.maxT(info);
    const visited = new Set<number>();

    const hop = (t: IMonster, from: { x: number; y: number }, n: number) => {
      const c = monsterCenter(t);
      playVfx(this.scene, spec.vfx.area, { x: from.x, y: from.y, targetX: c.x, targetY: c.y, facing: c.x >= from.x ? 1 : -1, lv: info.lv });
      visited.add(t.uid);
      this.strike(info, t, from.x);
      if (n >= max) return;
      this.sched.after(jumpDelay, () => {
        const here = t.alive ? monsterCenter(t) : c;
        let best: IMonster | null = null, bestD = Infinity;
        for (const m of this.living()) {
          if (visited.has(m.uid)) continue;
          const mc = monsterCenter(m);
          const d = Math.hypot(mc.x - here.x, mc.y - here.y);
          if (d <= jumpRange && d < bestD) { bestD = d; best = m; }
        }
        if (best) hop(best, here, n + 1);
      });
    };

    this.sched.after(delay, () => {
      const first = this.frontNearest(o, spec.range);
      if (!first) {
        // Fizzle: a short segment so the cast reads visually even with no target.
        playVfx(this.scene, spec.vfx.area, { x: o.x, y: o.y, targetX: o.x + o.facing * spec.range * 0.45, targetY: o.y, facing: o.facing, lv: info.lv });
        return;
      }
      hop(first, { x: o.x, y: o.y }, 1);
    });
  }

  private runRain(info: CastInfo, o: Origin, delay: number) {
    const spec = info.spec;
    const r = spec.rain ?? { count: () => 5, spreadX: 300, intervalMs: 110 };
    const n = Math.max(1, Math.round(num(r.count(info.lv), 1)));
    const offX = spec.area?.offsetX;
    // Snap to the nearest target only when the author did not pin the zone with area.offsetX.
    const t = offX === undefined ? this.frontNearest(o, spec.range) : null;
    const cx = t ? t.x : o.x + o.facing * num(offX, spec.range / 2);
    const groundY = t ? t.y : num(o.groundY, this.svc().player.y);
    const fall = num(r.fallHeight, 420);
    const speed = Math.max(50, num(spec.projectile?.speed, 900));
    const explode = spec.projectile?.explodeArea ?? (spec.area ? { w: spec.area.w, h: spec.area.h } : DEFAULT_EXPLODE);
    const spread = Math.max(0, num(r.spreadX, 0));
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const base = n === 1 ? cx : cx - spread / 2 + spread * (i / (n - 1));
      const jitter = n > 1 ? (Math.random() - 0.5) * (spread / n) * 0.6 : 0;
      xs.push(base + jitter);
    }
    shuffle(xs);
    const interval = Math.max(0, num(r.intervalMs, 100));
    xs.forEach((x, i) => {
      this.sched.after(delay + i * interval, () => {
        const y0 = groundY - fall;
        const go = this.spawnVisual(info, x, y0, Math.PI / 2, o.facing);
        this.projs.push({
          info, go, x, y: y0, vx: 0, vy: speed, gravity: 0, radius: 0, travelled: 0, range: fall + 200,
          pierce: false, maxTargets: this.maxT(info), hitCount: 0, hitSet: new Set(), explode,
          faller: { groundY }, dead: false,
        });
      });
    });
  }

  private runProjectile(info: CastInfo, o: Origin, delay: number) {
    const spec = info.spec;
    const p = spec.projectile ?? { speed: 700, radius: 10 };
    const count = Math.max(1, Math.round(num(p.count?.(info.lv), 1)));
    const spread = num(p.spreadDeg, 0);
    const speed = Math.max(50, num(p.speed, 700));
    const gravity = num(p.gravity, 0);
    // Base heading: straight ahead, or aimed (summons) clamped to ±60°.
    let baseAngle = 0; // relative to facing, +down
    if (o.aimAt) {
      const dx = Math.max(1, (o.aimAt.x - o.x) * o.facing);
      baseAngle = clamp(Math.atan2(o.aimAt.y - o.y, dx), -Math.PI / 3, Math.PI / 3);
    }
    // A fanned volley shares one hit set so its shots spread across distinct foes instead of
    // all landing on the nearest one (a fan advertises N targets x damage, not N x damage on one).
    const sharedHits: Set<number> | null = spread && count > 1 ? new Set() : null;
    for (let i = 0; i < count; i++) {
      const offDeg = spread ? (i - (count - 1) / 2) * spread : 0;
      const spawnDelay = delay + (spread ? 0 : i * 70);
      const yOff = !spread && count > 1 ? (i % 2 === 0 ? 0 : -6) * (i % 4 < 2 ? 1 : -1) : 0;
      this.sched.after(spawnDelay, () => {
        const a = baseAngle + (offDeg * Math.PI) / 180;
        let vx = Math.cos(a) * speed * o.facing;
        let vy = Math.sin(a) * speed;
        if (gravity > 0 && !o.aimAt) {
          // Auto-lob: returns to the launch height at `range`.
          const T = spec.range / Math.max(1, Math.abs(vx));
          vy += -gravity * T / 2;
        }
        const x = o.x, y = o.y + yOff;
        const go = this.spawnVisual(info, x, y, Math.atan2(vy, vx), o.facing);
        this.projs.push({
          info, go, x, y, vx, vy, gravity, radius: Math.max(2, num(p.radius, 10)), travelled: 0,
          range: gravity > 0 ? spec.range * 1.6 : spec.range,
          pierce: !!p.pierce, maxTargets: this.maxT(info), hitCount: 0, hitSet: sharedHits ?? new Set(),
          explode: p.explodeArea, dead: false,
        });
      });
    }
  }

  // ─────────────────────────── projectile simulation ───────────────────────────

  private spawnVisual(info: CastInfo, x: number, y: number, angle: number, facing: 1 | -1): Phaser.GameObjects.GameObject | null {
    const key = info.spec.vfx.projectile;
    let go: Phaser.GameObjects.GameObject | void = undefined;
    if (key) go = playVfx(this.scene, key, { x, y, facing, angle, lv: info.lv });
    else {
      // No visual authored: a simple default glow so the shot is still visible.
      const tex = this.scene.textures.exists('px_soft') ? 'px_soft' : this.scene.textures.exists('app_glow') ? 'app_glow' : null;
      go = tex
        ? this.scene.add.image(x, y, tex).setScale(0.6).setTint(0xd8c8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.VFX)
        : this.scene.add.circle(x, y, 6, 0xd8c8ff, 0.9).setDepth(DEPTH.VFX);
    }
    if (!go) go = this.scene.add.zone(x, y, 1, 1); // invisible placeholder: logic still works
    poseProj(go, x, y, angle);
    return go;
  }

  private kill(p: Proj, fadeMs: number) {
    if (p.dead) return;
    p.dead = true;
    destroyGo(p.go, fadeMs, this.scene);
    p.go = null;
  }

  private stepProj(p: Proj, dt: number) {
    if (p.faller) {
      const step = p.vy * dt;
      p.y += step;
      p.travelled += step;
      if (p.y >= p.faller.groundY) {
        p.y = p.faller.groundY;
        this.landFaller(p);
        return;
      }
      setPos(p.go, p.x, p.y, Math.PI / 2);
      return;
    }

    // Sub-step fast projectiles so they don't tunnel through small monsters.
    const speed = Math.hypot(p.vx, p.vy);
    const steps = Math.max(1, Math.ceil((speed * dt) / Math.max(8, p.radius)));
    const sdt = dt / steps;
    for (let s = 0; s < steps && !p.dead; s++) {
      p.vy += p.gravity * sdt;
      const nx = p.x + p.vx * sdt, ny = p.y + p.vy * sdt;
      p.travelled += p.gravity > 0 ? Math.abs(nx - p.x) : Math.hypot(nx - p.x, ny - p.y);
      p.x = nx; p.y = ny;

      if (this.checkMonsters(p)) return;
      if (this.hitsWall(p.x, p.y) || (p.gravity > 0 && p.vy > 0 && this.landsOnPlatform(p.x, p.y))) {
        if (p.explode) this.explodeAt(p, p.x, p.y); else this.kill(p, 60);
        return;
      }
      const map = this.svc().game.currentMap();
      const W = map?.widthPx ?? 1e9, H = map?.heightPx ?? 1e9;
      if (p.x < -40 || p.x > W + 40 || p.y > H + 40 || p.y < -400 || p.travelled >= p.range) { this.kill(p, 90); return; }
    }
    if (!p.dead) poseProj(p.go, p.x, p.y, Math.atan2(p.vy, p.vx));
  }

  /** Returns true if the projectile was consumed. */
  private checkMonsters(p: Proj): boolean {
    const r = p.radius;
    const vr = Math.max(r, 18); // forgiving vertical reach so straight shots hit short monsters
    const hits: IMonster[] = [];
    for (const m of this.living()) {
      if (p.hitSet.has(m.uid)) continue;
      const b = m.getBounds();
      if (p.x + r < b.left || p.x - r > b.right || p.y + vr < b.top || p.y - vr > b.bottom) continue;
      hits.push(m);
    }
    if (hits.length === 0) return false;
    if (p.explode) { this.explodeAt(p, p.x, p.y); return true; }
    hits.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
    const fromX = p.x - Math.sign(p.vx || 1) * 40;
    for (const m of hits) {
      p.hitSet.add(m.uid);
      p.hitCount++;
      this.strike(p.info, m, fromX);
      if (!p.pierce || p.hitCount >= p.maxTargets) { this.kill(p, 0); return true; }
    }
    return false;
  }

  private explodeAt(p: Proj, x: number, y: number) {
    const e = p.explode ?? DEFAULT_EXPLODE;
    const spec = p.info.spec;
    playVfx(this.scene, spec.vfx.area, { x, y, w: e.w, h: e.h, facing: p.vx < 0 ? -1 : 1, lv: p.info.lv });
    const targets = this.inRect(rectC(x, y, e.w, e.h), x, y, p.maxTargets);
    for (const m of targets) this.strike(p.info, m, x);
    this.kill(p, 0);
  }

  private landFaller(p: Proj) {
    const e = p.explode ?? DEFAULT_EXPLODE;
    const g = p.faller!.groundY;
    const spec = p.info.spec;
    playVfx(this.scene, spec.vfx.area, { x: p.x, y: g, w: e.w, h: e.h, facing: 1, lv: p.info.lv });
    const r = new Phaser.Geom.Rectangle(p.x - e.w / 2, g - e.h, e.w, e.h);
    for (const m of this.inRect(r, p.x, g - e.h / 2, p.maxTargets)) this.strike(p.info, m, p.x);
    this.kill(p, 0);
  }

  private hitsWall(x: number, y: number): boolean {
    const map = this.svc().game.currentMap();
    if (!map || !map.solids) return false;
    const kids = map.solids.getChildren();
    for (let i = 0; i < kids.length; i++) {
      const body = (kids[i] as unknown as { body?: { x: number; y: number; width: number; height: number } }).body;
      if (!body) continue;
      if (x >= body.x && x <= body.x + body.width && y >= body.y && y <= body.y + body.height) return true;
    }
    return false;
  }

  /** Falling arcing projectiles also land on one-way platform tops. */
  private landsOnPlatform(x: number, y: number): boolean {
    const map = this.svc().game.currentMap();
    if (!map || !map.platforms) return false;
    const kids = map.platforms.getChildren();
    for (let i = 0; i < kids.length; i++) {
      const body = (kids[i] as unknown as { body?: { x: number; y: number; width: number } }).body;
      if (!body) continue;
      if (x >= body.x && x <= body.x + body.width && y >= body.y && y <= body.y + 12) return true;
    }
    return false;
  }

  /** Number of live projectiles (debug). */
  get activeProjectiles(): number { return this.projs.length; }
}
