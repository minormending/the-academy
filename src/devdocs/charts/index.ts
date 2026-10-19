// The live charts (`<figure data-chart="NAME">`, CONTRACT.md § Charts): data
// from ./data.ts, drawn as dependency-free SVG. Each chart has a title, a
// legend when it has two or more series, hover tooltips, an accessible
// summary (role="img" + aria-label) and a "Show data" table. Charts render
// lazily as they scroll near and redraw when their box changes width.
//
// Pure data modules (balance, maps, monsters, jobs, items, quests) are
// imported statically. Skills, derived stats and saves import Phaser (their
// VFX code does), so they load on demand, in one shared chunk with the game.

import { AP_PER_LEVEL, refMonsterHp } from "../../core/balance";
import { JOB_LEVELS, MAX_LEVEL, START_MAP } from "../../core/constants";
import type { SkillDef, PlayerState, DerivedStats } from "../../core/types";
import { FIELD_BOSSES, MONSTERS } from "../../data/monsters";
import { MAPS } from "../../data/maps";
import { JOBS } from "../../data/jobs";
import { ITEMS } from "../../data/items";
import { QUESTS } from "../../data/quests";
import { STORY_QUESTS } from "../../data/storyQuests";
import { NPCS } from "../../data/npcs";
import type { ChartName } from "../names";
import { openViewer, panZoom, zoomTools, type PanZoom } from "../panzoom";
import {
  GROUPS, GROUP_NAME, GROUP_SERIES, KINDS, attackPatterns, contentCounts, expCurve, hpCurves, layoutMapGraph, layoutModuleGraph,
  mapGraph, matkCurve, monsterHp, monsterLevels, schoolBudgets, spellsByYear, statusMix, yearBands,
  type BudgetPoint, type Count, type Group, type MonsterRole, type StackRow, type YearBand,
} from "./data";
import type { SourceStats } from "./sourceStats";
import {
  barPath, compact, dataTable, fitLabel, fmt, frame, hideTip, hover, legend, linear, logScale, logTicks, niceMax, niceTicks, r1, s, showTip,
  svgRoot, text, xAxis, xGrid, yAxis, type LegendItem, type TableData, type TipContent,
} from "./svg";

interface Drawn { svg: SVGSVGElement; /** Node-link charts: natural size for pan/zoom. */ graph?: { w: number; h: number } }

interface ChartDef<M> {
  title: string;
  load(): M | Promise<M>;
  summary(m: M): string;
  legend?(m: M): LegendItem[];
  table(m: M): TableData;
  draw(m: M, width: number): Drawn;
}

// ---- lazily loaded game modules ---------------------------------------------------

interface GameModules {
  skills: SkillDef[];
  derive: (s: PlayerState) => DerivedStats;
  newPlayer: (name: string) => PlayerState;
}
let game: Promise<GameModules> | null = null;
/** Skills (and the formulas that need them) import Phaser through their VFX modules, so they load on demand. */
export const gameModules = () => (game ??= Promise.all([
  import("../../skills"),
  import("../../systems/progression/stats"),
  import("../../systems/SaveSystem"),
]).then(([sk, st, sv]) => ({ skills: sk.ALL_SKILLS, derive: (p: PlayerState) => st.computeDerived(p), newPlayer: sv.newPlayerState })));

let source: Promise<SourceStats> | null = null;
const sourceStats = () => (source ??= import("virtual:devdocs-source").then((m) => m.default));

const FIELD_IDS = new Set(Object.keys(FIELD_BOSSES));
const BANDS = yearBands(JOB_LEVELS, MAX_LEVEL);
const ROLE_SERIES: Record<MonsterRole, number> = { normal: 1, field: 2, final: 7 };
const ROLE_NAME: Record<MonsterRole, string> = { normal: "Monster", field: "Field boss", final: "Final boss" };
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const sec = (ms: number) => (ms ? `${fmt(ms / 1000)} s` : "none");

// ---- shared drawing helpers --------------------------------------------------------

interface LineSeries { label: string; series: number; dash?: boolean; points: [number, number][] }

/** Shaded school-Year bands behind a level axis, labelled along the top. */
function yearBandEls(x: (v: number) => number, top: number, height: number, bands: YearBand[], narrow: boolean): SVGElement[] {
  return bands.map((b, i) => s("g", {},
    s("rect", { class: `band${i % 2 ? " alt" : ""}`, x: r1(x(b.from - 0.5)), y: top, width: r1(x(b.to + 0.5) - x(b.from - 0.5)), height }),
    text((x(b.from - 0.5) + x(b.to + 0.5)) / 2, top + 12, narrow ? `Y${b.year}` : `Year ${b.year}`, { class: "band-label", "text-anchor": "middle" }),
  ));
}

/** Multi-series line chart over levels with a snapping crosshair that lists every series. */
function lineChart(width: number, opts: {
  series: LineSeries[]; xDomain: [number, number]; yMax: number; xLabel: string; yLabel: string; bands?: YearBand[];
  xTicks?: number[]; yFormat?: (n: number) => string; valueFormat: (n: number) => string;
  tipTitle: (x: number) => string; extraRows?: (i: number) => { label: string; value: string }[]; endLabels?: boolean;
}): Drawn {
  const h = Math.round(Math.max(260, Math.min(380, width * 0.55)));
  const ends = opts.endLabels && width > 520;
  const f = frame(width, h, { left: 58, right: ends ? 84 : 16, top: opts.bands ? 22 : 14, bottom: 44 });
  const x = linear(opts.xDomain, [f.m.left, f.m.left + f.iw]);
  const y = linear([0, opts.yMax], [f.m.top + f.ih, f.m.top]);
  const xt = opts.xTicks ?? niceTicks(opts.xDomain[0], opts.xDomain[1], width < 480 ? 4 : 8);
  const lines = opts.series.map((se) => s("path", {
    class: `line sk-${se.series}${se.dash ? " dash" : ""}`,
    d: se.points.map(([px, py], i) => `${i ? "L" : "M"}${r1(x(px))},${r1(y(py))}`).join(""),
  }));
  // End labels, nudged apart vertically so close lines don't print on top of each other.
  const endPos = opts.series.map((se) => { const [px, py] = se.points[se.points.length - 1]; return { se, x: x(px) + 6, y: y(py) + 4 }; })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < endPos.length; i++) endPos[i].y = Math.max(endPos[i].y, endPos[i - 1].y + 13);
  const endEls = ends ? endPos.map((p) => text(p.x, p.y, p.se.label, { class: "end-label" })) : [];
  const cross = s("g", { class: "crosshair", visibility: "hidden" });
  const xs = opts.series[0].points.map((p) => p[0]);
  const hit = s("rect", { class: "hit-area", x: f.m.left, y: f.m.top, width: f.iw, height: f.ih });
  const move = (clientX: number, clientY: number) => {
    const r = hit.getBoundingClientRect();
    const px = opts.xDomain[0] + ((clientX - r.left) / r.width) * (opts.xDomain[1] - opts.xDomain[0]);
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - px) < Math.abs(xs[best] - px)) best = i;
    const vx = xs[best];
    cross.replaceChildren(
      s("line", { class: "cross", x1: r1(x(vx)), x2: r1(x(vx)), y1: f.m.top, y2: f.m.top + f.ih }),
      ...opts.series.map((se) => s("circle", { class: `dot sf-${se.series}`, cx: r1(x(vx)), cy: r1(y(se.points[best][1])), r: 4 })),
    );
    cross.setAttribute("visibility", "visible");
    showTip({
      title: opts.tipTitle(vx),
      rows: [
        ...opts.series.map((se) => ({ label: se.label, value: opts.valueFormat(se.points[best][1]), series: se.series, dash: se.dash })),
        ...(opts.extraRows?.(best) ?? []),
      ],
    }, clientX, clientY);
  };
  hit.addEventListener("pointermove", (e) => move(e.clientX, e.clientY));
  hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); hideTip(); });
  return {
    svg: svgRoot(f,
      opts.bands ? yearBandEls(x, f.m.top - 18, f.ih + 18, opts.bands, width < 480) : null,
      yAxis(f, y, niceTicks(0, opts.yMax, 5), opts.yLabel, opts.yFormat),
      xAxis(f, x, xt, opts.xLabel),
      s("g", { class: "lines" }, lines), endEls, cross, hit,
    ),
  };
}

const levelTicks = (w: number) => [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].filter((t, i) => w >= 520 || i % 2 === 0 || t === 50);

interface HBarRow { label: string; values: number[]; tip?: () => TipContent; gapBefore?: boolean }

/** Horizontal bars (stacked or grouped), labels on the left, totals at the tips. */
function hbarsSvg(width: number, rows: HBarRow[], opts: {
  series: number[]; stacked?: boolean; xLabel?: string; labelWidth?: number; rowH?: number; title?: string; mono?: boolean;
}): SVGSVGElement {
  const groups = opts.stacked ? 1 : opts.series.length;
  const barH = opts.stacked ? 16 : 12;
  const rowH = opts.rowH ?? (opts.stacked ? 26 : groups * (barH + 2) + 14);
  const gaps = rows.filter((r) => r.gapBefore).length * 10;
  const labelW = opts.labelWidth ?? Math.min(170, Math.max(64, Math.max(...rows.map((r) => r.label.length)) * (opts.mono ? 7 : 6.8) + 18));
  const titleH = opts.title ? 22 : 0;
  const f = frame(width, titleH + rows.length * rowH + gaps + 40 + (opts.xLabel ? 12 : 0), { left: labelW, right: 44, top: titleH + 6, bottom: 34 + (opts.xLabel ? 12 : 0) });
  const max = Math.max(1, ...rows.map((r) => (opts.stacked ? r.values.reduce((a, b) => a + b, 0) : Math.max(...r.values))));
  const xm = niceMax(max, width < 480 ? 3 : 5);
  const x = linear([0, xm], [f.m.left, f.m.left + f.iw]);
  let offset = 0;
  const marks = rows.map((r, i) => {
    if (r.gapBefore) offset += 10;
    const rowTop = f.m.top + i * rowH + offset;
    const y0 = rowTop + (rowH - (opts.stacked ? barH : groups * (barH + 2) - 2)) / 2;
    const g = s("g", { class: "row" });
    g.append(text(f.m.left - 8, y0 + (opts.stacked ? barH : groups * (barH + 2) - 2) / 2 + 4, fitLabel(r.label, labelW - 10, opts.mono ? 6.6 : 6.4), { "text-anchor": "end", class: opts.mono ? "row-label mono" : "row-label" }));
    if (opts.stacked) {
      let acc = 0;
      r.values.forEach((v, j) => {
        if (!v) return;
        const x0 = x(acc) + (acc ? 1 : 0), x1 = x(acc + v) - 1;
        const last = r.values.slice(j + 1).every((n) => !n);
        g.append(s("path", { class: `bar sf-${opts.series[j]}`, d: last ? barPath(x0, y0, Math.max(1, x1 - x0 + 1), barH, "right") : `M${r1(x0)},${r1(y0)}h${r1(Math.max(1, x1 - x0))}v${barH}h${r1(-Math.max(1, x1 - x0))}Z` }));
        acc += v;
      });
      g.append(text(x(acc) + 6, y0 + barH / 2 + 4, fmt(acc), { class: "value" }));
    } else {
      r.values.forEach((v, j) => {
        const yy = y0 + j * (barH + 2);
        if (v > 0) g.append(s("path", { class: `bar sf-${opts.series[j]}`, d: barPath(x(0), yy, Math.max(2, x(v) - x(0)), barH, "right") }));
        if (v > 0 || j === 0) g.append(text(x(v) + 6, yy + barH / 2 + 4, fmt(v), { class: "value" }));
      });
    }
    const hitR = s("rect", { class: "hit-area", x: 0, y: rowTop, width: f.w, height: rowH });
    if (r.tip) hover(hitR, r.tip);
    g.append(hitR);
    return g;
  });
  return svgRoot(f,
    opts.title ? text(0, 14, opts.title, { class: "panel-title" }) : null,
    xGrid(f, x, niceTicks(0, xm, width < 480 ? 3 : 5), compact, opts.xLabel),
    marks,
  );
}

const schoolSeries = (g: Group) => 10 + GROUP_SERIES[g];
const schoolLegend = (groups: readonly Group[] = GROUPS): LegendItem[] => groups.map((g) => ({ label: GROUP_NAME[g], series: schoolSeries(g) }));

/** A stack-by-School bar chart (attack-patterns, status-mix). */
function schoolStack<K extends string>(rows: StackRow<K>[], w: number, xLabel: string, keyLabel: (k: K) => string): Drawn {
  return {
    svg: hbarsSvg(w, rows.map((r) => ({
      label: keyLabel(r.key),
      values: GROUPS.map((g) => r.counts[g]),
      tip: () => ({
        title: keyLabel(r.key),
        rows: GROUPS.filter((g) => r.counts[g]).map((g) => ({ label: GROUP_NAME[g], value: String(r.counts[g]), series: schoolSeries(g) })),
        note: GROUPS.filter((g) => r.counts[g]).map((g) => r.skills[g].join(", ")).join(" · ").slice(0, 260),
      }),
    })), { series: GROUPS.map(schoolSeries), stacked: true, xLabel, mono: true }),
  };
}

const stackTable = <K extends string>(rows: StackRow<K>[], first: string): TableData => ({
  head: [first, ...GROUPS.map((g) => GROUP_NAME[g]), "Total"],
  rows: rows.map((r) => [r.key, ...GROUPS.map((g) => r.counts[g]), GROUPS.reduce((a, g) => a + r.counts[g], 0)]),
});

// ---- the charts ------------------------------------------------------------------

const expC: ChartDef<ReturnType<typeof expCurve>> = {
  title: "EXP to the next level (expToNext)",
  load: () => expCurve(MAX_LEVEL),
  summary: (m) => `Line chart of EXP needed to go from each level to the next, levels 1 to ${m.length}, rising from ${fmt(m[0].toNext)} at level 1 to ${fmt(m[m.length - 1].toNext)} at level ${m.length}; ${fmt(m[m.length - 1].total)} EXP in all to reach level ${m.length + 1}. The four school Years are shaded.`,
  table: (m) => ({
    head: ["Level", "EXP to next", "Same-level kills", "Ref. monster EXP", "Total EXP so far"],
    rows: m.map((p) => [String(p.level), p.toNext, p.kills, p.monsterExp, p.total]),
  }),
  draw: (m, w) => lineChart(w, {
    series: [{ label: "EXP to next level", series: 1, points: m.map((p) => [p.level, p.toNext]) }],
    xDomain: [1, MAX_LEVEL], yMax: niceMax(Math.max(...m.map((p) => p.toNext))), xLabel: "Level", yLabel: "EXP", bands: BANDS,
    xTicks: levelTicks(w), valueFormat: (n) => `${fmt(n)} EXP`, tipTitle: (lv) => `Level ${lv} → ${lv + 1}`,
    extraRows: (i) => [
      { label: "intended same-level kills", value: fmt(m[i].kills) },
      { label: "EXP per reference monster", value: fmt(m[i].monsterExp) },
      { label: "total EXP so far", value: fmt(m[i].total) },
    ],
  }),
};

const matkC: ChartDef<ReturnType<typeof matkCurve>> = {
  title: "Magic attack: reference curve vs. the stat formula",
  load: async () => {
    const g = await gameModules();
    return matkCurve({ maxLevel: MAX_LEVEL, apPerLevel: AP_PER_LEVEL, start: g.newPlayer("Docs"), items: ITEMS, derive: g.derive });
  },
  summary: (m) => {
    const at = (lv: number) => m[lv - 1];
    return `Line chart of magic attack by level. Reference refMatk: ${at(10).ref} at level 10, ${at(30).ref} at 30, ${at(50).ref} at 50. Base formula with auto-assigned AP and no gear: ${at(10).base}, ${at(30).base}, ${at(50).base}. With the best buyable gear: ${at(10).geared}, ${at(30).geared}, ${at(50).geared}.`;
  },
  legend: () => [
    { label: "refMatk(level), the tuning target", series: 100, shape: "dash" },
    { label: "Base formula, auto-assigned AP, no gear", series: 1, shape: "line" },
    { label: "Base + best buyable gear", series: 2, shape: "line" },
  ],
  table: (m) => ({
    head: ["Level", "refMatk", "Base (no gear)", "With gear", "INT", "LUK", "Gear", "refSkillPct", "refHit"],
    rows: m.map((p) => [String(p.level), p.ref, p.base, p.geared, p.int, p.luk, p.gear.join(", ") || "—", p.refPct, Math.round(p.refHit)]),
    numeric: [false, true, true, true, true, true, false, true, true],
  }),
  draw: (m, w) => lineChart(w, {
    series: [
      { label: "refMatk", series: 100, dash: true, points: m.map((p) => [p.level, p.ref]) },
      { label: "Base", series: 1, points: m.map((p) => [p.level, p.base]) },
      { label: "With gear", series: 2, points: m.map((p) => [p.level, p.geared]) },
    ],
    xDomain: [1, MAX_LEVEL], yMax: niceMax(Math.max(...m.map((p) => Math.max(p.ref, p.geared)))), xLabel: "Level", yLabel: "Magic attack", bands: BANDS,
    xTicks: levelTicks(w), valueFormat: (n) => fmt(n), tipTitle: (lv) => `Level ${lv}`, endLabels: true,
    extraRows: (i) => [
      { label: "INT / LUK", value: `${m[i].int} / ${m[i].luk}` },
      { label: "gear", value: m[i].gear.join(", ") || "none" },
    ],
  }),
};

const hpC: ChartDef<ReturnType<typeof hpCurves>> = {
  title: "Reference HP and MP: player vs. monster",
  load: () => hpCurves(MAX_LEVEL),
  summary: (m) => {
    const at = (lv: number) => m[lv - 1];
    return `Line chart by level. Player max HP (refPlayerHp) ${at(1).playerHp} at level 1 and ${at(50).playerHp} at 50; player MP ${at(1).playerMp} to ${at(50).playerMp}; normal monster HP (refMonsterHp) ${at(1).monsterHp} to ${at(50).monsterHp}. A same-level monster's touch kills a reference player in ${at(1).hitsToDie} hits at level 1 and ${at(50).hitsToDie} at level 50.`;
  },
  legend: () => [
    { label: "Monster HP (refMonsterHp)", series: 2, shape: "line" },
    { label: "Player max HP (refPlayerHp)", series: 1, shape: "line" },
    { label: "Player max MP (refPlayerMp)", series: 3, shape: "dash" },
  ],
  table: (m) => ({
    head: ["Level", "Monster HP", "Player HP", "Player MP", "Monster touch", "Touches to KO", "Primary casts to kill"],
    rows: m.map((p) => [String(p.level), p.monsterHp, p.playerHp, p.playerMp, p.touch, p.hitsToDie, p.castsToKill]),
  }),
  draw: (m, w) => lineChart(w, {
    series: [
      { label: "Monster HP", series: 2, points: m.map((p) => [p.level, p.monsterHp]) },
      { label: "Player HP", series: 1, points: m.map((p) => [p.level, p.playerHp]) },
      { label: "Player MP", series: 3, dash: true, points: m.map((p) => [p.level, p.playerMp]) },
    ],
    xDomain: [1, MAX_LEVEL], yMax: niceMax(Math.max(...m.map((p) => p.monsterHp))), xLabel: "Level", yLabel: "Points", bands: BANDS,
    xTicks: levelTicks(w), valueFormat: (n) => fmt(n), tipTitle: (lv) => `Level ${lv}`, endLabels: true,
    extraRows: (i) => [
      { label: "monster touch damage", value: fmt(m[i].touch) },
      { label: "touches to knock out the player", value: fmt(m[i].hitsToDie) },
    ],
  }),
};

const kindSeries = (i: number) => i + 1;
const spellsC: ChartDef<ReturnType<typeof spellsByYear>> = {
  title: "Spells per School and Year, by kind",
  load: async () => spellsByYear((await gameModules()).skills, JOBS),
  summary: (m) => {
    const total = (r: (typeof m)[number]) => KINDS.reduce((a, k) => a + r.counts[k], 0);
    return `Stacked bar chart of ${m.reduce((a, r) => a + total(r), 0)} spells: ${m.map((r) => `${r.label} ${total(r)}`).join(", ")}. Kinds: ${KINDS.map((k) => `${k} ${m.reduce((a, r) => a + r.counts[k], 0)}`).join(", ")}.`;
  },
  legend: () => KINDS.map((k, i) => ({ label: cap(k), series: kindSeries(i) })),
  table: (m) => ({ head: ["School · Year", ...KINDS.map(cap), "Total"], rows: m.map((r) => [r.label, ...KINDS.map((k) => r.counts[k]), KINDS.reduce((a, k) => a + r.counts[k], 0)]) }),
  draw: (m, w) => ({
    svg: hbarsSvg(w, m.map((r, i) => ({
      label: r.label, gapBefore: i > 0 && r.year === 2,
      values: KINDS.map((k) => r.counts[k]),
      tip: () => ({ title: r.label, rows: KINDS.filter((k) => r.counts[k]).map((k) => ({ label: `${k}: ${r.skills[k].join(", ")}`, value: String(r.counts[k]), series: kindSeries(KINDS.indexOf(k)) })) }),
    })), { series: KINDS.map((_, i) => kindSeries(i)), stacked: true, xLabel: "Spells" }),
  }),
};

const budgetsC: ChartDef<ReturnType<typeof schoolBudgets>> = {
  title: "Damage per cast at max level (% of magic attack on one target)",
  load: async () => schoolBudgets((await gameModules()).skills, JOBS),
  summary: (m) => {
    const parts = GROUPS.map((g) => {
      const ps = m.points.filter((p) => p.group === g);
      const top = ps.reduce((a, p) => (p.pct > a.pct ? p : a), ps[0]);
      return top ? `${GROUP_NAME[g]} ${ps.length} spells, highest ${top.name} ${fmt(top.pct)}%` : "";
    }).filter(Boolean);
    return `Dot plot on a logarithmic scale of ${m.points.length} attack and summon spells at their max level: damage % × hit lines landed on one target by one cast (summons: over their whole duration). ${parts.join("; ")}.`;
  },
  legend: () => [
    ...[1, 2, 3, 4].map((y) => ({ label: `Year ${y}`, series: y, shape: "dot" as const })),
    { label: "Hollow: summon (whole duration)", series: 100, shape: "dot" as const },
  ],
  table: (m) => ({
    head: ["Spell", "School", "Year", "Pattern", "Max lv", "Damage %", "Hits", "% per target per cast", "Max targets", "Projectiles / impacts", "Cooldown", "MP"],
    rows: [...m.points].sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.year - b.year || b.pct - a.pct)
      .map((p) => [p.name, GROUP_NAME[p.group], p.year, p.kind === "summon" ? `summon: ${p.pattern} ×${p.attacks}` : p.pattern, p.maxLevel, p.damagePct, p.hits, Math.round(p.pct), p.maxTargets, p.count, sec(p.cooldownMs), Math.round(p.mp)]),
    numeric: [false, false, true, false, true, true, true, true, true, true, false, true],
  }),
  draw: (m, w) => {
    const labelW = w < 480 ? 74 : 118;
    const laneH = 13, rowPad = 10;
    const rows = GROUPS.map((g) => ({ g, years: g === "core" ? [1] : [2, 3, 4] }));
    const rowHs = rows.map((r) => r.years.length * laneH + rowPad * 2);
    const H = rowHs.reduce((a, b) => a + b, 0) + 48;
    const f = frame(w, H, { left: labelW, right: 18, top: 8, bottom: 40 });
    const min = Math.max(1, Math.min(...m.points.map((p) => p.pct)));
    const max = Math.max(...m.points.map((p) => p.pct));
    const lo = 10 ** Math.floor(Math.log10(min)), hi = 10 ** Math.ceil(Math.log10(max));
    const x = logScale([lo, hi], [f.m.left, f.m.left + f.iw]);
    const els: SVGElement[] = [];
    for (const t of logTicks(lo, hi)) {
      els.push(s("line", { class: t === lo ? "baseline" : "grid", x1: r1(x(t)), x2: r1(x(t)), y1: f.m.top, y2: f.m.top + f.ih }));
      if (w >= 480 || String(t)[0] !== "2") els.push(text(x(t), f.m.top + f.ih + 16, `${compact(t)}%`, { "text-anchor": "middle" }));
    }
    els.push(text(f.m.left + f.iw / 2, H - 4, "% of matk per target per cast (log scale)", { class: "axis-label", "text-anchor": "middle" }));
    let y0 = f.m.top;
    rows.forEach((r, i) => {
      const hgt = rowHs[i];
      els.push(s("rect", { class: `band${i % 2 ? " alt" : ""}`, x: 0, y: r1(y0), width: w, height: hgt }));
      els.push(text(labelW - 8, y0 + hgt / 2 + 4, w < 480 && r.g === "core" ? "Core" : GROUP_NAME[r.g], { class: "row-label", "text-anchor": "end" }));
      r.years.forEach((yr, li) => {
        const cy = y0 + rowPad + li * laneH + laneH / 2;
        for (const p of m.points.filter((q) => q.group === r.g && q.year === yr)) {
          const g = s("g", {},
            s("circle", { class: p.kind === "summon" ? `dot hollow sk-${yr}` : `dot sf-${yr}`, cx: r1(x(p.pct)), cy: r1(cy), r: 4.5 }),
            s("circle", { class: "hit-area", cx: r1(x(p.pct)), cy: r1(cy), r: 8 }),
          );
          hover(g, () => ({
            title: `${p.name} (${GROUP_NAME[p.group]}, Year ${p.year})`,
            rows: [
              { label: "% of matk per target per cast", value: `${fmt(Math.round(p.pct))}%`, series: p.year },
              { label: p.kind === "summon" ? `summon ${p.pattern}, attacks over its duration` : `${p.pattern}, damage % × hits`, value: p.kind === "summon" ? `${p.damagePct}% × ${p.hits} × ${p.attacks}` : `${p.damagePct}% × ${p.hits}` },
              { label: "max targets", value: String(p.maxTargets) },
              ...(p.count > 1 ? [{ label: p.pattern === "rain" ? "impacts per cast" : "projectiles per cast", value: String(p.count) }] : []),
              { label: "cooldown · MP", value: `${sec(p.cooldownMs)} · ${Math.round(p.mp)}` },
            ],
            note: `Max level ${p.maxLevel}`,
          }));
          els.push(g);
        }
      });
      y0 += hgt;
    });
    return { svg: svgRoot(f, els) };
  },
};

const PATTERN_LABEL: Record<string, string> = { projectile: "projectile", melee_arc: "melee_arc", aoe_self: "aoe_self", aoe_target: "aoe_target", chain: "chain", beam: "beam", rain: "rain" };
const patternsC: ChartDef<ReturnType<typeof attackPatterns>> = {
  title: "Attack patterns used by each School",
  load: async () => attackPatterns((await gameModules()).skills, JOBS),
  summary: (m) => `Stacked bar chart of spells (attacks and summons' attacks) per attack pattern: ${m.map((r) => `${r.key} ${GROUPS.reduce((a, g) => a + r.counts[g], 0)}`).join(", ")}, split by School.`,
  legend: () => schoolLegend(),
  table: (m) => stackTable(m, "Pattern"),
  draw: (m, w) => schoolStack(m, w, "Spells", (k) => PATTERN_LABEL[k] ?? k),
};

const statusC: ChartDef<ReturnType<typeof statusMix>> = {
  title: "Statuses each School can apply",
  load: async () => statusMix((await gameModules()).skills, JOBS),
  summary: (m) => `Stacked bar chart of spells that can apply each status: ${m.map((r) => `${r.key} ${GROUPS.reduce((a, g) => a + r.counts[g], 0)} (${GROUPS.filter((g) => r.counts[g]).map((g) => `${GROUP_NAME[g]} ${r.counts[g]}`).join(", ") || "none"})`).join("; ")}.`,
  legend: () => schoolLegend(),
  table: (m) => stackTable(m, "Status"),
  draw: (m, w) => schoolStack(m, w, "Spells", (k) => k),
};

const levelsC: ChartDef<ReturnType<typeof monsterLevels>> = {
  title: "Monster levels by zone",
  load: () => monsterLevels(MAPS, MONSTERS, FIELD_IDS),
  summary: (m) => `Dot plot of monster level per zone with each zone's level range: ${m.map((z) => `${z.name} (levels ${z.range[0]}–${z.range[1]}): ${z.monsters.map((x) => `${x.name} ${x.level}${x.role !== "normal" ? ` (${ROLE_NAME[x.role].toLowerCase()})` : ""}`).join(", ")}`).join("; ")}.`,
  legend: () => [
    { label: "Monster", series: ROLE_SERIES.normal, shape: "dot" },
    { label: "Field boss", series: ROLE_SERIES.field, shape: "dot" },
    { label: "Final boss", series: ROLE_SERIES.final, shape: "dot" },
    { label: "Zone level range", series: 99, shape: "rect" },
  ],
  table: (m) => ({
    head: ["Zone", "Range", "Monster", "Level", "Role", "HP", "EXP", "Spawned", "Weak", "Resists"],
    rows: m.flatMap((z) => z.monsters.map((x) => [z.name, `${z.range[0]}–${z.range[1]}`, x.name, x.level, ROLE_NAME[x.role], x.hp, x.exp, x.count, x.weak.join(", ") || "—", x.resist.join(", ") || "—"])),
    numeric: [false, false, false, true, false, true, true, true, false, false],
  }),
  draw: (m, w) => {
    const labelW = w < 480 ? 92 : 132;
    const rowH = 34;
    const H = m.length * rowH + 52;
    const f = frame(w, H, { left: labelW, right: 16, top: 22, bottom: 40 });
    const x = linear([0, MAX_LEVEL], [f.m.left, f.m.left + f.iw]);
    const els: SVGElement[] = [...yearBandEls(x, 4, f.ih + 18, BANDS, w < 480)];
    for (const t of niceTicks(0, MAX_LEVEL, w < 480 ? 5 : 10)) {
      els.push(s("line", { class: t === 0 ? "baseline" : "grid", x1: r1(x(t)), x2: r1(x(t)), y1: f.m.top, y2: f.m.top + f.ih }));
      els.push(text(x(t), f.m.top + f.ih + 16, String(t), { "text-anchor": "middle" }));
    }
    els.push(text(f.m.left + f.iw / 2, H - 4, "Monster level", { class: "axis-label", "text-anchor": "middle" }));
    m.forEach((z, i) => {
      const cy = f.m.top + i * rowH + rowH / 2;
      els.push(text(labelW - 8, cy + 4, fitLabel(z.name, labelW - 10), { class: "row-label", "text-anchor": "end" }));
      els.push(s("rect", { class: "range sk-99", x: r1(x(z.range[0])), y: r1(cy - 7), width: r1(x(z.range[1]) - x(z.range[0])), height: 14, rx: 7 }));
      const seenLv = new Map<number, number>();
      for (const mo of z.monsters) {
        const k = seenLv.get(mo.level) ?? 0;
        seenLv.set(mo.level, k + 1);
        const g = s("g", {},
          s("circle", { class: `dot sf-${ROLE_SERIES[mo.role]}`, cx: r1(x(mo.level)), cy: r1(cy + (k ? 6 * k : 0)), r: mo.role === "normal" ? 5 : 6.5 }),
          s("circle", { class: "hit-area", cx: r1(x(mo.level)), cy: r1(cy), r: 9 }),
        );
        hover(g, () => ({
          title: `${mo.name} (level ${mo.level})`,
          rows: [
            { label: ROLE_NAME[mo.role].toLowerCase(), value: z.name, series: ROLE_SERIES[mo.role] },
            { label: "HP · EXP", value: `${fmt(mo.hp)} · ${fmt(mo.exp)}` },
            { label: "weak · resists", value: `${mo.weak.join(", ") || "—"} · ${mo.resist.join(", ") || "—"}` },
          ],
          note: `Zone range ${z.range[0]}–${z.range[1]}`,
        }));
        els.push(g);
      }
    });
    return { svg: svgRoot(f, els) };
  },
};

const hpDotsC: ChartDef<ReturnType<typeof monsterHp>> = {
  title: "Monster HP against the reference curve",
  load: () => monsterHp(MONSTERS, FIELD_IDS),
  summary: (m) => {
    const normal = m.filter((d) => d.role === "normal");
    const muls = normal.map((d) => d.mul);
    return `Scatter plot on a logarithmic HP scale of ${m.length} monsters by level. Normal monsters sit between ×${Math.min(...muls)} and ×${Math.max(...muls)} of refMonsterHp; field bosses ${m.filter((d) => d.role === "field").map((d) => `${d.name} ×${d.mul}`).join(", ")}; the final boss ${m.filter((d) => d.role === "final").map((d) => `${d.name} ×${d.mul} (${fmt(d.hp)} HP)`).join(", ")}.`;
  },
  legend: () => [
    { label: "refMonsterHp(level)", series: 100, shape: "dash" },
    { label: "Monster", series: ROLE_SERIES.normal, shape: "dot" },
    { label: "Field boss", series: ROLE_SERIES.field, shape: "dot" },
    { label: "Final boss", series: ROLE_SERIES.final, shape: "dot" },
  ],
  table: (m) => ({
    head: ["Monster", "Level", "Role", "HP", "refMonsterHp", "× ref", "EXP", "Touch"],
    rows: m.map((d) => [d.name, d.level, ROLE_NAME[d.role], d.hp, d.ref, d.mul, d.exp, d.touch]),
    numeric: [false, true, false, true, true, true, true, true],
  }),
  draw: (m, w) => {
    const h = Math.round(Math.max(280, Math.min(400, w * 0.58)));
    const f = frame(w, h, { left: 58, right: 16, top: 22, bottom: 44 });
    const x = linear([0, MAX_LEVEL], [f.m.left, f.m.left + f.iw]);
    const lo = 10 ** Math.floor(Math.log10(Math.min(...m.map((d) => Math.min(d.hp, d.ref)))));
    const hi = 10 ** Math.ceil(Math.log10(Math.max(...m.map((d) => d.hp))));
    const y = logScale([lo, hi], [f.m.top + f.ih, f.m.top]);
    const els: SVGElement[] = [...yearBandEls(x, 4, f.ih + 18, BANDS, w < 480)];
    for (const t of logTicks(lo, hi)) {
      els.push(s("line", { class: t === lo ? "baseline" : "grid", x1: f.m.left, x2: f.m.left + f.iw, y1: r1(y(t)), y2: r1(y(t)) }));
      els.push(text(f.m.left - 6, y(t) + 4, compact(t), { "text-anchor": "end" }));
    }
    els.push(text(12, f.m.top + f.ih / 2, "HP (log scale)", { class: "axis-label", transform: `rotate(-90 12 ${r1(f.m.top + f.ih / 2)})`, "text-anchor": "middle" }));
    els.push(xAxis(f, x, levelTicks(w).filter((t) => t > 1).concat([0]).sort((a, b) => a - b), "Level"));
    const ref: string[] = [];
    for (let lv = 1; lv <= MAX_LEVEL; lv++) ref.push(`${lv === 1 ? "M" : "L"}${r1(x(lv))},${r1(y(refMonsterHp(lv)))}`);
    els.push(s("path", { class: "line dash sk-100", d: ref.join("") }));
    for (const d of m) {
      const g = s("g", {},
        s("circle", { class: `dot sf-${ROLE_SERIES[d.role]}`, cx: r1(x(d.level)), cy: r1(y(d.hp)), r: d.role === "normal" ? 4.5 : 6 }),
        s("circle", { class: "hit-area", cx: r1(x(d.level)), cy: r1(y(d.hp)), r: 9 }),
      );
      hover(g, () => ({
        title: `${d.name} (level ${d.level})`,
        rows: [
          { label: "HP", value: fmt(d.hp), series: ROLE_SERIES[d.role] },
          { label: "refMonsterHp", value: fmt(d.ref), series: 100, dash: true },
          { label: "× reference", value: `×${d.mul}` },
        ],
        note: ROLE_NAME[d.role],
      }));
      els.push(g);
    }
    return { svg: svgRoot(f, els) };
  },
};
function highlight(edges: SVGGElement, nodes: SVGGElement, id: string | null, neighbours: string[]) {
  edges.parentElement?.classList.toggle("focus", !!id);
  for (const e of Array.from(edges.children)) e.classList.toggle("on", !!id && (e.getAttribute("data-a") === id || e.getAttribute("data-b") === id));
  const near = new Set([id, ...neighbours]);
  for (const n of Array.from(nodes.children)) n.classList.toggle("on", !!id && near.has(n.getAttribute("data-id")));
}

const mapsC: ChartDef<ReturnType<typeof mapGraph>> = {
  title: "Maps and the portals between them",
  load: () => mapGraph(MAPS, MONSTERS),
  summary: (m) => `Node-link diagram of ${m.nodes.length} maps and ${m.edges.length} portal connections: ${m.edges.map((e) => `${m.nodes.find((n) => n.id === e.a)!.name} – ${m.nodes.find((n) => n.id === e.b)!.name}`).join(", ")}.`,
  legend: () => [
    { label: "Safe town", series: 3, shape: "rect" },
    { label: "Field zone", series: 1, shape: "rect" },
    { label: "Boss / arena", series: 2, shape: "rect" },
    { label: "Two-way portals", series: 99, shape: "line" },
    { label: "One-way portal", series: 99, shape: "dash" },
  ],
  table: (m) => ({
    head: ["Map", "Id", "Region", "Levels", "Size (px)", "Monsters", "NPCs", "Portals to"],
    rows: m.nodes.map((n) => [n.name, n.id, n.region, n.safe ? "safe" : `${n.range[0]}–${n.range[1]}`, `${n.width}×${n.height}`, n.monsters.join(", ") || "—", n.npcs,
      m.edges.filter((e) => e.a === n.id || e.b === n.id).map((e) => (e.a === n.id ? e.b : e.a)).join(", ")]),
    numeric: [false, false, false, false, false, false, true, false],
  }),
  draw: (m) => {
    const colW = 196, rowH = 112, nw = 168, nh = 64, pad = 24;
    const lay = layoutMapGraph(m, START_MAP, colW, rowH);
    const arc = 56; // room above the top row for edges that skip over maps
    const W = lay.cols * colW + pad * 2 - (colW - nw), H = lay.rows * rowH + pad * 2 + arc - (rowH - nh);
    const at = new Map(lay.placed.map((p) => [p.id, { x: pad + p.x, y: pad + arc + p.y }]));
    const kind = (n: (typeof m.nodes)[number]) => (n.safe ? 3 : n.arena ? 2 : 1);
    const edgeEls = m.edges.map((e) => {
      const a = at.get(e.a)!, b = at.get(e.b)!;
      const sameRow = a.y === b.y;
      const [p, q] = a.x <= b.x ? [a, b] : [b, a];
      const adjacent = Math.abs(a.x - b.x) <= colW + 1;
      const d = sameRow && adjacent
        ? `M${r1(p.x + nw)},${r1(p.y + nh / 2)}L${r1(q.x)},${r1(q.y + nh / 2)}`
        : sameRow // skips over maps in between: arc above the row
          ? `M${r1(p.x + nw * 0.7)},${r1(p.y)}C${r1(p.x + nw * 0.7)},${r1(p.y - arc)} ${r1(q.x + nw * 0.3)},${r1(q.y - arc)} ${r1(q.x + nw * 0.3)},${r1(q.y)}`
          : `M${r1(a.x + nw / 2)},${r1(Math.min(a.y, b.y) + nh)}L${r1(b.x + nw / 2)},${r1(Math.max(a.y, b.y))}`;
      const el = s("path", { class: `edge${e.oneWay ? " dash" : ""}`, d, "stroke-width": 2.5, "data-a": e.a, "data-b": e.b });
      hover(el, () => ({ title: `${m.nodes.find((n) => n.id === e.a)!.name} ↔ ${m.nodes.find((n) => n.id === e.b)!.name}`, rows: e.portals.map((p) => ({ label: "portal", value: p })) }));
      return el;
    });
    const edgeG = s("g", { class: "edges" }, edgeEls);
    const nodeEls = m.nodes.map((n) => {
      const p = at.get(n.id)!;
      const near = m.edges.filter((e) => e.a === n.id || e.b === n.id).map((e) => (e.a === n.id ? e.b : e.a));
      const g = s("g", { class: "node", "data-id": n.id },
        s("rect", { x: r1(p.x), y: r1(p.y), width: nw, height: nh, rx: 6, class: `node-box nb-${kind(n)}` }),
        text(p.x + nw / 2, p.y + 19, fitLabel(n.name, nw - 12, 7.2), { "text-anchor": "middle", class: "node-label strong" }),
        text(p.x + nw / 2, p.y + 36, n.safe ? `safe · ${n.theme}` : `Lv ${n.range[0]}–${n.range[1]} · ${n.theme}`, { "text-anchor": "middle", class: "node-sub" }),
        text(p.x + nw / 2, p.y + 52, n.monsters.length ? `${n.monsters.length} monster${n.monsters.length === 1 ? "" : "s"} · ${compact(n.width)} px` : `${n.npcs} NPCs · ${compact(n.width)} px`, { "text-anchor": "middle", class: "node-sub" }),
      );
      hover(g, () => ({
        title: `${n.name} (${n.id})`,
        rows: [
          { label: "region", value: n.region },
          { label: "monsters", value: n.monsters.join(", ") || "none" },
          { label: "portals to", value: near.map((id) => m.nodes.find((x) => x.id === id)!.name).join(", ") || "nowhere" },
        ],
        note: `${n.width}×${n.height} px · ${n.npcs} NPCs`,
      }));
      g.addEventListener("pointerenter", () => highlight(edgeG, nodesG, n.id, near));
      g.addEventListener("pointerleave", () => highlight(edgeG, nodesG, null, []));
      return g;
    });
    const nodesG = s("g", { class: "nodes" }, nodeEls);
    return { svg: s("svg", { class: "chart-svg graph", width: W, height: H, viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" }, edgeG, nodesG), graph: { w: W, h: H } };
  },
};

const modulesC: ChartDef<SourceStats> = {
  title: "Imports between the top-level folders of src/",
  load: sourceStats,
  summary: (m) => {
    const lay = layoutModuleGraph(m);
    const fanIn = new Map<string, number>();
    for (const e of m.edges) fanIn.set(e.to, (fanIn.get(e.to) ?? 0) + e.count);
    const top = [...fanIn].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(", ");
    return `Layered node-link diagram of ${m.folders.length} folders and ${m.edges.length} folder-to-folder import links (${m.edges.reduce((a, e) => a + e.count, 0)} import statements) in ${lay.layers.length} layers. Most imported: ${top}. ${lay.back.length} links point upwards (cycles between folders). The documentation pages (${m.excluded.join(", ")}) are left out.`;
  },
  legend: () => [{ label: "Imports downwards (thicker = more import statements)", series: 99, shape: "line" }, { label: "Imports upwards (closes a cycle)", series: 98, shape: "dash" }],
  table: (m) => ({
    head: ["Folder", "Files", "Lines", "Imports from (statements)"],
    rows: m.folders.map((f) => [f.folder === "main" ? "main.ts" : `${f.folder}/`, f.files, f.lines, m.edges.filter((e) => e.from === f.folder).map((e) => `${e.to} ${e.count}`).join(", ") || "—"]),
    numeric: [false, true, true, false],
  }),
  draw: (m) => {
    const lay = layoutModuleGraph(m);
    const colW = 168, rowH = 92, nw = 128, nh = 42, pad = 24;
    const W = lay.cols * colW + pad * 2, H = lay.layers.length * rowH + pad * 2 - (rowH - nh);
    const top = lay.layers.length - 1;
    const at = new Map(lay.nodes.map((n) => [n.id, { x: pad + n.col * colW + (colW - nw) / 2, y: pad + (top - n.layer) * rowH, n }]));
    const back = new Set(lay.back.map((b) => `${b.from}>${b.to}`));
    const edgeEls = m.edges.filter((e) => at.has(e.from) && at.has(e.to)).map((e) => {
      const a = at.get(e.from)!, b = at.get(e.to)!;
      const up = back.has(`${e.from}>${e.to}`);
      const x1 = a.x + nw / 2 + (up ? 10 : 0), y1 = up ? a.y : a.y + nh;
      const x2 = b.x + nw / 2 + (up ? 10 : 0), y2 = up ? b.y + nh : b.y;
      const dy = Math.max(30, Math.abs(y2 - y1) * 0.45);
      const d = up
        ? `M${r1(x1)},${r1(y1)}C${r1(x1 + 40)},${r1(y1 - dy)} ${r1(x2 + 40)},${r1(y2 + dy)} ${r1(x2)},${r1(y2)}`
        : `M${r1(x1)},${r1(y1)}C${r1(x1)},${r1(y1 + dy)} ${r1(x2)},${r1(y2 - dy)} ${r1(x2)},${r1(y2)}`;
      const el = s("path", { class: `edge${up ? " dash up" : ""}`, d, "stroke-width": r1(1 + Math.log2(e.count + 1) * 0.9), "marker-end": "url(#devdocs-arrow)", "data-a": e.from, "data-b": e.to });
      hover(el, () => ({ title: `${e.from} → ${e.to}`, rows: [{ label: "import statements", value: String(e.count) }], note: up ? "Points upwards: part of an import cycle between folders" : undefined }));
      return el;
    });
    const edgeG = s("g", { class: "edges" }, edgeEls);
    const nodeEls = lay.nodes.map((n) => {
      const p = at.get(n.id)!;
      const outs = m.edges.filter((e) => e.from === n.id);
      const ins = m.edges.filter((e) => e.to === n.id);
      const g = s("g", { class: "node", "data-id": n.id },
        s("rect", { x: r1(p.x), y: r1(p.y), width: nw, height: nh, rx: 6, class: `node-box nb-${n.id === "core" ? 2 : 1}` }),
        text(p.x + nw / 2, p.y + 17, n.id === "main" ? "main.ts" : `${n.id}/`, { "text-anchor": "middle", class: "node-label strong mono" }),
        text(p.x + nw / 2, p.y + 33, `${n.files} file${n.files === 1 ? "" : "s"} · ${compact(n.lines)} lines`, { "text-anchor": "middle", class: "node-sub" }),
      );
      hover(g, () => ({
        title: n.id === "main" ? "src/main.ts" : `src/${n.id}/`,
        rows: [
          { label: "imports from", value: outs.map((e) => e.to).join(", ") || "nothing" },
          { label: "imported by", value: ins.map((e) => e.from).join(", ") || "nothing" },
        ],
        note: `${n.files} files, ${fmt(n.lines)} lines · layer ${n.layer}`,
      }));
      g.addEventListener("pointerenter", () => highlight(edgeG, nodesG, n.id, [...outs.map((e) => e.to), ...ins.map((e) => e.from)]));
      g.addEventListener("pointerleave", () => highlight(edgeG, nodesG, null, []));
      return g;
    });
    const nodesG = s("g", { class: "nodes" }, nodeEls);
    const defs = s("defs", {}, s("marker", { id: "devdocs-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse", markerUnits: "userSpaceOnUse" }, s("path", { d: "M0,0L10,5L0,10z", class: "arrow-head" })));
    return { svg: s("svg", { class: "chart-svg graph", width: W, height: H, viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" }, defs, edgeG, nodesG), graph: { w: W, h: H } };
  },
};

const countsC: ChartDef<ReturnType<typeof contentCounts>> = {
  title: "What the game is made of",
  load: async () => {
    const [g, stats] = await Promise.all([gameModules(), sourceStats()]);
    return contentCounts({
      skills: g.skills.length, monsters: MONSTERS.length, fieldBosses: FIELD_IDS.size, maps: MAPS.length, items: ITEMS.length,
      quests: QUESTS.length + STORY_QUESTS.length, npcs: NPCS.length, jobs: JOBS.length,
    }, stats);
  },
  summary: (m) => `Bar charts. Game content: ${m.content.map((c) => `${c.value} ${c.label.toLowerCase()}`).join(", ")}. Lines of TypeScript per src/ folder: ${m.lines.map((t) => `${t.label} ${fmt(t.value)}`).join(", ")}, ${fmt(m.lines.reduce((a, t) => a + t.value, 0))} in all.`,
  table: (m) => ({ head: ["What", "Count"], rows: [...m.content.map((c) => [c.label, c.value]), ...m.lines.map((t) => [`Lines: src/${t.label}`, t.value])] }),
  draw: (m, w) => {
    const two = w >= 760;
    const pw = two ? (w - 32) / 2 : w;
    const panel = (title: string, rows: Count[], series: number, mono = false) =>
      hbarsSvg(pw, rows.map((c) => ({ label: c.label, values: [c.value], tip: () => ({ title: c.label, rows: [{ label: title.toLowerCase(), value: fmt(c.value) }] }) })), { series: [series], title, rowH: 24, mono });
    const a = panel("Game content", m.content, 1);
    const b = panel(`Lines of TypeScript by folder (${fmt(m.lines.reduce((x, t) => x + t.value, 0))})`, m.lines, 3, true);
    const ha = Number(a.getAttribute("height")), hb = Number(b.getAttribute("height"));
    b.setAttribute("x", two ? String(pw + 32) : "0");
    b.setAttribute("y", two ? "0" : String(ha + 16));
    const H = two ? Math.max(ha, hb) : ha + hb + 16;
    return { svg: svgRoot(frame(w, H, { left: 0, right: 0, top: 0, bottom: 0 }), a, b) };
  },
};

export const CHARTS: Record<ChartName, ChartDef<any>> = {
  "exp-curve": expC,
  "matk-curve": matkC,
  "hp-curves": hpC,
  "spells-by-year": spellsC,
  "school-budgets": budgetsC,
  "attack-patterns": patternsC,
  "status-mix": statusC,
  "monster-levels": levelsC,
  "monster-hp": hpDotsC,
  "map-graph": mapsC,
  "module-graph": modulesC,
  "content-counts": countsC,
};

// ---- mounting ------------------------------------------------------------------

interface Mounted { fig: HTMLElement; name: ChartName; state: "idle" | "loading" | "done"; done?: Promise<void> }
const mounted: Mounted[] = [];

function btn(label: string, title: string, onClick: (b: HTMLButtonElement) => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "tool-btn";
  b.textContent = label;
  b.title = title;
  b.addEventListener("click", () => onClick(b));
  return b;
}

async function render(mt: Mounted): Promise<void> {
  const { fig, name } = mt;
  const def = CHARTS[name];
  const box = fig.querySelector<HTMLElement>(".chart-box")!;
  try {
    const model = await def.load();
    box.setAttribute("aria-label", `${def.title}. ${def.summary(model)}`);
    if (def.legend) fig.querySelector(".chart-legend-slot")!.replaceChildren(legend(def.legend(model)));
    fig.querySelector<HTMLElement>(".chart-table")!.replaceChildren(dataTable(def.table(model), def.title));
    fig.querySelector<HTMLButtonElement>(".show-data")!.hidden = false;
    let pz: PanZoom | null = null;
    let lastW = 0;
    const draw = () => {
      const w = Math.max(280, Math.floor(box.clientWidth));
      if (w === lastW) return;
      lastW = w;
      const out = def.draw(model, w);
      if (out.graph) {
        const viewport = document.createElement("div");
        viewport.className = "graph-port";
        viewport.tabIndex = 0;
        viewport.setAttribute("aria-label", `${def.title}: drag to pan, Ctrl or ⌘ + scroll to zoom`);
        const stage = document.createElement("div");
        stage.append(out.svg);
        viewport.append(stage);
        // As tall as the graph at fit-to-width, within limits.
        const fitW = Math.min(1, w / out.graph.w);
        viewport.style.height = `${Math.round(Math.max(220, Math.min(out.graph.h * fitW + 16, Math.min(720, innerHeight * 0.8))))}px`;
        box.replaceChildren(viewport, zoomTools(() => pz, [btn("⤢", "Open full screen", () => openViewer(out.svg, out.graph!, def.title))]));
        pz = panZoom(viewport, stage, out.graph, { wheel: "modifier", fitMax: 1 });
        pz.fit();
      } else {
        box.replaceChildren(out.svg);
      }
    };
    draw();
    let t = 0;
    new ResizeObserver(() => { clearTimeout(t); t = window.setTimeout(draw, 120); }).observe(box);
  } catch (e) {
    console.error(`[devdocs] chart "${name}" failed`, e);
    const p = document.createElement("p");
    p.className = "chart-error";
    p.textContent = `This chart could not be drawn (${e instanceof Error ? e.message : String(e)}).`;
    box.replaceChildren(p);
    box.removeAttribute("role");
  }
  mt.state = "done";
}

function start(mt: Mounted): Promise<void> {
  if (mt.state === "idle") { mt.state = "loading"; mt.done = render(mt); }
  return mt.done ?? Promise.resolve();
}

const io = typeof IntersectionObserver !== "undefined"
  ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io!.unobserve(e.target);
      const mt = mounted.find((x) => x.fig === e.target);
      if (mt) void start(mt);
    }
  }, { rootMargin: "400px 0px" })
  : null;

/** Turn every `figure[data-chart]` under `root` into a lazily drawn chart. Unknown names show an error box. */
export function mountCharts(root: ParentNode): void {
  for (const fig of Array.from(root.querySelectorAll<HTMLElement>("figure[data-chart]"))) {
    const name = fig.dataset.chart as ChartName;
    const def = CHARTS[name];
    fig.classList.add("chart");
    const head = document.createElement("div");
    head.className = "chart-head";
    const title = document.createElement("p");
    title.className = "chart-title";
    title.textContent = def ? def.title : `Unknown chart "${name}"`;
    const tools = document.createElement("div");
    tools.className = "chart-tools";
    const table = document.createElement("div");
    table.className = "chart-table table-scroll";
    table.hidden = true;
    const toggle = btn("Show data", "Show the chart's data as a table", (b) => {
      table.hidden = !table.hidden;
      b.textContent = table.hidden ? "Show data" : "Hide data";
      b.setAttribute("aria-expanded", String(!table.hidden));
    });
    toggle.classList.add("show-data");
    toggle.setAttribute("aria-expanded", "false");
    toggle.hidden = true;
    tools.append(toggle);
    head.append(title, tools);
    const legendSlot = document.createElement("div");
    legendSlot.className = "chart-legend-slot";
    const box = document.createElement("div");
    box.className = "chart-box";
    box.setAttribute("role", "img");
    box.setAttribute("aria-label", def ? def.title : "Unknown chart");
    const caption = fig.querySelector("figcaption");
    fig.replaceChildren(head, legendSlot, box, table, ...(caption ? [caption] : []));
    if (!def) {
      box.textContent = `There is no chart named "${name}" (see src/devdocs/CONTRACT.md).`;
      box.classList.add("chart-error");
      continue;
    }
    const placeholder = document.createElement("p");
    placeholder.className = "chart-wait";
    placeholder.textContent = "Drawing…";
    box.append(placeholder);
    const mt: Mounted = { fig, name, state: "idle" };
    mounted.push(mt);
    if (io) io.observe(fig); else void start(mt);
  }
}

/** Draw every chart now (before printing). */
export async function renderAllCharts(): Promise<void> {
  await Promise.all(mounted.map(start));
}
