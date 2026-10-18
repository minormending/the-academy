/** Area-name banner (top) and big centred banners (LEVEL UP!, job advancement) with a queue. */
import { append, clear, h } from './dom';
import type { UICtx } from './context';

interface BigSpec { kind: 'level' | 'job' | 'generic'; title: string; text: string; sub?: string; color?: string; durMs: number }

export class Banners {
  private area: HTMLElement;
  private big: HTMLElement;
  private areaTimer = 0;
  private queue: BigSpec[] = [];
  private bigUntil = 0;
  private bigTimer = 0;
  private timers: number[] = [];

  constructor(private ctx: UICtx) {
    this.area = h('div', { class: 'ax-area-banner ax-passive' });
    this.big = h('div', { class: 'ax-big-banner ax-passive' });
    ctx.root.appendChild(this.area);
    ctx.root.appendChild(this.big);
  }

  /** Map name / generic banner from `ui:banner`. */
  showArea(text: string, sub?: string, color?: string) {
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
    this.enqueue({ kind: 'level', title: 'LEVEL UP!', text: `Level ${level}`, sub: 'New AP & SP available — press P / K', color: '#ffd76a', durMs: 2600 });
  }

  jobAdvance(jobName: string, desc: string, color: string) {
    this.enqueue({ kind: 'job', title: 'JOB ADVANCEMENT', text: jobName, sub: desc, color, durMs: 3400 });
  }

  private enqueue(b: BigSpec) {
    // Collapse multiple level-ups (e.g. debug levelTo) into the latest one.
    if (b.kind === 'level') {
      const i = this.queue.findIndex(q => q.kind === 'level');
      if (i >= 0) { this.queue[i] = b; return; }
    }
    this.queue.push(b);
    if (!this.bigUntil) this.next();
  }

  private next() {
    const b = this.queue.shift();
    if (!b) { this.bigUntil = 0; return; }
    this.bigUntil = 1;
    this.big.className = `ax-big-banner ax-passive ax-${b.kind}`;
    this.big.style.setProperty('--accent', b.color ?? '#ffd76a');
    clear(this.big);
    append(this.big, [
      h('div', { class: 'ax-big-rays' }),
      h('div', { class: 'ax-big-title' }, b.title),
      h('div', { class: 'ax-big-text' }, b.text),
      b.sub ? h('div', { class: 'ax-big-sub' }, b.sub) : null]);
    void this.big.offsetWidth;
    this.big.classList.add('ax-show');
    window.clearTimeout(this.bigTimer);
    this.bigTimer = window.setTimeout(() => {
      this.big.classList.remove('ax-show');
      this.timers.push(window.setTimeout(() => this.next(), 450));
    }, b.durMs);
  }

  destroy() {
    window.clearTimeout(this.areaTimer);
    window.clearTimeout(this.bigTimer);
    for (const t of this.timers) window.clearTimeout(t);
    this.area.remove();
    this.big.remove();
  }
}
