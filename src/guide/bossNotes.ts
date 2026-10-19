// Writers' notes for the boss cards: how each boss fights (read from its AI in src/entities/monsters/) and how to
// beat it. Stats, matchups, drops, spawn timers and bounties on the card come from the data; only prose lives here.

export interface BossNote {
  /** One line under the name. */
  tagline: string;
  attacks: { name: string; text: string }[];
  strategy: string[];
}

export const BOSS_NOTES: Record<string, BossNote> = {
  mossback_matriarch: {
    tagline: 'A cart-sized snail with a garden on her back. The Year 1 field exam nobody tells you about.',
    attacks: [
      { name: 'Shell Spin', text: 'She tucks in for almost a second, then spins across the ground like a millstone. Hits harder than her touch.' },
      { name: 'Slime Spit', text: 'Two or three globs arc to spots marked on the ground; each leaves a slime puddle that hurts while you stand in it.' },
      { name: 'Call Brood', text: 'Two or three Moss Snails crawl out to help (never more than four at once).' },
    ],
    strategy: [
      'Fight her from a platform: Shell Spin only travels along the ground, and you can drop back down when it ends.',
      'Step out of the marked circles before the slime lands, and never stand in an old puddle to cast.',
      'Clear the brood with Arcane Orb or Arcane Nova so they stop body-blocking your bolts.',
    ],
  },
  shroom_monarch: {
    tagline: 'The mushrooms of Shroom Hollow crowned a king, and he jumps like one.',
    attacks: [
      { name: 'Royal Slam', text: 'He crouches, leaps to a marked spot and slams down. Two shockwaves then roll outward along the ground: jump them.' },
      { name: 'Spore Cloud', text: 'Marked spots bloom into lingering spore clouds that poison you while you are inside.' },
      { name: 'Royal Guard', text: 'Two or three Cap and Thorn Shrooms answer his call (up to three at a time).' },
    ],
    strategy: [
      'Watch the crouch: when he lands, jump straight up and let both shockwaves pass under you.',
      'Fight from outside the spore clouds; they outlast his attack, so reposition rather than tank them.',
      'He is immune to poison, so Shadow students should lean on curses and direct damage here.',
    ],
  },
  frostfang_alpha: {
    tagline: 'The yetis of Frostfang have an alpha, and it has noticed the survey team.',
    attacks: [
      { name: 'Roar', text: 'He rears back and roars: the screen shakes, he moves faster for a few seconds, and icicles shake loose across the arena.' },
      { name: 'Ground Pound', text: 'An overhead pound hits the zone in front of him, then a line of icicles falls from above, the first one on you.' },
      { name: 'Charge', text: 'After a short wind-up he barrels across the ground, hitting harder than his touch.' },
    ],
    strategy: [
      'Icicles show a column on the ground before they drop. Keep moving sideways after every pound.',
      'Back off during the post-roar frenzy and let it run out; then punish him.',
      'He cannot be chilled. Ice students should bring freezes and raw damage instead of slows.',
    ],
  },
  magmaw: {
    tagline: 'A walking forge. Slow swings, landslide hits, and it gets angrier as it cracks.',
    attacks: [
      { name: 'Heavy Swing', text: 'Arms rise for almost a second over a big marked zone in front of it, then the slam.' },
      { name: 'Geysers', text: 'Lava erupts from marked spots, the first under you and more to either side (more and faster once enraged).' },
      { name: 'Enrage', text: 'Below 30% HP it calls two Ember Imps and sets off a geyser volley, then fights faster for the rest of the battle.' },
    ],
    strategy: [
      'Its swing is slow and telegraphed: stay just outside the marked zone and cast between swings.',
      'Save a burst cooldown for the enrage, and clear the imps quickly so they do not trap you in a geyser.',
      'It is immune to burn and resists fire. Ice and Shadow students have the easiest time.',
    ],
  },
  tempest_wyrm: {
    tagline: 'A storm drake circling the observatory, calling lightning on anything that moves.',
    attacks: [
      { name: 'Dive', text: 'It climbs, then dives across the arena, hitting harder than its touch.' },
      { name: 'Storm Call', text: 'Lightning strikes marked columns around you.' },
      { name: 'Storm Sweep', text: 'A wall of marked columns marches across the arena, one after another.' },
    ],
    strategy: [
      'It hovers and keeps its distance: projectiles, beams and chains reach it more reliably than close cones.',
      'During Storm Sweep, run against the direction of the sweep through a column that has already struck.',
      'It cannot be shocked and resists lightning; Ice and Holy are its weaknesses.',
    ],
  },
  lich_archon: {
    tagline: 'Archmage Valdris, forty years after he bound himself to the ley-heart. Your Final Thesis.',
    attacks: [
      { name: 'Orb Volley', text: 'A fan of void orbs. Enraged, he fires two volleys of seven, faster.' },
      { name: 'Ground Slam', text: 'Dark pillars burst from a marked zone under you; enraged, a second zone opens nearby.' },
      { name: 'Teleport', text: 'He vanishes and reappears on the far side of you.' },
      { name: 'Summon Whispers', text: 'Two or three Void Wisps join the fight; enraged, three at a time and more often.' },
      { name: 'Enrage', text: 'Below 30% HP he glows, moves faster and attacks with much shorter pauses.' },
    ],
    strategy: [
      'Bring stacks of potions on your hotbar and keep Return Scrolls in reserve. The Sanctum is a long walk.',
      'Kill the Void Wisps as they arrive: they are weak to Holy and resist Shadow just like their master.',
      'After every Teleport, turn around. He always lands behind you.',
      'Holy students hit his weakness. Shadow students fight at half damage: lean on poison, summons and patience.',
    ],
  },
};
