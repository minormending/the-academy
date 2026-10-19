/** Esc menu, controls help, Year-end Exam (job advancement) chooser. */
import { GAME_WIDTH, SCENES } from '../core/constants';
import type { JobDef, JobId } from '../core/types';
import { Registry } from '../core/registry';
import type { UICtx } from './context';
import { h, loadJson, safe, saveJson } from './dom';
import { BRANCH_COLORS, BRANCH_NAMES, examinerName, schoolName } from './info';
import { portraitEl } from './uiIcons';
import { UIWindow } from './window';

const VOL_KEY = 'arcana-ui-volumes';

/** Re-apply volumes the player chose last session (no-op if none saved). */
export function applySavedVolumes(audio: { setVolumes(s: number, m: number): void } | null | undefined) {
  const v = loadJson<{ sfx?: number; music?: number } | null>(VOL_KEY, null);
  if (!audio || !v || typeof v.sfx !== 'number' || typeof v.music !== 'number') return;
  try { audio.setVolumes(Math.max(0, Math.min(1, v.sfx)), Math.max(0, Math.min(1, v.music))); } catch { /* ignore */ }
}

// ───────────────────────────── Esc menu ─────────────────────────────

export class MenuWindow extends UIWindow {
  private confirmQuit = false;
  constructor(ctx: UICtx) {
    super(ctx, 'menu', 'Menu', { width: 300, x: 490, y: 170, className: 'ax-menu-win' });
  }

  protected onOpen() { this.confirmQuit = false; this.invalidate(); }
  /** Only re-render on explicit changes (keeps sliders stable while dragging). */
  protected signature() { return String(this.confirmQuit); }

  protected render() {
    const a = this.ctx.s.audio;
    const vols = safe(() => a.getVolumes(), { sfx: 0.7, music: 0.4 });
    const slider = (label: string, which: 'sfx' | 'music') => {
      const val = h('span', { class: 'ax-slider-val' }, `${Math.round(vols[which] * 100)}%`);
      const input = h('input', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(vols[which] * 100)), class: 'ax-slider' });
      input.addEventListener('input', () => {
        const cur = safe(() => a.getVolumes(), vols);
        const v = Number(input.value) / 100;
        const next = which === 'sfx' ? { sfx: v, music: cur.music } : { sfx: cur.sfx, music: v };
        try { a.setVolumes(next.sfx, next.music); } catch { /* ignore */ }
        saveJson(VOL_KEY, next);
        val.textContent = `${Math.round(v * 100)}%`;
      });
      input.addEventListener('change', () => { if (which === 'sfx') this.ctx.sfx('ui_click'); input.blur(); });
      input.addEventListener('pointerup', () => input.blur());
      return h('label', { class: 'ax-slider-row' }, h('span', null, label), input, val);
    };
    const btn = (label: string, fn: () => void, cls = '') => h('button', { class: `ax-btn ax-menu-btn ${cls}`, onclick: () => { this.ctx.sfx('ui_click'); fn(); } }, label);
    const quit = this.confirmQuit
      ? h('div', { class: 'ax-confirm' }, h('div', null, 'Return to the title screen? Your progress will be saved.'),
        h('div', { class: 'ax-row' }, btn('Quit', () => this.quit(), 'ax-btn-danger'), btn('Cancel', () => { this.confirmQuit = false; this.invalidate(); }, 'ax-btn-secondary')))
      : btn('Quit to Title', () => { this.confirmQuit = true; this.invalidate(); }, 'ax-btn-secondary');
    this.body.replaceChildren(
      btn('Resume', () => this.close()),
      btn('Controls', () => { this.close(); this.ctx.openWindow('help'); }, 'ax-btn-secondary'),
      h('div', { class: 'ax-panel ax-settings' }, h('div', { class: 'ax-panel-head' }, 'Sound'), slider('Effects', 'sfx'), slider('Music', 'music')),
      btn('Save Game', () => {
        try { this.ctx.s.progression.save(); this.ctx.log('Game saved.', '#9fe8a8'); } catch { this.ctx.log('Saving failed.', '#ff9b9b'); }
      }, 'ax-btn-secondary'),
      quit);
  }

  private quit() {
    try { this.ctx.s.progression.save(); } catch { /* ignore */ }
    try { this.ctx.s.scene.scene.start(SCENES.TITLE); } catch (e) { console.warn('[ui] quit failed', e); }
  }
}

// ───────────────────────────── Help ─────────────────────────────

export class HelpWindow extends UIWindow {
  constructor(ctx: UICtx) {
    super(ctx, 'help', 'How to Play', { width: 520, x: 380, y: 150, className: 'ax-help-win' });
  }
  protected signature() { return 'static'; }
  protected render() {
    const row = (keys: string[], what: string) => h('div', { class: 'ax-help-row' },
      h('div', { class: 'ax-help-keys' }, keys.map(k => h('kbd', null, k))), h('div', null, what));
    const jobs = safe(() => Registry.jobs(), [] as JobDef[]);
    const schools = jobs.filter(j => j.tier === 2).map(j => BRANCH_NAMES[j.branch] ?? j.name);
    const list = schools.length > 1 ? `${schools.slice(0, -1).join(', ')} or ${schools[schools.length - 1]}` : 'a School';
    const lv2 = jobs.find(j => j.tier === 2)?.requiredLevel ?? 10;
    this.body.replaceChildren(
      h('div', { class: 'ax-help-intro' }, `Welcome to The Academy! Every student here is a mage. Study the core curriculum as a Year 1 Apprentice, then pass your Year-end Exam at level ${lv2} and declare your School: ${list}.`),
      h('div', { class: 'ax-help-cols' },
        h('div', null,
          h('div', { class: 'ax-help-head' }, 'Movement'),
          row(['←', '→'], 'Walk'),
          row(['Space', 'Alt'], 'Jump'),
          row(['↓', '+ Jump'], 'Drop through a platform'),
          row(['↑', '↓'], 'Climb ropes & ladders'),
          row(['↑'], 'Enter portal / talk to NPC'),
          row(['Z'], 'Pick up items (hold)'),
          h('div', { class: 'ax-help-head' }, 'Combat'),
          row(['Q', 'W', 'E', 'R', 'T'], 'Hotbar slots'),
          row(['A', 'S', 'D', 'F', 'G'], 'Hotbar slots'),
          row(['1', '2'], 'Potions (by default)')),
        h('div', null,
          h('div', { class: 'ax-help-head' }, 'Windows'),
          row(['K'], 'Spellbook — spend SP'),
          row(['I'], 'Inventory'),
          row(['P'], 'Character — spend AP'),
          row(['J'], 'Assignments'),
          row(['M'], 'Minimap'),
          row(['H'], 'This help'),
          row(['Esc'], 'Close window / menu'),
          h('div', { class: 'ax-help-head' }, 'Tips'),
          h('div', { class: 'ax-help-tip' }, 'Drag spells from your Spellbook (or potions from your Inventory) onto the hotbar. Right-click a slot to clear it.'),
          h('div', { class: 'ax-help-tip' }, 'Hold a skill key to keep casting.'))),
      h('div', { class: 'ax-row ax-center' }, h('button', { class: 'ax-btn', onclick: () => this.close() }, 'Got it!')));
  }
}

// ───────────────────────────── Job advancement ─────────────────────────────

export class JobsWindow extends UIWindow {
  constructor(ctx: UICtx) {
    super(ctx, 'jobs', 'Year-end Exam', { width: 560, x: 360, y: 120, className: 'ax-jobs-win' });
  }

  protected signature(): string {
    const p = this.ctx.s.progression;
    return JSON.stringify([p.state.job, p.state.level, safe(() => p.availableAdvancements(), [])]);
  }

  protected render() {
    const p = this.ctx.s.progression;
    const st = p.state;
    const avail = safe(() => p.availableAdvancements(), [] as JobId[]);
    const cur = safe(() => p.jobDef(), null);
    const cards = h('div', { class: 'ax-job-cards' });
    const declaring = (cur?.tier ?? 1) === 1;
    // Five Schools to choose from in Year 1 → widen the window so every card fits on one row.
    const winW = avail.length > 3 ? Math.min(940, 40 + avail.length * 180) : 560;
    this.el.style.width = `${winW}px`;
    const left = parseFloat(this.el.style.left) || 0;
    if (left + winW > GAME_WIDTH) this.el.style.left = `${Math.max(0, GAME_WIDTH - winW - 8)}px`;
    this.setTitle(declaring && avail.length ? 'Year-end Exam — Declare your School' : 'Year-end Exam');
    for (const id of avail) {
      const j = safe(() => Registry.job(id), undefined as JobDef | undefined);
      if (!j) continue;
      const color = BRANCH_COLORS[j.branch] ?? '#c9b8ff';
      cards.appendChild(h('div', { class: 'ax-job-card', style: `--accent:${color}` },
        portraitEl(j.look, 72, j.name),
        h('div', { class: 'ax-job-name' }, j.name),
        h('div', { class: 'ax-job-branch' }, `${schoolName(j.branch)} · Year ${j.tier}`),
        h('div', { class: 'ax-job-desc' }, j.description || ''),
        h('button', {
          class: 'ax-btn', onclick: () => {
            if (safe(() => p.advanceJob(id), false)) { this.close(); }
            else { this.ctx.sfx('ui_error'); this.ctx.log('You cannot advance right now.', '#ff9b9b'); }
          },
        }, j.tier === 2 ? `Declare ${BRANCH_NAMES[j.branch] ?? j.name}` : j.tier === 4 ? `Graduate as ${j.name}` : `Begin Year ${j.tier}`)));
    }
    if (!cards.childElementCount) {
      const next = cur ? safe(() => Registry.jobs(), [] as JobDef[]).filter(j => j.parent === cur.id) : [];
      const lvl = next.length ? Math.min(...next.map(j => j.requiredLevel)) : 0;
      cards.appendChild(h('div', { class: 'ax-empty-note' },
        next.length ? (st.level < lvl ? `Your Year-end Exam opens at level ${lvl}. Keep studying!` : `Speak with ${examinerName(next[0])} on campus to sit your exam.`)
          : 'You have graduated — the Academy has nothing left to teach you. (For now.)'));
    }
    this.body.replaceChildren(
      h('div', { class: 'ax-help-intro' }, !cur ? '' : declaring
        ? `Year 1 is over, ${st.name}. Declare the School you will study for the rest of your time at the Academy — this choice is permanent.`
        : `You are a Year ${cur.tier} ${cur.name}. Pass this exam to begin your next Year.`),
      cards);
  }
}
