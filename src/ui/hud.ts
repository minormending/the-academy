/** HUD: status bar (Lv/name/job, HP/MP, EXP), hotbar, buff tray, low-HP vignette. */
import { MAX_LEVEL } from '../core/constants';
import { SLOT_ACTIONS, getBinding, keyLabel, onBindingsChanged, type ActionId } from '../core/bindings';
import { HOTBAR_PAGE_SIZE, HOTBAR_SIZE, type ActiveBuff } from '../core/types';
import { bus } from '../core/events';
import { Registry } from '../core/registry';
import { expToNext } from '../core/balance';
import { MAX_INVENTORY_STACKS } from '../systems/Progression';
import type { UICtx, WindowName } from './context';
import { clear, fmtNum, fmtSec, h, safe, setText, toggleClass } from './dom';
import { iconEl } from './uiIcons';
import { toggleHonorsWindow } from './honorsWindow';
import { onPixelIconsReady, pixelIconUrl, type PixelIconName } from '../art/icons';
import { isMobileLayout, onMobileLayoutChanged } from './mobile';

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
  private bagBadge = h('span', { class: 'ax-bag-badge', hidden: true });
  private bagHintShown = false;
  /** Unsubscribers for the pixel-icon-sheet ready callbacks (released in destroy). */
  private iconSubs: (() => void)[] = [];
  private keySyncs: (() => void)[] = [];
  private offBindings: () => void = () => {};
  /** Phone layout (html.ax-mobile): short EXP text; the ☰ menu replaces the quick buttons. */
  private mobile = isMobileLayout();
  private offMobile: () => void;
  private menu: MobileMenu;

  constructor(private ctx: UICtx) {
    this.offMobile = onMobileLayoutChanged((on) => { this.mobile = on; });
    this.menu = new MobileMenu(ctx);
    this.lvNum = h('div', { class: 'ax-lv-num' }, '1');
    this.nameEl = h('div', { class: 'ax-id-name' });
    this.jobEl = h('div', { class: 'ax-id-job' });
    const btn = (label: string, action: ActionId, win: WindowName | 'honors', title: string) => {
      const ico = h('span', { class: `ax-quick-ico ax-qi-${win}` });
      const px = win === 'honors' ? undefined : QUICK_ICONS[win];
      if (px) this.iconSubs.push(onPixelIconsReady(() => {
        const url = pixelIconUrl(px, 26);
        if (url) { ico.style.setProperty('--qi', `url("${url}")`); ico.classList.add('ax-qi-px'); }
      }));
      const keyEl = h('span', { class: 'ax-quick-key' });
      const el = h('button', { class: 'ax-quick', onclick: () => { ctx.sfx('ui_click'); if (win === 'honors') toggleHonorsWindow(); else ctx.toggleWindow(win); } },
        ico, h('span', { class: 'ax-quick-label' }, label), keyEl);
      if (win === 'inventory') el.appendChild(this.bagBadge);
      // Key hints follow the player's bindings (Controls window).
      const sync = () => { const k = keyLabel(getBinding(action)); setText(keyEl, k); el.title = `${title} (${k})`; };
      sync();
      this.keySyncs.push(sync);
      return el;
    };
    this.el = h('div', { class: 'ax-statusbar' },
      h('div', { class: 'ax-lv' }, h('div', { class: 'ax-lv-tag' }, 'Lv.'), this.lvNum),
      h('div', { class: 'ax-id' }, this.nameEl, this.jobEl),
      h('div', { class: 'ax-gauges' }, this.hp.el, this.mp.el),
      h('div', { class: 'ax-quickbar' },
        btn('Char', 'stats', 'stats', 'Character'), btn('Items', 'inventory', 'inventory', 'Inventory'), btn('Skills', 'skills', 'skills', 'Skills'),
        btn('Tasks', 'quests', 'quests', 'Assignments'), btn('Honors', 'honors', 'honors', 'Academy Honors'), btn('Help', 'help', 'help', 'Controls'), btn('Menu', 'menu', 'menu', 'Menu')));
    this.offBindings = onBindingsChanged(() => { for (const f of this.keySyncs) f(); });
    this.expEl = h('div', { class: 'ax-expbar' }, this.exp.el);
    ctx.root.appendChild(this.el);
    ctx.root.appendChild(this.expEl);
  }

  onDamaged() { this.hp.hit(); }

  frame(dt: number) {
    const p = this.ctx.s.progression;
    const st = p.state;
    const stacks = st.inventory.length;
    this.bagBadge.hidden = stacks < MAX_INVENTORY_STACKS - 4;
    setText(this.bagBadge, `Bag ${stacks}/${MAX_INVENTORY_STACKS}`);
    toggleClass(this.bagBadge, 'ax-bag-full', stacks >= MAX_INVENTORY_STACKS);
    if (stacks >= MAX_INVENTORY_STACKS && !this.bagHintShown) {
      this.bagHintShown = true;
      bus.emit('ui:banner', { text: 'Your bag is full — sell old gear at Bram or Tilda', color: '#ffd36b' });
    }
    const d = safe(() => p.derived(), null);
    const maxHp = Math.max(1, d?.maxHp ?? 1), maxMp = Math.max(1, d?.maxMp ?? 1);
    const hp = Math.max(0, Math.round(st.hp)), mp = Math.max(0, Math.round(st.mp));
    this.hp.update(hp / maxHp, `${fmtNum(hp)} / ${fmtNum(maxHp)}`, dt);
    this.mp.update(mp / maxMp, `${fmtNum(mp)} / ${fmtNum(maxMp)}`, dt);
    const need = st.level >= MAX_LEVEL ? 0 : expToNext(st.level);
    if (need > 0) {
      const r = st.exp / need;
      const pct = `${(Math.max(0, Math.min(1, r)) * 100).toFixed(2)}%`;
      this.exp.update(r, this.mobile ? pct : `${fmtNum(st.exp)} / ${fmtNum(need)}  [${pct}]`, dt);
    } else this.exp.update(1, this.mobile ? 'MAX' : 'MAX LEVEL', dt);
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
    try { this.offBindings(); } catch { /* ignore */ }
    try { this.offMobile(); } catch { /* ignore */ }
    this.menu.destroy();
    this.el.remove(); this.expEl.remove();
  }
}

// ───────────────────────────── Mobile menu (☰) ─────────────────────────────

const MOBILE_MENU: readonly { label: string; win: WindowName | 'honors'; icon?: PixelIconName }[] = [
  { label: 'Spellbook', win: 'skills', icon: 'W_Book06' },
  { label: 'Bag', win: 'inventory', icon: 'I_Chest01' },
  { label: 'Character', win: 'stats', icon: 'C_Hat01' },
  { label: 'Classes', win: 'courses', icon: 'I_Scroll' },
  { label: 'Honors', win: 'honors' },
  { label: 'Menu & Settings', win: 'menu' },
];

/** Phones: one top-right ☰ button opening a simple list of the game's windows (hidden by CSS on desktop). */
export class MobileMenu {
  readonly btn: HTMLElement;
  readonly panel: HTMLElement;
  private open = false;
  private subs: (() => void)[] = [];

  constructor(private ctx: UICtx) {
    this.btn = h('button', { class: 'ax-mob-menubtn', title: 'Menu', 'aria-label': 'Menu', onclick: () => { ctx.sfx('ui_click'); this.setOpen(!this.open); } },
      h('span', { class: 'ax-mob-burger' }));
    const list = h('div', { class: 'ax-mob-menu-list' });
    for (const it of MOBILE_MENU) {
      const ico = h('span', { class: `ax-quick-ico ax-qi-${it.win}` });
      if (it.icon) {
        const name = it.icon;
        this.subs.push(onPixelIconsReady(() => {
          const url = pixelIconUrl(name, 26);
          if (url) { ico.style.setProperty('--qi', `url("${url}")`); ico.classList.add('ax-qi-px'); }
        }));
      }
      list.appendChild(h('button', {
        class: 'ax-mob-menu-item',
        onclick: () => {
          ctx.sfx('ui_click');
          this.setOpen(false);
          if (it.win === 'honors') toggleHonorsWindow(); else ctx.openWindow(it.win);
        },
      }, ico, h('span', { class: 'ax-mob-menu-label' }, it.label)));
    }
    this.panel = h('div', { class: 'ax-mob-menu', hidden: true, onclick: (e: Event) => { if (e.target === this.panel) this.setOpen(false); } },
      h('div', { class: 'ax-mob-menu-sheet' }, h('div', { class: 'ax-mob-menu-title' }, 'Menu'), list));
    ctx.root.appendChild(this.btn);
    ctx.root.appendChild(this.panel);
    this.subs.push(onMobileLayoutChanged((on) => { if (!on) this.setOpen(false); }));
  }

  isOpen() { return this.open; }

  setOpen(v: boolean) {
    if (v === this.open) return;
    this.open = v;
    this.panel.hidden = !v;
    toggleClass(this.btn, 'ax-active', v);
  }

  destroy() {
    for (const off of this.subs.splice(0)) { try { off(); } catch { /* ignore */ } }
    this.btn.remove(); this.panel.remove();
  }
}

// ───────────────────────────── Hotbar ─────────────────────────────

/** Visual order: two rows mirroring the keyboard (Q W E R T 1 / A S D F G 2). Indices are page-local. */
const HOTBAR_ORDER = [0, 1, 2, 3, 4, 10, 5, 6, 7, 8, 9, 11];
const PAGES = Math.max(1, Math.floor(HOTBAR_SIZE / HOTBAR_PAGE_SIZE));

interface SlotEls { root: HTMLElement; icon: HTMLElement; cd: HTMLElement; cdText: HTMLElement; badge: HTMLElement; lastCd: string; lastBadge: string; mpCost: number; itemId: string | null; }

/**
 * Two pages of 12 slots (HOTBAR_SIZE = 24). Only the current page's 12 slot elements exist; each carries its
 * absolute index in `data-hotbar-slot` (page·12 + i), so drag/drop, right-click and swaps (UIRoot.onDrop) work
 * across pages. Tab (GameScene) or the page buttons flip pages; hovering a page button while dragging flips too.
 */
export class Hotbar {
  readonly el: HTMLElement;
  private slots: SlotEls[] = [];
  private pageBtns: HTMLElement[] = [];
  private sig = '';
  private dirty = true;
  private page = 0;
  private offPage: () => void;
  private offBindings: () => void;
  private slotKeys: HTMLElement[] = [];
  private pageKey: HTMLElement;
  private pager: HTMLElement;

  constructor(private ctx: UICtx) {
    const grid = h('div', { class: 'ax-hotbar-grid' });
    for (let i = 0; i < HOTBAR_PAGE_SIZE; i++) {
      const icon = h('div', { class: 'ax-slot-icon' });
      const cd = h('div', { class: 'ax-slot-cd' });
      const cdText = h('div', { class: 'ax-slot-cdtext' });
      const badge = h('div', { class: 'ax-slot-badge' });
      const keyEl = h('div', { class: 'ax-slot-key' });
      this.slotKeys[i] = keyEl;
      const root = h('div', { class: 'ax-slot ax-empty', 'data-hotbar-slot': String(i) },
        icon, cd, cdText, badge, keyEl);
      root.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const abs = this.abs(i);
        if (this.entry(abs)) { ctx.s.progression.setHotbar(abs, null); ctx.sfx('ui_click'); this.dirty = true; }
      });
      ctx.drag.bind(root, () => {
        const abs = this.abs(i);
        const entry = this.entry(abs);
        if (!entry) return null;
        const v = this.visual(entry);
        return { entry, icon: v.icon, label: v.label, fromSlot: abs };
      });
      ctx.tooltip.attach(root, () => this.tip(this.abs(i)));
      this.slots[i] = { root, icon, cd, cdText, badge, lastCd: '', lastBadge: '', mpCost: 0, itemId: null };
    }
    for (const i of HOTBAR_ORDER) grid.appendChild(this.slots[i].root);
    const pager = h('div', { class: 'ax-hotbar-pager' });
    this.pager = pager;
    for (let pg = 0; pg < PAGES; pg++) {
      const btn = h('button', {
        class: 'ax-page-btn', title: `Hotbar page ${pg + 1}`,
        onclick: () => { this.setPage(pg); ctx.sfx('ui_click'); },
      }, String(pg + 1));
      // Dragging a spell onto the other page: hover its button to flip.
      btn.addEventListener('ax-drag-over', () => this.setPage(pg));
      this.pageBtns.push(btn);
      pager.appendChild(btn);
    }
    this.pageKey = h('div', { class: 'ax-page-key' });
    pager.appendChild(this.pageKey);
    this.el = h('div', { class: 'ax-hotbar' }, pager, grid);
    ctx.root.appendChild(this.el);
    this.page = this.currentPage();
    this.offPage = bus.on('hotbar:page', ({ page }) => this.onPage(page));
    this.syncKeys();
    this.offBindings = onBindingsChanged(() => this.syncKeys());
    this.syncPage();
  }

  markDirty() { this.dirty = true; }

  /** Slot / page key hints from the current bindings. */
  private syncKeys() {
    SLOT_ACTIONS.forEach((a, i) => { if (this.slotKeys[i]) setText(this.slotKeys[i], getBinding(a) ? keyLabel(getBinding(a)) : ''); });
    const pk = keyLabel(getBinding('hotbarPage'));
    setText(this.pageKey, pk);
    this.pager.title = `Hotbar page (${pk})`;
  }

  private currentPage(): number {
    const p = safe(() => this.ctx.s.game.hotbarPage(), 0);
    return Number.isInteger(p) && p >= 0 && p < PAGES ? p : 0;
  }

  private setPage(p: number) {
    if (p === this.page) return;
    try { this.ctx.s.game.setHotbarPage(p); } catch { /* ignore */ }
    // GameScene emits 'hotbar:page'; follow it (or apply locally if the game API is unavailable).
    if (this.currentPage() !== this.page) this.onPage(this.currentPage());
    else this.onPage(p);
  }

  private onPage(page: number) {
    const p = Number.isInteger(page) && page >= 0 && page < PAGES ? page : 0;
    if (p === this.page && this.slots[0].root.getAttribute('data-hotbar-slot') === String(p * HOTBAR_PAGE_SIZE)) return;
    this.page = p;
    this.syncPage();
    this.sig = '';
    this.dirty = true;
    this.ctx.tooltip.hide();
    this.el.classList.remove('ax-page-flip'); void this.el.offsetWidth; this.el.classList.add('ax-page-flip');
  }

  private syncPage() {
    for (let i = 0; i < HOTBAR_PAGE_SIZE; i++) this.slots[i].root.setAttribute('data-hotbar-slot', String(this.abs(i)));
    this.pageBtns.forEach((b, i) => toggleClass(b, 'ax-active', i === this.page));
    this.el.setAttribute('data-page', String(this.page));
  }

  private abs(i: number): number { return this.page * HOTBAR_PAGE_SIZE + i; }

  private entry(abs: number): string | null { return this.ctx.s.progression.state.hotbar?.[abs] ?? null; }

  private displayedItem(id: string): string {
    const p = this.ctx.s.progression;
    if (p.countItem(id) > 0) return id;
    // Match useItem's strongest-first potion kinds; mixed HP/MP elixirs stay separate.
    const kinds = [['white_potion', 'orange_potion', 'red_potion'], ['mana_elixir', 'blue_potion']];
    return kinds.find(kind => kind.includes(id))
      ?.find(candidate => p.countItem(candidate) > 0 && Registry.item(candidate)?.consumable) ?? id;
  }

  private visual(entry: string) {
    if (entry.startsWith('item:')) {
      const def = Registry.item(entry.slice(5));
      return { icon: def?.icon, label: def?.name ?? entry.slice(5) };
    }
    const def = Registry.skill(entry);
    return { icon: def?.icon, label: def?.name ?? entry };
  }

  private tip(abs: number) {
    const entry = this.entry(abs);
    if (!entry) return null;
    const p = this.ctx.s.progression;
    if (entry.startsWith('item:')) {
      const id = entry.slice(5);
      const shown = this.displayedItem(id);
      const hint = shown === id ? 'Right-click or drag off the bar to clear.'
        : `Out of ${Registry.item(id)?.name ?? id} — using ${Registry.item(shown)?.name ?? shown}. Right-click or drag off the bar to clear.`;
      return itemTooltip(Registry.item(shown), { qty: p.countItem(shown), level: p.state.level, branch: safe(() => p.jobDef().branch, 'none'), hint }, shown);
    }
    const def = Registry.skill(entry);
    if (!def) return h('div', { class: 'ax-tt' }, entry);
    return skillTooltip(def, { level: p.state.skills[entry] ?? 0, matk: safe(() => p.derived().matk, 0), hotbar: true, learned: p.state.skills });
  }

  flash(skillId: string, fail = false) {
    const hb = this.ctx.s.progression.state.hotbar ?? [];
    const base = this.page * HOTBAR_PAGE_SIZE;
    for (let i = 0; i < HOTBAR_PAGE_SIZE; i++) {
      if (hb[base + i] !== skillId) continue;
      const el = this.slots[i].root;
      const cls = fail ? 'ax-shake' : 'ax-flash';
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    }
  }

  private rebuild() {
    const p = this.ctx.s.progression;
    const hb = p.state.hotbar ?? [];
    for (let i = 0; i < HOTBAR_PAGE_SIZE; i++) {
      const s = this.slots[i];
      const entry = hb[this.abs(i)] ?? null;
      clear(s.icon);
      s.lastCd = ''; s.lastBadge = '';
      s.cd.style.background = ''; s.cdText.textContent = ''; s.badge.textContent = '';
      s.mpCost = 0;
      s.itemId = null;
      toggleClass(s.root, 'ax-empty', !entry);
      toggleClass(s.root, 'ax-dim', false);
      toggleClass(s.root, 'ax-potion-fallback', false);
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
    // a dot on the other page's button when it holds anything
    this.pageBtns.forEach((b, pg) => toggleClass(b, 'ax-has', hb.slice(pg * HOTBAR_PAGE_SIZE, (pg + 1) * HOTBAR_PAGE_SIZE).some(Boolean)));
  }

  frame() {
    const s = this.ctx.s;
    const p = s.progression;
    const hb = p.state.hotbar ?? [];
    // keep in sync even if a page flip happened without the event (e.g. map reload)
    const cur = this.currentPage();
    if (cur !== this.page) this.onPage(cur);
    if (this.dirty) {
      this.dirty = false;
      const sig = this.page + '#' + hb.map(e => e && !e.startsWith('item:') ? `${e}:${p.state.skills[e] ?? 0}` : e ?? '').join(',');
      if (sig !== this.sig) { this.sig = sig; this.rebuild(); }
    }
    const mp = p.state.mp;
    for (let i = 0; i < HOTBAR_PAGE_SIZE; i++) {
      const entry = hb[this.abs(i)];
      if (!entry) continue;
      const el = this.slots[i];
      if (entry.startsWith('item:')) {
        const assigned = entry.slice(5);
        const shown = this.displayedItem(assigned);
        if (shown !== el.itemId) {
          el.itemId = shown;
          const def = Registry.item(shown);
          el.icon.replaceChildren(iconEl(def?.icon, 36, def?.name ?? shown));
        }
        const qty = safe(() => p.countItem(shown), 0);
        const b = String(qty);
        if (b !== el.lastBadge) { el.lastBadge = b; el.badge.textContent = b; }
        toggleClass(el.root, 'ax-dim', qty <= 0);
        toggleClass(el.root, 'ax-potion-fallback', shown !== assigned);
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

  destroy() { try { this.offPage(); } catch { /* ignore */ } try { this.offBindings(); } catch { /* ignore */ } this.el.remove(); }
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
