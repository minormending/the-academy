// OWNER: A9 (progression). Item definitions (consumables, etc drops, equipment).
import type { Branch, EquipSlot, IconSpec, ItemDef, StatModifier } from '../core/types';

function consumable(id: string, name: string, description: string, icon: IconSpec, price: number,
  effect: NonNullable<ItemDef['consumable']>, maxStack = 100): ItemDef {
  return { id, name, type: 'consumable', description, icon, price, sellPrice: Math.max(1, Math.floor(price * 0.25)), maxStack, consumable: effect };
}

function etc(id: string, name: string, description: string, icon: IconSpec, sellPrice: number, maxStack = 200, price = 0): ItemDef {
  return { id, name, type: 'etc', description, icon, price, sellPrice, maxStack };
}

function equip(id: string, name: string, description: string, icon: IconSpec, slot: EquipSlot, reqLevel: number,
  price: number, modifiers: StatModifier[], reqBranch?: Branch, sellPrice?: number): ItemDef {
  return {
    id, name, type: 'equip', description, icon, price, sellPrice: sellPrice ?? Math.max(1, Math.floor(price * 0.3)), maxStack: 1,
    equip: { slot, reqLevel, reqBranch, modifiers },
  };
}

const add = (stat: StatModifier['stat'], v: number): StatModifier => ({ stat, add: v });

export const ITEMS: ItemDef[] = [
  // ───────────── Consumables ─────────────
  consumable('red_potion', 'Red Potion', 'A cherry-sweet tonic. Restores 50 HP.', { glyph: 'potion', color: 0xe8413c, color2: 0xffb3a8 }, 30, { hp: 50, cooldownMs: 300 }),
  consumable('orange_potion', 'Orange Potion', 'Brewed from sunfruit peel. Restores 150 HP.', { glyph: 'potion', color: 0xff9a2e, color2: 0xffe0a8 }, 90, { hp: 150, cooldownMs: 300 }),
  consumable('white_potion', 'White Potion', 'A pearly draught that knits wounds shut. Restores 300 HP.', { glyph: 'potion', color: 0xf4f1ea, color2: 0xc9d6e6 }, 200, { hp: 300, cooldownMs: 300 }),
  consumable('blue_potion', 'Blue Potion', 'Tastes faintly of starlight. Restores 100 MP.', { glyph: 'potion', color: 0x3c7ee8, color2: 0xa8d0ff }, 40, { mp: 100, cooldownMs: 300 }),
  consumable('mana_elixir', 'Mana Elixir', 'Distilled ley-line dew. Restores 300 MP.', { glyph: 'potion', color: 0x2a3fd0, color2: 0x9be7ff }, 180, { mp: 300, cooldownMs: 300 }),
  consumable('elixir', 'Elixir', 'A rare alchemical masterpiece. Restores 50% of max HP and MP.', { glyph: 'potion', color: 0xb35cff, color2: 0xffd6ff }, 900, { hpPct: 0.5, mpPct: 0.5, cooldownMs: 1000 }),
  consumable('power_elixir', 'Power Elixir', 'Liquid sunrise in a bottle. Fully restores HP and MP.', { glyph: 'potion', color: 0xffd447, color2: 0xfff6c8 }, 2400, { hpPct: 1, mpPct: 1, cooldownMs: 1500 }),
  consumable('return_scroll', 'Return Scroll', 'Read aloud to be whisked back to the Academy campus. Late for class? Never again.', { glyph: 'scroll', color: 0xf0dca0, color2: 0x4a5bd4 }, 150, { returnToTown: true, cooldownMs: 1000 }, 50),

  // ───────────── Etc ─────────────
  etc('tome_of_unlearning', 'Tome of Unlearning', 'A violet-bound library tome that lets a student forget one Year of spells, reclaim their SP, and learn them anew. The librarian calls it revision.', { glyph: 'book', color: 0x8f6bd8, color2: 0xffd447 }, 500, 10, 2500),
  etc('snail_shell', 'Snail Shell', 'A mossy spiral shell. Prefect Finn collects these for some reason.', { glyph: 'shell', color: 0x9ccf6a, color2: 0x6b8f3e }, 2),
  etc('slime_jelly', 'Slime Jelly', 'Wobbly, sticky, faintly glowing. Do not eat.', { glyph: 'jelly', color: 0x7fd6ff, color2: 0xd8f6ff }, 4),
  etc('shroom_cap', 'Shroom Cap', 'A springy orange mushroom cap.', { glyph: 'mushroom', color: 0xff8a3d, color2: 0xfff1d6 }, 6),
  etc('thorn_spore', 'Thorn Spore', 'Prickly spores that make your nose itch.', { glyph: 'mushroom', color: 0x8a5ac8, color2: 0x7bd36b }, 9),
  etc('stump_bark', 'Stump Bark', 'Thick bark from an animated stump. Still grumpy.', { glyph: 'scale', color: 0x8a5a2b, color2: 0x5a3a1a }, 12),
  etc('bat_wing', 'Bat Wing', 'A leathery wing, cold to the touch.', { glyph: 'feather', color: 0x5a6a8a, color2: 0xbfe9ff }, 16),
  etc('yeti_fur', 'Yeti Fur', 'Shaggy white fur that crackles with static.', { glyph: 'fur', color: 0xf0f4f8, color2: 0xa8c4d8 }, 20),
  etc('wisp_essence', 'Wisp Essence', 'A drifting mote of pure cold light.', { glyph: 'orb', color: 0x9fefff, color2: 0xffffff }, 24),
  etc('imp_horn', 'Imp Horn', 'A tiny horn that is always warm.', { glyph: 'bone', color: 0xff6a2a, color2: 0x5a1a10 }, 28),
  etc('salamander_scale', 'Salamander Scale', 'Shimmers red-gold like a cooling ember.', { glyph: 'scale', color: 0xff4a1f, color2: 0xffc04d }, 32),
  etc('magma_core', 'Magma Core', 'A fist-sized heart of molten stone. Handle with tongs.', { glyph: 'gem', color: 0xff5a1f, color2: 0xffe08a }, 40),
  etc('harpy_feather', 'Harpy Feather', 'Each barb hums with a faint charge.', { glyph: 'feather', color: 0x8f6bd8, color2: 0xfff066 }, 44),
  etc('golem_shard', 'Golem Shard', 'A chip of storm-veined granite.', { glyph: 'crystal', color: 0x8a8f9a, color2: 0xfff066 }, 48),
  etc('yeti_bone', 'Yeti Bone', 'A thick, frost-white bone. Professor Morvane says it has \"good posture\".', { glyph: 'bone', color: 0xe8e4d8, color2: 0x8fd0ff }, 22),
  etc('drake_scale', 'Drake Scale', 'Thunder Drake scale, blue as a lightning flash.', { glyph: 'scale', color: 0x4a7aff, color2: 0xfff9a8 }, 56),
  etc('seal_fragment', 'Seal Fragment', 'A shard of the Sanctum\'s ancient seal, still warm with holy light.', { glyph: 'holy_cross', color: 0xffe08a, color2: 0x6a2ac8 }, 60),
  etc('void_crystal', 'Void Crystal', 'It hums a note just below hearing.', { glyph: 'crystal', color: 0x6a2ac8, color2: 0xe0b0ff }, 70),
  etc('toad_slime', 'Toad Slime', 'Bog Toad slime, green as pond water and twice as smelly. Potion-brewers swear by it; everyone else swears at it.', { glyph: 'gem', color: 0x6a9a3a, color2: 0xd4e890 }, 11),
  etc('wisp_lantern', 'Wisp Lantern', 'The papery husk a Will-o\'-Wisp leaves behind. It still glows a little, and still points the wrong way home.', { glyph: 'spark', color: 0x5ae8a0, color2: 0xf4fff8 }, 15),
  etc('crab_shard', 'Crab Shard', 'A chip of a Crystal Crab\'s geode shell. Professor Glacius reads them like tree rings.', { glyph: 'crystal', color: 0x8fd8f6, color2: 0xa898e0 }, 25),
  etc('shade_veil', 'Shade Veil', 'A scrap of frozen mist that was once someone\'s cloak. Cold enough to keep a lunch fresh for a term.', { glyph: 'ghost', color: 0xbfe6ff, color2: 0x23407a }, 30),
  etc('tome_page', 'Tome Page', 'A loose page from the Restricted Stacks, still trying to finish its sentence. Do not read it aloud.', { glyph: 'scroll', color: 0xe8d8b0, color2: 0x6a3ac8 }, 38),
  etc('ink_vial', 'Ink Vial', 'Ink wrung from an Ink Golem. It writes on its own if you leave the cap off, mostly complaints.', { glyph: 'poison', color: 0x2a2456, color2: 0x8a7ad8 }, 48),
  etc('archon_sigil', 'Archon Sigil', 'The seal of the Lich Archon, still faintly warm with stolen power.', { glyph: 'arcane_star', color: 0xc89bff, color2: 0xffd447 }, 5000, 10),

  // ───────────── Weapons ─────────────
  equip('oak_wand', 'Oak Wand', 'Every first-year\'s first wand. Smells of sawdust and ambition.', { glyph: 'wand', color: 0x9a6a3a, color2: 0x9be7ff },
    'weapon', 1, 50, [add('matk', 5)]),
  equip('willow_staff', 'Willow Staff', 'Supple willow wrapped in blue silk.', { glyph: 'staff', color: 0xb08a5a, color2: 0x7fd6ff },
    'weapon', 8, 800, [add('matk', 10)]),
  equip('sage_wand', 'Sage Wand', 'A short wand tipped with a quartz focus. Quick to cast.', { glyph: 'wand', color: 0xd8c8a8, color2: 0xc89bff },
    'weapon', 10, 1500, [add('matk', 13), add('castSpeed', 0.05)]),
  equip('ember_staff', 'Ember Staff', 'A charred staff whose gem never stops smoldering.', { glyph: 'staff', color: 0x6a2a1a, color2: 0xff7a2a },
    'weapon', 15, 5000, [add('matk', 18), add('dmgFire', 0.1)], 'fire'),
  equip('frost_staff', 'Frost Staff', 'Rime creeps along its length on warm days.', { glyph: 'staff', color: 0xbfe9ff, color2: 0x5cc8f0 },
    'weapon', 15, 5000, [add('matk', 18), add('dmgIce', 0.1)], 'ice'),
  equip('storm_staff', 'Storm Staff', 'Tiny sparks jump between your fingers when you hold it.', { glyph: 'staff', color: 0x4b2a8a, color2: 0xfff066 },
    'weapon', 15, 5000, [add('matk', 18), add('dmgLightning', 0.1)], 'lightning'),
  equip('dawn_staff', 'Dawn Staff', 'Pale ash wood capped with a sunstone. It is always faintly morning near it.', { glyph: 'staff', color: 0xf4efe0, color2: 0xffe27a },
    'weapon', 15, 5000, [add('matk', 18), add('dmgHoly', 0.1)], 'holy'),
  equip('grave_staff', 'Grave Staff', 'Blackthorn bound in grave-iron. The skull on top hums along when you cast.', { glyph: 'staff', color: 0x2a1d3d, color2: 0x8dff6a },
    'weapon', 15, 5000, [add('matk', 18), add('dmgShadow', 0.1)], 'shadow'),
  equip('inferno_staff', 'Inferno Staff', 'Forged in the cinder depths; the air ripples around it.', { glyph: 'staff', color: 0x8a1a10, color2: 0xffd447 },
    'weapon', 35, 60000, [add('matk', 28), add('dmgFire', 0.15), add('critRate', 0.03)], 'fire'),
  equip('glacier_staff', 'Glacier Staff', 'Carved from ice that has never once melted.', { glyph: 'staff', color: 0xe8f6ff, color2: 0x4fd6ff },
    'weapon', 35, 60000, [add('matk', 28), add('dmgIce', 0.15), add('critRate', 0.03)], 'ice'),
  equip('tempest_staff', 'Tempest Staff', 'A lightning rod that learned to think.', { glyph: 'staff', color: 0x2a0f58, color2: 0xffffff },
    'weapon', 35, 60000, [add('matk', 28), add('dmgLightning', 0.15), add('critRate', 0.03)], 'lightning'),
  equip('sunlit_scepter', 'Sunlit Scepter', 'A gilded scepter that hoards daylight and spends it on the wicked.', { glyph: 'staff', color: 0xffd54a, color2: 0xffffff },
    'weapon', 35, 60000, [add('matk', 28), add('dmgHoly', 0.15), add('critRate', 0.03)], 'holy'),
  equip('umbral_scepter', 'Umbral Scepter', 'Its shadow falls the wrong way, and points at whatever you should curse next.', { glyph: 'staff', color: 0x120d1a, color2: 0xb48cff },
    'weapon', 35, 60000, [add('matk', 28), add('dmgShadow', 0.15), add('critRate', 0.03)], 'shadow'),
  equip('archon_staff', 'Archon Staff', 'Torn from the Lich Archon\'s grasp. It obeys any element — reluctantly.', { glyph: 'staff', color: 0x3a1a5a, color2: 0xc89bff },
    'weapon', 45, 0, [add('matk', 36), add('dmgAll', 0.1), add('critDmg', 0.1)], undefined, 25000),

  // ───────────── Hats ─────────────
  equip('apprentice_hat', 'Apprentice Hat', 'Pointy, floppy, iconic.', { glyph: 'hat', color: 0x37419e, color2: 0xe8d36a },
    'hat', 1, 40, [add('def', 1), add('maxMp', 10)]),
  equip('scholar_cap', 'Scholar Cap', 'Worn by Academy upperclassmen. Tassel included.', { glyph: 'hat', color: 0x2a2a3a, color2: 0xe8d36a },
    'hat', 10, 1400, [add('def', 3), add('maxMp', 20), add('maxHp', 10)]),
  equip('sage_hat', 'Sage Hat', 'Embroidered with runes that hum when you think hard.', { glyph: 'hat', color: 0x6b4fa0, color2: 0xffd447 },
    'hat', 20, 9000, [add('def', 5), add('maxMp', 40), add('maxHp', 20)]),

  // ───────────── Robes ─────────────
  equip('apprentice_robe', 'Apprentice Robe', 'Standard-issue Academy uniform. Pockets full of chalk.', { glyph: 'robe', color: 0x4a5bd4, color2: 0xe8d36a },
    'robe', 1, 60, [add('def', 3), add('maxHp', 5)]),
  equip('traveler_robe', 'Traveler\'s Robe', 'Weatherproof wool with a lining of mana-silk.', { glyph: 'robe', color: 0x3f6a5a, color2: 0xd9b36c },
    'robe', 12, 2200, [add('def', 6), add('maxHp', 20), add('maxMp', 15)]),
  equip('sage_robe', 'Sage Robe', 'Flowing violet silk stitched with silver sigils.', { glyph: 'robe', color: 0x6b4fa0, color2: 0xdcdcdc },
    'robe', 20, 12000, [add('def', 9), add('maxHp', 40), add('maxMp', 30)]),

  equip('acolyte_vestments', 'Acolyte Vestments', 'White-and-gold Holy School vestments. Smell faintly of candle wax.', { glyph: 'robe', color: 0xfaf5e8, color2: 0xe3b84a },
    'robe', 22, 13000, [add('def', 9), add('maxHp', 55), add('maxMp', 25), add('hpRegen', 3)], 'holy'),
  equip('grave_robes', 'Grave Robes', 'Shadow School robes in violet-black. The hem never quite stops moving.', { glyph: 'robe', color: 0x231b33, color2: 0x7cff6b },
    'robe', 22, 13000, [add('def', 8), add('maxHp', 30), add('maxMp', 45), add('mpRegen', 3)], 'shadow'),

  // ───────────── Shoes ─────────────
  equip('soft_sandals', 'Soft Sandals', 'Comfortable. Quiet. Not great in snow.', { glyph: 'shoes', color: 0xb08a5a, color2: 0xe8d36a },
    'shoes', 1, 30, [add('def', 1)]),
  equip('traveler_boots', 'Traveler Boots', 'Sturdy boots for long roads.', { glyph: 'shoes', color: 0x6a4a2a, color2: 0xd9b36c },
    'shoes', 15, 3000, [add('def', 2), add('speed', 10)]),
  equip('wind_boots', 'Wind Boots', 'Enchanted with a gust that lifts every step.', { glyph: 'shoes', color: 0x9fefd0, color2: 0xffffff },
    'shoes', 25, 20000, [add('def', 4), add('speed', 20), add('jump', 30)]),

  // ───────────── Gloves ─────────────
  equip('cloth_gloves', 'Cloth Gloves', 'Keeps chalk dust off your fingers.', { glyph: 'gloves', color: 0xd8d0c0, color2: 0x4a5bd4 },
    'gloves', 12, 1200, [add('matk', 2), add('def', 2)]),
  equip('runed_gloves', 'Runed Gloves', 'Each knuckle bears a tiny focusing rune.', { glyph: 'gloves', color: 0x3a2a5a, color2: 0xc89bff },
    'gloves', 28, 22000, [add('matk', 4), add('def', 3), add('critRate', 0.02)]),

  // ───────────── Accessories ─────────────
  equip('quartz_ring', 'Quartz Ring', 'A simple band set with a clear focusing stone.', { glyph: 'ring', color: 0xd8c8a8, color2: 0xffffff },
    'ring', 18, 6000, [add('matk', 2), add('maxMp', 30)]),
  equip('mana_ring', 'Mana Ring', 'A sapphire ring that sips mana from the air for you.', { glyph: 'ring', color: 0xd4af37, color2: 0x3c7ee8 },
    'ring', 30, 30000, [add('matk', 4), add('maxMp', 60), add('mpRegen', 6)]),
  equip('arcane_amulet', 'Arcane Amulet', 'A star of living arcana on a silver chain.', { glyph: 'amulet', color: 0xc0c8d0, color2: 0xc89bff },
    'amulet', 35, 45000, [add('matk', 5), add('def', 4), add('maxHp', 50), add('maxMp', 60)]),

  // ───────────── Field boss trophies (Prefect Finn's Field Bounties) ─────────────
  etc('trophy_mossback_matriarch', 'Matriarch\'s Ancient Shell', 'A shell older than the Academy, still wearing its little garden. Proof for a Field Bounty.', { glyph: 'shell', color: 0x7a9a5a, color2: 0xff9ad0 }, 900, 10),
  etc('trophy_shroom_monarch', 'Monarch\'s Crown Cap', 'The Shroom Monarch\'s cap, crown still attached. It smells regal. And damp.', { glyph: 'mushroom', color: 0xd8344a, color2: 0xffd447 }, 1800, 10),
  etc('trophy_frostfang_alpha', 'Alpha\'s Frost Fang', 'A fang as long as your forearm, rimed in ice that never melts.', { glyph: 'bone', color: 0xe8f6ff, color2: 0x4fd6ff }, 3200, 10),
  etc('trophy_magmaw', 'Heart of Magmaw', 'Still beating. Slowly. Like a forge that remembers being angry.', { glyph: 'gem', color: 0xff5a1f, color2: 0xfff07a }, 5000, 10),
  etc('trophy_tempest_wyrm', 'Tempest Wyrm Horn', 'It crackles whenever someone in the room tells a lie.', { glyph: 'crystal', color: 0x8f6bd8, color2: 0xfff066 }, 7000, 10),

  // ───────────── Field boss accessories (any School; rare) ─────────────
  equip('matriarch_ring', 'Ring of the Slow Garden', 'Moss grows on it while you sleep. You heal a little; you hurry a little less.', { glyph: 'ring', color: 0x7a9a5a, color2: 0xff9ad0 },
    'ring', 8, 0, [add('matk', 3), add('maxHp', 40), add('hpRegen', 4), add('speed', -5)], undefined, 1200),
  equip('monarch_signet', 'Monarch\'s Signet', 'The royal seal of Shroom Hollow. Mushrooms bow when you pass. Critics do not.', { glyph: 'ring', color: 0xffd447, color2: 0xd8344a },
    'ring', 13, 0, [add('matk', 4), add('maxMp', 40), add('critRate', 0.04)], undefined, 3000),
  equip('alpha_fang_necklace', 'Alpha Fang Necklace', 'A pack leader\'s fang on a leather cord. Your spells bite harder — and so does the cold.', { glyph: 'amulet', color: 0xe8f6ff, color2: 0x4fd6ff },
    'amulet', 22, 0, [add('matk', 5), add('critDmg', 0.12), add('maxHp', 60), add('def', 2)], undefined, 7000),
  equip('magmaw_gauntlets', 'Magmaw Gauntlets', 'Forged from a molten titan\'s knuckles. Warm hands, heavy spells, no high-fives.', { glyph: 'gloves', color: 0x5a2a1e, color2: 0xff8a1e },
    'gloves', 32, 0, [add('matk', 7), add('dmgAll', 0.05), add('def', 5), add('castSpeed', -0.03)], undefined, 15000),
  equip('wyrmheart_amulet', 'Wyrmheart Amulet', 'A storm caught in amber. Your feet barely touch the ground, and neither do your cooldowns.', { glyph: 'amulet', color: 0x8f6bd8, color2: 0xfff066 },
    'amulet', 42, 0, [add('matk', 8), add('castSpeed', 0.05), add('cdr', 0.05), add('speed', 10), add('maxMp', 80)], undefined, 28000),
];
