// Mission guidance: which portal on the current map leads toward a target map. PLACEHOLDER (BFS stub);
// the world agent owns this file. Keep the signature.
import type { PortalDef } from '../core/types';
import { Registry } from '../core/registry';

/** First portal on `fromMap` on the shortest portal path to `toMap` (null if already there or unreachable). */
export function nextPortalToward(fromMap: string, toMap: string): PortalDef | null {
  if (fromMap === toMap) return null;
  const first = new Map<string, PortalDef>();
  const seen = new Set([fromMap]);
  const queue: string[] = [fromMap];
  while (queue.length) {
    const m = queue.shift()!;
    for (const p of Registry.map(m)?.portals ?? []) {
      if (seen.has(p.targetMap)) continue;
      seen.add(p.targetMap);
      first.set(p.targetMap, m === fromMap ? p : first.get(m)!);
      if (p.targetMap === toMap) return first.get(toMap)!;
      queue.push(p.targetMap);
    }
  }
  return null;
}
