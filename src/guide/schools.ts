// "Year 1 Core Curriculum" and "The Five Schools": identity, portraits per Year, every spell table, matchups
// against every monster, School gear and suggested builds with checked SP budgets.

import type { Element, MonsterDef, StatusKind } from '../core/types';
import { Registry } from '../core/registry';
import { JOB_LEVELS, MAX_LEVEL } from '../core/constants';
import { FELLOWSHIP_YEAR, SCHOOLS, SCHOOL_PROFESSOR, type School } from '../data/jobs';
import { h } from './dom';
import { jobImg, portraitImg } from './art';
import type { Guide } from './context';
import { schoolJobs } from './context';
import { jobBlurb, text } from './blocks';
import { BUILDS, CORE_PLAN, allocCost, checkBuild, spAtLevel, type Alloc, type Build } from './builds';
import { attackOf, skillsOf, spToMax, spellTable } from './spells';
import { anchor, elemPill, itemLink, monsterLink, npcLink, num, schoolName, sectionHeading, spellLink, statusPill } from './ui';
import type { RefSection } from './reference';

/** A few words of playstyle per School (the rest of the card is data). */
const PLAYSTYLE: Record<School, string> = {
  fire: 'The highest raw damage at the Academy. Burns tick on everything you touch, explosions clear ledges, and a few spells trade safety for power.',
  ice: 'Control first, then the killing frost. Slow and freeze whole packs, shatter what is frozen, and hide behind the thickest armour of any School.',
  lightning: 'Fast, mobile and wonderful against crowds. Chains leap from foe to foe, shocks make everything take more damage, and stuns buy time.',
  holy: 'Sustain, smite and control. The best healing at the Academy, stuns on almost every spell, and the answer to the undead and the void.',
  shadow: 'Attrition. Curse a foe so everything hurts more, let poison tick, drain life back, and let your summoned servants share the work.',
};

/** Statuses a School's spells apply (from the spells themselves). */
export function schoolStatuses(s: School): StatusKind[] {
  const set = new Set<StatusKind>();
  for (const j of schoolJobs(s)) for (const sk of skillsOf(j.id)) { const st = attackOf(sk)?.status?.kind; if (st) set.add(st); }
  return [...set];
}

function allocList(a: Alloc): HTMLElement {
  return h('ul.alloc', Object.entries(a).map(([id, lv]) => {
    const s = Registry.skill(id);
    return h('li', spellLink(id), h('span.alloc-lv', { title: s ? `max ${s.maxLevel}` : '' }, `${lv}${s && lv >= s.maxLevel ? ' (max)' : ''}`));
  }));
}

function buildCard(b: Build): HTMLElement {
  const c = checkBuild(b);
  if (c.problems.length && import.meta.env.DEV) console.warn(`[guide] build "${b.name}":`, c.problems);
  const yearLabel = ['Year 1 (core)', 'Year 2', 'Year 3', 'Year 4', `Year ${FELLOWSHIP_YEAR}`];
  return h('article.build',
    h('h5', b.name),
    h('p.small', b.style),
    h('div.build-years', [CORE_PLAN, ...b.years].map((a, i) => h('div.build-year',
      h('h6', yearLabel[i], h('small', ` ${allocCost(a)} SP`)),
      allocList(a),
    ))),
    h('p.budget', c.problems.length
      ? h('span.error', `Needs attention: ${c.problems.join('; ')}`)
      : `${num(c.cost[3])} of the ${num(c.budget[3])} SP a level ${MAX_LEVEL} graduate has. Each Year fits the SP you have before the next Year opens (${c.cost.map((x, i) => `${num(x)}/${num(c.budget[i])}`).join(', ')}).`),
    h('ul.list.small', b.notes.map(n => h('li', text(n)))),
  );
}

function matchups(g: Guide, s: School): HTMLElement {
  const el = s as Element;
  const sts = schoolStatuses(s);
  const normal = g.monsters;
  const weak = normal.filter(m => m.weak?.includes(el));
  const resist = normal.filter(m => m.resist?.includes(el));
  const immune = normal.filter(m => m.immune?.some(x => sts.includes(x)));
  const list = (ms: MonsterDef[]) => (ms.length ? h('span.mon-list', ms.map((m, i) => [i ? ', ' : '', monsterLink(m.id)])) : h('span.muted', 'none'));
  return h('dl.facts.matchups',
    h('dt', 'Weak to ', elemPill(el)), h('dd', list(weak)),
    h('dt', 'Resist ', elemPill(el)), h('dd', list(resist)),
    h('dt', 'Immune to ', sts.map((x, i) => [i ? ' ' : '', statusPill(x)])), h('dd', list(immune)),
  );
}

function schoolGear(g: Guide, s: School): HTMLElement | null {
  const gear = g.items.filter(i => i.equip?.reqBranch === s).sort((a, b) => (a.equip!.reqLevel - b.equip!.reqLevel));
  if (!gear.length) return null;
  return h('p.small', h('strong', 'School gear: '), gear.map((it, i) => [i ? ', ' : '', itemLink(it.id), h('small', ` Lv ${it.equip!.reqLevel}`)]));
}

function schoolSection(g: Guide, s: School): HTMLElement {
  const jobs = schoolJobs(s);
  const prof = SCHOOL_PROFESSOR[s];
  return h('section.school', { id: anchor.school(s), class: `sc-${s}` },
    sectionHeading(3, `${anchor.school(s)}-h`, `School of ${schoolName(s)}`, 'The Five Schools'),
    h('div.school-hero',
      h('div.school-hero-text',
        h('p.lead', PLAYSTYLE[s]),
        h('p', 'Head of School: ', npcLink(prof, true), `. Declare it as your major with the Headmistress at the end of Year 1 (level ${JOB_LEVELS[2]}+). Your Professor teaches your major class every Year after; its last mission is that Year's final, and the Year 4 final is the Fellowship Exam (level ${JOB_LEVELS[FELLOWSHIP_YEAR]}, graduates only) that leads to Archon.`),
        matchups(g, s),
        schoolGear(g, s),
      ),
      h('div.school-hero-jobs', jobs.map(j => h('figure.job',
        jobImg(j.id, 2),
        h('figcaption', h('small', `Year ${j.tier} · Lv ${j.requiredLevel}`), h('strong', j.name), h('span.small', jobBlurb(j.description))),
      ))),
    ),
    jobs.map(j => {
      const list = skillsOf(j.id);
      return h('div.year-spells',
        h('h4', { id: `spells-${j.id}` }, `Year ${j.tier} · ${j.name}`, h('small.muted', ` ${list.length} spells · ${num(spToMax(list))} SP to max all`)),
        spellTable(list),
      );
    }),
    h('h4', { id: `builds-${s}` }, 'Suggested builds'),
    h('div.builds', BUILDS[s].map(buildCard)),
  );
}

export function coreSection(g: Guide): RefSection {
  const list = skillsOf('apprentice');
  const el = h('section.ref', { id: 'core' },
    sectionHeading(2, 'core-h', 'Year 1 Core Curriculum', 'Reference'),
    h('div.school-hero',
      h('div.school-hero-text',
        h('p.lead', 'Every student studies the same ', String(list.length), ' spells in Year 1, and keeps them for life. They cost the same SP as School spells, so what you take here is a real choice.'),
        h('p', jobBlurb(Registry.job('apprentice')?.description ?? '')),
        h('p', `Arcane Bolt starts at level 1 for free. By level ${JOB_LEVELS[2] - 1} a student has earned ${spAtLevel(JOB_LEVELS[2] - 1)} SP; maxing the whole curriculum would take ${num(spToMax(list))}.`),
      ),
      h('div.school-hero-jobs', h('figure.job', jobImg('apprentice', 2), h('figcaption', h('small', 'Year 1'), h('strong', 'Apprentice')))),
    ),
    spellTable(list),
    h('h4', 'A Year 1 plan'),
    h('p', `The builds in the Five Schools all start from this ${allocCost(CORE_PLAN)}-SP core: a strong Arcane Bolt, an AoE for crowds, Blink for mobility and the two passives that help every School.`),
    allocList(CORE_PLAN),
  );
  return { id: 'core', title: 'Year 1 Core Curriculum', el };
}

export function schoolsSection(g: Guide): RefSection {
  const el = h('section.ref', { id: 'schools' },
    sectionHeading(2, 'schools-h', 'The Five Schools', 'Reference'),
    h('p.lead', `At the end of Year 1 (level ${JOB_LEVELS[2]}+) you declare one School as your major, for life. Each has ${schoolJobs('fire').reduce((n, j) => n + skillsOf(j.id).length, 0)} spells over Years 2–${FELLOWSHIP_YEAR}, its own statuses, and its own answers to the Academy's monsters. Spell damage is a % of your Magic ATK per hit, shown from level 1 to the spell's max level.`),
    h('div.schools-grid', SCHOOLS.map(s => h('a.school-tile', { href: `#${anchor.school(s)}`, class: `sc-${s}` },
      portraitImg(SCHOOL_PROFESSOR[s], 48), h('strong', schoolName(s)), h('small', schoolJobs(s).map(j => j.name).join(' → ')),
    ))),
    h('p.small', `SP budget: a student has ${spAtLevel(JOB_LEVELS[3] - 1)} SP by level ${JOB_LEVELS[3] - 1}, ${spAtLevel(JOB_LEVELS[4] - 1)} by level ${JOB_LEVELS[4] - 1}, ${spAtLevel(JOB_LEVELS[FELLOWSHIP_YEAR] - 1)} by level ${JOB_LEVELS[FELLOWSHIP_YEAR] - 1} and ${spAtLevel(MAX_LEVEL)} at level ${MAX_LEVEL}; one School's spells alone take ${num(schoolJobs('fire').reduce((n, j) => n + spToMax(skillsOf(j.id)), 0))} SP to max. Nobody can learn everything.`),
    SCHOOLS.map(s => schoolSection(g, s)),
  );
  return { id: 'schools', title: 'The Five Schools', el };
}
