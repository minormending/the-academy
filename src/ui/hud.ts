/** HUD: status bar (Lv/name/job, HP/MP, EXP), hotbar, buff tray, low-HP vignette. */
import { HOTBAR_LABELS, MAX_LEVEL } from '../core/constants';
import { HOTBAR_SIZE, type ActiveBuff } from '../core/types';
import { Registry } from '../core/registry';
import { expToNext } from '../core/balance';
import type { UICtx, WindowName } from './context';
import { clear, fmtNum, fmtSec, h, safe, setText, toggleClass } from './dom';
import { iconEl } from './uiIcons';
import { onPixelIconsReady, pixelIconUrl, type PixelIconName } from '../art/icons';

/** Pixel-art icons for the quick-menu buttons (CSS-drawn fallbacks stay for help/menu or if the sheet fails). */
const QUICK_ICONS: Partial<Record<WindowName, PixelIconName>> = { stats: 'C_Hat01', inventory: 'I_Chest01', skills: 'W_Book06', quests: 'I_Scroll' };
import { itemTooltip, skillTooltip, jobName, jobYear } from './info';

// ───────────────────────────── Gauge ─────────────────────────────

class Gauge {
  readonly el: HTMLElement;
  private fill: HTMLElement;
  private lag: HTMLElement;
  private text: HTMLElement;
  private shown = -1;
  private lagV = -1;
  private holdMs = 0;
  private lastText = '';

  constructor(private kind: 'hp' | 'mp' | 'exp', label: string) {
    this.fill = h('div', { class: 'ax-gauge-fill' });
    this.lag = h('div', { class: 'ax-gauge-lag' });
    this.text = h('div', { class: 'ax-gauge-text' });
    this.el = h('div', { class: `ax-gauge ax-${kind}` }, h('div', { class: 'ax-gauge-label' }, label),
      h('div', { class: 'ax-gauge-track' }, this.lag, this.fill, h('div', { class: 'ax-gauge-shine' })), this.text);
  }

  update(ratio: number, text: string, dt: number) {
    ratio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
    if (this.shown < 0 || (this.kind === 'exp' && ratio < this.shown - 0.02)) { this.shown = ratio; this.lagV = ratio; }
    // Fill: quick ease toward target. Lag layer: hold, then drain smoothly (damage trail).
    const k = Math.min(1, dt / 1000 * 14);
    this.shown += (ratio - this.shown) * k;
    if (Math.abs(this.shown - ratio) < 0.0005) this.shown = ratio;
    if (ratio < this.lagV - 0.0005) {
      if (this.holdMs > 0) this.holdMs -= dt;
      else this.lagV = Math.max(ratio, this.lagV - Math.max(0.25 * dt / 1000, (this.lagV - ratio) * Math.min(1, dt / 1000 * 3)));
    } else { this.lagV = Math.max(this.shown, ratio); this.holdMs = 0; }
    this.fill.style.transform = `scaleX(${this.shown.toFixed(4)})`;
    this.lag.style.transform = `scaleX(${this.lagV.toFixed(4)})`;
    if (text !== this.lastText) { this.lastText = text; this.text.textContent = text; }
  }

  /** Called when a hit lands so the trail lingers briefly. */
  hit() { this.holdMs = 380; this.el.classList.remove('ax-hit'); void this.el.offsetWidth; this.el.classList.add('ax-hit'); }
}

// ───────────────────────────── Status bar ─────────────────────────────

export class StatusBar {
  readonly el: HTMLElement;
  readonly expEl: HTMLElement;
  private lvNum: HTMLElement;
  private nameEl: HTMLElement;
  private jobEl: HTMLElement;
  private hp = new Gauge('hp', 'HP');
  private mp = new Gauge('mp', 'MP');
  private exp = new Gauge('exp', 'EXP');
  private sig = '';
  /** Unsubscribers for the pixel-icon-sheet ready callbacks (released in destroy). */
  private iconSubs: (() => void)[] = [];

  constructor(private ctx: UICtx) {
    this.lvNum = h('div', { class: 'ax-lv-num' }, '1');
    this.nameEl = h('div', { class: 'ax-id-name' });
    this.jobEl = h('div', { class: 'ax-id-job' });
    const btn = (label: string, key: string, win: WindowName, title: string) => {
      const ico = h('span', { class: `ax-quick-ico ax-qi-${win}` });
      const px = QUICK_ICONS[win];
      if (px) this.iconSubs.push(onPixelIconsReady(() => {
        const url = pixelIconUrl(px, 26);
        if (url) { ico.style.setProperty('--qi', `url("${url}")`); ico.classList.add('ax-qi-px'); }
      }));
      return h('button', { class: 'ax-quick', title: `${title} (${key})`, onclick: () => { ctx.sfx('ui_click'); ctx.toggleWindow(win); } },
        ico, h('span', { class: 'ax-quick-label' }, label), h('span', { class: 'ax-quick-key' }, key));
    };
    this.el = h('div', { class: 'ax-statusbar' },
      h('div', { class: 'ax-lv' }, h('div', { class: 'ax-lv-tag' }, 'Lv.'), this.lvNum),
      h('div', { class: 'ax-id' }, this.nameEl, this.jobEl),
      h('div', { class: 'ax-gauges' }, this.hp.el, this.mp.el),
      h('div', { class: 'ax-quickbar' },
        btn('Char', 'P', 'stats', 'Character'), btn('Items', 'I', 'inventory', 'Inventory'), btn('Skills', 'K', 'skills', 'Skills'),
        btn('Tasks', 'J', 'quests', 'Assignments'), btn('Help', 'H', 'help', 'Controls'), btn('Menu', 'Esc', 'menu', 'Menu')));
    this.expEl = h('div', { class: 'ax-expbar' }, this.exp.el);
    ctx.root.appendChild(this.el);
    ctx.root.appendChild(this.expEl);
  }

  onDamaged() { this.hp.hit(); }

  frame(dt: number) {
    const p = this.ctx.s.progression;
    const st = p.state;
    const d = safe(() => p.derived(), null);
    const maxHp = Math.max(1, d?.maxHp ?? 1), maxMp = Math.max(1, d?.maxMp ?? 1);
    const hp = Math.max(0, Math.round(st.hp)), mp = Math.max(0, Math.round(st.mp));
    this.hp.update(hp / maxHp, `${fmtNum(hp)} / ${fmtNum(maxHp)}`, dt);
    this.mp.update(mp / maxMp, `${fmtNum(mp)} / ${fmtNum(maxMp)}`, dt);
    const need = st.level >= MAX_LEVEL ? 0 : expToNext(st.level);
    if (need > 0) {
      const r = st.exp / need;
      this.exp.update(r, `${fmtNum(st.exp)} / ${fmtNum(need)}  [${(Math.max(0, Math.min(1, r)) * 100).toFixed(2)}%]`, dt);
    } else this.exp.update(1, 'MAX LEVEL', dt);
    const sig = `${st.level}|${st.name}|${st.job}`;
    if (sig !== this.sig) {
      this.sig = sig;
      setText(this.lvNum, String(st.level));
      setText(this.nameEl, st.name);
      setText(this.jobEl, `Year ${jobYear(st.job)} · ${jobName(st.job)}`);
    }
  }

  destroy() {
    for (const off of this.iconSubs.splice(0)) { try { off(); } catch { /* ignore */ } }
    this.el.remove(); this.expEl.remove();
  }
}

// ───────────────────────────── Hotbar ─────────────────────────────

/** Visual order: two rows mirroring the keyboard (Q W E R T 1 / A S D F G 2). */
const HOTBAR_ORDER = [0, 1, 2, 3, 4, 10, 5, 6, 7, 8, 9, 11];

interface SlotEls { root: HTMLElement; icon: HTMLElement; cd: HTMLElement; cdText: HTMLElement; badge: HTMLElement; lastCd: string; lastBadge: string; mpCost: number; }

export class Hotbar {
  readonly el: HTMLElement;
  private slots: SlotEls[] = [];
  private sig = '';
  private dirty = true;

  constructor(private ctx: UICtx) {
    const grid = h('div', { class: 'ax-hotbar-grid' });
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const icon = h('div', { class: 'ax-slot-icon' });
      const cd = h('div', { class: 'ax-slot-cd' });
      const cdText = h('div', { class: 'ax-slot-cdtext' });
      const badge = h('div', { class: 'ax-slot-badge' });
      const root = h('div', { class: 'ax-slot ax-empty', 'data-hotbar-slot': String(i) },
        icon, cd, cdText, badge, h('div', { class: 'ax-slot-key' }, HOTBAR_LABELS[i] ?? ''));
      root.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.entry(i)) { ctx.s.progression.setHotbar(i, null); ctx.sfx('ui_click'); this.dirty = true; }
      });
      ctx.drag.bind(root, () => {
        const entry = this.entry(i);
        if (!entry) return null;
        const v = this.visual(entry);
        return { entry, icon: v.icon, label: v.label, fromSlot: i };
      });
      ctx.tooltip.attach(root, () => this.tip(i));
      this.slots[i] = { root, icon, cd, cdText, badge, lastCd: '', lastBadge: '', mpCost: 0 };
    }
    for (const i of HOTBAR_ORDER) grid.appendChild(this.slots[i].root);
    this.el = h('div', { class: 'ax-hotbar' }, grid);
    ctx.root.appendChild(this.el);
  }

  markDirty() { this.dirty = true; }

  private entry(i: number): string | null { return this.ctx.s.progression.state.hotbar?.[i] ?? null; }

  private visual(entry: string) {
    if (entry.startsWith('item:')) {
      const def = Registry.item(entry.slice(5));
      return { icon: def?.icon, label: def?.name ?? entry.slice(5) };
    }
    const def = Registry.skill(entry);
    return { icon: def?.icon, label: def?.name ?? entry };
  }

  private tip(i: number) {
    const entry = this.entry(i);
    if (!entry) return null;
    const p = this.ctx.s.progression;
    if (entry.startsWith('item:')) {
      const id = entry.slice(5);
      return itemTooltip(Registry.item(id), { qty: p.countItem(id), level: p.state.level, branch: safe(() => p.jobDef().branch, 'none'), hint: 'Right-click or drag off the bar to clear.' }, id);
    }
    const def = Registry.skill(entry);
    if (!def) return h('div', { class: 'ax-tt' }, entry);
    return skillTooltip(def, { level: p.state.skills[entry] ?? 0, matk: safe(() => p.derived().matk, 0), hotbar: true, learned: p.state.skills });
  }

  flash(skillId: string, fail = false) {
    const hb = this.ctx.s.progression.state.hotbar;
    hb.forEach((e, i) => {
      if (e !== skillId) return;
      const el = this.slots[i].root;
      const cls = fail ? 'ax-shake' : 'ax-flash';
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    });
  }

  private rebuild() {
    const p = this.ctx.s.progression;
    const hb = p.state.hotbar ?? [];
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const s = this.slots[i];
      const entry = hb[i] ?? null;
      clear(s.icon);
      s.lastCd = ''; s.lastBadge = '';
      s.cd.style.background = ''; s.cdText.textContent = ''; s.badge.textContent = '';
      s.mpCost = 0;
      toggleClass(s.root, 'ax-empty', !entry);
      toggleClass(s.root, 'ax-dim', false);
      toggleClass(s.root, 'ax-item', !!entry && entry.startsWith('item:'));
      if (!entry) continue;
      const v = this.visual(entry);
      s.icon.appendChild(iconEl(v.icon, 36, v.label));
      if (!entry.startsWith('item:')) {
        const def = Registry.skill(entry);
        const lv = p.state.skills[entry] ?? 0;
        s.mpCost = def && lv > 0 ? safe(() => def.mpCost(lv), 0) : 0;
        if (s.mpCost > 0) { s.badge.textContent = String(s.mpCost); s.badge.className = 'ax-slot-badge ax-mp'; }
        else s.badge.className = 'ax-slot-badge';
      } else s.badge.className = 'ax-slot-badge ax-qty';
    }
  }

  frame() {
    const s = this.ctx.s;
    const p = s.progression;
    const hb = p.state.hotbar ?? [];
    if (this.dirty) {
      this.dirty = false;
      const sig = hb.map(e => e && !e.startsWith('item:') ? `${e}:${p.state.skills[e] ?? 0}` : e ?? '').join(',');
      if (sig !== this.sig) { this.sig = sig; this.rebuild(); }
    }
    const mp = p.state.mp;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const entry = hb[i];
      if (!entry) continue;
      const el = this.slots[i];
      if (entry.startsWith('item:')) {
        const qty = safe(() => p.countItem(entry.slice(5)), 0);
        const b = String(qty);
        if (b !== el.lastBadge) { el.lastBadge = b; el.badge.textContent = b; toggleClass(el.root, 'ax-dim', qty <= 0); }
        continue;
      }
      const rem = safe(() => s.skills.getCooldownRemaining(entry), 0);
      const tot = safe(() => s.skills.getCooldownTotal(entry), 0);
      let cdKey = '';
      if (rem > 0 && tot > 0) {
        const pct = Math.max(0, Math.min(100, (rem / tot) * 100));
        cdKey = pct.toFixed(0);
        if (cdKey !== el.lastCd) {
          el.cd.style.background = `conic-gradient(rgba(8,10,28,0.72) ${pct}%, rgba(8,10,28,0) ${pct}%)`;
        }
        const t = rem >= 1000 ? String(Math.ceil(rem / 1000)) : (rem / 1000).toFixed(1);
        if (el.cdText.textContent !== t) el.cdText.textContent = t;
      }
      if (cdKey !== el.lastCd) {
        if (!cdKey) { el.cd.style.background = ''; el.cdText.textContent = ''; if (el.lastCd) { el.root.classList.remove('ax-ready'); void el.root.offsetWidth; el.root.classList.add('ax-ready'); } }
        el.lastCd = cdKey;
      }
      toggleClass(el.root, 'ax-dim', el.mpCost > 0 && mp < el.mpCost);
    }
  }

  destroy() { this.el.remove(); }
}

// ───────────────────────────── Buff tray ─────────────────────────────

export class BuffTray {
  readonly el: HTMLElement;
  private sig = '';
  private items = new Map<string, { root: HTMLElement; time: HTMLElement; ring: HTMLElement; last: string }>();

  constructor(private ctx: UICtx) {
    this.el = h('div', { class: 'ax-buffs' });
    ctx.root.appendChild(this.el);
  }

  frame() {
    const buffs: ActiveBuff[] = safe(() => this.ctx.s.skills.getActiveBuffs(), []);
    const sig = buffs.map(b => b.skillId).join(',');
    if (sig !== this.sig) {
      this.sig = sig;
      clear(this.el);
      this.items.clear();
      for (const b of buffs) {
        const def = Registry.skill(b.skillId);
        const time = h('div', { class: 'ax-buff-time' });
        const ring = h('div', { class: 'ax-buff-ring' });
        const root = h('div', { class: 'ax-buff', title: '' }, iconEl(def?.icon, 30, def?.name ?? b.skillId), ring, time);
        // Maple-style: right-click cancels a buff (left-click does nothing, so it can't happen by accident).
        root.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          try { this.ctx.s.skills.cancelBuff(b.skillId); this.ctx.sfx('ui_close'); this.ctx.tooltip.hide(); } catch { /* ignore */ }
        });
        this.ctx.tooltip.attach(root, () => {
          const cur = safe(() => this.ctx.s.skills.getActiveBuffs().find(x => x.skillId === b.skillId), undefined);
          return h('div', { class: 'ax-tt' },
            h('div', { class: 'ax-tt-name' }, def?.name ?? b.skillId),
            h('div', { class: 'ax-tt-sub' }, cur ? `${fmtSec(cur.remainingMs)} remaining` : ''),
            h('div', { class: 'ax-tt-foot' }, 'Right-click to cancel.'));
        });
        this.el.appendChild(root);
        this.items.set(b.skillId, { root, time, ring, last: '' });
      }
    }
    for (const b of buffs) {
      const it = this.items.get(b.skillId);
      if (!it) continue;
      const secs = Math.ceil(b.remainingMs / 1000);
      const t = secs >= 60 ? `${Math.floor(secs / 60)}m` : `${secs}s`;
      if (t !== it.last) {
        it.last = t;
        it.time.textContent = t;
        const pct = b.totalMs > 0 ? Math.max(0, Math.min(100, 100 - (b.remainingMs / b.totalMs) * 100)) : 0;
        it.ring.style.background = `conic-gradient(rgba(5,6,20,0.6) ${pct}%, transparent ${pct}%)`;
        toggleClass(it.root, 'ax-expiring', b.remainingMs < 5000);
      }
    }
  }

  destroy() { this.el.remove(); }
}

// ───────────────────────────── Low HP vignette ─────────────────────────────

export class Vignette {
  readonly el: HTMLElement;
  private last = -1;
  constructor(private ctx: UICtx) {
    this.el = h('div', { class: 'ax-vignette ax-passive' });
    ctx.root.appendChild(this.el);
  }
  frame() {
    const p = this.ctx.s.progression;
    const max = Math.max(1, safe(() => p.derived().maxHp, 1));
    const r = p.state.hp / max;
    const dead = safe(() => p.isDead(), false);
    const o = dead ? 0.85 : r < 0.3 ? 0.5 + ((0.3 - r) / 0.3) * 0.5 : 0;
    const q = Math.round(o * 50) / 50;
    if (q !== this.last) {
      this.last = q;
      this.el.style.opacity = String(q);
      toggleClass(this.el, 'ax-pulse', q > 0 && !dead);
    }
  }
  destroy() { this.el.remove(); }
}
