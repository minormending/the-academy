// Year 5 (the Fellowship) is landing in parallel: monsters, maps and items come from other agents. Data checks
// tolerate these ids until they are registered/spawning, and report them with `it.todo` instead of failing CI.
// Once everything lands, `pendingYear5` returns null for all of them and the checks become strict automatically.
import { Registry } from '../../src/core/registry';

/** Lv 50+ monsters the Fellowship Exams hunt (monsters + maps agents). */
export const YEAR5_MONSTERS = new Set(['star_moth', 'astral_sentinel', 'rift_stalker', 'null_wisp', 'shard_horror']);
/** Year 5 drops the Fellowship Exams collect (items agent, src/data/items5.ts). */
export const YEAR5_ITEMS = new Set(['star_dust']);

/**
 * Why a Year 5 objective target cannot be checked yet, or null when it is ready (or is not a Year 5 id at all).
 * `spawned` = monsters on reachable maps; `dropped` = items some spawned monster drops.
 */
export function pendingYear5(kind: 'kill' | 'collect', id: string, spawned: Set<string>, dropped?: Set<string>): string | null {
  if (kind === 'kill') {
    if (!YEAR5_MONSTERS.has(id)) return null;
    if (!Registry.monster(id)) return `monster ${id} is not registered yet`;
    if (!spawned.has(id)) return `monster ${id} does not spawn on a reachable map yet`;
    return null;
  }
  if (!YEAR5_ITEMS.has(id)) return null;
  if (!Registry.item(id)) return `item ${id} is not registered yet`;
  if (dropped && !dropped.has(id)) return `no reachable monster drops ${id} yet`;
  return null;
}
