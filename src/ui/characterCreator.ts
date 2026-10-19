/**
 * "Design your mage" — the character-creation step of New Game (after the name, before Begin).
 * A big animated preview of the Year 1 Apprentice in the chosen colours, three rows of swatches (Skin, Hair, Accent),
 * Randomize, and a strip of the same student in each School's Year 2 robes so players see the look carries over.
 * Pure DOM; the title menu owns it and forwards keys / update ticks.
 */
import type { Appearance, JobId } from '../core/types';
import { APPEARANCE_OPTIONS, DEFAULT_APPEARANCE, randomAppearance } from '../data/appearance';
import { jobPreviewDataUrl, playerAnimFrameCount, type PlayerAnim } from '../art/characters';
import { h, safe } from './dom';

type Row = keyof Appearance;
const ROWS: { key: Row; label: string }[] = [
  { key: 'skin', label: 'Skin' },
  { key: 'hair', label: 'Hair' },
  { key: 'accent', label: 'Accent' },
];
/** Preview modes: ms per frame matches the in-game anims; cast is one-shot, so it rests a few ticks before looping. */
const MODES: { anim: PlayerAnim; label: string; ms: number; hold: number }[] = [
  { anim: 'idle', label: 'Idle', ms: 125, hold: 0 },
  { anim: 'walk', label: 'Walk', ms: 71, hold: 0 },
  { anim: 'cast', label: 'Cast', ms: 64, hold: 8 },
];
/** Year 2 job of each School, in School order. */
const SCHOOL_JOBS: { job: JobId; school: string }[] = [
  { job: 'pyromancer', school: 'Fire' },
  { job: 'cryomancer', school: 'Ice' },
  { job: 'stormcaller', school: 'Lightning' },
  { job: 'cleric', school: 'Holy' },
  { job: 'occultist', school: 'Shadow' },
];

const hex = (n: number) => `#${(n >>> 0).toString(16).padStart(6, '0').slice(-6)}`;


export interface CreatorOpts {
  name: string;
  initial?: Appearance | null;
  onBegin: (a: Appearance) => void;
  onBack: (a: Appearance) => void;
  sfx?: (k: 'ui_click' | 'ui_error') => void;
}

export class CharacterCreator {
  readonly el: HTMLElement;
  private a: Appearance;
  /** Keyboard row: 0-2 swatch rows, 3 = action buttons. */
  private row = 0;
  private btnIdx = 0;
  private mode = 0;
  private frame = 0;
  private tick = 0;
  private lastAt = 0;
  private preview: HTMLImageElement;
  private body: HTMLElement;

  constructor(private opts: CreatorOpts) {
    this.a = { ...(opts.initial ?? DEFAULT_APPEARANCE) };
    this.preview = h('img', { class: 'ax-cc-sprite', alt: `${opts.name}'s preview`, draggable: false });
    this.body = h('div', { class: 'ax-cc-body' });
    this.el = h('div', { class: 'ax-cs-frame ax-cc ax-cs-enter' },
      h('div', { class: 'ax-cs-head' },
        h('div', { class: 'ax-title-h' }, 'Design your mage'),
        h('div', { class: 'ax-cs-sub' }, `${opts.name} · Year 1 Apprentice`)),
      this.body);
    this.render();
  }

  get appearance(): Appearance { return { ...this.a }; }

  private sfx(k: 'ui_click' | 'ui_error') { try { this.opts.sfx?.(k); } catch { /* ignore */ } }

  private set(key: Row, v: number) {
    if (this.a[key] === v) return;
    this.a = { ...this.a, [key]: v };
    this.sfx('ui_click');
    this.render();
  }

  private randomize() {
    let next = randomAppearance();
    for (let n = 0; n < 4 && next.skin === this.a.skin && next.hair === this.a.hair && next.accent === this.a.accent; n++) next = randomAppearance();
    this.a = next;
    this.sfx('ui_click');
    this.render();
  }

  private setMode(i: number) { this.mode = i; this.frame = 0; this.tick = 0; this.sfx('ui_click'); this.render(); }

  private frameUrl(frame: number): string {
    const anim = MODES[this.mode].anim;
    return safe(() => jobPreviewDataUrl('apprentice', 1, this.a, anim, frame), '');
  }

  private render() {
    const kbd = (r: number) => (this.row === r ? ' ax-kbd-row' : '');
    const stage = h('div', { class: 'ax-cc-stage' },
      h('div', { class: 'ax-cc-pedestal' }), this.preview,
      h('div', { class: 'ax-cc-modes', role: 'radiogroup', 'aria-label': 'Preview animation' },
        MODES.map((m, i) => h('button', {
          class: `ax-btn ax-btn-small ax-cc-mode${i === this.mode ? ' ax-on' : ' ax-btn-secondary'}`, role: 'radio',
          'aria-checked': String(i === this.mode), onclick: () => this.setMode(i),
        }, m.label))));
    this.preview.src = this.frameUrl(this.frame);

    const rows = h('div', { class: 'ax-cc-rows' },
      ROWS.map((r, ri) => h('div', { class: `ax-cc-row${kbd(ri)}` },
        h('div', { class: 'ax-cc-label' }, r.label),
        h('div', { class: 'ax-cc-swatches', role: 'radiogroup', 'aria-label': r.label },
          (APPEARANCE_OPTIONS[r.key] as readonly number[]).map((c, ci) => {
            const on = this.a[r.key] === c;
            return h('button', {
              class: `ax-cc-sw${on ? ' ax-on' : ''}`, role: 'radio', 'aria-checked': String(on),
              'aria-label': `${r.label} ${ci + 1}`, style: `--ax-sw: ${hex(c)}`,
              onclick: () => { this.row = ri; this.set(r.key, c); },
            });
          })))),
      h('div', { class: 'ax-cc-schools' },
        h('div', { class: 'ax-cc-label' }, 'Year 2 robes'),
        h('div', { class: 'ax-cc-school-row' },
          SCHOOL_JOBS.map(s => h('div', { class: 'ax-cc-school' },
            h('img', { class: 'ax-cc-mini', alt: '', draggable: false,
              src: safe(() => jobPreviewDataUrl(s.job, 1, this.a), '') }),
            h('span', null, s.school))))));

    const btns: { label: string; cls: string; run: () => void }[] = [
      { label: 'Begin', cls: 'ax-begin-btn', run: () => this.opts.onBegin(this.appearance) },
      { label: 'Randomize', cls: 'ax-btn-secondary', run: () => this.randomize() },
      { label: 'Back', cls: 'ax-btn-secondary', run: () => { this.sfx('ui_click'); this.opts.onBack(this.appearance); } },
    ];
    const bar = h('div', { class: 'ax-cs-bar ax-cc-bar' },
      btns.map((b, i) => h('button', {
        class: `ax-btn ax-btn-large ${b.cls}${this.row === 3 && this.btnIdx === i ? ' ax-kbd' : ''}`, onclick: () => b.run(),
      }, b.label)));

    this.body.replaceChildren(h('div', { class: 'ax-cc-main' }, stage, rows), bar);
  }

  /** Keyboard: ↑↓ choose a row, ←→ change its colour (or button), Enter begins (or presses the button), R randomizes. */
  key(e: KeyboardEvent): void {
    const k = e.code;
    const opts = this.row < 3 ? (APPEARANCE_OPTIONS[ROWS[this.row].key] as readonly number[]) : null;
    if (k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault();
      this.row = (this.row + (k === 'ArrowUp' ? -1 : 1) + 4) % 4;
      this.sfx('ui_click');
      this.render();
    } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      const d = k === 'ArrowLeft' ? -1 : 1;
      if (opts) {
        const key = ROWS[this.row].key;
        const i = Math.max(0, opts.indexOf(this.a[key]));
        this.set(key, opts[(i + d + opts.length) % opts.length]);
      } else { this.btnIdx = (this.btnIdx + d + 3) % 3; this.sfx('ui_click'); this.render(); }
    } else if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') {
      e.preventDefault();
      if (this.row === 3) (this.body.querySelectorAll<HTMLButtonElement>('.ax-cc-bar button')[this.btnIdx])?.click();
      else this.opts.onBegin(this.appearance);
    } else if (k === 'KeyR') { e.preventDefault(); this.randomize(); }
    else if (k === 'Tab') { e.preventDefault(); this.setMode((this.mode + 1) % MODES.length); }
    else if (k === 'Escape') { e.preventDefault(); this.sfx('ui_click'); this.opts.onBack(this.appearance); }
  }

  /** Steps the preview animation (call every frame). */
  update(time: number): void {
    const m = MODES[this.mode];
    if (time - this.lastAt < m.ms) return;
    this.lastAt = time;
    const frames = Math.max(1, safe(() => playerAnimFrameCount(m.anim), 1));
    this.tick = (this.tick + 1) % (frames + m.hold);
    const f = Math.min(this.tick, frames - 1);
    if (f === this.frame) return;
    this.frame = f;
    const url = this.frameUrl(f);
    if (url) this.preview.src = url;
  }
}
