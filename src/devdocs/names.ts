// Names the content contract (src/devdocs/CONTRACT.md) promises writers.
// No imports: the fragment validator (validate.ts) and the Node checker
// (check.mjs) load this file directly.

/** Every `<figure data-chart="NAME">` the page can draw (CONTRACT.md § Charts). */
export const CHART_NAMES = [
  "exp-curve",
  "matk-curve",
  "hp-curves",
  "spells-by-year",
  "school-budgets",
  "attack-patterns",
  "status-mix",
  "monster-levels",
  "monster-hp",
  "map-graph",
  "module-graph",
  "content-counts",
] as const;
export type ChartName = (typeof CHART_NAMES)[number];

/**
 * Every `<span data-stat="NAME">fallback</span>` the page can fill from the game's data (CONTRACT.md § Live numbers).
 * Computed by `spellStats` in charts/data.ts.
 */
export const STAT_NAMES = [
  "spells", "spells-core", "spells-school", "spells-y2", "spells-y3", "spells-y4", "levels-min", "levels-max",
  "lines-total", "lines-skills", "lines-art",
  "honors", "monsters", "bosses", "field-bosses", "maps", "items", "quests", "quests-story", "npcs", "jobs",
] as const;

/** Ids the page shell itself creates; fragments may link to them but not reuse them. */
export const SHELL_IDS = ["top", "contents", "cover", "inside", "search", "search-results", "main"] as const;

/** Code languages the highlighter knows (`<code class="lang-…">`). */
export const CODE_LANGS = ["ts", "js", "json", "bash", "css", "html", "yaml"] as const;

export const REPO_URL = "https://github.com/minormending/the-academy";
/** Where `data-src` links point: the file on GitHub `main` (keeps any `#L12` / `#L12-L20`). */
export const srcUrl = (path: string) => `${REPO_URL}/blob/main/${path.replace(/^\/+/, "")}`;
