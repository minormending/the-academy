/**
 * DOM menu for the title screen: logo, Continue, Character Select (6 save slots, MapleStory-style),
 * New Game (name entry into a chosen slot), per-slot Delete with confirmation.
 */
import './ui.css';
import Phaser from 'phaser';
import type { JobId, PlayerState } from '../core/types';
import {
  SAVE_SLOTS, deleteSlot, firstEmptySlot, getActiveSlot, lastPlayedSlot, listSlots, loadSlot, newPlayerState,
  setActiveSlot, writeSave, type SlotSummary,
} from '../systems/SaveSystem';
import type { School } from '../data/jobs';
import { getBinding, keyLabel, type ActionId } from '../core/bindings';
import { ensurePlayerTexture, jobPreviewDataUrl, playerAnimKey, playerTextureKey } from '../art/characters';
import { getAudio } from '../systems/AudioSystem';
import { append, h, isTextInput, safe } from './dom';
import { UIScaler, uiRootEl } from './scaler';
import { forgetCreditsSeen } from './creditsRoll';
import { consumeReturnToSelect, markNewCharacter, markReturnToSelect } from './session';

type View = 'main' | 'select' | 'new' | 'confirm';
/** What the confirm modal is asking. */
type Confirm = { kind: 'delete' | 'replace'; slot: number };

// Start loading the bundled pixel fonts right away so BootScene's document.fonts.ready waits for them
// (Phaser name tags / damage numbers rasterise text into canvases and need the real font).
try {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  void fonts?.load('16px "Kenney Pixel"').catch(() => undefined);
  void fonts?.load('16px "Kenney Mini"').catch(() => undefined);
} catch { /* FontFaceSet unavailable */ }

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _'-]*[A-Za-z0-9]$/;
const COLS = 3;
const ANIM_MS = 125; // idle anim plays at 8 fps

/** Card accent per School (Year 1 students wear the Academy's own indigo). */
const SCHOOL_COLOR: Record<School | 'none', string> = {
  fire: '#e8603c', ice: '#7fd8ff', lightning: '#f4d84a', holy: '#f6e7a8', shadow: '#a676ff', none: '#8fa0ff',
};

export function validateName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 2) return 'Name must be at least 2 characters.';
  if (name.length > 12) return 'Name must be at most 12 characters.';
  if (!NAME_RE.test(name)) return 'Use letters, numbers, spaces, - _ or \'.';
  return null;
}

function fmtPlayTime(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60000);
  if (m < 1) return '<1m';
  const hr = Math.floor(m / 60);
  return hr ? `${hr}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

function fmtAgo(at: number): string {
  if (!at) return '';
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  try { return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return ''; }
}

const jobLine = (s: SlotSummary) => `Lv ${s.level} · Year ${s.year} · ${s.jobName}`;

export class TitleMenu {
  private root: HTMLElement;
  private scaler: UIScaler;
  private el: HTMLElement;
  private panel: HTMLElement;
  private cs: HTMLElement;
  private foot: HTMLElement;
  private view: View = 'main';
  private slots: SlotSummary[] = [];
  private starting = false;
  private nameDraft = '';
  private error = '';
  /** Highlighted main-menu button (keyboard). */
  private mainIdx = 0;
  /** Selected Character Select card. */
  private sel = 0;
  /** 'replace': every slot is full and the player is choosing whom New Game should overwrite. */
  private selectMode: 'browse' | 'replace' = 'browse';
  private confirm: Confirm | null = null;
  /** 0 = Cancel (default, so a stray Enter never deletes), 1 = confirm. */
  private confirmIdx = 0;
  /** Name entry target. */
  private newSlot = 0;
  private newReplace = false;
  private newFrom: 'main' | 'select' = 'main';
  /** Idle-anim frames (data URLs) per job, cut from the in-game player sheets. */
  private frames = new Map<JobId, string[]>();
  private animAt = 0;
  private animFrame = 0;
  private csEnter = false;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);
  private readonly onFocusIn = () => this.syncCapture();
  private readonly onFocusOut = () => setTimeout(() => this.syncCapture(), 0);

  constructor(private scene: Phaser.Scene, private onStart: (state: PlayerState) => void) {
    this.root = uiRootEl();
    this.scaler = new UIScaler(this.root, scene.game);
    this.panel = h('div', { class: 'ax-title-panel' });
    this.cs = h('div', { class: 'ax-cs' });
    this.foot = h('div', { class: 'ax-title-foot' });
    // Logo and menu panel share one flow column so they can never overlap (whatever font loads).
    this.el = h('div', { class: 'ax-title' },
      h('div', { class: 'ax-title-col' },
        h('div', { class: 'ax-logo' },
          h('div', { class: 'ax-logo-orn' }),
          h('div', { class: 'ax-logo-the' }, 'The'),
          h('div', { class: 'ax-logo-text' }, 'Academy'),
          h('div', { class: 'ax-logo-sub' }, 'Every student is a mage')),
        this.panel),
      this.cs,
      this.foot);
    this.el.addEventListener('mousedown', (e) => { if ((e.target as Element | null)?.closest?.('button, .ax-cs-card')) e.preventDefault(); });
    this.root.appendChild(this.el);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('focusin', this.onFocusIn);
    document.addEventListener('focusout', this.onFocusOut);
    this.refresh();
    // Coming back from the game (Quit to Title): straight to Character Select on the slot just played.
    if (consumeReturnToSelect() && this.anySaves()) {
      this.sel = safe(() => getActiveSlot(), 0);
      this.view = 'select';
    } else {
      this.sel = this.continueSlot() ?? 0;
    }
    this.render();
  }

  // ─────────────────────────── data ───────────────────────────

  private refresh() {
    this.slots = safe(() => listSlots(), []);
    while (this.slots.length < SAVE_SLOTS) {
      const i = this.slots.length;
      this.slots.push({ index: i, status: 'empty', last: false, name: '', level: 0, job: 'apprentice', jobName: '', year: 1,
        school: null, schoolName: '', mapId: '', mapName: '', playTimeMs: 0, savedAt: 0 });
    }
  }

  private anySaves() { return this.slots.some(s => s.status !== 'empty'); }
  private okCount() { return this.slots.filter(s => s.status === 'ok').length; }

  /** Slot Continue loads: last played, else the most recently saved readable slot. */
  private continueSlot(): number | null {
    const last = safe(() => lastPlayedSlot(), null);
    if (last !== null && this.slots[last]?.status === 'ok') return last;
    let best: SlotSummary | null = null;
    for (const s of this.slots) if (s.status === 'ok' && (!best || s.savedAt > best.savedAt)) best = s;
    return best ? best.index : null;
  }

  private emptySlot(): number | null { return safe(() => firstEmptySlot(), null); }

  private framesFor(job: JobId): string[] {
    const hit = this.frames.get(job);
    if (hit) return hit;
    let out: string[] = [];
    try {
      const key = playerTextureKey(job);
      if (!this.scene.textures.exists(key)) ensurePlayerTexture(this.scene, job);
      const anim = this.scene.anims.get(playerAnimKey(job, 'idle'));
      if (anim && this.scene.textures.exists(key)) {
        out = anim.frames.map(f => safe(() => this.scene.textures.getBase64(key, f.frame.name) as string, '')).filter(Boolean);
      }
    } catch (e) { console.warn('[title] portrait frames failed', e); }
    if (!out.length) { const still = safe(() => jobPreviewDataUrl(job, 1), ''); if (still) out = [still]; }
    this.frames.set(job, out);
    return out;
  }

  private sfx(k: 'ui_click' | 'ui_open' | 'ui_close' | 'ui_error') { try { getAudio().play(k); } catch { /* ignore */ } }

  private setView(v: View) {
    this.view = v;
    this.error = '';
    if (v !== 'confirm') this.confirm = null;
    if (v === 'main') { this.selectMode = 'browse'; this.mainIdx = 0; }
    this.render();
  }

  // ─────────────────────────── render ───────────────────────────

  private render() {
    const csOn = this.view === 'select' || this.view === 'confirm';
    // Only play the panel's entrance animation when the select screen opens, not on every re-render.
    this.csEnter = csOn && !this.el.classList.contains('ax-cs-on');
    this.el.classList.toggle('ax-cs-on', csOn);
    if (csOn) { this.panel.replaceChildren(); this.renderSelect(); } else { this.cs.replaceChildren(); this.renderPanel(); }
    this.foot.textContent = csOn
      ? (this.view === 'confirm' ? '← → choose · Enter confirm · Esc cancel' : 'Arrows choose · Enter play · N new · Del delete · Esc back')
      : this.playHint();
  }

  /** Main-menu footer: key names follow the player's live bindings. */
  private playHint(): string {
    const k = (a: ActionId) => keyLabel(getBinding(a));
    return `${['left', 'right'].map(a => k(a as ActionId)).join(' ')} move · ${k('jump')} jumps · ${(['slot0', 'slot1', 'slot2', 'slot3', 'slot4'] as ActionId[]).map(k).join(' ')} cast · ${k('help')} for help`;
  }

  private mainButtons(): { label: string; sub: string; primary: boolean; disabled?: boolean; run: () => void }[] {
    const out: { label: string; sub: string; primary: boolean; disabled?: boolean; run: () => void }[] = [];
    if (this.anySaves()) {
      const ci = this.continueSlot();
      const c = ci !== null ? this.slots[ci] : null;
      out.push({ label: 'Continue', primary: true, disabled: !c, run: () => this.continue(),
        sub: c ? `${c.name} · Lv ${c.level} ${c.jobName}` : 'Save data could not be read' });
      out.push({ label: 'Character Select', primary: false, run: () => this.openSelect('browse'),
        sub: `${this.okCount()} of ${SAVE_SLOTS} students enrolled` });
    }
    const full = this.emptySlot() === null;
    out.push({ label: 'New Game', primary: !this.anySaves(), run: () => this.newGame('main'),
      sub: full ? 'All slots full · replace a student' : 'Enrol as a Year 1 Apprentice' });
    return out;
  }

  private renderPanel() {
    const p = this.panel;
    p.replaceChildren();
    if (this.view === 'main') {
      const btns = this.mainButtons();
      this.mainIdx = Math.max(0, Math.min(btns.length - 1, this.mainIdx));
      btns.forEach((b, i) => p.appendChild(h('button', {
        class: `ax-title-btn${b.primary ? ' ax-primary' : ''}${i === this.mainIdx ? ' ax-kbd' : ''}`, disabled: !!b.disabled,
        onclick: () => { this.mainIdx = i; b.run(); },
      }, h('span', { class: 'ax-tb-label' }, b.label), h('span', { class: 'ax-tb-sub' }, b.sub))));
      return;
    }
    // Name entry
    const input = h('input', {
      class: 'ax-input', type: 'text', maxLength: 12, placeholder: 'Your mage\'s name', value: this.nameDraft,
      autocomplete: 'off',
    });
    input.spellcheck = false;
    const err = h('div', { class: 'ax-title-error' }, this.error);
    const counter = h('span', { class: 'ax-counter' }, `${this.nameDraft.trim().length}/12`);
    input.addEventListener('input', () => {
      this.nameDraft = input.value;
      counter.textContent = `${input.value.trim().length}/12`;
      if (this.error) { this.error = ''; err.textContent = ''; }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.begin(); }
      else if (e.key === 'Escape') { e.preventDefault(); input.blur(); this.backFromNew(); }
      e.stopPropagation();
    });
    const old = this.slots[this.newSlot];
    append(p, [
      h('div', { class: 'ax-title-h' }, 'Name your student'),
      h('div', { class: 'ax-title-text ax-cs-slotnote' }, `Enrolling in slot ${this.newSlot + 1} of ${SAVE_SLOTS}`),
      h('div', { class: 'ax-input-wrap' }, input, counter),
      err,
      this.newReplace && old && old.status !== 'empty'
        ? h('div', { class: 'ax-title-warn' }, old.status === 'ok' ? `This will replace ${old.name} (Lv ${old.level}).` : 'This will replace the damaged save.')
        : null,
      h('div', { class: 'ax-row' },
        h('button', { class: 'ax-btn ax-btn-large ax-begin-btn', onclick: () => this.begin() }, 'Begin'),
        h('button', { class: 'ax-btn ax-btn-secondary ax-btn-large', onclick: () => { this.sfx('ui_click'); this.backFromNew(); } }, 'Back'))]);
    setTimeout(() => { if (this.view === 'new' && input.isConnected) input.focus(); }, 30);
  }

  private renderSelect() {
    const replace = this.selectMode === 'replace';
    const cur = this.slots[this.sel];
    const head = h('div', { class: 'ax-cs-head' },
      h('div', { class: 'ax-title-h' }, replace ? 'All slots are full' : 'Character Select'),
      h('div', { class: 'ax-cs-sub' }, replace
        ? 'Choose a student to replace with your new one'
        : `${this.okCount()} of ${SAVE_SLOTS} students enrolled at the Academy`));
    const grid = h('div', { class: 'ax-cs-grid' }, this.slots.map(s => this.card(s)));

    const playLabel = !cur || cur.status === 'empty' ? 'Enrol' : replace ? 'Replace' : 'Play';
    const bar = h('div', { class: 'ax-cs-bar' },
      h('button', { class: 'ax-btn ax-btn-large ax-cs-play', disabled: !cur || cur.status === 'damaged' && !replace,
        onclick: () => this.activate(this.sel) }, playLabel),
      replace ? null : h('button', { class: 'ax-btn ax-btn-secondary ax-btn-large', onclick: () => this.newGame('select') }, 'New student'),
      replace ? null : h('button', { class: 'ax-btn ax-btn-danger ax-btn-large', disabled: !cur || cur.status === 'empty',
        onclick: () => this.askDelete(this.sel) }, 'Delete'),
      h('button', { class: 'ax-btn ax-btn-secondary ax-btn-large', onclick: () => { this.sfx('ui_click'); this.setView('main'); } }, 'Back'));

    this.cs.replaceChildren(h('div', { class: `ax-cs-frame${this.csEnter ? ' ax-cs-enter' : ''}` }, head, grid, bar));
    if (this.view === 'confirm' && this.confirm) this.cs.appendChild(this.confirmModal(this.confirm));
    this.animFrame = 0;
    this.animAt = 0;
  }

  private card(s: SlotSummary): HTMLElement {
    const selected = s.index === this.sel;
    const cls = `ax-cs-card ax-cs-${s.status}${selected ? ' ax-sel' : ''}`;
    const no = h('span', { class: 'ax-cs-no' }, String(s.index + 1));
    const onclick = () => this.clickCard(s.index);
    const ondblclick = () => { if (s.status !== 'empty') this.activate(s.index); };

    if (s.status === 'empty') {
      return h('div', { class: cls, role: 'button', 'aria-label': `Slot ${s.index + 1}: empty`, onclick },
        h('div', { class: 'ax-cs-top' }, no, h('span', { class: 'ax-cs-school' }, 'Empty slot')),
        h('div', { class: 'ax-cs-plus' }, '+'),
        h('div', { class: 'ax-cs-enrol' }, 'Enrol a new student'));
    }
    if (s.status === 'damaged') {
      return h('div', { class: cls, role: 'button', 'aria-label': `Slot ${s.index + 1}: damaged save`, onclick, ondblclick },
        h('div', { class: 'ax-cs-top' }, no, h('span', { class: 'ax-cs-school' }, 'Unreadable')),
        h('div', { class: 'ax-cs-broken' }, h('div', { class: 'ax-cs-crack' }, '!')),
        h('div', { class: 'ax-cs-name' }, 'Damaged save'),
        h('div', { class: 'ax-cs-line' }, s.error || 'This slot could not be read'),
        h('div', { class: 'ax-cs-meta' },
          h('div', null, s.previous ? `Was ${s.previous.name} · Lv ${s.previous.level}` : 'Delete it to free the slot')));
    }
    const color = SCHOOL_COLOR[s.school ?? 'none'];
    const frames = this.framesFor(s.job);
    const sprite = h('img', { class: 'ax-cs-sprite', alt: '', draggable: false, src: frames[0] ?? '' });
    const ago = fmtAgo(s.savedAt);
    return h('div', { class: cls, role: 'button', 'aria-label': `Slot ${s.index + 1}: ${s.name}, ${jobLine(s)}`, style: `--ax-school: ${color}`, onclick, ondblclick },
      h('div', { class: 'ax-cs-top' }, no,
        h('span', { class: 'ax-cs-school' }, s.school ? `School of ${s.schoolName}` : s.schoolName),
        s.last ? h('span', { class: 'ax-cs-last' }, 'Last') : null),
      h('div', { class: 'ax-cs-stage' }, h('div', { class: 'ax-cs-pedestal' }), sprite),
      h('div', { class: 'ax-cs-name' }, s.name),
      h('div', { class: 'ax-cs-line' }, jobLine(s)),
      h('div', { class: 'ax-cs-meta' },
        h('div', { class: 'ax-cs-map' }, s.mapName || '—'),
        h('div', null, `${fmtPlayTime(s.playTimeMs)} played${ago ? ` · ${ago}` : ''}`)));
  }

  private confirmModal(c: Confirm): HTMLElement {
    const s = this.slots[c.slot];
    const who = s?.status === 'ok' ? `${s.name} (Lv ${s.level} ${s.jobName})` : 'the damaged save';
    const title = c.kind === 'delete' ? (s?.status === 'ok' ? `Withdraw ${s.name}?` : 'Delete damaged save?') : `Replace ${s?.status === 'ok' ? s.name : 'this slot'}?`;
    const text = c.kind === 'delete'
      ? `Slot ${c.slot + 1}: ${who} will be deleted forever.`
      : `Slot ${c.slot + 1}: ${who} will be deleted when your new student begins.`;
    const btnCls = (i: number, base: string) => `ax-btn ax-btn-large ${base}${this.confirmIdx === i ? ' ax-kbd' : ''}`;
    return h('div', { class: 'ax-cs-modal', onclick: (e: Event) => { if (e.target === e.currentTarget) this.cancelConfirm(); } },
      h('div', { class: 'ax-cs-dialog' },
        h('div', { class: 'ax-title-h' }, title),
        h('div', { class: 'ax-title-text' }, text),
        h('div', { class: 'ax-row' },
          h('button', { class: btnCls(1, 'ax-btn-danger'), onclick: () => this.doConfirm() }, c.kind === 'delete' ? 'Delete' : 'Replace'),
          h('button', { class: btnCls(0, 'ax-btn-secondary'), onclick: () => this.cancelConfirm() }, 'Cancel'))));
  }

  // ─────────────────────────── actions ───────────────────────────

  private openSelect(mode: 'browse' | 'replace') {
    this.sfx('ui_open');
    this.refresh();
    this.selectMode = mode;
    if (mode === 'replace') {
      // Prefer a damaged slot, else the least recently played student.
      const dmg = this.slots.find(s => s.status === 'damaged');
      const oldest = [...this.slots].filter(s => s.status === 'ok').sort((a, b) => a.savedAt - b.savedAt)[0];
      this.sel = (dmg ?? oldest ?? this.slots[0]).index;
    } else if (this.slots[this.sel]?.status === 'empty') {
      this.sel = this.continueSlot() ?? this.sel;
    }
    this.setView('select');
  }

  private clickCard(i: number) {
    const s = this.slots[i];
    if (!s) return;
    if (s.status === 'empty' && this.selectMode === 'browse') { this.sel = i; this.startNew(i, false, 'select'); return; }
    if (this.sel === i) { this.activate(i); return; }
    this.sfx('ui_click');
    this.sel = i;
    this.render();
  }

  private activate(i: number) {
    const s = this.slots[i];
    if (!s) return;
    if (this.selectMode === 'replace') {
      if (s.status === 'empty') { this.startNew(i, false, 'select'); return; }
      this.sfx('ui_open');
      this.confirm = { kind: 'replace', slot: i };
      this.confirmIdx = 0;
      this.setView('confirm');
      return;
    }
    if (s.status === 'empty') { this.startNew(i, false, 'select'); return; }
    if (s.status === 'damaged') { this.sfx('ui_error'); this.askDelete(i); return; }
    this.play(i);
  }

  private askDelete(i: number) {
    const s = this.slots[i];
    if (!s || s.status === 'empty') { this.sfx('ui_error'); return; }
    this.sfx('ui_open');
    this.confirm = { kind: 'delete', slot: i };
    this.confirmIdx = 0;
    this.setView('confirm');
  }

  private cancelConfirm() { this.sfx('ui_click'); this.confirm = null; this.setView('select'); }

  private doConfirm() {
    const c = this.confirm;
    if (!c) return;
    if (c.kind === 'delete') {
      try { deleteSlot(c.slot); forgetCreditsSeen(c.slot); } catch (e) { console.warn('[title] delete failed', e); }
      this.sfx('ui_close');
      this.refresh();
      this.confirm = null;
      if (!this.anySaves()) { this.setView('main'); return; }
      this.setView('select');
    } else {
      this.confirm = null;
      this.startNew(c.slot, true, 'select');
    }
  }

  /** New Game from the main menu or the select bar: first empty slot, or pick one to replace. */
  private newGame(from: 'main' | 'select') {
    this.refresh();
    const empty = this.emptySlot();
    if (empty === null) { this.openSelect('replace'); return; }
    this.startNew(empty, false, from);
  }

  private startNew(slot: number, replace: boolean, from: 'main' | 'select') {
    this.sfx('ui_click');
    this.newSlot = slot;
    this.newReplace = replace;
    this.newFrom = from;
    this.setView('new');
  }

  private backFromNew() {
    if (this.newFrom === 'select' && this.anySaves()) { this.sel = this.newSlot; this.setView('select'); } else this.setView('main');
  }

  private continue() {
    const i = this.continueSlot();
    if (i === null) { this.sfx('ui_error'); this.refresh(); this.render(); return; }
    this.play(i);
  }

  private play(i: number) {
    if (this.starting) return;
    const s = safe(() => loadSlot(i), null);
    if (!s) { this.sfx('ui_error'); this.refresh(); this.render(); return; }
    setActiveSlot(i);
    this.go(s);
  }

  private begin() {
    if (this.starting) return;
    const err = validateName(this.nameDraft);
    if (err) {
      this.error = err;
      this.sfx('ui_error');
      const e = this.panel.querySelector('.ax-title-error');
      if (e) { e.textContent = err; e.classList.remove('ax-shake'); void (e as HTMLElement).offsetWidth; e.classList.add('ax-shake'); }
      return;
    }
    // The target was empty when chosen; if something has since been written there, never overwrite silently.
    let slot = this.newSlot;
    this.refresh();
    if (!this.newReplace && this.slots[slot]?.status !== 'empty') {
      const alt = this.emptySlot();
      if (alt === null) { this.openSelect('replace'); return; }
      slot = alt;
    }
    const name = this.nameDraft.trim().replace(/\s+/g, ' ');
    let state: PlayerState;
    try { state = newPlayerState(name); } catch (e) { console.error('[title] newPlayerState failed', e); this.sfx('ui_error'); return; }
    if (this.newReplace) { try { deleteSlot(slot); } catch { /* ignore */ } }
    forgetCreditsSeen(slot); // a fresh character must not inherit a stale 'seen the credits' flag
    setActiveSlot(slot);
    try { writeSave(state); } catch { /* the game saves again on its first map load */ }
    markNewCharacter();
    this.go(state);
  }

  private go(state: PlayerState) {
    this.starting = true;
    this.sfx('ui_click');
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.el.classList.add('ax-leaving');
    markReturnToSelect();
    this.onStart(state);
  }

  // ─────────────────────────── input ───────────────────────────

  private key(e: KeyboardEvent) {
    if (this.starting || isTextInput(document.activeElement)) return;
    const k = e.code;
    if (this.view === 'main') {
      const btns = this.mainButtons();
      if (k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault();
        const d = k === 'ArrowUp' ? -1 : 1;
        let i = this.mainIdx;
        for (let n = 0; n < btns.length; n++) { i = (i + d + btns.length) % btns.length; if (!btns[i].disabled) break; }
        this.mainIdx = i;
        this.sfx('ui_click');
        this.render();
      } else if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') {
        e.preventDefault();
        const b = btns[this.mainIdx];
        if (b && !b.disabled) b.run(); else this.sfx('ui_error');
      }
      return;
    }
    if (this.view === 'new') { if (k === 'Escape') { e.preventDefault(); this.backFromNew(); } return; }
    if (this.view === 'confirm') {
      e.preventDefault();
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Tab') { this.confirmIdx = 1 - this.confirmIdx; this.sfx('ui_click'); this.render(); }
      else if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { if (this.confirmIdx === 1) this.doConfirm(); else this.cancelConfirm(); }
      else if (k === 'Escape') this.cancelConfirm();
      return;
    }
    // select
    const move = (d: number) => {
      e.preventDefault();
      this.sel = (this.sel + d + SAVE_SLOTS) % SAVE_SLOTS;
      this.sfx('ui_click');
      this.render();
    };
    if (k === 'ArrowLeft') move(-1);
    else if (k === 'ArrowRight') move(1);
    else if (k === 'ArrowUp') move(-COLS);
    else if (k === 'ArrowDown') move(COLS);
    else if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); this.activate(this.sel); }
    else if ((k === 'Delete' || k === 'Backspace' || k === 'KeyX') && this.selectMode === 'browse') { e.preventDefault(); this.askDelete(this.sel); }
    else if (k === 'KeyN' && this.selectMode === 'browse') { e.preventDefault(); this.newGame('select'); }
    else if (k === 'Escape') { e.preventDefault(); this.sfx('ui_click'); this.setView('main'); }
  }

  /** Disable Phaser keyboard capture while a text field is focused. */
  private syncCapture() {
    const kb = this.scene.input?.keyboard;
    if (!kb) return;
    try { if (isTextInput(document.activeElement)) kb.disableGlobalCapture(); else kb.enableGlobalCapture(); } catch { /* ignore */ }
  }

  update(time: number) {
    this.scaler.check(time);
    // Animate the selected student's idle loop (stepped, 8 fps).
    if (this.view !== 'select' && this.view !== 'confirm') return;
    if (time - this.animAt < ANIM_MS) return;
    this.animAt = time;
    const s = this.slots[this.sel];
    if (!s || s.status !== 'ok') return;
    const frames = this.framesFor(s.job);
    if (frames.length < 2) return;
    this.animFrame = (this.animFrame + 1) % frames.length;
    const img = this.cs.querySelector<HTMLImageElement>('.ax-cs-card.ax-sel .ax-cs-sprite');
    if (img) img.src = frames[this.animFrame];
  }

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('focusin', this.onFocusIn);
    document.removeEventListener('focusout', this.onFocusOut);
    try { this.scene.input?.keyboard?.enableGlobalCapture(); } catch { /* ignore */ }
    this.scaler.destroy();
    this.el.remove();
  }
}
