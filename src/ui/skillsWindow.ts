/**
 * Spellbook (K): one tab per school Year in the lineage ("Year 2 · Pyromancer") + locked previews of what is ahead
 * (an Apprentice previews all five Schools). Each Year holds 8–10 spells, so spells are compact two-column cards
 * with a kind filter (Attacks / Buffs / Passives / Summons), a sort toggle, and an SP / points-invested header.
 */
import { HOTBAR_PAGE_SIZE, HOTBAR_SIZE, type JobDef, type JobId, type SkillDef } from '../core/types';
import { Registry } from '../core/registry';
import { getBinding, keyLabel } from '../core/bindings';
import type { UICtx } from './context';
import { h, safe } from './dom';
import { BRANCH_COLORS, BRANCH_NAMES, examinerName, schoolName, skillTooltip } from './info';
import { iconEl } from './uiIcons';
import { UIWindow, hotbarPicker } from './window';

interface TabDef { id: string; year: string; label: string; jobs: JobDef[]; locked: boolean; color: string; note?: string }

type Filter = 'all' | 'attack' | 'buff' | 'passive' | 'summon';
type Sort = 'book' | 'learnable' | 'level';

const KIND_TAG: Record<SkillDef['kind'], string> = { attack: 'Attack', buff: 'Buff', passive: 'Passive', movement: 'Move', summon: 'Summon' };
const FILTERS: { id: Filter; label: string; title: string }[] = [
  { id: 'all', label: 'All', title: 'Every spell this Year' },
  { id: 'attack', label: 'Attacks', title: 'Damage spells' },
  { id: 'buff', label: 'Buffs', title: 'Buffs, heals, blinks and other utility' },
  { id: 'passive', label: 'Passives', title: 'Always-on bonuses' },
  { id: 'summon', label: 'Summons', title: 'Summons and persistent fields' },
];
const SORTS: Record<Sort, { label: string; next: Sort }> = {
  book: { label: 'Book order', next: 'learnable' },
  learnable: { label: 'Learnable first', next: 'level' },
  level: { label: 'Highest level', next: 'book' },
};

function matches(def: SkillDef, f: Filter): boolean {
  if (f === 'all') return true;
  if (f === 'buff') return def.kind === 'buff' || def.kind === 'movement';
  return def.kind === f;
}

export class SkillsWindow extends UIWindow {
  private tab = '';
  private filter: Filter = 'all';
  private sort: Sort = 'book';
  private confirmRespec = '';
  /** Keep the list's scroll position across re-renders (learning a spell re-renders the window). */
  private scrollTop = 0;
  private scrollKey = '';
  /** Phone layout: spell shown in the detail pane, slot chooser state. */
  private selected = '';
  private picking = false;
  private pickPage = 0;

  constructor(ctx: UICtx) {
    super(ctx, 'skills', 'Spellbook', { width: 548, x: 16, y: 80, className: 'ax-skills-win' });
    const sort = ctx.layout.getFlag('skills:sortLearnable', false);
    if (sort) this.sort = 'learnable';
  }

  private allJobs(): JobDef[] { return safe(() => Registry.jobs(), [] as JobDef[]).filter(Boolean); }

  protected onClose() { this.confirmRespec = ''; this.picking = false; }

  private refundableSp(skills: SkillDef[]): number {
    // Match respecTier: the starting Arcane Bolt level was free and stays learned.
    return skills.reduce((n, d) => n + Math.max(0,
      (this.ctx.s.progression.state.skills[d.id] ?? 0) - (d.id === 'app_arcane_bolt' ? 1 : 0)), 0);
  }

  private descendants(id: JobId): JobDef[] {
    const out: JobDef[] = [];
    const walk = (pid: JobId) => {
      for (const j of this.allJobs()) if (j.parent === pid) { out.push(j); walk(j.id); }
    };
    walk(id);
    return out.sort((a, b) => a.tier - b.tier);
  }

  private tabs(): TabDef[] {
    const st = this.ctx.s.progression.state;
    const lineage = safe(() => Registry.jobLineage(st.job), [] as JobDef[]);
    const tabs: TabDef[] = lineage.map(j => ({
      id: j.id, year: `Year ${j.tier}`, label: j.name, jobs: [j], locked: false, color: BRANCH_COLORS[j.branch] ?? '#c9b8ff',
    }));
    if (!tabs.length) tabs.push({ id: st.job, year: 'Year 1', label: st.job, jobs: [], locked: false, color: '#c9b8ff' });
    const cur = lineage[lineage.length - 1];
    if (cur && cur.tier === 1) {
      // Apprentice: preview each School (all of its Years) as a locked tab.
      for (const j of this.allJobs().filter(x => x.parent === cur.id)) {
        tabs.push({
          id: `preview:${j.branch}`, year: 'Year 2–4', label: BRANCH_NAMES[j.branch] ?? j.name, locked: true,
          color: BRANCH_COLORS[j.branch] ?? '#c9b8ff', jobs: [j, ...this.descendants(j.id)],
          note: `${schoolName(j.branch)}: declare it at your Year-end Exam (Lv ${j.requiredLevel}) with ${examinerName(j)} on campus.`,
        });
      }
    } else if (cur) {
      for (const j of this.descendants(cur.id)) {
        tabs.push({
          id: `preview:${j.id}`, year: `Year ${j.tier}`, label: j.name, jobs: [j], locked: true, color: BRANCH_COLORS[j.branch] ?? '#c9b8ff',
          note: `Year ${j.tier} opens at Lv ${j.requiredLevel} — pass your Year-end Exam with ${examinerName(j)} on campus.`,
        });
      }
    }
    return tabs;
  }

  protected signature(): string {
    const p = this.ctx.s.progression;
    const st = p.state;
    const learnable = Registry.skills().filter(s => safe(() => p.canLearn(s.id), false)).map(s => s.id).join(',');
    return JSON.stringify([this.tab, this.filter, this.sort, st.job, st.level, st.sp, st.skills, learnable, st.hotbar,
      p.countItem('tome_of_unlearning'), this.confirmRespec, this.mobile, this.selected, this.picking, this.pickPage]);
  }

  protected render() {
    const p = this.ctx.s.progression;
    const st = p.state;
    const tabs = this.tabs();
    if (!tabs.find(t => t.id === this.tab)) {
      // default to the current (deepest unlocked) Year
      const unlocked = tabs.filter(t => !t.locked);
      this.tab = (unlocked[unlocked.length - 1] ?? tabs[0]).id;
    }
    const tab = tabs.find(t => t.id === this.tab)!;
    if (this.mobile) { this.renderMobile(tabs, tab); return; }
    this.titleExtra.replaceChildren(h('span', { class: `ax-pill${st.sp > 0 ? ' ax-glow' : ''}` }, `SP ${st.sp}`));
    const matk = safe(() => p.derived().matk, 0);

    // previous list scroll (same tab + filter keeps its position)
    const oldList = this.body.querySelector('.ax-skill-list') as HTMLElement | null;
    if (oldList) this.scrollTop = oldList.scrollTop;
    const key = `${this.tab}|${this.filter}|${this.sort}`;
    if (key !== this.scrollKey) { this.scrollKey = key; this.scrollTop = 0; }

    // ── tabs: two-line "Year N / Job" buttons tinted by school
    const strip = h('div', { class: 'ax-tabs ax-year-tabs' }, tabs.map(t => h('button', {
      class: `ax-tab ax-year-tab${t.id === this.tab ? ' ax-active' : ''}${t.locked ? ' ax-locked' : ''}`,
      style: `--accent:${t.color}`,
      title: t.locked ? `${t.year} · ${t.label} — ${t.note ?? ''}` : `${t.year} · ${t.label}`,
      onclick: () => { if (t.id !== this.tab) { this.tab = t.id; this.confirmRespec = ''; this.invalidate(); this.ctx.sfx('ui_click'); } },
    },
    h('span', { class: 'ax-year-tab-year' }, t.locked ? h('span', { class: 'ax-lock' }) : null, t.year),
    h('span', { class: 'ax-tab-label' }, t.label))));

    // ── all spells of this tab (grouped by job when a preview spans several Years)
    const groups = tab.jobs.map(job => ({ job, skills: safe(() => Registry.skillsForJob(job.id), [] as SkillDef[]) }));
    const all = groups.flatMap(g => g.skills);
    const invested = all.reduce((n, d) => n + (tab.locked ? 0 : st.skills[d.id] ?? 0), 0);
    const capacity = all.reduce((n, d) => n + d.maxLevel, 0);
    const learnableHere = tab.locked ? 0 : all.filter(d => (st.skills[d.id] ?? 0) < d.maxLevel && safe(() => p.canLearn(d.id), false)).length;

    // ── header: what this tab is + points invested + SP
    const job = tab.jobs[0];
    const header = h('div', { class: 'ax-book-head', style: `--accent:${tab.color}` },
      h('div', { class: 'ax-book-title' },
        h('b', null, tab.locked && tab.jobs.length > 1 ? schoolName(job?.branch ?? 'none') : `${tab.year} · ${tab.label}`),
        h('span', null, tab.locked ? ' — preview' : ` — ${all.length} spells`)),
      tab.locked ? null : h('div', { class: 'ax-book-meta' },
        h('span', null, 'Invested ', h('b', null, `${invested}`), ` / ${capacity}`),
        learnableHere ? h('span', { class: 'ax-book-ready' }, `${learnableHere} can level`) : null),
      h('div', { class: `ax-book-sp${st.sp > 0 ? ' ax-glow' : ''}` }, h('span', null, 'SP'), h('b', null, String(st.sp))));

    // ── per-Year unlearning: second click confirms the refund and consumes one tome.
    const tomes = p.countItem('tome_of_unlearning');
    const refund = tab.locked ? 0 : this.refundableSp(all);
    const reason = tab.locked ? 'This Year is locked. Pass its Year-end Exam first.'
      : refund === 0 ? 'No learned spells to unlearn in this Year. The free starting Arcane Bolt level is kept.'
      : tomes === 0 ? 'Requires a Tome of Unlearning. Buy one from Quartermaster Bram for 2,500 mesos.' : '';
    const respecKey = JSON.stringify([st.job, tab.id, refund]);
    if (reason || this.confirmRespec !== respecKey) this.confirmRespec = '';
    const confirming = this.confirmRespec === respecKey;
    const hint = reason || `Spend 1 Tome of Unlearning to unlearn ${tab.year} spells and refund ${refund} SP. The free starting Arcane Bolt level is kept.${confirming ? ' Click again to confirm.' : ''}`;
    const unlearn = h('div', { class: 'ax-book-respec' },
      h('button', {
        class: `ax-btn ax-btn-small ${confirming ? 'ax-btn-danger' : 'ax-btn-secondary'}`,
        disabled: !!reason, title: hint,
        onclick: () => {
          // Recheck live state in case inventory or spell levels changed before the next render.
          const currentRefund = this.refundableSp(all);
          const inLineage = job && Registry.jobLineage(p.state.job).some(j => j.id === job.id);
          if (tab.locked || !inLineage || !currentRefund || !p.countItem('tome_of_unlearning')) {
            this.confirmRespec = ''; this.invalidate(); this.ctx.sfx('ui_error'); return;
          }
          if (!confirming || this.confirmRespec !== respecKey || currentRefund !== refund) {
            this.confirmRespec = JSON.stringify([p.state.job, tab.id, currentRefund]);
            this.invalidate(); this.ctx.sfx('ui_click'); return;
          }
          this.confirmRespec = '';
          let refunded = 0;
          if (p.removeItem('tome_of_unlearning', 1)) {
            refunded = p.respecTier(job.tier);
            if (refunded === 0) p.addItem('tome_of_unlearning', 1);
          }
          this.ctx.sfx(refunded > 0 ? 'ui_click' : 'ui_error');
          this.invalidate();
        },
      }, confirming ? `Unlearn ${refund} SP?` : 'Unlearn Year'),
      h('span', { class: 'ax-dim' }, `Tomes: ${tomes}`));
    // A wrapper receives hover events even while the button is disabled.
    this.ctx.tooltip.attach(unlearn, () => hint);
    if (confirming) unlearn.appendChild(h('button', {
      class: 'ax-btn ax-btn-small ax-btn-secondary',
      onclick: () => { this.confirmRespec = ''; this.invalidate(); this.ctx.sfx('ui_click'); },
    }, 'Cancel'));

    // ── toolbar: kind filter chips (with counts) + sort toggle
    const count = (f: Filter) => all.filter(d => matches(d, f)).length;
    const chips = h('div', { class: 'ax-book-tools' },
      h('div', { class: 'ax-chips' }, FILTERS.map(f => {
        const n = count(f.id);
        return h('button', {
          class: `ax-chip ax-chip-${f.id}${this.filter === f.id ? ' ax-active' : ''}`, disabled: f.id !== 'all' && n === 0, title: f.title,
          onclick: () => { if (this.filter !== f.id) { this.filter = f.id; this.invalidate(); this.ctx.sfx('ui_click'); } },
        }, f.label, h('span', { class: 'ax-chip-n' }, String(n)));
      })),
      h('button', {
        class: 'ax-chip ax-sort', title: 'Change sort order',
        onclick: () => {
          this.sort = SORTS[this.sort].next; this.ctx.layout.setFlag('skills:sortLearnable', this.sort === 'learnable');
          this.invalidate(); this.ctx.sfx('ui_click');
        },
      }, '⇅ ', SORTS[this.sort].label));

    // ── list
    const list = h('div', { class: 'ax-skill-list' });
    if (tab.locked && tab.note) list.appendChild(h('div', { class: 'ax-locked-note' }, h('span', { class: 'ax-lock' }), tab.note));
    let shown = 0;
    for (const g of groups) {
      const skills = this.sorted(g.skills.filter(d => matches(d, this.filter)), tab.locked);
      if (tab.jobs.length > 1) {
        list.appendChild(h('div', { class: 'ax-skill-group', style: `--accent:${BRANCH_COLORS[g.job.branch] ?? '#c9b8ff'}` },
          h('b', null, `Year ${g.job.tier} · ${g.job.name}`), h('span', null, ` · Lv ${g.job.requiredLevel} · ${g.skills.length} spells`),
          g.job.description ? h('div', { class: 'ax-skill-group-desc' }, g.job.description) : null));
      } else if (g.job.description && this.filter === 'all') {
        list.appendChild(h('div', { class: 'ax-skill-group-desc ax-solo' }, g.job.description));
      }
      if (!g.skills.length) { list.appendChild(h('div', { class: 'ax-empty-note' }, 'No spells recorded for this Year yet.')); continue; }
      const grid = h('div', { class: 'ax-skill-grid' });
      for (const def of skills) grid.appendChild(this.card(def, tab.locked, matk));
      shown += skills.length;
      if (skills.length) list.appendChild(grid);
    }
    if (!shown && all.length) list.appendChild(h('div', { class: 'ax-empty-note' }, 'No spells of this kind in this Year.'));

    const footer = h('div', { class: 'ax-win-footer' },
      h('span', { class: 'ax-dim' }, tab.locked ? 'Preview — not yet available' : 'Drag to the hotbar · double-click to auto-place · Shift+ = up to 5 SP'),
      h('span', { class: 'ax-sp' }, 'SP ', h('b', null, String(st.sp))));
    this.body.replaceChildren(strip, header, unlearn, chips, list, footer);
    if (this.scrollTop) list.scrollTop = this.scrollTop;
  }

  private sorted(skills: SkillDef[], locked: boolean): SkillDef[] {
    if (this.sort === 'book' || locked) return skills;
    const p = this.ctx.s.progression;
    const lv = (d: SkillDef) => p.state.skills[d.id] ?? 0;
    const can = (d: SkillDef) => lv(d) < d.maxLevel && safe(() => p.canLearn(d.id), false) ? 1 : 0;
    const idx = new Map(skills.map((d, i) => [d.id, i]));
    return [...skills].sort((a, b) => this.sort === 'learnable'
      ? (can(b) - can(a)) || (idx.get(a.id)! - idx.get(b.id)!)
      : (lv(b) - lv(a)) || (idx.get(a.id)! - idx.get(b.id)!));
  }

  /** Put a learned active spell into the first empty hotbar slot (no-op if it is already there). */
  private autoPlace(def: SkillDef) {
    const p = this.ctx.s.progression;
    const hb = p.state.hotbar ?? [];
    const pageOf = (i: number) => Math.floor(i / HOTBAR_PAGE_SIZE) + 1;
    const at = hb.indexOf(def.id);
    if (at >= 0) { this.ctx.log(`${def.name} is already on hotbar page ${pageOf(at)}.`, '#b8c2ff'); return; }
    // Current page first, then the other page(s); skip each page's 1/2 keys (potion slots) unless nothing else is free.
    const pages = Math.max(1, Math.floor(HOTBAR_SIZE / HOTBAR_PAGE_SIZE));
    const cur = safe(() => this.ctx.s.game.hotbarPage(), 0) || 0;
    const order: number[] = [];
    for (let k = 0; k < pages; k++) { const pg = (cur + k) % pages; for (let i = 0; i < HOTBAR_PAGE_SIZE; i++) order.push(pg * HOTBAR_PAGE_SIZE + i); }
    const isPotionKey = (abs: number) => abs % HOTBAR_PAGE_SIZE >= HOTBAR_PAGE_SIZE - 2;
    const slot = order.find(i => !hb[i] && !isPotionKey(i)) ?? order.find(i => !hb[i]);
    if (slot === undefined) { this.ctx.sfx('ui_error'); this.ctx.log('Both hotbar pages are full — drag the spell onto a slot to replace it.', '#ff9b9b'); return; }
    safe(() => p.setHotbar(slot, def.id), undefined);
    if (pageOf(slot) - 1 !== cur) this.ctx.log(`${def.name} added to hotbar page ${pageOf(slot)} (${keyLabel(getBinding('hotbarPage'))} to flip).`, '#b8c2ff');
    this.ctx.sfx('ui_click');
  }

  private card(def: SkillDef, locked: boolean, matk: number): HTMLElement {
    const p = this.ctx.s.progression;
    const lv = locked ? 0 : p.state.skills[def.id] ?? 0;
    const canLearn = !locked && lv < def.maxLevel && safe(() => p.canLearn(def.id), false);
    const active = def.kind !== 'passive';
    const draggable = !locked && lv > 0 && active;
    const icon = h('div', { class: `ax-skill-icon${draggable ? ' ax-draggable' : ''}${lv === 0 ? ' ax-unlearned' : ''}` }, iconEl(def.icon, 32, def.name));
    if (draggable) this.ctx.drag.bind(icon, () => ({ entry: def.id, icon: def.icon, label: def.name }));
    const reqMissing = (def.requires ?? []).filter(r => (p.state.skills[r.skillId] ?? 0) < r.level);
    const plus = h('button', {
      class: 'ax-plus', disabled: !canLearn, title: canLearn ? 'Learn / level up (1 SP · Shift: up to 5)' : '',
      onclick: (e: MouseEvent) => {
        const times = e.shiftKey ? 5 : 1;
        let n = 0;
        for (let i = 0; i < times; i++) { if (safe(() => p.learnSkill(def.id), false)) n++; else break; }
        if (n) { this.ctx.sfx('ui_click'); this.invalidate(); this.ctx.tooltip.refresh(); }
        else this.ctx.sfx('ui_error');
      },
    }, '+');
    const pct = Math.round((lv / Math.max(1, def.maxLevel)) * 100);
    const onHotbar = !locked && (p.state.hotbar ?? []).includes(def.id);
    const barPage = onHotbar ? Math.floor((p.state.hotbar ?? []).indexOf(def.id) / HOTBAR_PAGE_SIZE) + 1 : 0;
    const status = !locked && lv === 0 && reqMissing.length
      ? h('div', { class: 'ax-skill-req' }, `Needs ${reqMissing.map(r => `${Registry.skill(r.skillId)?.name ?? r.skillId} ${r.level}`).join(', ')}`)
      : null;
    const card = h('div', {
      class: `ax-skill-card ax-k-${def.kind}${locked ? ' ax-locked' : ''}${lv >= def.maxLevel ? ' ax-maxed' : ''}${canLearn ? ' ax-can' : ''}${lv === 0 ? ' ax-zero' : ''}`,
    },
    icon,
    h('div', { class: 'ax-skill-main' },
      h('div', { class: 'ax-skill-name' }, h('span', { class: 'ax-skill-name-t' }, def.name), onHotbar ? h('span', { class: 'ax-on-bar', title: `On hotbar page ${barPage}` }) : null),
      h('div', { class: 'ax-skill-lv' },
        h('span', { class: `ax-kind ax-kind-${def.kind}` }, KIND_TAG[def.kind] ?? def.kind),
        h('div', { class: 'ax-mini-bar' }, h('div', { style: `width:${pct}%` })),
        h('span', { class: 'ax-skill-lvnum' }, `${lv}/${def.maxLevel}`)),
      status),
    locked ? h('span', { class: 'ax-lock ax-lock-lg' }) : plus);
    if (draggable) card.addEventListener('dblclick', (e) => { if (!(e.target as HTMLElement).closest('button')) this.autoPlace(def); });
    this.ctx.tooltip.attach(card, () => skillTooltip(def, {
      level: locked ? 0 : (this.ctx.s.progression.state.skills[def.id] ?? 0), matk,
      learned: locked ? undefined : this.ctx.s.progression.state.skills,
      locked: locked ? `Locked — Year ${Registry.job(def.job)?.tier ?? '?'} ${Registry.job(def.job)?.name ?? def.job} spell` : undefined,
    }));
    return card;
  }

  // ───────────────────────────── phone layout ─────────────────────────────

  /** Phone Spellbook: Year scroller on top, big spell rows on the left, tap-to-detail pane on the right. */
  private renderMobile(tabs: TabDef[], tab: TabDef) {
    const p = this.ctx.s.progression;
    const st = p.state;
    const matk = safe(() => p.derived().matk, 0);
    this.titleExtra.replaceChildren(h('span', { class: `ax-pill ax-m-sp${st.sp > 0 ? ' ax-glow' : ''}` }, `SP ${st.sp}`));
    const oldList = this.body.querySelector('.ax-m-list') as HTMLElement | null;
    const oldTabs = this.body.querySelector('.ax-m-yeartabs') as HTMLElement | null;
    const key = `${this.tab}|${this.filter}`;
    let top = oldList?.scrollTop ?? 0;
    if (key !== this.scrollKey) { this.scrollKey = key; top = 0; }

    const strip = h('div', { class: 'ax-m-yeartabs' }, tabs.map(t => h('button', {
      class: `ax-m-yeartab${t.id === this.tab ? ' ax-active' : ''}${t.locked ? ' ax-locked' : ''}`,
      style: `--accent:${t.color}`,
      onclick: () => { if (t.id !== this.tab) { this.tab = t.id; this.confirmRespec = ''; this.selected = ''; this.picking = false; this.invalidate(); this.ctx.sfx('ui_click'); } },
    }, h('span', { class: 'ax-m-yeartab-year' }, t.locked ? h('span', { class: 'ax-lock' }) : null, t.year), h('span', { class: 'ax-m-yeartab-name' }, t.label))));

    const groups = tab.jobs.map(job => ({ job, skills: safe(() => Registry.skillsForJob(job.id), [] as SkillDef[]) }));
    const all = groups.flatMap(g => g.skills);
    const count = (f: Filter) => all.filter(d => matches(d, f)).length;
    const chips = h('div', { class: 'ax-m-chips' }, FILTERS.filter(f => f.id === 'all' || count(f.id) > 0).map(f => h('button', {
      class: `ax-chip ax-chip-${f.id}${this.filter === f.id ? ' ax-active' : ''}`,
      onclick: () => { if (this.filter !== f.id) { this.filter = f.id; this.invalidate(); this.ctx.sfx('ui_click'); } },
    }, f.label, h('span', { class: 'ax-chip-n' }, ` ${count(f.id)}`))));

    const list = h('div', { class: 'ax-m-list ax-m-scroll' }, chips);
    if (tab.locked && tab.note) list.appendChild(h('div', { class: 'ax-locked-note' }, h('span', { class: 'ax-lock' }), tab.note));
    for (const g of groups) {
      if (tab.jobs.length > 1) list.appendChild(h('div', { class: 'ax-m-group', style: `--accent:${BRANCH_COLORS[g.job.branch] ?? '#c9b8ff'}` }, `Year ${g.job.tier} · ${g.job.name} · Lv ${g.job.requiredLevel}`));
      for (const def of g.skills.filter(d => matches(d, this.filter))) list.appendChild(this.mobileRow(def, tab.locked));
    }
    if (!all.length) list.appendChild(h('div', { class: 'ax-empty-note' }, 'No spells recorded for this Year yet.'));
    if (!tab.locked) list.appendChild(this.mobileUnlearn(tab, all));

    const detail = h('div', { class: 'ax-m-detail ax-m-scroll' });
    const def = all.find(d => d.id === this.selected);
    if (!def) {
      detail.appendChild(h('div', { class: 'ax-m-hint' }, tab.locked ? 'Preview: tap a spell to read about it.' : 'Tap a spell to see what it does, learn it, or put it on your skill buttons.'));
    } else {
      const lv = tab.locked ? 0 : st.skills[def.id] ?? 0;
      const canLearn = !tab.locked && lv < def.maxLevel && safe(() => p.canLearn(def.id), false);
      const active = def.kind !== 'passive';
      detail.appendChild(h('div', { class: 'ax-m-tip' }, skillTooltip(def, {
        level: lv, matk, learned: tab.locked ? undefined : st.skills,
        locked: tab.locked ? `Locked — Year ${Registry.job(def.job)?.tier ?? '?'} ${Registry.job(def.job)?.name ?? def.job} spell` : undefined,
      })));
      if (this.picking && !tab.locked && lv > 0 && active) {
        detail.prepend(hotbarPicker(this.ctx, def.id, this.pickPage,
          (pg) => { this.pickPage = pg; this.invalidate(); },
          () => { this.picking = false; this.invalidate(); }));
      } else if (!tab.locked) {
        const onBar = (st.hotbar ?? []).includes(def.id);
        detail.appendChild(h('div', { class: 'ax-m-actions' },
          h('button', {
            class: 'ax-btn ax-m-btn', disabled: !canLearn,
            onclick: () => { if (safe(() => p.learnSkill(def.id), false)) this.ctx.sfx('ui_click'); else this.ctx.sfx('ui_error'); this.invalidate(); },
          }, lv >= def.maxLevel ? 'Mastered' : lv === 0 ? '+ Learn' : '+ Level'),
          active ? h('button', {
            class: 'ax-btn ax-btn-secondary ax-m-btn', disabled: lv === 0,
            onclick: () => { this.picking = true; this.pickPage = safe(() => this.ctx.s.game.hotbarPage(), 0) || 0; this.invalidate(); this.ctx.sfx('ui_click'); },
          }, onBar ? 'Move slot' : 'To hotbar') : null));
      }
    }

    this.body.replaceChildren(strip, h('div', { class: 'ax-m-split' }, list, detail));
    if (top) list.scrollTop = top;
    if (oldTabs) strip.scrollLeft = oldTabs.scrollLeft;
    else requestAnimationFrame(() => {
      const a = strip.querySelector('.ax-active') as HTMLElement | null;
      if (a) strip.scrollLeft = a.offsetLeft - (strip.clientWidth - a.offsetWidth) / 2;
    });
  }

  private mobileRow(def: SkillDef, locked: boolean): HTMLElement {
    const p = this.ctx.s.progression;
    const lv = locked ? 0 : p.state.skills[def.id] ?? 0;
    const canLearn = !locked && lv < def.maxLevel && safe(() => p.canLearn(def.id), false);
    const onHotbar = !locked && (p.state.hotbar ?? []).includes(def.id);
    const pct = Math.round((lv / Math.max(1, def.maxLevel)) * 100);
    const row = h('div', {
      class: `ax-m-row ax-m-spell ax-k-${def.kind}${this.selected === def.id ? ' ax-sel' : ''}${locked ? ' ax-locked' : ''}${lv >= def.maxLevel ? ' ax-maxed' : ''}${lv === 0 ? ' ax-zero' : ''}`,
      onclick: (e: Event) => {
        if ((e.target as HTMLElement).closest('button')) return;
        if (this.selected !== def.id) { this.selected = def.id; this.picking = false; this.invalidate(); this.ctx.sfx('ui_click'); }
      },
    },
    h('div', { class: `ax-skill-icon${lv === 0 ? ' ax-unlearned' : ''}` }, iconEl(def.icon, 40, def.name)),
    h('div', { class: 'ax-m-row-main' },
      h('div', { class: 'ax-m-row-name' }, h('span', { class: 'ax-m-row-t' }, def.name), onHotbar ? h('span', { class: 'ax-on-bar' }) : null),
      h('div', { class: 'ax-m-row-sub' },
        h('span', { class: `ax-kind ax-kind-${def.kind}` }, KIND_TAG[def.kind] ?? def.kind),
        h('div', { class: 'ax-mini-bar' }, h('div', { style: `width:${pct}%` })),
        h('span', { class: 'ax-m-row-lv' }, `${lv}/${def.maxLevel}`))),
    locked ? h('span', { class: 'ax-lock ax-lock-lg' }) : h('button', {
      class: 'ax-plus ax-m-plus', disabled: !canLearn, 'aria-label': `Learn ${def.name}`,
      onclick: () => {
        if (safe(() => p.learnSkill(def.id), false)) { this.selected = def.id; this.ctx.sfx('ui_click'); } else this.ctx.sfx('ui_error');
        this.invalidate();
      },
    }, '+'));
    return row;
  }

  /** Phone version of the per-Year unlearn control (two taps; reason shown as text instead of a tooltip). */
  private mobileUnlearn(tab: TabDef, all: SkillDef[]): HTMLElement {
    const p = this.ctx.s.progression;
    const job = tab.jobs[0];
    const tomes = p.countItem('tome_of_unlearning');
    const refund = this.refundableSp(all);
    const reason = refund === 0 ? 'Nothing to unlearn in this Year.' : tomes === 0 ? 'Needs a Tome of Unlearning (Quartermaster Bram, 2,500 mesos).' : '';
    const respecKey = JSON.stringify([p.state.job, tab.id, refund]);
    if (reason || this.confirmRespec !== respecKey) this.confirmRespec = '';
    const confirming = this.confirmRespec === respecKey;
    return h('div', { class: 'ax-m-unlearn' },
      h('div', { class: 'ax-m-note' }, reason || (confirming ? `Tap again to spend 1 Tome and refund ${refund} SP.` : `Unlearn this Year: refund ${refund} SP for 1 Tome (you have ${tomes}).`)),
      h('div', { class: 'ax-m-actions' },
        h('button', {
          class: `ax-btn ${confirming ? 'ax-btn-danger' : 'ax-btn-secondary'} ax-m-btn`, disabled: !!reason,
          onclick: () => {
            const current = this.refundableSp(all);
            if (!job || !current || !p.countItem('tome_of_unlearning')) { this.confirmRespec = ''; this.invalidate(); this.ctx.sfx('ui_error'); return; }
            if (!confirming || current !== refund) { this.confirmRespec = JSON.stringify([p.state.job, tab.id, current]); this.invalidate(); this.ctx.sfx('ui_click'); return; }
            this.confirmRespec = '';
            let refunded = 0;
            if (p.removeItem('tome_of_unlearning', 1)) {
              refunded = p.respecTier(job.tier);
              if (refunded === 0) p.addItem('tome_of_unlearning', 1);
            }
            this.ctx.sfx(refunded > 0 ? 'ui_click' : 'ui_error');
            this.invalidate();
          },
        }, confirming ? `Unlearn ${refund} SP?` : 'Unlearn Year'),
        confirming ? h('button', { class: 'ax-btn ax-btn-secondary ax-m-btn', onclick: () => { this.confirmRespec = ''; this.invalidate(); } }, 'Cancel') : null));
  }

}
