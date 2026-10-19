// Year 3 classes and their missions. See src/data/courses/README.md for the rules.
import type { CourseDef, QuestDef, YearPlan } from '../../core/types';
import { expToNext } from '../../core/balance';

/** Mission EXP reward as a fraction of the EXP needed for `level`. */
const xp = (level: number, frac: number) => Math.round(expToNext(level) * frac);

export const YEAR_3: YearPlan = {
  year: 3, title: 'Year 3 · The Missing Notes',
  intro: 'Third-years sit in on faculty meetings now, which is a polite way of saying we have run out of people to ask. '
    + 'Pages are going missing from the sealed notes on the Forbidden Wing, and the trail runs through Glacier Grotto, the Cinder Caverns, '
    + 'the Restricted Stacks and up to Stormspire Peak. Take your core seminar, your major, and whichever electives keep you out of trouble. Four badges pass the Year.',
  badgesToPass: 4, required: ['core', 'major'],
  outro: 'Four badges, one cracked seal, and a faculty that has finally told you the truth. Next term we go through the door. Year 4 is the Final Year, and you will want to be rested.',
};

export const COURSES_Y3: CourseDef[] = [
  {
    id: 'c3_core', year: 3, name: 'Seminar in the Sealed Wing', code: 'ACA 301', teacher: 'elder_maelis', kind: 'core',
    blurb: 'Headmistress Maelis tells you what the faculty has kept from students for centuries, then sends you after the burned pages and the cracking seal.',
    missions: ['story_faculty_meeting', 'story_ash_and_ink', 'story_crack_in_seal', 'm3_core_1'],
    badge: { id: 'b_sealed_wing', name: 'Sealed Wing Seminar', color: 0xd4af37, shape: 'crest' },
    rewards: { exp: xp(35, 1.0), mesos: 15000, sp: 2, items: [{ itemId: 'mana_ring', qty: 1 }, { itemId: 'white_potion', qty: 20 }] },
    passLine: 'You have read the notes that were never meant for students, and you did not flinch. That is a pass. Wear the badge where the Archon can see it.',
  },
  {
    id: 'c3_library', year: 3, name: 'Library Sciences', code: 'LIB 301', teacher: 'elder_maelis', kind: 'elective',
    blurb: 'A practical course in the Restricted Stacks: shelve loose pages, return overdue books to silence, and take inventory of what the Ink Golems have been writing.',
    missions: ['m3_library_1', 'q_maelis_overdue', 'm3_library_2'],
    badge: { id: 'b_library_sciences', name: 'Library Sciences', color: 0x6b4fa0, shape: 'diamond' },
    rewards: { exp: xp(36, 1.0), mesos: 12000, items: [{ itemId: 'runed_gloves', qty: 1 }, { itemId: 'mana_elixir', qty: 15 }] },
    passLine: 'Every book accounted for, or at least accounted against. You may keep your library card. Do not lend it to a tome.',
  },
  {
    id: 'c3_economics', year: 3, name: 'Applied Economics', code: 'ECN 301', teacher: 'merchant_bram', kind: 'elective',
    blurb: 'Bram teaches that the market rewards whoever shows up with the goods: horns from the Caverns, veils from the Grotto, cores, and feathers from the Peak.',
    missions: ['m3_econ_1', 'm3_econ_2', 'q_bram_cores', 'm3_econ_3'],
    badge: { id: 'b_applied_economics', name: 'Applied Economics', color: 0x3fae6a, shape: 'circle' },
    rewards: { exp: xp(37, 1.0), mesos: 20000, items: [{ itemId: 'wind_boots', qty: 1 }, { itemId: 'white_potion', qty: 25 }] },
    passLine: 'Positive margins, clean books, and only one cauldron fire. I have seen worse from graduates. A pass, and a discount you did not hear from me.',
  },
  {
    id: 'c3_bestiary', year: 3, name: 'Advanced Bestiary', code: 'BST 301', teacher: 'scout_finn', kind: 'elective',
    blurb: 'Prefect Finn takes the field notes deeper: grotto crabs, cavern salamanders, a certain angry mountain called Magmaw, and the golems of Stormspire Peak.',
    missions: ['m3_bestiary_1', 'q_maelis_scales', 'q_bounty_magmaw', 'm3_bestiary_2'],
    badge: { id: 'b_advanced_bestiary', name: 'Advanced Bestiary', color: 0xd9743a, shape: 'star' },
    rewards: { exp: xp(38, 1.0), mesos: 22000, sp: 1, items: [{ itemId: 'sage_robe', qty: 1 }, { itemId: 'elixir', qty: 5 }] },
    passLine: 'You can name them, you can find them, and you walked out of the Caverns with your eyebrows. Top marks. The field notes are yours.',
  },
];

/** New missions for this Year (ids `m3_<course>_<n>`). Existing quest ids may also be listed in a course's missions. */
export const MISSIONS_Y3: QuestDef[] = [
  // ───────────── ACA 301 · Seminar in the Sealed Wing ─────────────
  {
    id: 'm3_core_1', name: 'The Faculty\'s Plan', giver: 'elder_maelis', minLevel: 38,
    description: 'The seal cannot be mended, only held, and the faculty has a plan to hold it. It needs three signatures before term ends: Professor Glacius for the cold, Professor Voltis for the storm, and Professor Morvane, who keeps the key. Collect them, then check the Ledger Desk in the Restricted Stacks, where the plan is filed in triplicate. Headmistress Maelis wants it all back before the Wing wakes.',
    objectives: [
      { kind: 'talk', npcId: 'glacius' }, { kind: 'talk', npcId: 'voltis' }, { kind: 'talk', npcId: 'morvane' },
      { kind: 'visit', mapId: 'restricted_stacks' },
    ],
    rewards: { exp: xp(39, 0.35), mesos: 8000, items: [{ itemId: 'elixir', qty: 5 }] },
  },

  // ───────────── LIB 301 · Library Sciences ─────────────
  {
    id: 'm3_library_1', name: 'Library Card', giver: 'elder_maelis', minLevel: 32,
    description: 'Restricted Stacks access is a privilege, and it comes with chores. Climb the tower to the Restricted Stacks and gather 10 loose Tome Pages from the Animated Tomes, then bring them to Headmistress Maelis to be reshelved. Do not read them. Do not read them out loud.',
    objectives: [{ kind: 'visit', mapId: 'restricted_stacks' }, { kind: 'collect', itemId: 'tome_page', count: 10 }],
    rewards: { exp: xp(33, 0.3), mesos: 5000, items: [{ itemId: 'white_potion', qty: 10 }] },
  },
  {
    id: 'm3_library_2', name: 'Ink Inventory', giver: 'elder_maelis', minLevel: 37,
    description: 'Someone has been writing in the Stacks, and the Ink Golems are the pens. Put down 10 Ink Golems and bring Headmistress Maelis 6 Ink Vials so she can match the handwriting. She suspects she already knows whose it is.',
    objectives: [{ kind: 'kill', monsterId: 'ink_golem', count: 10 }, { kind: 'collect', itemId: 'ink_vial', count: 6 }],
    rewards: { exp: xp(38, 0.5), mesos: 10000, items: [{ itemId: 'mana_elixir', qty: 10 }] },
  },

  // ───────────── ECN 301 · Applied Economics ─────────────
  {
    id: 'm3_econ_1', name: 'Horns of Plenty', giver: 'merchant_bram', minLevel: 26,
    description: 'Lesson one: demand. The alchemists upstairs are screaming for Imp Horns, and you are standing near the Cinder Caverns. Bring Bram 12 Imp Horns and he will explain why they cost double on the way back.',
    objectives: [{ kind: 'collect', itemId: 'imp_horn', count: 12 }],
    rewards: { exp: xp(27, 0.4), mesos: 3500, items: [{ itemId: 'white_potion', qty: 10 }] },
  },
  {
    id: 'm3_econ_2', name: 'Cold Stock', giver: 'merchant_bram', minLevel: 29,
    description: 'Lesson two: supply chains. Frost Shades in Glacier Grotto leave behind veils that cold-stores pay well for. Walk into the Grotto and bring Bram 10 Shade Veils. Dress warmly; Bram does not refund frostbite.',
    objectives: [{ kind: 'visit', mapId: 'glacier_grotto' }, { kind: 'collect', itemId: 'shade_veil', count: 10 }],
    rewards: { exp: xp(30, 0.4), mesos: 5000, items: [{ itemId: 'mana_elixir', qty: 10 }] },
  },
  {
    id: 'm3_econ_3', name: 'The Quarterly Audit', giver: 'merchant_bram', minLevel: 36,
    description: 'The final exam is an audit: everything on the Peak that can be sold, counted twice. Climb to Stormspire Peak and bring Bram 8 Harpy Feathers and 5 Golem Shards from the Crag Golems. Shards are sold by weight, so do not pad the count with pebbles.',
    objectives: [
      { kind: 'visit', mapId: 'stormspire_peak' },
      { kind: 'collect', itemId: 'harpy_feather', count: 8 }, { kind: 'collect', itemId: 'golem_shard', count: 5 },
    ],
    rewards: { exp: xp(37, 0.5), mesos: 12000, items: [{ itemId: 'white_potion', qty: 15 }] },
  },

  // ───────────── BST 301 · Advanced Bestiary ─────────────
  {
    id: 'm3_bestiary_1', name: 'Field Notes: The Grotto', giver: 'scout_finn', minLevel: 26,
    description: 'Advanced Bestiary starts underground. Take the cliff path down into Glacier Grotto and study the Crystal Crabs up close, which means defeating 12 of them. Lightning cracks their shells; frost only makes them proud. Prefect Finn will check your notes for spelling.',
    objectives: [{ kind: 'visit', mapId: 'glacier_grotto' }, { kind: 'kill', monsterId: 'crystal_crab', count: 12 }],
    rewards: { exp: xp(27, 0.4), mesos: 4000, items: [{ itemId: 'mana_elixir', qty: 10 }] },
  },
  {
    id: 'm3_bestiary_2', name: 'Field Exam: Stormspire', giver: 'scout_finn', minLevel: 38,
    description: 'The final field exam is on the highest ledge in the course. On Stormspire Peak, defeat 10 Crag Golems and bring Prefect Finn 5 Golem Shards as proof. The golems are slow, which is the only mercy the Peak offers. Remember: you may use your notes, but not the wind.',
    objectives: [
      { kind: 'visit', mapId: 'stormspire_peak' },
      { kind: 'kill', monsterId: 'crag_golem', count: 10 }, { kind: 'collect', itemId: 'golem_shard', count: 5 },
    ],
    rewards: { exp: xp(39, 0.45), mesos: 12000, items: [{ itemId: 'elixir', qty: 3 }] },
  },
];
