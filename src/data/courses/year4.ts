// Year 4 classes and their missions. See src/data/courses/README.md for the rules.
// Core (Maelis) + three electives open to every major. The five major classes live in year4majors.ts.
import type { CourseDef, QuestDef, YearPlan } from '../../core/types';
import { expToNext } from '../../core/balance';
import { GRADUATION_QUEST_ID } from '../storyQuests';

/** Mission/course EXP as a fraction of the EXP needed for `level`. */
const xp = (level: number, frac: number) => Math.round(expToNext(level) * frac);

export const YEAR_4: YearPlan = {
  year: 4, title: 'Year 4 · The Final Year',
  intro: 'Final year, and the syllabus is one page long. The pages of the Archon\'s sealed notes are gone, the Forbidden Wing is awake, and the Final Thesis is not a paper. Take your core class, your major, and whichever electives keep you alive. Four badges, and the Wing is yours to close.',
  badgesToPass: 4, required: ['core', 'major'],
  outro: 'You have finished the Academy. The Archon is gone and the Wing sleeps. Wear the robe proudly, and know the door to the Fellowship is open if you want to study what the Archon never finished. Graduates may leave. Fellows may not, and may not want to.',
};

export const COURSES_Y4: CourseDef[] = [
  {
    id: 'c4_thesis', year: 4, name: 'Final Thesis', code: 'THS 401', teacher: 'elder_maelis', kind: 'core',
    blurb: 'Primary sources, a key, and a locked door. Defeat the Lich Archon and graduate. Taught by Headmistress Maelis, who has been waiting a long time to teach it.',
    missions: ['m4_thesis_1', 'm4_thesis_2', 'story_forbidden_wing', 'story_final_thesis', GRADUATION_QUEST_ID],
    badge: { id: 'b_thesis', name: 'Final Thesis', color: 0xffd447, shape: 'crest' },
    rewards: { exp: xp(48, 1.0), mesos: 60000, sp: 3, items: [{ itemId: 'power_elixir', qty: 10 }] },
    passLine: 'Thesis accepted, with distinction, and without a single footnote. Welcome to the ranks of the Academy\'s graduates. The Wing will not be missed.',
  },
  {
    id: 'c4_armory', year: 4, name: 'Storm-Forged Artificing', code: 'ART 410', teacher: 'smith_tilda', kind: 'elective',
    blurb: 'Tilda\'s capstone workshop: build armor that drinks lightning from the stone, the feather and the scale. Open to every major. Bring thick gloves.',
    missions: ['m4_armory_1', 'm4_armory_2', 'q_tilda_drakes'],
    badge: { id: 'b_armory', name: 'Storm-Forged', color: 0x4a7aff, shape: 'shield' },
    rewards: { exp: xp(44, 1.0), mesos: 28000, items: [{ itemId: 'elixir', qty: 8 }, { itemId: 'power_elixir', qty: 2 }] },
    passLine: 'It holds a charge, it holds a shape, and it only exploded twice. Passed. Do keep the receipts.',
  },
  {
    id: 'c4_stormfield', year: 4, name: 'Field Practicum: Stormspire', code: 'FLD 410', teacher: 'scout_finn', kind: 'elective',
    blurb: 'Prefect Finn\'s last field lesson: read the sky over Stormspire Peak, thin the flocks, and answer the Tempest Wyrm. Open to every major.',
    missions: ['m4_stormfield_1', 'm4_stormfield_2', 'q_bounty_tempest_wyrm'],
    badge: { id: 'b_stormfield', name: 'Stormspire Practicum', color: 0x8f6bd8, shape: 'star' },
    rewards: { exp: xp(44, 1.0), mesos: 24000, items: [{ itemId: 'elixir', qty: 10 }] },
    passLine: 'You looked up, you did not panic, and you came back with the horn. That is the whole practicum. Top marks, and I am a little proud.',
  },
  {
    id: 'c4_containment', year: 4, name: 'Sanctum Containment', code: 'SAN 410', teacher: 'elder_maelis', kind: 'elective',
    blurb: 'Headmistress Maelis\'s seminar on sealing what leaks: tomes, seal-shards and the Void Wisps of the Arcane Sanctum. Open to every major.',
    missions: ['m4_containment_1', 'm4_containment_2', 'q_maelis_void'],
    badge: { id: 'b_containment', name: 'Containment', color: 0xc89bff, shape: 'diamond' },
    rewards: { exp: xp(47, 0.9), mesos: 40000, sp: 1, items: [{ itemId: 'power_elixir', qty: 5 }] },
    passLine: 'The cracks are sealed and the whispers have gone quiet. For now. Passed, and kindly do not tell the Board how close it was.',
  },
];

/** New missions for this Year (ids `m4_<course>_<n>`). Existing quest ids may also be listed in a course's missions. */
export const MISSIONS_Y4: QuestDef[] = [
  // ───────────── c4_thesis · Final Thesis (Maelis) ─────────────
  {
    id: 'm4_thesis_1', name: 'Primary Sources', giver: 'elder_maelis', minLevel: 40,
    description: 'Every thesis begins in the library. Maelis wants what the Archon\'s Ink Golems have been writing in the Restricted Stacks: put 15 of them down and bring back 6 Ink Vials. Mind the footnotes. They bite.',
    objectives: [{ kind: 'kill', monsterId: 'ink_golem', count: 15 }, { kind: 'collect', itemId: 'ink_vial', count: 6 }],
    rewards: { exp: xp(40, 0.4), mesos: 9000, items: [{ itemId: 'elixir', qty: 3 }] },
  },
  {
    id: 'm4_thesis_2', name: 'The Key-Keeper', giver: 'elder_maelis', minLevel: 43,
    description: 'Professor Morvane keeps the only key to the Forbidden Wing, cut from Stormspire granite, and she will not hand it over until you prove you can walk the road to the Sanctum. Visit Stormspire Peak, topple 15 Crag Golems on the path, then report to Morvane.',
    objectives: [{ kind: 'visit', mapId: 'stormspire_peak' }, { kind: 'kill', monsterId: 'crag_golem', count: 15 }, { kind: 'talk', npcId: 'morvane' }],
    rewards: { exp: xp(43, 0.4), mesos: 12000, items: [{ itemId: 'elixir', qty: 4 }] },
  },

  // ───────────── c4_armory · Storm-Forged Artificing (Tilda) ─────────────
  {
    id: 'm4_armory_1', name: 'Granite and Grit', giver: 'smith_tilda', minLevel: 40,
    description: 'Storm armor starts with a stone that already knows lightning. Tilda needs 8 Golem Shards from the Crag Golems on Stormspire Peak. Hit them with something that does not mind a thunderstorm.',
    objectives: [{ kind: 'collect', itemId: 'golem_shard', count: 8 }],
    rewards: { exp: xp(40, 0.35), mesos: 8000, items: [{ itemId: 'white_potion', qty: 15 }] },
  },
  {
    id: 'm4_armory_2', name: 'Quills for the Lining', giver: 'smith_tilda', minLevel: 41,
    description: 'Step two is the lining: Harpy Feathers hum with charge and weave into a coat that shrugs off sparks. Bring Tilda 10 from the Storm Harpies of Stormspire Peak. Do not wave them around in a thunderstorm. That is exactly how Tilda lost her eyebrows.',
    objectives: [{ kind: 'collect', itemId: 'harpy_feather', count: 10 }],
    rewards: { exp: xp(41, 0.35), mesos: 9000, items: [{ itemId: 'white_potion', qty: 15 }] },
  },

  // ───────────── c4_stormfield · Field Practicum: Stormspire (Finn) ─────────────
  {
    id: 'm4_stormfield_1', name: 'Reading the Sky', giver: 'scout_finn', minLevel: 40,
    description: 'Finn\'s final field lesson: the weather on Stormspire Peak is a creature with moods. Visit the Peak, ground 15 Storm Harpies before they carry off another survey flag, and learn to watch where the wind goes.',
    objectives: [{ kind: 'visit', mapId: 'stormspire_peak' }, { kind: 'kill', monsterId: 'storm_harpy', count: 15 }],
    rewards: { exp: xp(40, 0.35), mesos: 8000, items: [{ itemId: 'white_potion', qty: 15 }] },
  },
  {
    id: 'm4_stormfield_2', name: 'Thinning the Flock', giver: 'scout_finn', minLevel: 42,
    description: 'The Thunder Drakes have been nesting too close to the practicum trail. Defeat 15 of them so the next class can walk it, and keep an eye on the sky. Something bigger is watching, and it will be Finn\'s next assignment.',
    objectives: [{ kind: 'kill', monsterId: 'thunder_drake', count: 15 }],
    rewards: { exp: xp(42, 0.4), mesos: 11000, items: [{ itemId: 'elixir', qty: 3 }] },
  },

  // ───────────── c4_containment · Sanctum Containment (Maelis) ─────────────
  {
    id: 'm4_containment_1', name: 'Overdue Pages', giver: 'elder_maelis', minLevel: 40,
    description: 'Seminar reading: the Animated Tomes of the Restricted Stacks are shedding loose pages, and the pages are leaking something. Gather 10 Tome Pages for the Headmistress. Do not read them aloud. Nobody has ever regretted not reading one aloud.',
    objectives: [{ kind: 'collect', itemId: 'tome_page', count: 10 }],
    rewards: { exp: xp(40, 0.35), mesos: 8000, items: [{ itemId: 'white_potion', qty: 15 }] },
  },
  {
    id: 'm4_containment_2', name: 'Sealing Wax', giver: 'elder_maelis', minLevel: 42,
    description: 'A seal needs wax, and the oldest wax is the Sanctum\'s own seal, broken. Recover 5 Seal Fragments from the Thunder Drakes of Stormspire Peak so the Headmistress can melt them back into something useful.',
    objectives: [{ kind: 'collect', itemId: 'seal_fragment', count: 5 }],
    rewards: { exp: xp(42, 0.4), mesos: 11000, items: [{ itemId: 'elixir', qty: 3 }] },
  },
];
