// OWNER: A6 (monsters). Spawning, respawn, contact damage and spatial queries.
import Phaser from 'phaser';
import type { GameServices, IMapInstance, IMonster, IMonsterManager, MonsterDef, SpawnDef } from '../core/types';
import { bus } from '../core/events';
import { Registry } from '../core/registry';
import { Monster, type MonsterSpawnOptions } from '../entities/Monster';
import { ensureMonsterTexture } from '../art/monsterArt';
import { LichArchon } from '../entities/monsters/LichArchon';
import { FIELD_BOSS_CLASSES } from '../entities/monsters/fieldBosses';
import { FIELD_BOSSES, fieldBossTitle, isFieldBoss } from '../data/monsters';

const DEFAULT_RESPAWN_MS = 7000;
const BOSS_RESPAWN_MS = 300000;
/** Field boss respawn after death when its spawn entry has no respawnMs; jittered ±20% (→ ~8–12 min). */
const FIELD_BOSS_RESPAWN_MS = 600000;

/** Boss ids already warned about (no FieldBoss class) so a respawning boss logs once. */
const warnedBossFallback = new Set<string>();

/** Per-map field boss timer (session-scoped: survives map changes, not saves). */
interface FieldBossTimer { nextAt: number; alive: boolean }

export class MonsterManager implements IMonsterManager {
  private list: Monster[] = [];
  private map: IMapInstance | null = null;
  private timers: Phaser.Time.TimerEvent[] = [];
  /** monster uid → index into map.def.spawns */
  private groupOf = new Map<number, number>();
  private gen = 0;
  private warned = false;
  private fieldBoss = new Map<string, FieldBossTimer>();
  /** uid of the current map's living field boss → its spawn-entry index. */
  private fieldBossUid = new Map<number, number>();
  /** First appearance on the first visit to a map (debug: shorten in the console). */
  fieldBossFirstDelayMs = 180000;
  /** Re-entering a map whose boss was due / still alive: it shows up after this. */
  fieldBossReturnDelayMs = 10000;

  constructor(private scene: Phaser.Scene, private services: GameServices) {
    bus.on('monster:killed', ({ monster }) => this.onKilled(monster));
  }

  // ─────────────────────────── queries ───────────────────────────

  all(): IMonster[] {
    return this.list.filter(m => m.alive);
  }

  inRect(rect: Phaser.Geom.Rectangle): IMonster[] {
    const out: IMonster[] = [];
    for (const m of this.list) {
      if (m.alive && Phaser.Geom.Intersects.RectangleToRectangle(m.getBounds(), rect)) out.push(m);
    }
    return out;
  }

  nearest(x: number, y: number, maxDist: number, facing?: 1 | -1, maxDy?: number): IMonster | null {
    let best: Monster | null = null;
    let bestD = Infinity;
    for (const m of this.list) {
      if (!m.alive) continue;
      const b = m.getBounds();
      const dxC = m.x - x;
      if (facing !== undefined && dxC * facing < -b.width / 2) continue; // behind us
      const dxE = Math.max(0, Math.abs(dxC) - b.width / 2);
      const dyE = y < b.y ? b.y - y : y > b.bottom ? y - b.bottom : 0;
      if (maxDy !== undefined && dyE > maxDy) continue;
      const d = Math.hypot(dxE, dyE);
      if (d > maxDist) continue;
      if (d < bestD || (d === bestD && best && Math.abs(dxC) < Math.abs(best.x - x))) { best = m; bestD = d; }
    }
    return best;
  }

  // ─────────────────────────── lifecycle ───────────────────────────

  bindMap(map: IMapInstance) {
    this.clear();
    this.map = map;
    this.gen++;
    if (map.def.safe) return;
    // Build this map's monster sheets up front (one batch during the map load, not a hitch per first spawn).
    for (const id of new Set((map.def.spawns ?? []).map(sp => sp.monsterId))) ensureMonsterTexture(this.scene, id);
    (map.def.spawns ?? []).forEach((sp, i) => {
      if (isFieldBoss(sp.monsterId)) { this.scheduleFieldBoss(i); return; }
      for (let k = 0; k < sp.count; k++) this.spawnInGroup(i, false);
    });
  }

  spawn(monsterId: string, x: number, y: number): IMonster | null {
    const def = Registry.monster(monsterId);
    if (!def || !this.map) return null;
    const m = this.create(def, x, y, { fadeIn: true });
    if (m && isFieldBoss(def.id)) {
      // Debug / scripted spawn of the map's own field boss counts as its natural appearance.
      const i = (this.map.def.spawns ?? []).findIndex(sp => sp.monsterId === def.id);
      if (i >= 0) this.adoptFieldBoss(m, i);
      this.announceFieldBoss(def);
    }
    return m;
  }

  update(time: number, delta: number) {
    if (this.list.length === 0) return;
    // prune destroyed
    let pruned = false;
    for (let i = 0; i < this.list.length; i++) if (this.list[i].destroyed) { pruned = true; break; }
    if (pruned) this.list = this.list.filter(m => !m.destroyed);
    // Index loop over the length at entry: monsters spawned during this update (boss adds) wait for next frame, and a
    // map change that swaps `this.list` mid-loop can't break iteration (destroyed monsters ignore update()).
    const list = this.list, n = list.length;
    for (let i = 0; i < n; i++) list[i].update(time, delta);
    try {
      this.contactDamage();
    } catch (e) {
      if (!this.warned) { this.warned = true; console.warn('[monsters] contact check failed', e); }
    }
  }

  clear() {
    this.gen++;
    for (const t of this.timers) t.remove(false);
    this.timers = [];
    for (const m of this.list) { try { m.destroy(); } catch { /* ignore */ } }
    this.list = [];
    this.groupOf.clear();
    this.fieldBossUid.clear();
    this.map = null;
  }

  // ─────────────────────────── internals ───────────────────────────

  private create(def: MonsterDef, x: number, y: number, opts: MonsterSpawnOptions): Monster | null {
    if (!this.map) return null;
    try {
      const FB = FIELD_BOSS_CLASSES[def.id];
      const m = FB
        ? new FB(this.scene, this.services, def, x, y, this.map, opts)
        : def.id === 'lich_archon'
          ? new LichArchon(this.scene, this.services, def, x, y, this.map, opts)
          : new Monster(this.scene, this.services, def, x, y, this.map, opts);
      if (!FB && def.behavior === 'boss' && def.id !== 'lich_archon' && !warnedBossFallback.has(def.id)) {
        warnedBossFallback.add(def.id);
        console.warn(`[monsters] '${def.id}' is a boss with no FieldBoss class; spawning it as a regular Monster`);
      }
      this.list.push(m);
      return m;
    } catch (e) {
      console.error(`[monsters] failed to spawn ${def.id}`, e);
      return null;
    }
  }

  private spawnInGroup(i: number, fadeIn: boolean) {
    const sp: SpawnDef | undefined = this.map?.def.spawns?.[i];
    if (!sp) return;
    const def = Registry.monster(sp.monsterId);
    if (!def) {
      if (!this.warned) { this.warned = true; console.warn(`[monsters] unknown monster ${sp.monsterId}`); }
      return;
    }
    const x1 = Math.min(sp.x1, sp.x2), x2 = Math.max(sp.x1, sp.x2);
    const half = def.size.w / 2;
    const x = Phaser.Math.Clamp(x1 + Math.random() * (x2 - x1), x1 + Math.min(half, (x2 - x1) / 2), x2 - Math.min(half, (x2 - x1) / 2));
    const m = this.create(def, x, sp.y - 1, { band: { x1, x2, y: sp.y }, fadeIn });
    if (m) this.groupOf.set(m.uid, i);
  }

  private aliveInGroup(i: number): number {
    let n = 0;
    for (const m of this.list) if (m.alive && this.groupOf.get(m.uid) === i) n++;
    return n;
  }

  // ─────────────────────────── field bosses ───────────────────────────

  /** Timer state per map for debugging: `{ mapId: { inMs, alive } }`. */
  fieldBossTimers(): Record<string, { inMs: number; alive: boolean }> {
    const now = this.scene.time.now, out: Record<string, { inMs: number; alive: boolean }> = {};
    for (const [id, t] of this.fieldBoss) out[id] = { inMs: Math.max(0, Math.round(t.nextAt - now)), alive: t.alive };
    return out;
  }

  /** On map bind: first visit → in ~3 min; returning while it was due/alive → shortly; else the remaining respawn. */
  private scheduleFieldBoss(i: number) {
    const map = this.map;
    const sp = map?.def.spawns?.[i];
    if (!map || !sp) return;
    const now = this.scene.time.now;
    let t = this.fieldBoss.get(map.def.id);
    if (!t) { t = { nextAt: now + this.fieldBossFirstDelayMs, alive: false }; this.fieldBoss.set(map.def.id, t); }
    else if (t.alive || t.nextAt <= now) { t.nextAt = now + this.fieldBossReturnDelayMs; t.alive = false; }
    this.armFieldBossTimer(i, Math.max(0, t.nextAt - now));
  }

  private armFieldBossTimer(i: number, ms: number) {
    const gen = this.gen;
    const timer = this.scene.time.delayedCall(ms, () => {
      this.timers = this.timers.filter(x => x !== timer);
      if (gen !== this.gen || !this.map) return;
      // Don't ambush students far below the boss: wait until they're within a level of it.
      const sp = this.map.def.spawns?.[i];
      const bossLv = sp ? Registry.monster(sp.monsterId)?.level ?? 0 : 0;
      const pl = this.services.progression?.state.level ?? 99;
      if (pl < bossLv - 1) { this.armFieldBossTimer(i, 60000); return; }
      this.spawnFieldBoss(i);
    });
    this.timers.push(timer);
  }

  private spawnFieldBoss(i: number) {
    const map = this.map;
    const sp = map?.def.spawns?.[i];
    if (!map || !sp) return;
    const def = Registry.monster(sp.monsterId);
    if (!def) return;
    const existing = this.list.find(m => m.alive && m.def.id === def.id);
    if (existing) { this.adoptFieldBoss(existing, i); return; }
    const x1 = Math.min(sp.x1, sp.x2), x2 = Math.max(sp.x1, sp.x2);
    // Appear in the middle part of the span (well away from the portals at the ends).
    const x = x1 + (x2 - x1) * (0.3 + Math.random() * 0.4);
    const m = this.create(def, x, sp.y - 1, { band: { x1, x2, y: sp.y }, fadeIn: true });
    if (!m) return;
    this.adoptFieldBoss(m, i);
    this.announceFieldBoss(def);
  }

  private adoptFieldBoss(m: IMonster, i: number) {
    if (!this.map) return;
    this.fieldBossUid.set(m.uid, i);
    const t = this.fieldBoss.get(this.map.def.id) ?? { nextAt: 0, alive: true };
    t.alive = true;
    t.nextAt = Infinity;
    this.fieldBoss.set(this.map.def.id, t);
  }

  private announceFieldBoss(def: MonsterDef) {
    const color = FIELD_BOSSES[def.id]?.color ?? '#ffd36b';
    const who = fieldBossTitle(def);
    try { bus.emit('ui:banner', { text: `${who} has appeared!`, sub: `Lv.${def.level} field boss`, color }); } catch { /* ignore */ }
    try { bus.emit('ui:log', { text: `${who} has appeared somewhere in ${this.map?.def.name ?? 'the area'}!`, color }); } catch { /* ignore */ }
    try { this.services.audio?.play('boss_roar'); } catch { /* ignore */ }
    try { this.scene.cameras.main.shake(300, 0.004); } catch { /* ignore */ }
  }

  private onFieldBossKilled(i: number) {
    const map = this.map;
    if (!map) return;
    const sp = map.def.spawns?.[i];
    const base = sp?.respawnMs ?? FIELD_BOSS_RESPAWN_MS;
    const ms = Math.round(base * (0.8 + Math.random() * 0.4));
    this.fieldBoss.set(map.def.id, { nextAt: this.scene.time.now + ms, alive: false });
    this.armFieldBossTimer(i, ms);
  }

  private onKilled(monster: IMonster) {
    // One bad spawn entry / missing map must not break the remaining 'monster:killed' work (bus also guards listeners).
    try { this.handleKilled(monster); } catch (e) { console.error(`[monsters] onKilled failed for ${monster?.def?.id}`, e); }
  }

  private handleKilled(monster: IMonster) {
    const fb = this.fieldBossUid.get(monster.uid);
    if (fb !== undefined) { this.fieldBossUid.delete(monster.uid); this.onFieldBossKilled(fb); return; }
    const group = this.groupOf.get(monster.uid);
    this.groupOf.delete(monster.uid);
    if (group === undefined || !this.map) return;
    const sp = this.map.def.spawns?.[group];
    if (!sp) return;
    const ms = sp.respawnMs ?? (monster.def.boss ? BOSS_RESPAWN_MS : DEFAULT_RESPAWN_MS);
    const gen = this.gen;
    const timer = this.scene.time.delayedCall(ms, () => {
      this.timers = this.timers.filter(t => t !== timer);
      if (gen !== this.gen || !this.map) return;
      if (this.aliveInGroup(group) < sp.count) this.spawnInGroup(group, true);
    });
    this.timers.push(timer);
  }

  private contactDamage() {
    const s = this.services;
    if (!s.player || !s.combat) return;
    if (s.progression?.isDead()) return;
    if (s.player.isInvulnerable()) return;
    const pb = s.player.getBounds();
    for (const m of this.list) {
      if (!m.canContact()) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(m.boundsRef(), pb)) {
        const weak = (m as { outgoingDamageMult?: () => number }).outgoingDamageMult?.() ?? 1;
        s.combat.hitPlayer(Math.max(1, Math.round(m.def.touchDamage * weak)), m.x);
        return; // one contact hit per frame
      }
    }
  }
}
