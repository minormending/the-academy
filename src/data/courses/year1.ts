// Year 1 classes and their missions. See src/data/courses/README.md for the rules.
import type { CourseDef, QuestDef, YearPlan } from '../../core/types';
import { expToNext } from '../../core/balance';

/** Quest EXP reward as a fraction of the EXP needed for `level`. */
const xp = (level: number, frac: number) => Math.round(expToNext(level) * frac);

export const YEAR_1: YearPlan = {
  year: 1,
  title: 'Year 1 · The Apprentice Term',
  intro: 'Welcome, first-year. This term you will learn to walk, to cast, and to read a syllabus without weeping. Each Professor teaches a sampler of their School, and Prefect Finn runs the field practicums. Earn four badges, including Orientation, and at the end of term you will declare your major.',
  badgesToPass: 4,
  required: ['core'],
  outro: 'Four badges, a full term, and only one minor fire. You are no longer an Apprentice in anything but name. Choose your School, and Year 2 will teach you what it can really do.',
};

export const COURSES_Y1: CourseDef[] = [
  // ───────────── Core ─────────────
  {
    id: 'c1_orientation', year: 1, name: 'Orientation', code: 'ACD 101', teacher: 'elder_maelis', kind: 'core',
    blurb: 'The Headmistress\'s welcome course: campus, staff, supplies and your first practicum. Required of every first-year.',
    missions: ['story_orientation', 'story_office_hours', 'story_supplies', 'story_first_practicum', 'm1_orientation_5'],
    badge: { id: 'b_orientation', name: 'Orientation Crest', color: 0x4a5bd4, shape: 'crest' },
    rewards: { exp: xp(9, 1.0), mesos: 1500, sp: 2, items: [{ itemId: 'sage_wand', qty: 1 }, { itemId: 'red_potion', qty: 20 }, { itemId: 'blue_potion', qty: 15 }] },
    passLine: 'You found the glow and you told someone. Most students manage one or the other. Welcome to the Academy, properly this time.',
  },

  // ───────────── School samplers (electives) ─────────────
  {
    id: 'c1_kindling', year: 1, name: 'Kindling 101', code: 'PYR 101', teacher: 'pyra', kind: 'elective',
    blurb: 'Professor Pyra\'s taste of Pyromancy: what burns, what feeds a fire, and how not to set your own sleeve alight.',
    missions: ['m1_kindling_1', 'm1_kindling_2', 'm1_kindling_3'],
    badge: { id: 'b_kindling', name: 'Kindling Star', color: 0xff6a2a, shape: 'star' },
    rewards: { exp: xp(6, 1.0), mesos: 800, sp: 1, items: [{ itemId: 'willow_staff', qty: 1 }, { itemId: 'red_potion', qty: 15 }] },
    passLine: 'Not one singed eyebrow. I\'m almost disappointed. Major in Fire with me and we\'ll fix that.',
  },
  {
    id: 'c1_cold_reading', year: 1, name: 'Cold Reading', code: 'CRY 101', teacher: 'glacius', kind: 'elective',
    blurb: 'Professor Glacius\'s introduction to Cryomancy. Patience, stillness, and the radical idea of letting your enemy come to you.',
    missions: ['m1_cold_reading_1', 'm1_cold_reading_2', 'm1_cold_reading_3'],
    badge: { id: 'b_cold_reading', name: 'Frost Facet', color: 0x7fd6ff, shape: 'diamond' },
    rewards: { exp: xp(8, 1.0), mesos: 900, sp: 1, items: [{ itemId: 'blue_potion', qty: 25 }] },
    passLine: 'Steady hands, cold head. You would make a fine Cryomancer. Think it over. Slowly.',
  },
  {
    id: 'c1_sparks', year: 1, name: 'Sparks & Chains', code: 'STM 101', teacher: 'voltis', kind: 'elective',
    blurb: 'Professor Voltis\'s sampler of Storm Magic: chain your spells, cover ground, and never, ever stand still.',
    missions: ['m1_sparks_1', 'm1_sparks_2', 'm1_sparks_3'],
    badge: { id: 'b_sparks', name: 'Spark Star', color: 0xfff066, shape: 'star' },
    rewards: { exp: xp(7, 1.0), mesos: 850, sp: 1, items: [{ itemId: 'return_scroll', qty: 5 }, { itemId: 'blue_potion', qty: 15 }] },
    passLine: 'Done already? Good! Fast feet, quick fingers. The Storm School could use you. Sign up before I change my mind!',
  },
  {
    id: 'c1_mending', year: 1, name: 'Mending & Light', code: 'HOL 101', teacher: 'seraphine', kind: 'elective',
    blurb: 'Professor Seraphine\'s first lessons in Holy Magic: tend the hurt, ward the weak, and carry light where it is needed.',
    missions: ['m1_mending_1', 'm1_mending_2', 'm1_mending_3'],
    badge: { id: 'b_mending', name: 'Dawn Shield', color: 0xffe27a, shape: 'shield' },
    rewards: { exp: xp(8, 1.0), mesos: 900, sp: 1, items: [{ itemId: 'red_potion', qty: 30 }] },
    passLine: 'You looked after people before you looked after yourself. That is the whole of Holy Magic, really. My chapel door is open if you choose it.',
  },
  {
    id: 'c1_after_dark', year: 1, name: 'After Dark', code: 'SHD 101', teacher: 'morvane', kind: 'elective',
    blurb: 'Professor Morvane\'s sampler of Shadow Magic, held after curfew. Bring a lantern. You will not be allowed to use it.',
    missions: ['m1_after_dark_1', 'm1_after_dark_2', 'm1_after_dark_3'],
    badge: { id: 'b_after_dark', name: 'New Moon', color: 0x6a2ac8, shape: 'circle' },
    rewards: { exp: xp(9, 1.0), mesos: 1000, sp: 1, items: [{ itemId: 'traveler_robe', qty: 1 }, { itemId: 'blue_potion', qty: 15 }] },
    passLine: 'You kept your nerve and your mouth shut. Rare, in a first-year. Major in Shadow and I will tell you what those spores were for.',
  },

  // ───────────── Field Practicum (elective) ─────────────
  {
    id: 'c1_field_practicum', year: 1, name: 'Field Practicum', code: 'FLD 101', teacher: 'scout_finn', kind: 'elective',
    blurb: 'Prefect Finn\'s hands-on course in Whisperwood: trail markers, slime glue, a mushroom march and, for the brave, a very large snail.',
    missions: ['q_finn_snails', 'q_finn_jelly', 'q_finn_shrooms', 'q_bounty_mossback_matriarch'],
    badge: { id: 'b_field_practicum', name: 'Trailblazer Shield', color: 0x6b8f3e, shape: 'shield' },
    rewards: { exp: xp(9, 1.0), mesos: 1200, sp: 1, items: [{ itemId: 'orange_potion', qty: 15 }, { itemId: 'return_scroll', qty: 3 }] },
    passLine: 'You took down the Matriarch! I am putting that in the field log in capital letters. Same time next Year?',
  },
];

/** New missions for this Year (ids `m1_<course>_<n>`). Existing quest ids may also be listed in a course's missions. */
export const MISSIONS_Y1: QuestDef[] = [
  // ───────────── ACD 101 · Orientation (closing mission) ─────────────
  {
    id: 'm1_orientation_5', name: 'End-of-Term Rounds', giver: 'elder_maelis', minLevel: 8,
    description: 'Before term ends, Headmistress Maelis wants every first-year to walk the whole practicum trail, east through Whisperwood to Shroom Hollow, and see it with their own eyes. On your way back, a violet light is seeping under the Forbidden Wing\'s doors. Report it to Professor Morvane, who keeps the key, then come back to the Headmistress.',
    objectives: [{ kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'kill', monsterId: 'thorn_shroom', count: 8 }, { kind: 'talk', npcId: 'morvane' }],
    rewards: { exp: xp(8, 0.5), mesos: 600 },
  },

  // ───────────── PYR 101 · Kindling 101 (Pyra) ─────────────
  {
    id: 'm1_kindling_1', name: 'Dry Tinder', giver: 'pyra', minLevel: 2,
    description: 'Lesson one: fire needs fuel. The moss on a Moss Snail\'s shell dries into the best tinder on campus. Head east into Whisperwood and bring Professor Pyra 5 Snail Shells.',
    objectives: [{ kind: 'collect', itemId: 'snail_shell', count: 5 }],
    rewards: { exp: xp(2, 0.5), mesos: 120 },
  },
  {
    id: 'm1_kindling_2', name: 'Mind the Bellows', giver: 'pyra', minLevel: 4,
    description: 'A fire has to breathe. Ask Tilda at the Academy forge how she keeps hers going, then go pop 10 Puff Slimes in Whisperwood. They are mostly water, so you will learn exactly what a Fire mage is up against.',
    objectives: [{ kind: 'talk', npcId: 'smith_tilda' }, { kind: 'kill', monsterId: 'puff_slime', count: 10 }],
    rewards: { exp: xp(4, 0.5), mesos: 220, items: [{ itemId: 'red_potion', qty: 8 }] },
  },
  {
    id: 'm1_kindling_3', name: 'Embers in Waiting', giver: 'pyra', minLevel: 6,
    description: 'A dried Shroom Cap smoulders for hours; Pyra calls them embers in waiting and keeps a jar on her desk. Gather 8 from the Cap Shrooms of Whisperwood. Do not let them near your notes.',
    objectives: [{ kind: 'collect', itemId: 'shroom_cap', count: 8 }],
    rewards: { exp: xp(6, 0.5), mesos: 350 },
  },

  // ───────────── CRY 101 · Cold Reading (Glacius) ─────────────
  {
    id: 'm1_cold_reading_1', name: 'Slow Study', giver: 'glacius', minLevel: 3,
    description: 'The first virtue of Cryomancy is patience, and nothing alive is more patient than a Moss Snail. Go to Whisperwood and defeat 12 of them. If you have learned Frost Primer, chill them first and watch how a slow thing gets slower.',
    objectives: [{ kind: 'kill', monsterId: 'moss_snail', count: 12 }],
    rewards: { exp: xp(3, 0.5), mesos: 160 },
  },
  {
    id: 'm1_cold_reading_2', name: 'Still Water', giver: 'glacius', minLevel: 5,
    description: 'Puff Slime jelly is water that forgot how to sit still. Professor Glacius wants to see whether it can be taught to freeze. Bring him 10 Slime Jelly from Whisperwood, and keep them cool.',
    objectives: [{ kind: 'collect', itemId: 'slime_jelly', count: 10 }],
    rewards: { exp: xp(5, 0.5), mesos: 280, items: [{ itemId: 'blue_potion', qty: 8 }] },
  },
  {
    id: 'm1_cold_reading_3', name: 'Cold Storage', giver: 'glacius', minLevel: 8,
    description: 'Field survey. Walk past Whisperwood to Shroom Hollow and collect 6 Thorn Spores from the Thorn Shrooms. Glacius preserves samples in ice; a cold sample never lies about where it came from.',
    objectives: [{ kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'collect', itemId: 'thorn_spore', count: 6 }],
    rewards: { exp: xp(8, 0.5), mesos: 500 },
  },

  // ───────────── STM 101 · Sparks & Chains (Voltis) ─────────────
  {
    id: 'm1_sparks_1', name: 'Chain Practice', giver: 'voltis', minLevel: 3,
    description: 'Puff Slimes hop around Whisperwood in clumps, which makes them perfect for chain-spell practice. Spark Primer links them if you have it; Arcane Nova will do if you don\'t. Defeat 15. Quickly!',
    objectives: [{ kind: 'kill', monsterId: 'puff_slime', count: 15 }],
    rewards: { exp: xp(3, 0.5), mesos: 160 },
  },
  {
    id: 'm1_sparks_2', name: 'A Lap of the Grounds', giver: 'voltis', minLevel: 5,
    description: 'Storm mages never stand still. Run the whole practicum trail, through Whisperwood and on to Shroom Hollow, then report back to Bram at his counter. He owes Professor Voltis a copper coil and has been avoiding him.',
    objectives: [{ kind: 'visit', mapId: 'whisperwood' }, { kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'talk', npcId: 'merchant_bram' }],
    rewards: { exp: xp(5, 0.45), mesos: 300, items: [{ itemId: 'return_scroll', qty: 2 }] },
  },
  {
    id: 'm1_sparks_3', name: 'Conductivity Test', giver: 'voltis', minLevel: 7,
    description: 'Voltis has a theory that Shroom Caps hold a static charge. Test it in Whisperwood: defeat 12 Cap Shrooms and bring back 6 Shroom Caps. Use Quill Step to keep out of their way.',
    objectives: [{ kind: 'kill', monsterId: 'cap_shroom', count: 12 }, { kind: 'collect', itemId: 'shroom_cap', count: 6 }],
    rewards: { exp: xp(7, 0.5), mesos: 450 },
  },

  // ───────────── HOL 101 · Mending & Light (Seraphine) ─────────────
  {
    id: 'm1_mending_1', name: 'Stocking the Infirmary', giver: 'seraphine', minLevel: 2,
    description: 'The infirmary always runs short in the first week. Bring Professor Seraphine 5 Red Potions, bought from Bram or picked up in Whisperwood. Healing starts with having something to heal with.',
    objectives: [{ kind: 'collect', itemId: 'red_potion', count: 5 }],
    rewards: { exp: xp(2, 0.5), mesos: 150, items: [{ itemId: 'red_potion', qty: 8 }] },
  },
  {
    id: 'm1_mending_2', name: 'Rounds', giver: 'seraphine', minLevel: 4,
    description: 'Prefect Finn has scraped knees from yesterday\'s practicum and will not admit it. Check on him, then go to Whisperwood and clear 10 Puff Slimes, which keep bowling first-years over. A Practice Ward will hold them still.',
    objectives: [{ kind: 'talk', npcId: 'scout_finn' }, { kind: 'kill', monsterId: 'puff_slime', count: 10 }],
    rewards: { exp: xp(4, 0.5), mesos: 220 },
  },
  {
    id: 'm1_mending_3', name: 'Light Under the Caps', giver: 'seraphine', minLevel: 8,
    description: 'It is always dusk under the great mushrooms of Shroom Hollow, and the Thorn Shrooms like it that way. Carry some light in: go past Whisperwood to Shroom Hollow and drive back 10 Thorn Shrooms.',
    objectives: [{ kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'kill', monsterId: 'thorn_shroom', count: 10 }],
    rewards: { exp: xp(8, 0.5), mesos: 500 },
  },

  // ───────────── SHD 101 · After Dark (Morvane) ─────────────
  {
    id: 'm1_after_dark_1', name: 'Night Walk', giver: 'morvane', minLevel: 4,
    description: 'Class meets after curfew. Slip out the east gate into Whisperwood once the lanterns are out and learn what moves in the dark. Defeat 10 Moss Snails by feel, not by sight. Professor Morvane will know if you brought a light.',
    objectives: [{ kind: 'visit', mapId: 'whisperwood' }, { kind: 'kill', monsterId: 'moss_snail', count: 10 }],
    rewards: { exp: xp(4, 0.5), mesos: 220 },
  },
  {
    id: 'm1_after_dark_2', name: 'What Grows in the Dark', giver: 'morvane', minLevel: 6,
    description: 'Mushrooms grow where light does not, which makes them honorary members of the Shadow School. Defeat 12 Cap Shrooms in Whisperwood and bring Morvane 6 Shroom Caps. Vital Ink will teach you what a spell costs.',
    objectives: [{ kind: 'kill', monsterId: 'cap_shroom', count: 12 }, { kind: 'collect', itemId: 'shroom_cap', count: 6 }],
    rewards: { exp: xp(6, 0.5), mesos: 350 },
  },
  {
    id: 'm1_after_dark_3', name: 'Something Violet', giver: 'morvane', minLevel: 9,
    description: 'At night the Thorn Spores of Shroom Hollow glow a faint violet. Morvane wants 8 of them, collected after dark, and wants you not to mention it to anyone. She will not say why. She did glance at the Forbidden Wing.',
    objectives: [{ kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'collect', itemId: 'thorn_spore', count: 8 }],
    rewards: { exp: xp(9, 0.5), mesos: 600 },
  },
];
