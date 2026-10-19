// Pure chart data for the developer docs, computed from the game's own
// modules: the balance curves, skill, monster, map, job and item definitions,
// and the derived-stat formulas. The modules that need Phaser (skills, stats,
// saves) are passed in by charts/index.ts, which loads them lazily.

import {
  expToNext, killsPerLevel, refHit, refMatk, refMonsterExp, refMonsterHp, refMonsterTouch, refPlayerHp, refPlayerMp, refSkillPct,
} from "../../core/balance";
import type {
  AttackPattern, AttackSpec, DerivedStats, EquipSlot, ItemDef, JobDef, MapDef, MonsterDef, PlayerState, SkillDef, SkillKind, StatusKind,
} from "../../core/types";
import type { SourceStats } from "./sourceStats";

// ---- Years and Schools --------------------------------------------------------

export interface YearBand { year: number; from: number; to: number }

/** Level ranges of the four school Years from JOB_LEVELS (Year n starts at the tier-n job level). */
export function yearBands(jobLevels: Record<1 | 2 | 3 | 4, number>, maxLevel: number): YearBand[] {
  const starts = [jobLevels[1], jobLevels[2], jobLevels[3], jobLevels[4]];
  return starts.map((from, i) => ({ year: i + 1, from, to: i < 3 ? starts[i + 1] - 1 : maxLevel }));
}

/** "core" (Year 1, every student) or a School id. */
export type Group = "core" | "fire" | "ice" | "lightning" | "holy" | "shadow";
export const GROUPS: Group[] = ["core", "fire", "ice", "lightning", "holy", "shadow"];
export const GROUP_NAME: Record<Group, string> = { core: "Core (Year 1)", fire: "Fire", ice: "Ice", lightning: "Lightning", holy: "Holy", shadow: "Shadow" };
/** Series index (1-based) for School colours in charts (`ss-N` classes). */
export const GROUP_SERIES: Record<Group, number> = { core: 1, fire: 2, ice: 3, lightning: 4, holy: 5, shadow: 6 };

function skillPlace(sk: SkillDef, jobs: Map<string, JobDef>): { group: Group; year: number } | null {
  const job = jobs.get(sk.job);
  if (!job) return null;
  const group: Group = job.branch === "none" ? "core" : (job.branch as Group);
  return { group, year: job.tier };
}

// ---- exp-curve ------------------------------------------------------------------

export interface ExpPoint { level: number; toNext: number; kills: number; monsterExp: number; total: number }

/** EXP to the next level for levels 1 … maxLevel − 1, with the intended same-level kills per level. */
export function expCurve(maxLevel: number): ExpPoint[] {
  const out: ExpPoint[] = [];
  let total = 0;
  for (let level = 1; level < maxLevel; level++) {
    const toNext = expToNext(level);
    total += toNext;
    out.push({ level, toNext, kills: killsPerLevel(level), monsterExp: refMonsterExp(level), total });
  }
  return out;
}

// ---- matk-curve -----------------------------------------------------------------

export interface MatkPoint {
  level: number;
  /** refMatk(level): what content is tuned against. */
  ref: number;
  /** computeDerived().matk with no gear, no passives, no buffs. */
  base: number;
  /** The same plus the best buyable gear for that level. */
  geared: number;
  int: number;
  luk: number;
  gear: string[];
  refPct: number;
  refHit: number;
}

/**
 * The same rule as Progression.autoAllocateAp (the Character window's Auto button): raise LUK whenever
 * 4 × (LUK gained) < (INT gained), otherwise INT, one point at a time — about 4 INT : 1 LUK.
 */
export function autoAllocate(base: { int: number; luk: number }, start: { int: number; luk: number }, ap: number): { int: number; luk: number } {
  let { int, luk } = base;
  for (let i = 0; i < ap; i++) {
    if ((luk - start.luk) * 4 < int - start.int) luk += 1; else int += 1;
  }
  return { int, luk };
}

/** Best matk-adding equip per slot with reqLevel ≤ level that a shop sells (price > 0). Branch-locked staffs count: every School has one. */
export function bestBuyableGear(items: readonly ItemDef[], level: number): ItemDef[] {
  const best = new Map<EquipSlot, { item: ItemDef; matk: number }>();
  for (const it of items) {
    if (!it.equip || it.price <= 0 || it.equip.reqLevel > level) continue;
    const matk = it.equip.modifiers.reduce((a, m) => a + (m.stat === "matk" ? m.add ?? 0 : 0), 0);
    if (matk <= 0) continue;
    const cur = best.get(it.equip.slot);
    if (!cur || matk > cur.matk || (matk === cur.matk && it.equip.reqLevel > (cur.item.equip?.reqLevel ?? 0))) best.set(it.equip.slot, { item: it, matk });
  }
  return [...best.values()].map((b) => b.item);
}

export function matkCurve(p: {
  maxLevel: number;
  apPerLevel: number;
  start: PlayerState;
  items: readonly ItemDef[];
  derive: (s: PlayerState) => DerivedStats;
}): MatkPoint[] {
  const out: MatkPoint[] = [];
  const s0 = p.start.base;
  for (let level = 1; level <= p.maxLevel; level++) {
    const { int, luk } = autoAllocate({ int: s0.int, luk: s0.luk }, { int: s0.int, luk: s0.luk }, (level - 1) * p.apPerLevel);
    const naked: PlayerState = { ...p.start, level, base: { ...s0, int, luk }, skills: {}, equipment: {} };
    const gear = bestBuyableGear(p.items, level);
    const equipment: PlayerState["equipment"] = {};
    for (const g of gear) equipment[g.equip!.slot] = { uid: `doc-${g.id}`, itemId: g.id, qty: 1 };
    out.push({
      level, ref: refMatk(level), base: p.derive(naked).matk, geared: p.derive({ ...naked, equipment }).matk,
      int, luk, gear: gear.map((g) => g.name), refPct: refSkillPct(level), refHit: refHit(level),
    });
  }
  return out;
}

// ---- hp-curves ------------------------------------------------------------------

export interface HpPoint { level: number; playerHp: number; playerMp: number; monsterHp: number; touch: number; hitsToDie: number; castsToKill: number }

export function hpCurves(maxLevel: number): HpPoint[] {
  const out: HpPoint[] = [];
  for (let level = 1; level <= maxLevel; level++) {
    const playerHp = refPlayerHp(level), touch = refMonsterTouch(level), monsterHp = refMonsterHp(level);
    out.push({
      level, playerHp, playerMp: refPlayerMp(level), monsterHp, touch,
      hitsToDie: Math.ceil(playerHp / touch), castsToKill: Math.round((monsterHp / refHit(level)) * 10) / 10,
    });
  }
  return out;
}

// ---- spells-by-year -------------------------------------------------------------

export const KINDS: SkillKind[] = ["attack", "buff", "passive", "movement", "summon"];

export interface YearRow { group: Group; year: number; label: string; counts: Record<SkillKind, number>; skills: Record<SkillKind, string[]> }

export function spellsByYear(skills: readonly SkillDef[], jobs: readonly JobDef[]): YearRow[] {
  const byId = new Map(jobs.map((j) => [j.id as string, j]));
  const rows = new Map<string, YearRow>();
  const empty = () => Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<SkillKind, number>;
  const emptyL = () => Object.fromEntries(KINDS.map((k) => [k, [] as string[]])) as Record<SkillKind, string[]>;
  for (const g of GROUPS) {
    const years = g === "core" ? [1] : [2, 3, 4];
    for (const y of years) rows.set(`${g}:${y}`, { group: g, year: y, label: g === "core" ? "Year 1 · Core" : `${GROUP_NAME[g]} · Year ${y}`, counts: empty(), skills: emptyL() });
  }
  for (const sk of skills) {
    const at = skillPlace(sk, byId);
    const row = at && rows.get(`${at.group}:${at.year}`);
    if (!row) continue;
    row.counts[sk.kind]++;
    row.skills[sk.kind].push(sk.name);
  }
  return [...rows.values()];
}

// ---- prose numbers (data-stat) --------------------------------------------------------

/** Numbers the section prose can pull from the game's data: `<span data-stat="spells">174</span>` (names in names.ts). */
export function spellStats(skills: readonly SkillDef[], jobs: readonly JobDef[]): Record<string, number> {
  const rows = spellsByYear(skills, jobs);
  const total = (r: YearRow) => KINDS.reduce((a, k) => a + r.counts[k], 0);
  const schools = GROUPS.filter((g) => g !== "core");
  const perYear = (y: number) => schools.map((g) => total(rows.find((r) => r.group === g && r.year === y)!));
  // Every School has the same shape; if one ever differs the prose is wrong for it, so report the largest.
  const most = (xs: number[]) => Math.max(...xs);
  const byId = new Map(jobs.map((j) => [j.id as string, j]));
  const levels = new Map<Group, number>(GROUPS.map((g) => [g, 0]));
  for (const sk of skills) {
    const at = skillPlace(sk, byId);
    if (at) levels.set(at.group, levels.get(at.group)! + sk.maxLevel);
  }
  // Arcane Bolt's first level is free (newPlayerState), so it is not purchasable.
  const lineage = schools.map((g) => levels.get("core")! - 1 + levels.get(g)!);
  const perSchool = schools.map((_, i) => perYear(2)[i] + perYear(3)[i] + perYear(4)[i]);
  return {
    spells: skills.length,
    "spells-core": total(rows.find((r) => r.group === "core")!),
    "spells-school": most(perSchool),
    "spells-y2": most(perYear(2)),
    "spells-y3": most(perYear(3)),
    "spells-y4": most(perYear(4)),
    "levels-min": Math.min(...lineage),
    "levels-max": Math.max(...lineage),
  };
}

// ---- school-budgets ---------------------------------------------------------------

export interface BudgetPoint {
  id: string;
  name: string;
  group: Group;
  year: number;
  kind: "attack" | "summon";
  pattern: AttackPattern;
  maxLevel: number;
  /** damagePct(max) × hits(max): % of matk landed on one target by one cast (summons: over their whole duration). */
  pct: number;
  damagePct: number;
  hits: number;
  maxTargets: number;
  /** Projectiles per cast or rain impacts per cast, when the pattern has them. */
  count: number;
  cooldownMs: number;
  mp: number;
  /** Summons only: attacks over the summon's duration. */
  attacks: number;
}

const safe = (f: ((lv: number) => number) | undefined, lv: number, d = 0) => {
  try { const v = f ? f(lv) : d; return Number.isFinite(v) ? v : d; } catch { return d; }
};

function countOf(a: AttackSpec, lv: number): number {
  if (a.pattern === "rain") return safe(a.rain?.count, lv, 1);
  if (a.pattern === "projectile") return safe(a.projectile?.count, lv, 1);
  return 1;
}

export function schoolBudgets(skills: readonly SkillDef[], jobs: readonly JobDef[]): { points: BudgetPoint[]; onCastOnly: string[] } {
  const byId = new Map(jobs.map((j) => [j.id as string, j]));
  const points: BudgetPoint[] = [];
  const onCastOnly: string[] = [];
  for (const sk of skills) {
    const at = skillPlace(sk, byId);
    if (!at) continue;
    const lv = sk.maxLevel;
    const base = { id: sk.id, name: sk.name, group: at.group, year: at.year, maxLevel: lv, cooldownMs: safe(sk.cooldownMs, lv), mp: safe(sk.mpCost, lv) };
    if (sk.attack) {
      const a = sk.attack;
      const damagePct = safe(a.damagePct, lv), hits = safe(a.hits, lv, 1);
      points.push({ ...base, kind: "attack", pattern: a.pattern, pct: damagePct * hits, damagePct, hits, maxTargets: safe(a.maxTargets, lv, 1), count: countOf(a, lv), attacks: 1 });
    } else if (sk.summon) {
      const a = sk.summon.attack;
      const damagePct = safe(a.damagePct, lv), hits = safe(a.hits, lv, 1);
      const attacks = Math.max(1, Math.floor(safe(sk.summon.durationMs, lv) / Math.max(1, sk.summon.attackIntervalMs)));
      points.push({ ...base, kind: "summon", pattern: a.pattern, pct: damagePct * hits * attacks, damagePct, hits, maxTargets: safe(a.maxTargets, lv, 1), count: countOf(a, lv), attacks });
    } else if (sk.kind === "attack") {
      onCastOnly.push(sk.name);
    }
  }
  return { points: points.filter((p) => p.pct > 0), onCastOnly };
}

// ---- attack-patterns, status-mix ----------------------------------------------------

export const PATTERNS: AttackPattern[] = ["projectile", "melee_arc", "aoe_self", "aoe_target", "chain", "beam", "rain"];
export const STATUSES: StatusKind[] = ["burn", "chill", "freeze", "shock", "stun", "poison", "curse"];

export interface StackRow<K extends string> { key: K; counts: Record<Group, number>; skills: Record<Group, string[]> }

function attacksOf(sk: SkillDef): AttackSpec[] {
  return [sk.attack, sk.summon?.attack].filter((a): a is AttackSpec => !!a);
}

function stackBy<K extends string>(skills: readonly SkillDef[], jobs: readonly JobDef[], keys: readonly K[], keyOf: (a: AttackSpec) => K | undefined): StackRow<K>[] {
  const byId = new Map(jobs.map((j) => [j.id as string, j]));
  const rows = keys.map((key) => ({
    key,
    counts: Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>,
    skills: Object.fromEntries(GROUPS.map((g) => [g, [] as string[]])) as Record<Group, string[]>,
  }));
  for (const sk of skills) {
    const at = skillPlace(sk, byId);
    if (!at) continue;
    const seen = new Set<K>();
    for (const a of attacksOf(sk)) {
      const k = keyOf(a);
      if (k === undefined || seen.has(k)) continue;
      seen.add(k);
      const row = rows.find((r) => r.key === k);
      if (!row) continue;
      row.counts[at.group]++;
      row.skills[at.group].push(sk.name);
    }
  }
  return rows;
}

/** Spells (attacks and summons' attacks) by attack pattern, per School. */
export const attackPatterns = (skills: readonly SkillDef[], jobs: readonly JobDef[]) => stackBy(skills, jobs, PATTERNS, (a) => a.pattern);
/** Spells that can apply each status, per School. */
export const statusMix = (skills: readonly SkillDef[], jobs: readonly JobDef[]) => stackBy(skills, jobs, STATUSES, (a) => a.status?.kind);

// ---- monster-levels, monster-hp ----------------------------------------------------

export type MonsterRole = "normal" | "field" | "final";

export interface ZoneRow { mapId: string; name: string; range: [number, number]; monsters: { id: string; name: string; level: number; role: MonsterRole; hp: number; exp: number; count: number; weak: string[]; resist: string[] }[] }

export function monsterRole(m: MonsterDef, fieldBossIds: ReadonlySet<string>): MonsterRole {
  return fieldBossIds.has(m.id) ? "field" : m.boss ? "final" : "normal";
}

/** Every map with spawns, in MAPS order, with the monsters that spawn there. */
export function monsterLevels(maps: readonly MapDef[], monsters: readonly MonsterDef[], fieldBossIds: ReadonlySet<string>): ZoneRow[] {
  const byId = new Map(monsters.map((m) => [m.id, m]));
  return maps.filter((m) => m.spawns.length).map((map) => {
    const seen = new Map<string, ZoneRow["monsters"][number]>();
    for (const sp of map.spawns) {
      const def = byId.get(sp.monsterId);
      if (!def) continue;
      const cur = seen.get(def.id);
      if (cur) { cur.count += sp.count; continue; }
      seen.set(def.id, { id: def.id, name: def.name, level: def.level, role: monsterRole(def, fieldBossIds), hp: def.hp, exp: def.exp, count: sp.count, weak: def.weak ?? [], resist: def.resist ?? [] });
    }
    return { mapId: map.id, name: map.name, range: map.levelRange, monsters: [...seen.values()].sort((a, b) => a.level - b.level) };
  });
}

export interface HpDot { id: string; name: string; level: number; hp: number; ref: number; mul: number; role: MonsterRole; exp: number; touch: number }

export function monsterHp(monsters: readonly MonsterDef[], fieldBossIds: ReadonlySet<string>): HpDot[] {
  return monsters.map((m) => {
    const ref = refMonsterHp(m.level);
    return { id: m.id, name: m.name, level: m.level, hp: m.hp, ref, mul: Math.round((m.hp / ref) * 100) / 100, role: monsterRole(m, fieldBossIds), exp: m.exp, touch: m.touchDamage };
  }).sort((a, b) => a.level - b.level || a.hp - b.hp);
}

// ---- map-graph ------------------------------------------------------------------

export interface MapNode { id: string; name: string; region: string; theme: string; range: [number, number]; safe: boolean; width: number; height: number; monsters: string[]; npcs: number; portals: number;
  /** A boss spawns here, or it spawns nothing but is not a town (the Trial Hall arena). */ arena: boolean }
export interface MapEdge { a: string; b: string; portals: string[]; oneWay: boolean }

/** Nodes in MAPS order; one edge per pair of maps joined by portals (both directions merged). */
export function mapGraph(maps: readonly MapDef[], monsters: readonly MonsterDef[]): { nodes: MapNode[]; edges: MapEdge[] } {
  const names = new Map(monsters.map((m) => [m.id, m.name]));
  const bosses = new Set(monsters.filter((m) => m.boss).map((m) => m.id));
  const nodes: MapNode[] = maps.map((m) => ({
    id: m.id, name: m.name, region: m.region, theme: m.theme, range: m.levelRange, safe: !!m.safe, width: m.width, height: m.height,
    monsters: [...new Set(m.spawns.map((s) => names.get(s.monsterId) ?? s.monsterId))], npcs: m.npcs.length, portals: m.portals.length,
    arena: !m.safe && (m.spawns.length === 0 || m.spawns.some((s) => bosses.has(s.monsterId))),
  }));
  const edges = new Map<string, MapEdge>();
  for (const m of maps) {
    for (const p of m.portals) {
      const [a, b] = m.id < p.targetMap ? [m.id, p.targetMap] : [p.targetMap, m.id];
      const key = `${a}|${b}`;
      const e = edges.get(key) ?? { a, b, portals: [], oneWay: true };
      e.portals.push(`${m.id}:${p.id} → ${p.targetMap}:${p.targetPortal}`);
      const back = maps.find((x) => x.id === p.targetMap)?.portals.some((q) => q.targetMap === m.id);
      if (back) e.oneWay = false;
      edges.set(key, e);
    }
  }
  return { nodes, edges: [...edges.values()] };
}

export interface MapPlaced { id: string; x: number; y: number }

/**
 * Deterministic layout: the longest portal path from `start` runs left to right along the top row; every
 * other map hangs below the first map on that path it connects to.
 */
export function layoutMapGraph(g: { nodes: MapNode[]; edges: MapEdge[] }, start: string, colW: number, rowH: number): { placed: MapPlaced[]; cols: number; rows: number } {
  const adj = new Map<string, string[]>(g.nodes.map((n) => [n.id, []]));
  for (const e of g.edges) { adj.get(e.a)?.push(e.b); adj.get(e.b)?.push(e.a); }
  const order = g.nodes.map((n) => n.id);
  for (const list of adj.values()) list.sort((x, y) => order.indexOf(x) - order.indexOf(y));
  let best: string[] = [start];
  const walk = (path: string[]) => {
    if (path.length > best.length) best = [...path];
    for (const n of adj.get(path[path.length - 1]) ?? []) if (!path.includes(n)) walk([...path, n]);
  };
  if (adj.has(start)) walk([start]);
  const placed = new Map<string, MapPlaced>();
  best.forEach((id, i) => placed.set(id, { id, x: i * colW, y: 0 }));
  const below = new Map<number, number>();
  for (const id of order) {
    if (placed.has(id)) continue;
    const anchor = best.findIndex((p) => adj.get(p)?.includes(id));
    const col = anchor >= 0 ? anchor : best.length + placed.size;
    const depth = (below.get(col) ?? 0) + 1;
    below.set(col, depth);
    placed.set(id, { id, x: col * colW, y: depth * rowH });
  }
  const all = [...placed.values()];
  return { placed: all, cols: Math.max(...all.map((p) => p.x / colW)) + 1, rows: Math.max(...all.map((p) => p.y / rowH)) + 1 };
}

// ---- module-graph -----------------------------------------------------------------

export interface ImportPair { from: string; to: string }
export interface ModuleNode { id: string; files: number; lines: number; layer: number; col: number }

/**
 * Layers: a folder sits one layer above the highest folder it imports. Cycles are broken weakest-first
 * (the import with the fewest statements is dropped from the layering and drawn as an upward edge).
 */
export function layoutModuleGraph(stats: SourceStats, minCols = 5): { nodes: ModuleNode[]; layers: string[][]; back: ImportPair[]; cols: number } {
  const names = stats.folders.map((f) => f.folder).sort();
  const known = new Set(names);
  const dag = new Map<string, string[]>(names.map((n) => [n, []]));
  const reaches = (from: string, to: string): boolean => {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length) {
      const n = stack.pop()!;
      if (n === to) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      stack.push(...dag.get(n)!);
    }
    return false;
  };
  const back: ImportPair[] = [];
  const edges = stats.edges.filter((e) => known.has(e.from) && known.has(e.to))
    .sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  for (const e of edges) {
    if (reaches(e.to, e.from)) back.push({ from: e.from, to: e.to });
    else dag.get(e.from)!.push(e.to);
  }
  const layer = new Map<string, number>();
  const depth = (n: string): number => {
    const k = layer.get(n);
    if (k !== undefined) return k;
    const d = dag.get(n)!.length ? 1 + Math.max(...dag.get(n)!.map(depth)) : 0;
    layer.set(n, d);
    return d;
  };
  names.forEach(depth);
  const max = Math.max(0, ...layer.values());
  const layers: string[][] = Array.from({ length: max + 1 }, () => []);
  for (const n of names) layers[layer.get(n)!].push(n);
  // Columns: near what a folder imports, but off the columns used by the layers just below,
  // so long edges don't run straight through nodes.
  const col = new Map<string, number>();
  const cols = Math.max(minCols, ...layers.map((l) => l.length));
  const centre = (cols - 1) / 2;
  for (let l = 0; l <= max; l++) {
    const near = [1, 0.6, 0.3].map((wgt, k) => ({ wgt, used: new Set(l - 1 - k >= 0 ? layers[l - 1 - k].map((n) => col.get(n)!) : []) }));
    const used = new Set<number>();
    for (const n of layers[l]) {
      const deps = dag.get(n)!.filter((d) => col.has(d));
      const target = deps.length ? deps.reduce((a, d) => a + col.get(d)!, 0) / deps.length : centre;
      let best = -1, bestCost = Infinity;
      for (let c = 0; c < cols; c++) {
        if (used.has(c)) continue;
        const cost = 0.25 * Math.abs(c - target) + near.reduce((a, b) => a + (b.used.has(c) ? b.wgt : 0), 0) + Math.abs(c - centre) * 0.01;
        if (cost < bestCost - 1e-9) { best = c; bestCost = cost; }
      }
      used.add(best);
      col.set(n, best);
    }
  }
  const byName = new Map(stats.folders.map((f) => [f.folder, f]));
  return {
    nodes: names.map((n) => ({ id: n, files: byName.get(n)!.files, lines: byName.get(n)!.lines, layer: layer.get(n)!, col: col.get(n)! })),
    layers, back, cols,
  };
}

// ---- content-counts -------------------------------------------------------------------

export interface Count { label: string; value: number }

export function contentCounts(c: { skills: number; monsters: number; fieldBosses: number; maps: number; items: number; quests: number; npcs: number; jobs: number }, stats: SourceStats): { content: Count[]; lines: Count[] } {
  return {
    content: [
      { label: "Spells", value: c.skills },
      { label: "Items", value: c.items },
      { label: "Quests", value: c.quests },
      { label: "Monsters", value: c.monsters },
      { label: "Jobs", value: c.jobs },
      { label: "NPCs", value: c.npcs },
      { label: "Maps", value: c.maps },
      { label: "Field bosses", value: c.fieldBosses },
    ],
    lines: [...stats.folders].sort((a, b) => b.lines - a.lines).map((f) => ({ label: f.folder === "main" ? "main.ts" : `${f.folder}/`, value: f.lines })),
  };
}
