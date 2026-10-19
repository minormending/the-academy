/** "Change look" window: re-pick skin / hair / accent after character creation (opened from the Character window). */
import { APPEARANCE_OPTIONS, DEFAULT_APPEARANCE } from '../data/appearance';
import type { Appearance } from '../core/types';
import { jobPreviewDataUrl } from '../art/characters';
import type { UICtx } from './context';
import { h, safe } from './dom';
import { UIWindow } from './window';

const ROWS: { key: keyof Appearance; label: string }[] = [
  { key: 'skin', label: 'Skin' }, { key: 'hair', label: 'Hair' }, { key: 'accent', label: 'Accent' },
];
const hex = (n: number) => `#${(n >>> 0).toString(16).padStart(6, '0').slice(-6)}`;

export class AppearanceEditor extends UIWindow {
  private a: Appearance = { ...DEFAULT_APPEARANCE };
  constructor(ctx: UICtx) {
    super(ctx, 'appearance', 'Change look', { width: 420, x: 460, y: 90, className: 'ax-appearance-win', persist: false });
  }

  protected onOpen() {
    this.a = { ...DEFAULT_APPEARANCE, ...(this.ctx.s.progression.state.appearance ?? {}) };
    this.invalidate();
  }

  private set(key: keyof Appearance, v: number) {
    this.a = { ...this.a, [key]: v };
    this.ctx.sfx('ui_click');
    this.invalidate();
  }

  protected render() {
    const job = this.ctx.s.progression.state.job;
    const preview = h('img', {
      class: 'ax-cc-preview', alt: 'Preview', draggable: false,
      style: 'display:block;margin:0 auto;image-rendering:pixelated;',
      src: safe(() => jobPreviewDataUrl(job, 3, this.a), ''),
    });
    const rows = ROWS.map(r => h('div', { class: 'ax-cc-row' },
      h('div', { class: 'ax-cc-label' }, r.label),
      h('div', { class: 'ax-cc-swatches', role: 'radiogroup', 'aria-label': r.label },
        (APPEARANCE_OPTIONS[r.key] as readonly number[]).map((c, ci) => {
          const on = this.a[r.key] === c;
          return h('button', {
            class: `ax-cc-sw${on ? ' ax-on' : ''}`, role: 'radio', 'aria-checked': String(on),
            'aria-label': `${r.label} ${ci + 1}`, style: `--ax-sw: ${hex(c)}`,
            onclick: () => this.set(r.key, c),
          });
        }))));
    const bar = h('div', { class: 'ax-win-footer', style: 'display:flex;gap:8px;justify-content:center;' },
      h('button', { class: 'ax-btn', onclick: () => this.save() }, 'Save'),
      h('button', { class: 'ax-btn ax-btn-secondary', onclick: () => { this.ctx.sfx('ui_close'); this.close(); } }, 'Cancel'));
    this.body.replaceChildren(h('div', { class: 'ax-panel', style: 'display:flex;flex-direction:column;gap:8px;' }, preview, rows), bar);
  }

  private save() {
    const p = this.ctx.s.progression;
    p.state.appearance = { ...this.a };
    safe(() => p.save(), false);
    safe(() => this.ctx.s.player.setJob(p.state.job), undefined);
    this.ctx.sfx('ui_click');
    this.close();
  }
}
