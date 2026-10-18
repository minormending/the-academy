/** Base class for draggable, closable, position-remembering UI windows. */
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import type { UICtx } from './context';
import { h, setText } from './dom';

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
/** Top edge of the bottom status bar (logical px) — windows are fitted above it. */
const HUD_TOP = GAME_HEIGHT - 66;

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
  }

  setTitle(text: string) { setText(this.titleText, text); }

  open() {
    if (this.isOpen) { this.bringToFront(); return; }
    this.isOpen = true;
    this.el.style.display = '';
    this.dirty = true;
    this.lastSig = '';
    this.bringToFront();
    this.tick(0, 0);
    this.clampIntoView('all');
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
        if (!this.dragOff) this.clampIntoView('v');
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
    const x = parseFloat(this.el.style.left) || 0, y = parseFloat(this.el.style.top) || 0;
    let nx = Math.max(-w + 80, Math.min(GAME_WIDTH - 80, x));
    let ny = Math.max(0, Math.min(GAME_HEIGHT - 40, y));
    if (fit === 'all') nx = Math.max(0, Math.min(GAME_WIDTH - w, nx));
    if (fit !== 'none') ny = Math.max(0, Math.min(HUD_TOP - 6 - ht, ny));
    if (nx !== x || ny !== y) this.setPos(nx, ny);
  }

  private dragStart(e: PointerEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
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

  destroy() { this.el.remove(); }
}

/** Simple tab strip helper. */
export function tabStrip<T extends string>(tabs: { id: T; label: string; locked?: boolean; title?: string }[], active: T, onPick: (id: T) => void): HTMLElement {
  return h('div', { class: 'ax-tabs' }, tabs.map(t => h('button', {
    class: `ax-tab${t.id === active ? ' ax-active' : ''}${t.locked ? ' ax-locked' : ''}`,
    title: t.title ?? '',
    onclick: () => { if (t.id !== active) onPick(t.id); },
  }, t.locked ? h('span', { class: 'ax-lock' }) : null, h('span', { class: 'ax-tab-label' }, t.label))));
}
