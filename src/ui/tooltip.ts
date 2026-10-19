/** A single floating tooltip shared by the whole UI. Content is built lazily on hover. */
import { append, clear, h, type Child } from './dom';
import type { UIScaler } from './scaler';
import { isMobileLayout, uiLogicalSize } from './mobile';

export type TipBuilder = () => Child;

export class Tooltip {
  readonly el: HTMLDivElement;
  private anchor: HTMLElement | null = null;
  private build: TipBuilder | null = null;

  constructor(private root: HTMLElement, private scaler: UIScaler) {
    this.el = h('div', { class: 'ax-tooltip ax-passive' });
    this.el.style.display = 'none';
    root.appendChild(this.el);
  }

  /** Attach a lazily-built tooltip to an element. */
  attach(target: HTMLElement, build: TipBuilder) {
    target.addEventListener('mouseenter', (e) => this.show(target, build, e.clientX, e.clientY));
    target.addEventListener('mousemove', (e) => { if (this.anchor === target) this.place(e.clientX, e.clientY); });
    target.addEventListener('mouseleave', () => { if (this.anchor === target) this.hide(); });
    target.addEventListener('pointerdown', () => { if (this.anchor === target) this.hide(); });
  }

  show(anchor: HTMLElement, build: TipBuilder, clientX: number, clientY: number) {
    if (document.body.classList.contains('ax-dragging')) return;
    // Phones: no hover — every window shows the same details on tap instead.
    if (isMobileLayout()) { this.hide(); return; }
    let content: Child = null;
    try { content = build(); } catch (e) { console.warn('[ui] tooltip failed', e); }
    if (content === null || content === undefined || content === false) { this.hide(); return; }
    this.anchor = anchor;
    this.build = build;
    clear(this.el);
    append(this.el, [content]);
    this.el.style.display = '';
    this.place(clientX, clientY);
  }

  /** Rebuild the content of the currently visible tooltip (e.g. after learning a skill). */
  refresh() {
    if (!this.anchor || !this.build) return;
    try { clear(this.el); append(this.el, [this.build()]); } catch { this.hide(); }
  }

  place(clientX: number, clientY: number) {
    const p = this.scaler.toLogical(clientX, clientY);
    const w = this.el.offsetWidth, ht = this.el.offsetHeight;
    const { w: viewW, h: viewH } = uiLogicalSize();
    let x = p.x + 16, y = p.y + 18;
    if (x + w > viewW - 4) x = p.x - w - 12;
    if (y + ht > viewH - 4) y = p.y - ht - 12;
    x = Math.max(4, x); y = Math.max(4, y);
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
  }

  hide() {
    this.anchor = null;
    this.build = null;
    this.el.style.display = 'none';
  }

  /** Called each frame: hide if the anchor was removed by a re-render. */
  check() {
    if (this.anchor && !this.anchor.isConnected) this.hide();
  }

  destroy() { this.el.remove(); }
}
