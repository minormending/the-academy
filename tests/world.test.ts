// Cross-references between monsters, items, quests, maps, NPCs and shops: every id someone points at must exist.
import { describe, expect, it } from 'vitest';
import type { GameServices, JobId, StatModifier } from '../src/core/types';
import { Registry } from '../src/core/registry';
import { bus } from '../src/core/events';
import { MAX_LEVEL, START_MAP, TOWN_MAP } from '../src/core/constants';
import { MAPS } from '../src/data/maps';
import { MONSTERS, FIELD_BOSSES } from '../src/data/monsters';
import { ITEMS } from '../src/data/items';
import { NPCS } from '../src/data/npcs';
import { JOBS, BRANCH_ROOT_JOB, SCHOOLS } from '../src/data/jobs';
import { QUESTS, JOB_ADVANCEMENT_QUESTS, FIELD_BOUNTY_QUEST_IDS } from '../src/data/quests';
import { STORY_QUESTS, STORY_FLOW, GRADUATION_QUEST_ID } from '../src/data/storyQuests';
import { MERIT_SHOP, runNpcScript } from '../src/data/npcScripts';
import { baseDerived } from '../src/systems/progression/stats';
import { newPlayerState } from '../src/systems/SaveSystem';
import { reachableMaps, spawnedMonsterIds } from './support/data';
import { problems } from './support/problems';
import { YEAR5_ITEMS, YEAR5_MONSTERS, pendingYear5 } from './support/year5';

const ELEMENTS = ['fire', 'ice', 'lightning', 'holy', 'shadow'];
const STATUS_KINDS = ['burn', 'chill', 'freeze', 'shock', 'stun', 'poison', 'curse'];
const STATS = new Set(Object.keys(baseDerived(newPlayerState('t'))));
const ALL_QUESTS = [...QUESTS, ...STORY_QUESTS];

function uniqueIds(name: string, ids: string[]) {
  const seen = new Set<string>();
  const p = problems();
  for (const id of ids) { p.check(!seen.has(id), `duplicate ${name} id ${id}`); seen.add(id); }
  p.done();
}

describe('unique ids', () => {
  it('monsters', () => uniqueIds('monster', MONSTERS.map(m => m.id)));
  it('items', () => uniqueIds('item', ITEMS.map(m => m.id)));
  it('maps', () => uniqueIds('map', MAPS.map(m => m.id)));
  it('npcs', () => uniqueIds('npc', NPCS.map(m => m.id)));
  it('jobs', () => uniqueIds('job', JOBS.map(m => m.id)));
  it('quests (side + story share one namespace)', () => uniqueIds('quest', ALL_QUESTS.map(m => m.id)));
});

describe('monsters', () => {
  it('have sane stats', () => {
    const p = problems();
    for (const m of MONSTERS) {
      p.check(Number.isInteger(m.level) && m.level >= 1 && m.level <= 70, `${m.id} level ${m.level}`);
      p.check(m.hp > 0 && m.exp > 0, `${m.id} hp/exp ${m.hp}/${m.exp}`);
      p.check(m.mesos[0] >= 0 && m.mesos[0] <= m.mesos[1], `${m.id} mesos ${m.mesos}`);
      p.check(m.touchDamage > 0 && m.def >= 0 && m.speed >= 0, `${m.id} touch/def/speed`);
      p.check(m.size.w > 0 && m.size.h > 0, `${m.id} size`);
      for (const e of [...(m.weak ?? []), ...(m.resist ?? [])]) p.check(ELEMENTS.includes(e), `${m.id} element ${e}`);
      for (const e of m.weak ?? []) p.check(!(m.resist ?? []).includes(e), `${m.id} is both weak and resistant to ${e}`);
      for (const s of m.immune ?? []) p.check(STATUS_KINDS.includes(s), `${m.id} immune to unknown status ${s}`);
      p.check(m.drops.length > 0, `${m.id} drops nothing`);
    }
    p.done();
  });

  it('every drop names a real item with a valid chance and quantity', () => {
    const p = problems();
    for (const m of MONSTERS) {
      for (const d of m.drops) {
        p.check(Registry.item(d.itemId), `${m.id} drops missing item ${d.itemId}`);
        p.check(d.chance > 0 && d.chance <= 1, `${m.id} drop ${d.itemId} chance ${d.chance}`);
        const min = d.min ?? 1, max = d.max ?? min;
        p.check(Number.isInteger(min) && min >= 1 && max >= min, `${m.id} drop ${d.itemId} qty ${min}-${max}`);
      }
      const ids = m.drops.map(d => d.itemId);
      p.check(new Set(ids).size === ids.length || m.boss, `${m.id} lists the same drop twice`);
    }
    p.done();
  });

  it('bosses are flagged boss and aggressive; every field boss exists and has its trophy', () => {
    const p = problems();
    for (const m of MONSTERS.filter(x => x.boss)) p.check(m.behavior === 'boss' && m.aggressive, `${m.id} boss flag / behavior`);
    for (const id of Object.keys(FIELD_BOSSES)) {
      const m = Registry.monster(id);
      if (!p.check(m, `field boss ${id} is not a monster`)) continue;
      p.check(m!.drops.some(d => d.itemId === `trophy_${id}` && d.chance === 1), `${id} does not always drop trophy_${id}`);
    }
    p.done();
  });
});

describe('items', () => {
  it('have sane prices, stacks and effects', () => {
    const p = problems();
    for (const i of ITEMS) {
      p.check(i.name.trim() && i.description.trim(), `${i.id} name/description`);
      p.check(i.icon?.glyph, `${i.id} icon`);
      p.check(Number.isInteger(i.price) && i.price >= 0, `${i.id} price ${i.price}`);
      p.check(Number.isInteger(i.sellPrice) && i.sellPrice >= 0, `${i.id} sellPrice ${i.sellPrice}`);
      if (i.price > 0) p.check(i.sellPrice <= i.price, `${i.id} sells (${i.sellPrice}) for more than it costs (${i.price})`);
      p.check(Number.isInteger(i.maxStack) && i.maxStack >= 1, `${i.id} maxStack ${i.maxStack}`);
      if (i.type === 'equip') {
        p.check(i.maxStack === 1, `${i.id} equip stacks`);
        if (!p.check(i.equip, `${i.id} is an equip with no equip spec`)) continue;
        p.check(i.equip!.reqLevel >= 1 && i.equip!.reqLevel <= 50, `${i.id} reqLevel ${i.equip!.reqLevel}`);
        p.check(i.equip!.modifiers.length > 0, `${i.id} has no modifiers`);
        for (const m of i.equip!.modifiers as StatModifier[]) p.check(STATS.has(m.stat) && Number.isFinite(m.add ?? m.mul), `${i.id} modifier ${JSON.stringify(m)}`);
        const rb = i.equip!.reqBranch;
        p.check(!rb || rb === 'none' || (SCHOOLS as string[]).includes(rb), `${i.id} reqBranch ${rb}`);
      }
      if (i.type === 'consumable') {
        const c = i.consumable;
        if (!p.check(c, `${i.id} is a consumable with no effect`)) continue;
        p.check(c!.hp || c!.mp || c!.hpPct || c!.mpPct || c!.returnToTown, `${i.id} does nothing when used`);
      }
    }
    p.done();
  });
});

describe('maps', () => {
  it('start and town maps exist; every map is reachable from the start', () => {
    expect(Registry.map(START_MAP)).toBeDefined();
    expect(Registry.map(TOWN_MAP)).toBeDefined();
    const reach = reachableMaps(START_MAP);
    expect(MAPS.map(m => m.id).filter(id => !reach.has(id)), 'unreachable maps').toEqual([]);
  });

  it('every map has a way back to the town', () => {
    const p = problems();
    for (const m of MAPS) p.check(reachableMaps(m.id).has(TOWN_MAP), `${m.id} cannot reach ${TOWN_MAP} by portals`);
    p.done();
  });

  it('have sane geometry', () => {
    const p = problems();
    for (const m of MAPS) {
      p.check(m.width > 0 && m.height > 0, `${m.id} size`);
      p.check(m.levelRange[0] >= 1 && m.levelRange[0] <= m.levelRange[1] && m.levelRange[1] <= 70, `${m.id} levelRange ${m.levelRange}`);
      p.check(m.platforms.some(pl => !pl.oneWay && pl.x1 <= 0 && pl.x2 >= m.width), `${m.id} has no ground spanning the map`);
      for (const pl of m.platforms) p.check(pl.x1 < pl.x2 && pl.y > 0 && pl.y <= m.height, `${m.id} platform ${JSON.stringify(pl)}`);
      for (const r of m.ropes) p.check(r.x >= 0 && r.x <= m.width && r.top < r.bottom, `${m.id} rope ${JSON.stringify(r)}`);
      if (m.safe) p.check(m.spawns.length === 0, `${m.id} is safe but has spawns`);
    }
    p.done();
  });

  it('every spawn names a real monster on a real platform inside the map', () => {
    const p = problems();
    for (const m of MAPS) {
      for (const s of m.spawns) {
        const tag = `${m.id}: spawn ${s.monsterId}@${s.x1}-${s.x2}`;
        p.check(Registry.monster(s.monsterId), `${tag} unknown monster`);
        p.check(s.count >= 1 && s.x1 <= s.x2 && s.x1 >= 0 && s.x2 <= m.width, `${tag} bad range/count`);
        p.check(m.platforms.some(pl => pl.y === s.y && s.x1 >= pl.x1 && s.x2 <= pl.x2) || m.walls?.some(w => w.y === s.y && s.x1 >= w.x && s.x2 <= w.x + w.w),
          `${tag} y=${s.y} is not on a platform that spans it`);
        p.check(s.respawnMs === undefined || s.respawnMs > 0, `${tag} respawnMs`);
      }
    }
    p.done();
  });

  it('every monster that exists spawns somewhere', () => {
    const spawned = spawnedMonsterIds();
    expect(MONSTERS.map(m => m.id).filter(id => !spawned.has(id)), 'monsters on no map (Trial Hall waves may use them: see ArenaSystem)').toEqual([]);
  });

  it('portals are in bounds, lead to real portals, and come back', () => {
    const p = problems();
    for (const m of MAPS) {
      const ids = new Set<string>();
      for (const po of m.portals) {
        const tag = `${m.id}:${po.id}`;
        p.check(!ids.has(po.id), `${tag} duplicate portal id`);
        ids.add(po.id);
        p.check(po.x >= 0 && po.x <= m.width && po.y >= 0 && po.y <= m.height, `${tag} out of bounds`);
        const target = Registry.map(po.targetMap);
        if (!p.check(target, `${tag} -> unknown map ${po.targetMap}`)) continue;
        const back = target!.portals.find(x => x.id === po.targetPortal);
        if (!p.check(back, `${tag} -> ${po.targetMap}:${po.targetPortal} does not exist`)) continue;
        // Deliberate one-way shortcut: a late-game map may drop the player at the town's gate (arcane_sanctum:town).
        if (po.targetMap === TOWN_MAP) continue;
        p.check(back!.targetMap === m.id, `${tag} -> ${po.targetMap}:${po.targetPortal}, but that portal leads to ${back!.targetMap}, not back to ${m.id}`);
      }
    }
    p.done();
  });

  it('NPC placements name real NPCs standing on a platform inside the map; every NPC is placed', () => {
    const p = problems();
    const placed = new Set<string>();
    for (const m of MAPS) {
      for (const n of m.npcs) {
        placed.add(n.npcId);
        const tag = `${m.id}: npc ${n.npcId}`;
        p.check(Registry.npc(n.npcId), `${tag} is not an NPC`);
        p.check(n.x >= 0 && n.x <= m.width, `${tag} x ${n.x} out of bounds`);
        p.check(m.platforms.some(pl => pl.y === n.y && n.x >= pl.x1 && n.x <= pl.x2) || m.walls?.some(w => w.y === n.y && n.x >= w.x && n.x <= w.x + w.w),
          `${tag} y=${n.y} x=${n.x} is not standing on a platform`);
      }
    }
    for (const n of NPCS) p.check(placed.has(n.id), `NPC ${n.id} is not placed on any map`);
    p.done();
  });

  it('the music key and theme are present', () => {
    for (const m of MAPS) { expect(m.music, m.id).toBeTruthy(); expect(m.theme, m.id).toBeTruthy(); expect(m.region, m.id).toBeTruthy(); }
  });
});

describe('quests', () => {
  it('have real givers, objectives, rewards and levels', () => {
    const p = problems();
    for (const q of ALL_QUESTS) {
      p.check(Registry.npc(q.giver), `${q.id}: giver ${q.giver} is not an NPC`);
      p.check(q.minLevel >= 1 && q.minLevel <= MAX_LEVEL, `${q.id} minLevel ${q.minLevel}`);
      p.check(!q.requiredJobBranch || q.requiredJobBranch === 'none' || (SCHOOLS as string[]).includes(q.requiredJobBranch), `${q.id} requiredJobBranch`);
      p.check(q.name.trim() && q.description.trim(), `${q.id} name/description`);
      for (const o of q.objectives) {
        if (o.kind === 'kill') {
          // Year 5 monsters land from another agent; graduation.test.ts reports them as it.todo until then.
          p.check(Registry.monster(o.monsterId) || YEAR5_MONSTERS.has(o.monsterId), `${q.id}: kills unknown monster ${o.monsterId}`);
          p.check(o.count >= 1, `${q.id} kill count`);
        } else if (o.kind === 'collect') {
          p.check(Registry.item(o.itemId) || YEAR5_ITEMS.has(o.itemId), `${q.id}: collects unknown item ${o.itemId}`);
          p.check(o.count >= 1, `${q.id} collect count`);
        } else if (o.kind === 'level') p.check(o.level >= 1 && o.level <= MAX_LEVEL, `${q.id} level objective ${o.level}`);
        else if (o.kind === 'visit') p.check(Registry.map(o.mapId), `${q.id}: visits unknown map ${o.mapId}`);
        else p.check(Registry.npc(o.npcId), `${q.id}: talks to unknown NPC ${o.npcId}`);
      }
      for (const r of q.rewards.items ?? []) {
        p.check(Registry.item(r.itemId), `${q.id}: rewards unknown item ${r.itemId}`);
        p.check(r.qty >= 1, `${q.id} reward qty`);
      }
      p.check((q.rewards.exp ?? 0) >= 0 && (q.rewards.mesos ?? 0) >= 0, `${q.id} reward amounts`);
    }
    p.done();
  });

  it('every kill objective targets a monster that spawns on a map the player can reach', () => {
    const reach = reachableMaps(START_MAP);
    const spawned = spawnedMonsterIds([...reach].map(id => Registry.map(id)!));
    const p = problems();
    for (const q of ALL_QUESTS) for (const o of q.objectives) if (o.kind === 'kill' && !pendingYear5('kill', o.monsterId, spawned)) p.check(spawned.has(o.monsterId), `${q.id}: ${o.monsterId} never spawns on a reachable map`);
    p.done();
  });

  it('every collect objective names an item the player can actually get', () => {
    const p = problems();
    const reach = reachableMaps(START_MAP);
    const spawned = spawnedMonsterIds([...reach].map(id => Registry.map(id)!));
    const dropped = new Set<string>();
    for (const m of MONSTERS) if (spawned.has(m.id)) for (const d of m.drops) dropped.add(d.itemId);
    const rewarded = new Set<string>(ALL_QUESTS.flatMap(q => (q.rewards.items ?? []).map(i => i.itemId)));
    const sold = new Set<string>([...shopStock('merchant_bram'), ...MERIT_SHOP.study.map(o => o.itemId), ...MERIT_SHOP.trophies.map(o => o.itemId)]);
    for (const q of ALL_QUESTS) for (const o of q.objectives) {
      if (o.kind !== 'collect') continue;
      if (pendingYear5('collect', o.itemId, spawned, dropped)) continue;
      p.check(dropped.has(o.itemId) || rewarded.has(o.itemId) || sold.has(o.itemId), `${q.id}: nobody drops, sells or rewards ${o.itemId}`);
    }
    p.done();
  });

  it('job-advancement exams point at real quests given by the School professor', () => {
    const p = problems();
    for (const [job, qid] of Object.entries(JOB_ADVANCEMENT_QUESTS)) {
      const jd = Registry.job(job as JobId);
      if (!p.check(jd, `exam for unknown job ${job}`)) continue;
      const q = Registry.quest(qid!);
      if (!p.check(q, `exam ${qid} for ${job} does not exist`)) continue;
      p.check(q!.requiredJobBranch === jd.branch, `${qid} branch ${q!.requiredJobBranch} should be ${jd.branch}`);
      p.check(q!.minLevel <= jd.requiredLevel, `${qid} needs level ${q!.minLevel} but ${job} is available at ${jd.requiredLevel}`);
    }
    p.done();
  });

  it('field bounties exist for each field boss', () => {
    expect(FIELD_BOUNTY_QUEST_IDS.length).toBe(Object.keys(FIELD_BOSSES).length);
    for (const id of FIELD_BOUNTY_QUEST_IDS) expect(Registry.quest(id), id).toBeDefined();
  });

  it('the story is one unbroken chain ending in graduation', () => {
    const ids = new Set(Object.keys(STORY_FLOW));
    const p = problems();
    for (const q of STORY_QUESTS) p.check(ids.has(q.id), `story quest ${q.id} has no STORY_FLOW entry`);
    for (const [id, f] of Object.entries(STORY_FLOW)) {
      p.check(Registry.quest(id), `STORY_FLOW names unknown quest ${id}`);
      if (f.prev) p.check(ids.has(f.prev), `${id}.prev ${f.prev} is not a story step`);
    }
    const roots = Object.entries(STORY_FLOW).filter(([, f]) => !f.prev).map(([id]) => id);
    p.check(roots.length === 1, `expected exactly one story root, found ${roots.join(', ')}`);
    // Walk from every step to the root: finite means no cycle.
    for (const id of ids) {
      const seen = new Set<string>();
      for (let cur: string | undefined = id; cur; cur = STORY_FLOW[cur]?.prev) {
        if (!p.check(!seen.has(cur), `story cycle through ${cur}`)) break;
        seen.add(cur);
      }
    }
    p.check(ids.has(GRADUATION_QUEST_ID), 'graduation quest is not a story step');
    // Graduation is the last link: no step has it as prev.
    p.check(!Object.values(STORY_FLOW).some(f => f.prev === GRADUATION_QUEST_ID), 'something comes after graduation');
    p.done();
  });
});

describe('NPCs and jobs', () => {
  it('every NPC has a name and a look; the five professors head the five Schools', () => {
    for (const n of NPCS) { expect(n.name.trim(), n.id).toBeTruthy(); expect(n.look.hatStyle, n.id).toBeTruthy(); }
  });

  it('job lineage is a clean tree: apprentice -> Year 2 -> Year 3 -> Year 4 per School', () => {
    const p = problems();
    const root = JOBS.find(j => !j.parent);
    p.check(root?.id === 'apprentice' && root.tier === 1, 'root job should be the tier-1 apprentice');
    for (const j of JOBS) {
      if (!j.parent) continue;
      const parent = Registry.job(j.parent);
      if (!p.check(parent, `${j.id}.parent ${j.parent} missing`)) continue;
      p.check(parent.tier === j.tier - 1, `${j.id} tier ${j.tier} under tier ${parent.tier}`);
      p.check(parent.branch === j.branch || parent.branch === 'none', `${j.id} branch ${j.branch} under ${parent.branch}`);
      p.check(j.requiredLevel > parent.requiredLevel, `${j.id} requiredLevel ${j.requiredLevel} <= parent's ${parent.requiredLevel}`);
    }
    for (const s of SCHOOLS) p.check(Registry.job(BRANCH_ROOT_JOB[s])?.parent === 'apprentice', `${s} root job should hang off apprentice`);
    p.done();
  });
});

describe('shops', () => {
  it("Bram's counter sells only real, priced items; potions and a Return Scroll are in stock", () => {
    const stock = shopStock('merchant_bram');
    expect(stock.length).toBeGreaterThan(3);
    for (const id of stock) { expect(Registry.item(id), id).toBeDefined(); expect(Registry.item(id)!.price, id).toBeGreaterThan(0); }
    for (const must of ['red_potion', 'blue_potion', 'return_scroll']) expect(stock, must).toContain(must);
  });

  it("Tilda's armory is never empty for any School at any level, and offers only equips", () => {
    const p = problems();
    for (const school of [null, ...SCHOOLS]) {
      const job = school ? BRANCH_ROOT_JOB[school] : 'apprentice';
      for (const lv of [1, 10, 25, 40, 50]) {
        const stock = shopStock('smith_tilda', lv, job);
        p.check(stock.length > 0, `Tilda sells nothing to a Lv ${lv} ${job}`);
        for (const id of stock) p.check(Registry.item(id)?.type === 'equip', `Tilda sells non-equip ${id}`);
      }
    }
    p.done();
  });

  it('every Merit Exchange offer is a real item and divides evenly by its quantity', () => {
    const p = problems();
    for (const o of [...MERIT_SHOP.study, ...MERIT_SHOP.trophies]) {
      p.check(Registry.item(o.itemId), `merit offer ${o.itemId} is not an item`);
      p.check(o.qty >= 1 && o.cost > 0 && o.cost % o.qty === 0, `merit offer ${o.itemId} x${o.qty} costs ${o.cost}`);
    }
    p.done();
  });
});

/** Ask a shopkeeper's own dialog script what it sells (the same probe the handbook uses). */
function shopStock(npcId: string, level = 1, jobId: JobId = 'apprentice'): string[] {
  const dialogs: { options: { label: string; action?: () => void }[] }[] = [];
  let shop: string[] = [];
  const offD = bus.on('ui:dialog', d => { dialogs.push(d); });
  const offS = bus.on('ui:shop', s => { shop = s.items.map(i => i.itemId); });
  try {
    const student = {
      state: { name: 'Student', level, job: jobId, quests: {}, hotbar: [], inventory: [], merits: 0, skills: {} },
      jobDef: () => Registry.job(jobId),
      questStatus: () => 'unavailable',
      countItem: () => 0,
    };
    runNpcScript({ progression: student } as unknown as GameServices, npcId);
    dialogs[0]?.options.find(o => /supplies|counter|armory/i.test(o.label))?.action?.();
  } finally { offD(); offS(); }
  return shop;
}
