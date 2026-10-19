/** Data registry. Owned by the lead — do not edit. Agents export arrays from their data modules. */
import type { CourseDef, ItemDef, JobDef, JobId, MapDef, MonsterDef, NpcDef, QuestDef, SkillDef, YearNo, YearPlan } from './types';
import { ALL_SKILLS } from '../skills';
import { MONSTERS } from '../data/monsters';
import { RAID_BOSSES } from '../data/raidBosses';
import { MAPS } from '../data/maps';
import { ITEMS } from '../data/items';
import { ITEMS5 } from '../data/items5';
import { JOBS } from '../data/jobs';
import { NPCS } from '../data/npcs';
import { QUESTS } from '../data/quests';
import { STORY_QUESTS } from '../data/storyQuests';
import { COURSES, MISSIONS, YEAR_PLANS } from '../data/courses';

function index<T extends { id: string }>(arr: T[], what: string): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of arr) { if (m.has(x.id)) console.warn(`[registry] duplicate ${what} id ${x.id}`); m.set(x.id, x); }
  return m;
}

let _skills: Map<string, SkillDef>, _monsters: Map<string, MonsterDef>, _maps: Map<string, MapDef>,
  _items: Map<string, ItemDef>, _jobs: Map<string, JobDef>, _npcs: Map<string, NpcDef>, _quests: Map<string, QuestDef>, _courses: Map<string, CourseDef>;
function ensure() {
  if (_skills) return;
  _skills = index(ALL_SKILLS, 'skill'); _monsters = index([...MONSTERS, ...RAID_BOSSES], 'monster'); _maps = index(MAPS, 'map');
  _items = index([...ITEMS, ...ITEMS5], 'item'); _jobs = index(JOBS, 'job'); _npcs = index(NPCS, 'npc'); _quests = index([...QUESTS, ...STORY_QUESTS, ...MISSIONS], 'quest');
  _courses = index(COURSES, 'course');
}

export const Registry = {
  skill(id: string) { ensure(); return _skills.get(id); },
  skills() { ensure(); return [..._skills.values()]; },
  skillsForJob(job: JobId) { ensure(); return [..._skills.values()].filter(s => s.job === job); },
  monster(id: string) { ensure(); return _monsters.get(id); },
  monsters() { ensure(); return [..._monsters.values()]; },
  map(id: string) { ensure(); return _maps.get(id); },
  maps() { ensure(); return [..._maps.values()]; },
  item(id: string) { ensure(); return _items.get(id); },
  items() { ensure(); return [..._items.values()]; },
  job(id: JobId) { ensure(); return _jobs.get(id)!; },
  jobs() { ensure(); return [..._jobs.values()]; },
  /** Job lineage from tier 1 to `job` inclusive, e.g. [apprentice, pyromancer, flamebinder]. */
  jobLineage(job: JobId): JobDef[] {
    ensure(); const out: JobDef[] = []; let j: JobDef | undefined = _jobs.get(job);
    while (j) { out.unshift(j); j = j.parent ? _jobs.get(j.parent) : undefined; }
    return out;
  },
  npc(id: string) { ensure(); return _npcs.get(id); },
  quest(id: string) { ensure(); return _quests.get(id); },
  quests() { ensure(); return [..._quests.values()]; },
  course(id: string) { ensure(); return _courses.get(id); },
  courses() { ensure(); return [..._courses.values()]; },
  yearPlan(year: YearNo): YearPlan { return YEAR_PLANS[year]; },
  /** The class a mission belongs to (missions belong to at most one class). */
  courseOfMission(questId: string) { ensure(); return [..._courses.values()].find(c => c.missions.includes(questId)); },
};
