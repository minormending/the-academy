// Story-mode data integrity: every class (CourseDef), its missions (QuestDefs) and each Year's plan.
// Passes on empty data; once the course files land it catches dangling ids, duplicate ids, wrong Year bands, etc.
// See src/data/courses/README.md for the authoring rules these tests enforce.
import { describe, expect, it } from 'vitest';
import type { CourseDef, YearNo } from '../src/core/types';
import { Registry } from '../src/core/registry';
import { MISSIONS } from '../src/data/courses';
import { SCHOOLS, monstersDropping } from './support/data';
import { problems } from './support/problems';

const YEARS: YearNo[] = [1, 2, 3, 4, 5];
/** Level band per Year from the README table; minLevels may stray this far outside it. */
const BAND: Record<YearNo, [number, number]> = { 1: [1, 10], 2: [10, 25], 3: [25, 40], 4: [40, 55], 5: [55, 70] };
const SLACK = 3;

const courses = Registry.courses();
const inYear = (y: YearNo) => courses.filter(c => c.year === y);
/** Classes a student of `school` can take in `year`: core + electives + that School's major. */
const availableTo = (year: YearNo, school: string) => inYear(year).filter(c => c.kind !== 'major' || c.school === school);
const newMissionIds = new Set(MISSIONS.map(q => q.id));
const rewardItemIds = new Set(Registry.quests().flatMap(q => (q.rewards.items ?? []).map(i => i.itemId)));

describe('courses: identity', () => {
  it('course ids are unique, c<year>_ prefixed, and the year is valid', () => {
    const p = problems();
    const seen = new Set<string>();
    for (const c of courses) {
      p.check(!seen.has(c.id), `duplicate course id ${c.id}`);
      seen.add(c.id);
      p.check(YEARS.includes(c.year), `${c.id}: bad year ${c.year}`);
      p.check(c.id.startsWith(`c${c.year}_`), `${c.id}: id must start with c${c.year}_ (year is ${c.year})`);
      p.check(c.name && c.code && c.blurb && c.passLine, `${c.id}: name, code, blurb and passLine are all required`);
    }
    p.done();
  });

  it('badge ids are unique and b_ prefixed', () => {
    const p = problems();
    const seen = new Map<string, string>();
    for (const c of courses) {
      p.check(!!c.badge?.id, `${c.id}: no badge`);
      if (!c.badge?.id) continue;
      p.check(!seen.has(c.badge.id), `badge ${c.badge.id} used by both ${seen.get(c.badge.id)} and ${c.id}`);
      seen.set(c.badge.id, c.id);
      p.check(c.badge.id.startsWith('b_'), `${c.id}: badge id ${c.badge.id} should start with b_`);
      p.check(c.badge.name && Number.isFinite(c.badge.color) && c.badge.shape, `${c.id}: badge needs name, color and shape`);
    }
    p.done();
  });

  it('teachers exist as NPCs', () => {
    const p = problems();
    for (const c of courses) p.check(Registry.npc(c.teacher), `${c.id}: teacher NPC ${c.teacher} does not exist`);
    p.done();
  });

  it('kind and school are consistent; every School has exactly one major per Year 2-5', () => {
    const p = problems();
    for (const c of courses) {
      p.check(['core', 'major', 'elective'].includes(c.kind), `${c.id}: bad kind ${c.kind}`);
      if (c.kind === 'major') p.check(c.school && SCHOOLS.includes(c.school), `${c.id}: major needs a valid school (got ${c.school})`);
      else p.check(!c.school, `${c.id}: only majors carry a school (${c.kind} has ${c.school})`);
    }
    for (const y of [2, 3, 4, 5] as YearNo[]) {
      const majors = inYear(y).filter(c => c.kind === 'major');
      if (!majors.length) continue; // that Year's data has not landed yet
      for (const s of SCHOOLS) {
        const mine = majors.filter(c => c.school === s);
        p.check(mine.length === 1, `Year ${y}: expected exactly 1 ${s} major, found ${mine.length} (${mine.map(c => c.id).join(', ')})`);
      }
    }
    p.done();
  });

  it('Year 1 has no majors (the major is declared at its end)', () => {
    expect(inYear(1).filter(c => c.kind === 'major').map(c => c.id)).toEqual([]);
  });
});

describe('courses: missions', () => {
  it('every class has missions, all of which exist; none repeats within a class', () => {
    const p = problems();
    for (const c of courses) {
      p.check(c.missions.length > 0, `${c.id}: no missions`);
      p.check(new Set(c.missions).size === c.missions.length, `${c.id}: a mission is listed twice`);
      for (const id of c.missions) p.check(Registry.quest(id), `${c.id}: mission ${id} is not in the quest registry`);
    }
    p.done();
  });

  it('no quest id appears in two classes', () => {
    const p = problems();
    const owner = new Map<string, string>();
    for (const c of courses) for (const id of c.missions) {
      if (owner.has(id) && owner.get(id) !== c.id) p.check(false, `${id} is in both ${owner.get(id)} and ${c.id}`);
      owner.set(id, c.id);
    }
    p.done();
  });

  it('new mission ids are unique across the quest registry and follow m<year>_ naming', () => {
    const p = problems();
    const seen = new Set<string>();
    for (const q of MISSIONS) {
      p.check(!seen.has(q.id), `duplicate mission id ${q.id}`);
      seen.add(q.id);
      p.check(/^m[1-5]_/.test(q.id), `${q.id}: new missions are named m<year>_<course>_<n>`);
      const c = Registry.courseOfMission(q.id);
      p.check(c, `${q.id}: not part of any class`);
      if (c) p.check(q.id.startsWith(`m${c.year}_`), `${q.id}: in ${c.id} (Year ${c.year}) but named for another Year`);
      p.check(q.name && q.description, `${q.id}: name and description required`);
    }
    for (const id of seen) p.check(Registry.quests().filter(q => q.id === id).length === 1, `${id}: collides with an existing quest id`);
    p.done();
  });

  it('mission givers, objective targets and reward items all exist', () => {
    const p = problems();
    for (const c of courses) for (const id of c.missions) {
      const q = Registry.quest(id);
      if (!q) continue;
      const at = `${c.id}/${id}`;
      p.check(Registry.npc(q.giver), `${at}: giver ${q.giver} is not an NPC`);
      // Existing story beats can be talk-only (handed in by speaking to the giver); new missions need a goal.
      p.check(q.objectives.length > 0 || !newMissionIds.has(id), `${at}: no objectives`);
      for (const o of q.objectives) {
        if (o.kind === 'kill') {
          p.check(Registry.monster(o.monsterId), `${at}: monster ${o.monsterId} does not exist`);
          p.check(o.count > 0, `${at}: kill count must be positive`);
        } else if (o.kind === 'collect') {
          p.check(Registry.item(o.itemId), `${at}: item ${o.itemId} does not exist`);
          p.check(o.count > 0, `${at}: collect count must be positive`);
          p.check(monstersDropping(o.itemId).length > 0 || rewardItemIds.has(o.itemId),
            `${at}: nothing drops ${o.itemId}, so it can never be collected`);
        } else if (o.kind === 'visit') p.check(Registry.map(o.mapId), `${at}: map ${o.mapId} does not exist`);
        else if (o.kind === 'talk') p.check(Registry.npc(o.npcId), `${at}: NPC ${o.npcId} does not exist`);
        else if (o.kind === 'level') p.check(o.level >= 1, `${at}: bad level goal ${o.level}`);
      }
      for (const r of q.rewards.items ?? []) {
        p.check(Registry.item(r.itemId), `${at}: reward item ${r.itemId} does not exist`);
        p.check(r.qty > 0, `${at}: reward qty must be positive`);
      }
      p.check((q.rewards.exp ?? 0) >= 0 && (q.rewards.mesos ?? 0) >= 0, `${at}: negative exp/mesos`);
    }
    p.done();
  });

  it('minLevel never decreases through a class', () => {
    const p = problems();
    for (const c of courses) {
      const lv = c.missions.map(id => Registry.quest(id)?.minLevel).filter((x): x is number => x !== undefined);
      for (let i = 1; i < lv.length; i++) {
        p.check(lv[i] >= lv[i - 1], `${c.id}: mission ${c.missions[i]} (L${lv[i]}) is below the one before it (L${lv[i - 1]})`);
      }
    }
    p.done();
  });

  it(`new missions' minLevels sit in their Year's band (±${SLACK})`, () => {
    const p = problems();
    for (const c of courses) for (const id of c.missions) {
      const q = Registry.quest(id);
      if (!q || !newMissionIds.has(id)) continue; // reused quests keep whatever level they were authored at
      const [lo, hi] = BAND[c.year];
      p.check(q.minLevel >= lo - SLACK && q.minLevel <= hi + SLACK,
        `${c.id}/${id}: minLevel ${q.minLevel} is outside Year ${c.year}'s band ${lo}-${hi} (±${SLACK})`);
    }
    p.done();
  });
});

describe('courses: rewards', () => {
  it('course reward items exist; exp, mesos and sp are non-negative', () => {
    const p = problems();
    for (const c of courses) {
      const r = c.rewards;
      p.check((r.exp ?? 0) >= 0 && (r.mesos ?? 0) >= 0 && (r.sp ?? 0) >= 0, `${c.id}: negative reward`);
      for (const it of r.items ?? []) {
        p.check(Registry.item(it.itemId), `${c.id}: reward item ${it.itemId} does not exist`);
        p.check(it.qty > 0, `${c.id}: reward qty must be positive`);
      }
    }
    p.done();
  });
});

describe('year plans', () => {
  it('each Year has a plan for its own Year with sane numbers', () => {
    const p = problems();
    for (const y of YEARS) {
      const plan = Registry.yearPlan(y);
      if (!p.check(plan, `Year ${y}: no plan`)) continue;
      p.check(plan.year === y, `Year ${y}: plan says year ${plan.year}`);
      p.check(Number.isInteger(plan.badgesToPass) && plan.badgesToPass >= 1, `Year ${y}: badgesToPass ${plan.badgesToPass}`);
    }
    p.done();
  });

  it('badgesToPass is reachable for a student of every School, and required kinds exist', () => {
    const p = problems();
    for (const y of YEARS) {
      const plan = Registry.yearPlan(y);
      const list = inYear(y);
      if (!plan || !list.length) continue; // Year not authored yet
      for (const s of SCHOOLS) {
        const n = availableTo(y, s).length;
        p.check(plan.badgesToPass <= n, `Year ${y}: ${s} student can take ${n} classes but needs ${plan.badgesToPass} badges`);
      }
      for (const k of plan.required) {
        p.check(list.some(c => c.kind === k), `Year ${y}: requires a ${k} badge but no ${k} class exists`);
      }
      // A required kind must be takeable by every School, not just exist somewhere.
      for (const s of SCHOOLS) for (const k of plan.required) {
        p.check(availableTo(y, s).some((c: CourseDef) => c.kind === k), `Year ${y}: ${s} student has no ${k} class`);
      }
    }
    p.done();
  });
});
