/** Top-left minimap drawn from the current MapDef; player/NPC/monster dots refreshed ~12×/s. */
import type { MapDef } from '../core/types';
import { Registry } from '../core/registry';
import type { UICtx } from './context';
import { getBinding, keyLabel, onBindingsChanged } from '../core/bindings';
import { h, safe, setText } from './dom';
import { isMobileLayout, onMobileLayoutChanged } from './mobile';

const MAX_W = 216, MAX_H = 112, DPR = 2;
/** Phones: the minimap hides behind a map button; tapping it shows this large overlay (logical 720×405 px). */
const BIG_W = 600, BIG_H = 250;

export class Minimap {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D | null;
  private staticLayer: HTMLCanvasElement | null = null;
  private nameEl: HTMLElement;
  private subEl: HTMLElement;
  private mapId = '';
  private scale = 1;
  private w = MAX_W;
  private hgt = 60;
  private nextDraw = 0;
  private visible: boolean;
  private toggleBtn!: HTMLButtonElement;
  private offBindings: (() => void) | null = null;
  private offMobile: (() => void) | null = null;
  /** Phones: map button + large overlay state. */
  readonly mapBtn: HTMLElement;
  private overlay = false;
  private built: 'small' | 'big' = 'small';
  /** Marker / line size multiplier (bigger on the phone overlay). */
  private mk = 1;

  constructor(private ctx: UICtx) {
    this.canvas = h('canvas', { class: 'ax-minimap-canvas' });
    this.g = this.canvas.getContext('2d');
    this.nameEl = h('div', { class: 'ax-mm-name' });
    this.subEl = h('div', { class: 'ax-mm-sub' });
    const toggle = h('button', { class: 'ax-mm-toggle', title: 'Toggle minimap', onclick: () => this.toggle() }, '–');
    this.toggleBtn = toggle;
    const syncKey = () => { toggle.title = `Toggle minimap (${keyLabel(getBinding('minimap'))})`; };
    syncKey();
    this.offBindings = onBindingsChanged(syncKey);
    this.el = h('div', { class: 'ax-minimap' },
      h('div', { class: 'ax-mm-head' }, h('div', { class: 'ax-mm-titles' }, this.nameEl, this.subEl), toggle),
      h('div', { class: 'ax-mm-body' }, this.canvas));
    this.visible = ctx.layout.getFlag('minimap', true);
    this.el.classList.toggle('ax-collapsed', !this.visible);
    toggle.textContent = this.visible ? '–' : '+';
    // Tapping the big overlay anywhere closes it.
    this.el.addEventListener('click', (e) => { if (this.overlay && e.target !== toggle) this.setOverlay(false); });
    this.mapBtn = h('button', { class: 'ax-mm-mobbtn', title: 'Map', 'aria-label': 'Map', onclick: () => { this.ctx.sfx('ui_click'); this.setOverlay(!this.overlay); } },
      h('span', { class: 'ax-mm-mobico' }));
    ctx.root.appendChild(this.el);
    ctx.root.appendChild(this.mapBtn);
    this.offMobile = onMobileLayoutChanged((on) => { if (!on) this.setOverlay(false); this.mapId = ''; this.nextDraw = 0; });
  }

  /** Phones: show / hide the large map overlay. */
  setOverlay(on: boolean) {
    if (on === this.overlay) return;
    this.overlay = on;
    this.el.classList.toggle('ax-mm-overlay', on);
    this.mapBtn.classList.toggle('ax-active', on);
    this.mapId = '';
    this.nextDraw = 0;
    if (on) this.ctx.sfx('ui_open');
  }

  private drawing(): boolean { return isMobileLayout() ? this.overlay : this.visible; }

  toggle() {
    if (isMobileLayout()) { this.setOverlay(!this.overlay); return; }
    this.visible = !this.visible;
    this.el.classList.toggle('ax-collapsed', !this.visible);
    this.toggleBtn.textContent = this.visible ? '–' : '+';
    this.ctx.layout.setFlag('minimap', this.visible);
    this.ctx.sfx(this.visible ? 'ui_open' : 'ui_close');
    this.nextDraw = 0;
  }

  /** Force rebuild of the static layer (map changed). */
  invalidate() { this.mapId = ''; this.nextDraw = 0; }

  private buildStatic(def: MapDef) {
    this.mapId = def.id;
    setText(this.nameEl, def.name);
    const lr = def.levelRange;
    setText(this.subEl, def.safe ? `${def.region} · Safe zone` : `${def.region}${lr ? ` · Lv ${lr[0]}–${lr[1]}` : ''}`);
    const mw = Math.max(1, def.width), mh = Math.max(1, def.height);
    const big = isMobileLayout() && this.overlay;
    this.built = big ? 'big' : 'small';
    this.mk = big ? 1.8 : 1;
    this.scale = Math.min((big ? BIG_W : MAX_W) / mw, (big ? BIG_H : MAX_H) / mh);
    this.w = Math.max(40, Math.round(mw * this.scale));
    this.hgt = Math.max(24, Math.round(mh * this.scale));
    this.canvas.width = this.w * DPR;
    this.canvas.height = this.hgt * DPR;
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.hgt}px`;

    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    const g = c.getContext('2d');
    if (g) {
      const s = this.scale * DPR;
      const D = DPR * this.mk;
      const bg = g.createLinearGradient(0, 0, 0, c.height);
      bg.addColorStop(0, 'rgba(30,38,92,0.85)');
      bg.addColorStop(1, 'rgba(12,16,44,0.9)');
      g.fillStyle = bg;
      g.fillRect(0, 0, c.width, c.height);
      // walls
      g.fillStyle = 'rgba(140,150,200,0.45)';
      for (const w of def.walls ?? []) g.fillRect(w.x * s, w.y * s, Math.max(1, w.w * s), Math.max(1, w.h * s));
      // ropes
      g.strokeStyle = 'rgba(222,190,120,0.85)';
      g.lineWidth = D;
      g.setLineDash([2 * D, 1.5 * D]);
      for (const r of def.ropes ?? []) { g.beginPath(); g.moveTo(r.x * s, r.top * s); g.lineTo(r.x * s, r.bottom * s); g.stroke(); }
      g.setLineDash([]);
      // platforms
      for (const p of def.platforms ?? []) {
        g.strokeStyle = p.oneWay ? 'rgba(190,220,255,0.85)' : 'rgba(150,230,170,0.95)';
        g.lineWidth = (p.oneWay ? 1.2 : 2) * D;
        g.beginPath(); g.moveTo(p.x1 * s, p.y * s); g.lineTo(p.x2 * s, p.y * s); g.stroke();
      }
      // portals
      for (const p of def.portals ?? []) {
        if (p.hidden) continue;
        const x = p.x * s, y = (p.y - 30) * s;
        const grd = g.createRadialGradient(x, y, 0, x, y, 5 * D);
        grd.addColorStop(0, 'rgba(220,200,255,1)'); grd.addColorStop(1, 'rgba(140,90,255,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, 5 * D, 0, Math.PI * 2); g.fill();
      }
      // NPCs (static placements)
      for (const n of def.npcs ?? []) {
        g.fillStyle = '#6dffa6';
        g.strokeStyle = 'rgba(0,40,10,0.9)';
        g.lineWidth = D * 0.8;
        g.beginPath(); g.arc(n.x * s, (n.y - 20) * s, 2.4 * D, 0, Math.PI * 2); g.fill(); g.stroke();
      }
    }
    this.staticLayer = c;
  }

  frame(time: number) {
    if (!this.drawing()) return;
    if (time < this.nextDraw) return;
    this.nextDraw = time + 80;
    const map = safe(() => this.ctx.s.game.currentMap(), null);
    const def = map?.def ?? Registry.map(this.ctx.s.progression.state.mapId);
    if (!def || !this.g) return;
    if (def.id !== this.mapId || this.built !== (isMobileLayout() && this.overlay ? 'big' : 'small')) this.buildStatic(def);
    const g = this.g;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.staticLayer) g.drawImage(this.staticLayer, 0, 0);
    const s = this.scale * DPR;
    const D = DPR * this.mk;
    const mons = safe(() => this.ctx.s.monsters.all(), []);
    for (const m of mons) {
      if (!m.alive) continue;
      const boss = !!m.def.boss;
      g.fillStyle = boss ? '#ff4f9a' : '#ff6a5a';
      g.beginPath(); g.arc(m.x * s, (m.y - m.def.size.h / 2) * s, (boss ? 3.6 : 1.9) * D, 0, Math.PI * 2); g.fill();
    }
    const pl = this.ctx.s.player;
    const px = safe(() => pl.x, 0) * s, py = (safe(() => pl.y, 0) - 30) * s;
    const pulse = 1 + Math.sin(time / 180) * 0.25;
    g.fillStyle = 'rgba(255,230,90,0.35)';
    g.beginPath(); g.arc(px, py, 5 * D * pulse, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffe45a';
    g.strokeStyle = '#3a2a00';
    g.lineWidth = D;
    g.beginPath(); g.arc(px, py, 2.8 * D, 0, Math.PI * 2); g.fill(); g.stroke();
  }

  destroy() {
    this.offBindings?.(); this.offBindings = null;
    this.offMobile?.(); this.offMobile = null;
    this.el.remove(); this.mapBtn.remove();
  }
}
