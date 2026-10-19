/** Base class for draggable, closable, position-remembering UI windows. */
import { HOTBAR_PAGE_SIZE, HOTBAR_SIZE } from '../core/types';
import { Registry } from '../core/registry';
import type { UICtx } from './context';
import { h, safe, setText } from './dom';
import { iconEl } from './uiIcons';
import { isMobileLayout, onMobileLayoutChanged, uiLogicalSize } from './mobile';

export interface WindowOpts {
  width: number;
  x: number;
  y: number;
  className?: string;
  closable?: boolean;
  /** Persist position in localStorage (default true). */
  persist?: boolean;
}

let sigCounter = 0;
/** Every live window (for the phone rule "one sheet at a time"). */
const LIVE = new Set<UIWindow>();
/** Height of the bottom status bar (logical px) — windows are fitted above it. */
const HUD_H = 66;

export abstract class UIWindow {
  readonly el: HTMLDivElement;
  protected readonly body: HTMLDivElement;
  protected readonly titleBar: HTMLDivElement;
  protected readonly titleText: HTMLSpanElement;
  protected readonly titleExtra: HTMLSpanElement;
  isOpen = false;
  private dirty = true;
  private lastSig = '';
  private dragOff: { dx: number; dy: number; id: number } | null = null;

  constructor(protected ctx: UICtx, readonly id: string, title: string, protected opts: WindowOpts) {
    this.titleText = h('span', { class: 'ax-win-title-text' }, title);
    this.titleExtra = h('span', { class: 'ax-win-title-extra' });
    const closeBtn = opts.closable === false ? null : h('button', {
      class: 'ax-win-close', title: 'Close', 'aria-label': 'Close',
      onclick: (e: Event) => { e.stopPropagation(); this.close(); },
    }, '×');
    this.titleBar = h('div', { class: 'ax-win-title' }, h('span', { class: 'ax-win-gem' }), this.titleText, this.titleExtra, closeBtn);
    this.body = h('div', { class: 'ax-win-body' });
    this.el = h('div', { class: `ax-window ${opts.className ?? ''}`, style: `width:${opts.width}px;display:none;` }, this.titleBar, this.body);
    this.el.addEventListener('pointerdown', () => this.bringToFront());
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.titleBar.addEventListener('pointerdown', (e) => this.dragStart(e));
    this.titleBar.addEventListener('pointermove', (e) => this.dragMove(e));
    this.titleBar.addEventListener('pointerup', (e) => this.dragEnd(e));
    this.titleBar.addEventListener('pointercancel', (e) => this.dragEnd(e));
    const saved = opts.persist === false ? null : ctx.layout.getPos(id);
    this.setPos(saved?.x ?? opts.x, saved?.y ?? opts.y);
    ctx.root.appendChild(this.el);
    LIVE.add(this);
    // Phones: windows are full-screen sheets (CSS `html.ax-mobile .ax-window`); re-render on a layout switch.
    this.mobile = isMobileLayout();
    this.el.classList.toggle('ax-sheet', this.mobile);
    this.unsubMobile = onMobileLayoutChanged((on) => {
      this.mobile = on;
      this.el.classList.toggle('ax-sheet', on);
      this.onMobileChanged(on);
      this.invalidate();
      if (on && this.isOpen) this.closeOthers();
    });
  }

  /** True while the phone layout is active (windows render as full-screen sheets). */
  protected mobile = false;
  private unsubMobile: () => void;

  /** Phones show one sheet at a time: opening one closes every other open window. */
  private closeOthers() {
    for (const w of LIVE) if (w !== this && w.isOpen) w.close();
  }

  /** Hook: the phone layout switched on/off (the window is invalidated right after). */
  protected onMobileChanged(_on: boolean): void { /* hook */ }

  setTitle(text: string) { setText(this.titleText, text); }

  open() {
    if (this.isOpen) { this.bringToFront(); return; }
    if (this.mobile) this.closeOthers();
    this.isOpen = true;
    this.el.style.display = '';
    this.dirty = true;
    this.lastSig = '';
    this.bringToFront();
    this.tick(0, 0);
    if (this.mobile) this.body.scrollTop = 0;
    else this.clampIntoView('all');
    this.ctx.sfx('ui_open');
    this.onOpen();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.style.display = 'none';
    this.ctx.tooltip.hide();
    this.ctx.sfx('ui_close');
    this.onClose();
  }

  toggle() { if (this.isOpen) this.close(); else this.open(); }

  bringToFront() { this.el.style.zIndex = String(this.ctx.nextZ()); }
  get z(): number { return Number(this.el.style.zIndex) || 0; }

  markDirty() { this.dirty = true; }
  /** Force a full re-render on the next tick even if the signature is unchanged. */
  invalidate() { this.dirty = true; this.lastSig = ''; }

  /** Called every frame by UIRoot. */
  tick(time: number, delta: number) {
    if (!this.isOpen) return;
    if (this.dirty) {
      this.dirty = false;
      let sig: string;
      try { sig = this.signature(); } catch { sig = `x${++sigCounter}`; }
      if (sig !== this.lastSig) {
        this.lastSig = sig;
        try { this.render(); } catch (e) { console.warn(`[ui] ${this.id} render failed`, e); }
        // Content height can change (tabs, dialog options): keep the whole window above the HUD.
        if (!this.dragOff && !this.mobile) this.clampIntoView('v');
      }
    }
    try { this.frame(time, delta); } catch { /* never throw in update */ }
  }

  protected abstract render(): void;
  /** Return a string capturing everything render() depends on; unchanged ⇒ no re-render. */
  protected signature(): string { return `x${++sigCounter}`; }
  protected frame(_time: number, _delta: number): void { /* cheap per-frame work */ }
  protected onOpen(): void { /* hook */ }
  protected onClose(): void { /* hook */ }

  private setPos(x: number, y: number) {
    this.el.style.left = `${Math.round(x)}px`;
    this.el.style.top = `${Math.round(y)}px`;
  }

  /**
   * Keep the window reachable. While dragging only the title bar must stay on screen; with `fit`
   * the window is pushed fully on-screen ('all', on open) or just above the status bar ('v', on re-render).
   */
  protected clampIntoView(fit: 'none' | 'v' | 'all' = 'none') {
    const w = this.el.offsetWidth || this.opts.width;
    const ht = this.el.offsetHeight || 0;
    const { w: viewW, h: viewH } = uiLogicalSize();
    const HUD_TOP = viewH - HUD_H;
    const x = parseFloat(this.el.style.left) || 0, y = parseFloat(this.el.style.top) || 0;
    let nx = Math.max(-w + 80, Math.min(viewW - 80, x));
    let ny = Math.max(0, Math.min(viewH - 40, y));
    if (fit === 'all') nx = Math.max(0, Math.min(viewW - w, nx));
    if (fit !== 'none') ny = Math.max(0, Math.min(HUD_TOP - 6 - ht, ny));
    if (nx !== x || ny !== y) this.setPos(nx, ny);
  }

  private dragStart(e: PointerEvent) {
    if (this.mobile || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const p = this.ctx.scaler.toLogical(e.clientX, e.clientY);
    this.dragOff = { dx: p.x - (parseFloat(this.el.style.left) || 0), dy: p.y - (parseFloat(this.el.style.top) || 0), id: e.pointerId };
    try { this.titleBar.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    this.el.classList.add('ax-moving');
    e.preventDefault();
  }

  private dragMove(e: PointerEvent) {
    if (!this.dragOff || e.pointerId !== this.dragOff.id) return;
    const p = this.ctx.scaler.toLogical(e.clientX, e.clientY);
    this.setPos(p.x - this.dragOff.dx, p.y - this.dragOff.dy);
    this.clampIntoView();
  }

  private dragEnd(e: PointerEvent) {
    if (!this.dragOff || e.pointerId !== this.dragOff.id) return;
    this.dragOff = null;
    try { this.titleBar.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    this.el.classList.remove('ax-moving');
    this.clampIntoView('v'); // settle above the status bar (re-renders would snap it there anyway)
    if (this.opts.persist !== false) this.ctx.layout.setPos(this.id, parseFloat(this.el.style.left) || 0, parseFloat(this.el.style.top) || 0);
  }

  destroy() { LIVE.delete(this); this.unsubMobile(); this.el.remove(); }
}

/** Simple tab strip helper. */
export function tabStrip<T extends string>(tabs: { id: T; label: string; locked?: boolean; title?: string }[], active: T, onPick: (id: T) => void): HTMLElement {
  return h('div', { class: 'ax-tabs' }, tabs.map(t => h('button', {
    class: `ax-tab${t.id === active ? ' ax-active' : ''}${t.locked ? ' ax-locked' : ''}`,
    title: t.title ?? '',
    onclick: () => { if (t.id !== active) onPick(t.id); },
  }, t.locked ? h('span', { class: 'ax-lock' }) : null, h('span', { class: 'ax-tab-label' }, t.label))));
}

// ───────────────────────────── phone sheets (M2) ─────────────────────────────

/** Page-local slots of each half of the touch skill pad (same order as touchControls: A = Q W E / A S D, B = R T 1 / F G 2). */
const TOUCH_HALVES: readonly (readonly number[])[] = [[0, 1, 2, 5, 6, 7], [3, 4, 10, 8, 9, 11]];

/**
 * Phone "Add to hotbar" chooser: pick a page, then tap one of the twelve slots laid out like the touch skill pad.
 * `entry` is a skill id or `item:<id>`; `done` runs after a slot was set (or the entry removed).
 */
export function hotbarPicker(ctx: UICtx, entry: string, page: number, setPage: (p: number) => void, done: () => void): HTMLElement {
  const p = ctx.s.progression;
  const hb = p.state.hotbar ?? [];
  const pages = Math.max(1, Math.floor(HOTBAR_SIZE / HOTBAR_PAGE_SIZE));
  const iconFor = (e: string | null | undefined) => {
    if (!e) return null;
    if (e.startsWith('item:')) { const d = Registry.item(e.slice(5)); return iconEl(d?.icon, 36, d?.name ?? '?'); }
    const d = safe(() => Registry.skill(e), undefined);
    return iconEl(d?.icon, 36, d?.name ?? '?');
  };
  const rows = TOUCH_HALVES.map((half, hi) => h('div', { class: 'ax-m-pick-row' },
    h('span', { class: 'ax-m-pick-half' }, hi === 0 ? 'A' : 'B'),
    half.map((local, i) => {
      const abs = page * HOTBAR_PAGE_SIZE + local;
      const cur = hb[abs] ?? null;
      return h('button', {
        class: `ax-m-pick-slot${cur === entry ? ' ax-active' : ''}${cur ? '' : ' ax-empty'}`,
        'aria-label': `Page ${page + 1} set ${hi === 0 ? 'A' : 'B'} slot ${i + 1}`,
        onclick: () => { safe(() => p.setHotbar(abs, entry), undefined); ctx.sfx('ui_click'); done(); },
      }, iconFor(cur) ?? h('span', { class: 'ax-m-pick-n' }, String(i + 1)));
    })));
  const at = hb.indexOf(entry);
  return h('div', { class: 'ax-m-picker' },
    h('div', { class: 'ax-m-pick-head' }, h('b', null, 'Choose a slot'),
      pages > 1 ? h('div', { class: 'ax-m-seg' }, Array.from({ length: pages }, (_, i) => h('button', {
        class: `ax-m-seg-btn${i === page ? ' ax-active' : ''}`, onclick: () => { if (i !== page) { setPage(i); ctx.sfx('ui_click'); } },
      }, `Page ${i + 1}`))) : null),
    rows,
    h('div', { class: 'ax-m-actions' },
      at >= 0 ? h('button', { class: 'ax-btn ax-btn-secondary ax-m-btn', onclick: () => { safe(() => p.setHotbar(at, null), undefined); ctx.sfx('ui_close'); done(); } }, 'Remove from bar') : null,
      h('button', { class: 'ax-btn ax-btn-secondary ax-m-btn', onclick: () => { ctx.sfx('ui_click'); done(); } }, 'Cancel')));
}
