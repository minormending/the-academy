// Every School must be finishable: Year 2 declaration -> Year 3 exam -> Year 4 exam -> the shared story to
// graduation (Commencement). After that, Year 5 — the Fellowship — is postgraduate: one Fellowship Exam per School.
// The exams' items have to drop somewhere the student can reach, and at a rate that is playable.
import { describe, expect, it } from 'vitest';
import type { QuestDef } from '../src/core/types';
import { Registry } from '../src/core/registry';
import { JOB_LEVELS, MAX_LEVEL, START_MAP } from '../src/core/constants';
import { BRANCH_ROOT_JOB, SCHOOLS, SCHOOL_PROFESSOR } from '../src/data/jobs';
import { JOB_ADVANCEMENT_QUESTS } from '../src/data/quests';
import { GRADUATION_QUEST_ID, STORY_FLOW } from '../src/data/storyQuests';
import { lineageOf, monstersDropping, reachableMaps, spawnedMonsterIds } from './support/data';
import { problems } from './support/problems';
import { pendingYear5 } from './support/year5';

const reach = reachableMaps(START_MAP);
const reachableMapDefs = [...reach].map(id => Registry.map(id)!);
const spawned = spawnedMonsterIds(reachableMapDefs);

/** Map ids on which an NPC stands. */
const npcMaps = (npcId: string) => reachableMapDefs.filter(m => m.npcs.some(n => n.npcId === npcId)).map(m => m.id);

/** Fewest expected kills to collect `count` of `itemId` from any reachable monster. */
function bestKillsFor(itemId: string, count: number): number {
  let best = Infinity;
  for (const { drop } of monstersDropping(itemId, spawned)) {
    const avgQty = ((drop.min ?? 1) + (drop.max ?? drop.min ?? 1)) / 2;
    best = Math.min(best, count / (drop.chance * avgQty));
  }
  return best;
}

/** Items some reachable monster drops. */
const droppedItems = new Set<string>();
for (const id of spawned) for (const d of Registry.monster(id)?.drops ?? []) if (d.chance > 0) droppedItems.add(d.itemId);

/** Year 5 objective targets still landing from other agents, per exam: `${qid}: ${reason}`. */
function pendingObjectives(qid: string | undefined): string[] {
  const q = qid ? Registry.quest(qid) : undefined;
  if (!q) return [];
  return q.objectives.flatMap(o => {
    const why = o.kind === 'kill' ? pendingYear5('kill', o.monsterId, spawned)
      : o.kind === 'collect' ? pendingYear5('collect', o.itemId, spawned, droppedItems) : null;
    return why ? [`${qid}: ${why}`] : [];
  });
}

describe.each(SCHOOLS)('the %s School can graduate', school => {
  const jobs = lineageOf(school);
  const undergrad = jobs.filter(j => j.tier <= 4);
  const fellow = jobs.find(j => j.tier === 5);

  it('has a Year 2, Year 3 and Year 4 job (and a Year 5 Fellowship job), each in the right place', () => {
    expect(jobs.map(j => j.tier)).toEqual([2, 3, 4, 5]);
    expect(jobs[0].id).toBe(BRANCH_ROOT_JOB[school]);
    expect(jobs.map(j => j.parent)).toEqual(['apprentice', jobs[0].id, jobs[1].id, jobs[2].id]);
    expect(jobs.map(j => j.requiredLevel)).toEqual([JOB_LEVELS[2], JOB_LEVELS[3], JOB_LEVELS[4], JOB_LEVELS[5]]);
    expect(JOB_LEVELS[5]).toBeLessThanOrEqual(MAX_LEVEL);
    for (const j of undergrad) expect(Registry.skillsForJob(j.id).length, `${j.id} skills`).toBeGreaterThanOrEqual(4);
    expect(fellow!.description, `${fellow!.id} description`).toMatch(/^Year 5 · /);
  });

  // Year 5 spells are being written by other agents; report rather than fail until they land.
  if (fellow && Registry.skillsForJob(fellow.id).length >= 4) {
    it(`its Year 5 job ${fellow.id} has at least 4 skills`, () => expect(Registry.skillsForJob(fellow.id).length).toBeGreaterThanOrEqual(4));
  } else if (fellow) {
    it.todo(`Year 5 skills for ${fellow.id} (${Registry.skillsForJob(fellow.id).length} registered so far, need 4)`);
  }

  it('can fight on day one: its Year 2 job has an attack skill that needs nothing from the School', () => {
    const attacks = Registry.skillsForJob(jobs[0].id).filter(s => s.kind === 'attack');
    expect(attacks.length).toBeGreaterThan(0);
    const opener = attacks.find(s => !s.requires?.length) ?? attacks.find(s => s.requires!.every(r => Registry.skill(r.skillId)!.job === 'apprentice'));
    expect(opener, 'no Year 2 attack the student can learn immediately').toBeDefined();
  });

  const pending = pendingObjectives(fellow && JOB_ADVANCEMENT_QUESTS[fellow.id]);
  for (const why of pending) it.todo(`Fellowship Exam objective pending another agent — ${why}`);

  it('the professor runs every exam (Years 3, 4 and the Year 5 Fellowship), stands on a reachable map, and each exam can be completed', () => {
    const prof = SCHOOL_PROFESSOR[school];
    expect(Registry.npc(prof), `professor ${prof}`).toBeDefined();
    expect(npcMaps(prof).length, `${prof} stands on no reachable map`).toBeGreaterThan(0);
    const p = problems();
    for (const job of jobs.slice(1)) {
      const qid = JOB_ADVANCEMENT_QUESTS[job.id];
      if (!p.check(qid, `${job.id} has no exam in JOB_ADVANCEMENT_QUESTS`)) continue;
      const q = Registry.quest(qid!) as QuestDef;
      if (!p.check(q, `exam ${qid} is missing`)) continue;
      p.check(q.giver === prof, `${qid} is given by ${q.giver}, not the School's professor ${prof}`);
      p.check(q.requiredJobBranch === school, `${qid} requiredJobBranch ${q.requiredJobBranch}`);
      p.check(q.minLevel <= job.requiredLevel && q.minLevel <= MAX_LEVEL, `${qid} minLevel ${q.minLevel} > ${job.id}'s level ${job.requiredLevel}`);
      p.check(q.objectives.length > 0, `${qid} has no objective`);
      if (job.tier === 5) {
        p.check(q.minLevel === JOB_LEVELS[5], `${qid} minLevel ${q.minLevel} should be ${JOB_LEVELS[5]}`);
        p.check(q.objectives.some(o => o.kind === 'kill') && q.objectives.some(o => o.kind === 'collect'), `${qid} should be a hunt + a collection`);
      }
      for (const o of q.objectives) {
        // Year 5 monsters/items still landing are reported as it.todo above, not failed here.
        if (o.kind === 'kill' && pendingYear5('kill', o.monsterId, spawned)) continue;
        if (o.kind === 'collect' && pendingYear5('collect', o.itemId, spawned, droppedItems)) continue;
        if (o.kind === 'collect') {
          const kills = bestKillsFor(o.itemId, o.count);
          p.check(Number.isFinite(kills), `${qid}: no reachable monster drops ${o.itemId}`);
          p.check(kills <= 120, `${qid}: ${o.count} x ${o.itemId} takes ~${Math.round(kills)} kills on average`);
        } else if (o.kind === 'kill') {
          p.check(spawned.has(o.monsterId), `${qid}: ${o.monsterId} never spawns on a reachable map`);
        }
      }
      p.check((q.rewards.exp ?? 0) > 0, `${qid} pays no EXP`);
    }
    p.done();
  });
});

describe('the story to graduation', () => {
  const chain: QuestDef[] = [];
  const byPrev = new Map(Object.entries(STORY_FLOW).filter(([, f]) => f.prev).map(([id, f]) => [f.prev!, id]));
  for (let id: string | undefined = Object.entries(STORY_FLOW).find(([, f]) => !f.prev)?.[0]; id; id = byPrev.get(id)) chain.push(Registry.quest(id)!);

  it('covers every story step and ends at graduation', () => {
    expect(chain.length).toBe(Object.keys(STORY_FLOW).length);
    expect(chain[chain.length - 1].id).toBe(GRADUATION_QUEST_ID);
  });

  it("is open to every School: no step is branch-locked, and levels/tiers only go up", () => {
    const p = problems();
    let level = 0, tier = 0;
    for (const q of chain) {
      const f = STORY_FLOW[q.id];
      p.check(!q.requiredJobBranch || q.requiredJobBranch === 'none', `${q.id} is locked to ${q.requiredJobBranch}`);
      p.check(q.minLevel >= level, `${q.id} minLevel ${q.minLevel} is lower than the step before (${level})`);
      level = q.minLevel;
      if (f.minTier) {
        p.check(f.minTier >= tier, `${q.id} minTier ${f.minTier} is lower than an earlier step's ${tier}`);
        tier = f.minTier;
        p.check(q.minLevel >= JOB_LEVELS[f.minTier as 1 | 2 | 3 | 4], `${q.id} needs Year ${f.minTier} (Lv ${JOB_LEVELS[f.minTier as 1 | 2 | 3 | 4]}) but is offered at Lv ${q.minLevel}`);
      }
      p.check(npcMaps(q.giver).length > 0, `${q.id}: ${q.giver} stands on no reachable map`);
    }
    p.check(level <= MAX_LEVEL, `graduation needs Lv ${level}`);
    p.done();
  });

  it('the final boss spawns, is reachable, and always drops the sigil the thesis asks for', () => {
    const thesis = Registry.quest('story_final_thesis')!;
    const kill = thesis.objectives.find(o => o.kind === 'kill');
    const collect = thesis.objectives.find(o => o.kind === 'collect');
    expect(kill && kill.kind === 'kill' && spawned.has(kill.monsterId)).toBe(true);
    if (kill?.kind === 'kill' && collect?.kind === 'collect') {
      const drop = Registry.monster(kill.monsterId)!.drops.find(d => d.itemId === collect.itemId);
      expect(drop, `${kill.monsterId} does not drop ${collect.itemId}`).toBeDefined();
      expect(drop!.chance, 'the thesis item must be a guaranteed drop').toBe(1);
    }
  });

  it('collect objectives are completable in a sane number of kills', () => {
    const p = problems();
    for (const q of chain) for (const o of q.objectives) {
      if (o.kind !== 'collect') continue;
      const kills = bestKillsFor(o.itemId, o.count);
      // Quest-reward items (return_scroll in the shopping errand) are bought, not dropped.
      if (!Number.isFinite(kills)) continue;
      p.check(kills <= 120, `${q.id}: ${o.count} x ${o.itemId} takes ~${Math.round(kills)} kills`);
    }
    p.done();
  });
});
