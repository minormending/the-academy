// Year 2 classes and their missions. See src/data/courses/README.md for the rules.
// The major classes (one per School) live in year2majors.ts.
import type { CourseDef, QuestDef, YearPlan } from '../../core/types';
import { expToNext } from '../../core/balance';

/** Mission EXP reward as a fraction of the EXP needed for `level`. */
const xp = (level: number, frac: number) => Math.round(expToNext(level) * frac);

export const YEAR_2: YearPlan = {
  year: 2, title: 'Year 2 · The Violet Glow', badgesToPass: 4, required: ['core', 'major'],
  intro: 'Welcome back, second-year. You have a School now, a wand that fits, and a syllabus with real teeth. '
    + 'Fair warning: the violet glow under the Forbidden Wing has stopped staying under the Forbidden Wing, and pages '
    + 'from the sealed notes are turning up in places pages have no business being. Take your core class and your major, '
    + 'pick a couple of electives, and pass four classes. Do keep an eye on the margins.',
  outro: 'Four badges, a full satchel and a very muddy hem. Well done. You followed the glow from the Hollow to the '
    + 'snow and you did not lose your nerve, which is more than the stolen pages can say. Year 3 is when I tell you what '
    + 'the Forbidden Wing is really for. Come to the faculty meeting. Bring tea.',
};

export const COURSES_Y2: CourseDef[] = [
  // ───────────── Core: Maelis ─────────────
  {
    id: 'c2_core', year: 2, name: 'Marginalia: Reading the Forbidden Wing', code: 'ARC 201', teacher: 'elder_maelis', kind: 'core',
    blurb: 'Headmistress Maelis\'s seminar on the Academy\'s oldest problem. Follow the violet glow from Shroom Hollow to Frostfang Cliffs and find out where the missing pages went.',
    missions: ['m2_core_1', 'story_violet_thorns', 'story_pages_in_snow', 'm2_core_2'],
    badge: { id: 'b_marginalia', name: 'Marginalia', color: 0x8a5ac8, shape: 'crest' },
    rewards: { exp: xp(22, 1), mesos: 4000, sp: 2, items: [{ itemId: 'sage_hat', qty: 1 }, { itemId: 'mana_elixir', qty: 10 }] },
    passLine: 'Pass, with a note in the margin: curiosity. Keep it. Just keep it pointed away from locked doors.',
  },
  // ───────────── Elective: Finn ─────────────
  {
    id: 'c2_field', year: 2, name: 'Field Studies II: Hollow to Marsh', code: 'FLD 201', teacher: 'scout_finn', kind: 'elective',
    blurb: 'Prefect Finn\'s second-year practicum. Calm the Hollow, dethrone its king, then take the night walk through the Moonlit Marsh without following the wrong lights.',
    missions: ['q_finn_stumps', 'q_bounty_shroom_monarch', 'q_finn_lanterns', 'm2_field_1'],
    badge: { id: 'b_field_studies', name: 'Field Studies', color: 0x5fae4a, shape: 'shield' },
    rewards: { exp: xp(16, 1), mesos: 2500, sp: 1, items: [{ itemId: 'traveler_boots', qty: 1 }, { itemId: 'orange_potion', qty: 20 }] },
    passLine: 'You came back with the same number of limbs you left with. In Field Studies, that is an A.',
  },
  // ───────────── Elective: Tilda ─────────────
  {
    id: 'c2_artifice', year: 2, name: 'Artificing I: Bark, Leather and Bone', code: 'ART 201', teacher: 'smith_tilda', kind: 'elective',
    blurb: 'Tilda\'s forge is short on materials and long on opinions. Gather bark, leather and bone and learn what a staff is actually made of.',
    missions: ['m2_art_1', 'q_tilda_wings', 'm2_art_2', 'm2_art_3'],
    badge: { id: 'b_artificing', name: 'Artificing', color: 0xd9822b, shape: 'diamond' },
    rewards: { exp: xp(22, 1), mesos: 4500, sp: 1, items: [{ itemId: 'traveler_robe', qty: 1 }, { itemId: 'mana_elixir', qty: 10 }] },
    passLine: 'Good hands, good eye, only one singed eyebrow. The forge approves. I approve. The eyebrow does not.',
  },
  // ───────────── Elective: Bram ─────────────
  {
    id: 'c2_alchemy', year: 2, name: 'Practical Alchemy and Shelf Economics', code: 'ALC 201', teacher: 'merchant_bram', kind: 'elective',
    blurb: 'Quartermaster Bram teaches the two things nobody tells you about potions: what goes in them, and what they cost. Bring receipts.',
    missions: ['m2_alch_1', 'm2_alch_2', 'm2_alch_3', 'm2_alch_4'],
    badge: { id: 'b_alchemy', name: 'Alchemy', color: 0xe8c547, shape: 'circle' },
    rewards: { exp: xp(22, 1), mesos: 5000, sp: 1, items: [{ itemId: 'orange_potion', qty: 30 }, { itemId: 'mana_elixir', qty: 15 }] },
    passLine: 'The books balance, the shelves are full, and you only spilled twice. I am keeping the badge deposit. Kidding. Mostly.',
  },
];

/** New missions for this Year (ids `m2_<course>_<n>`). Existing quest ids may also be listed in a course's missions. */
export const MISSIONS_Y2: QuestDef[] = [
  // ───────────── ARC 201 · Marginalia (core) ─────────────
  {
    id: 'm2_core_1', name: 'The Glow Has Legs', giver: 'elder_maelis', minLevel: 10,
    description: 'Maelis has pinned a page of her own notes to the board: the violet glow under the Forbidden Wing is gone from the corridor, and something in the sealed notes has gone with it. Walk out to Shroom Hollow and ask Prefect Finn what the mushrooms have been up to. Bring a lantern. Do not touch anything purple.',
    objectives: [{ kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'talk', npcId: 'scout_finn' }],
    rewards: { exp: xp(10, 0.3), mesos: 500, items: [{ itemId: 'orange_potion', qty: 10 }] },
  },
  {
    id: 'm2_core_2', name: 'The Missing Chapter', giver: 'elder_maelis', minLevel: 22,
    description: 'Glacius has read what the snow gave up, and it is a page from the middle of a sentence, and the sentence was written by a hand that is not any Professor\'s. Someone wants the Forbidden Wing\'s notes in pieces. Frostfang\'s Snow Yetis have been nesting in torn parchment. Thin out 12 of them and bring Maelis 6 Yeti Fur from the nests, scraps of parchment still tangled in it, so she can match the paper.',
    objectives: [{ kind: 'kill', monsterId: 'snow_yeti', count: 12 }, { kind: 'collect', itemId: 'yeti_fur', count: 6 }],
    rewards: { exp: xp(22, 0.5), mesos: 2800, items: [{ itemId: 'mana_elixir', qty: 10 }] },
  },

  // ───────────── FLD 201 · Field Studies II (Finn) ─────────────
  {
    id: 'm2_field_1', name: 'Night Walk Survey', giver: 'scout_finn', minLevel: 16,
    description: 'The lanterns are hung, so now Finn needs proof that the route holds. Walk the Moonlit Marsh end to end, clear 15 Bog Toads off the path (they sit on the boardwalk and look smug) and douse 8 Will-o\'-Wisps so the next group follows the real trail. Report: "no one drowned." Ideally in writing.',
    objectives: [{ kind: 'visit', mapId: 'moonlit_marsh' }, { kind: 'kill', monsterId: 'bog_toad', count: 15 }, { kind: 'kill', monsterId: 'will_o_wisp', count: 8 }],
    rewards: { exp: xp(16, 0.5), mesos: 1500, items: [{ itemId: 'blue_potion', qty: 15 }] },
  },

  // ───────────── ART 201 · Artificing I (Tilda) ─────────────
  {
    id: 'm2_art_1', name: 'Bark for the Handle', giver: 'smith_tilda', minLevel: 12,
    description: 'Every staff starts with a handle, and the best handles come from trees that already hate you. Take Tilda\'s gloves to Shroom Hollow and bring back 10 Stump Bark from the Stump Golems. Dry it by the fire. Do not, under any circumstances, apologise to the stump.',
    objectives: [{ kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'collect', itemId: 'stump_bark', count: 10 }],
    rewards: { exp: xp(12, 0.4), mesos: 800, items: [{ itemId: 'orange_potion', qty: 10 }] },
  },
  {
    id: 'm2_art_2', name: 'A Spine for the Staff', giver: 'smith_tilda', minLevel: 19,
    description: 'Bellows leather sorted, now the hard part: a staff needs a core that will not snap in a cold snap. Yeti Bone is the strongest thing on Frostfang Cliffs that is not a yeti. Bring Tilda 6 Yeti Bones, and mind the yeti it came from.',
    objectives: [{ kind: 'collect', itemId: 'yeti_bone', count: 6 }],
    rewards: { exp: xp(19, 0.45), mesos: 1800, items: [{ itemId: 'orange_potion', qty: 15 }] },
  },
  {
    id: 'm2_art_3', name: 'Spark and Frost', giver: 'smith_tilda', minLevel: 22,
    description: 'Final project. Tilda wants a focus that holds a charge, and Ice Wisps keep one forever. Collect 8 Wisp Essences on Frostfang Cliffs and clear 10 Frost Bats off the ledge where you work, because they steal the shiny bits. She will pretend not to be touched.',
    objectives: [{ kind: 'collect', itemId: 'wisp_essence', count: 8 }, { kind: 'kill', monsterId: 'frost_bat', count: 10 }],
    rewards: { exp: xp(22, 0.5), mesos: 2800, items: [{ itemId: 'mana_elixir', qty: 8 }] },
  },

  // ───────────── ALC 201 · Practical Alchemy (Bram) ─────────────
  {
    id: 'm2_alch_1', name: 'Brewer\'s Slime', giver: 'merchant_bram', minLevel: 12,
    description: 'Lesson one of Alchemy: the main ingredient of every good tonic is something nobody wants to carry. Bram needs 10 Toad Slime from the Bog Toads of the Moonlit Marsh, up the ledge past Shroom Hollow. Seal the jar. Then seal it again.',
    objectives: [{ kind: 'visit', mapId: 'moonlit_marsh' }, { kind: 'collect', itemId: 'toad_slime', count: 10 }],
    rewards: { exp: xp(12, 0.4), mesos: 900, items: [{ itemId: 'orange_potion', qty: 10 }] },
  },
  {
    id: 'm2_alch_2', name: 'Spore Futures', giver: 'merchant_bram', minLevel: 15,
    description: 'Bram has noticed that his mushroom stock is cheaper in spring and angrier in autumn. Stock the shelves before the market turns: bring back 10 Shroom Caps and 6 Thorn Spores from Shroom Hollow. Do not eat the samples. He counts them.',
    objectives: [{ kind: 'collect', itemId: 'shroom_cap', count: 10 }, { kind: 'collect', itemId: 'thorn_spore', count: 6 }],
    rewards: { exp: xp(15, 0.45), mesos: 1400, items: [{ itemId: 'blue_potion', qty: 10 }] },
  },
  {
    id: 'm2_alch_3', name: 'The Cold Chain', giver: 'merchant_bram', minLevel: 18,
    description: 'Elixirs spoil in a warm shop, so Bram is moving his cellar to Frostfang Cliffs. The Frost Bats have already moved in and have opinions about rent. Visit the cliffs and evict 12 of them, then collect 6 Yeti Fur for the cold-storage wrapping.',
    objectives: [{ kind: 'visit', mapId: 'frostfang_cliffs' }, { kind: 'kill', monsterId: 'frost_bat', count: 12 }, { kind: 'collect', itemId: 'yeti_fur', count: 6 }],
    rewards: { exp: xp(18, 0.5), mesos: 2000, items: [{ itemId: 'orange_potion', qty: 15 }] },
  },
  {
    id: 'm2_alch_4', name: 'Final Audit', giver: 'merchant_bram', minLevel: 22,
    description: 'The term-end audit. Bram wants the elixir shelf restocked by sundown: 8 Wisp Essences from the Ice Wisps of Frostfang Cliffs and 6 more Toad Slime from the Marsh (yes, again; the jar was empty. Do not ask). Bring receipts. Bring all the receipts.',
    objectives: [{ kind: 'collect', itemId: 'wisp_essence', count: 8 }, { kind: 'collect', itemId: 'toad_slime', count: 6 }],
    rewards: { exp: xp(22, 0.5), mesos: 3000, items: [{ itemId: 'mana_elixir', qty: 10 }] },
  },
];
