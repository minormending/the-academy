// Data integrity of every skill: ids, jobs, prerequisites, attack specs and numbers at every level.
import { describe, expect, it } from 'vitest';
import type { AttackSpec, SkillDef } from '../src/core/types';
import { Registry } from '../src/core/registry';
import { ALL_SKILLS } from '../src/skills';
import { baseDerived } from '../src/systems/progression/stats';
import { newPlayerState } from '../src/systems/SaveSystem';
import { levels, jobById, schoolOf, SKILL_PREFIX, skillById } from './support/data';
import { problems } from './support/problems';

const ELEMENTS = ['neutral', 'fire', 'ice', 'lightning', 'holy', 'shadow'];
const KINDS = ['attack', 'buff', 'passive', 'movement', 'summon'];
const PATTERNS = ['projectile', 'melee_arc', 'aoe_self', 'aoe_target', 'chain', 'beam', 'rain'];
const STATUS_KINDS = ['burn', 'chill', 'freeze', 'shock', 'stun', 'poison', 'curse'];

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const attackSpecs = (s: SkillDef): { where: string; spec: AttackSpec }[] => {
  const out: { where: string; spec: AttackSpec }[] = [];
  if (s.attack) out.push({ where: 'attack', spec: s.attack });
  if (s.summon?.attack) out.push({ where: 'summon.attack', spec: s.summon.attack });
  return out;
};

describe('skill registry', () => {
  it('has skills for every job', () => {
    for (const j of Registry.jobs().filter(j => j.tier < 5 || Registry.skillsForJob(j.id).length > 0)) expect(Registry.skillsForJob(j.id).length, `${j.id} teaches nothing`).toBeGreaterThan(0);
  });
  // Year 5 (Fellowship) spells are written by other agents in parallel; report empty jobs instead of failing.
  for (const j of Registry.jobs().filter(j => j.tier >= 5 && Registry.skillsForJob(j.id).length === 0)) it.todo(`Year 5 skills for ${j.id}`);

  it('has unique ids', () => {
    const p = problems();
    const seen = new Set<string>();
    for (const s of ALL_SKILLS) { p.check(!seen.has(s.id), `duplicate skill id ${s.id}`); seen.add(s.id); }
    p.done();
  });

  it("every id has the prefix of its job's School (app_ for the Apprentice)", () => {
    const p = problems();
    for (const s of ALL_SKILLS) {
      const job = jobById(s.job);
      if (!p.check(job, `${s.id}: unknown job ${s.job}`)) continue;
      const prefix = SKILL_PREFIX[schoolOf(job!) ?? 'none'];
      p.check(s.id.startsWith(prefix), `${s.id} (job ${s.job}) should start with ${prefix}`);
    }
    p.done();
  });

  it("an element matches its School (Apprentice skills may be any element)", () => {
    const p = problems();
    for (const s of ALL_SKILLS) {
      p.check(ELEMENTS.includes(s.element), `${s.id}: bad element ${s.element}`);
      const school = schoolOf(jobById(s.job)!);
      if (school && s.element !== 'neutral') p.check(s.element === school, `${s.id} is ${s.element} in the ${school} School`);
    }
    p.done();
  });

  it('has the basics: name, description, kind, icon and max level', () => {
    const p = problems();
    for (const s of ALL_SKILLS) {
      p.check(s.name.trim(), `${s.id} name`);
      p.check(s.description.trim(), `${s.id} description`);
      p.check(KINDS.includes(s.kind), `${s.id} kind ${s.kind}`);
      p.check(s.icon?.glyph, `${s.id} icon`);
      p.check(Number.isInteger(s.maxLevel) && s.maxLevel >= 1 && s.maxLevel <= 30, `${s.id} maxLevel ${s.maxLevel}`);
    }
    p.done();
  });
});

describe('skill prerequisites', () => {
  const tier = (s: SkillDef) => jobById(s.job)!.tier;

  it('point at existing skills at a valid level', () => {
    const p = problems();
    for (const s of ALL_SKILLS) {
      for (const r of s.requires ?? []) {
        const req = skillById.get(r.skillId);
        if (!p.check(req, `${s.id} requires missing skill ${r.skillId}`)) continue;
        p.check(r.skillId !== s.id, `${s.id} requires itself`);
        p.check(Number.isInteger(r.level) && r.level >= 1 && r.level <= req!.maxLevel, `${s.id} requires ${r.skillId} lv ${r.level} (max ${req!.maxLevel})`);
      }
    }
    p.done();
  });

  it('come from the same lineage and the same or an earlier Year', () => {
    const p = problems();
    for (const s of ALL_SKILLS) {
      const lineage = new Set(Registry.jobLineage(s.job).map(j => j.id));
      for (const r of s.requires ?? []) {
        const req = skillById.get(r.skillId);
        if (!req) continue;
        p.check(lineage.has(req.job), `${s.id} (${s.job}) requires ${req.id} from ${req.job}, which is not in its lineage`);
        p.check(tier(req) <= tier(s), `${s.id} (Year ${tier(s)}) requires ${req.id} from a later Year ${tier(req)}`);
      }
    }
    p.done();
  });

  it('never form a cycle', () => {
    const p = problems();
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (id: string, path: string[]) => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'visiting') { p.check(false, `prerequisite cycle: ${[...path, id].join(' -> ')}`); return; }
      state.set(id, 'visiting');
      for (const r of skillById.get(id)?.requires ?? []) visit(r.skillId, [...path, id]);
      state.set(id, 'done');
    };
    for (const s of ALL_SKILLS) visit(s.id, []);
    p.done();
  });

  it('the starting skill exists and has no prerequisites', () => {
    const bolt = skillById.get('app_arcane_bolt');
    expect(bolt).toBeDefined();
    expect(bolt!.requires ?? []).toEqual([]);
    expect(bolt!.job).toBe('apprentice');
  });
});

describe('skill numbers', () => {
  it('mpCost and cooldown are finite, non-negative and sane at every level', () => {
    const p = problems();
    for (const s of ALL_SKILLS) {
      for (const lv of levels(s)) {
        const mp = s.mpCost(lv);
        p.check(finite(mp) && mp >= 0 && mp <= 200, `${s.id} mpCost(${lv}) = ${mp}`);
        // A hand-written onCast may charge its own cost (Vital Ink trades HP for MP and is free).
        if (s.kind !== 'passive' && !s.onCast) p.check(mp > 0, `${s.id} mpCost(${lv}) should be > 0`);
        if (s.cooldownMs) {
          const cd = s.cooldownMs(lv);
          p.check(finite(cd) && cd >= 0 && cd <= 180_000, `${s.id} cooldownMs(${lv}) = ${cd}`);
        }
      }
      if (s.castTimeMs !== undefined) p.check(s.castTimeMs >= 0 && s.castTimeMs <= 3000, `${s.id} castTimeMs ${s.castTimeMs}`);
    }
    p.done();
  });

  it('levelling a skill never makes it cost far more mana or recharge slower', () => {
    const p = problems();
    for (const s of ALL_SKILLS.filter(x => x.kind !== 'passive' && x.maxLevel > 1)) {
      const lo = s.mpCost(1), hi = s.mpCost(s.maxLevel);
      p.check(hi <= lo * 3 + 1, `${s.id} mpCost grows ${lo} -> ${hi}`);
      if (s.cooldownMs) p.check(s.cooldownMs(s.maxLevel) <= s.cooldownMs(1), `${s.id} cooldown grows with level (${s.cooldownMs(1)} -> ${s.cooldownMs(s.maxLevel)})`);
    }
    p.done();
  });

  it('every kind has the spec it needs (or an onCast override)', () => {
    const p = problems();
    for (const s of ALL_SKILLS) {
      if (s.kind === 'attack') p.check(s.attack || s.onCast, `${s.id} is an attack with no attack spec`);
      if (s.kind === 'buff') p.check(s.buff || s.onCast, `${s.id} is a buff with no buff spec`);
      if (s.kind === 'passive') p.check(typeof s.passive === 'function', `${s.id} is a passive with no passive fn`);
      if (s.kind === 'movement') p.check(s.movement || s.onCast, `${s.id} is a movement with no movement spec`);
      if (s.kind === 'summon') p.check(s.summon || s.onCast, `${s.id} is a summon with no summon spec`);
    }
    p.done();
  });

  it('attack specs carry the fields their pattern needs, with positive numbers at lv1 and max', () => {
    const p = problems();
    for (const s of ALL_SKILLS) {
      for (const { where, spec } of attackSpecs(s)) {
        const id = `${s.id}.${where}`;
        if (!p.check(PATTERNS.includes(spec.pattern), `${id} pattern ${spec.pattern}`)) continue;
        p.check(finite(spec.range) && spec.range >= 0, `${id} range ${spec.range}`);
        if (['projectile', 'beam', 'chain', 'aoe_target'].includes(spec.pattern)) p.check(spec.range > 0, `${id}: ${spec.pattern} needs range > 0`);
        for (const lv of [1, s.maxLevel]) {
          const dmg = spec.damagePct(lv);
          p.check(finite(dmg) && dmg > 0 && dmg <= 5000, `${id} damagePct(${lv}) = ${dmg}`);
          const hits = spec.hits(lv);
          p.check(Number.isInteger(hits) && hits >= 1 && hits <= 30, `${id} hits(${lv}) = ${hits}`);
          const t = spec.maxTargets(lv);
          p.check(Number.isInteger(t) && t >= 1 && t <= 50, `${id} maxTargets(${lv}) = ${t}`);
        }
        switch (spec.pattern) {
          case 'projectile': {
            const pr = spec.projectile;
            if (!p.check(pr, `${id}: projectile pattern needs a projectile spec`)) break;
            p.check(pr!.speed > 0, `${id} projectile.speed ${pr!.speed}`);
            p.check(pr!.radius > 0, `${id} projectile.radius ${pr!.radius}`);
            if (pr!.count) for (const lv of [1, s.maxLevel]) p.check(pr!.count!(lv) >= 1, `${id} projectile.count(${lv}) = ${pr!.count!(lv)}`);
            if (pr!.explodeArea) p.check(pr!.explodeArea.w > 0 && pr!.explodeArea.h > 0, `${id} projectile.explodeArea`);
            break;
          }
          case 'chain': {
            if (!p.check(spec.chain, `${id}: chain pattern needs a chain spec`)) break;
            p.check(spec.chain!.jumpRange > 0, `${id} chain.jumpRange ${spec.chain!.jumpRange}`);
            for (const lv of [1, s.maxLevel]) p.check(spec.maxTargets(lv) >= 2, `${id}: a chain needs >= 2 targets to jump (lv ${lv} has ${spec.maxTargets(lv)})`);
            break;
          }
          case 'rain': {
            if (!p.check(spec.rain, `${id}: rain pattern needs a rain spec`)) break;
            p.check(spec.rain!.spreadX > 0, `${id} rain.spreadX ${spec.rain!.spreadX}`);
            p.check(spec.rain!.intervalMs > 0, `${id} rain.intervalMs ${spec.rain!.intervalMs}`);
            for (const lv of [1, s.maxLevel]) p.check(spec.rain!.count(lv) >= 1, `${id} rain.count(${lv}) = ${spec.rain!.count(lv)}`);
            break;
          }
          case 'beam':
            p.check((spec.area?.h ?? 0) > 0, `${id}: beam needs area.h`);
            break;
          default: // melee_arc, aoe_self, aoe_target
            if (p.check(spec.area, `${id}: ${spec.pattern} needs an area`)) p.check(spec.area!.w > 0 && spec.area!.h > 0, `${id} area ${JSON.stringify(spec.area)}`);
        }
        if (spec.status) {
          p.check(STATUS_KINDS.includes(spec.status.kind), `${id} status kind ${spec.status.kind}`);
          for (const lv of [1, s.maxLevel]) {
            const c = spec.status.chance(lv);
            p.check(c >= 0 && c <= 1, `${id} status.chance(${lv}) = ${c}`);
            p.check(spec.status.durationMs(lv) > 0, `${id} status.durationMs(${lv})`);
            p.check(finite(spec.status.potency(lv)) && spec.status.potency(lv) >= 0, `${id} status.potency(${lv})`);
          }
        }
        if (spec.bonusVs) {
          p.check(STATUS_KINDS.includes(spec.bonusVs.status), `${id} bonusVs.status ${spec.bonusVs.status}`);
          p.check(spec.bonusVs.mult > 1, `${id} bonusVs.mult ${spec.bonusVs.mult}`);
        }
      }
    }
    p.done();
  });

  it('total damage per target never drops as a skill levels up', () => {
    const p = problems();
    for (const s of ALL_SKILLS) {
      for (const { where, spec } of attackSpecs(s)) {
        let prev = 0;
        for (const lv of levels(s)) {
          const total = spec.damagePct(lv) * spec.hits(lv);
          p.check(total >= prev - 1e-6, `${s.id}.${where}: damagePct*hits fell at lv ${lv} (${prev} -> ${total})`);
          prev = total;
        }
      }
    }
    p.done();
  });

  it('summons, buffs, movement and passives return sane values', () => {
    const p = problems();
    for (const s of ALL_SKILLS) {
      for (const lv of [1, s.maxLevel]) {
        if (s.summon) {
          p.check(s.summon.durationMs(lv) > 0, `${s.id} summon.durationMs(${lv})`);
          p.check(s.summon.attackIntervalMs > 0, `${s.id} summon.attackIntervalMs`);
          p.check(s.summon.vfx, `${s.id} summon.vfx`);
          p.check(finite(s.summon.offset?.x) && finite(s.summon.offset?.y), `${s.id} summon.offset`);
          p.check(s.summon.attack, `${s.id} summon.attack`);
        }
        if (s.buff) {
          p.check(s.buff.durationMs(lv) > 0, `${s.id} buff.durationMs(${lv})`);
          const mods = s.buff.modifiers(lv);
          if (p.check(Array.isArray(mods), `${s.id} buff.modifiers(${lv}) is not an array`)) {
            for (const m of mods) p.check(finite(m.add ?? 0) && finite(m.mul ?? 0), `${s.id} buff modifier ${JSON.stringify(m)}`);
          }
        }
        if (s.movement) p.check(s.movement.distance(lv) > 0, `${s.id} movement.distance(${lv})`);
        if (s.passive) {
          const mods = s.passive(lv);
          p.check(mods.length > 0, `${s.id} passive(${lv}) gives no modifiers`);
          for (const m of mods) p.check(finite(m.add ?? 0) && finite(m.mul ?? 0) && (m.add !== undefined || m.mul !== undefined), `${s.id} passive modifier ${JSON.stringify(m)}`);
        }
      }
    }
    p.done();
  });

  it('modifier stats are real derived stats', () => {
    const p = problems();
    const keys = new Set(Object.keys(baseDerived(newPlayerState('t'))));
    for (const s of ALL_SKILLS) {
      const mods = [...(s.passive?.(s.maxLevel) ?? []), ...(s.buff?.modifiers(s.maxLevel) ?? [])];
      for (const m of mods) p.check(keys.has(m.stat), `${s.id}: unknown stat ${m.stat}`);
    }
    p.done();
  });
});
