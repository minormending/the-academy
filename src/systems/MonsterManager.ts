// OWNER: A6 (monsters). Spawning, respawn, contact damage and spatial queries.
import Phaser from 'phaser';
import type { GameServices, IMapInstance, IMonster, IMonsterManager, MonsterDef, SpawnDef } from '../core/types';
import { bus } from '../core/events';
import { Registry } from '../core/registry';
import { Monster, type MonsterSpawnOptions } from '../entities/Monster';
import { LichArchon } from '../entities/monsters/LichArchon';

const DEFAULT_RESPAWN_MS = 7000;
const BOSS_RESPAWN_MS = 300000;

export class MonsterManager implements IMonsterManager {
  private list: Monster[] = [];
  private map: IMapInstance | null = null;
  private timers: Phaser.Time.TimerEvent[] = [];
  /** monster uid → index into map.def.spawns */
  private groupOf = new Map<number, number>();
  private gen = 0;
  private warned = false;

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
    (map.def.spawns ?? []).forEach((sp, i) => {
      for (let k = 0; k < sp.count; k++) this.spawnInGroup(i, false);
    });
  }

  spawn(monsterId: string, x: number, y: number): IMonster | null {
    const def = Registry.monster(monsterId);
    if (!def || !this.map) return null;
    return this.create(def, x, y, { fadeIn: true });
  }

  update(time: number, delta: number) {
    if (this.list.length === 0) return;
    // prune destroyed
    if (this.list.some(m => m.destroyed)) this.list = this.list.filter(m => !m.destroyed);
    for (const m of [...this.list]) m.update(time, delta);
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
    this.map = null;
  }

  // ─────────────────────────── internals ───────────────────────────

  private create(def: MonsterDef, x: number, y: number, opts: MonsterSpawnOptions): Monster | null {
    if (!this.map) return null;
    try {
      const m = def.behavior === 'boss' || def.id === 'lich_archon'
        ? new LichArchon(this.scene, this.services, def, x, y, this.map, opts)
        : new Monster(this.scene, this.services, def, x, y, this.map, opts);
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

  private onKilled(monster: IMonster) {
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
      if (Phaser.Geom.Intersects.RectangleToRectangle(m.getBounds(), pb)) {
        const weak = (m as { outgoingDamageMult?: () => number }).outgoingDamageMult?.() ?? 1;
        s.combat.hitPlayer(Math.max(1, Math.round(m.def.touchDamage * weak)), m.x);
        return; // one contact hit per frame
      }
    }
  }
}
