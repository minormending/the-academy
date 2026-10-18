/** Bottom-left system log with fading lines and spam coalescing. */
import { h } from './dom';
import type { UICtx } from './context';

interface Line { el: HTMLElement; text: string; key: string | null; total: number; repeat: number; born: number; fmt?: (n: number) => string; }

const MAX_LINES = 60;
const FADE_MS = 9000;
const COALESCE_MS = 2600;

export class ChatLog {
  readonly el: HTMLElement;
  private list: HTMLElement;
  private lines: Line[] = [];
  private nextSweep = 0;

  constructor(private ctx: UICtx) {
    this.list = h('div', { class: 'ax-chat-list' });
    this.el = h('div', { class: 'ax-chat' }, this.list);
    this.el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    ctx.root.appendChild(this.el);
  }

  private stamp() { return performance.now(); }

  /** Plain message. Identical consecutive messages collapse into "(×n)". */
  push(text: string, color?: string) {
    const t = this.stamp();
    const last = this.lines[this.lines.length - 1];
    if (last && !last.key && last.text === text && t - last.born < COALESCE_MS * 2) {
      last.repeat++;
      last.born = t;
      last.el.textContent = `${text} (×${last.repeat})`;
      last.el.classList.remove('ax-faded');
      return;
    }
    this.add({ text, key: null, total: 0, repeat: 1, born: t }, color);
  }

  /** Accumulating message (EXP / mesos / item gains): sums amounts arriving close together. */
  gain(key: string, amount: number, fmt: (total: number) => string, color?: string) {
    const t = this.stamp();
    for (let i = this.lines.length - 1; i >= Math.max(0, this.lines.length - 4); i--) {
      const l = this.lines[i];
      if (l.key === key && t - l.born < COALESCE_MS) {
        l.total += amount;
        l.born = t;
        l.text = fmt(l.total);
        l.el.textContent = l.text;
        l.el.classList.remove('ax-faded');
        return;
      }
    }
    this.add({ text: fmt(amount), key, total: amount, repeat: 1, born: t, fmt }, color);
  }

  private add(partial: Omit<Line, 'el'>, color?: string) {
    const el = h('div', { class: 'ax-line', style: color ? `color:${color}` : '' }, partial.text);
    const line: Line = { ...partial, el };
    this.lines.push(line);
    this.list.appendChild(el);
    while (this.lines.length > MAX_LINES) this.lines.shift()?.el.remove();
    this.list.scrollTop = this.list.scrollHeight;
  }

  frame(time: number) {
    if (time < this.nextSweep) return;
    this.nextSweep = time + 400;
    const t = this.stamp();
    for (const l of this.lines) {
      const faded = t - l.born > FADE_MS;
      if (faded !== l.el.classList.contains('ax-faded')) l.el.classList.toggle('ax-faded', faded);
    }
  }

  destroy() { this.el.remove(); }
}
