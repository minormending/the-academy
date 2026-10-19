// Mission guidance: which portal on the current map leads toward a mission's target map.
import type { PortalDef, QuestDef } from '../core/types';
import { Registry } from '../core/registry';
import { maybeServices } from '../core/services';

/** First portal on `fromMap` on the shortest portal path to `toMap` (null if already there or unreachable). Hidden portals are not routes. */
export function nextPortalToward(fromMap: string, toMap: string): PortalDef | null {
  if (fromMap === toMap || !Registry.map(fromMap)) return null;
  const first = new Map<string, PortalDef>();   // map id -> the portal on `fromMap` that starts the shortest path to it
  const seen = new Set([fromMap]);
  const queue: string[] = [fromMap];
  while (queue.length) {
    const m = queue.shift()!;
    for (const p of Registry.map(m)?.portals ?? []) {
      if (p.hidden || seen.has(p.targetMap) || !Registry.map(p.targetMap)) continue;
      seen.add(p.targetMap);
      first.set(p.targetMap, m === fromMap ? p : first.get(m)!);
      if (p.targetMap === toMap) return first.get(toMap)!;
      queue.push(p.targetMap);
    }
  }
  return null;
}

/** Map with the most spawns of `monsterIds` (null when none spawn anywhere). */
function bestSpawnMap(monsterIds: Set<string>): string | null {
  let best: string | null = null, bestN = 0;
  for (const m of Registry.maps()) {
    let n = 0;
    for (const s of m.spawns) if (monsterIds.has(s.monsterId)) n += s.count;
    if (n > bestN) { best = m.id; bestN = n; }
  }
  return best;
}

/**
 * Where to go for a mission: the map of its first unfinished `visit` objective; otherwise the map with the most
 * spawns of the first unfinished kill/collect target (collect = monsters whose drops include the item); else null.
 */
export function missionTargetMap(mission: QuestDef): string | null {
  const prog = maybeServices()?.progression;
  const counts = prog?.state?.quests?.[mission.id]?.counts ?? [];
  const bag = (itemId: string) => { try { return prog?.countItem(itemId) ?? 0; } catch { return 0; } };
  for (let i = 0; i < mission.objectives.length; i++) {
    const o = mission.objectives[i];
    const have = counts[i] ?? 0;
    if (o.kind === 'visit') {
      if (have < 1 && Registry.map(o.mapId)) return o.mapId;
    } else if (o.kind === 'kill') {
      if (have >= o.count) continue;
      const m = bestSpawnMap(new Set([o.monsterId]));
      if (m) return m;
    } else if (o.kind === 'collect') {
      if (Math.max(have, bag(o.itemId)) >= o.count) continue;
      const droppers = new Set(Registry.monsters().filter(mo => mo.drops.some(d => d.itemId === o.itemId)).map(mo => mo.id));
      const m = bestSpawnMap(droppers);
      if (m) return m;
    } else if (o.kind === 'talk') {
      if (have >= 1) continue;
      const m = npcMap(o.npcId);
      if (m) return m;
    }
  }
  // Every goal met: head back to whoever hands the mission in.
  return npcMap(mission.giver);
}

/** The map an NPC stands on (null if they aren't placed anywhere). */
function npcMap(npcId: string): string | null {
  return Registry.maps().find(m => m.npcs.some(n => n.npcId === npcId))?.id ?? null;
}
