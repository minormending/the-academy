// Year 3 major classes: one per School (`school` set, `kind: 'major'`). See src/data/courses/README.md.
// Each class: three new missions from the professor's own research into the stolen pages, then that School's
// existing Year-end exam (`q_job_*`) as the last mission, which passes the class.
import type { CourseDef, QuestDef } from '../../core/types';
import { expToNext } from '../../core/balance';

/** Mission EXP as a fraction of the EXP needed for `level` (same pattern as src/data/quests.ts). */
const xp = (level: number, frac: number) => Math.round(expToNext(level) * frac);

export const COURSES_Y3_MAJORS: CourseDef[] = [
  {
    id: 'c3_pyromancy', year: 3, name: 'Pyromancy II: Kiln and Cinder', code: 'PYR 301', teacher: 'pyra', kind: 'major', school: 'fire',
    blurb: 'Professor Pyra\'s advanced seminar: how fire reads, what it leaves behind, and who has been feeding the Cinder Caverns our stolen pages. Bring gloves. Bring spare gloves.',
    missions: ['m3_pyromancy_1', 'm3_pyromancy_2', 'm3_pyromancy_3', 'q_job_inferno_sage'],
    badge: { id: 'b_pyromancy_adept', name: 'Kiln and Cinder', color: 0xff6a2a, shape: 'star' },
    rewards: { exp: xp(36, 1.0), mesos: 9000, sp: 2, items: [{ itemId: 'inferno_staff', qty: 1 }, { itemId: 'mana_elixir', qty: 5 }] },
    passLine: 'Passed. You can tell a controlled burn from an arson now, which is more than most of the faculty can. Wear the badge where the soot will not reach it.',
  },
  {
    id: 'c3_cryomancy', year: 3, name: 'Cryomancy II: Still Water', code: 'CRY 301', teacher: 'glacius', kind: 'major', school: 'ice',
    blurb: 'Professor Glacius\'s deep-cold seminar: Glacier Grotto field work, a study of what the cold remembers, and one very patient look at the fire the pages are burning in.',
    missions: ['m3_cryomancy_1', 'm3_cryomancy_2', 'm3_cryomancy_3', 'q_job_glacial_sage'],
    badge: { id: 'b_cryomancy_adept', name: 'Still Water', color: 0x4fd6ff, shape: 'diamond' },
    rewards: { exp: xp(36, 1.0), mesos: 9000, sp: 2, items: [{ itemId: 'glacier_staff', qty: 1 }, { itemId: 'mana_elixir', qty: 5 }] },
    passLine: 'Passed, and without once raising your voice. Cold is only patience with a good coat. Keep this badge somewhere it will not melt.',
  },
  {
    id: 'c3_stormcraft', year: 3, name: 'Stormcraft II: Thunder Etiquette', code: 'STM 301', teacher: 'voltis', kind: 'major', school: 'lightning',
    blurb: 'Professor Voltis\'s applied lab: ring the crystals, read the drakes, and learn what it means that the Peak has started humming in a key nobody wrote.',
    missions: ['m3_stormcraft_1', 'm3_stormcraft_2', 'm3_stormcraft_3', 'q_job_tempest_sage'],
    badge: { id: 'b_stormcraft_adept', name: 'Thunder Etiquette', color: 0xb48cff, shape: 'crest' },
    rewards: { exp: xp(36, 1.0), mesos: 9000, sp: 2, items: [{ itemId: 'tempest_staff', qty: 1 }, { itemId: 'mana_elixir', qty: 5 }] },
    passLine: 'Passed! Your hair says so too. A storm that listens is a storm that stays polite, and you have taught one to listen.',
  },
  {
    id: 'c3_sanctity', year: 3, name: 'Sanctity II: Consecration and Seals', code: 'HLY 301', teacher: 'seraphine', kind: 'major', school: 'holy',
    blurb: 'Professor Seraphine\'s seminar on seals: how they are made, how they hold, and why a student of mercy needs to know exactly how this one is cracking.',
    missions: ['m3_sanctity_1', 'm3_sanctity_2', 'm3_sanctity_3', 'q_job_hierophant'],
    badge: { id: 'b_sanctity_adept', name: 'Consecration and Seals', color: 0xffe08a, shape: 'shield' },
    rewards: { exp: xp(36, 1.0), mesos: 9000, sp: 2, items: [{ itemId: 'sunlit_scepter', qty: 1 }, { itemId: 'mana_elixir', qty: 5 }] },
    passLine: 'Passed, with grace. You hold a seal the way one holds a sleeping child: firmly, and without waking anything. I am proud of you.',
  },
  {
    id: 'c3_necromancy', year: 3, name: 'Necromancy II: Intermediate Grave Work', code: 'SHD 301', teacher: 'morvane', kind: 'major', school: 'shadow',
    blurb: 'Professor Morvane\'s seminar on the dead and what they wrote down. Reading comprehension is graded on whether the page stops moving.',
    missions: ['m3_necromancy_1', 'm3_necromancy_2', 'm3_necromancy_3', 'q_job_umbral_sage'],
    badge: { id: 'b_necromancy_adept', name: 'Grave Work', color: 0x8a5ac8, shape: 'circle' },
    rewards: { exp: xp(36, 1.0), mesos: 9000, sp: 2, items: [{ itemId: 'umbral_scepter', qty: 1 }, { itemId: 'mana_elixir', qty: 5 }] },
    passLine: 'Passed. You read the dead politely and they answered. Do not tell the Headmistress how much of this was in my syllabus; she thinks it was all theory.',
  },
];

/** New missions for these classes (ids `m3_<course slug>_<n>`). */
export const MISSIONS_Y3_MAJORS: QuestDef[] = [
  // ───────────── PYR 301 · Pyromancy II (fire) ─────────────
  {
    id: 'm3_pyromancy_1', name: 'Reading the Smoke', giver: 'pyra', minLevel: 28, requiredJobBranch: 'fire',
    description: 'Pyra has a theory: fire writes its own notes, and the pages that burned in the Cinder Caverns left a signature in whatever lives there. Travel to the Cinder Caverns, singe 12 Lava Salamanders (they like it, slightly) and bring her 6 Salamander Scales to read.',
    objectives: [{ kind: 'visit', mapId: 'cinder_caverns' }, { kind: 'kill', monsterId: 'lava_salamander', count: 12 }, { kind: 'collect', itemId: 'salamander_scale', count: 6 }],
    rewards: { exp: xp(28, 0.4), mesos: 2500 },
  },
  {
    id: 'm3_pyromancy_2', name: 'Burn Only What Is Ruined', giver: 'pyra', minLevel: 33, requiredJobBranch: 'fire',
    description: 'Not every page deserves to burn. In the Restricted Stacks, Animated Tomes have started copying stolen verses from memory, and Pyra wants the copies gone but the library standing. Defeat 12 Animated Tomes in the Restricted Stacks and bring back 6 Tome Pages (the loose ones; she will do the filing).',
    objectives: [{ kind: 'visit', mapId: 'restricted_stacks' }, { kind: 'kill', monsterId: 'animated_tome', count: 12 }, { kind: 'collect', itemId: 'tome_page', count: 6 }],
    rewards: { exp: xp(33, 0.45), mesos: 3000 },
  },
  {
    id: 'm3_pyromancy_3', name: 'Hot Take', giver: 'pyra', minLevel: 36, requiredJobBranch: 'fire',
    description: 'Someone is feeding the caverns, and Magmaw has been getting fat on it. Pyra needs a sample from the source, and a second opinion on how to stop a fire from the one person who knows. Talk to Professor Glacius, then defeat Magmaw in the Cinder Caverns (it only shows itself now and then) and bring Pyra 3 Magma Cores.',
    objectives: [{ kind: 'talk', npcId: 'glacius' }, { kind: 'kill', monsterId: 'magmaw', count: 1 }, { kind: 'collect', itemId: 'magma_core', count: 3 }],
    rewards: { exp: xp(36, 0.55), mesos: 4000, items: [{ itemId: 'white_potion', qty: 10 }] },
  },

  // ───────────── CRY 301 · Cryomancy II (ice) ─────────────
  {
    id: 'm3_cryomancy_1', name: 'Growth Rings', giver: 'glacius', minLevel: 27, requiredJobBranch: 'ice',
    description: 'Glacier Grotto holds ice that has never once been disturbed, and Glacius wants to know what it remembers. Crystal Crabs grow their shells from that ice, one ring per year, like trees with opinions. Travel to the Glacier Grotto, defeat 12 Crystal Crabs and bring Glacius 6 Crab Shards to read.',
    objectives: [{ kind: 'visit', mapId: 'glacier_grotto' }, { kind: 'kill', monsterId: 'crystal_crab', count: 12 }, { kind: 'collect', itemId: 'crab_shard', count: 6 }],
    rewards: { exp: xp(27, 0.4), mesos: 2500 },
  },
  {
    id: 'm3_cryomancy_2', name: 'Frozen Mid-Sentence', giver: 'glacius', minLevel: 31, requiredJobBranch: 'ice',
    description: 'Stolen pages that blew into the snow did not melt, Glacius notes; they froze mid-sentence, and the Frost Shades are what the cold made of the words. Disperse 12 Frost Shades in the Glacier Grotto and bring back 6 Shade Veils. Mind the verbs; some of them bite.',
    objectives: [{ kind: 'kill', monsterId: 'frost_shade', count: 12 }, { kind: 'collect', itemId: 'shade_veil', count: 6 }],
    rewards: { exp: xp(31, 0.45), mesos: 3000 },
  },
  {
    id: 'm3_cryomancy_3', name: 'Cold Case', giver: 'glacius', minLevel: 35, requiredJobBranch: 'ice',
    description: 'You cannot quench a fire you have never studied. Talk to Professor Pyra about the burned pages, then go to the Cinder Caverns and defeat 12 Lava Salamanders (they resist the heat, not you) and bring Glacius 5 Salamander Scales. He wants to see what the fire left behind when the cold got there first.',
    objectives: [{ kind: 'talk', npcId: 'pyra' }, { kind: 'visit', mapId: 'cinder_caverns' }, { kind: 'kill', monsterId: 'lava_salamander', count: 12 }, { kind: 'collect', itemId: 'salamander_scale', count: 5 }],
    rewards: { exp: xp(35, 0.5), mesos: 3500, items: [{ itemId: 'white_potion', qty: 10 }] },
  },

  // ───────────── STM 301 · Stormcraft II (lightning) ─────────────
  {
    id: 'm3_stormcraft_1', name: 'Tuning Forks', giver: 'voltis', minLevel: 27, requiredJobBranch: 'lightning',
    description: 'Crystal Crabs in the Glacier Grotto ring like tuning forks when struck by a spark, and Voltis suspects the stolen verses are humming the same note. Visit the Glacier Grotto, shock 12 Crystal Crabs (they are weak to lightning, and they know it) and bring Voltis 5 Crab Shards to test against the Peak.',
    objectives: [{ kind: 'visit', mapId: 'glacier_grotto' }, { kind: 'kill', monsterId: 'crystal_crab', count: 12 }, { kind: 'collect', itemId: 'crab_shard', count: 5 }],
    rewards: { exp: xp(27, 0.4), mesos: 2500 },
  },
  {
    id: 'm3_stormcraft_2', name: 'Weather Report', giver: 'voltis', minLevel: 35, requiredJobBranch: 'lightning',
    description: 'The Thunder Drakes of Stormspire Peak have gone quiet, and a quiet drake is a charging drake. Voltis wants a read on what is feeding them. Climb Stormspire Peak, defeat 10 Thunder Drakes and bring back 4 Drake Scales for the lab.',
    objectives: [{ kind: 'visit', mapId: 'stormspire_peak' }, { kind: 'kill', monsterId: 'thunder_drake', count: 10 }, { kind: 'collect', itemId: 'drake_scale', count: 4 }],
    rewards: { exp: xp(35, 0.45), mesos: 3500 },
  },
  {
    id: 'm3_stormcraft_3', name: 'Ground Rules', giver: 'voltis', minLevel: 38, requiredJobBranch: 'lightning',
    description: 'Voltis has measured it: the Peak is humming in the key of the Forbidden Wing\'s seal, and the Crag Golems are the ones conducting it. Speak with Professor Seraphine about what the seal does under load, then break 10 Crag Golems on Stormspire Peak and bring Voltis 4 Golem Shards. Wear rubber soles. He is not joking.',
    objectives: [{ kind: 'talk', npcId: 'seraphine' }, { kind: 'kill', monsterId: 'crag_golem', count: 10 }, { kind: 'collect', itemId: 'golem_shard', count: 4 }],
    rewards: { exp: xp(38, 0.5), mesos: 4500, items: [{ itemId: 'white_potion', qty: 10 }] },
  },

  // ───────────── HLY 301 · Sanctity II (holy) ─────────────
  {
    id: 'm3_sanctity_1', name: 'Where the Lights Were Going', giver: 'seraphine', minLevel: 27, requiredJobBranch: 'holy',
    description: 'Seraphine\'s first lesson in seals is that nothing is ever just lost; it is going somewhere. She wants a map of where the Ice Wisps of the Glacier Grotto were heading when the pages blew past them. Visit the Glacier Grotto, lay 12 Ice Wisps to rest (holy light, gently) and bring her 6 Wisp Essences.',
    objectives: [{ kind: 'visit', mapId: 'glacier_grotto' }, { kind: 'kill', monsterId: 'ice_wisp', count: 12 }, { kind: 'collect', itemId: 'wisp_essence', count: 6 }],
    rewards: { exp: xp(27, 0.4), mesos: 2500 },
  },
  {
    id: 'm3_sanctity_2', name: 'Blessed Be the Margins', giver: 'seraphine', minLevel: 33, requiredJobBranch: 'holy',
    description: 'A seal is a sentence the Archon\'s keepers wrote to bind him, and the stolen pages are its missing words. In the Restricted Stacks, Animated Tomes are reciting the fragments from memory. Quiet 12 of them and bring Seraphine 6 Tome Pages so she can bless the margins and read what they say.',
    objectives: [{ kind: 'visit', mapId: 'restricted_stacks' }, { kind: 'kill', monsterId: 'animated_tome', count: 12 }, { kind: 'collect', itemId: 'tome_page', count: 6 }],
    rewards: { exp: xp(33, 0.45), mesos: 3000 },
  },
  {
    id: 'm3_sanctity_3', name: 'Load Test', giver: 'seraphine', minLevel: 37, requiredJobBranch: 'holy',
    description: 'Voltis has been measuring the Peak and has numbers Seraphine would rather not have. Talk to Professor Voltis, then ground 12 Storm Harpies on Stormspire Peak (they are carrying verses to the nests) and bring Seraphine 4 Harpy Feathers. She is blessing the seal\'s stress points, one by one.',
    objectives: [{ kind: 'talk', npcId: 'voltis' }, { kind: 'visit', mapId: 'stormspire_peak' }, { kind: 'kill', monsterId: 'storm_harpy', count: 12 }, { kind: 'collect', itemId: 'harpy_feather', count: 4 }],
    rewards: { exp: xp(37, 0.5), mesos: 4500, items: [{ itemId: 'white_potion', qty: 10 }] },
  },

  // ───────────── SHD 301 · Necromancy II (shadow) ─────────────
  {
    id: 'm3_necromancy_1', name: 'Borrowed Cloaks', giver: 'morvane', minLevel: 28, requiredJobBranch: 'shadow',
    description: 'A Frost Shade is a ghost that cannot afford a cloak, so it wears the cold. Morvane wants to know whose handwriting it learned from. Visit the Glacier Grotto, unravel 12 Frost Shades and bring her 6 Shade Veils. Do not wear one; she has seen the results.',
    objectives: [{ kind: 'visit', mapId: 'glacier_grotto' }, { kind: 'kill', monsterId: 'frost_shade', count: 12 }, { kind: 'collect', itemId: 'shade_veil', count: 6 }],
    rewards: { exp: xp(28, 0.4), mesos: 2500 },
  },
  {
    id: 'm3_necromancy_2', name: 'Ashes to Ashes', giver: 'morvane', minLevel: 32, requiredJobBranch: 'shadow',
    description: 'Burned pages are not dead pages, Morvane insists; they are merely between drafts. The Lava Salamanders of the Cinder Caverns shelter in the ashes, and shadow shows them to be quite soft in the middle. Defeat 12 Lava Salamanders and bring back 5 Salamander Scales dusted with ink-ash.',
    objectives: [{ kind: 'visit', mapId: 'cinder_caverns' }, { kind: 'kill', monsterId: 'lava_salamander', count: 12 }, { kind: 'collect', itemId: 'salamander_scale', count: 5 }],
    rewards: { exp: xp(32, 0.45), mesos: 3000 },
  },
  {
    id: 'm3_necromancy_3', name: 'Reading the Dead', giver: 'morvane', minLevel: 36, requiredJobBranch: 'shadow',
    description: 'The Archon was Headmaster once, and only the Headmistress remembers his handwriting. Talk to Headmistress Maelis, then go to the Restricted Stacks, silence 12 Animated Tomes (they are practising his penmanship) and bring Morvane 6 Tome Pages. A necromancer reads the dead politely, and verifies the signature.',
    objectives: [{ kind: 'talk', npcId: 'elder_maelis' }, { kind: 'visit', mapId: 'restricted_stacks' }, { kind: 'kill', monsterId: 'animated_tome', count: 12 }, { kind: 'collect', itemId: 'tome_page', count: 6 }],
    rewards: { exp: xp(36, 0.5), mesos: 4000, items: [{ itemId: 'white_potion', qty: 10 }] },
  },
];
