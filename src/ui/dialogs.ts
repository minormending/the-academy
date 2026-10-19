/** NPC dialog (typewriter + options), shop (buy/sell), death prompt. */
import type { Branch, DialogSpec, ItemDef, ItemStack, ShopSpec } from '../core/types';
import { Registry } from '../core/registry';
import type { UICtx } from './context';
import { keyText } from '../data/keyText';
import { fmtNum, h, safe } from './dom';
import { itemTooltip } from './info';
import { iconEl, portraitEl } from './uiIcons';
import { UIWindow, tabStrip } from './window';

// ───────────────────────────── Dialog ─────────────────────────────

const CHARS_PER_SEC = 70;

export class DialogWindow extends UIWindow {
  private spec: DialogSpec | null = null;
  /** Incremented every time a new spec is shown — lets option handlers detect a chained dialog. */
  gen = 0;
  /** Typed-so-far text; sits over an invisible copy of the full text so the box never resizes while typing. */
  private textEl: HTMLElement = h('span', { class: 'ax-dlg-typed' });
  private full = '';
  private shown = 0;
  private busy = false;

  constructor(ctx: UICtx) {
    super(ctx, 'dialog', 'Dialog', { width: 600, x: 340, y: 340, className: 'ax-dialog-win' });
  }

  show(spec: DialogSpec) {
    this.spec = spec;
    this.gen++;
    this.full = keyText(String(spec.text ?? '').replace(/\\n/g, '\n'));
    this.shown = 0;
    this.invalidate();
    if (!this.isOpen) this.open(); else this.bringToFront();
  }

  protected signature() { return String(this.gen); }

  get typing() { return this.shown < this.full.length; }
  skip() { this.shown = this.full.length; this.textEl.textContent = this.full; }

  protected render() {
    const spec = this.spec;
    if (!spec) return;
    const npc = Registry.npc(spec.npcId);
    this.setTitle(spec.npcName || npc?.name || 'Dialog');
    this.textEl = h('span', { class: 'ax-dlg-typed' });
    this.textEl.textContent = this.full.slice(0, Math.floor(this.shown));
    const box = h('div', { class: 'ax-dlg-text', title: 'Click to skip' }, h('span', { class: 'ax-dlg-ghost', 'aria-hidden': 'true' }, this.full), this.textEl);
    box.addEventListener('click', () => this.skip());
    const opts = spec.options?.length ? spec.options : [{ label: 'OK' }];
    const buttons = opts.map((o, i) => h('button', {
      class: `ax-dlg-opt${opts.length === 1 ? ' ax-single' : ''}`,
      onclick: () => this.choose(i),
    }, h('span', { class: 'ax-dlg-num' }, String(i + 1)), keyText(o.label)));
    this.body.replaceChildren(
      h('div', { class: 'ax-dlg' },
        h('div', { class: 'ax-dlg-left' }, portraitEl(npc?.look, 110, spec.npcName),
          h('div', { class: 'ax-dlg-name' }, spec.npcName || npc?.name || ''),
          npc?.title ? h('div', { class: 'ax-dlg-title' }, npc.title) : null),
        h('div', { class: 'ax-dlg-right' }, box, h('div', { class: 'ax-dlg-opts' }, buttons))));
  }

  /** Run option i: invoke action, then close unless closes===false or a new dialog arrived meanwhile. */
  choose(i: number) {
    const spec = this.spec;
    if (!spec || this.busy) return;
    const opts = spec.options?.length ? spec.options : [{ label: 'OK' } as DialogSpec['options'][number]];
    const o = opts[i];
    if (!o) return;
    if (this.typing) this.skip();
    this.ctx.sfx('ui_click');
    const before = this.gen;
    this.busy = true;
    try { o.action?.(); } catch (e) { console.warn('[ui] dialog action failed', e); }
    this.busy = false;
    if (this.gen !== before) return;          // a chained ui:dialog is now showing
    if (!this.isOpen || this.spec !== spec) return; // closed by ui:closeDialog during the action
    if (o.closes !== false) this.close();
  }

  /** Keyboard: Enter/Space skip or confirm single option; digits pick options. Returns true if handled. */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.isOpen || !this.spec) return false;
    const n = this.spec.options?.length || 1;
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      if (this.typing) this.skip();
      else if (n === 1) this.choose(0);
      return true;
    }
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) { const i = Number(m[1]) - 1; if (i < n) this.choose(i); return true; }
    return false;
  }

  protected frame(_t: number, delta: number) {
    if (this.shown >= this.full.length) return;
    this.shown = Math.min(this.full.length, this.shown + (CHARS_PER_SEC * delta) / 1000);
    const s = this.full.slice(0, Math.floor(this.shown));
    if (this.textEl.textContent !== s) this.textEl.textContent = s;
  }

  protected onClose() { this.spec = null; }
}

// ───────────────────────────── Shop ─────────────────────────────

type ShopTab = 'buy' | 'sell';

export class ShopWindow extends UIWindow {
  private spec: ShopSpec | null = null;
  private tab: ShopTab = 'buy';
  private qty = new Map<string, number>();
  /** Sell row awaiting a confirming second click (equipment / valuable stacks). */
  private confirmSell: string | null = null;

  constructor(ctx: UICtx) {
    super(ctx, 'shop', 'Shop', { width: 420, x: 430, y: 90, className: 'ax-shop-win' });
  }

  show(spec: ShopSpec) {
    this.spec = spec;
    this.tab = 'buy';
    this.qty.clear();
    this.confirmSell = null;
    this.setTitle(`${spec.npcName}'s Shop`);
    this.invalidate();
    if (!this.isOpen) this.open(); else this.bringToFront();
  }

  protected signature(): string {
    const st = this.ctx.s.progression.state;
    return JSON.stringify([this.tab, st.mesos, st.inventory, [...this.qty], this.confirmSell]);
  }

  private stepper(key: string, max: number, onChange: () => void): HTMLElement {
    const cur = Math.max(1, Math.min(max, this.qty.get(key) ?? 1));
    const set = (v: number) => { this.qty.set(key, Math.max(1, Math.min(max, v))); onChange(); };
    return h('div', { class: 'ax-stepper' },
      h('button', { class: 'ax-step', disabled: cur <= 1, onclick: () => set(cur - 1) }, '−'),
      h('span', { class: 'ax-step-val' }, String(cur)),
      h('button', { class: 'ax-step', disabled: cur >= max, onclick: () => set(cur + 1) }, '+'),
      max >= 10 ? h('button', { class: 'ax-step ax-step-wide', disabled: cur >= max, onclick: () => set(cur === 1 ? 10 : cur + 10) }, '+10') : null);
  }

  protected render() {
    const spec = this.spec;
    if (!spec) return;
    const p = this.ctx.s.progression;
    const st = p.state;
    const branch = safe<Branch>(() => p.jobDef().branch, 'none');
    const rerender = () => this.invalidate();
    const list = h('div', { class: 'ax-shop-list' });
    if (this.tab === 'buy') {
      for (const entry of spec.items ?? []) {
        const def = Registry.item(entry.itemId);
        const max = def ? Math.max(1, Math.min(def.maxStack || 1, 100)) : 1;
        const key = `b:${entry.itemId}`;
        const q = Math.max(1, Math.min(max, this.qty.get(key) ?? 1));
        const total = entry.price * q;
        const afford = st.mesos >= total;
        const row = h('div', { class: 'ax-shop-row' },
          iconEl(def?.icon, 32, def?.name ?? entry.itemId),
          h('div', { class: 'ax-shop-main' },
            h('div', { class: 'ax-shop-name' }, def?.name ?? entry.itemId),
            h('div', { class: `ax-shop-price${afford ? '' : ' ax-bad'}` }, h('span', { class: 'ax-coin ax-coin-sm' }), fmtNum(entry.price), q > 1 ? h('span', { class: 'ax-dim' }, `  (total ${fmtNum(total)})`) : null)),
          this.stepper(key, max, rerender),
          h('button', { class: 'ax-btn ax-btn-small', disabled: !afford, onclick: () => this.buy(entry.itemId, entry.price, q, def) }, 'Buy'));
        this.ctx.tooltip.attach(row.firstChild as HTMLElement, () => itemTooltip(def, { level: st.level, branch, price: entry.price }, entry.itemId));
        list.appendChild(row);
      }
      if (!spec.items?.length) list.appendChild(h('div', { class: 'ax-empty-note' }, 'Sold out!'));
    } else {
      const stacks = (st.inventory ?? []).filter(s => (Registry.item(s.itemId)?.sellPrice ?? 0) > 0);
      for (const s of stacks) list.appendChild(this.sellRow(s, Registry.item(s.itemId)!, st.level, branch, rerender));
      if (!stacks.length) list.appendChild(h('div', { class: 'ax-empty-note' }, 'You have nothing to sell.'));
    }
    this.body.replaceChildren(
      tabStrip<ShopTab>([{ id: 'buy', label: 'Buy' }, { id: 'sell', label: 'Sell' }], this.tab, (t) => { this.tab = t; this.confirmSell = null; this.invalidate(); this.ctx.sfx('ui_click'); }),
      list,
      h('div', { class: 'ax-win-footer' },
        h('div', { class: 'ax-mesos' }, h('span', { class: 'ax-coin' }), h('b', null, fmtNum(st.mesos)), h('span', { class: 'ax-dim' }, ' mesos')),
        h('button', { class: 'ax-btn ax-btn-secondary ax-btn-small', onclick: () => this.close() }, 'Leave')));
  }

  private sellRow(s: ItemStack, def: ItemDef, level: number, branch: Branch, rerender: () => void) {
    const key = `s:${s.uid}`;
    const q = Math.max(1, Math.min(s.qty, this.qty.get(key) ?? 1));
    // Equipment and valuable stacks need a second click, so a stray click can't sell your staff.
    const needsConfirm = def.type === 'equip' || def.sellPrice * q >= 1000;
    const confirming = needsConfirm && this.confirmSell === key;
    const row = h('div', { class: 'ax-shop-row' },
      iconEl(def.icon, 32, def.name),
      h('div', { class: 'ax-shop-main' },
        h('div', { class: 'ax-shop-name' }, def.name, s.qty > 1 ? h('span', { class: 'ax-dim' }, ` ×${s.qty}`) : null),
        h('div', { class: 'ax-shop-price ax-good' }, h('span', { class: 'ax-coin ax-coin-sm' }), fmtNum(def.sellPrice * q))),
      s.qty > 1 ? this.stepper(key, s.qty, rerender) : h('div', { class: 'ax-stepper' }),
      h('button', {
        class: `ax-btn ax-btn-small ${confirming ? 'ax-btn-danger' : 'ax-btn-secondary'} ax-sell-btn`, title: confirming ? 'Click again to sell' : '',
        onclick: () => {
          if (needsConfirm && !confirming) { this.confirmSell = key; this.ctx.sfx('ui_click'); this.invalidate(); return; }
          this.confirmSell = null;
          if (safe(() => this.ctx.s.progression.sell(s.uid, q), false)) { this.ctx.sfx('mesos'); this.qty.delete(key); }
          else this.ctx.sfx('ui_error');
          this.invalidate();
        },
      }, confirming ? 'Sure?' : 'Sell'));
    this.ctx.tooltip.attach(row.firstChild as HTMLElement, () => itemTooltip(def, { qty: s.qty, level, branch }, s.itemId));
    return row;
  }

  private buy(itemId: string, price: number, qty: number, def: ItemDef | undefined) {
    const p = this.ctx.s.progression;
    if (p.state.mesos < price * qty) { this.ctx.sfx('ui_error'); this.ctx.log('You don\'t have enough mesos.', '#ff9b9b'); return; }
    if (safe(() => p.buy(itemId, price, qty), false)) {
      this.ctx.sfx('mesos');
    } else {
      this.ctx.sfx('ui_error'); // Progression logs the reason
    }
    this.invalidate();
  }

  protected onClose() { this.spec = null; }
}

// ───────────────────────────── Death prompt ─────────────────────────────

export class DeathModal {
  readonly el: HTMLElement;
  isOpen = false;
  constructor(private ctx: UICtx) {
    this.el = h('div', { class: 'ax-death', style: 'display:none' },
      h('div', { class: 'ax-death-panel' },
        h('div', { class: 'ax-death-title' }, 'You have fallen…'),
        h('div', { class: 'ax-death-text' }, 'You wake in the Academy infirmary. You will lose a portion of your EXP.'),
        h('button', { class: 'ax-btn ax-btn-large', onclick: () => this.respawn() }, 'Return to Town')));
    ctx.root.appendChild(this.el);
  }
  show() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.el.style.display = '';
    this.el.classList.remove('ax-show'); void this.el.offsetWidth; this.el.classList.add('ax-show');
  }
  hide() { this.isOpen = false; this.el.style.display = 'none'; this.el.classList.remove('ax-show'); }
  private respawn() {
    this.ctx.sfx('ui_click');
    this.hide();
    try { this.ctx.s.progression.respawn(); } catch (e) { console.warn('[ui] respawn failed', e); }
  }
  destroy() { this.el.remove(); }
}
