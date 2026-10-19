/** Esc menu (Game + Settings tabs), controls help, Year-end Exam (job advancement) chooser. */
import { GAME_WIDTH, SCENES } from '../core/constants';
import type { JobDef, JobId } from '../core/types';
import { Registry } from '../core/registry';
import type { UICtx } from './context';
import { h, loadJson, safe, saveJson } from './dom';
import { BRANCH_COLORS, BRANCH_NAMES, examinerName, schoolName } from './info';
import { portraitEl } from './uiIcons';
import { GRADUATION_QUEST_ID } from '../data/storyQuests';
import { UIWindow, tabStrip } from './window';
import { SLOT_ACTIONS, getBinding, getBindings, keyLabel, onBindingsChanged, type ActionId } from '../core/bindings';
import { getSettings, onSettingsChanged, setSetting, type Settings } from '../core/settings';
import { destroyControls, openControls } from './controlsWindow';

const VOL_KEY = 'arcana-ui-volumes';

/** Re-apply volumes the player chose last session (no-op if none saved). */
export function applySavedVolumes(audio: { setVolumes(s: number, m: number): void } | null | undefined) {
  const v = loadJson<{ sfx?: number; music?: number } | null>(VOL_KEY, null);
  if (!audio || !v || typeof v.sfx !== 'number' || typeof v.music !== 'number') return;
  try { audio.setVolumes(Math.max(0, Math.min(1, v.sfx)), Math.max(0, Math.min(1, v.music))); } catch { /* ignore */ }
}

// ───────────────────────────── Esc menu ─────────────────────────────

type MenuTab = 'game' | 'settings';

export class MenuWindow extends UIWindow {
  private confirmQuit = false;
  private tab: MenuTab = 'game';
  private offSettings: () => void;
  constructor(ctx: UICtx) {
    super(ctx, 'menu', 'Menu', { width: 320, x: 480, y: 150, className: 'ax-menu-win' });
    this.offSettings = onSettingsChanged(() => this.invalidate());
  }

  protected onOpen() { this.confirmQuit = false; this.invalidate(); }
  /** Only re-render on explicit changes (keeps sliders stable while dragging). */
  protected signature() { return JSON.stringify([this.confirmQuit, this.tab, getSettings()]); }

  destroy() {
    try { this.offSettings(); } catch { /* ignore */ }
    destroyControls(this.ctx);
    super.destroy();
  }

  protected render() {
    const tabs = tabStrip<MenuTab>([{ id: 'game', label: 'Game' }, { id: 'settings', label: 'Settings' }], this.tab, (t) => {
      this.tab = t; this.confirmQuit = false; this.ctx.sfx('ui_click'); this.invalidate();
    });
    this.body.replaceChildren(tabs, ...(this.tab === 'game' ? this.renderGame() : this.renderSettings()));
  }

  private btn(label: string, fn: () => void, cls = '') {
    return h('button', { class: `ax-btn ax-menu-btn ${cls}`, onclick: () => { this.ctx.sfx('ui_click'); fn(); } }, label);
  }

  private renderGame(): HTMLElement[] {
    const btn = this.btn.bind(this);
    const quit = this.confirmQuit
      ? h('div', { class: 'ax-confirm' }, h('div', null, 'Return to the title screen? Your progress will be saved.'),
        h('div', { class: 'ax-row' }, btn('Quit', () => this.quit(), 'ax-btn-danger'), btn('Cancel', () => { this.confirmQuit = false; this.invalidate(); }, 'ax-btn-secondary')))
      : btn('Quit to Title', () => { this.confirmQuit = true; this.invalidate(); }, 'ax-btn-secondary');
    return [
      btn('Resume', () => this.close()),
      btn('Controls', () => { this.close(); openControls(this.ctx, 'keyboard'); }, 'ax-btn-secondary'),
      btn('Settings', () => { this.tab = 'settings'; this.invalidate(); }, 'ax-btn-secondary'),
      btn('How to Play', () => { this.close(); this.ctx.openWindow('help'); }, 'ax-btn-secondary'),
      btn('Save Game', () => {
        let ok = false;
        try { ok = this.ctx.s.progression.save() !== false; } catch { ok = false; }
        if (ok) this.ctx.log('Game saved.', '#9fe8a8');
        else this.ctx.log('Saving failed. Browser storage may be full or blocked.', '#ff9b9b');
      }, 'ax-btn-secondary'),
      quit,
    ];
  }

  private renderSettings(): HTMLElement[] {
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
    const st = getSettings();
    const seg = <K extends keyof Settings>(label: string, key: K, opts: [Settings[K], string][], title = '') =>
      h('div', { class: 'ax-set-row', title },
        h('span', { class: 'ax-set-label' }, label),
        h('div', { class: 'ax-seg' }, opts.map(([v, text]) => h('button', {
          class: `ax-seg-btn${st[key] === v ? ' ax-active' : ''}`, 'data-setting': `${key}:${String(v)}`,
          onclick: () => { this.ctx.sfx('ui_click'); setSetting(key, v); },
        }, text))));
    return [
      h('div', { class: 'ax-panel ax-settings' }, h('div', { class: 'ax-panel-head' }, 'Sound'), slider('Effects', 'sfx'), slider('Music', 'music')),
      h('div', { class: 'ax-panel ax-settings' }, h('div', { class: 'ax-panel-head' }, 'Display'),
        seg('Shake', 'shake', [['on', 'On'], ['reduced', 'Less'], ['off', 'Off']], 'Camera shake and flashes from big spells and bosses'),
        seg('Damage #', 'damageSize', [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']], 'Size of floating damage numbers'),
        seg('Familiar', 'familiar', [[true, 'Show'], [false, 'Hide']], 'Show Pip, your familiar'),
        seg('Touch', 'touch', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], 'On-screen touch controls (Auto: shown on phones and tablets, or after you touch the screen)')),
      this.btn('Back', () => { this.tab = 'game'; this.invalidate(); }, 'ax-btn-secondary'),
    ];
  }

  private quit() {
    try { this.ctx.s.progression.save(); } catch { /* ignore */ }
    try { this.ctx.s.scene.scene.start(SCENES.TITLE); } catch (e) { console.warn('[ui] quit failed', e); }
  }
}

// ───────────────────────────── Help ─────────────────────────────

export class HelpWindow extends UIWindow {
  private offBindings: () => void;
  constructor(ctx: UICtx) {
    super(ctx, 'help', 'How to Play', { width: 540, x: 370, y: 130, className: 'ax-help-win' });
    this.offBindings = onBindingsChanged(() => this.invalidate());
  }
  protected signature() { return JSON.stringify(getBindings()); }
  destroy() {
    try { this.offBindings(); } catch { /* ignore */ }
    destroyControls(this.ctx);
    super.destroy();
  }
  protected render() {
    const k = (...acts: ActionId[]) => acts.map(a => keyLabel(getBinding(a)));
    const row = (keys: string[], what: string) => h('div', { class: 'ax-help-row' },
      h('div', { class: 'ax-help-keys' }, keys.map(key => h('kbd', null, key))), h('div', null, what));
    const jobs = safe(() => Registry.jobs(), [] as JobDef[]);
    const schools = jobs.filter(j => j.tier === 2).map(j => BRANCH_NAMES[j.branch] ?? j.name);
    const list = schools.length > 1 ? `${schools.slice(0, -1).join(', ')} or ${schools[schools.length - 1]}` : 'a School';
    const lv2 = jobs.find(j => j.tier === 2)?.requiredLevel ?? 10;
    const slots = (idx: number[]) => k(...idx.map(i => SLOT_ACTIONS[i]));
    this.body.replaceChildren(
      h('div', { class: 'ax-help-intro' }, `Welcome to The Academy! Every student here is a mage. Study the core curriculum as a Year 1 Apprentice, then pass your Year-end Exam at level ${lv2} and declare your School: ${list}.`),
      h('div', { class: 'ax-help-cols' },
        h('div', null,
          h('div', { class: 'ax-help-head' }, 'Movement'),
          row(k('left', 'right'), 'Walk'),
          row(k('jump', 'jump2'), 'Jump'),
          row([...k('down'), '+ Jump'], 'Drop through a platform'),
          row(k('up', 'down'), 'Climb ropes & ladders'),
          row(k('interact'), 'Enter portal / talk to NPC'),
          row(k('pickup'), 'Pick up items (hold)'),
          h('div', { class: 'ax-help-head' }, 'Combat'),
          row(slots([0, 1, 2, 3, 4]), 'Hotbar slots'),
          row(slots([5, 6, 7, 8, 9]), 'Hotbar slots'),
          row(slots([10, 11]), 'Potions (by default)'),
          row(k('hotbarPage'), 'Flip hotbar page (1 / 2)')),
        h('div', null,
          h('div', { class: 'ax-help-head' }, 'Windows'),
          row(k('skills'), 'Spellbook — spend SP'),
          row(k('inventory'), 'Inventory'),
          row(k('stats'), 'Character — spend AP'),
          row(k('quests'), 'Assignments'),
          row(k('honors'), 'Academy Honors & titles'),
          row(k('minimap'), 'Minimap'),
          row(k('help'), 'This help'),
          row(['Esc'], 'Close window / menu'),
          h('div', { class: 'ax-help-head' }, 'Gamepad & keys'),
          h('div', { class: 'ax-help-tip' }, 'Plug in a controller: left stick / D-pad move, A jumps, B picks up, X Y LB RB LT RT and the right stick cast your hotbar, hold Back and press X / Y for the potion slots, tap Back to flip the hotbar page, Start opens the menu.'),
          h('div', { class: 'ax-help-tip' }, 'Every key can be rebound: Esc → Controls (button below).'),
          h('div', { class: 'ax-help-head' }, 'Tips'),
          h('div', { class: 'ax-help-tip' }, `Drag spells from your Spellbook (or potions from your Inventory) onto the hotbar. Two pages of 12 slots — ${keyLabel(getBinding('hotbarPage'))} flips. Right-click a slot to clear it. Hold a skill key to keep casting.`))),
      h('div', { class: 'ax-row ax-center' },
        h('button', { class: 'ax-btn ax-btn-secondary', onclick: () => { this.ctx.sfx('ui_click'); this.close(); openControls(this.ctx, 'keyboard'); } }, 'Controls & Gamepad'),
        h('button', { class: 'ax-btn', onclick: () => this.close() }, 'Got it!')));
  }
}

// ───────────────────────────── Job advancement ─────────────────────────────

export class JobsWindow extends UIWindow {
  constructor(ctx: UICtx) {
    super(ctx, 'jobs', 'Year-end Exam', { width: 560, x: 360, y: 120, className: 'ax-jobs-win' });
  }

  protected signature(): string {
    const p = this.ctx.s.progression;
    return JSON.stringify([p.state.job, p.state.level, safe(() => p.availableAdvancements(), []), p.state.quests[GRADUATION_QUEST_ID]?.status]);
  }

  protected render() {
    const p = this.ctx.s.progression;
    const st = p.state;
    const avail = safe(() => p.availableAdvancements(), [] as JobId[]);
    const cur = safe(() => p.jobDef(), null);
    const cards = h('div', { class: 'ax-job-cards' });
    const declaring = (cur?.tier ?? 1) === 1;
    const graduated = st.quests[GRADUATION_QUEST_ID]?.status === 'turned_in';
    // Year 4 -> 5 is the postgraduate Fellowship, not another undergraduate Year.
    const fellowship = (cur?.tier ?? 1) >= 4;
    // Five Schools to choose from in Year 1 → widen the window so every card fits on one row.
    const winW = avail.length > 3 ? Math.min(940, 40 + avail.length * 180) : 560;
    this.el.style.width = `${winW}px`;
    const left = parseFloat(this.el.style.left) || 0;
    if (left + winW > GAME_WIDTH) this.el.style.left = `${Math.max(0, GAME_WIDTH - winW - 8)}px`;
    this.setTitle(declaring && avail.length ? 'Year-end Exam — Declare your School' : fellowship ? 'Fellowship Exam' : 'Year-end Exam');
    for (const id of avail) {
      const j = safe(() => Registry.job(id), undefined as JobDef | undefined);
      if (!j) continue;
      const color = BRANCH_COLORS[j.branch] ?? '#c9b8ff';
      cards.appendChild(h('div', { class: 'ax-job-card', style: `--accent:${color}` },
        portraitEl(j.look, 72, j.name),
        h('div', { class: 'ax-job-name' }, j.name),
        h('div', { class: 'ax-job-branch' }, `${schoolName(j.branch)} · Year ${j.tier}${j.tier >= 5 ? ' · Fellowship' : ''}`),
        h('div', { class: 'ax-job-desc' }, j.description || ''),
        h('button', {
          class: 'ax-btn', onclick: () => {
            if (safe(() => p.advanceJob(id), false)) { this.close(); }
            else { this.ctx.sfx('ui_error'); this.ctx.log('You cannot advance right now.', '#ff9b9b'); }
          },
        }, j.tier === 2 ? `Declare ${BRANCH_NAMES[j.branch] ?? j.name}` : j.tier >= 5 ? 'Begin your Fellowship' : `Begin Year ${j.tier}`)));
    }
    if (!cards.childElementCount) {
      const next = cur ? safe(() => Registry.jobs(), [] as JobDef[]).filter(j => j.parent === cur.id) : [];
      const lvl = next.length ? Math.min(...next.map(j => j.requiredLevel)) : 0;
      let note: string;
      if (fellowship && !next.length) note = 'You are a Fellow of the Academy. There are no more exams — only the stars, and whatever waits beyond them.';
      else if (fellowship && !graduated) note = 'This is your final Year. Your Final Thesis awaits — speak with Headmistress Maelis.';
      else if (fellowship) note = st.level < lvl
        ? `You have graduated! The Fellowship (Year 5) invites graduates at level ${lvl}.`
        : `The Fellowship is waiting. Speak with ${examinerName(next[0])} on campus to sit your Fellowship Exam.`;
      else if (next.length) note = st.level < lvl ? `Your Year-end Exam opens at level ${lvl}. Keep studying!` : `Speak with ${examinerName(next[0])} on campus to sit your exam.`;
      else note = graduated ? 'You have graduated — the Academy has nothing left to teach you. (For now.)'
        : 'This is your final Year. Your Final Thesis awaits — speak with Headmistress Maelis.';
      cards.appendChild(h('div', { class: 'ax-empty-note' }, note));
    }
    this.body.replaceChildren(
      h('div', { class: 'ax-help-intro' }, !cur ? '' : declaring
        ? `Year 1 is over, ${st.name}. Declare the School you will study for the rest of your time at the Academy — this choice is permanent.`
        : fellowship
          ? `You are a Year ${cur.tier} ${cur.name}${cur.tier >= 5 ? ', a Fellow of the Academy' : ''}. ${cur.tier >= 5 ? 'Your studies are your own now.' : 'Graduates who pass their Professor\'s Fellowship Exam begin Year 5.'}`
          : `You are a Year ${cur.tier} ${cur.name}. Pass this exam to begin your next Year.`),
      cards);
  }
}
