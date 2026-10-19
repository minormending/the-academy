// Walkthrough blocks: text, tips and lists, plus the data blocks expanded from the game's own modules (zone
// panels with drawn maps, quest cards, boss cards, exam tables, School cards, training planners, shops).

import type { MapDef, MonsterDef, QuestDef } from '../core/types';
import { Registry } from '../core/registry';
import { expToNext } from '../core/balance';
import { JOB_LEVELS } from '../core/constants';
import { SCHOOLS, SCHOOL_PROFESSOR, isSchool, type School } from '../data/jobs';
import { STORY_FLOW } from '../data/storyQuests';
import { JOB_QUEST_IDS, FIELD_BOUNTY_QUEST_IDS } from '../data/quests';
import { MonsterManager } from '../systems/MonsterManager';
import { h, inline, type Child } from './dom';
import { guideAsset, jobImg, monsterImg, npcImg as npcImgFor, portraitImg } from './art';
import { BOSS_NOTES } from './bossNotes';
import type { Guide } from './context';
import { isFieldBoss, schoolJobs } from './context';
import { mapCanvasSize, renderMap } from './mapRender';
import type { Block } from './types';
import {
  anchor, chance, elemPills, expand, facts, itemLink, keyText, lvRange, mapLink, mesos, monsterLink, npcLink, num, questLink,
  range, schoolName, secs, statusPill,
} from './ui';

// ─────────────────────────── ids ───────────────────────────

/** Element ids already used, so a zone shown twice gets `zone-x` then `zone-x-2`. */
const usedIds = new Map<string, number>();
export function uniqueId(base: string): string {
  const n = (usedIds.get(base) ?? 0) + 1;
  usedIds.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

// ─────────────────────────── dispatch ───────────────────────────

/** Writer prose: tokens expanded, then inline markup. */
export const text = (s: string) => inline(expand(s));
const note = (s?: string) => (s ? h('p.note', text(s)) : null);

export function renderBlock(g: Guide, b: Block): HTMLElement {
  if ('p' in b) return h('p', text(b.p));
  if ('tip' in b) return h('aside.tip', h('strong.tip-title', b.title ?? 'Tip'), h('div', text(b.tip)));
  if ('list' in b) return h('ul.list', b.list.map(li => h('li', text(li))));
  if ('checklist' in b) {
    return h('aside.checklist', h('strong.tip-title', 'Before you move on'),
      h('ul', b.checklist.map(li => h('li', h('span.box', { 'aria-hidden': 'true' }), h('span', text(li))))));
  }
  if ('zone' in b) return zonePanel(g, b.zone, b.note);
  if ('quest' in b) return questCard(g, b.quest, b.note);
  if ('quests' in b) return questTable(g, b.quests, b.title);
  if ('boss' in b) return bossCard(g, b.boss, b.note);
  if ('exams' in b) return examTable(g, b.exams);
  if ('schools' in b) return schoolsOverview(g);
  if ('school' in b) return schoolCard(g, b.school);
  if ('training' in b) return trainingTable(g, b.training[0], b.training[1]);
  if ('npc' in b) return npcCard(g, b.npc, b.note);
  if ('shop' in b) return shopTable(g, b.shop);
  if ('image' in b) {
    return h('figure.shot', h('img', { src: guideAsset(b.image), alt: b.alt, loading: 'lazy' }), b.caption ? h('figcaption', text(b.caption)) : null);
  }
  return h('p.error', 'Unknown block');
}

// ─────────────────────────── lazy pictures ───────────────────────────

const pending = new Set<() => Promise<void>>();
let observer: IntersectionObserver | null = null;
function lazy(el: HTMLElement & { __render?: () => void }, run: () => Promise<void>) {
  let done = false;
  const once = async () => { if (done) return; done = true; pending.delete(once); observer?.unobserve(el); await run(); };
  pending.add(once);
  if (typeof IntersectionObserver === 'undefined') { void once(); return; }
  observer ??= new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) (e.target as HTMLElement & { __render?: () => void }).__render?.();
  }, { rootMargin: '900px 0px' });
  el.__render = () => void once();
  observer.observe(el);
}
/** Draw every remaining map (before printing). */
export async function renderAllPending(): Promise<void> {
  for (const run of [...pending]) await run();
}

// ─────────────────────────── map pictures ───────────────────────────

function marker(def: MapDef, x: number, y: number, cls: string, label: Child, title: string): HTMLElement {
  const left = (x / def.width) * 100, top = Math.max(4, (y / def.height) * 100);
  // Labels near either edge hang inwards so they never get cut off.
  const edge = left < 10 ? ' mk-l' : left > 90 ? ' mk-r' : '';
  const pos = edge === ' mk-l' ? `left:0.5%` : edge === ' mk-r' ? `right:0.5%` : `left:${left}%`;
  return h('span.mk', { class: cls + edge, style: `${pos};top:${top}%`, title }, label);
}

/** The drawn map with labels for portals, staff and field bosses. Click to see it at full size. */
export function mapFigure(def: MapDef): HTMLElement {
  const { w, h: hh } = mapCanvasSize(def);
  const canvas = h<HTMLCanvasElement>('canvas.map-canvas', { width: w, height: hh, role: 'img', 'aria-label': `Map of ${def.name}` });
  const inner = h('div.map-inner', { style: `--map-w:${w}px` }, canvas);
  const frame = h('div.map-frame', inner);
  for (const p of def.portals) {
    if (p.hidden) continue;
    const to = Registry.map(p.targetMap)?.name ?? p.targetMap;
    inner.appendChild(marker(def, p.x, p.y - 150, 'mk-portal', h('span', `⇢ ${to}`), `Portal to ${to}`));
  }
  for (const n of def.npcs) {
    const npc = Registry.npc(n.npcId);
    const short = npc?.name.replace(/^(Headmistress|Professor|Prefect) /, '') ?? n.npcId;
    inner.appendChild(marker(def, n.x, n.y - 104, 'mk-npc', short, npc ? `${npc.name}, ${npc.title ?? ''}` : n.npcId));
  }
  for (const s of def.spawns) {
    const m = Registry.monster(s.monsterId);
    if (!m?.boss) continue;
    inner.appendChild(marker(def, (s.x1 + s.x2) / 2, s.y - m.size.h - 70, 'mk-boss', `★ ${m.name}`, `${m.name} (Lv ${m.level})`));
  }
  const fig = h('figure.map-fig', frame,
    h('figcaption.map-legend',
      h('span', `${num(def.width)} × ${num(def.height)} px`),
      h('span', `${def.platforms.length} platforms`),
      def.ropes.length ? h('span', `${def.ropes.filter(r => r.kind === 'rope').length} ropes, ${def.ropes.filter(r => r.kind === 'ladder').length} ladders`) : null,
      h('span.muted', 'Click the map to see it at full size'),
    ));
  frame.addEventListener('click', () => fig.classList.toggle('zoom'));
  lazy(frame, async () => {
    frame.classList.add('loading');
    try { await renderMap(def, canvas); } catch (e) { console.warn('[guide] map render failed', def.id, e); }
    frame.classList.remove('loading');
  });
  return fig;
}

// ─────────────────────────── monsters ───────────────────────────

/** Where a monster lives, as links. */
export function homesOf(g: Guide, id: string): Child {
  const homes = g.monsterHome.get(id) ?? [];
  return homes.length ? homes.map((s, i) => [i ? ', ' : '', mapLink(s.map)]) : h('span.muted', 'Trial Hall waves only');
}

/** The etc drop and anything rarer than potions, for compact tables. */
export function keyDrops(m: MonsterDef, limit = 3): Child {
  const ds = m.drops.filter(d => Registry.item(d.itemId)?.type !== 'consumable').slice(0, limit);
  return ds.length ? ds.map((d, i) => [i ? ' ' : '', h('span.drop', itemLink(d.itemId), h('small', ` ${chance(d.chance)}`))]) : h('span.muted', '—');
}

/** Kill EXP at the monster's own level, and how many kills a level takes there. */
export const killsForLevel = (m: MonsterDef) => Math.ceil(expToNext(m.level) / Math.max(1, m.exp));

export function monsterRows(g: Guide, ids: { monster: string; count?: number }[], withCount = true): HTMLElement {
  return h('div.scroll', h('table.mons',
    h('thead', h('tr',
      h('th', 'Monster'), h('th.num', 'Lv'), h('th.num', 'HP'), h('th.num', 'EXP'),
      h('th.num', { title: 'Kills at its level to gain one level' }, 'Kills/lv'),
      withCount ? h('th.num', { title: 'How many share the map at once' }, 'On map') : null,
      h('th', 'Weak'), h('th', 'Resists'), h('th', 'Drops'),
    )),
    h('tbody', ids.map(({ monster: id, count }) => {
      const m = Registry.monster(id);
      if (!m) return h('tr', h('td', { colspan: 9 }, id));
      return h('tr', { class: m.boss ? 'boss-row' : '' },
        h('td', h('div.mon-cell', monsterImg(id, 40), h('div', monsterLink(id), m.boss ? h('span.badge', isFieldBoss(id) ? 'Field boss' : 'Boss') : null))),
        h('td.num', m.level), h('td.num', num(m.hp)), h('td.num', num(m.exp)),
        h('td.num', m.boss ? '—' : num(killsForLevel(m))),
        withCount ? h('td.num', count ?? '—') : null,
        h('td', elemPills(m.weak)), h('td', elemPills(m.resist)),
        h('td.small', keyDrops(m)),
      );
    })),
  ));
}

// ─────────────────────────── zone panel ───────────────────────────

export function connections(def: MapDef): Child {
  return def.portals.filter(p => !p.hidden).map((p, i) => [i ? ' · ' : '', h('span', `${p.id} → `, mapLink(p.targetMap))]);
}

export function zonePanel(g: Guide, id: string, noteText?: string): HTMLElement {
  const def = Registry.map(id);
  if (!def) return h('p.error', `Unknown map ${id}`);
  const mons = g.mapMonsters.get(id) ?? [];
  return h('section.zone-panel', { id: uniqueId(anchor.zone(id)) },
    h('div.zone-head',
      h('h4', def.name),
      h('div.tags',
        h('span.tag', def.region),
        h('span.tag.lv', def.safe ? 'Safe zone' : lvRange(def.levelRange)),
        mons.some(m => Registry.monster(m.monster)?.boss) ? h('span.tag.warn', 'Field boss') : null,
      ),
    ),
    note(noteText),
    mapFigure(def),
    facts([
      ['Portals', connections(def)],
      ['Staff', def.npcs.length ? def.npcs.map((n, i) => [i ? ', ' : '', npcLink(n.npcId)]) : null],
    ]),
    mons.length ? monsterRows(g, mons) : null,
  );
}

// ─────────────────────────── quests ───────────────────────────

export type QuestKind = 'story' | 'exam' | 'bounty' | 'assignment';
export function questKind(id: string): QuestKind {
  if (STORY_FLOW[id]) return 'story';
  if (JOB_QUEST_IDS.has(id)) return 'exam';
  if (FIELD_BOUNTY_QUEST_IDS.includes(id)) return 'bounty';
  return 'assignment';
}
const KIND_LABEL: Record<QuestKind, string> = { story: 'Main story', exam: 'Year-end Exam', bounty: 'Field Bounty', assignment: 'Assignment' };

export function objectiveLine(o: QuestDef['objectives'][number]): Child {
  if (o.kind === 'kill') return ['Defeat ', h('strong', num(o.count)), ' ', monsterLink(o.monsterId, true)];
  if (o.kind === 'collect') return ['Bring ', h('strong', num(o.count)), ' ', itemLink(o.itemId)];
  if (o.kind === 'visit') return ['Travel to ', h('strong', Registry.map(o.mapId)?.name ?? o.mapId)];
  if (o.kind === 'talk') return ['Talk to ', h('strong', Registry.npc(o.npcId)?.name ?? o.npcId)];
  return ['Reach ', h('strong', `level ${o.level}`)];
}

export function rewardLine(q: QuestDef, merits = 0): Child {
  const r = q.rewards;
  const parts: Child[] = [];
  if (r.exp) parts.push(h('span.rw', `${num(r.exp)} EXP`));
  if (r.mesos) parts.push(h('span.rw', mesos(r.mesos)));
  for (const it of r.items ?? []) parts.push(h('span.rw', itemLink(it.itemId, true, it.qty)));
  if (merits) parts.push(h('span.rw', `${num(merits)} Academy Merits`));
  return parts.length ? parts.flatMap((p, i) => (i ? [h('span.sep', { 'aria-hidden': 'true' }, '·'), p] : [p])) : h('span.muted', '—');
}

/** Where to find what a quest asks for. */
function objectiveWhere(g: Guide, o: QuestDef['objectives'][number]): Child {
  if (o.kind === 'kill') return homesOf(g, o.monsterId);
  if (o.kind === 'collect') {
    const all = g.dropSources.get(o.itemId) ?? [];
    const normal = all.filter(d => !Registry.monster(d.monster)?.boss);
    const src = (normal.length ? normal : all).slice(0, 3);
    const shop = g.bram.find(s => s.itemId === o.itemId);
    return [
      ...src.map((d, i) => [i ? ', ' : '', monsterLink(d.monster), h('small', ` ${chance(d.chance)}`)]),
      shop ? [src.length ? ', ' : '', 'Bram sells it for ', mesos(shop.price)] : null,
    ];
  }
  return null;
}

function giverOf(q: QuestDef): Child {
  if (STORY_FLOW[q.id]?.anyProfessor) return h('span', 'any Professor (e.g. ', npcLink(q.giver), ')');
  return npcLink(q.giver);
}

export function questCard(g: Guide, id: string, noteText?: string, extraMerits = 0): HTMLElement {
  const q = Registry.quest(id);
  if (!q) return h('p.error', `Unknown quest ${id}`);
  const kind = questKind(id);
  const flow = STORY_FLOW[id];
  const school = isSchool(q.requiredJobBranch) ? q.requiredJobBranch : null;
  return h('article.quest-card', { id: uniqueId(anchor.quest(id)), class: `qk-${kind}` },
    h('div.quest-head',
      portraitImg(q.giver, 56),
      h('div',
        h('span.kicker', [KIND_LABEL[kind], flow?.tag && flow.tag !== KIND_LABEL[kind] ? ` · ${flow.tag}` : '', school ? ` · ${schoolName(school)} School` : '']),
        h('h4', q.name),
        h('div.quest-meta',
          h('span', 'From ', giverOf(q)),
          h('span', `Level ${q.minLevel}+`),
          flow?.minTier && flow.minTier > 1 ? h('span', `Year ${flow.minTier}+`) : null,
          flow?.prev ? h('span', 'After ', questLink(flow.prev)) : null,
          flow?.talk ? h('span.tag', 'Talk only') : null,
        ),
      ),
    ),
    h('p.quest-desc', keyText(q.description)),
    q.objectives.length ? h('ul.objectives', q.objectives.map(o => h('li', objectiveLine(o), (() => { const w = objectiveWhere(g, o); return w ? h('div.where', 'Where: ', w) : null; })()))) : null,
    h('div.rewards', h('strong', 'Reward '), rewardLine(q, extraMerits)),
    note(noteText),
  );
}

export function questTable(g: Guide, ids: string[], title?: string): HTMLElement {
  return h('div.quest-table',
    title ? h('h5', title) : null,
    h('div.scroll', h('table.quests',
      h('thead', h('tr', h('th', 'Assignment'), h('th', 'From'), h('th.num', 'Lv'), h('th', 'Objectives'), h('th', 'Reward'))),
      h('tbody', ids.map(id => {
        const q = Registry.quest(id);
        if (!q) return h('tr', h('td', { colspan: 5 }, id));
        return h('tr', { id: uniqueId(anchor.quest(id)) },
          h('td', h('strong', q.name)),
          h('td', npcLink(q.giver, true)),
          h('td.num', q.minLevel),
          h('td.small', q.objectives.map((o, i) => [i ? h('br') : null, objectiveLine(o)])),
          h('td.small', rewardLine(q)),
        );
      })),
    )),
  );
}

// ─────────────────────────── bosses ───────────────────────────

let timers: { first: number; back: number } | null = null;
/** The field boss timers, read from a MonsterManager instance (they are instance fields). */
function bossTimers() {
  if (!timers) {
    try {
      const mm = new MonsterManager(null as never, null as never);
      timers = { first: mm.fieldBossFirstDelayMs, back: mm.fieldBossReturnDelayMs };
    } catch { timers = { first: 0, back: 0 }; }
  }
  return timers;
}

export function bossCard(g: Guide, id: string, noteText?: string): HTMLElement {
  const m = Registry.monster(id);
  if (!m) return h('p.error', `Unknown boss ${id}`);
  const nt = BOSS_NOTES[id];
  const home = g.monsterHome.get(id)?.[0];
  const spawn = home ? Registry.map(home.map)?.spawns.find(s => s.monsterId === id) : undefined;
  const t = bossTimers();
  const field = isFieldBoss(id);
  const bounty = Registry.quest(`q_bounty_${id}`);
  const thesis = g.story.find(q => q.objectives.some(o => o.kind === 'kill' && o.monsterId === id));
  const respawn = spawn?.respawnMs ?? home?.respawnMs ?? 0;
  return h('article.boss-card', { id: uniqueId(anchor.boss(id)) },
    h('div.boss-head',
      h('div.boss-art', monsterImg(id, 220, 'idle')),
      h('div.boss-body',
        h('span.kicker', field ? `Field boss · ${home ? Registry.map(home.map)?.name : ''}` : 'Boss'),
        h('h4', m.name),
        nt ? h('p.tagline', nt.tagline) : null,
        h('div.boss-stats',
          stat('Level', m.level), stat('HP', num(m.hp)), stat('EXP', num(m.exp)), stat('Mesos', range(m.mesos[0], m.mesos[1])),
          stat('Touch', num(m.touchDamage)), stat('DEF', num(m.def)),
        ),
        facts([
          ['Weak to', elemPills(m.weak)],
          ['Resists', elemPills(m.resist)],
          ['Immune', m.immune?.length ? h('span.pills', m.immune.map(statusPill)) : h('span.muted', '—')],
          ['Where', home ? [mapLink(home.map), field
            // MonsterManager jitters a field boss's respawn by ±20%.
            ? ` · appears ${secs(t.first)} into your first visit, then ${secs(respawn * 0.8)}–${secs(respawn * 1.2)} after it falls${t.back ? ` (${secs(t.back)} after you come back, if it was due)` : ''}`
            : respawn ? ` · returns ${secs(respawn)} after it falls` : ''] : null],
          ['Bounty', bounty ? questLink(bounty.id) : thesis ? questLink(thesis.id) : null],
        ]),
      ),
    ),
    note(noteText),
    nt ? h('div.boss-cols',
      h('div', h('h5', 'Attacks'), h('dl.attacks', nt.attacks.map(a => [h('dt', a.name), h('dd', a.text)]))),
      h('div', h('h5', 'Strategy'), h('ul.list', nt.strategy.map(s => h('li', text(s))))),
    ) : null,
    h('h5', 'Drops'),
    dropList(m),
  );
}

const stat = (label: string, v: Child) => h('div.stat', h('small', label), h('strong', v));

export function dropList(m: MonsterDef): HTMLElement {
  return h('ul.drops', [...m.drops].sort((a, b) => b.chance - a.chance).map(d => h('li',
    itemLink(d.itemId), h('small', ` ${chance(d.chance)}${(d.max ?? 1) > 1 ? ` · ${range(d.min ?? 1, d.max ?? 1)}` : ''}`),
  )));
}

// ─────────────────────────── exams ───────────────────────────

export function examTable(g: Guide, year: 3 | 4): HTMLElement {
  const lv = JOB_LEVELS[year];
  return h('div.exam-table',
    h('div.scroll', h('table.exams',
      h('thead', h('tr', h('th', 'School'), h('th', 'Professor'), h('th', 'Exam'), h('th', 'Objectives'), h('th', 'Where'), h('th', 'Pass to become'))),
      h('tbody', SCHOOLS.map(s => {
        const q = g.exams[s][year];
        const target = schoolJobs(s)[year - 2];
        return h('tr', { id: q ? uniqueId(anchor.quest(q.id)) : undefined },
          h('td', h('a.school-link', { href: `#${anchor.school(s)}`, class: `sc-${s}` }, schoolName(s))),
          h('td', npcLink(SCHOOL_PROFESSOR[s], true)),
          h('td', q ? h('strong', q.name.replace(/^Year \d Exam: /, '')) : '—'),
          h('td.small', q ? q.objectives.map((o, i) => [i ? h('br') : null, objectiveLine(o)]) : '—'),
          h('td.small', q ? q.objectives.map((o, i) => [i ? h('br') : null, objectiveWhere(g, o)]) : '—'),
          h('td', target ? h('div.job-cell', jobImg(target.id, 1), h('strong', target.name)) : '—'),
        );
      })),
    )),
    (() => {
      const q = g.exams.fire[year];
      return q ? h('p.small', `Every exam opens at level ${lv} and pays the same reward: `, rewardLine(q), '. Passing also grants the new title and bonus SP.') : null;
    })(),
  );
}

// ─────────────────────────── Schools ───────────────────────────

/** "Year 2 · School of Fire. Fire answers…" → the sentence after the prefix. */
export const jobBlurb = (desc: string) => desc.replace(/^Year \d · [^.]+\.\s*/, '');

export function schoolsOverview(g: Guide): HTMLElement {
  return h('div.schools-grid', SCHOOLS.map(s => schoolCard(g, s, true)));
}

export function schoolCard(g: Guide, s: School, compact = false): HTMLElement {
  const jobs = schoolJobs(s);
  return h('article.school-card', { class: `sc-${s}` },
    h('div.school-card-head',
      portraitImg(SCHOOL_PROFESSOR[s], 48),
      h('div', h('span.kicker', `${Registry.npc(SCHOOL_PROFESSOR[s])?.name ?? ''}`), h('h4', h('a', { href: `#${anchor.school(s)}` }, `School of ${schoolName(s)}`))),
    ),
    h('div.school-jobs', jobs.map(j => h('figure', jobImg(j.id, 1), h('figcaption', h('small', `Year ${j.tier}`), j.name)))),
    compact ? h('p.small', jobBlurb(jobs[0]?.description ?? '')) : null,
  );
}

// ─────────────────────────── training planner ───────────────────────────

export function trainingTable(g: Guide, min: number, max: number): HTMLElement {
  const rows: { m: MonsterDef; map: string; count: number }[] = [];
  for (const [mapId, list] of g.mapMonsters) {
    for (const e of list) {
      const m = Registry.monster(e.monster);
      if (!m || m.boss || m.level < min - 2 || m.level > max + 2) continue;
      rows.push({ m, map: mapId, count: e.count });
    }
  }
  rows.sort((a, b) => a.m.level - b.m.level || g.zoneOrder.indexOf(a.map) - g.zoneOrder.indexOf(b.map));
  return h('div.scroll', h('table.training',
    h('caption', `Training between levels ${min} and ${max}`),
    h('thead', h('tr', h('th', 'Monster'), h('th.num', 'Lv'), h('th', 'Zone'), h('th.num', 'On map'), h('th.num', 'HP'), h('th.num', 'EXP'),
      h('th.num', { title: 'EXP per 100 HP dealt: higher is faster' }, 'EXP/100 HP'), h('th.num', { title: 'Kills at its level for one level' }, 'Kills/lv'), h('th', 'Weak'))),
    h('tbody', rows.map(({ m, map, count }) => h('tr',
      h('td', h('div.mon-cell', monsterImg(m.id, 32), monsterLink(m.id))),
      h('td.num', m.level), h('td', mapLink(map)), h('td.num', count), h('td.num', num(m.hp)), h('td.num', num(m.exp)),
      h('td.num', (m.exp / m.hp * 100).toFixed(1)), h('td.num', num(killsForLevel(m))), h('td', elemPills(m.weak)),
    ))),
  ));
}

// ─────────────────────────── staff ───────────────────────────

export function npcCard(g: Guide, id: string, noteText?: string): HTMLElement {
  const n = Registry.npc(id);
  if (!n) return h('p.error', `Unknown NPC ${id}`);
  const place = g.npcPlace.get(id);
  const gives = g.quests.filter(q => q.giver === id && questKind(q.id) !== 'exam');
  const school = SCHOOLS.find(s => SCHOOL_PROFESSOR[s] === id);
  const exams = school ? [g.exams[school][3], g.exams[school][4]].filter((q): q is QuestDef => !!q) : [];
  const offers: Child[] = [];
  if (g.bram.length && id === 'merchant_bram') offers.push(h('a', { href: '#shops' }, 'Supplies'), ' and the ', h('a', { href: '#trial-hall' }, 'Merit Exchange'));
  if (g.tilda.length && id === 'smith_tilda') offers.push(h('a', { href: '#shops' }, 'Armory'));
  if (id === 'elder_maelis') offers.push(`Declares your School at level ${JOB_LEVELS[2]}`);
  if (school) offers.push(h('a', { href: `#${anchor.school(school)}` }, `Head of the ${schoolName(school)} School`), ' (sets its Year-end Exams)');
  return h('article.npc-card', { id: uniqueId(anchor.npc(id)) },
    h('div.npc-art', npcImgFor(id)),
    h('div',
      h('span.kicker', n.title ?? ''),
      h('h4', n.name),
      facts([
        ['Where', place ? mapLink(place.map) : null],
        ['Offers', offers.length ? offers : null],
        ['Exams', exams.length ? exams.map((q, i) => [i ? ', ' : '', questLink(q.id)]) : null],
        ['Quests', gives.length ? gives.map((q, i) => [i ? ', ' : '', questLink(q.id)]) : null],
      ]),
      note(noteText),
    ),
  );
}

// ─────────────────────────── shops ───────────────────────────

export function shopTable(g: Guide, which: 'bram' | 'tilda' | 'merit'): HTMLElement {
  if (which === 'merit') {
    return h('div.scroll', h('table.shop',
      h('caption', 'Merit Exchange (Quartermaster Bram)'),
      h('thead', h('tr', h('th', 'Item'), h('th', 'Shelf'), h('th.num', 'Qty'), h('th.num', 'Merits'), h('th.num', 'Per item'))),
      h('tbody', g.merit.map(o => h('tr',
        h('td', itemLink(o.itemId)), h('td', o.page === 'study' ? 'Study Aids' : 'Field Trophies'),
        h('td.num', o.qty), h('td.num', num(o.cost)), h('td.num', num(o.cost / o.qty)),
      ))),
    ));
  }
  if (which === 'bram') {
    return h('div.scroll', h('table.shop',
      h('caption', 'Quartermaster Bram'),
      h('thead', h('tr', h('th', 'Item'), h('th', 'Effect'), h('th.num', 'Price'), h('th.num', 'Sells for'))),
      h('tbody', g.bram.map(s => {
        const it = Registry.item(s.itemId);
        return h('tr', h('td', itemLink(s.itemId)), h('td.small', it?.description ?? ''), h('td.num', num(s.price)), h('td.num', num(it?.sellPrice ?? 0)));
      })),
    ));
  }
  return h('div.scroll', h('table.shop',
    h('caption', 'Armorer Tilda'),
    h('thead', h('tr', h('th', 'Item'), h('th', 'Slot'), h('th.num', 'Req. Lv'), h('th', 'School'), h('th.num', 'In stock from'), h('th.num', 'Price'))),
    h('tbody', g.tilda.map(s => {
      const it = Registry.item(s.itemId);
      const b = it?.equip?.reqBranch;
      return h('tr', h('td', itemLink(s.itemId)), h('td', it?.equip?.slot ?? ''), h('td.num', it?.equip?.reqLevel ?? ''),
        h('td', isSchool(b) ? schoolName(b) : 'Any'), h('td.num', `Lv ${s.fromLevel}`), h('td.num', num(s.price)));
    })),
  ));
}
