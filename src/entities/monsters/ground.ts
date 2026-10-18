// OWNER: A6 (monsters). Ground/platform lookup helpers shared by monster AI and drops.
import type { IMapInstance, PlatformDef } from '../../core/types';

/** All walkable surfaces of a map: platforms + tops of solid walls. */
function surfaces(map: IMapInstance): PlatformDef[] {
  const out: PlatformDef[] = [];
  try {
    for (const p of map.def.platforms ?? []) out.push(p);
    for (const w of map.def.walls ?? []) out.push({ x1: w.x, x2: w.x + w.w, y: w.y, oneWay: false });
  } catch { /* ignore */ }
  return out;
}

/** Highest surface whose top is at/below y (within `maxBelow`) and spans x. */
export function scanGround(map: IMapInstance, x: number, y: number, maxBelow = 4000, above = 6): PlatformDef | null {
  let best: PlatformDef | null = null;
  for (const p of surfaces(map)) {
    if (x < p.x1 || x > p.x2) continue;
    if (p.y < y - above || p.y > y + maxBelow) continue;
    if (!best || p.y < best.y) best = p;
  }
  return best;
}

/** Platform the entity stands on (prefers the map's own `platformAt`, falls back to a scan). */
export function platformUnder(map: IMapInstance, x: number, y: number, tolerance = 10): PlatformDef | null {
  try {
    const p = map.platformAt(x, y, tolerance);
    if (p && Math.abs(p.y - y) <= tolerance + 4) return p;
  } catch { /* ignore */ }
  return scanGround(map, x, y, tolerance, tolerance);
}

/** Ground y under (x,y) for drops etc; null if nothing below. */
export function groundBelow(map: IMapInstance, x: number, y: number): PlatformDef | null {
  return scanGround(map, x, y, 4000, 8);
}
