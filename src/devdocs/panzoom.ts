// Pan and zoom for diagrams and node-link charts (CSS transforms on a stage
// inside a clipped viewport), and the full-screen viewer that uses it.

export interface PanZoom {
  fit(): void;
  zoomBy(factor: number, cx?: number, cy?: number): void;
  readonly scale: number;
}

export interface PanZoomOptions {
  /** "always": the wheel zooms (full-screen viewer). "modifier": only with Ctrl/⌘, so the page still scrolls. */
  wheel: "always" | "modifier";
  /** Largest zoom relative to 1:1. */
  maxScale?: number;
  /** Fit never enlarges past this (keeps small diagrams at a readable 1:1). */
  fitMax?: number;
}

export function panZoom(viewport: HTMLElement, stage: HTMLElement, size: { w: number; h: number }, opts: PanZoomOptions): PanZoom {
  let k = 1, x = 0, y = 0;
  let minK = 0.1;
  const maxK = opts.maxScale ?? 6;
  stage.style.transformOrigin = "0 0";
  stage.style.position = "absolute";
  stage.style.left = "0";
  stage.style.top = "0";
  const apply = () => { stage.style.transform = `translate(${x}px, ${y}px) scale(${k})`; };
  const clampPan = () => {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    const cw = size.w * k, ch = size.h * k;
    // Keep at least a quarter of the content on screen.
    x = Math.max(-cw + vw * 0.25, Math.min(vw * 0.75, x));
    y = Math.max(-ch + vh * 0.25, Math.min(vh * 0.75, y));
  };
  const api: PanZoom = {
    get scale() { return k; },
    fit() {
      const vw = viewport.clientWidth, vh = viewport.clientHeight;
      if (!vw || !vh) return;
      k = Math.min(vw / size.w, vh / size.h, opts.fitMax ?? 1);
      minK = Math.min(k, 1) * 0.5;
      x = (vw - size.w * k) / 2;
      y = (vh - size.h * k) / 2;
      apply();
    },
    zoomBy(f, cx, cy) {
      const vw = viewport.clientWidth, vh = viewport.clientHeight;
      const px = cx ?? vw / 2, py = cy ?? vh / 2;
      const nk = Math.max(minK, Math.min(maxK, k * f));
      x = px - ((px - x) * nk) / k;
      y = py - ((py - y) * nk) / k;
      k = nk;
      clampPan();
      apply();
    },
  };

  viewport.addEventListener("wheel", (e) => {
    if (opts.wheel === "modifier" && !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    api.zoomBy(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { d: number } | null = null;
  viewport.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add("dragging");
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  });
  viewport.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, cur);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = viewport.getBoundingClientRect();
      api.zoomBy(d / pinch.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      pinch.d = d;
      return;
    }
    x += cur.x - prev.x;
    y += cur.y - prev.y;
    clampPan();
    apply();
  });
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) viewport.classList.remove("dragging");
  };
  viewport.addEventListener("pointerup", up);
  viewport.addEventListener("pointercancel", up);
  viewport.addEventListener("dblclick", (e) => {
    const r = viewport.getBoundingClientRect();
    api.zoomBy(e.shiftKey ? 0.5 : 2, e.clientX - r.left, e.clientY - r.top);
  });
  viewport.addEventListener("keydown", (e) => {
    if (e.key === "+" || e.key === "=") api.zoomBy(1.25);
    else if (e.key === "-") api.zoomBy(0.8);
    else if (e.key === "0") api.fit();
    else if (e.key.startsWith("Arrow")) {
      const step = 40;
      if (e.key === "ArrowLeft") x += step;
      if (e.key === "ArrowRight") x -= step;
      if (e.key === "ArrowUp") y += step;
      if (e.key === "ArrowDown") y -= step;
      clampPan();
      apply();
    } else return;
    e.preventDefault();
  });
  apply();
  return api;
}

function button(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "tool-btn";
  b.textContent = label;
  b.title = title;
  b.setAttribute("aria-label", title);
  b.addEventListener("click", onClick);
  return b;
}

/** Zoom controls for a pan/zoom viewport. */
export function zoomTools(pz: () => PanZoom | null, extra: HTMLElement[] = []): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "zoom-tools";
  bar.append(
    button("−", "Zoom out", () => pz()?.zoomBy(0.8)),
    button("+", "Zoom in", () => pz()?.zoomBy(1.25)),
    button("Fit", "Fit to view", () => pz()?.fit()),
    ...extra,
  );
  return bar;
}

/**
 * Open `content` (an SVG, cloned) full-screen with pan and zoom. `size` is its
 * natural size in CSS pixels. Esc, the close button or the backdrop closes it.
 */
export function openViewer(content: SVGSVGElement, size: { w: number; h: number }, title: string): void {
  const opener = document.activeElement as HTMLElement | null;
  const overlay = document.createElement("div");
  overlay.className = "viewer";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", title);
  const head = document.createElement("div");
  head.className = "viewer-head";
  const h = document.createElement("span");
  h.className = "viewer-title";
  h.textContent = title;
  const viewport = document.createElement("div");
  viewport.className = "viewer-port";
  viewport.tabIndex = 0;
  const stage = document.createElement("div");
  stage.className = "viewer-stage";
  const svg = content.cloneNode(true) as SVGSVGElement;
  svg.removeAttribute("style");
  svg.setAttribute("width", String(size.w));
  svg.setAttribute("height", String(size.h));
  stage.append(svg);
  viewport.append(stage);
  let pz: PanZoom | null = null;
  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    document.documentElement.classList.remove("viewer-open");
    opener?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
  const closeBtn = button("✕", "Close", close);
  closeBtn.classList.add("close");
  head.append(h, zoomTools(() => pz), closeBtn);
  const hint = document.createElement("div");
  hint.className = "viewer-hint";
  hint.textContent = "Drag to pan · scroll or pinch to zoom · double-click to zoom in · Esc to close";
  overlay.append(head, viewport, hint);
  document.body.append(overlay);
  document.documentElement.classList.add("viewer-open");
  document.addEventListener("keydown", onKey);
  pz = panZoom(viewport, stage, size, { wheel: "always", fitMax: 2.5, maxScale: 8 });
  pz.fit();
  closeBtn.focus();
}

/** Natural size of an SVG from its viewBox (falls back to its rendered box). */
export function svgSize(svg: SVGSVGElement): { w: number; h: number } {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width && vb.height) return { w: vb.width, h: vb.height };
  const r = svg.getBoundingClientRect();
  return { w: r.width || 800, h: r.height || 600 };
}
