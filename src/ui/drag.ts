/** Pointer-based drag & drop with a ghost icon (skills/items → hotbar, hotbar ↔ hotbar). */
import type { IconSpec } from '../core/types';
import { h } from './dom';
import type { UIScaler } from './scaler';
import { iconEl } from './uiIcons';

export interface DragPayload {
  /** Hotbar entry: skill id or "item:<id>". */
  entry: string;
  icon?: IconSpec;
  label: string;
  /** Set when dragging out of a hotbar slot. */
  fromSlot?: number;
}

export type DropHandler = (payload: DragPayload, target: Element | null) => void;

export class DragManager {
  private ghost: HTMLElement | null = null;
  private payload: DragPayload | null = null;
  private start: { x: number; y: number; id: number } | null = null;
  private pendingFn: (() => DragPayload | null) | null = null;
  private suppressClick = false;

  private readonly onMove = (e: PointerEvent) => this.move(e);
  private readonly onUp = (e: PointerEvent) => this.up(e);
  private readonly onClickCapture = (e: MouseEvent) => {
    if (this.suppressClick) { e.stopPropagation(); e.preventDefault(); this.suppressClick = false; }
  };

  constructor(private root: HTMLElement, private scaler: UIScaler, private onDrop: DropHandler) {
    window.addEventListener('click', this.onClickCapture, true);
  }

  get dragging() { return this.payload !== null; }

  /** Make `el` a drag source. `fn` returns the payload at drag start, or null to refuse. */
  bind(el: HTMLElement, fn: () => DragPayload | null) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      this.pendingFn = fn;
      window.addEventListener('pointermove', this.onMove);
      window.addEventListener('pointerup', this.onUp);
      window.addEventListener('pointercancel', this.onUp);
    });
  }

  private move(e: PointerEvent) {
    if (!this.start) return;
    if (!this.payload) {
      if (Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) < 5) return;
      let p: DragPayload | null = null;
      try { p = this.pendingFn?.() ?? null; } catch { p = null; }
      if (!p) { this.reset(); return; }
      this.payload = p;
      this.ghost = h('div', { class: 'ax-drag-ghost ax-passive' }, iconEl(p.icon, 34, p.label));
      this.root.appendChild(this.ghost);
      document.body.classList.add('ax-dragging');
      this.root.classList.add('ax-drag-active');
    }
    const l = this.scaler.toLogical(e.clientX, e.clientY);
    if (this.ghost) this.ghost.style.transform = `translate(${l.x - 19}px, ${l.y - 19}px)`;
    this.highlight(document.elementFromPoint(e.clientX, e.clientY));
  }

  private lastHover: Element | null = null;
  private highlight(el: Element | null) {
    // Hotbar page buttons flip the page while a drag hovers them (so spells can be dropped on page 2).
    el?.closest('.ax-page-btn')?.dispatchEvent(new Event('ax-drag-over'));
    const slot = el?.closest('[data-hotbar-slot]') ?? null;
    if (slot === this.lastHover) return;
    this.lastHover?.classList.remove('ax-drop-hover');
    slot?.classList.add('ax-drop-hover');
    this.lastHover = slot;
  }

  private up(e: PointerEvent) {
    const payload = this.payload;
    if (payload) {
      this.suppressClick = true;
      setTimeout(() => { this.suppressClick = false; }, 0);
      const target = document.elementFromPoint(e.clientX, e.clientY);
      this.reset();
      try { this.onDrop(payload, target); } catch (err) { console.warn('[ui] drop failed', err); }
    } else {
      this.reset();
    }
  }

  private reset() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.ghost?.remove();
    this.ghost = null;
    this.payload = null;
    this.start = null;
    this.pendingFn = null;
    this.lastHover?.classList.remove('ax-drop-hover');
    this.lastHover = null;
    document.body.classList.remove('ax-dragging');
    this.root.classList.remove('ax-drag-active');
  }

  destroy() {
    this.reset();
    window.removeEventListener('click', this.onClickCapture, true);
  }
}
