# The Academy — Roadmap to "finished"

The lead (orchestrating Claude session) works through these phases with subagents and Codex.
Status markers: `[x]` done · `[~]` in progress · `[ ]` pending. Update this file as phases complete —
a resumed session (after a usage-limit pause) reads it to pick up exactly where work stopped.

## Resume protocol (for a resumed or fresh session)

1. Read this file, `ARCHITECTURE.md`, and `git log --oneline | head -30`.
2. `git status`: uncommitted work from an interrupted agent → typecheck (`npx tsc --noEmit`); commit it if it
   compiles and matches a phase below, otherwise note it and redo that task.
3. Check for still-running agents (their completion notices arrive on their own); never duplicate one.
4. Start the first phase that is not `[x]`, dispatching parallel agents per the file-ownership rules in
   ARCHITECTURE.md (disjoint files per agent; lead owns `src/core/*`, `src/scenes/*`, `src/main.ts`).
5. After each phase: typecheck, `npm run build`, browser smoke test, commit, tick it here.

## Phases

- [x] **1. Foundation** — contracts, 10 builder agents, integration, QA wave, Codex reviews.
- [x] **2. Pixel-art pivot** — CC0/CC-BY art for characters, monsters, world, VFX, UI; credits.
- [x] **3. Holy & Shadow schools** — contract, jobs, statuses (poison/curse), trees.
- [x] **4. The Academy** — rename + school-year premise; 10 Year-1 spells + 5 Schools × 24; professors,
      exams, campus with five halls; spellbook UI; two-page hotbar; familiar (Pip); field bosses + bounties.
- [x] **5. Systems & feel**
  - [x] Respec (Tome of Unlearning, per-Year Unlearn)
  - [x] Gamepad bridge
  - [x] Trial Hall wave arena (+ GameScene wiring by lead)
  - [x] Pacing playthrough QA levels 1–25
- [x] **6. Story & structure**
  - [x] Main questline across the four Years (13 `story_` quests, all five Schools reach graduation).
  - [x] Year 1 orientation/tutorial assignment chain.
  - [x] Academy Merit shop (Bram → Merit Exchange; `buyWithMerits`).
  - [x] UI wiring: graduation credits screen on `quest:updated` for `GRADUATION_QUEST_ID` turned_in;
        quest log hides locked story steps (`storyStepUnlocked`, `STORY_QUEST_IDS`); no banner flash for
        talk-only steps that go straight to turned_in; rename `q_maelis_archon` to avoid name overlap.
- [x] **7. Quality of life & polish**
  - [x] Multiple save slots / character select (MapleStory-style), with per-slot School + Year shown.
  - [x] Key rebinding + controls screen (keyboard + gamepad map), settings persistence.
  - [x] Help/UI mentions gamepad; damage-number readability options; screen-shake toggle.
  - [x] Pacing QA levels 25–50 (Years 3–4) per School; boss tuning pass.
- [x] **8. Ship**
  - [x] Full regression QA (all five Schools, every map, bosses, arena, saves) + Codex final review.
  - [x] Performance pass (busy ultimates, load time), production build.
  - [x] README (how to play/run, credits); [x] final CREDITS merge.
  - [x] Publish the production build as a playable private Artifact link: https://claude.ai/artifact/EQ1W2af4QsyPHZhd4UKomz
        (republish: `npm run build && node scripts/make-publish-page.mjs`, then publish `dist/academy.html` with `dist/` as root).

## Definition of finished

All phases `[x]`; `npx tsc --noEmit` clean; `npm run build` clean; a new player can go from the title screen
through Year 1 → graduation (Lich Archon Final Thesis) in any of the five Schools without blockers or console
errors; every asset credited; playable build published.

## Phase 10: Year 5 — the Fellowship (done)

- [x] Contract: tier 5 jobs `pyre_archon`, `winter_archon`, `storm_archon`, `light_archon`, `night_archon` (lv 55), cap 70,
      music keys `astral`/`rift`, registries `src/data/items5.ts` + `src/data/raidBosses.ts`.
- [x] 8 Year-5 spells per School (`src/skills/<school>/year5.ts` + `vfx5.ts`).
- [x] Jobs polish, five Fellowship Exams, advancement UI, `tests/graduation.test.ts` accepts Year 5 (tests currently red until this lands — don't push before `npm test` is green).
- [x] Maps `astral_observatory` (from `arcane_sanctum:observatory`), `void_rift`, `archon_spire`.
- [x] Monsters `star_moth`, `astral_sentinel`, `rift_stalker`, `null_wisp`, `shard_horror`, `archon_knight`, `unwritten_page`;
      raid boss `the_unwritten` (`src/entities/monsters/Unwritten.ts`); items in `items5.ts`; music `astral`, `rift`.
- [x] Integrate: `npx tsc --noEmit`, `npm test`, `npm run build`, browser smoke (warp to the new maps, cast Year-5 spells),
      docs sync (README/handbook/devdocs: Year 5, cap 70, new zones), commit, push, verify the Pages deploy.

## Phase 11: mobile redesign (done)

The user: "not mobile friendly — text and screens too small, the map too large to see details. Rethink and simplify."
Shared switch `src/ui/mobile.ts` (`isMobileLayout()`, `MOBILE_UI` 720×405, `MOBILE_CAMERA_ZOOM` 1.8, `html.ax-mobile`).
- [x] M1: zoomed camera on phones, `#ui-root` laid out at 720×405, simplified HUD (big bars, 2-line chat, minimap behind a
      button, one ☰ menu), touch controls re-laid out, readable name tags/damage numbers/boss bars.
- [x] M2: every window/dialog/shop as a full-screen mobile sheet, tap-to-detail instead of tooltips, title/character select.
- [x] Integrate: tsc, `npm test`, build, phone-size browser check (812×375, 667×375, portrait hint), desktop unchanged,
      docs mention of the mobile layout, push, verify the Pages deploy on a phone-sized viewport.
- [x] Leftovers from Year 5: handbook lists only Year 3/4 exams (`src/guide/context.ts`, `schools.ts`, `walkthrough.ts`);
      tier-5 character decoration (`src/art/characters.ts:84`); "EXAM PASSED — YEAR 5" banner wording; README/devdocs for Year 5 + cap 70.

### Phase 11b — 20-agent polish batch (2026-10-19, uncommitted until integrated)
Character creation shipped (a879717, cc02d5e). Then 20 agents were launched on disjoint files. Resume protocol: run
`npx tsc --noEmit`, `npm test`, `npm run build`, fix anything broken, check review findings, then commit with explicit paths and push.
- Phones: canvas fills the screen (src/main.ts, mobile.ts, scaler.ts, index.html); camera bounds clear of the touch pads (GameScene camera); bigger sheet text (ui.css M2 block); touch haptics, cooldown sweeps and multi-touch (touchControls.ts)
- Handbook Year 5 + "Design your mage" (src/guide/context.ts, schools.ts, walkthrough.ts); README/ARCHITECTURE/DEVDOCS refresh
- Fellowship banner wording; Year 5 polish per School (src/skills/<school>/year5.ts, vfx5.ts); Year 5 Honors
- "Change look" editor (src/ui/appearanceEditor.ts + statsWindow button); creator gamepad/polish; Large text setting
- Tests: tests/appearance.test.ts (+ mobile); read-only reviews of the appearance, mobile HUD and mobile windows diffs
- **Integrated and pushed in cc625f5.** Open findings from the reviews (by static reading only):
  - Hotbar picker on phones (src/ui/window.ts): "Remove from bar" clears the first copy of a potion on any page, not the current page; tapping an occupied slot overwrites it instead of swapping
  - Esc, or a window hotkey, while the phone map overlay or ☰ panel is open opens the window behind it (UIRoot.ts keyDown/openWindow)
  - Window z counter in UIRoot never resets and can pass the HUD overlays (z 850/900) after about 750 focus changes
  - Boss bar keeps its phone/desktop size if the layout flips mid-fight (bossBar.ts)
  - Phone sheets: the Character window's STR/DEX/INT tooltips have no tap equivalent; mobileUnlearn lacks desktop's lineage guard; a layout flip keeps an arbitrary open window instead of the topmost
  - Parallax/sky layers at 1.8× zoom and on wide canvases: check a few maps on a phone (MapLoader.ts, ambient.ts); credits star field still assumes 1280 wide
  - Handbook still says Years 2–4 in builds.ts and front.ts; The Unwritten has no BOSS_NOTES entry
  - Character Select bakes one sprite sheet per saved look on first render (possible stall with many slots)

## Phase 12: story mode

The user: "switch this to story based. Each year there are goals or missions to accomplish to pass a class… the teachers
give you rewards and a badge for passing the class. When you pass enough classes, you move to the next year. At the
end of the 1st year, you choose your major." Contract and rules: `src/data/courses/README.md`; types `CourseDef`,
`YearPlan`, `ICourses` in src/core/types.ts; data in `src/data/courses/year{1..5}.ts` + `year{2..5}majors.ts`.
- [x] Course data: Year 1 (core + 5 School samplers + Field Practicum), Years 2–4 (core + major ×5 + electives), Year 5 Fellowship
- [x] CourseSystem (src/systems/CourseSystem.ts): pass class → badge + rewards; Year progress; declareMajor; promote; old-save credit; visit/talk objectives
- [x] Teacher dialogs (src/data/npcScripts.ts): class missions per teacher, badge ceremony, Maelis report card / declare major / promotion
- [x] UI: Classes window (report card, badge case, assignments tab), HUD mission tracker, badge banner
- [x] Guidance: route to the mission's map (portal arrow, minimap marker); pixel badge art
- [x] Tests (tests/courses.test.ts, courseSystem.test.ts, route.test.ts); integrate, tsc/test/build, play Year 1 in the browser (desktop + phone), push
- [x] Docs: handbook walkthrough by Year/classes (Year plans, class tables, major finals), README, ARCHITECTURE, devdocs
