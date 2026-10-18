/** Tooltip/descriptive text builders for skills, items and stats. */
import type {
  AttackSpec, Branch, DerivedStatKey, DerivedStats, Element, EquipSlot, ItemDef, JobDef, SkillDef, StatModifier, StatusKind,
} from '../core/types';
import { Registry } from '../core/registry';
import { fmtNum, fmtPct, fmtSec, h, safe, type Child } from './dom';
import { iconEl } from './uiIcons';

export const STAT_LABELS: Record<DerivedStatKey, string> = {
  maxHp: 'Max HP', maxMp: 'Max MP', matk: 'Magic ATK', def: 'Defense', critRate: 'Crit Rate', critDmg: 'Crit Damage',
  mastery: 'Mastery', speed: 'Speed', jump: 'Jump', hpRegen: 'HP Regen', mpRegen: 'MP Regen', mpShield: 'Mana Shield',
  dmgAll: 'All Damage', dmgFire: 'Fire Damage', dmgIce: 'Ice Damage', dmgLightning: 'Lightning Damage', dmgHoly: 'Holy Damage', dmgShadow: 'Shadow Damage',
  castSpeed: 'Cast Speed', cdr: 'Cooldown Reduction',
};

/** Stats whose values are fractions (display as %). */
export const FRACTION_STATS = new Set<DerivedStatKey>(['critRate', 'critDmg', 'mastery', 'mpShield', 'dmgAll', 'dmgFire', 'dmgIce', 'dmgHoly', 'dmgShadow', 'dmgLightning', 'castSpeed', 'cdr']);

export const ELEMENT_COLORS: Record<Element, string> = { neutral: '#b9a6ff', fire: '#ff8a4c', ice: '#7fd8ff', lightning: '#ffe25c', holy: '#fff1a8', shadow: '#b48cff' };
export const BRANCH_COLORS: Record<Branch, string> = { none: '#c9b8ff', fire: '#ff8a4c', ice: '#7fd8ff', lightning: '#ffe25c', holy: '#fff1a8', shadow: '#b48cff' };
export const BRANCH_NAMES: Record<Branch, string> = { none: 'Arcane', fire: 'Fire', ice: 'Ice', lightning: 'Lightning', holy: 'Holy', shadow: 'Shadow' };
export const SLOT_LABELS: Record<EquipSlot, string> = { weapon: 'Weapon', hat: 'Hat', robe: 'Robe', shoes: 'Shoes', gloves: 'Gloves', ring: 'Ring', amulet: 'Amulet' };
const STATUS_NAMES: Record<StatusKind, string> = { burn: 'Burn', chill: 'Chill', freeze: 'Freeze', shock: 'Shock', stun: 'Stun', poison: 'Poison', curse: 'Curse' };
const KIND_LABELS: Record<SkillDef['kind'], string> = { attack: 'Attack', buff: 'Buff', passive: 'Passive', movement: 'Movement', summon: 'Summon' };

const r1 = (n: number) => +n.toFixed(1);

export function fmtStatValue(stat: DerivedStatKey, v: number): string {
  if (FRACTION_STATS.has(stat)) return fmtPct(v, Math.abs(v) < 0.1 && v !== 0 ? 1 : 0);
  return fmtNum(v);
}

export function fmtModifier(m: StatModifier): string {
  const label = STAT_LABELS[m.stat] ?? m.stat;
  const parts: string[] = [];
  if (m.add) {
    const sign = m.add > 0 ? '+' : '−';
    const a = Math.abs(m.add);
    parts.push(FRACTION_STATS.has(m.stat) ? `${sign}${r1(a * 100)}%` : `${sign}${r1(a)}`);
  }
  if (m.mul) parts.push(`${m.mul > 0 ? '+' : '−'}${r1(Math.abs(m.mul) * 100)}%`);
  return `${label} ${parts.join(' & ') || '+0'}`;
}

export function jobName(id: string | undefined): string {
  if (!id) return '';
  return safe(() => Registry.job(id as JobDef['id'])?.name, '') || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function attackLines(a: AttackSpec, lv: number, matk: number, out: Child[], prefix = '') {
  const pct = safe(() => a.damagePct(lv), 0);
  const hits = Math.max(1, safe(() => a.hits(lv), 1));
  const targets = safe(() => a.maxTargets(lv), 1);
  const count = a.projectile?.count ? safe(() => a.projectile!.count!(lv), 1) : 1;
  const rain = a.rain ? safe(() => a.rain!.count(lv), 1) : 0;
  out.push(stat(`${prefix}Damage`, `${fmtNum(pct)}%${hits > 1 ? ` × ${hits} lines` : ''}`));
  if (matk > 0 && pct > 0) out.push(stat(`${prefix}Est. per line`, `≈ ${fmtNum(matk * pct / 100)}`, 'ax-dim'));
  out.push(stat(`${prefix}Max targets`, String(targets)));
  if (count > 1) out.push(stat(`${prefix}Projectiles`, String(count)));
  if (rain > 0) out.push(stat(`${prefix}Impacts`, String(rain)));
  if (a.status) {
    const s = a.status;
    const ch = safe(() => s.chance(lv), 0), dur = safe(() => s.durationMs(lv), 0), pot = safe(() => s.potency(lv), 0);
    let extra = '';
    if (s.kind === 'burn' && pot) extra = `, ${r1(pot)}% of hit / 0.5s`;
    else if (s.kind === 'chill' && pot) extra = `, −${r1(pot * 100)}% speed`;
    else if (s.kind === 'shock' && pot) extra = `, +${r1(pot * 100)}% dmg taken`;
    out.push(stat(`${prefix}${STATUS_NAMES[s.kind]}`, `${fmtPct(ch)} for ${fmtSec(dur)}${extra}`));
  }
  if (a.bonusVs) out.push(stat(`${prefix}vs ${STATUS_NAMES[a.bonusVs.status]}`, `×${r1(a.bonusVs.mult)} damage${a.bonusVs.consume ? ' (consumes)' : ''}`));
}

function stat(label: string, value: string, cls = ''): HTMLElement {
  return h('div', { class: `ax-tt-stat ${cls}` }, h('span', null, label), h('b', null, value));
}

/** Numbers for one level of a skill. */
export function skillLevelBlock(def: SkillDef, lv: number, matk: number): Child[] {
  const out: Child[] = [];
  const mp = safe(() => def.mpCost(lv), 0);
  if (def.kind !== 'passive' && mp > 0) out.push(stat('MP cost', fmtNum(mp)));
  const cd = def.cooldownMs ? safe(() => def.cooldownMs!(lv), 0) : 0;
  if (cd > 0) out.push(stat('Cooldown', fmtSec(cd)));
  if (def.attack) attackLines(def.attack, lv, matk, out);
  if (def.buff) {
    out.push(stat('Duration', fmtSec(safe(() => def.buff!.durationMs(lv), 0))));
    for (const m of safe(() => def.buff!.modifiers(lv), [] as StatModifier[])) out.push(h('div', { class: 'ax-tt-mod' }, fmtModifier(m)));
  }
  if (def.passive) for (const m of safe(() => def.passive!(lv), [] as StatModifier[])) out.push(h('div', { class: 'ax-tt-mod' }, fmtModifier(m)));
  if (def.movement) out.push(stat('Distance', `${fmtNum(safe(() => def.movement!.distance(lv), 0))} px`));
  if (def.summon) {
    out.push(stat('Duration', fmtSec(safe(() => def.summon!.durationMs(lv), 0))));
    out.push(stat('Attacks every', fmtSec(def.summon.attackIntervalMs)));
    attackLines(def.summon.attack, lv, matk, out, 'Summon ');
  }
  return out;
}

export interface SkillTipOpts { level: number; matk: number; locked?: string; canLearn?: boolean; hotbar?: boolean }

export function skillTooltip(def: SkillDef, o: SkillTipOpts): HTMLElement {
  const lv = o.level;
  const color = ELEMENT_COLORS[def.element] ?? '#fff';
  const head = h('div', { class: 'ax-tt-head' },
    iconEl(def.icon, 40, def.name),
    h('div', null,
      h('div', { class: 'ax-tt-name', style: `color:${color}` }, def.name),
      h('div', { class: 'ax-tt-sub' }, `${KIND_LABELS[def.kind] ?? def.kind} · ${def.element === 'neutral' ? 'Arcane' : BRANCH_NAMES[def.element as Branch]} · ${jobName(def.job)}`),
      h('div', { class: 'ax-tt-sub' }, `Level ${lv} / ${def.maxLevel}`)));
  const el = h('div', { class: 'ax-tt' }, head, h('div', { class: 'ax-tt-desc' }, def.description.replace(/\{[^}]*\}/g, '').trim()));
  if (def.requires?.length) {
    el.appendChild(h('div', { class: 'ax-tt-req' }, 'Requires: ' + def.requires.map(r => `${Registry.skill(r.skillId)?.name ?? r.skillId} Lv ${r.level}`).join(', ')));
  }
  if (lv > 0) {
    el.appendChild(h('div', { class: 'ax-tt-section' }, `Current — Lv ${lv}`));
    el.appendChild(h('div', { class: 'ax-tt-block' }, skillLevelBlock(def, lv, o.matk)));
  }
  if (lv < def.maxLevel) {
    el.appendChild(h('div', { class: 'ax-tt-section ax-next' }, `Next — Lv ${lv + 1}`));
    el.appendChild(h('div', { class: 'ax-tt-block' }, skillLevelBlock(def, lv + 1, o.matk)));
  } else {
    el.appendChild(h('div', { class: 'ax-tt-foot ax-gold' }, 'Mastered'));
  }
  if (o.locked) el.appendChild(h('div', { class: 'ax-tt-req' }, o.locked));
  else if (lv > 0 && def.kind !== 'passive' && !o.hotbar) el.appendChild(h('div', { class: 'ax-tt-foot' }, 'Drag to the hotbar to use.'));
  else if (o.hotbar) el.appendChild(h('div', { class: 'ax-tt-foot' }, 'Right-click or drag off the bar to clear.'));
  return el;
}

export interface ItemTipOpts { qty?: number; level: number; branch: Branch; equipped?: boolean; hint?: string; price?: number }

export function itemTooltip(def: ItemDef | undefined, o: ItemTipOpts, fallbackId = ''): HTMLElement {
  if (!def) return h('div', { class: 'ax-tt' }, h('div', { class: 'ax-tt-name' }, fallbackId || 'Unknown item'));
  const typeLabel = def.type === 'equip' ? (def.equip ? SLOT_LABELS[def.equip.slot] : 'Equipment') : def.type === 'consumable' ? 'Consumable' : 'Material';
  const el = h('div', { class: 'ax-tt' },
    h('div', { class: 'ax-tt-head' }, iconEl(def.icon, 40, def.name),
      h('div', null,
        h('div', { class: 'ax-tt-name' }, def.name),
        h('div', { class: 'ax-tt-sub' }, typeLabel + (o.equipped ? ' · Equipped' : '') + (o.qty && o.qty > 1 ? ` · ×${o.qty}` : '')))),
    def.description ? h('div', { class: 'ax-tt-desc' }, def.description) : null);
  const c = def.consumable;
  if (c) {
    const fx: string[] = [];
    if (c.hp) fx.push(`+${fmtNum(c.hp)} HP`);
    if (c.mp) fx.push(`+${fmtNum(c.mp)} MP`);
    if (c.hpPct) fx.push(`+${fmtPct(c.hpPct > 1 ? c.hpPct / 100 : c.hpPct)} HP`);
    if (c.mpPct) fx.push(`+${fmtPct(c.mpPct > 1 ? c.mpPct / 100 : c.mpPct)} MP`);
    if (c.returnToTown) fx.push('Returns you to town');
    if (fx.length) el.appendChild(h('div', { class: 'ax-tt-block' }, fx.map(t => h('div', { class: 'ax-tt-mod' }, t))));
  }
  const e = def.equip;
  if (e) {
    el.appendChild(h('div', { class: 'ax-tt-block' }, e.modifiers.map(m => h('div', { class: 'ax-tt-mod' }, fmtModifier(m)))));
    const lvOk = o.level >= e.reqLevel;
    el.appendChild(h('div', { class: `ax-tt-req${lvOk ? ' ax-ok' : ''}` }, `Req. Level ${e.reqLevel}`));
    if (e.reqBranch && e.reqBranch !== 'none') {
      const ok = o.branch === e.reqBranch;
      el.appendChild(h('div', { class: `ax-tt-req${ok ? ' ax-ok' : ''}` }, `Req. ${BRANCH_NAMES[e.reqBranch]} mage`));
    }
  }
  if (o.price !== undefined) el.appendChild(h('div', { class: 'ax-tt-foot ax-gold' }, `Price: ${fmtNum(o.price)} mesos`));
  else if (def.sellPrice > 0) el.appendChild(h('div', { class: 'ax-tt-foot' }, `Sells for ${fmtNum(def.sellPrice)} mesos`));
  if (o.hint) el.appendChild(h('div', { class: 'ax-tt-foot' }, o.hint));
  return el;
}

export function canEquip(def: ItemDef | undefined, level: number, branch: Branch): boolean {
  const e = def?.equip;
  if (!e) return false;
  if (level < e.reqLevel) return false;
  if (e.reqBranch && e.reqBranch !== 'none' && e.reqBranch !== branch) return false;
  return true;
}

export const DERIVED_ORDER: DerivedStatKey[] = ['maxHp', 'maxMp', 'matk', 'def', 'critRate', 'critDmg', 'mastery', 'speed', 'jump',
  'hpRegen', 'mpRegen', 'mpShield', 'dmgAll', 'dmgFire', 'dmgIce', 'dmgHoly', 'dmgShadow', 'dmgLightning', 'castSpeed', 'cdr'];

export function derivedRows(d: DerivedStats): { label: string; value: string }[] {
  return DERIVED_ORDER.filter(k => {
    // Hide zero elemental bonuses etc. to keep the panel readable.
    if (['mpShield', 'dmgAll', 'dmgFire', 'dmgIce', 'dmgHoly', 'dmgShadow', 'dmgLightning', 'castSpeed', 'cdr'].includes(k)) return (d[k] ?? 0) !== 0;
    return true;
  }).map(k => ({ label: STAT_LABELS[k], value: fmtStatValue(k, d[k] ?? 0) + (k === 'hpRegen' || k === 'mpRegen' ? ' / 5s' : '') }));
}
