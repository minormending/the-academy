// Year 5 classes and their missions. See src/data/courses/README.md for the rules.
import type { CourseDef, QuestDef, YearPlan } from '../../core/types';
import { expToNext } from '../../core/balance';

/** Mission EXP as a fraction of the EXP needed for `level`. */
const xp = (level: number, frac: number) => Math.round(expToNext(level) * frac);

export const YEAR_5: YearPlan = {
  year: 5, title: 'Year 5 · The Fellowship', badgesToPass: 3, required: ['core', 'major'],
  intro: 'There is no Year 5 on the syllabus, so I have written one. The Archon\'s book was never finished, and an unfinished story does not stay quiet. '
    + 'Past the Forbidden Wing the stars have gone strange, and something called The Unwritten is turning blank pages into a way in. '
    + 'The Fellowship is a handful of graduates, a great many potions, and one last term. Pass three classes: mine, your own School\'s, and whichever else takes your fancy.',
  outro: 'The Unwritten is closed, the Spire is dark, and the book has an ending at last. The Fellowship has no more terms to give you, '
    + 'which is the nicest thing I can say about a school. Go home, Fellow. The Academy will keep a lamp lit in your window.',
};

export const COURSES_Y5: CourseDef[] = [
  {
    id: 'c5_unwritten', year: 5, name: 'The Unwritten', code: 'ARC 599', teacher: 'elder_maelis', kind: 'core',
    blurb: 'The Headmistress\'s own seminar, and the last chapter of the Academy\'s story. Climb the stars to the Archon Spire and end the book that writes itself.',
    missions: ['m5_unwritten_1', 'm5_unwritten_2', 'm5_unwritten_3', 'm5_unwritten_4'],
    badge: { id: 'b_unwritten', name: 'The Last Page', color: 0xffd447, shape: 'crest' },
    rewards: { exp: xp(66, 1), mesos: 120000, sp: 3, items: [{ itemId: 'archon_crown', qty: 1 }, { itemId: 'fellowship_elixir', qty: 10 }] },
    passLine: 'The last page is turned and the book is closed. Whatever comes next, Fellow, you write it yourself.',
  },
  {
    id: 'c5_bestiary', year: 5, name: 'Field Practicum: Beyond the Stars', code: 'FLD 501', teacher: 'scout_finn', kind: 'elective',
    blurb: 'Prefect Finn\'s survey of the endgame wildlife. Bring a notebook, a bedroll and a very long goodbye letter.',
    missions: ['m5_bestiary_1', 'm5_bestiary_2', 'm5_bestiary_3'],
    badge: { id: 'b_bestiary', name: 'Star Surveyor', color: 0x6fd08c, shape: 'diamond' },
    rewards: { exp: xp(60, 0.8), mesos: 60000, items: [{ itemId: 'astral_ring', qty: 1 }, { itemId: 'power_elixir', qty: 5 }] },
    passLine: 'Every page of the survey is filled in, and not one of the creatures bit the notebook. Best practicum report I have ever received.',
  },
  {
    id: 'c5_starmetal', year: 5, name: 'Artificing: Star-Metal', code: 'ART 501', teacher: 'smith_tilda', kind: 'elective',
    blurb: 'Tilda\'s forge, now with a view. Gather star dust, rift shards and Archon Seals, and learn what happens to a hammer that works on the sky.',
    missions: ['m5_starmetal_1', 'm5_starmetal_2', 'm5_starmetal_3'],
    badge: { id: 'b_starmetal', name: 'Star-Smith', color: 0xc8d4f0, shape: 'shield' },
    rewards: { exp: xp(60, 0.8), mesos: 70000, items: [{ itemId: 'rift_amulet', qty: 1 }, { itemId: 'fellowship_elixir', qty: 5 }] },
    passLine: 'That is star-metal, and you worked it like you meant to. I will ask you to sign the anvil.',
  },
];

/** New missions for this Year (ids `m5_<course>_<n>`). Existing quest ids may also be listed in a course's missions. */
export const MISSIONS_Y5: QuestDef[] = [
  // ───────────── ARC 599 · The Unwritten (Maelis, core) ─────────────
  {
    id: 'm5_unwritten_1', name: 'The Book Was Never Finished', giver: 'elder_maelis', minLevel: 55,
    description: 'The Archon never wrote an ending, and the book has been writing one for him. Headmistress Maelis wants a survey of the sky above the Forbidden Wing. Climb to the Astral Observatory, clear 15 Star Moths from the lenses, and bring back 8 pinches of Star Dust so she can read the charts.',
    objectives: [{ kind: 'visit', mapId: 'astral_observatory' }, { kind: 'kill', monsterId: 'star_moth', count: 15 }, { kind: 'collect', itemId: 'star_dust', count: 8 }],
    rewards: { exp: xp(55, 0.4), mesos: 20000, items: [{ itemId: 'white_potion', qty: 30 }] },
  },
  {
    id: 'm5_unwritten_2', name: 'Where the Map Runs Out', giver: 'morvane', minLevel: 58,
    description: 'The charts stop at the edge of the Observatory, and Professor Morvane has volunteered the Void Rift because nobody else will. Cross to the Rift, put down 15 Rift Stalkers and 15 Null Wisps, and bring her 12 Rift Shards. She says it is for the map. She is smiling about it, which is the worrying part.',
    objectives: [{ kind: 'visit', mapId: 'void_rift' }, { kind: 'kill', monsterId: 'rift_stalker', count: 15 }, { kind: 'kill', monsterId: 'null_wisp', count: 15 }, { kind: 'collect', itemId: 'rift_shard', count: 12 }],
    rewards: { exp: xp(58, 0.45), mesos: 26000, items: [{ itemId: 'mana_elixir', qty: 30 }] },
  },
  {
    id: 'm5_unwritten_3', name: 'The Spire Door', giver: 'elder_maelis', minLevel: 63,
    description: 'Beyond the Rift the stars give way to a tower: the Archon Spire, where The Unwritten has been waiting for a reader. Its door is sealed by the Archon\'s own knights. Go in, defeat 15 Archon Knights and 10 Unwritten Pages, and bring Headmistress Maelis 3 Archon Seals to prove you were there.',
    objectives: [{ kind: 'visit', mapId: 'archon_spire' }, { kind: 'kill', monsterId: 'archon_knight', count: 15 }, { kind: 'kill', monsterId: 'unwritten_page', count: 10 }, { kind: 'collect', itemId: 'archon_seal', count: 3 }],
    rewards: { exp: xp(63, 0.5), mesos: 34000, items: [{ itemId: 'elixir', qty: 10 }] },
  },
  {
    id: 'm5_unwritten_4', name: 'The Last Page', giver: 'elder_maelis', minLevel: 66,
    description: 'This is the end of the book. At the top of the Archon Spire The Unwritten has been writing itself since the day the Archon fell, and it has run out of pages that are not you. Go up, close the story, and bring Headmistress Maelis the 5 Archon Seals that fall when it does. Then come home. The Academy will have the kettle on.',
    objectives: [{ kind: 'kill', monsterId: 'the_unwritten', count: 1 }, { kind: 'collect', itemId: 'archon_seal', count: 5 }],
    rewards: { exp: xp(66, 0.8), mesos: 80000, items: [{ itemId: 'fellowship_elixir', qty: 10 }] },
  },

  // ───────────── FLD 501 · Field Practicum: Beyond the Stars (Finn) ─────────────
  {
    id: 'm5_bestiary_1', name: 'Observatory Census', giver: 'scout_finn', minLevel: 55,
    description: 'Prefect Finn has been handed the Fellowship\'s wildlife survey, and the first page is the Astral Observatory. Count it the usual way: put down 10 Star Moths and 10 Astral Sentinels, and bring back 6 pinches of Star Dust as specimens.',
    objectives: [{ kind: 'visit', mapId: 'astral_observatory' }, { kind: 'kill', monsterId: 'star_moth', count: 10 }, { kind: 'kill', monsterId: 'astral_sentinel', count: 10 }, { kind: 'collect', itemId: 'star_dust', count: 6 }],
    rewards: { exp: xp(55, 0.35), mesos: 14000, items: [{ itemId: 'white_potion', qty: 20 }] },
  },
  {
    id: 'm5_bestiary_2', name: 'Rift Census', giver: 'scout_finn', minLevel: 59,
    description: 'Page two: the Void Rift, where the field guide gets shorter every time someone checks it. Put down 10 Rift Stalkers, 10 Null Wisps and 10 Shard Horrors, and bring Finn 8 Rift Shards for the display case. Do not turn your back on the horrors, even politely.',
    objectives: [{ kind: 'visit', mapId: 'void_rift' }, { kind: 'kill', monsterId: 'rift_stalker', count: 10 }, { kind: 'kill', monsterId: 'null_wisp', count: 10 }, { kind: 'kill', monsterId: 'shard_horror', count: 10 }, { kind: 'collect', itemId: 'rift_shard', count: 8 }],
    rewards: { exp: xp(59, 0.4), mesos: 20000, items: [{ itemId: 'mana_elixir', qty: 20 }] },
  },
  {
    id: 'm5_bestiary_3', name: 'Spire Census', giver: 'scout_finn', minLevel: 64,
    description: 'The last page of the survey is the Archon Spire. Count 12 Archon Knights and 12 Unwritten Pages from a respectful distance, which is to say, from the end of your staff, and bring Finn 3 Archon Seals to staple to the cover.',
    objectives: [{ kind: 'visit', mapId: 'archon_spire' }, { kind: 'kill', monsterId: 'archon_knight', count: 12 }, { kind: 'kill', monsterId: 'unwritten_page', count: 12 }, { kind: 'collect', itemId: 'archon_seal', count: 3 }],
    rewards: { exp: xp(64, 0.45), mesos: 28000, items: [{ itemId: 'elixir', qty: 8 }] },
  },

  // ───────────── ART 501 · Artificing: Star-Metal (Tilda) ─────────────
  {
    id: 'm5_starmetal_1', name: 'Sweeping the Dome', giver: 'smith_tilda', minLevel: 55,
    description: 'Tilda has heard that the Observatory ceiling drops fine silver grit after midnight and wants every grain. Go up to the Astral Observatory, shake the Star Moths and Astral Sentinels until they give it up, and bring her 15 pinches of Star Dust. She has brought a very big broom for the rest.',
    objectives: [{ kind: 'visit', mapId: 'astral_observatory' }, { kind: 'collect', itemId: 'star_dust', count: 15 }],
    rewards: { exp: xp(55, 0.35), mesos: 15000, items: [{ itemId: 'white_potion', qty: 20 }] },
  },
  {
    id: 'm5_starmetal_2', name: 'A Shard of Sky', giver: 'smith_tilda', minLevel: 59,
    description: 'Star-metal needs a sharp edge, and the only edge that will do is a piece of the sky itself. Tilda wants 15 Rift Shards from the Void Rift. Mind the Shard Horrors: they have the same idea, and they are not selling.',
    objectives: [{ kind: 'visit', mapId: 'void_rift' }, { kind: 'collect', itemId: 'rift_shard', count: 15 }],
    rewards: { exp: xp(59, 0.4), mesos: 22000, items: [{ itemId: 'mana_elixir', qty: 20 }] },
  },
  {
    id: 'm5_starmetal_3', name: 'One Last Seal', giver: 'smith_tilda', minLevel: 64,
    description: 'Every good forge ends with a signature. Tilda wants the Archon\'s: 5 Archon Seals from the knights and pages of the Archon Spire, pressed cold into the star-metal. She promises the Headmistress will not notice the missing seals. The Headmistress has noticed.',
    objectives: [{ kind: 'visit', mapId: 'archon_spire' }, { kind: 'collect', itemId: 'archon_seal', count: 5 }],
    rewards: { exp: xp(64, 0.45), mesos: 30000, items: [{ itemId: 'elixir', qty: 8 }] },
  },
];
