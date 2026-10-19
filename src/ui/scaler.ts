/**
 * Keeps #ui-root laid out at a logical 1280×720 (on phones: 405 tall and as wide as the device aspect, so every
 * DOM element renders ~1.8× larger and right-anchored HUD sits at the screen edge) and scaled to exactly cover the Phaser canvas.
 */
import Phaser from 'phaser';
import { onMobileLayoutChanged, uiLogicalSize } from './mobile';

export function uiRootEl(): HTMLElement {
  let el = document.getElementById('ui-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ui-root';
    (document.getElementById('stage') ?? document.body).appendChild(el);
  }
  return el;
}

export class UIScaler {
  k = 1;
  private last = '';
  private ro: ResizeObserver | null = null;
  private nextCheck = 0;
  private readonly onResize = () => this.apply();
  private offMobile: () => void;
  /** Logical size #ui-root is laid out at (1280×720, or ~W×405 in the mobile layout, W following the canvas aspect). */
  w = 1280;
  h = 720;

  constructor(readonly root: HTMLElement, private game: Phaser.Game) {
    const st = root.style;
    const size = uiLogicalSize();
    this.w = size.w; this.h = size.h;
    st.width = `${size.w}px`;
    st.height = `${size.h}px`;
    st.transformOrigin = '0 0';
    this.offMobile = onMobileLayoutChanged(() => { this.last = ''; this.apply(); });
    window.addEventListener('resize', this.onResize);
    try { game.scale.on(Phaser.Scale.Events.RESIZE, this.onResize); } catch { /* ignore */ }
    try {
      if (typeof ResizeObserver !== 'undefined' && game.canvas) {
        this.ro = new ResizeObserver(this.onResize);
        this.ro.observe(game.canvas);
      }
    } catch { this.ro = null; }
    this.apply();
  }

  /** Cheap periodic re-check (margins from autoCenter don't fire ResizeObserver). */
  check(time: number) {
    if (time < this.nextCheck) return;
    this.nextCheck = time + 300;
    this.apply();
  }

  apply() {
    const canvas = this.game.canvas;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (r.width < 1) return;
    const parent = (this.root.offsetParent as HTMLElement | null) ?? document.body;
    const p = parent.getBoundingClientRect();
    const size = uiLogicalSize();
    const k = r.width / size.w;
    const left = r.left - p.left + (parent.scrollLeft || 0);
    const top = r.top - p.top + (parent.scrollTop || 0);
    const key = `${left.toFixed(1)},${top.toFixed(1)},${k.toFixed(4)},${size.w}`;
    if (key === this.last) return;
    this.last = key;
    this.k = k;
    this.w = size.w;
    this.h = size.h;
    const st = this.root.style;
    st.width = `${size.w}px`;
    st.height = `${size.h}px`;
    st.left = `${left}px`;
    st.top = `${top}px`;
    st.transform = `scale(${k})`;
  }

  /** Client (viewport) coordinates → logical UI coordinates (1280×720, or ~W×405 on phones). */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.root.getBoundingClientRect();
    const k = this.k || 1;
    return { x: (clientX - r.left) / k, y: (clientY - r.top) / k };
  }

  destroy() {
    try { this.offMobile(); } catch { /* ignore */ }
    window.removeEventListener('resize', this.onResize);
    try { this.game.scale.off(Phaser.Scale.Events.RESIZE, this.onResize); } catch { /* ignore */ }
    try { this.ro?.disconnect(); } catch { /* ignore */ }
    this.ro = null;
  }
}
