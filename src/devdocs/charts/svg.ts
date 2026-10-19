// A small SVG toolkit for the docs' charts: elements, scales (linear and
// log), ticks, axes, legends, the shared tooltip and data tables. No dependencies.

export const SVG_NS = "http://www.w3.org/2000/svg";

type Attr = string | number | boolean | null | undefined;
export type SvgChild = SVGElement | string | null | undefined | false | SvgChild[];

export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, Attr> = {}, ...children: SvgChild[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? "" : String(v));
  }
  const add = (c: SvgChild) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(typeof c === "string" ? document.createTextNode(c) : c);
  };
  children.forEach(add);
  return el;
}

/** Text helper: s("text") with a string body. */
export const text = (x: number, y: number, body: string, attrs: Record<string, Attr> = {}) => s("text", { x: r1(x), y: r1(y), ...attrs }, body);

export const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Scale {
  (v: number): number;
  domain: [number, number];
  range: [number, number];
  ticks(count?: number): number[];
}

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1_] = range;
  const k = d1 === d0 ? 0 : (r1_ - r0) / (d1 - d0);
  const f = ((v: number) => r0 + (v - d0) * k) as Scale;
  f.domain = domain;
  f.range = range;
  f.ticks = (count = 5) => niceTicks(d0, d1, count);
  return f;
}

/** Logarithmic scale (base 10). Domain values must be > 0. */
export function logScale(domain: [number, number], range: [number, number]): Scale {
  const l0 = Math.log10(domain[0]), l1 = Math.log10(domain[1]);
  const [r0, r1_] = range;
  const k = l1 === l0 ? 0 : (r1_ - r0) / (l1 - l0);
  const f = ((v: number) => r0 + (Math.log10(Math.max(v, 1e-9)) - l0) * k) as Scale;
  f.domain = domain;
  f.range = range;
  f.ticks = () => logTicks(domain[0], domain[1]);
  return f;
}

/** 1, 2, 5 × 10^n ticks inside [min, max] (just powers of ten when the span is wide). */
export function logTicks(min: number, max: number): number[] {
  const out: number[] = [];
  const wide = Math.log10(max / min) > 3.2;
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of wide ? [1] : [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= min * 0.999 && v <= max * 1.001) out.push(v);
    }
  }
  return out;
}

/** Round tick values (1, 2, 2.5, 5 × 10^n) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(Math.round(v / step) * step + 0);
  return out;
}

/** The smallest "nice" maximum at or above v. */
export function niceMax(v: number, count = 5): number {
  const t = niceTicks(0, v, count);
  const last = t[t.length - 1];
  return last >= v ? last : last + (t[1] - t[0]);
}

export const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${fmt(Math.round(n / 1e5) / 10)}M`;
  if (a >= 1e4) return `${fmt(Math.round(n / 100) / 10)}K`;
  return fmt(n);
}
export const pct = (p: number) => `${p >= 0.995 || p === 0 ? Math.round(p * 100) : p < 0.01 ? (p * 100).toFixed(2) : (p * 100).toFixed(1)}%`;

export interface Box { left: number; right: number; top: number; bottom: number }
export interface Frame { w: number; h: number; m: Box; iw: number; ih: number }
export const frame = (w: number, h: number, m: Box): Frame => ({ w, h, m, iw: Math.max(10, w - m.left - m.right), ih: Math.max(10, h - m.top - m.bottom) });

export function svgRoot(f: Frame, ...children: SvgChild[]): SVGSVGElement {
  return s("svg", { class: "chart-svg", width: f.w, height: f.h, viewBox: `0 0 ${f.w} ${f.h}`, "aria-hidden": "true", focusable: "false" }, ...children);
}

/** Horizontal gridlines and left-axis labels for a y scale. */
export function yAxis(f: Frame, y: Scale, ticks: number[], label?: string, format: (n: number) => string = compact): SVGGElement {
  return s("g", { class: "axis y" },
    ticks.map((t) => s("g", {},
      s("line", { class: t === 0 ? "baseline" : "grid", x1: f.m.left, x2: f.m.left + f.iw, y1: r1(y(t)), y2: r1(y(t)) }),
      text(f.m.left - 6, y(t) + 4, format(t), { "text-anchor": "end" }),
    )),
    label ? text(12, f.m.top + f.ih / 2, label, { class: "axis-label", transform: `rotate(-90 12 ${r1(f.m.top + f.ih / 2)})`, "text-anchor": "middle" }) : null,
  );
}

/** Bottom axis labels for an x scale, plus a baseline. */
export function xAxis(f: Frame, x: Scale, ticks: number[], label?: string, format: (n: number) => string = compact): SVGGElement {
  const y0 = f.m.top + f.ih;
  return s("g", { class: "axis x" },
    s("line", { class: "baseline", x1: f.m.left, x2: f.m.left + f.iw, y1: y0, y2: y0 }),
    ticks.map((t) => text(x(t), y0 + 16, format(t), { "text-anchor": "middle" })),
    label ? text(f.m.left + f.iw / 2, f.h - 4, label, { class: "axis-label", "text-anchor": "middle" }) : null,
  );
}

/** Vertical gridlines for an x scale (horizontal bar charts). */
export function xGrid(f: Frame, x: Scale, ticks: number[], format: (n: number) => string = compact, label?: string): SVGGElement {
  return s("g", { class: "axis x" },
    ticks.map((t) => s("g", {},
      s("line", { class: t === 0 ? "baseline" : "grid", x1: r1(x(t)), x2: r1(x(t)), y1: f.m.top, y2: f.m.top + f.ih }),
      text(x(t), f.m.top + f.ih + 16, format(t), { "text-anchor": "middle" }),
    )),
    label ? text(f.m.left + f.iw / 2, f.h - 4, label, { class: "axis-label", "text-anchor": "middle" }) : null,
  );
}

/** A bar with a 4px rounded data end and a square baseline end. */
export function barPath(x: number, y: number, w: number, h: number, dir: "up" | "right", radius = 4): string {
  const rr = Math.max(0, Math.min(radius, dir === "up" ? w / 2 : h / 2, dir === "up" ? h : w));
  if (dir === "up") {
    return `M${r1(x)},${r1(y + h)}V${r1(y + rr)}Q${r1(x)},${r1(y)} ${r1(x + rr)},${r1(y)}H${r1(x + w - rr)}Q${r1(x + w)},${r1(y)} ${r1(x + w)},${r1(y + rr)}V${r1(y + h)}Z`;
  }
  return `M${r1(x)},${r1(y)}H${r1(x + w - rr)}Q${r1(x + w)},${r1(y)} ${r1(x + w)},${r1(y + rr)}V${r1(y + h - rr)}Q${r1(x + w)},${r1(y + h)} ${r1(x + w - rr)},${r1(y + h)}H${r1(x)}Z`;
}

// ---- tooltip ---------------------------------------------------------------

export interface TipContent { title: string; rows?: { label: string; value: string; series?: number; dash?: boolean }[]; note?: string }

let tipEl: HTMLDivElement | null = null;

function tipNode(): HTMLDivElement {
  if (tipEl && tipEl.isConnected) return tipEl;
  tipEl = document.createElement("div");
  tipEl.className = "chart-tip";
  tipEl.setAttribute("role", "status");
  tipEl.hidden = true;
  document.body.append(tipEl);
  return tipEl;
}

export function showTip(c: TipContent, clientX: number, clientY: number): void {
  const el = tipNode();
  const title = document.createElement("strong");
  title.textContent = c.title;
  const kids: Node[] = [title];
  for (const r of c.rows ?? []) {
    const row = document.createElement("div");
    row.className = "tip-row";
    if (r.series) {
      const key = document.createElement("span");
      key.className = `tip-key sk-${r.series}${r.dash ? " dash" : ""}`;
      row.append(key);
    }
    const v = document.createElement("b");
    v.textContent = r.value;
    const l = document.createElement("span");
    l.textContent = r.label;
    row.append(v, l);
    kids.push(row);
  }
  if (c.note) {
    const n = document.createElement("div");
    n.className = "tip-note";
    n.textContent = c.note;
    kids.push(n);
  }
  el.replaceChildren(...kids);
  el.hidden = false;
  const pad = 14;
  const { width, height } = el.getBoundingClientRect();
  let x = clientX + pad;
  let y = clientY + pad;
  if (x + width > innerWidth - 8) x = Math.max(8, clientX - width - pad);
  if (y + height > innerHeight - 8) y = Math.max(8, clientY - height - pad);
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

export function hideTip(): void { if (tipEl) tipEl.hidden = true; }

/** Hover and focus tooltip for one mark (or its larger hit area). */
export function hover<T extends SVGElement>(el: T, content: () => TipContent): T {
  el.classList.add("hit");
  el.setAttribute("tabindex", "-1");
  el.addEventListener("pointermove", (e) => showTip(content(), (e as PointerEvent).clientX, (e as PointerEvent).clientY));
  el.addEventListener("pointerleave", hideTip);
  el.addEventListener("focus", () => {
    const b = el.getBoundingClientRect();
    showTip(content(), b.right, b.top);
  });
  el.addEventListener("blur", hideTip);
  return el;
}

// ---- legend, table ------------------------------------------------------------

export interface LegendItem { label: string; series: number; shape?: "rect" | "line" | "dash" | "dot" }

export function legend(items: LegendItem[]): HTMLElement {
  const ul = document.createElement("ul");
  ul.className = "chart-legend";
  for (const it of items) {
    const li = document.createElement("li");
    const sw = document.createElement("span");
    sw.className = `sw sw-${it.shape ?? "rect"} sk-${it.series}`;
    sw.setAttribute("aria-hidden", "true");
    li.append(sw, document.createTextNode(it.label));
    ul.append(li);
  }
  return ul;
}

export interface TableData { head: string[]; rows: (string | number)[][]; numeric?: boolean[] }

export function dataTable(t: TableData, caption: string): HTMLTableElement {
  const table = document.createElement("table");
  table.className = "data-table";
  const cap = document.createElement("caption");
  cap.textContent = caption;
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  t.head.forEach((h, i) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = h;
    if (t.numeric?.[i]) th.className = "num";
    hr.append(th);
  });
  thead.append(hr);
  const tbody = document.createElement("tbody");
  for (const r of t.rows) {
    const tr = document.createElement("tr");
    r.forEach((c, i) => {
      const td = document.createElement(i === 0 ? "th" : "td");
      if (i === 0) (td as HTMLTableCellElement).scope = "row";
      td.textContent = typeof c === "number" ? fmt(c) : c;
      if (t.numeric?.[i] ?? typeof c === "number") td.classList.add("num");
      tr.append(td);
    });
    tbody.append(tr);
  }
  table.append(cap, thead, tbody);
  return table;
}

/** Truncate a label to fit roughly `px` at ~6.4px per character (11px sans). */
export function fitLabel(label: string, px: number, charW = 6.4): string {
  const max = Math.max(3, Math.floor(px / charW));
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}
