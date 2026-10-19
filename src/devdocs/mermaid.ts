// Mermaid diagrams (`<pre class="mermaid">`), rendered lazily as they scroll
// near, themed from the page's colours and re-rendered when the theme flips.
//
// Mermaid is NOT a package dependency: this page alone imports a pinned ESM
// build from the jsDelivr CDN at runtime (docs/DEVDOCS.md explains why); the
// game itself ships only Phaser. If the CDN can't be reached, each diagram
// shows its source with a note.

import { openViewer, svgSize } from "./panzoom";

export const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";

interface MermaidApi {
  initialize(config: Record<string, unknown>): void;
  render(id: string, text: string): Promise<{ svg: string }>;
}

let lib: Promise<MermaidApi | null> | null = null;
function loadMermaid(): Promise<MermaidApi | null> {
  lib ??= import(/* @vite-ignore */ MERMAID_URL)
    .then((m: { default: MermaidApi }) => m.default)
    .catch((e: unknown) => { console.warn("[devdocs] Mermaid could not be loaded from the CDN", e); return null; });
  return lib;
}

interface Diagram { box: HTMLElement; source: string; title: string; state: "idle" | "queued" | "done" }
const diagrams: Diagram[] = [];
let seq = 0;
let themeKey = "";
let queue: Promise<unknown> = Promise.resolve();

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const isDark = () => document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === "dark"
  : matchMedia("(prefers-color-scheme: dark)").matches;

function config(): Record<string, unknown> {
  const dark = isDark();
  return {
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    darkMode: dark,
    fontFamily: cssVar("--body-font") || "system-ui, sans-serif",
    flowchart: { htmlLabels: true, curve: "basis", useMaxWidth: true },
    sequence: { useMaxWidth: true },
    themeVariables: {
      darkMode: dark,
      background: cssVar("--surface"),
      fontSize: "14px",
      primaryColor: cssVar("--diagram-node"),
      primaryBorderColor: cssVar("--accent"),
      primaryTextColor: cssVar("--ink"),
      secondaryColor: cssVar("--diagram-node-2"),
      tertiaryColor: cssVar("--surface-2"),
      lineColor: cssVar("--ink-soft"),
      textColor: cssVar("--ink"),
      mainBkg: cssVar("--diagram-node"),
      nodeBorder: cssVar("--accent"),
      clusterBkg: cssVar("--surface-2"),
      clusterBorder: cssVar("--rule"),
      edgeLabelBackground: cssVar("--surface"),
      noteBkgColor: cssVar("--note-bg"),
      noteBorderColor: cssVar("--accent"),
      noteTextColor: cssVar("--ink"),
      actorBkg: cssVar("--diagram-node"),
      actorBorder: cssVar("--accent"),
      actorTextColor: cssVar("--ink"),
      signalColor: cssVar("--ink-soft"),
      signalTextColor: cssVar("--ink"),
      labelBoxBkgColor: cssVar("--surface-2"),
      labelTextColor: cssVar("--ink"),
      loopTextColor: cssVar("--ink"),
    },
  };
}

function fallback(d: Diagram, why: string) {
  const note = document.createElement("p");
  note.className = "diagram-note";
  note.textContent = why;
  const pre = document.createElement("pre");
  pre.className = "diagram-source";
  pre.textContent = d.source;
  d.box.classList.add("failed");
  d.box.classList.remove("pending");
  d.box.replaceChildren(note, pre);
}

async function renderOne(d: Diagram): Promise<void> {
  const mermaid = await loadMermaid();
  if (!mermaid) {
    fallback(d, "The diagram library (Mermaid) could not be loaded from its CDN, so here is the diagram's source.");
    d.state = "done";
    return;
  }
  const key = isDark() ? "dark" : "light";
  if (themeKey !== key) { mermaid.initialize(config()); themeKey = key; }
  try {
    const { svg } = await mermaid.render(`mmd-${++seq}`, d.source);
    const tpl = document.createElement("template");
    tpl.innerHTML = svg;
    const el = tpl.content.querySelector("svg");
    if (!el) throw new Error("no svg in Mermaid output");
    // Fit the box, but never shrink text below ~80%: wider diagrams scroll inside their box.
    const natural = el.viewBox?.baseVal?.width || 0;
    if (natural) {
      el.style.width = "100%";
      el.style.maxWidth = `${Math.round(natural)}px`;
      el.style.minWidth = `${Math.round(natural * 0.65)}px`;
      el.removeAttribute("height");
    }
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", d.title);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "diagram-open";
    btn.title = "Open full screen (pan and zoom)";
    btn.setAttribute("aria-label", `Open diagram full screen: ${d.title}`);
    btn.append(el);
    btn.addEventListener("click", () => openViewer(el, svgSize(el), d.title));
    d.box.classList.remove("failed", "pending");
    d.box.replaceChildren(btn);
    // A diagram wider than its box: left-to-right charts and sequence diagrams
    // start at their left edge, where reading starts; top-down trees start
    // scrolled to the middle, where their root is.
    if (d.box.scrollWidth > d.box.clientWidth) {
      const readsLeftToRight = /^\s*(?:(?:flowchart|graph)\s+LR\b|sequenceDiagram|gitGraph|timeline|gantt)/.test(d.source);
      d.box.scrollLeft = readsLeftToRight ? 0 : (d.box.scrollWidth - d.box.clientWidth) / 2;
    }
  } catch (e) {
    console.error(`[devdocs] Mermaid could not draw a diagram in "${d.title}":`, e);
    fallback(d, `This diagram has a syntax error (${e instanceof Error ? e.message.split("\n")[0] : "Mermaid refused it"}); its source follows.`);
    // Mermaid leaves an error element behind on failure.
    document.getElementById(`dmmd-${seq}`)?.remove();
  }
  d.state = "done";
  d.box.style.minHeight = "";
}

function enqueue(d: Diagram): Promise<void> {
  if (d.state !== "idle") return queue.then(() => undefined);
  d.state = "queued";
  const p = queue.then(() => renderOne(d));
  queue = p.catch(() => undefined);
  return p;
}

const io = typeof IntersectionObserver !== "undefined"
  ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io!.unobserve(e.target);
      const d = diagrams.find((x) => x.box === e.target);
      if (d) void enqueue(d);
    }
  }, { rootMargin: "600px 0px" })
  : null;

/** Replace every `pre.mermaid` under `root` with a lazily rendered diagram box. */
export function mountDiagrams(root: ParentNode): void {
  for (const pre of Array.from(root.querySelectorAll<HTMLPreElement>("pre.mermaid"))) {
    // Line breaks inside labels are written <br> in the fragment, which the HTML parser turns into elements;
    // put them back as text so Mermaid sees them.
    for (const br of Array.from(pre.querySelectorAll("br"))) br.replaceWith("<br>");
    const source = (pre.textContent ?? "").replace(/^\n+|\s+$/g, "");
    const section = pre.closest("section");
    const heading = section ? Array.from(section.querySelectorAll("h2, h3, h4")).filter((h) => h.compareDocumentPosition(pre) & Node.DOCUMENT_POSITION_FOLLOWING).pop() : null;
    const title = `Diagram: ${heading?.textContent?.replace(/#$/, "").trim() || section?.dataset.title || "diagram"}`;
    const box = document.createElement("div");
    box.className = "diagram pending";
    const wait = document.createElement("pre");
    wait.className = "diagram-source waiting";
    wait.textContent = source;
    box.append(wait);
    pre.replaceWith(box);
    const d: Diagram = { box, source, title, state: "idle" };
    diagrams.push(d);
    if (io) io.observe(box); else void enqueue(d);
  }
}

/** Re-render every drawn diagram in the current theme (unrendered ones pick it up when they appear). */
export function rethemeDiagrams(): void {
  for (const d of diagrams) {
    if (d.state !== "done" || d.box.classList.contains("failed") && !lib) continue;
    // Hold the box's height while it redraws so the page doesn't jump.
    d.box.style.minHeight = `${d.box.offsetHeight}px`;
    d.state = "idle";
    void enqueue(d);
  }
}

/** Render everything now (before printing). */
export async function renderAllDiagrams(): Promise<void> {
  await Promise.all(diagrams.map((d) => (d.state === "idle" ? enqueue(d) : queue)));
}
