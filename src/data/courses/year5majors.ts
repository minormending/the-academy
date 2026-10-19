// Year 5 major classes: one per School (`school` set, `kind: 'major'`). See src/data/courses/README.md.
import type { CourseDef, QuestDef } from '../../core/types';
import { expToNext } from '../../core/balance';

/** Mission EXP as a fraction of the EXP needed for `level`. */
const xp = (level: number, frac: number) => Math.round(expToNext(level) * frac);

// Every major is three new missions (Observatory, Rift, Spire). The `q_job_*_archon` Fellowship Exams belong to the Year 4 majors.
export const COURSES_Y5_MAJORS: CourseDef[] = [
  {
    id: 'c5_pyre', year: 5, name: 'Pyromancy: The Pyre Archon', code: 'PYR 501', teacher: 'pyra', kind: 'major', school: 'fire',
    blurb: 'Professor Pyra\'s Fellowship seminar. Learn what fire does to a sky, a mirror and a blank page.',
    missions: ['m5_pyre_1', 'm5_pyre_2', 'm5_pyre_3'],
    badge: { id: 'b_pyre', name: 'Pyre Archon', color: 0xff6a2a, shape: 'shield' },
    rewards: { exp: xp(60, 1), mesos: 60000, sp: 2, items: [{ itemId: 'fellow_rod_fire', qty: 1 }, { itemId: 'power_elixir', qty: 5 }] },
    passLine: 'You passed with honours and only a little scorching. Wear the Rod of Flame properly: it is not a toasting fork, whatever the Rift told you.',
  },
  {
    id: 'c5_winter', year: 5, name: 'Cryomancy: The Winter Archon', code: 'CRY 501', teacher: 'glacius', kind: 'major', school: 'ice',
    blurb: 'Professor Glacius\'s Fellowship seminar. Learn to stop things: time, knights and, in a pinch, the Void.',
    missions: ['m5_winter_1', 'm5_winter_2', 'm5_winter_3'],
    badge: { id: 'b_winter', name: 'Winter Archon', color: 0x3fd0ff, shape: 'star' },
    rewards: { exp: xp(60, 1), mesos: 60000, sp: 2, items: [{ itemId: 'fellow_rod_ice', qty: 1 }, { itemId: 'power_elixir', qty: 5 }] },
    passLine: 'Everything held still for you, and nothing broke that I will be billed for. The Rod of Frost is yours. Do keep your gloves in the handle.',
  },
  {
    id: 'c5_storm', year: 5, name: 'Storm Magic: The Storm Archon', code: 'STM 501', teacher: 'voltis', kind: 'major', school: 'lightning',
    blurb: 'Professor Voltis\'s Fellowship seminar. Learn how to move faster than the Rift, and then slightly more.',
    missions: ['m5_storm_1', 'm5_storm_2', 'm5_storm_3'],
    badge: { id: 'b_storm', name: 'Storm Archon', color: 0xfff470, shape: 'diamond' },
    rewards: { exp: xp(60, 1), mesos: 60000, sp: 2, items: [{ itemId: 'fellow_rod_lightning', qty: 1 }, { itemId: 'power_elixir', qty: 5 }] },
    passLine: 'Passed, and in record time, which for me is also a warning. Take the Rod of Storms, and please do not hold it during exams.',
  },
  {
    id: 'c5_light', year: 5, name: 'Holy Magic: The Light Archon', code: 'HLY 501', teacher: 'seraphine', kind: 'major', school: 'holy',
    blurb: 'Professor Seraphine\'s Fellowship seminar. Learn to carry a lamp into a place that was designed to eat it.',
    missions: ['m5_light_1', 'm5_light_2', 'm5_light_3'],
    badge: { id: 'b_light', name: 'Light Archon', color: 0xfff0b0, shape: 'circle' },
    rewards: { exp: xp(60, 1), mesos: 60000, sp: 2, items: [{ itemId: 'fellow_rod_holy', qty: 1 }, { itemId: 'power_elixir', qty: 5 }] },
    passLine: 'The lamp is lit and the dark was not allowed to touch it. The Rod of Dawn is yours, and so is the chapel window you have earned.',
  },
  {
    id: 'c5_night', year: 5, name: 'Shadow Magic: The Night Archon', code: 'SHD 501', teacher: 'morvane', kind: 'major', school: 'shadow',
    blurb: 'Professor Morvane\'s Fellowship seminar. Learn what a shadow is for when the sky has none.',
    missions: ['m5_night_1', 'm5_night_2', 'm5_night_3'],
    badge: { id: 'b_night', name: 'Night Archon', color: 0xa86bff, shape: 'crest' },
    rewards: { exp: xp(60, 1), mesos: 60000, sp: 2, items: [{ itemId: 'fellow_rod_shadow', qty: 1 }, { itemId: 'power_elixir', qty: 5 }] },
    passLine: 'Passed. I will not say how it felt to watch. The Rod of Dusk is signed out in your name; the signature was already there.',
  },
];

/** New missions for these classes (ids `m5_<course slug>_<n>`). */
export const MISSIONS_Y5_MAJORS: QuestDef[] = [
  // ───────────── PYR 501 · Pyre Archon (fire) ─────────────
  {
    id: 'm5_pyre_1', name: 'Kindling the Stars', giver: 'pyra', minLevel: 55,
    description: 'Professor Pyra\'s first Fellowship lesson: stars are only slow fires, so be impatient with them. Climb to the Astral Observatory, set 15 Star Moths alight, and bring her 6 pinches of Star Dust to light the seminar room.',
    objectives: [{ kind: 'visit', mapId: 'astral_observatory' }, { kind: 'kill', monsterId: 'star_moth', count: 15 }, { kind: 'collect', itemId: 'star_dust', count: 6 }],
    rewards: { exp: xp(55, 0.35), mesos: 15000, items: [{ itemId: 'white_potion', qty: 20 }] },
  },
  {
    id: 'm5_pyre_2', name: 'The Glass Furnace', giver: 'pyra', minLevel: 58,
    description: 'Shard Horrors are glass, and glass is only sand that has been through a furnace. Cross to the Void Rift, melt 20 Shard Horrors back to where they started, and bring Pyra 8 Rift Shards still warm from the pour.',
    objectives: [{ kind: 'visit', mapId: 'void_rift' }, { kind: 'kill', monsterId: 'shard_horror', count: 20 }, { kind: 'collect', itemId: 'rift_shard', count: 8 }],
    rewards: { exp: xp(58, 0.4), mesos: 20000, items: [{ itemId: 'mana_elixir', qty: 20 }] },
  },
  {
    id: 'm5_pyre_3', name: 'A Match for a Blank Page', giver: 'pyra', minLevel: 63,
    description: 'The Unwritten sheds pages like a bad habit, and Pyra has a lot of feelings about them. Burn 25 Unwritten Pages in the Archon Spire and bring back 3 Archon Seals as ash-proof.',
    objectives: [{ kind: 'visit', mapId: 'archon_spire' }, { kind: 'kill', monsterId: 'unwritten_page', count: 25 }, { kind: 'collect', itemId: 'archon_seal', count: 3 }],
    rewards: { exp: xp(63, 0.45), mesos: 28000, items: [{ itemId: 'elixir', qty: 8 }] },
  },

  // ───────────── CRY 501 · Winter Archon (ice) ─────────────
  {
    id: 'm5_winter_1', name: 'Still Life with Moths', giver: 'glacius', minLevel: 55,
    description: 'Professor Glacius opens the Fellowship with a still life. Climb to the Astral Observatory, freeze 15 Star Moths mid-flap without cracking a wing, and bring back 8 pinches of Star Dust for the display.',
    objectives: [{ kind: 'visit', mapId: 'astral_observatory' }, { kind: 'kill', monsterId: 'star_moth', count: 15 }, { kind: 'collect', itemId: 'star_dust', count: 8 }],
    rewards: { exp: xp(55, 0.35), mesos: 15000, items: [{ itemId: 'white_potion', qty: 20 }] },
  },
  {
    id: 'm5_winter_2', name: 'The Stillest Hour', giver: 'glacius', minLevel: 58,
    description: 'Rift Stalkers move faster than the eye, but ice does not need the eye. Slow 20 of them to a stop in the Void Rift and bring Glacius 8 Rift Shards, which he says will make excellent ice cubes.',
    objectives: [{ kind: 'visit', mapId: 'void_rift' }, { kind: 'kill', monsterId: 'rift_stalker', count: 20 }, { kind: 'collect', itemId: 'rift_shard', count: 8 }],
    rewards: { exp: xp(58, 0.4), mesos: 20000, items: [{ itemId: 'mana_elixir', qty: 20 }] },
  },
  {
    id: 'm5_winter_3', name: 'Cold Case', giver: 'glacius', minLevel: 63,
    description: 'The Archon Knights have been standing guard for forty years without once sitting down, so give them something to remember. Freeze 15 of them in the Archon Spire and bring Glacius 3 Archon Seals, chilled.',
    objectives: [{ kind: 'visit', mapId: 'archon_spire' }, { kind: 'kill', monsterId: 'archon_knight', count: 15 }, { kind: 'collect', itemId: 'archon_seal', count: 3 }],
    rewards: { exp: xp(63, 0.45), mesos: 28000, items: [{ itemId: 'elixir', qty: 8 }] },
  },

  // ───────────── STM 501 · Storm Archon (lightning) ─────────────
  {
    id: 'm5_storm_1', name: 'Grounding the Dome', giver: 'voltis', minLevel: 55,
    description: 'The Observatory dome is one enormous lightning rod, and the Astral Sentinels are standing in it. Professor Voltis wants them grounded: climb up, break 15 Astral Sentinels, and bring back 6 pinches of Star Dust, which she says is only charged ceiling.',
    objectives: [{ kind: 'visit', mapId: 'astral_observatory' }, { kind: 'kill', monsterId: 'astral_sentinel', count: 15 }, { kind: 'collect', itemId: 'star_dust', count: 6 }],
    rewards: { exp: xp(55, 0.35), mesos: 15000, items: [{ itemId: 'white_potion', qty: 20 }] },
  },
  {
    id: 'm5_storm_2', name: 'Faster Than the Rift', giver: 'voltis', minLevel: 58,
    description: 'The Void Rift drops things from nowhere in particular, and Voltis wants to be there before they land. Cross over, disperse 15 Null Wisps and 10 Shard Horrors, and bring back 8 Rift Shards before the thunder gets there first.',
    objectives: [{ kind: 'visit', mapId: 'void_rift' }, { kind: 'kill', monsterId: 'null_wisp', count: 15 }, { kind: 'kill', monsterId: 'shard_horror', count: 10 }, { kind: 'collect', itemId: 'rift_shard', count: 8 }],
    rewards: { exp: xp(58, 0.4), mesos: 20000, items: [{ itemId: 'mana_elixir', qty: 20 }] },
  },
  {
    id: 'm5_storm_3', name: 'Reading by Lightning', giver: 'voltis', minLevel: 63,
    description: 'The pages of the Archon Spire are blank until something lights them, so be something. Shock 20 Unwritten Pages in the Archon Spire and bring Voltis 3 Archon Seals, with the sparks still on them.',
    objectives: [{ kind: 'visit', mapId: 'archon_spire' }, { kind: 'kill', monsterId: 'unwritten_page', count: 20 }, { kind: 'collect', itemId: 'archon_seal', count: 3 }],
    rewards: { exp: xp(63, 0.45), mesos: 28000, items: [{ itemId: 'elixir', qty: 8 }] },
  },

  // ───────────── HLY 501 · Light Archon (holy) ─────────────
  {
    id: 'm5_light_1', name: 'Lamplighter Rounds', giver: 'seraphine', minLevel: 55,
    description: 'The Fellowship starts with a lamplighter\'s round. Professor Seraphine wants the Astral Observatory lit properly, which means collecting 10 pinches of Star Dust from whatever is guarding it and carrying them back to the chapel windows. Bring a light. They bring the dark.',
    objectives: [{ kind: 'visit', mapId: 'astral_observatory' }, { kind: 'collect', itemId: 'star_dust', count: 10 }],
    rewards: { exp: xp(55, 0.35), mesos: 15000, items: [{ itemId: 'white_potion', qty: 20 }] },
  },
  {
    id: 'm5_light_2', name: 'Light in the Dark Rooms', giver: 'seraphine', minLevel: 58,
    description: 'Rift Stalkers and Null Wisps both hate the light, which is the nicest thing either of them has in common with a student. Cross to the Void Rift, dispel 15 of each, and bring Seraphine 8 Rift Shards for the lantern glass.',
    objectives: [{ kind: 'visit', mapId: 'void_rift' }, { kind: 'kill', monsterId: 'rift_stalker', count: 15 }, { kind: 'kill', monsterId: 'null_wisp', count: 15 }, { kind: 'collect', itemId: 'rift_shard', count: 8 }],
    rewards: { exp: xp(58, 0.4), mesos: 20000, items: [{ itemId: 'mana_elixir', qty: 20 }] },
  },
  {
    id: 'm5_light_3', name: 'What the Page Fears', giver: 'seraphine', minLevel: 63,
    description: 'Unwritten Pages are blank because nobody has dared to write on them. Seraphine would like you to be the first. Banish 25 of them in the Archon Spire with something kind and bring her 3 Archon Seals.',
    objectives: [{ kind: 'visit', mapId: 'archon_spire' }, { kind: 'kill', monsterId: 'unwritten_page', count: 25 }, { kind: 'collect', itemId: 'archon_seal', count: 3 }],
    rewards: { exp: xp(63, 0.45), mesos: 28000, items: [{ itemId: 'elixir', qty: 8 }] },
  },

  // ───────────── SHD 501 · Night Archon (shadow) ─────────────
  {
    id: 'm5_night_1', name: 'The Eyes of the Dome', giver: 'morvane', minLevel: 55,
    description: 'Professor Morvane opens the Fellowship with a quiet lesson in being overlooked. Slip into the Astral Observatory, put down 15 Astral Sentinels before any of them turns around, and bring her 6 pinches of Star Dust. She does not say what the dust is for. She never does.',
    objectives: [{ kind: 'visit', mapId: 'astral_observatory' }, { kind: 'kill', monsterId: 'astral_sentinel', count: 15 }, { kind: 'collect', itemId: 'star_dust', count: 6 }],
    rewards: { exp: xp(55, 0.35), mesos: 15000, items: [{ itemId: 'white_potion', qty: 20 }] },
  },
  {
    id: 'm5_night_2', name: 'A Shadow Without a Sun', giver: 'morvane', minLevel: 58,
    description: 'There is no light in the Void Rift and so, technically, no shadows. Morvane wants to know what you cast anyway. Cross over, shatter 18 Shard Horrors, and bring her 8 Rift Shards for her collection of things that should not exist.',
    objectives: [{ kind: 'visit', mapId: 'void_rift' }, { kind: 'kill', monsterId: 'shard_horror', count: 18 }, { kind: 'collect', itemId: 'rift_shard', count: 8 }],
    rewards: { exp: xp(58, 0.4), mesos: 20000, items: [{ itemId: 'mana_elixir', qty: 20 }] },
  },
  {
    id: 'm5_night_3', name: 'The Knights Keep Their Own Hours', giver: 'morvane', minLevel: 63,
    description: 'Archon Knights do not blink, which makes a patient shadow all the more useful. Take 20 of them down in the Archon Spire and bring Morvane 4 Archon Seals. She says she will return them once she has read them. She will not return them.',
    objectives: [{ kind: 'visit', mapId: 'archon_spire' }, { kind: 'kill', monsterId: 'archon_knight', count: 20 }, { kind: 'collect', itemId: 'archon_seal', count: 4 }],
    rewards: { exp: xp(63, 0.45), mesos: 28000, items: [{ itemId: 'elixir', qty: 8 }] },
  },
];
