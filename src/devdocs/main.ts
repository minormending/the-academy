// The developer docs page (devdocs.html): the section fragments in
// src/devdocs/sections/ (CONTRACT.md) inside a shell with a cover, a sticky
// table of contents with scroll-spy, search, light/dark, Advanced blocks,
// callouts, highlighted code, GitHub source links, Mermaid diagrams and live
// charts drawn from the game's own modules. See docs/DEVDOCS.md.

import "./devdocs.css";
import { MONSTERS } from "../data/monsters";
import { MAPS } from "../data/maps";
import { ITEMS } from "../data/items";
import { QUESTS } from "../data/quests";
import { STORY_QUESTS } from "../data/storyQuests";
import { SCHOOLS } from "../data/jobs";
import { gameModules, mountCharts, renderAllCharts } from "./charts";
import { h } from "./dom";
import { highlightElement } from "./highlight";
import { mountDiagrams, renderAllDiagrams, rethemeDiagrams } from "./mermaid";
import { CHART_NAMES, CODE_LANGS, REPO_URL, SHELL_IDS, srcUrl } from "./names";
import { FRAGMENTS } from "./sections";
import { formatProblems, validateFragments, type Fragment } from "./validate";

const THEME_KEY = "academy.devdocs.theme";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---- theme ---------------------------------------------------------------------

const isDark = () => document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === "dark"
  : matchMedia("(prefers-color-scheme: dark)").matches;

function applyTheme(t: string | null) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

function themeToggle(): HTMLButtonElement {
  let saved: string | null = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* storage unavailable */ }
  applyTheme(saved);
  const b = h<HTMLButtonElement>("button.icon-btn", { type: "button" });
  const sync = () => {
    const dark = isDark();
    b.textContent = dark ? "☀" : "☾";
    b.title = dark ? "Switch to light mode (daylight on campus)" : "Switch to dark mode (night at the Academy)";
    b.setAttribute("aria-label", b.title);
  };
  b.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
    sync();
    rethemeDiagrams();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    sync();
    if (!document.documentElement.dataset.theme) rethemeDiagrams();
  });
  sync();
  return b;
}

// ---- fragments → DOM -------------------------------------------------------------

interface Built { el: HTMLElement; id: string; title: string; summary: string; subs: { id: string; title: string }[] }

function buildSection(f: Fragment): Built | null {
  const tpl = document.createElement("template");
  tpl.innerHTML = f.html;
  const el = tpl.content.querySelector("section");
  if (!el) return null;
  el.classList.add("doc");
  const id = el.id || slug(f.file.replace(/\.html$/, ""));
  el.id = id;
  const title = el.dataset.title || el.querySelector("h2")?.textContent || id;
  const subs: Built["subs"] = [];
  const used = new Set<string>();
  for (const hd of Array.from(el.querySelectorAll<HTMLHeadingElement>("h2, h3, h4"))) {
    if (hd.tagName !== "H2") {
      if (!hd.id) {
        const base = `${id}-${slug(hd.textContent ?? "") || "part"}`;
        let n = 2, cand = base;
        while (used.has(cand) || document.getElementById(cand)) cand = `${base}-${n++}`;
        hd.id = cand;
      }
      used.add(hd.id);
      if (hd.tagName === "H3" && !hd.closest("details")) subs.push({ id: hd.id, title: hd.textContent ?? "" });
    }
    const target = hd.tagName === "H2" ? id : hd.id;
    hd.append(h("a.hash", { href: `#${target}`, "aria-label": `Link to ${hd.textContent}` }, "#"));
  }
  return { el, id, title, summary: el.dataset.summary ?? "", subs };
}

const langName = (l: string) => ({ ts: "TypeScript", js: "JavaScript", json: "JSON", bash: "Shell", css: "CSS", html: "HTML", yaml: "YAML" } as Record<string, string>)[l] ?? (l || "Text");

function enhance(root: HTMLElement): void {
  // Source links to GitHub main.
  for (const a of Array.from(root.querySelectorAll<HTMLAnchorElement>("a[data-src]"))) {
    const src = a.dataset.src!;
    a.href = srcUrl(src);
    a.target = "_blank";
    a.rel = "noopener";
    a.classList.add("src-link");
    if (!a.title) a.title = `${src.replace("#L", " line ")} on GitHub (main)`;
  }
  // Callout labels.
  const labels: Record<string, string> = { note: "Note", tip: "Tip", warn: "Careful" };
  for (const aside of Array.from(root.querySelectorAll<HTMLElement>("aside.note, aside.tip, aside.warn"))) {
    const kind = (["warn", "tip", "note"] as const).find((k) => aside.classList.contains(k))!;
    aside.classList.add("callout");
    aside.setAttribute("role", "note");
    aside.prepend(h("span.callout-label", labels[kind]));
  }
  // Advanced blocks.
  for (const d of Array.from(root.querySelectorAll<HTMLDetailsElement>("details.advanced"))) {
    const sum = d.querySelector("summary");
    if (sum) {
      const t = (sum.textContent ?? "").replace(/^\s*Advanced:\s*/i, "").trim();
      sum.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      sum.prepend(h("span.adv-badge", "Advanced"));
    }
    d.addEventListener("toggle", syncAdvancedButton);
  }
  // Tables scroll inside their own box.
  for (const t of Array.from(root.querySelectorAll<HTMLTableElement>("table"))) {
    if (t.closest(".table-scroll, .chart")) continue;
    const wrap = h("div.table-scroll", { tabindex: "0", role: "region", "aria-label": t.caption?.textContent || "Table" });
    t.replaceWith(wrap);
    wrap.append(t);
  }
  // Code: highlight and copy.
  for (const code of Array.from(root.querySelectorAll<HTMLElement>("pre > code"))) {
    const pre = code.parentElement as HTMLPreElement;
    if (pre.classList.contains("mermaid")) continue;
    const lang = Array.from(code.classList).find((c) => c.startsWith("lang-"))?.slice(5) ?? "";
    const raw = code.textContent ?? "";
    if (lang) highlightElement(code, lang);
    const copy = h<HTMLButtonElement>("button.copy-btn", { type: "button", "aria-label": "Copy code" }, "Copy");
    copy.addEventListener("click", async () => {
      const ok = await copyText(raw);
      copy.textContent = ok ? "Copied" : "Press ⌘C";
      setTimeout(() => { copy.textContent = "Copy"; }, 1600);
    });
    const wrap = h("div.code", h("div.code-head", h("span.code-lang", langName(lang)), copy));
    pre.replaceWith(wrap);
    pre.tabIndex = 0;
    wrap.append(pre);
  }
}

async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    const ta = h<HTMLTextAreaElement>("textarea", { "aria-hidden": "true" });
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* unsupported */ }
    ta.remove();
    return ok;
  }
}

// ---- advanced toggle --------------------------------------------------------------

let advButton: HTMLButtonElement | null = null;
const advBlocks = () => Array.from(document.querySelectorAll<HTMLDetailsElement>("details.advanced"));
function syncAdvancedButton() {
  if (!advButton) return;
  const all = advBlocks();
  const open = all.length > 0 && all.every((d) => d.open);
  advButton.setAttribute("aria-pressed", String(open));
  advButton.querySelector(".adv-text")!.textContent = open ? "Collapse advanced" : "Expand all advanced";
  advButton.hidden = all.length === 0;
}
function advancedToggle(): HTMLButtonElement {
  advButton = h<HTMLButtonElement>("button.adv-toggle", { type: "button", "aria-pressed": "false", title: "Open or close every Advanced block" },
    h("span.adv-dot", { "aria-hidden": "true" }), h("span.adv-text", "Expand all advanced"));
  advButton.addEventListener("click", () => {
    const all = advBlocks();
    const open = !all.every((d) => d.open);
    for (const d of all) d.open = open;
    syncAdvancedButton();
  });
  return advButton;
}

// ---- search --------------------------------------------------------------------

interface Hit { kind: "heading" | "text"; title: string; context: string; href: string; key: string; text: string }

function searchIndex(sections: Built[]): Hit[] {
  const out: Hit[] = [];
  for (const s of sections) {
    let current = { id: s.id, title: s.title };
    const nodes = s.el.querySelectorAll<HTMLElement>("h2, h3, h4, p, li, td, th, summary, figcaption, dt, dd, pre > code");
    for (const n of Array.from(nodes)) {
      if (/^H[234]$/.test(n.tagName)) {
        const t = (n.textContent ?? "").replace(/#$/, "").trim();
        const hid = n.tagName === "H2" ? s.id : n.id;
        current = { id: hid, title: t };
        out.push({ kind: "heading", title: t, context: n.tagName === "H2" ? "Section" : s.title, href: `#${hid}`, key: t.toLowerCase(), text: t });
        continue;
      }
      if (n.tagName === "LI" && n.querySelector("p")) continue;
      const t = (n.textContent ?? "").replace(/\s+/g, " ").trim();
      if (t.length < 3) continue;
      const anchor = n.closest("details.advanced") ? (n.closest("details") as HTMLElement) : null;
      if (anchor && !anchor.id) anchor.id = `${current.id}-adv-${out.length}`;
      out.push({ kind: "text", title: current.title, context: n.tagName === "CODE" ? `${s.title} · code` : s.title, href: `#${anchor?.id ?? current.id}`, key: t.toLowerCase(), text: t });
    }
  }
  return out;
}

function snippet(text: string, q: string): Node[] {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return [document.createTextNode(text.slice(0, 120))];
  const from = Math.max(0, i - 40);
  const pre = (from > 0 ? "…" : "") + text.slice(from, i);
  const post = text.slice(i + q.length, i + q.length + 80) + (i + q.length + 80 < text.length ? "…" : "");
  return [document.createTextNode(pre), h("mark", text.slice(i, i + q.length)), document.createTextNode(post)];
}

function searchBox(sections: Built[]): HTMLElement {
  const index = searchIndex(sections);
  const input = h<HTMLInputElement>("input.search", { type: "search", id: "search", placeholder: "Search the docs  /", "aria-label": "Search the developer docs", autocomplete: "off", "aria-controls": "search-results", "aria-expanded": "false" });
  const list = h("ul.search-results", { id: "search-results", role: "listbox", hidden: true });
  let active = -1;
  const items = () => Array.from(list.querySelectorAll<HTMLAnchorElement>("a"));
  const setActive = (i: number) => {
    const all = items();
    active = Math.max(-1, Math.min(all.length - 1, i));
    all.forEach((a, j) => a.setAttribute("aria-selected", String(j === active)));
    all[active]?.scrollIntoView({ block: "nearest" });
  };
  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
  const update = () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { close(); return; }
    const words = q.split(/\s+/);
    const match = (x: Hit) => words.every((w) => x.key.includes(w));
    const heads = index.filter((x) => x.kind === "heading" && match(x)).sort((a, b) => Number(!a.key.startsWith(q)) - Number(!b.key.startsWith(q)));
    const texts: Hit[] = [];
    const seen = new Set<string>();
    for (const x of index) {
      if (x.kind !== "text" || !match(x) || texts.length >= 14) continue;
      const k = `${x.href}|${x.text.slice(0, 60)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      texts.push(x);
    }
    const found = [...heads.slice(0, 8), ...texts].slice(0, 16);
    list.replaceChildren(...(found.length
      ? found.map((x) => h("li", h("a", { href: x.href, role: "option", "aria-selected": "false" },
        h("span.hit-title", x.title),
        h("small.hit-context", x.context),
        x.kind === "text" ? h("span.hit-text", snippet(x.text, x.key.includes(q) ? q : words[0])) : null)))
      : [h("li.muted", "No matches")]));
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    active = -1;
  };
  input.addEventListener("input", update);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") {
      const a = items()[Math.max(0, active)];
      if (a) { e.preventDefault(); go(a.getAttribute("href")!); close(); input.blur(); }
    } else if (e.key === "Escape") { input.value = ""; close(); input.blur(); }
  });
  list.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    e.preventDefault();
    go(a.getAttribute("href")!);
    close();
  });
  document.addEventListener("click", (e) => { if (!(e.target as HTMLElement).closest(".search-wrap")) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !(e.target as HTMLElement).closest("input, textarea")) { e.preventDefault(); input.focus(); }
  });
  return h("div.search-wrap", { role: "search" }, input, list);
}

/** Navigate to an anchor, opening any closed Advanced block around it. */
function go(href: string, push = true) {
  const id = decodeURIComponent(href.replace(/^#/, ""));
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === "DETAILS") (el as HTMLDetailsElement).open = true;
  let d = el.closest("details");
  while (d) { d.open = true; d = d.parentElement?.closest("details") ?? null; }
  if (push && location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
  el.scrollIntoView({ block: "start" });
  closeToc();
}

// ---- table of contents + scroll-spy ------------------------------------------------

let tocEl: HTMLElement | null = null;
const closeToc = () => document.documentElement.classList.remove("toc-open");

function toc(sections: Built[]): HTMLElement {
  tocEl = h("nav.toc", { id: "contents", "aria-label": "Contents" },
    h("p.toc-title", "Contents"),
    h("ol.toc-list",
      sections.map((s, i) => h("li.toc-sec", { "data-sec": s.id },
        h("a.toc-link", { href: `#${s.id}`, "data-target": s.id }, h("span.toc-n", String(i + 1).padStart(2, "0")), h("span", s.title)),
        s.subs.length ? h("ol.toc-subs", s.subs.map((sub) => h("li", h("a.toc-link.sub", { href: `#${sub.id}`, "data-target": sub.id }, sub.title)))) : null,
      )),
    ),
    h("div.toc-foot",
      h("a", { href: "./" }, "Play the game"), h("a", { href: "./guide.html" }, "Student Handbook"), h("a", { href: REPO_URL }, "Repository"),
    ),
  );
  tocEl.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-target]");
    if (!a) return;
    e.preventDefault();
    go(a.getAttribute("href")!);
  });
  return tocEl;
}

function scrollSpy(sections: Built[]) {
  const heads = sections.flatMap((s) => [{ id: s.id, sec: s.id, el: s.el }, ...s.subs.map((x) => ({ id: x.id, sec: s.id, el: document.getElementById(x.id)! }))]).filter((x) => x.el);
  let current = "";
  const update = () => {
    const y = 96;
    let hit = heads[0];
    for (const x of heads) {
      if (x.el.getBoundingClientRect().top <= y) hit = x; else break;
    }
    if (!hit) return;
    const cover = document.getElementById("cover");
    if (cover && cover.getBoundingClientRect().bottom > y) hit = { id: "", sec: "", el: cover };
    if (hit.id === current) return;
    current = hit.id;
    for (const a of Array.from(tocEl?.querySelectorAll<HTMLAnchorElement>("a[data-target]") ?? [])) {
      const on = a.dataset.target === hit.id;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    }
    for (const li of Array.from(tocEl?.querySelectorAll<HTMLElement>(".toc-sec") ?? [])) li.classList.toggle("current", li.dataset.sec === hit.sec);
    const act = tocEl?.querySelector<HTMLElement>("a.active");
    if (act && tocEl && getComputedStyle(tocEl).position === "sticky") {
      const r = act.getBoundingClientRect(), tr = tocEl.getBoundingClientRect();
      if (r.top < tr.top + 40 || r.bottom > tr.bottom - 40) tocEl.scrollTop += r.top - tr.top - tr.height / 3;
    }
  };
  let raf = 0;
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
  addEventListener("resize", update);
  update();
}

// ---- cover -----------------------------------------------------------------------

function cover(sections: Built[]): HTMLElement {
  const spells = h("b", "…");
  // The spell list imports Phaser (through the VFX modules), so count it once the page is idle.
  const countSpells = () => void gameModules().then((g) => { spells.textContent = String(g.skills.length); }).catch(() => { spells.textContent = "?"; });
  if ("requestIdleCallback" in window) requestIdleCallback(countSpells, { timeout: 2500 }); else setTimeout(countSpells, 1200);
  const stats: [Node | number, string][] = [
    [spells, "spells"],
    [SCHOOLS.length, "Schools"],
    [MAPS.length, "maps"],
    [MONSTERS.length, "monsters"],
    [QUESTS.length + STORY_QUESTS.length, "quests"],
    [ITEMS.length, "items"],
  ];
  const stack: [string, string][] = [
    ["TypeScript, strict", "every module; contracts in src/core/types.ts"],
    ["Phaser 3.90", "the only runtime dependency: scenes, Arcade physics, sprites, particles"],
    ["DOM UI", "HUD and windows are HTML over the canvas, styled as pixel panels"],
    ["Vite 6", "dev server on :5199 and one build for three pages"],
    ["16-bit pixel art", "CC0 / CC-BY packs, sliced and palette-swapped at boot"],
    ["WebAudio", "every sound effect and song synthesized live; no audio files"],
    ["Built by agents", "a lead Claude session, parallel subagents and Codex"],
    ["GitHub Pages", "deployed by Actions on every push to main"],
  ];
  return h("header.cover", { id: "cover" },
    h("div.cover-sky", { "aria-hidden": "true" }),
    h("div.cover-main",
      h("p.kicker", "The Academy · developer documentation"),
      h("h1", { id: "top" }, "How The Academy is built"),
      h("p.lede",
        "The Academy is a MapleStory-style side-scroller in which every student is a mage: enrol as a Year 1 Apprentice, declare one of five Schools, pass your Year-end Exams and graduate by defeating the Lich Archon. ",
        "These pages walk through the code from the contracts that let ten agents build it in parallel to the skill engine, the world, the art pipeline and the deploy. ",
        "Every chart is drawn live from the game's own modules, so the numbers always match the build. Blocks marked ",
        h("span.adv-badge.inline", "Advanced"), " go deeper for experienced readers."),
      h("p.cover-links",
        h("a.button", { href: "./" }, "Play the game"),
        h("a.button.ghost", { href: "./guide.html" }, "Student Handbook"),
        h("a.button.ghost", { href: REPO_URL }, "Source on GitHub"),
      ),
      h("ul.cover-stats", stats.map(([n, l]) => h("li", typeof n === "number" ? h("b", n.toLocaleString("en-US")) : n, h("span", l)))),
    ),
    h("div.cover-stack",
      h("p.stack-title", "The stack at a glance"),
      h("dl.stack", stack.map(([k, v]) => h("div.stack-item", h("dt", k), h("dd", v)))),
    ),
    sections.length ? h("nav.inside", { id: "inside", "aria-label": "What's inside" },
      h("p.stack-title", "What's inside"),
      h("ol.inside-grid", sections.map((s, i) => h("li", h("a", { href: `#${s.id}` },
        h("span.inside-n", String(i + 1).padStart(2, "0")), h("span.inside-t", s.title), s.summary ? h("span.inside-s", s.summary) : null)))),
    ) : h("p.inside", { id: "inside" }, "The sections are on their way."),
  );
}

// ---- dev-only checks ---------------------------------------------------------------

async function devChecks(root: HTMLElement, fragments: Fragment[]) {
  if (!import.meta.env.DEV) return;
  const lines = (await import("virtual:devdocs-files")).default;
  const problems = validateFragments(fragments, { chartNames: CHART_NAMES, codeLangs: CODE_LANGS, shellIds: SHELL_IDS, fileLines: (p) => lines[p] });
  (window as unknown as { __devdocsProblems: unknown }).__devdocsProblems = problems;
  if (!problems.length) return;
  console.error(`[devdocs] ${problems.length} problem(s) in src/devdocs/sections:\n${formatProblems(problems)}`);
  root.before(h("div.dev-problems", { role: "alert" },
    h("strong", `${problems.length} problem${problems.length === 1 ? "" : "s"} in src/devdocs/sections (dev only; node src/devdocs/check.mjs lists them too)`),
    h("ul", problems.slice(0, 30).map((p) => h("li", h("code", p.file), " ", p.message))),
  ));
}

// ---- boot ------------------------------------------------------------------------

function boot() {
  const root = document.getElementById("devdocs")!;
  const fragments = FRAGMENTS;
  void devChecks(root, fragments);
  const built = fragments.map(buildSection).filter((b): b is Built => !!b);
  const main = h("main.content", { id: "main" },
    cover(built),
    built.map((b) => b.el),
    h("footer.foot",
      h("p", "Charts on this page are computed in your browser from the game's own modules, so they always match the deployed game. Diagrams are drawn by Mermaid, loaded from a CDN on this page only."),
      h("p", h("a", { href: "./" }, "Play The Academy"), " · ", h("a", { href: "./guide.html" }, "Student Handbook"), " · ", h("a", { href: REPO_URL }, "GitHub"), " · ", h("a", { href: "#top" }, "Back to top")),
    ),
  );
  const menu = h<HTMLButtonElement>("button.icon-btn.menu-btn", { type: "button", "aria-label": "Show contents", "aria-controls": "contents", title: "Contents" }, "☰");
  menu.addEventListener("click", () => {
    const open = document.documentElement.classList.toggle("toc-open");
    // Open the drawer at the section being read, not at the top of the list.
    const act = tocEl?.querySelector<HTMLElement>("a.active");
    if (open && act && tocEl) tocEl.scrollTop = Math.max(0, act.offsetTop - tocEl.clientHeight / 3);
  });
  const printBtn = h<HTMLButtonElement>("button.icon-btn.print-btn", { type: "button", title: "Print (draws every diagram and chart first)", "aria-label": "Print" });
  printBtn.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6V2h8v4M4 12H2V6h12v6h-2M4 9h8v5H4z"/></svg>';
  printBtn.addEventListener("click", async () => {
    printBtn.disabled = true;
    await Promise.all([renderAllDiagrams(), renderAllCharts()]);
    printBtn.disabled = false;
    print();
  });
  const bar = h("header.topbar",
    menu,
    h("a.brand", { href: "#top" }, h("span.crest", { "aria-hidden": "true" }), h("span.brand-name", "THE ACADEMY"), h("small", "DEV DOCS")),
    searchBox(built),
    h("div.bar-tools", advancedToggle(), printBtn, themeToggle()),
  );
  const scrim = h("div.scrim", { "aria-hidden": "true" });
  scrim.addEventListener("click", closeToc);
  root.replaceChildren(bar, h("div.layout", toc(built), scrim, main));
  enhance(main);
  mountDiagrams(main);
  mountCharts(main);
  syncAdvancedButton();
  scrollSpy(built);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeToc(); });
  // In-page links (including those inside fragments) open closed Advanced blocks.
  main.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a || a.classList.contains("hash")) return;
    const href = a.getAttribute("href")!;
    if (href.length > 1 && document.getElementById(decodeURIComponent(href.slice(1)))) { e.preventDefault(); go(href); }
  });
  addEventListener("popstate", () => { if (location.hash) go(location.hash, false); });
  addEventListener("beforeprint", () => { for (const d of Array.from(document.querySelectorAll("details"))) d.open = true; });
  if (location.hash) requestAnimationFrame(() => go(location.hash, false));
}

try {
  boot();
} catch (e) {
  console.error(e);
  document.getElementById("devdocs")!.textContent = "The developer docs failed to load. Please reload the page.";
}
