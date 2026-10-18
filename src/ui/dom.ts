/** Tiny DOM helpers for the Arcana Story UI (A8). */

export type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> | null | undefined;

/** Hyperscript-style element builder. `class`, `style` (string|object), `onxxx` (listener), `data-*`/`aria-*` attrs. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const key of Object.keys(props)) {
      const v = props[key];
      if (v === undefined || v === null) continue;
      if (v === false && (key === 'class' || key === 'style' || key === 'text' || key.includes('-') || key.startsWith('on'))) continue;
      if (key === 'class') el.className = String(v);
      else if (key === 'style') {
        if (typeof v === 'string') el.style.cssText = v;
        else Object.assign(el.style, v as Record<string, string>);
      } else if (key === 'text') el.textContent = String(v);
      else if (key.startsWith('on') && typeof v === 'function') el.addEventListener(key.slice(2).toLowerCase(), v as EventListener);
      else if (key.startsWith('data-') || key.startsWith('aria-') || key === 'role' || key === 'for') el.setAttribute(key, String(v));
      else (el as unknown as Record<string, unknown>)[key] = v;
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el: Node) { while (el.firstChild) el.removeChild(el.firstChild); }

export function setText(el: HTMLElement, text: string) { if (el.textContent !== text) el.textContent = text; }

export function toggleClass(el: Element, cls: string, on: boolean) {
  if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
}

// ───────────────────────────── storage ─────────────────────────────

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return (v ?? fallback) as T;
  } catch { return fallback; }
}

export function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

// ───────────────────────────── formatting ─────────────────────────────

export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
}

export function fmtSec(ms: number): string {
  const s = ms / 1000;
  if (s >= 60) { const m = Math.floor(s / 60); const r = Math.round(s % 60); return r ? `${m}m ${r}s` : `${m}m`; }
  return `${+s.toFixed(s < 10 ? 1 : 0)}s`;
}

export function fmtPct(fraction: number, digits = 0): string {
  return `${+(fraction * 100).toFixed(digits)}%`;
}

export function cssColor(n: number | undefined, fallback = '#8fa0ff'): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}

/** Lighten (amt>0) or darken (amt<0) a 0xRRGGBB colour; returns CSS. */
export function shade(n: number | undefined, amt: number): string {
  const c = typeof n === 'number' ? n : 0x8fa0ff;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  const r = f((c >> 16) & 255), g = f((c >> 8) & 255), b = f(c & 255);
  return `rgb(${r},${g},${b})`;
}

/** Safe call: returns fallback if fn throws. */
export function safe<T>(fn: () => T, fallback: T): T {
  try { const v = fn(); return v === undefined ? fallback : v; } catch { return fallback; }
}

export function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    const t = el.type;
    return t !== 'range' && t !== 'checkbox' && t !== 'radio' && t !== 'button' && t !== 'submit';
  }
  return (el as HTMLElement).isContentEditable === true;
}
