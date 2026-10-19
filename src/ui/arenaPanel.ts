/**
 * Trial Hall panel (DOM). Mounted into the UI root only while the player is in `trial_hall`.
 * Reads the live ArenaSystem through `getArena()` every frame; buttons call `begin()` / `forfeit()`.
 */
import type { UICtx } from './context';
import { clear, fmtNum, h, safe, setText, toggleClass } from './dom';
import { ARENA_MAP_ID, ARENA_TUNING, getArena, type ArenaView } from '../systems/ArenaSystem';

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export class ArenaPanel {
  private el: HTMLElement;
  private body: HTMLElement;
  private bestEl: HTMLElement;
  private count: HTMLElement;
  private countNum: HTMLElement;
  private countSub: HTMLElement;
  private mounted = false;
  private sig = '';
  /** Live text nodes for the current layout (keyed by role). */
  private f: Record<string, HTMLElement> = {};
  private beginBtn: HTMLButtonElement | null = null;
  private lastCount = '';

  constructor(private ctx: UICtx) {
    this.bestEl = h('span', { class: 'ax-arena-best' });
    this.body = h('div', { class: 'ax-arena-body' });
    this.el = h('div', { class: 'ax-arena' },
      h('div', { class: 'ax-arena-head' }, h('span', { class: 'ax-win-gem ax-arena-gem' }), h('span', { class: 'ax-arena-title' }, 'Trial Hall'), this.bestEl),
      this.body);
    this.countNum = h('div', { class: 'ax-arena-count-num' });
    this.countSub = h('div', { class: 'ax-arena-count-sub' });
    this.count = h('div', { class: 'ax-arena-count ax-passive' }, this.countNum, this.countSub);
  }

  frame() {
    const arena = getArena();
    const v = arena ? safe(() => arena.view(), null) : null;
    const inHall = v ? v.inHall : safe(() => this.ctx.s.progression.state.mapId === ARENA_MAP_ID, false);
    if (inHall !== this.mounted) {
      this.mounted = inHall;
      if (inHall) { this.ctx.root.appendChild(this.el); this.ctx.root.appendChild(this.count); this.sig = ''; }
      else { this.el.remove(); this.count.remove(); }
    }
    if (!inHall) return;
    this.render(v);
  }

  private render(v: ArenaView | null) {
    const best = v?.best ?? safe(() => this.ctx.s.progression.state.arenaBest ?? 0, 0);
    setText(this.bestEl, `Best ${best}`);
    const phase = v?.phase ?? 'offline';
    const sig = `${phase}|${phase === 'results' ? `${v?.result?.reason}${v?.result?.wavesCleared}${v?.result?.timeMs}` : ''}`;
    if (sig !== this.sig) { this.sig = sig; this.build(v); }
    toggleClass(this.el, 'ax-arena-bosswave', !!v?.bossWave && (phase === 'fighting' || phase === 'countdown'));
    this.updateLive(v);
    this.updateCountdown(v);
  }

  // ─────────────────────────── layouts ───────────────────────────

  private build(v: ArenaView | null) {
    clear(this.body);
    this.f = {};
    this.beginBtn = null;
    const stat = (label: string, key: string, cls = '') => {
      const val = h('span', { class: `ax-arena-val ${cls}` });
      this.f[key] = val;
      return h('div', { class: 'ax-arena-stat' }, h('span', { class: 'ax-arena-lbl' }, label), val);
    };

    if (!v) {
      this.body.append(h('div', { class: 'ax-arena-text' }, 'The Trial proctor is away. Come back later.'));
      return;
    }

    if (v.phase === 'idle') {
      this.body.append(
        h('div', { class: 'ax-arena-text' }, 'Test your spellbook against endless waves. Each wave cleared pays Academy Merits and bonus EXP; every ',
          h('span', { class: 'ax-gold' }, `${ARENA_TUNING.bossEvery}th`), ' wave brings a boss.'),
        stat('Your Merits', 'merits', 'ax-gold'),
        this.beginButton('Begin Trial'),
      );
      return;
    }

    if (v.phase === 'results' && v.result) {
      const r = v.result;
      const head = r.reason === 'fell' ? 'You Fell!' : r.reason === 'forfeit' ? 'Trial Yielded' : 'Trial Ended';
      const card = h('div', { class: `ax-arena-card ax-arena-${r.reason}` },
        h('div', { class: 'ax-arena-card-title' }, head),
        h('div', { class: 'ax-arena-big' }, h('span', { class: 'ax-arena-big-num' }, String(r.wavesCleared)),
          h('span', { class: 'ax-arena-big-lbl' }, r.wavesCleared === 1 ? 'wave cleared' : 'waves cleared')),
        r.newBest ? h('div', { class: 'ax-arena-newbest' }, 'NEW PERSONAL BEST!') : null,
        h('div', { class: 'ax-arena-stat' }, h('span', { class: 'ax-arena-lbl' }, 'Merits earned'), h('span', { class: 'ax-arena-val ax-gold' }, `+${fmtNum(r.merits)}`)),
        h('div', { class: 'ax-arena-stat' }, h('span', { class: 'ax-arena-lbl' }, 'Bonus EXP'), h('span', { class: 'ax-arena-val ax-arena-exp' }, `+${fmtNum(r.exp)}`)),
        h('div', { class: 'ax-arena-stat' }, h('span', { class: 'ax-arena-lbl' }, 'Time'), h('span', { class: 'ax-arena-val' }, mmss(r.timeMs))),
        h('div', { class: 'ax-arena-stat' }, h('span', { class: 'ax-arena-lbl' }, 'Personal best'), h('span', { class: 'ax-arena-val' }, `${r.best} wave${r.best === 1 ? '' : 's'}`)),
      );
      const close = h('button', { class: 'ax-btn ax-btn-small ax-btn-secondary', onclick: () => { this.ctx.sfx('ui_close'); getArena()?.dismissResult(); } }, 'Close');
      this.body.append(card, h('div', { class: 'ax-arena-actions' }, this.beginButton('Try Again'), close));
      return;
    }

    // Running: countdown / fighting / breather.
    const bar = h('div', { class: 'ax-arena-bar-fill' });
    this.f.bar = bar;
    this.f.wave = h('span', { class: 'ax-arena-wave-num' });
    this.f.tag = h('span', { class: 'ax-arena-tag' });
    this.body.append(
      h('div', { class: 'ax-arena-wave' }, this.f.wave, this.f.tag),
      stat('Enemies', 'enemies'),
      h('div', { class: 'ax-arena-bar' }, bar),
      stat('Timer', 'timer'),
      stat('Run', 'run', 'ax-dim'),
      stat('Merits', 'runMerits', 'ax-gold'),
      h('div', { class: 'ax-arena-actions' },
        h('button', { class: 'ax-btn ax-btn-small ax-btn-danger', onclick: () => { this.ctx.sfx('ui_click'); getArena()?.forfeit(); } }, 'Forfeit')),
    );
  }

  private beginButton(label: string): HTMLButtonElement {
    const b = h('button', {
      class: 'ax-btn ax-arena-begin',
      onclick: () => {
        const a = getArena();
        if (a?.begin()) this.ctx.sfx('ui_click'); else this.ctx.sfx('ui_error');
      },
    }, label) as HTMLButtonElement;
    this.beginBtn = b;
    return b;
  }

  private updateLive(v: ArenaView | null) {
    if (!v) return;
    if (this.beginBtn) this.beginBtn.disabled = !v.canBegin;
    const f = this.f;
    if (f.merits) setText(f.merits, fmtNum(safe(() => this.ctx.s.progression.state.merits ?? 0, 0)));
    if (!f.wave) return;
    setText(f.wave, `Wave ${v.phase === 'breather' ? v.wave + 1 : v.wave}`);
    setText(f.tag, v.phase === 'countdown' ? (v.bossWave ? 'BOSS' : 'GET READY') : v.phase === 'breather' ? 'BREATHER' : v.bossWave ? 'BOSS' : 'FIGHT');
    toggleClass(f.tag, 'ax-arena-tag-boss', v.bossWave);
    toggleClass(f.tag, 'ax-arena-tag-rest', v.phase === 'breather');
    if (v.phase === 'fighting') {
      setText(f.enemies, `${v.enemiesLeft} / ${Math.max(v.enemiesTotal, v.enemiesLeft)}`);
      const r = v.enemiesTotal > 0 ? Math.min(1, v.enemiesLeft / Math.max(v.enemiesTotal, v.enemiesLeft)) : 0;
      f.bar.style.transform = `scaleX(${r.toFixed(3)})`;
      setText(f.timer, mmss(v.waveMs));
    } else {
      setText(f.enemies, v.phase === 'breather' ? `Wave ${v.wavesCleared} clear` : '—');
      f.bar.style.transform = `scaleX(${v.phase === 'breather' ? 0 : 1})`;
      setText(f.timer, `${v.phase === 'breather' ? 'Next in' : 'Starts in'} ${Math.ceil(v.phaseMsLeft / 1000)}s`);
    }
    setText(f.run, mmss(v.runMs));
    setText(f.runMerits, `+${fmtNum(v.merits)}`);
  }

  private updateCountdown(v: ArenaView | null) {
    const show = !!v && v.phase === 'countdown';
    toggleClass(this.count, 'ax-show', show);
    if (!show || !v) { this.lastCount = ''; return; }
    const n = String(Math.max(1, Math.ceil(v.phaseMsLeft / 1000)));
    if (n !== this.lastCount) {
      this.lastCount = n;
      setText(this.countNum, n);
      this.countNum.classList.remove('ax-bump'); void this.countNum.offsetWidth; this.countNum.classList.add('ax-bump');
    }
    setText(this.countSub, v.bossWave && v.bossName ? `Wave ${v.wave} · ${v.bossName}` : `Wave ${v.wave}`);
    toggleClass(this.count, 'ax-arena-count-boss', v.bossWave);
  }

  destroy() {
    this.el.remove();
    this.count.remove();
    this.mounted = false;
  }
}
