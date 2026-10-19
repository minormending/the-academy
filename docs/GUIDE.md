# The handbook (guide.html)

The Academy's Official Student Handbook: a strategy guide for the whole game, published next to it at
https://minormending.github.io/the-academy/guide.html (dev: http://localhost:5199/guide.html).

Writers supply only the **prose** and say **which** zone, quest, boss or shop to show. Every table,
picture and number is generated in the browser from the game's own modules and PNGs, so the handbook
can't drift from the build.

## How it is built

`guide.html` is a second Vite page (`build.rollupOptions.input` in `vite.config.ts`); `npm run build`
emits `dist/guide.html` beside the game. It imports the game's data modules read-only and never creates a
Phaser game: the shared modules still pull in the `phaser` chunk (the registry and art helpers import it),
but nothing boots it. Pictures come from the game's canvas painters, fed with PNGs the handbook loads itself.

| Module | Job |
|---|---|
| `src/guide/types.ts` | The content contract: `Section` and `Block`. |
| `src/guide/walkthrough.ts` | The walkthrough, the five school Years of story mode in play order, as `WALKTHROUGH`. Each Year opens with its plan and class table, then follows the road its classes send you down. Prose only; part headings are the Years' own `YearPlan.title`s. |
| `src/guide/context.ts` | **Indexes the game's data** once (`buildGuide`): monsters per zone from the maps' `spawns`, drop sources from monster drop tables, quest rewards and wants, NPC positions, the story chain from `STORY_FLOW`, every class (`Registry.courses()`) and Year plan (`Registry.yearPlan()`) with a quest → class index, bounties, and the assignments that belong to no class. Shop stock is read by **running Bram's and Tilda's own dialog scripts** (`runNpcScript`) against a stand-in student and catching the `ui:shop` event, at every level and School, so the racks and "in stock from" levels are exactly the game's. |
| `src/guide/art.ts` | Pictures without Phaser: `iconDataUrl` (7Soul1 sheet), `jobPreviewDataUrl` / `characterDataUrl` / `portraitDataUrl` (after handing the character PNGs to `registerPixelSheetData`), and `paintPixelMonsterSheet` through a tiny stand-in for Phaser's texture manager backed by the monster PNGs (`paintMonsterSheet` as the fallback, like `ensureMonsterTexture`). All paths go through `assetUrl`, so the relative base works on GitHub Pages. |
| `src/guide/mapRender.ts` | Draws a whole map from its `MapDef` at half world scale (one source pixel per canvas pixel): the theme's parallax PNGs (`PIXEL_BG`), the terrain kit (same atlas as `src/art/world/pixel.ts`), the hand-placed set dressing in `src/world/mapExtras.ts`, ropes, ladders, portals, the NPCs and every spawn's monsters. |
| `src/guide/blocks.ts` | Renders blocks: text, tips, lists, zone panels (map + monster table), Year plans, class tables with fold-out mission lists, quest cards, quest tables, boss cards, major-final tables, School cards, training planners, staff cards, shop tables, screenshots. |
| `src/guide/spells.ts` | Spell tables straight from each `SkillDef`'s level functions: damage % Lv 1 → max, hits, targets, MP, cooldown, status (chance, duration), prerequisites, buff/passive effects. |
| `src/guide/schools.ts`, `builds.ts` | Year 1 Core Curriculum and The Five Schools: portraits per Year, matchups against every monster (weak / resist / immune to the School's own statuses), School gear, every spell table, and suggested builds. `checkBuild` totals each build's SP, checks every prerequisite and that each Year fits the SP a student has before the next Year opens (`SP_PER_LEVEL`, `JOB_ADVANCE_BONUS_SP`, `JOB_LEVELS`). |
| `src/guide/bossNotes.ts` | Prose for boss cards: tagline, attacks (read from the AI in `src/entities/monsters/`) and strategy. Stats, matchups, drops, spawn timers and bounties on the card come from data. |
| `src/guide/reference.ts` | Bestiary (filterable), Atlas, Campus staff, Items & gear (with every source: shops, drops, rewards, Merit Exchange), Trial Hall (`ARENA_TUNING`, `meritsForWave`, `bonusExpForWave`), familiar/respec/saves, Academy Honors (every non-secret honor from `HONORS`, with its Merits and title), Assignments (story, major finals, assignments outside the classes, bounties), Levels & EXP (`expToNext`, `killExpMultiplier`). |
| `src/guide/front.ts` | Cover (the title screen's PNGs), How to play (controls from `ACTIONS` + `DEFAULT_BINDINGS` + `GAMEPAD_MAP`, the hotbar, the HUD, the starting kit from `newPlayerState`, what one AP buys by diffing `baseDerived`), table of contents. |
| `src/guide/validate.ts` | Checks the content against the data (below). |
| `src/guide/main.ts`, `guide.css` | Page shell: sticky bar, search (`/` to focus), night/day themes, print. |
| `public/guide/*.jpg` | A few screenshots from the game (title, campus HUD, combat, the Lich). |

The look is the game's own: Kenney Pixel / Kenney Mini (`public/assets/ui/fonts`), the indigo-and-gold
Golden UI frames (`public/assets/ui/golden`, 2× pixelated border-images), the title screen's night sky.
Night is the default when the system is dark; Day is a parchment printing. Map pictures render lazily as
they scroll near; the print button draws every remaining map first, and the print stylesheet starts each
part, chapter and School on a new page.

## The content contract (`src/guide/types.ts`)

A `Section` is `{ id, part, title, blocks }`. `id` is the anchor (`y2-frostfang`: lower case, digits and
hyphens, unique). Sections with the same `part` (`Year 1 · The Apprentice Term`, …) are grouped under one part
heading, in order of first appearance.

| Block | Renders |
|---|---|
| `{ p }` | A paragraph. Inline: `**bold**` and `[[text\|#anchor]]` links. |
| `{ tip, title? }` / `{ list }` / `{ checklist }` | A boxed hint / a bullet list / a "Before you move on" checklist. |
| `{ zone, note? }` | Zone panel: the drawn map with portal, staff and field-boss labels, its level range, where its portals lead, and every monster with level, HP, EXP, kills per level, count, matchups and key drops. |
| `{ quest, note? }` | Quest card: its class and mission number, kind (story / major final / class mission / assignment / bounty), giver portrait, level and Year gates, prerequisite step, objectives with where to find each, rewards. |
| `{ quests, title? }` | A compact quest table. |
| `{ boss, note? }` | Boss card: sprite, stats, matchups, immunities, where and when it appears, its bounty, attacks and strategy (`bossNotes.ts`), drops. |
| `{ year: 1…5 }` | The Year's plan (`YearPlan`): title, the Headmistress's welcome, badges to pass, required kinds of class, level band and what ends the Year. |
| `{ classes: 1…5 }` | The Year's classes from `Registry.courses()`: code, name, teacher, kind (one row per School for majors), missions, badge (the game's pixel badge) and pass rewards; then each class's missions in a fold-out list with objectives, rewards and the teacher's pass line. |
| `{ finals: 2…5 }` | The last mission of every School's major class in that Year side by side (the old Year-end and Fellowship Exams), with where to find what it asks for and the title the next Year brings. |
| `{ schools: true }` / `{ school }` | The five Schools' cards / one School's card. |
| `{ training: [min, max] }` | Every monster worth hunting in that level band, with EXP per 100 HP. |
| `{ npc, note? }` | A staff card. |
| `{ shop: 'bram' \| 'tilda' \| 'merit' }` | A shop's stock and prices. |
| `{ image, alt, caption? }` | A screenshot from `public/guide/`. |

**Prose tokens** keep numbers out of the writing: `{key:skills}` (default key), `{joblv:2}` (level a Year
opens), `{qlv:story_violet_thorns}` (a quest's level), `{mlv:moss_snail}` (a monster's level),
`{zlv:whisperwood}` (a zone's level range). Don't type badge counts or class rewards either: the `year` and `classes` blocks print them.

Anchors other sections can link to: `#zone-<mapId>` (walkthrough panel), `#map-<mapId>` (Atlas),
`#mon-<monsterId>`, `#boss-<monsterId>`, `#item-<itemId>`, `#spell-<skillId>`, `#spells-<jobId>`,
`#quest-<questId>`, `#class-<courseId>` (its row in the class table), `#year-<n>` (the Year plan), `#npc-<npcId>`, `#school-<school>`, `#builds-<school>`, `#honor-<honorId>`, and the chapters `#core`,
`#schools`, `#bestiary`, `#atlas`, `#staff`, `#items`, `#shops`, `#trial-hall`, `#familiar`, `#respec`,
`#honors`, `#assignments`, `#progression`.

## How to add a section

1. Add a `Section` to `src/guide/walkthrough.ts` in play order.
2. Write the prose in `p`, `tip`, `list` and `checklist` blocks. Don't type out levels, HP, rates or
   prices: use a token or put a `{ zone }`, `{ quest }`, `{ boss }`, `{ training }` or `{ shop }` block where
   the reader needs them.
3. Look at it in `npm run dev` (`/guide.html#<your-section-id>`) and run `npx tsc --noEmit`.

`src/guide/validate.ts` runs in the page (the project has no test runner). In dev, problems show in a red
banner at the top of the handbook and in the console. It checks that every block names a map, quest, boss,
NPC or School that exists; that section ids are unique and well formed and text blocks aren't empty; that
**every zone with monsters has a zone panel, every field boss and the Lich a boss card, every story step that
belongs to a class a quest card, every Year a `year` and a `classes` block (which lists every class mission),
and every assignment outside the classes and every bounty a mention**; and that every suggested build still fits its SP
budget and prerequisites. When the game gains a map, boss or quest, the banner lists what the walkthrough is
still missing.

To add a **reference chapter**, write a function returning `{ id, title, el }` (see `reference.ts`) and add
it to the `refs` list in `main.ts`; the contents, top bar search and chapter list pick it up.

To add a **build**, add it to `BUILDS` in `builds.ts`; the page totals and checks it. Each School has three
(the third one is built around the Phase 9 spells: traps and wards, combo payoffs, HP-for-MP trades, dashes and
channels), and the validator flags any build that names an unknown spell, skips a prerequisite or does not fit the
SP a student really has by the end of each Year. The budget counts levels and the Year bonus only, not the SP some classes pay, so a build also fits a student who skipped those classes. The totals shown under each build come from `spAtLevel`, so they
follow `SP_PER_LEVEL`, `JOB_ADVANCE_BONUS_SP` and `JOB_LEVELS` if those change.

The spell tables list each spell's numbers from its `SkillDef`, and a spell that cashes in a status says so in its
effects line ("removes it"). A spell whose behaviour lives in `onCast` shows its `attack` or `summon` numbers and
its description; keep the numbers in those fields so the handbook can print them.

To refresh the **screenshots**, replace the JPEGs in `public/guide/` (800×450 works well) and keep the
file names, or add an `{ image }` block for a new one.
