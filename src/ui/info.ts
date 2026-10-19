/** Tooltip/descriptive text builders for skills, items and stats. */
import type {
  AttackSpec, Branch, DerivedStatKey, DerivedStats, Element, EquipSlot, ItemDef, JobDef, SkillDef, StatModifier, StatusKind,
} from '../core/types';
import { Registry } from '../core/registry';
import { SCHOOL_PROFESSOR, isSchool } from '../data/jobs';
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

/** The Academy: every job tier is a school Year (1 = Apprentice core curriculum, 4 = graduate title, 5 = postgraduate Fellowship). */
export function jobYear(id: string | undefined): number {
  if (!id) return 1;
  return safe(() => Registry.job(id as JobDef['id'])?.tier, undefined) ?? 1;
}
/** "Year 2 · Pyromancer" / "Year 5 Fellow · Pyre Archon" */
export function yearJobLabel(id: string | undefined): string {
  const year = jobYear(id);
  return `Year ${year}${year >= 5 ? ' Fellow' : ''} · ${jobName(id)}`;
}
/** "School of Fire" (Apprentices have not declared a School yet). */
export function schoolName(branch: Branch): string {
  return branch === 'none' ? 'Core Curriculum' : `School of ${BRANCH_NAMES[branch] ?? branch} Magic`;
}
/** Who runs the exam that leads into `job`: the Headmistress declares Schools (Year 2); each School's Professor runs Years 3–4 and the Year 5 Fellowship Exam. */
export function examinerName(job: JobDef | undefined): string {
  const head = npcName('elder_maelis', 'Headmistress Maelis');
  if (!job || job.tier <= 2 || !isSchool(job.branch)) return head;
  return npcName(SCHOOL_PROFESSOR[job.branch], 'your Professor');
}
/** Display name of an NPC by id (text is owned by the data agent), with a fallback. */
export function npcName(id: string, fallback: string): string {
  return safe(() => Registry.npc(id)?.name, undefined) || fallback;
}

export function jobName(id: string | undefined): string {
  if (!id) return '';
  return safe(() => Registry.job(id as JobDef['id'])?.name, '') || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** One tooltip number: `label` + `value`; `mod` lines are stat modifiers (green), `dim` lines are estimates. */
interface StatLine { label: string; value: string; kind?: 'mod' | 'dim' }

function modLine(m: StatModifier): StatLine {
  const parts: string[] = [];
  if (m.add) {
    const sign = m.add > 0 ? '+' : '−', a = Math.abs(m.add);
    parts.push(FRACTION_STATS.has(m.stat) ? `${sign}${r1(a * 100)}%` : `${sign}${r1(a)}`);
  }
  if (m.mul) parts.push(`${m.mul > 0 ? '+' : '−'}${r1(Math.abs(m.mul) * 100)}%`);
  return { label: STAT_LABELS[m.stat] ?? m.stat, value: parts.join(' & ') || '+0', kind: 'mod' };
}

function attackLines(a: AttackSpec, lv: number, matk: number, out: StatLine[], prefix = '') {
  const pct = safe(() => a.damagePct(lv), 0);
  const hits = Math.max(1, safe(() => a.hits(lv), 1));
  const targets = safe(() => a.maxTargets(lv), 1);
  const count = a.projectile?.count ? safe(() => a.projectile!.count!(lv), 1) : 1;
  const rain = a.rain ? safe(() => a.rain!.count(lv), 1) : 0;
  out.push({ label: `${prefix}Damage`, value: `${fmtNum(pct)}%${hits > 1 ? ` × ${hits}` : ''}` });
  if (matk > 0 && pct > 0) out.push({ label: `${prefix}Est. per line`, value: `≈ ${fmtNum(matk * pct / 100)}`, kind: 'dim' });
  out.push({ label: `${prefix}Max targets`, value: String(targets) });
  if (count > 1) out.push({ label: `${prefix}Projectiles`, value: String(count) });
  if (rain > 0) out.push({ label: `${prefix}Impacts`, value: String(rain) });
  if (a.status) {
    const s = a.status;
    const ch = safe(() => s.chance(lv), 0), dur = safe(() => s.durationMs(lv), 0), pot = safe(() => s.potency(lv), 0);
    let extra = '';
    if ((s.kind === 'burn' || s.kind === 'poison') && pot) extra = ` · ${r1(pot)}%/0.5s`;
    else if (s.kind === 'chill' && pot) extra = ` · −${r1(pot * 100)}% spd`;
    else if ((s.kind === 'shock' || s.kind === 'curse') && pot) extra = ` · +${r1(pot * 100)}% taken`;
    out.push({ label: `${prefix}${STATUS_NAMES[s.kind]}`, value: `${fmtPct(ch)}, ${fmtSec(dur)}${extra}` });
  }
  if (a.bonusVs) out.push({ label: `${prefix}vs ${STATUS_NAMES[a.bonusVs.status]}`, value: `×${r1(a.bonusVs.mult)}${a.bonusVs.consume ? ' (consumes)' : ''}` });
}

/** Numbers for one level of a skill, as label/value lines (so two levels can be compared row by row). */
export function skillLevelLines(def: SkillDef, lv: number, matk: number): StatLine[] {
  const out: StatLine[] = [];
  const mp = safe(() => def.mpCost(lv), 0);
  if (def.kind !== 'passive' && mp > 0) out.push({ label: 'MP cost', value: fmtNum(mp) });
  const cd = def.cooldownMs ? safe(() => def.cooldownMs!(lv), 0) : 0;
  if (cd > 0) out.push({ label: 'Cooldown', value: fmtSec(cd) });
  if (def.attack) attackLines(def.attack, lv, matk, out);
  if (def.buff) {
    out.push({ label: 'Duration', value: fmtSec(safe(() => def.buff!.durationMs(lv), 0)) });
    for (const m of safe(() => def.buff!.modifiers(lv), [] as StatModifier[])) out.push(modLine(m));
  }
  if (def.passive) for (const m of safe(() => def.passive!(lv), [] as StatModifier[])) out.push(modLine(m));
  if (def.movement) out.push({ label: 'Distance', value: `${fmtNum(safe(() => def.movement!.distance(lv), 0))} px` });
  if (def.summon) {
    out.push({ label: 'Duration', value: fmtSec(safe(() => def.summon!.durationMs(lv), 0)) });
    out.push({ label: 'Attacks every', value: fmtSec(def.summon.attackIntervalMs) });
    attackLines(def.summon.attack, lv, matk, out, 'Summon ');
  }
  return out;
}

function lineEl(l: StatLine, next?: string): HTMLElement {
  const cls = `ax-tt-stat${l.kind === 'mod' ? ' ax-mod' : l.kind === 'dim' ? ' ax-dim' : ''}`;
  const val = next !== undefined && next !== l.value
    ? h('b', null, l.value, h('i', { class: 'ax-tt-arrow' }, ' → '), h('em', { class: 'ax-tt-next' }, next))
    : h('b', null, next ?? l.value);
  return h('div', { class: cls }, h('span', null, l.label), val);
}

/** Numbers for one level of a skill (kept for callers that want a single level). */
export function skillLevelBlock(def: SkillDef, lv: number, matk: number): Child[] {
  return skillLevelLines(def, lv, matk).map(l => lineEl(l));
}

/** Current level vs next level in one table: unchanged rows once, changed rows as "a → b". */
function compareBlock(def: SkillDef, lv: number, matk: number): HTMLElement {
  const cur = skillLevelLines(def, lv, matk), nxt = skillLevelLines(def, lv + 1, matk);
  const rows: HTMLElement[] = [];
  const n = Math.max(cur.length, nxt.length);
  for (let i = 0; i < n; i++) {
    const c = cur[i], x = nxt[i];
    if (c && x && c.label === x.label) rows.push(lineEl(c, x.value));
    else if (x) rows.push(lineEl({ ...x, value: '—' }, x.value));
    else if (c) rows.push(lineEl(c));
  }
  return h('div', { class: 'ax-tt-block' }, rows);
}

export interface SkillTipOpts { level: number; matk: number; locked?: string; canLearn?: boolean; hotbar?: boolean; learned?: Record<string, number> }

export function skillTooltip(def: SkillDef, o: SkillTipOpts): HTMLElement {
  const lv = o.level;
  const color = ELEMENT_COLORS[def.element] ?? '#fff';
  const head = h('div', { class: 'ax-tt-head' },
    iconEl(def.icon, 40, def.name),
    h('div', null,
      h('div', { class: 'ax-tt-name', style: `color:${color}` }, def.name),
      h('div', { class: 'ax-tt-sub' }, `${KIND_LABELS[def.kind] ?? def.kind} · ${def.element === 'neutral' ? 'Arcane' : BRANCH_NAMES[def.element as Branch]}`),
      h('div', { class: 'ax-tt-sub' }, `Year ${jobYear(def.job)} ${jobName(def.job)} · Lv ${lv} / ${def.maxLevel}`)));
  const el = h('div', { class: 'ax-tt ax-tt-skill' }, head, h('div', { class: 'ax-tt-desc' }, def.description.replace(/\{[^}]*\}/g, '').trim()));
  if (def.requires?.length) {
    const learned = o.learned ?? {};
    const met = (r: { skillId: string; level: number }) => (learned[r.skillId] ?? 0) >= r.level;
    el.appendChild(h('div', { class: 'ax-tt-req ax-tt-reqs' }, 'Requires: ', def.requires.map((r, i) => h('span', { class: met(r) ? 'ax-ok' : '' },
      `${Registry.skill(r.skillId)?.name ?? r.skillId} Lv ${r.level}${i < def.requires!.length - 1 ? ', ' : ''}`))));
  }
  if (lv > 0 && lv < def.maxLevel) {
    el.appendChild(h('div', { class: 'ax-tt-section' }, h('span', null, `Lv ${lv}`), h('span', { class: 'ax-tt-next' }, ` → Lv ${lv + 1}`)));
    el.appendChild(compareBlock(def, lv, o.matk));
  } else if (lv <= 0) {
    el.appendChild(h('div', { class: 'ax-tt-section ax-next' }, 'At Lv 1'));
    el.appendChild(h('div', { class: 'ax-tt-block' }, skillLevelBlock(def, 1, o.matk)));
  } else {
    el.appendChild(h('div', { class: 'ax-tt-section ax-gold' }, `Mastered — Lv ${lv}`));
    el.appendChild(h('div', { class: 'ax-tt-block' }, skillLevelBlock(def, lv, o.matk)));
  }
  if (o.locked) el.appendChild(h('div', { class: 'ax-tt-req' }, o.locked));
  else if (o.hotbar) el.appendChild(h('div', { class: 'ax-tt-foot' }, 'Right-click or drag off the bar to clear.'));
  else if (lv > 0 && def.kind !== 'passive') el.appendChild(h('div', { class: 'ax-tt-foot' }, 'Drag to the hotbar · double-click to auto-place.'));
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
      el.appendChild(h('div', { class: `ax-tt-req${ok ? ' ax-ok' : ''}` }, `Req. ${schoolName(e.reqBranch)} student`));
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
