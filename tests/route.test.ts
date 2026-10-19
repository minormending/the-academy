// Mission routing: BFS over real map portals, and where a mission wants the player to go.
import { describe, expect, it } from 'vitest';
import { Registry } from '../src/core/registry';
import { START_MAP } from '../src/core/constants';
import type { QuestDef } from '../src/core/types';
import { missionTargetMap, nextPortalToward } from '../src/world/route';
import { badgeGrid } from '../src/art/badges';

const mission = (objectives: QuestDef['objectives']): QuestDef =>
  ({ id: 't_m', name: 't', giver: 'elder_maelis', description: '', minLevel: 1, objectives, rewards: {} });

const dist = (a: string, b: string): number => {
  const d = new Map([[a, 0]]); const q = [a];
  while (q.length) {
    const m = q.shift()!;
    for (const p of Registry.map(m)?.portals ?? []) if (!p.hidden && !d.has(p.targetMap)) { d.set(p.targetMap, d.get(m)! + 1); q.push(p.targetMap); }
  }
  return d.get(b) ?? Infinity;
};

describe('nextPortalToward', () => {
  it('every map is reachable from mistvale through non-hidden portals', () => {
    const missing = Registry.maps().filter(m => dist(START_MAP, m.id) === Infinity).map(m => m.id);
    expect(missing, `unreachable from ${START_MAP}`).toEqual([]);
    for (const m of Registry.maps()) {
      if (m.id === START_MAP) continue;
      expect(nextPortalToward(START_MAP, m.id), `${START_MAP} -> ${m.id}`).not.toBeNull();
    }
  });

  it('is null when already there or a map is unknown', () => {
    expect(nextPortalToward('mistvale', 'mistvale')).toBeNull();
    expect(nextPortalToward('mistvale', 'nowhere')).toBeNull();
    expect(nextPortalToward('nowhere', 'mistvale')).toBeNull();
  });

  it('returns a portal that sits on a shortest path', () => {
    const pairs: [string, string][] = [['mistvale', 'whisperwood'], ['mistvale', 'frostfang_cliffs'], ['stormspire_peak', 'mistvale'], ['shroom_hollow', 'glacier_grotto']];
    let checked = 0;
    for (const [a, b] of pairs) {
      if (!Registry.map(a) || !Registry.map(b)) continue;
      const p = nextPortalToward(a, b)!;
      expect(p, `${a} -> ${b}`).not.toBeNull();
      expect(Registry.map(a)!.portals).toContain(p);
      expect(dist(p.targetMap, b)).toBe(dist(a, b) - 1);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(2);
    const first = Registry.map('mistvale')!.portals.find(p => !p.hidden)!;
    expect(nextPortalToward('mistvale', first.targetMap)!.targetMap).toBe(first.targetMap);
  });
});

describe('missionTargetMap', () => {
  it('a visit objective points at that map', () => {
    expect(missionTargetMap(mission([{ kind: 'visit', mapId: 'whisperwood' }]))).toBe('whisperwood');
  });
  it('a kill objective points at the map with the most spawns of that monster', () => {
    const mon = Registry.monsters().find(m => !m.boss && Registry.maps().some(map => map.spawns.some(s => s.monsterId === m.id)))!;
    const totals = Registry.maps().map(map => ({ id: map.id, n: map.spawns.filter(s => s.monsterId === mon.id).reduce((a, s) => a + s.count, 0) }));
    const top = Math.max(...totals.map(t => t.n));
    const target = missionTargetMap(mission([{ kind: 'kill', monsterId: mon.id, count: 5 }]));
    expect(totals.find(t => t.id === target)!.n).toBe(top);
  });
  it('a collect objective points at a map where a dropper of that item spawns', () => {
    const dropper = Registry.monsters().find(m => m.drops.length && Registry.maps().some(map => map.spawns.some(s => s.monsterId === m.id)))!;
    const itemId = dropper.drops[0].itemId;
    const droppers = new Set(Registry.monsters().filter(m => m.drops.some(d => d.itemId === itemId)).map(m => m.id));
    const target = missionTargetMap(mission([{ kind: 'collect', itemId, count: 3 }]))!;
    expect(Registry.map(target)!.spawns.some(s => droppers.has(s.monsterId))).toBe(true);
  });
  it('sends talk goals to the NPC\'s map, and finished missions back to the giver', () => {
    expect(missionTargetMap(mission([{ kind: 'talk', npcId: 'scout_finn' }]))).toBe('whisperwood');
    expect(missionTargetMap(mission([{ kind: 'level', level: 5 }]))).toBe(mapOf('elder_maelis'));
    expect(missionTargetMap(mission([{ kind: 'kill', monsterId: 'no_such_monster', count: 1 }]))).toBe(mapOf('elder_maelis'));
  });
  it('takes the first actionable objective, in order', () => {
    expect(missionTargetMap(mission([{ kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'talk', npcId: 'scout_finn' }]))).toBe('shroom_hollow');
  });
});

function mapOf(npcId: string) { return Registry.maps().find(m => m.npcs.some(n => n.npcId === npcId))?.id ?? null; }

describe('badge art', () => {
  const shapes = ['shield', 'star', 'circle', 'diamond', 'crest'] as const;
  it('shapes differ, ids vary the glyph, dim is a silhouette', () => {
    const g = shapes.map(s => badgeGrid({ id: 'b_x', name: 'x', color: 0x4488ff, shape: s }).join('|'));
    expect(new Set(g).size).toBe(shapes.length);
    const ids = Array.from({ length: 12 }, (_, i) => badgeGrid({ id: `b_${i}`, name: 'x', color: 0x4488ff, shape: 'circle' }).join('|'));
    expect(new Set(ids).size).toBeGreaterThan(4);
    const dim = badgeGrid({ id: 'b_x', name: 'x', color: 0xff0000, shape: 'shield' }, true);
    expect(dim.filter(Boolean).length).toBeGreaterThan(60);
    expect(dim.every(c => !c || !/^#ff/i.test(c))).toBe(true);
  });
});
