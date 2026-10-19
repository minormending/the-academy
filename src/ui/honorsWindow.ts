/** Academy Honors window (default O): honors by category with progress, earned dates, secrets, and the title selector. */
import { getBinding, keyLabel } from '../core/bindings';
import { availableHonors, HONOR_CATEGORIES, honorTitles, type HonorCategory, type HonorDef } from '../data/honors';
import { earnedTitles, ensureHonors, honorView } from '../systems/HonorsSystem';
import type { UICtx } from './context';
import { fmtNum, h, safe } from './dom';
import { iconEl } from './uiIcons';
import { UIWindow, tabStrip } from './window';

type Tab = HonorCategory | 'titles';

let current: HonorsWindow | null = null;

/** Toggle the mounted Honors window (HUD quick button, key binding). */
export function toggleHonorsWindow(): void { current?.toggle(); }

export class HonorsWindow extends UIWindow {
  private tab: Tab = 'studies';

  constructor(ctx: UICtx) {
    super(ctx, 'honors', 'Academy Honors', { width: 470, x: 400, y: 70, className: 'ax-honors-win' });
    current = this;
  }

  destroy() {
    if (current === this) current = null;
    super.destroy();
  }

  protected signature(): string {
    const st = this.ctx.s.progression.state;
    const quests = Object.entries(st.quests ?? {}).map(([id, q]) => `${id}:${q.status}`).join(',');
    return JSON.stringify([this.tab, st.honors, st.level, st.job, st.skills, quests, st.arenaBest, Math.floor((st.playTimeMs ?? 0) / 60000),
      st.inventory.length, keyLabel(getBinding('honors'))]);
  }

  protected render() {
    const st = this.ctx.s.progression.state;
    const view = honorView(st);
    const all = availableHonors();
    const done = all.filter(d => view.honors.done[d.id]);
    const meritsFromHonors = done.reduce((n, d) => n + d.reward, 0);
    const title = view.honors.title;

    const head = h('div', { class: 'ax-hon-head' },
      h('div', { class: 'ax-hon-stat' }, h('b', null, `${done.length}`), h('span', { class: 'ax-dim' }, ` / ${all.length} honors`)),
      h('div', { class: 'ax-hon-stat' }, h('span', { class: 'ax-dim' }, 'Merits from honors '), h('b', { class: 'ax-gold' }, fmtNum(meritsFromHonors))),
      h('button', {
        class: 'ax-hon-title-btn', title: 'Choose the title shown under your name',
        onclick: () => { this.tab = 'titles'; this.invalidate(); this.ctx.sfx('ui_click'); },
      }, h('span', { class: 'ax-dim' }, 'Title: '), title ? h('b', null, title) : h('i', { class: 'ax-dim' }, 'none')));
    const pct = all.length ? Math.round((done.length / all.length) * 100) : 0;
    const overall = h('div', { class: 'ax-mini-bar ax-hon-overall' }, h('div', { style: `width:${pct}%` }));

    const tabs = tabStrip<Tab>([
      ...HONOR_CATEGORIES.map(c => {
        const inCat = all.filter(d => d.category === c.id);
        const n = inCat.filter(d => view.honors.done[d.id]).length;
        return { id: c.id as Tab, label: c.id === 'secret' ? `${c.name} ${n}` : `${c.name} ${n}/${inCat.length}`, title: c.name };
      }),
      { id: 'titles', label: 'Titles' },
    ], this.tab, (t) => { this.tab = t; this.invalidate(); this.ctx.sfx('ui_click'); });

    const list = h('div', { class: 'ax-hon-list' });
    if (this.tab === 'titles') this.renderTitles(list);
    else {
      const items = all.filter(d => d.category === this.tab);
      if (!items.length) list.appendChild(h('div', { class: 'ax-empty-note' }, 'Nothing here yet.'));
      for (const d of items) list.appendChild(this.row(d, view));
    }
    this.body.replaceChildren(head, overall, tabs, list);
  }

  private row(d: HonorDef, view: ReturnType<typeof honorView>): HTMLElement {
    const at = view.honors.done[d.id];
    const earned = !!at;
    const hidden = !!d.secret && !earned;
    const target = Math.max(1, safe(() => d.target(view), 1));
    const have = earned ? target : Math.max(0, Math.min(target, safe(() => d.measure(view), 0)));
    const pct = Math.round((have / target) * 100);
    const detail = safe(() => d.detail?.(view) ?? null, null);
    const date = earned ? new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const icon = hidden ? h('div', { class: 'ax-hon-icon ax-hon-secret-ico' }, '?') : iconEl(d.icon, 32, d.name, 'ax-hon-icon');
    return h('div', { class: `ax-hon${earned ? ' ax-hon-done' : ''}${hidden ? ' ax-hon-hidden' : ''}` },
      icon,
      h('div', { class: 'ax-hon-main' },
        h('div', { class: 'ax-hon-line' },
          h('span', { class: 'ax-hon-name' }, hidden ? '???' : d.name),
          h('span', { class: 'ax-hon-reward' }, `+${d.reward} Merits`)),
        h('div', { class: 'ax-hon-desc' }, hidden ? (d.hint ?? 'A secret honor.') : d.description),
        d.title && !hidden ? h('div', { class: 'ax-hon-titletag' }, `Title: ${d.title}`) : null,
        earned
          ? h('div', { class: 'ax-hon-earned' }, `Earned ${date}`, detail ? h('span', { class: 'ax-dim' }, ` · ${detail}`) : null)
          : hidden ? null : h('div', { class: 'ax-hon-prog' },
            h('div', { class: 'ax-mini-bar' }, h('div', { style: `width:${pct}%` })),
            h('span', { class: 'ax-hon-count' }, target > 1 ? `${fmtNum(have)} / ${fmtNum(target)}` : detail ?? 'Not yet'))));
  }

  private renderTitles(list: HTMLElement) {
    const st = this.ctx.s.progression.state;
    const honors = ensureHonors(st);
    const have = new Set(earnedTitles(st));
    const pick = (t: string | null) => {
      if (t && !have.has(t)) { this.ctx.sfx('ui_error'); return; }
      if (t) honors.title = t; else delete honors.title;
      try { this.ctx.s.progression.save(); } catch { /* ignore */ }
      this.ctx.sfx('ui_click');
      this.invalidate();
    };
    list.appendChild(h('div', { class: 'ax-hon-note' }, 'Your title is shown under your name. Earn honors to unlock more.'));
    const opt = (label: string, value: string | null, sub: string, unlocked: boolean) => {
      const active = (honors.title ?? null) === value;
      return h('button', {
        class: `ax-hon-titleopt${active ? ' ax-active' : ''}${unlocked ? '' : ' ax-locked'}`,
        disabled: !unlocked, onclick: () => pick(value),
      }, h('span', { class: 'ax-hon-titlename' }, label), h('span', { class: 'ax-hon-titlesub' }, sub));
    };
    list.appendChild(opt('No title', null, 'Just your name', true));
    const available = new Set(availableHonors().map(d => d.id));
    for (const { title, honorId } of honorTitles()) {
      if (!available.has(honorId)) continue;
      const d = availableHonors().find(x => x.id === honorId);
      const unlocked = have.has(title);
      const secret = !!d?.secret && !unlocked;
      list.appendChild(opt(secret ? '???' : title, title, unlocked ? `From "${d?.name ?? honorId}"` : secret ? 'Secret honor' : `Earn "${d?.name ?? honorId}"`, unlocked));
    }
  }
}
