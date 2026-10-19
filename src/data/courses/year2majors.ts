// Year 2 major classes: one per School (`school` set, `kind: 'major'`). See src/data/courses/README.md.
// Each class: three new missions that teach the School's identity, then that School's Year 3 entrance exam (q_job_*).
import type { CourseDef, QuestDef } from '../../core/types';
import { expToNext } from '../../core/balance';

const xp = (level: number, frac: number) => Math.round(expToNext(level) * frac);

export const COURSES_Y2_MAJORS: CourseDef[] = [
  {
    id: 'c2_combustion', year: 2, name: 'Combustion Theory', code: 'PYR 201', teacher: 'pyra', kind: 'major', school: 'fire',
    blurb: 'Professor Pyra on burn: how to start a fire, how to keep it going, and how to stop it before the Dean notices. Ends with the Flamebinder entrance exam.',
    missions: ['m2_combustion_1', 'm2_combustion_2', 'm2_combustion_3', 'q_job_flamebinder'],
    badge: { id: 'b_combustion', name: 'Combustion Theory', color: 0xe8501c, shape: 'shield' },
    rewards: { exp: xp(20, 1), mesos: 4000, sp: 2, items: [{ itemId: 'ember_staff', qty: 1 }, { itemId: 'orange_potion', qty: 10 }] },
    passLine: 'Flame holds, nothing is scorched that was not meant to be. Pin this on, and keep it away from the curtains.',
  },
  {
    id: 'c2_cryomancy', year: 2, name: 'Chill and Freeze', code: 'CRY 201', teacher: 'glacius', kind: 'major', school: 'ice',
    blurb: 'Professor Glacius on cold: slow them first, then stop them. Patience is graded. Ends with the Frostbinder entrance exam.',
    missions: ['m2_cryomancy_1', 'm2_cryomancy_2', 'm2_cryomancy_3', 'q_job_frostbinder'],
    badge: { id: 'b_cryomancy', name: 'Chill and Freeze', color: 0x5cc8f0, shape: 'diamond' },
    rewards: { exp: xp(20, 1), mesos: 4000, sp: 2, items: [{ itemId: 'frost_staff', qty: 1 }, { itemId: 'orange_potion', qty: 10 }] },
    passLine: 'Steady hands, steady frost. You did not rush it, and that is the whole lesson. Your badge.',
  },
  {
    id: 'c2_stormwork', year: 2, name: 'Chain and Shock', code: 'STM 201', teacher: 'voltis', kind: 'major', school: 'lightning',
    blurb: 'Professor Voltis on lightning: one spark is a trick, a chain of them is a crowd-clearing spell. Ends with the Stormbinder entrance exam.',
    missions: ['m2_stormwork_1', 'm2_stormwork_2', 'm2_stormwork_3', 'q_job_stormbinder'],
    badge: { id: 'b_stormwork', name: 'Chain and Shock', color: 0xffe14d, shape: 'star' },
    rewards: { exp: xp(20, 1), mesos: 4000, sp: 2, items: [{ itemId: 'storm_staff', qty: 1 }, { itemId: 'orange_potion', qty: 10 }] },
    passLine: 'Every link held and nobody was singed but me, which is within tolerances. Badge, please, quickly, before it jumps.',
  },
  {
    id: 'c2_sanctuary', year: 2, name: 'Sanctuary and Succor', code: 'HLY 201', teacher: 'seraphine', kind: 'major', school: 'holy',
    blurb: 'Professor Seraphine on mending and warding: closing the wound, then closing the door behind it. Ends with the Priest entrance exam.',
    missions: ['m2_sanctuary_1', 'm2_sanctuary_2', 'm2_sanctuary_3', 'q_job_priest'],
    badge: { id: 'b_sanctuary', name: 'Sanctuary and Succor', color: 0xffe27a, shape: 'circle' },
    rewards: { exp: xp(20, 1), mesos: 4000, sp: 2, items: [{ itemId: 'dawn_staff', qty: 1 }, { itemId: 'white_potion', qty: 10 }] },
    passLine: 'You mended what was hurt and warded what was left. That is the whole of the vocation. Wear this where it can be seen.',
  },
  {
    id: 'c2_necromancy', year: 2, name: 'Curses and Familiars', code: 'SHD 201', teacher: 'morvane', kind: 'major', school: 'shadow',
    blurb: 'Professor Morvane on curses and summoning: ask politely, and the dead may answer. Ends with the Necromancer entrance exam.',
    missions: ['m2_necromancy_1', 'm2_necromancy_2', 'm2_necromancy_3', 'q_job_necromancer'],
    badge: { id: 'b_necromancy', name: 'Curses and Familiars', color: 0x8a5ac8, shape: 'crest' },
    rewards: { exp: xp(20, 1), mesos: 4000, sp: 2, items: [{ itemId: 'grave_staff', qty: 1 }, { itemId: 'blue_potion', qty: 15 }] },
    passLine: 'A tidy curse and a well-behaved familiar. I have taught worse, and buried some of them. Your badge.',
  },
];

/** New missions for these classes (ids `m2_<course slug>_<n>`). */
export const MISSIONS_Y2_MAJORS: QuestDef[] = [
  // ───────────── Fire: Combustion Theory (burn) ─────────────
  {
    id: 'm2_combustion_1', name: 'Combustion: Kindling', giver: 'pyra', minLevel: 10, requiredJobBranch: 'fire',
    description: 'Lesson one: fire needs fuel. Head to Shroom Hollow and light up 12 Thorn Shrooms (carefully, they are damp) and watch how the burn keeps going after the spell ends.',
    objectives: [{ kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'kill', monsterId: 'thorn_shroom', count: 12 }],
    rewards: { exp: xp(10, 0.4), mesos: 700, items: [{ itemId: 'red_potion', qty: 15 }] },
  },
  {
    id: 'm2_combustion_2', name: 'Combustion: Fireproofing', giver: 'pyra', minLevel: 14, requiredJobBranch: 'fire',
    description: 'A burn is only a lesson if the lab survives it. Bring Tilda the Armorer a note about fire-proof gloves, then gather 10 pieces of Stump Bark from the Stump Golems of Shroom Hollow. They make good kindling and worse conversation.',
    objectives: [{ kind: 'talk', npcId: 'smith_tilda' }, { kind: 'collect', itemId: 'stump_bark', count: 10 }],
    rewards: { exp: xp(14, 0.4), mesos: 1000, items: [{ itemId: 'orange_potion', qty: 5 }] },
  },
  {
    id: 'm2_combustion_3', name: 'Combustion: Controlled Burn', giver: 'pyra', minLevel: 19, requiredJobBranch: 'fire',
    description: 'Class field trip to Frostfang Cliffs: set 12 Snow Yetis alight, one at a time, and hold the flame exactly as long as it takes. A burn you cannot end is just a house fire.',
    objectives: [{ kind: 'visit', mapId: 'frostfang_cliffs' }, { kind: 'kill', monsterId: 'snow_yeti', count: 12 }],
    rewards: { exp: xp(19, 0.5), mesos: 1500, items: [{ itemId: 'orange_potion', qty: 8 }] },
  },

  // ───────────── Ice: Chill and Freeze ─────────────
  {
    id: 'm2_cryomancy_1', name: 'Chill: First Frost', giver: 'glacius', minLevel: 10, requiredJobBranch: 'ice',
    description: 'Lesson one: cold slows before it stops. Take 12 Thorn Shrooms in Shroom Hollow down to a sluggish shuffle, and take notes on how much longer they take to reach you each time.',
    objectives: [{ kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'kill', monsterId: 'thorn_shroom', count: 12 }],
    rewards: { exp: xp(10, 0.4), mesos: 700, items: [{ itemId: 'red_potion', qty: 15 }] },
  },
  {
    id: 'm2_cryomancy_2', name: 'Chill: The Set Bog', giver: 'glacius', minLevel: 14, requiredJobBranch: 'ice',
    description: 'Freeze changes what a thing is. Visit Moonlit Marsh and bring back 12 Toad Slime; a good frost turns it from sludge to something close to jelly. Do not taste the jelly.',
    objectives: [{ kind: 'visit', mapId: 'moonlit_marsh' }, { kind: 'collect', itemId: 'toad_slime', count: 12 }],
    rewards: { exp: xp(14, 0.4), mesos: 1000, items: [{ itemId: 'blue_potion', qty: 10 }] },
  },
  {
    id: 'm2_cryomancy_3', name: 'Chill: Hold Still', giver: 'glacius', minLevel: 19, requiredJobBranch: 'ice',
    description: 'Frost Bats never stand still, which makes them the final test of a freeze. On Frostfang Cliffs, stop 12 of them mid-flight. The class record is fourteen seconds of perfect silence.',
    objectives: [{ kind: 'visit', mapId: 'frostfang_cliffs' }, { kind: 'kill', monsterId: 'frost_bat', count: 12 }],
    rewards: { exp: xp(19, 0.5), mesos: 1500, items: [{ itemId: 'orange_potion', qty: 8 }] },
  },

  // ───────────── Lightning: Chain and Shock ─────────────
  {
    id: 'm2_stormwork_1', name: 'Chain: Static Cling', giver: 'voltis', minLevel: 10, requiredJobBranch: 'lightning',
    description: 'Lesson one: a spark likes company. Shroom Hollow is thick with Thorn Shrooms standing in clumps, which is exactly where lightning wants to be. Shock 15 of them and watch the jump.',
    objectives: [{ kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'kill', monsterId: 'thorn_shroom', count: 15 }],
    rewards: { exp: xp(10, 0.4), mesos: 700, items: [{ itemId: 'red_potion', qty: 15 }] },
  },
  {
    id: 'm2_stormwork_2', name: 'Chain: Wet Conductor', giver: 'voltis', minLevel: 14, requiredJobBranch: 'lightning',
    description: 'Water carries a charge further than anything in the syllabus. Take your wand to Moonlit Marsh and shock 15 Bog Toads. They are the best conductors in the district and the least grateful.',
    objectives: [{ kind: 'visit', mapId: 'moonlit_marsh' }, { kind: 'kill', monsterId: 'bog_toad', count: 15 }],
    rewards: { exp: xp(14, 0.4), mesos: 1000, items: [{ itemId: 'blue_potion', qty: 10 }] },
  },
  {
    id: 'm2_stormwork_3', name: 'Chain: Frozen Light', giver: 'voltis', minLevel: 21, requiredJobBranch: 'lightning',
    description: 'On Frostfang Cliffs, Ice Wisps hang in loose clusters. Strike 8 of them and let the bolt hop between the rest. Count the links and tell me honestly how many were an accident.',
    objectives: [{ kind: 'visit', mapId: 'frostfang_cliffs' }, { kind: 'kill', monsterId: 'ice_wisp', count: 8 }],
    rewards: { exp: xp(21, 0.5), mesos: 1700, items: [{ itemId: 'orange_potion', qty: 8 }] },
  },

  // ───────────── Holy: Sanctuary and Succor ─────────────
  {
    id: 'm2_sanctuary_1', name: 'Succor: The Violet Glow', giver: 'seraphine', minLevel: 10, requiredJobBranch: 'holy',
    description: 'A violet glow is creeping into the Thorn Shrooms of Shroom Hollow, and it does not look natural. Go and cleanse it with holy light, then bring me 12 Thorn Spores so I can see what it left behind.',
    objectives: [{ kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'collect', itemId: 'thorn_spore', count: 12 }],
    rewards: { exp: xp(10, 0.4), mesos: 700, items: [{ itemId: 'red_potion', qty: 15 }] },
  },
  {
    id: 'm2_sanctuary_2', name: 'Succor: Lights Out', giver: 'seraphine', minLevel: 14, requiredJobBranch: 'holy',
    description: 'Healing is also letting go. The Will-o\'-Wisps of Moonlit Marsh are lights that cannot find their way home. Put 12 of them to rest with holy light, and they will lend you a little of their glow.',
    objectives: [{ kind: 'visit', mapId: 'moonlit_marsh' }, { kind: 'kill', monsterId: 'will_o_wisp', count: 12 }],
    rewards: { exp: xp(14, 0.4), mesos: 1000, items: [{ itemId: 'white_potion', qty: 5 }] },
  },
  {
    id: 'm2_sanctuary_3', name: 'Succor: Ward the Camp', giver: 'seraphine', minLevel: 19, requiredJobBranch: 'holy',
    description: 'Prefect Finn is camped on Frostfang Cliffs with a clipboard and very little protection. Find him, then stand a ward around the camp and hold it while you drive off 10 Frost Bats. A ward that works is invisible, so he will not thank you.',
    objectives: [{ kind: 'talk', npcId: 'scout_finn' }, { kind: 'visit', mapId: 'frostfang_cliffs' }, { kind: 'kill', monsterId: 'frost_bat', count: 10 }],
    rewards: { exp: xp(19, 0.5), mesos: 1500, items: [{ itemId: 'white_potion', qty: 8 }] },
  },

  // ───────────── Shadow: Curses and Familiars ─────────────
  {
    id: 'm2_necromancy_1', name: 'Curses: Borrowed Wood', giver: 'morvane', minLevel: 10, requiredJobBranch: 'shadow',
    description: 'Lesson one: a familiar needs a body, and a body needs bark. Stump Golems in Shroom Hollow dislike shadow more than anything else in the field. Collect 10 Stump Bark for the practical, and curse something into using it.',
    objectives: [{ kind: 'visit', mapId: 'shroom_hollow' }, { kind: 'collect', itemId: 'stump_bark', count: 10 }],
    rewards: { exp: xp(10, 0.4), mesos: 700, items: [{ itemId: 'red_potion', qty: 15 }] },
  },
  {
    id: 'm2_necromancy_2', name: 'Curses: Guide-Lights', giver: 'morvane', minLevel: 14, requiredJobBranch: 'shadow',
    description: 'The dead are easier to call when you hold something that points the way home. Visit Moonlit Marsh and bring back 10 Wisp Lanterns from the Will-o\'-Wisps. Do not follow them. They are wrong about everything.',
    objectives: [{ kind: 'visit', mapId: 'moonlit_marsh' }, { kind: 'collect', itemId: 'wisp_lantern', count: 10 }],
    rewards: { exp: xp(14, 0.4), mesos: 1000, items: [{ itemId: 'blue_potion', qty: 10 }] },
  },
  {
    id: 'm2_necromancy_3', name: 'Curses: A Proper Familiar', giver: 'morvane', minLevel: 19, requiredJobBranch: 'shadow',
    description: 'Bats make the classic first familiar: small, loyal to the night, and fond of corners. Collect 12 Bat Wings from the Frost Bats of Frostfang Cliffs for the binding, and mind your curses. They carry.',
    objectives: [{ kind: 'visit', mapId: 'frostfang_cliffs' }, { kind: 'collect', itemId: 'bat_wing', count: 12 }],
    rewards: { exp: xp(19, 0.5), mesos: 1500, items: [{ itemId: 'blue_potion', qty: 10 }] },
  },
];
