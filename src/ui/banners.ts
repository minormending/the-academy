/** Area-name banner (top) and big centred banners (LEVEL UP!, job advancement) with a queue. */
import { append, clear, h } from './dom';
import type { UICtx } from './context';
import { getBinding, keyLabel } from '../core/bindings';

interface BigSpec { kind: 'level' | 'job' | 'generic'; title: string; text: string; sub?: string; color?: string; durMs: number }

export class Banners {
  private area: HTMLElement;
  private big: HTMLElement;
  private areaTimer = 0;
  private queue: BigSpec[] = [];
  private bigUntil = 0;
  private bigTimer = 0;
  private timers: number[] = [];
  private current: BigSpec | null = null;
  private textEl: HTMLElement | null = null;
  private pendingArea: [string, string | undefined, string | undefined] | null = null;

  constructor(private ctx: UICtx) {
    this.area = h('div', { class: 'ax-area-banner ax-passive' });
    this.big = h('div', { class: 'ax-big-banner ax-passive' });
    ctx.root.appendChild(this.area);
    ctx.root.appendChild(this.big);
  }

  /** Map name / generic banner from `ui:banner`. */
  showArea(text: string, sub?: string, color?: string) {
    // While a big banner is up, hold the area banner until it finishes (they would overlap).
    if (this.bigUntil) { this.pendingArea = [text, sub, color]; return; }
    clear(this.area);
    append(this.area, [
      h('div', { class: 'ax-area-orn' }),
      h('div', { class: 'ax-area-text', style: color ? `color:${color}` : '' }, text),
      sub ? h('div', { class: 'ax-area-sub' }, sub) : null]);
    this.area.classList.remove('ax-show');
    void this.area.offsetWidth;
    this.area.classList.add('ax-show');
    window.clearTimeout(this.areaTimer);
    this.areaTimer = window.setTimeout(() => this.area.classList.remove('ax-show'), 2800);
  }

  levelUp(level: number) {
    this.enqueue({ kind: 'level', title: 'LEVEL UP!', text: `Level ${level}`, sub: `New AP & SP available — press ${keyLabel(getBinding('stats'))} / ${keyLabel(getBinding('skills'))}`, color: '#ffd76a', durMs: 2600 });
  }

  jobAdvance(jobName: string, desc: string, color: string, year?: number) {
    const title = year === 4 ? 'GRADUATED — YEAR 4' : year ? `EXAM PASSED — YEAR ${year}` : 'EXAM PASSED';
    this.enqueue({ kind: 'job', title, text: jobName, sub: desc, color, durMs: 3400 });
  }

  private enqueue(b: BigSpec) {
    // Collapse multiple level-ups (e.g. several levels from one quest/debug levelTo) into the latest one:
    // update the banner that is showing in place, or the one waiting in the queue.
    if (b.kind === 'level') {
      if (this.current?.kind === 'level' && this.textEl && this.big.classList.contains('ax-show')) {
        this.current = b;
        this.textEl.textContent = b.text;
        this.textEl.classList.remove('ax-bump'); void this.textEl.offsetWidth; this.textEl.classList.add('ax-bump');
        this.armHide(b.durMs);
        return;
      }
      const i = this.queue.findIndex(q => q.kind === 'level');
      if (i >= 0) { this.queue[i] = b; return; }
    } else if (b.kind === 'job') {
      // Several advancements at once (debug / skipped tiers): only announce the newest job.
      const i = this.queue.findIndex(q => q.kind === 'job');
      if (i >= 0) { this.queue[i] = b; return; }
    }
    this.queue.push(b);
    if (!this.bigUntil) this.next();
  }

  private next() {
    const b = this.queue.shift();
    this.current = b ?? null;
    if (!b) {
      this.bigUntil = 0; this.textEl = null;
      const pa = this.pendingArea;
      this.pendingArea = null;
      if (pa) this.showArea(pa[0], pa[1], pa[2]);
      return;
    }
    this.bigUntil = 1;
    // Never stack the map-name banner on top of a big banner.
    window.clearTimeout(this.areaTimer);
    this.area.classList.remove('ax-show');
    this.big.className = `ax-big-banner ax-passive ax-${b.kind}`;
    this.big.style.setProperty('--accent', b.color ?? '#ffd76a');
    clear(this.big);
    this.textEl = h('div', { class: 'ax-big-text' }, b.text);
    append(this.big, [
      h('div', { class: 'ax-big-rays' }),
      h('div', { class: 'ax-big-title' }, b.title),
      this.textEl,
      b.sub ? h('div', { class: 'ax-big-sub' }, b.sub) : null]);
    void this.big.offsetWidth;
    this.big.classList.add('ax-show');
    this.armHide(b.durMs);
  }

  private armHide(ms: number) {
    window.clearTimeout(this.bigTimer);
    this.bigTimer = window.setTimeout(() => {
      this.big.classList.remove('ax-show');
      this.timers.push(window.setTimeout(() => this.next(), 450));
    }, ms);
  }

  destroy() {
    window.clearTimeout(this.areaTimer);
    window.clearTimeout(this.bigTimer);
    for (const t of this.timers) window.clearTimeout(t);
    this.area.remove();
    this.big.remove();
  }
}
