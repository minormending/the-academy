// OWNER: story agent. Main questline (the four Years) + Year 1 orientation assignments.
// Dialog for every step lives in npcScripts.ts (STORY_SCRIPT); the flow rules (prerequisites, Year gates) live here.
//
// Chain (each step unlocks once the previous one is handed in):
//   Year 1 orientation:  story_orientation → story_office_hours → story_supplies → story_first_practicum
//   Main line:           story_declaration (reach Lv 10 → declare a School)
//                        → story_violet_thorns → story_pages_in_snow            (Year 2: the Forbidden Wing stirs)
//                        → story_faculty_meeting → story_ash_and_ink → story_crack_in_seal   (Year 3: the missing notes)
//                        → story_forbidden_wing → story_final_thesis → story_commencement    (Year 4: the Lich Archon)
import type { QuestDef } from '../core/types';
import { expToNext } from '../core/balance';

/** Quest EXP reward as a fraction of the EXP needed for `level`. */
const xp = (level: number, frac: number) => Math.round(expToNext(level) * frac);

/** Handing this in is graduation — the cue for the credits screen. */
export const GRADUATION_QUEST_ID = 'story_commencement';

export interface StoryStep {
  /** Must be handed in before this step is offered. */
  prev?: string;
  /** Minimum job tier (= school Year). */
  minTier?: number;
  /** Year 1 lessons: students past this tier skip the step (it counts as done for the chain). */
  maxTier?: number;
  /** Any School's Professor can run this step (the giver is just the one nearest the Headmistress). */
  anyProfessor?: boolean;
  /** No trackable objective: the lesson is the conversation; accepted and handed in on the spot. */
  talk?: boolean;
  /** Short chapter tag shown on dialog options. */
  tag: string;
}

export const STORY_QUESTS: QuestDef[] = [
  // ───────────── Year 1 · Orientation (tutorial) ─────────────
  {
    id: 'story_orientation', name: 'Orientation Day', giver: 'elder_maelis', minLevel: 1,
    description: 'Welcome to the Academy! Headmistress Maelis walks every first-year through the basics: walking, jumping, and how to talk to the staff.',
    objectives: [],
    rewards: { exp: xp(1, 0.5), mesos: 150 },
  },
  {
    id: 'story_office_hours', name: 'Office Hours', giver: 'pyra', minLevel: 1,
    description: 'The Professors keep office hours along the east hall. Introduce yourself to any one of them — all five Schools are hoping you will pick theirs.',
    objectives: [],
    rewards: { exp: xp(1, 0.5), items: [{ itemId: 'blue_potion', qty: 5 }] },
  },
  {
    id: 'story_supplies', name: 'Shopping List', giver: 'merchant_bram', minLevel: 1,
    description: 'No first-year leaves campus without supplies. Buy a Return Scroll from Bram\'s counter, then show it to him. Bram will also explain how to keep potions on your hotbar.',
    objectives: [{ kind: 'collect', itemId: 'return_scroll', count: 1 }],
    rewards: { exp: xp(1, 0.5), items: [{ itemId: 'return_scroll', qty: 3 }, { itemId: 'red_potion', qty: 10 }] }, // the shown scroll comes back + 2
  },
  {
    id: 'story_first_practicum', name: 'First Practicum', giver: 'scout_finn', minLevel: 1,
    description: 'Prefect Finn\'s first field lesson, just past the east gate in Whisperwood: blast 3 Moss Snails with Arcane Bolt (Q) and scoop up 2 Snail Shells (hold Z).',
    objectives: [{ kind: 'kill', monsterId: 'moss_snail', count: 3 }, { kind: 'collect', itemId: 'snail_shell', count: 2 }],
    rewards: { exp: xp(2, 0.8), mesos: 100, items: [{ itemId: 'soft_sandals', qty: 1 }, { itemId: 'red_potion', qty: 10 }] },
  },

  // ───────────── Year 1 → 2 · Declaration ─────────────
  {
    id: 'story_declaration', name: 'Declaration Day', giver: 'elder_maelis', minLevel: 1,
    description: 'Finish the Year 1 core curriculum — reach level 10 — and return to Headmistress Maelis to declare your School. Prefect Finn\'s field practicums are the quickest way there.',
    objectives: [{ kind: 'level', level: 10 }],
    rewards: { exp: xp(10, 0.3), mesos: 1000, items: [{ itemId: 'scholar_cap', qty: 1 }] },
  },

  // ───────────── Year 2 · The Forbidden Wing stirs ─────────────
  {
    id: 'story_violet_thorns', name: 'Violet Thorns', giver: 'scout_finn', minLevel: 11,
    description: 'The Thorn Shrooms of Shroom Hollow are sprouting thorns of a strange violet light — the same glow that leaks under the doors of the Forbidden Wing. Thin out 15 of them and bring Prefect Finn 6 Thorn Spores to study.',
    objectives: [{ kind: 'kill', monsterId: 'thorn_shroom', count: 15 }, { kind: 'collect', itemId: 'thorn_spore', count: 6 }],
    rewards: { exp: xp(12, 0.5), mesos: 1200, items: [{ itemId: 'orange_potion', qty: 15 }] },
  },
  {
    id: 'story_pages_in_snow', name: 'Pages in the Snow', giver: 'glacius', minLevel: 21,
    description: 'Pages are missing from the Professors\' sealed notes on the Forbidden Wing, and a cold wind carried their ink-magic to Frostfang Cliffs. Ice Wisps drink old magic and remember it. Bring Professor Glacius 10 Wisp Essences so he can read where the pages went.',
    objectives: [{ kind: 'collect', itemId: 'wisp_essence', count: 10 }],
    rewards: { exp: xp(22, 0.45), mesos: 2500, items: [{ itemId: 'mana_elixir', qty: 10 }] },
  },

  // ───────────── Year 3 · The missing notes ─────────────
  {
    id: 'story_faculty_meeting', name: 'Faculty Meeting', giver: 'elder_maelis', minLevel: 25,
    description: 'Now a Year 3 student, you have been invited to sit in on an emergency faculty meeting. Headmistress Maelis has a story about the Forbidden Wing that she has never told a student.',
    objectives: [],
    rewards: { exp: xp(25, 0.25), items: [{ itemId: 'white_potion', qty: 10 }] },
  },
  {
    id: 'story_ash_and_ink', name: 'Ash and Ink', giver: 'pyra', minLevel: 27,
    description: 'The stolen pages are being burned in the Cinder Caverns — the Ember Imps come home with parchment ash caked on their horns. Defeat 20 Ember Imps and bring Professor Pyra 8 Imp Horns so she can read what was written in the smoke.',
    objectives: [{ kind: 'kill', monsterId: 'ember_imp', count: 20 }, { kind: 'collect', itemId: 'imp_horn', count: 8 }],
    rewards: { exp: xp(28, 0.4), mesos: 5000, items: [{ itemId: 'white_potion', qty: 15 }] },
  },
  {
    id: 'story_crack_in_seal', name: 'A Crack in the Seal', giver: 'seraphine', minLevel: 38,
    description: 'With the stolen verses, something has begun to crack the Forbidden Wing\'s seal, and the pieces are blowing out over Stormspire Peak. Storm Harpies are carrying them to the Thunder Drakes\' nests. Ground 20 Storm Harpies and recover 4 Seal Fragments for Professor Seraphine.',
    objectives: [{ kind: 'kill', monsterId: 'storm_harpy', count: 20 }, { kind: 'collect', itemId: 'seal_fragment', count: 4 }],
    rewards: { exp: xp(39, 0.4), mesos: 9000, items: [{ itemId: 'elixir', qty: 5 }] },
  },

  // ───────────── Year 4 · The Lich Archon ─────────────
  {
    id: 'story_forbidden_wing', name: 'The Forbidden Wing', giver: 'morvane', minLevel: 45,
    description: 'Professor Morvane has the only key to the Forbidden Wing (the Arcane Sanctum, past Stormspire Peak). Go in and clear 15 Void Wisps, the Archon\'s whispers, before they carry anything else back to their master.',
    objectives: [{ kind: 'kill', monsterId: 'void_wisp', count: 15 }],
    rewards: { exp: xp(45, 0.35), mesos: 15000, items: [{ itemId: 'elixir', qty: 8 }] },
  },
  {
    id: 'story_final_thesis', name: 'The Final Thesis', giver: 'elder_maelis', minLevel: 46,
    description: 'Every graduate writes a thesis. Yours is a single line: the Lich Archon falls. Defeat it in the heart of the Arcane Sanctum and bring its Archon Sigil to Headmistress Maelis, so the stolen magic can come home.',
    objectives: [{ kind: 'kill', monsterId: 'lich_archon', count: 1 }, { kind: 'collect', itemId: 'archon_sigil', count: 1 }],
    rewards: { exp: xp(47, 0.6), mesos: 40000, items: [{ itemId: 'power_elixir', qty: 5 }] },
  },
  {
    id: GRADUATION_QUEST_ID, name: 'Commencement', giver: 'elder_maelis', minLevel: 46,
    description: 'The Lich Archon has fallen and the Forbidden Wing sleeps. All that remains is the ceremony. Talk to Headmistress Maelis to graduate from the Academy.',
    objectives: [],
    rewards: { exp: xp(48, 0.5), mesos: 50000, items: [{ itemId: 'arcane_amulet', qty: 1 }, { itemId: 'power_elixir', qty: 10 }] },
  },
];

/** Flow rules for each story step (prerequisite, Year gates). */
export const STORY_FLOW: Record<string, StoryStep> = {
  story_orientation: { maxTier: 1, talk: true, tag: 'Orientation' },
  story_office_hours: { prev: 'story_orientation', maxTier: 1, talk: true, anyProfessor: true, tag: 'Orientation' },
  story_supplies: { prev: 'story_office_hours', maxTier: 1, tag: 'Orientation' },
  story_first_practicum: { prev: 'story_supplies', maxTier: 1, tag: 'Orientation' },
  story_declaration: { prev: 'story_first_practicum', maxTier: 1, tag: 'Year 1' },
  story_violet_thorns: { prev: 'story_declaration', minTier: 2, tag: 'Year 2' },
  story_pages_in_snow: { prev: 'story_violet_thorns', minTier: 2, tag: 'Year 2' },
  story_faculty_meeting: { prev: 'story_pages_in_snow', minTier: 3, talk: true, tag: 'Year 3' },
  story_ash_and_ink: { prev: 'story_faculty_meeting', minTier: 3, tag: 'Year 3' },
  story_crack_in_seal: { prev: 'story_ash_and_ink', minTier: 3, tag: 'Year 3' },
  story_forbidden_wing: { prev: 'story_crack_in_seal', minTier: 4, tag: 'Year 4' },
  story_final_thesis: { prev: 'story_forbidden_wing', minTier: 4, tag: 'Final Thesis' },
  [GRADUATION_QUEST_ID]: { prev: 'story_final_thesis', minTier: 4, talk: true, tag: 'Graduation' },
};

export const STORY_QUEST_IDS = new Set(STORY_QUESTS.map(q => q.id));

/** Minimal state shape the flow helpers need (keeps this data module free of system imports). */
export interface StoryStateView {
  level: number;
  tier: number;
  quests: Record<string, { status: string } | undefined>;
}

/**
 * True when a story step no longer blocks the chain: handed in, or a Year 1 lesson the student has outgrown
 * (an accepted-but-unfinished one can still be handed in later; it just stops gating the main line).
 */
export function storyStepDone(v: StoryStateView, id: string): boolean {
  if (v.quests[id]?.status === 'turned_in') return true;
  const f = STORY_FLOW[id];
  return !!f?.maxTier && v.tier > f.maxTier;
}

/**
 * Whether a not-yet-accepted story step may be offered now (prerequisite done, Year gates met).
 * Level is NOT checked here — combine with the quest's `minLevel` (Progression.canAcceptQuest does).
 * UI hint for the lead: the quest log's "Available" tab can filter story quests with this.
 */
export function storyStepUnlocked(v: StoryStateView, id: string): boolean {
  const f = STORY_FLOW[id];
  if (!f) return true;
  if (f.prev && !storyStepDone(v, f.prev)) return false;
  if (f.minTier && v.tier < f.minTier) return false;
  if (f.maxTier && v.tier > f.maxTier) return false;
  return true;
}
