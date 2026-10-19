// Year 4 major classes: one per School (`school` set, `kind: 'major'`). See src/data/courses/README.md.
// Each class is a mastery capstone: three missions of the professor's hardest field work (each touching the Forbidden
// Wing story), then that School's Fellowship Exam (`q_job_*_archon`, which admits the student to Year 5) as the last mission.
import type { CourseDef, QuestDef } from '../../core/types';
import { expToNext } from '../../core/balance';

/** Mission EXP reward as a fraction of the EXP needed for `level`. */
const xp = (level: number, frac: number) => Math.round(expToNext(level) * frac);

/** Course reward shared by the five capstones: about one level of EXP plus mesos, 2 SP and a School-flavoured extra. */
const passRewards = (items: { itemId: string; qty: number }[]): CourseDef['rewards'] =>
  ({ exp: xp(44, 1.0), mesos: 40000, sp: 2, items });

export const COURSES_Y4_MAJORS: CourseDef[] = [
  {
    id: 'c4_pyromancy', year: 4, name: 'Pyromancy Mastery', code: 'PYR 401', teacher: 'pyra', kind: 'major', school: 'fire',
    blurb: 'Capstone for Fire majors. Professor Pyra takes you into the Cinder Caverns and the Forbidden Wing to learn what a fire can burn, and what it must not.',
    missions: ['m4_pyromancy_1', 'm4_pyromancy_2', 'm4_pyromancy_3', 'q_job_pyre_archon'],
    badge: { id: 'b_pyromancy_mastery', name: 'Mastery of Flame', color: 0xff6a2a, shape: 'star' },
    rewards: passRewards([{ itemId: 'power_elixir', qty: 8 }, { itemId: 'mana_elixir', qty: 15 }]),
    passLine: 'Top marks, and I do not give those. You have learned to burn precisely. Now please do not set the Forbidden Wing on fire. Again.',
  },
  {
    id: 'c4_cryomancy', year: 4, name: 'Cryomancy Mastery', code: 'CRY 401', teacher: 'glacius', kind: 'major', school: 'ice',
    blurb: 'Capstone for Ice majors. Professor Glacius takes you through the Restricted Stacks and into the Forbidden Wing, where very old things need to be kept very still.',
    missions: ['m4_cryomancy_1', 'm4_cryomancy_2', 'm4_cryomancy_3', 'q_job_winter_archon'],
    badge: { id: 'b_cryomancy_mastery', name: 'Mastery of Frost', color: 0x6fd8ff, shape: 'diamond' },
    rewards: passRewards([{ itemId: 'arcane_amulet', qty: 1 }, { itemId: 'power_elixir', qty: 6 }]),
    passLine: 'Calm, exact and cold all the way through. I could not be prouder, and I am showing it by not saying so twice.',
  },
  {
    id: 'c4_storm_magic', year: 4, name: 'Storm Magic Mastery', code: 'STM 401', teacher: 'voltis', kind: 'major', school: 'lightning',
    blurb: 'Capstone for Lightning majors. Professor Voltis wants a storm that obeys, so she sends you up Stormspire Peak, and then into the one place that has no weather.',
    missions: ['m4_storm_magic_1', 'm4_storm_magic_2', 'm4_storm_magic_3', 'q_job_storm_archon'],
    badge: { id: 'b_storm_magic_mastery', name: 'Mastery of Storms', color: 0xffe14d, shape: 'shield' },
    rewards: passRewards([{ itemId: 'wyrmheart_amulet', qty: 1 }, { itemId: 'power_elixir', qty: 6 }]),
    passLine: 'You hit the exact spot, at the exact moment, on purpose. That is the whole subject. Class dismissed, and mind the metal railings.',
  },
  {
    id: 'c4_holy_magic', year: 4, name: 'Holy Magic Mastery', code: 'HLY 401', teacher: 'seraphine', kind: 'major', school: 'holy',
    blurb: 'Capstone for Holy majors. Professor Seraphine asks you to bring light to the places that have forgotten it: the Stacks, the Forbidden Wing, and the cracked seal.',
    missions: ['m4_holy_magic_1', 'm4_holy_magic_2', 'm4_holy_magic_3', 'q_job_light_archon'],
    badge: { id: 'b_holy_magic_mastery', name: 'Mastery of Light', color: 0xf5e6a8, shape: 'crest' },
    rewards: passRewards([{ itemId: 'power_elixir', qty: 10 }, { itemId: 'elixir', qty: 10 }]),
    passLine: 'You carried the light into the dark and did not mistake yourself for it. That is the lesson. Go gently, and keep your lamp trimmed.',
  },
  {
    id: 'c4_shadow_magic', year: 4, name: 'Shadow Magic Mastery', code: 'SHD 401', teacher: 'morvane', kind: 'major', school: 'shadow',
    blurb: 'Capstone for Shadow majors. Professor Morvane has read the Archon\'s margins for years. She would like you to read them with her, quietly, and not tell the faculty.',
    missions: ['m4_shadow_magic_1', 'm4_shadow_magic_2', 'm4_shadow_magic_3', 'q_job_night_archon'],
    badge: { id: 'b_shadow_magic_mastery', name: 'Mastery of Shadow', color: 0x9a5cff, shape: 'circle' },
    rewards: passRewards([{ itemId: 'power_elixir', qty: 8 }, { itemId: 'mana_elixir', qty: 15 }]),
    passLine: 'You know what the dark is for now, which is more than the Archon ever did. Keep your own counsel. I always have, and look how well it has gone.',
  },
];

/** New missions for these classes (ids `m4_<course slug>_<n>`). */
export const MISSIONS_Y4_MAJORS: QuestDef[] = [
  // ───────────── PYR 401 · Pyromancy Mastery (Pyra) ─────────────
  {
    id: 'm4_pyromancy_1', name: 'Hotter Than Ink', giver: 'pyra', minLevel: 40,
    description: 'Pyra: "The thief burns pages in the Cinder Caverns, and ordinary fire cannot even scorch the Archon\'s ink. Mine can. Go down to the Cinder Caverns, shatter 15 Magma Golems and bring me 6 Magma Cores. I need to learn what temperature a forbidden sentence ignites at."',
    objectives: [{ kind: 'visit', mapId: 'cinder_caverns' }, { kind: 'kill', monsterId: 'magma_golem', count: 15 }, { kind: 'collect', itemId: 'magma_core', count: 6 }],
    rewards: { exp: xp(40, 0.4), mesos: 8000, items: [{ itemId: 'white_potion', qty: 15 }] },
  },
  {
    id: 'm4_pyromancy_2', name: 'Magmaw\'s Last Lesson', giver: 'pyra', minLevel: 42,
    description: 'Pyra: "Magmaw has been eating ash from the burned notes, and it is getting clever. A clever landslide is a menace. Return to the Cinder Caverns and put it down for good, and bring me 12 Salamander Scales so I can see how far the ink-smoke has spread."',
    objectives: [{ kind: 'kill', monsterId: 'magmaw', count: 1 }, { kind: 'collect', itemId: 'salamander_scale', count: 12 }],
    rewards: { exp: xp(42, 0.45), mesos: 10000, items: [{ itemId: 'mana_elixir', qty: 10 }] },
  },
  {
    id: 'm4_pyromancy_3', name: 'A Fire the Wing Cannot Read', giver: 'pyra', minLevel: 44,
    description: 'Pyra: "Last field day. Professor Morvane keeps the key to the Forbidden Wing, so go and ask her to open it. Then enter the Arcane Sanctum, burn out 20 Void Wisps (they whisper, and I do not want them whispering about me) and bring me 5 Void Crystals. A flame is the only thing in there the Archon did not write."',
    objectives: [{ kind: 'talk', npcId: 'morvane' }, { kind: 'visit', mapId: 'arcane_sanctum' }, { kind: 'kill', monsterId: 'void_wisp', count: 20 }, { kind: 'collect', itemId: 'void_crystal', count: 5 }],
    rewards: { exp: xp(44, 0.5), mesos: 12000, items: [{ itemId: 'elixir', qty: 5 }] },
  },

  // ───────────── CRY 401 · Cryomancy Mastery (Glacius) ─────────────
  {
    id: 'm4_cryomancy_1', name: 'Still Ink', giver: 'glacius', minLevel: 40,
    description: 'Glacius: "Some books should stay shut, and the Restricted Stacks agree. Go in, freeze 15 Ink Golems solid, and bring me 8 Ink Vials. Do not open them. Ink that wants to write is ink I want to chill."',
    objectives: [{ kind: 'visit', mapId: 'restricted_stacks' }, { kind: 'kill', monsterId: 'ink_golem', count: 15 }, { kind: 'collect', itemId: 'ink_vial', count: 8 }],
    rewards: { exp: xp(40, 0.4), mesos: 8000, items: [{ itemId: 'white_potion', qty: 15 }] },
  },
  {
    id: 'm4_cryomancy_2', name: 'Page Freeze', giver: 'glacius', minLevel: 42,
    description: 'Glacius: "The tomes in the Stacks are flapping loose, and the stolen pages are leaking into them. Frost the Animated Tomes still: 25 of them. Bring me 10 Tome Pages. A cold page is a page that stays where it is put."',
    objectives: [{ kind: 'kill', monsterId: 'animated_tome', count: 25 }, { kind: 'collect', itemId: 'tome_page', count: 10 }],
    rewards: { exp: xp(42, 0.45), mesos: 10000, items: [{ itemId: 'mana_elixir', qty: 10 }] },
  },
  {
    id: 'm4_cryomancy_3', name: 'Cold Case', giver: 'glacius', minLevel: 44,
    description: 'Glacius: "The Forbidden Wing is warm, which is wrong for a place that holds so much grief. Slip into the Arcane Sanctum, chill 20 Void Wisps, and bring me 5 Void Crystals. Something in there is trying to keep itself warm. I would like to know why."',
    objectives: [{ kind: 'visit', mapId: 'arcane_sanctum' }, { kind: 'kill', monsterId: 'void_wisp', count: 20 }, { kind: 'collect', itemId: 'void_crystal', count: 5 }],
    rewards: { exp: xp(44, 0.5), mesos: 12000, items: [{ itemId: 'elixir', qty: 5 }] },
  },

  // ───────────── STM 401 · Storm Magic Mastery (Voltis) ─────────────
  {
    id: 'm4_storm_magic_1', name: 'Conductors', giver: 'voltis', minLevel: 40,
    description: 'Voltis: "The Thunder Drakes carry the cracked seal on their backs, and scale conducts. Go up Stormspire Peak, bring down 20 Thunder Drakes and carry me 8 Drake Scales. I want to measure how much of the Wing\'s glow they have been soaking up."',
    objectives: [{ kind: 'visit', mapId: 'stormspire_peak' }, { kind: 'kill', monsterId: 'thunder_drake', count: 20 }, { kind: 'collect', itemId: 'drake_scale', count: 8 }],
    rewards: { exp: xp(40, 0.4), mesos: 8000, items: [{ itemId: 'white_potion', qty: 15 }] },
  },
  {
    id: 'm4_storm_magic_2', name: 'Answer the Sky', giver: 'voltis', minLevel: 42,
    description: 'Voltis: "The Tempest Wyrm has been calling lightning onto the Observatory all week. The sky asked a question and it keeps answering wrong. On Stormspire Peak, give it the right answer. Bring me 10 Golem Shards from the Crag Golems it has been cracking open, so I can mend the roof."',
    objectives: [{ kind: 'kill', monsterId: 'tempest_wyrm', count: 1 }, { kind: 'collect', itemId: 'golem_shard', count: 10 }],
    rewards: { exp: xp(42, 0.45), mesos: 10000, items: [{ itemId: 'mana_elixir', qty: 10 }] },
  },
  {
    id: 'm4_storm_magic_3', name: 'Weather in the Wing', giver: 'voltis', minLevel: 44,
    description: 'Voltis: "There is no weather in the Forbidden Wing, and I find that offensive. Past Stormspire Peak, in the Arcane Sanctum, strike down 20 Void Wisps and bring me 5 Void Crystals. If a bolt can find the Archon\'s whispers, it can find the Archon."',
    objectives: [{ kind: 'visit', mapId: 'arcane_sanctum' }, { kind: 'kill', monsterId: 'void_wisp', count: 20 }, { kind: 'collect', itemId: 'void_crystal', count: 5 }],
    rewards: { exp: xp(44, 0.5), mesos: 12000, items: [{ itemId: 'elixir', qty: 5 }] },
  },

  // ───────────── HLY 401 · Holy Magic Mastery (Seraphine) ─────────────
  {
    id: 'm4_holy_magic_1', name: 'Lamps in the Stacks', giver: 'seraphine', minLevel: 40,
    description: 'Seraphine: "The loose pages in the Restricted Stacks are not wicked. They are frightened. Go in, quiet 20 Animated Tomes with gentle light and bring me 10 Tome Pages, so I can read them their own endings and let them rest."',
    objectives: [{ kind: 'visit', mapId: 'restricted_stacks' }, { kind: 'kill', monsterId: 'animated_tome', count: 20 }, { kind: 'collect', itemId: 'tome_page', count: 10 }],
    rewards: { exp: xp(40, 0.4), mesos: 8000, items: [{ itemId: 'white_potion', qty: 15 }] },
  },
  {
    id: 'm4_holy_magic_2', name: 'The Seal, Mended', giver: 'seraphine', minLevel: 42,
    description: 'Seraphine: "The seal that holds the Forbidden Wing was written in light, and light can be mended. Enter the Arcane Sanctum, dispel 25 Void Wisps (they weaken to holy) and bring me 6 Wisp Essences. I will need them for the chapel candles, and for the patch."',
    objectives: [{ kind: 'visit', mapId: 'arcane_sanctum' }, { kind: 'kill', monsterId: 'void_wisp', count: 25 }, { kind: 'collect', itemId: 'wisp_essence', count: 6 }],
    rewards: { exp: xp(42, 0.45), mesos: 10000, items: [{ itemId: 'mana_elixir', qty: 10 }] },
  },
  {
    id: 'm4_holy_magic_3', name: 'The Last Lantern', giver: 'seraphine', minLevel: 44,
    description: 'Seraphine: "Before the final exam, one more kindness. Ink Golems in the Restricted Stacks are made of the Archon\'s unfinished sentences, and the sentences hurt. Cleanse 15 of them and bring me 6 Ink Vials. Then, on your way out, tell Headmistress Maelis that the light is holding."',
    objectives: [{ kind: 'kill', monsterId: 'ink_golem', count: 15 }, { kind: 'collect', itemId: 'ink_vial', count: 6 }, { kind: 'talk', npcId: 'elder_maelis' }],
    rewards: { exp: xp(44, 0.5), mesos: 12000, items: [{ itemId: 'elixir', qty: 5 }] },
  },

  // ───────────── SHD 401 · Shadow Magic Mastery (Morvane) ─────────────
  {
    id: 'm4_shadow_magic_1', name: 'Marginalia', giver: 'morvane', minLevel: 40,
    description: 'Morvane: "The Archon wrote in the margins of everything, and the margins live in the Restricted Stacks now. Go in, wither 15 Ink Golems and bring me 8 Ink Vials. I would like to read what he wrote when he thought nobody was reading."',
    objectives: [{ kind: 'visit', mapId: 'restricted_stacks' }, { kind: 'kill', monsterId: 'ink_golem', count: 15 }, { kind: 'collect', itemId: 'ink_vial', count: 8 }],
    rewards: { exp: xp(40, 0.4), mesos: 8000, items: [{ itemId: 'white_potion', qty: 15 }] },
  },
  {
    id: 'm4_shadow_magic_2', name: 'A Key Is a Kind of Question', giver: 'morvane', minLevel: 42,
    description: 'Morvane: "I hold the only key to the Forbidden Wing, and I would like to know what it opens besides the door. Go through the Arcane Sanctum, silence 20 Void Wisps and bring me 6 Void Crystals. They are the Archon\'s listening ears. Let us give him a long, polite silence."',
    objectives: [{ kind: 'visit', mapId: 'arcane_sanctum' }, { kind: 'kill', monsterId: 'void_wisp', count: 20 }, { kind: 'collect', itemId: 'void_crystal', count: 6 }],
    rewards: { exp: xp(42, 0.45), mesos: 10000, items: [{ itemId: 'mana_elixir', qty: 10 }] },
  },
  {
    id: 'm4_shadow_magic_3', name: 'Ink Under the Door', giver: 'morvane', minLevel: 44,
    description: 'Morvane: "Pages have been slipping under the Wing\'s doors and writing themselves into the Stacks. Hunt down 20 Animated Tomes, bring me 12 Tome Pages so I can read the draft in order, and tell the Headmistress what I am not going to say out loud. She will know."',
    objectives: [{ kind: 'kill', monsterId: 'animated_tome', count: 20 }, { kind: 'collect', itemId: 'tome_page', count: 12 }, { kind: 'talk', npcId: 'elder_maelis' }],
    rewards: { exp: xp(44, 0.5), mesos: 12000, items: [{ itemId: 'elixir', qty: 5 }] },
  },
];
