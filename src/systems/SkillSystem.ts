// OWNER: A2 (skill-engine). Casting, cooldowns, buffs, summons, movement; attacks via AttackRunner.
import Phaser from 'phaser';
import { bus } from '../core/events';
import { Registry } from '../core/registry';
import { playVfx } from '../core/vfx';
import type {
  ActiveBuff, AttackSpec, CastResult, GameServices, ISkillSystem, SkillContext, SkillDef, StatModifier,
} from '../core/types';
import { AttackRunner } from './skill/AttackRunner';
import { Origin, Scheduler, clamp, destroyGo, goAlive, monsterCenter, num, safe, setFacing, setPos } from './skill/util';

/** Cast point relative to player feet (staff height). */
export const CAST_OFFSET = { x: 18, y: -34 } as const;

interface Cooldown { remaining: number; total: number; }

interface BuffState {
  def: SkillDef;
  lv: number;
  remaining: number;
  total: number;
  modifiers: StatModifier[];
  aura: Phaser.GameObjects.GameObject | null;
  /** Set when the aura must be (re)created (cast / after clearWorld). */
  needsAura: boolean;
}

interface SummonState {
  def: SkillDef;
  lv: number;
  go: Phaser.GameObjects.GameObject | null;
  x: number;
  y: number;
  facing: 1 | -1;
  remaining: number;
  attackTimer: number;
  faceLockMs: number;
}

export class SkillSystem implements ISkillSystem {
  private cooldowns = new Map<string, Cooldown>();
  private buffs = new Map<string, BuffState>();
  private summons = new Map<string, SummonState>();
  private sched = new Scheduler();
  private runner: AttackRunner;

  constructor(private scene: Phaser.Scene, private services: GameServices) {
    this.runner = new AttackRunner(scene, () => this.services, this.sched);
    bus.on('player:died', () => this.onPlayerDied());
  }

  // ─────────────────────────── casting ───────────────────────────

  tryCast(skillId: string): CastResult {
    const def = Registry.skill(skillId);
    if (!def) return 'unknown';
    const s = this.services;
    const learned = s.progression.state.skills[skillId] ?? 0;
    if (!(learned > 0)) return 'not_learned';
    if (def.kind === 'passive') return 'passive';
    if (s.progression.isDead() || s.player.state === 'dead') return 'dead';
    if (s.player.isBusy()) return 'busy';
    if ((this.cooldowns.get(skillId)?.remaining ?? 0) > 0) return 'cooldown';
    const lv = Math.max(1, Math.min(learned, def.maxLevel || learned));
    const cost = Math.max(0, Math.round(num(def.mpCost(lv), 0)));
    if (!s.progression.spendMp(cost)) return 'no_mp';

    const d = s.progression.derived();
    if (def.cooldownMs) {
      const cd = num(def.cooldownMs(lv), 0) * (1 - clamp(num(d.cdr, 0), 0, 0.8));
      if (cd > 0) this.cooldowns.set(skillId, { remaining: cd, total: cd });
    }
    const baseCast = def.castTimeMs ?? (def.kind === 'movement' ? 150 : 450);
    const lock = Math.max(0, Math.round(baseCast * (1 - clamp(num(d.castSpeed, 0), 0, 0.75))));
    safe(() => s.player.playCast(lock));
    if (def.sfx) safe(() => s.audio.play(def.sfx!));
    bus.emit('skill:cast', { skillId });
    safe(() => this.execute(def, lv));
    return 'ok';
  }

  private castOrigin(): Origin {
    const p = this.services.player;
    return { x: p.x + CAST_OFFSET.x * p.facing, y: p.y + CAST_OFFSET.y, facing: p.facing, groundY: p.y, centerX: p.x };
  }

  private makeContext(def: SkillDef, lv: number): SkillContext {
    return {
      scene: this.scene,
      services: this.services,
      skill: def,
      level: lv,
      runAttack: (spec: AttackSpec, origin: { x: number; y: number; facing: 1 | -1 }) =>
        this.runner.run(spec, { groundY: this.services.player.y, centerX: origin.x, ...origin }, lv, def.element, def.id),
    };
  }

  private execute(def: SkillDef, lv: number) {
    if (def.onCast) { def.onCast(this.makeContext(def, lv), lv); return; }
    switch (def.kind) {
      case 'attack':
        if (def.attack) this.runner.run(def.attack, this.castOrigin(), lv, def.element, def.id);
        break;
      case 'buff':
        if (def.buff) this.startBuff(def, lv);
        break;
      case 'movement':
        if (def.movement) this.doMovement(def, lv);
        break;
      case 'summon':
        if (def.summon) this.spawnSummon(def, lv);
        break;
    }
  }

  getCooldownRemaining(skillId: string): number { return Math.max(0, this.cooldowns.get(skillId)?.remaining ?? 0); }
  getCooldownTotal(skillId: string): number { return this.cooldowns.get(skillId)?.total ?? 0; }

  // ─────────────────────────── buffs ───────────────────────────

  private startBuff(def: SkillDef, lv: number) {
    const spec = def.buff!;
    const p = this.services.player;
    const dur = Math.max(1, num(spec.durationMs(lv), 1000));
    const mods = spec.modifiers(lv) ?? [];
    const b = this.buffs.get(def.id);
    if (b) {
      b.lv = lv; b.remaining = dur; b.total = dur; b.modifiers = mods;
      if (!goAlive(b.aura)) b.needsAura = true;
    } else {
      this.buffs.set(def.id, { def, lv, remaining: dur, total: dur, modifiers: mods, aura: null, needsAura: true });
    }
    playVfx(this.scene, spec.vfx, { x: p.x, y: p.y, facing: p.facing, durationMs: dur, lv });
    this.ensureAuras();
    this.buffsChanged();
  }

  private ensureAuras() {
    const p = this.services.player;
    for (const b of this.buffs.values()) {
      if (!b.needsAura) continue;
      b.needsAura = false;
      const key = b.def.buff?.auraVfx;
      if (!key) continue;
      destroyGo(b.aura);
      const go = playVfx(this.scene, key, { x: p.x, y: p.y, facing: p.facing, durationMs: b.remaining, lv: b.lv });
      b.aura = go || null;
    }
  }

  private endBuff(id: string) {
    const b = this.buffs.get(id);
    if (!b) return;
    destroyGo(b.aura, 200, this.scene);
    this.buffs.delete(id);
    this.buffsChanged();
  }

  private buffsChanged() {
    safe(() => this.services.progression.invalidate());
    bus.emit('player:changed', {});
  }

  getActiveBuffs(): ActiveBuff[] {
    return [...this.buffs.values()].map(b => ({ skillId: b.def.id, remainingMs: Math.max(0, b.remaining), totalMs: b.total, modifiers: b.modifiers }));
  }

  getBuffModifiers(): StatModifier[] {
    const out: StatModifier[] = [];
    for (const b of this.buffs.values()) out.push(...b.modifiers);
    return out;
  }

  cancelBuff(skillId: string): void { this.endBuff(skillId); }

  // ─────────────────────────── summons ───────────────────────────

  private spawnSummon(def: SkillDef, lv: number) {
    const spec = def.summon!;
    const p = this.services.player;
    this.destroySummon(def.id);
    const dur = Math.max(1, num(spec.durationMs(lv), 10000));
    const x = p.x + num(spec.offset?.x, 0) * p.facing;
    const y = p.y + num(spec.offset?.y, 0);
    const go = playVfx(this.scene, spec.vfx, { x, y, facing: p.facing, durationMs: dur, lv }) || null;
    setPos(go, x, y);
    setFacing(go, p.facing);
    const iv = Math.max(100, num(spec.attackIntervalMs, 1000));
    this.summons.set(def.id, { def, lv, go, x, y, facing: p.facing, remaining: dur, attackTimer: Math.min(400, iv), faceLockMs: 0 });
  }

  private destroySummon(id: string) {
    const s = this.summons.get(id);
    if (!s) return;
    destroyGo(s.go, 250, this.scene);
    this.summons.delete(id);
  }

  private updateSummon(sm: SummonState, delta: number) {
    const spec = sm.def.summon!;
    const p = this.services.player;
    sm.remaining -= delta;
    if (sm.remaining <= 0) { this.destroySummon(sm.def.id); return; }
    if (spec.follow) {
      const tx = p.x + num(spec.offset?.x, 0) * p.facing;
      const ty = p.y + num(spec.offset?.y, 0);
      const k = 1 - Math.exp(-(delta / 1000) * 6);
      sm.x += (tx - sm.x) * k;
      sm.y += (ty - sm.y) * k;
      if (sm.faceLockMs <= 0) sm.facing = p.facing;
    }
    sm.faceLockMs -= delta;

    sm.attackTimer -= delta;
    if (sm.attackTimer <= 0) {
      const iv = Math.max(100, num(spec.attackIntervalMs, 1000));
      sm.attackTimer += iv;
      if (sm.attackTimer < 0) sm.attackTimer = iv;
      const atk = spec.attack;
      // aoe_self fields (e.g. Wall of Fire) wake for anything inside their rectangle, not just a w/2 circle.
      const halfW = num(atk.area?.w, 0) / 2, halfH = num(atk.area?.h, 0) / 2;
      const reach = Math.max(num(atk.range, 300), atk.pattern === 'aoe_self' ? Math.hypot(halfW, halfH) : 0);
      const target = this.runner.nearestAny(sm.x, sm.y, reach, Math.max(160, halfH + 20));
      if (target) {
        const c = monsterCenter(target);
        sm.facing = c.x >= sm.x ? 1 : -1;
        sm.faceLockMs = 600;
        this.runner.run(atk, { x: sm.x, y: sm.y, facing: sm.facing, groundY: target.y, aimAt: c }, sm.lv, sm.def.element, sm.def.id);
      }
    }
    setPos(sm.go, sm.x, sm.y);
    setFacing(sm.go, sm.facing);
  }

  // ─────────────────────────── movement ───────────────────────────

  private doMovement(def: SkillDef, lv: number) {
    const spec = def.movement!;
    const p = this.services.player;
    const dist = Math.max(0, num(spec.distance(lv), 120));
    const aim = p.getAimDir();
    let dx = 0, dy = 0;
    if (aim.x !== 0) dx = aim.x * dist;
    else if (aim.y !== 0) dy = aim.y * dist;
    else dx = p.facing * dist;
    const ox = p.x, oy = p.y;
    playVfx(this.scene, spec.vfxOut, { x: ox, y: oy, facing: p.facing, targetX: ox + dx, targetY: oy + dy, lv });
    p.blink(dx, dy);
    playVfx(this.scene, spec.vfxIn, { x: p.x, y: p.y, facing: p.facing, targetX: ox, targetY: oy, lv });
  }

  // ─────────────────────────── frame / lifecycle ───────────────────────────

  update(time: number, delta: number): void {
    const dt = Math.min(100, Math.max(0, delta));
    try {
      for (const [id, cd] of this.cooldowns) {
        cd.remaining -= dt;
        if (cd.remaining <= 0) this.cooldowns.delete(id);
      }
      this.sched.update(dt);
      this.runner.update(dt);

      if (this.buffs.size > 0) {
        this.ensureAuras();
        const p = this.services.player;
        const expired: string[] = [];
        for (const [id, b] of this.buffs) {
          b.remaining -= dt;
          if (b.remaining <= 0) { expired.push(id); continue; }
          if (goAlive(b.aura)) { setPos(b.aura, p.x, p.y); setFacing(b.aura, p.facing); }
        }
        for (const id of expired) this.endBuff(id);
      }

      for (const sm of [...this.summons.values()]) {
        try { this.updateSummon(sm, dt); } catch (e) { console.error('[skills] summon', e); this.destroySummon(sm.def.id); }
      }
    } catch (e) {
      console.error('[skills] update', e);
    }
  }

  clearWorld(): void {
    this.sched.clear();
    this.runner.clear();
    for (const id of [...this.summons.keys()]) {
      const s = this.summons.get(id);
      destroyGo(s?.go);
      this.summons.delete(id);
    }
    // Buffs persist; their auras are recreated next update (after the new map is loaded).
    for (const b of this.buffs.values()) {
      destroyGo(b.aura);
      b.aura = null;
      b.needsAura = !!b.def.buff?.auraVfx;
    }
  }

  private onPlayerDied() {
    this.sched.clear();
    // In-flight projectiles must not keep killing monsters (EXP/drops) after death.
    this.runner.clear();
    for (const id of [...this.summons.keys()]) this.destroySummon(id);
    const had = this.buffs.size > 0;
    for (const b of this.buffs.values()) destroyGo(b.aura);
    this.buffs.clear();
    if (had) this.buffsChanged();
  }

  /** Debug helper: reset all cooldowns. */
  resetCooldowns(): void { this.cooldowns.clear(); }
}
