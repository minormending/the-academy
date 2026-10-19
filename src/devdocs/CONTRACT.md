# Developer docs: content contract

The developer documentation page (`devdocs.html`, deployed at
`https://minormending.github.io/the-academy/devdocs.html`) is assembled from
HTML fragments in `src/devdocs/sections/`. The page shell (`src/devdocs/`)
loads them in file-name order, builds the navigation and search, renders
diagrams and charts, and highlights code. Writers only write fragments.

**Audience.** A junior to mid-level developer new to the codebase who knows
TypeScript but not Phaser. Explain the *why* as well as the *what*, define
terms the first time they appear, and prefer a diagram to a paragraph. Every
section also has at least one **Advanced** block for senior developers:
invariants, trade-offs, performance, edge cases, failure modes, how to extend
safely.

## A section file

`src/devdocs/sections/<nn>-<slug>.html`, e.g. `03-boot.html`. One fragment:

```html
<section id="boot" data-title="Scenes and boot" data-summary="One line for the contents and the cover.">
  <h2>Scenes and boot</h2>
  <p>…</p>
  <h3 id="boot-lazy">Lazy art generation</h3>
  …
</section>
```

- `id`, `data-title` and `data-summary` are required. The `id` is unique and
  stable; ids of headings and anything else inside get the section id as a
  prefix (`boot-lazy`).
- Only `h2` (once, the section title) and `h3`/`h4` inside. `h3`s appear in
  the sticky contents.
- No `<script>`, `<style>`, `style=`, inline event handlers, images or embeds.
  Plain HTML.

## Building blocks

| Block | Markup |
|---|---|
| Diagram (flowchart, sequence, state, class…) | `<pre class="mermaid">flowchart LR\n  A --> B</pre>` (Mermaid 11 syntax; keep labels short; quote labels with punctuation: `A["Boot (preload)"]`; write `<` as `&lt;`) |
| Live chart from game data | `<figure data-chart="NAME"><figcaption>Caption that says what to notice.</figcaption></figure>` with a NAME from the list below |
| Advanced block | `<details class="advanced"><summary>Advanced: short title</summary> … </details>` |
| Callouts | `<aside class="note">…</aside>`, `<aside class="tip">…</aside>`, `<aside class="warn">…</aside>` |
| Code | `<pre><code class="lang-ts">…</code></pre>` (also `lang-js`, `lang-json`, `lang-bash`, `lang-css`, `lang-html`, `lang-yaml`); escape `<` as `&lt;`, `>` as `&gt;`, `&` as `&amp;` |
| Link to source | `<a data-src="src/core/balance.ts#L7">balance.ts:7</a>` (path from the repo root; optional `#L7` or `#L7-L12`) → GitHub `main` |
| Link to another section | `<a href="#skills-patterns">the seven patterns</a>` |
| Key term | `<dfn>service locator</dfn>` on first use |
| Keys | `<kbd>Tab</kbd>` |
| Table | plain `<table>` with `<thead>` |

Code excerpts must be copied from the real source (shortened with `// …`
where needed), never invented. Every claim must match the code. Line numbers
in `data-src` must point at the line you mean (check with `grep -n`); the
checker verifies the file exists and the line is in range, not that it is the
right line.

## Sections (ids for cross-links)

| File | `id` | Covers |
|---|---|---|
| `01-overview.html` | `overview` | What the game is, tech stack, repo map, how to run, the three pages |
| `02-architecture.html` | `architecture` | Service locator, contracts in `src/core/types.ts`, Registry, ownership model, event bus, frame flow |
| `03-boot.html` | `boot` | `main.ts`, Boot / Title / Game scenes, asset preload, lazy art generation, map changes, teardown |
| `04-input.html` | `input` | Bindings, latched presses, hotbar pages, cast buffer, settings, gamepad bridge |
| `05-physics.html` | `physics` | Player movement, one-way platforms, ropes and ladders, blink, hit reaction |
| `06-skills.html` | `skills` | SkillDef, cast flow, the seven attack patterns, VFX conventions, buffs, summons, combat math, statuses |
| `07-progression.html` | `progression` | Balance curves, derived stats, SP/AP, jobs as school Years, exams, respec, merits |
| `08-world.html` | `world` | MapDef, MapLoader, platforms/walls/ropes/portals, parallax and themes, ambient, the map graph |
| `09-monsters.html` | `monsters` | MonsterDef, Monster AI, MonsterManager, drops, field bosses, the Lich Archon, Trial Hall waves |
| `10-story.html` | `story` | Quests, story questline, NPC scripts, exams, Trial Hall, graduation |
| `11-ui.html` | `ui` | DOM overlay, scaling, windows, HUD, dialogs, title menu |
| `12-art.html` | `art` | Pixel-art pivot, manifests, palette swaps, character rig, icons, particles, licensing and credits |
| `13-audio.html` | `audio` | Synthesized SFX and music |
| `14-saves.html` | `saves` | SaveSystem, six slots, migration, damaged saves |
| `15-build.html` | `build` | Vite, the three pages, chunks, GitHub Pages workflow, the Artifact build, these docs |
| `16-history.html` | `history` | How it was built: the lead session, parallel Claude subagents and Codex runs, phases, QA waves |
| `17-recipes.html` | `recipes` | Add a spell, a monster, a map, a School |

## Charts (rendered from the game's own modules)

| NAME | What it shows |
|---|---|
| `exp-curve` | EXP to the next level, levels 1–49 (`expToNext`), with the four school Years shaded; tooltips add same-level kills per level and reference monster EXP |
| `matk-curve` | Reference magic attack `refMatk(level)` against the base formula (`baseDerived`, INT build from auto-AP, no gear), so the gap gear must fill is visible |
| `hp-curves` | Reference player HP/MP (`refPlayerHp`, `refPlayerMp`) against reference monster HP (`refMonsterHp`); tooltips add monster touch damage |
| `spells-by-year` | Spells per School per Year, stacked by kind (attack, buff, passive, movement, summon) |
| `school-budgets` | Every attack and summon at max level: damage % × hit lines per target per cast, by School and Year (log scale) |
| `attack-patterns` | Attack specs by pattern (projectile, melee_arc, aoe_self, aoe_target, chain, beam, rain), stacked by School |
| `status-mix` | Spells that can apply each status (burn, chill, freeze, shock, stun, poison, curse), stacked by School |
| `monster-levels` | Every monster's level against the zone it spawns in, with each zone's level range |
| `monster-hp` | Monster HP against the reference curve, normal monsters and bosses (log scale) |
| `map-graph` | Every map as a node and every portal pair as an edge |
| `module-graph` | Top-level `src/` folders and the imports between them (computed at build time) |
| `content-counts` | Spells, monsters, maps, items, quests, NPCs, jobs; source lines per `src/` folder |

If you need a chart that isn't listed, describe it in your report instead of
inventing a NAME.

## Checking your work

```bash
node src/devdocs/check.mjs
```

prints every problem (unknown elements, unescaped `<`, broken `#links`,
missing files or out-of-range lines in `data-src`, unknown chart names…). In
`npm run dev`, `/devdocs.html` shows the same problems in a red banner.
