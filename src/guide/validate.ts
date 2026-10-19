// Checks the walkthrough and builds against the game's data. Runs in the page (the project has no test runner):
// in dev every problem is logged and shown in a banner at the top; production builds stay quiet.
//
// - every block names a map, quest, monster, NPC or School that exists
// - section ids are unique and well formed, text blocks aren't empty
// - every zone with monsters gets a zone panel, every field boss and the Lich a boss card, every story step a card
// - every build fits its SP budget and respects every prerequisite

import { Registry } from '../core/registry';
import { isSchool } from '../data/jobs';
import { STORY_QUESTS } from '../data/storyQuests';
import { BUILDS, checkBuild } from './builds';
import type { Guide } from './context';
import type { Block, Section } from './types';

function blockProblems(b: Block): string[] {
  const p: string[] = [];
  if ('p' in b && !b.p.trim()) p.push('empty paragraph');
  if ('tip' in b && !b.tip.trim()) p.push('empty tip');
  if ('list' in b && !b.list.length) p.push('empty list');
  if ('zone' in b && !Registry.map(b.zone)) p.push(`unknown map ${b.zone}`);
  if ('quest' in b && !Registry.quest(b.quest)) p.push(`unknown quest ${b.quest}`);
  if ('quests' in b) for (const q of b.quests) if (!Registry.quest(q)) p.push(`unknown quest ${q}`);
  if ('boss' in b && !Registry.monster(b.boss)?.boss) p.push(`not a boss: ${b.boss}`);
  if ('npc' in b && !Registry.npc(b.npc)) p.push(`unknown NPC ${b.npc}`);
  if ('school' in b && !isSchool(b.school)) p.push(`unknown School ${b.school}`);
  if ('training' in b && !(b.training[0] <= b.training[1])) p.push('training range is backwards');
  return p;
}

export function validate(g: Guide, sections: Section[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const s of sections) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) out.push(`section id "${s.id}" is not lower-case-with-hyphens`);
    if (ids.has(s.id)) out.push(`duplicate section id "${s.id}"`);
    ids.add(s.id);
    for (const b of s.blocks) for (const p of blockProblems(b)) out.push(`${s.id}: ${p}`);
  }
  const all = sections.flatMap(s => s.blocks);
  const zones = new Set(all.flatMap(b => ('zone' in b ? [b.zone] : [])));
  const bosses = new Set(all.flatMap(b => ('boss' in b ? [b.boss] : [])));
  const quests = new Set(all.flatMap(b => ('quest' in b ? [b.quest] : 'quests' in b ? b.quests : [])));
  for (const m of g.maps) if ((g.mapMonsters.get(m.id) ?? []).length && !zones.has(m.id)) out.push(`no zone panel for ${m.id}`);
  for (const m of g.monsters) if (m.boss && g.monsterHome.has(m.id) && !bosses.has(m.id)) out.push(`no boss card for ${m.id}`);
  for (const q of STORY_QUESTS) if (!quests.has(q.id)) out.push(`story step ${q.id} has no quest card`);
  for (const q of [...g.assignments, ...g.bounties]) if (!quests.has(q.id)) out.push(`quest ${q.id} is not in the walkthrough`);
  for (const [school, builds] of Object.entries(BUILDS)) {
    for (const b of builds) for (const p of checkBuild(b).problems) out.push(`build ${school}/${b.name}: ${p}`);
  }
  return out;
}
