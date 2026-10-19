# The developer docs (devdocs.html)

How The Academy is built, for developers new to the codebase, published next
to the game: https://minormending.github.io/the-academy/devdocs.html
(dev: http://localhost:5199/devdocs.html).

Writers supply only **HTML fragments** in `src/devdocs/sections/`, following
the content contract in [src/devdocs/CONTRACT.md](../src/devdocs/CONTRACT.md).
The page shell turns them into the page: cover, sticky contents with
scroll-spy, search, light/dark, Advanced blocks, callouts, highlighted code,
GitHub source links, Mermaid diagrams and live charts. Every chart is computed
in the browser from the game's own modules, so the numbers can't drift from the
build. The design follows the developer docs of the sister project Verdant
Reach; the look is The Academy's own (the game's DawnBringer night palette and
Kenney's CC0 pixel fonts from `public/assets/ui/fonts/`).

## How it is built

`devdocs.html` is the third Vite page (`build.rollupOptions.input` in
`vite.config.ts`); `npm run build` emits `dist/devdocs.html` beside the game
and the Student Handbook. It shares the game's data modules, so the build
splits common code into shared chunks; the game's entry, base and behaviour are
unchanged.

| Module | Job |
|---|---|
| `src/devdocs/CONTRACT.md` | The content contract writers follow: one `<section>` per file, building blocks, section ids, chart names. |
| `src/devdocs/sections/*.html` | The content, loaded with `import.meta.glob(…, { query: "?raw", eager: true })` in file-name order (`sections.ts`). |
| `src/devdocs/validate.ts` | Pure, string-based fragment checks (no DOM, no imports), shared by the browser, Node and the build. |
| `src/devdocs/check.mjs` | `node src/devdocs/check.mjs`: runs the validator over the real sections with repo file line counts. Also imported by `vite.config.ts`. |
| `src/devdocs/main.ts`, `devdocs.css`, `dom.ts` | Page shell: cover, contents with scroll-spy, search (`/` to focus), light/dark, Advanced toggle, callouts, source links, tables, copy buttons, print. |
| `src/devdocs/highlight.ts` | A tiny highlighter (keywords, strings, comments, numbers) for `lang-ts`, `lang-js`, `lang-json`, `lang-bash`, `lang-css`, `lang-html`, `lang-yaml`. Text nodes only, never HTML. |
| `src/devdocs/mermaid.ts` | Mermaid diagrams: lazy, themed from the page's CSS variables, re-rendered on theme change, with a source fallback. |
| `src/devdocs/panzoom.ts` | Pan/zoom (drag, wheel, pinch, keys) and the full-screen viewer used by diagrams and node-link charts. |
| `src/devdocs/charts/data.ts` | **Pure chart data** from `balance.ts`, `MONSTERS`, `MAPS`, `JOBS`, `ITEMS`, the skill definitions and `computeDerived`. |
| `src/devdocs/charts/sourceStats.ts` | Pure parsing of source text: lines and files per `src/` folder, imports between folders. |
| `src/devdocs/charts/index.ts`, `svg.ts` | The charts as dependency-free SVG: titles, legends, tooltips, `role="img"` summaries, "Show data" tables, redraw on resize. |
| `src/devdocs/names.ts` | Chart names, `data-stat` names, reserved shell ids, code languages, the GitHub source URL. |

### Charts and the game's modules

Pure data modules (balance, maps, monsters, jobs, items, quests, NPCs) are
imported statically. The skill definitions import `playVfx`, which imports
Phaser, so skills, derived stats and `newPlayerState` are loaded with a dynamic
`import()` (`gameModules()` in `charts/index.ts`) when a spell chart nears the
viewport, or when the page is idle (the cover's spell count). That chunk is the
same Phaser chunk the game uses. Importing Phaser has no side effects; no
`Phaser.Game` is created.

### Source statistics: the devdocsSource plugin

`module-graph` and `content-counts` need facts about the source tree. Rather
than shipping the source to the browser, `devdocsSource` in `vite.config.ts`
serves two virtual modules that only the docs page imports:

- `virtual:devdocs-source`: `sourceStats()` over `src/**/*.ts` (folders, lines,
  import edges between folders; the docs folders `devdocs/` and `guide/` are
  left out). A few hundred bytes.
- `virtual:devdocs-files`: the line count of every text file in the repo,
  imported in dev only, so the page can check `data-src` links.

In dev they are computed when the server first loads them; restart the dev
server to refresh them. The plugin's `buildStart` also runs the fragment checks
on every `vite build`: problems are printed as warnings, and
`DEVDOCS_STRICT=1 npm run build` turns them into errors.

`module-graph` is laid out deterministically: a folder sits one layer above the
highest folder it imports; cycles (the Registry imports the skills, the skills
import core) are broken weakest-first and drawn as dashed upward edges.
`map-graph` puts the longest portal path from the campus along the top row and
hangs every other map below its neighbour.

## Diagrams: why Mermaid comes from a CDN

The game's only runtime dependency is Phaser. Mermaid is large (megabytes with
its renderers), so it is **not** in `package.json`. Instead
`src/devdocs/mermaid.ts` imports a pinned ESM build at runtime, on this page
only:

`https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs`

- **Pinned:** the exact version is in the URL, so a new Mermaid release can't
  change the page. Bump it deliberately and look at every diagram.
- **Lazy:** the library loads when the first diagram nears the viewport, and
  each diagram renders as it scrolls near. Rendering is serialised.
- **Themed:** the `base` theme with colours read from the page's CSS
  variables; diagrams redraw when the light/dark mode changes.
- **Fails soft:** if the CDN can't be reached, each diagram shows its source
  with a note. A diagram with a syntax error shows its source and the error
  (and logs it in the console).
- **Safe:** `securityLevel: "strict"`; fragments can't carry scripts anyway.

Click a diagram to open it full screen (drag to pan, scroll or pinch to zoom,
Esc to close).

## How to add a section

1. Read [src/devdocs/CONTRACT.md](../src/devdocs/CONTRACT.md).
2. Add `src/devdocs/sections/<nn>-<slug>.html` with one
   `<section id="slug" data-title="…" data-summary="…">`, one `<h2>`, `h3`/`h4`
   with ids prefixed `slug-`, and at least one `<details class="advanced">`.
   The file-name number sets the order. Add the row to CONTRACT.md's section
   table.
3. Use the building blocks: `<pre class="mermaid">`, `<figure data-chart="NAME">`,
   `<aside class="note|tip|warn">`, `<pre><code class="lang-ts">` (escape `<`,
   `>` and `&`), `<a data-src="src/…#L40">` and `<a href="#id">`.
4. Run `node src/devdocs/check.mjs` (Node 22.6+) and look at it in
   `npm run dev` (`/devdocs.html#slug`). In dev, problems also show in a red
   banner at the top of the page and in the console.

The checker fails on: a file without exactly one
`<section id data-title data-summary>`, duplicate ids (across all files) or
ids the shell reserves, a missing `h2` or Advanced block, unknown elements
(usually an unescaped `<` in code), `<script>`, `<style>`, `style=`, inline
event handlers, `javascript:` URLs, images and embeds, unknown chart names or
code languages, `#anchor` links that point nowhere, and `data-src` paths that
don't exist or whose `#L` line is past the end of the file.

It cannot tell whether `#L120` still points at the code the text describes:
line links drift when code above them changes. After a refactor, grep the
sections for the file name and re-check the numbers.

### Numbers in prose

A count of game data (how many spells there are, how many a School has) is written as
`<span data-stat="spells">214</span>`, not as a bare number. `fillStats` in `main.ts` replaces the text with the
value from `spellStats` (`charts/data.ts`) when the game modules load, and `check.mjs` rejects a name that is not in
`STAT_NAMES` (`names.ts`). The number typed inside the span is only a fallback; in `npm run dev` a stale one is
listed in the red banner, so a content change shows up the next time someone opens the page. To add a stat, add
the name to `STAT_NAMES`, the value to `spellStats` and a row to CONTRACT.md's "Live numbers" table.

### Adding a chart

Add the NAME to `CHART_NAMES` (`src/devdocs/names.ts`) and to the table in
CONTRACT.md, a pure data function in `charts/data.ts`, and a `ChartDef` in
`charts/index.ts` (title, `load`, `summary` for screen readers, `table`,
`draw`, and `legend` for two or more series). Series colours are `sf-N`
(fill) and `sk-N` (stroke, legend) classes: 1–8 the categorical palette, 11–16
the School colours (core, fire, ice, lightning, holy, shadow), 99/100 neutral.
Text never wears a series colour.

A new School needs a line in `GROUPS`/`GROUP_NAME`/`GROUP_SERIES`
(`charts/data.ts`) and a `--school-*` colour in `devdocs.css`; the compiler
won't flag it.
