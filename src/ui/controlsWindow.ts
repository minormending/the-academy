/**
 * Controls window (P7b): keyboard rebinding + gamepad map. Opened from the Esc menu and from Help.
 * Click a row → "Press a key…" capture (Esc cancels). While capturing, gameplay input is blocked and every key
 * event is swallowed in the capture phase so neither Phaser nor UIRoot sees it.
 */
import {
  ACTIONS, actionLabel, eventKeyCode, getBinding, getBindings, isBindableKey, keyLabel, onBindingsChanged, resetBindings,
  setBinding, type ActionGroup, type ActionId,
} from '../core/bindings';
import { GAMEPAD_EVENT_FLAG, GAMEPAD_MAP, connectedGamepad } from '../systems/GamepadBridge';
import type { UICtx } from './context';
import { h, safe } from './dom';
import { UIWindow, tabStrip } from './window';

type Tab = 'keyboard' | 'gamepad';

export class ControlsWindow extends UIWindow {
  private tab: Tab = 'keyboard';
  private capturing: ActionId | null = null;
  private msg = '';
  private msgBad = false;
  private padSig = '';
  private padTimer = 0;
  private restoreBlocked = false;
  private listening = false;
  private offBindings: () => void;

  private readonly onKey = (e: KeyboardEvent) => this.handleKey(e);

  constructor(ctx: UICtx) {
    super(ctx, 'controls', 'Controls', { width: 620, x: 330, y: 70, className: 'ax-controls-win' });
    this.offBindings = onBindingsChanged(() => this.redraw());
  }

  protected signature() {
    return JSON.stringify([this.tab, this.capturing, this.msg, this.msgBad, getBindings(), this.padSig]);
  }

  protected onOpen() {
    this.msg = '';
    this.padSig = this.padState();
    if (!this.listening) { window.addEventListener('keydown', this.onKey, true); window.addEventListener('keyup', this.onKey, true); this.listening = true; }
    window.clearInterval(this.padTimer);
    this.padTimer = window.setInterval(() => this.pollPad(), 500);
    this.redraw();
  }

  setTab(t: Tab) { if (t !== this.tab) { this.endCapture(); this.tab = t; this.msg = ''; this.redraw(); } }

  /**
   * This window is not in UIRoot's per-frame list (UIRoot is outside P7b's scope), so it re-renders itself
   * whenever its state changes.
   */
  private redraw() {
    this.invalidate();
    if (this.isOpen) this.tick(performance.now(), 0);
  }

  protected onClose() {
    this.endCapture();
    this.unlisten();
  }

  destroy() {
    this.endCapture();
    this.unlisten();
    try { this.offBindings(); } catch { /* ignore */ }
    super.destroy();
  }

  private unlisten() {
    window.clearInterval(this.padTimer);
    this.padTimer = 0;
    if (!this.listening) return;
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKey, true);
    this.listening = false;
  }

  private pollPad() {
    const sig = this.padState();
    if (sig !== this.padSig) { this.padSig = sig; this.redraw(); }
  }

  private padState(): string { return connectedGamepad()?.id ?? ''; }

  /** Is this the top-most visible window (so Esc belongs to it)? */
  private isTopmost(): boolean {
    let maxZ = -Infinity;
    for (const el of Array.from(this.ctx.root.querySelectorAll<HTMLElement>('.ax-window'))) {
      if (el.style.display === 'none') continue;
      maxZ = Math.max(maxZ, Number(el.style.zIndex) || 0);
    }
    return this.z >= maxZ;
  }

  // ─────────────────────────── capture ───────────────────────────

  private startCapture(action: ActionId) {
    if (!this.capturing) {
      this.restoreBlocked = safe(() => this.ctx.s.game.isInputBlocked(), false);
      try { this.ctx.s.game.setInputBlocked(true); } catch { /* ignore */ }
    }
    this.capturing = action;
    this.msg = '';
    this.ctx.sfx('ui_click');
    this.redraw();
  }

  private endCapture() {
    if (!this.capturing) return;
    this.capturing = null;
    try { this.ctx.s.game.setInputBlocked(this.restoreBlocked); } catch { /* ignore */ }
    this.redraw();
  }

  /** True when this window owns `e` (capturing, or Esc while on top) — UIRoot skips such events. */
  claims(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;
    if (this.capturing) return true;
    return (e.code === 'Escape' || e.keyCode === 27) && this.isTopmost();
  }

  private handleKey(e: KeyboardEvent) {
    if (!this.isOpen) return;
    const isEsc = e.code === 'Escape' || e.keyCode === 27;
    if (!this.capturing) {
      // Not capturing: only claim Esc (close this window) when it is on top.
      if (isEsc && e.type === 'keydown' && this.isTopmost()) {
        e.preventDefault(); e.stopImmediatePropagation();
        this.close();
      }
      return;
    }
    // Capturing: nothing else (Phaser, UIRoot, browser shortcuts) may see the key.
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type !== 'keydown' || e.repeat) return;
    if ((e as unknown as Record<string, unknown>)[GAMEPAD_EVENT_FLAG]) return; // pad presses can't be bound
    const action = this.capturing;
    if (isEsc) { this.msg = 'Cancelled.'; this.msgBad = false; this.endCapture(); return; }
    const code = eventKeyCode(e);
    if (!isBindableKey(code)) { this.msg = `${keyLabel(code)} can't be bound.`; this.msgBad = true; this.ctx.sfx('ui_error'); this.redraw(); return; }
    const r = setBinding(action, code);
    if (!r.ok) { this.msg = 'That key can\'t be bound.'; this.msgBad = true; this.ctx.sfx('ui_error'); }
    else {
      this.msgBad = false;
      this.msg = `${actionLabel(action)} → ${keyLabel(code)}.`
        + (r.swapped ? ` Swapped: ${actionLabel(r.swapped)} → ${keyLabel(getBinding(r.swapped))}.` : '')
        + (r.unbound ? ` ${actionLabel(r.unbound)} is now unbound.` : '');
      this.ctx.sfx('ui_click');
    }
    this.endCapture();
    this.redraw();
  }

  // ─────────────────────────── render ───────────────────────────

  protected render() {
    const tabs = tabStrip<Tab>([{ id: 'keyboard', label: 'Keyboard' }, { id: 'gamepad', label: 'Gamepad' }], this.tab, (t) => {
      this.ctx.sfx('ui_click'); this.setTab(t);
    });
    this.body.replaceChildren(tabs, this.tab === 'keyboard' ? this.renderKeyboard() : this.renderGamepad());
  }

  private renderKeyboard(): HTMLElement {
    const group = (g: ActionGroup) => h('div', { class: 'ax-ctl-group' },
      h('div', { class: 'ax-help-head' }, g),
      ACTIONS.filter(a => a.group === g).map(a => {
        const cap = this.capturing === a.id;
        const code = getBinding(a.id);
        return h('button', {
          class: `ax-ctl-row${cap ? ' ax-capturing' : ''}${code ? '' : ' ax-unbound'}`,
          title: cap ? 'Press a key (Esc cancels)' : 'Click to rebind',
          'data-action': a.id,
          onclick: () => { if (cap) { this.msg = 'Cancelled.'; this.msgBad = false; this.endCapture(); } else this.startCapture(a.id); },
        }, h('span', { class: 'ax-ctl-label' }, a.label), cap ? h('span', { class: 'ax-ctl-wait' }, 'Press a key…') : h('kbd', null, keyLabel(code)));
      }));
    const hint = this.capturing
      ? `Press a key for "${actionLabel(this.capturing)}" — Esc cancels.`
      : 'Click an action, then press its new key. A key already in use swaps with it. Esc always opens the menu.';
    return h('div', null,
      h('div', { class: 'ax-ctl-cols' },
        h('div', null, group('Movement'), group('Actions')),
        h('div', null, group('Hotbar')),
        h('div', null, group('Windows'))),
      h('div', { class: `ax-ctl-msg${this.msgBad ? ' ax-bad' : ''}` }, this.msg || hint),
      h('div', { class: 'ax-row ax-center' },
        h('button', {
          class: 'ax-btn ax-btn-secondary', onclick: () => {
            this.endCapture(); this.msg = 'All keys reset to defaults.'; this.msgBad = false; resetBindings(); this.ctx.sfx('ui_click'); this.redraw();
          },
        }, 'Reset to defaults'),
        h('button', { class: 'ax-btn', onclick: () => this.close() }, 'Done')));
  }

  private renderGamepad(): HTMLElement {
    const pad = connectedGamepad();
    const status = h('div', { class: `ax-pad-status${pad ? ' ax-on' : ''}` },
      h('span', { class: 'ax-pad-dot' }),
      pad ? `Connected: ${pad.id}` : 'No gamepad connected — plug one in and press any button.');
    const rows = GAMEPAD_MAP.map(m => h('div', { class: 'ax-pad-row' },
      h('span', { class: 'ax-pad-input' }, m.input),
      h('span', { class: 'ax-pad-acts' }, m.actions.map(a => h('span', { class: 'ax-pad-act' },
        actionLabel(a), ' ', h('kbd', null, keyLabel(getBinding(a))))))));
    const half = Math.ceil(rows.length / 2);
    return h('div', null, status,
      h('div', { class: 'ax-pad-cols' }, h('div', null, rows.slice(0, half)), h('div', null, rows.slice(half))),
      h('div', { class: 'ax-ctl-msg' }, 'Standard-layout controllers (Xbox, PlayStation, Switch Pro). Pad buttons press the actions above, so they follow your keyboard bindings.'),
      h('div', { class: 'ax-row ax-center' }, h('button', { class: 'ax-btn', onclick: () => this.close() }, 'Done')));
  }
}

// One Controls window per UI context, created on first use (Esc menu / Help own its lifetime).
const instances = new Map<UICtx, ControlsWindow>();

/**
 * For UIRoot's keydown listener: true when an open Controls window owns this key event. Real key events reach
 * the window's capture-phase listener first, but events dispatched directly on `window` (GamepadBridge) run
 * at-target listeners in registration order, so UIRoot must also ask.
 */
export function controlsClaimKey(e: KeyboardEvent): boolean {
  for (const w of instances.values()) if (w.claims(e)) return true;
  return false;
}

export function openControls(ctx: UICtx, tab?: Tab) {
  let w = instances.get(ctx);
  if (!w) { w = new ControlsWindow(ctx); instances.set(ctx, w); }
  w.open();
  if (tab) w.setTab(tab);
}

export function destroyControls(ctx: UICtx) {
  const w = instances.get(ctx);
  if (!w) return;
  instances.delete(ctx);
  w.destroy();
}
