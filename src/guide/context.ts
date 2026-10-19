// Everything the handbook renders from, indexed once from the game's own modules (read-only).
// Nothing here is typed by hand: monsters per zone come from the maps' spawn lists, drop sources from the
// monsters' drop tables, shop stock from running the shopkeepers' own dialog scripts, and so on.

import type { GameServices, ItemDef, JobDef, JobId, MapDef, MonsterDef, NpcDef, QuestDef, SkillDef } from '../core/types';
import { Registry } from '../core/registry';
import { bus } from '../core/events';
import { FIELD_BOSSES } from '../data/monsters';
import { NPCS } from '../data/npcs';
import { SCHOOLS, BRANCH_ROOT_JOB, type School } from '../data/jobs';
import { FIELD_BOUNTY_QUEST_IDS, JOB_ADVANCEMENT_QUESTS, JOB_QUEST_IDS } from '../data/quests';
import { STORY_FLOW, STORY_QUESTS, STORY_QUEST_IDS } from '../data/storyQuests';
import { MERIT_SHOP, runNpcScript } from '../data/npcScripts';
import type { Section } from './types';

export interface SpawnInfo { map: string; count: number; respawnMs: number }
export interface DropSource { monster: string; chance: number; min: number; max: number }
export interface ShopEntry { itemId: string; price: number }
export interface ArmoryEntry extends ShopEntry { fromLevel: number }
export interface MeritEntry { itemId: string; qty: number; cost: number; page: 'study' | 'trophies' }

export interface Guide {
  sections: Section[];
  maps: MapDef[];
  /** Maps the walkthrough tours, in play order (the town first, the Fellowship maps after the Sanctum, then the rest). */
  zoneOrder: string[];
  monsters: MonsterDef[];
  items: ItemDef[];
  skills: SkillDef[];
  jobs: JobDef[];
  npcs: NpcDef[];
  quests: QuestDef[];
  /** monster id → maps it spawns on (summed spawn counts). */
  monsterHome: Map<string, SpawnInfo[]>;
  /** map id → monsters that spawn there, in spawn-list order. */
  mapMonsters: Map<string, { monster: string; count: number; respawnMs: number }[]>;
  /** item id → monsters that drop it. */
  dropSources: Map<string, DropSource[]>;
  /** item id → quests that give it as a reward. */
  rewardSources: Map<string, string[]>;
  /** item id → quests that ask for it. */
  wantedBy: Map<string, string[]>;
  /** npc id → where they stand. */
  npcPlace: Map<string, { map: string; x: number }>;
  /** Quartermaster Bram's counter (from his own dialog script). */
  bram: ShopEntry[];
  /** Armorer Tilda's racks, with the level each piece first appears at (from her own dialog script). */
  tilda: ArmoryEntry[];
  merit: MeritEntry[];
  /** Story steps in chain order. */
  story: QuestDef[];
  exams: Record<School, { 3: QuestDef | undefined; 4: QuestDef | undefined; 5: QuestDef | undefined }>;
  bounties: QuestDef[];
  /** Side assignments (not story, not exams, not bounties), by minimum level. */
  assignments: QuestDef[];
}

export const monster = (id: string) => Registry.monster(id);
export const item = (id: string) => Registry.item(id);
export const skill = (id: string) => Registry.skill(id);
export const mapDef = (id: string) => Registry.map(id);
export const npc = (id: string) => Registry.npc(id);
export const quest = (id: string) => Registry.quest(id);
export const job = (id: JobId) => Registry.job(id);

/** The jobs of a School by Year: [Year 2, Year 3, Year 4, Year 5 (the Fellowship Archon)]. */
export function schoolJobs(s: School): JobDef[] {
  const out: JobDef[] = [];
  let j: JobDef | undefined = Registry.job(BRANCH_ROOT_JOB[s]);
  while (j) { out.push(j); j = Registry.jobs().find(x => x.parent === j!.id); }
  return out;
}

export const isBoss = (m: MonsterDef) => !!m.boss;
export const isFieldBoss = (id: string) => Object.prototype.hasOwnProperty.call(FIELD_BOSSES, id);

// ─────────────────────────── shops: ask the shopkeepers ───────────────────────────

/**
 * The shop lists live inside the NPC dialog scripts, so we run the script against a stand-in student and
 * catch the `ui:shop` event the "show me the goods" option emits. What the guide prints is exactly what the
 * game offers.
 */
function probeShop(npcId: string, level: number, jobId: JobId): ShopEntry[] {
  const dialogs: { options: { label: string; action?: () => void }[] }[] = [];
  let shop: ShopEntry[] | null = null;
  const offD = bus.on('ui:dialog', d => { dialogs.push(d); });
  const offS = bus.on('ui:shop', s => { shop = s.items.map(i => ({ itemId: i.itemId, price: i.price })); });
  try {
    const student = {
      state: { name: 'Student', level, job: jobId, quests: {}, hotbar: [], inventory: [], merits: 0, skills: {} },
      jobDef: () => Registry.job(jobId),
      questStatus: () => 'unavailable',
      countItem: () => 0,
    };
    runNpcScript({ progression: student } as unknown as GameServices, npcId);
    const opt = dialogs[0]?.options.find(o => /supplies|counter|armory/i.test(o.label));
    opt?.action?.();
  } catch (e) {
    console.warn(`[guide] could not read ${npcId}'s shop`, e);
  } finally {
    offD(); offS();
  }
  return shop ?? [];
}

function bramStock(): ShopEntry[] {
  return probeShop('merchant_bram', 1, 'apprentice');
}

function tildaStock(): ArmoryEntry[] {
  const first = new Map<string, ArmoryEntry>();
  const jobsToTry: JobId[] = ['apprentice', ...SCHOOLS.map(s => BRANCH_ROOT_JOB[s])];
  for (const j of jobsToTry) {
    for (let lv = 1; lv <= 50; lv++) {
      for (const e of probeShop('smith_tilda', lv, j)) {
        const prev = first.get(e.itemId);
        if (!prev || lv < prev.fromLevel) first.set(e.itemId, { ...e, fromLevel: lv });
      }
    }
  }
  return [...first.values()].sort((a, b) => (item(a.itemId)?.equip?.reqLevel ?? 0) - (item(b.itemId)?.equip?.reqLevel ?? 0) || a.price - b.price);
}

// ─────────────────────────── build ───────────────────────────

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const a = m.get(k);
  if (a) a.push(v); else m.set(k, [v]);
}

function storyChain(): QuestDef[] {
  // Follow the `prev` links from the step with none.
  const byPrev = new Map<string | undefined, string>();
  for (const [id, f] of Object.entries(STORY_FLOW)) byPrev.set(f.prev, id);
  const out: QuestDef[] = [];
  let id = byPrev.get(undefined);
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const q = STORY_QUESTS.find(x => x.id === id);
    if (q) out.push(q);
    id = byPrev.get(id);
  }
  for (const q of STORY_QUESTS) if (!seen.has(q.id)) out.push(q);
  return out;
}

export function buildGuide(sections: Section[]): Guide {
  const maps = Registry.maps();
  const monsters = Registry.monsters();
  const items = Registry.items();
  const quests = Registry.quests();

  const monsterHome = new Map<string, SpawnInfo[]>();
  const mapMonsters = new Map<string, { monster: string; count: number; respawnMs: number }[]>();
  for (const m of maps) {
    const list: { monster: string; count: number; respawnMs: number }[] = [];
    for (const s of m.spawns) {
      const e = list.find(x => x.monster === s.monsterId);
      if (e) e.count += s.count;
      else list.push({ monster: s.monsterId, count: s.count, respawnMs: s.respawnMs ?? 7000 });
    }
    mapMonsters.set(m.id, list);
    for (const e of list) push(monsterHome, e.monster, { map: m.id, count: e.count, respawnMs: e.respawnMs });
  }

  const dropSources = new Map<string, DropSource[]>();
  for (const mon of monsters) {
    for (const d of mon.drops) push(dropSources, d.itemId, { monster: mon.id, chance: d.chance, min: d.min ?? 1, max: d.max ?? d.min ?? 1 });
  }
  for (const list of dropSources.values()) list.sort((a, b) => b.chance - a.chance);

  const rewardSources = new Map<string, string[]>();
  const wantedBy = new Map<string, string[]>();
  for (const q of quests) {
    for (const r of q.rewards.items ?? []) push(rewardSources, r.itemId, q.id);
    for (const o of q.objectives) if (o.kind === 'collect') push(wantedBy, o.itemId, q.id);
  }

  const npcPlace = new Map<string, { map: string; x: number }>();
  for (const m of maps) for (const n of m.npcs) npcPlace.set(n.npcId, { map: m.id, x: n.x });

  const exams = {} as Guide['exams'];
  for (const s of SCHOOLS) {
    const [, y3, y4, y5] = schoolJobs(s);
    exams[s] = {
      3: y3 ? quest(JOB_ADVANCEMENT_QUESTS[y3.id] ?? '') : undefined,
      4: y4 ? quest(JOB_ADVANCEMENT_QUESTS[y4.id] ?? '') : undefined,
      5: y5 ? quest(JOB_ADVANCEMENT_QUESTS[y5.id] ?? '') : undefined,
    };
  }

  const bountySet = new Set(FIELD_BOUNTY_QUEST_IDS);
  const assignments = quests
    .filter(q => !STORY_QUEST_IDS.has(q.id) && !JOB_QUEST_IDS.has(q.id) && !bountySet.has(q.id))
    .sort((a, b) => a.minLevel - b.minLevel);

  // Play order: the campus, then the practicum zones east along the portal chain, then anything else.
  const zoneOrder: string[] = [];
  const town = maps.find(m => m.safe && m.theme === 'town') ?? maps[0];
  for (let cur: MapDef | undefined = town; cur && !zoneOrder.includes(cur.id);) {
    zoneOrder.push(cur.id);
    const east: MapDef | undefined = cur.portals.filter(p => p.id === 'east').map(p => Registry.map(p.targetMap)).find(Boolean);
    cur = east;
  }
  // The Fellowship's endgame maps follow the Arcane Sanctum: Observatory → Rift → Spire along the east portals.
  for (let cur: MapDef | undefined = Registry.map('astral_observatory'); cur && !zoneOrder.includes(cur.id);) {
    zoneOrder.push(cur.id);
    cur = cur.portals.filter(p => p.id === 'east').map(p => Registry.map(p.targetMap)).find(Boolean);
  }
  for (const m of maps) if (!zoneOrder.includes(m.id)) zoneOrder.push(m.id);

  return {
    sections, maps, zoneOrder, monsters, items, quests,
    skills: Registry.skills(),
    jobs: Registry.jobs(),
    npcs: NPCS,
    monsterHome, mapMonsters, dropSources, rewardSources, wantedBy, npcPlace,
    bram: bramStock(),
    tilda: tildaStock(),
    merit: (Object.keys(MERIT_SHOP) as (keyof typeof MERIT_SHOP)[]).flatMap(page => MERIT_SHOP[page].map(o => ({ ...o, page }))),
    story: storyChain(),
    exams,
    bounties: FIELD_BOUNTY_QUEST_IDS.map(id => quest(id)).filter((q): q is QuestDef => !!q),
    assignments,
  };
}
