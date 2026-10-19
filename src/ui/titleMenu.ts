/** DOM menu for the title screen: logo, Continue, New Game (name entry), Delete Save. */
import './ui.css';
import Phaser from 'phaser';
import type { PlayerState } from '../core/types';
import { Registry } from '../core/registry';
import { deleteSave, hasSave, loadSave, newPlayerState } from '../systems/SaveSystem';
import { getAudio } from '../systems/AudioSystem';
import { append, h, isTextInput, safe } from './dom';
import { UIScaler, uiRootEl } from './scaler';
import { markNewCharacter } from './session';

type View = 'main' | 'new' | 'delete';

// Start loading the bundled pixel fonts right away so BootScene's document.fonts.ready waits for them
// (Phaser name tags / damage numbers rasterise text into canvases and need the real font).
try {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  void fonts?.load('16px "Kenney Pixel"').catch(() => undefined);
  void fonts?.load('16px "Kenney Mini"').catch(() => undefined);
} catch { /* FontFaceSet unavailable */ }

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _'-]*[A-Za-z0-9]$/;

export function validateName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 2) return 'Name must be at least 2 characters.';
  if (name.length > 12) return 'Name must be at most 12 characters.';
  if (!NAME_RE.test(name)) return 'Use letters, numbers, spaces, - _ or \'.';
  return null;
}

export class TitleMenu {
  private root: HTMLElement;
  private scaler: UIScaler;
  private el: HTMLElement;
  private panel: HTMLElement;
  private view: View = 'main';
  private save: PlayerState | null = null;
  private saveExists = false;
  private starting = false;
  private nameDraft = '';
  private error = '';
  /** Second-click confirmation before New Game overwrites an existing save. */
  private confirmOverwrite = false;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);
  private readonly onFocusIn = () => this.syncCapture();
  private readonly onFocusOut = () => setTimeout(() => this.syncCapture(), 0);

  constructor(private scene: Phaser.Scene, private onStart: (state: PlayerState) => void) {
    this.root = uiRootEl();
    this.scaler = new UIScaler(this.root, scene.game);
    this.panel = h('div', { class: 'ax-title-panel' });
    // Logo and menu panel share one flow column so they can never overlap (whatever font loads).
    this.el = h('div', { class: 'ax-title' },
      h('div', { class: 'ax-title-col' },
        h('div', { class: 'ax-logo' },
          h('div', { class: 'ax-logo-orn' }),
          h('div', { class: 'ax-logo-the' }, 'The'),
          h('div', { class: 'ax-logo-text' }, 'Academy'),
          h('div', { class: 'ax-logo-sub' }, 'Every student is a mage')),
        this.panel),
      h('div', { class: 'ax-title-foot' }, 'Arrows move · Space jumps · Q W E R T cast · H for help'));
    this.el.addEventListener('mousedown', (e) => { if ((e.target as Element | null)?.closest?.('button')) e.preventDefault(); });
    this.root.appendChild(this.el);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('focusin', this.onFocusIn);
    document.addEventListener('focusout', this.onFocusOut);
    this.refreshSave();
    this.render();
  }

  private refreshSave() {
    this.saveExists = safe(() => hasSave(), false);
    this.save = this.saveExists ? safe(() => loadSave(), null) : null;
  }

  private sfx(k: 'ui_click' | 'ui_open' | 'ui_close' | 'ui_error') { try { getAudio().play(k); } catch { /* ignore */ } }

  private setView(v: View) { this.view = v; this.error = ''; this.confirmOverwrite = false; this.render(); }

  private render() {
    const p = this.panel;
    p.replaceChildren();
    if (this.view === 'main') {
      const s = this.save;
      if (this.saveExists) {
        const jd = s ? safe(() => Registry.job(s.job), undefined) : undefined;
        const job = s ? (jd?.name || s.job) + (jd ? ` · Year ${jd.tier}` : '') : '';
        p.appendChild(h('button', { class: 'ax-title-btn ax-primary', onclick: () => this.continue(), disabled: !s },
          h('span', { class: 'ax-tb-label' }, 'Continue'),
          s ? h('span', { class: 'ax-tb-sub' }, `${s.name} · Lv ${s.level} ${job}`) : h('span', { class: 'ax-tb-sub' }, 'Save data could not be read')));
      }
      p.appendChild(h('button', { class: `ax-title-btn${this.saveExists ? '' : ' ax-primary'}`, onclick: () => { this.sfx('ui_click'); this.setView('new'); } },
        h('span', { class: 'ax-tb-label' }, 'New Game'), h('span', { class: 'ax-tb-sub' }, 'Enrol as a Year 1 Apprentice')));
      if (this.saveExists) {
        p.appendChild(h('button', { class: 'ax-title-link', onclick: () => { this.sfx('ui_click'); this.setView('delete'); } }, 'Delete save'));
      }
    } else if (this.view === 'new') {
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
        if (this.confirmOverwrite) { this.confirmOverwrite = false; this.syncBeginBtn(); }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this.begin(); }
        else if (e.key === 'Escape') { e.preventDefault(); input.blur(); this.setView('main'); }
        e.stopPropagation();
      });
      append(p, [
        h('div', { class: 'ax-title-h' }, 'Name your student'),
        h('div', { class: 'ax-input-wrap' }, input, counter),
        err,
        this.saveExists && this.save ? h('div', { class: 'ax-title-warn' }, `This will replace ${this.save.name} (Lv ${this.save.level}).`) : null,
        h('div', { class: 'ax-row' },
          h('button', { class: 'ax-btn ax-btn-large ax-begin-btn', onclick: () => this.begin() }, 'Begin'),
          h('button', { class: 'ax-btn ax-btn-secondary ax-btn-large', onclick: () => { this.sfx('ui_click'); this.setView('main'); } }, 'Back'))]);
      setTimeout(() => { if (this.view === 'new' && input.isConnected) input.focus(); }, 30);
    } else {
      const s = this.save;
      p.append(
        h('div', { class: 'ax-title-h' }, 'Delete save?'),
        h('div', { class: 'ax-title-text' }, s ? `${s.name} (Lv ${s.level}) will be lost forever.` : 'Your saved game will be lost forever.'),
        h('div', { class: 'ax-row' },
          h('button', {
            class: 'ax-btn ax-btn-danger ax-btn-large', onclick: () => {
              try { deleteSave(); } catch { /* ignore */ }
              this.sfx('ui_close');
              this.refreshSave();
              this.setView('main');
            },
          }, 'Delete'),
          h('button', { class: 'ax-btn ax-btn-secondary ax-btn-large', onclick: () => { this.sfx('ui_click'); this.setView('main'); } }, 'Cancel')));
    }
  }

  /** Swap the Begin button between normal and "Overwrite <name>?" confirmation. */
  private syncBeginBtn() {
    const btn = this.panel.querySelector<HTMLButtonElement>('.ax-begin-btn');
    if (!btn) return;
    const s = this.save;
    btn.textContent = this.confirmOverwrite ? (s ? `Overwrite ${s.name} Lv ${s.level}?` : 'Overwrite save?') : 'Begin';
    btn.classList.toggle('ax-btn-danger', this.confirmOverwrite);
    if (this.confirmOverwrite) { btn.classList.remove('ax-shake'); void btn.offsetWidth; btn.classList.add('ax-shake'); }
  }

  private continue() {
    if (this.starting) return;
    const s = safe(() => loadSave(), null);
    if (!s) { this.sfx('ui_error'); this.refreshSave(); this.render(); return; }
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
    // An existing save would be replaced: require a second Begin (click or Enter) to confirm.
    if (safe(() => hasSave(), false) && !this.confirmOverwrite) {
      this.confirmOverwrite = true;
      this.sfx('ui_error');
      this.syncBeginBtn();
      return;
    }
    const name = this.nameDraft.trim().replace(/\s+/g, ' ');
    let state: PlayerState;
    try { state = newPlayerState(name); } catch (e) { console.error('[title] newPlayerState failed', e); this.sfx('ui_error'); return; }
    markNewCharacter();
    this.go(state);
  }

  private go(state: PlayerState) {
    this.starting = true;
    this.sfx('ui_click');
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.el.classList.add('ax-leaving');
    this.onStart(state);
  }

  private key(e: KeyboardEvent) {
    if (isTextInput(document.activeElement)) return;
    if (this.view === 'main' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      if (this.saveExists && this.save) this.continue(); else this.setView('new');
    } else if (e.code === 'Escape' && this.view !== 'main') this.setView('main');
  }

  /** Disable Phaser keyboard capture while a text field is focused. */
  private syncCapture() {
    const kb = this.scene.input?.keyboard;
    if (!kb) return;
    try { if (isTextInput(document.activeElement)) kb.disableGlobalCapture(); else kb.enableGlobalCapture(); } catch { /* ignore */ }
  }

  update(time: number) { this.scaler.check(time); }

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('focusin', this.onFocusIn);
    document.removeEventListener('focusout', this.onFocusOut);
    try { this.scene.input?.keyboard?.enableGlobalCapture(); } catch { /* ignore */ }
    this.scaler.destroy();
    this.el.remove();
  }
}
