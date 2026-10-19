/** Assignments (J; the quest log): In Progress / Available / Handed in, with objective progress. */
import type { Branch, QuestDef, QuestProgress } from '../core/types';
import { Registry } from '../core/registry';
import { STORY_QUEST_IDS, storyStepUnlocked } from '../data/storyQuests';
import { keyText } from '../data/keyText';
import { getBindings, onBindingsChanged } from '../core/bindings';
import type { UICtx } from './context';
import { fmtNum, h, safe } from './dom';
import { UIWindow, tabStrip } from './window';

type Tab = 'active' | 'available' | 'done';

export class QuestsWindow extends UIWindow {
  private tab: Tab = 'active';
  private expanded = new Set<string>();

  constructor(ctx: UICtx) {
    super(ctx, 'quests', 'Assignments', { width: 380, x: 520, y: 96, className: 'ax-quests-win' });
    this.offBindings = onBindingsChanged(() => this.markDirty());   // quest text carries live key hints
  }

  private offBindings: (() => void) | null = null;

  destroy() {
    try { this.offBindings?.(); } catch { /* ignore */ }
    this.offBindings = null;
    super.destroy();
  }

  protected signature(): string {
    const st = this.ctx.s.progression.state;
    // collect objectives depend on inventory counts
    return JSON.stringify([this.tab, [...this.expanded], st.quests, st.level, st.job, st.inventory.map(s => s.itemId + s.qty), getBindings()]);
  }

  protected render() {
    const p = this.ctx.s.progression;
    const st = p.state;
    const all = safe(() => Registry.quests(), [] as QuestDef[]);
    const branch = safe<Branch>(() => p.jobDef().branch, 'none');
    const prog = (q: QuestDef): QuestProgress | undefined => st.quests?.[q.id];
    const active = all.filter(q => { const s = prog(q)?.status; return s === 'active' || s === 'complete'; })
      .sort((a, b) => (prog(b)?.status === 'complete' ? 1 : 0) - (prog(a)?.status === 'complete' ? 1 : 0));
    const done = all.filter(q => prog(q)?.status === 'turned_in');
    // Closest-to-your-level first.
    // Story steps stay hidden until their prerequisite is handed in and their Year is reached (spoiler-free chain).
    const storyView = { level: st.level, tier: safe(() => p.jobDef().tier, 1), quests: st.quests ?? {} };
    const available = all.filter(q => !prog(q) && q.minLevel <= st.level && (!q.requiredJobBranch || q.requiredJobBranch === 'none' || q.requiredJobBranch === branch)
      && (!STORY_QUEST_IDS.has(q.id) || storyStepUnlocked(storyView, q.id)))
      .sort((a, b) => b.minLevel - a.minLevel);
    const lists: Record<Tab, QuestDef[]> = { active, available, done };
    const items = lists[this.tab];

    const list = h('div', { class: 'ax-quest-list' });
    if (!items.length) {
      list.appendChild(h('div', { class: 'ax-empty-note' },
        this.tab === 'active' ? 'No assignments in progress. Talk to staff and students marked with a quest icon.' :
          this.tab === 'available' ? 'No new assignments for your level right now.' : 'No assignments handed in yet.'));
    }
    for (const q of items) list.appendChild(this.card(q, prog(q)));

    this.body.replaceChildren(
      tabStrip<Tab>([
        { id: 'active', label: `In Progress (${active.length})` },
        { id: 'available', label: `Available (${available.length})` },
        { id: 'done', label: `Handed in (${done.length})` },
      ], this.tab, (t) => { this.tab = t; this.invalidate(); this.ctx.sfx('ui_click'); }),
      list);
  }

  private card(q: QuestDef, pr: QuestProgress | undefined): HTMLElement {
    const p = this.ctx.s.progression;
    const giver = Registry.npc(q.giver)?.name ?? q.giver;
    const status = pr?.status;
    const open = this.expanded.has(q.id) || this.tab === 'active';
    const objectives = q.objectives.map((o, i) => {
      let have = 0, need = 1, label = '';
      if (o.kind === 'kill') { need = o.count; have = pr?.counts?.[i] ?? 0; label = `Defeat ${Registry.monster(o.monsterId)?.name ?? o.monsterId}`; }
      else if (o.kind === 'collect') { need = o.count; have = Math.max(pr?.counts?.[i] ?? 0, safe(() => p.countItem(o.itemId), 0)); label = `Collect ${Registry.item(o.itemId)?.name ?? o.itemId}`; }
      else if (o.kind === 'level') { need = o.level; have = p.state.level; label = `Reach level ${o.level}`; }
      else if (o.kind === 'visit') { have = pr?.counts?.[i] ?? 0; label = `Travel to ${Registry.map(o.mapId)?.name ?? o.mapId}`; }
      else { have = pr?.counts?.[i] ?? 0; label = `Talk to ${Registry.npc(o.npcId)?.name ?? o.npcId}`; }
      if (status === 'turned_in') have = need;
      have = Math.min(have, need);
      const pct = Math.round((have / Math.max(1, need)) * 100);
      return h('div', { class: `ax-obj${have >= need ? ' ax-done' : ''}` },
        h('div', { class: 'ax-obj-line' }, h('span', null, label), h('b', null, `${have} / ${need}`)),
        h('div', { class: 'ax-mini-bar' }, h('div', { style: `width:${pct}%` })));
    });
    const r = q.rewards ?? {};
    const rewards: string[] = [];
    if (r.exp) rewards.push(`${fmtNum(r.exp)} EXP`);
    if (r.mesos) rewards.push(`${fmtNum(r.mesos)} mesos`);
    for (const it of r.items ?? []) rewards.push(`${Registry.item(it.itemId)?.name ?? it.itemId}${it.qty > 1 ? ` ×${it.qty}` : ''}`);
    const badge = status === 'complete' ? h('span', { class: 'ax-badge ax-badge-ready' }, 'Ready')
      : status === 'turned_in' ? h('span', { class: 'ax-badge ax-badge-done' }, 'Done')
        : status === 'active' ? null : h('span', { class: 'ax-badge' }, `Lv ${q.minLevel}+`);
    const head = h('div', { class: 'ax-quest-head', onclick: () => { if (this.expanded.has(q.id)) this.expanded.delete(q.id); else this.expanded.add(q.id); this.invalidate(); } },
      h('div', null, h('div', { class: 'ax-quest-name' }, q.name), h('div', { class: 'ax-quest-giver' }, status === 'complete' ? `Return to ${giver}` : `From ${giver}`)), badge);
    return h('div', { class: `ax-quest${status === 'complete' ? ' ax-ready' : ''}` }, head,
      open ? h('div', { class: 'ax-quest-body' },
        h('div', { class: 'ax-quest-desc' }, keyText(q.description)),
        objectives,
        rewards.length ? h('div', { class: 'ax-quest-rewards' }, h('span', { class: 'ax-dim' }, 'Rewards: '), rewards.join(' · ')) : null) : null);
  }
}
