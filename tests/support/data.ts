// Shared lookups for the data-integrity tests. Everything is read from the game's own modules.
import type { DropEntry, JobDef, MonsterDef, SkillDef } from '../../src/core/types';
import { Registry } from '../../src/core/registry';
import { ALL_SKILLS } from '../../src/skills';
import { SCHOOLS, isSchool, type School } from '../../src/data/jobs';

export const SKILL_PREFIX: Record<School | 'none', string> = {
  none: 'app_', fire: 'fire_', ice: 'ice_', lightning: 'ltn_', holy: 'holy_', shadow: 'shd_',
};

/** Every integer level 1..max of a skill. */
export const levels = (s: SkillDef): number[] => Array.from({ length: s.maxLevel }, (_, i) => i + 1);

export const skillById = new Map(ALL_SKILLS.map(s => [s.id, s]));
export const jobById = (id: string): JobDef | undefined => Registry.jobs().find(j => j.id === id);

export function schoolOf(job: JobDef): School | null { return isSchool(job.branch) ? job.branch : null; }

/** Tier-2..4 jobs of a School, in Year order. */
export function lineageOf(school: School): JobDef[] {
  return Registry.jobs().filter(j => j.branch === school).sort((a, b) => a.tier - b.tier);
}

/** Maps reachable from the start map by walking portals (the player can use any non-hidden or hidden portal). */
export function reachableMaps(start: string): Set<string> {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const m = Registry.map(queue.shift()!);
    for (const p of m?.portals ?? []) {
      if (!seen.has(p.targetMap) && Registry.map(p.targetMap)) { seen.add(p.targetMap); queue.push(p.targetMap); }
    }
  }
  return seen;
}

/** Monsters that spawn somewhere on a map (field bosses and the Lich Archon included). */
export function spawnedMonsterIds(maps = Registry.maps()): Set<string> {
  const out = new Set<string>();
  for (const m of maps) for (const s of m.spawns) out.add(s.monsterId);
  return out;
}

export function monstersDropping(itemId: string, among?: Set<string>): { monster: MonsterDef; drop: DropEntry }[] {
  const out: { monster: MonsterDef; drop: DropEntry }[] = [];
  for (const monster of Registry.monsters()) {
    if (among && !among.has(monster.id)) continue;
    for (const drop of monster.drops) if (drop.itemId === itemId && drop.chance > 0) out.push({ monster, drop });
  }
  return out;
}

export { SCHOOLS };
