// CourseSystem (story mode): class order, Year/School gates, passing, majors, promotion, old-save credit,
// and the Progression hooks (visit / talk objectives, Year gates). Uses small fake course data.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEvents } from '../src/core/events';
import type { GameServices, JobId, PlayerState } from '../src/core/types';

vi.mock('../src/data/courses', () => {
  const quest = (id: string, giver: string, objectives: unknown[], minLevel = 1) =>
    ({ id, name: id, giver, description: id, minLevel, objectives, rewards: {} });
  const badge = (id: string) => ({ id: `b_${id}`, name: `Badge ${id}`, color: 0xff8800, shape: 'star' });
  const course = (id: string, year: number, kind: string, missions: string[], extra: Record<string, unknown> = {}) =>
    ({ id, year, name: id, code: id.toUpperCase(), teacher: 'elder_maelis', kind, blurb: '', missions, badge: badge(id), rewards: {}, passLine: '', ...extra });
  const plan = (year: number, badgesToPass: number, required: string[]) =>
    ({ year, title: `Year ${year}`, intro: '', badgesToPass, required, outro: '' });
  return {
    COURSES: [
      course('c1_core', 1, 'core', ['m1_core_1', 'm1_core_2'],
        { rewards: { exp: 5, mesos: 100, sp: 2, items: [{ itemId: 'red_potion', qty: 3 }] } }),
      course('c1_elec', 1, 'elective', ['m1_elec_1']),
      course('c2_core', 2, 'core', ['m2_core_1']),
      course('c2_fire', 2, 'major', ['m2_fire_1'], { school: 'fire' }),
      course('c2_ice', 2, 'major', ['m2_ice_1'], { school: 'ice' }),
      course('c2_elec', 2, 'elective', ['m2_elec_1']),
      course('c2_elec2', 2, 'elective', ['m2_elec2_1']),
      course('c3_core', 3, 'core', ['m3_core_1']),
      course('c4_core', 4, 'core', ['m4_core_1']),
      course('c5_core', 5, 'core', ['m5_core_1']),
    ],
    MISSIONS: [
      quest('m1_core_1', 'elder_maelis', [{ kind: 'visit', mapId: 'whisperwood' }]),
      quest('m1_core_2', 'elder_maelis', [{ kind: 'talk', npcId: 'scout_finn' }]),
      quest('m1_elec_1', 'pyra', [{ kind: 'kill', monsterId: 'moss_snail', count: 1 }]),
      quest('m2_core_1', 'elder_maelis', [{ kind: 'talk', npcId: 'pyra' }]),
      quest('m2_fire_1', 'pyra', [{ kind: 'talk', npcId: 'pyra' }]),
      quest('m2_ice_1', 'glacius', [{ kind: 'talk', npcId: 'glacius' }]),
      quest('m2_elec_1', 'scout_finn', [{ kind: 'talk', npcId: 'scout_finn' }]),
      quest('m2_elec2_1', 'scout_finn', [{ kind: 'talk', npcId: 'scout_finn' }]),
      quest('m3_core_1', 'elder_maelis', [{ kind: 'talk', npcId: 'elder_maelis' }]),
      quest('m4_core_1', 'elder_maelis', [{ kind: 'talk', npcId: 'elder_maelis' }]),
      quest('m5_core_1', 'elder_maelis', [{ kind: 'talk', npcId: 'elder_maelis' }]),
    ],
    YEAR_PLANS: {
      1: plan(1, 2, ['core']), 2: plan(2, 3, ['core', 'major']), 3: plan(3, 1, ['core']),
      4: plan(4, 1, ['core']), 5: plan(5, 1, ['core']),
    },
  };
});

import { bus } from '../src/core/events';
import { Registry } from '../src/core/registry';
import { objectiveGoal } from '../src/core/quest';
import { JOB_LEVELS } from '../src/core/constants';
import { CourseSystem, canAcceptMission } from '../src/systems/CourseSystem';
import { Progression } from '../src/systems/Progression';
import { newPlayerState, repairCourses, repairState } from '../src/systems/SaveSystem';
import { GRADUATION_QUEST_ID } from '../src/data/storyQuests';
import { stubStorage } from './support/storage';

function world(opts: { job?: JobId; level?: number; courses?: boolean; mapId?: string; state?: PlayerState } = {}) {
  const state = opts.state ?? newPlayerState('Tester');
  if (opts.job) state.job = opts.job;
  if (opts.level) state.level = opts.level;
  if (opts.mapId) state.mapId = opts.mapId;
  const s = {} as GameServices;
  const p = new Progression(s, state);
  s.progression = p;
  const cs = opts.courses === false ? undefined : new CourseSystem(s);
  if (cs) s.courses = cs;
  return { s, p, cs: cs!, state: p.state };
}

/** Accept, satisfy every objective, hand in. */
function finish(p: Progression, qid: string) {
  p.acceptQuest(qid);
  const prog = p.state.quests[qid];
  expect(prog, `${qid} accepted`).toBeDefined();
  prog.counts = Registry.quest(qid)!.objectives.map(objectiveGoal);
  expect(p.turnInQuest(qid), `${qid} handed in`).toBe(true);
}

function pass(p: Progression, cs: CourseSystem, courseId: string) {
  for (const m of Registry.course(courseId)!.missions) finish(p, m);
  expect(cs.passCourse(courseId), `${courseId} passed`).toBe(true);
}

function record<K extends keyof GameEvents>(ev: K): GameEvents[K][] {
  const out: GameEvents[K][] = [];
  bus.on(ev, e => out.push(e));
  return out;
}

beforeEach(() => { bus.removeAll(); stubStorage(); });
afterEach(() => { bus.removeAll(); vi.unstubAllGlobals(); });

describe('canAcceptMission', () => {
  it('ignores quests outside every class', () => {
    expect(canAcceptMission(newPlayerState('a'), 'q_finn_snails')).toBe(true);
  });
  it('enforces course order, Year and School', () => {
    const st = newPlayerState('a');
    expect(canAcceptMission(st, 'm1_core_1')).toBe(true);
    expect(canAcceptMission(st, 'm1_core_2')).toBe(false);
    st.quests.m1_core_1 = { status: 'complete', counts: [1] };
    expect(canAcceptMission(st, 'm1_core_2')).toBe(false);
    st.quests.m1_core_1.status = 'turned_in';
    expect(canAcceptMission(st, 'm1_core_2')).toBe(true);
    expect(canAcceptMission(st, 'm2_core_1')).toBe(false); // Year 2 class, Year 1 student
    st.job = 'pyromancer';
    expect(canAcceptMission(st, 'm2_core_1')).toBe(true);
    expect(canAcceptMission(st, 'm2_fire_1')).toBe(true);
    expect(canAcceptMission(st, 'm2_ice_1')).toBe(false); // someone else's major
    expect(canAcceptMission(st, 'm1_elec_1')).toBe(true); // earlier Years stay open
  });
  it('is wired into Progression.canAcceptQuest', () => {
    const { p } = world();
    expect(p.canAcceptQuest('m1_core_1')).toBe(true);
    expect(p.canAcceptQuest('m1_core_2')).toBe(false);
    expect(p.canAcceptQuest('m2_core_1')).toBe(false);
  });
});

describe('visit and talk objectives', () => {
  it('count a visit on accept when already on the map, and on map:changed', () => {
    const a = world({ mapId: 'whisperwood' });
    a.p.acceptQuest('m1_core_1');
    expect(a.state.quests.m1_core_1.status).toBe('complete');

    bus.removeAll();
    const b = world({ mapId: 'mistvale' });
    b.p.acceptQuest('m1_core_1');
    expect(b.state.quests.m1_core_1.status).toBe('active');
    bus.emit('map:changed', { mapId: 'shroom_hollow' });
    expect(b.state.quests.m1_core_1.status).toBe('active');
    bus.emit('map:changed', { mapId: 'whisperwood' });
    expect(b.state.quests.m1_core_1).toEqual({ status: 'complete', counts: [1] });
  });
  it('count a talk on npc:talked', () => {
    const { p, state } = world();
    finish(p, 'm1_core_1');
    p.acceptQuest('m1_core_2');
    bus.emit('npc:talked', { npcId: 'pyra' });
    expect(state.quests.m1_core_2.status).toBe('active');
    bus.emit('npc:talked', { npcId: 'scout_finn' });
    expect(state.quests.m1_core_2.status).toBe('complete');
  });
});

describe('class status and passing', () => {
  it('moves open → enrolled → passed, tracking the current mission', () => {
    const { p, cs, state } = world();
    expect(cs.year()).toBe(1);
    expect(cs.catalogue().map(c => c.id)).toEqual(['c1_core', 'c1_elec']);
    expect(cs.status('c1_core')).toBe('open');
    expect(cs.status('c2_core')).toBe('locked');
    expect(cs.currentMission('c1_core')?.id).toBe('m1_core_1');

    const updates = record('course:updated');
    p.acceptQuest('m1_core_1');
    expect(cs.status('c1_core')).toBe('enrolled');
    expect(state.courses?.c1_core).toEqual({ status: 'enrolled' });
    expect(updates.some(u => u.courseId === 'c1_core')).toBe(true);
    expect(cs.activeMissions().map(m => m.mission.id)).toEqual(['m1_core_1']);

    expect(cs.passCourse('c1_core')).toBe(false); // missions not all handed in
    state.quests.m1_core_1.counts = [1];
    p.turnInQuest('m1_core_1');
    expect(cs.currentMission('c1_core')?.id).toBe('m1_core_2');
    finish(p, 'm1_core_2');
    expect(cs.currentMission('c1_core')).toBeNull();
    expect(cs.readyToPass('c1_core')).toBe(true);

    const passed = record('course:passed');
    const banners = record('ui:banner');
    const before = { mesos: state.mesos, sp: state.sp, potions: p.countItem('red_potion') };
    expect(cs.passCourse('c1_core')).toBe(true);
    expect(passed).toEqual([{ courseId: 'c1_core', badgeId: 'b_c1_core' }]);
    expect(banners).toContainEqual({ text: 'CLASS PASSED', sub: 'Badge c1_core', color: '#ff8800' });
    expect(state.mesos).toBe(before.mesos + 100);
    expect(state.sp).toBe(before.sp + 2);
    expect(p.countItem('red_potion')).toBe(before.potions + 3);
    expect(state.courses?.c1_core.status).toBe('passed');
    expect(typeof state.courses?.c1_core.passedAt).toBe('number');
    expect(cs.status('c1_core')).toBe('passed');
    expect(cs.badges(1).map(c => c.id)).toEqual(['c1_core']);
    expect(cs.passCourse('c1_core')).toBe(false); // only once
  });

  it('refuses to pass when the reward items do not fit', () => {
    const { p, cs, state } = world();
    finish(p, 'm1_core_1'); finish(p, 'm1_core_2');
    state.inventory = Array.from({ length: 48 }, (_, i) => ({ uid: `w${i}`, itemId: 'oak_wand', qty: 1 }));
    expect(cs.passCourse('c1_core')).toBe(false);
    expect(state.courses?.c1_core?.status).not.toBe('passed');
  });
});

describe('Years, majors and promotion', () => {
  it('Year 1: declare a major only once the Year is passed and at the job level', () => {
    const { p, cs, state } = world({ level: JOB_LEVELS[2] });
    // The legacy NPC flows cannot skip the Year: advanceJob and availableAdvancements are gated.
    expect(p.availableAdvancements()).toEqual([]);
    expect(p.advanceJob('pyromancer')).toBe(false);
    expect(cs.declareMajor('fire')).toBe(false);
    pass(p, cs, 'c1_core');
    expect(cs.yearProgress()).toEqual({ have: 1, need: 2, missing: [], ready: false });
    pass(p, cs, 'c1_elec');
    expect(cs.yearProgress().ready).toBe(true);
    expect(p.availableAdvancements()).toContain('pyromancer');

    state.level = JOB_LEVELS[2] - 1;
    const logs = record('ui:log');
    expect(cs.declareMajor('fire')).toBe(false);
    expect(logs.some(l => /level 10/.test(l.text))).toBe(true);

    state.level = JOB_LEVELS[2];
    const years = record('year:promoted');
    expect(cs.declareMajor('fire')).toBe(true);
    expect(state.job).toBe('pyromancer');
    expect(years).toEqual([{ year: 2 }]);
    expect(cs.year()).toBe(2);
    expect(cs.catalogue().map(c => c.id)).toEqual(['c2_core', 'c2_fire', 'c2_elec', 'c2_elec2']);
    expect(cs.declareMajor('ice')).toBe(false);
  });

  it('Year 2+: needs the core and the major; promote() advances the lineage', () => {
    const { p, cs, state } = world({ job: 'pyromancer', level: JOB_LEVELS[3] });
    expect(cs.promote()).toBe(false);
    pass(p, cs, 'c2_core'); pass(p, cs, 'c2_elec'); pass(p, cs, 'c2_elec2');
    expect(cs.yearProgress()).toEqual({ have: 3, need: 3, missing: ['major'], ready: false });
    expect(cs.promote()).toBe(false);
    pass(p, cs, 'c2_fire');
    const years = record('year:promoted');
    expect(cs.promote()).toBe(true);
    expect(state.job).toBe('flamebinder');
    expect(years).toEqual([{ year: 3 }]);
  });

  it('Year 4 → 5 waits for graduation; Year 5 passed fires the finale (year 6)', () => {
    const a = world({ job: 'inferno_sage', level: JOB_LEVELS[5] });
    pass(a.p, a.cs, 'c4_core');
    expect(a.cs.promote()).toBe(false);
    expect(a.p.advanceJob('pyre_archon')).toBe(false);
    a.state.quests[GRADUATION_QUEST_ID] = { status: 'turned_in', counts: [] };
    expect(a.cs.promote()).toBe(true);
    expect(a.state.job).toBe('pyre_archon');

    pass(a.p, a.cs, 'c5_core');
    const years = record('year:promoted');
    expect(a.cs.promote()).toBe(true);
    expect(years).toEqual([{ year: 6 }]);
  });

  it('without a course service the legacy advancement flow still works', () => {
    const { p } = world({ level: JOB_LEVELS[2], courses: false });
    expect(p.availableAdvancements()).toHaveLength(5);
    expect(p.advanceJob('cryomancer')).toBe(true);
  });
});

describe('old saves and repair', () => {
  it('grants credit for every finished Year when courses is absent', () => {
    const st = newPlayerState('Old');
    st.job = 'flamebinder'; st.level = 30;
    delete st.courses;
    const { cs, state } = world({ state: st });
    const credited = Object.entries(state.courses ?? {}).filter(([, v]) => v.credit).map(([id]) => id).sort();
    expect(credited).toEqual(['c1_core', 'c1_elec', 'c2_core', 'c2_elec', 'c2_fire']);
    expect(cs.year()).toBe(3);
    expect(cs.badges(2)).toHaveLength(3);
    expect(cs.status('c3_core')).toBe('open');
  });

  it('a new Year 1 student gets an empty record and no credit', () => {
    const { state } = world();
    expect(state.courses).toEqual({});
  });

  it('repairCourses keeps only valid entries; absent stays absent', () => {
    expect(repairCourses(undefined)).toBeUndefined();
    expect(repairCourses([1, 2])).toBeUndefined();
    expect(repairCourses({
      c1_core: { status: 'passed', passedAt: 5, credit: true, junk: 1 },
      c1_elec: { status: 'enrolled', passedAt: 'x', credit: 'yes' },
      c2_core: { status: 'failed' },
      c2_fire: 'passed',
      c9_unknown: { status: 'passed' },
    })).toEqual({ c1_core: { status: 'passed', passedAt: 5, credit: true }, c1_elec: { status: 'enrolled' } });
    const st = newPlayerState('R');
    expect('courses' in repairState(st)).toBe(false);
    expect(repairState({ ...st, courses: { c1_core: { status: 'passed' } } }).courses).toEqual({ c1_core: { status: 'passed' } });
  });
});
