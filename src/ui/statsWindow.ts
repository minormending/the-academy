/** Character window (P): base stats + AP, derived stats, equipment paper-doll. */
import { MAX_LEVEL } from '../core/constants';
import type { BaseStatKey, Branch, EquipSlot } from '../core/types';
import { Registry } from '../core/registry';
import { expToNext } from '../core/balance';
import type { UICtx } from './context';
import { fmtNum, h, safe } from './dom';
import { BRANCH_COLORS, SLOT_LABELS, derivedRows, itemTooltip, jobName, jobYear, schoolName } from './info';
import { iconEl, portraitEl } from './uiIcons';
import { UIWindow } from './window';
import { AppearanceEditor } from './appearanceEditor';

const BASE: { key: BaseStatKey; label: string; hint: string }[] = [
  { key: 'str', label: 'STR', hint: 'Max HP and a little defense.' },
  { key: 'dex', label: 'DEX', hint: 'Mastery (damage consistency) and speed.' },
  { key: 'int', label: 'INT', hint: 'Primary stat — Magic ATK and Max MP.' },
  { key: 'luk', label: 'LUK', hint: 'Critical rate and critical damage.' },
];

/** Paper-doll layout (3×3, null = portrait/blank). */
const DOLL: (EquipSlot | 'portrait' | null)[] = ['ring', 'hat', 'amulet', 'weapon', 'portrait', 'robe', 'gloves', null, 'shoes'];

export class StatsWindow extends UIWindow {
  private expSpan = h('span', { class: 'ax-dim' });
  private lastExp = '';
  /** Phones: equipment slot whose item details are expanded (replaces the hover tooltip). */
  private infoSlot = '';
  private editor: AppearanceEditor | null = null;

  destroy() {
    try { this.editor?.destroy(); } catch { /* ignore */ }
    this.editor = null;
    super.destroy();
  }
  constructor(ctx: UICtx) {
    super(ctx, 'stats', 'Character', { width: 452, x: 420, y: 76, className: 'ax-stats-win' });
  }

  protected signature(): string {
    const p = this.ctx.s.progression;
    const st = p.state;
    return JSON.stringify([st.name, st.level, st.job, st.base, st.ap, st.equipment, safe(() => p.derived(), null), this.mobile, this.infoSlot]);
  }

  protected render() {
    const p = this.ctx.s.progression;
    const st = p.state;
    const job = safe(() => p.jobDef(), null);
    const branch: Branch = job?.branch ?? 'none';
    const d = safe(() => p.derived(), null);

    // ── identity
    const ident = h('div', { class: 'ax-char-ident' },
      h('div', { class: 'ax-char-name' }, st.name),
      h('div', { class: 'ax-char-job', style: `color:${BRANCH_COLORS[branch]}` }, `Year ${jobYear(st.job)} ${jobName(st.job)} · ${schoolName(branch)}`),
      h('div', { class: 'ax-char-lv' }, `Level ${st.level}`, this.expSpan),
      h('button', {
        class: 'ax-btn ax-btn-small ax-btn-secondary', title: 'Change your skin, hair and accent colours',
        onclick: () => { this.ctx.sfx('ui_click'); (this.editor ??= new AppearanceEditor(this.ctx)).open(); },
      }, 'Change look'));
    this.expSpan.textContent = '';
    this.lastExp = '';

    // ── base stats
    const apLeft = st.ap;
    const rows = BASE.map(b => {
      const btn = h('button', {
        class: 'ax-plus', disabled: apLeft <= 0, title: `Add 1 AP to ${b.label}`,
        onclick: () => { if (safe(() => p.allocateAp(b.key), false)) this.ctx.sfx('ui_click'); else this.ctx.sfx('ui_error'); this.markDirty(); },
      }, '+');
      const row = h('div', { class: `ax-base-row${b.key === 'int' ? ' ax-primary' : ''}` },
        h('span', { class: 'ax-base-label' }, b.label), h('b', { class: 'ax-base-val' }, String(st.base?.[b.key] ?? 0)), btn);
      this.ctx.tooltip.attach(row, () => h('div', { class: 'ax-tt' }, h('div', { class: 'ax-tt-name' }, b.label), h('div', { class: 'ax-tt-desc' }, b.hint)));
      return row;
    });
    const auto = h('button', {
      class: 'ax-btn ax-btn-small', disabled: apLeft <= 0,
      onclick: () => { safe(() => p.autoAllocateAp(), undefined); this.ctx.sfx('ui_click'); this.markDirty(); },
    }, 'Auto');
    const base = h('div', { class: 'ax-panel ax-base' },
      h('div', { class: 'ax-panel-head' }, 'Stats', h('span', { class: `ax-pill${apLeft > 0 ? ' ax-glow' : ''}` }, `AP ${apLeft}`), auto),
      rows);

    // ── derived
    const derived = h('div', { class: 'ax-panel ax-derived' },
      h('div', { class: 'ax-panel-head' }, 'Details'),
      h('div', { class: 'ax-derived-grid' }, d ? derivedRows(d).map(r => h('div', { class: 'ax-derived-row' }, h('span', null, r.label), h('b', null, r.value))) : 'Unavailable'));

    // ── equipment
    const doll = h('div', { class: 'ax-doll' }, DOLL.map(slot => {
      if (slot === 'portrait') return h('div', { class: 'ax-doll-portrait' }, portraitEl(job?.look, 64, st.name));
      if (!slot) return h('div', { class: 'ax-doll-blank' });
      const stack = st.equipment?.[slot];
      const def = stack ? Registry.item(stack.itemId) : undefined;
      const cell = h('div', { class: `ax-cell ax-equip-slot${stack ? '' : ' ax-empty'}` },
        stack ? iconEl(def?.icon, 34, def?.name ?? stack.itemId) : h('span', { class: 'ax-slot-label' }, SLOT_LABELS[slot]));
      if (stack) {
        cell.addEventListener('dblclick', () => {
          const ok = safe(() => p.unequip(slot), false); // Progression logs "inventory is full"
          this.ctx.sfx(ok ? 'ui_click' : 'ui_error');
          this.markDirty();
        });
        this.ctx.tooltip.attach(cell, () => itemTooltip(def, { level: st.level, branch, equipped: true, hint: 'Double-click to unequip.' }, stack.itemId));
      } else {
        this.ctx.tooltip.attach(cell, () => h('div', { class: 'ax-tt' }, h('div', { class: 'ax-tt-name' }, SLOT_LABELS[slot]), h('div', { class: 'ax-tt-sub' }, 'Empty — double-click gear in your inventory to equip.')));
      }
      return cell;
    }));
    const equip = h('div', { class: 'ax-panel ax-equip' }, h('div', { class: 'ax-panel-head' }, 'Equipment'), this.mobile ? this.equipList(branch) : doll);

    this.body.replaceChildren(
      h('div', { class: 'ax-stats-top' }, h('div', { class: 'ax-stats-left' }, ident, base), equip),
      derived,
      h('div', { class: 'ax-win-footer' }, h('span', { class: 'ax-dim' }, this.mobile
        ? 'INT is your primary stat. Tap gear to read about it.'
        : 'Double-click equipment to remove it. INT is your primary stat.')));
  }

  /** Phone equipment: one big row per slot (tap = details, Remove button) instead of the double-click paper doll. */
  private equipList(branch: Branch): HTMLElement {
    const p = this.ctx.s.progression;
    const st = p.state;
    const slots = DOLL.filter((x): x is EquipSlot => !!x && x !== 'portrait');
    return h('div', { class: 'ax-m-equip' }, slots.map(slot => {
      const stack = st.equipment?.[slot];
      const def = stack ? Registry.item(stack.itemId) : undefined;
      const open = !!stack && this.infoSlot === slot;
      const row = h('div', {
        class: `ax-m-row ax-m-eq${stack ? '' : ' ax-empty'}${open ? ' ax-sel' : ''}`,
        onclick: (e: Event) => {
          if (!stack || (e.target as HTMLElement).closest('button')) return;
          this.infoSlot = open ? '' : slot; this.ctx.sfx('ui_click'); this.invalidate();
        },
      },
      h('div', { class: 'ax-cell ax-equip-slot' }, stack ? iconEl(def?.icon, 34, def?.name ?? stack.itemId) : null),
      h('div', { class: 'ax-m-row-main' },
        h('div', { class: 'ax-m-eq-slot' }, SLOT_LABELS[slot]),
        h('div', { class: 'ax-m-row-t' }, stack ? def?.name ?? stack.itemId : 'Empty')),
      stack ? h('button', {
        class: 'ax-btn ax-btn-secondary ax-m-btn',
        onclick: () => { const ok = safe(() => p.unequip(slot), false); this.ctx.sfx(ok ? 'ui_click' : 'ui_error'); this.infoSlot = ''; this.invalidate(); },
      }, 'Remove') : null);
      return open ? [row, h('div', { class: 'ax-m-tip ax-m-shop-tip' }, itemTooltip(def, { level: st.level, branch, equipped: true }, stack!.itemId))] : row;
    }));
  }

  protected frame() {
    const st = this.ctx.s.progression.state;
    const need = st.level >= MAX_LEVEL ? 0 : expToNext(st.level);
    const t = need ? `  ·  EXP ${fmtNum(st.exp)} / ${fmtNum(need)} (${((st.exp / need) * 100).toFixed(1)}%)` : '  ·  MAX';
    if (t !== this.lastExp) { this.lastExp = t; this.expSpan.textContent = t; }
  }
}
