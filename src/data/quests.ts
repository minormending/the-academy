// OWNER: A9 (progression). Quest definitions: Year-end Exams (job advancement) + Assignments (side quests).
// The Academy: every id is unchanged from Arcana Story so saves keep working; only player-facing text changed.
import type { JobId, QuestDef } from '../core/types';
import { expToNext } from '../core/balance';

/** Quest EXP reward as a fraction of the EXP needed for `level`. */
const xp = (level: number, frac: number) => Math.round(expToNext(level) * frac);

/** Year-end Exam that must be turned in before advancing to a job (Year 3 and Year 4 jobs). */
export const JOB_ADVANCEMENT_QUESTS: Partial<Record<JobId, string>> = {
  flamebinder: 'q_job_flamebinder',
  inferno_sage: 'q_job_inferno_sage',
  frostbinder: 'q_job_frostbinder',
  glacial_sage: 'q_job_glacial_sage',
  stormbinder: 'q_job_stormbinder',
  tempest_sage: 'q_job_tempest_sage',
  priest: 'q_job_priest',
  hierophant: 'q_job_hierophant',
  necromancer: 'q_job_necromancer',
  umbral_sage: 'q_job_umbral_sage',
};

export const JOB_QUEST_IDS = new Set(Object.values(JOB_ADVANCEMENT_QUESTS));

/** Rewards are identical for every school's exam of the same Year. */
const YEAR3_REWARDS: QuestDef['rewards'] = { exp: xp(25, 0.3), mesos: 3000, items: [{ itemId: 'orange_potion', qty: 20 }] };
const YEAR4_REWARDS: QuestDef['rewards'] = { exp: xp(40, 0.3), mesos: 12000, items: [{ itemId: 'elixir', qty: 5 }] };

export const QUESTS: QuestDef[] = [
  // ───────────── Year 3 Exams (lv 25, collect) ─────────────
  {
    id: 'q_job_flamebinder', name: 'Year 3 Exam: The Thawing Flame', giver: 'pyra', minLevel: 25, requiredJobBranch: 'fire',
    description: 'Practical exam. The Snow Yetis of Frostfang Cliffs have never felt a real fire. Teach them, and bring Professor Pyra 20 tufts of Yeti Fur — singed is fine.',
    objectives: [{ kind: 'collect', itemId: 'yeti_fur', count: 20 }],
    rewards: YEAR3_REWARDS,
  },
  {
    id: 'q_job_frostbinder', name: 'Year 3 Exam: The Cooled Ember', giver: 'glacius', minLevel: 25, requiredJobBranch: 'ice',
    description: 'Practical exam. Ember Imps in the Cinder Caverns burn hot and think little. Still their fire and bring Professor Glacius 20 Imp Horns, frosted through.',
    objectives: [{ kind: 'collect', itemId: 'imp_horn', count: 20 }],
    rewards: YEAR3_REWARDS,
  },
  {
    id: 'q_job_stormbinder', name: 'Year 3 Exam: Captured Light', giver: 'voltis', minLevel: 25, requiredJobBranch: 'lightning',
    description: 'Practical exam. Ice Wisps on Frostfang Cliffs are light that froze mid-flight — a spark can wake them. Bring Professor Voltis 20 Wisp Essences to charge a storm-cloak.',
    objectives: [{ kind: 'collect', itemId: 'wisp_essence', count: 20 }],
    rewards: YEAR3_REWARDS,
  },
  {
    id: 'q_job_priest', name: 'Year 3 Exam: Rest for the Restless', giver: 'seraphine', minLevel: 25, requiredJobBranch: 'holy',
    description: 'Practical exam. The Ice Wisps of Frostfang Cliffs are lost lights that forgot how to go home. Guide them to rest with holy light and bring Professor Seraphine 20 Wisp Essences for the chapel lamps.',
    objectives: [{ kind: 'collect', itemId: 'wisp_essence', count: 20 }],
    rewards: YEAR3_REWARDS,
  },
  {
    id: 'q_job_necromancer', name: 'Year 3 Exam: A Skeleton of Your Own', giver: 'morvane', minLevel: 25, requiredJobBranch: 'shadow',
    description: 'Practical exam. Every necromancer raises a first servant, and it should be a sturdy one. Wither the Snow Yetis of Frostfang Cliffs and bring Professor Morvane 20 Yeti Bones.',
    objectives: [{ kind: 'collect', itemId: 'yeti_bone', count: 20 }],
    rewards: YEAR3_REWARDS,
  },

  // ───────────── Year 4 Exams (lv 40, kill + collect) ─────────────
  {
    id: 'q_job_inferno_sage', name: 'Year 4 Exam: Molten Stone', giver: 'pyra', minLevel: 40, requiredJobBranch: 'fire',
    description: 'Final exam. A graduate of flame can melt mountains. Shatter 30 Crag Golems on Stormspire Peak and bring back 10 Golem Shards as proof.',
    objectives: [{ kind: 'kill', monsterId: 'crag_golem', count: 30 }, { kind: 'collect', itemId: 'golem_shard', count: 10 }],
    rewards: YEAR4_REWARDS,
  },
  {
    id: 'q_job_glacial_sage', name: 'Year 4 Exam: The Quenched Heart', giver: 'glacius', minLevel: 40, requiredJobBranch: 'ice',
    description: 'Final exam. Still the fire at the mountain\'s heart. Defeat 30 Magma Golems in the Cinder Caverns and bring 10 Magma Cores, frozen solid.',
    objectives: [{ kind: 'kill', monsterId: 'magma_golem', count: 30 }, { kind: 'collect', itemId: 'magma_core', count: 10 }],
    rewards: YEAR4_REWARDS,
  },
  {
    id: 'q_job_tempest_sage', name: 'Year 4 Exam: The Skyborn', giver: 'voltis', minLevel: 40, requiredJobBranch: 'lightning',
    description: 'Final exam. The harpies of Stormspire ride the thunder like it\'s theirs. It isn\'t. Ground 30 Storm Harpies and bring 10 Harpy Feathers.',
    objectives: [{ kind: 'kill', monsterId: 'storm_harpy', count: 30 }, { kind: 'collect', itemId: 'harpy_feather', count: 10 }],
    rewards: YEAR4_REWARDS,
  },
  {
    id: 'q_job_hierophant', name: 'Year 4 Exam: The Broken Seal', giver: 'seraphine', minLevel: 40, requiredJobBranch: 'holy',
    description: 'Final exam. The Sanctum\'s ancient seal is cracking, and the Thunder Drakes of Stormspire have been hoarding its pieces — the void-taint is turning them. Purify 30 Thunder Drakes and recover 10 Seal Fragments.',
    objectives: [{ kind: 'kill', monsterId: 'thunder_drake', count: 30 }, { kind: 'collect', itemId: 'seal_fragment', count: 10 }],
    rewards: YEAR4_REWARDS,
  },
  {
    id: 'q_job_umbral_sage', name: 'Year 4 Exam: Cloak of Night', giver: 'morvane', minLevel: 40, requiredJobBranch: 'shadow',
    description: 'Final exam. An Umbral Sage wears the night itself, and the night is fletched from stolen wings. Bring down 30 Storm Harpies on Stormspire Peak and bring Professor Morvane 10 Harpy Feathers.',
    objectives: [{ kind: 'kill', monsterId: 'storm_harpy', count: 30 }, { kind: 'collect', itemId: 'harpy_feather', count: 10 }],
    rewards: YEAR4_REWARDS,
  },

  // ───────────── Assignments (side quests) ─────────────
  {
    id: 'q_finn_snails', name: 'Snail Patrol', giver: 'scout_finn', minLevel: 1,
    description: 'First field practicum! Moss Snails keep sliming the Academy\'s trail markers. Clear out 10 of them so the first-years can find their way back.',
    objectives: [{ kind: 'kill', monsterId: 'moss_snail', count: 10 }],
    rewards: { exp: xp(2, 0.9), mesos: 100, items: [{ itemId: 'red_potion', qty: 10 }] },
  },
  {
    id: 'q_finn_jelly', name: 'Sticky Situation', giver: 'scout_finn', minLevel: 3,
    description: 'Prefect Finn\'s boots came apart mid-practicum. Puff Slime jelly makes excellent glue. Bring 15 Slime Jelly.',
    objectives: [{ kind: 'collect', itemId: 'slime_jelly', count: 15 }],
    rewards: { exp: xp(4, 0.6), mesos: 200, items: [{ itemId: 'blue_potion', qty: 8 }] },
  },
  {
    id: 'q_finn_shrooms', name: 'Mushroom Menace', giver: 'scout_finn', minLevel: 6,
    description: 'Cap Shrooms are marching on the practicum camp in Whisperwood. Defeat 15 before they reach the tents.',
    objectives: [{ kind: 'kill', monsterId: 'cap_shroom', count: 15 }],
    rewards: { exp: xp(7, 0.6), mesos: 400, items: [{ itemId: 'orange_potion', qty: 5 }, { itemId: 'apprentice_hat', qty: 1 }] },
  },
  {
    id: 'q_finn_stumps', name: 'Grumpy Woods', giver: 'scout_finn', minLevel: 11,
    description: 'Something in Shroom Hollow is waking the old stumps, and the practicum site is next. Calm 12 Stump Golems — permanently.',
    objectives: [{ kind: 'kill', monsterId: 'stump_golem', count: 12 }],
    rewards: { exp: xp(12, 0.5), mesos: 900, items: [{ itemId: 'cloth_gloves', qty: 1 }] },
  },
  {
    id: 'q_bram_spores', name: 'A Pinch of Thorn', giver: 'merchant_bram', minLevel: 8,
    description: 'The quartermaster\'s secret potion recipe calls for Thorn Spores. Bring Bram 12, and try not to sneeze on them.',
    objectives: [{ kind: 'collect', itemId: 'thorn_spore', count: 12 }],
    rewards: { exp: xp(9, 0.5), mesos: 600, items: [{ itemId: 'orange_potion', qty: 10 }] },
  },
  {
    id: 'q_tilda_wings', name: 'Leather for the Forge', giver: 'smith_tilda', minLevel: 16,
    description: 'Frost Bat wings make the finest bellows leather. Tilda needs 20 to keep the Academy armory\'s forge breathing.',
    objectives: [{ kind: 'collect', itemId: 'bat_wing', count: 20 }],
    rewards: { exp: xp(17, 0.45), mesos: 1500, items: [{ itemId: 'quartz_ring', qty: 1 }] },
  },
  {
    id: 'q_maelis_scales', name: 'Embers of the Deep', giver: 'elder_maelis', minLevel: 28,
    description: 'Salamander scales remember the heat of the earth. Headmistress Maelis wants 15 for her research.',
    objectives: [{ kind: 'collect', itemId: 'salamander_scale', count: 15 }],
    rewards: { exp: xp(29, 0.4), mesos: 4000, items: [{ itemId: 'mana_elixir', qty: 15 }] },
  },
  {
    id: 'q_bram_cores', name: 'Hot Commodity', giver: 'merchant_bram', minLevel: 32,
    description: 'A Magma Core keeps a potion cauldron simmering for a whole term. The quartermaster will pay handsomely for 8.',
    objectives: [{ kind: 'collect', itemId: 'magma_core', count: 8 }],
    rewards: { exp: xp(33, 0.35), mesos: 8000, items: [{ itemId: 'white_potion', qty: 20 }] },
  },
  {
    id: 'q_tilda_drakes', name: 'Scales of Thunder', giver: 'smith_tilda', minLevel: 42,
    description: 'Tilda dreams of armor that drinks lightning. Hunt Thunder Drakes on Stormspire Peak and bring 12 Drake Scales.',
    objectives: [{ kind: 'collect', itemId: 'drake_scale', count: 12 }],
    rewards: { exp: xp(43, 0.35), mesos: 15000, items: [{ itemId: 'elixir', qty: 5 }] },
  },
  {
    id: 'q_maelis_void', name: 'Whispers from the Sanctum', giver: 'elder_maelis', minLevel: 45,
    description: 'The Arcane Sanctum is leaking. Destroy 25 Void Wisps and bring back 10 Void Crystals so the Headmistress can seal the cracks.',
    objectives: [{ kind: 'kill', monsterId: 'void_wisp', count: 25 }, { kind: 'collect', itemId: 'void_crystal', count: 10 }],
    rewards: { exp: xp(46, 0.4), mesos: 25000, items: [{ itemId: 'power_elixir', qty: 5 }] },
  },
  {
    id: 'q_maelis_archon', name: 'Final Thesis: The Lich Archon', giver: 'elder_maelis', minLevel: 46,
    description: 'At the heart of the Sanctum, the Lich Archon hoards magic stolen from generations of students. Defeat it and bring the Headmistress its Sigil.',
    objectives: [{ kind: 'collect', itemId: 'archon_sigil', count: 1 }],
    rewards: { exp: xp(48, 0.8), mesos: 50000, items: [{ itemId: 'power_elixir', qty: 10 }] },
  },
];
