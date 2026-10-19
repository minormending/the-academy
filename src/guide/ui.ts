// Shared pieces of the handbook page: anchors, links, element and status pills, number formats, headings and
// key names (from the default bindings, so the handbook names the keys a new student actually has).

import type { Element, StatusKind } from '../core/types';
import { Registry } from '../core/registry';
import { JOB_LEVELS } from '../core/constants';
import { DEFAULT_BINDINGS, keyLabel, type ActionId } from '../core/bindings';
import { SCHOOL_NAME, isSchool, type School } from '../data/jobs';
import { h, type Child } from './dom';
import { iconImg, monsterImg, portraitImg } from './art';

// ─────────────────────────── anchors ───────────────────────────

export const anchor = {
  monster: (id: string) => `mon-${id}`,
  item: (id: string) => `item-${id}`,
  spell: (id: string) => `spell-${id}`,
  map: (id: string) => `map-${id}`,
  zone: (id: string) => `zone-${id}`,
  quest: (id: string) => `quest-${id}`,
  npc: (id: string) => `npc-${id}`,
  school: (s: School) => `school-${s}`,
  boss: (id: string) => `boss-${id}`,
};

// ─────────────────────────── formats ───────────────────────────

export const num = (n: number) => Math.round(n).toLocaleString('en-US');
export const mesos = (n: number) => `${num(n)} mesos`;
export const secs = (ms: number) => {
  const s = ms / 1000;
  return s >= 120 ? `${+(s / 60).toFixed(1)} min` : `${+s.toFixed(s < 10 ? 1 : 0)} s`;
};
export const pct = (f: number, digits = 0) => `${+(f * 100).toFixed(digits)}%`;
/** Drop chance: 45%, 1.2%, 0.5%. */
export const chance = (f: number) => (f >= 0.1 ? pct(f) : `${+(f * 100).toFixed(1)}%`);
export const range = (a: number, b: number) => (Math.round(a) === Math.round(b) ? num(a) : `${num(a)}–${num(b)}`);
export const lvRange = ([a, b]: [number, number]) => (a === b ? `Lv ${a}` : `Lv ${a}–${b}`);

// ─────────────────────────── keys ───────────────────────────

/** Default key for an action ("K", "Space", "↑"). */
export const keyName = (a: ActionId) => keyLabel(DEFAULT_BINDINGS[a] ?? 0);
export const kbd = (a: ActionId) => h('kbd', keyName(a));
/** Replace the game's `{key:action}` tokens (quest text) with default key names. */
export const keyText = (text: string) => text.replace(/\{key:([A-Za-z0-9]+)\}/g, (m, id: string) => (id in DEFAULT_BINDINGS ? keyName(id as ActionId) : m));

/**
 * Handbook prose tokens, so writers never type a number the data knows:
 * `{key:skills}` default key · `{joblv:2}` level a Year opens · `{qlv:story_violet_thorns}` a quest's level ·
 * `{mlv:moss_snail}` a monster's level · `{zlv:whisperwood}` a zone's level range.
 */
export function expand(text: string): string {
  return keyText(text).replace(/\{(joblv|qlv|mlv|zlv):([\w]+)\}/g, (m, kind: string, id: string) => {
    if (kind === 'joblv') return String(JOB_LEVELS[Number(id) as 1 | 2 | 3 | 4] ?? m);
    if (kind === 'qlv') return String(Registry.quest(id)?.minLevel ?? m);
    if (kind === 'mlv') return String(Registry.monster(id)?.level ?? m);
    const r = Registry.map(id)?.levelRange;
    return r ? `${r[0]}–${r[1]}` : m;
  });
}

// ─────────────────────────── elements & statuses ───────────────────────────

export const ELEMENT_NAME: Record<Element, string> = {
  neutral: 'Arcane', fire: 'Fire', ice: 'Ice', lightning: 'Lightning', holy: 'Holy', shadow: 'Shadow',
};
export const elemPill = (e: Element) => h('span.pill', { class: `el-${e}` }, ELEMENT_NAME[e]);
export const elemPills = (es: readonly Element[] | undefined) => (es?.length ? h('span.pills', es.map(elemPill)) : h('span.muted', '—'));

export const STATUS_INFO: Record<StatusKind, { name: string; what: string }> = {
  burn: { name: 'Burn', what: 'damage every 0.5 s, a share of the hit that applied it' },
  chill: { name: 'Chill', what: 'slows movement' },
  freeze: { name: 'Freeze', what: 'cannot move or attack (bosses: half duration)' },
  shock: { name: 'Shock', what: 'takes extra damage from every hit' },
  stun: { name: 'Stun', what: 'cannot move or attack (bosses: half duration)' },
  poison: { name: 'Poison', what: 'damage every 0.5 s, a share of the hit that applied it' },
  curse: { name: 'Curse', what: 'takes more damage and deals less contact damage' },
};
export const statusPill = (s: StatusKind) => h('span.pill.st', { class: `st-${s}`, title: STATUS_INFO[s].what }, STATUS_INFO[s].name);

export const schoolName = (s: School) => SCHOOL_NAME[s];
export const schoolOfBranch = (b: string | undefined): School | null => (isSchool(b) ? b : null);

// ─────────────────────────── links ───────────────────────────

export function monsterLink(id: string, pic = false): HTMLElement {
  const m = Registry.monster(id);
  return h('a.mon-link', { href: `#${anchor.monster(id)}` }, pic ? monsterImg(id, 28) : null, h('span', m?.name ?? id));
}

export function itemLink(id: string, icon = true, qty?: number): HTMLElement {
  const it = Registry.item(id);
  return h('a.item-link', { href: `#${anchor.item(id)}` }, icon ? iconImg(it?.icon, 24) : null, h('span', it?.name ?? id), qty && qty > 1 ? h('small.qty', `×${num(qty)}`) : null);
}

export function spellLink(id: string, icon = true): HTMLElement {
  const s = Registry.skill(id);
  return h('a.spell-link', { href: `#${anchor.spell(id)}` }, icon ? iconImg(s?.icon, 24) : null, h('span', s?.name ?? id));
}

export function mapLink(id: string): HTMLElement {
  return h('a.map-link', { href: `#${anchor.map(id)}` }, Registry.map(id)?.name ?? id);
}

export function questLink(id: string): HTMLElement {
  return h('a.quest-link', { href: `#${anchor.quest(id)}` }, Registry.quest(id)?.name ?? id);
}

export function npcLink(id: string, pic = false): HTMLElement {
  const n = Registry.npc(id);
  return h('a.npc-link', { href: `#${anchor.npc(id)}` }, pic ? portraitImg(id, 24) : null, h('span', n?.name ?? id));
}

export function sectionHeading(level: 2 | 3 | 4, id: string, text: string, kicker?: string): HTMLElement {
  return h(`h${level}`, { id }, kicker ? h('span.kicker', kicker) : null, h('span', text), h('a.hash', { href: `#${id}`, 'aria-label': 'Link to this section' }, '#'));
}

/** A small "label: value" fact list. */
export function facts(rows: [string, Child][]): HTMLElement {
  return h('dl.facts', rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [h('dt', k), h('dd', v)]));
}

/** A scrolling table wrapper. */
export const scroll = (table: HTMLElement) => h('div.scroll', table);
