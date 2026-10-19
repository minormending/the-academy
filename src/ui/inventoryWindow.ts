/** Inventory (I): Equip / Use / Etc tabs, grid with qty badges, tooltips, double-click use/equip, drag to hotbar. */
import type { Branch, ItemDef, ItemStack, ItemType } from '../core/types';
import { Registry } from '../core/registry';
import type { UICtx } from './context';
import { fmtNum, h, safe } from './dom';
import { canEquip, itemTooltip } from './info';
import { iconEl } from './uiIcons';
import { UIWindow, hotbarPicker, tabStrip } from './window';

type Tab = 'equip' | 'consumable' | 'etc';
const COLS = 6;
const MIN_CELLS = 24;

export class InventoryWindow extends UIWindow {
  private tab: Tab = 'consumable';
  /** Phone layout: selected stack (uid) shown in the detail pane, slot chooser state. */
  private selected = '';
  private picking = false;
  private pickPage = 0;

  constructor(ctx: UICtx) {
    super(ctx, 'inventory', 'Inventory', { width: 304, x: 952, y: 120, className: 'ax-inv-win' });
  }

  protected signature(): string {
    const st = this.ctx.s.progression.state;
    return JSON.stringify([this.tab, st.inventory, st.mesos, st.level, st.job, this.mobile, this.selected, this.picking, this.pickPage, this.mobile ? st.hotbar : 0]);
  }

  private typeOf(s: ItemStack): Tab {
    const t: ItemType | undefined = Registry.item(s.itemId)?.type;
    return t === 'equip' ? 'equip' : t === 'consumable' ? 'consumable' : 'etc';
  }

  protected onClose() { this.picking = false; }

  protected render() {
    const p = this.ctx.s.progression;
    const st = p.state;
    const branch = safe<Branch>(() => p.jobDef().branch, 'none');
    const stacks = (st.inventory ?? []).filter(s => this.typeOf(s) === this.tab);
    const counts: Record<Tab, number> = { equip: 0, consumable: 0, etc: 0 };
    for (const s of st.inventory ?? []) counts[this.typeOf(s)]++;
    if (this.mobile) { this.renderMobile(stacks, counts, branch); return; }

    const grid = h('div', { class: 'ax-inv-grid', style: `grid-template-columns:repeat(${COLS}, 42px)` });
    const cells = Math.max(MIN_CELLS, Math.ceil(stacks.length / COLS) * COLS);
    for (let i = 0; i < cells; i++) {
      const s = stacks[i];
      if (!s) { grid.appendChild(h('div', { class: 'ax-cell ax-empty' })); continue; }
      grid.appendChild(this.cell(s, Registry.item(s.itemId), st.level, branch));
    }

    const hint = this.tab === 'equip' ? 'Double-click to equip.' : this.tab === 'consumable' ? 'Double-click to use · drag to hotbar.' : 'Materials — sell them to merchants.';
    this.body.replaceChildren(
      tabStrip<Tab>([
        { id: 'equip', label: `Equip${counts.equip ? ` (${counts.equip})` : ''}` },
        { id: 'consumable', label: `Use${counts.consumable ? ` (${counts.consumable})` : ''}` },
        { id: 'etc', label: `Etc${counts.etc ? ` (${counts.etc})` : ''}` },
      ], this.tab, (t) => { this.tab = t; this.invalidate(); this.ctx.sfx('ui_click'); }),
      h('div', { class: 'ax-inv-scroll' }, grid),
      h('div', { class: 'ax-inv-hint ax-dim' }, hint),
      h('div', { class: 'ax-mesos' }, h('span', { class: 'ax-coin' }), h('b', null, fmtNum(st.mesos)), h('span', { class: 'ax-dim' }, ' mesos')));
  }

  private cell(s: ItemStack, def: ItemDef | undefined, level: number, branch: Branch): HTMLElement {
    const p = this.ctx.s.progression;
    const unusable = def?.type === 'equip' && !canEquip(def, level, branch);
    const el = h('div', { class: `ax-cell${unusable ? ' ax-unusable' : ''}` },
      iconEl(def?.icon, 34, def?.name ?? s.itemId),
      s.qty > 1 ? h('div', { class: 'ax-qty' }, String(s.qty)) : null);
    el.addEventListener('dblclick', () => {
      if (!def) return;
      let ok = false;
      if (def.type === 'consumable') ok = safe(() => p.useItem(def.id), false);
      else if (def.type === 'equip') {
        ok = safe(() => p.equip(s.uid), false); // Progression logs why it failed (level / branch / full)
      }
      this.ctx.sfx(ok ? 'ui_click' : 'ui_error');
      this.markDirty();
    });
    if (def?.type === 'consumable') this.ctx.drag.bind(el, () => ({ entry: `item:${def.id}`, icon: def.icon, label: def.name }));
    this.ctx.tooltip.attach(el, () => itemTooltip(def, {
      qty: s.qty, level, branch,
      hint: def?.type === 'consumable' ? 'Double-click to use. Drag to the hotbar.' : def?.type === 'equip' ? 'Double-click to equip.' : undefined,
    }, s.itemId));
    return el;
  }

  // ───────────────────────────── phone layout ─────────────────────────────

  /** Phone Inventory: tabs + big-slot grid on the left, tap-to-detail pane with Use / Equip / Hotbar on the right. */
  private renderMobile(stacks: ItemStack[], counts: Record<Tab, number>, branch: Branch) {
    const p = this.ctx.s.progression;
    const st = p.state;
    const oldGrid = this.body.querySelector('.ax-m-inv-left') as HTMLElement | null;
    const top = oldGrid?.scrollTop ?? 0;
    const grid = h('div', { class: 'ax-m-inv-grid' });
    const cells = Math.max(15, Math.ceil(stacks.length / 5) * 5);
    for (let i = 0; i < cells; i++) {
      const s = stacks[i];
      if (!s) { grid.appendChild(h('div', { class: 'ax-cell ax-empty' })); continue; }
      const def = Registry.item(s.itemId);
      const unusable = def?.type === 'equip' && !canEquip(def, st.level, branch);
      grid.appendChild(h('button', {
        class: `ax-cell ax-m-cell${unusable ? ' ax-unusable' : ''}${this.selected === s.uid ? ' ax-sel' : ''}`,
        'aria-label': def?.name ?? s.itemId,
        onclick: () => { if (this.selected !== s.uid) { this.selected = s.uid; this.picking = false; this.invalidate(); this.ctx.sfx('ui_click'); } },
      }, iconEl(def?.icon, 40, def?.name ?? s.itemId), s.qty > 1 ? h('div', { class: 'ax-qty' }, String(s.qty)) : null));
    }
    const left = h('div', { class: 'ax-m-inv-left ax-m-scroll' },
      tabStrip<Tab>([
        { id: 'equip', label: `Equip${counts.equip ? ` (${counts.equip})` : ''}` },
        { id: 'consumable', label: `Use${counts.consumable ? ` (${counts.consumable})` : ''}` },
        { id: 'etc', label: `Etc${counts.etc ? ` (${counts.etc})` : ''}` },
      ], this.tab, (t) => { this.tab = t; this.selected = ''; this.picking = false; this.invalidate(); this.ctx.sfx('ui_click'); }),
      grid,
      h('div', { class: 'ax-mesos' }, h('span', { class: 'ax-coin' }), h('b', null, fmtNum(st.mesos)), h('span', { class: 'ax-dim' }, ' mesos')));

    const detail = h('div', { class: 'ax-m-detail ax-m-scroll' });
    const s = stacks.find(x => x.uid === this.selected);
    const def = s ? Registry.item(s.itemId) : undefined;
    if (!s) {
      detail.appendChild(h('div', { class: 'ax-m-hint' }, this.tab === 'etc' ? 'Materials: sell them to merchants. Tap one to read about it.' : 'Tap an item to see it and use, equip or put it on your skill buttons.'));
    } else {
      detail.appendChild(h('div', { class: 'ax-m-tip' }, itemTooltip(def, { qty: s.qty, level: st.level, branch }, s.itemId)));
      if (this.picking && def?.type === 'consumable') {
        detail.prepend(hotbarPicker(this.ctx, `item:${def.id}`, this.pickPage,
          (pg) => { this.pickPage = pg; this.invalidate(); },
          () => { this.picking = false; this.invalidate(); }));
      } else if (def?.type === 'consumable' || def?.type === 'equip') {
        const act = () => {
          const ok = def.type === 'consumable' ? safe(() => p.useItem(def.id), false) : safe(() => p.equip(s.uid), false);
          this.ctx.sfx(ok ? 'ui_click' : 'ui_error');
          this.invalidate();
        };
        detail.appendChild(h('div', { class: 'ax-m-actions' },
          h('button', { class: 'ax-btn ax-m-btn', onclick: act }, def.type === 'consumable' ? 'Use' : 'Equip'),
          def.type === 'consumable' ? h('button', {
            class: 'ax-btn ax-btn-secondary ax-m-btn',
            onclick: () => { this.picking = true; this.pickPage = safe(() => this.ctx.s.game.hotbarPage(), 0) || 0; this.invalidate(); this.ctx.sfx('ui_click'); },
          }, (st.hotbar ?? []).includes(`item:${def.id}`) ? 'Move slot' : 'To hotbar') : null));
      }
    }
    this.body.replaceChildren(h('div', { class: 'ax-m-split' }, left, detail));
    if (top) left.scrollTop = top;
  }

}
