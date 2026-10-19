# Story mode: Years, classes, missions and badges

The Academy is a story game. Every Year is a term of **classes**. A class is taught by a teacher NPC and is a short
chain of **missions** (ordinary `QuestDef`s): travel to a map, talk to someone, defeat monsters, bring back loot.
Handing in a class's **last** mission passes the class: the teacher pays the course rewards and pins a **badge** on
you. Enough badges, including the required kinds, pass the Year, and Headmistress Maelis promotes you.

- **Year 1 → Year 2:** at the end of Year 1 you **declare your major**, which is your School (Fire, Ice, Lightning,
  Holy, Shadow) and so your skill tree. The Year 1 sampler classes, one per School, are how students try each School first.
- **Year = job tier.** Promotion calls `advanceJob` to the next job in your School (the job's `requiredLevel` still
  applies, so missions should bring the player to that level naturally).

## Year plan (contract for the data agents)

| Year | Levels | Maps | Classes offered | To pass |
|---|---|---|---|---|
| 1 Apprentice Term | 1–10 | mistvale, whisperwood, shroom_hollow | core (Maelis, Orientation) + 5 School samplers (one per professor) + Field Practicum (Finn) | 4 badges incl. core |
| 2 | 10–25 | shroom_hollow, moonlit_marsh, frostfang_cliffs | core (Maelis) + **major** (your School's professor; 5 variants, one per School) + 3 electives | 4 badges incl. core + major |
| 3 | 25–40 | glacier_grotto, cinder_caverns, restricted_stacks, stormspire_peak | core + major ×5 + 3 electives | 4 incl. core + major |
| 4 Final Year | 40–55 | stormspire_peak, arcane_sanctum (Lich Archon = Final Thesis) | core + major ×5 + 2–3 electives | 4 incl. core + major |
| 5 Fellowship | 55–70 | astral_observatory, void_rift, archon_spire (The Unwritten) | core + major ×5 + 1–2 electives | 3 incl. core + major |

A student sees: core + their own major + the electives, about 5–6 classes per Year, and must pass 4 of them (3 in Year 5).

**Teachers:** `elder_maelis` (Headmistress; core story classes), `pyra` (fire), `glacius` (ice), `voltis`
(lightning), `seraphine` (holy), `morvane` (shadow), `scout_finn` (Field Practicums, bestiary), `smith_tilda`
(Artificing: gear and materials), `merchant_bram` (Academy Economics and Alchemy: loot, potions, mesos). In Years 2–5
a professor may also teach an **elective** open to all majors (a "minor" in their School).

## The story (keep every class consistent with it)

The Academy guards the **Forbidden Wing**, where the Lich Archon, a former Headmaster who tried to write himself into
eternity, was sealed long ago. Pages of the sealed notes are going missing.
- **Year 1:** orientation, first practicum, and sampling the five Schools. A violet glow starts leaking under the Forbidden Wing's doors.
- **Year 2:** the glow spreads to the Thorn Shrooms (Shroom Hollow), and stolen pages blow to Frostfang Cliffs (the existing story quests `story_violet_thorns`, `story_pages_in_snow`).
- **Year 3:** the faculty meeting reveals the Archon's history (`story_faculty_meeting`). The pages are being burned in the Cinder Caverns (`story_ash_and_ink`), and the seal cracks over Stormspire Peak (`story_crack_in_seal`).
- **Year 4:** into the Forbidden Wing (`story_forbidden_wing`) and the Final Thesis: defeat the Lich Archon (`story_final_thesis`).
- **Year 5:** the Fellowship. The Archon's book was never finished; **The Unwritten**, a story that writes itself, waits beyond the stars (astral_observatory → void_rift → archon_spire). The Fellows end it.

Read `src/data/storyQuests.ts` and `src/data/npcScripts.ts` (STORY_SCRIPT) for the existing voice and lines.

## Authoring rules

- **Courses:** id `c<year>_<slug>`, catalogue code like `PYR 201`, badge id `b_<course slug>`, a distinct badge colour, and a shape from BadgeShape.
- **Mission count:** 3–4 missions per class. Use a mix of objectives:
  - `visit` (go to a map)
  - `talk` (see someone)
  - `kill`
  - `collect` (loot drops; check the monster's `drops` in `src/data/monsters.ts`)
  - a boss where it fits
- **Mission ids:** `m<year>_<course slug>_<n>`.
- **Mission giver:** normally the teacher, but `giver` may be another NPC for a hand-off step.
- **Mission fields:** each mission needs a vivid `description` that tells the player where to go, and `minLevel`s that rise through the class.
- **Reuse existing quests:** list the existing ids in a course's `missions` instead of copying them:
  - story quests go in core classes
  - `q_job_*` Year-end and Fellowship exams go as the **last** mission of that School's major class for the matching Year
  - side quests (`q_finn_*`, `q_bram_*`, `q_tilda_*`, `q_glacius_geodes`, `q_maelis_*`, bounties) go in electives

  A quest id may appear in **one** class only. Don't edit the existing quest files; ask the lead if one needs changing.
- **References must exist:** every monster, item, map and NPC id used must exist (tests check this). Only use ids from `src/data/monsters.ts`, `items.ts`, `items5.ts`, `maps.ts`, `npcs.ts`.
- **Rewards:**
  - Mission rewards: modest EXP and mesos. Use the `xp(level, frac)` pattern from `src/data/quests.ts`; about 0.3–0.6 of a level per mission.
  - Course rewards (on passing): ~1 level of EXP, mesos, and often a gear item or potions that suit the Year. Optionally `sp: 1–3`.
- **Pacing:** a Year's missions plus normal play should take a player from the Year's first level to the next Year's `requiredLevel` (10, 25, 40, 55).
- **Voice:** warm, a little wry, school flavour (syllabi, office hours, pop quizzes, detention), and short. A teacher's `passLine` is one or two sentences.
