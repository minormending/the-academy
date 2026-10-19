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
- [~] **5. Systems & feel**
  - [x] Respec (Tome of Unlearning, per-Year Unlearn)
  - [x] Gamepad bridge
  - [x] Trial Hall wave arena (+ GameScene wiring by lead)
  - [~] Pacing playthrough QA levels 1–25
- [x] **6. Story & structure**
  - [x] Main questline across the four Years (13 `story_` quests, all five Schools reach graduation).
  - [x] Year 1 orientation/tutorial assignment chain.
  - [x] Academy Merit shop (Bram → Merit Exchange; `buyWithMerits`).
  - [x] UI wiring: graduation credits screen on `quest:updated` for `GRADUATION_QUEST_ID` turned_in;
        quest log hides locked story steps (`storyStepUnlocked`, `STORY_QUEST_IDS`); no banner flash for
        talk-only steps that go straight to turned_in; rename `q_maelis_archon` to avoid name overlap.
- [~] **7. Quality of life & polish** (save slots + controls in progress)
  - [x] Multiple save slots / character select (MapleStory-style), with per-slot School + Year shown.
  - [x] Key rebinding + controls screen (keyboard + gamepad map), settings persistence.
  - [x] Help/UI mentions gamepad; damage-number readability options; screen-shake toggle.
  - [ ] Pacing QA levels 25–50 (Years 3–4) per School; boss tuning pass (after the 1–25 pass lands).
- [ ] **8. Ship**
  - Full regression QA (all five Schools, every map, bosses, arena, saves) + Codex final review.
  - Performance pass (busy ultimates, load time), production build.
  - [x] README (how to play/run, credits); [x] final CREDITS merge.
  - Publish the production build as a playable private Artifact link for the user.

## Definition of finished

All phases `[x]`; `npx tsc --noEmit` clean; `npm run build` clean; a new player can go from the title screen
through Year 1 → graduation (Lich Archon Final Thesis) in any of the five Schools without blockers or console
errors; every asset credited; playable build published.
