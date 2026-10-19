// Spell facts and tables, read straight from each SkillDef's level functions (src/skills/*.ts).

import type { AttackSpec, DerivedStatKey, SkillDef, StatModifier } from '../core/types';
import { Registry } from '../core/registry';
import { h, type Child } from './dom';
import { iconImg } from './art';
import { anchor, num, secs, spellLink, statusPill, pct, elemPill } from './ui';

export const KIND_LABEL: Record<SkillDef['kind'], string> = {
  attack: 'Attack', buff: 'Buff', passive: 'Passive', movement: 'Movement', summon: 'Summon',
};

const STAT_LABEL: Record<DerivedStatKey, string> = {
  maxHp: 'Max HP', maxMp: 'Max MP', matk: 'Magic ATK', def: 'DEF', critRate: 'Crit rate', critDmg: 'Crit damage',
  mastery: 'Mastery', speed: 'Speed', jump: 'Jump', hpRegen: 'HP regen', mpRegen: 'MP regen', mpShield: 'MP shield',
  dmgAll: 'All damage', dmgFire: 'Fire damage', dmgIce: 'Ice damage', dmgLightning: 'Lightning damage',
  dmgHoly: 'Holy damage', dmgShadow: 'Shadow damage', castSpeed: 'Cast speed', cdr: 'Cooldown reduction',
};
/** Stats stored as fractions (shown as %). */
const FRACTION = new Set<DerivedStatKey>(['critRate', 'critDmg', 'mastery', 'mpShield', 'dmgAll', 'dmgFire', 'dmgIce', 'dmgLightning', 'dmgHoly', 'dmgShadow', 'castSpeed', 'cdr']);

const sign = (n: number) => (n >= 0 ? '+' : '−');
export function modText(m: StatModifier): string {
  const parts: string[] = [];
  if (m.add) parts.push(FRACTION.has(m.stat) ? `${sign(m.add)}${pct(Math.abs(m.add), 1)}` : `${sign(m.add)}${num(Math.abs(m.add))}`);
  if (m.mul) parts.push(`${sign(m.mul)}${pct(Math.abs(m.mul), 1)}`);
  return `${STAT_LABEL[m.stat] ?? m.stat} ${parts.join(' ')}`;
}
export const modsText = (ms: StatModifier[]) => ms.map(modText).join(', ');

/** The attack a spell deals damage with (its own, or its summon's). */
export const attackOf = (s: SkillDef): AttackSpec | undefined => s.attack ?? s.summon?.attack;

const PATTERN_ROLE: Record<AttackSpec['pattern'], string> = {
  projectile: 'Projectile', melee_arc: 'Close cone', aoe_self: 'Burst around you', aoe_target: 'Targeted blast',
  chain: 'Chain', beam: 'Line', rain: 'Rain from above',
};

/** A short role line: "Projectile · pierces", "Chain", "Summon (Projectile)". */
export function roleOf(s: SkillDef): string {
  const a = attackOf(s);
  if (s.kind === 'passive') return 'Always on';
  if (s.kind === 'buff' && !a) return 'Self buff';
  if (s.kind === 'movement' && !a) return 'Blink';
  if (!a) return s.onCast ? 'Special' : '—';
  let r = PATTERN_ROLE[a.pattern];
  if (a.pattern === 'projectile' && a.projectile?.pierce) r += ' · pierces';
  if (a.pattern === 'projectile' && a.projectile?.explodeArea) r += ' · explodes';
  if (s.kind === 'summon') r = `Summon · ${r.toLowerCase()}`;
  if (s.kind === 'movement') r = `Blink · ${r.toLowerCase()}`;
  return r;
}

const lv1 = 1;
const AFFLICTED: Record<string, string> = {
  burn: 'burning', chill: 'chilled', freeze: 'frozen', shock: 'shocked', stun: 'stunned', poison: 'poisoned', curse: 'cursed',
};
const fromTo = (a: number, b: number, unit = '') => (Math.round(a) === Math.round(b) ? `${num(a)}${unit}` : `${num(a)}${unit} → ${num(b)}${unit}`);

export interface SpellFacts {
  dmg: string; hits: string; targets: string; mp: string; cd: string;
  status: Child; needs: Child; effects: string[];
}

export function spellFacts(s: SkillDef): SpellFacts {
  const mx = s.maxLevel;
  const a = attackOf(s);
  const effects: string[] = [];
  if (s.buff) {
    effects.push(`Lv ${mx}: ${modsText(s.buff.modifiers(mx))} for ${secs(s.buff.durationMs(mx))}`);
    if (mx > 1) effects.push(`Lv 1: ${modsText(s.buff.modifiers(lv1))} for ${secs(s.buff.durationMs(lv1))}`);
  }
  if (s.passive) {
    effects.push(`Lv ${mx}: ${modsText(s.passive(mx))}`);
    if (mx > 1) effects.push(`Lv 1: ${modsText(s.passive(lv1))}`);
  }
  if (s.movement) effects.push(`Blinks ${fromTo(s.movement.distance(lv1), s.movement.distance(mx), ' px')}`);
  // An interval at the engine's 100 ms floor is a trap's trigger poll (Grave Mine), not a rate of fire.
  if (s.summon) effects.push(`Lasts ${fromTo(s.summon.durationMs(lv1) / 1000, s.summon.durationMs(mx) / 1000, ' s')}, ${s.summon.attackIntervalMs <= 100 ? 'strikes when a foe steps in' : `attacks every ${secs(s.summon.attackIntervalMs)}`}`);
  if (a?.projectile?.count && a.projectile.count(mx) > 1) effects.push(`Fires ${fromTo(a.projectile.count(lv1), a.projectile.count(mx))} projectiles`);
  if (a?.rain) effects.push(`${fromTo(a.rain.count(lv1), a.rain.count(mx))} impacts`);
  if (a?.bonusVs) effects.push(`×${a.bonusVs.mult} damage to ${AFFLICTED[a.bonusVs.status]} foes${a.bonusVs.consume ? ' (removes it)' : ''}`);
  if (a?.knockback) effects.push(`Knocks back ${num(a.knockback)} px`);
  if (!a && s.onCast && !s.buff && !s.movement) effects.push('Custom effect — see the description');

  let status: Child = h('span.muted', '—');
  if (a?.status) {
    const st = a.status;
    status = h('span.status',
      statusPill(st.kind),
      h('small', ` ${fromTo(st.chance(lv1) * 100, st.chance(mx) * 100, '%')}, ${secs(st.durationMs(mx))}`));
  }
  const needs: Child = s.requires?.length
    ? h('span.needs', s.requires.map((r, i) => [i ? ', ' : '', spellLink(r.skillId, false), h('small', ` ${r.level}`)]))
    : h('span.muted', '—');
  return {
    dmg: a ? fromTo(a.damagePct(lv1), a.damagePct(mx), '%') : '—',
    hits: a ? fromTo(a.hits(lv1), a.hits(mx)) : '—',
    targets: a ? fromTo(a.maxTargets(lv1), a.maxTargets(mx)) : '—',
    mp: s.kind === 'passive' ? '—' : fromTo(s.mpCost(lv1), s.mpCost(mx)),
    cd: s.cooldownMs ? (Math.round(s.cooldownMs(lv1)) === Math.round(s.cooldownMs(mx)) ? secs(s.cooldownMs(mx)) : `${secs(s.cooldownMs(lv1))} → ${secs(s.cooldownMs(mx))}`) : '—',
    status, needs, effects,
  };
}

/** Total SP to max every spell in a list (Arcane Bolt's first level is free). */
export const spToMax = (list: SkillDef[]) => list.reduce((n, s) => n + s.maxLevel - (s.id === 'app_arcane_bolt' ? 1 : 0), 0);

/** The full spell table for one job (one Year of one School, or the Year 1 core curriculum). */
export function spellTable(skills: SkillDef[]): HTMLElement {
  return h('div.scroll', h('table.spells',
    h('thead', h('tr',
      h('th', 'Spell'), h('th', 'Type'), h('th.num', { title: 'Damage per hit as % of Magic ATK, level 1 → max' }, 'Damage'),
      h('th.num', 'Hits'), h('th.num', 'Targets'), h('th.num', 'MP'), h('th.num', 'Cooldown'), h('th', 'Status'), h('th', 'Needs'),
    )),
    h('tbody', skills.map(s => {
      const f = spellFacts(s);
      return h('tr', { id: anchor.spell(s.id) },
        h('td.spell',
          h('div.spell-head', iconImg(s.icon, 32, ''), h('div',
            h('strong', s.name), ' ', h('small.lv', `max Lv ${s.maxLevel}`), ' ', elemPill(s.element),
            h('div.desc', s.description),
            f.effects.length ? h('ul.effects', f.effects.map(e => h('li', e))) : null,
          )),
        ),
        h('td', h('span.kind', { class: `k-${s.kind}` }, KIND_LABEL[s.kind]), h('div.small.muted', roleOf(s))),
        h('td.num', f.dmg), h('td.num', f.hits), h('td.num', f.targets), h('td.num', f.mp), h('td.num', f.cd),
        h('td', f.status), h('td.small', f.needs),
      );
    })),
  ));
}

export const skillsOf = (job: string) => Registry.skills().filter(s => s.job === job);
