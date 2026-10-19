/**
 * On-screen touch controls for phones and tablets.
 *
 * Every control presses the *current binding* of a rebindable action with synthetic `KeyboardEvent`s on `window`
 * (same approach and flag as GamepadBridge), so Player / GameScene / UIRoot need no touch code and rebinding keeps
 * working. Each control is a "source" that holds a set of keys; a key is pressed when its first source takes it and
 * released when the last one lets go, so multi-touch (move + jump + cast) and shared keys (Up = climb + portal) work.
 *
 * Layout (logical 1280×720, inside #ui-root so it scales with the canvas):
 * - bottom-left: 8-way d-pad / joystick (Up also = interact / portal, like the keyboard);
 * - bottom-right: big Jump, Pick up (hold), a 2×3 cluster showing half of the current hotbar page
 *   (icons + cooldown sweep from the same state the HUD reads) and a flip button cycling halves and pages;
 * - top-centre: Spellbook, Items, Character, Assignments, Honors, Menu.
 *
 * Touch mode (html.ax-touch) comes from Settings → Touch: auto (coarse pointer or after the first touch; a real
 * key press on a fine-pointer device switches it back off), on, off. The module also installs a few page-wide
 * touch fixes on import: iOS pinch-zoom block and a double-tap → dblclick shim for the DOM windows.
 */
import { SLOT_ACTIONS, getBinding, keyEventInit, onBindingsChanged, type ActionId } from '../core/bindings';
import { getSettings, onSettingsChanged } from '../core/settings';
import { GAMEPAD_EVENT_FLAG } from '../systems/GamepadBridge';
import { HOTBAR_PAGE_SIZE, HOTBAR_SIZE } from '../core/types';
import { Registry } from '../core/registry';
import { onPixelIconsReady, pixelIconUrl, type PixelIconName } from '../art/icons';
import type { UICtx, WindowName } from './context';
import { h, safe, setText, toggleClass } from './dom';
import { iconEl } from './uiIcons';
import { toggleHonorsWindow } from './honorsWindow';

// ───────────────────────────── touch mode ─────────────────────────────

let touchSeen = false;
let coarse: MediaQueryList | null = null;
let lastActive: boolean | null = null;
const modeListeners = new Set<(on: boolean) => void>();

/** True when the on-screen controls should be shown. */
export function isTouchMode(): boolean {
  const m = getSettings().touch;
  return m === 'on' || (m === 'auto' && (touchSeen || !!coarse?.matches));
}

/** Subscribe to touch mode turning on / off; returns an unsubscribe function. */
export function onTouchModeChanged(cb: (on: boolean) => void): () => void {
  modeListeners.add(cb);
  return () => { modeListeners.delete(cb); };
}

function syncMode() {
  const on = isTouchMode();
  const html = document.documentElement;
  html.classList.toggle('ax-touch', on);
  html.classList.toggle('ax-touch-off', getSettings().touch === 'off');
  if (on === lastActive) return;
  lastActive = on;
  for (const cb of [...modeListeners]) {
    try { cb(on); } catch (e) { console.warn('[touch] listener failed', e); }
  }
}

/**
 * Many mobile browsers only send `dblclick` for a double tap when they feel like it. Inventory / Spellbook /
 * Character use dblclick (use, equip, auto-place), so synthesize one for a touch double tap — unless the browser
 * sends its own right after (it would arrive within the same tap's compat mouse events).
 */
function installDoubleTap() {
  let last: { t: number; x: number; y: number; target: Element } | null = null;
  let pending = 0;
  window.addEventListener('dblclick', (e) => {
    if (e.isTrusted && pending) { window.clearTimeout(pending); pending = 0; }
  }, true);
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target || !target.closest('#ui-root') || target.closest('.ax-tc')) { last = null; return; }
    const now = performance.now();
    if (last && last.target === target && now - last.t < 380 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
      last = null;
      const { clientX, clientY } = e;
      window.clearTimeout(pending);
      pending = window.setTimeout(() => {
        pending = 0;
        if (target.isConnected) target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX, clientY, detail: 2, view: window }));
      }, 120);
      return;
    }
    last = { t: now, x: e.clientX, y: e.clientY, target };
  }, true);
}

function installTouchMode() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try { coarse = window.matchMedia('(pointer: coarse)'); coarse.addEventListener?.('change', syncMode); } catch { coarse = null; }
  const seen = () => { if (!touchSeen) { touchSeen = true; syncMode(); } };
  window.addEventListener('touchstart', seen, { capture: true, passive: true });
  window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') seen(); }, { capture: true, passive: true });
  // Auto mode on a laptop with a touch screen: going back to the keyboard hides the controls again.
  window.addEventListener('keydown', (e) => {
    if (e.isTrusted && touchSeen && !coarse?.matches && getSettings().touch === 'auto') { touchSeen = false; syncMode(); }
  }, true);
  onSettingsChanged((_s, key) => { if (key === 'touch') syncMode(); });
  // iOS Safari ignores user-scalable=no; its proprietary gesture events are the only way to stop pinch-zoom.
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  installDoubleTap();
  syncMode();
}

installTouchMode();

/** Light haptic tick for jump / spell presses; no-op where vibration is unsupported or touch mode is off. */
function tick() {
  try { if (isTouchMode()) navigator.vibrate?.(8); } catch { /* unsupported or blocked */ }
}

// ───────────────────────────── synthetic keys ─────────────────────────────

function dispatchKey(type: 'keydown' | 'keyup', keyCode: number) {
  const init = keyEventInit(keyCode);
  const event = new KeyboardEvent(type, { key: init.key, code: init.code, bubbles: true, cancelable: true, repeat: false });
  // Phaser reads the legacy numeric fields; the flag keeps the Controls window's key capture from binding taps.
  Object.defineProperties(event, {
    keyCode: { value: keyCode },
    which: { value: keyCode },
    [GAMEPAD_EVENT_FLAG]: { value: true },
  });
  window.dispatchEvent(event);
}

/** Reference-counted key presses: each control is a source holding a set of keyCodes. */
class KeyPresser {
  private sources = new Map<string, number[]>();
  private counts = new Map<number, number>();

  set(source: string, actions: readonly ActionId[]) {
    const codes = [...new Set(actions.map(a => getBinding(a)).filter(c => c > 0))];
    const prev = this.sources.get(source) ?? [];
    if (codes.length) this.sources.set(source, codes); else this.sources.delete(source);
    for (const c of prev) {
      if (codes.includes(c)) continue;
      const n = (this.counts.get(c) ?? 0) - 1;
      if (n > 0) this.counts.set(c, n);
      else { this.counts.delete(c); dispatchKey('keyup', c); }
    }
    for (const c of codes) {
      if (prev.includes(c)) continue;
      const n = (this.counts.get(c) ?? 0) + 1;
      this.counts.set(c, n);
      if (n === 1) dispatchKey('keydown', c);
    }
  }

  release(source: string) { if (this.sources.has(source)) this.set(source, []); }

  releaseAll() {
    const held = [...this.counts.keys()];
    this.sources.clear();
    this.counts.clear();
    for (const c of held) dispatchKey('keyup', c);
  }

  /** keyCodes currently held (debug / tests). */
  held(): number[] { return [...this.counts.keys()]; }
}

// ───────────────────────────── controls ─────────────────────────────

const PAGES = Math.max(1, Math.floor(HOTBAR_SIZE / HOTBAR_PAGE_SIZE));
/** Page-local slot indices of each half, in grid order (keyboard halves: Q W E / A S D and R T 1 / F G 2). */
const HALVES: readonly (readonly number[])[] = [[0, 1, 2, 5, 6, 7], [3, 4, 10, 8, 9, 11]];
const TOP_BUTTONS: readonly { action: ActionId; win: WindowName | 'honors'; label: string; icon?: PixelIconName }[] = [
  { action: 'skills', win: 'skills', label: 'Spells', icon: 'W_Book06' },
  { action: 'inventory', win: 'inventory', label: 'Items', icon: 'I_Chest01' },
  { action: 'stats', win: 'stats', label: 'Char', icon: 'C_Hat01' },
  { action: 'quests', win: 'quests', label: 'Tasks', icon: 'I_Scroll' },
  { action: 'honors', win: 'honors', label: 'Honors' }, // CSS-drawn medal (.ax-qi-honors)
  { action: 'menu', win: 'menu', label: 'Menu' },
];

interface TouchSlot { el: HTMLElement; icon: HTMLElement; cd: HTMLElement; cdText: HTMLElement; badge: HTMLElement; sig: string; lastCd: string; mpCost: number; }

export class TouchControls {
  readonly el: HTMLElement;
  private keys = new KeyPresser();
  private pad: HTMLElement;
  private knob: HTMLElement;
  private padPointer: number | null = null;
  private padDir = '';
  private slots: TouchSlot[] = [];
  private flipBtn: HTMLElement;
  private flipNum: HTMLElement;
  private flipPips: HTMLElement[] = [];
  private half = 0;
  private page = -1;
  /** null until the first sync, so the initial state always applies. */
  private shown: boolean | null = null;
  /** Elements with active pointers (for release-all). */
  private downEls = new Map<HTMLElement, Set<number>>();
  private unsubs: (() => void)[] = [];

  private readonly releaseAll = () => this.reset();
  private readonly onVisibility = () => { if (document.hidden) this.reset(); };
  private readonly block = (e: Event) => { if (e.cancelable) e.preventDefault(); };

  constructor(private ctx: UICtx) {
    // D-pad
    this.knob = h('div', { class: 'ax-tc-knob' });
    const arm = (d: string) => h('div', { class: `ax-tc-arm ax-tc-arm-${d}` }, h('i'));
    this.pad = h('div', { class: 'ax-tc-pad' }, h('div', { class: 'ax-tc-cross' }, arm('up'), arm('down'), arm('left'), arm('right'), h('div', { class: 'ax-tc-hub' })), this.knob);
    this.bindPad();

    // Hotbar cluster
    const grid = h('div', { class: 'ax-tc-slots' });
    for (let i = 0; i < 6; i++) {
      const icon = h('div', { class: 'ax-tc-slot-icon' });
      const cd = h('div', { class: 'ax-tc-slot-cd' });
      const cdText = h('div', { class: 'ax-tc-slot-cdtext' });
      const badge = h('div', { class: 'ax-tc-slot-badge' });
      const el = h('div', { class: 'ax-tc-btn ax-tc-slot ax-empty', 'data-hotbar-slot': String(HALVES[0][i]) }, icon, cd, cdText, badge);
      // Slots are drop targets too (UIRoot.onDrop reads data-hotbar-slot), so spells can be dragged straight here.
      this.pressable(el, `slot${i}`, () => [SLOT_ACTIONS[HALVES[this.half][i]]], true);
      grid.appendChild(el);
      this.slots.push({ el, icon, cd, cdText, badge, sig: '', lastCd: '', mpCost: 0 });
    }
    this.flipNum = h('span', { class: 'ax-tc-flip-num' });
    const pips = h('span', { class: 'ax-tc-flip-pips' });
    for (let i = 0; i < HALVES.length; i++) { const p = h('i'); this.flipPips.push(p); pips.appendChild(p); }
    this.flipBtn = h('div', { class: 'ax-tc-btn ax-tc-flip', title: 'Next hotbar half / page' }, h('span', { class: 'ax-tc-flip-arrow' }), this.flipNum, pips);
    this.bindFlip();

    const jump = h('div', { class: 'ax-tc-btn ax-tc-jump' }, h('span', { class: 'ax-tc-jump-arrow' }), h('span', { class: 'ax-tc-label' }, 'Jump'));
    this.pressable(jump, 'jump', () => [getBinding('jump') ? 'jump' : 'jump2'], true);
    const pickIco = h('span', { class: 'ax-tc-ico' });
    const pickup = h('div', { class: 'ax-tc-btn ax-tc-pickup' }, pickIco, h('span', { class: 'ax-tc-label' }, 'Loot'));
    this.pressable(pickup, 'pickup', () => ['pickup']);
    this.iconInto(pickIco, 'I_GoldCoin', 28);

    // Top bar
    const top = h('div', { class: 'ax-tc-top' });
    for (const b of TOP_BUTTONS) {
      const ico = h('span', { class: `ax-quick-ico ax-qi-${b.win}` });
      if (b.icon) {
        const name = b.icon;
        this.unsubs.push(onPixelIconsReady(() => {
          const url = pixelIconUrl(name, 26);
          if (url) { ico.style.setProperty('--qi', `url("${url}")`); ico.classList.add('ax-qi-px'); }
        }));
      }
      const el = h('div', { class: 'ax-tc-btn ax-tc-topbtn', title: b.label }, ico, h('span', { class: 'ax-tc-label' }, b.label));
      this.pressable(el, `win:${b.action}`, () => [b.action]);
      // Honors is a separate window (not a WindowName); if its key is unbound, toggle it directly.
      if (b.win === 'honors') el.addEventListener('pointerdown', () => { if (!getBinding('honors')) toggleHonorsWindow(); });
      top.appendChild(el);
    }

    this.el = h('div', { class: 'ax-tc' }, this.pad, h('div', { class: 'ax-tc-right' }, grid, this.flipBtn, pickup, jump), top);
    // No scrolling, zooming, selection, callouts or long-press menus on the controls.
    this.el.addEventListener('touchstart', this.block, { passive: false });
    this.el.addEventListener('touchmove', this.block, { passive: false });
    this.el.addEventListener('contextmenu', this.block);
    this.el.addEventListener('selectstart', this.block);
    this.el.addEventListener('dragstart', this.block);
    ctx.root.appendChild(this.el);

    window.addEventListener('blur', this.releaseAll);
    window.addEventListener('pagehide', this.releaseAll);
    window.addEventListener('orientationchange', this.releaseAll);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.unsubs.push(onBindingsChanged(() => this.reset()));
    this.unsubs.push(onTouchModeChanged(() => this.syncShown()));
    this.syncShown();
  }

  /** Debug / tests: keyCodes the touch layer currently holds. */
  heldKeys(): number[] { return this.keys.held(); }

  private syncShown() {
    const on = isTouchMode();
    if (on === this.shown) return;
    this.shown = on;
    this.el.style.display = on ? '' : 'none';
    if (!on) this.reset();
  }

  private iconInto(el: HTMLElement, name: PixelIconName, size: number) {
    this.unsubs.push(onPixelIconsReady(() => {
      const url = pixelIconUrl(name, size);
      if (url) { el.style.backgroundImage = `url("${url}")`; el.classList.add('ax-tc-ico-px'); }
    }));
  }

  // ─────────────────────────── input ───────────────────────────

  private track(el: HTMLElement, id: number, down: boolean): number {
    let set = this.downEls.get(el);
    if (down) { if (!set) { set = new Set(); this.downEls.set(el, set); } set.add(id); }
    else if (set) { set.delete(id); if (!set.size) this.downEls.delete(el); }
    const n = this.downEls.get(el)?.size ?? 0;
    toggleClass(el, 'ax-down', n > 0);
    return n;
  }

  /** Hold-to-press button: keydown on the first finger, keyup when the last one lifts (or is cancelled). */
  private pressable(el: HTMLElement, source: string, actions: () => readonly ActionId[], haptic = false) {
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      if (this.downEls.get(el)?.has(e.pointerId)) return;
      if (this.track(el, e.pointerId, true) === 1) {
        this.keys.set(source, actions());
        if (haptic) tick();
      }
    });
    const up = (e: PointerEvent) => {
      if (!this.downEls.get(el)?.has(e.pointerId)) return;
      if (this.track(el, e.pointerId, false) === 0) this.keys.release(source);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  private bindPad() {
    const pad = this.pad;
    pad.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      if (this.padPointer !== null) return;
      this.padPointer = e.pointerId;
      try { pad.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      this.track(pad, e.pointerId, true);
      this.padMove(e.clientX, e.clientY);
    });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === this.padPointer) this.padMove(e.clientX, e.clientY); });
    const up = (e: PointerEvent) => { if (e.pointerId === this.padPointer) this.padEnd(); };
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    pad.addEventListener('lostpointercapture', up);
  }

  private padMove(clientX: number, clientY: number) {
    const r = this.pad.getBoundingClientRect();
    const half = Math.max(1, r.width / 2);
    const dx = (clientX - (r.left + r.width / 2)) / half;
    const dy = (clientY - (r.top + r.height / 2)) / half;
    const dist = Math.hypot(dx, dy);
    let dir = '';
    if (dist > 0.2) {
      const ux = dx / dist, uy = dy / dist;
      // Horizontal wins a wide band (±37°) so walking never drops into prone / climb by accident; then diagonals.
      if (uy < -0.6) dir += 'u'; else if (uy > 0.6) dir += 'd';
      if (ux < -0.38) dir += 'l'; else if (ux > 0.38) dir += 'r';
    }
    const k = Math.min(1, dist) / Math.max(dist, 1e-6);
    const logicalHalf = 64;
    this.knob.style.transform = `translate(${Math.round(dx * k * logicalHalf)}px, ${Math.round(dy * k * logicalHalf)}px)`;
    if (dir === this.padDir) return;
    this.padDir = dir;
    const acts: ActionId[] = [];
    if (dir.includes('u')) acts.push('up', 'interact');
    if (dir.includes('d')) acts.push('down');
    if (dir.includes('l')) acts.push('left');
    if (dir.includes('r')) acts.push('right');
    this.keys.set('pad', acts);
    for (const d of ['u', 'd', 'l', 'r']) toggleClass(this.pad, `ax-tc-${d}`, dir.includes(d));
  }

  private padEnd() {
    if (this.padPointer !== null) this.track(this.pad, this.padPointer, false);
    this.padPointer = null;
    this.padDir = '';
    this.keys.release('pad');
    this.knob.style.transform = '';
    for (const d of ['u', 'd', 'l', 'r']) toggleClass(this.pad, `ax-tc-${d}`, false);
  }

  /** Flip: next half of this page, else the next page (pressing the hotbar-page key). Empty halves are skipped. */
  private bindFlip() {
    const el = this.flipBtn;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      if (this.downEls.get(el)?.has(e.pointerId)) return;
      if (this.track(el, e.pointerId, true) !== 1) return;
      this.flip();
    });
    const up = (e: PointerEvent) => {
      if (!this.downEls.get(el)?.has(e.pointerId)) return;
      if (this.track(el, e.pointerId, false) === 0) this.keys.release('flip');
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  private flip() {
    const hb = this.ctx.s.progression.state.hotbar ?? [];
    const page = this.currentPage();
    const views = PAGES * HALVES.length;
    const cur = page * HALVES.length + this.half;
    let next = (cur + 1) % views;
    for (let step = 1; step < views; step++) {
      const v = (cur + step) % views;
      const pg = Math.floor(v / HALVES.length), hf = v % HALVES.length;
      if (HALVES[hf].some(i => hb[pg * HOTBAR_PAGE_SIZE + i])) { next = v; break; }
    }
    const nextPage = Math.floor(next / HALVES.length);
    for (let i = 0; i < 6; i++) this.keys.release(`slot${i}`);
    this.half = next % HALVES.length;
    if (nextPage !== page) {
      const steps = (nextPage - page + PAGES) % PAGES;
      if (steps === 1 && getBinding('hotbarPage')) this.keys.set('flip', ['hotbarPage']);
      else safe(() => this.ctx.s.game.setHotbarPage(nextPage), undefined);
    }
    this.ctx.sfx('ui_click');
    this.syncFlip(nextPage);
    for (const s of this.slots) s.sig = '';
  }

  private currentPage(): number {
    const p = safe(() => this.ctx.s.game.hotbarPage(), 0);
    return Number.isInteger(p) && p >= 0 && p < PAGES ? p : 0;
  }

  private syncFlip(page: number) {
    setText(this.flipNum, String(page + 1));
    this.flipPips.forEach((p, i) => toggleClass(p, 'ax-on', i === this.half));
  }

  /** Release every key and pointer (blur, tab hidden, rebinding, touch mode off, destroy). */
  private reset() {
    for (const el of this.downEls.keys()) {
      el.classList.remove('ax-down');
    }
    this.downEls.clear();
    this.padPointer = null;
    this.padDir = '';
    this.knob.style.transform = '';
    for (const d of ['u', 'd', 'l', 'r']) this.pad.classList.remove(`ax-tc-${d}`);
    this.keys.releaseAll();
  }

  // ─────────────────────────── frame ───────────────────────────

  private displayedItem(id: string): string {
    const p = this.ctx.s.progression;
    if (p.countItem(id) > 0) return id;
    // Same strongest-first fallback as the HUD hotbar / useItem.
    const kinds = [['white_potion', 'orange_potion', 'red_potion'], ['mana_elixir', 'blue_potion']];
    return kinds.find(kind => kind.includes(id))
      ?.find(c => p.countItem(c) > 0 && Registry.item(c)?.consumable) ?? id;
  }

  frame() {
    if (!this.shown) return;
    const s = this.ctx.s;
    const p = s.progression;
    const hb = p.state.hotbar ?? [];
    const page = this.currentPage();
    if (page !== this.page) { this.page = page; this.syncFlip(page); for (const sl of this.slots) sl.sig = ''; }
    const base = page * HOTBAR_PAGE_SIZE;
    const mp = p.state.mp;
    for (let i = 0; i < 6; i++) {
      const sl = this.slots[i];
      const abs = base + HALVES[this.half][i];
      const entry = hb[abs] ?? null;
      const isItem = !!entry && entry.startsWith('item:');
      const shown = isItem ? this.displayedItem(entry!.slice(5)) : '';
      const sig = `${abs}|${entry ?? ''}|${shown}|${entry && !isItem ? p.state.skills[entry] ?? 0 : ''}`;
      if (sig !== sl.sig) {
        sl.sig = sig;
        sl.el.setAttribute('data-hotbar-slot', String(abs));
        sl.lastCd = '';
        sl.cd.style.background = '';
        sl.cdText.textContent = '';
        sl.badge.textContent = '';
        sl.mpCost = 0;
        toggleClass(sl.el, 'ax-empty', !entry);
        toggleClass(sl.el, 'ax-item', isItem);
        toggleClass(sl.el, 'ax-dim', false);
        if (!entry) sl.icon.replaceChildren();
        else if (isItem) {
          const def = Registry.item(shown);
          sl.icon.replaceChildren(iconEl(def?.icon, 64, def?.name ?? shown));
          toggleClass(sl.el, 'ax-potion-fallback', shown !== entry.slice(5));
        } else {
          const def = Registry.skill(entry);
          sl.icon.replaceChildren(iconEl(def?.icon, 64, def?.name ?? entry));
          const lv = p.state.skills[entry] ?? 0;
          sl.mpCost = def && lv > 0 ? safe(() => def.mpCost(lv), 0) : 0;
          sl.badge.textContent = sl.mpCost > 0 ? String(sl.mpCost) : '';
          sl.badge.className = 'ax-tc-slot-badge ax-mp';
          toggleClass(sl.el, 'ax-potion-fallback', false);
        }
      }
      if (!entry) continue;
      if (isItem) {
        const qty = safe(() => p.countItem(shown), 0);
        setText(sl.badge, String(qty));
        sl.badge.className = 'ax-tc-slot-badge ax-qty';
        toggleClass(sl.el, 'ax-dim', qty <= 0);
        continue;
      }
      const rem = safe(() => s.skills.getCooldownRemaining(entry), 0);
      const tot = safe(() => s.skills.getCooldownTotal(entry), 0);
      let cdKey = '';
      if (rem > 0 && tot > 0) {
        const pct = Math.max(0, Math.min(100, (rem / tot) * 100));
        cdKey = pct.toFixed(0);
        if (cdKey !== sl.lastCd) sl.cd.style.background = `conic-gradient(rgba(8,10,28,0.72) ${pct}%, rgba(8,10,28,0) ${pct}%)`;
        setText(sl.cdText, rem >= 1000 ? String(Math.ceil(rem / 1000)) : (rem / 1000).toFixed(1));
      }
      if (cdKey !== sl.lastCd) {
        if (!cdKey) { sl.cd.style.background = ''; sl.cdText.textContent = ''; }
        sl.lastCd = cdKey;
      }
      toggleClass(sl.el, 'ax-dim', sl.mpCost > 0 && mp < sl.mpCost);
    }
  }

  /** Cast / fail feedback, mirroring the HUD hotbar. */
  flash(skillId: string, fail = false) {
    if (!this.shown) return;
    const hb = this.ctx.s.progression.state.hotbar ?? [];
    const base = this.currentPage() * HOTBAR_PAGE_SIZE;
    this.slots.forEach((sl, i) => {
      if (hb[base + HALVES[this.half][i]] !== skillId) return;
      const cls = fail ? 'ax-shake' : 'ax-flash';
      sl.el.classList.remove(cls); void sl.el.offsetWidth; sl.el.classList.add(cls);
    });
  }

  destroy() {
    this.reset();
    for (const u of this.unsubs.splice(0)) { try { u(); } catch { /* ignore */ } }
    window.removeEventListener('blur', this.releaseAll);
    window.removeEventListener('pagehide', this.releaseAll);
    window.removeEventListener('orientationchange', this.releaseAll);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.el.remove();
  }
}
