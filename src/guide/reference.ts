// Reference sections: Bestiary, Atlas, Items & gear, Trial Hall, Familiar, Respec, Assignments and Progression.
// Every row comes from the game's modules.

import type { ItemDef, MonsterDef, QuestDef } from '../core/types';
import { Registry } from '../core/registry';
import { expToNext, refMonsterExp, SP_PER_LEVEL, AP_PER_LEVEL } from '../core/balance';
import { MAX_LEVEL, TOWN_MAP } from '../core/constants';
import { ARENA_TUNING, bonusExpForWave, meritsForWave } from '../systems/ArenaSystem';
import { DEATH_EXP_PENALTY, JOB_ADVANCE_BONUS_SP, MAX_INVENTORY_STACKS, killExpMultiplier } from '../systems/Progression';
import { DEFAULT_SETTINGS } from '../core/settings';
import { GRADUATION_MERITS } from '../data/npcScripts';
import { HONOR_CATEGORIES, availableHonors } from '../data/honors';
import { isSchool } from '../data/jobs';
import { append, h, type Child } from './dom';
import { iconImg, monsterImg } from './art';
import type { Guide } from './context';
import { isFieldBoss } from './context';
import {
  connections, dropList, homesOf, killsForLevel, mapFigure, npcCard, objectiveLine, questKind, rewardLine, shopTable,
} from './blocks';
import { modsText } from './spells';
import {
  anchor, chance, elemPills, facts, itemLink, kbd, lvRange, mapLink, mesos, monsterLink, npcLink, num, pct, questLink,
  range, schoolName, secs, sectionHeading, statusPill,
} from './ui';

export interface RefSection { id: string; title: string; el: HTMLElement }

const BEHAVIOR: Record<MonsterDef['behavior'], string> = {
  walker: 'Walks', hopper: 'Hops', flyer: 'Flies', stationary: 'Stationary', boss: 'Boss AI',
};

// ─────────────────────────── filter toolbar ───────────────────────────

/** A text filter over cards/rows carrying data-key. */
function filterBar(target: () => HTMLElement, placeholder: string, extra?: HTMLElement): HTMLElement {
  const input = h<HTMLInputElement>('input.filter', { type: 'search', placeholder, 'aria-label': placeholder });
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    for (const el of Array.from(target().querySelectorAll<HTMLElement>('[data-key]'))) el.hidden = !!q && !el.dataset.key!.includes(q);
  });
  return h('div.toolbar', input, extra ?? null);
}

// ─────────────────────────── Bestiary ───────────────────────────

function monsterCard(g: Guide, m: MonsterDef): HTMLElement {
  const homes = g.monsterHome.get(m.id) ?? [];
  const key = [m.name, ...(m.weak ?? []), ...homes.map(x => Registry.map(x.map)?.name ?? '')].join(' ').toLowerCase();
  return h('article.mon-card', { id: anchor.monster(m.id), 'data-key': key, class: m.boss ? 'is-boss' : '' },
    h('div.mon-art', monsterImg(m.id, 128)),
    h('div.mon-body',
      h('span.kicker', `Lv ${m.level} · ${BEHAVIOR[m.behavior]}${m.aggressive === false ? ' · passive' : ''}`),
      h('h3', m.name, m.boss ? h('span.badge', isFieldBoss(m.id) ? 'Field boss' : 'Boss') : null),
      h('div.mon-stats',
        h('span', h('small', 'HP'), num(m.hp)), h('span', h('small', 'EXP'), num(m.exp)),
        h('span', h('small', 'Mesos'), range(m.mesos[0], m.mesos[1])), h('span', h('small', 'Touch'), num(m.touchDamage)),
        h('span', h('small', 'DEF'), num(m.def)), h('span', h('small', 'Speed'), num(m.speed)),
      ),
      facts([
        ['Weak', elemPills(m.weak)],
        ['Resists', elemPills(m.resist)],
        ['Immune', m.immune?.length ? h('span.pills', m.immune.map(statusPill)) : null],
        ['Found in', homesOf(g, m.id)],
        ['Kills/level', m.boss ? null : `${num(killsForLevel(m))} at Lv ${m.level}`],
        ['Boss card', m.boss ? h('a', { href: `#${anchor.boss(m.id)}` }, 'Attacks and strategy') : null],
      ]),
      h('details.drops-wrap', h('summary', `Drops (${m.drops.length})`), dropList(m)),
    ),
  );
}

export function bestiary(g: Guide): RefSection {
  const grid = h('div.mon-grid');
  const sorted = [...g.monsters].sort((a, b) => Number(!!a.boss) - Number(!!b.boss) || a.level - b.level);
  for (const m of sorted) grid.appendChild(monsterCard(g, m));
  const el = h('section.ref', { id: 'bestiary' },
    sectionHeading(2, 'bestiary-h', 'Bestiary', 'Reference'),
    h('p.lead', `Every creature at the Academy: ${g.monsters.filter(m => !m.boss).length} monsters and ${g.monsters.filter(m => m.boss).length} bosses. Spells deal 50% more damage to a weakness and half to a resistance; an immune monster shrugs that status off entirely.`),
    filterBar(() => grid, 'Filter by name, zone or weakness…'),
    grid,
  );
  return { id: 'bestiary', title: 'Bestiary', el };
}

// ─────────────────────────── Atlas ───────────────────────────

function atlasEntry(g: Guide, id: string): HTMLElement {
  const def = Registry.map(id)!;
  const mons = g.mapMonsters.get(id) ?? [];
  return h('section.atlas-map', { id: anchor.map(id) },
    h('h3', h('span', def.name), h('span.tags', h('span.tag', def.region), h('span.tag.lv', def.safe ? 'Safe zone' : lvRange(def.levelRange)))),
    mapFigure(def),
    facts([
      ['Portals', connections(def)],
      ['Staff', def.npcs.length ? def.npcs.map((n, i) => [i ? ', ' : '', npcLink(n.npcId, true)]) : null],
      ['Terrain', `${def.platforms.filter(p => p.oneWay).length} ledges, ${(def.walls ?? []).length} raised blocks, ${def.ropes.filter(r => r.kind === 'rope').length} ropes, ${def.ropes.filter(r => r.kind === 'ladder').length} ladders`],
      ['Music', def.music],
    ]),
    mons.length ? h('div.scroll', h('table.spawns',
      h('thead', h('tr', h('th', 'Spawns'), h('th.num', 'Lv'), h('th.num', 'At once'), h('th.num', 'Respawn'))),
      h('tbody', mons.map(e => {
        const m = Registry.monster(e.monster);
        return h('tr', h('td', h('div.mon-cell', monsterImg(e.monster, 32), monsterLink(e.monster))), h('td.num', m?.level ?? ''), h('td.num', e.count), h('td.num', secs(e.respawnMs)));
      })),
    )) : id === 'trial_hall' ? h('p.small', 'No natural spawns: the Trial Hall spawns every wave itself. See ', h('a', { href: '#trial-hall' }, 'Trial Hall'), '.') : null,
  );
}

export function atlas(g: Guide): RefSection {
  const chain = g.zoneOrder.filter(id => Registry.map(id) && !Registry.map(id)!.safe || id === TOWN_MAP).filter(id => id !== 'trial_hall');
  const el = h('section.ref', { id: 'atlas' },
    sectionHeading(2, 'atlas-h', 'Atlas', 'Reference'),
    h('p.lead', 'Every map, drawn from its own data: platforms, ropes and ladders, portals, the staff, and the monsters at their spawn points (field bosses glow red). Portals run east and west in one long chain.'),
    h('ol.route', chain.map(id => {
      const m = Registry.map(id)!;
      return h('li', h('a', { href: `#${anchor.map(id)}` }, m.name), h('small', m.safe ? 'Campus' : lvRange(m.levelRange)));
    })),
    g.zoneOrder.map(id => atlasEntry(g, id)),
  );
  return { id: 'atlas', title: 'Atlas', el };
}

// ─────────────────────────── Staff ───────────────────────────

export function staffSection(g: Guide): RefSection {
  const order = [...g.npcs].sort((a, b) => {
    const pa = g.npcPlace.get(a.id), pb = g.npcPlace.get(b.id);
    return g.zoneOrder.indexOf(pa?.map ?? '') - g.zoneOrder.indexOf(pb?.map ?? '') || (pa?.x ?? 0) - (pb?.x ?? 0);
  });
  const el = h('section.ref', { id: 'staff' },
    sectionHeading(2, 'staff-h', 'Campus staff', 'Reference'),
    h('p.lead', 'Everyone you can talk to, west to east. A yellow mark over someone\'s head means they have something new for you.'),
    h('div.staff-grid', order.map(n => npcCard(g, n.id))),
  );
  return { id: 'staff', title: 'Campus staff', el };
}

// ─────────────────────────── Items ───────────────────────────

function sourcesOf(g: Guide, it: ItemDef): Child {
  const out: Child[] = [];
  const bram = g.bram.find(s => s.itemId === it.id);
  if (bram) out.push(h('div', 'Bram: ', mesos(bram.price)));
  const tilda = g.tilda.find(s => s.itemId === it.id);
  if (tilda) out.push(h('div', 'Tilda: ', mesos(tilda.price), h('small', ` (from Lv ${tilda.fromLevel})`)));
  const merit = g.merit.filter(o => o.itemId === it.id);
  if (merit.length) out.push(h('div', 'Merit Exchange: ', merit.map((o, i) => [i ? ', ' : '', `${num(o.cost)}${o.qty > 1 ? ` for ${o.qty}` : ''}`]), ' Merits'));
  const drops = g.dropSources.get(it.id) ?? [];
  if (drops.length) {
    const shown = drops.slice(0, 4);
    out.push(h('div', 'Drops: ', shown.map((d, i) => [i ? ', ' : '', monsterLink(d.monster), h('small', ` ${chance(d.chance)}`)]), drops.length > shown.length ? h('small', ` +${drops.length - shown.length} more`) : null));
  }
  const rewards = g.rewardSources.get(it.id) ?? [];
  if (rewards.length) out.push(h('div', 'Reward: ', rewards.slice(0, 3).map((q, i) => [i ? ', ' : '', questLink(q)]), rewards.length > 3 ? h('small', ` +${rewards.length - 3} more`) : null));
  return out.length ? out : h('span.muted', '—');
}

function effectOf(it: ItemDef): string {
  const c = it.consumable;
  if (c) {
    const parts: string[] = [];
    if (c.hp) parts.push(`+${num(c.hp)} HP`);
    if (c.mp) parts.push(`+${num(c.mp)} MP`);
    if (c.hpPct) parts.push(`+${pct(c.hpPct)} max HP`);
    if (c.mpPct) parts.push(`+${pct(c.mpPct)} max MP`);
    if (c.returnToTown) parts.push('Warp to campus');
    if (c.cooldownMs) parts.push(`${secs(c.cooldownMs)} cooldown`);
    return parts.join(' · ');
  }
  if (it.equip) return modsText(it.equip.modifiers);
  return it.description;
}

function itemRow(g: Guide, it: ItemDef, cols: 'consumable' | 'equip' | 'etc'): HTMLElement {
  const key = `${it.name} ${it.equip?.slot ?? ''} ${isSchool(it.equip?.reqBranch) ? it.equip!.reqBranch : ''}`.toLowerCase();
  const name = h('td', h('div.item-cell', iconImg(it.icon, 32), h('div', h('strong', it.name), h('div.small.muted', it.description))));
  if (cols === 'consumable') return h('tr', { id: anchor.item(it.id), 'data-key': key }, name, h('td.small', effectOf(it)), h('td.num', num(it.sellPrice)), h('td.small', sourcesOf(g, it)));
  if (cols === 'equip') {
    const b = it.equip!.reqBranch;
    return h('tr', { id: anchor.item(it.id), 'data-key': key }, name, h('td', it.equip!.slot), h('td.num', it.equip!.reqLevel), h('td', isSchool(b) ? schoolName(b) : 'Any'),
      h('td.small', effectOf(it)), h('td.num', num(it.sellPrice)), h('td.small', sourcesOf(g, it)));
  }
  const wanted = g.wantedBy.get(it.id) ?? [];
  return h('tr', { id: anchor.item(it.id), 'data-key': key }, name, h('td.num', num(it.sellPrice)), h('td.small', sourcesOf(g, it)),
    h('td.small', wanted.length ? wanted.map((q, i) => [i ? ', ' : '', questLink(q)]) : h('span.muted', '—')));
}

export function itemsSection(g: Guide): RefSection {
  const cons = g.items.filter(i => i.type === 'consumable');
  const equip = g.items.filter(i => i.type === 'equip').sort((a, b) => a.equip!.slot.localeCompare(b.equip!.slot) || a.equip!.reqLevel - b.equip!.reqLevel);
  const etc = g.items.filter(i => i.type === 'etc');
  const wrap = h('div');
  const slots = [...new Set(equip.map(i => i.equip!.slot))];
  append(wrap, [
    h('h3', 'Consumables'),
    h('div.scroll', h('table.items', h('thead', h('tr', h('th', 'Item'), h('th', 'Effect'), h('th.num', 'Sells'), h('th', 'Where'))), h('tbody', cons.map(i => itemRow(g, i, 'consumable'))))),
    h('h3', 'Equipment'),
    h('p.small', `Seven slots. School gear needs that School; everything else fits any student. Stats add to your character's own (Stats window, ${''}`, kbd('stats'), ').'),
    slots.map(s => [
      h('h4', s[0].toUpperCase() + s.slice(1)),
      h('div.scroll', h('table.items', h('thead', h('tr', h('th', 'Item'), h('th', 'Slot'), h('th.num', 'Lv'), h('th', 'School'), h('th', 'Stats'), h('th.num', 'Sells'), h('th', 'Where'))),
        h('tbody', equip.filter(i => i.equip!.slot === s).map(i => itemRow(g, i, 'equip'))))),
    ]),
    h('h3', 'Materials and trophies'),
    h('div.scroll', h('table.items', h('thead', h('tr', h('th', 'Item'), h('th.num', 'Sells'), h('th', 'Where'), h('th', 'Wanted by'))), h('tbody', etc.map(i => itemRow(g, i, 'etc'))))),
    h('h3', { id: 'shops' }, 'Shops'),
    h('p.small', 'Bram and Tilda stand at the west end of campus. Tilda only racks what suits you: School pieces for your own School, and nothing more than a few levels above you.'),
    h('div.shops', shopTable(g, 'bram'), shopTable(g, 'tilda'), shopTable(g, 'merit')),
  ]);
  const el = h('section.ref', { id: 'items' },
    sectionHeading(2, 'items-h', 'Items & gear', 'Reference'),
    h('p.lead', `${g.items.length} items: potions and scrolls, ${equip.length} pieces of equipment, monster materials and field-boss trophies. Your bag holds ${MAX_INVENTORY_STACKS} stacks.`),
    filterBar(() => wrap, 'Filter items by name, slot or School…'),
    wrap,
  );
  return { id: 'items', title: 'Items & gear', el };
}

// ─────────────────────────── Trial Hall ───────────────────────────

export function trialHall(g: Guide): RefSection {
  const T = ARENA_TUNING;
  const waves = Array.from({ length: 20 }, (_, i) => i + 1);
  let total = 0;
  const sampleLv = 30;
  const el = h('section.ref', { id: 'trial-hall' },
    sectionHeading(2, 'trial-hall-h', 'Trial Hall', 'Reference'),
    h('p.lead', 'A wave-survival arena under the Headmistress\'s tower, open to every student. Climb the ladder at the foot of the tower and take the door on the balcony.'),
    h('div.cols',
      h('div',
        h('h4', 'How a run works'),
        h('ul.list',
          h('li', `Press Begin. Each wave has a ${secs(T.countdownMs)} countdown, then the fight.`),
          h('li', `Clear a wave for a ${secs(T.breatherMs)} breather that restores ${pct(T.breatherHeal)} of your max HP and MP.`),
          h('li', `Waves hold ${T.baseCount} + the wave number in monsters, up to ${T.maxCount}.`),
          h('li', `Monsters start ${Math.abs(T.levelBias)} levels below you and gain ${T.levelStep} levels every ${T.levelEvery} waves, up to ${T.maxOffset} above you. Their HP grows ${pct(T.hpPerWave)} per wave on top.`),
          h('li', `Every ${T.bossEvery}th wave is a boss wave: a field boss that fits your level (at ${pct(T.bossHpFirst)} HP the first time, +${pct(T.bossHpStep)} each boss wave after), or an elite with ×${T.eliteHp} HP. Elites also join normal waves later on.`),
          h('li', 'Merits and bonus EXP are paid the moment a wave is cleared, so you keep everything if you fall. Your best wave is remembered.'),
        ),
      ),
      h('div',
        h('h4', 'Rewards per wave'),
        h('div.scroll', h('table.compact',
          h('thead', h('tr', h('th.num', 'Wave'), h('th.num', 'Merits'), h('th.num', 'Run total'), h('th.num', `Bonus EXP at Lv ${sampleLv}`))),
          h('tbody', waves.map(w => { total += meritsForWave(w); return h('tr', { class: w % T.bossEvery === 0 ? 'boss-row' : '' }, h('td.num', w), h('td.num', num(meritsForWave(w))), h('td.num', num(total)), h('td.num', num(bonusExpForWave(w, sampleLv)))); })),
        )),
        h('p.small', `Bonus EXP scales with your level (it is based on a same-level monster's ${num(refMonsterExp(sampleLv))} EXP at Lv ${sampleLv}). Boss waves pay double. Graduation adds ${num(GRADUATION_MERITS)} Merits.`),
      ),
    ),
    h('h4', 'Spending Merits'),
    shopTable(g, 'merit'),
  );
  return { id: 'trial-hall', title: 'Trial Hall', el };
}

// ─────────────────────────── Familiar, respec ───────────────────────────

export function studentLife(g: Guide): RefSection {
  const tome = Registry.item('tome_of_unlearning');
  const bram = g.bram.find(s => s.itemId === 'tome_of_unlearning');
  const merit = g.merit.find(o => o.itemId === 'tome_of_unlearning');
  const el = h('section.ref', { id: 'student-life' },
    sectionHeading(2, 'student-life-h', 'Familiar, respec and saves', 'Reference'),
    h('div.cols',
      h('div', { id: 'familiar' },
        h('h3', 'Pip, your familiar'),
        h('p', 'Every student has a familiar: **Pip**, a small owl that flutters beside you. Pip spots loot on the ground near you, flies over and picks it up for you, so you can keep casting instead of stopping to hold the pickup key.'.replace(/\*\*/g, '')),
        h('p', `Pip is ${DEFAULT_SETTINGS.familiar ? 'on' : 'off'} by default. Hide or show Pip in `, kbd('menu'), ' → Settings → Familiar. You can still loot by hand with ', kbd('pickup'), '.'),
      ),
      h('div', { id: 'respec' },
        h('h3', 'Respec: the Tome of Unlearning'),
        h('p', 'Changed your mind about a build? A ', itemLink('tome_of_unlearning'), ' lets you unlearn one Year of spells and get every SP you spent on it back, to spend again.'),
        h('ul.list',
          h('li', 'Open the spellbook (', kbd('skills'), '), pick the Year\'s tab and press Unlearn Year. One tome per Year.'),
          h('li', 'You can unlearn any Year you have reached, including Year 1. The free first level of Arcane Bolt stays learned.'),
          h('li', 'Spells you unlearn leave your hotbar.'),
          bram ? h('li', `Bram sells the tome for ${mesos(bram.price)}${merit ? `, or trade ${num(merit.cost)} Merits for one at the Merit Exchange` : ''}.`) : null,
        ),
        tome ? h('p.small.muted', tome.description) : null,
      ),
      h('div', { id: 'saves' },
        h('h3', 'Saves and settings'),
        h('ul.list',
          h('li', 'Six save slots. Character Select on the title screen shows each student\'s School and Year.'),
          h('li', 'The game saves on map changes, level-ups, quests and every so often while you play.'),
          h('li', 'Every key can be rebound in ', kbd('menu'), ' → Controls, and a standard gamepad works out of the box.'),
          h('li', 'Settings: screen shake (on, reduced or off), damage-number size, the familiar and the on-screen touch controls.'),
        ),
      ),
    ),
  );
  return { id: 'student-life', title: 'Familiar, respec & saves', el };
}

// ─────────────────────────── Academy Honors ───────────────────────────

export function honorsSection(): RefSection {
  const all = availableHonors();
  const secrets = all.filter(x => x.secret).length;
  const titled = all.filter(x => x.title).length;
  const el = h('section.ref', { id: 'honors' },
    sectionHeading(2, 'honors-h', 'Academy Honors', 'Reference'),
    h('p.lead', `${all.length} honors in ${HONOR_CATEGORIES.length} categories. Each pays Merits once, and ${titled} of them unlock a title you can wear under your name tag. Open the Honors window with `, kbd('honors'), ' to see your progress bars and pick a title.'),
    h('p.small', `${secrets} honors are secret and stay hidden until you earn them. Merits are spent at Bram's Merit Exchange (see `, h('a', { href: '#trial-hall' }, 'the Trial Hall'), ').'),
    HONOR_CATEGORIES.map(c => {
      const list = all.filter(x => x.category === c.id && !x.secret);
      if (!list.length) return null;
      return h('div.honor-cat',
        h('h3', { id: `honors-${c.id}` }, c.name, h('small.muted', ` ${list.length}`)),
        h('div.scroll', h('table.compact',
          h('thead', h('tr', h('th', 'Honor'), h('th', 'How'), h('th.num', 'Merits'), h('th', 'Title'))),
          h('tbody', list.map(x => h('tr', { id: `honor-${x.id}` },
            h('td', h('div.spell-head', iconImg(x.icon, 24, ''), h('strong', x.name))),
            h('td.small', x.description),
            h('td.num', x.reward ? num(x.reward) : '—'),
            h('td.small', x.title ?? '—'),
          ))),
        )),
      );
    }),
  );
  return { id: 'honors', title: 'Academy Honors', el };
}

// ─────────────────────────── Assignments ───────────────────────────

function questRows(qs: QuestDef[]): HTMLElement {
  return h('div.scroll', h('table.quests',
    h('thead', h('tr', h('th', 'Quest'), h('th', 'From'), h('th.num', 'Lv'), h('th', 'Objectives'), h('th', 'Reward'))),
    h('tbody', qs.map(q => h('tr',
      h('td', questLink(q.id), q.requiredJobBranch && isSchool(q.requiredJobBranch) ? h('div.small.muted', `${schoolName(q.requiredJobBranch)} School`) : null),
      h('td', npcLink(q.giver, true)), h('td.num', q.minLevel),
      h('td.small', q.objectives.length ? q.objectives.map((o, i) => [i ? h('br') : null, objectiveLine(o)]) : h('span.muted', 'Talk')),
      h('td.small', rewardLine(q, q.id === 'story_commencement' ? GRADUATION_MERITS : 0)),
    ))),
  ));
}

export function assignmentsSection(g: Guide): RefSection {
  const exams = g.quests.filter(q => questKind(q.id) === 'exam').sort((a, b) => a.minLevel - b.minLevel);
  const el = h('section.ref', { id: 'assignments' },
    sectionHeading(2, 'assignments-h', 'Assignments', 'Reference'),
    h('p.lead', `Every quest in the game: ${g.story.length} main story steps, ${exams.length} Year-end Exams, ${g.assignments.length} assignments and ${g.bounties.length} Field Bounties. Collection objectives count what is already in your bag.`),
    h('h3', 'Main story'), questRows(g.story),
    h('h3', 'Year-end Exams'), questRows(exams),
    h('h3', 'Assignments'), questRows(g.assignments),
    h('h3', 'Field Bounties'), h('p.small', 'Prefect Finn re-posts a bounty after you hand it in, so each can be repeated.'), questRows(g.bounties),
  );
  return { id: 'assignments', title: 'Assignments', el };
}

// ─────────────────────────── Progression ───────────────────────────

export function progressionSection(): RefSection {
  let cum = 0;
  const rows = Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 1).map(lv => {
    const need = expToNext(lv);
    cum += need;
    return h('tr', h('td.num', lv), h('td.num', num(need)), h('td.num', num(cum)), h('td.num', num(refMonsterExp(lv))));
  });
  const diffs = [-5, -1, 0, 5, 9, 10, 12, 15, 20];
  const el = h('section.ref', { id: 'progression' },
    sectionHeading(2, 'progression-h', 'Levels and EXP', 'Reference'),
    h('div.cols',
      h('div',
        h('ul.list',
          h('li', `Each level gives ${SP_PER_LEVEL} SP (spells) and ${AP_PER_LEVEL} AP (stats). Each School Year adds ${JOB_ADVANCE_BONUS_SP} bonus SP.`),
          h('li', `Falling in the field costs ${pct(DEATH_EXP_PENALTY)} of the current level's EXP requirement (never below zero) and sends you back to campus.`),
          h('li', `The level cap is ${MAX_LEVEL}.`),
        ),
        h('h4', 'Kill EXP by level gap'),
        h('div.scroll', h('table.compact',
          h('thead', h('tr', h('th.num', 'You are'), h('th.num', 'EXP'))),
          h('tbody', diffs.map(d => h('tr', h('td', d === 0 ? 'Same level' : d > 0 ? `${d} levels above` : `${-d} below`), h('td.num', pct(killExpMultiplier(20 + d, 20)))))),
        )),
      ),
      h('div', h('div.scroll.tall', h('table.compact.exp',
        h('thead', h('tr', h('th.num', 'Lv'), h('th.num', 'EXP to next'), h('th.num', 'Total'), h('th.num', 'Typical kill'))),
        h('tbody', rows),
      ))),
    ),
  );
  return { id: 'progression', title: 'Levels & EXP', el };
}

